import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { wmsTaskService } from '../services/wms/wmsTaskService.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'user', 'audit', 'warehouse');
const writeRoles = allowRoles('admin', 'warehouse');

// Get all tasks (with filters)
router.get('/tasks', readRoles, asyncHandler(async (req, res) => {
  const filters = {
    warehouseId: req.query.warehouseId,
    status: req.query.status,
    taskType: req.query.taskType,
    assignedTo: req.query.assignedTo
  };
  const tasks = await wmsTaskService.getTasks(filters);
  res.json({ data: tasks });
}));

// Get specific task by ID
router.get('/tasks/:id', readRoles, asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id);
  const task = await wmsTaskService.getTaskById(taskId);
  if (!task) {
    return res.status(404).json({ message: 'WMS Task not found' });
  }
  res.json({ data: task });
}));

// Manually generate a task (For API testing or ad-hoc tasks)
router.post('/tasks', writeRoles, asyncHandler(async (req, res) => {
  const taskId = await wmsTaskService.createTask({
    taskType: req.body.taskType,
    referenceType: req.body.referenceType,
    referenceId: req.body.referenceId,
    warehouseId: req.body.warehouseId,
    assignedTo: req.body.assignedTo,
    lines: req.body.lines
  });
  
  const createdTask = await wmsTaskService.getTaskById(taskId);
  res.status(201).json({ data: createdTask });
}));

export default router;
