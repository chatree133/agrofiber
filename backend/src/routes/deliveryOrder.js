import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';
import { postingService } from '../services/inventory/postingService.js';


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
      SELECT dol.*, i.ItemCode, i.ItemName, u.UnitCode, u.UnitName,
             ispec.SalesSKU, ispec.SpecCode, ispec.SpecName
      FROM dbo.DeliveryOrderLines dol
      JOIN dbo.Items i ON i.ItemId = dol.ItemId
      JOIN dbo.Units u ON u.UnitId = dol.UnitId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = dol.ItemSpecId
      WHERE dol.DeliveryOrderId = @id
      ORDER BY dol.LineNum
    `, { inputs: { id: { type: sql.Int, value: doId } } });

    res.json({
      data: {
        id: headerRows[0].DeliveryOrderId,
        deliveryOrderId: headerRows[0].DeliveryOrderId,
        documentNo: headerRows[0].DocumentNo,
        branchId: headerRows[0].BranchId,
        salesOrderId: headerRows[0].SalesOrderId,
        salesOrderNo: headerRows[0].SalesOrderNo,
        customerId: headerRows[0].CustomerId,
        customerCode: headerRows[0].CustomerCode,
        customerName: headerRows[0].CustomerName,
        documentDate: headerRows[0].DocumentDate,
        status: headerRows[0].Status,
        Status: headerRows[0].Status, // compatibility fallback
        shipToAddress: headerRows[0].ShipToAddress,
        createdAt: headerRows[0].CreatedAt,
        lines: linesRows.map(l => ({
          id: l.DeliveryOrderLineId,
          deliveryOrderId: l.DeliveryOrderId,
          lineNum: l.LineNum,
          itemId: l.ItemId,
          quantity: l.Quantity,
          unitId: l.UnitId,
          itemCode: l.SalesSKU || l.ItemCode,
          itemName: l.SpecName ? `${l.ItemName} - ${l.SpecName}` : l.ItemName,
          unitCode: l.UnitCode,
          unitName: l.UnitName,
          itemSpecId: l.ItemSpecId,
          salesSku: l.SalesSKU,
          specCode: l.SpecCode,
          specName: l.SpecName
        }))
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

// Confirms POD, posts Goods Issue, generates Invoice and optionally Payment/Receipt
router.post(
  '/:id/deliver-and-bill',
  writeRoles,
  asyncHandler(async (req, res) => {
    const doId = parseId(req.params.id, 'id');
    const userId = getUserId(req);

    const actualDeliveryDate = parseOptionalDate(req.body.actualDeliveryDate, 'actualDeliveryDate') || new Date();
    const recipientName = req.body.recipientName ? String(req.body.recipientName).trim() : null;
    const signatureUrl = req.body.signatureUrl ? String(req.body.signatureUrl).trim() : null;
    const photoUrl = req.body.photoUrl ? String(req.body.photoUrl).trim() : null;
    const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;

    const paymentMethod = req.body.paymentMethod ? String(req.body.paymentMethod).trim() : 'transfer';
    const amountPaid = parseOptionalNumber(req.body.amountPaid, 'amountPaid') || 0;

    let result;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        // 1. Fetch DO and SO details
        const doReq = new sql.Request(tx);
        doReq.input('doId', sql.Int, doId);
        const doRes = await doReq.query(`
          SELECT do.DeliveryOrderId, do.BranchId, do.SalesOrderId, do.CustomerId, do.Status, do.ShipToAddress, do.DocumentNo AS DeliveryOrderNo,
                 so.PriceListId, so.TaxType, so.CurrencyCode, so.SalesPersonId, so.PaymentTermId, so.WarehouseId
          FROM dbo.DeliveryOrders do
          LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = do.SalesOrderId
          WHERE do.DeliveryOrderId = @doId
        `);
        const deliveryOrder = doRes.recordset[0];
        if (!deliveryOrder) throw badRequest('Delivery Order not found');
        if (deliveryOrder.Status === 'closed') throw badRequest('Delivery Order is already closed');

        const salesOrderId = deliveryOrder.SalesOrderId;
        const branchId = deliveryOrder.BranchId;
        const customerId = deliveryOrder.CustomerId;
        const currencyCode = deliveryOrder.CurrencyCode || 'THB';
        const taxType = deliveryOrder.TaxType || 'exclusive';

        // 2. Create Proof of Delivery (POD)
        const dateStr = actualDeliveryDate.toISOString().slice(0, 10).replace(/-/g, '');
        const randStr = Math.floor(1000 + Math.random() * 9000).toString();
        const podNo = `POD-${dateStr}-${randStr}`;

        const podReq = new sql.Request(tx);
        podReq.input('doId', sql.Int, doId);
        podReq.input('podNo', sql.NVarChar(50), podNo);
        podReq.input('status', sql.NVarChar(30), 'delivered');
        podReq.input('actualDate', sql.DateTime2, actualDeliveryDate);
        podReq.input('recipient', sql.NVarChar(255), recipientName);
        podReq.input('signature', sql.NVarChar(500), signatureUrl);
        podReq.input('photo', sql.NVarChar(500), photoUrl);
        podReq.input('remarks', sql.NVarChar(1000), remarks);
        podReq.input('createdBy', sql.Int, userId);

        await podReq.query(`
          INSERT INTO dbo.ProofOfDeliveries (
            DeliveryOrderId, PodNo, DeliveryStatus, ActualDeliveryDate, RecipientName, SignatureUrl, PhotoUrl, Remarks, CreatedBy
          ) VALUES (
            @doId, @podNo, @status, @actualDate, @recipient, @signature, @photo, @remarks, @createdBy
          )
        `);

        // Update DO Status to closed (completed)
        await doReq.query(`
          UPDATE dbo.DeliveryOrders
          SET Status = 'closed'
          WHERE DeliveryOrderId = @doId
        `);

        // Log Status History for DO
        const histReq = new sql.Request(tx);
        histReq.input('docId', sql.Int, doId);
        histReq.input('userId', sql.Int, userId);
        histReq.input('status', sql.NVarChar(30), deliveryOrder.Status);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
          VALUES ('DO', @docId, @status, 'closed', @userId, 'Delivery confirmed via POD upload')
        `);

        // 3. Create and Post Goods Issue (GI)
        let giId;
        if (salesOrderId) {
          // Look up completed picking task for this SO
          const taskReq = new sql.Request(tx);
          taskReq.input('soId', sql.Int, salesOrderId);
          taskReq.input('doId', sql.Int, doId);
          const taskRes = await taskReq.query(`
            SELECT TOP 1 WmsTaskId, WarehouseId
            FROM dbo.WmsTasks
            WHERE ReferenceType = 'SO' AND ReferenceId = @soId AND TaskType = 'picking' AND Status = 'completed'
            ORDER BY CompletedAt DESC
          `);
          const task = taskRes.recordset[0];
          if (task) {
            const linesRes = await taskReq.query(`
              SELECT tl.ItemId, tl.ItemSpecId, tl.LotId, tl.FromLocationId AS LocationId, tl.QuantityCompleted AS Quantity, tl.InventoryReservationId, tl.InventoryUnitId, dol.UnitId, tl.PalletNo
              FROM dbo.WmsTaskLines tl
              JOIN dbo.DeliveryOrderLines dol ON dol.DeliveryOrderId = @doId AND dol.ItemId = tl.ItemId AND dol.ItemSpecId = tl.ItemSpecId
              WHERE tl.WmsTaskId = ${task.WmsTaskId} AND tl.QuantityCompleted > 0
            `);
            const pickLines = linesRes.recordset;

            if (pickLines.length > 0) {
              const giDocNo = await documentService.generateDocumentNumber(tx, 'GI', branchId, actualDeliveryDate);
              const giHeaderReq = new sql.Request(tx);
              giHeaderReq.input('docNo', sql.NVarChar(50), giDocNo);
              giHeaderReq.input('branchId', sql.Int, branchId);
              giHeaderReq.input('customerId', sql.Int, customerId);
              giHeaderReq.input('warehouseId', sql.Int, task.WarehouseId || deliveryOrder.WarehouseId || 1);
              giHeaderReq.input('createdBy', sql.Int, userId);

              const giHeaderRes = await giHeaderReq.query(`
                INSERT INTO dbo.GoodsIssues (
                  DocumentNo, BranchId, GoodsIssueTypeId, CustomerId, WarehouseId, RequestDate, IssueDate, Status, CreatedBy
                ) OUTPUT INSERTED.GoodsIssueId
                VALUES (
                  @docNo, @branchId, 1, @customerId, @warehouseId, CAST(SYSUTCDATETIME() AS DATE), CAST(SYSUTCDATETIME() AS DATE), 'approved', @createdBy
                )
              `);
              giId = giHeaderRes.recordset[0].GoodsIssueId;

              for (let idx = 0; idx < pickLines.length; idx++) {
                const line = pickLines[idx];
                const giLineReq = new sql.Request(tx);
                giLineReq.input('giId', sql.Int, giId);
                giLineReq.input('lineNum', sql.Int, idx + 1);
                giLineReq.input('itemId', sql.Int, line.ItemId);
                giLineReq.input('itemSpecId', sql.Int, line.ItemSpecId);
                giLineReq.input('lotId', sql.BigInt, line.LotId);
                giLineReq.input('warehouseId', sql.Int, task.WarehouseId);
                giLineReq.input('locationId', sql.Int, line.LocationId);
                giLineReq.input('unitId', sql.Int, line.UnitId);
                giLineReq.input('qty', sql.Decimal(18, 4), line.Quantity);
                giLineReq.input('palletNo', sql.NVarChar(100), line.PalletNo || null);

                await giLineReq.query(`
                  INSERT INTO dbo.GoodsIssueLines (
                    GoodsIssueId, LineNum, ItemId, ItemSpecId, LotId, WarehouseId, LocationId, UnitId, RequestedQuantity, IssuedQuantity, PalletNo
                  ) VALUES (
                    @giId, @lineNum, @itemId, @itemSpecId, @lotId, @warehouseId, @locationId, @unitId, @qty, @qty, @palletNo
                  )
                `);

                // Release/close reservation since stock is issued
                if (line.InventoryReservationId) {
                  const releaseResReq = new sql.Request(tx);
                  releaseResReq.input('resId', sql.BigInt, line.InventoryReservationId);
                  await releaseResReq.query(`
                    UPDATE dbo.InventoryReservations
                    SET Status = 'released'
                    WHERE InventoryReservationId = @resId
                  `);
                }
              }

              // Post Goods Issue (consumes FIFO layers, updates OnHand)
              await postingService.postGoodsIssue(giId, userId, tx);
            }
          }
        }

        // 4. Generate and Post Sales Invoice
        let invoiceId;
        // Check if invoice already exists
        const invCheckReq = new sql.Request(tx);
        invCheckReq.input('doId', sql.Int, doId);
        const invCheckRes = await invCheckReq.query(`
          SELECT SalesInvoiceId FROM dbo.SalesInvoices WHERE DeliveryOrderId = @doId AND Status <> 'cancelled'
        `);

        if (invCheckRes.recordset.length === 0) {
          // Fetch DO lines mapped to SO lines pricing
          doReq.input('salesOrderId', sql.Int, salesOrderId);
          const doLinesRes = await doReq.query(`
            SELECT dol.ItemId, dol.Quantity, dol.UnitId, sol.UnitPrice, sol.DiscountAmount AS SO_DiscountAmount, sol.Quantity AS SO_Quantity, sol.TaxRatePercent, sol.TaxCodeId, sol.ItemSpecId
            FROM dbo.DeliveryOrderLines dol
            LEFT JOIN dbo.WmsTasks wt ON wt.ReferenceType = 'SO' AND wt.ReferenceId = @salesOrderId AND wt.Status = 'completed' AND wt.TaskType = 'picking'
            LEFT JOIN dbo.WmsTaskLines wtl ON wtl.WmsTaskId = wt.WmsTaskId AND wtl.ItemId = dol.ItemId
            LEFT JOIN dbo.SalesOrderLines sol ON sol.SalesOrderId = @salesOrderId AND sol.ItemId = dol.ItemId AND (sol.ItemSpecId = wtl.ItemSpecId OR (sol.ItemSpecId IS NULL AND wtl.ItemSpecId IS NULL))
            WHERE dol.DeliveryOrderId = @doId
          `);
          const doLines = doLinesRes.recordset;

          if (doLines.length > 0) {
            let subTotal = 0;
            let discountTotal = 0;
            let taxTotal = 0;

            const invoiceLines = doLines.map((line, idx) => {
              const qty = line.Quantity;
              const price = line.UnitPrice || 0;
              // Pro-rate line discount based on quantity delivered
              const soQty = line.SO_Quantity || qty;
              const discPerUnit = (line.SO_DiscountAmount || 0) / soQty;
              const discount = qty * discPerUnit;

              const netAmt = (qty * price) - discount;
              const taxRate = line.TaxRatePercent || 0;
              const taxAmt = (netAmt * taxRate) / 100;

              subTotal += qty * price;
              discountTotal += discount;
              taxTotal += taxAmt;

              return {
                lineNum: idx + 1,
                itemId: line.ItemId,
                quantity: qty,
                unitId: line.UnitId,
                unitPrice: price,
                discountAmount: discount,
                taxRatePercent: taxRate,
                lineAmount: netAmt,
                taxCodeId: line.TaxCodeId,
                taxAmount: taxAmt,
                itemSpecId: line.ItemSpecId
              };
            });

            const grandTotal = (subTotal - discountTotal) + taxTotal;
            const invDocNo = await documentService.generateDocumentNumber(tx, 'INV', branchId, actualDeliveryDate);

            const invHeaderReq = new sql.Request(tx);
            invHeaderReq.input('docNo', sql.NVarChar(50), invDocNo);
            invHeaderReq.input('branchId', sql.Int, branchId);
            invHeaderReq.input('customerId', sql.Int, customerId);
            invHeaderReq.input('salesOrderId', sql.Int, salesOrderId);
            invHeaderReq.input('doId', sql.Int, doId);
            invHeaderReq.input('docDate', sql.Date, actualDeliveryDate);
            invHeaderReq.input('status', sql.NVarChar(30), 'posted');
            invHeaderReq.input('taxType', sql.NVarChar(20), taxType);
            invHeaderReq.input('currencyCode', sql.Char(3), currencyCode);
            invHeaderReq.input('subTotal', sql.Decimal(18, 4), subTotal);
            invHeaderReq.input('discount', sql.Decimal(18, 4), discountTotal);
            invHeaderReq.input('tax', sql.Decimal(18, 4), taxTotal);
            invHeaderReq.input('grandTotal', sql.Decimal(18, 4), grandTotal);
            invHeaderReq.input('createdBy', sql.Int, userId);

            const invHeaderRes = await invHeaderReq.query(`
              INSERT INTO dbo.SalesInvoices (
                DocumentNo, BranchId, CustomerId, SalesOrderId, DeliveryOrderId, DocumentDate, DueDate,
                Status, TaxType, CurrencyCode, SubTotalAmount, DiscountAmount, TaxAmount, GrandTotalAmount, PaidAmount, CreatedBy
              ) OUTPUT INSERTED.SalesInvoiceId
              VALUES (
                @docNo, @branchId, @customerId, @salesOrderId, @doId, @docDate, DATEADD(day, 30, @docDate),
                @status, @taxType, @currencyCode, @subTotal, @discount, @tax, @grandTotal, 0, @createdBy
              )
            `);
            invoiceId = invHeaderRes.recordset[0].SalesInvoiceId;

            for (const line of invoiceLines) {
              const lineReq = new sql.Request(tx);
              lineReq.input('invId', sql.Int, invoiceId);
              lineReq.input('ln', sql.Int, line.lineNum);
              lineReq.input('itemId', sql.Int, line.itemId);
              lineReq.input('qty', sql.Decimal(18, 4), line.quantity);
              lineReq.input('unitId', sql.Int, line.unitId);
              lineReq.input('unitPrice', sql.Decimal(18, 4), line.unitPrice);
              lineReq.input('disc', sql.Decimal(18, 4), line.discountAmount);
              lineReq.input('taxRate', sql.Decimal(9, 4), line.taxRatePercent);
              lineReq.input('lineAmt', sql.Decimal(18, 4), line.lineAmount);
              lineReq.input('taxCodeId', sql.Int, line.taxCodeId);
              lineReq.input('taxAmt', sql.Decimal(18, 4), line.taxAmount);
              lineReq.input('itemSpecId', sql.Int, line.itemSpecId);

              await lineReq.query(`
                INSERT INTO dbo.SalesInvoiceLines (
                  SalesInvoiceId, LineNum, ItemId, Quantity, UnitId, UnitPrice,
                  DiscountAmount, TaxRatePercent, LineAmount, TaxCodeId, TaxAmount, ItemSpecId
                ) VALUES (
                  @invId, @ln, @itemId, @qty, @unitId, @unitPrice,
                  @disc, @taxRate, @lineAmt, @taxCodeId, @taxAmt, @itemSpecId
                )
              `);
            }

            const invHistReq = new sql.Request(tx);
            invHistReq.input('docId', sql.Int, invoiceId);
            invHistReq.input('userId', sql.Int, userId);
            await invHistReq.query(`
              INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
              VALUES ('INV', @docId, 'posted', @userId, 'Invoice generated automatically upon delivery confirmation')
            `);

            // 5. Create Customer Payment & Receipt (if cash-on-delivery or immediate payment is made)
            if (amountPaid > 0) {
              const rcptNo = await documentService.generateDocumentNumber(tx, 'RCPT', branchId, actualDeliveryDate);
              const pmtHeaderReq = new sql.Request(tx);
              pmtHeaderReq.input('paymentNo', sql.NVarChar(50), rcptNo);
              pmtHeaderReq.input('branchId', sql.Int, branchId);
              pmtHeaderReq.input('customerId', sql.Int, customerId);
              pmtHeaderReq.input('payDate', sql.Date, actualDeliveryDate);
              pmtHeaderReq.input('method', sql.NVarChar(40), paymentMethod);
              pmtHeaderReq.input('currency', sql.Char(3), currencyCode);
              pmtHeaderReq.input('amount', sql.Decimal(18, 4), amountPaid);
              pmtHeaderReq.input('createdBy', sql.Int, userId);

              const pmtHeaderRes = await pmtHeaderReq.query(`
                INSERT INTO dbo.CustomerPayments (
                  PaymentNo, BranchId, CustomerId, PaymentDate, PaymentMethod, CurrencyCode, Amount, CreatedBy
                ) OUTPUT INSERTED.CustomerPaymentId
                VALUES (
                  @paymentNo, @branchId, @customerId, @payDate, @method, @currency, @amount, @createdBy
                )
              `);
              const paymentId = pmtHeaderRes.recordset[0].CustomerPaymentId;

              // Insert Allocation
              const allocReq = new sql.Request(tx);
              allocReq.input('pmtId', sql.Int, paymentId);
              allocReq.input('invId', sql.Int, invoiceId);
              allocReq.input('applied', sql.Decimal(18, 4), amountPaid);
              await allocReq.query(`
                INSERT INTO dbo.CustomerPaymentAllocations (CustomerPaymentId, SalesInvoiceId, AmountApplied)
                VALUES (@pmtId, @invId, @applied)
              `);

              // Update SalesInvoice PaidAmount and Status
              const finalStatus = amountPaid >= grandTotal ? 'paid' : 'posted';
              const updateInvReq = new sql.Request(tx);
              updateInvReq.input('invId', sql.Int, invoiceId);
              updateInvReq.input('paid', sql.Decimal(18, 4), amountPaid);
              updateInvReq.input('status', sql.NVarChar(30), finalStatus);
              await updateInvReq.query(`
                UPDATE dbo.SalesInvoices
                SET PaidAmount = PaidAmount + @paid, Status = @status
                WHERE SalesInvoiceId = @invId
              `);

              const pmtHistReq = new sql.Request(tx);
              pmtHistReq.input('docId', sql.Int, paymentId);
              pmtHistReq.input('userId', sql.Int, userId);
              await pmtHistReq.query(`
                INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
                VALUES ('RCPT', @docId, 'posted', @userId, 'Receipt generated automatically upon cash payment')
              `);
            }
          }
        }

        result = {
          success: true,
          message: 'Proof of Delivery log registered, Goods Issue posted, Invoice and Payment created successfully',
          deliveryOrderId: doId,
          goodsIssueId: giId || null,
          salesInvoiceId: invoiceId || null
        };
      });
    } catch (err) {
      console.error('Deliver & Bill transaction failed:', err);
      throw err;
    }

    res.json(result);
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
