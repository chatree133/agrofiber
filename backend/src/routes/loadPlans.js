import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';

// Ensure directories exist
const uploadDir = path.resolve('src/public/uploads/pod_photos');
const sigDir = path.resolve('src/public/uploads/signatures');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(sigDir)) {
  fs.mkdirSync(sigDir, { recursive: true });
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'pod-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // limit 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

const router = Router();
router.use(authenticate);

const dispatcherRoles = allowRoles('admin', 'warehouse_manager', 'wms');
const driverRoles = allowRoles('admin', 'driver', 'warehouse', 'wms');

function getUserId(req) {
  const raw = req.user?.sub;
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Invalid authenticated user');
  }
  return userId;
}

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be greater than 0`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function formatTime(timeVal) {
  if (!timeVal) return null;
  if (timeVal instanceof Date) {
    return timeVal.toISOString().substring(11, 16); // "HH:mm" from "1970-01-01THH:mm:ss.sssZ"
  }
  return String(timeVal).substring(0, 5);
}

// 1. Get active vehicles
router.get('/vehicles', dispatcherRoles, asyncHandler(async (req, res) => {
  const includeInactive = parseBoolean(req.query.includeInactive, false);
  const rows = await mssqlQuery('DEFAULT', `
    SELECT VehicleId, LicensePlate, VehicleType, MaxWeightKg, MaxVolumeCbm, WorkingStart, WorkingEnd, IsActive
    FROM dbo.Vehicles
    ${includeInactive ? '' : 'WHERE IsActive = 1'}
    ORDER BY LicensePlate
  `);
  res.json({
    data: rows.map(r => ({
      ...r,
      WorkingStart: formatTime(r.WorkingStart),
      WorkingEnd: formatTime(r.WorkingEnd),
    }))
  });
}));

router.get('/driver-users', dispatcherRoles, asyncHandler(async (_req, res) => {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT u.UserId, u.Username, u.StaffId, u.DisplayName
    FROM dbo.Users u
    WHERE u.IsActive = 1
    ORDER BY u.DisplayName, u.Username
  `);
  res.json({ data: rows });
}));

router.post('/vehicles', dispatcherRoles, asyncHandler(async (req, res) => {
  const licensePlate = String(req.body.licensePlate || '').trim();
  const vehicleType = String(req.body.vehicleType || '').trim();
  const maxWeightKg = parsePositiveNumber(req.body.maxWeightKg, 'maxWeightKg');
  const maxVolumeCbm = parsePositiveNumber(req.body.maxVolumeCbm, 'maxVolumeCbm');
  const workingStart = req.body.workingStart ? String(req.body.workingStart).trim() : null;
  const workingEnd = req.body.workingEnd ? String(req.body.workingEnd).trim() : null;
  const isActive = parseBoolean(req.body.isActive, true);

  if (!licensePlate) return res.status(400).json({ message: 'licensePlate is required' });
  if (!vehicleType) return res.status(400).json({ message: 'vehicleType is required' });

  // Time format validation
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (workingStart && !timeRegex.test(workingStart)) {
    return res.status(400).json({ message: 'Invalid workingStart format. Must be HH:mm' });
  }
  if (workingEnd && !timeRegex.test(workingEnd)) {
    return res.status(400).json({ message: 'Invalid workingEnd format. Must be HH:mm' });
  }

  const exists = await mssqlQuery('DEFAULT', `
    SELECT 1 AS ExistsFlag
    FROM dbo.Vehicles
    WHERE LicensePlate = @licensePlate
  `, {
    inputs: {
      licensePlate: { type: sql.NVarChar(30), value: licensePlate },
    },
  });

  if (exists.length) return res.status(409).json({ message: 'License plate already exists' });

  const rows = await mssqlQuery('DEFAULT', `
    INSERT INTO dbo.Vehicles (LicensePlate, VehicleType, MaxWeightKg, MaxVolumeCbm, WorkingStart, WorkingEnd, IsActive)
    OUTPUT inserted.VehicleId, inserted.LicensePlate, inserted.VehicleType, inserted.MaxWeightKg, inserted.MaxVolumeCbm, inserted.WorkingStart, inserted.WorkingEnd, inserted.IsActive
    VALUES (@licensePlate, @vehicleType, @maxWeightKg, @maxVolumeCbm, @workingStart, @workingEnd, @isActive)
  `, {
    inputs: {
      licensePlate: { type: sql.NVarChar(30), value: licensePlate },
      vehicleType: { type: sql.NVarChar(50), value: vehicleType },
      maxWeightKg: { type: sql.Decimal(18, 4), value: maxWeightKg },
      maxVolumeCbm: { type: sql.Decimal(18, 4), value: maxVolumeCbm },
      workingStart: { type: sql.VarChar(5), value: workingStart },
      workingEnd: { type: sql.VarChar(5), value: workingEnd },
      isActive: { type: sql.Bit, value: isActive },
    },
  });

  const formattedRow = {
    ...rows[0],
    WorkingStart: formatTime(rows[0].WorkingStart),
    WorkingEnd: formatTime(rows[0].WorkingEnd),
  };

  res.status(201).json({ data: formattedRow });
}));

router.put('/vehicles/:vehicleId', dispatcherRoles, asyncHandler(async (req, res) => {
  const vehicleId = parsePositiveInt(req.params.vehicleId, 'vehicleId');
  const licensePlate = String(req.body.licensePlate || '').trim();
  const vehicleType = String(req.body.vehicleType || '').trim();
  const maxWeightKg = parsePositiveNumber(req.body.maxWeightKg, 'maxWeightKg');
  const maxVolumeCbm = parsePositiveNumber(req.body.maxVolumeCbm, 'maxVolumeCbm');
  const workingStart = req.body.workingStart ? String(req.body.workingStart).trim() : null;
  const workingEnd = req.body.workingEnd ? String(req.body.workingEnd).trim() : null;
  const isActive = parseBoolean(req.body.isActive, true);

  if (!licensePlate) return res.status(400).json({ message: 'licensePlate is required' });
  if (!vehicleType) return res.status(400).json({ message: 'vehicleType is required' });

  // Time format validation
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (workingStart && !timeRegex.test(workingStart)) {
    return res.status(400).json({ message: 'Invalid workingStart format. Must be HH:mm' });
  }
  if (workingEnd && !timeRegex.test(workingEnd)) {
    return res.status(400).json({ message: 'Invalid workingEnd format. Must be HH:mm' });
  }

  const exists = await mssqlQuery('DEFAULT', `
    SELECT 1 AS ExistsFlag
    FROM dbo.Vehicles
    WHERE LicensePlate = @licensePlate AND VehicleId <> @vehicleId
  `, {
    inputs: {
      vehicleId: { type: sql.Int, value: vehicleId },
      licensePlate: { type: sql.NVarChar(30), value: licensePlate },
    },
  });

  if (exists.length) return res.status(409).json({ message: 'License plate already exists' });

  const rows = await mssqlQuery('DEFAULT', `
    UPDATE dbo.Vehicles
    SET LicensePlate = @licensePlate,
        VehicleType = @vehicleType,
        MaxWeightKg = @maxWeightKg,
        MaxVolumeCbm = @maxVolumeCbm,
        WorkingStart = @workingStart,
        WorkingEnd = @workingEnd,
        IsActive = @isActive
    OUTPUT inserted.VehicleId, inserted.LicensePlate, inserted.VehicleType, inserted.MaxWeightKg, inserted.MaxVolumeCbm, inserted.WorkingStart, inserted.WorkingEnd, inserted.IsActive
    WHERE VehicleId = @vehicleId
  `, {
    inputs: {
      vehicleId: { type: sql.Int, value: vehicleId },
      licensePlate: { type: sql.NVarChar(30), value: licensePlate },
      vehicleType: { type: sql.NVarChar(50), value: vehicleType },
      maxWeightKg: { type: sql.Decimal(18, 4), value: maxWeightKg },
      maxVolumeCbm: { type: sql.Decimal(18, 4), value: maxVolumeCbm },
      workingStart: { type: sql.VarChar(5), value: workingStart },
      workingEnd: { type: sql.VarChar(5), value: workingEnd },
      isActive: { type: sql.Bit, value: isActive },
    },
  });

  if (!rows.length) return res.status(404).json({ message: 'Vehicle not found' });
  
  const formattedRow = {
    ...rows[0],
    WorkingStart: formatTime(rows[0].WorkingStart),
    WorkingEnd: formatTime(rows[0].WorkingEnd),
  };

  res.json({ data: formattedRow });
}));

// 2. Get active drivers
router.get('/drivers', dispatcherRoles, asyncHandler(async (req, res) => {
  const includeInactive = parseBoolean(req.query.includeInactive, false);
  const rows = await mssqlQuery('DEFAULT', `
    SELECT d.DriverId, d.UserId, d.DriverName, d.Phone, d.PreferredProvinceId, d.IsActive, u.Username, u.DisplayName, p.PROVINCE_THAI as PreferredProvince
    FROM dbo.Drivers d
    JOIN dbo.Users u ON u.UserId = d.UserId
    JOIN dbo.provinces p ON p.PROVINCE_ID = d.PreferredProvinceId
    ${includeInactive ? '' : 'WHERE d.IsActive = 1'}
    ORDER BY d.DriverName
  `);
  res.json({ data: rows });
}));

router.post('/drivers', dispatcherRoles, asyncHandler(async (req, res) => {
  const userId = parsePositiveInt(req.body.userId, 'userId');
  const driverName = String(req.body.driverName || '').trim();
  const phone = String(req.body.phone || '').trim() || null;
  const preferredProvince = String(req.body.preferredProvince || '').trim() || null;
  const preferredProvinceId = parsePositiveInt(req.body.preferredProvinceId, 'preferredProvinceId') || null;
  const isActive = parseBoolean(req.body.isActive, true);

  if (!driverName) return res.status(400).json({ message: 'driverName is required' });

  const userRows = await mssqlQuery('DEFAULT', `
    SELECT UserId
    FROM dbo.Users
    WHERE UserId = @userId AND IsActive = 1
  `, {
    inputs: {
      userId: { type: sql.Int, value: userId },
    },
  });

  if (!userRows.length) return res.status(400).json({ message: 'Active user not found' });

  const exists = await mssqlQuery('DEFAULT', `
    SELECT 1 AS ExistsFlag
    FROM dbo.Drivers
    WHERE UserId = @userId
  `, {
    inputs: {
      userId: { type: sql.Int, value: userId },
    },
  });

  if (exists.length) return res.status(409).json({ message: 'User is already assigned as a driver' });

  const rows = await mssqlQuery('DEFAULT', `
    INSERT INTO dbo.Drivers (UserId, DriverName, Phone, PreferredProvince, IsActive, PreferredProvinceId)
    OUTPUT inserted.DriverId, inserted.UserId, inserted.DriverName, inserted.Phone, inserted.PreferredProvince, inserted.IsActive
    VALUES (@userId, @driverName, @phone, @preferredProvince, @isActive, @preferredProvinceId)
  `, {
    inputs: {
      userId: { type: sql.Int, value: userId },
      driverName: { type: sql.NVarChar(200), value: driverName },
      phone: { type: sql.NVarChar(30), value: phone },
      preferredProvince: { type: sql.NVarChar(100), value: preferredProvince },
      isActive: { type: sql.Bit, value: isActive },
      preferredProvinceId: { type: sql.Int, value: preferredProvinceId },
    },
  });

  res.status(201).json({ data: rows[0] });
}));

router.put('/drivers/:driverId', dispatcherRoles, asyncHandler(async (req, res) => {
  const driverId = parsePositiveInt(req.params.driverId, 'driverId');
  const userId = parsePositiveInt(req.body.userId, 'userId');
  const driverName = String(req.body.driverName || '').trim();
  const phone = String(req.body.phone || '').trim() || null;
  const preferredProvince = String(req.body.preferredProvince || '').trim() || null;
  const preferredProvinceId = parsePositiveInt(req.body.preferredProvinceId, 'preferredProvinceId') || null;
  const isActive = parseBoolean(req.body.isActive, true);

  if (!driverName) return res.status(400).json({ message: 'driverName is required' });

  const userRows = await mssqlQuery('DEFAULT', `
    SELECT UserId
    FROM dbo.Users
    WHERE UserId = @userId AND IsActive = 1
  `, {
    inputs: {
      userId: { type: sql.Int, value: userId },
    },
  });

  if (!userRows.length) return res.status(400).json({ message: 'Active user not found' });

  const exists = await mssqlQuery('DEFAULT', `
    SELECT 1 AS ExistsFlag
    FROM dbo.Drivers
    WHERE UserId = @userId AND DriverId <> @driverId
  `, {
    inputs: {
      driverId: { type: sql.Int, value: driverId },
      userId: { type: sql.Int, value: userId },
    },
  });

  if (exists.length) return res.status(409).json({ message: 'User is already assigned as a driver' });

  const rows = await mssqlQuery('DEFAULT', `
    UPDATE dbo.Drivers
    SET UserId = @userId,
        DriverName = @driverName,
        Phone = @phone,
        PreferredProvince = @preferredProvince,
        PreferredProvinceId = @preferredProvinceId,
        IsActive = @isActive
    OUTPUT inserted.DriverId, inserted.UserId, inserted.DriverName, inserted.Phone, inserted.PreferredProvince, inserted.IsActive
    WHERE DriverId = @driverId
  `, {
    inputs: {
      driverId: { type: sql.Int, value: driverId },
      userId: { type: sql.Int, value: userId },
      driverName: { type: sql.NVarChar(200), value: driverName },
      phone: { type: sql.NVarChar(30), value: phone },
      preferredProvince: { type: sql.NVarChar(100), value: preferredProvince },
      preferredProvinceId: { type: sql.Int, value: preferredProvinceId },
      isActive: { type: sql.Bit, value: isActive },
    },
  });

  if (!rows.length) return res.status(404).json({ message: 'Driver not found' });
  res.json({ data: rows[0] });
}));

// 3. Get pending Delivery Orders (DeliveryType = 'delivery', Status = 'draft', not assigned to any load plan)
router.get('/pending-dos', dispatcherRoles, asyncHandler(async (req, res) => {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      do.DeliveryOrderId, do.DocumentNo, do.CustomerId, c.CustomerName, c.CustomerCode,
      do.DocumentDate, do.ShipToAddress,
      ISNULL(SUM(
        COALESCE(
          NULLIF(iw.WidthM * il.LengthM * (th.ThicknessMm / 1000.0) * 770.0, 0),
          1.5
        ) * dol.Quantity
      ), 0) AS TotalWeightKg,
      ISNULL(SUM(
        COALESCE(
          NULLIF(iw.WidthM * il.LengthM * (th.ThicknessMm / 1000.0), 0),
          0.002
        ) * dol.Quantity
      ), 0) AS TotalVolumeCbm,
      COUNT(dol.DeliveryOrderLineId) AS TotalLines,
      ISNULL(SUM(dol.Quantity), 0) AS TotalQty
    FROM dbo.DeliveryOrders do
    JOIN dbo.Customers c ON c.CustomerId = do.CustomerId
    JOIN dbo.DeliveryOrderLines dol ON dol.DeliveryOrderId = do.DeliveryOrderId
    JOIN dbo.Items i ON i.ItemId = dol.ItemId
    JOIN dbo.ItemLengths il ON i.LengthId = il.LengthId
    JOIN dbo.ItemWidths iw ON i.WidthId = iw.WidthId
    LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
    WHERE do.DeliveryType = 'delivery' AND do.Status = 'draft'
      AND NOT EXISTS (
        SELECT 1 FROM dbo.WmsLoadPlanLines lpl WHERE lpl.DeliveryOrderId = do.DeliveryOrderId
      )
    GROUP BY do.DeliveryOrderId, do.DocumentNo, do.CustomerId, c.CustomerName, c.CustomerCode, do.DocumentDate, do.ShipToAddress
    ORDER BY do.DeliveryOrderId DESC
  `);

  res.json({
    data: rows.map(r => ({
      id: r.DeliveryOrderId,
      deliveryOrderId: r.DeliveryOrderId,
      documentNo: r.DocumentNo,
      customerId: r.CustomerId,
      customerCode: r.CustomerCode,
      customerName: r.CustomerName,
      documentDate: r.DocumentDate,
      shipToAddress: r.ShipToAddress,
      totalWeightKg: Number(r.TotalWeightKg),
      totalVolumeCbm: Number(r.TotalVolumeCbm),
      totalLines: r.TotalLines,
      totalQty: Number(r.TotalQty),
    }))
  });
}));

// Helper to generate LoadPlanNo: LP-YYYYMMDD-XXXX
async function generateLoadPlanNo(tx) {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `LP-${todayStr}-`;
  
  const req = new sql.Request(tx);
  req.input('prefix', sql.NVarChar(50), prefix + '%');
  const res = await req.query(`
    SELECT TOP 1 LoadPlanNo
    FROM dbo.WmsLoadPlans
    WHERE LoadPlanNo LIKE @prefix
    ORDER BY LoadPlanNo DESC
  `);

  let nextSeq = 1;
  if (res.recordset.length > 0) {
    const lastNo = res.recordset[0].LoadPlanNo;
    const parts = lastNo.split('-');
    const seqStr = parts[parts.length - 1];
    nextSeq = parseInt(seqStr, 10) + 1;
  }

  return prefix + String(nextSeq).padStart(4, '0');
}

// 4. Create a Load Plan
router.post('/', dispatcherRoles, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { planDate, vehicleId, driverId, remarks, deliveryOrderIds } = req.body;

  if (!planDate) return res.status(400).json({ message: 'planDate is required' });
  if (!vehicleId) return res.status(400).json({ message: 'vehicleId is required' });
  if (!driverId) return res.status(400).json({ message: 'driverId is required' });
  if (!Array.isArray(deliveryOrderIds) || deliveryOrderIds.length === 0) {
    return res.status(400).json({ message: 'At least one deliveryOrderId is required' });
  }

  const result = await mssqlTransaction('DEFAULT', async (tx) => {
    // Check vehicle limits
    const vReq = new sql.Request(tx);
    vReq.input('vId', sql.Int, vehicleId);
    const vehicleRes = await vReq.query(`SELECT MaxWeightKg, MaxVolumeCbm FROM dbo.Vehicles WHERE VehicleId = @vId`);
    if (vehicleRes.recordset.length === 0) throw new Error('Vehicle not found');

    // Calculate actual weight/volume of the selected DOs
    const doQueryReq = new sql.Request(tx);
    const placeHolders = deliveryOrderIds.map((id, index) => {
      const pName = `doId_${index}`;
      doQueryReq.input(pName, sql.Int, id);
      return `@${pName}`;
    }).join(',');

    const doRes = await doQueryReq.query(`
      SELECT
        dol.DeliveryOrderId,
        ISNULL(SUM(COALESCE(NULLIF(i.WidthM * i.LengthM * (th.ThicknessMm / 1000.0) * 1350.0, 0), 1.5) * dol.Quantity), 0) AS LineWeight,
        ISNULL(SUM(COALESCE(NULLIF(i.WidthM * i.LengthM * (th.ThicknessMm / 1000.0), 0), 0.002) * dol.Quantity), 0) AS LineVolume
      FROM dbo.DeliveryOrderLines dol
      JOIN dbo.Items i ON i.ItemId = dol.ItemId
      LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
      WHERE dol.DeliveryOrderId IN (${placeHolders})
      GROUP BY dol.DeliveryOrderId
    `);

    let totalWeight = 0;
    let totalVolume = 0;
    doRes.recordset.forEach(r => {
      totalWeight += Number(r.LineWeight);
      totalVolume += Number(r.LineVolume);
    });

    // Generate LP number
    const loadPlanNo = await generateLoadPlanNo(tx);

    // Insert header
    const headerReq = new sql.Request(tx);
    headerReq.input('lpNo', sql.NVarChar(50), loadPlanNo);
    headerReq.input('planDate', sql.Date, planDate);
    headerReq.input('vId', sql.Int, vehicleId);
    headerReq.input('dId', sql.Int, driverId);
    headerReq.input('weight', sql.Decimal(18, 4), totalWeight);
    headerReq.input('volume', sql.Decimal(18, 4), totalVolume);
    headerReq.input('remarks', sql.NVarChar(1000), remarks || null);
    headerReq.input('createdBy', sql.Int, userId);

    const insertHeaderRes = await headerReq.query(`
      INSERT INTO dbo.WmsLoadPlans (LoadPlanNo, PlanDate, VehicleId, DriverId, Status, TotalWeightKg, TotalVolumeCbm, Remarks, CreatedBy)
      OUTPUT INSERTED.LoadPlanId
      VALUES (@lpNo, @planDate, @vId, @dId, 'draft', @weight, @volume, @remarks, @createdBy)
    `);
    const loadPlanId = insertHeaderRes.recordset[0].LoadPlanId;

    // Insert lines with sequences
    for (let idx = 0; idx < deliveryOrderIds.length; idx++) {
      const doId = deliveryOrderIds[idx];
      const lineReq = new sql.Request(tx);
      lineReq.input('lpId', sql.Int, loadPlanId);
      lineReq.input('doId', sql.Int, doId);
      lineReq.input('seq', sql.Int, idx + 1);
      await lineReq.query(`
        INSERT INTO dbo.WmsLoadPlanLines (LoadPlanId, DeliveryOrderId, StopSequence, DeliveryStatus)
        VALUES (@lpId, @doId, @seq, 'pending')
      `);
    }

    return { loadPlanId, loadPlanNo };
  });

  res.status(201).json({ data: result });
}));

// 5. Get all load plans
router.get('/', dispatcherRoles, asyncHandler(async (req, res) => {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      lp.LoadPlanId, lp.LoadPlanNo, lp.PlanDate, lp.Status,
      lp.TotalWeightKg, lp.TotalVolumeCbm, lp.Remarks, lp.CreatedAt,
      v.LicensePlate, v.VehicleType, d.DriverName, u.DisplayName AS CreatedByName
    FROM dbo.WmsLoadPlans lp
    JOIN dbo.Vehicles v ON v.VehicleId = lp.VehicleId
    JOIN dbo.Drivers d ON d.DriverId = lp.DriverId
    JOIN dbo.Users u ON u.UserId = lp.CreatedBy
    ORDER BY lp.PlanDate DESC, lp.LoadPlanId DESC
  `);

  res.json({
    data: rows.map(r => ({
      id: r.LoadPlanId,
      loadPlanId: r.LoadPlanId,
      loadPlanNo: r.LoadPlanNo,
      planDate: r.PlanDate,
      status: r.Status,
      totalWeightKg: Number(r.TotalWeightKg),
      totalVolumeCbm: Number(r.TotalVolumeCbm),
      remarks: r.Remarks,
      createdAt: r.CreatedAt,
      licensePlate: r.LicensePlate,
      vehicleType: r.VehicleType,
      driverName: r.DriverName,
      createdByName: r.CreatedByName,
    }))
  });
}));

// 6. Get detail of a specific load plan
router.get('/:id', dispatcherRoles, asyncHandler(async (req, res) => {
  const lpId = Number(req.params.id);
  
  const headerRows = await mssqlQuery('DEFAULT', `
    SELECT
      lp.LoadPlanId, lp.LoadPlanNo, lp.PlanDate, lp.Status,
      lp.TotalWeightKg, lp.TotalVolumeCbm, lp.Remarks, lp.CreatedAt,
      v.VehicleId, v.LicensePlate, v.VehicleType, v.MaxWeightKg, v.MaxVolumeCbm, v.WorkingStart, v.WorkingEnd,
      d.DriverId, d.DriverName, d.Phone, u.DisplayName AS CreatedByName
    FROM dbo.WmsLoadPlans lp
    JOIN dbo.Vehicles v ON v.VehicleId = lp.VehicleId
    JOIN dbo.Drivers d ON d.DriverId = lp.DriverId
    JOIN dbo.Users u ON u.UserId = lp.CreatedBy
    WHERE lp.LoadPlanId = @lpId
  `, { inputs: { lpId: { type: sql.Int, value: lpId } } });

  if (headerRows.length === 0) {
    return res.status(404).json({ message: 'Load plan not found' });
  }

  const linesRows = await mssqlQuery('DEFAULT', `
    SELECT
      lpl.LoadPlanLineId, lpl.StopSequence, lpl.DeliveryStatus,
      do.DeliveryOrderId, do.DocumentNo, do.ShipToAddress, do.DocumentDate,
      c.CustomerName, c.CustomerCode,
      ISNULL(SUM(COALESCE(NULLIF(i.WidthM * i.LengthM * (th.ThicknessMm / 1000.0) * 1350.0, 0), 1.5) * dol.Quantity), 0) AS LineWeight,
      ISNULL(SUM(COALESCE(NULLIF(i.WidthM * i.LengthM * (th.ThicknessMm / 1000.0), 0), 0.002) * dol.Quantity), 0) AS LineVolume
    FROM dbo.WmsLoadPlanLines lpl
    JOIN dbo.DeliveryOrders do ON do.DeliveryOrderId = lpl.DeliveryOrderId
    JOIN dbo.Customers c ON c.CustomerId = do.CustomerId
    JOIN dbo.DeliveryOrderLines dol ON dol.DeliveryOrderId = do.DeliveryOrderId
    JOIN dbo.Items i ON i.ItemId = dol.ItemId
    LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
    WHERE lpl.LoadPlanId = @lpId
    GROUP BY lpl.LoadPlanLineId, lpl.StopSequence, lpl.DeliveryStatus, do.DeliveryOrderId, do.DocumentNo, do.ShipToAddress, do.DocumentDate, c.CustomerName, c.CustomerCode
    ORDER BY lpl.StopSequence ASC
  `, { inputs: { lpId: { type: sql.Int, value: lpId } } });

  res.json({
    data: {
      id: headerRows[0].LoadPlanId,
      loadPlanId: headerRows[0].LoadPlanId,
      loadPlanNo: headerRows[0].LoadPlanNo,
      planDate: headerRows[0].PlanDate,
      status: headerRows[0].Status,
      totalWeightKg: Number(headerRows[0].TotalWeightKg),
      totalVolumeCbm: Number(headerRows[0].TotalVolumeCbm),
      remarks: headerRows[0].Remarks,
      createdAt: headerRows[0].CreatedAt,
      createdByName: headerRows[0].CreatedByName,
      vehicle: {
        id: headerRows[0].VehicleId,
        licensePlate: headerRows[0].LicensePlate,
        vehicleType: headerRows[0].VehicleType,
        maxWeightKg: Number(headerRows[0].MaxWeightKg),
        maxVolumeCbm: Number(headerRows[0].MaxVolumeCbm),
        workingStart: formatTime(headerRows[0].WorkingStart),
        workingEnd: formatTime(headerRows[0].WorkingEnd),
      },
      driver: {
        id: headerRows[0].DriverId,
        driverName: headerRows[0].DriverName,
        phone: headerRows[0].Phone,
      },
      lines: linesRows.map(l => ({
        id: l.LoadPlanLineId,
        loadPlanLineId: l.LoadPlanLineId,
        stopSequence: l.StopSequence,
        deliveryStatus: l.DeliveryStatus,
        deliveryOrderId: l.DeliveryOrderId,
        documentNo: l.DocumentNo,
        shipToAddress: l.ShipToAddress,
        documentDate: l.DocumentDate,
        customerName: l.CustomerName,
        customerCode: l.CustomerCode,
        weightKg: Number(l.LineWeight),
        volumeCbm: Number(l.LineVolume),
      }))
    }
  });
}));

// 7. Update status of a load plan
router.put('/:id/status', dispatcherRoles, asyncHandler(async (req, res) => {
  const lpId = Number(req.params.id);
  const { status } = req.body;

  const allowedStatuses = ['draft', 'ready', 'in_transit', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  await mssqlTransaction('DEFAULT', async (tx) => {
    const updateReq = new sql.Request(tx);
    updateReq.input('lpId', sql.Int, lpId);
    updateReq.input('status', sql.NVarChar(30), status);
    
    // Update LoadPlan Status
    await updateReq.query(`UPDATE dbo.WmsLoadPlans SET Status = @status WHERE LoadPlanId = @lpId`);

    // If LoadPlan status is in_transit, update all DOs inside to 'in_transit'
    if (status === 'in_transit') {
      await updateReq.query(`
        UPDATE dbo.DeliveryOrders
        SET Status = 'in_transit'
        WHERE DeliveryOrderId IN (
          SELECT DeliveryOrderId FROM dbo.WmsLoadPlanLines WHERE LoadPlanId = @lpId
        )
      `);
    } else if (status === 'cancelled') {
      // Revert DO statuses to 'draft'
      await updateReq.query(`
        UPDATE dbo.DeliveryOrders
        SET Status = 'draft'
        WHERE DeliveryOrderId IN (
          SELECT DeliveryOrderId FROM dbo.WmsLoadPlanLines WHERE LoadPlanId = @lpId
        )
      `);
    }
  });

  res.json({ message: 'Load plan status updated successfully' });
}));

// 8. Driver Portal: Get today's active shipments for logged-in driver
router.get('/drivers/me/today', driverRoles, asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  // Find DriverId for this UserId
  const dRes = await mssqlQuery('DEFAULT', `SELECT DriverId FROM dbo.Drivers WHERE UserId = @userId`, {
    inputs: { userId: { type: sql.Int, value: userId } }
  });

  if (dRes.length === 0) {
    return res.status(404).json({ message: 'Driver profile not found for this user account' });
  }
  const driverId = dRes[0].DriverId;

  // Get active load plans for today
  const lpRows = await mssqlQuery('DEFAULT', `
    SELECT lp.LoadPlanId, lp.LoadPlanNo, lp.PlanDate, lp.Status,
           v.LicensePlate, v.VehicleType
    FROM dbo.WmsLoadPlans lp
    JOIN dbo.Vehicles v ON v.VehicleId = lp.VehicleId
    WHERE lp.DriverId = @driverId 
      AND lp.PlanDate = CAST(SYSUTCDATETIME() AS DATE)
      AND lp.Status IN ('ready', 'in_transit', 'completed')
    ORDER BY lp.LoadPlanId DESC
  `, { inputs: { driverId: { type: sql.Int, value: driverId } } });

  if (lpRows.length === 0) {
    return res.json({ data: [] });
  }

  // Fetch all lines for these plans
  const planIds = lpRows.map(lp => lp.LoadPlanId).join(',');
  const linesRows = await mssqlQuery('DEFAULT', `
    SELECT
      lpl.LoadPlanLineId, lpl.LoadPlanId, lpl.StopSequence, lpl.DeliveryStatus,
      do.DeliveryOrderId, do.DocumentNo, do.ShipToAddress, do.DocumentDate,
      c.CustomerName, c.CustomerCode,
      ISNULL(SUM(COALESCE(NULLIF(i.WidthM * i.LengthM * (th.ThicknessMm / 1000.0) * 1350.0, 0), 1.5) * dol.Quantity), 0) AS LineWeight,
      ISNULL(SUM(COALESCE(NULLIF(i.WidthM * i.LengthM * (th.ThicknessMm / 1000.0), 0), 0.002) * dol.Quantity), 0) AS LineVolume
    FROM dbo.WmsLoadPlanLines lpl
    JOIN dbo.DeliveryOrders do ON do.DeliveryOrderId = lpl.DeliveryOrderId
    JOIN dbo.Customers c ON c.CustomerId = do.CustomerId
    JOIN dbo.DeliveryOrderLines dol ON dol.DeliveryOrderId = do.DeliveryOrderId
    JOIN dbo.Items i ON i.ItemId = dol.ItemId
    LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
    WHERE lpl.LoadPlanId IN (${planIds})
    GROUP BY lpl.LoadPlanLineId, lpl.LoadPlanId, lpl.StopSequence, lpl.DeliveryStatus, do.DeliveryOrderId, do.DocumentNo, do.ShipToAddress, do.DocumentDate, c.CustomerName, c.CustomerCode
    ORDER BY lpl.StopSequence ASC
  `);

  // Group lines by load plan
  const result = lpRows.map(lp => ({
    loadPlanId: lp.LoadPlanId,
    loadPlanNo: lp.LoadPlanNo,
    planDate: lp.PlanDate,
    status: lp.Status,
    licensePlate: lp.LicensePlate,
    vehicleType: lp.VehicleType,
    lines: linesRows
      .filter(l => l.LoadPlanId === lp.LoadPlanId)
      .map(l => ({
        loadPlanLineId: l.LoadPlanLineId,
        stopSequence: l.StopSequence,
        deliveryStatus: l.DeliveryStatus,
        deliveryOrderId: l.DeliveryOrderId,
        documentNo: l.DocumentNo,
        shipToAddress: l.ShipToAddress,
        customerName: l.CustomerName,
        customerCode: l.CustomerCode,
        weightKg: Number(l.LineWeight),
        volumeCbm: Number(l.LineVolume),
      }))
  }));

  res.json({ data: result });
}));

// Helper to generate POD no: POD-YYYYMMDD-XXXX
async function generatePodNo(tx) {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `POD-${todayStr}-`;
  
  const req = new sql.Request(tx);
  req.input('prefix', sql.NVarChar(50), prefix + '%');
  const res = await req.query(`
    SELECT TOP 1 PodNo
    FROM dbo.ProofOfDeliveries
    WHERE PodNo LIKE @prefix
    ORDER BY PodNo DESC
  `);

  let nextSeq = 1;
  if (res.recordset.length > 0) {
    const lastNo = res.recordset[0].PodNo;
    const parts = lastNo.split('-');
    const seqStr = parts[parts.length - 1];
    nextSeq = parseInt(seqStr, 10) + 1;
  }

  return prefix + String(nextSeq).padStart(4, '0');
}

// 9. Submit POD for a load plan line (updates ProofOfDeliveries and DeliveryOrder status)
router.post('/lines/:lineId/pod', driverRoles, upload.single('photo'), asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const lineId = Number(req.params.lineId);
  const { deliveryStatus, recipientName, remarks, signatureDataUrl, lat, lng } = req.body;

  const allowedStatuses = ['delivered', 'partial', 'failed'];
  if (!allowedStatuses.includes(deliveryStatus)) {
    return res.status(400).json({ message: 'Invalid delivery status. Must be delivered, partial, or failed.' });
  }

  const latitude = lat !== undefined && lat !== null && lat !== '' ? Number(lat) : null;
  const longitude = lng !== undefined && lng !== null && lng !== '' ? Number(lng) : null;

  // Process signature if provided
  let signatureUrl = null;
  if (signatureDataUrl) {
    const matches = signatureDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `sig-${lineId}-${Date.now()}.png`;
      const filePath = path.join(sigDir, filename);
      fs.writeFileSync(filePath, buffer);
      signatureUrl = `/public/uploads/signatures/${filename}`;
    }
  }

  // Photo URL if uploaded
  const photoUrl = req.file ? `/public/uploads/pod_photos/${req.file.filename}` : null;

  await mssqlTransaction('DEFAULT', async (tx) => {
    // 1. Fetch the line to get DeliveryOrderId and LoadPlanId
    const lineReq = new sql.Request(tx);
    lineReq.input('lineId', sql.BigInt, lineId);
    const lineRes = await lineReq.query(`
      SELECT LoadPlanId, DeliveryOrderId 
      FROM dbo.WmsLoadPlanLines 
      WHERE LoadPlanLineId = @lineId
    `);

    if (lineRes.recordset.length === 0) {
      throw new Error('Load plan line not found');
    }
    const { LoadPlanId, DeliveryOrderId } = lineRes.recordset[0];

    // 1.1 Update coordinates on customer address if coordinates are provided
    const doInfoReq = new sql.Request(tx);
    doInfoReq.input('doId', sql.Int, DeliveryOrderId);
    const doInfoRes = await doInfoReq.query(`
      SELECT CustomerId, ShipToAddress 
      FROM dbo.DeliveryOrders 
      WHERE DeliveryOrderId = @doId
    `);
    
    if (doInfoRes.recordset.length > 0) {
      const { CustomerId, ShipToAddress } = doInfoRes.recordset[0];
      
      if (latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude)) {
        const addrReq = new sql.Request(tx);
        addrReq.input('customerId', sql.Int, CustomerId);
        addrReq.input('shipToAddress', sql.NVarChar(1000), ShipToAddress || '');
        
        // Find best match address
        const bestAddrRes = await addrReq.query(`
          SELECT TOP 1 CustomerAddressId
          FROM dbo.CustomerAddresses
          WHERE CustomerId = @customerId
            AND (
              @shipToAddress LIKE '%' + AddressLine1 + '%'
              OR @shipToAddress LIKE '%' + AddressCode + '%'
            )
          ORDER BY IsDefault DESC, CustomerAddressId ASC
        `);
        
        let targetAddressId = null;
        if (bestAddrRes.recordset.length > 0) {
          targetAddressId = bestAddrRes.recordset[0].CustomerAddressId;
        } else {
          // Fallback to default/first address of customer
          const fallbackRes = await addrReq.query(`
            SELECT TOP 1 CustomerAddressId
            FROM dbo.CustomerAddresses
            WHERE CustomerId = @customerId
            ORDER BY IsDefault DESC, CustomerAddressId ASC
          `);
          if (fallbackRes.recordset.length > 0) {
            targetAddressId = fallbackRes.recordset[0].CustomerAddressId;
          }
        }
        
        if (targetAddressId) {
          const updateAddrReq = new sql.Request(tx);
          updateAddrReq.input('addressId', sql.Int, targetAddressId);
          updateAddrReq.input('lat', sql.Decimal(18, 10), latitude);
          updateAddrReq.input('lng', sql.Decimal(18, 10), longitude);
          await updateAddrReq.query(`
            UPDATE dbo.CustomerAddresses
            SET Latitude = @lat, Longitude = @lng
            WHERE CustomerAddressId = @addressId
          `);
        }
      }
    }

    // 2. Update line DeliveryStatus
    await lineReq.query(`
      UPDATE dbo.WmsLoadPlanLines
      SET DeliveryStatus = @deliveryStatus
      WHERE LoadPlanLineId = @lineId
    `);

    // 3. Generate POD Document No
    const podNo = await generatePodNo(tx);

    // 4. Create or update ProofOfDeliveries entry
    const podReq = new sql.Request(tx);
    podReq.input('doId', sql.Int, DeliveryOrderId);
    podReq.input('podNo', sql.NVarChar(50), podNo);
    podReq.input('status', sql.NVarChar(30), deliveryStatus);
    podReq.input('recipient', sql.NVarChar(255), recipientName || null);
    podReq.input('signature', sql.NVarChar(500), signatureUrl);
    podReq.input('photo', sql.NVarChar(500), photoUrl);
    podReq.input('remarks', sql.NVarChar(1000), remarks || null);
    podReq.input('createdBy', sql.Int, userId);

    await podReq.query(`
      -- Clean up existing POD if any (due to retries)
      DELETE FROM dbo.ProofOfDeliveries WHERE DeliveryOrderId = @doId;

      INSERT INTO dbo.ProofOfDeliveries (
        DeliveryOrderId, PodNo, DeliveryStatus, ActualDeliveryDate, RecipientName, SignatureUrl, PhotoUrl, Remarks, CreatedBy
      ) VALUES (
        @doId, @podNo, @status, SYSUTCDATETIME(), @recipient, @signature, @photo, @remarks, @createdBy
      )
    `);

    // 5. Update DeliveryOrder status
    let doStatus = 'closed';
    if (deliveryStatus === 'partial') doStatus = 'partial_delivered';
    else if (deliveryStatus === 'failed') doStatus = 'failed';
    else if (deliveryStatus === 'delivered') doStatus = 'delivered'; // Matches status code from migration!

    const doReq = new sql.Request(tx);
    doReq.input('doId', sql.Int, DeliveryOrderId);
    doReq.input('status', sql.NVarChar(30), doStatus);
    await doReq.query(`UPDATE dbo.DeliveryOrders SET Status = @status WHERE DeliveryOrderId = @doId`);

    // 6. Check if all lines in this load plan are completed (not pending)
    const checkReq = new sql.Request(tx);
    checkReq.input('lpId', sql.Int, LoadPlanId);
    const countRes = await checkReq.query(`
      SELECT COUNT(1) AS TotalCount,
             SUM(CASE WHEN DeliveryStatus != 'pending' THEN 1 ELSE 0 END) AS CompletedCount
      FROM dbo.WmsLoadPlanLines
      WHERE LoadPlanId = @lpId
    `);

    const { TotalCount, CompletedCount } = countRes.recordset[0];
    if (TotalCount === CompletedCount) {
      // Update LoadPlan status to completed
      await checkReq.query(`UPDATE dbo.WmsLoadPlans SET Status = 'completed' WHERE LoadPlanId = @lpId`);
    }
  });

  res.json({ message: 'POD submitted successfully', signatureUrl, photoUrl });
}));

export default router;
