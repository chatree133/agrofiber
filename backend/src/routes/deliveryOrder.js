import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

router.get('/', allowRoles('admin', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, documentNo: 'DO-2026-0001', status: 'picking' }] });
});

router.post('/', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

router.post('/:id/ship', allowRoles('admin', 'user'), (req, res) => {
  res.json({ id: Number(req.params.id), status: 'shipped' });
});

export default router;
