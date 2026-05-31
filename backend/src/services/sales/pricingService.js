import { sql, mssqlTransaction } from '../../lib/mssql.js';
import { approvalService } from '../common/approvalService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export const pricingService = {
  async requestPriceContractApproval(contractId, userId, steps = []) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('contractId', sql.Int, contractId);
      const headerRes = await headerReq.query(`
        SELECT CustomerPriceContractId, Status, ContractNo
        FROM dbo.CustomerPriceContracts 
        WHERE CustomerPriceContractId = @contractId
      `);
      const contract = headerRes.recordset[0];
      
      if (!contract) throw badRequest('Price contract not found');
      if (contract.Status !== 'draft') throw badRequest(`Cannot request approval in status: ${contract.Status}`);

      const updateReq = new sql.Request(tx);
      updateReq.input('contractId', sql.Int, contractId);
      await updateReq.query(`
        UPDATE dbo.CustomerPriceContracts 
        SET Status = 'requested'
        WHERE CustomerPriceContractId = @contractId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, contractId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), contract.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('PRICE_CONTRACT', @docId, @fromStatus, 'requested', @userId, 'Requested for approval')
      `);

      await approvalService.createRequest({
        documentType: 'PRICE_CONTRACT',
        documentId: contractId,
        requestedBy: userId,
        notes: `Approval request for Customer Price Contract ${contract.ContractNo}`,
        steps: steps
      }, tx);

      return { success: true, message: 'Price contract submitted for approval' };
    });
  },

  async approvePriceContract(contractId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('contractId', sql.Int, contractId);
      const headerRes = await headerReq.query(`
        SELECT CustomerPriceContractId, Status
        FROM dbo.CustomerPriceContracts 
        WHERE CustomerPriceContractId = @contractId
      `);
      const contract = headerRes.recordset[0];
      
      if (!contract) throw badRequest('Price contract not found');
      if (contract.Status !== 'requested') throw badRequest(`Cannot approve price contract in status: ${contract.Status}`);

      const updateReq = new sql.Request(tx);
      updateReq.input('contractId', sql.Int, contractId);
      await updateReq.query(`
        UPDATE dbo.CustomerPriceContracts 
        SET Status = 'active'
        WHERE CustomerPriceContractId = @contractId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, contractId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), contract.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('PRICE_CONTRACT', @docId, @fromStatus, 'active', @userId, 'Approved and activated via Orchestrator')
      `);

      return { success: true, message: 'Price contract approved and activated successfully' };
    });
  },

  async requestPriceListApproval(priceListId, userId, steps = []) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('priceListId', sql.Int, priceListId);
      const headerRes = await headerReq.query(`
        SELECT PriceListId, IsActive, PriceListName
        FROM dbo.PriceLists 
        WHERE PriceListId = @priceListId
      `);
      const priceList = headerRes.recordset[0];
      
      if (!priceList) throw badRequest('Price list not found');
      if (priceList.IsActive) throw badRequest('Cannot request approval for an already active price list');

      // PriceLists doesn't have a formal Status column, so we just track via DocumentStatusHistory and ApprovalRequests
      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, priceListId);
      histReq.input('userId', sql.Int, userId);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('PRICE_LIST', @docId, 'draft', 'requested', @userId, 'Requested for approval')
      `);

      await approvalService.createRequest({
        documentType: 'PRICE_LIST',
        documentId: priceListId,
        requestedBy: userId,
        notes: `Approval request for Price List ${priceList.PriceListName}`,
        steps: steps
      }, tx);

      return { success: true, message: 'Price list submitted for approval' };
    });
  },

  async approvePriceList(priceListId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('priceListId', sql.Int, priceListId);
      const headerRes = await headerReq.query(`
        SELECT PriceListId, IsActive
        FROM dbo.PriceLists 
        WHERE PriceListId = @priceListId
      `);
      const priceList = headerRes.recordset[0];
      
      if (!priceList) throw badRequest('Price list not found');
      if (priceList.IsActive) throw badRequest('Price list is already active');

      const updateReq = new sql.Request(tx);
      updateReq.input('priceListId', sql.Int, priceListId);
      await updateReq.query(`
        UPDATE dbo.PriceLists 
        SET IsActive = 1
        WHERE PriceListId = @priceListId
      `);

      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, priceListId);
      histReq.input('userId', sql.Int, userId);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('PRICE_LIST', @docId, 'requested', 'active', @userId, 'Approved and activated via Orchestrator')
      `);

      return { success: true, message: 'Price list approved and activated successfully' };
    });
  }
};
