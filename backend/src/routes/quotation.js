import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

router.get('/', allowRoles('admin', 'user', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, documentNo: 'QT-2026-0001', status: 'sent' }] });
});

router.post('/', allowRoles('admin', 'user'), (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

router.post('/:id/convert-to-sale-order', allowRoles('admin', 'user'), (req, res) => {
  res.json({ quotationId: Number(req.params.id), saleOrderNo: 'SO-2026-0002' });
});

export default router;
