import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', allowRoles('admin', 'accounting', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, documentNo: 'SO-2026-0001', status: 'open' }] });
});

router.post('/', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

router.get('/:id', allowRoles('admin', 'accounting', 'user', 'audit'), (req, res) => {
  res.json({ id: Number(req.params.id), documentNo: 'SO-2026-0001' });
});

router.put('/:id', allowRoles('admin', 'user'), (req, res) => {
  res.json({ id: Number(req.params.id), ...req.body });
});

router.post('/:id/approve', allowRoles('admin', 'accounting'), (req, res) => {
  res.json({ id: Number(req.params.id), status: 'approved' });
});

export default router;
