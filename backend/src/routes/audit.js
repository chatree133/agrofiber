import { Router } from 'express';
import { mssqlQueryFull, sql } from '../lib/mssql.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';

const router = Router();
router.use(authenticate);

// Allow admin and audit roles to view audit logs
const viewerRoles = allowRoles('admin', 'audit');

router.get('/', viewerRoles, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const pageSize = parseInt(req.query.pageSize || '20', 10);
  const search = req.query.search || '';
  const moduleFilter = req.query.module || '';
  const actionFilter = req.query.action || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';

  const offset = (page - 1) * pageSize;

  let whereClauses = [];
  const inputs = {};

  if (search) {
    whereClauses.push('(al.Username LIKE @search OR al.Description LIKE @search OR al.TargetId LIKE @search)');
    inputs.search = `%${search}%`;
  }
  if (moduleFilter) {
    whereClauses.push('al.Module = @module');
    inputs.module = moduleFilter;
  }
  if (actionFilter) {
    whereClauses.push('al.ActionType = @action');
    inputs.action = actionFilter;
  }
  if (startDate) {
    whereClauses.push('al.Timestamp >= @startDate');
    inputs.startDate = startDate;
  }
  if (endDate) {
    // Append time to end date so it is inclusive of the whole day (23:59:59)
    whereClauses.push('al.Timestamp <= @endDate');
    inputs.endDate = `${endDate} 23:59:59`;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const queryText = `
    SELECT al.AuditLogId, al.Timestamp, al.UserId, al.Username, al.Module, al.ActionType, al.TargetId, al.Description, al.OldValues, al.NewValues, al.IpAddress, u.DisplayName
    FROM dbo.AuditLogs al
    LEFT JOIN dbo.Users u ON u.UserId = al.UserId
    ${whereSql}
    ORDER BY al.Timestamp DESC
    OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;

    SELECT COUNT(*) AS total
    FROM dbo.AuditLogs al
    ${whereSql};
  `;

  // Construct inputs with correct MSSQL data types
  const parsedInputs = {};
  for (const [key, val] of Object.entries(inputs)) {
    parsedInputs[key] = { type: sql.NVarChar, value: val };
  }

  const poolResult = await mssqlQueryFull('DEFAULT', queryText, {
    inputs: parsedInputs
  });

  const logs = poolResult.recordsets[0] || [];
  const total = poolResult.recordsets[1]?.[0]?.total || 0;

  res.json({
    data: logs.map(log => ({
      id: log.AuditLogId,
      timestamp: log.Timestamp,
      userId: log.UserId,
      username: log.Username,
      displayName: log.DisplayName || log.Username || 'System',
      module: log.Module,
      actionType: log.ActionType,
      targetId: log.TargetId,
      description: log.Description,
      oldValues: log.OldValues,
      newValues: log.NewValues,
      ipAddress: log.IpAddress
    })),
    pagination: {
      page,
      pageSize,
      total
    }
  });
}));

export default router;
