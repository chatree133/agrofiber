import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'user', 'manager', 'audit', 'accounting');
const writeRoles = allowRoles('admin', 'user', 'manager', 'accounting');

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
  if (!Array.isArray(rawLines) || !rawLines.length) throw badRequest('lines is required');
  const lines = [];

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const raw = rawLines[idx] || {};
    const lineNum = Number.isInteger(raw.lineNum) && raw.lineNum > 0 ? raw.lineNum : idx + 1;

    const quantity = parseOptionalNumber(raw.quantity, `lines[${idx}].quantity`) ?? 0;
    const unitPrice = parseOptionalNumber(raw.unitPrice, `lines[${idx}].unitPrice`) ?? 0;
    
    // Explicit discountAmount provided or default 0
    let discountAmount = parseOptionalNumber(raw.discountAmount, `lines[${idx}].discountAmount`) ?? 0;

    const netLineBeforeTax = (quantity * unitPrice) - discountAmount;
    const taxRatePercent = parseOptionalNumber(raw.taxRatePercent, `lines[${idx}].taxRatePercent`) ?? 0;
    const taxAmount = (netLineBeforeTax * taxRatePercent) / 100;
    
    lines.push({
      lineNum,
      itemId: parseId(raw.itemId, `lines[${idx}].itemId`),
      quantity,
      unitId: parseId(raw.unitId, `lines[${idx}].unitId`),
      unitPrice,
      discountAmount,
      taxRatePercent,
      lineAmount: netLineBeforeTax,
      taxAmount,
    });
  }

  return lines;
}

function calculateHeaderTotals(lines) {
  let subTotalAmount = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  for (const line of lines) {
    const rawLineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    subTotalAmount += rawLineTotal;
    discountAmount += Number(line.discountAmount || 0);
    taxAmount += Number(line.taxAmount || 0);
  }

  const grandTotalAmount = (subTotalAmount - discountAmount) + taxAmount;
  return { subTotalAmount, discountAmount, taxAmount, grandTotalAmount };
}

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.status) {
      conditions.push('inv.Status = @status');
      inputs.status = { type: sql.NVarChar(30), value: req.query.status };
    }
    if (req.query.customerId) {
      conditions.push('inv.CustomerId = @customerId');
      inputs.customerId = { type: sql.Int, value: parseId(req.query.customerId, 'customerId') };
    }
    if (req.query.salesOrderId) {
      conditions.push('inv.SalesOrderId = @salesOrderId');
      inputs.salesOrderId = { type: sql.Int, value: parseId(req.query.salesOrderId, 'salesOrderId') };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredInvoices AS (
        SELECT inv.SalesInvoiceId
        FROM dbo.SalesInvoices inv
        ${whereSql}
      )
      SELECT
        inv.SalesInvoiceId, inv.DocumentNo, inv.BranchId,
        inv.SalesOrderId, so.DocumentNo AS SalesOrderNo,
        inv.DeliveryOrderId, do.DocumentNo AS DeliveryOrderNo,
        inv.CustomerId, c.CustomerCode, c.CustomerName,
        inv.DocumentDate, inv.DueDate, inv.Status,
      inv.CustomerPoNo,
      inv.CustomerPoDate,
      inv.SalesPersonId,
      inv.PaymentTermId,
      inv.PriceListId,
      inv.WarehouseId,
      inv.TaxType,
      inv.Remarks, inv.CurrencyCode,
        inv.GrandTotalAmount, inv.PaidAmount, inv.CreatedAt,
        (SELECT COUNT(1) FROM FilteredInvoices) AS TotalCount
      FROM FilteredInvoices fi
      JOIN dbo.SalesInvoices inv ON inv.SalesInvoiceId = fi.SalesInvoiceId
      LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = inv.SalesOrderId
      LEFT JOIN dbo.DeliveryOrders do ON do.DeliveryOrderId = inv.DeliveryOrderId
      LEFT JOIN dbo.Customers c ON c.CustomerId = inv.CustomerId
      ORDER BY inv.CreatedAt DESC, inv.SalesInvoiceId DESC
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
        id: r.SalesInvoiceId,
        documentNo: r.DocumentNo,
        branchId: r.BranchId,
        salesOrderId: r.SalesOrderId,
        salesOrderNo: r.SalesOrderNo,
        deliveryOrderId: r.DeliveryOrderId,
        deliveryOrderNo: r.DeliveryOrderNo,
        customerId: r.CustomerId,
        customerCode: r.CustomerCode,
        customerName: r.CustomerName,
        documentDate: r.DocumentDate,
        dueDate: r.DueDate,
        status: r.Status,
        currencyCode: r.CurrencyCode,
        grandTotalAmount: r.GrandTotalAmount,
        paidAmount: r.PaidAmount,
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
    const invId = parseId(req.params.id, 'id');
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT inv.*, c.CustomerCode, c.CustomerName, 
             so.DocumentNo AS SalesOrderNo, do.DocumentNo AS DeliveryOrderNo
      FROM dbo.SalesInvoices inv
      LEFT JOIN dbo.Customers c ON c.CustomerId = inv.CustomerId
      LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = inv.SalesOrderId
      LEFT JOIN dbo.DeliveryOrders do ON do.DeliveryOrderId = inv.DeliveryOrderId
      WHERE inv.SalesInvoiceId = @id
    `, { inputs: { id: { type: sql.Int, value: invId } } });

    if (headerRows.length === 0) {
      return res.status(404).json({ message: 'Sales invoice not found' });
    }

    const linesRows = await mssqlQuery('DEFAULT', `
      SELECT il.*, i.ItemCode, i.ItemName, u.UnitCode, u.UnitName
      FROM dbo.SalesInvoiceLines il
      JOIN dbo.Items i ON i.ItemId = il.ItemId
      JOIN dbo.Units u ON u.UnitId = il.UnitId
      WHERE il.SalesInvoiceId = @id
      ORDER BY il.LineNum
    `, { inputs: { id: { type: sql.Int, value: invId } } });

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
    const deliveryOrderId = parseOptionalId(req.body.deliveryOrderId, 'deliveryOrderId');
    const documentDate = parseOptionalDate(req.body.documentDate, 'documentDate') || new Date();
    const dueDate = parseOptionalDate(req.body.dueDate, 'dueDate');
    const currencyCode = req.body.currencyCode ? String(req.body.currencyCode).toUpperCase().slice(0, 3) : 'THB';
    const customerPoNo = req.body.customerPoNo ? String(req.body.customerPoNo).trim() : null;
    const customerPoDate = parseOptionalDate(req.body.customerPoDate, 'customerPoDate');
    const salesPersonId = parseOptionalId(req.body.salesPersonId, 'salesPersonId');
    const paymentTermId = parseOptionalId(req.body.paymentTermId, 'paymentTermId');
    const priceListId = parseOptionalId(req.body.priceListId, 'priceListId');
    const warehouseId = parseOptionalId(req.body.warehouseId, 'warehouseId');
    const taxType = normalizeEnum(req.body.taxType, ['exclusive', 'inclusive', 'no_vat'], 'taxType') || 'exclusive';
    const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;
    const status = normalizeEnum(req.body.status, ['draft', 'posted'], 'status') || 'draft';

    const lineSnapshots = buildLineSnapshots(req.body.lines || []);
    if (lineSnapshots.length === 0) throw badRequest('At least one line is required');
    const totals = calculateHeaderTotals(lineSnapshots);

    let salesInvoiceId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        const documentNo = await documentService.generateDocumentNumber(tx, 'INV', branchId, documentDate);

        const headerReq = new sql.Request(tx);
        headerReq.input('docNo', sql.NVarChar(50), documentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('customerId', sql.Int, customerId);
        headerReq.input('salesOrderId', sql.Int, salesOrderId);
        headerReq.input('deliveryOrderId', sql.Int, deliveryOrderId);
        headerReq.input('docDate', sql.Date, documentDate);
        headerReq.input('dueDate', sql.Date, dueDate);
        headerReq.input('status', sql.NVarChar(30), status);
        headerReq.input('currencyCode', sql.Char(3), currencyCode);
        headerReq.input('customerPoNo', sql.NVarChar(100), customerPoNo);
        headerReq.input('customerPoDate', sql.Date, customerPoDate);
        headerReq.input('salesPersonId', sql.Int, salesPersonId);
        headerReq.input('paymentTermId', sql.Int, paymentTermId);
        headerReq.input('priceListId', sql.Int, priceListId);
        headerReq.input('warehouseId', sql.Int, warehouseId);
        headerReq.input('taxType', sql.NVarChar(20), taxType);
        headerReq.input('remarks', sql.NVarChar(sql.MAX), remarks);
        headerReq.input('subTotalAmount', sql.Decimal(18, 4), totals.subTotalAmount);
        headerReq.input('discountAmount', sql.Decimal(18, 4), totals.discountAmount);
        headerReq.input('taxAmount', sql.Decimal(18, 4), totals.taxAmount);
        headerReq.input('grandTotalAmount', sql.Decimal(18, 4), totals.grandTotalAmount);
        headerReq.input('paidAmount', sql.Decimal(18, 4), 0); // initial payment is 0
        headerReq.input('createdBy', sql.Int, userId);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.SalesInvoices (
            DocumentNo, BranchId, CustomerId, SalesOrderId, DeliveryOrderId, DocumentDate, DueDate,
            Status, CustomerPoNo, CustomerPoDate, SalesPersonId, PaymentTermId, PriceListId, WarehouseId, TaxType, Remarks, CurrencyCode, SubTotalAmount, DiscountAmount, TaxAmount, GrandTotalAmount, PaidAmount, CreatedBy
          ) OUTPUT INSERTED.SalesInvoiceId
          VALUES (
            @docNo, @branchId, @customerId, @salesOrderId, @deliveryOrderId, @docDate, @dueDate,
            @status, @customerPoNo, @customerPoDate, @salesPersonId, @paymentTermId, @priceListId, @warehouseId, @taxType, @remarks, @currencyCode, @subTotalAmount, @discountAmount, @taxAmount, @grandTotalAmount, @paidAmount, @createdBy
          )
        `);
        salesInvoiceId = headerRes.recordset[0].SalesInvoiceId;

        for (const line of lineSnapshots) {
          const lineReq = new sql.Request(tx);
          lineReq.input('invId', sql.Int, salesInvoiceId);
          lineReq.input('ln', sql.Int, line.lineNum);
          lineReq.input('itemId', sql.Int, line.itemId);
          lineReq.input('qty', sql.Decimal(18, 4), line.quantity);
          lineReq.input('unitId', sql.Int, line.unitId);
          lineReq.input('unitPrice', sql.Decimal(18, 4), line.unitPrice);
          lineReq.input('discountAmount', sql.Decimal(18, 4), line.discountAmount);
          lineReq.input('taxRatePercent', sql.Decimal(9, 4), line.taxRatePercent);
          lineReq.input('lineAmt', sql.Decimal(18, 4), line.lineAmount);
          lineReq.input('taxAmt', sql.Decimal(18, 4), line.taxAmount);

          await lineReq.query(`
            INSERT INTO dbo.SalesInvoiceLines (
              SalesInvoiceId, LineNum, ItemId, Quantity, UnitId, UnitPrice,
              DiscountAmount, TaxRatePercent, LineAmount, TaxAmount
            ) VALUES (
              @invId, @ln, @itemId, @qty, @unitId, @unitPrice,
              @discountAmount, @taxRatePercent, @lineAmt, @taxAmt
            )
          `);
        }

        const histReq = new sql.Request(tx);
        histReq.input('docId', sql.Int, salesInvoiceId);
        histReq.input('userId', sql.Int, userId);
        histReq.input('status', sql.NVarChar(30), status);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
          VALUES ('INV', @docId, @status, @userId, 'Sales Invoice created')
        `);
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    res.status(201).json({ id: salesInvoiceId, message: 'Sales Invoice created successfully' });
  })
);

router.get(
  '/:id/status-history',
  readRoles,
  asyncHandler(async (req, res) => {
    const invId = parseId(req.params.id, 'id');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT DocumentStatusHistoryId, DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, ChangedAt, Notes
      FROM dbo.DocumentStatusHistory
      WHERE DocumentType = 'INV' AND DocumentId = @id
      ORDER BY ChangedAt DESC, DocumentStatusHistoryId DESC
    `, { inputs: { id: { type: sql.Int, value: invId } } });
    res.json({ data: rows });
  })
);

export default router;
