import { sql, mssqlTransaction } from '../../lib/mssql.js';
import { reservationService } from "../inventory/reservationService.js";
import { wmsTaskService } from '../wms/wmsTaskService.js';
import { approvalService } from '../common/approvalService.js';
import { pricingResolverService } from '../pricing/pricingResolverService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export const salesOrderService = {
  async requestApproval(salesOrderId, userId, steps = []) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      // 1. Get header
      const headerReq = new sql.Request(tx);
      headerReq.input('salesOrderId', sql.Int, salesOrderId);
      const headerRes = await headerReq.query(`
        SELECT SalesOrderId, Status, DocumentNo, CustomerId, PriceListId, CurrencyCode, WarehouseId, BranchId
        FROM dbo.SalesOrders 
        WHERE SalesOrderId = @salesOrderId
      `);
      const so = headerRes.recordset[0];
      
      if (!so) throw badRequest('Sales order not found');
      if (so.Status !== 'draft') throw badRequest(`Cannot request approval for sales order in status: ${so.Status}`);

      // 2. Get lines
      const linesReq = new sql.Request(tx);
      linesReq.input('salesOrderId', sql.Int, salesOrderId);
      const linesRes = await linesReq.query(`
        SELECT ItemId, ItemSpecId, Quantity, UnitId, UnitPrice
        FROM dbo.SalesOrderLines
        WHERE SalesOrderId = @salesOrderId
      `);
      const lines = linesRes.recordset;

      let requiresApproval = false;
      const basePricingContext = {
          customerId: so.CustomerId,
          currencyCode: so.CurrencyCode,
          documentDate: new Date(),
          warehouseId: so.WarehouseId,
          priceListId: so.PriceListId,
      };

      const dbLines = [];
      for (const line of lines) {
          const pricingContext = {
              ...basePricingContext,
              itemId: line.ItemId,
              itemSpecId: line.ItemSpecId,
              quantity: line.Quantity,
              unitId: line.UnitId,
          };
          const pricing = await pricingResolverService.resolvePricing(
              pricingContext,
              tx,
          );

          if (line.UnitPrice < pricing.finalPrice) {
              requiresApproval = true;
          }

          dbLines.push({
              ItemId: line.ItemId,
              ItemSpecId: line.ItemSpecId,
              Quantity: line.Quantity,
              Remark: line.Remark || line.remark || null
          });
      }

      if (requiresApproval) {
          // 3. Normal Approval Workflow: Update Status to 'requested'
          const updateReq = new sql.Request(tx);
          updateReq.input('salesOrderId', sql.Int, salesOrderId);
          await updateReq.query(`
            UPDATE dbo.SalesOrders 
            SET Status = 'requested', UpdatedAt = SYSUTCDATETIME()
            WHERE SalesOrderId = @salesOrderId
          `);

          // Status History
          const histReq = new sql.Request(tx);
          histReq.input('docId', sql.Int, salesOrderId);
          histReq.input('userId', sql.Int, userId);
          histReq.input('fromStatus', sql.NVarChar(30), so.Status);
          await histReq.query(`
            INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
            VALUES ('SO', @docId, @fromStatus, 'requested', @userId, 'Requested for approval')
          `);

          // Create Approval Request
          await approvalService.createRequest({
            documentType: 'SO',
            documentId: salesOrderId,
            requestedBy: userId,
            notes: `Approval request for Sales Order ${so.DocumentNo}`,
            steps: steps
          }, tx);

          return { success: true, message: 'Sales order submitted for approval' };
      } else {
          // 4. Auto-Confirm Workflow: Update Status to 'approved' directly!
          const updateReq = new sql.Request(tx);
          updateReq.input('salesOrderId', sql.Int, salesOrderId);
          await updateReq.query(`
            UPDATE dbo.SalesOrders 
            SET Status = 'approved', UpdatedAt = SYSUTCDATETIME()
            WHERE SalesOrderId = @salesOrderId
          `);

          // Status History
          const histReq = new sql.Request(tx);
          histReq.input('docId', sql.Int, salesOrderId);
          histReq.input('userId', sql.Int, userId);
          histReq.input('fromStatus', sql.NVarChar(30), so.Status);
          await histReq.query(`
            INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
            VALUES ('SO', @docId, @fromStatus, 'approved', @userId, 'Auto-confirmed (price sold >= standard)')
          `);

          // Sync stock reservation
          await reservationService.syncReservationsForApprovedOrder(tx, salesOrderId, dbLines, userId);

          // Get created reservation IDs
          const resReq = new sql.Request(tx);
          resReq.input('soId', sql.Int, salesOrderId);
          const resRows = await resReq.query(`
            SELECT InventoryReservationId, ItemId, ItemSpecId
            FROM dbo.InventoryReservations
            WHERE ReferenceType = 'SO' AND ReferenceId = @soId AND Status = 'open'
          `);
          const reservations = resRows.recordset;

          // Create WMS Picking Task
          let resolvedWarehouseId = so.WarehouseId || 1;
          await wmsTaskService.createTask({
            taskType: 'picking',
            referenceType: 'SO',
            referenceId: salesOrderId,
            warehouseId: resolvedWarehouseId, 
            assignedTo: null,
            lines: dbLines.map(line => {
              const res = reservations.find(r => r.ItemId === line.ItemId && (r.ItemSpecId === line.ItemSpecId || (!r.ItemSpecId && !line.ItemSpecId)));
              return {
                itemId: line.ItemId,
                itemSpecId: line.ItemSpecId,
                quantityRequired: line.Quantity,
                remark: line.Remark || null,
                inventoryReservationId: res ? res.InventoryReservationId : null,
                fromLocationId: null,
                toLocationId: null
              };
            })
          }, tx);

          return { success: true, message: 'Sales order auto-confirmed and approved' };
      }
    });
  },

  async approveSalesOrder(salesOrderId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      // 1. Get header
      const headerReq = new sql.Request(tx);
      headerReq.input('salesOrderId', sql.Int, salesOrderId);
      const headerRes = await headerReq.query(`
        SELECT SalesOrderId, BranchId, Status, DocumentNo
        FROM dbo.SalesOrders 
        WHERE SalesOrderId = @salesOrderId
      `);
      const so = headerRes.recordset[0];
      
      if (!so) throw badRequest('Sales order not found');
      if (so.Status !== 'requested') throw badRequest(`Cannot approve sales order in status: ${so.Status}`);

      // 2. Get lines
      const linesReq = new sql.Request(tx);
      linesReq.input('salesOrderId', sql.Int, salesOrderId);
      const linesRes = await linesReq.query(`
        SELECT
          SalesOrderLineId, ItemId, ItemSpecId, Quantity, Remark
        FROM dbo.SalesOrderLines
        WHERE SalesOrderId = @salesOrderId
        ORDER BY LineNum
      `);
      const lines = linesRes.recordset;

      if (lines.length === 0) throw badRequest('Cannot approve sales order without lines');

      // 3. Update Status to 'approved'
      const updateReq = new sql.Request(tx);
      updateReq.input('salesOrderId', sql.Int, salesOrderId);
      await updateReq.query(`
        UPDATE dbo.SalesOrders 
        SET Status = 'approved', UpdatedAt = SYSUTCDATETIME()
        WHERE SalesOrderId = @salesOrderId
      `);

      // 4. Add Status History
      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, salesOrderId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), so.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('SO', @docId, @fromStatus, 'approved', @userId, 'Approved via Orchestrator')
      `);

      // 5. Reserve Stock
      await reservationService.syncReservationsForApprovedOrder(tx, salesOrderId, lines, userId);

      const resReq = new sql.Request(tx);
      resReq.input('soId', sql.Int, salesOrderId);
      const resRows = await resReq.query(`
        SELECT InventoryReservationId, ItemId, ItemSpecId
        FROM dbo.InventoryReservations
        WHERE ReferenceType = 'SO' AND ReferenceId = @soId AND Status = 'open'
      `);
      const reservations = resRows.recordset;

      // 6. Generate WMS Picking Task (assuming picking from a main warehouse, or branch's default warehouse)
      // Note: Ideally, SO lines specify the warehouse, but if not we assume a default or use Branch mapping.
      // Here we will use BranchId or a placeholder if missing. WMS tasks require a WarehouseId.
      let warehouseId = 1; // Default fallback
      if (so.BranchId) {
        // Just as an example, fetch default warehouse for branch if your logic requires
        const whReq = new sql.Request(tx);
        whReq.input('branchId', sql.Int, so.BranchId);
        const whRes = await whReq.query(`SELECT TOP 1 WarehouseId FROM dbo.Warehouses WHERE BranchId = @branchId`);
        if (whRes.recordset.length > 0) {
          warehouseId = whRes.recordset[0].WarehouseId;
        }
      }

      await wmsTaskService.createTask({
        taskType: 'picking',
        referenceType: 'SO',
        referenceId: salesOrderId,
        warehouseId: warehouseId, 
        assignedTo: null,
        lines: lines.map(line => {
          const res = reservations.find(r => r.ItemId === line.ItemId && (r.ItemSpecId === line.ItemSpecId || (!r.ItemSpecId && !line.ItemSpecId)));
          return {
            itemId: line.ItemId,
            itemSpecId: line.ItemSpecId,
            quantityRequired: line.Quantity,
            remark: line.Remark || null,
            inventoryReservationId: res ? res.InventoryReservationId : null,
            fromLocationId: null, // Let the picker decide or system suggest
            toLocationId: null    // Usually staging area for shipping
          };
        })
      }, tx);

      return { success: true, message: 'Sales order approved successfully' };
    });
  },

  async rejectSalesOrder(salesOrderId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('salesOrderId', sql.Int, salesOrderId);
      const headerRes = await headerReq.query(`
        SELECT SalesOrderId, Status, DocumentNo
        FROM dbo.SalesOrders
        WHERE SalesOrderId = @salesOrderId
      `);
      const so = headerRes.recordset[0];

      if (!so) throw badRequest('Sales order not found');
      if (so.Status !== 'requested') throw badRequest(`Cannot reject sales order in status: ${so.Status}`);

      const updateReq = new sql.Request(tx);
      updateReq.input('salesOrderId', sql.Int, salesOrderId);
      await updateReq.query(`
        UPDATE dbo.SalesOrders
        SET Status = 'rejected', UpdatedAt = SYSUTCDATETIME()
        WHERE SalesOrderId = @salesOrderId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, salesOrderId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), so.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('SO', @docId, @fromStatus, 'rejected', @userId, 'Rejected via Orchestrator')
      `);

      return { success: true, message: 'Sales order rejected' };
    });
  }
};
