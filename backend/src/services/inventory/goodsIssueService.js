import { sql, mssqlTransaction } from '../../lib/mssql.js';
import { approvalService } from '../common/approvalService.js';
import { wmsTaskService } from '../wms/wmsTaskService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export const goodsIssueService = {
  async requestApproval(goodsIssueId, userId, steps = []) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('giId', sql.Int, goodsIssueId);
      const headerRes = await headerReq.query(`
        SELECT GoodsIssueId, Status, DocumentNo
        FROM dbo.GoodsIssues 
        WHERE GoodsIssueId = @giId
      `);
      const gi = headerRes.recordset[0];
      
      if (!gi) throw badRequest('Goods issue not found');
      if (gi.Status !== 'draft') throw badRequest(`Cannot request approval in status: ${gi.Status}`);

      const updateReq = new sql.Request(tx);
      updateReq.input('giId', sql.Int, goodsIssueId);
      await updateReq.query(`
        UPDATE dbo.GoodsIssues 
        SET Status = 'requested', UpdatedAt = SYSUTCDATETIME()
        WHERE GoodsIssueId = @giId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, goodsIssueId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), gi.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('GI', @docId, @fromStatus, 'requested', @userId, 'Requested for approval')
      `);

      await approvalService.createRequest({
        documentType: 'GI',
        documentId: goodsIssueId,
        requestedBy: userId,
        notes: `Approval request for Goods Issue ${gi.DocumentNo}`,
        steps: steps
      }, tx);

      return { success: true, message: 'Goods issue submitted for approval' };
    });
  },

  async approveGoodsIssue(goodsIssueId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('giId', sql.Int, goodsIssueId);
      const headerRes = await headerReq.query(`
        SELECT GoodsIssueId, Status, WarehouseId
        FROM dbo.GoodsIssues 
        WHERE GoodsIssueId = @giId
      `);
      const gi = headerRes.recordset[0];
      
      if (!gi) throw badRequest('Goods issue not found');
      if (gi.Status !== 'requested') throw badRequest(`Cannot approve goods issue in status: ${gi.Status}`);

      const updateReq = new sql.Request(tx);
      updateReq.input('giId', sql.Int, goodsIssueId);
      await updateReq.query(`
        UPDATE dbo.GoodsIssues 
        SET Status = 'approved', UpdatedAt = SYSUTCDATETIME()
        WHERE GoodsIssueId = @giId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, goodsIssueId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), gi.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('GI', @docId, @fromStatus, 'approved', @userId, 'Approved via Orchestrator')
      `);

      // 3. Generate WMS Picking Task for the Goods Issue
      const linesReq = new sql.Request(tx);
      linesReq.input('giId', sql.Int, goodsIssueId);
      const linesRes = await linesReq.query(`
        SELECT ItemId, ItemSpecId, WarehouseId, LocationId, LotId, IssuedQuantity
        FROM dbo.GoodsIssueLines
        WHERE GoodsIssueId = @giId
      `);
      
      const lines = linesRes.recordset;
      if (lines.length > 0) {
        await wmsTaskService.createTask({
          taskType: 'picking', // Generates a pick task for GI
          referenceType: 'GI',
          referenceId: goodsIssueId,
          warehouseId: gi.WarehouseId, 
          assignedTo: null,
          lines: lines.map(line => ({
            itemId: line.ItemId,
            itemSpecId: line.ItemSpecId,
            lotId: line.LotId,
            quantityRequired: line.IssuedQuantity,
            fromLocationId: line.LocationId, 
            toLocationId: null
          }))
        }, tx);
      }

      return { success: true, message: 'Goods issue approved and pick task generated' };
    });
  }
};
