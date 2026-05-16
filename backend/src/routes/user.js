import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();

const favoriteStore = new Map();

router.get('/', authenticate, allowRoles('admin'), (_req, res) => {
  res.json({
    data: [
      { id: 1, username: 'chatree', name: 'Chatree Kueakachai', roles: ['admin', 'accounting', 'user'] },
      { id: 2, username: 'audit01', name: 'Audit User', roles: ['audit'] },
    ],
  });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.put('/menus/favorite', authenticate, (req, res) => {
  const { menuKey } = req.body;
  if (!menuKey) {
    res.status(400).json({ message: 'menuKey is required' });
    return;
  }

  const userId = req.user.sub;
  const current = favoriteStore.get(userId) || new Set();

  if (current.has(menuKey)) {
    current.delete(menuKey);
  } else {
    current.add(menuKey);
  }

  favoriteStore.set(userId, current);
  res.json({ favoriteMenus: Array.from(current) });
});

router.put('/:id/roles', authenticate, allowRoles('admin'), (req, res) => {
  res.json({ id: Number(req.params.id), roles: req.body.roles || [] });
});

export default router;
