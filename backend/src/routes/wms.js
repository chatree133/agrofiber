import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { wmsTaskService } from '../services/wms/wmsTaskService.js';

const router = Router();
router.use(authenticate);

const readRoles = allowRoles('admin', 'user', 'audit', 'warehouse', 'warehouse_manager', 'wms');
const writeRoles = allowRoles('admin', 'warehouse', 'warehouse_manager', 'wms');
const cancelTransferRoles = allowRoles('admin', 'warehouse_manager');

function getUserId(req) {
  const raw = req.user?.sub;
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid authenticated user');
  return userId;
}

function isWmsPrivileged(req) {
  const roles = req.user?.roles || [];
  return roles.includes('admin') || roles.includes('warehouse_manager');
}

// Get last putaway location of an item
router.get('/items/last-location', readRoles, asyncHandler(async (req, res) => {
  const itemId = Number(req.query.itemId);
  const itemSpecId = req.query.itemSpecId ? Number(req.query.itemSpecId) : null;
  const warehouseId = Number(req.query.warehouseId);

  if (!itemId || !warehouseId) {
    return res.status(400).json({ message: 'itemId and warehouseId are required' });
  }

  const lastLocation = await wmsTaskService.getLastLocation({ itemId, itemSpecId, warehouseId });
  res.json({ data: lastLocation });
}));

// Get all tasks (with filters)
router.get('/tasks', readRoles, asyncHandler(async (req, res) => {
  const filters = {
    warehouseId: req.query.warehouseId,
    status: req.query.status,
    taskType: req.query.taskType,
    assignedTo: req.query.assignedTo,
    unassociated: req.query.unassociated
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

// Claim/Start a task (set ActionBy = current user)
router.post('/tasks/:id/claim', writeRoles, asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = getUserId(req);
  await wmsTaskService.claimTask({ taskId, userId });
  const updatedTask = await wmsTaskService.getTaskById(taskId);
  res.json({ data: updatedTask });
}));

// Unclaim/Stop a task (clear ActionBy/ActionAt)
router.post('/tasks/:id/unclaim', writeRoles, asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = getUserId(req);
  const privileged = isWmsPrivileged(req);
  await wmsTaskService.unclaimTask({ taskId, userId, privileged });
  const updatedTask = await wmsTaskService.getTaskById(taskId);
  res.json({ data: updatedTask });
}));

// Create a wave picking task group
router.post('/waves', writeRoles, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { taskIds } = req.body;
  const waveId = await wmsTaskService.createWave({ taskIds, userId });
  const createdWave = await wmsTaskService.getWaveById(waveId);
  res.status(201).json({ data: createdWave });
}));

// Get all waves
router.get('/waves', readRoles, asyncHandler(async (req, res) => {
  const waves = await wmsTaskService.getWaves(req.query);
  res.json({ data: waves });
}));

// Get specific wave details
router.get('/waves/:id', readRoles, asyncHandler(async (req, res) => {
  const waveId = Number(req.params.id);
  const wave = await wmsTaskService.getWaveById(waveId);
  if (!wave) {
    return res.status(404).json({ message: 'WMS Wave not found' });
  }
  res.json({ data: wave });
}));

// Claim/Start a wave (set ActionBy = current user)
router.post('/waves/:id/claim', writeRoles, asyncHandler(async (req, res) => {
  const waveId = Number(req.params.id);
  const userId = getUserId(req);
  await wmsTaskService.claimWave({ waveId, userId });
  const updatedWave = await wmsTaskService.getWaveById(waveId);
  res.json({ data: updatedWave });
}));

// Unclaim/Stop a wave (clear ActionBy/ActionAt; also clears open tasks ActionBy under the wave)
router.post('/waves/:id/unclaim', writeRoles, asyncHandler(async (req, res) => {
  const waveId = Number(req.params.id);
  const userId = getUserId(req);
  const privileged = isWmsPrivileged(req);
  await wmsTaskService.unclaimWave({ waveId, userId, privileged });
  const updatedWave = await wmsTaskService.getWaveById(waveId);
  res.json({ data: updatedWave });
}));

// Confirm picking task
router.post('/tasks/:id/confirm', writeRoles, asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = getUserId(req);
  const { lines } = req.body;
  await wmsTaskService.confirmTask({ taskId, lines, userId });
  const updatedTask = await wmsTaskService.getTaskById(taskId);
  res.json({ data: updatedTask, message: 'WMS Task confirmed successfully' });
}));

// Cancel a transfer task (admin/warehouse_manager only)
router.post('/tasks/:id/cancel', cancelTransferRoles, asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = getUserId(req);
  const notes = req.body?.notes ? String(req.body.notes).trim() : null;
  await wmsTaskService.cancelTask({ taskId, userId, notes });
  const updatedTask = await wmsTaskService.getTaskById(taskId);
  res.json({ data: updatedTask, message: 'WMS Task cancelled successfully' });
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

// Re-allocate / Reset Wave FIFO allocation
router.post('/waves/:id/allocate', writeRoles, asyncHandler(async (req, res) => {
  const waveId = Number(req.params.id);
  const userId = getUserId(req);
  await wmsTaskService.resetAndReallocateWave({ waveId, userId });
  const updatedWave = await wmsTaskService.getWaveById(waveId);
  res.json({ data: updatedWave, message: 'Wave inventory re-allocated successfully' });
}));

// Manual split task line
router.post('/tasks/:taskId/lines/:lineId/split', writeRoles, asyncHandler(async (req, res) => {
  const taskId = Number(req.params.taskId);
  const lineId = Number(req.params.lineId);
  const { splitQty } = req.body;
  const userId = getUserId(req);
  await wmsTaskService.splitTaskLine({ taskId, lineId, splitQty, userId });
  const updatedTask = await wmsTaskService.getTaskById(taskId);
  res.json({ data: updatedTask, message: 'WMS Task Line split successfully' });
}));

// Get WMS / Warehouse Incidents
router.get('/incidents', readRoles, asyncHandler(async (req, res) => {
  const incidents = await wmsTaskService.getIncidents(req.query);
  res.json({ data: incidents });
}));

// Resolve WMS / Warehouse Incident
router.post('/incidents/:id/resolve', writeRoles, asyncHandler(async (req, res) => {
  const incidentId = Number(req.params.id);
  const userId = getUserId(req);
  const { action, details } = req.body;
  await wmsTaskService.resolveIncident({ incidentId, action, userId, details });
  res.json({ success: true, message: 'Incident resolved successfully' });
}));

export default router;
