import { sql, mssqlTransaction } from '../../lib/mssql.js';
import { stockService } from './stockService.js';
import { costingService } from './costingService.js';
import { wmsTaskService } from '../wms/wmsTaskService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/**
 * Orchestrator service to handle inventory posting transactions.
 */
export const postingService = {
  async postGoodsReceipt(goodsReceiptId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      // 1. Get header
      const headerReq = new sql.Request(tx);
      headerReq.input('grId', sql.Int, goodsReceiptId);
      const headerRes = await headerReq.query(`
        SELECT GoodsReceiptId, Status, GoodsReceiptTypeId, ReceiptDate, WarehouseId 
        FROM dbo.GoodsReceipts 
        WHERE GoodsReceiptId = @grId
      `);
      const gr = headerRes.recordset[0];
      
      if (!gr) throw badRequest('Goods receipt not found');
      if (gr.Status === 'posted') throw badRequest('Goods receipt is already posted');

      // Get MovementTypeCode
      const typeReq = new sql.Request(tx);
      typeReq.input('typeId', sql.Int, gr.GoodsReceiptTypeId);
      const typeRes = await typeReq.query(`
        SELECT MovementTypeCode FROM dbo.GoodsReceiptTypes WHERE GoodsReceiptTypeId = @typeId
      `);
      const movementTypeCode = typeRes.recordset[0]?.MovementTypeCode || 'goods_receipt';

      // 2. Get lines
      const linesReq = new sql.Request(tx);
      linesReq.input('grId', sql.Int, goodsReceiptId);
      const linesRes = await linesReq.query(`
        SELECT 
          GoodsReceiptLineId, ItemId, ItemSpecId, LotId, LotNo, 
          WarehouseId, LocationId, UnitId, ReceivedQuantity, UnitCostSnapshot
        FROM dbo.GoodsReceiptLines
        WHERE GoodsReceiptId = @grId
      `);
      const lines = linesRes.recordset;

      for (const line of lines) {
        if (!line.ReceivedQuantity || line.ReceivedQuantity <= 0) continue;
        
        const qty = line.ReceivedQuantity;
        const cost = line.UnitCostSnapshot || 0;
        const totalCost = qty * cost;

        // 3. Insert StockMovement (using stockService)
        const movementId = await stockService.insertStockMovement(tx, {
          movementType: movementTypeCode,
          referenceType: 'GR',
          referenceId: goodsReceiptId,
          itemId: line.ItemId,
          toWarehouseId: line.WarehouseId,
          toLocationId: line.LocationId,
          lotId: line.LotId,
          lotNo: line.LotNo,
          quantity: qty,
          unitId: line.UnitId,
          unitCost: cost,
          totalCost: totalCost,
          createdBy: userId
        });

        // 4. Update StockOnHand (using stockService)
        await stockService.updateStockOnHand(tx, {
          itemId: line.ItemId,
          itemSpecId: line.ItemSpecId,
          warehouseId: line.WarehouseId,
          locationId: line.LocationId,
          lotId: line.LotId,
          lotNo: line.LotNo,
          quantityDelta: qty
        });

        // 5. Insert InventoryValuationMovement (using costingService)
        await costingService.insertValuationMovement(tx, {
          stockMovementId: movementId,
          itemId: line.ItemId,
          lotId: line.LotId,
          quantity: qty,
          unitCost: cost,
          totalCost: totalCost,
          valuationMethod: 'fifo'
        });

        // 6. Create InventoryCostLayer (using costingService)
        await costingService.addCostLayer(tx, {
          itemId: line.ItemId,
          lotId: line.LotId,
          warehouseId: line.WarehouseId,
          movementId: movementId,
          quantity: qty,
          unitCost: cost
        });
      }

      // 7. Update Status
      const updateReq = new sql.Request(tx);
      updateReq.input('grId', sql.Int, goodsReceiptId);
      updateReq.input('userId', sql.Int, userId);
      await updateReq.query(`
        UPDATE dbo.GoodsReceipts 
        SET Status = 'posted', PostedAt = SYSUTCDATETIME(), PostedBy = @userId, UpdatedAt = SYSUTCDATETIME()
        WHERE GoodsReceiptId = @grId
      `);

      // 8. Add Status History
      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, goodsReceiptId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), gr.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('GR', @docId, @fromStatus, 'posted', @userId, 'Posted to inventory')
      `);

      // 9. Generate WMS Putaway Task
      await wmsTaskService.createTask({
        taskType: 'putaway',
        referenceType: 'GR',
        referenceId: goodsReceiptId,
        warehouseId: gr.WarehouseId,
        assignedTo: null,
        lines: lines.map(line => ({
          itemId: line.ItemId,
          itemSpecId: line.ItemSpecId,
          lotId: line.LotId,
          quantityRequired: line.ReceivedQuantity,
          fromLocationId: line.LocationId, // Staging/Receiving location
          toLocationId: null // Let WMS app user scan the putaway location
        }))
      }, tx);

      return { success: true, message: 'Goods receipt posted successfully' };
    });
  },

  async postGoodsIssue(goodsIssueId, userId, existingTx = null) {
    const execute = async (tx) => {
      // 1. Get header
      const headerReq = new sql.Request(tx);
      headerReq.input('giId', sql.Int, goodsIssueId);
      const headerRes = await headerReq.query(`
        SELECT GoodsIssueId, Status, GoodsIssueTypeId, IssueDate 
        FROM dbo.GoodsIssues 
        WHERE GoodsIssueId = @giId
      `);
      const gi = headerRes.recordset[0];
      
      if (!gi) throw badRequest('Goods issue not found');
      if (gi.Status === 'issued') throw badRequest('Goods issue is already issued');

      // Get MovementTypeCode
      const typeReq = new sql.Request(tx);
      typeReq.input('typeId', sql.Int, gi.GoodsIssueTypeId);
      const typeRes = await typeReq.query(`
        SELECT MovementTypeCode FROM dbo.GoodsIssueTypes WHERE GoodsIssueTypeId = @typeId
      `);
      const movementTypeCode = typeRes.recordset[0]?.MovementTypeCode || 'goods_issue';

      // 2. Get lines
      const linesReq = new sql.Request(tx);
      linesReq.input('giId', sql.Int, goodsIssueId);
      const linesRes = await linesReq.query(`
        SELECT 
          GoodsIssueLineId, ItemId, ItemSpecId, LotId, 
          WarehouseId, LocationId, UnitId, IssuedQuantity
        FROM dbo.GoodsIssueLines
        WHERE GoodsIssueId = @giId
      `);
      const lines = linesRes.recordset;

      for (const line of lines) {
        if (!line.IssuedQuantity || line.IssuedQuantity <= 0) continue;
        
        try {
          // 3. Consume FIFO Layers (using costingService)
          const { totalValuationCost, avgUnitCost } = await costingService.consumeFifoLayers(tx, {
            itemId: line.ItemId,
            warehouseId: line.WarehouseId,
            lotId: line.LotId,
            quantityToConsume: line.IssuedQuantity
          });

          // 4. Insert StockMovement (using stockService)
          const movementId = await stockService.insertStockMovement(tx, {
            movementType: movementTypeCode,
            referenceType: 'GI',
            referenceId: goodsIssueId,
            itemId: line.ItemId,
            fromWarehouseId: line.WarehouseId,
            fromLocationId: line.LocationId,
            lotId: line.LotId,
            quantity: -line.IssuedQuantity, // Negative for issue
            unitId: line.UnitId,
            unitCost: avgUnitCost,
            totalCost: totalValuationCost,
            createdBy: userId
          });

          // 5. Update StockOnHand (using stockService)
          await stockService.updateStockOnHand(tx, {
            itemId: line.ItemId,
            itemSpecId: line.ItemSpecId,
            warehouseId: line.WarehouseId,
            locationId: line.LocationId,
            lotId: line.LotId,
            quantityDelta: -line.IssuedQuantity
          });

          // 6. Insert Valuation Movement (using costingService)
          await costingService.insertValuationMovement(tx, {
            stockMovementId: movementId,
            itemId: line.ItemId,
            lotId: line.LotId,
            quantity: -line.IssuedQuantity,
            unitCost: avgUnitCost,
            totalCost: totalValuationCost,
            valuationMethod: 'fifo'
          });

        } catch (err) {
          throw badRequest(`Line ${line.GoodsIssueLineId}: ${err.message}`);
        }
      }

      // 7. Update GoodsIssue Status
      const updateReq = new sql.Request(tx);
      updateReq.input('giId', sql.Int, goodsIssueId);
      updateReq.input('userId', sql.Int, userId);
      await updateReq.query(`
        UPDATE dbo.GoodsIssues 
        SET Status = 'issued', PostedAt = SYSUTCDATETIME(), PostedBy = @userId, UpdatedAt = SYSUTCDATETIME()
        WHERE GoodsIssueId = @giId
      `);

      // 8. Add Status History
      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, goodsIssueId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), gi.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('GI', @docId, @fromStatus, 'issued', @userId, 'Posted to inventory')
      `);

      return { success: true, message: 'Goods issue posted successfully' };
    };

    if (existingTx) {
      return await execute(existingTx);
    } else {
      return await mssqlTransaction('DEFAULT', execute);
    }
  }
};
