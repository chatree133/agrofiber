import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sql, mssqlQuery, mssqlTransaction } from '../lib/mssql.js';
import { documentService } from '../services/common/documentService.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'manager', 'user', 'audit', 'qc');
const writeRoles = allowRoles('admin', 'manager', 'qc');

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

function parseBool(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
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

// ----------------------------------------------------------------------
// Quality Specs (Master Data)
// ----------------------------------------------------------------------

router.get(
  '/specs',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.search) {
      conditions.push('(SpecCode LIKE @search OR SpecName LIKE @search)');
      inputs.search = { type: sql.NVarChar(255), value: `%${req.query.search}%` };
    }
    if (req.query.isActive !== undefined && req.query.isActive !== '') {
      conditions.push('IsActive = @isActive');
      inputs.isActive = { type: sql.Bit, value: parseBool(req.query.isActive) };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredSpecs AS (
        SELECT QualitySpecId FROM dbo.QualitySpecs ${whereSql}
      )
      SELECT 
        qs.*,
        (SELECT COUNT(1) FROM FilteredSpecs) AS TotalCount
      FROM FilteredSpecs fs
      JOIN dbo.QualitySpecs qs ON qs.QualitySpecId = fs.QualitySpecId
      ORDER BY qs.SpecCode
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
        id: r.QualitySpecId,
        specCode: r.SpecCode,
        specName: r.SpecName,
        description: r.Description,
        itemTypeId: r.ItemTypeId,
        productTypeId: r.ProductTypeId,
        parametersJson: r.ParametersJson ? JSON.parse(r.ParametersJson) : null,
        isActive: Boolean(r.IsActive),
        createdAt: r.CreatedAt
      })),
      pagination: { page, pageSize, total: rows[0]?.TotalCount || 0 },
    });
  })
);

router.post(
  '/specs',
  writeRoles,
  asyncHandler(async (req, res) => {
    const specCode = String(req.body.specCode || '').trim();
    const specName = String(req.body.specName || '').trim();
    if (!specCode) throw badRequest('specCode is required');
    if (!specName) throw badRequest('specName is required');

    const description = req.body.description ? String(req.body.description).trim() : null;
    const itemTypeId = parseOptionalId(req.body.itemTypeId, 'itemTypeId');
    const productTypeId = parseOptionalId(req.body.productTypeId, 'productTypeId');
    const parametersJson = req.body.parametersJson ? JSON.stringify(req.body.parametersJson) : null;
    const isActive = req.body.isActive === undefined ? true : parseBool(req.body.isActive);

    const rows = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.QualitySpecs (
        SpecCode, SpecName, Description, ItemTypeId, ProductTypeId, ParametersJson, IsActive
      ) OUTPUT INSERTED.QualitySpecId
      VALUES (
        @specCode, @specName, @description, @itemTypeId, @productTypeId, @parametersJson, @isActive
      )
    `, {
      inputs: {
        specCode: { type: sql.NVarChar(50), value: specCode },
        specName: { type: sql.NVarChar(255), value: specName },
        description: { type: sql.NVarChar(1000), value: description },
        itemTypeId: { type: sql.Int, value: itemTypeId },
        productTypeId: { type: sql.Int, value: productTypeId },
        parametersJson: { type: sql.NVarChar(sql.MAX), value: parametersJson },
        isActive: { type: sql.Bit, value: isActive },
      }
    });

    res.status(201).json({ id: rows[0].QualitySpecId, message: 'Quality Spec created successfully' });
  })
);

// ----------------------------------------------------------------------
// Quality Inspections
// ----------------------------------------------------------------------

router.get(
  '/inspections',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = buildPagination(req.query);
    const conditions = [];
    const inputs = {};

    if (req.query.overallResult) {
      conditions.push('qi.OverallResult = @overallResult');
      inputs.overallResult = { type: sql.NVarChar(30), value: req.query.overallResult };
    }
    if (req.query.itemId) {
      conditions.push('qi.ItemId = @itemId');
      inputs.itemId = { type: sql.Int, value: parseId(req.query.itemId, 'itemId') };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredInspections AS (
        SELECT InspectionId FROM dbo.QualityInspections qi ${whereSql}
      )
      SELECT 
        qi.*, i.ItemCode, i.ItemName, u.FirstName + ' ' + u.LastName AS InspectorName,
        (SELECT COUNT(1) FROM FilteredInspections) AS TotalCount
      FROM FilteredInspections fi
      JOIN dbo.QualityInspections qi ON qi.InspectionId = fi.InspectionId
      JOIN dbo.Items i ON i.ItemId = qi.ItemId
      JOIN dbo.Users u ON u.UserId = qi.InspectorId
      ORDER BY qi.CreatedAt DESC
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
        id: r.InspectionId,
        documentNo: r.DocumentNo,
        branchId: r.BranchId,
        referenceType: r.ReferenceType,
        referenceId: r.ReferenceId,
        itemId: r.ItemId,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        lotId: r.LotId,
        inspectorId: r.InspectorId,
        inspectorName: r.InspectorName,
        inspectionDate: r.InspectionDate,
        overallResult: r.OverallResult,
        notes: r.Notes,
        createdAt: r.CreatedAt
      })),
      pagination: { page, pageSize, total: rows[0]?.TotalCount || 0 },
    });
  })
);

router.get(
  '/inspections/:id',
  readRoles,
  asyncHandler(async (req, res) => {
    const qiId = parseId(req.params.id, 'id');
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT qi.*, i.ItemCode, i.ItemName, u.FirstName + ' ' + u.LastName AS InspectorName
      FROM dbo.QualityInspections qi
      JOIN dbo.Items i ON i.ItemId = qi.ItemId
      JOIN dbo.Users u ON u.UserId = qi.InspectorId
      WHERE qi.InspectionId = @id
    `, { inputs: { id: { type: sql.Int, value: qiId } } });

    if (headerRows.length === 0) return res.status(404).json({ message: 'Inspection not found' });

    const linesRows = await mssqlQuery('DEFAULT', `
      SELECT qir.*, qs.SpecCode, qs.SpecName
      FROM dbo.QualityInspectionResults qir
      JOIN dbo.QualitySpecs qs ON qs.QualitySpecId = qir.QualitySpecId
      WHERE qir.InspectionId = @id
    `, { inputs: { id: { type: sql.Int, value: qiId } } });

    res.json({
      data: {
        ...headerRows[0],
        results: linesRows.map(l => ({
          resultId: l.ResultId,
          qualitySpecId: l.QualitySpecId,
          specCode: l.SpecCode,
          specName: l.SpecName,
          parameterName: l.ParameterName,
          expectedValue: l.ExpectedValue,
          actualValue: l.ActualValue,
          isPassed: Boolean(l.IsPassed),
          notes: l.Notes
        }))
      }
    });
  })
);

router.post(
  '/inspections',
  writeRoles,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const branchId = parseOptionalId(req.body.branchId, 'branchId');
    const referenceType = String(req.body.referenceType || 'GR').trim();
    const referenceId = parseId(req.body.referenceId, 'referenceId');
    const itemId = parseId(req.body.itemId, 'itemId');
    const lotId = parseOptionalId(req.body.lotId, 'lotId');
    const inspectionDate = parseOptionalDate(req.body.inspectionDate, 'inspectionDate') || new Date();
    const overallResult = normalizeEnum(req.body.overallResult, ['pending', 'passed', 'failed'], 'overallResult') || 'pending';
    const notes = req.body.notes ? String(req.body.notes).trim() : null;

    const results = req.body.results || [];
    if (!Array.isArray(results) || results.length === 0) throw badRequest('Inspection results are required');

    let inspectionId;
    try {
      await mssqlTransaction('DEFAULT', async (tx) => {
        // Document Type code for Quality Inspection
        const documentNo = await documentService.generateDocumentNumber(tx, 'QC', branchId, inspectionDate);

        const headerReq = new sql.Request(tx);
        headerReq.input('docNo', sql.NVarChar(50), documentNo);
        headerReq.input('branchId', sql.Int, branchId);
        headerReq.input('refType', sql.NVarChar(30), referenceType);
        headerReq.input('refId', sql.Int, referenceId);
        headerReq.input('itemId', sql.Int, itemId);
        headerReq.input('lotId', sql.BigInt, lotId);
        headerReq.input('inspectorId', sql.Int, userId);
        headerReq.input('inspectionDate', sql.Date, inspectionDate);
        headerReq.input('overallResult', sql.NVarChar(30), overallResult);
        headerReq.input('notes', sql.NVarChar(1000), notes);

        const headerRes = await headerReq.query(`
          INSERT INTO dbo.QualityInspections (
            DocumentNo, BranchId, ReferenceType, ReferenceId, ItemId, LotId, 
            InspectorId, InspectionDate, OverallResult, Notes
          ) OUTPUT INSERTED.InspectionId
          VALUES (
            @docNo, @branchId, @refType, @refId, @itemId, @lotId, 
            @inspectorId, @inspectionDate, @overallResult, @notes
          )
        `);
        inspectionId = headerRes.recordset[0].InspectionId;

        for (const idx in results) {
          const resObj = results[idx];
          const lineReq = new sql.Request(tx);
          lineReq.input('qiId', sql.Int, inspectionId);
          lineReq.input('specId', sql.Int, parseId(resObj.qualitySpecId, `results[${idx}].qualitySpecId`));
          lineReq.input('paramName', sql.NVarChar(100), String(resObj.parameterName).trim());
          lineReq.input('expected', sql.NVarChar(255), resObj.expectedValue ? String(resObj.expectedValue) : null);
          lineReq.input('actual', sql.NVarChar(255), resObj.actualValue ? String(resObj.actualValue) : null);
          lineReq.input('isPassed', sql.Bit, parseBool(resObj.isPassed));
          lineReq.input('notes', sql.NVarChar(1000), resObj.notes ? String(resObj.notes) : null);

          await lineReq.query(`
            INSERT INTO dbo.QualityInspectionResults (
              InspectionId, QualitySpecId, ParameterName, ExpectedValue, ActualValue, IsPassed, Notes
            ) VALUES (
              @qiId, @specId, @paramName, @expected, @actual, @isPassed, @notes
            )
          `);
        }
      });
    } catch (e) {
      if (e.message && e.message.includes('Document Series')) {
        e.status = 400;
      }
      throw e;
    }

    res.status(201).json({ id: inspectionId, message: 'Quality Inspection recorded successfully' });
  })
);

export default router;
