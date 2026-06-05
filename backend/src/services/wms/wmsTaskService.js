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
        lineReq.input('remark', sql.NVarChar(1000), line.remark || null);

        await lineReq.query(`
          INSERT INTO dbo.WmsTaskLines (
            WmsTaskId, ItemId, ItemSpecId, LotId, InventoryReservationId, InventoryUnitId,
            FromLocationId, ToLocationId, QuantityRequired, QuantityCompleted, Remark
          )
          VALUES (
            @taskId, @itemId, @itemSpecId, @lotId, @reservationId, @unitId,
            @fromLoc, @toLoc, @qty, 0, @remark
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
    if (filters.unassociated === 'true' || filters.unassociated === true) {
      whereClause += ' AND t.WaveId IS NULL';
    }

    const rows = await mssqlQuery('DEFAULT', `
      SELECT 
        t.WmsTaskId, t.TaskType, ty.TaskTypeName, t.ReferenceType, t.ReferenceId,
        t.WarehouseId, w.WarehouseName, t.AssignedTo, u.DisplayName,
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
      assignedToName: r.DisplayName || null,
      status: r.Status,
      createdAt: r.CreatedAt,
      completedAt: r.CompletedAt
    }));
  },

  async getTaskById(taskId) {
    const headerRows = await mssqlQuery('DEFAULT', `
      SELECT 
        t.WmsTaskId, t.TaskType, ty.TaskTypeName, t.ReferenceType, t.ReferenceId,
        t.WarehouseId, w.WarehouseName, t.AssignedTo, u.DisplayName,
        t.Status, t.CreatedAt, t.CompletedAt, t.WaveId
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
        l.ItemSpecId, l.LotId, lot.LotNo, l.InventoryReservationId, l.InventoryUnitId,
        l.FromLocationId, fl.LocationCode AS FromLocationCode,
        l.ToLocationId, tl.LocationCode AS ToLocationCode,
        l.QuantityRequired, l.QuantityCompleted,
        ispec.SalesSKU, ispec.SpecCode, ispec.SpecName,
        l.Remark
      FROM dbo.WmsTaskLines l
      JOIN dbo.Items i ON i.ItemId = l.ItemId
      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = l.ItemSpecId
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
      assignedToName: task.DisplayName || null,
      status: task.Status,
      createdAt: task.CreatedAt,
      completedAt: task.CompletedAt,
      waveId: task.WaveId,
      lines: linesRows.map(l => ({
        id: l.WmsTaskLineId,
        itemId: l.ItemId,
        itemCode: l.SalesSKU || l.ItemCode,
        itemName: l.SpecName ? `${l.ItemName} - ${l.SpecName}` : l.ItemName,
        itemSpecId: l.ItemSpecId,
        salesSku: l.SalesSKU,
        specCode: l.SpecCode,
        specName: l.SpecName,
        lotId: l.LotId,
        lotNo: l.LotNo,
        inventoryReservationId: l.InventoryReservationId,
        inventoryUnitId: l.InventoryUnitId,
        fromLocationId: l.FromLocationId,
        fromLocationCode: l.FromLocationCode,
        toLocationId: l.ToLocationId,
        toLocationCode: l.ToLocationCode,
        quantityRequired: l.QuantityRequired,
        quantityCompleted: l.QuantityCompleted,
        remark: l.Remark || null
      }))
    };
  },

  async createWave({ taskIds, userId }, existingTx = null) {
    if (!taskIds || taskIds.length === 0) throw badRequest('At least one WMS task ID is required');

    const execute = async (tx) => {
      // 1. Generate WaveNo: WV-YYYYMMDD-XXXX
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randStr = Math.floor(1000 + Math.random() * 9000).toString();
      const waveNo = `WV-${dateStr}-${randStr}`;

      // 2. Create Wave Header
      const headerReq = new sql.Request(tx);
      headerReq.input('waveNo', sql.NVarChar(50), waveNo);
      headerReq.input('userId', sql.Int, userId);
      const headerRes = await headerReq.query(`
        INSERT INTO dbo.WmsWaves (WaveNo, Status, CreatedBy)
        OUTPUT INSERTED.WmsWaveId
        VALUES (@waveNo, 'open', @userId)
      `);
      const waveId = headerRes.recordset[0].WmsWaveId;

      // 3. Update tasks with WaveId
      for (const taskId of taskIds) {
        const updateReq = new sql.Request(tx);
        updateReq.input('waveId', sql.Int, waveId);
        updateReq.input('taskId', sql.BigInt, taskId);
        await updateReq.query(`
          UPDATE dbo.WmsTasks
          SET WaveId = @waveId
          WHERE WmsTaskId = @taskId
        `);
      }

      // 4. Auto-allocate wave inventory (FIFO)
      await this.allocateWaveInventory(waveId, tx);

      return waveId;
    };

    if (existingTx) {
      return await execute(existingTx);
    } else {
      return await mssqlTransaction('DEFAULT', execute);
    }
  },

  async getWaves(filters = {}) {
    let whereClause = '1=1';
    const inputs = {};

    if (filters.status) {
      whereClause += ' AND w.Status = @status';
      inputs.status = { type: sql.NVarChar(30), value: filters.status };
    }

    const rows = await mssqlQuery('DEFAULT', `
      SELECT 
        w.WmsWaveId, w.WaveNo, w.Status, w.CreatedBy, w.CreatedAt, w.CompletedAt,
        u.DisplayName AS CreatedByName,
        (SELECT COUNT(1) FROM dbo.WmsTasks t WHERE t.WaveId = w.WmsWaveId) AS TaskCount
      FROM dbo.WmsWaves w
      LEFT JOIN dbo.Users u ON u.UserId = w.CreatedBy
      WHERE ${whereClause}
      ORDER BY w.CreatedAt DESC
    `, { inputs });

    return rows.map(r => ({
      id: r.WmsWaveId,
      waveNo: r.WaveNo,
      status: r.Status,
      createdBy: r.CreatedBy,
      createdByName: r.CreatedByName,
      createdAt: r.CreatedAt,
      completedAt: r.CompletedAt,
      taskCount: r.TaskCount
    }));
  },

  async getWaveById(waveId) {
    const waveRows = await mssqlQuery('DEFAULT', `
      SELECT w.WmsWaveId, w.WaveNo, w.Status, w.CreatedBy, w.CreatedAt, w.CompletedAt,
             u.DisplayName AS CreatedByName
      FROM dbo.WmsWaves w
      LEFT JOIN dbo.Users u ON u.UserId = w.CreatedBy
      WHERE w.WmsWaveId = @waveId
    `, { inputs: { waveId: { type: sql.Int, value: waveId } } });

    if (waveRows.length === 0) return null;
    const wave = waveRows[0];

    const tasksRows = await mssqlQuery('DEFAULT', `
      SELECT t.WmsTaskId
      FROM dbo.WmsTasks t
      WHERE t.WaveId = @waveId
    `, { inputs: { waveId: { type: sql.Int, value: waveId } } });

    const tasks = [];
    for (const row of tasksRows) {
      const taskDetails = await this.getTaskById(row.WmsTaskId);
      if (taskDetails) tasks.push(taskDetails);
    }

    return {
      id: wave.WmsWaveId,
      waveNo: wave.WaveNo,
      status: wave.Status,
      createdBy: wave.CreatedBy,
      createdByName: wave.CreatedByName,
      createdAt: wave.CreatedAt,
      completedAt: wave.CompletedAt,
      tasks
    };
  },

  async confirmTask({ taskId, lines = [], userId }, existingTx = null) {
    const execute = async (tx) => {
      // 1. Get task details
      const taskReq = new sql.Request(tx);
      taskReq.input('taskId', sql.BigInt, taskId);
      const taskRes = await taskReq.query(`
        SELECT WmsTaskId, TaskType, ReferenceType, ReferenceId, WarehouseId, Status, WaveId
        FROM dbo.WmsTasks
        WHERE WmsTaskId = @taskId
      `);
      const task = taskRes.recordset[0];
      if (!task) throw badRequest('WMS Task not found');
      if (task.Status === 'completed') throw badRequest('WMS Task is already completed');

      // 2. Update each line
      for (const line of lines) {
        if (!line.lineId) continue;

        const qtyCompleted = line.quantityCompleted || 0;
        const lotId = line.lotId || null;
        const inventoryUnitId = line.inventoryUnitId || null;
        const fromLocationId = line.fromLocationId || null;
        const toLocationId = line.toLocationId || null;

        const lineReq = new sql.Request(tx);
        lineReq.input('lineId', sql.BigInt, line.lineId);
        lineReq.input('taskId', sql.BigInt, taskId);
        lineReq.input('qty', sql.Decimal(18, 4), qtyCompleted);
        lineReq.input('lotId', sql.BigInt, lotId);
        lineReq.input('unitId', sql.BigInt, inventoryUnitId);
        lineReq.input('fromLoc', sql.Int, fromLocationId);
        lineReq.input('toLoc', sql.Int, toLocationId);

        // Fetch task line details to get reservation
        const taskLineRes = await lineReq.query(`
          SELECT InventoryReservationId, ItemId
          FROM dbo.WmsTaskLines
          WHERE WmsTaskLineId = @lineId AND WmsTaskId = @taskId
        `);
        const taskLine = taskLineRes.recordset[0];
        if (!taskLine) continue;

        await lineReq.query(`
          UPDATE dbo.WmsTaskLines
          SET
            QuantityCompleted = @qty,
            LotId = COALESCE(@lotId, LotId),
            InventoryUnitId = COALESCE(@unitId, InventoryUnitId),
            FromLocationId = COALESCE(@fromLoc, FromLocationId),
            ToLocationId = COALESCE(@toLoc, ToLocationId)
          WHERE WmsTaskLineId = @lineId AND WmsTaskId = @taskId
        `);

        // If it references an inventory reservation, update the reservation
        if (taskLine.InventoryReservationId) {
          const resReq = new sql.Request(tx);
          resReq.input('resId', sql.BigInt, taskLine.InventoryReservationId);
          resReq.input('qty', sql.Decimal(18, 4), qtyCompleted);
          resReq.input('lotId', sql.BigInt, lotId);
          resReq.input('whId', sql.Int, task.WarehouseId);
          resReq.input('locId', sql.Int, fromLocationId);
          resReq.input('unitId', sql.BigInt, inventoryUnitId);

          await resReq.query(`
            UPDATE dbo.InventoryReservations
            SET
              PickedQty = @qty,
              Status = CASE WHEN @qty >= ReservedQty THEN 'picked' ELSE 'allocated' END,
              LotId = COALESCE(@lotId, LotId),
              WarehouseId = COALESCE(@whId, WarehouseId),
              LocationId = COALESCE(@locId, LocationId),
              InventoryUnitId = COALESCE(@unitId, InventoryUnitId)
            WHERE InventoryReservationId = @resId
          `);
        }
      }

      // 3. Mark task as completed
      const updateTaskReq = new sql.Request(tx);
      updateTaskReq.input('taskId', sql.BigInt, taskId);
      await updateTaskReq.query(`
        UPDATE dbo.WmsTasks
        SET Status = 'completed', CompletedAt = SYSUTCDATETIME()
        WHERE WmsTaskId = @taskId
      `);

      // Status history log
      const histReq = new sql.Request(tx);
      histReq.input('taskId', sql.BigInt, taskId);
      histReq.input('userId', sql.Int, userId);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('WMS_TASK', @taskId, 'open', 'completed', @userId, 'Picking task completed and confirmed')
      `);

      // If task belongs to a wave, check if all tasks in wave are completed
      if (task.WaveId) {
        const waveCheckReq = new sql.Request(tx);
        waveCheckReq.input('waveId', sql.Int, task.WaveId);
        const waveCheckRes = await waveCheckReq.query(`
          SELECT COUNT(1) AS OpenTaskCount
          FROM dbo.WmsTasks
          WHERE WaveId = @waveId AND Status = 'open'
        `);
        if (waveCheckRes.recordset[0].OpenTaskCount === 0) {
          await waveCheckReq.query(`
            UPDATE dbo.WmsWaves
            SET Status = 'completed', CompletedAt = SYSUTCDATETIME()
            WHERE WmsWaveId = @waveId
          `);
        }
      }

      // 4. Auto-create draft Delivery Order if ReferenceType = 'SO'
      if (task.ReferenceType === 'SO' && task.ReferenceId) {
        await wmsTaskService.createDraftDOFromPickTask(tx, taskId, userId);
      }

      return { success: true };
    };

    if (existingTx) {
      return await execute(existingTx);
    } else {
      return await mssqlTransaction('DEFAULT', execute);
    }
  },

  async createDraftDOFromPickTask(tx, taskId, userId) {
    // 1. Fetch SO details and branch
    const taskReq = new sql.Request(tx);
    taskReq.input('taskId', sql.BigInt, taskId);
    const taskRes = await taskReq.query(`
      SELECT t.ReferenceId AS SalesOrderId, t.WarehouseId,
             so.BranchId, so.CustomerId, so.ShippingAddress
      FROM dbo.WmsTasks t
      JOIN dbo.SalesOrders so ON so.SalesOrderId = t.ReferenceId
      WHERE t.WmsTaskId = @taskId
    `);
    const info = taskRes.recordset[0];
    if (!info) return;

    // 2. Fetch completed lines from picking task with UnitId
    const linesRes = await taskReq.query(`
      SELECT tl.ItemId, tl.QuantityCompleted, sol.UnitId
      FROM dbo.WmsTaskLines tl
      JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
      JOIN dbo.SalesOrderLines sol ON sol.SalesOrderId = t.ReferenceId 
           AND sol.ItemId = tl.ItemId 
           AND (sol.ItemSpecId = tl.ItemSpecId OR (sol.ItemSpecId IS NULL AND tl.ItemSpecId IS NULL))
      WHERE tl.WmsTaskId = @taskId AND tl.QuantityCompleted > 0
    `);
    const lines = linesRes.recordset;
    if (lines.length === 0) return;

    // 3. Generate DO document number
    const { documentService } = await import('../common/documentService.js');
    const documentNo = await documentService.generateDocumentNumber(tx, 'DO', info.BranchId, new Date());

    // 4. Insert DO Header
    const headerReq = new sql.Request(tx);
    headerReq.input('docNo', sql.NVarChar(50), documentNo);
    headerReq.input('branchId', sql.Int, info.BranchId);
    headerReq.input('customerId', sql.Int, info.CustomerId);
    headerReq.input('salesOrderId', sql.Int, info.SalesOrderId);
    headerReq.input('shipTo', sql.NVarChar(1000), info.ShippingAddress);
    headerReq.input('createdBy', sql.Int, userId);

    const doHeaderRes = await headerReq.query(`
      INSERT INTO dbo.DeliveryOrders (
        DocumentNo, BranchId, SalesOrderId, CustomerId, DocumentDate, Status, ShipToAddress, CreatedBy
      )
      OUTPUT INSERTED.DeliveryOrderId
      VALUES (
        @docNo, @branchId, @salesOrderId, @customerId, CAST(SYSUTCDATETIME() AS DATE), 'draft', @shipTo, @createdBy
      )
    `);
    const deliveryOrderId = doHeaderRes.recordset[0].DeliveryOrderId;

    // 5. Insert DO Lines
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineReq = new sql.Request(tx);
      lineReq.input('doId', sql.Int, deliveryOrderId);
      lineReq.input('lineNum', sql.Int, idx + 1);
      lineReq.input('itemId', sql.Int, line.ItemId);
      lineReq.input('qty', sql.Decimal(18, 4), line.QuantityCompleted);
      lineReq.input('unitId', sql.Int, line.UnitId);
      lineReq.input('itemSpecId', sql.Int, line.ItemSpecId || null);

      await lineReq.query(`
        INSERT INTO dbo.DeliveryOrderLines (DeliveryOrderId, LineNum, ItemId, Quantity, UnitId, ItemSpecId)
        VALUES (@doId, @lineNum, @itemId, @qty, @unitId, @itemSpecId)
      `);
    }

    // 6. Log Status History
    const histReq = new sql.Request(tx);
    histReq.input('docId', sql.Int, deliveryOrderId);
    histReq.input('userId', sql.Int, userId);
    await histReq.query(`
      INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
      VALUES ('DO', @docId, NULL, 'draft', @userId, 'Delivery Order auto-created from Picking confirmation')
    `);
  },

  async allocateWaveInventory(waveId, tx) {
    // 1. Fetch all uncompleted picking task lines in the wave
    const linesReq = new sql.Request(tx);
    linesReq.input('waveId', sql.Int, waveId);
    const linesRes = await linesReq.query(`
      SELECT tl.WmsTaskLineId, tl.WmsTaskId, tl.ItemId, tl.ItemSpecId, tl.QuantityRequired, t.WarehouseId
      FROM dbo.WmsTaskLines tl
      JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
      WHERE t.WaveId = @waveId AND tl.QuantityCompleted = 0 AND t.Status <> 'completed'
    `);
    const taskLines = linesRes.recordset;

    for (const line of taskLines) {
      // 2. Query available stock for this item & spec in FIFO order
      const stockReq = new sql.Request(tx);
      stockReq.input('itemId', sql.Int, line.ItemId);
      stockReq.input('itemSpecId', sql.Int, line.ItemSpecId || null);
      stockReq.input('whId', sql.Int, line.WarehouseId);

      const stockRes = await stockReq.query(`
        SELECT iu.InventoryUnitId, iu.LocationId, iu.LotId, lot.LotNo, iu.PalletNo, 
               (iu.QtySheet - ISNULL((
                 SELECT SUM(tl.QuantityRequired - tl.QuantityCompleted)
                 FROM dbo.WmsTaskLines tl
                 JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
                 WHERE tl.InventoryUnitId = iu.InventoryUnitId
                   AND t.Status = 'open'
               ), 0)) AS AvailableQty
        FROM dbo.InventoryUnits iu
        JOIN dbo.Lots lot ON lot.LotId = iu.LotId
        WHERE iu.ItemId = @itemId
          AND (iu.ItemSpecId = @itemSpecId OR (iu.ItemSpecId IS NULL AND @itemSpecId IS NULL))
          AND iu.WarehouseId = @whId
          AND (iu.QtySheet - ISNULL((
                 SELECT SUM(tl.QuantityRequired - tl.QuantityCompleted)
                 FROM dbo.WmsTaskLines tl
                 JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
                 WHERE tl.InventoryUnitId = iu.InventoryUnitId
                   AND t.Status = 'open'
               ), 0)) > 0
        ORDER BY lot.CreatedAt ASC
      `);

      let remainingToAllocate = line.QuantityRequired;
      const stockLayers = stockRes.recordset;

      for (let i = 0; i < stockLayers.length && remainingToAllocate > 0; i++) {
        const layer = stockLayers[i];
        const allocQty = Math.min(remainingToAllocate, layer.AvailableQty);

        if (allocQty <= 0) continue;

        if (remainingToAllocate === line.QuantityRequired) {
          // This is the first allocation layer. Update the existing line.
          const updateReq = new sql.Request(tx);
          updateReq.input('lineId', sql.BigInt, line.WmsTaskLineId);
          updateReq.input('qtyReq', sql.Decimal(18, 4), allocQty);
          updateReq.input('fromLoc', sql.Int, layer.LocationId);
          updateReq.input('lotId', sql.BigInt, layer.LotId);
          updateReq.input('unitId', sql.BigInt, layer.InventoryUnitId);

          await updateReq.query(`
            UPDATE dbo.WmsTaskLines
            SET FromLocationId = @fromLoc,
                LotId = @lotId,
                InventoryUnitId = @unitId,
                QuantityRequired = @qtyReq
            WHERE WmsTaskLineId = @lineId
          `);
        } else {
          // We need to split: insert a new line in WmsTaskLines.
          const insertReq = new sql.Request(tx);
          insertReq.input('taskId', sql.BigInt, line.WmsTaskId);
          insertReq.input('itemId', sql.Int, line.ItemId);
          insertReq.input('itemSpecId', sql.Int, line.ItemSpecId || null);
          insertReq.input('qtyReq', sql.Decimal(18, 4), allocQty);
          insertReq.input('fromLoc', sql.Int, layer.LocationId);
          insertReq.input('lotId', sql.BigInt, layer.LotId);
          insertReq.input('unitId', sql.BigInt, layer.InventoryUnitId);

          // Find other fields to copy (like ToLocationId, InventoryReservationId, Remark)
          const copyReq = new sql.Request(tx);
          copyReq.input('lineId', sql.BigInt, line.WmsTaskLineId);
          const copyRes = await copyReq.query(`
            SELECT ToLocationId, InventoryReservationId, Remark
            FROM dbo.WmsTaskLines
            WHERE WmsTaskLineId = @lineId
          `);
          const originalLine = copyRes.recordset[0];
          const toLocId = originalLine ? originalLine.ToLocationId : null;
          const resId = originalLine ? originalLine.InventoryReservationId : null;
          const remark = originalLine ? originalLine.Remark : null;

          insertReq.input('toLoc', sql.Int, toLocId);
          insertReq.input('resId', sql.BigInt, resId);
          insertReq.input('remark', sql.NVarChar(1000), remark);

          await insertReq.query(`
            INSERT INTO dbo.WmsTaskLines (
              WmsTaskId, ItemId, ItemSpecId, QuantityRequired, QuantityCompleted, 
              LotId, InventoryReservationId, InventoryUnitId, FromLocationId, ToLocationId, Remark
            )
            VALUES (
              @taskId, @itemId, @itemSpecId, @qtyReq, 0, 
              @lotId, @resId, @unitId, @fromLoc, @toLoc, @remark
            )
          `);
        }

        // No separate AllocatedQty column update needed (calculated dynamically)

        // Update matching reservation if present
        const copyReq = new sql.Request(tx);
        copyReq.input('lineId', sql.BigInt, line.WmsTaskLineId);
        const copyRes = await copyReq.query(`SELECT InventoryReservationId FROM dbo.WmsTaskLines WHERE WmsTaskLineId = @lineId`);
        const resId = copyRes.recordset[0]?.InventoryReservationId;
        if (resId) {
          const resReq = new sql.Request(tx);
          resReq.input('resId', sql.BigInt, resId);
          await resReq.query(`
            UPDATE dbo.InventoryReservations
            SET Status = 'allocated'
            WHERE InventoryReservationId = @resId AND Status = 'open'
          `);
        }

        remainingToAllocate -= allocQty;
      }
    }
  },

  async resetAndReallocateWave({ waveId, userId }, existingTx = null) {
    const execute = async (tx) => {
      // 1. Fetch wave details and make sure status is not completed
      const waveReq = new sql.Request(tx);
      waveReq.input('waveId', sql.Int, waveId);
      const waveRes = await waveReq.query(`SELECT Status FROM dbo.WmsWaves WHERE WmsWaveId = @waveId`);
      if (waveRes.recordset.length === 0) throw badRequest('Wave not found');
      if (waveRes.recordset[0].Status === 'completed') throw badRequest('Wave is already completed');

      // 2. Fetch all tasks in the wave
      const tasksRes = await waveReq.query(`SELECT WmsTaskId FROM dbo.WmsTasks WHERE WaveId = @waveId`);
      const taskIds = tasksRes.recordset.map(t => t.WmsTaskId);

      for (const taskId of taskIds) {
        // 3. Find task lines in the wave
        const linesReq = new sql.Request(tx);
        linesReq.input('taskId', sql.BigInt, taskId);
        const linesRes = await linesReq.query(`
          SELECT WmsTaskLineId, ItemId, ItemSpecId, InventoryReservationId, InventoryUnitId, QuantityRequired, QuantityCompleted
          FROM dbo.WmsTaskLines
          WHERE WmsTaskId = @taskId
        `);
        const lines = linesRes.recordset;

        // No separate AllocatedQty column reset needed (calculated dynamically)

        // 4. Merge split lines. Group by ItemId, ItemSpecId, InventoryReservationId
        const groups = {};
        for (const line of lines) {
          if (line.QuantityCompleted > 0) continue; // Skip completed lines
          const key = `${line.ItemId}-${line.ItemSpecId || 'null'}-${line.InventoryReservationId || 'null'}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(line);
        }

        for (const key in groups) {
          const groupLines = groups[key];
          if (groupLines.length > 1) {
            const firstLine = groupLines[0];
            const totalQty = groupLines.reduce((sum, l) => sum + l.QuantityRequired, 0);

            // Update first line
            const updateReq = new sql.Request(tx);
            updateReq.input('lineId', sql.BigInt, firstLine.WmsTaskLineId);
            updateReq.input('totalQty', sql.Decimal(18, 4), totalQty);
            await updateReq.query(`
              UPDATE dbo.WmsTaskLines
              SET QuantityRequired = @totalQty,
                  FromLocationId = NULL,
                  LotId = NULL,
                  InventoryUnitId = NULL
              WHERE WmsTaskLineId = @lineId
            `);

            // Delete the other lines
            for (let i = 1; i < groupLines.length; i++) {
              const deleteReq = new sql.Request(tx);
              deleteReq.input('lineId', sql.BigInt, groupLines[i].WmsTaskLineId);
              await deleteReq.query(`DELETE FROM dbo.WmsTaskLines WHERE WmsTaskLineId = @lineId`);
            }
          } else if (groupLines.length === 1) {
            // Just reset the allocation fields
            const resetReq = new sql.Request(tx);
            resetReq.input('lineId', sql.BigInt, groupLines[0].WmsTaskLineId);
            await resetReq.query(`
              UPDATE dbo.WmsTaskLines
              SET FromLocationId = NULL,
                  LotId = NULL,
                  InventoryUnitId = NULL
              WHERE WmsTaskLineId = @lineId
            `);
          }
        }
      }

      // 5. Run FIFO allocation again
      await this.allocateWaveInventory(waveId, tx);

      return { success: true };
    };

    if (existingTx) {
      return await execute(existingTx);
    } else {
      return await mssqlTransaction('DEFAULT', execute);
    }
  },

  async splitTaskLine({ taskId, lineId, splitQty, userId }, existingTx = null) {
    const execute = async (tx) => {
      // 1. Get task details and verify status is not completed
      const taskReq = new sql.Request(tx);
      taskReq.input('taskId', sql.BigInt, taskId);
      const taskRes = await taskReq.query(`SELECT Status FROM dbo.WmsTasks WHERE WmsTaskId = @taskId`);
      if (taskRes.recordset.length === 0) throw badRequest('WMS Task not found');
      if (taskRes.recordset[0].Status === 'completed') throw badRequest('WMS Task is already completed');

      // 2. Fetch the target line
      const lineReq = new sql.Request(tx);
      lineReq.input('lineId', sql.BigInt, lineId);
      lineReq.input('taskId', sql.BigInt, taskId);
      const lineRes = await lineReq.query(`
        SELECT WmsTaskLineId, ItemId, ItemSpecId, QuantityRequired, QuantityCompleted, 
               LotId, InventoryReservationId, InventoryUnitId, FromLocationId, ToLocationId, Remark
        FROM dbo.WmsTaskLines
        WHERE WmsTaskLineId = @lineId AND WmsTaskId = @taskId
      `);
      const line = lineRes.recordset[0];
      if (!line) throw badRequest('WMS Task Line not found');
      if (line.QuantityCompleted > 0) throw badRequest('Cannot split a completed task line');

      const qtyReq = Number(line.QuantityRequired);
      const sQty = Number(splitQty);
      if (isNaN(sQty) || sQty <= 0) throw badRequest('Split quantity must be greater than zero');
      if (sQty >= qtyReq) throw badRequest('Split quantity must be less than the required quantity');

      const newQty = qtyReq - sQty;

      // 3. Update original line
      const updateReq = new sql.Request(tx);
      updateReq.input('lineId', sql.BigInt, lineId);
      updateReq.input('qty', sql.Decimal(18, 4), newQty);
      await updateReq.query(`
        UPDATE dbo.WmsTaskLines
        SET QuantityRequired = @qty,
            FromLocationId = NULL,
            LotId = NULL,
            InventoryUnitId = NULL
        WHERE WmsTaskLineId = @lineId
      `);

      // Original line allocation reset is handled by setting fields to NULL below, no AllocatedQty update needed

      // 4. Insert new split line
      const insertReq = new sql.Request(tx);
      insertReq.input('taskId', sql.BigInt, taskId);
      insertReq.input('itemId', sql.Int, line.ItemId);
      insertReq.input('itemSpecId', sql.Int, line.ItemSpecId || null);
      insertReq.input('qtyReq', sql.Decimal(18, 4), sQty);
      insertReq.input('resId', sql.BigInt, line.InventoryReservationId || null);
      insertReq.input('toLoc', sql.Int, line.ToLocationId || null);
      insertReq.input('remark', sql.NVarChar(1000), line.Remark || null);

      await insertReq.query(`
        INSERT INTO dbo.WmsTaskLines (
          WmsTaskId, ItemId, ItemSpecId, QuantityRequired, QuantityCompleted, 
          LotId, InventoryReservationId, InventoryUnitId, FromLocationId, ToLocationId, Remark
        )
        VALUES (
          @taskId, @itemId, @itemSpecId, @qtyReq, 0, 
          NULL, @resId, NULL, NULL, @toLoc, @remark
        )
      `);

      return { success: true };
    };

    if (existingTx) {
      return await execute(existingTx);
    } else {
      return await mssqlTransaction('DEFAULT', execute);
    }
  }
};

