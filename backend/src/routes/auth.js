import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const dummyUsers = [
  {
    id: 1,
    username: 'chatree',
    passwordHash: bcrypt.hashSync('password', 10),
    name: 'Chatree Kueakachai',
    roles: ['admin', 'accounting', 'user'],
    avatarUrl: 'https://i.pravatar.cc/160?img=12',
    favoriteMenus: ['/salesorder/create', '/inventory/stock'],
  },
];

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const user = dummyUsers.find((entry) => entry.username === username);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }

    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    const { passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  }),
);

router.post('/logout', (_req, res) => {
  res.status(204).send();
});

export default router;
