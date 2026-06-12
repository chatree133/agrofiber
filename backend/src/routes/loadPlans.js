import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { logRequestAudit } from '../lib/auditLogger.js';

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
  const branchId = req.query.branchId ? parseInt(req.query.branchId, 10) : null;

  let query = `
    SELECT v.VehicleId, v.LicensePlate, v.VehicleType, v.MaxWeightKg, v.MaxVolumeCbm, v.WorkingStart, v.WorkingEnd, v.IsActive, v.BranchId, b.BranchName, v.CostPerKm
    FROM dbo.Vehicles v
    LEFT JOIN dbo.Branches b ON b.BranchId = v.BranchId
  `;

  const conditions = [];
  const inputs = {};

  if (!includeInactive) {
    conditions.push('v.IsActive = 1');
  }
  if (branchId) {
    conditions.push('(v.BranchId = @branchId OR v.BranchId IS NULL)');
    inputs.branchId = { type: sql.Int, value: branchId };
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY v.LicensePlate';

  const rows = await mssqlQuery('DEFAULT', query, { inputs });

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
  const branchId = req.body.branchId ? parseInt(req.body.branchId, 10) : null;
  const costPerKm = req.body.costPerKm !== undefined && req.body.costPerKm !== null ? Number(req.body.costPerKm) : null;

  if (!licensePlate) return res.status(400).json({ message: 'licensePlate is required' });
  if (!vehicleType) return res.status(400).json({ message: 'vehicleType is required' });
  if (costPerKm !== null && (isNaN(costPerKm) || costPerKm < 0)) {
    return res.status(400).json({ message: 'costPerKm must be a non-negative number' });
  }

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
    INSERT INTO dbo.Vehicles (LicensePlate, VehicleType, MaxWeightKg, MaxVolumeCbm, WorkingStart, WorkingEnd, IsActive, BranchId, CostPerKm)
    OUTPUT inserted.VehicleId, inserted.LicensePlate, inserted.VehicleType, inserted.MaxWeightKg, inserted.MaxVolumeCbm, inserted.WorkingStart, inserted.WorkingEnd, inserted.IsActive, inserted.BranchId, inserted.CostPerKm
    VALUES (@licensePlate, @vehicleType, @maxWeightKg, @maxVolumeCbm, @workingStart, @workingEnd, @isActive, @branchId, @costPerKm)
  `, {
    inputs: {
      licensePlate: { type: sql.NVarChar(30), value: licensePlate },
      vehicleType: { type: sql.NVarChar(50), value: vehicleType },
      maxWeightKg: { type: sql.Decimal(18, 4), value: maxWeightKg },
      maxVolumeCbm: { type: sql.Decimal(18, 4), value: maxVolumeCbm },
      workingStart: { type: sql.VarChar(5), value: workingStart },
      workingEnd: { type: sql.VarChar(5), value: workingEnd },
      isActive: { type: sql.Bit, value: isActive },
      branchId: { type: sql.Int, value: branchId },
      costPerKm: { type: sql.Decimal(18, 2), value: costPerKm },
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
  const branchId = req.body.branchId ? parseInt(req.body.branchId, 10) : null;
  const costPerKm = req.body.costPerKm !== undefined && req.body.costPerKm !== null ? Number(req.body.costPerKm) : null;

  if (!licensePlate) return res.status(400).json({ message: 'licensePlate is required' });
  if (!vehicleType) return res.status(400).json({ message: 'vehicleType is required' });
  if (costPerKm !== null && (isNaN(costPerKm) || costPerKm < 0)) {
    return res.status(400).json({ message: 'costPerKm must be a non-negative number' });
  }

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
        IsActive = @isActive,
        BranchId = @branchId,
        CostPerKm = @costPerKm
    OUTPUT inserted.VehicleId, inserted.LicensePlate, inserted.VehicleType, inserted.MaxWeightKg, inserted.MaxVolumeCbm, inserted.WorkingStart, inserted.WorkingEnd, inserted.IsActive, inserted.BranchId, inserted.CostPerKm
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
      branchId: { type: sql.Int, value: branchId },
      costPerKm: { type: sql.Decimal(18, 2), value: costPerKm },
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
  const branchId = req.query.branchId ? parseInt(req.query.branchId, 10) : null;
  const inputs = {};
  let whereClause = `
    WHERE do.DeliveryType = 'delivery' AND do.Status = 'draft'
      AND NOT EXISTS (
        SELECT 1 FROM dbo.WmsLoadPlanLines lpl WHERE lpl.DeliveryOrderId = do.DeliveryOrderId
      )
  `;

  if (branchId) {
    whereClause += ' AND do.BranchId = @branchId';
    inputs.branchId = { type: sql.Int, value: branchId };
  }

  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      do.DeliveryOrderId, do.DocumentNo, do.BranchId, do.CustomerId, c.CustomerName, c.CustomerCode,
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
    ${whereClause}
    GROUP BY do.DeliveryOrderId, do.DocumentNo, do.BranchId, do.CustomerId, c.CustomerName, c.CustomerCode, do.DocumentDate, do.ShipToAddress
    ORDER BY do.DeliveryOrderId DESC
  `, { inputs });

  res.json({
    data: rows.map(r => ({
      id: r.DeliveryOrderId,
      deliveryOrderId: r.DeliveryOrderId,
      documentNo: r.DocumentNo,
      branchId: r.BranchId,
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

function convertTimeToMinutes(timeVal) {
  if (!timeVal) return 0;
  let timeStr = '';
  if (timeVal instanceof Date) {
    timeStr = timeVal.toISOString().substring(11, 16); // "HH:mm"
  } else {
    timeStr = String(timeVal).substring(0, 5); // "HH:mm"
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours * 60 + minutes;
    }
  }
  return 0;
}

// GET /bot-payload
router.get('/bot-payload', dispatcherRoles, asyncHandler(async (req, res) => {
  const date = req.query.date; // e.g. "2026-06-13"
  const branchId = req.query.branch ? parseInt(req.query.branch, 10) : null;

  if (!date || !branchId) {
    return res.status(400).json({ message: "Parameters 'date' and 'branch' are required." });
  }

  // 1. Get Google Maps Geocoding API Key
  const keyRes = await mssqlQuery('DEFAULT', `
    SELECT SettingValue FROM dbo.SystemSettings WHERE SettingKey = 'GOOGLE_MAPS_KEY'
  `);
  const googleMapsKey = keyRes.length > 0 ? keyRes[0].SettingValue : null;

  // 2. Get Depot coordinates from Branches
  const branchRes = await mssqlQuery('DEFAULT', `
    SELECT Latitude, Longitude, BranchName FROM dbo.Branches WHERE BranchId = @branchId
  `, { inputs: { branchId: { type: sql.Int, value: branchId } } });

  if (!branchRes.length) {
    return res.status(404).json({ message: `Branch ID ${branchId} not found` });
  }

  const depot = {
    lat: branchRes[0].Latitude ? Number(branchRes[0].Latitude) : null,
    lng: branchRes[0].Longitude ? Number(branchRes[0].Longitude) : null,
    branchName: branchRes[0].BranchName
  };

  if (depot.lat === null || depot.lng === null) {
    return res.status(400).json({ 
      message: `สาขา "${depot.branchName}" ยังไม่ได้ระบุพิกัด Latitude หรือ Longitude ในระบบ กรุณาไปที่หน้าตั้งค่าบริษัทเพื่อระบุพิกัดก่อนเรียกใช้งาน AI` 
    });
  }

  // 3. Get Vehicles matching branch (or unassigned/global ones)
  const vehiclesRes = await mssqlQuery('DEFAULT', `
    SELECT v.VehicleId, v.LicensePlate, v.VehicleType, v.MaxWeightKg, v.MaxVolumeCbm, v.WorkingStart, v.WorkingEnd, v.CostPerKm
    FROM dbo.Vehicles v
    WHERE v.IsActive = 1
      AND (v.BranchId = @branchId OR v.BranchId IS NULL)
  `, { inputs: { branchId: { type: sql.Int, value: branchId } } });

  const vehicles = vehiclesRes.map(v => ({
    id: String(v.VehicleId),
    weight_capacity: Number(v.MaxWeightKg) || 0,
    volume_capacity: Number(v.MaxVolumeCbm) || 0,
    start_time_min: convertTimeToMinutes(v.WorkingStart),
    end_time_min: convertTimeToMinutes(v.WorkingEnd),
    cost_per_km: v.CostPerKm !== null && v.CostPerKm !== undefined ? Number(v.CostPerKm) : 1.0
  }));

  // 4. Get Pending draft DOs
  const pendingDosRes = await mssqlQuery('DEFAULT', `
    SELECT
      do.DeliveryOrderId,
      do.DocumentNo,
      do.CustomerId,
      c.CustomerName,
      c.CustomerCode,
      do.DocumentDate,
      do.ShipToAddress,
      so.ShippingAddress,
      so.ShippingLatLng,
      so.DeliveryReservationId,
      dr.DeliveryStartDateTime,
      DATEPART(hour, dr.DeliveryStartDateTime) AS StartHour,
      DATEPART(minute, dr.DeliveryStartDateTime) AS StartMinute,
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
      ), 0) AS TotalVolumeCbm
    FROM dbo.DeliveryOrders do
    JOIN dbo.Customers c ON c.CustomerId = do.CustomerId
    JOIN dbo.DeliveryOrderLines dol ON dol.DeliveryOrderId = do.DeliveryOrderId
    JOIN dbo.Items i ON i.ItemId = dol.ItemId
    JOIN dbo.ItemLengths il ON i.LengthId = il.LengthId
    JOIN dbo.ItemWidths iw ON i.WidthId = iw.WidthId
    LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
    LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = do.SalesOrderId
    LEFT JOIN dbo.DeliveryReservations dr ON dr.ReservationId = so.DeliveryReservationId
    WHERE do.DeliveryType = 'delivery'
      AND do.Status = 'draft'
      AND do.BranchId = @branchId
      AND NOT EXISTS (
        SELECT 1 FROM dbo.WmsLoadPlanLines lpl WHERE lpl.DeliveryOrderId = do.DeliveryOrderId
      )
      AND (
        so.DeliveryReservationId IS NULL
        OR CONVERT(date, dr.DeliveryStartDateTime) = @date
      )
    GROUP BY 
      do.DeliveryOrderId, 
      do.DocumentNo, 
      do.CustomerId, 
      c.CustomerName, 
      c.CustomerCode, 
      do.DocumentDate, 
      do.ShipToAddress,
      so.ShippingAddress,
      so.ShippingLatLng, 
      so.DeliveryReservationId, 
      dr.DeliveryStartDateTime
    ORDER BY do.DeliveryOrderId DESC
  `, {
    inputs: {
      branchId: { type: sql.Int, value: branchId },
      date: { type: sql.VarChar, value: date }
    }
  });

  const orders = await Promise.all(pendingDosRes.map(async (r) => {
    let lat = null;
    let lng = null;

    // Try to parse coordinate from ShippingLatLng
    if (r.ShippingLatLng) {
      const parts = r.ShippingLatLng.split(',');
      if (parts.length === 2) {
        lat = parseFloat(parts[0].trim());
        lng = parseFloat(parts[1].trim());
        if (isNaN(lat)) lat = null;
        if (isNaN(lng)) lng = null;
      }
    }

    // Determine time windows
    let startMin = 0;
    let endMin = 1440;

    if (r.DeliveryReservationId !== null && r.StartHour !== null) {
      startMin = r.StartHour * 60 + (r.StartMinute || 0);
      endMin = startMin + 60;
    }

    const address = r.ShipToAddress || r.ShippingAddress || '';

    // Geocoding Fallback
    if ((lat === null || lng === null) && googleMapsKey && address) {
      try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsKey}`;
        const response = await fetch(geocodeUrl);
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          lat = location.lat;
          lng = location.lng;
        } else {
          console.warn(`Geocoding status: ${data.status} for address: "${address}"`);
        }
      } catch (err) {
        console.error(`Geocoding error for address: "${address}"`, err);
      }
    }

    return {
      id: r.DocumentNo,
      deliveryOrderId: r.DeliveryOrderId,
      lat: lat,
      lng: lng,
      weight: Number(r.TotalWeightKg),
      volume: Number(r.TotalVolumeCbm),
      priority: 1,
      time_window_start_min: startMin,
      time_window_end_min: endMin,
      service_time_min: 30,
      shippingAddress: address
    };
  }));

  const missingCoordsOrders = orders.filter(o => o.lat === null || o.lng === null).map(o => o.id);
  if (missingCoordsOrders.length > 0) {
    return res.status(400).json({
      message: `ใบส่งของ (DO) ต่อไปนี้ไม่มีข้อมูลพิกัดจัดส่ง และระบบค้นหาอัตโนมัติไม่สำเร็จ: ${missingCoordsOrders.join(', ')} กรุณาระบุพิกัดที่ถูกต้องในหน้าใบสั่งซื้อ หรือตรวจเช็คคีย์ Google Maps API ในระบบก่อนประมวลผลด้วย AI`
    });
  }

  const optimizerPayload = {
    depot: {
      lat: depot.lat,
      lng: depot.lng,
      branchName: depot.branchName
    },
    vehicles: vehicles.map(v => ({
      id: v.id,
      weight_capacity: v.weight_capacity,
      volume_capacity: v.volume_capacity,
      start_time_min: v.start_time_min,
      end_time_min: v.end_time_min,
      cost_per_km: v.cost_per_km
    })),
    orders: orders.map(o => ({
      id: o.id,
      deliveryOrderId: o.deliveryOrderId,
      lat: o.lat,
      lng: o.lng,
      weight: o.weight,
      volume: o.volume,
      priority: o.priority,
      time_window_start_min: o.time_window_start_min,
      time_window_end_min: o.time_window_end_min,
      service_time_min: o.service_time_min,
      shippingAddress: o.shippingAddress
    }))
  };

  // POST to microservice optimizer
  let optResult;
  const optimizerUrl = process.env.OPTIMIZER_URL || 'http://localhost:8080/optimize';
  try {
    const optResponse = await fetch(optimizerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(optimizerPayload)
    });

    if (!optResponse.ok) {
      const errText = await optResponse.text();
      throw new Error(`Optimizer returned status ${optResponse.status}: ${errText}`);
    }
    optResult = await optResponse.json();
  } catch (err) {
    console.error('Optimizer service call failed:', err);
    return res.status(502).json({ 
      message: `ไม่สามารถเชื่อมต่อระบบประมวลผลจัดเส้นทาง (${optimizerUrl}) ได้: ${err.message}` 
    });
  }

  // Create a map for DOs by DocumentNo for O(1) lookups
  const doMap = {};
  pendingDosRes.forEach(r => {
    doMap[r.DocumentNo] = r;
  });

  // Enrich routes stops
  const enrichedRoutes = (optResult.routes || []).map(route => {
    const vInfo = vehiclesRes.find(v => String(v.VehicleId) === String(route.vehicle_id));
    const augmentedStops = (route.route || []).map((stop, stopIdx) => {
      if (stop.order_id === 'depot') {
        return {
          ...stop,
          stopSequence: stopIdx + 1,
          customerName: depot.branchName || 'คลังสินค้า',
          shippingAddress: branchRes[0].BranchName || depot.branchName || 'คลังสินค้า',
          lat: depot.lat,
          lng: depot.lng
        };
      } else {
        const doData = doMap[stop.order_id];
        return {
          ...stop,
          stopSequence: stopIdx + 1,
          deliveryOrderId: doData ? doData.DeliveryOrderId : null,
          customerName: doData ? doData.CustomerName : 'ไม่ทราบชื่อ',
          shippingAddress: doData ? doData.ShipToAddress : '',
          lat: stop.lat || (doData ? doData.lat : null),
          lng: stop.lng || (doData ? doData.lng : null)
        };
      }
    });
    return {
      ...route,
      licensePlate: vInfo ? vInfo.LicensePlate : '',
      vehicleType: vInfo ? vInfo.VehicleType : '',
      route: augmentedStops
    };
  });

  res.json({
    status: optResult.status,
    total_distance_meters: optResult.total_distance_meters,
    total_weight: optResult.total_weight,
    total_volume: optResult.total_volume,
    total_cost: optResult.total_cost,
    routes: enrichedRoutes,
    unassigned_orders: optResult.unassigned_orders || []
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
  const { planDate, vehicleId, driverId, remarks, deliveryOrderIds, deliveryOrders, branchId } = req.body;

  if (!planDate) return res.status(400).json({ message: 'planDate is required' });
  if (!vehicleId) return res.status(400).json({ message: 'vehicleId is required' });
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
    headerReq.input('branchId', sql.Int, branchId || null);

    const insertHeaderRes = await headerReq.query(`
      INSERT INTO dbo.WmsLoadPlans (LoadPlanNo, PlanDate, VehicleId, DriverId, Status, TotalWeightKg, TotalVolumeCbm, Remarks, CreatedBy, BranchId)
      OUTPUT INSERTED.LoadPlanId
      VALUES (@lpNo, @planDate, @vId, @dId, 'draft', @weight, @volume, @remarks, @createdBy, @branchId)
    `);
    const loadPlanId = insertHeaderRes.recordset[0].LoadPlanId;

    // Insert lines with sequences and coordinates
    for (let idx = 0; idx < deliveryOrderIds.length; idx++) {
      const doId = deliveryOrderIds[idx];
      
      const extraInfo = Array.isArray(deliveryOrders) ? deliveryOrders.find(item => item.deliveryOrderId === doId) : null;
      let lat = extraInfo ? extraInfo.lat : null;
      let lng = extraInfo ? extraInfo.lng : null;

      // Fallback: Query ShippingLatLng from SalesOrder associated with DO
      if (lat === null || lng === null) {
        const soReq = new sql.Request(tx);
        soReq.input('doId', sql.Int, doId);
        const soRes = await soReq.query(`
          SELECT so.ShippingLatLng 
          FROM dbo.SalesOrders so
          JOIN dbo.DeliveryOrders do ON do.SalesOrderId = so.SalesOrderId
          WHERE do.DeliveryOrderId = @doId
        `);
        if (soRes.recordset.length > 0 && soRes.recordset[0].ShippingLatLng) {
          const parts = soRes.recordset[0].ShippingLatLng.split(',');
          if (parts.length === 2) {
            lat = parseFloat(parts[0].trim());
            lng = parseFloat(parts[1].trim());
            if (isNaN(lat)) lat = null;
            if (isNaN(lng)) lng = null;
          }
        }
      }

      const lineReq = new sql.Request(tx);
      lineReq.input('lpId', sql.Int, loadPlanId);
      lineReq.input('doId', sql.Int, doId);
      lineReq.input('seq', sql.Int, idx + 1);
      lineReq.input('lat', sql.Decimal(18, 10), lat);
      lineReq.input('lng', sql.Decimal(18, 10), lng);

      await lineReq.query(`
        INSERT INTO dbo.WmsLoadPlanLines (LoadPlanId, DeliveryOrderId, StopSequence, DeliveryStatus, Latitude, Longitude)
        VALUES (@lpId, @doId, @seq, 'pending', @lat, @lng)
      `);
    }

    return { loadPlanId, loadPlanNo };
  });

  await logRequestAudit(req, {
    module: 'Transportation',
    actionType: 'Create',
    targetId: result.loadPlanNo,
    description: `Created Load Plan ${result.loadPlanNo}`,
    newValues: {
      planDate,
      vehicleId,
      driverId,
      remarks,
      deliveryOrderIds,
      branchId
    }
  });

  res.status(201).json({ data: result });
}));

// 5. Get all load plans
router.get('/', dispatcherRoles, asyncHandler(async (req, res) => {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      lp.LoadPlanId, lp.LoadPlanNo, lp.PlanDate, lp.Status, lp.BranchId, b.BranchName,
      lp.TotalWeightKg, lp.TotalVolumeCbm, lp.Remarks, lp.CreatedAt,
      v.LicensePlate, v.VehicleType, d.DriverName, u.DisplayName AS CreatedByName
    FROM dbo.WmsLoadPlans lp
    JOIN dbo.Vehicles v ON v.VehicleId = lp.VehicleId
    JOIN dbo.Drivers d ON d.DriverId = lp.DriverId
    JOIN dbo.Users u ON u.UserId = lp.CreatedBy
    LEFT JOIN dbo.Branches b ON b.BranchId = lp.BranchId
    ORDER BY lp.PlanDate DESC, lp.LoadPlanId DESC
  `);

  res.json({
    data: rows.map(r => ({
      id: r.LoadPlanId,
      loadPlanId: r.LoadPlanId,
      loadPlanNo: r.LoadPlanNo,
      planDate: r.PlanDate,
      status: r.Status,
      branchId: r.BranchId,
      branchName: r.BranchName,
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
      lp.LoadPlanId, lp.LoadPlanNo, lp.PlanDate, lp.Status, lp.BranchId, b.BranchName,
      lp.TotalWeightKg, lp.TotalVolumeCbm, lp.Remarks, lp.CreatedAt,
      v.VehicleId, v.LicensePlate, v.VehicleType, v.MaxWeightKg, v.MaxVolumeCbm, v.WorkingStart, v.WorkingEnd,
      d.DriverId, d.DriverName, d.Phone, u.DisplayName AS CreatedByName
    FROM dbo.WmsLoadPlans lp
    JOIN dbo.Vehicles v ON v.VehicleId = lp.VehicleId
    JOIN dbo.Drivers d ON d.DriverId = lp.DriverId
    JOIN dbo.Users u ON u.UserId = lp.CreatedBy
    LEFT JOIN dbo.Branches b ON b.BranchId = lp.BranchId
    WHERE lp.LoadPlanId = @lpId
  `, { inputs: { lpId: { type: sql.Int, value: lpId } } });

  if (headerRows.length === 0) {
    return res.status(404).json({ message: 'load plan not found' });
  }

  const linesRows = await mssqlQuery('DEFAULT', `
    SELECT
      lpl.LoadPlanLineId, lpl.StopSequence, lpl.DeliveryStatus, lpl.Latitude, lpl.Longitude,
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
    GROUP BY lpl.LoadPlanLineId, lpl.StopSequence, lpl.DeliveryStatus, lpl.Latitude, lpl.Longitude, do.DeliveryOrderId, do.DocumentNo, do.ShipToAddress, do.DocumentDate, c.CustomerName, c.CustomerCode
    ORDER BY lpl.StopSequence ASC
  `, { inputs: { lpId: { type: sql.Int, value: lpId } } });

  res.json({
    data: {
      id: headerRows[0].LoadPlanId,
      loadPlanId: headerRows[0].LoadPlanId,
      loadPlanNo: headerRows[0].LoadPlanNo,
      planDate: headerRows[0].PlanDate,
      status: headerRows[0].Status,
      branchId: headerRows[0].BranchId,
      branchName: headerRows[0].BranchName,
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
        latitude: l.Latitude ? Number(l.Latitude) : null,
        longitude: l.Longitude ? Number(l.Longitude) : null,
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
