import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

router.get('/items', allowRoles('admin', 'accounting', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, sku: 'FG-PAPER-A4-80', name: 'Double A A4 80gsm' }] });
});

router.post('/items', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

router.get('/warehouses', allowRoles('admin', 'accounting', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, code: 'MAIN', name: 'Main Warehouse' }] });
});

router.post('/transfers', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, status: 'draft', ...req.body });
});

export default router;
