import { sql, mssqlQuery, mssqlTransaction } from "../../lib/mssql.js";
import { stockService } from "../inventory/stockService.js";
import { unitConversionService } from "../inventory/unitConversionService.js";

function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function forbidden(message) {
    const error = new Error(message);
    error.status = 403;
    return error;
}

export const wmsTaskService = {
    /**
     * สร้าง WMS Task ใหม่ (รองรับการรันภายใน Transaction หรือนอก Transaction)
     */
    async createTask(
        {
            taskType,
            referenceType = null,
            referenceId = null,
            warehouseId,
            assignedTo = null,
            lines = [],
        },
        existingTx = null,
    ) {
        if (!taskType) throw badRequest("taskType is required");
        if (!warehouseId) throw badRequest("warehouseId is required");
        if (!lines || lines.length === 0)
            throw badRequest("At least one task line is required");

        const execute = async (tx) => {
            // 1. ตรวจสอบว่ามี TaskType นี้ไหม
            const typeReq = new sql.Request(tx);
            typeReq.input("taskType", sql.NVarChar(40), taskType);
            const typeRes = await typeReq.query(
                `SELECT 1 FROM dbo.WmsTaskTypes WHERE TaskTypeCode = @taskType`,
            );
            if (typeRes.recordset.length === 0) {
                throw badRequest(`Invalid TaskType: ${taskType}`);
            }

            // 2. สร้าง Header
            const headerReq = new sql.Request(tx);
            headerReq.input("taskType", sql.NVarChar(40), taskType);
            headerReq.input("refType", sql.NVarChar(40), referenceType);
            headerReq.input("refId", sql.Int, referenceId);
            headerReq.input("whId", sql.Int, warehouseId);
            headerReq.input("assignedTo", sql.Int, assignedTo);

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

                const requestedUnitId = line.unitId;
                if (!requestedUnitId) throw badRequest("UnitId is required for WMS task line");
                const conversion = await unitConversionService.convertToItemBase(tx, {
                    itemId: line.itemId,
                    itemSpecId: line.itemSpecId || null,
                    fromUnitId: requestedUnitId,
                    quantity: line.quantityRequired,
                });

                const lineReq = new sql.Request(tx);
                lineReq.input("taskId", sql.BigInt, wmsTaskId);
                lineReq.input("itemId", sql.Int, line.itemId);
                lineReq.input("itemSpecId", sql.Int, line.itemSpecId || null);
                lineReq.input("unitId", sql.Int, conversion.baseUnitId);
                lineReq.input("requestedUnitId", sql.Int, requestedUnitId);
                lineReq.input("lotId", sql.BigInt, line.lotId || null);
                lineReq.input(
                    "reservationId",
                    sql.BigInt,
                    line.inventoryReservationId || null,
                );
                lineReq.input(
                    "invUnitId",
                    sql.BigInt,
                    line.inventoryUnitId || null,
                );
                lineReq.input("fromLoc", sql.Int, line.fromLocationId || null);
                lineReq.input("toLoc", sql.Int, line.toLocationId || null);
                lineReq.input("qty", sql.Decimal(18, 4), conversion.baseQuantity);
                lineReq.input("requestedQty", sql.Decimal(18, 4), conversion.sourceQuantity);
                lineReq.input("conversionFactor", sql.Decimal(18, 8), conversion.conversionFactor);
                lineReq.input(
                    "remark",
                    sql.NVarChar(1000),
                    line.remark || null,
                );
                lineReq.input(
                    "palletNo",
                    sql.NVarChar(100),
                    line.palletNo || null,
                );

                await lineReq.query(`
          INSERT INTO dbo.WmsTaskLines (
            WmsTaskId, ItemId, ItemSpecId, UnitId, LotId, InventoryReservationId, InventoryUnitId,
            FromLocationId, ToLocationId, QuantityRequired, QuantityCompleted,
            RequestedQuantity, RequestedUnitId, UnitConversionFactor, Remark, PalletNo
          )
          VALUES (
            @taskId, @itemId, @itemSpecId, @unitId, @lotId, @reservationId, @invUnitId,
            @fromLoc, @toLoc, @qty, 0,
            @requestedQty, @requestedUnitId, @conversionFactor, @remark, @palletNo
          )
        `);
            }

            return wmsTaskId;
        };

        if (existingTx) {
            return await execute(existingTx);
        } else {
            return await mssqlTransaction("DEFAULT", execute);
        }
    },

    async getTasks(filters = {}) {
        let whereClause = "1=1";
        const inputs = {};

        if (filters.warehouseId) {
            whereClause += " AND t.WarehouseId = @whId";
            inputs.whId = { type: sql.Int, value: filters.warehouseId };
        }
        if (filters.status) {
            whereClause += " AND t.Status = @status";
            inputs.status = { type: sql.NVarChar(30), value: filters.status };
        }
        if (filters.taskType) {
            whereClause += " AND t.TaskType = @taskType";
            inputs.taskType = {
                type: sql.NVarChar(40),
                value: filters.taskType,
            };
        }
        if (filters.assignedTo) {
            whereClause += " AND t.AssignedTo = @assignedTo";
            inputs.assignedTo = { type: sql.Int, value: filters.assignedTo };
        }
        if (filters.unassociated === "true" || filters.unassociated === true) {
            whereClause += " AND t.WaveId IS NULL";
        }

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT 
        t.WmsTaskId, t.TaskType, ty.TaskTypeName, t.ReferenceType, t.ReferenceId,
        t.WarehouseId, w.WarehouseName,
        t.AssignedTo, u.DisplayName AS AssignedToName,
        t.ActionBy, ua.DisplayName AS ActionByName, ua.AvatarUrl AS ActionByAvatarUrl,
        t.CompletedBy, uc.DisplayName AS CompletedByName,
        t.Status, t.CreatedAt, t.ActionAt, t.CompletedAt
      FROM dbo.WmsTasks t
      LEFT JOIN dbo.WmsTaskTypes ty ON ty.TaskTypeCode = t.TaskType
      LEFT JOIN dbo.Warehouses w ON w.WarehouseId = t.WarehouseId
      LEFT JOIN dbo.Users u ON u.UserId = t.AssignedTo
      LEFT JOIN dbo.Users ua ON ua.UserId = t.ActionBy
      LEFT JOIN dbo.Users uc ON uc.UserId = t.CompletedBy
      WHERE ${whereClause}
      ORDER BY t.CreatedAt DESC
    `,
            { inputs },
        );

        return rows.map((r) => ({
            id: r.WmsTaskId,
            taskType: r.TaskType,
            taskTypeName: r.TaskTypeName,
            referenceType: r.ReferenceType,
            referenceId: r.ReferenceId,
            warehouseId: r.WarehouseId,
            warehouseName: r.WarehouseName,
            assignedTo: r.AssignedTo,
            assignedToName: r.AssignedToName || null,
            actionBy: r.ActionBy ?? null,
            actionByName: r.ActionByName || null,
            actionByAvatarUrl: r.ActionByAvatarUrl || null,
            status: r.Status,
            createdAt: r.CreatedAt,
            actionAt: r.ActionAt ?? null,
            completedAt: r.CompletedAt,
            completedBy: r.CompletedBy ?? null,
            completedByName: r.CompletedByName || null,
        }));
    },

    async getTaskById(taskId) {
        const headerRows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT 
        t.WmsTaskId, t.TaskType, ty.TaskTypeName, t.ReferenceType, t.ReferenceId,
        t.WarehouseId, w.WarehouseName,
        t.AssignedTo, u.DisplayName AS AssignedToName,
        t.ActionBy, ua.DisplayName AS ActionByName, ua.AvatarUrl AS ActionByAvatarUrl,
        t.CompletedBy, uc.DisplayName AS CompletedByName,
        t.Status, t.CreatedAt, t.ActionAt, t.CompletedAt, t.WaveId
      FROM dbo.WmsTasks t
      LEFT JOIN dbo.Users uc ON uc.UserId = t.CompletedBy
      LEFT JOIN dbo.Users ua ON ua.UserId = t.ActionBy
      LEFT JOIN dbo.WmsTaskTypes ty ON ty.TaskTypeCode = t.TaskType
      LEFT JOIN dbo.Warehouses w ON w.WarehouseId = t.WarehouseId
      LEFT JOIN dbo.Users u ON u.UserId = t.AssignedTo
      WHERE t.WmsTaskId = @taskId
    `,
            { inputs: { taskId: { type: sql.BigInt, value: taskId } } },
        );

        if (headerRows.length === 0) return null;
        const task = headerRows[0];

        const linesRows = await mssqlQuery(
            "DEFAULT",
            `
	      SELECT
	        l.WmsTaskLineId, l.ItemId, i.ItemCode, i.ItemName,
	        l.ItemSpecId, l.UnitId, uu.UnitCode, uu.UnitName,
	        l.RequestedQuantity, l.RequestedUnitId, ru.UnitCode AS RequestedUnitCode, ru.UnitName AS RequestedUnitName,
	        l.UnitConversionFactor,
	        l.LotId, lot.LotNo, l.InventoryReservationId, l.InventoryUnitId,
	        l.FromLocationId, fl.LocationCode AS FromLocationCode,
	        l.ToLocationId, tl.LocationCode AS ToLocationCode,
	        l.QuantityRequired, l.QuantityCompleted,
	        ispec.SalesSKU, ispec.SpecCode, ispec.SpecName,
	        l.Remark, l.PalletNo
	      FROM dbo.WmsTaskLines l
	      JOIN dbo.Items i ON i.ItemId = l.ItemId
	      JOIN dbo.Units uu ON uu.UnitId = l.UnitId
	      LEFT JOIN dbo.Units ru ON ru.UnitId = l.RequestedUnitId
	      LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = l.ItemSpecId
	      LEFT JOIN dbo.Lots lot ON lot.LotId = l.LotId
	      LEFT JOIN dbo.WarehouseLocations fl ON fl.LocationId = l.FromLocationId
	      LEFT JOIN dbo.WarehouseLocations tl ON tl.LocationId = l.ToLocationId
	      WHERE l.WmsTaskId = @taskId
	    `,
            { inputs: { taskId: { type: sql.BigInt, value: taskId } } },
        );

        return {
            id: task.WmsTaskId,
            taskType: task.TaskType,
            taskTypeName: task.TaskTypeName,
            referenceType: task.ReferenceType,
            referenceId: task.ReferenceId,
            warehouseId: task.WarehouseId,
            warehouseName: task.WarehouseName,
            assignedTo: task.AssignedTo,
            assignedToName: task.AssignedToName || null,
            actionBy: task.ActionBy ?? null,
            actionByName: task.ActionByName || null,
            actionByAvatarUrl: task.ActionByAvatarUrl || null,
            status: task.Status,
            createdAt: task.CreatedAt,
            actionAt: task.ActionAt ?? null,
            completedAt: task.CompletedAt,
            completedBy: task.CompletedBy ?? null,
            completedByName: task.CompletedByName || null,
            waveId: task.WaveId,
	            lines: linesRows.map((l) => ({
	                id: l.WmsTaskLineId,
	                itemId: l.ItemId,
	                itemCode: l.SalesSKU || l.ItemCode,
	                itemName: l.SpecName
	                    ? `${l.ItemName} - ${l.SpecName}`
	                    : l.ItemName,
	                itemSpecId: l.ItemSpecId,
	                unitId: l.UnitId,
	                unitCode: l.UnitCode,
	                unitName: l.UnitName,
	                requestedQuantity: l.RequestedQuantity ?? l.QuantityRequired,
	                requestedUnitId: l.RequestedUnitId ?? l.UnitId,
	                requestedUnitCode: l.RequestedUnitCode || l.UnitCode,
	                requestedUnitName: l.RequestedUnitName || l.UnitName,
	                unitConversionFactor: l.UnitConversionFactor ?? 1,
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
                remark: l.Remark || null,
                palletNo: l.PalletNo,
            })),
        };
    },

    async claimTask({ taskId, userId }, existingTx = null) {
        const execute = async (tx) => {
            const req = new sql.Request(tx);
            req.input("taskId", sql.BigInt, taskId);
            const res = await req.query(`
        SELECT WmsTaskId, Status, ActionBy
        FROM dbo.WmsTasks
        WHERE WmsTaskId = @taskId
      `);
            const task = res.recordset[0];
            if (!task) throw badRequest("WMS Task not found");
            if (["completed", "cancelled"].includes(task.Status))
                throw badRequest(
                    `WMS Task is not available in status: ${task.Status}`,
                );
            if (task.ActionBy && task.ActionBy !== userId)
                throw badRequest("WMS Task is being handled by another user");

            const upd = new sql.Request(tx);
            upd.input("taskId", sql.BigInt, taskId);
            upd.input("userId", sql.Int, userId);
            await upd.query(`
        UPDATE dbo.WmsTasks
        SET
          ActionBy = @userId,
          ActionAt = COALESCE(ActionAt, SYSUTCDATETIME()),
          AssignedTo = COALESCE(AssignedTo, @userId)
        WHERE WmsTaskId = @taskId
      `);
            return { success: true };
        };

        if (existingTx) return await execute(existingTx);
        return await mssqlTransaction("DEFAULT", execute);
    },

    async unclaimTask(
        { taskId, userId, privileged = false },
        existingTx = null,
    ) {
        const execute = async (tx) => {
            const req = new sql.Request(tx);
            req.input("taskId", sql.BigInt, taskId);
            const res = await req.query(`
        SELECT WmsTaskId, Status, ActionBy
        FROM dbo.WmsTasks
        WHERE WmsTaskId = @taskId
      `);
            const task = res.recordset[0];
            if (!task) throw badRequest("WMS Task not found");
            if (["completed", "cancelled"].includes(task.Status))
                throw badRequest(
                    `WMS Task is not available in status: ${task.Status}`,
                );

            if (!task.ActionBy) return { success: true };
            if (task.ActionBy !== userId && !privileged)
                throw forbidden(
                    "Forbidden: cannot unclaim task owned by another user",
                );

            const upd = new sql.Request(tx);
            upd.input("taskId", sql.BigInt, taskId);
            await upd.query(`
        UPDATE dbo.WmsTasks
        SET ActionBy = NULL, ActionAt = NULL
        WHERE WmsTaskId = @taskId
      `);
            return { success: true };
        };

        if (existingTx) return await execute(existingTx);
        return await mssqlTransaction("DEFAULT", execute);
    },

    async cancelTask({ taskId, userId, notes = null }, existingTx = null) {
        const execute = async (tx) => {
            const req = new sql.Request(tx);
            req.input("taskId", sql.BigInt, taskId);
            const res = await req.query(`
        SELECT WmsTaskId, TaskType, Status
        FROM dbo.WmsTasks
        WHERE WmsTaskId = @taskId
      `);
            const task = res.recordset[0];
            if (!task) throw badRequest("WMS Task not found");
            if (task.TaskType !== "transfer")
                throw badRequest("Only transfer tasks can be cancelled here");
            if (task.Status === "completed")
                throw badRequest("Cannot cancel a completed task");
            if (task.Status === "cancelled") return { success: true };

            const upd = new sql.Request(tx);
            upd.input("taskId", sql.BigInt, taskId);
            await upd.query(`
        UPDATE dbo.WmsTasks
        SET
          Status = 'cancelled',
          ActionBy = NULL,
          ActionAt = NULL,
          CompletedAt = COALESCE(CompletedAt, SYSUTCDATETIME())
        WHERE WmsTaskId = @taskId
      `);

            const hist = new sql.Request(tx);
            hist.input("docId", sql.BigInt, taskId);
            hist.input("userId", sql.Int, userId);
            hist.input("fromStatus", sql.NVarChar(30), task.Status);
            hist.input(
                "notes",
                sql.NVarChar(1000),
                notes
                    ? String(notes).trim().slice(0, 1000)
                    : "Cancelled transfer task",
            );
            await hist.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('WMS_TASK', @docId, @fromStatus, 'cancelled', @userId, @notes)
      `);

            return { success: true };
        };

        if (existingTx) return await execute(existingTx);
        return await mssqlTransaction("DEFAULT", execute);
    },

    async createWave({ taskIds, userId }, existingTx = null) {
        if (!taskIds || taskIds.length === 0)
            throw badRequest("At least one WMS task ID is required");

        const execute = async (tx) => {
            // 1. Generate WaveNo: WV-YYYYMMDD-XXXX
            const dateStr = new Date()
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "");
            const randStr = Math.floor(1000 + Math.random() * 9000).toString();
            const waveNo = `WV-${dateStr}-${randStr}`;

            // 2. Create Wave Header
            const headerReq = new sql.Request(tx);
            headerReq.input("waveNo", sql.NVarChar(50), waveNo);
            headerReq.input("userId", sql.Int, userId);
            const headerRes = await headerReq.query(`
        INSERT INTO dbo.WmsWaves (WaveNo, Status, CreatedBy)
        OUTPUT INSERTED.WmsWaveId
        VALUES (@waveNo, 'open', @userId)
      `);
            const waveId = headerRes.recordset[0].WmsWaveId;

            // 3. Update tasks with WaveId
            for (const taskId of taskIds) {
                const updateReq = new sql.Request(tx);
                updateReq.input("waveId", sql.Int, waveId);
                updateReq.input("taskId", sql.BigInt, taskId);
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
            return await mssqlTransaction("DEFAULT", execute);
        }
    },

    async getWaves(filters = {}) {
        let whereClause = "1=1";
        const inputs = {};

        if (filters.status) {
            whereClause += " AND w.Status = @status";
            inputs.status = { type: sql.NVarChar(30), value: filters.status };
        }

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT 
        w.WmsWaveId, w.WaveNo, w.Status, w.CreatedBy, w.CreatedAt,
        w.ActionBy, w.ActionAt,
        w.CompletedAt,
        u.DisplayName AS CreatedByName,
        ua.DisplayName AS ActionByName, ua.AvatarUrl AS ActionByAvatarUrl,
        (SELECT COUNT(1) FROM dbo.WmsTasks t WHERE t.WaveId = w.WmsWaveId) AS TaskCount
      FROM dbo.WmsWaves w
      LEFT JOIN dbo.Users u ON u.UserId = w.CreatedBy
      LEFT JOIN dbo.Users ua ON ua.UserId = w.ActionBy
      WHERE ${whereClause}
      ORDER BY w.CreatedAt DESC
    `,
            { inputs },
        );

        return rows.map((r) => ({
            id: r.WmsWaveId,
            waveNo: r.WaveNo,
            status: r.Status,
            createdBy: r.CreatedBy,
            createdByName: r.CreatedByName,
            createdAt: r.CreatedAt,
            actionBy: r.ActionBy ?? null,
            actionByName: r.ActionByName || null,
            actionByAvatarUrl: r.ActionByAvatarUrl || null,
            actionAt: r.ActionAt ?? null,
            completedAt: r.CompletedAt,
            taskCount: r.TaskCount,
        }));
    },

    async getWaveById(waveId) {
        const waveRows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT w.WmsWaveId, w.WaveNo, w.Status, w.CreatedBy, w.CreatedAt,
             w.ActionBy, w.ActionAt,
             w.CompletedAt,
             u.DisplayName AS CreatedByName,
             ua.DisplayName AS ActionByName, ua.AvatarUrl AS ActionByAvatarUrl
      FROM dbo.WmsWaves w
      LEFT JOIN dbo.Users u ON u.UserId = w.CreatedBy
      LEFT JOIN dbo.Users ua ON ua.UserId = w.ActionBy
      WHERE w.WmsWaveId = @waveId
    `,
            { inputs: { waveId: { type: sql.Int, value: waveId } } },
        );

        if (waveRows.length === 0) return null;
        const wave = waveRows[0];

        const tasksRows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT t.WmsTaskId
      FROM dbo.WmsTasks t
      WHERE t.WaveId = @waveId
    `,
            { inputs: { waveId: { type: sql.Int, value: waveId } } },
        );

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
            actionBy: wave.ActionBy ?? null,
            actionByName: wave.ActionByName || null,
            actionByAvatarUrl: wave.ActionByAvatarUrl || null,
            actionAt: wave.ActionAt ?? null,
            completedAt: wave.CompletedAt,
            tasks,
        };
    },

    async claimWave({ waveId, userId }, existingTx = null) {
        const execute = async (tx) => {
            const req = new sql.Request(tx);
            req.input("waveId", sql.Int, waveId);
            const res = await req.query(`
        SELECT WmsWaveId, Status, ActionBy
        FROM dbo.WmsWaves
        WHERE WmsWaveId = @waveId
      `);
            const wave = res.recordset[0];
            if (!wave) throw badRequest("Wave not found");
            if (wave.Status === "completed")
                throw badRequest("Wave is already completed");
            if (wave.ActionBy && wave.ActionBy !== userId)
                throw badRequest("Wave is being handled by another user");

            const upd = new sql.Request(tx);
            upd.input("waveId", sql.Int, waveId);
            upd.input("userId", sql.Int, userId);
            await upd.query(`
        UPDATE dbo.WmsWaves
        SET
          ActionBy = @userId,
          ActionAt = COALESCE(ActionAt, SYSUTCDATETIME())
        WHERE WmsWaveId = @waveId
      `);
            return { success: true };
        };

        if (existingTx) return await execute(existingTx);
        return await mssqlTransaction("DEFAULT", execute);
    },

    async unclaimWave(
        { waveId, userId, privileged = false },
        existingTx = null,
    ) {
        const execute = async (tx) => {
            const req = new sql.Request(tx);
            req.input("waveId", sql.Int, waveId);
            const res = await req.query(`
        SELECT WmsWaveId, Status, ActionBy
        FROM dbo.WmsWaves
        WHERE WmsWaveId = @waveId
      `);
            const wave = res.recordset[0];
            if (!wave) throw badRequest("Wave not found");
            if (wave.Status === "completed")
                throw badRequest("Wave is already completed");

            if (!wave.ActionBy) return { success: true };
            if (wave.ActionBy !== userId && !privileged)
                throw forbidden(
                    "Forbidden: cannot unclaim wave owned by another user",
                );

            const upd = new sql.Request(tx);
            upd.input("waveId", sql.Int, waveId);
            await upd.query(`
        UPDATE dbo.WmsWaves
        SET ActionBy = NULL, ActionAt = NULL
        WHERE WmsWaveId = @waveId
      `);

            const taskReq = new sql.Request(tx);
            taskReq.input("waveId", sql.Int, waveId);
            if (privileged) {
                await taskReq.query(`
          UPDATE dbo.WmsTasks
          SET ActionBy = NULL, ActionAt = NULL
          WHERE WaveId = @waveId AND Status <> 'completed'
        `);
            } else {
                taskReq.input("userId", sql.Int, userId);
                await taskReq.query(`
          UPDATE dbo.WmsTasks
          SET ActionBy = NULL, ActionAt = NULL
          WHERE WaveId = @waveId AND Status <> 'completed' AND ActionBy = @userId
        `);
            }

            return { success: true };
        };

        if (existingTx) return await execute(existingTx);
        return await mssqlTransaction("DEFAULT", execute);
    },

    async confirmTask({ taskId, lines = [], userId }, existingTx = null) {
        const execute = async (tx) => {
            // 1. Get task details
            const taskReq = new sql.Request(tx);
            taskReq.input("taskId", sql.BigInt, taskId);
            const taskRes = await taskReq.query(`
        SELECT WmsTaskId, TaskType, ReferenceType, ReferenceId, WarehouseId, Status, WaveId, ActionBy
        FROM dbo.WmsTasks
        WHERE WmsTaskId = @taskId
      `);
            const task = taskRes.recordset[0];
            if (!task) throw badRequest("WMS Task not found");
            if (["completed", "cancelled"].includes(task.Status))
                throw badRequest(
                    `WMS Task is not available in status: ${task.Status}`,
                );
            if (task.ActionBy && task.ActionBy !== userId)
                throw badRequest("WMS Task is being handled by another user");

            // Over-pick validation at backend (Item/Spec level for picking tasks)
            if (task.TaskType === "picking") {
                const dbLinesRes = await tx.request()
                    .input("taskId", sql.BigInt, taskId)
                    .query(`
                        SELECT tl.WmsTaskLineId, tl.ItemId, tl.ItemSpecId, tl.QuantityRequired, i.ItemCode
                        FROM dbo.WmsTaskLines tl
                        JOIN dbo.Items i ON i.ItemId = tl.ItemId
                        WHERE tl.WmsTaskId = @taskId
                    `);
                
                const requiredMap = new Map();
                for (const dbL of dbLinesRes.recordset) {
                    const key = `${dbL.ItemId}-${dbL.ItemSpecId || 'null'}`;
                    const existing = requiredMap.get(key);
                    if (existing) {
                        existing.requiredQty += Number(dbL.QuantityRequired || 0);
                    } else {
                        requiredMap.set(key, {
                            requiredQty: Number(dbL.QuantityRequired || 0),
                            itemCode: dbL.ItemCode
                        });
                    }
                }

                const confirmedMap = new Map();
                for (const reqL of lines) {
                    if (!reqL.lineId) continue;
                    const dbLine = dbLinesRes.recordset.find(l => l.WmsTaskLineId === reqL.lineId);
                    if (!dbLine) continue;
                    
                    const key = `${dbLine.ItemId}-${dbLine.ItemSpecId || 'null'}`;
                    const qty = Number(reqL.quantityCompleted || 0);
                    confirmedMap.set(key, (confirmedMap.get(key) || 0) + qty);
                }

                for (const [key, qtyConfirmed] of confirmedMap.entries()) {
                    const reqInfo = requiredMap.get(key);
                    const qtyRequired = reqInfo ? reqInfo.requiredQty : 0;
                    if (qtyConfirmed > qtyRequired) {
                        const itemCode = reqInfo ? reqInfo.itemCode : 'Unknown';
                        throw badRequest(`Over-pick at SKU: ${itemCode}`);
                    }
                }
            }

            // 2. Update each line
            for (const line of lines) {
                if (!line.lineId) continue;

                const qtyCompleted = line.quantityCompleted || 0;
                const lotId = line.lotId || null;
                let inventoryUnitId = line.inventoryUnitId || null;
                const fromLocationId = line.fromLocationId || null;
                const toLocationId = line.toLocationId || null;
                const fromPalletNo = line.fromPalletNo
                    ? String(line.fromPalletNo).trim()
                    : null;
                const toPalletNoRaw =
                    line.toPalletNo || line.palletNo || line.palletId || null;
                const toPalletNo = toPalletNoRaw
                    ? String(toPalletNoRaw).trim()
                    : null;

                const lineReq = new sql.Request(tx);
                lineReq.input("lineId", sql.BigInt, line.lineId);
                lineReq.input("taskId", sql.BigInt, taskId);
                lineReq.input("qty", sql.Decimal(18, 4), qtyCompleted);
                lineReq.input("lotId", sql.BigInt, lotId);
                lineReq.input("fromLoc", sql.Int, fromLocationId);
                lineReq.input("toLoc", sql.Int, toLocationId);

                // Fetch task line details to get reservation and item info
	                const taskLineRes = await lineReq.query(`
	          SELECT InventoryReservationId, ItemId, ItemSpecId, UnitId, LotId, FromLocationId, ToLocationId, QuantityRequired
	          FROM dbo.WmsTaskLines
	          WHERE WmsTaskLineId = @lineId AND WmsTaskId = @taskId
	        `);
                const taskLine = taskLineRes.recordset[0];
                if (!taskLine) continue;

                const movementUnitId = taskLine.UnitId ?? null;

                // Resolve inventoryUnitId by pallet/track scan (picking only)
                if (task.TaskType === "picking") {
                    const inputPalletNo =
                        line.palletNo || line.palletId || null;
                    if (inputPalletNo) {
                        const iuLookupRes = await tx
                            .request()
                            .input(
                                "palletNo",
                                sql.NVarChar(100),
                                String(inputPalletNo).trim(),
                            )
                            .input("itemId", sql.Int, taskLine.ItemId).query(`
	              SELECT TOP 1 InventoryUnitId 
	              FROM dbo.InventoryUnits 
	              WHERE (PalletNo = @palletNo OR TrackingNo = @palletNo) AND ItemId = @itemId
	            `);
                        if (iuLookupRes.recordset.length > 0) {
                            inventoryUnitId =
                                iuLookupRes.recordset[0].InventoryUnitId;
                        }
                    }
                }

                // If it's a picking task, deduct from the source InventoryUnit
                if (
                    task.TaskType === "picking" &&
                    inventoryUnitId &&
                    qtyCompleted > 0
                ) {
                    await tx
                        .request()
                        .input("unitId", sql.BigInt, inventoryUnitId)
                        .input("qty", sql.Decimal(18, 4), qtyCompleted).query(`
              UPDATE dbo.InventoryUnits
              SET QtySheet = CASE WHEN QtySheet - @qty >= 0 THEN QtySheet - @qty ELSE 0 END
              WHERE InventoryUnitId = @unitId
            `);

                    await tx
                        .request()
                        .input("unitId", sql.BigInt, inventoryUnitId).query(`
              DELETE FROM dbo.InventoryUnits
              WHERE InventoryUnitId = @unitId AND QtySheet <= 0
            `);
                }

                // If it's a putaway task and toLocationId is specified, create or update the InventoryUnit
                if (task.TaskType === "putaway" && toLocationId) {
                    const finalLotId = lotId || taskLine.LotId;
                    let lotNo = "";
                    if (finalLotId) {
                        const lotRes = await tx
                            .request()
                            .input("lotId", sql.BigInt, finalLotId)
                            .query(
                                `SELECT LotNo FROM dbo.Lots WHERE LotId = @lotId`,
                            );
                        if (lotRes.recordset.length > 0) {
                            lotNo = lotRes.recordset[0].LotNo;
                        }
                    }

                    let trackNo =
                        line.palletId || line.palletNo || taskLine.PalletNo;
                    if (!trackNo) {
                        const yy = String(new Date().getFullYear()).slice(-2); // e.g. '26'
                        const prefix = `PLT${yy}`;
                        const maxRes = await tx
                            .request()
                            .input("prefix", sql.NVarChar(20), prefix + "%")
                            .query(`
                SELECT MAX(PalletNo) AS MaxPalletNo
                FROM (
                  SELECT TrackingNo AS PalletNo FROM dbo.InventoryUnits WHERE TrackingNo LIKE @prefix
                  UNION ALL
                  SELECT PalletNo FROM dbo.GoodsReceiptLines WHERE PalletNo LIKE @prefix
                  UNION ALL
                  SELECT PalletNo FROM dbo.WmsTaskLines WHERE PalletNo LIKE @prefix
                ) AS AllPallets
              `);
                        let nextSeq = 1;
                        if (
                            maxRes.recordset.length > 0 &&
                            maxRes.recordset[0].MaxPalletNo
                        ) {
                            const maxPalletNo = maxRes.recordset[0].MaxPalletNo;
                            const numPart = maxPalletNo.substring(
                                prefix.length,
                            );
                            const num = parseInt(numPart, 10);
                            if (!isNaN(num)) {
                                nextSeq = num + 1;
                            }
                        }
                        trackNo = prefix + String(nextSeq).padStart(5, "0");
                    }

                    // Check if InventoryUnit already exists with this TrackingNo
                    const iuRes = await tx
                        .request()
                        .input("trackNo", sql.NVarChar(100), trackNo)
                        .query(
                            `SELECT InventoryUnitId FROM dbo.InventoryUnits WHERE TrackingNo = @trackNo`,
                        );

                    if (iuRes.recordset.length > 0) {
                        inventoryUnitId = iuRes.recordset[0].InventoryUnitId;
                        // Update quantity, location, and status
                        await tx
                            .request()
                            .input("unitId", sql.BigInt, inventoryUnitId)
                            .input("qty", sql.Decimal(18, 4), qtyCompleted)
                            .input("locId", sql.Int, toLocationId)
                            .input("whId", sql.Int, task.WarehouseId).query(`
                UPDATE dbo.InventoryUnits
                SET QtySheet = QtySheet + @qty,
                    LocationId = @locId,
                    WarehouseId = @whId,
                    InventoryStatus = 'available'
                WHERE InventoryUnitId = @unitId
              `);
                    } else {
                        // Insert new InventoryUnit
                        const insertIuRes = await tx
                            .request()
                            .input("itemId", sql.Int, taskLine.ItemId)
                            .input(
                                "itemSpecId",
                                sql.Int,
                                taskLine.ItemSpecId || null,
                            )
                            .input("trackNo", sql.NVarChar(100), trackNo)
                            .input("lotId", sql.BigInt, finalLotId)
                            .input("whId", sql.Int, task.WarehouseId)
                            .input("locId", sql.Int, toLocationId)
                            .input("qty", sql.Decimal(18, 4), qtyCompleted)
                            .input("palletNo", sql.NVarChar(100), trackNo)
                            .query(`
                INSERT INTO dbo.InventoryUnits (ItemId, ItemSpecId, TrackingNo, LotId, WarehouseId, LocationId, QtySheet, PalletNo, InventoryStatus)
                OUTPUT INSERTED.InventoryUnitId
                VALUES (@itemId, @itemSpecId, @trackNo, @lotId, @whId, @locId, @qty, @palletNo, 'available')
              `);
                        inventoryUnitId =
                            insertIuRes.recordset[0].InventoryUnitId;
                    }

                    // Relocate stock in StockOnHand (Deduct from staging / source, add to target)
                    if (taskLine.FromLocationId) {
                        await stockService.updateStockOnHand(tx, {
                            itemId: taskLine.ItemId,
                            itemSpecId: taskLine.ItemSpecId,
                            warehouseId: task.WarehouseId,
                            locationId: taskLine.FromLocationId,
                            lotId: finalLotId,
                            lotNo: lotNo,
                            quantityDelta: -qtyCompleted,
                        });
                    }

                    await stockService.updateStockOnHand(tx, {
                        itemId: taskLine.ItemId,
                        itemSpecId: taskLine.ItemSpecId,
                        warehouseId: task.WarehouseId,
                        locationId: toLocationId,
                        lotId: finalLotId,
                        lotNo: lotNo,
                        quantityDelta: qtyCompleted,
                    });

                    // Insert stock relocation movement
                    await stockService.insertStockMovement(tx, {
                        movementType: "transfer",
                        referenceType: "WMS",
                        referenceId: taskId,
                        itemId: taskLine.ItemId,
                        itemSpecId: taskLine.ItemSpecId,
                        fromWarehouseId: task.WarehouseId,
                        fromLocationId: taskLine.FromLocationId,
                        toWarehouseId: task.WarehouseId,
                        toLocationId: toLocationId,
                        lotId: finalLotId,
                        lotNo: lotNo,
                        quantity: qtyCompleted,
                        createdBy: userId || 1,
                        unitId: movementUnitId,
                    });
                }

                if (task.TaskType === "transfer") {
                    if (!inventoryUnitId)
                        throw badRequest(
                            "inventoryUnitId is required for transfer",
                        );
                    if (!fromLocationId)
                        throw badRequest(
                            "fromLocationId is required for transfer",
                        );
                    if (!toLocationId)
                        throw badRequest(
                            "toLocationId is required for transfer",
                        );
                    if (!fromPalletNo)
                        throw badRequest(
                            "fromPalletNo is required for transfer",
                        );
                    if (qtyCompleted <= 0)
                        throw badRequest(
                            "quantityCompleted must be greater than zero",
                        );

	                    const unitRes = await tx
	                        .request()
	                        .input("unitId", sql.BigInt, inventoryUnitId).query(`
	                SELECT iu.InventoryUnitId, iu.ItemId, iu.ItemSpecId, iu.TrackingNo, iu.PalletNo,
	                       iu.LotId, l.LotNo,
	                       iu.WarehouseId, iu.LocationId, iu.QtySheet
	                FROM dbo.InventoryUnits iu
	                LEFT JOIN dbo.Lots l ON l.LotId = iu.LotId
	                WHERE iu.InventoryUnitId = @unitId
	              `);
                    if (unitRes.recordset.length === 0)
                        throw badRequest("Inventory unit not found");
                    const unit = unitRes.recordset[0];

                    const fromPalletNorm = fromPalletNo.toLowerCase();
                    const okPallet = [unit.TrackingNo, unit.PalletNo]
                        .filter(Boolean)
                        .some(
                            (p) =>
                                String(p).trim().toLowerCase() ===
                                fromPalletNorm,
                        );
                    if (!okPallet)
                        throw badRequest(
                            "Source pallet does not match the inventory unit",
                        );
                    if (Number(unit.LocationId) !== Number(fromLocationId))
                        throw badRequest(
                            "Source location does not match the inventory unit",
                        );

                    const availableQty = Number(unit.QtySheet || 0);
                    if (Number(qtyCompleted) !== availableQty) {
                        throw badRequest(
                            "Partial transfers are not supported. Move the full unit quantity or split the unit first.",
                        );
                    }

                    const toWarehouseId =
                        task.ReferenceType === "INVENTORY_TRANSFER" &&
                        task.ReferenceId
                            ? Number(task.ReferenceId)
                            : Number(unit.WarehouseId);

                    const toLocRes = await tx
                        .request()
                        .input("locId", sql.Int, toLocationId)
                        .query(
                            `SELECT WarehouseId FROM dbo.WarehouseLocations WHERE LocationId = @locId`,
                        );
                    if (toLocRes.recordset.length === 0)
                        throw badRequest("Target location not found");
                    if (
                        Number(toLocRes.recordset[0].WarehouseId) !==
                        toWarehouseId
                    ) {
                        throw badRequest(
                            "Target location does not belong to the target warehouse",
                        );
                    }

                    const finalPalletNo =
                        toPalletNo ||
                        taskLine.PalletNo ||
                        unit.PalletNo ||
                        null;
                    await tx
                        .request()
                        .input("unitId", sql.BigInt, inventoryUnitId)
                        .input("toWhId", sql.Int, toWarehouseId)
                        .input("toLocId", sql.Int, toLocationId)
                        .input("palletNo", sql.NVarChar(100), finalPalletNo)
                        .query(`
                UPDATE dbo.InventoryUnits
                SET WarehouseId = @toWhId,
                    LocationId = @toLocId,
                    PalletNo = @palletNo
                WHERE InventoryUnitId = @unitId
              `);

                    await stockService.updateStockOnHand(tx, {
                        itemId: unit.ItemId,
                        itemSpecId: unit.ItemSpecId,
                        warehouseId: unit.WarehouseId,
                        locationId: unit.LocationId,
                        lotId: unit.LotId,
                        lotNo: unit.LotNo,
                        quantityDelta: -qtyCompleted,
                    });

                    await stockService.updateStockOnHand(tx, {
                        itemId: unit.ItemId,
                        itemSpecId: unit.ItemSpecId,
                        warehouseId: toWarehouseId,
                        locationId: toLocationId,
                        lotId: unit.LotId,
                        lotNo: unit.LotNo,
                        quantityDelta: qtyCompleted,
                    });

	                    await stockService.insertStockMovement(tx, {
	                        movementType: "transfer",
	                        referenceType: "WMS",
	                        referenceId: taskId,
	                        itemId: unit.ItemId,
	                        itemSpecId: unit.ItemSpecId,
	                        fromWarehouseId: unit.WarehouseId,
	                        fromLocationId: unit.LocationId,
	                        toWarehouseId,
	                        toLocationId,
	                        lotId: unit.LotId,
	                        lotNo: unit.LotNo,
	                        quantity: qtyCompleted,
	                        createdBy: userId || 1,
	                        unitId: movementUnitId,
	                    });
	                }

                lineReq.input("unitId", sql.BigInt, inventoryUnitId);
                lineReq.input(
                    "palletNo",
                    sql.NVarChar(100),
                    toPalletNo ||
                        line.palletId ||
                        line.palletNo ||
                        taskLine.PalletNo ||
                        null,
                );

                await lineReq.query(`
          UPDATE dbo.WmsTaskLines
          SET
            QuantityCompleted = @qty,
            LotId = COALESCE(@lotId, LotId),
            InventoryUnitId = COALESCE(@unitId, InventoryUnitId),
            FromLocationId = COALESCE(@fromLoc, FromLocationId),
            ToLocationId = COALESCE(@toLoc, ToLocationId),
            PalletNo = COALESCE(@palletNo, PalletNo)
          WHERE WmsTaskLineId = @lineId AND WmsTaskId = @taskId
        `);

                // Log short-pick incident if completed quantity is less than required (for picking tasks)
                if (task.TaskType === "picking" && qtyCompleted < taskLine.QuantityRequired) {
                    const shortageQty = taskLine.QuantityRequired - qtyCompleted;
                    const conditionVal = line.condition && line.condition !== 'good' ? String(line.condition).trim() : null;
                    const incidentReq = new sql.Request(tx);
                    incidentReq.input("taskId", sql.BigInt, taskId);
                    incidentReq.input("sourceType", sql.NVarChar(30), task.ReferenceType || "WMS");
                    incidentReq.input("sourceId", sql.Int, task.ReferenceId || null);
                    incidentReq.input("itemId", sql.Int, taskLine.ItemId);
                    incidentReq.input("itemSpecId", sql.Int, taskLine.ItemSpecId || null);
                    incidentReq.input("reqQty", sql.Decimal(18, 4), taskLine.QuantityRequired);
                    incidentReq.input("compQty", sql.Decimal(18, 4), qtyCompleted);
                    incidentReq.input("shortQty", sql.Decimal(18, 4), shortageQty);
                    incidentReq.input("userId", sql.Int, userId);
                    incidentReq.input("condition", sql.NVarChar(30), conditionVal);
                    
                    await incidentReq.query(`
                        INSERT INTO dbo.WarehouseIncidents (
                            IncidentType, Status, WmsTaskId, SourceType, SourceId, ItemId, ItemSpecId, QtyRequired, QtyCompleted, QtyShortage, CreatedBy, Condition
                        ) VALUES (
                            'short_pick', 'pending', @taskId, @sourceType, @sourceId, @itemId, @itemSpecId, @reqQty, @compQty, @shortQty, @userId, @condition
                        )
                    `);
                }

                // If it references an inventory reservation, update the reservation
                if (taskLine.InventoryReservationId) {
                    const resReq = new sql.Request(tx);
                    resReq.input(
                        "resId",
                        sql.BigInt,
                        taskLine.InventoryReservationId,
                    );
                    resReq.input("qty", sql.Decimal(18, 4), qtyCompleted);
                    resReq.input("lotId", sql.BigInt, lotId);
                    resReq.input("whId", sql.Int, task.WarehouseId);
                    resReq.input("locId", sql.Int, fromLocationId);
                    resReq.input("unitId", sql.BigInt, inventoryUnitId);

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
            updateTaskReq.input("taskId", sql.BigInt, taskId);
            updateTaskReq.input("userId", sql.Int, userId);
            await updateTaskReq.query(`
        UPDATE dbo.WmsTasks
        SET
          Status = 'completed',
          CompletedAt = SYSUTCDATETIME(),
          CompletedBy = @userId,
          ActionBy = NULL
        WHERE WmsTaskId = @taskId
      `);

            // Status history log
            const histReq = new sql.Request(tx);
            histReq.input("taskId", sql.BigInt, taskId);
            histReq.input("userId", sql.Int, userId);
            await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('WMS_TASK', @taskId, 'open', 'completed', @userId, 'Picking task completed and confirmed')
      `);

            // 3.1 If the task references a Goods Issue (GI), rebuild GoodsIssueLines with actual picked/split data and log GI audit trail
            if (
                task.ReferenceType === "GI" &&
                task.ReferenceId &&
                task.TaskType === "picking"
            ) {
                const giId = task.ReferenceId;

                // Fetch original GoodsIssueLines metadata to preserve unit and dimensions
                const origLinesRes = await tx
                    .request()
                    .input("giId", sql.Int, giId).query(`
            SELECT ItemId, ItemSpecId, UnitId, ProductTypeId, ThicknessId, WidthId, LengthId, Remark
            FROM dbo.GoodsIssueLines
            WHERE GoodsIssueId = @giId
          `);
                const origLines = origLinesRes.recordset;

                // Fetch actual picked lines from WmsTaskLines
                const completedLinesRes = await tx
                    .request()
                    .input("taskId", sql.BigInt, taskId).query(`
            SELECT
              ItemId, ItemSpecId, LotId, FromLocationId,
              QuantityRequired, QuantityCompleted,
              RequestedQuantity, RequestedUnitId, UnitConversionFactor,
              PalletNo, Remark
            FROM dbo.WmsTaskLines
            WHERE WmsTaskId = @taskId AND QuantityCompleted > 0
          `);
                const completedLines = completedLinesRes.recordset;

                if (completedLines.length > 0) {
                    // Delete old lines
                    await tx
                        .request()
                        .input("giId", sql.Int, giId)
                        .query(
                            `DELETE FROM dbo.GoodsIssueLines WHERE GoodsIssueId = @giId`,
                        );

                    // Insert new lines mirroring the actual picks (handles splits perfectly)
                    for (let idx = 0; idx < completedLines.length; idx++) {
                        const pick = completedLines[idx];
                        const orig =
                            origLines.find(
                                (o) =>
                                    o.ItemId === pick.ItemId &&
                                    (o.ItemSpecId === pick.ItemSpecId ||
                                        (o.ItemSpecId === null &&
                                            pick.ItemSpecId === null)),
                            ) || {};

                        const insReq = new sql.Request(tx);
                        insReq.input("giId", sql.Int, giId);
                        insReq.input("lineNum", sql.Int, idx + 1);
                        insReq.input("itemId", sql.Int, pick.ItemId);
                        insReq.input("itemSpecId", sql.Int, pick.ItemSpecId);
                        insReq.input("lotId", sql.BigInt, pick.LotId);
                        insReq.input("warehouseId", sql.Int, task.WarehouseId);
                        insReq.input(
                            "locationId",
                            sql.Int,
                            pick.FromLocationId,
                        );
                        const conversionFactor = Number(pick.UnitConversionFactor || 1);
                        const requestedQty = pick.RequestedQuantity ?? (pick.QuantityRequired / conversionFactor);
                        const issuedQty = pick.QuantityCompleted / conversionFactor;
                        insReq.input("unitId", sql.Int, pick.RequestedUnitId || orig.UnitId || pick.UnitId);
                        insReq.input(
                            "reqQty",
                            sql.Decimal(18, 4),
                            requestedQty,
                        );
                        insReq.input(
                            "issQty",
                            sql.Decimal(18, 4),
                            issuedQty,
                        );
                        insReq.input(
                            "reqBaseQty",
                            sql.Decimal(18, 4),
                            pick.QuantityRequired,
                        );
                        insReq.input(
                            "issBaseQty",
                            sql.Decimal(18, 4),
                            pick.QuantityCompleted,
                        );
                        insReq.input("prodType", sql.Int, orig.ProductTypeId);
                        insReq.input("thickness", sql.Int, orig.ThicknessId);
                        insReq.input("width", sql.Int, orig.WidthId);
                        insReq.input("length", sql.Int, orig.LengthId);
                        insReq.input(
                            "remark",
                            sql.NVarChar(1000),
                            pick.Remark || orig.Remark,
                        );
                        insReq.input(
                            "palletNo",
                            sql.NVarChar(100),
                            pick.PalletNo,
                        );

                        await insReq.query(`
              INSERT INTO dbo.GoodsIssueLines (
                GoodsIssueId, LineNum, ItemId, ItemSpecId, LotId, WarehouseId, LocationId, UnitId,
                RequestedQuantity, IssuedQuantity, RequestedSheetQty, IssuedSheetQty,
                ProductTypeId, ThicknessId, WidthId, LengthId, Remark, PalletNo
              ) VALUES (
                @giId, @lineNum, @itemId, @itemSpecId, @lotId, @warehouseId, @locationId, @unitId,
                @reqQty, @issQty, @reqBaseQty, @issBaseQty,
                @prodType, @thickness, @width, @length, @remark, @palletNo
              )
            `);
                    }

                    // Recalculate totals and update GI Header
                    const sumRes = await tx
                        .request()
                        .input("giId", sql.Int, giId).query(`
              SELECT 
                SUM(RequestedSheetQty) AS ReqTotal,
                SUM(IssuedSheetQty) AS IssTotal,
                COUNT(DISTINCT PalletNo) AS PalletTotal
              FROM dbo.GoodsIssueLines
              WHERE GoodsIssueId = @giId
            `);
                    const sums = sumRes.recordset[0];

                    await tx
                        .request()
                        .input("giId", sql.Int, giId)
                        .input(
                            "reqTotal",
                            sql.Decimal(18, 4),
                            sums?.ReqTotal || 0,
                        )
                        .input(
                            "issTotal",
                            sql.Decimal(18, 4),
                            sums?.IssTotal || 0,
                        )
                        .input(
                            "palletTotal",
                            sql.Decimal(18, 4),
                            sums?.PalletTotal || 0,
                        ).query(`
              UPDATE dbo.GoodsIssues
              SET
                RequestedSheetTotal = @reqTotal,
                IssuedSheetTotal = @issTotal,
                PalletCountTotal = @palletTotal,
                UpdatedAt = SYSUTCDATETIME()
              WHERE GoodsIssueId = @giId
            `);

                    // Write GI Status history as Audit Trail for override
                    await tx
                        .request()
                        .input("giId", sql.Int, giId)
                        .input("userId", sql.Int, userId)
                        .input("taskId", sql.BigInt, taskId).query(`
              INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
              VALUES ('GI', @giId, 'approved', 'approved', @userId, 'Lines rebuilt with actual picked data from WMS Task #' + CAST(@taskId AS VARCHAR))
            `);
                }
            }

            // 3.2 If the task references a Goods Receipt (GR), update GoodsReceiptLines with actual putaway location and pallet data
            if (
                task.ReferenceType === "GR" &&
                task.ReferenceId &&
                task.TaskType === "putaway"
            ) {
                const grId = task.ReferenceId;

                const origLinesRes = await tx
                    .request()
                    .input("grId", sql.Int, grId).query(`
            SELECT GoodsReceiptLineId, ItemId, ItemSpecId, LotId
            FROM dbo.GoodsReceiptLines
            WHERE GoodsReceiptId = @grId
            ORDER BY LineNum
          `);
                const origLines = origLinesRes.recordset;

                const completedLinesRes = await tx
                    .request()
                    .input("taskId", sql.BigInt, taskId).query(`
            SELECT ItemId, ItemSpecId, LotId, ToLocationId, PalletNo
            FROM dbo.WmsTaskLines
            WHERE WmsTaskId = @taskId AND QuantityCompleted > 0
            ORDER BY WmsTaskLineId
          `);
                const completedLines = completedLinesRes.recordset;

                if (completedLines.length > 0 && origLines.length > 0) {
                    const origByKey = new Map();
                    for (const line of origLines) {
                        const key = `${line.ItemId}-${line.ItemSpecId ?? "null"}-${line.LotId ?? "null"}`;
                        if (!origByKey.has(key)) origByKey.set(key, []);
                        origByKey.get(key).push(line);
                    }

                    for (const putaway of completedLines) {
                        const key = `${putaway.ItemId}-${putaway.ItemSpecId ?? "null"}-${putaway.LotId ?? "null"}`;
                        const candidates = origByKey.get(key) || [];
                        const target = candidates.shift() || origLines.shift();
                        if (!target) continue;

                        const updateReq = new sql.Request(tx);
                        updateReq.input(
                            "lineId",
                            sql.BigInt,
                            target.GoodsReceiptLineId,
                        );
                        updateReq.input("locId", sql.Int, putaway.ToLocationId);
                        updateReq.input(
                            "palletNo",
                            sql.NVarChar(100),
                            putaway.PalletNo || null,
                        );
                        await updateReq.query(`
              UPDATE dbo.GoodsReceiptLines
              SET
                LocationId = COALESCE(@locId, LocationId),
                PalletNo = COALESCE(@palletNo, PalletNo)
              WHERE GoodsReceiptLineId = @lineId
            `);
                    }

                    await tx
                        .request()
                        .input("grId", sql.Int, grId)
                        .input("userId", sql.Int, userId)
                        .input("taskId", sql.BigInt, taskId).query(`
              INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
              VALUES ('GR', @grId, 'received', 'received', @userId, 'Putaway location and pallet updated from WMS Task #' + CAST(@taskId AS VARCHAR))
            `);
                }
            }

            // If task belongs to a wave, check if all tasks in wave are completed
            if (task.WaveId) {
                const waveCheckReq = new sql.Request(tx);
                waveCheckReq.input("waveId", sql.Int, task.WaveId);
                const waveCheckRes = await waveCheckReq.query(`
          SELECT COUNT(1) AS OpenTaskCount
          FROM dbo.WmsTasks
          WHERE WaveId = @waveId AND Status = 'open'
        `);
                if (waveCheckRes.recordset[0].OpenTaskCount === 0) {
                    await waveCheckReq.query(`
            UPDATE dbo.WmsWaves
            SET
              Status = 'completed',
              CompletedAt = SYSUTCDATETIME(),
              ActionAt = COALESCE(ActionAt, SYSUTCDATETIME())
            WHERE WmsWaveId = @waveId
          `);
                }
            }

            // 4. Auto-create draft Delivery Order if ReferenceType = 'SO'
            if (task.ReferenceType === "SO" && task.ReferenceId) {
                await wmsTaskService.createDraftDOFromPickTask(
                    tx,
                    taskId,
                    userId,
                );
            }

            return { success: true };
        };

        if (existingTx) {
            return await execute(existingTx);
        } else {
            return await mssqlTransaction("DEFAULT", execute);
        }
    },

    async createDraftDOFromPickTask(tx, taskId, userId) {
        // 1. Fetch SO details and branch
        const taskReq = new sql.Request(tx);
        taskReq.input("taskId", sql.BigInt, taskId);
        const taskRes = await taskReq.query(`
      SELECT t.ReferenceId AS SalesOrderId, t.WarehouseId,
             so.BranchId, so.CustomerId, so.ShippingAddress, so.DeliveryType
      FROM dbo.WmsTasks t
      JOIN dbo.SalesOrders so ON so.SalesOrderId = t.ReferenceId
      WHERE t.WmsTaskId = @taskId
    `);
        const info = taskRes.recordset[0];
        if (!info) return;

        // 2. Fetch completed lines from picking task with requested/display unit
        const linesRes = await taskReq.query(`
      SELECT
        tl.ItemId,
        tl.ItemSpecId,
        CASE
          WHEN ISNULL(tl.UnitConversionFactor, 1) = 0 THEN tl.QuantityCompleted
          ELSE tl.QuantityCompleted / ISNULL(tl.UnitConversionFactor, 1)
        END AS Quantity,
        ISNULL(tl.RequestedUnitId, sol.UnitId) AS UnitId
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
        const { documentService } =
            await import("../common/documentService.js");
        const documentNo = await documentService.generateDocumentNumber(
            tx,
            "DO",
            info.BranchId,
            new Date(),
        );

        // 4. Insert DO Header
        const headerReq = new sql.Request(tx);
        headerReq.input("docNo", sql.NVarChar(50), documentNo);
        headerReq.input("branchId", sql.Int, info.BranchId);
        headerReq.input("customerId", sql.Int, info.CustomerId);
        headerReq.input("salesOrderId", sql.Int, info.SalesOrderId);
        headerReq.input("shipTo", sql.NVarChar(1000), info.ShippingAddress);
        headerReq.input("deliveryType", sql.NVarChar(30), info.DeliveryType || 'delivery');
        headerReq.input("createdBy", sql.Int, userId);

        const doHeaderRes = await headerReq.query(`
      INSERT INTO dbo.DeliveryOrders (
        DocumentNo, BranchId, SalesOrderId, CustomerId, DocumentDate, Status, ShipToAddress, DeliveryType, CreatedBy
      )
      OUTPUT INSERTED.DeliveryOrderId
      VALUES (
        @docNo, @branchId, @salesOrderId, @customerId, CAST(SYSUTCDATETIME() AS DATE), 'draft', @shipTo, @deliveryType, @createdBy
      )
    `);
        const deliveryOrderId = doHeaderRes.recordset[0].DeliveryOrderId;

        // 5. Insert DO Lines
        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            const lineReq = new sql.Request(tx);
            lineReq.input("doId", sql.Int, deliveryOrderId);
            lineReq.input("lineNum", sql.Int, idx + 1);
            lineReq.input("itemId", sql.Int, line.ItemId);
            lineReq.input("qty", sql.Decimal(18, 4), line.Quantity);
            lineReq.input("unitId", sql.Int, line.UnitId);
            lineReq.input("itemSpecId", sql.Int, line.ItemSpecId || null);

            await lineReq.query(`
        INSERT INTO dbo.DeliveryOrderLines (DeliveryOrderId, LineNum, ItemId, Quantity, UnitId, ItemSpecId)
        VALUES (@doId, @lineNum, @itemId, @qty, @unitId, @itemSpecId)
      `);
        }

        // 6. Log Status History
        const histReq = new sql.Request(tx);
        histReq.input("docId", sql.Int, deliveryOrderId);
        histReq.input("userId", sql.Int, userId);
        await histReq.query(`
      INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
      VALUES ('DO', @docId, NULL, 'draft', @userId, 'Delivery Order auto-created from Picking confirmation')
    `);
    },

    async allocateWaveInventory(waveId, tx) {
        // 1. Fetch all uncompleted picking task lines in the wave
        const linesReq = new sql.Request(tx);
        linesReq.input("waveId", sql.Int, waveId);
        const linesRes = await linesReq.query(`
      SELECT tl.WmsTaskLineId, tl.WmsTaskId, tl.ItemId, tl.ItemSpecId, tl.QuantityRequired, t.WarehouseId, tl.LotId, tl.FromLocationId
      FROM dbo.WmsTaskLines tl
      JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
      WHERE t.WaveId = @waveId AND tl.QuantityCompleted = 0 AND t.Status <> 'completed'
    `);
        const taskLines = linesRes.recordset;

        for (const line of taskLines) {
            // 2. Query available stock for this item & spec in FIFO order
            const stockReq = new sql.Request(tx);
            stockReq.input("itemId", sql.Int, line.ItemId);
            stockReq.input("itemSpecId", sql.Int, line.ItemSpecId || null);
            stockReq.input("whId", sql.Int, line.WarehouseId);
            stockReq.input("currentLineId", sql.BigInt, line.WmsTaskLineId);

            let stockQuery = `
        SELECT iu.InventoryUnitId, iu.LocationId, iu.LotId, lot.LotNo, iu.PalletNo, 
               (iu.QtySheet - ISNULL((
                 SELECT SUM(tl.QuantityRequired - tl.QuantityCompleted)
                 FROM dbo.WmsTaskLines tl
                 JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
                 WHERE tl.InventoryUnitId = iu.InventoryUnitId
                   AND t.Status = 'open'
                   AND tl.WmsTaskLineId <> @currentLineId
               ), 0)) AS AvailableQty
        FROM dbo.InventoryUnits iu
        JOIN dbo.Lots lot ON lot.LotId = iu.LotId
        WHERE iu.ItemId = @itemId
          AND (iu.ItemSpecId = @itemSpecId OR (iu.ItemSpecId IS NULL AND @itemSpecId IS NULL))
          AND iu.WarehouseId = @whId
      `;

            if (line.LotId) {
                stockQuery += ` AND iu.LotId = @specificLotId`;
                stockReq.input("specificLotId", sql.BigInt, line.LotId);
            }
            if (line.FromLocationId) {
                stockQuery += ` AND iu.LocationId = @specificLocId`;
                stockReq.input("specificLocId", sql.Int, line.FromLocationId);
            }

            stockQuery += `
          AND (iu.QtySheet - ISNULL((
                 SELECT SUM(tl.QuantityRequired - tl.QuantityCompleted)
                 FROM dbo.WmsTaskLines tl
                 JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
                 WHERE tl.InventoryUnitId = iu.InventoryUnitId
                   AND t.Status = 'open'
                   AND tl.WmsTaskLineId <> @currentLineId
               ), 0)) > 0
        ORDER BY lot.CreatedAt ASC
      `;

            const stockRes = await stockReq.query(stockQuery);

            let remainingToAllocate = line.QuantityRequired;
            const stockLayers = stockRes.recordset;

            for (
                let i = 0;
                i < stockLayers.length && remainingToAllocate > 0;
                i++
            ) {
                const layer = stockLayers[i];
                const allocQty = Math.min(
                    remainingToAllocate,
                    layer.AvailableQty,
                );

                if (allocQty <= 0) continue;

                if (remainingToAllocate === line.QuantityRequired) {
                    // This is the first allocation layer. Update the existing line.
                    const updateReq = new sql.Request(tx);
                    updateReq.input("lineId", sql.BigInt, line.WmsTaskLineId);
                    updateReq.input("qtyReq", sql.Decimal(18, 4), allocQty);
                    updateReq.input("fromLoc", sql.Int, layer.LocationId);
                    updateReq.input("lotId", sql.BigInt, layer.LotId);
                    updateReq.input(
                        "unitId",
                        sql.BigInt,
                        layer.InventoryUnitId,
                    );
                    updateReq.input("palletNo", sql.NVarChar(100), layer.PalletNo || null);

                    await updateReq.query(`
            UPDATE dbo.WmsTaskLines
            SET FromLocationId = @fromLoc,
                LotId = @lotId,
                InventoryUnitId = @unitId,
                QuantityRequired = @qtyReq,
                RequestedQuantity = @qtyReq / NULLIF(ISNULL(UnitConversionFactor, 1), 0),
                PalletNo = @palletNo
            WHERE WmsTaskLineId = @lineId
          `);
                } else {
                    // We need to split: insert a new line in WmsTaskLines.
                    const insertReq = new sql.Request(tx);
                    insertReq.input("taskId", sql.BigInt, line.WmsTaskId);
                    insertReq.input("itemId", sql.Int, line.ItemId);
                    insertReq.input(
                        "itemSpecId",
                        sql.Int,
                        line.ItemSpecId || null,
                    );
	                    insertReq.input("qtyReq", sql.Decimal(18, 4), allocQty);
	                    insertReq.input("fromLoc", sql.Int, layer.LocationId);
	                    insertReq.input("lotId", sql.BigInt, layer.LotId);
	                    insertReq.input(
	                        "invUnitId",
	                        sql.BigInt,
	                        layer.InventoryUnitId,
	                    );

                    // Find other fields to copy (like ToLocationId, InventoryReservationId, Remark)
                    const copyReq = new sql.Request(tx);
                    copyReq.input("lineId", sql.BigInt, line.WmsTaskLineId);
	                    const copyRes = await copyReq.query(`
	            SELECT ToLocationId, InventoryReservationId, Remark, UnitId,
                     RequestedUnitId, UnitConversionFactor
	            FROM dbo.WmsTaskLines
	            WHERE WmsTaskLineId = @lineId
	          `);
                    const originalLine = copyRes.recordset[0];
                    const toLocId = originalLine
                        ? originalLine.ToLocationId
                        : null;
                    const resId = originalLine
                        ? originalLine.InventoryReservationId
                        : null;
	                    const remark = originalLine ? originalLine.Remark : null;
	                    const lineUnitId = originalLine ? originalLine.UnitId : null;
	                    const requestedUnitId = originalLine ? originalLine.RequestedUnitId : null;
	                    const conversionFactor = Number(originalLine?.UnitConversionFactor || 1);
	                    if (!lineUnitId) throw badRequest("UnitId is required for WMS task line");

	                    insertReq.input("toLoc", sql.Int, toLocId);
	                    insertReq.input("resId", sql.BigInt, resId);
	                    insertReq.input("remark", sql.NVarChar(1000), remark);
	                    insertReq.input("unitId", sql.Int, lineUnitId);
	                    insertReq.input("requestedUnitId", sql.Int, requestedUnitId || lineUnitId);
	                    insertReq.input("requestedQty", sql.Decimal(18, 4), allocQty / conversionFactor);
	                    insertReq.input("conversionFactor", sql.Decimal(18, 8), conversionFactor);
                        insertReq.input("palletNo", sql.NVarChar(100), layer.PalletNo || null);

                    await insertReq.query(`
	            INSERT INTO dbo.WmsTaskLines (
	              WmsTaskId, ItemId, ItemSpecId, UnitId, QuantityRequired, QuantityCompleted,
	              RequestedQuantity, RequestedUnitId, UnitConversionFactor,
	              LotId, InventoryReservationId, InventoryUnitId, FromLocationId, ToLocationId, Remark, PalletNo
	            )
	            VALUES (
	              @taskId, @itemId, @itemSpecId, @unitId, @qtyReq, 0,
	              @requestedQty, @requestedUnitId, @conversionFactor,
	              @lotId, @resId, @invUnitId, @fromLoc, @toLoc, @remark, @palletNo
	            )
	          `);
                }

                // No separate AllocatedQty column update needed (calculated dynamically)

                // Update matching reservation if present
                const copyReq = new sql.Request(tx);
                copyReq.input("lineId", sql.BigInt, line.WmsTaskLineId);
                const copyRes = await copyReq.query(
                    `SELECT InventoryReservationId FROM dbo.WmsTaskLines WHERE WmsTaskLineId = @lineId`,
                );
                const resId = copyRes.recordset[0]?.InventoryReservationId;
                if (resId) {
                    const resReq = new sql.Request(tx);
                    resReq.input("resId", sql.BigInt, resId);
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
            waveReq.input("waveId", sql.Int, waveId);
            const waveRes = await waveReq.query(
                `SELECT Status FROM dbo.WmsWaves WHERE WmsWaveId = @waveId`,
            );
            if (waveRes.recordset.length === 0)
                throw badRequest("Wave not found");
            if (waveRes.recordset[0].Status === "completed")
                throw badRequest("Wave is already completed");

            // 2. Fetch all tasks in the wave
            const tasksRes = await waveReq.query(
                `SELECT WmsTaskId FROM dbo.WmsTasks WHERE WaveId = @waveId`,
            );
            const taskIds = tasksRes.recordset.map((t) => t.WmsTaskId);

            for (const taskId of taskIds) {
                // 3. Find task lines in the wave
                const linesReq = new sql.Request(tx);
                linesReq.input("taskId", sql.BigInt, taskId);
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
                    const key = `${line.ItemId}-${line.ItemSpecId || "null"}-${line.InventoryReservationId || "null"}`;
                    if (!groups[key]) {
                        groups[key] = [];
                    }
                    groups[key].push(line);
                }

                for (const key in groups) {
                    const groupLines = groups[key];
                    if (groupLines.length > 1) {
                        const firstLine = groupLines[0];
                        const totalQty = groupLines.reduce(
                            (sum, l) => sum + l.QuantityRequired,
                            0,
                        );

                        // Update first line
                        const updateReq = new sql.Request(tx);
                        updateReq.input(
                            "lineId",
                            sql.BigInt,
                            firstLine.WmsTaskLineId,
                        );
                        updateReq.input(
                            "totalQty",
                            sql.Decimal(18, 4),
                            totalQty,
                        );
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
                            deleteReq.input(
                                "lineId",
                                sql.BigInt,
                                groupLines[i].WmsTaskLineId,
                            );
                            await deleteReq.query(
                                `DELETE FROM dbo.WmsTaskLines WHERE WmsTaskLineId = @lineId`,
                            );
                        }
                    } else if (groupLines.length === 1) {
                        // Just reset the allocation fields
                        const resetReq = new sql.Request(tx);
                        resetReq.input(
                            "lineId",
                            sql.BigInt,
                            groupLines[0].WmsTaskLineId,
                        );
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
            return await mssqlTransaction("DEFAULT", execute);
        }
    },

    async splitTaskLine(
        { taskId, lineId, splitQty, userId },
        existingTx = null,
    ) {
        const execute = async (tx) => {
            // 1. Get task details and verify status is not completed
            const taskReq = new sql.Request(tx);
            taskReq.input("taskId", sql.BigInt, taskId);
            const taskRes = await taskReq.query(
                `SELECT Status FROM dbo.WmsTasks WHERE WmsTaskId = @taskId`,
            );
            if (taskRes.recordset.length === 0)
                throw badRequest("WMS Task not found");
            if (
                ["completed", "cancelled"].includes(taskRes.recordset[0].Status)
            )
                throw badRequest(
                    `WMS Task is not available in status: ${taskRes.recordset[0].Status}`,
                );

            // 2. Fetch the target line
            const lineReq = new sql.Request(tx);
            lineReq.input("lineId", sql.BigInt, lineId);
            lineReq.input("taskId", sql.BigInt, taskId);
            const lineRes = await lineReq.query(`
	        SELECT WmsTaskLineId, ItemId, ItemSpecId, UnitId, QuantityRequired, QuantityCompleted,
	               RequestedQuantity, RequestedUnitId, UnitConversionFactor,
	               LotId, InventoryReservationId, InventoryUnitId, FromLocationId, ToLocationId, Remark
	        FROM dbo.WmsTaskLines
	        WHERE WmsTaskLineId = @lineId AND WmsTaskId = @taskId
	      `);
            const line = lineRes.recordset[0];
            if (!line) throw badRequest("WMS Task Line not found");
            if (line.QuantityCompleted > 0)
                throw badRequest("Cannot split a completed task line");

            const qtyReq = Number(line.QuantityRequired);
            const sQty = Number(splitQty);
            if (isNaN(sQty) || sQty <= 0)
                throw badRequest("Split quantity must be greater than zero");
            if (sQty >= qtyReq)
                throw badRequest(
                    "Split quantity must be less than the required quantity",
                );

            const newQty = qtyReq - sQty;

            // 3. Update original line
            const updateReq = new sql.Request(tx);
            updateReq.input("lineId", sql.BigInt, lineId);
            updateReq.input("qty", sql.Decimal(18, 4), newQty);
            await updateReq.query(`
        UPDATE dbo.WmsTaskLines
        SET QuantityRequired = @qty,
            RequestedQuantity = @qty / NULLIF(ISNULL(UnitConversionFactor, 1), 0),
            FromLocationId = NULL,
            LotId = NULL,
            InventoryUnitId = NULL
        WHERE WmsTaskLineId = @lineId
      `);

            // Original line allocation reset is handled by setting fields to NULL below, no AllocatedQty update needed

            // 4. Insert new split line
            const insertReq = new sql.Request(tx);
	            insertReq.input("taskId", sql.BigInt, taskId);
	            insertReq.input("itemId", sql.Int, line.ItemId);
	            insertReq.input("itemSpecId", sql.Int, line.ItemSpecId || null);
	            insertReq.input("unitId", sql.Int, line.UnitId);
	            insertReq.input("qtyReq", sql.Decimal(18, 4), sQty);
	            insertReq.input("requestedUnitId", sql.Int, line.RequestedUnitId || line.UnitId);
	            
	            const factor = Number(line.UnitConversionFactor) > 0 ? Number(line.UnitConversionFactor) : 1;
	            insertReq.input("conversionFactor", sql.Decimal(18, 8), factor);
	            insertReq.input(
	                "requestedQty",
	                sql.Decimal(18, 4),
	                sQty / factor,
	            );
            insertReq.input(
                "resId",
                sql.BigInt,
                line.InventoryReservationId || null,
            );
            insertReq.input("toLoc", sql.Int, line.ToLocationId || null);
            insertReq.input("remark", sql.NVarChar(1000), line.Remark || null);

	            await insertReq.query(`
	        INSERT INTO dbo.WmsTaskLines (
	          WmsTaskId, ItemId, ItemSpecId, UnitId, QuantityRequired, QuantityCompleted,
	          RequestedQuantity, RequestedUnitId, UnitConversionFactor,
	          LotId, InventoryReservationId, InventoryUnitId, FromLocationId, ToLocationId, Remark
	        )
	        VALUES (
	          @taskId, @itemId, @itemSpecId, @unitId, @qtyReq, 0,
	          @requestedQty, @requestedUnitId, @conversionFactor,
	          NULL, @resId, NULL, NULL, @toLoc, @remark
	        )
	      `);

            return { success: true };
        };

        if (existingTx) {
            return await execute(existingTx);
        } else {
            return await mssqlTransaction("DEFAULT", execute);
        }
    },

    async getLastLocation({ itemId, itemSpecId = null, warehouseId }) {
        const query = `
      SELECT TOP 1 wl.LocationId, wl.LocationCode
      FROM (
        SELECT tl.ToLocationId AS LocationId, t.CompletedAt AS Date
        FROM dbo.WmsTaskLines tl
        JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
        WHERE tl.ItemId = @itemId
          AND (tl.ItemSpecId = @itemSpecId OR (tl.ItemSpecId IS NULL AND @itemSpecId IS NULL))
          AND t.WarehouseId = @warehouseId
          AND t.Status = 'completed'
          AND t.TaskType = 'putaway'
          AND tl.ToLocationId IS NOT NULL
        
        UNION ALL
        
        SELECT LocationId, CreatedAt AS Date
        FROM dbo.InventoryUnits
        WHERE ItemId = @itemId
          AND (ItemSpecId = @itemSpecId OR (ItemSpecId IS NULL AND @itemSpecId IS NULL))
          AND WarehouseId = @warehouseId
          AND LocationId IS NOT NULL
      ) AS Locations
      JOIN dbo.WarehouseLocations wl ON wl.LocationId = Locations.LocationId
      ORDER BY Locations.Date DESC
    `;

        const inputs = {
            itemId: { type: sql.Int, value: itemId },
            itemSpecId: { type: sql.Int, value: itemSpecId },
            warehouseId: { type: sql.Int, value: warehouseId },
        };

        const rows = await mssqlQuery("DEFAULT", query, { inputs });
        if (rows.length === 0) return null;
        return {
            locationId: rows[0].LocationId,
            locationCode: rows[0].LocationCode,
        };
    },

    async getIncidents(filters = {}) {
        let whereClause = "1=1";
        const inputs = {};

        if (filters.status) {
            whereClause += " AND wi.Status = @status";
            inputs.status = { type: sql.NVarChar(30), value: filters.status };
        }
        if (filters.sourceType) {
            whereClause += " AND wi.SourceType = @sourceType";
            inputs.sourceType = { type: sql.NVarChar(30), value: filters.sourceType };
        }
        if (filters.sourceId) {
            whereClause += " AND wi.SourceId = @sourceId";
            inputs.sourceId = { type: sql.Int, value: Number(filters.sourceId) };
        }

        const rows = await mssqlQuery(
            "DEFAULT",
            `
            SELECT 
                wi.IncidentId, wi.IncidentType, wi.Status, wi.WmsTaskId, wi.SourceType, wi.SourceId,
                wi.ItemId, i.ItemCode, i.ItemName, wi.ItemSpecId, ispec.SalesSKU, ispec.SpecName,
                wi.QtyRequired, wi.QtyCompleted, wi.QtyShortage, wi.CreatedAt,
                wi.ResolvedAt, wi.ResolutionAction, wi.ResolutionDetails, wi.Condition,
                u.DisplayName AS CreatedByName,
                ur.DisplayName AS ResolvedByName
            FROM dbo.WarehouseIncidents wi
            JOIN dbo.Items i ON i.ItemId = wi.ItemId
            LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = wi.ItemSpecId
            LEFT JOIN dbo.Users u ON u.UserId = wi.CreatedBy
            LEFT JOIN dbo.Users ur ON ur.UserId = wi.ResolvedBy
            WHERE ${whereClause}
            ORDER BY wi.CreatedAt DESC
            `,
            { inputs }
        );

        return rows.map(r => ({
            id: r.IncidentId,
            incidentType: r.IncidentType,
            status: r.Status,
            wmsTaskId: r.WmsTaskId,
            sourceType: r.SourceType,
            sourceId: r.SourceId,
            itemId: r.ItemId,
            itemCode: r.ItemCode,
            itemName: r.ItemName,
            itemSpecId: r.ItemSpecId,
            salesSku: r.SalesSKU,
            specName: r.SpecName,
            qtyRequired: r.QtyRequired,
            qtyCompleted: r.QtyCompleted,
            qtyShortage: r.QtyShortage,
            createdAt: r.CreatedAt,
            resolvedAt: r.ResolvedAt,
            resolutionAction: r.ResolutionAction,
            resolutionDetails: r.ResolutionDetails,
            createdByName: r.CreatedByName,
            resolvedByName: r.ResolvedByName,
            condition: r.Condition
        }));
    },

    async resolveIncident({ incidentId, action, userId, details = null }, existingTx = null) {
        const execute = async (tx) => {
            // 1. Fetch incident
            const incReq = new sql.Request(tx);
            incReq.input("incidentId", sql.BigInt, incidentId);
            const incRes = await incReq.query(`
                SELECT IncidentId, IncidentType, Status, WmsTaskId, SourceType, SourceId, ItemId, ItemSpecId, QtyShortage, CreatedBy
                FROM dbo.WarehouseIncidents
                WHERE IncidentId = @incidentId
            `);
            const incident = incRes.recordset[0];
            if (!incident) throw badRequest("Incident not found");
            if (incident.Status === "resolved") throw badRequest("Incident is already resolved");

            // 2. Resolve based on action
            if (action === "re_pick") {
                const taskReq = new sql.Request(tx);
                taskReq.input("taskId", sql.BigInt, incident.WmsTaskId);
                taskReq.input("itemId", sql.Int, incident.ItemId);
                taskReq.input("itemSpecId", sql.Int, incident.ItemSpecId || null);
                
                const taskRes = await taskReq.query(`
                    SELECT WarehouseId 
                    FROM dbo.WmsTasks 
                    WHERE WmsTaskId = @taskId
                `);
                const origTask = taskRes.recordset[0];
                if (!origTask) throw badRequest("Original WMS task not found");

                const lineRes = await taskReq.query(`
                    SELECT TOP 1 UnitId, InventoryReservationId, Remark
                    FROM dbo.WmsTaskLines
                    WHERE WmsTaskId = @taskId AND ItemId = @itemId 
                      AND (ItemSpecId = @itemSpecId OR (ItemSpecId IS NULL AND @itemSpecId IS NULL))
                `);
                const origLine = lineRes.recordset[0];
                const unitId = origLine ? origLine.UnitId : 1;
                const reservationId = origLine ? origLine.InventoryReservationId : null;
                const remark = origLine ? origLine.Remark : null;

                // Create a new picking task for the shortage quantity
                await this.createTask({
                    taskType: 'picking',
                    referenceType: incident.SourceType,
                    referenceId: incident.SourceId,
                    warehouseId: origTask.WarehouseId,
                    assignedTo: null,
                    lines: [{
                        itemId: incident.ItemId,
                        itemSpecId: incident.ItemSpecId,
                        unitId: unitId,
                        quantityRequired: incident.QtyShortage,
                        remark: remark ? `${remark} (Short-pick split)` : "Short-pick split",
                        inventoryReservationId: reservationId,
                        fromLocationId: null,
                        toLocationId: null
                    }]
                }, tx);

            } else if (action === "cancel_remaining") {
                if (incident.SourceType === "SO" && incident.SourceId) {
                    const taskReq = new sql.Request(tx);
                    taskReq.input("taskId", sql.BigInt, incident.WmsTaskId);
                    taskReq.input("itemId", sql.Int, incident.ItemId);
                    taskReq.input("itemSpecId", sql.Int, incident.ItemSpecId || null);

                    const lineRes = await taskReq.query(`
                        SELECT TOP 1 InventoryReservationId
                        FROM dbo.WmsTaskLines
                        WHERE WmsTaskId = @taskId AND ItemId = @itemId 
                          AND (ItemSpecId = @itemSpecId OR (ItemSpecId IS NULL AND @itemSpecId IS NULL))
                    `);
                    const origLine = lineRes.recordset[0];

                    if (origLine && origLine.InventoryReservationId) {
                        const resReq = new sql.Request(tx);
                        resReq.input("resId", sql.BigInt, origLine.InventoryReservationId);
                        
                        await resReq.query(`
                            UPDATE dbo.InventoryReservations
                            SET Status = 'released'
                            WHERE InventoryReservationId = @resId
                        `);
                    }
                }
            } else {
                throw badRequest(`Invalid resolution action: ${action}`);
            }

            // 3. Update Incident record to resolved
            const updReq = new sql.Request(tx);
            updReq.input("incidentId", sql.BigInt, incidentId);
            updReq.input("resolvedBy", sql.Int, userId);
            updReq.input("action", sql.NVarChar(30), action);
            updReq.input("details", sql.NVarChar(1000), details);

            await updReq.query(`
                UPDATE dbo.WarehouseIncidents
                SET Status = 'resolved',
                    ResolvedBy = @resolvedBy,
                    ResolvedAt = SYSUTCDATETIME(),
                    ResolutionAction = @action,
                    ResolutionDetails = @details
                WHERE IncidentId = @incidentId
            `);

            return { success: true };
        };

        if (existingTx) return await execute(existingTx);
        return await mssqlTransaction("DEFAULT", execute);
    },
};
