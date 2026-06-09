import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mssqlQuery, sql } from '../lib/mssql.js';

const router = Router();

router.get('/', authenticate, allowRoles('admin'), (_req, res) => {
  res.json({
    data: [
      { id: 1, username: 'chatree', name: 'Chatree Kueakachai', roles: ['admin', 'accounting', 'user'] },
      { id: 2, username: 'audit01', name: 'Audit User', roles: ['audit'] },
    ],
  });
});

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;

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
          r.RoleCode,
          ufm.MenuKey
        FROM dbo.Users u
        LEFT JOIN dbo.UserRoles ur ON ur.UserId = u.UserId AND ur.IsActive = 1
        LEFT JOIN dbo.Roles r ON r.RoleId = ur.RoleId
        LEFT JOIN dbo.UserFavoriteMenus ufm ON ufm.UserId = u.UserId
        WHERE u.UserId = @userId
      `, { inputs: { userId: { type: sql.Int, value: userId } } });

    const firstRow = rows[0];
    if (!firstRow || !firstRow.IsActive) {
      res.status(404).json({ message: 'User not found or inactive' });
      return;
    }

    const roles = [...new Set(rows.map((row) => row.RoleCode).filter(Boolean))];
    const favoriteMenus = [...new Set(rows.map((row) => row.MenuKey).filter(Boolean))];

    res.json({
      user: {
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
      },
    });
  }),
);

router.put(
  '/menus/favorite',
  authenticate,
  asyncHandler(async (req, res) => {
    const { menuKey } = req.body;
    if (!menuKey || typeof menuKey !== 'string') {
      res.status(400).json({ message: 'menuKey is required' });
      return;
    }

    const userId = req.user.sub;

    const existsRows = await mssqlQuery(
      'DEFAULT',
      'SELECT 1 AS ExistsFlag FROM dbo.UserFavoriteMenus WHERE UserId = @userId AND MenuKey = @menuKey',
      { inputs: { userId: { type: sql.Int, value: userId }, menuKey: { type: sql.NVarChar(200), value: menuKey } } },
    );

    if (existsRows.length) {
      await mssqlQuery(
        'DEFAULT',
        'DELETE FROM dbo.UserFavoriteMenus WHERE UserId = @userId AND MenuKey = @menuKey',
        { inputs: { userId: { type: sql.Int, value: userId }, menuKey: { type: sql.NVarChar(200), value: menuKey } } },
      );
    } else {
      await mssqlQuery(
        'DEFAULT',
        'INSERT INTO dbo.UserFavoriteMenus (UserId, MenuKey) VALUES (@userId, @menuKey)',
        { inputs: { userId: { type: sql.Int, value: userId }, menuKey: { type: sql.NVarChar(200), value: menuKey } } },
      );
    }

    const favoritesRows = await mssqlQuery(
      'DEFAULT',
      'SELECT MenuKey FROM dbo.UserFavoriteMenus WHERE UserId = @userId ORDER BY MenuKey',
      { inputs: { userId: { type: sql.Int, value: userId } } },
    );

    res.json({ favoriteMenus: favoritesRows.map((row) => row.MenuKey) });
  }),
);

router.put('/:id/roles', authenticate, allowRoles('admin'), (req, res) => {
  res.json({ id: Number(req.params.id), roles: req.body.roles || [] });
});

export default router;
