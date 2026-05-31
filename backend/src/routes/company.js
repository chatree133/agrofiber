import { Router } from 'express';
import { mssqlQuery, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);
router.use(allowRoles('admin'));

function mapCompany(row) {
  return {
    companyId: row.CompanyId,
    companyCode: row.CompanyCode,
    companyName: row.CompanyName,
    taxId: row.TaxId,
    address: row.Address,
    phone: row.Phone,
    email: row.Email,
    isActive: Boolean(row.IsActive),
    createdAt: row.CreatedAt,
  };
}

function mapBranch(row) {
  return {
    branchId: row.BranchId,
    companyId: row.CompanyId,
    branchCode: row.BranchCode,
    branchName: row.BranchName,
    taxBranchCode: row.TaxBranchCode,
    address: row.Address,
    isHeadOffice: Boolean(row.IsHeadOffice),
    isActive: Boolean(row.IsActive),
  };
}

function mapDocumentSeries(row) {
  return {
    documentSeriesId: row.DocumentSeriesId,
    documentType: row.DocumentType,
    seriesCode: row.SeriesCode,
    branchId: row.BranchId,
    branchCode: row.BranchCode,
    branchName: row.BranchName,
    prefixFormat: row.PrefixFormat,
    paddingLength: row.PaddingLength,
    resetFrequency: row.ResetFrequency,
    isActive: Boolean(row.IsActive),
  };
}

router.get(
  '/document-series',
  asyncHandler(async (req, res) => {
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const rows = await mssqlQuery('DEFAULT', `
      SELECT ds.*, b.BranchCode, b.BranchName, b.CompanyId
      FROM dbo.DocumentSeries ds
      LEFT JOIN dbo.Branches b ON b.BranchId = ds.BranchId
      WHERE (@companyId IS NULL OR b.CompanyId = @companyId)
      ORDER BY ds.DocumentType, ds.SeriesCode, b.BranchName
    `, {
      inputs: {
        companyId: { type: sql.Int, value: companyId },
      },
    });

    res.json({
      data: rows.map(mapDocumentSeries),
    });
  }),
);

router.get(
  '/document-series/:id',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT ds.*, b.BranchCode, b.BranchName, b.CompanyId
      FROM dbo.DocumentSeries ds
      LEFT JOIN dbo.Branches b ON b.BranchId = ds.BranchId
      WHERE ds.DocumentSeriesId = @id
    `, {
      inputs: {
        id: { type: sql.Int, value: Number(req.params.id) },
      },
    });

    if (!rows.length) {
      res.status(404).json({ message: 'Document series not found' });
      return;
    }

    res.json({ data: mapDocumentSeries(rows[0]) });
  }),
);

router.post(
  '/document-series',
  asyncHandler(async (req, res) => {
    const {
      documentType,
      seriesCode,
      branchId = null,
      prefixFormat,
      paddingLength = 4,
      resetFrequency = 'yearly',
      isActive = true,
    } = req.body;

    if (!documentType || !seriesCode || !prefixFormat) {
      return res.status(400).json({ message: 'documentType, seriesCode, and prefixFormat are required' });
    }

    const resetValue = normalizeEnum(resetFrequency, ['never', 'yearly', 'monthly', 'daily'], 'resetFrequency');

    const rows = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.DocumentSeries (
        DocumentType,
        SeriesCode,
        BranchId,
        PrefixFormat,
        PaddingLength,
        ResetFrequency,
        IsActive
      )
      OUTPUT inserted.*
      VALUES (
        @documentType,
        @seriesCode,
        @branchId,
        @prefixFormat,
        @paddingLength,
        @resetFrequency,
        @isActive
      )
    `, {
      inputs: {
        documentType: { type: sql.NVarChar(40), value: documentType },
        seriesCode: { type: sql.NVarChar(30), value: seriesCode },
        branchId: { type: sql.Int, value: branchId },
        prefixFormat: { type: sql.NVarChar(50), value: prefixFormat },
        paddingLength: { type: sql.Int, value: Number(paddingLength) },
        resetFrequency: { type: sql.NVarChar(20), value: resetValue },
        isActive: { type: sql.Bit, value: Boolean(isActive) },
      },
    });

    res.status(201).json({ data: mapDocumentSeries(rows[0]) });
  }),
);

router.put(
  '/document-series/:id',
  asyncHandler(async (req, res) => {
    const updates = [];
    const inputs = {
      id: { type: sql.Int, value: Number(req.params.id) },
    };

    const {
      documentType,
      seriesCode,
      branchId,
      prefixFormat,
      paddingLength,
      resetFrequency,
      isActive,
    } = req.body;

    if (documentType !== undefined) {
      updates.push('DocumentType = @documentType');
      inputs.documentType = { type: sql.NVarChar(40), value: documentType };
    }
    if (seriesCode !== undefined) {
      updates.push('SeriesCode = @seriesCode');
      inputs.seriesCode = { type: sql.NVarChar(30), value: seriesCode };
    }
    if (branchId !== undefined) {
      updates.push('BranchId = @branchId');
      inputs.branchId = { type: sql.Int, value: branchId ?? null };
    }
    if (prefixFormat !== undefined) {
      updates.push('PrefixFormat = @prefixFormat');
      inputs.prefixFormat = { type: sql.NVarChar(50), value: prefixFormat };
    }
    if (paddingLength !== undefined) {
      updates.push('PaddingLength = @paddingLength');
      inputs.paddingLength = { type: sql.Int, value: Number(paddingLength) };
    }
    if (resetFrequency !== undefined) {
      const resetValue = normalizeEnum(resetFrequency, ['never', 'yearly', 'monthly', 'daily'], 'resetFrequency');
      updates.push('ResetFrequency = @resetFrequency');
      inputs.resetFrequency = { type: sql.NVarChar(20), value: resetValue };
    }
    if (isActive !== undefined) {
      updates.push('IsActive = @isActive');
      inputs.isActive = { type: sql.Bit, value: Boolean(isActive) };
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.DocumentSeries
      SET ${updates.join(', ')}
      OUTPUT inserted.*
      WHERE DocumentSeriesId = @id
    `, { inputs });

    if (!rows.length) {
      return res.status(404).json({ message: 'Document series not found' });
    }

    res.json({ data: mapDocumentSeries(rows[0]) });
  }),
);

router.delete(
  '/document-series/:id',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.DocumentSeries
      SET IsActive = 0
      OUTPUT inserted.*
      WHERE DocumentSeriesId = @id
    `, {
      inputs: {
        id: { type: sql.Int, value: Number(req.params.id) },
      },
    });

    if (!rows.length) {
      return res.status(404).json({ message: 'Document series not found' });
    }

    res.json({ message: 'Document series deactivated', data: mapDocumentSeries(rows[0]) });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.Companies
      ORDER BY CompanyCode
    `);

    res.json({
      data: rows.map(mapCompany),
    });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      companyCode,
      companyName,
      taxId = null,
      address = null,
      phone = null,
      email = null,
      isActive = true,
    } = req.body;

    if (!companyCode || !companyName) {
      res.status(400).json({
        message: 'companyCode and companyName are required',
      });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.Companies (
        CompanyCode,
        CompanyName,
        TaxId,
        Address,
        Phone,
        Email,
        IsActive
      )
      OUTPUT inserted.*
      VALUES (
        @companyCode,
        @companyName,
        @taxId,
        @address,
        @phone,
        @email,
        @isActive
      )
    `, {
      inputs: {
        companyCode: { type: sql.NVarChar(30), value: companyCode },
        companyName: { type: sql.NVarChar(255), value: companyName },
        taxId: { type: sql.NVarChar(50), value: taxId },
        address: { type: sql.NVarChar(1000), value: address },
        phone: { type: sql.NVarChar(50), value: phone },
        email: { type: sql.NVarChar(255), value: email },
        isActive: { type: sql.Bit, value: Boolean(isActive) },
      },
    });

    res.status(201).json({
      data: mapCompany(rows[0]),
    });
  }),
);

router.get(
  '/:companyId',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.Companies
      WHERE CompanyId = @companyId
    `, {
      inputs: {
        companyId: {
          type: sql.Int,
          value: Number(req.params.companyId),
        },
      },
    });

    if (!rows.length) {
      res.status(404).json({
        message: 'Company not found',
      });
      return;
    }

    res.json({
      data: mapCompany(rows[0]),
    });
  }),
);

router.put(
  '/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = Number(req.params.companyId);

    const {
      companyCode,
      companyName,
      taxId,
      address,
      phone,
      email,
      isActive,
    } = req.body;

    const updates = [];
    const inputs = {
      companyId: {
        type: sql.Int,
        value: companyId,
      },
    };

    if (companyCode !== undefined) {
      updates.push('CompanyCode = @companyCode');
      inputs.companyCode = {
        type: sql.NVarChar(30),
        value: companyCode,
      };
    }

    if (companyName !== undefined) {
      updates.push('CompanyName = @companyName');
      inputs.companyName = {
        type: sql.NVarChar(255),
        value: companyName,
      };
    }

    if (taxId !== undefined) {
      updates.push('TaxId = @taxId');
      inputs.taxId = {
        type: sql.NVarChar(50),
        value: taxId,
      };
    }

    if (address !== undefined) {
      updates.push('Address = @address');
      inputs.address = {
        type: sql.NVarChar(1000),
        value: address,
      };
    }

    if (phone !== undefined) {
      updates.push('Phone = @phone');
      inputs.phone = {
        type: sql.NVarChar(50),
        value: phone,
      };
    }

    if (email !== undefined) {
      updates.push('Email = @email');
      inputs.email = {
        type: sql.NVarChar(255),
        value: email,
      };
    }

    if (isActive !== undefined) {
      updates.push('IsActive = @isActive');
      inputs.isActive = {
        type: sql.Bit,
        value: Boolean(isActive),
      };
    }

    if (!updates.length) {
      res.status(400).json({
        message: 'No fields to update',
      });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Companies
      SET ${updates.join(', ')}
      OUTPUT inserted.*
      WHERE CompanyId = @companyId
    `, {
      inputs,
    });

    if (!rows.length) {
      res.status(404).json({
        message: 'Company not found',
      });
      return;
    }

    res.json({
      data: mapCompany(rows[0]),
    });
  }),
);

router.get(
  '/:companyId/branches',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.Branches
      WHERE CompanyId = @companyId
      ORDER BY BranchCode
    `, {
      inputs: {
        companyId: {
          type: sql.Int,
          value: Number(req.params.companyId),
        },
      },
    });

    res.json({
      data: rows.map(mapBranch),
    });
  }),
);

router.post(
  '/:companyId/branches',
  asyncHandler(async (req, res) => {
    const companyId = Number(req.params.companyId);

    const {
      branchCode,
      branchName,
      taxBranchCode = null,
      address = null,
      isHeadOffice = false,
      isActive = true,
    } = req.body;

    if (!branchCode || !branchName) {
      res.status(400).json({
        message: 'branchCode and branchName are required',
      });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.Branches (
        CompanyId,
        BranchCode,
        BranchName,
        TaxBranchCode,
        Address,
        IsHeadOffice,
        IsActive
      )
      OUTPUT inserted.*
      VALUES (
        @companyId,
        @branchCode,
        @branchName,
        @taxBranchCode,
        @address,
        @isHeadOffice,
        @isActive
      )
    `, {
      inputs: {
        companyId: {
          type: sql.Int,
          value: companyId,
        },
        branchCode: {
          type: sql.NVarChar(30),
          value: branchCode,
        },
        branchName: {
          type: sql.NVarChar(255),
          value: branchName,
        },
        taxBranchCode: {
          type: sql.NVarChar(30),
          value: taxBranchCode,
        },
        address: {
          type: sql.NVarChar(1000),
          value: address,
        },
        isHeadOffice: {
          type: sql.Bit,
          value: Boolean(isHeadOffice),
        },
        isActive: {
          type: sql.Bit,
          value: Boolean(isActive),
        },
      },
    });

    res.status(201).json({
      data: mapBranch(rows[0]),
    });
  }),
);

router.put(
  '/:companyId/branches/:branchId',
  asyncHandler(async (req, res) => {
    const {
      branchCode,
      branchName,
      taxBranchCode,
      address,
      isHeadOffice,
      isActive,
    } = req.body;

    const updates = [];
    const inputs = {
      companyId: { type: sql.Int, value: Number(req.params.companyId) },
      branchId: { type: sql.Int, value: Number(req.params.branchId) },
    };

    if (branchCode !== undefined) {
      updates.push('BranchCode = @branchCode');
      inputs.branchCode = { type: sql.NVarChar(30), value: branchCode };
    }
    if (branchName !== undefined) {
      updates.push('BranchName = @branchName');
      inputs.branchName = { type: sql.NVarChar(255), value: branchName };
    }
    if (taxBranchCode !== undefined) {
      updates.push('TaxBranchCode = @taxBranchCode');
      inputs.taxBranchCode = { type: sql.NVarChar(30), value: taxBranchCode };
    }
    if (address !== undefined) {
      updates.push('Address = @address');
      inputs.address = { type: sql.NVarChar(1000), value: address };
    }
    if (isHeadOffice !== undefined) {
      updates.push('IsHeadOffice = @isHeadOffice');
      inputs.isHeadOffice = { type: sql.Bit, value: Boolean(isHeadOffice) };
    }
    if (isActive !== undefined) {
      updates.push('IsActive = @isActive');
      inputs.isActive = { type: sql.Bit, value: Boolean(isActive) };
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Branches
      SET ${updates.join(', ')}
      OUTPUT inserted.*
      WHERE CompanyId = @companyId AND BranchId = @branchId
    `, { inputs });

    if (!rows.length) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    res.json({ data: mapBranch(rows[0]) });
  }),
);

router.delete(
  '/:companyId/branches/:branchId',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Branches
      SET IsActive = 0
      OUTPUT inserted.*
      WHERE CompanyId = @companyId AND BranchId = @branchId
    `, {
      inputs: {
        companyId: { type: sql.Int, value: Number(req.params.companyId) },
        branchId: { type: sql.Int, value: Number(req.params.branchId) },
      },
    });

    if (!rows.length) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    res.json({ message: 'Branch soft-deleted', data: mapBranch(rows[0]) });
  }),
);

export default router;