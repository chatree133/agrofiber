import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

router.get('/', allowRoles('admin', 'accounting', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, documentNo: 'PO-2026-0001', status: 'draft' }] });
});

router.post('/', allowRoles('admin', 'accounting'), (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

router.put('/:id', allowRoles('admin', 'accounting'), (req, res) => {
  res.json({ id: Number(req.params.id), ...req.body });
});

router.post('/:id/approve', allowRoles('admin'), (req, res) => {
  res.json({ id: Number(req.params.id), status: 'approved' });
});

export default router;
