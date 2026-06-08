import { Router } from 'express';
import { mssqlQuery, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'accounting', 'user', 'audit');
const writeRoles = allowRoles('admin', 'accounting', 'user');

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`${name} must be a positive integer`);
  return id;
}

function parseOptionalId(value, name) {
  if (value === null || value === undefined || value === '') return null;
  return parseId(value, name);
}

function parseOptionalNumber(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`${name} must be a number`);
  return n;
}

function normalizeEnum(value, allowed, name) {
  if (value === null || value === undefined || value === '') return null;
  const v = String(value).toLowerCase();
  if (!allowed.includes(v)) throw badRequest(`${name} must be one of: ${allowed.join(', ')}`);
  return v;
}

function buildPagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 200);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

router.get(
  '/warehouses',
  readRoles,
  asyncHandler(async (_req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT WarehouseId, WarehouseCode, WarehouseName, IsActive
      FROM dbo.Warehouses
      ORDER BY WarehouseCode
    `);

    res.json({
      data: rows.map((r) => ({
        id: r.WarehouseId,
        code: r.WarehouseCode,
        name: r.WarehouseName,
        isActive: Boolean(r.IsActive),
      })),
    });
  }),
);

router.post('/transfers', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, status: 'draft', ...req.body });
});

router.get(
  '/lots',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.itemId) {
      conditions.push('l.ItemId = @itemId');
      inputs.itemId = { type: sql.Int, value: parseId(req.query.itemId, 'itemId') };
    }
    if (req.query.qualityStatus !== undefined && req.query.qualityStatus !== '') {
      const qualityStatus = normalizeEnum(
        req.query.qualityStatus,
        ['pending', 'approved', 'rejected', 'hold'],
        'qualityStatus',
      );
      conditions.push('l.QualityStatus = @qualityStatus');
      inputs.qualityStatus = { type: sql.NVarChar(30), value: qualityStatus };
    }
    if (req.query.search) {
      conditions.push('(i.ItemCode LIKE @search OR i.ItemName LIKE @search OR l.LotNo LIKE @search)');
      inputs.search = { type: sql.NVarChar(255), value: `%${req.query.search}%` };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredLots AS (
        SELECT l.LotId
        FROM dbo.Lots l
        JOIN dbo.Items i ON i.ItemId = l.ItemId
        ${whereSql}
      )
      SELECT
        l.LotId,
        l.ItemId,
        i.ItemCode,
        i.ItemName,
        ispec.SalesSKU,
        ispec.SpecName,
        l.LotNo,
        l.ProductionDate,
        l.ExpiryDate,
        l.Grade,
        l.QualityStatus,
        l.MoisturePercent,
        l.DensityKgM3,
        l.SourceDocumentType,
        l.SourceDocumentId,
        l.CreatedAt,
        (SELECT COUNT(1) FROM FilteredLots) AS TotalCount
      FROM FilteredLots fl
      JOIN dbo.Lots l ON l.LotId = fl.LotId
      JOIN dbo.Items i ON i.ItemId = l.ItemId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = COALESCE(
        (SELECT TOP 1 ItemSpecId FROM dbo.GoodsReceiptLines WHERE LotId = l.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.InventoryUnits WHERE LotId = l.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.StockOnHand WHERE LotId = l.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.InventoryReservations WHERE LotId = l.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.GoodsIssueLines WHERE LotId = l.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.WmsTaskLines WHERE LotId = l.LotId),
        CASE 
          WHEN l.SourceDocumentType IN ('GoodsReceipt', 'GR') THEN (SELECT TOP 1 ItemSpecId FROM dbo.GoodsReceiptLines WHERE GoodsReceiptId = l.SourceDocumentId AND ItemId = l.ItemId)
          WHEN l.SourceDocumentType IN ('GoodsIssue', 'GI')   THEN (SELECT TOP 1 ItemSpecId FROM dbo.GoodsIssueLines   WHERE GoodsIssueId   = l.SourceDocumentId AND ItemId = l.ItemId)
          ELSE NULL
        END
      )
      ORDER BY l.CreatedAt DESC, l.LotId DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, {
      inputs: {
        ...inputs,
        offset: { type: sql.Int, value: offset },
        pageSize: { type: sql.Int, value: pageSize },
      },
    });

    res.json({
      data: rows.map((r) => ({
        id: r.LotId,
        itemId: r.ItemId,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        salesSku: r.SalesSKU,
        specName: r.SpecName,
        lotNo: r.LotNo,
        productionDate: r.ProductionDate,
        expiryDate: r.ExpiryDate,
        grade: r.Grade,
        qualityStatus: r.QualityStatus,
        moisturePercent: r.MoisturePercent,
        densityKgM3: r.DensityKgM3,
        sourceDocumentType: r.SourceDocumentType,
        sourceDocumentId: r.SourceDocumentId,
        createdAt: r.CreatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total: rows[0]?.TotalCount || 0,
      },
    });
  }),
);

router.get(
  '/units',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.itemId) {
      conditions.push('iu.ItemId = @itemId');
      inputs.itemId = { type: sql.Int, value: parseId(req.query.itemId, 'itemId') };
    }
    if (req.query.itemSpecId) {
      conditions.push('iu.ItemSpecId = @itemSpecId');
      inputs.itemSpecId = { type: sql.Int, value: parseId(req.query.itemSpecId, 'itemSpecId') };
    }
    if (req.query.lotId) {
      conditions.push('iu.LotId = @lotId');
      inputs.lotId = { type: sql.BigInt, value: Number(req.query.lotId) };
    }
    if (req.query.warehouseId) {
      conditions.push('iu.WarehouseId = @warehouseId');
      inputs.warehouseId = { type: sql.Int, value: parseId(req.query.warehouseId, 'warehouseId') };
    }
    if (req.query.locationId) {
      conditions.push('iu.LocationId = @locationId');
      inputs.locationId = { type: sql.Int, value: parseId(req.query.locationId, 'locationId') };
    }
    if (req.query.inventoryStatus !== undefined && req.query.inventoryStatus !== '') {
      const inventoryStatus = normalizeEnum(
        req.query.inventoryStatus,
        ['available', 'quarantine', 'blocked', 'damaged'],
        'inventoryStatus',
      );
      conditions.push('iu.InventoryStatus = @inventoryStatus');
      inputs.inventoryStatus = { type: sql.NVarChar(30), value: inventoryStatus };
    }
    if (req.query.search) {
      conditions.push('(iu.TrackingNo LIKE @search OR iu.PalletNo LIKE @search OR i.ItemCode LIKE @search OR i.ItemName LIKE @search)');
      inputs.search = { type: sql.NVarChar(255), value: `%${req.query.search}%` };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredUnits AS (
        SELECT iu.InventoryUnitId
        FROM dbo.InventoryUnits iu
        JOIN dbo.Items i ON i.ItemId = iu.ItemId
        ${whereSql}
      )
      SELECT
        iu.InventoryUnitId,
        iu.ItemId,
        i.ItemCode,
        i.ItemName,
        iu.ItemSpecId,
        ispec.SalesSKU,
        ispec.SpecCode,
        ispec.SpecName,
        iu.TrackingNo,
        iu.LotId,
        l.LotNo,
        iu.GradeId,
        g.GradeName,
        iu.WarehouseId,
        wh.WarehouseCode,
        wh.WarehouseName,
        iu.LocationId,
        loc.LocationCode,
        loc.LocationName,
        iu.QtySheet,
        iu.QtySqm,
        iu.PalletNo,
        iu.InventoryStatus,
        iu.CreatedAt,
        (SELECT COUNT(1) FROM FilteredUnits) AS TotalCount
      FROM FilteredUnits fu
      JOIN dbo.InventoryUnits iu ON iu.InventoryUnitId = fu.InventoryUnitId
      JOIN dbo.Items i ON i.ItemId = iu.ItemId
      JOIN dbo.Warehouses wh ON wh.WarehouseId = iu.WarehouseId
      JOIN dbo.WarehouseLocations loc ON loc.LocationId = iu.LocationId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = iu.ItemSpecId
      LEFT JOIN dbo.Lots l ON l.LotId = iu.LotId
      LEFT JOIN dbo.Grades g ON g.GradeId = iu.GradeId
      ORDER BY iu.CreatedAt DESC, iu.InventoryUnitId DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, {
      inputs: {
        ...inputs,
        offset: { type: sql.Int, value: offset },
        pageSize: { type: sql.Int, value: pageSize },
      },
    });

    res.json({
      data: rows.map((r) => ({
        id: r.InventoryUnitId,
        itemId: r.ItemId,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        itemSpecId: r.ItemSpecId,
        salesSku: r.SalesSKU,
        specCode: r.SpecCode,
        specName: r.SpecName,
        trackingNo: r.TrackingNo,
        lotId: r.LotId,
        lotNo: r.LotNo,
        gradeId: r.GradeId,
        gradeName: r.GradeName,
        warehouseId: r.WarehouseId,
        warehouseCode: r.WarehouseCode,
        warehouseName: r.WarehouseName,
        locationId: r.LocationId,
        locationCode: r.LocationCode,
        locationName: r.LocationName,
        qtySheet: r.QtySheet,
        qtySqm: r.QtySqm,
        palletNo: r.PalletNo,
        inventoryStatus: r.InventoryStatus,
        createdAt: r.CreatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total: rows[0]?.TotalCount || 0,
      },
    });
  }),
);

router.get(
  '/reservations',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.referenceType !== undefined && req.query.referenceType !== '') {
      const referenceType = normalizeEnum(req.query.referenceType, ['so', 'gi', 'transfer'], 'referenceType');
      conditions.push('ir.ReferenceType = @referenceType');
      inputs.referenceType = { type: sql.NVarChar(30), value: referenceType.toUpperCase() };
    }
    if (req.query.status !== undefined && req.query.status !== '') {
      const status = normalizeEnum(
        req.query.status,
        ['open', 'allocated', 'picked', 'released', 'cancelled'],
        'status',
      );
      conditions.push('ir.Status = @status');
      inputs.status = { type: sql.NVarChar(30), value: status };
    }
    if (req.query.itemId) {
      conditions.push('ir.ItemId = @itemId');
      inputs.itemId = { type: sql.Int, value: parseId(req.query.itemId, 'itemId') };
    }
    if (req.query.warehouseId) {
      conditions.push('ir.WarehouseId = @warehouseId');
      inputs.warehouseId = { type: sql.Int, value: parseId(req.query.warehouseId, 'warehouseId') };
    }
    if (req.query.search) {
      conditions.push('(i.ItemCode LIKE @search OR i.ItemName LIKE @search)');
      inputs.search = { type: sql.NVarChar(255), value: `%${req.query.search}%` };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredReservations AS (
        SELECT ir.InventoryReservationId
        FROM dbo.InventoryReservations ir
        JOIN dbo.Items i ON i.ItemId = ir.ItemId
        ${whereSql}
      )
      SELECT
        ir.InventoryReservationId,
        ir.ReferenceType,
        ir.ReferenceId,
        ir.ReferenceLineId,
        ir.ItemId,
        i.ItemCode,
        i.ItemName,
        ir.ItemSpecId,
        ispec.SalesSKU,
        ispec.SpecCode,
        ispec.SpecName,
        ir.LotId,
        l.LotNo,
        ir.WarehouseId,
        wh.WarehouseCode,
        wh.WarehouseName,
        ir.LocationId,
        loc.LocationCode,
        loc.LocationName,
        ir.InventoryUnitId,
        iu.TrackingNo,
        ir.ReservedQty,
        ir.PickedQty,
        ir.Status,
        ir.CreatedAt,
        (SELECT COUNT(1) FROM FilteredReservations) AS TotalCount
      FROM FilteredReservations fr
      JOIN dbo.InventoryReservations ir ON ir.InventoryReservationId = fr.InventoryReservationId
      JOIN dbo.Items i ON i.ItemId = ir.ItemId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = ir.ItemSpecId
      LEFT JOIN dbo.Lots l ON l.LotId = ir.LotId
      LEFT JOIN dbo.Warehouses wh ON wh.WarehouseId = ir.WarehouseId
      LEFT JOIN dbo.WarehouseLocations loc ON loc.LocationId = ir.LocationId
      LEFT JOIN dbo.InventoryUnits iu ON iu.InventoryUnitId = ir.InventoryUnitId
      ORDER BY ir.CreatedAt DESC, ir.InventoryReservationId DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, {
      inputs: {
        ...inputs,
        offset: { type: sql.Int, value: offset },
        pageSize: { type: sql.Int, value: pageSize },
      },
    });

    res.json({
      data: rows.map((r) => ({
        id: r.InventoryReservationId,
        referenceType: r.ReferenceType,
        referenceId: r.ReferenceId,
        referenceLineId: r.ReferenceLineId,
        itemId: r.ItemId,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        itemSpecId: r.ItemSpecId,
        salesSku: r.SalesSKU,
        specCode: r.SpecCode,
        specName: r.SpecName,
        lotId: r.LotId,
        lotNo: r.LotNo,
        warehouseId: r.WarehouseId,
        warehouseCode: r.WarehouseCode,
        warehouseName: r.WarehouseName,
        locationId: r.LocationId,
        locationCode: r.LocationCode,
        locationName: r.LocationName,
        inventoryUnitId: r.InventoryUnitId,
        trackingNo: r.TrackingNo,
        reservedQty: r.ReservedQty,
        pickedQty: r.PickedQty,
        status: r.Status,
        createdAt: r.CreatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total: rows[0]?.TotalCount || 0,
      },
    });
  }),
);

export default router;
