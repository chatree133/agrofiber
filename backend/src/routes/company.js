import { Router } from 'express';
import { mssqlQuery, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logRequestAudit } from '../lib/auditLogger.js';

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
    latitude: row.Latitude,
    longitude: row.Longitude,
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

function mapSmtpSettings(row) {
  return {
    smtpSettingId: row.SmtpSettingId,
    smtpHost: row.SmtpHost,
    smtpPort: row.SmtpPort,
    smtpUser: row.SmtpUser,
    smtpPassword: row.SmtpPassword,
    smtpSender: row.SmtpSender,
    isActive: Boolean(row.IsActive),
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
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
  '/smtp-settings',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.SmtpSettings
      ORDER BY SmtpSettingId DESC
    `);

    res.json({
      data: rows.map(mapSmtpSettings),
    });
  }),
);

router.get(
  '/smtp-settings/:id',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.SmtpSettings
      WHERE SmtpSettingId = @id
    `, {
      inputs: {
        id: { type: sql.Int, value: Number(req.params.id) },
      },
    });

    if (!rows.length) {
      return res.status(404).json({ message: 'SMTP settings not found' });
    }

    res.json({ data: mapSmtpSettings(rows[0]) });
  }),
);

router.post(
  '/smtp-settings',
  asyncHandler(async (req, res) => {
    const {
      smtpHost,
      smtpPort = 587,
      smtpUser,
      smtpPassword,
      smtpSender,
      isActive = true,
    } = req.body;

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpSender) {
      return res.status(400).json({
        message: 'smtpHost, smtpUser, smtpPassword, and smtpSender are required',
      });
    }

    const rows = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.SmtpSettings (
        SmtpHost,
        SmtpPort,
        SmtpUser,
        SmtpPassword,
        SmtpSender,
        IsActive
      )
      OUTPUT inserted.*
      VALUES (
        @smtpHost,
        @smtpPort,
        @smtpUser,
        @smtpPassword,
        @smtpSender,
        @isActive
      )
    `, {
      inputs: {
        smtpHost: { type: sql.NVarChar(255), value: smtpHost },
        smtpPort: { type: sql.Int, value: Number(smtpPort) },
        smtpUser: { type: sql.NVarChar(255), value: smtpUser },
        smtpPassword: { type: sql.NVarChar(255), value: smtpPassword },
        smtpSender: { type: sql.NVarChar(255), value: smtpSender },
        isActive: { type: sql.Bit, value: Boolean(isActive) },
      },
    });

    res.status(201).json({ data: mapSmtpSettings(rows[0]) });
  }),
);

router.put(
  '/smtp-settings/:id',
  asyncHandler(async (req, res) => {
    const updates = [];
    const inputs = {
      id: { type: sql.Int, value: Number(req.params.id) },
    };

    const {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpSender,
      isActive,
    } = req.body;

    if (smtpHost !== undefined) {
      updates.push('SmtpHost = @smtpHost');
      inputs.smtpHost = { type: sql.NVarChar(255), value: smtpHost };
    }
    if (smtpPort !== undefined) {
      updates.push('SmtpPort = @smtpPort');
      inputs.smtpPort = { type: sql.Int, value: Number(smtpPort) };
    }
    if (smtpUser !== undefined) {
      updates.push('SmtpUser = @smtpUser');
      inputs.smtpUser = { type: sql.NVarChar(255), value: smtpUser };
    }
    if (smtpPassword !== undefined) {
      updates.push('SmtpPassword = @smtpPassword');
      inputs.smtpPassword = { type: sql.NVarChar(255), value: smtpPassword };
    }
    if (smtpSender !== undefined) {
      updates.push('SmtpSender = @smtpSender');
      inputs.smtpSender = { type: sql.NVarChar(255), value: smtpSender };
    }
    if (isActive !== undefined) {
      updates.push('IsActive = @isActive');
      inputs.isActive = { type: sql.Bit, value: Boolean(isActive) };
    }
    if (updates.length === 0) {
      updates.push('UpdatedAt = @updatedAt');
      inputs.updatedAt = { type: sql.DateTime2, value: new Date() };
    } else {
      updates.push('UpdatedAt = @updatedAt');
      inputs.updatedAt = { type: sql.DateTime2, value: new Date() };
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.SmtpSettings
      SET ${updates.join(', ')}
      OUTPUT inserted.*
      WHERE SmtpSettingId = @id
    `, { inputs });

    if (!rows.length) {
      return res.status(404).json({ message: 'SMTP settings not found' });
    }

    res.json({ data: mapSmtpSettings(rows[0]) });
  }),
);

router.delete(
  '/smtp-settings/:id',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.SmtpSettings
      SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
      OUTPUT inserted.*
      WHERE SmtpSettingId = @id
    `, {
      inputs: {
        id: { type: sql.Int, value: Number(req.params.id) },
      },
    });

    if (!rows.length) {
      return res.status(404).json({ message: 'SMTP settings not found' });
    }

    res.json({ message: 'SMTP settings deactivated', data: mapSmtpSettings(rows[0]) });
  }),
);

// System Settings (Generic key-value store)
function mapSystemSetting(row) {
  return {
    settingKey: row.SettingKey,
    settingValue: row.SettingValue,
    settingGroup: row.SettingGroup,
    description: row.Description,
    updatedAt: row.UpdatedAt,
    updatedBy: row.UpdatedBy,
  };
}

router.get(
  '/system-settings',
  asyncHandler(async (req, res) => {
    const group = req.query.group || null;

    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.SystemSettings
      WHERE (@group IS NULL OR SettingGroup = @group)
      ORDER BY SettingKey
    `, {
      inputs: {
        group: { type: sql.NVarChar(50), value: group },
      },
    });

    res.json({
      data: rows.map(mapSystemSetting),
    });
  }),
);

router.put(
  '/system-settings',
  asyncHandler(async (req, res) => {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ message: 'settings must be an array of key-value pairs' });
    }

    const updatedSettings = [];

    for (const item of settings) {
      const { settingKey, settingValue, settingGroup = null } = item;

      if (!settingKey) {
        continue;
      }

      const rows = await mssqlQuery('DEFAULT', `
        IF EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = @settingKey)
        BEGIN
            UPDATE dbo.SystemSettings
            SET SettingValue = @settingValue, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
            OUTPUT inserted.*
            WHERE SettingKey = @settingKey;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, SettingGroup, UpdatedBy)
            OUTPUT inserted.*
            VALUES (@settingKey, @settingValue, ISNULL(@settingGroup, 'General'), @updatedBy);
        END
      `, {
        inputs: {
          settingKey: { type: sql.VarChar(100), value: settingKey },
          settingValue: { type: sql.NVarChar(sql.MAX), value: settingValue !== undefined ? String(settingValue) : null },
          settingGroup: { type: sql.VarChar(50), value: settingGroup },
          updatedBy: { type: sql.NVarChar(100), value: req.user?.username || 'admin' },
        },
      });

      if (rows.length > 0) {
        updatedSettings.push(mapSystemSetting(rows[0]));
      }
    }

    await logRequestAudit(req, {
      module: 'Settings',
      actionType: 'Update',
      description: 'Updated system configurations',
      newValues: settings
    });

    res.json({
      message: 'System settings updated successfully',
      data: updatedSettings,
    });
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
      latitude = null,
      longitude = null,
      isHeadOffice = false,
      isActive = true,
    } = req.body;

    if (!branchCode || !branchName) {
      res.status(400).json({
        message: 'branchCode and branchName are required',
      });
      return;
    }

    const parseLatLng = (val) => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const rows = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.Branches (
        CompanyId,
        BranchCode,
        BranchName,
        TaxBranchCode,
        Address,
        Latitude,
        Longitude,
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
        @latitude,
        @longitude,
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
        latitude: {
          type: sql.Decimal(18, 10),
          value: parseLatLng(latitude),
        },
        longitude: {
          type: sql.Decimal(18, 10),
          value: parseLatLng(longitude),
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
      latitude,
      longitude,
      isHeadOffice,
      isActive,
    } = req.body;

    const parseLatLng = (val) => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

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
    if (latitude !== undefined) {
      updates.push('Latitude = @latitude');
      inputs.latitude = { type: sql.Decimal(18, 10), value: parseLatLng(latitude) };
    }
    if (longitude !== undefined) {
      updates.push('Longitude = @longitude');
      inputs.longitude = { type: sql.Decimal(18, 10), value: parseLatLng(longitude) };
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