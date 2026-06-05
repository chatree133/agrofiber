import { Router } from 'express';
import { postingService as inventoryPostingService } from '../services/inventory/postingService.js';
import { mssqlQuery, sql, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

const readRoles = allowRoles('admin', 'inventory', 'warehouse', 'user', 'audit');
const writeRoles = allowRoles('admin', 'inventory', 'warehouse', 'user');
const approveRoles = allowRoles('admin', 'inventory', 'warehouse');

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

function mapGoodsReceipt(row) {
  if (!row) return null;
  return {
    id: row.GoodsReceiptId,
    documentNo: row.DocumentNo,
    branchId: row.BranchId,
    branchCode: row.BranchCode,
    branchName: row.BranchName,
    goodsReceiptTypeId: row.GoodsReceiptTypeId,
    goodsReceiptTypeCode: row.GoodsReceiptTypeCode,
    goodsReceiptTypeName: row.GoodsReceiptTypeName,
    vendorId: row.VendorId,
    vendorCode: row.VendorCode,
    vendorName: row.VendorName,
    customerId: row.CustomerId,
    customerCode: row.CustomerCode,
    customerName: row.CustomerName,
    purchaseOrderId: row.PurchaseOrderId,
    productionOrderId: row.ProductionOrderId,
    warehouseId: row.WarehouseId,
    warehouseCode: row.WarehouseCode,
    warehouseName: row.WarehouseName,
    receiptDate: row.ReceiptDate,
    status: row.Status,
    receivedSheetTotal: row.ReceivedSheetTotal,
    palletCountTotal: row.PalletCountTotal,
    m3Total: row.M3Total,
    remark: row.Remark,
    postedAt: row.PostedAt,
    postedBy: row.PostedBy,
    postedByName: row.PostedByName,
    createdBy: row.CreatedBy,
    createdByName: row.CreatedByName,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

function mapGoodsReceiptLine(row) {
  return {
    id: row.GoodsReceiptLineId,
    goodsReceiptId: row.GoodsReceiptId,
    lineNum: row.LineNum,
    itemId: row.ItemId,
    itemCode: row.ItemCode,
    itemName: row.ItemName,
    itemSpecId: row.ItemSpecId,
    specCode: row.SpecCode,
    specName: row.SpecName,
    salesSKU: row.SalesSKU,
    lotId: row.LotId,
    lotNo: row.LotNo,
    warehouseId: row.WarehouseId,
    warehouseCode: row.WarehouseCode,
    warehouseName: row.WarehouseName,
    locationId: row.LocationId,
    locationCode: row.LocationCode,
    unitId: row.UnitId,
    unitCode: row.UnitCode,
    unitName: row.UnitName,
    receivedQuantity: row.ReceivedQuantity,
    receivedSheetQty: row.ReceivedSheetQty,
    palletCount: row.PalletCount,
    m3Quantity: row.M3Quantity,
    productTypeId: row.ProductTypeId,
    thicknessId: row.ThicknessId,
    thicknessMm: row.ThicknessMm,
    thicknessLabel: row.ThicknessLabel,
    widthId: row.WidthId,
    widthMm: row.WidthM ? Number(row.WidthM) * 1000 : null,
    widthLabel: row.WidthLabel,
    lengthId: row.LengthId,
    lengthMm: row.LengthM ? Number(row.LengthM) * 1000 : null,
    lengthLabel: row.LengthLabel,
    unitCostSnapshot: row.UnitCostSnapshot,
    remark: row.Remark,
  };
}

async function getGoodsReceipt(goodsReceiptId) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      gr.GoodsReceiptId,
      gr.DocumentNo,
      gr.BranchId,
      b.BranchCode,
      b.BranchName,
      gr.GoodsReceiptTypeId,
      grt.GoodsReceiptTypeCode,
      grt.GoodsReceiptTypeName,
      gr.VendorId,
      v.VendorCode,
      v.VendorName,
      gr.CustomerId,
      c.CustomerCode,
      c.CustomerName,
      gr.PurchaseOrderId,
      gr.ProductionOrderId,
      gr.WarehouseId,
      w.WarehouseCode,
      w.WarehouseName,
      gr.ReceiptDate,
      gr.Status,
      gr.ReceivedSheetTotal,
      gr.PalletCountTotal,
      gr.M3Total,
      gr.Remark,
      gr.PostedAt,
      gr.PostedBy,
      u_post.DisplayName as PostedByName,
      gr.CreatedBy,
      u_create.DisplayName as CreatedByName,
      gr.CreatedAt,
      gr.UpdatedAt
    FROM dbo.GoodsReceipts gr
    JOIN dbo.GoodsReceiptTypes grt ON grt.GoodsReceiptTypeId = gr.GoodsReceiptTypeId
    JOIN dbo.Warehouses w ON w.WarehouseId = gr.WarehouseId
    LEFT JOIN dbo.Vendors v ON v.VendorId = gr.VendorId
    LEFT JOIN dbo.Customers c ON c.CustomerId = gr.CustomerId
    LEFT JOIN dbo.Branches b ON b.BranchId = gr.BranchId
    LEFT JOIN dbo.Users u_post ON u_post.UserId = gr.PostedBy
    LEFT JOIN dbo.Users u_create ON u_create.UserId = gr.CreatedBy
    WHERE gr.GoodsReceiptId = @goodsReceiptId
  `, { inputs: { goodsReceiptId: { type: sql.Int, value: goodsReceiptId } } });

  return mapGoodsReceipt(rows[0]);
}

async function getGoodsReceiptLines(goodsReceiptId) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      grl.GoodsReceiptLineId,
      grl.GoodsReceiptId,
      grl.LineNum,
      grl.ItemId,
      i.ItemCode,
      i.ItemName,
      grl.ItemSpecId,
      ispec.SalesSKU,
      ispec.SpecCode,
      ispec.SpecName,
      grl.LotId,
      COALESCE(l.LotNo, grl.LotNo) AS LotNo,
      grl.WarehouseId,
      w.WarehouseCode,
      w.WarehouseName,
      grl.LocationId,
      wl.LocationCode,
      grl.UnitId,
      u.UnitCode,
      u.UnitName,
      grl.ReceivedQuantity,
      grl.ReceivedSheetQty,
      grl.PalletCount,
      grl.M3Quantity,
      grl.ProductTypeId,
      grl.ThicknessId,
      th.ThicknessMm,
      th.ThicknessLabel,
      grl.WidthId,
      wd.WidthM,
      wd.WidthLabel,
      grl.LengthId,
      ln.LengthM,
      ln.LengthLabel,
      grl.UnitCostSnapshot,
      grl.Remark
    FROM dbo.GoodsReceiptLines grl
    JOIN dbo.Items i ON i.ItemId = grl.ItemId
    JOIN dbo.Units u ON u.UnitId = grl.UnitId
    LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = grl.ItemSpecId
    LEFT JOIN dbo.Lots l ON l.LotId = grl.LotId
    LEFT JOIN dbo.Warehouses w ON w.WarehouseId = grl.WarehouseId
    LEFT JOIN dbo.WarehouseLocations wl ON wl.LocationId = grl.LocationId
    LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = grl.ThicknessId
    LEFT JOIN dbo.ItemWidths wd ON wd.WidthId = grl.WidthId
    LEFT JOIN dbo.ItemLengths ln ON ln.LengthId = grl.LengthId
    WHERE grl.GoodsReceiptId = @goodsReceiptId
    ORDER BY grl.LineNum
  `, { inputs: { goodsReceiptId: { type: sql.Int, value: goodsReceiptId } } });

  return rows.map(mapGoodsReceiptLine);
}

function buildGoodsReceiptFilters(query) {
  const { page, pageSize, offset } = buildPagination(query);
  const conditions = [];
  const inputs = {};

  if (query.vendorId) {
    conditions.push('gr.VendorId = @vendorId');
    inputs.vendorId = { type: sql.Int, value: parseId(query.vendorId, 'vendorId') };
  }
  if (query.customerId) {
    conditions.push('gr.CustomerId = @customerId');
    inputs.customerId = { type: sql.Int, value: parseId(query.customerId, 'customerId') };
  }
  if (query.warehouseId) {
    conditions.push('gr.WarehouseId = @warehouseId');
    inputs.warehouseId = { type: sql.Int, value: parseId(query.warehouseId, 'warehouseId') };
  }
  if (query.goodsReceiptTypeId) {
    conditions.push('gr.GoodsReceiptTypeId = @goodsReceiptTypeId');
    inputs.goodsReceiptTypeId = { type: sql.Int, value: parseId(query.goodsReceiptTypeId, 'goodsReceiptTypeId') };
  }
  if (query.status !== undefined && query.status !== '') {
    const status = normalizeEnum(query.status, ['draft', 'received', 'posted', 'cancelled'], 'status');
    conditions.push('gr.Status = @status');
    inputs.status = { type: sql.NVarChar(30), value: status };
  }
  if (query.search) {
    conditions.push('(gr.DocumentNo LIKE @search OR v.VendorCode LIKE @search OR v.VendorName LIKE @search OR c.CustomerCode LIKE @search OR c.CustomerName LIKE @search)');
    inputs.search = { type: sql.NVarChar(255), value: `%${query.search}%` };
  }
  if (query.dateFrom) {
    inputs.dateFrom = { type: sql.Date, value: parseOptionalDate(query.dateFrom, 'dateFrom') };
    conditions.push('gr.ReceiptDate >= @dateFrom');
  }
  if (query.dateTo) {
    inputs.dateTo = { type: sql.Date, value: parseOptionalDate(query.dateTo, 'dateTo') };
    conditions.push('gr.ReceiptDate <= @dateTo');
  }

  return {
    page,
    pageSize,
    offset,
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    inputs,
  };
}

function calculateHeaderTotals(lines) {
  let receivedSheetTotal = 0;
  let palletCountTotal = 0;
  let m3Total = 0;

  for (const line of lines) {
    receivedSheetTotal += Number(line.receivedSheetQty || 0);
    palletCountTotal += Number(line.palletCount || 0);
    m3Total += Number(line.m3Quantity || 0);
  }

  return { receivedSheetTotal, palletCountTotal, m3Total };
}

async function resolveLineLots(tx, lineSnapshots, userId) {
  for (const line of lineSnapshots) {
    if (!line.lotId && line.lotNo) {
      const res = await tx.request()
        .input('itemId', sql.Int, line.itemId)
        .input('lotNo', sql.NVarChar(80), line.lotNo)
        .query(`
          SELECT LotId FROM dbo.Lots WHERE ItemId = @itemId AND LotNo = @lotNo
        `);
      if (res.recordset.length > 0) {
        line.lotId = res.recordset[0].LotId;
      } else {
        const ins = await tx.request()
          .input('itemId', sql.Int, line.itemId)
          .input('lotNo', sql.NVarChar(80), line.lotNo)
          .input('createdBy', sql.Int, userId)
          .query(`
            INSERT INTO dbo.Lots (ItemId, LotNo, QualityStatus, CreatedBy)
            OUTPUT INSERTED.LotId
            VALUES (@itemId, @lotNo, 'approved', @createdBy)
          `);
        line.lotId = ins.recordset[0].LotId;
      }
    }
  }
}

function buildLineSnapshots(rawLines) {
  if (!Array.isArray(rawLines) || !rawLines.length) throw badRequest('lines is required');
  const lines = [];

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const raw = rawLines[idx] || {};
    const lineNum = Number.isInteger(raw.lineNum) && raw.lineNum > 0 ? raw.lineNum : idx + 1;
    
    const receivedQuantity = parseOptionalNumber(raw.receivedQuantity, `lines[${idx}].receivedQuantity`) ?? 0;
    
    lines.push({
      lineNum,
      itemId: parseId(raw.itemId, `lines[${idx}].itemId`),
      itemSpecId: parseOptionalId(raw.itemSpecId, `lines[${idx}].itemSpecId`),
      lotId: parseOptionalId(raw.lotId, `lines[${idx}].lotId`),
      lotNo: raw.lotNo ? String(raw.lotNo).trim() : null,
      warehouseId: parseOptionalId(raw.warehouseId, `lines[${idx}].warehouseId`),
      locationId: parseOptionalId(raw.locationId, `lines[${idx}].locationId`),
      unitId: parseId(raw.unitId, `lines[${idx}].unitId`),
      receivedQuantity,
      receivedSheetQty: parseOptionalNumber(raw.receivedSheetQty, `lines[${idx}].receivedSheetQty`),
      palletCount: parseOptionalNumber(raw.palletCount, `lines[${idx}].palletCount`),
      m3Quantity: parseOptionalNumber(raw.m3Quantity, `lines[${idx}].m3Quantity`),
      productTypeId: parseOptionalId(raw.productTypeId, `lines[${idx}].productTypeId`),
      thicknessId: parseOptionalId(raw.thicknessId, `lines[${idx}].thicknessId`),
      widthId: parseOptionalId(raw.widthId, `lines[${idx}].widthId`),
      lengthId: parseOptionalId(raw.lengthId, `lines[${idx}].lengthId`),
      unitCostSnapshot: parseOptionalNumber(raw.unitCostSnapshot, `lines[${idx}].unitCostSnapshot`),
      remark: raw.remark ? String(raw.remark).trim() : null,
    });
  }

  return lines;
}

async function writeStatusHistory(documentType, documentId, fromStatus, toStatus, changedBy, notes) {
  await mssqlQuery('DEFAULT', `
    INSERT INTO dbo.DocumentStatusHistory (
      DocumentType,
      DocumentId,
      FromStatus,
      ToStatus,
      ChangedBy,
      Notes
    )
    VALUES (
      @documentType,
      @documentId,
      @fromStatus,
      @toStatus,
      @changedBy,
      @notes
    )
  `, {
    inputs: {
      documentType: { type: sql.NVarChar(40), value: documentType },
      documentId: { type: sql.Int, value: documentId },
      fromStatus: { type: sql.NVarChar(30), value: fromStatus },
      toStatus: { type: sql.NVarChar(30), value: toStatus },
      changedBy: { type: sql.Int, value: changedBy },
      notes: { type: sql.NVarChar(1000), value: notes || null },
    },
  });
}

router.get(
  '/types',
  readRoles,
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT GoodsReceiptTypeId, GoodsReceiptTypeCode, GoodsReceiptTypeName, MovementTypeCode, RequiresVendor, RequiresProductionOrder, RequiresApproval, IsActive
      FROM dbo.GoodsReceiptTypes
      ORDER BY GoodsReceiptTypeId
    `);
    res.json({
      data: rows.map(r => ({
        goodsReceiptTypeId: r.GoodsReceiptTypeId,
        goodsReceiptTypeCode: r.GoodsReceiptTypeCode,
        goodsReceiptTypeName: r.GoodsReceiptTypeName,
        movementTypeCode: r.MovementTypeCode,
        requiresVendor: Boolean(r.RequiresVendor),
        requiresProductionOrder: Boolean(r.RequiresProductionOrder),
        requiresApproval: Boolean(r.RequiresApproval),
        isActive: Boolean(r.IsActive),
      }))
    });
  })
);

router.post(
  '/types',
  writeRoles,
  asyncHandler(async (req, res) => {
    const code = String(req.body.goodsReceiptTypeCode || '').trim().toUpperCase();
    const name = String(req.body.goodsReceiptTypeName || '').trim();
    const movementTypeCode = String(req.body.movementTypeCode || 'goods_receipt').trim();
    const requiresVendor = req.body.requiresVendor ? 1 : 0;
    const requiresProductionOrder = req.body.requiresProductionOrder ? 1 : 0;
    const requiresApproval = req.body.requiresApproval ? 1 : 0;
    const isActive = req.body.isActive !== false ? 1 : 0;

    if (!code) throw badRequest('goodsReceiptTypeCode is required');
    if (!name) throw badRequest('goodsReceiptTypeName is required');

    const result = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.GoodsReceiptTypes (GoodsReceiptTypeCode, GoodsReceiptTypeName, MovementTypeCode, RequiresVendor, RequiresProductionOrder, RequiresApproval, IsActive)
      OUTPUT INSERTED.GoodsReceiptTypeId
      VALUES (@code, @name, @movementTypeCode, @requiresVendor, @requiresProductionOrder, @requiresApproval, @isActive)
    `, {
      inputs: {
        code: { type: sql.NVarChar(40), value: code },
        name: { type: sql.NVarChar(100), value: name },
        movementTypeCode: { type: sql.NVarChar(40), value: movementTypeCode },
        requiresVendor: { type: sql.Bit, value: requiresVendor },
        requiresProductionOrder: { type: sql.Bit, value: requiresProductionOrder },
        requiresApproval: { type: sql.Bit, value: requiresApproval },
        isActive: { type: sql.Bit, value: isActive },
      }
    });

    res.status(201).json({
      success: true,
      data: {
        goodsReceiptTypeId: result[0].GoodsReceiptTypeId,
        goodsReceiptTypeCode: code,
        goodsReceiptTypeName: name,
        movementTypeCode,
        requiresVendor,
        requiresProductionOrder,
        requiresApproval,
        isActive,
      }
    });
  })
);

router.put(
  '/types/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    const typeId = parseId(req.params.id, 'goodsReceiptTypeId');
    const name = String(req.body.goodsReceiptTypeName || '').trim();
    const requiresVendor = req.body.requiresVendor ? 1 : 0;
    const requiresProductionOrder = req.body.requiresProductionOrder ? 1 : 0;
    const requiresApproval = req.body.requiresApproval ? 1 : 0;
    const isActive = req.body.isActive !== false ? 1 : 0;

    if (!name) throw badRequest('goodsReceiptTypeName is required');

    await mssqlQuery('DEFAULT', `
      UPDATE dbo.GoodsReceiptTypes
      SET
        GoodsReceiptTypeName = @name,
        RequiresVendor = @requiresVendor,
        RequiresProductionOrder = @requiresProductionOrder,
        RequiresApproval = @requiresApproval,
        IsActive = @isActive
      WHERE GoodsReceiptTypeId = @typeId
    `, {
      inputs: {
        typeId: { type: sql.Int, value: typeId },
        name: { type: sql.NVarChar(100), value: name },
        requiresVendor: { type: sql.Bit, value: requiresVendor },
        requiresProductionOrder: { type: sql.Bit, value: requiresProductionOrder },
        requiresApproval: { type: sql.Bit, value: requiresApproval },
        isActive: { type: sql.Bit, value: isActive },
      }
    });

    res.json({
      success: true,
      message: 'Goods receipt type updated successfully'
    });
  })
);

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset, whereSql, inputs } = buildGoodsReceiptFilters(req.query);

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredReceipts AS (
        SELECT gr.GoodsReceiptId
        FROM dbo.GoodsReceipts gr
        LEFT JOIN dbo.Vendors v ON v.VendorId = gr.VendorId
        LEFT JOIN dbo.Customers c ON c.CustomerId = gr.CustomerId
        ${whereSql}
      )
      SELECT
        gr.GoodsReceiptId,
        gr.DocumentNo,
        gr.BranchId,
        b.BranchCode,
        b.BranchName,
        gr.GoodsReceiptTypeId,
        grt.GoodsReceiptTypeCode,
        grt.GoodsReceiptTypeName,
        gr.VendorId,
        v.VendorCode,
        v.VendorName,
        gr.CustomerId,
        c.CustomerCode,
        c.CustomerName,
        gr.WarehouseId,
        w.WarehouseCode,
        w.WarehouseName,
        gr.ReceiptDate,
        gr.Status,
        gr.CreatedAt,
        (SELECT COUNT(1) FROM FilteredReceipts) AS TotalCount
      FROM FilteredReceipts fr
      JOIN dbo.GoodsReceipts gr ON gr.GoodsReceiptId = fr.GoodsReceiptId
      JOIN dbo.GoodsReceiptTypes grt ON grt.GoodsReceiptTypeId = gr.GoodsReceiptTypeId
      JOIN dbo.Warehouses w ON w.WarehouseId = gr.WarehouseId
      LEFT JOIN dbo.Vendors v ON v.VendorId = gr.VendorId
      LEFT JOIN dbo.Customers c ON c.CustomerId = gr.CustomerId
      LEFT JOIN dbo.Branches b ON b.BranchId = gr.BranchId
      ORDER BY gr.CreatedAt DESC, gr.GoodsReceiptId DESC
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
        id: r.GoodsReceiptId,
        documentNo: r.DocumentNo,
        branchId: r.BranchId,
        branchCode: r.BranchCode,
        branchName: r.BranchName,
        goodsReceiptTypeId: r.GoodsReceiptTypeId,
        goodsReceiptTypeCode: r.GoodsReceiptTypeCode,
        goodsReceiptTypeName: r.GoodsReceiptTypeName,
        vendorId: r.VendorId,
        vendorCode: r.VendorCode,
        vendorName: r.VendorName,
        customerId: r.CustomerId,
        customerCode: r.CustomerCode,
        customerName: r.CustomerName,
        warehouseId: r.WarehouseId,
        warehouseCode: r.WarehouseCode,
        warehouseName: r.WarehouseName,
        receiptDate: r.ReceiptDate,
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

router.get(
  '/:id',
  readRoles,
  asyncHandler(async (req, res) => {
    const goodsReceiptId = parseId(req.params.id, 'goodsReceiptId');
    const order = await getGoodsReceipt(goodsReceiptId);
    if (!order) {
      res.status(404).json({ message: 'Goods receipt not found' });
      return;
    }
    const lines = await getGoodsReceiptLines(goodsReceiptId);
    res.json({ data: { ...order, lines } });
  }),
);

router.post(
  '/',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const goodsReceiptTypeId = parseId(req.body.goodsReceiptTypeId, 'goodsReceiptTypeId');
    const warehouseId = parseId(req.body.warehouseId, 'warehouseId');
    const vendorId = parseOptionalId(req.body.vendorId, 'vendorId');
    const customerId = parseOptionalId(req.body.customerId, 'customerId');
    const purchaseOrderId = parseOptionalId(req.body.purchaseOrderId, 'purchaseOrderId');
    const productionOrderId = parseOptionalId(req.body.productionOrderId, 'productionOrderId');
    const branchId = parseOptionalId(req.body.branchId, 'branchId');
    const receiptDate = parseOptionalDate(req.body.receiptDate, 'receiptDate') || new Date();
    const remark = req.body.remark ? String(req.body.remark).trim() : null;
    const status = normalizeEnum(req.body.status, ['draft', 'received'], 'status') || 'draft';

    const lineSnapshots = buildLineSnapshots(req.body.lines);
    const totals = calculateHeaderTotals(lineSnapshots);

    let goodsReceiptId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        const documentNo = await documentService.generateDocumentNumber(tx, 'GR', branchId, receiptDate);

        const headerReq = new sql.Request(tx);
        headerReq.input('documentNo', sql.NVarChar(50), documentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('goodsReceiptTypeId', sql.Int, goodsReceiptTypeId);
        headerReq.input('vendorId', sql.Int, vendorId);
        headerReq.input('customerId', sql.Int, customerId);
        headerReq.input('purchaseOrderId', sql.Int, purchaseOrderId);
        headerReq.input('productionOrderId', sql.Int, productionOrderId);
        headerReq.input('warehouseId', sql.Int, warehouseId);
        headerReq.input('receiptDate', sql.Date, receiptDate);
        headerReq.input('status', sql.NVarChar(30), status);
        headerReq.input('receivedSheetTotal', sql.Decimal(18, 4), totals.receivedSheetTotal);
        headerReq.input('palletCountTotal', sql.Decimal(18, 4), totals.palletCountTotal);
        headerReq.input('m3Total', sql.Decimal(18, 6), totals.m3Total);
        headerReq.input('remark', sql.NVarChar(1000), remark);
        headerReq.input('createdBy', sql.Int, userId);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.GoodsReceipts (
            DocumentNo, BranchId, GoodsReceiptTypeId, VendorId, CustomerId, PurchaseOrderId, ProductionOrderId,
            WarehouseId, ReceiptDate, Status, ReceivedSheetTotal, PalletCountTotal, M3Total, Remark, CreatedBy
          )
          OUTPUT INSERTED.GoodsReceiptId
          VALUES (
            @documentNo, @branchId, @goodsReceiptTypeId, @vendorId, @customerId, @purchaseOrderId, @productionOrderId,
            @warehouseId, @receiptDate, @status, @receivedSheetTotal, @palletCountTotal, @m3Total, @remark, @createdBy
          )
        `);
        goodsReceiptId = headerRes.recordset[0].GoodsReceiptId;

        await resolveLineLots(tx, lineSnapshots, userId);

        for (const line of lineSnapshots) {
          const lineReq = new sql.Request(tx);
          lineReq.input('goodsReceiptId', sql.Int, goodsReceiptId);
          lineReq.input('lineNum', sql.Int, line.lineNum);
          lineReq.input('itemId', sql.Int, line.itemId);
          lineReq.input('itemSpecId', sql.Int, line.itemSpecId);
          lineReq.input('lotId', sql.BigInt, line.lotId);
          lineReq.input('lotNo', sql.NVarChar(80), line.lotNo);
          lineReq.input('warehouseId', sql.Int, line.warehouseId);
          lineReq.input('locationId', sql.Int, line.locationId);
          lineReq.input('unitId', sql.Int, line.unitId);
          lineReq.input('receivedQuantity', sql.Decimal(18, 4), line.receivedQuantity);
          lineReq.input('receivedSheetQty', sql.Decimal(18, 4), line.receivedSheetQty);
          lineReq.input('palletCount', sql.Decimal(18, 4), line.palletCount);
          lineReq.input('m3Quantity', sql.Decimal(18, 6), line.m3Quantity);
          lineReq.input('productTypeId', sql.Int, line.productTypeId);
          lineReq.input('thicknessId', sql.Int, line.thicknessId);
          lineReq.input('widthId', sql.Int, line.widthId);
          lineReq.input('lengthId', sql.Int, line.lengthId);
          lineReq.input('unitCostSnapshot', sql.Decimal(18, 4), line.unitCostSnapshot);
          lineReq.input('remark', sql.NVarChar(1000), line.remark);

          await lineReq.query(`
            INSERT INTO dbo.GoodsReceiptLines (
              GoodsReceiptId, LineNum, ItemId, ItemSpecId, LotId, LotNo, WarehouseId, LocationId, UnitId,
              ReceivedQuantity, ReceivedSheetQty, PalletCount, M3Quantity, ProductTypeId, ThicknessId,
              WidthId, LengthId, UnitCostSnapshot, Remark
            ) VALUES (
              @goodsReceiptId, @lineNum, @itemId, @itemSpecId, @lotId, @lotNo, @warehouseId, @locationId, @unitId,
              @receivedQuantity, @receivedSheetQty, @palletCount, @m3Quantity, @productTypeId, @thicknessId,
              @widthId, @lengthId, @unitCostSnapshot, @remark
            )
          `);
        }

        const histReq = new sql.Request(tx);
        histReq.input('grId', sql.Int, goodsReceiptId);
        histReq.input('userId', sql.Int, userId);
        histReq.input('status', sql.NVarChar(30), status);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
          VALUES ('GR', @grId, @status, @userId, 'Goods receipt created')
        `);
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    const order = await getGoodsReceipt(goodsReceiptId);
    if (!order) {
      res.status(404).json({ message: 'Goods receipt not found' });
      return;
    }
    const lines = await getGoodsReceiptLines(goodsReceiptId);
    res.status(201).json({ data: { ...order, lines } });
  }),
);
router.put(
  '/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const goodsReceiptId = parseId(req.params.id, 'goodsReceiptId');
    const existing = await getGoodsReceipt(goodsReceiptId);
    if (!existing) {
      res.status(404).json({ message: 'Goods receipt not found' });
      return;
    }
    if (existing.status !== 'draft') {
      res.status(409).json({ message: `Cannot update goods receipt in status: ${existing.status}` });
      return;
    }

    const goodsReceiptTypeId = req.body.goodsReceiptTypeId === undefined ? undefined : parseId(req.body.goodsReceiptTypeId, 'goodsReceiptTypeId');
    const warehouseId = req.body.warehouseId === undefined ? undefined : parseId(req.body.warehouseId, 'warehouseId');
    const vendorId = req.body.vendorId === undefined ? null : parseOptionalId(req.body.vendorId, 'vendorId');
    const customerId = req.body.customerId === undefined ? null : parseOptionalId(req.body.customerId, 'customerId');
    const purchaseOrderId = req.body.purchaseOrderId === undefined ? null : parseOptionalId(req.body.purchaseOrderId, 'purchaseOrderId');
    const productionOrderId = req.body.productionOrderId === undefined ? null : parseOptionalId(req.body.productionOrderId, 'productionOrderId');
    const branchId = req.body.branchId === undefined ? null : parseOptionalId(req.body.branchId, 'branchId');
    const receiptDate = req.body.receiptDate === undefined ? undefined : parseOptionalDate(req.body.receiptDate, 'receiptDate');
    const remark = req.body.remark === undefined ? null : (req.body.remark ? String(req.body.remark).trim() : null);

    const replaceLines = req.body.lines !== undefined;
    const lineSnapshots = replaceLines ? buildLineSnapshots(req.body.lines) : null;
    const totals = lineSnapshots ? calculateHeaderTotals(lineSnapshots) : null;

    await mssqlTransaction('DEFAULT', async (tx) => {
      const updateReq = new sql.Request(tx);
      updateReq.input('goodsReceiptId', sql.Int, goodsReceiptId);
      updateReq.input('goodsReceiptTypeId', sql.Int, goodsReceiptTypeId);
      updateReq.input('warehouseId', sql.Int, warehouseId);
      updateReq.input('vendorId', sql.Int, vendorId);
      updateReq.input('customerId', sql.Int, customerId);
      updateReq.input('purchaseOrderId', sql.Int, purchaseOrderId);
      updateReq.input('productionOrderId', sql.Int, productionOrderId);
      updateReq.input('branchId', sql.Int, branchId);
      updateReq.input('receiptDate', sql.Date, receiptDate);
      updateReq.input('remark', sql.NVarChar(1000), remark);
      updateReq.input('receivedSheetTotal', sql.Decimal(18, 4), totals?.receivedSheetTotal ?? null);
      updateReq.input('palletCountTotal', sql.Decimal(18, 4), totals?.palletCountTotal ?? null);
      updateReq.input('m3Total', sql.Decimal(18, 6), totals?.m3Total ?? null);

      await updateReq.query(`
        UPDATE dbo.GoodsReceipts
        SET
          GoodsReceiptTypeId = COALESCE(@goodsReceiptTypeId, GoodsReceiptTypeId),
          WarehouseId = COALESCE(@warehouseId, WarehouseId),
          VendorId = @vendorId,
          CustomerId = @customerId,
          PurchaseOrderId = @purchaseOrderId,
          ProductionOrderId = @productionOrderId,
          BranchId = @branchId,
          ReceiptDate = COALESCE(@receiptDate, ReceiptDate),
          Remark = @remark,
          ReceivedSheetTotal = COALESCE(@receivedSheetTotal, ReceivedSheetTotal),
          PalletCountTotal = COALESCE(@palletCountTotal, PalletCountTotal),
          M3Total = COALESCE(@m3Total, M3Total),
          UpdatedAt = SYSUTCDATETIME()
        WHERE GoodsReceiptId = @goodsReceiptId
      `);

      if (replaceLines) {
        const delReq = new sql.Request(tx);
        delReq.input('goodsReceiptId', sql.Int, goodsReceiptId);
        await delReq.query(`
          DELETE FROM dbo.GoodsReceiptLines
          WHERE GoodsReceiptId = @goodsReceiptId
        `);

        await resolveLineLots(tx, lineSnapshots, userId);

        for (const line of lineSnapshots) {
          const lineReq = new sql.Request(tx);
          lineReq.input('goodsReceiptId', sql.Int, goodsReceiptId);
          lineReq.input('lineNum', sql.Int, line.lineNum);
          lineReq.input('itemId', sql.Int, line.itemId);
          lineReq.input('itemSpecId', sql.Int, line.itemSpecId);
          lineReq.input('lotId', sql.BigInt, line.lotId);
          lineReq.input('lotNo', sql.NVarChar(80), line.lotNo);
          lineReq.input('warehouseId', sql.Int, line.warehouseId);
          lineReq.input('locationId', sql.Int, line.locationId);
          lineReq.input('unitId', sql.Int, line.unitId);
          lineReq.input('receivedQuantity', sql.Decimal(18, 4), line.receivedQuantity);
          lineReq.input('receivedSheetQty', sql.Decimal(18, 4), line.receivedSheetQty);
          lineReq.input('palletCount', sql.Decimal(18, 4), line.palletCount);
          lineReq.input('m3Quantity', sql.Decimal(18, 6), line.m3Quantity);
          lineReq.input('productTypeId', sql.Int, line.productTypeId);
          lineReq.input('thicknessId', sql.Int, line.thicknessId);
          lineReq.input('widthId', sql.Int, line.widthId);
          lineReq.input('lengthId', sql.Int, line.lengthId);
          lineReq.input('unitCostSnapshot', sql.Decimal(18, 4), line.unitCostSnapshot);
          lineReq.input('remark', sql.NVarChar(1000), line.remark);

          await lineReq.query(`
            INSERT INTO dbo.GoodsReceiptLines (
              GoodsReceiptId, LineNum, ItemId, ItemSpecId, LotId, LotNo, WarehouseId, LocationId, UnitId,
              ReceivedQuantity, ReceivedSheetQty, PalletCount, M3Quantity, ProductTypeId, ThicknessId,
              WidthId, LengthId, UnitCostSnapshot, Remark
            )
            VALUES (
              @goodsReceiptId, @lineNum, @itemId, @itemSpecId, @lotId, @lotNo, @warehouseId, @locationId, @unitId,
              @receivedQuantity, @receivedSheetQty, @palletCount, @m3Quantity, @productTypeId, @thicknessId,
              @widthId, @lengthId, @unitCostSnapshot, @remark
            )
          `);
        }
      }

      const histReq = new sql.Request(tx);
      histReq.input('grId', sql.Int, goodsReceiptId);
      histReq.input('status', sql.NVarChar(30), existing.status);
      histReq.input('userId', sql.Int, userId);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('GR', @grId, @status, @status, @userId, 'Updated')
      `);
    });

    const order = await getGoodsReceipt(goodsReceiptId);
    const lines = await getGoodsReceiptLines(goodsReceiptId);
    res.json({ data: { ...order, lines } });
  }),
);

router.get(
  '/:id/status-history',
  readRoles,
  asyncHandler(async (req, res) => {
    const goodsReceiptId = parseId(req.params.id, 'goodsReceiptId');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT
        DocumentStatusHistoryId,
        DocumentType,
        DocumentId,
        FromStatus,
        ToStatus,
        dsh.ChangedBy,
        u.DisplayName as ChangedByName,
        ChangedAt,
        Notes
      FROM dbo.DocumentStatusHistory dsh
      LEFT JOIN dbo.Users u ON u.UserId = dsh.ChangedBy
      WHERE DocumentType = 'GR' AND DocumentId = @goodsReceiptId
      ORDER BY ChangedAt DESC, DocumentStatusHistoryId DESC
    `, { inputs: { goodsReceiptId: { type: sql.Int, value: goodsReceiptId } } });

    res.json({
      data: rows.map((r) => ({
        id: r.DocumentStatusHistoryId,
        documentType: r.DocumentType,
        documentId: r.DocumentId,
        fromStatus: r.FromStatus,
        toStatus: r.ToStatus,
        changedBy: r.ChangedBy,
        changedByName: r.ChangedByName,
        changedAt: r.ChangedAt,
        notes: r.Notes,
      })),
    });
  }),
);

router.post(
  '/:id/post',
  approveRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const goodsReceiptId = parseId(req.params.id, 'goodsReceiptId');
    const result = await inventoryPostingService.postGoodsReceipt(goodsReceiptId, userId);
    res.json(result);
  }),
);

export default router;
