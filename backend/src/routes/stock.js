import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

router.get('/on-hand', allowRoles('admin', 'accounting', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ itemId: 1, warehouseId: 1, qtyAvailable: 8430 }] });
});

router.get('/movements', allowRoles('admin', 'accounting', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, movementType: 'receipt', quantity: 500 }] });
});

router.post('/adjustments', allowRoles('admin'), (req, res) => {
  res.status(201).json({ id: 1, status: 'posted', ...req.body });
});

export default router;
