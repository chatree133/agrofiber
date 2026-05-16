import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

router.get('/tasks', allowRoles('admin', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, taskType: 'picking', status: 'open' }] });
});

router.post('/receipts', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, status: 'received', ...req.body });
});

router.post('/picks', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, status: 'picked', ...req.body });
});

router.post('/packs', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, status: 'packed', ...req.body });
});

export default router;
