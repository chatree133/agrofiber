import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';
import { approvalService } from '../services/common/approvalService.js';
import { quotationService } from '../services/sales/quotationService.js';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'user', 'manager', 'audit', 'sales');
const writeRoles = allowRoles('admin', 'user', 'manager', 'sales');

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
    const discountPercent = parseOptionalNumber(raw.discountPercent, `lines[${idx}].discountPercent`);

    let discountAmount = parseOptionalNumber(raw.discountAmount, `lines[${idx}].discountAmount`) ?? 0;
    if (discountPercent !== null && discountPercent !== undefined && !raw.discountAmount) {
      discountAmount = (quantity * unitPrice * discountPercent) / 100;
    }

    const netLineBeforeTax = (quantity * unitPrice) - discountAmount;
    const taxRatePercent = parseOptionalNumber(raw.taxRatePercent, `lines[${idx}].taxRatePercent`) ?? 0;
    const taxAmount = (netLineBeforeTax * taxRatePercent) / 100;

    lines.push({
      lineNum,
      itemId: parseId(raw.itemId, `lines[${idx}].itemId`),
      quantity,
      unitPrice,
      discountPercent,
      discountAmount,
      taxRatePercent,
      unitCostSnapshot: parseOptionalNumber(raw.unitCostSnapshot, `lines[${idx}].unitCostSnapshot`),
      pricingSource: raw.pricingSource ? String(raw.pricingSource).trim() : null,
      pricingReferenceId: parseOptionalId(raw.pricingReferenceId, `lines[${idx}].pricingReferenceId`),
      marginPercentSnapshot: parseOptionalNumber(raw.marginPercentSnapshot, `lines[${idx}].marginPercentSnapshot`),
      markupPercentSnapshot: parseOptionalNumber(raw.markupPercentSnapshot, `lines[${idx}].markupPercentSnapshot`),
      lineAmount: netLineBeforeTax,
      taxAmount,
      unitId: parseId(raw.unitId, `lines[${idx}].unitId`),
      itemSpecId: parseOptionalId(raw.itemSpecId, `lines[${idx}].itemSpecId`),
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

const uploadDir = path.resolve('uploads/quotations');

async function saveAttachment(fileName, dataUrl) {
  if (!dataUrl) return null;
  const match = /^data:.+;base64,(.+)$/i.exec(dataUrl);
  if (!match) throw badRequest('Invalid file format. Must be base64 data URL.');

  const buffer = Buffer.from(match[1], 'base64');
  await fs.mkdir(uploadDir, { recursive: true });
  const uuid = crypto.randomUUID();
  const fileExt = path.extname(fileName) || '';
  const fileBasename = path.basename(fileName, fileExt) || 'file';
  const uniqueName = `${fileBasename}-${uuid}${fileExt}`;

  await fs.writeFile(path.join(uploadDir, uniqueName), buffer);
  return {
    filePath: `/uploads/quotations/${uniqueName}`,
    fileName: fileName,
    fileSize: buffer.length,
  };
}

router.post(
  '/upload',
  writeRoles,
  asyncHandler(async (req, res) => {
    const { fileName, fileDataUrl } = req.body;
    if (!fileName || !fileDataUrl) throw badRequest('fileName and fileDataUrl are required');

    const result = await saveAttachment(fileName, fileDataUrl);
    res.json({ data: result });
  })
);

router.get(
  '/price-lookup',
  readRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.query.customerId, 'customerId');
    const itemId = parseId(req.query.itemId, 'itemId');
    const unitId = parseId(req.query.unitId, 'unitId');

    // 1. Find customer PriceListId
    const customerRes = await mssqlQuery('DEFAULT', `
      SELECT PriceListId FROM dbo.Customers WHERE CustomerId = @customerId
    `, { inputs: { customerId: { type: sql.Int, value: customerId } } });

    let price = null;
    let pricingSource = 'Manual';

    if (customerRes.length > 0 && customerRes[0].PriceListId) {
      const priceListId = customerRes[0].PriceListId;
      // Look up price in PriceListItems
      const pliRes = await mssqlQuery('DEFAULT', `
        SELECT TOP 1 UnitPrice 
        FROM dbo.PriceListItems 
        WHERE PriceListId = @priceListId 
          AND ItemId = @itemId 
          AND UnitId = @unitId 
          AND IsActive = 1
          AND EffectiveFrom <= CAST(SYSUTCDATETIME() AS DATE)
          AND (EffectiveTo IS NULL OR EffectiveTo >= CAST(SYSUTCDATETIME() AS DATE))
        ORDER BY EffectiveFrom DESC
      `, {
        inputs: {
          priceListId: { type: sql.Int, value: priceListId },
          itemId: { type: sql.Int, value: itemId },
          unitId: { type: sql.Int, value: unitId },
        }
      });
      if (pliRes.length > 0) {
        price = pliRes[0].UnitPrice;
        pricingSource = 'CUSTOMER_PRICE_LIST';
      }
    }

    // 2. If not found, look up the last sold price from SalesOrders
    if (price === null) {
      const solRes = await mssqlQuery('DEFAULT', `
        SELECT TOP 1 sol.UnitPrice
        FROM dbo.SalesOrderLines sol
        JOIN dbo.SalesOrders so ON so.SalesOrderId = sol.SalesOrderId
        WHERE so.CustomerId = @customerId 
          AND sol.ItemId = @itemId 
          AND sol.UnitId = @unitId 
          AND so.Status IN ('confirmed', 'approved')
        ORDER BY so.DocumentDate DESC, so.SalesOrderId DESC
      `, {
        inputs: {
          customerId: { type: sql.Int, value: customerId },
          itemId: { type: sql.Int, value: itemId },
          unitId: { type: sql.Int, value: unitId },
        }
      });
      if (solRes.length > 0) {
        price = solRes[0].UnitPrice;
        pricingSource = 'LAST_SOLD_SO';
      }
    }

    // 3. If still not found, look up the last sold price from Quotations
    if (price === null) {
      const qlRes = await mssqlQuery('DEFAULT', `
        SELECT TOP 1 ql.UnitPrice
        FROM dbo.QuotationLines ql
        JOIN dbo.Quotations q ON q.QuotationId = ql.QuotationId
        WHERE q.CustomerId = @customerId 
          AND ql.ItemId = @itemId 
          AND ql.UnitId = @unitId 
          AND q.Status IN ('requested', 'approved')
        ORDER BY q.DocumentDate DESC, q.QuotationId DESC
      `, {
        inputs: {
          customerId: { type: sql.Int, value: customerId },
          itemId: { type: sql.Int, value: itemId },
          unitId: { type: sql.Int, value: unitId },
        }
      });
      if (qlRes.length > 0) {
        price = qlRes[0].UnitPrice;
        pricingSource = 'LAST_SOLD_QT';
      }
    }

    // 4. Default to 0
    if (price === null) {
      price = 0;
      pricingSource = 'None';
    }

    res.json({ data: { unitPrice: price, pricingSource } });
  })
);

router.get(
  '/customer-history/:customerId',
  readRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.customerId, 'customerId');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT QuotationId AS id, DocumentNo, DocumentDate, Status
      FROM dbo.Quotations
      WHERE CustomerId = @customerId
      ORDER BY DocumentDate DESC, QuotationId DESC
    `, { inputs: { customerId: { type: sql.Int, value: customerId } } });

    res.json({ data: rows });
  })
);

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.status) {
      conditions.push('q.Status = @status');
      inputs.status = { type: sql.NVarChar(30), value: req.query.status };
    }
    if (req.query.customerId) {
      conditions.push('q.CustomerId = @customerId');
      inputs.customerId = { type: sql.Int, value: parseId(req.query.customerId, 'customerId') };
    }
    if (req.query.search) {
      conditions.push('(q.DocumentNo LIKE @search OR c.CustomerName LIKE @search OR c.CustomerCode LIKE @search)');
      inputs.search = { type: sql.NVarChar(255), value: `%${String(req.query.search).trim()}%` };
    }
    if (req.query.startDate) {
      conditions.push('q.DocumentDate >= @startDate');
      inputs.startDate = { type: sql.Date, value: new Date(req.query.startDate) };
    }
    if (req.query.endDate) {
      conditions.push('q.DocumentDate <= @endDate');
      inputs.endDate = { type: sql.Date, value: new Date(req.query.endDate) };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredOrders AS (
        SELECT q.QuotationId
        FROM dbo.Quotations q
        LEFT JOIN dbo.Customers c ON c.CustomerId = q.CustomerId
        ${whereSql}
      )
      SELECT
        q.QuotationId, q.DocumentNo, q.BranchId,
        q.CustomerId, c.CustomerCode, c.CustomerName,
        q.DocumentDate, q.ValidUntil, q.Status,
      q.CustomerPoNo,
      q.CustomerPoDate,
      q.SalesPersonId,
      q.PaymentTermId,
      q.PriceListId,
      q.WarehouseId,
      q.TaxType,
      q.Remarks, q.CurrencyCode,
        q.GrandTotalAmount, q.CreatedAt,
        (SELECT COUNT(1) FROM FilteredOrders) AS TotalCount
      FROM FilteredOrders fo
      JOIN dbo.Quotations q ON q.QuotationId = fo.QuotationId
      LEFT JOIN dbo.Customers c ON c.CustomerId = q.CustomerId
      ORDER BY q.CreatedAt DESC, q.QuotationId DESC
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
        id: r.QuotationId,
        documentNo: r.DocumentNo,
        branchId: r.BranchId,
        customerId: r.CustomerId,
        customerCode: r.CustomerCode,
        customerName: r.CustomerName,
        documentDate: r.DocumentDate,
        validUntil: r.ValidUntil,
        status: r.Status,
        currencyCode: r.CurrencyCode,
        grandTotalAmount: r.GrandTotalAmount,
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
    const qtId = parseId(req.params.id, 'id');
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT q.*, c.CustomerCode, c.CustomerName, c.TaxId
      FROM dbo.Quotations q
      LEFT JOIN dbo.Customers c ON c.CustomerId = q.CustomerId
      WHERE q.QuotationId = @id
    `, { inputs: { id: { type: sql.Int, value: qtId } } });

    if (headerRows.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    const linesRows = await mssqlQuery('DEFAULT', `
      SELECT 
        ql.*, 
        i.ItemCode, 
        i.ItemName, 
        u.UnitCode, 
        u.UnitName,
        pt.ProductTypeCode,
        th.ThicknessMm,
        th.ThicknessLabel,
        w.WidthM,
        w.WidthLabel,
        l.LengthM,
        l.LengthLabel,
        ispec.SalesSKU,
        ispec.SpecName
      FROM dbo.QuotationLines ql
      JOIN dbo.Items i ON i.ItemId = ql.ItemId
      JOIN dbo.Units u ON u.UnitId = ql.UnitId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = ql.ItemSpecId
      LEFT JOIN dbo.ProductTypes pt ON pt.ProductTypeId = i.ProductTypeId
      LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
      LEFT JOIN dbo.ItemWidths w ON w.WidthId = i.WidthId
      LEFT JOIN dbo.ItemLengths l ON l.LengthId = i.LengthId
      WHERE ql.QuotationId = @id
      ORDER BY ql.LineNum
    `, { inputs: { id: { type: sql.Int, value: qtId } } });

    const attachmentsRows = await mssqlQuery('DEFAULT', `
      SELECT QuotationAttachmentId AS id, FileName AS fileName, FilePath AS filePath, FileSize AS fileSize
      FROM dbo.QuotationAttachments
      WHERE QuotationId = @id
    `, { inputs: { id: { type: sql.Int, value: qtId } } });

    res.json({
      data: {
        ...headerRows[0],
        lines: linesRows,
        attachments: attachmentsRows,
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
    const documentDate = parseOptionalDate(req.body.documentDate, 'documentDate') || new Date();
    const validUntil = parseOptionalDate(req.body.validUntil, 'validUntil');
    const currencyCode = req.body.currencyCode ? String(req.body.currencyCode).toUpperCase().slice(0, 3) : 'THB';
    const customerPoNo = req.body.customerPoNo ? String(req.body.customerPoNo).trim() : null;
    const customerPoDate = parseOptionalDate(req.body.customerPoDate, 'customerPoDate');
    const salesPersonId = parseOptionalId(req.body.salesPersonId, 'salesPersonId');
    const paymentTermId = parseOptionalId(req.body.paymentTermId, 'paymentTermId');
    const priceListId = parseOptionalId(req.body.priceListId, 'priceListId');
    const warehouseId = parseOptionalId(req.body.warehouseId, 'warehouseId');
    const taxType = normalizeEnum(req.body.taxType, ['exclusive', 'inclusive', 'no_vat'], 'taxType') || 'exclusive';
    const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;
    const status = normalizeEnum(req.body.status, ['draft', 'requested'], 'status') || 'draft';
    const billingAddress = req.body.billingAddress ? String(req.body.billingAddress).trim() : null;

    const lineSnapshots = buildLineSnapshots(req.body.lines || []);
    if (lineSnapshots.length === 0) throw badRequest('At least one line is required');
    const totals = calculateHeaderTotals(lineSnapshots);

    let quotationId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        const documentNo = await documentService.generateDocumentNumber(tx, 'QT', branchId, documentDate);

        const headerReq = new sql.Request(tx);
        headerReq.input('docNo', sql.NVarChar(50), documentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('customerId', sql.Int, customerId);
        headerReq.input('docDate', sql.Date, documentDate);
        headerReq.input('validUntil', sql.Date, validUntil);
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
        headerReq.input('createdBy', sql.Int, userId);
        headerReq.input('billingAddress', sql.NVarChar(1000), billingAddress);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.Quotations (
            DocumentNo, BranchId, CustomerId, DocumentDate, ValidUntil,
            Status, CustomerPoNo, CustomerPoDate, SalesPersonId, PaymentTermId, PriceListId, WarehouseId, TaxType, Remarks, CurrencyCode, SubTotalAmount, DiscountAmount, TaxAmount, GrandTotalAmount, CreatedBy, BillingAddress
          ) OUTPUT INSERTED.QuotationId
          VALUES (
            @docNo, @branchId, @customerId, @docDate, @validUntil,
            @status, @customerPoNo, @customerPoDate, @salesPersonId, @paymentTermId, @priceListId, @warehouseId, @taxType, @remarks, @currencyCode, @subTotalAmount, @discountAmount, @taxAmount, @grandTotalAmount, @createdBy, @billingAddress
          )
        `);
        quotationId = headerRes.recordset[0].QuotationId;

        for (const line of lineSnapshots) {
          const lineReq = new sql.Request(tx);
          lineReq.input('qtId', sql.Int, quotationId);
          lineReq.input('ln', sql.Int, line.lineNum);
          lineReq.input('itemId', sql.Int, line.itemId);
          lineReq.input('qty', sql.Decimal(18, 4), line.quantity);
          lineReq.input('unitPrice', sql.Decimal(18, 4), line.unitPrice);
          lineReq.input('discountPercent', sql.Decimal(9, 4), line.discountPercent);
          lineReq.input('discountAmount', sql.Decimal(18, 4), line.discountAmount);
          lineReq.input('taxRatePercent', sql.Decimal(9, 4), line.taxRatePercent);
          lineReq.input('unitCostSnapshot', sql.Decimal(18, 4), line.unitCostSnapshot);
          lineReq.input('pricingSource', sql.NVarChar(40), line.pricingSource === 'None' ? null : line.pricingSource);
          lineReq.input('pricingRefId', sql.Int, line.pricingReferenceId);
          lineReq.input('marginPct', sql.Decimal(9, 4), line.marginPercentSnapshot);
          lineReq.input('markupPct', sql.Decimal(9, 4), line.markupPercentSnapshot);
          lineReq.input('lineAmt', sql.Decimal(18, 4), line.lineAmount);
          lineReq.input('taxAmt', sql.Decimal(18, 4), line.taxAmount);
          lineReq.input('unitId', sql.Int, line.unitId);
          lineReq.input('itemSpecId', sql.Int, line.itemSpecId);

          await lineReq.query(`
            INSERT INTO dbo.QuotationLines (
              QuotationId, LineNum, ItemId, Quantity, UnitPrice, DiscountPercent, DiscountAmount,
              TaxRatePercent, UnitCostSnapshot, PricingSource, PricingReferenceId,
              MarginPercentSnapshot, MarkupPercentSnapshot, LineAmount, TaxCodeId, TaxAmount, UnitId, ItemSpecId
            ) VALUES (
              @qtId, @ln, @itemId, @qty, @unitPrice, @discountPercent, @discountAmount,
              @taxRatePercent, @unitCostSnapshot, @pricingSource, @pricingRefId,
              @marginPct, @markupPct, @lineAmt, NULL, @taxAmt, @unitId, @itemSpecId
            )
          `);
        }

        if (Array.isArray(req.body.attachments) && req.body.attachments.length > 0) {
          for (const att of req.body.attachments) {
            const attReq = new sql.Request(tx);
            attReq.input('qtId', sql.Int, quotationId);
            attReq.input('name', sql.NVarChar(255), att.fileName);
            attReq.input('path', sql.NVarChar(500), att.filePath);
            attReq.input('size', sql.Int, att.fileSize);
            attReq.input('userId', sql.Int, userId);
            await attReq.query(`
              INSERT INTO dbo.QuotationAttachments (QuotationId, FileName, FilePath, FileSize, UploadedBy)
              VALUES (@qtId, @name, @path, @size, @userId)
            `);
          }
        }

        const histReq = new sql.Request(tx);
        histReq.input('docId', sql.Int, quotationId);
        histReq.input('userId', sql.Int, userId);
        histReq.input('status', sql.NVarChar(30), status);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
          VALUES ('QT', @docId, @status, @userId, 'Quotation created')
        `);

        if (status === 'requested') {
          await approvalService.createRequest({
            documentType: 'QT',
            documentId: quotationId,
            requestedBy: userId,
            notes: `Approval request for Quotation ${documentNo}`,
            steps: req.body.steps || []
          }, tx);
        }
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    res.status(201).json({ id: quotationId, message: 'Quotation created successfully' });
  })
);

router.get(
  '/:id/status-history',
  readRoles,
  asyncHandler(async (req, res) => {
    const qtId = parseId(req.params.id, 'id');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT DocumentStatusHistoryId, DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, ChangedAt, Notes
      FROM dbo.DocumentStatusHistory
      WHERE DocumentType = 'QT' AND DocumentId = @id
      ORDER BY ChangedAt DESC, DocumentStatusHistoryId DESC
    `, { inputs: { id: { type: sql.Int, value: qtId } } });
    res.json({ data: rows });
  })
);

router.delete(
  '/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    const qtId = parseId(req.params.id, 'id');
    const userId = getUserId(req);

    await mssqlTransaction('DEFAULT', async (tx) => {
      // 1. Verify quotation exists
      const checkReq = new sql.Request(tx);
      checkReq.input('id', sql.Int, qtId);
      const checkRes = await checkReq.query(`
        SELECT Status FROM dbo.Quotations WHERE QuotationId = @id
      `);

      if (checkRes.recordset.length === 0) {
        throw badRequest('Quotation not found');
      }

      // 2. Perform soft delete by setting Status = 'closed'
      const updateReq = new sql.Request(tx);
      updateReq.input('id', sql.Int, qtId);
      await updateReq.query(`
        UPDATE dbo.Quotations
        SET Status = 'closed', UpdatedAt = SYSUTCDATETIME()
        WHERE QuotationId = @id
      `);

      // 3. Log status change history
      const histReq = new sql.Request(tx);
      histReq.input('id', sql.Int, qtId);
      histReq.input('userId', sql.Int, userId);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
        VALUES ('QT', @id, 'closed', @userId, 'Soft deleted (Closed)')
      `);
    });

    res.json({ message: 'Quotation soft-deleted successfully' });
  })
);

// 1. ส่งใบเสนอราคาขออนุมัติ
router.post(
  '/:id/request-approval',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const quotationId = parseId(req.params.id, 'id');
    const { steps } = req.body;
    const result = await quotationService.requestApproval(quotationId, userId, steps);
    res.json(result);
  })
);

// 2. อนุมัติใบเสนอราคา (กรณีต้องการทำ standalone / manual)
router.post(
  '/:id/approve',
  allowRoles('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const quotationId = parseId(req.params.id, 'id');
    const result = await quotationService.approveQuotation(quotationId, userId);
    res.json(result);
  })
);

// 3. ปฏิเสธใบเสนอราคา (กรณีต้องการทำ standalone / manual)
router.post(
  '/:id/reject',
  allowRoles('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const quotationId = parseId(req.params.id, 'id');
    const result = await quotationService.rejectQuotation(quotationId, userId);
    res.json(result);
  })
);

export default router;
