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

function mapGoodsIssue(row) {
  if (!row) return null;
  return {
    id: row.GoodsIssueId,
    documentNo: row.DocumentNo,
    branchId: row.BranchId,
    branchCode: row.BranchCode,
    branchName: row.BranchName,
    goodsIssueTypeId: row.GoodsIssueTypeId,
    goodsIssueTypeCode: row.GoodsIssueTypeCode,
    goodsIssueTypeName: row.GoodsIssueTypeName,
    customerId: row.CustomerId,
    customerCode: row.CustomerCode,
    customerName: row.CustomerName,
    warehouseId: row.WarehouseId,
    warehouseCode: row.WarehouseCode,
    warehouseName: row.WarehouseName,
    requestDate: row.RequestDate,
    issueDate: row.IssueDate,
    status: row.Status,
    limitSheetTotal: row.LimitSheetTotal,
    requestedSheetTotal: row.RequestedSheetTotal,
    issuedSheetTotal: row.IssuedSheetTotal,
    palletCountTotal: row.PalletCountTotal,
    m3Total: row.M3Total,
    remark: row.Remark,
    postedAt: row.PostedAt,
    postedBy: row.PostedBy,
    createdBy: row.CreatedBy,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

function mapGoodsIssueLine(row) {
  return {
    id: row.GoodsIssueLineId,
    goodsIssueId: row.GoodsIssueId,
    lineNum: row.LineNum,
    itemId: row.ItemId,
    itemCode: row.ItemCode,
    itemName: row.ItemName,
    itemSpecId: row.ItemSpecId,
    specCode: row.SpecCode,
    specName: row.SpecName,
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
    requestedQuantity: row.RequestedQuantity,
    issuedQuantity: row.IssuedQuantity,
    requestedSheetQty: row.RequestedSheetQty,
    issuedSheetQty: row.IssuedSheetQty,
    limitSheetQty: row.LimitSheetQty,
    palletCount: row.PalletCount,
    m3Quantity: row.M3Quantity,
    productTypeId: row.ProductTypeId,
    thicknessId: row.ThicknessId,
    widthId: row.WidthId,
    lengthId: row.LengthId,
    remark: row.Remark,
  };
}

async function getGoodsIssue(goodsIssueId) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      gi.GoodsIssueId,
      gi.DocumentNo,
      gi.BranchId,
      b.BranchCode,
      b.BranchName,
      gi.GoodsIssueTypeId,
      git.GoodsIssueTypeCode,
      git.GoodsIssueTypeName,
      gi.CustomerId,
      c.CustomerCode,
      c.CustomerName,
      gi.WarehouseId,
      w.WarehouseCode,
      w.WarehouseName,
      gi.RequestDate,
      gi.IssueDate,
      gi.Status,
      gi.LimitSheetTotal,
      gi.RequestedSheetTotal,
      gi.IssuedSheetTotal,
      gi.PalletCountTotal,
      gi.M3Total,
      gi.Remark,
      gi.PostedAt,
      gi.PostedBy,
      gi.CreatedBy,
      gi.CreatedAt,
      gi.UpdatedAt
    FROM dbo.GoodsIssues gi
    JOIN dbo.GoodsIssueTypes git ON git.GoodsIssueTypeId = gi.GoodsIssueTypeId
    JOIN dbo.Warehouses w ON w.WarehouseId = gi.WarehouseId
    LEFT JOIN dbo.Customers c ON c.CustomerId = gi.CustomerId
    LEFT JOIN dbo.Branches b ON b.BranchId = gi.BranchId
    WHERE gi.GoodsIssueId = @goodsIssueId
  `, { inputs: { goodsIssueId: { type: sql.Int, value: goodsIssueId } } });

  return mapGoodsIssue(rows[0]);
}

async function getGoodsIssueLines(goodsIssueId) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      gil.GoodsIssueLineId,
      gil.GoodsIssueId,
      gil.LineNum,
      gil.ItemId,
      i.ItemCode,
      i.ItemName,
      gil.ItemSpecId,
      ispec.SpecCode,
      ispec.SpecName,
      gil.LotId,
      l.LotNo,
      gil.WarehouseId,
      w.WarehouseCode,
      w.WarehouseName,
      gil.LocationId,
      wl.LocationCode,
      gil.UnitId,
      u.UnitCode,
      u.UnitName,
      gil.RequestedQuantity,
      gil.IssuedQuantity,
      gil.RequestedSheetQty,
      gil.IssuedSheetQty,
      gil.LimitSheetQty,
      gil.PalletCount,
      gil.M3Quantity,
      gil.ProductTypeId,
      gil.ThicknessId,
      gil.WidthId,
      gil.LengthId,
      gil.Remark
    FROM dbo.GoodsIssueLines gil
    JOIN dbo.Items i ON i.ItemId = gil.ItemId
    JOIN dbo.Units u ON u.UnitId = gil.UnitId
    LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = gil.ItemSpecId
    LEFT JOIN dbo.Lots l ON l.LotId = gil.LotId
    LEFT JOIN dbo.Warehouses w ON w.WarehouseId = gil.WarehouseId
    LEFT JOIN dbo.WarehouseLocations wl ON wl.LocationId = gil.LocationId
    WHERE gil.GoodsIssueId = @goodsIssueId
    ORDER BY gil.LineNum
  `, { inputs: { goodsIssueId: { type: sql.Int, value: goodsIssueId } } });

  return rows.map(mapGoodsIssueLine);
}

function buildGoodsIssueFilters(query) {
  const { page, pageSize, offset } = buildPagination(query);
  const conditions = [];
  const inputs = {};

  if (query.customerId) {
    conditions.push('gi.CustomerId = @customerId');
    inputs.customerId = { type: sql.Int, value: parseId(query.customerId, 'customerId') };
  }
  if (query.warehouseId) {
    conditions.push('gi.WarehouseId = @warehouseId');
    inputs.warehouseId = { type: sql.Int, value: parseId(query.warehouseId, 'warehouseId') };
  }
  if (query.goodsIssueTypeId) {
    conditions.push('gi.GoodsIssueTypeId = @goodsIssueTypeId');
    inputs.goodsIssueTypeId = { type: sql.Int, value: parseId(query.goodsIssueTypeId, 'goodsIssueTypeId') };
  }
  if (query.status !== undefined && query.status !== '') {
    const status = normalizeEnum(query.status, ['draft', 'requested', 'approved', 'issued', 'cancelled'], 'status');
    conditions.push('gi.Status = @status');
    inputs.status = { type: sql.NVarChar(30), value: status };
  }
  if (query.search) {
    conditions.push('(gi.DocumentNo LIKE @search OR c.CustomerCode LIKE @search OR c.CustomerName LIKE @search)');
    inputs.search = { type: sql.NVarChar(255), value: `%${query.search}%` };
  }
  if (query.dateFrom) {
    inputs.dateFrom = { type: sql.Date, value: parseOptionalDate(query.dateFrom, 'dateFrom') };
    conditions.push('gi.RequestDate >= @dateFrom');
  }
  if (query.dateTo) {
    inputs.dateTo = { type: sql.Date, value: parseOptionalDate(query.dateTo, 'dateTo') };
    conditions.push('gi.RequestDate <= @dateTo');
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
  let limitSheetTotal = 0;
  let requestedSheetTotal = 0;
  let issuedSheetTotal = 0;
  let palletCountTotal = 0;
  let m3Total = 0;

  for (const line of lines) {
    limitSheetTotal += Number(line.limitSheetQty || 0);
    requestedSheetTotal += Number(line.requestedSheetQty || 0);
    issuedSheetTotal += Number(line.issuedSheetQty || 0);
    palletCountTotal += Number(line.palletCount || 0);
    m3Total += Number(line.m3Quantity || 0);
  }

  return { limitSheetTotal, requestedSheetTotal, issuedSheetTotal, palletCountTotal, m3Total };
}

function buildLineSnapshots(rawLines) {
  if (!Array.isArray(rawLines) || !rawLines.length) throw badRequest('lines is required');
  const lines = [];

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const raw = rawLines[idx] || {};
    const lineNum = Number.isInteger(raw.lineNum) && raw.lineNum > 0 ? raw.lineNum : idx + 1;
    
    const requestedQuantity = parseOptionalNumber(raw.requestedQuantity, `lines[${idx}].requestedQuantity`) ?? 0;
    const issuedQuantity = parseOptionalNumber(raw.issuedQuantity, `lines[${idx}].issuedQuantity`) ?? 0;
    
    lines.push({
      lineNum,
      itemId: parseId(raw.itemId, `lines[${idx}].itemId`),
      itemSpecId: parseOptionalId(raw.itemSpecId, `lines[${idx}].itemSpecId`),
      lotId: parseOptionalId(raw.lotId, `lines[${idx}].lotId`),
      warehouseId: parseOptionalId(raw.warehouseId, `lines[${idx}].warehouseId`),
      locationId: parseOptionalId(raw.locationId, `lines[${idx}].locationId`),
      unitId: parseId(raw.unitId, `lines[${idx}].unitId`),
      requestedQuantity,
      issuedQuantity,
      requestedSheetQty: parseOptionalNumber(raw.requestedSheetQty, `lines[${idx}].requestedSheetQty`),
      issuedSheetQty: parseOptionalNumber(raw.issuedSheetQty, `lines[${idx}].issuedSheetQty`),
      limitSheetQty: parseOptionalNumber(raw.limitSheetQty, `lines[${idx}].limitSheetQty`),
      palletCount: parseOptionalNumber(raw.palletCount, `lines[${idx}].palletCount`),
      m3Quantity: parseOptionalNumber(raw.m3Quantity, `lines[${idx}].m3Quantity`),
      productTypeId: parseOptionalId(raw.productTypeId, `lines[${idx}].productTypeId`),
      thicknessId: parseOptionalId(raw.thicknessId, `lines[${idx}].thicknessId`),
      widthId: parseOptionalId(raw.widthId, `lines[${idx}].widthId`),
      lengthId: parseOptionalId(raw.lengthId, `lines[${idx}].lengthId`),
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
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset, whereSql, inputs } = buildGoodsIssueFilters(req.query);

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredIssues AS (
        SELECT gi.GoodsIssueId
        FROM dbo.GoodsIssues gi
        LEFT JOIN dbo.Customers c ON c.CustomerId = gi.CustomerId
        ${whereSql}
      )
      SELECT
        gi.GoodsIssueId,
        gi.DocumentNo,
        gi.BranchId,
        b.BranchCode,
        b.BranchName,
        gi.GoodsIssueTypeId,
        git.GoodsIssueTypeCode,
        git.GoodsIssueTypeName,
        gi.CustomerId,
        c.CustomerCode,
        c.CustomerName,
        gi.WarehouseId,
        w.WarehouseCode,
        w.WarehouseName,
        gi.RequestDate,
        gi.IssueDate,
        gi.Status,
        gi.CreatedAt,
        (SELECT COUNT(1) FROM FilteredIssues) AS TotalCount
      FROM FilteredIssues fi
      JOIN dbo.GoodsIssues gi ON gi.GoodsIssueId = fi.GoodsIssueId
      JOIN dbo.GoodsIssueTypes git ON git.GoodsIssueTypeId = gi.GoodsIssueTypeId
      JOIN dbo.Warehouses w ON w.WarehouseId = gi.WarehouseId
      LEFT JOIN dbo.Customers c ON c.CustomerId = gi.CustomerId
      LEFT JOIN dbo.Branches b ON b.BranchId = gi.BranchId
      ORDER BY gi.CreatedAt DESC, gi.GoodsIssueId DESC
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
        id: r.GoodsIssueId,
        documentNo: r.DocumentNo,
        branchId: r.BranchId,
        branchCode: r.BranchCode,
        branchName: r.BranchName,
        goodsIssueTypeId: r.GoodsIssueTypeId,
        goodsIssueTypeCode: r.GoodsIssueTypeCode,
        goodsIssueTypeName: r.GoodsIssueTypeName,
        customerId: r.CustomerId,
        customerCode: r.CustomerCode,
        customerName: r.CustomerName,
        warehouseId: r.WarehouseId,
        warehouseCode: r.WarehouseCode,
        warehouseName: r.WarehouseName,
        requestDate: r.RequestDate,
        issueDate: r.IssueDate,
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
    const goodsIssueId = parseId(req.params.id, 'goodsIssueId');
    const order = await getGoodsIssue(goodsIssueId);
    if (!order) {
      res.status(404).json({ message: 'Goods issue not found' });
      return;
    }
    const lines = await getGoodsIssueLines(goodsIssueId);
    res.json({ data: { ...order, lines } });
  }),
);

router.post(
  '/',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const goodsIssueTypeId = parseId(req.body.goodsIssueTypeId, 'goodsIssueTypeId');
    const warehouseId = parseId(req.body.warehouseId, 'warehouseId');
    const customerId = parseOptionalId(req.body.customerId, 'customerId');
    const branchId = parseOptionalId(req.body.branchId, 'branchId');
    const requestDate = parseOptionalDate(req.body.requestDate, 'requestDate') || new Date();
    const issueDate = parseOptionalDate(req.body.issueDate, 'issueDate');
    const remark = req.body.remark ? String(req.body.remark).trim() : null;
    const status = normalizeEnum(req.body.status, ['draft', 'requested'], 'status') || 'draft';

    const lineSnapshots = buildLineSnapshots(req.body.lines);
    const totals = calculateHeaderTotals(lineSnapshots);

    let goodsIssueId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        const documentNo = await documentService.generateDocumentNumber(tx, 'GI', branchId, requestDate);

        const headerReq = new sql.Request(tx);
        headerReq.input('documentNo', sql.NVarChar(50), documentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('goodsIssueTypeId', sql.Int, goodsIssueTypeId);
        headerReq.input('customerId', sql.Int, customerId);
        headerReq.input('warehouseId', sql.Int, warehouseId);
        headerReq.input('requestDate', sql.Date, requestDate);
        headerReq.input('issueDate', sql.Date, issueDate);
        headerReq.input('status', sql.NVarChar(30), status);
        headerReq.input('limitSheetTotal', sql.Decimal(18, 4), totals.limitSheetTotal);
        headerReq.input('requestedSheetTotal', sql.Decimal(18, 4), totals.requestedSheetTotal);
        headerReq.input('issuedSheetTotal', sql.Decimal(18, 4), totals.issuedSheetTotal);
        headerReq.input('palletCountTotal', sql.Decimal(18, 4), totals.palletCountTotal);
        headerReq.input('m3Total', sql.Decimal(18, 6), totals.m3Total);
        headerReq.input('remark', sql.NVarChar(1000), remark);
        headerReq.input('createdBy', sql.Int, userId);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.GoodsIssues (
            DocumentNo, BranchId, GoodsIssueTypeId, CustomerId, WarehouseId,
            RequestDate, IssueDate, Status, LimitSheetTotal, RequestedSheetTotal,
            IssuedSheetTotal, PalletCountTotal, M3Total, Remark, CreatedBy
          )
          OUTPUT INSERTED.GoodsIssueId
          VALUES (
            @documentNo, @branchId, @goodsIssueTypeId, @customerId, @warehouseId,
            @requestDate, @issueDate, @status, @limitSheetTotal, @requestedSheetTotal,
            @issuedSheetTotal, @palletCountTotal, @m3Total, @remark, @createdBy
          )
        `);
        goodsIssueId = headerRes.recordset[0].GoodsIssueId;

        for (const line of lineSnapshots) {
          const lineReq = new sql.Request(tx);
          lineReq.input('goodsIssueId', sql.Int, goodsIssueId);
          lineReq.input('lineNum', sql.Int, line.lineNum);
          lineReq.input('itemId', sql.Int, line.itemId);
          lineReq.input('itemSpecId', sql.Int, line.itemSpecId);
          lineReq.input('lotId', sql.BigInt, line.lotId);
          lineReq.input('warehouseId', sql.Int, line.warehouseId);
          lineReq.input('locationId', sql.Int, line.locationId);
          lineReq.input('unitId', sql.Int, line.unitId);
          lineReq.input('requestedQuantity', sql.Decimal(18, 4), line.requestedQuantity);
          lineReq.input('issuedQuantity', sql.Decimal(18, 4), line.issuedQuantity);
          lineReq.input('requestedSheetQty', sql.Decimal(18, 4), line.requestedSheetQty);
          lineReq.input('issuedSheetQty', sql.Decimal(18, 4), line.issuedSheetQty);
          lineReq.input('limitSheetQty', sql.Decimal(18, 4), line.limitSheetQty);
          lineReq.input('palletCount', sql.Decimal(18, 4), line.palletCount);
          lineReq.input('m3Quantity', sql.Decimal(18, 6), line.m3Quantity);
          lineReq.input('productTypeId', sql.Int, line.productTypeId);
          lineReq.input('thicknessId', sql.Int, line.thicknessId);
          lineReq.input('widthId', sql.Int, line.widthId);
          lineReq.input('lengthId', sql.Int, line.lengthId);
          lineReq.input('remark', sql.NVarChar(1000), line.remark);

          await lineReq.query(`
            INSERT INTO dbo.GoodsIssueLines (
              GoodsIssueId, LineNum, ItemId, ItemSpecId, LotId, WarehouseId, LocationId, UnitId,
              RequestedQuantity, IssuedQuantity, RequestedSheetQty, IssuedSheetQty, LimitSheetQty,
              PalletCount, M3Quantity, ProductTypeId, ThicknessId, WidthId, LengthId, Remark
            ) VALUES (
              @goodsIssueId, @lineNum, @itemId, @itemSpecId, @lotId, @warehouseId, @locationId, @unitId,
              @requestedQuantity, @issuedQuantity, @requestedSheetQty, @issuedSheetQty, @limitSheetQty,
              @palletCount, @m3Quantity, @productTypeId, @thicknessId, @widthId, @lengthId, @remark
            )
          `);
        }

        const histReq = new sql.Request(tx);
        histReq.input('giId', sql.Int, goodsIssueId);
        histReq.input('userId', sql.Int, userId);
        histReq.input('status', sql.NVarChar(30), status);
        await histReq.query(`
          INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
          VALUES ('GI', @giId, @status, @userId, 'Goods issue created')
        `);
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    const order = await getGoodsIssue(goodsIssueId);
    if (!order) {
      res.status(404).json({ message: 'Goods issue not found' });
      return;
    }
    const lines = await getGoodsIssueLines(goodsIssueId);
    res.status(201).json({ data: { ...order, lines } });
  }),
);
router.put(
  '/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const goodsIssueId = parseId(req.params.id, 'goodsIssueId');
    const existing = await getGoodsIssue(goodsIssueId);
    if (!existing) {
      res.status(404).json({ message: 'Goods issue not found' });
      return;
    }
    if (existing.status !== 'draft' && existing.status !== 'requested') {
      res.status(409).json({ message: `Cannot update goods issue in status: ${existing.status}` });
      return;
    }

    const goodsIssueTypeId = req.body.goodsIssueTypeId === undefined ? undefined : parseId(req.body.goodsIssueTypeId, 'goodsIssueTypeId');
    const warehouseId = req.body.warehouseId === undefined ? undefined : parseId(req.body.warehouseId, 'warehouseId');
    const customerId = req.body.customerId === undefined ? null : parseOptionalId(req.body.customerId, 'customerId');
    const branchId = req.body.branchId === undefined ? null : parseOptionalId(req.body.branchId, 'branchId');
    const requestDate = req.body.requestDate === undefined ? undefined : parseOptionalDate(req.body.requestDate, 'requestDate');
    const issueDate = req.body.issueDate === undefined ? null : parseOptionalDate(req.body.issueDate, 'issueDate');
    const remark = req.body.remark === undefined ? null : (req.body.remark ? String(req.body.remark).trim() : null);

    const replaceLines = req.body.lines !== undefined;
    const lineSnapshots = replaceLines ? buildLineSnapshots(req.body.lines) : null;
    const totals = lineSnapshots ? calculateHeaderTotals(lineSnapshots) : null;

    await mssqlQuery('DEFAULT', `
      UPDATE dbo.GoodsIssues
      SET
        GoodsIssueTypeId = COALESCE(@goodsIssueTypeId, GoodsIssueTypeId),
        WarehouseId = COALESCE(@warehouseId, WarehouseId),
        CustomerId = @customerId,
        BranchId = @branchId,
        RequestDate = COALESCE(@requestDate, RequestDate),
        IssueDate = @issueDate,
        Remark = @remark,
        LimitSheetTotal = COALESCE(@limitSheetTotal, LimitSheetTotal),
        RequestedSheetTotal = COALESCE(@requestedSheetTotal, RequestedSheetTotal),
        IssuedSheetTotal = COALESCE(@issuedSheetTotal, IssuedSheetTotal),
        PalletCountTotal = COALESCE(@palletCountTotal, PalletCountTotal),
        M3Total = COALESCE(@m3Total, M3Total),
        UpdatedAt = SYSUTCDATETIME()
      WHERE GoodsIssueId = @goodsIssueId
    `, {
      inputs: {
        goodsIssueId: { type: sql.Int, value: goodsIssueId },
        goodsIssueTypeId: { type: sql.Int, value: goodsIssueTypeId },
        warehouseId: { type: sql.Int, value: warehouseId },
        customerId: { type: sql.Int, value: customerId },
        branchId: { type: sql.Int, value: branchId },
        requestDate: { type: sql.Date, value: requestDate },
        issueDate: { type: sql.Date, value: issueDate },
        remark: { type: sql.NVarChar(1000), value: remark },
        limitSheetTotal: { type: sql.Decimal(18, 4), value: totals?.limitSheetTotal ?? null },
        requestedSheetTotal: { type: sql.Decimal(18, 4), value: totals?.requestedSheetTotal ?? null },
        issuedSheetTotal: { type: sql.Decimal(18, 4), value: totals?.issuedSheetTotal ?? null },
        palletCountTotal: { type: sql.Decimal(18, 4), value: totals?.palletCountTotal ?? null },
        m3Total: { type: sql.Decimal(18, 6), value: totals?.m3Total ?? null },
      },
    });

    if (replaceLines) {
      await mssqlQuery('DEFAULT', `
        DELETE FROM dbo.GoodsIssueLines
        WHERE GoodsIssueId = @goodsIssueId
      `, { inputs: { goodsIssueId: { type: sql.Int, value: goodsIssueId } } });

      for (const line of lineSnapshots) {
        await mssqlQuery('DEFAULT', `
          INSERT INTO dbo.GoodsIssueLines (
            GoodsIssueId,
            LineNum,
            ItemId,
            ItemSpecId,
            LotId,
            WarehouseId,
            LocationId,
            UnitId,
            RequestedQuantity,
            IssuedQuantity,
            RequestedSheetQty,
            IssuedSheetQty,
            LimitSheetQty,
            PalletCount,
            M3Quantity,
            ProductTypeId,
            ThicknessId,
            WidthId,
            LengthId,
            Remark
          )
          VALUES (
            @goodsIssueId,
            @lineNum,
            @itemId,
            @itemSpecId,
            @lotId,
            @warehouseId,
            @locationId,
            @unitId,
            @requestedQuantity,
            @issuedQuantity,
            @requestedSheetQty,
            @issuedSheetQty,
            @limitSheetQty,
            @palletCount,
            @m3Quantity,
            @productTypeId,
            @thicknessId,
            @widthId,
            @lengthId,
            @remark
          )
        `, {
          inputs: {
            goodsIssueId: { type: sql.Int, value: goodsIssueId },
            lineNum: { type: sql.Int, value: line.lineNum },
            itemId: { type: sql.Int, value: line.itemId },
            itemSpecId: { type: sql.Int, value: line.itemSpecId },
            lotId: { type: sql.BigInt, value: line.lotId },
            warehouseId: { type: sql.Int, value: line.warehouseId },
            locationId: { type: sql.Int, value: line.locationId },
            unitId: { type: sql.Int, value: line.unitId },
            requestedQuantity: { type: sql.Decimal(18, 4), value: line.requestedQuantity },
            issuedQuantity: { type: sql.Decimal(18, 4), value: line.issuedQuantity },
            requestedSheetQty: { type: sql.Decimal(18, 4), value: line.requestedSheetQty },
            issuedSheetQty: { type: sql.Decimal(18, 4), value: line.issuedSheetQty },
            limitSheetQty: { type: sql.Decimal(18, 4), value: line.limitSheetQty },
            palletCount: { type: sql.Decimal(18, 4), value: line.palletCount },
            m3Quantity: { type: sql.Decimal(18, 6), value: line.m3Quantity },
            productTypeId: { type: sql.Int, value: line.productTypeId },
            thicknessId: { type: sql.Int, value: line.thicknessId },
            widthId: { type: sql.Int, value: line.widthId },
            lengthId: { type: sql.Int, value: line.lengthId },
            remark: { type: sql.NVarChar(1000), value: line.remark },
          },
        });
      }
    }

    await writeStatusHistory('GI', goodsIssueId, existing.status, existing.status, userId, 'Updated');

    const order = await getGoodsIssue(goodsIssueId);
    const lines = await getGoodsIssueLines(goodsIssueId);
    res.json({ data: { ...order, lines } });
  }),
);

router.get(
  '/:id/status-history',
  readRoles,
  asyncHandler(async (req, res) => {
    const goodsIssueId = parseId(req.params.id, 'goodsIssueId');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT
        DocumentStatusHistoryId,
        DocumentType,
        DocumentId,
        FromStatus,
        ToStatus,
        ChangedBy,
        ChangedAt,
        Notes
      FROM dbo.DocumentStatusHistory
      WHERE DocumentType = 'GI' AND DocumentId = @goodsIssueId
      ORDER BY ChangedAt DESC, DocumentStatusHistoryId DESC
    `, { inputs: { goodsIssueId: { type: sql.Int, value: goodsIssueId } } });

    res.json({
      data: rows.map((r) => ({
        id: r.DocumentStatusHistoryId,
        documentType: r.DocumentType,
        documentId: r.DocumentId,
        fromStatus: r.FromStatus,
        toStatus: r.ToStatus,
        changedBy: r.ChangedBy,
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
    const goodsIssueId = parseId(req.params.id, 'goodsIssueId');
    const result = await inventoryPostingService.postGoodsIssue(goodsIssueId, userId);
    res.json(result);
  }),
);

export default router;
