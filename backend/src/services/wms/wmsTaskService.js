import { sql, mssqlQuery, mssqlTransaction } from '../../lib/mssql.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export const wmsTaskService = {
  /**
   * สร้าง WMS Task ใหม่ (รองรับการรันภายใน Transaction หรือนอก Transaction)
   */
  async createTask({ taskType, referenceType = null, referenceId = null, warehouseId, assignedTo = null, lines = [] }, existingTx = null) {
    if (!taskType) throw badRequest('taskType is required');
    if (!warehouseId) throw badRequest('warehouseId is required');
    if (!lines || lines.length === 0) throw badRequest('At least one task line is required');

    const execute = async (tx) => {
      // 1. ตรวจสอบว่ามี TaskType นี้ไหม
      const typeReq = new sql.Request(tx);
      typeReq.input('taskType', sql.NVarChar(40), taskType);
      const typeRes = await typeReq.query(`SELECT 1 FROM dbo.WmsTaskTypes WHERE TaskTypeCode = @taskType`);
      if (typeRes.recordset.length === 0) {
        throw badRequest(`Invalid TaskType: ${taskType}`);
      }

      // 2. สร้าง Header
      const headerReq = new sql.Request(tx);
      headerReq.input('taskType', sql.NVarChar(40), taskType);
      headerReq.input('refType', sql.NVarChar(40), referenceType);
      headerReq.input('refId', sql.Int, referenceId);
      headerReq.input('whId', sql.Int, warehouseId);
      headerReq.input('assignedTo', sql.Int, assignedTo);

      const headerRes = await headerReq.query(`
        INSERT INTO dbo.WmsTasks (
          TaskType, ReferenceType, ReferenceId, WarehouseId, AssignedTo, Status
        )
        OUTPUT INSERTED.WmsTaskId
        VALUES (
          @taskType, @refType, @refId, @whId, @assignedTo, 'open'
        )
      `);
      const wmsTaskId = headerRes.recordset[0].WmsTaskId;

      // 3. สร้าง Lines
      for (const line of lines) {
        if (!line.itemId || !line.quantityRequired) continue;

        const lineReq = new sql.Request(tx);
        lineReq.input('taskId', sql.BigInt, wmsTaskId);
        lineReq.input('itemId', sql.Int, line.itemId);
        lineReq.input('itemSpecId', sql.Int, line.itemSpecId || null);
        lineReq.input('lotId', sql.BigInt, line.lotId || null);
        lineReq.input('reservationId', sql.BigInt, line.inventoryReservationId || null);
        lineReq.input('unitId', sql.BigInt, line.inventoryUnitId || null);
        lineReq.input('fromLoc', sql.Int, line.fromLocationId || null);
        lineReq.input('toLoc', sql.Int, line.toLocationId || null);
        lineReq.input('qty', sql.Decimal(18, 4), line.quantityRequired);

        await lineReq.query(`
          INSERT INTO dbo.WmsTaskLines (
            WmsTaskId, ItemId, ItemSpecId, LotId, InventoryReservationId, InventoryUnitId,
            FromLocationId, ToLocationId, QuantityRequired, QuantityCompleted
          )
          VALUES (
            @taskId, @itemId, @itemSpecId, @lotId, @reservationId, @unitId,
            @fromLoc, @toLoc, @qty, 0
          )
        `);
      }

      return wmsTaskId;
    };

    if (existingTx) {
      return await execute(existingTx);
    } else {
      return await mssqlTransaction('DEFAULT', execute);
    }
  },

  async getTasks(filters = {}) {
    let whereClause = '1=1';
    const inputs = {};

    if (filters.warehouseId) {
      whereClause += ' AND t.WarehouseId = @whId';
      inputs.whId = { type: sql.Int, value: filters.warehouseId };
    }
    if (filters.status) {
      whereClause += ' AND t.Status = @status';
      inputs.status = { type: sql.NVarChar(30), value: filters.status };
    }
    if (filters.taskType) {
      whereClause += ' AND t.TaskType = @taskType';
      inputs.taskType = { type: sql.NVarChar(40), value: filters.taskType };
    }
    if (filters.assignedTo) {
      whereClause += ' AND t.AssignedTo = @assignedTo';
      inputs.assignedTo = { type: sql.Int, value: filters.assignedTo };
    }

    const rows = await mssqlQuery('DEFAULT', `
      SELECT 
        t.WmsTaskId, t.TaskType, ty.TaskTypeName, t.ReferenceType, t.ReferenceId,
        t.WarehouseId, w.WarehouseName, t.AssignedTo, u.FirstName, u.LastName,
        t.Status, t.CreatedAt, t.CompletedAt
      FROM dbo.WmsTasks t
      LEFT JOIN dbo.WmsTaskTypes ty ON ty.TaskTypeCode = t.TaskType
      LEFT JOIN dbo.Warehouses w ON w.WarehouseId = t.WarehouseId
      LEFT JOIN dbo.Users u ON u.UserId = t.AssignedTo
      WHERE ${whereClause}
      ORDER BY t.CreatedAt DESC
    `, { inputs });

    return rows.map(r => ({
      id: r.WmsTaskId,
      taskType: r.TaskType,
      taskTypeName: r.TaskTypeName,
      referenceType: r.ReferenceType,
      referenceId: r.ReferenceId,
      warehouseId: r.WarehouseId,
      warehouseName: r.WarehouseName,
      assignedTo: r.AssignedTo,
      assignedToName: r.FirstName ? `${r.FirstName} ${r.LastName || ''}`.trim() : null,
      status: r.Status,
      createdAt: r.CreatedAt,
      completedAt: r.CompletedAt
    }));
  },

  async getTaskById(taskId) {
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT 
        t.WmsTaskId, t.TaskType, ty.TaskTypeName, t.ReferenceType, t.ReferenceId,
        t.WarehouseId, w.WarehouseName, t.AssignedTo, u.FirstName, u.LastName,
        t.Status, t.CreatedAt, t.CompletedAt
      FROM dbo.WmsTasks t
      LEFT JOIN dbo.WmsTaskTypes ty ON ty.TaskTypeCode = t.TaskType
      LEFT JOIN dbo.Warehouses w ON w.WarehouseId = t.WarehouseId
      LEFT JOIN dbo.Users u ON u.UserId = t.AssignedTo
      WHERE t.WmsTaskId = @taskId
    `, { inputs: { taskId: { type: sql.BigInt, value: taskId } } });

    if (headerRows.length === 0) return null;
    const task = headerRows[0];

    const linesRows = await mssqlQuery('DEFAULT', `
      SELECT 
        l.WmsTaskLineId, l.ItemId, i.ItemCode, i.ItemName,
        l.ItemSpecId, l.LotId, lot.LotNo,
        l.FromLocationId, fl.LocationCode AS FromLocationCode,
        l.ToLocationId, tl.LocationCode AS ToLocationCode,
        l.QuantityRequired, l.QuantityCompleted
      FROM dbo.WmsTaskLines l
      JOIN dbo.Items i ON i.ItemId = l.ItemId
      LEFT JOIN dbo.Lots lot ON lot.LotId = l.LotId
      LEFT JOIN dbo.WarehouseLocations fl ON fl.LocationId = l.FromLocationId
      LEFT JOIN dbo.WarehouseLocations tl ON tl.LocationId = l.ToLocationId
      WHERE l.WmsTaskId = @taskId
    `, { inputs: { taskId: { type: sql.BigInt, value: taskId } } });

    return {
      id: task.WmsTaskId,
      taskType: task.TaskType,
      taskTypeName: task.TaskTypeName,
      referenceType: task.ReferenceType,
      referenceId: task.ReferenceId,
      warehouseId: task.WarehouseId,
      warehouseName: task.WarehouseName,
      assignedTo: task.AssignedTo,
      assignedToName: task.FirstName ? `${task.FirstName} ${task.LastName || ''}`.trim() : null,
      status: task.Status,
      createdAt: task.CreatedAt,
      completedAt: task.CompletedAt,
      lines: linesRows.map(l => ({
        id: l.WmsTaskLineId,
        itemId: l.ItemId,
        itemCode: l.ItemCode,
        itemName: l.ItemName,
        itemSpecId: l.ItemSpecId,
        lotId: l.LotId,
        lotNo: l.LotNo,
        fromLocationId: l.FromLocationId,
        fromLocationCode: l.FromLocationCode,
        toLocationId: l.ToLocationId,
        toLocationCode: l.ToLocationCode,
        quantityRequired: l.QuantityRequired,
        quantityCompleted: l.QuantityCompleted
      }))
    };
  }
};
