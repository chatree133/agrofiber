import { sql, getMssqlPool } from './mssql.js';

export async function logAuditEvent({
  userId = null,
  username = null,
  module,
  actionType,
  targetId = null,
  description,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  tx = null
}) {
  try {
    const qText = `
      INSERT INTO dbo.AuditLogs (UserId, Username, Module, ActionType, TargetId, Description, OldValues, NewValues, IpAddress)
      VALUES (@userId, @username, @module, @actionType, @targetId, @description, @oldValues, @newValues, @ipAddress)
    `;
    
    const oldStr = oldValues && typeof oldValues === 'object' ? JSON.stringify(oldValues) : oldValues;
    const newStr = newValues && typeof newValues === 'object' ? JSON.stringify(newValues) : newValues;

    const pool = await getMssqlPool('DEFAULT');
    const request = tx ? new sql.Request(tx) : pool.request();
    request.input('userId', sql.Int, userId);
    request.input('username', sql.NVarChar(100), username);
    request.input('module', sql.NVarChar(50), module);
    request.input('actionType', sql.NVarChar(30), actionType);
    request.input('targetId', sql.NVarChar(100), targetId);
    request.input('description', sql.NVarChar(1000), description);
    request.input('oldValues', sql.NVarChar(sql.MAX), oldStr || null);
    request.input('newValues', sql.NVarChar(sql.MAX), newStr || null);
    request.input('ipAddress', sql.NVarChar(45), ipAddress);

    await request.query(qText);
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

// Helper for Express Router requests
export function logRequestAudit(req, { module, actionType, targetId, description, oldValues, newValues, tx = null }) {
  if (req) {
    req.auditLogged = true;
  }

  const userId = req.user?.sub ? Number(req.user.sub) : null;
  const username = req.user?.username || null;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

  return logAuditEvent({
    userId,
    username,
    module,
    actionType,
    targetId,
    description,
    oldValues,
    newValues,
    ipAddress,
    tx
  });
}

// Module mapping based on API route segments
const MODULE_MAP = {
  'auth': 'Auth',
  'sale-orders': 'Sales',
  'purchase-orders': 'Purchasing',
  'delivery-orders': 'WMS',
  'quotations': 'Sales',
  'users': 'Auth',
  'accounts': 'Finance',
  'customers': 'Master',
  'customer-price-contracts': 'Master',
  'inventory': 'WMS',
  'items': 'Master',
  'warehouses': 'Master',
  'goods-issues': 'WMS',
  'goods-receipts': 'WMS',
  'approvals': 'Approvals',
  'workflows': 'Settings',
  'production-orders': 'Production',
  'sales-invoices': 'Finance',
  'customer-payments': 'Finance',
  'qc': 'QC',
  'companies': 'Settings',
  'wms': 'WMS',
  'master-data': 'Master',
  'audit-logs': 'Audit'
};

// Global Express Middleware for Hybrid Audit Logging
export function auditMiddleware(req, res, next) {
  // Only intercept mutations (POST, PUT, PATCH, DELETE)
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isMutation) {
    return next();
  }

  // Parse path to resolve module name
  const pathParts = req.path.split('/').filter(Boolean);
  const moduleKey = pathParts[0] === 'api' ? pathParts[1] : pathParts[0];
  const moduleName = MODULE_MAP[moduleKey] || 'System';

  // Determine default action type
  let actionType = 'Update';
  if (req.method === 'POST') actionType = 'Create';
  if (req.method === 'DELETE') actionType = 'Delete';

  // Handle specific sub-actions
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart === 'approve') actionType = 'Approve';
  if (lastPart === 'cancel') actionType = 'Cancel';
  if (lastPart === 'login') actionType = 'Login';
  if (lastPart === 'logout') actionType = 'Logout';

  // Initialize audit payload structure on req
  req.auditData = {
    module: moduleName,
    actionType,
    description: `${actionType} operation on ${moduleName}`,
    oldValues: null,
    newValues: req.method !== 'DELETE' ? req.body : null,
    targetId: null
  };

  // Intercept response finish
  res.on('finish', () => {
    // Log only if successful (2xx) and not already logged manually
    if (res.statusCode >= 200 && res.statusCode < 400 && !req.auditLogged) {
      const userId = req.user?.sub ? Number(req.user.sub) : req.auditData.userId || null;
      const username = req.user?.username || req.auditData.username || null;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

      // Extract targetId from path segments if not custom-specified
      let targetId = req.auditData.targetId;
      if (!targetId) {
        const segments = req.originalUrl.split('?')[0].split('/').filter(Boolean);
        // Remove trailing action segments
        while (segments.length > 0 && ['cancel', 'approve', 'status-history', 'request-approval', 'reject'].includes(segments[segments.length - 1])) {
          segments.pop();
        }
        if (segments.length > 2) {
          const lastSeg = segments[segments.length - 1];
          // If the last segment is not a registered module key, treat it as the targetId
          if (lastSeg !== 'api' && MODULE_MAP[lastSeg] === undefined) {
            targetId = lastSeg;
          }
        }
      }

      logAuditEvent({
        userId,
        username,
        module: req.auditData.module,
        actionType: req.auditData.actionType,
        targetId,
        description: req.auditData.description,
        oldValues: req.auditData.oldValues,
        newValues: req.auditData.newValues,
        ipAddress
      });
    }
  });

  next();
}

