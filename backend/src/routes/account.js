import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getMssqlPool, mssqlQuery, sql } from '../lib/mssql.js';
import emailService from '../services/common/emailService.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const avatarUploadDir = path.resolve('uploads/avatars');

router.use(authenticate);
router.use(allowRoles('admin'));

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return [];

  return [
    ...new Set(
      roles
        .map((role) => {
          if (typeof role === 'number') return { roleId: role };
          if (typeof role === 'string') return { roleCode: role.trim() };
          if (role?.roleId) return { roleId: Number(role.roleId) };
          if (role?.id) return { roleId: Number(role.id) };
          if (role?.roleCode) return { roleCode: String(role.roleCode).trim() };
          if (role?.code) return { roleCode: String(role.code).trim() };
          return null;
        })
        .filter(Boolean)
        .map((role) => JSON.stringify(role)),
    ),
  ].map((role) => JSON.parse(role));
}

function requireRoles(roles) {
  const normalizedRoles = normalizeRoles(roles);
  if (!normalizedRoles.length) {
    const error = new Error('At least one role is required');
    error.status = 400;
    throw error;
  }
  if (
    normalizedRoles.some(
      (role) =>
        (role.roleId !== undefined && (!Number.isInteger(role.roleId) || role.roleId <= 0)) ||
        (role.roleCode !== undefined && !role.roleCode),
    )
  ) {
    const error = new Error('Invalid role value');
    error.status = 400;
    throw error;
  }
  return normalizedRoles;
}

async function resolveRoleIds(db, roles) {
  const normalizedRoles = requireRoles(roles);
  const roleIds = normalizedRoles.filter((role) => role.roleId).map((role) => role.roleId);
  const roleCodes = normalizedRoles.filter((role) => role.roleCode).map((role) => role.roleCode);

  const conditions = [];
  const request = db.request();

  roleIds.forEach((roleId, index) => {
    request.input(`roleId${index}`, sql.Int, roleId);
    conditions.push(`RoleId = @roleId${index}`);
  });

  roleCodes.forEach((roleCode, index) => {
    request.input(`roleCode${index}`, sql.NVarChar(50), roleCode);
    conditions.push(`RoleCode = @roleCode${index}`);
  });

  const result = await request.query(`
    SELECT RoleId
    FROM dbo.Roles
    WHERE ${conditions.join(' OR ')}
  `);

  const resolvedRoleIds = result.recordset.map((role) => role.RoleId);
  if (resolvedRoleIds.length !== normalizedRoles.length) {
    const error = new Error('One or more roles do not exist');
    error.status = 400;
    throw error;
  }

  return resolvedRoleIds;
}

function parseList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : String(value).split(',');
}

async function saveAvatarDataUrl(dataUrl) {
  if (!dataUrl) return undefined;

  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    const error = new Error('Avatar must be a PNG, JPG or JPEG image');
    error.status = 400;
    throw error;
  }

  const extension = match[1].toLowerCase() === 'png' ? 'png' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 2 * 1024 * 1024) {
    const error = new Error('Avatar image must be 2MB or smaller');
    error.status = 400;
    throw error;
  }

  await fs.mkdir(avatarUploadDir, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(avatarUploadDir, fileName), buffer);

  return `/uploads/avatars/${fileName}`;
}

function mapUsers(rows) {
  const users = new Map();

  rows.forEach((row) => {
    if (!users.has(row.UserId)) {
      users.set(row.UserId, {
        id: row.UserId,
        username: row.Username,
        staffId: row.StaffId,
        displayName: row.DisplayName,
        jobTitle: row.JobTitle,
        email: row.Email,
        avatarUrl: row.AvatarUrl,
        isActive: Boolean(row.IsActive),
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
        roles: [],
      });
    }

    if (row.RoleId) {
      users.get(row.UserId).roles.push({
        id: row.RoleId,
        code: row.RoleCode,
        name: row.RoleName,
      });
    }
  });

  return Array.from(users.values());
}

async function getUsers(whereClause = '', inputs = {}) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      u.UserId,
      u.Username,
      u.StaffId,
      u.DisplayName,
      u.JobTitle,
      u.Email,
      u.AvatarUrl,
      u.IsActive,
      u.CreatedAt,
      u.UpdatedAt,
      r.RoleId,
      r.RoleCode,
      r.RoleName
    FROM dbo.Users u
    LEFT JOIN dbo.UserRoles ur ON ur.UserId = u.UserId AND ur.IsActive = 1
    LEFT JOIN dbo.Roles r ON r.RoleId = ur.RoleId
    ${whereClause}
    ORDER BY u.UserId, r.RoleCode
  `, { inputs });

  return mapUsers(rows);
}

function buildAccountFilters(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 100);
  const conditions = [];
  const inputs = {};

  if (query.search) {
    conditions.push(`(
      u.Username LIKE @search OR
      u.StaffId LIKE @search OR
      u.DisplayName LIKE @search OR
      u.Email LIKE @search
    )`);
    inputs.search = { type: sql.NVarChar(255), value: `%${query.search}%` };
  }

  if (query.createdFrom) {
    conditions.push('u.CreatedAt >= @createdFrom');
    inputs.createdFrom = { type: sql.DateTime2, value: new Date(query.createdFrom) };
  }

  if (query.createdTo) {
    conditions.push('u.CreatedAt < DATEADD(day, 1, @createdTo)');
    inputs.createdTo = { type: sql.DateTime2, value: new Date(query.createdTo) };
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    conditions.push('u.IsActive = @isActive');
    inputs.isActive = { type: sql.Bit, value: String(query.isActive) === 'true' || String(query.isActive) === '1' };
  }

  const roleIds = parseList(query.roleIds).map(Number).filter((value) => Number.isInteger(value) && value > 0);
  const roleCodes = parseList(query.roleCodes).map((value) => String(value).trim()).filter(Boolean);
  const roleConditions = [];

  roleIds.forEach((roleId, index) => {
    inputs[`filterRoleId${index}`] = { type: sql.Int, value: roleId };
    roleConditions.push(`rFilter.RoleId = @filterRoleId${index}`);
  });

  roleCodes.forEach((roleCode, index) => {
    inputs[`filterRoleCode${index}`] = { type: sql.NVarChar(50), value: roleCode };
    roleConditions.push(`rFilter.RoleCode = @filterRoleCode${index}`);
  });

  if (roleConditions.length) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM dbo.UserRoles urFilter
      JOIN dbo.Roles rFilter ON rFilter.RoleId = urFilter.RoleId
      WHERE urFilter.UserId = u.UserId AND urFilter.IsActive = 1
        AND (${roleConditions.join(' OR ')})
    )`);
  }

  return {
    page,
    pageSize,
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    inputs,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, whereSql, inputs } = buildAccountFilters(req.query);
    const offset = (page - 1) * pageSize;
    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredUsers AS (
        SELECT u.UserId
        FROM dbo.Users u
        ${whereSql}
      ),
      PagedUsers AS (
        SELECT UserId
        FROM FilteredUsers
        ORDER BY UserId
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      )
      SELECT
        u.UserId,
        u.Username,
        u.StaffId,
        u.DisplayName,
        u.JobTitle,
        u.Email,
        u.AvatarUrl,
        u.IsActive,
        u.CreatedAt,
        u.UpdatedAt,
        r.RoleId,
        r.RoleCode,
        r.RoleName,
        (SELECT COUNT(1) FROM FilteredUsers) AS TotalCount
      FROM PagedUsers pu
      JOIN dbo.Users u ON u.UserId = pu.UserId
      LEFT JOIN dbo.UserRoles ur ON ur.UserId = u.UserId AND ur.IsActive = 1
      LEFT JOIN dbo.Roles r ON r.RoleId = ur.RoleId
      ORDER BY u.UserId, r.RoleCode
    `, {
      inputs: {
        ...inputs,
        offset: { type: sql.Int, value: offset },
        pageSize: { type: sql.Int, value: pageSize },
      },
    });

    res.json({
      data: mapUsers(rows),
      pagination: {
        page,
        pageSize,
        total: rows[0]?.TotalCount || 0,
      },
    });
  }),
);

router.get(
  '/roles',
  asyncHandler(async (_req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT RoleId AS id, RoleCode AS code, RoleName AS name
      FROM dbo.Roles
      WHERE IsActive = 1
      ORDER BY RoleCode
    `);

    res.json({ data: rows });
  }),
);

router.get(
  '/roles/:id',
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      res.status(400).json({ message: 'Invalid role id' });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      SELECT RoleId AS id, RoleCode AS code, RoleName AS name
      FROM dbo.Roles
      WHERE RoleId = @roleId AND IsActive = 1
    `, {
      inputs: {
        roleId: { type: sql.Int, value: roleId },
      },
    });

    if (!rows.length) {
      res.status(404).json({ message: 'Role not found' });
      return;
    }

    res.json({ data: rows[0] });
  }),
);

router.post(
  '/roles',
  asyncHandler(async (req, res) => {
    const roleCode = String(req.body.roleCode || '').trim();
    const roleName = String(req.body.roleName || '').trim();

    if (!roleCode || !roleName) {
      res.status(400).json({ message: 'roleCode and roleName are required' });
      return;
    }

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const insertResult = await transaction
        .request()
        .input('roleCode', sql.NVarChar(50), roleCode)
        .input('roleName', sql.NVarChar(100), roleName)
        .query(`
          INSERT INTO dbo.Roles (RoleCode, RoleName)
          OUTPUT inserted.RoleId
          VALUES (@roleCode, @roleName)
        `);

      const roleId = insertResult.recordset[0].RoleId;
      await transaction.commit();

      const rows = await mssqlQuery('DEFAULT', `
        SELECT RoleId AS id, RoleCode AS code, RoleName AS name
        FROM dbo.Roles
        WHERE RoleId = @roleId
      `, {
        inputs: { roleId: { type: sql.Int, value: roleId } },
      });

      res.status(201).json({ data: rows[0] });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.put(
  '/roles/:id',
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    const roleCode = req.body.roleCode !== undefined ? String(req.body.roleCode).trim() : undefined;
    const roleName = req.body.roleName !== undefined ? String(req.body.roleName).trim() : undefined;

    if (!Number.isInteger(roleId) || roleId <= 0) {
      res.status(400).json({ message: 'Invalid role id' });
      return;
    }
    if (roleCode === undefined && roleName === undefined) {
      res.status(400).json({ message: 'roleCode or roleName is required' });
      return;
    }

    const updates = [];
    const request = (await getMssqlPool('DEFAULT')).request().input('roleId', sql.Int, roleId);

    if (roleCode !== undefined) {
      if (!roleCode) {
        res.status(400).json({ message: 'roleCode cannot be empty' });
        return;
      }
      request.input('roleCode', sql.NVarChar(50), roleCode);
      updates.push('RoleCode = @roleCode');
    }
    if (roleName !== undefined) {
      if (!roleName) {
        res.status(400).json({ message: 'roleName cannot be empty' });
        return;
      }
      request.input('roleName', sql.NVarChar(100), roleName);
      updates.push('RoleName = @roleName');
    }

    const result = await request.query(`
      UPDATE dbo.Roles
      SET ${updates.join(', ')}
      WHERE RoleId = @roleId
      SELECT @@ROWCOUNT AS affected
    `);

    if (!result.recordset[0]?.affected) {
      res.status(404).json({ message: 'Role not found' });
      return;
    }

    const updatedRows = await mssqlQuery('DEFAULT', `
      SELECT RoleId AS id, RoleCode AS code, RoleName AS name
      FROM dbo.Roles
      WHERE RoleId = @roleId
    `, {
      inputs: { roleId: { type: sql.Int, value: roleId } },
    });

    res.json({ data: updatedRows[0] });
  }),
);

router.delete(
  '/roles/:id',
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      res.status(400).json({ message: 'Invalid role id' });
      return;
    }

    const result = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Roles
      SET IsActive = 0
      WHERE RoleId = @roleId AND IsActive = 1
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: { roleId: { type: sql.Int, value: roleId } },
    });

    if (!result[0]?.affected) {
      res.status(404).json({ message: 'Role not found' });
      return;
    }

    res.status(204).send();
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const users = await getUsers('WHERE u.UserId = @userId', {
      userId: { type: sql.Int, value: Number(req.params.id) },
    });

    if (!users.length) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: users[0] });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      username,
      staffId,
      password,
      displayName,
      jobTitle = null,
      email = null,
      avatarUrl = null,
      avatarDataUrl = null,
      isActive = true,
      roles,
    } = req.body;

    if (!username || !staffId || !password || !displayName) {
      res.status(400).json({ message: 'username, staffId, password and displayName are required' });
      return;
    }

    requireRoles(roles);

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const roleIds = await resolveRoleIds(transaction, roles);
      const savedAvatarUrl = await saveAvatarDataUrl(avatarDataUrl);
      const passwordHash = await bcrypt.hash(password, 10);

      const createResult = await transaction
        .request()
        .input('username', sql.NVarChar(100), username)
        .input('staffId', sql.NVarChar(100), staffId)
        .input('passwordHash', sql.NVarChar(255), passwordHash)
        .input('displayName', sql.NVarChar(200), displayName)
        .input('jobTitle', sql.NVarChar(100), jobTitle)
        .input('email', sql.NVarChar(255), email)
        .input('avatarUrl', sql.NVarChar(500), savedAvatarUrl || avatarUrl)
        .input('isActive', sql.Bit, Boolean(isActive)).query(`
          INSERT INTO dbo.Users (
            Username,
            StaffId,
            PasswordHash,
            DisplayName,
            JobTitle,
            Email,
            AvatarUrl,
            IsActive
          )
          OUTPUT inserted.UserId
          VALUES (
            @username,
            @staffId,
            @passwordHash,
            @displayName,
            @jobTitle,
            @email,
            @avatarUrl,
            @isActive
          )
        `);

      const userId = createResult.recordset[0].UserId;
      for (const roleId of roleIds) {
        await transaction
          .request()
          .input('userId', sql.Int, userId)
          .input('roleId', sql.Int, roleId)
          .query('INSERT INTO dbo.UserRoles (UserId, RoleId, IsActive) VALUES (@userId, @roleId, 1)');
      }

      await transaction.commit();

      let emailSent = false;
      if (email) {
        try {
          await emailService.sendNewAccountEmail({
            to: email,
            username,
            password,
            loginUrl: 'https://erp.agrofiber.com',
          });
          emailSent = true;
        } catch (emailError) {
          console.error('Failed to send new account email:', emailError);
        }
      }

      const [user] = await getUsers('WHERE u.UserId = @userId', {
        userId: { type: sql.Int, value: userId },
      });

      res.status(201).json({ data: user, emailSent });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const {
      username,
      staffId,
      password,
      displayName,
      jobTitle,
      email,
      avatarUrl,
      avatarDataUrl,
      isActive,
      roles,
    } = req.body;

    if (roles !== undefined) requireRoles(roles);

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const existing = await transaction
        .request()
        .input('userId', sql.Int, userId)
        .query('SELECT UserId FROM dbo.Users WHERE UserId = @userId');

      if (!existing.recordset.length) {
        await transaction.rollback();
        res.status(404).json({ message: 'User not found' });
        return;
      }

      const updates = [];
      const request = transaction.request().input('userId', sql.Int, userId);

      if (username !== undefined) {
        request.input('username', sql.NVarChar(100), username);
        updates.push('Username = @username');
      }
      if (staffId !== undefined) {
        request.input('staffId', sql.NVarChar(100), staffId);
        updates.push('StaffId = @staffId');
      }
      if (password !== undefined) {
        request.input('passwordHash', sql.NVarChar(255), await bcrypt.hash(password, 10));
        updates.push('PasswordHash = @passwordHash');
      }
      if (displayName !== undefined) {
        request.input('displayName', sql.NVarChar(200), displayName);
        updates.push('DisplayName = @displayName');
      }
      if (jobTitle !== undefined) {
        request.input('jobTitle', sql.NVarChar(100), jobTitle);
        updates.push('JobTitle = @jobTitle');
      }
      if (email !== undefined) {
        request.input('email', sql.NVarChar(255), email);
        updates.push('Email = @email');
      }
      if (avatarUrl !== undefined) {
        request.input('avatarUrl', sql.NVarChar(500), avatarUrl);
        updates.push('AvatarUrl = @avatarUrl');
      }
      if (avatarDataUrl) {
        request.input('uploadedAvatarUrl', sql.NVarChar(500), await saveAvatarDataUrl(avatarDataUrl));
        updates.push('AvatarUrl = @uploadedAvatarUrl');
      }
      if (isActive !== undefined) {
        request.input('isActive', sql.Bit, Boolean(isActive));
        updates.push('IsActive = @isActive');
      }

      if (updates.length) {
        updates.push('UpdatedAt = SYSUTCDATETIME()');
        await request.query(`
          UPDATE dbo.Users
          SET ${updates.join(', ')}
          WHERE UserId = @userId
        `);
      }

      if (roles !== undefined) {
        const roleIds = await resolveRoleIds(transaction, roles);

        await transaction
          .request()
          .input('userId', sql.Int, userId)
          .query('UPDATE dbo.UserRoles SET IsActive = 0 WHERE UserId = @userId AND IsActive = 1');

        for (const roleId of roleIds) {
          const updateResult = await transaction
            .request()
            .input('userId', sql.Int, userId)
            .input('roleId', sql.Int, roleId)
            .query(`
              UPDATE dbo.UserRoles
              SET IsActive = 1
              WHERE UserId = @userId AND RoleId = @roleId
              SELECT @@ROWCOUNT AS affected
            `);

          if (!updateResult.recordset[0]?.affected) {
            await transaction
              .request()
              .input('userId', sql.Int, userId)
              .input('roleId', sql.Int, roleId)
              .query('INSERT INTO dbo.UserRoles (UserId, RoleId, IsActive) VALUES (@userId, @roleId, 1)');
          }
        }
      }

      await transaction.commit();

      const [user] = await getUsers('WHERE u.UserId = @userId', {
        userId: { type: sql.Int, value: userId },
      });

      res.json({ data: user });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
    if (!ids.length) {
      res.status(400).json({ message: 'ids is required' });
      return;
    }

    const inputs = {};
    ids.forEach((id, index) => {
      inputs[`id${index}`] = { type: sql.Int, value: id };
    });

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Users
      SET IsActive = 0,
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserId IN (${ids.map((_, index) => `@id${index}`).join(', ')})
      SELECT @@ROWCOUNT AS affected
    `, { inputs });

    res.json({ deleted: rows[0]?.affected || 0 });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
        UPDATE dbo.Users
        SET IsActive = 0,
            UpdatedAt = SYSUTCDATETIME()
        WHERE UserId = @userId
        SELECT @@ROWCOUNT AS affected
      `, { inputs: { userId: { type: sql.Int, value: Number(req.params.id) } } });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(204).send();
  }),
);

export default router;
