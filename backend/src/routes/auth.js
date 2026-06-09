import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import bwipjs from 'bwip-js';
import { mssqlQuery, sql } from '../lib/mssql.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'Username and password are required' });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
        SELECT
          u.UserId,
          u.Username,
          u.StaffId,
          u.PasswordHash,
          u.DisplayName,
          u.JobTitle,
          u.Email,
          u.AvatarUrl,
          u.IsActive,
          r.RoleCode,
          ufm.MenuKey
        FROM dbo.Users u
        LEFT JOIN dbo.UserRoles ur ON ur.UserId = u.UserId AND ur.IsActive = 1
        LEFT JOIN dbo.Roles r ON r.RoleId = ur.RoleId
        LEFT JOIN dbo.UserFavoriteMenus ufm ON ufm.UserId = u.UserId
        WHERE u.Username = @login OR u.StaffId = @login
      `, { inputs: { login: { type: sql.NVarChar(100), value: username } } });

    const firstRow = rows[0];
    if (!firstRow || !firstRow.IsActive || !(await bcrypt.compare(password, firstRow.PasswordHash))) {
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }

    const roles = [...new Set(rows.map((row) => row.RoleCode).filter(Boolean))];
    if (!roles.length) {
      res.status(403).json({ message: 'User has no assigned roles' });
      return;
    }

    const favoriteMenus = [...new Set(rows.map((row) => row.MenuKey).filter(Boolean))];
    const user = {
      id: firstRow.UserId,
      username: firstRow.Username,
      staffId: firstRow.StaffId,
      name: firstRow.DisplayName,
      displayName: firstRow.DisplayName,
      jobTitle: firstRow.JobTitle,
      email: firstRow.Email,
      avatarUrl: firstRow.AvatarUrl,
      roles,
      favoriteMenus,
    };

    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ token, user });
  }),
);

router.post('/logout', (_req, res) => {
  res.status(204).send();
});

router.get(
  '/barcode/:text',
  asyncHandler(async (req, res) => {
    const { text } = req.params;
    if (!text) {
      res.status(400).send('Text parameter is required');
      return;
    }

    bwipjs.toBuffer({
      bcid: 'code128',
      text: text,
      scale: 3,
      height: 15,
      includetext: false,
    }, function (err, png) {
      if (err) {
        res.status(500).send(err.message || err);
      } else {
        res.type('png');
        res.send(png);
      }
    });
  })
);

router.get(
  '/qrcode/:text',
  asyncHandler(async (req, res) => {
    const { text } = req.params;
    if (!text) {
      res.status(400).send('Text parameter is required');
      return;
    }

    bwipjs.toBuffer({
      bcid: 'qrcode',
      text: text,
      scale: 4,
    }, function (err, png) {
      if (err) {
        res.status(500).send(err.message || err);
      } else {
        res.type('png');
        res.send(png);
      }
    });
  })
);

export default router;
