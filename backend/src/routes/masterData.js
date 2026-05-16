import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

router.get('/customers', allowRoles('admin', 'accounting', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, code: 'CUST-001', name: 'Advance Agro Public Co., Ltd.' }] });
});

router.get('/vendors', allowRoles('admin', 'accounting', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, code: 'VEND-001', name: 'Double A Paper' }] });
});

router.get('/units', allowRoles('admin', 'accounting', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, code: 'REAM', name: 'รีม' }] });
});

export default router;
