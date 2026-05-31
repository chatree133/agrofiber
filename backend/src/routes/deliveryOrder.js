import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'user', 'manager', 'audit', 'accounting');
const writeRoles = allowRoles('admin', 'user', 'manager');

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

function buildLineSnapshots(rawLines) {
  if (!Array.isArray(rawLines)) return [];
  const lines = [];
  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const raw = rawLines[idx] || {};
    const lineNum = Number.isInteger(raw.lineNum) && raw.lineNum > 0 ? raw.lineNum : idx + 1;
    lines.push({
      lineNum,
      itemId: parseId(raw.itemId, `lines[${idx}].itemId`),
      quantity: parseOptionalNumber(raw.quantity, `lines[${idx}].quantity`) ?? 0,
      unitId: parseId(raw.unitId, `lines[${idx}].unitId`),
    });
  }
  return lines;
}

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.status) {
      conditions.push('do.Status = @status');
      inputs.status = { type: sql.NVarChar(30), value: req.query.status };
    }
    if (req.query.customerId) {
      conditions.push('do.CustomerId = @customerId');
      inputs.customerId = { type: sql.Int, value: parseId(req.query.customerId, 'customerId') };
    }
    if (req.query.salesOrderId) {
      conditions.push('do.SalesOrderId = @salesOrderId');
      inputs.salesOrderId = { type: sql.Int, value: parseId(req.query.salesOrderId, 'salesOrderId') };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredOrders AS (
        SELECT do.DeliveryOrderId
        FROM dbo.DeliveryOrders do
        ${whereSql}
      )
      SELECT
        do.DeliveryOrderId, do.DocumentNo, do.BranchId,
        do.SalesOrderId, so.DocumentNo AS SalesOrderNo,
        do.CustomerId, c.CustomerCode, c.CustomerName,
        do.DocumentDate, do.Status, do.ShipToAddress, do.CreatedAt,
        (SELECT COUNT(1) FROM FilteredOrders) AS TotalCount
      FROM FilteredOrders fo
      JOIN dbo.DeliveryOrders do ON do.DeliveryOrderId = fo.DeliveryOrderId
      LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = do.SalesOrderId
      LEFT JOIN dbo.Customers c ON c.CustomerId = do.CustomerId
      ORDER BY do.CreatedAt DESC, do.DeliveryOrderId DESC
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
        id: r.DeliveryOrderId,
        documentNo: r.DocumentNo,
        branchId: r.BranchId,
        salesOrderId: r.SalesOrderId,
        salesOrderNo: r.SalesOrderNo,
        customerId: r.CustomerId,
        customerCode: r.CustomerCode,
        customerName: r.CustomerName,
        documentDate: r.DocumentDate,
        status: r.Status,
        shipToAddress: r.ShipToAddress,
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
    const doId = parseId(req.params.id, 'id');
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT do.*, c.CustomerCode, c.CustomerName, so.DocumentNo AS SalesOrderNo
      FROM dbo.DeliveryOrders do
      LEFT JOIN dbo.Customers c ON c.CustomerId = do.CustomerId
      LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = do.SalesOrderId
      WHERE do.DeliveryOrderId = @id
    `, { inputs: { id: { type: sql.Int, value: doId } } });

    if (headerRows.length === 0) {
      return res.status(404).json({ message: 'Delivery order not found' });
    }

    const linesRows = await mssqlQuery('DEFAULT', `
      SELECT dol.*, i.ItemCode, i.ItemName, u.UnitCode, u.UnitName
      FROM dbo.DeliveryOrderLines dol
      JOIN dbo.Items i ON i.ItemId = dol.ItemId
      JOIN dbo.Units u ON u.UnitId = dol.UnitId
      WHERE dol.DeliveryOrderId = @id
      ORDER BY dol.LineNum
    `, { inputs: { id: { type: sql.Int, value: doId } } });

    res.json({
      data: {
        ...headerRows[0],
        lines: linesRows,
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
    const customerId = parseId(req.body.customerId, 'customerId');
    const salesOrderId = parseOptionalId(req.body.salesOrderId, 'salesOrderId');
    const documentDate = parseOptionalDate(req.body.documentDate, 'documentDate') || new Date();
    const shipToAddress = req.body.shipToAddress ? String(req.body.shipToAddress).trim() : null;
    const status = normalizeEnum(req.body.status, ['draft'], 'status') || 'draft';

    const lineSnapshots = buildLineSnapshots(req.body.lines || []);
    if (lineSnapshots.length === 0) throw badRequest('At least one line is required');

    let deliveryOrderId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        const documentNo = await documentService.generateDocumentNumber(tx, 'DO', branchId, documentDate);

        const headerReq = new sql.Request(tx);
        headerReq.input('docNo', sql.NVarChar(50), documentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('customerId', sql.Int, customerId);
        headerReq.input('salesOrderId', sql.Int, salesOrderId);
        headerReq.input('docDate', sql.Date, documentDate);
        headerReq.input('status', sql.NVarChar(30), status);
        headerReq.input('shipToAddress', sql.NVarChar(1000), shipToAddress);
        headerReq.input('createdBy', sql.Int, userId);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.DeliveryOrders (
            DocumentNo, BranchId, CustomerId, SalesOrderId, DocumentDate, Status, ShipToAddress, CreatedBy
          ) OUTPUT INSERTED.DeliveryOrderId
          VALUES (
            @docNo, @branchId, @customerId, @salesOrderId, @docDate, @status, @shipToAddress, @createdBy
          )
        `);
        deliveryOrderId = headerRes.recordset[0].DeliveryOrderId;

        for (const line of lineSnapshots) {
          const lineReq = new sql.Request(tx);
          lineReq.input('doId', sql.Int, deliveryOrderId);
          lineReq.input('ln', sql.Int, line.lineNum);
          lineReq.input('itemId', sql.Int, line.itemId);
          lineReq.input('qty', sql.Decimal(18, 4), line.quantity);
          lineReq.input('unitId', sql.Int, line.unitId);
          await lineReq.query(`
            INSERT INTO dbo.DeliveryOrderLines (
              DeliveryOrderId, LineNum, ItemId, Quantity, UnitId
            ) VALUES (
              @doId, @ln, @itemId, @qty, @unitId
            )
          `);
        }

        const histReq = new sql.Request(tx);
        histReq.input('docId', sql.Int, deliveryOrderId);
        histReq.input('userId', sql.Int, userId);
        histReq.input('status', sql.NVarChar(30), status);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
          VALUES ('DO', @docId, @status, @userId, 'Delivery Order created')
        `);
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    res.status(201).json({ id: deliveryOrderId, message: 'Delivery Order created successfully' });
  })
);

router.get(
  '/:id/status-history',
  readRoles,
  asyncHandler(async (req, res) => {
    const doId = parseId(req.params.id, 'id');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT DocumentStatusHistoryId, DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, ChangedAt, Notes
      FROM dbo.DocumentStatusHistory
      WHERE DocumentType = 'DO' AND DocumentId = @id
      ORDER BY ChangedAt DESC, DocumentStatusHistoryId DESC
    `, { inputs: { id: { type: sql.Int, value: doId } } });
    res.json({ data: rows });
  })
);

export default router;
