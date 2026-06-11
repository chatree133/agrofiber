import { Router } from 'express';
import { mssqlQuery, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'accounting', 'user', 'audit');
const movementReadRoles = allowRoles('admin', 'accounting', 'audit');
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

function parseOptionalDate(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${name} must be a valid date`);
  return d;
}

function normalizeEnum(value, allowed, name) {
  if (value === null || value === undefined || value === '') return null;
  const v = String(value).toLowerCase();
  if (!allowed.includes(v)) throw badRequest(`${name} must be one of: ${allowed.join(', ')}`);
  return v;
}

function getUserId(req) {
  const raw = req.user?.sub;
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid authenticated user');
  return userId;
}

function buildPagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 200);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function buildStockOnHandFilters(query) {
  const conditions = [];
  const inputs = {};

  if (query.itemId) {
    conditions.push('soh.ItemId = @itemId');
    inputs.itemId = { type: sql.Int, value: parseId(query.itemId, 'itemId') };
  }
  if (query.itemSpecId) {
    conditions.push('soh.ItemSpecId = @itemSpecId');
    inputs.itemSpecId = { type: sql.Int, value: parseId(query.itemSpecId, 'itemSpecId') };
  }
  if (query.warehouseId) {
    conditions.push('soh.WarehouseId = @warehouseId');
    inputs.warehouseId = { type: sql.Int, value: parseId(query.warehouseId, 'warehouseId') };
  }
  if (query.locationId) {
    conditions.push('soh.LocationId = @locationId');
    inputs.locationId = { type: sql.Int, value: parseId(query.locationId, 'locationId') };
  }
  if (query.lotId) {
    conditions.push('soh.LotId = @lotId');
    inputs.lotId = { type: sql.BigInt, value: Number(query.lotId) };
  }
  if (query.search) {
    const searchSql = query.summary === 'true' || query.summary === true
      ? '(i.ItemCode LIKE @search OR i.ItemName LIKE @search OR ispec.SalesSKU LIKE @search)'
      : '(i.ItemCode LIKE @search OR i.ItemName LIKE @search OR ispec.SalesSKU LIKE @search OR soh.LotNo LIKE @search)';
    conditions.push(searchSql);
    inputs.search = { type: sql.NVarChar(255), value: `%${query.search}%` };
  }
  if (query.includeZero === 'false' || query.includeZero === false || query.includeZero === '0') {
    conditions.push('(soh.QuantityOnHand <> 0 OR soh.QuantityReserved <> 0)');
  }

  return { whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', inputs };
}

async function listStockOnHand(req, res) {
  const { whereSql, inputs } = buildStockOnHandFilters(req.query);
  const summary = req.query.summary === 'true' || req.query.summary === true;

  if (summary) {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT
        MIN(soh.StockOnHandId) AS StockOnHandId,
        soh.ItemId,
        i.ItemCode,
        i.ItemName,
        soh.ItemSpecId,
        COALESCE(ispec.SalesSKU, i.ItemCode) AS SalesSKU,
        ispec.SpecCode,
        ispec.SpecName,
        soh.WarehouseId,
        wh.WarehouseCode,
        wh.WarehouseName,
        SUM(soh.QuantityOnHand) AS QuantityOnHand,
        SUM(soh.QuantityReserved) AS QuantityReserved,
        MAX(soh.UpdatedAt) AS UpdatedAt
      FROM dbo.StockOnHand soh
      JOIN dbo.Items i ON i.ItemId = soh.ItemId
      JOIN dbo.Warehouses wh ON wh.WarehouseId = soh.WarehouseId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = soh.ItemSpecId
      ${whereSql}
      GROUP BY
        soh.WarehouseId,
        wh.WarehouseCode,
        wh.WarehouseName,
        soh.ItemId,
        i.ItemCode,
        i.ItemName,
        soh.ItemSpecId,
        ispec.SalesSKU,
        ispec.SpecCode,
        ispec.SpecName
      ORDER BY COALESCE(ispec.SalesSKU, i.ItemCode), wh.WarehouseCode
    `, { inputs });

    return res.json({
      data: rows.map((r) => ({
        id: r.StockOnHandId,
        itemId: r.ItemId,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        itemSpecId: r.ItemSpecId,
        salesSku: r.SalesSKU,
        specCode: r.SpecCode,
        specName: r.SpecName,
        warehouseId: r.WarehouseId,
        warehouseCode: r.WarehouseCode,
        warehouseName: r.WarehouseName,
        locationId: null,
        locationCode: null,
        locationName: null,
        lotId: null,
        lotNo: null,
        gradeId: null,
        gradeName: null,
        qtyOnHand: r.QuantityOnHand,
        qtyReserved: r.QuantityReserved,
        qtyAvailable: Number(r.QuantityOnHand || 0) - Number(r.QuantityReserved || 0),
        updatedAt: r.UpdatedAt,
        summary: true,
      })),
    });
  }

  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      soh.StockOnHandId,
      soh.ItemId,
      i.ItemCode,
      i.ItemName,
      soh.ItemSpecId,
      ispec.SalesSKU,
      ispec.SpecCode,
      ispec.SpecName,
      soh.WarehouseId,
      wh.WarehouseCode,
      wh.WarehouseName,
      soh.LocationId,
      loc.LocationCode,
      loc.LocationName,
      soh.LotId,
      soh.LotNo,
      soh.GradeId,
      g.GradeName,
      soh.QuantityOnHand,
      soh.QuantityReserved,
      soh.UpdatedAt
    FROM dbo.StockOnHand soh
    JOIN dbo.Items i ON i.ItemId = soh.ItemId
    JOIN dbo.Warehouses wh ON wh.WarehouseId = soh.WarehouseId
    LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = soh.ItemSpecId
    LEFT JOIN dbo.WarehouseLocations loc ON loc.LocationId = soh.LocationId
    LEFT JOIN dbo.Grades g ON g.GradeId = soh.GradeId
    ${whereSql}
    ORDER BY i.ItemCode, wh.WarehouseCode, loc.LocationCode, soh.LotNo
  `, { inputs });

  res.json({
    data: rows.map((r) => ({
      id: r.StockOnHandId,
      itemId: r.ItemId,
      itemCode: r.ItemCode,
      itemName: r.ItemName,
      itemSpecId: r.ItemSpecId,
      salesSku: r.SalesSKU,
      specCode: r.SpecCode,
      specName: r.SpecName,
      warehouseId: r.WarehouseId,
      warehouseCode: r.WarehouseCode,
      warehouseName: r.WarehouseName,
      locationId: r.LocationId,
      locationCode: r.LocationCode,
      locationName: r.LocationName,
      lotId: r.LotId,
      lotNo: r.LotNo,
      gradeId: r.GradeId,
      gradeName: r.GradeName,
      qtyOnHand: r.QuantityOnHand,
      qtyReserved: r.QuantityReserved,
      qtyAvailable: Number(r.QuantityOnHand || 0) - Number(r.QuantityReserved || 0),
      updatedAt: r.UpdatedAt,
    })),
  });
}

router.get('/on-hand', readRoles, asyncHandler(listStockOnHand));
router.get('/onhand', readRoles, asyncHandler(listStockOnHand));

function buildMovementFilters(query) {
  const { page, pageSize, offset } = buildPagination(query);
  const conditions = [];
  const inputs = {};

  if (query.itemId) {
    conditions.push('sm.ItemId = @itemId');
    inputs.itemId = { type: sql.Int, value: parseId(query.itemId, 'itemId') };
  }
  if (query.itemSpecId) {
    conditions.push('sm.ItemSpecId = @itemSpecId');
    inputs.itemSpecId = { type: sql.Int, value: parseId(query.itemSpecId, 'itemSpecId') };
  }
  if (query.warehouseId) {
    const warehouseId = parseId(query.warehouseId, 'warehouseId');
    conditions.push('(sm.FromWarehouseId = @warehouseId OR sm.ToWarehouseId = @warehouseId)');
    inputs.warehouseId = { type: sql.Int, value: warehouseId };
  }
  if (query.movementType) {
    inputs.movementType = { type: sql.NVarChar(40), value: String(query.movementType).trim() };
    conditions.push('sm.MovementType = @movementType');
  }
  if (query.referenceType) {
    inputs.referenceType = { type: sql.NVarChar(40), value: String(query.referenceType).trim() };
    conditions.push('sm.ReferenceType = @referenceType');
  }
  if (query.referenceId) {
    inputs.referenceId = { type: sql.Int, value: parseId(query.referenceId, 'referenceId') };
    conditions.push('sm.ReferenceId = @referenceId');
  }
  if (query.dateFrom) {
    inputs.dateFrom = { type: sql.DateTime2, value: parseOptionalDate(query.dateFrom, 'dateFrom') };
    conditions.push('sm.CreatedAt >= @dateFrom');
  }
  if (query.dateTo) {
    inputs.dateTo = { type: sql.DateTime2, value: parseOptionalDate(query.dateTo, 'dateTo') };
    conditions.push('sm.CreatedAt < DATEADD(day, 1, @dateTo)');
  }

  return {
    page,
    pageSize,
    offset,
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    inputs,
  };
}

router.get(
  '/movements',
  movementReadRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset, whereSql, inputs } = buildMovementFilters(req.query);

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredMovements AS (
        SELECT sm.StockMovementId
        FROM dbo.StockMovements sm
        ${whereSql}
      )
      SELECT
        sm.StockMovementId,
        sm.MovementType,
        sm.ReferenceType,
        sm.ReferenceId,
        sm.ItemId,
        i.ItemCode,
        i.ItemName,
        ispec.SalesSKU,
        ispec.SpecName,
        sm.FromWarehouseId,
        fwh.WarehouseCode AS FromWarehouseCode,
        fwh.WarehouseName AS FromWarehouseName,
        sm.ToWarehouseId,
        twh.WarehouseCode AS ToWarehouseCode,
        twh.WarehouseName AS ToWarehouseName,
        sm.FromLocationId,
        floc.LocationCode AS FromLocationCode,
        floc.LocationName AS FromLocationName,
        sm.ToLocationId,
        tloc.LocationCode AS ToLocationCode,
        tloc.LocationName AS ToLocationName,
        sm.LotId,
        sm.LotNo,
        sm.Quantity,
        sm.UnitId,
        u.UnitCode,
        u.UnitName,
        sm.UnitCost,
        sm.TotalCost,
        sm.CreatedBy,
        sm.CreatedAt,
        (SELECT COUNT(1) FROM FilteredMovements) AS TotalCount
      FROM FilteredMovements fm
      JOIN dbo.StockMovements sm ON sm.StockMovementId = fm.StockMovementId
      JOIN dbo.Items i ON i.ItemId = sm.ItemId
      LEFT JOIN dbo.Warehouses fwh ON fwh.WarehouseId = sm.FromWarehouseId
      LEFT JOIN dbo.Warehouses twh ON twh.WarehouseId = sm.ToWarehouseId
      LEFT JOIN dbo.WarehouseLocations floc ON floc.LocationId = sm.FromLocationId
      LEFT JOIN dbo.WarehouseLocations tloc ON tloc.LocationId = sm.ToLocationId
      LEFT JOIN dbo.Units u ON u.UnitId = sm.UnitId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = COALESCE(
        (SELECT TOP 1 ItemSpecId FROM dbo.GoodsReceiptLines WHERE LotId = sm.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.InventoryUnits WHERE LotId = sm.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.StockOnHand WHERE LotId = sm.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.InventoryReservations WHERE LotId = sm.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.GoodsIssueLines WHERE LotId = sm.LotId),
        (SELECT TOP 1 ItemSpecId FROM dbo.WmsTaskLines WHERE LotId = sm.LotId),
        CASE 
          WHEN sm.ReferenceType IN ('GoodsReceipt', 'GR') THEN (SELECT TOP 1 ItemSpecId FROM dbo.GoodsReceiptLines WHERE GoodsReceiptId = sm.ReferenceId AND ItemId = sm.ItemId)
          WHEN sm.ReferenceType IN ('GoodsIssue', 'GI')   THEN (SELECT TOP 1 ItemSpecId FROM dbo.GoodsIssueLines   WHERE GoodsIssueId   = sm.ReferenceId AND ItemId = sm.ItemId)
          ELSE NULL
        END
      )
      ORDER BY sm.CreatedAt DESC, sm.StockMovementId DESC
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
        id: r.StockMovementId,
        movementType: r.MovementType,
        referenceType: r.ReferenceType,
        referenceId: r.ReferenceId,
        itemId: r.ItemId,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        salesSku: r.SalesSKU,
        specName: r.SpecName,
        fromWarehouseId: r.FromWarehouseId,
        fromWarehouseCode: r.FromWarehouseCode,
        fromWarehouseName: r.FromWarehouseName,
        fromLocationId: r.FromLocationId,
        fromLocationCode: r.FromLocationCode,
        fromLocationName: r.FromLocationName,
        toWarehouseId: r.ToWarehouseId,
        toWarehouseCode: r.ToWarehouseCode,
        toWarehouseName: r.ToWarehouseName,
        toLocationId: r.ToLocationId,
        toLocationCode: r.ToLocationCode,
        toLocationName: r.ToLocationName,
        lotId: r.LotId,
        lotNo: r.LotNo,
        quantity: r.Quantity,
        unitId: r.UnitId,
        unitCode: r.UnitCode,
        unitName: r.UnitName,
        unitCost: r.UnitCost,
        totalCost: r.TotalCost,
        createdBy: r.CreatedBy,
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
