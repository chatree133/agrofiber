import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'user', 'manager', 'audit', 'accounting');
const writeRoles = allowRoles('admin', 'manager', 'accounting');

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

function buildAllocations(rawLines) {
  if (!Array.isArray(rawLines)) return [];
  const lines = [];

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const raw = rawLines[idx] || {};
    const amountApplied = parseOptionalNumber(raw.amountApplied, `allocations[${idx}].amountApplied`) ?? 0;
    if (amountApplied <= 0) continue; // Skip zero allocations

    lines.push({
      salesInvoiceId: parseId(raw.salesInvoiceId, `allocations[${idx}].salesInvoiceId`),
      amountApplied,
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

    if (req.query.customerId) {
      conditions.push('cp.CustomerId = @customerId');
      inputs.customerId = { type: sql.Int, value: parseId(req.query.customerId, 'customerId') };
    }
    if (req.query.paymentMethod) {
      conditions.push('cp.PaymentMethod = @paymentMethod');
      inputs.paymentMethod = { type: sql.NVarChar(40), value: req.query.paymentMethod };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredPayments AS (
        SELECT cp.CustomerPaymentId
        FROM dbo.CustomerPayments cp
        ${whereSql}
      )
      SELECT
        cp.CustomerPaymentId, cp.PaymentNo, cp.BranchId,
        cp.CustomerId, c.CustomerCode, c.CustomerName,
        cp.PaymentDate, cp.PaymentMethod, cp.CurrencyCode,
        cp.Amount, cp.ReferenceNo, cp.Notes, cp.CreatedAt,
        (SELECT COUNT(1) FROM FilteredPayments) AS TotalCount
      FROM FilteredPayments fp
      JOIN dbo.CustomerPayments cp ON cp.CustomerPaymentId = fp.CustomerPaymentId
      LEFT JOIN dbo.Customers c ON c.CustomerId = cp.CustomerId
      ORDER BY cp.CreatedAt DESC, cp.CustomerPaymentId DESC
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
        id: r.CustomerPaymentId,
        paymentNo: r.PaymentNo,
        branchId: r.BranchId,
        customerId: r.CustomerId,
        customerCode: r.CustomerCode,
        customerName: r.CustomerName,
        paymentDate: r.PaymentDate,
        paymentMethod: r.PaymentMethod,
        currencyCode: r.CurrencyCode,
        amount: r.Amount,
        referenceNo: r.ReferenceNo,
        notes: r.Notes,
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
    const cpId = parseId(req.params.id, 'id');
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT cp.*, c.CustomerCode, c.CustomerName
      FROM dbo.CustomerPayments cp
      LEFT JOIN dbo.Customers c ON c.CustomerId = cp.CustomerId
      WHERE cp.CustomerPaymentId = @id
    `, { inputs: { id: { type: sql.Int, value: cpId } } });

    if (headerRows.length === 0) {
      return res.status(404).json({ message: 'Customer payment not found' });
    }

    const allocRows = await mssqlQuery('DEFAULT', `
      SELECT cpa.*, inv.DocumentNo AS SalesInvoiceNo
      FROM dbo.CustomerPaymentAllocations cpa
      JOIN dbo.SalesInvoices inv ON inv.SalesInvoiceId = cpa.SalesInvoiceId
      WHERE cpa.CustomerPaymentId = @id
    `, { inputs: { id: { type: sql.Int, value: cpId } } });

    res.json({
      data: {
        ...headerRows[0],
        allocations: allocRows,
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
    const paymentDate = parseOptionalDate(req.body.paymentDate, 'paymentDate') || new Date();
    const paymentMethod = req.body.paymentMethod ? String(req.body.paymentMethod).trim() : 'transfer';
    const currencyCode = req.body.currencyCode ? String(req.body.currencyCode).toUpperCase().slice(0, 3) : 'THB';
    const amount = parseOptionalNumber(req.body.amount, 'amount') || 0;
    const referenceNo = req.body.referenceNo ? String(req.body.referenceNo).trim() : null;
    const notes = req.body.notes ? String(req.body.notes).trim() : null;

    if (amount <= 0) throw badRequest('Payment amount must be greater than zero');

    const allocations = buildAllocations(req.body.allocations || []);
    
    // Validate that total allocation doesn't exceed payment amount
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amountApplied, 0);
    if (totalAllocated > amount) {
      throw badRequest(`Total allocated amount (${totalAllocated}) cannot exceed payment amount (${amount})`);
    }

    let customerPaymentId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        // Document Type code for Customer Payment is usually RCPT
        const paymentNo = await documentService.generateDocumentNumber(tx, 'RCPT', branchId, paymentDate);

        const headerReq = new sql.Request(tx);
        headerReq.input('paymentNo', sql.NVarChar(50), paymentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('customerId', sql.Int, customerId);
        headerReq.input('paymentDate', sql.Date, paymentDate);
        headerReq.input('paymentMethod', sql.NVarChar(40), paymentMethod);
        headerReq.input('currencyCode', sql.Char(3), currencyCode);
        headerReq.input('amount', sql.Decimal(18, 4), amount);
        headerReq.input('referenceNo', sql.NVarChar(100), referenceNo);
        headerReq.input('notes', sql.NVarChar(1000), notes);
        headerReq.input('createdBy', sql.Int, userId);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.CustomerPayments (
            PaymentNo, BranchId, CustomerId, PaymentDate, PaymentMethod, CurrencyCode,
            Amount, ReferenceNo, Notes, CreatedBy
          ) OUTPUT INSERTED.CustomerPaymentId
          VALUES (
            @paymentNo, @branchId, @customerId, @paymentDate, @paymentMethod, @currencyCode,
            @amount, @referenceNo, @notes, @createdBy
          )
        `);
        customerPaymentId = headerRes.recordset[0].CustomerPaymentId;

        for (const alloc of allocations) {
          const allocReq = new sql.Request(tx);
          allocReq.input('cpId', sql.Int, customerPaymentId);
          allocReq.input('invId', sql.Int, alloc.salesInvoiceId);
          allocReq.input('applied', sql.Decimal(18, 4), alloc.amountApplied);

          await allocReq.query(`
            INSERT INTO dbo.CustomerPaymentAllocations (
              CustomerPaymentId, SalesInvoiceId, AmountApplied
            ) VALUES (
              @cpId, @invId, @applied
            )
          `);

          // Automatically update the PaidAmount on the Sales Invoice
          const invUpdateReq = new sql.Request(tx);
          invUpdateReq.input('invId', sql.Int, alloc.salesInvoiceId);
          invUpdateReq.input('applied', sql.Decimal(18, 4), alloc.amountApplied);
          await invUpdateReq.query(`
            UPDATE dbo.SalesInvoices
            SET PaidAmount = PaidAmount + @applied
            WHERE SalesInvoiceId = @invId
          `);
        }

        const histReq = new sql.Request(tx);
        histReq.input('docId', sql.Int, customerPaymentId);
        histReq.input('userId', sql.Int, userId);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
          VALUES ('RCPT', @docId, 'posted', @userId, 'Payment received and allocated')
        `);
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    res.status(201).json({ id: customerPaymentId, message: 'Customer payment recorded successfully' });
  })
);

router.get(
  '/:id/status-history',
  readRoles,
  asyncHandler(async (req, res) => {
    const cpId = parseId(req.params.id, 'id');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT DocumentStatusHistoryId, DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, ChangedAt, Notes
      FROM dbo.DocumentStatusHistory
      WHERE DocumentType = 'RCPT' AND DocumentId = @id
      ORDER BY ChangedAt DESC, DocumentStatusHistoryId DESC
    `, { inputs: { id: { type: sql.Int, value: cpId } } });
    res.json({ data: rows });
  })
);

export default router;
