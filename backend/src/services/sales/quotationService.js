import { sql, mssqlTransaction } from '../../lib/mssql.js';
import { approvalService } from '../common/approvalService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export const quotationService = {
  /**
   * ส่งใบเสนอราคาเข้าขั้นตอนขออนุมัติ (Request Approval)
   */
  async requestApproval(quotationId, userId, steps = []) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      // 1. ตรวจสอบข้อมูลใบเสนอราคา
      const headerReq = new sql.Request(tx);
      headerReq.input('quotationId', sql.Int, quotationId);
      const headerRes = await headerReq.query(`
        SELECT QuotationId, Status, DocumentNo
        FROM dbo.Quotations 
        WHERE QuotationId = @quotationId
      `);
      const qt = headerRes.recordset[0];
      
      if (!qt) throw badRequest('Quotation not found');
      if (qt.Status !== 'draft') throw badRequest(`Cannot request approval for Quotation in status: ${qt.Status}`);

      // 2. อัปเดตสถานะของเอกสารเป็น 'requested'
      const updateReq = new sql.Request(tx);
      updateReq.input('quotationId', sql.Int, quotationId);
      await updateReq.query(`
        UPDATE dbo.Quotations 
        SET Status = 'requested', UpdatedAt = SYSUTCDATETIME()
        WHERE QuotationId = @quotationId
      `);

      // 3. บันทึกประวัติสถานะลงใน History
      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, quotationId);
      histReq.input('userId', sql.Int, userId);
      histReq.input('fromStatus', sql.NVarChar(30), qt.Status);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('QT', @docId, @fromStatus, 'requested', @userId, 'Requested for approval')
      `);

      // 4. สร้าง Approval Request ผูกกับเอกสารประเภท 'QT'
      await approvalService.createRequest({
        documentType: 'QT',
        documentId: quotationId,
        requestedBy: userId,
        notes: `Approval request for Quotation ${qt.DocumentNo}`,
        steps: steps
      }, tx);

      return { success: true, message: 'Quotation submitted for approval' };
    });
  },

  /**
   * อนุมัติใบเสนอราคา (Approve - ถูกเรียกอัตโนมัติจาก Approval System ขั้นสุดท้าย)
   */
  async approveQuotation(quotationId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('quotationId', sql.Int, quotationId);
      const headerRes = await headerReq.query(`
        SELECT QuotationId, Status, DocumentNo FROM dbo.Quotations WHERE QuotationId = @quotationId
      `);
      const qt = headerRes.recordset[0];
      
      if (!qt) throw badRequest('Quotation not found');
      if (qt.Status !== 'requested') throw badRequest(`Cannot approve Quotation in status: ${qt.Status}`);

      // อัปเดตสถานะเป็น 'approved'
      const updateReq = new sql.Request(tx);
      updateReq.input('quotationId', sql.Int, quotationId);
      await updateReq.query(`
        UPDATE dbo.Quotations SET Status = 'approved', UpdatedAt = SYSUTCDATETIME() WHERE QuotationId = @quotationId
      `);

      // บันทึกประวัติสถานะ
      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, quotationId);
      histReq.input('userId', sql.Int, userId);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('QT', @docId, 'requested', 'approved', @userId, 'Quotation approved')
      `);

      return { success: true, message: 'Quotation approved successfully' };
    });
  },

  /**
   * ปฏิเสธใบเสนอราคา (Reject - ถูกเรียกโดยระบบอนุมัติหลักเมื่อถูกปฏิเสธ)
   */
  async rejectQuotation(quotationId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const headerReq = new sql.Request(tx);
      headerReq.input('quotationId', sql.Int, quotationId);
      const headerRes = await headerReq.query(`
        SELECT QuotationId, Status, DocumentNo FROM dbo.Quotations WHERE QuotationId = @quotationId
      `);
      const qt = headerRes.recordset[0];
      
      if (!qt) throw badRequest('Quotation not found');
      if (qt.Status !== 'requested') throw badRequest(`Cannot reject Quotation in status: ${qt.Status}`);

      // ย้อนสถานะกลับไปเป็น 'draft' เพื่อแก้ไขใหม่
      const updateReq = new sql.Request(tx);
      updateReq.input('quotationId', sql.Int, quotationId);
      await updateReq.query(`
        UPDATE dbo.Quotations SET Status = 'draft', UpdatedAt = SYSUTCDATETIME() WHERE QuotationId = @quotationId
      `);

      // บันทึกประวัติสถานะ
      const histReq = new sql.Request(tx);
      histReq.input('docId', sql.Int, quotationId);
      histReq.input('userId', sql.Int, userId);
      await histReq.query(`
        INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, FromStatus, ToStatus, ChangedBy, Notes)
        VALUES ('QT', @docId, 'requested', 'draft', @userId, 'Quotation rejected and reverted to draft')
      `);

      return { success: true, message: 'Quotation rejected' };
    });
  }
};
