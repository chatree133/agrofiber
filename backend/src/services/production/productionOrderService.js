import { sql, mssqlTransaction } from '../../lib/mssql.js';
import { approvalService } from '../common/approvalService.js';
import { wmsTaskService } from '../wms/wmsTaskService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export const productionOrderService = {
  async requestApproval(productionOrderId, userId, steps = []) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('prdId', sql.Int, productionOrderId);
      const headerRes = await headerReq.query(`
        SELECT ProductionOrderId, Status, DocumentNo
        FROM dbo.ProductionOrders 
        WHERE ProductionOrderId = @prdId
      `);
      const prd = headerRes.recordset[0];
      
      if (!prd) throw badRequest('Production order not found');
      if (prd.Status !== 'draft') throw badRequest(`Cannot request approval in status: ${prd.Status}`);

      const updateReq = new sql.Request(tx);
      updateReq.input('prdId', sql.Int, productionOrderId);
      await updateReq.query(`
        UPDATE dbo.ProductionOrders 
        SET Status = 'requested', UpdatedAt = SYSUTCDATETIME()
        WHERE ProductionOrderId = @prdId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, productionOrderId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), prd.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('MO', @docId, @fromStatus, 'requested', @userId, 'Requested for approval')
      `);

      await approvalService.createRequest({
        documentType: 'MO',
        documentId: productionOrderId,
        requestedBy: userId,
        notes: `Approval request for Production Order ${prd.DocumentNo}`,
        steps: steps
      }, tx);

      return { success: true, message: 'Production order submitted for approval' };
    });
  },

  async approveProductionOrder(productionOrderId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('prdId', sql.Int, productionOrderId);
      const headerRes = await headerReq.query(`
        SELECT ProductionOrderId, Status, WarehouseId
        FROM dbo.ProductionOrders 
        WHERE ProductionOrderId = @prdId
      `);
      const prd = headerRes.recordset[0];
      
      if (!prd) throw badRequest('Production order not found');
      if (prd.Status !== 'requested') throw badRequest(`Cannot approve production order in status: ${prd.Status}`);

      const updateReq = new sql.Request(tx);
      updateReq.input('prdId', sql.Int, productionOrderId);
      await updateReq.query(`
        UPDATE dbo.ProductionOrders 
        SET Status = 'approved', UpdatedAt = SYSUTCDATETIME()
        WHERE ProductionOrderId = @prdId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, productionOrderId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), prd.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('MO', @docId, @fromStatus, 'approved', @userId, 'Approved via Orchestrator')
      `);

      // 3. Generate Material Pick Task for Production Consumption
      const bomReq = new sql.Request(tx);
      bomReq.input('prdId', sql.Int, productionOrderId);
      // Fetches required materials from ProductionConsumption table (assuming it's populated on draft)
      const bomRes = await bomReq.query(`
        SELECT ItemId, PlannedQuantity, UnitId, LocationId, LotId
        FROM dbo.ProductionConsumption
        WHERE ProductionOrderId = @prdId
      `);
      
      const lines = bomRes.recordset;
      if (lines.length > 0 && prd.WarehouseId) {
        await wmsTaskService.createTask({
          taskType: 'material_pick', // Generate a material pick task
          referenceType: 'MO',
          referenceId: productionOrderId,
          warehouseId: prd.WarehouseId, 
          assignedTo: null,
          lines: lines.map(line => ({
            itemId: line.ItemId,
            unitId: line.UnitId,
            lotId: line.LotId,
            quantityRequired: line.PlannedQuantity,
            fromLocationId: line.LocationId, 
            toLocationId: null // Typically picked into the shop floor staging location
          }))
        }, tx);
      }

      return { success: true, message: 'Production order approved and material pick task generated' };
    });
  }
};
