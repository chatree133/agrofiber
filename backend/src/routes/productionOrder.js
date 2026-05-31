import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';
import { productionOrderService } from '../services/production/productionOrderService.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'user', 'manager', 'audit');
const writeRoles = allowRoles('admin', 'user', 'manager');
const approveRoles = allowRoles('admin', 'manager');

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
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function buildConsumptionSnapshots(rawLines) {
  if (!Array.isArray(rawLines)) return [];
  const lines = [];
  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const raw = rawLines[idx] || {};
    const lineNum = Number.isInteger(raw.lineNum) && raw.lineNum > 0 ? raw.lineNum : idx + 1;
    lines.push({
      lineNum,
      itemId: parseId(raw.itemId, `consumptionLines[${idx}].itemId`),
      lotId: parseOptionalId(raw.lotId, `consumptionLines[${idx}].lotId`),
      warehouseId: parseOptionalId(raw.warehouseId, `consumptionLines[${idx}].warehouseId`),
      locationId: parseOptionalId(raw.locationId, `consumptionLines[${idx}].locationId`),
      plannedQuantity: parseOptionalNumber(raw.plannedQuantity, `consumptionLines[${idx}].plannedQuantity`) ?? 0,
      consumedQuantity: parseOptionalNumber(raw.consumedQuantity, `consumptionLines[${idx}].consumedQuantity`) ?? 0,
      unitId: parseId(raw.unitId, `consumptionLines[${idx}].unitId`),
      unitCostSnapshot: parseOptionalNumber(raw.unitCostSnapshot, `consumptionLines[${idx}].unitCostSnapshot`),
    });
  }
  return lines;
}

async function writeStatusHistory(documentId, fromStatus, toStatus, changedBy, notes) {
  await mssqlQuery('DEFAULT', `
    INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
    VALUES ('MO', @documentId, @fromStatus, @toStatus, @changedBy, @notes)
  `, {
    inputs: {
      documentId: { type: sql.Int, value: documentId },
      fromStatus: { type: sql.NVarChar(30), value: fromStatus },
      toStatus: { type: sql.NVarChar(30), value: toStatus },
      changedBy: { type: sql.Int, value: changedBy },
      notes: { type: sql.NVarChar(1000), value: notes || null },
    },
  });
}

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.status) {
      conditions.push('mo.Status = @status');
      inputs.status = { type: sql.NVarChar(30), value: req.query.status };
    }
    if (req.query.warehouseId) {
      conditions.push('mo.WarehouseId = @warehouseId');
      inputs.warehouseId = { type: sql.Int, value: parseId(req.query.warehouseId, 'warehouseId') };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredOrders AS (
        SELECT mo.ProductionOrderId
        FROM dbo.ProductionOrders mo
        ${whereSql}
      )
      SELECT
        mo.ProductionOrderId, mo.DocumentNo, mo.BranchId,
        mo.FinishedGoodItemId, i.ItemCode, i.ItemName,
        mo.PlannedQuantity, mo.CompletedQuantity,
        mo.Status, mo.PlannedStartDate, mo.PlannedEndDate, mo.CreatedAt,
        (SELECT COUNT(1) FROM FilteredOrders) AS TotalCount
      FROM FilteredOrders fo
      JOIN dbo.ProductionOrders mo ON mo.ProductionOrderId = fo.ProductionOrderId
      LEFT JOIN dbo.Items i ON i.ItemId = mo.FinishedGoodItemId
      ORDER BY mo.CreatedAt DESC, mo.ProductionOrderId DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, {
      inputs: {
        ...inputs,
        offset: { type: sql.Int, value: offset },
        pageSize: { type: sql.Int, value: pageSize },
      },
    });

    res.json({
      data: rows.map(r => ({
        id: r.ProductionOrderId,
        documentNo: r.DocumentNo,
        branchId: r.BranchId,
        finishedGoodItemId: r.FinishedGoodItemId,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        plannedQuantity: r.PlannedQuantity,
        completedQuantity: r.CompletedQuantity,
        status: r.Status,
        plannedStartDate: r.PlannedStartDate,
        plannedEndDate: r.PlannedEndDate,
        createdAt: r.CreatedAt,
      })),
      pagination: { page, pageSize, total: rows[0]?.TotalCount || 0 },
    });
  })
);

router.get(
  '/:id',
  readRoles,
  asyncHandler(async (req, res) => {
    const moId = parseId(req.params.id, 'id');
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT * FROM dbo.ProductionOrders WHERE ProductionOrderId = @id
    `, { inputs: { id: { type: sql.Int, value: moId } } });

    if (headerRows.length === 0) {
      return res.status(404).json({ message: 'Production order not found' });
    }

    const consumptionRows = await mssqlQuery('DEFAULT', `
      SELECT pc.*, i.ItemCode, i.ItemName, w.WarehouseCode, wl.LocationCode
      FROM dbo.ProductionConsumption pc
      JOIN dbo.Items i ON i.ItemId = pc.ItemId
      LEFT JOIN dbo.Warehouses w ON w.WarehouseId = pc.WarehouseId
      LEFT JOIN dbo.WarehouseLocations wl ON wl.LocationId = pc.LocationId
      WHERE pc.ProductionOrderId = @id
      ORDER BY pc.LineNum
    `, { inputs: { id: { type: sql.Int, value: moId } } });

    res.json({
      data: {
        ...headerRows[0],
        consumptionLines: consumptionRows,
      }
    });
  })
);

router.post(
  '/',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const branchId = parseOptionalId(req.body.branchId, 'branchId');
    const finishedGoodItemId = parseId(req.body.finishedGoodItemId, 'finishedGoodItemId');
    const bomId = parseOptionalId(req.body.bomId, 'bomId');
    const plannedQuantity = parseOptionalNumber(req.body.plannedQuantity, 'plannedQuantity') || 0;
    const unitId = parseId(req.body.unitId, 'unitId');
    const warehouseId = parseOptionalId(req.body.warehouseId, 'warehouseId');
    const locationId = parseOptionalId(req.body.locationId, 'locationId');
    const plannedStartDate = parseOptionalDate(req.body.plannedStartDate, 'plannedStartDate');
    const plannedEndDate = parseOptionalDate(req.body.plannedEndDate, 'plannedEndDate');
    const status = normalizeEnum(req.body.status, ['draft'], 'status') || 'draft';

    const consumptionSnapshots = buildConsumptionSnapshots(req.body.consumptionLines || []);

    let productionOrderId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        const documentNo = await documentService.generateDocumentNumber(tx, 'MO', branchId, new Date());

        const headerReq = new sql.Request(tx);
        headerReq.input('docNo', sql.NVarChar(50), documentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('fgId', sql.Int, finishedGoodItemId);
        headerReq.input('bomId', sql.Int, bomId);
        headerReq.input('plannedQty', sql.Decimal(18, 4), plannedQuantity);
        headerReq.input('unitId', sql.Int, unitId);
        headerReq.input('whId', sql.Int, warehouseId);
        headerReq.input('locId', sql.Int, locationId);
        headerReq.input('start', sql.Date, plannedStartDate);
        headerReq.input('end', sql.Date, plannedEndDate);
        headerReq.input('status', sql.NVarChar(30), status);
        headerReq.input('createdBy', sql.Int, userId);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.ProductionOrders (
            DocumentNo, BranchId, FinishedGoodItemId, BomId, PlannedQuantity,
            UnitId, WarehouseId, LocationId, PlannedStartDate, PlannedEndDate, Status, CreatedBy
          ) OUTPUT INSERTED.ProductionOrderId
          VALUES (
            @docNo, @branchId, @fgId, @bomId, @plannedQty,
            @unitId, @whId, @locId, @start, @end, @status, @createdBy
          )
        `);
        productionOrderId = headerRes.recordset[0].ProductionOrderId;

        for (const line of consumptionSnapshots) {
          const lineReq = new sql.Request(tx);
          lineReq.input('moId', sql.Int, productionOrderId);
          lineReq.input('ln', sql.Int, line.lineNum);
          lineReq.input('itemId', sql.Int, line.itemId);
          lineReq.input('lotId', sql.BigInt, line.lotId);
          lineReq.input('whId', sql.Int, line.warehouseId);
          lineReq.input('locId', sql.Int, line.locationId);
          lineReq.input('plannedQty', sql.Decimal(18, 4), line.plannedQuantity);
          lineReq.input('unitId', sql.Int, line.unitId);
          await lineReq.query(`
            INSERT INTO dbo.ProductionConsumption (
              ProductionOrderId, LineNum, ItemId, LotId, WarehouseId, LocationId, PlannedQuantity, UnitId
            ) VALUES (
              @moId, @ln, @itemId, @lotId, @whId, @locId, @plannedQty, @unitId
            )
          `);
        }

        const histReq = new sql.Request(tx);
        histReq.input('docId', sql.Int, productionOrderId);
        histReq.input('userId', sql.Int, userId);
        histReq.input('status', sql.NVarChar(30), status);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
          VALUES ('MO', @docId, @status, @userId, 'Production Order created')
        `);
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    res.status(201).json({ id: productionOrderId, message: 'Production Order created successfully' });
  })
);

router.post(
  '/:id/request-approval',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const id = parseId(req.params.id, 'id');
    const result = await productionOrderService.requestApproval(id, userId, req.body.steps || []);
    res.json(result);
  })
);

router.post(
  '/:id/approve',
  approveRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const id = parseId(req.params.id, 'id');
    const result = await productionOrderService.approveProductionOrder(id, userId);
    res.json(result);
  })
);

export default router;
