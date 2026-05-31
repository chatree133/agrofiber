import { sql, mssqlTransaction, mssqlQuery } from '../../lib/mssql.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export const approvalService = {
  /**
   * สร้างคำขออนุมัติใหม่ พร้อมกำหนด Steps เริ่มต้น
   */
  async createRequest({ documentType, documentId, requestedBy, notes, steps = [] }, existingTx = null) {
    const execute = async (tx) => {
      // ตรวจสอบว่ามี Request ที่กำลังรออนุมัติของ Document นี้อยู่แล้วหรือไม่
      const checkReq = new sql.Request(tx);
      checkReq.input('docType', sql.NVarChar(40), documentType);
      checkReq.input('docId', sql.Int, documentId);
      const checkRes = await checkReq.query(`
        SELECT 1 FROM dbo.ApprovalRequests 
        WHERE DocumentType = @docType AND DocumentId = @docId AND Status = 'pending'
      `);
      if (checkRes.recordset.length > 0) {
        throw badRequest('There is already a pending approval request for this document.');
      }

      // 1. สร้าง Request
      const reqHeader = new sql.Request(tx);
      reqHeader.input('docType', sql.NVarChar(40), documentType);
      reqHeader.input('docId', sql.Int, documentId);
      reqHeader.input('requestedBy', sql.Int, requestedBy);
      reqHeader.input('notes', sql.NVarChar(1000), notes || null);

      const resHeader = await reqHeader.query(`
        INSERT INTO dbo.ApprovalRequests (DocumentType, DocumentId, RequestedBy, Notes, Status, CurrentStepNo)
        OUTPUT INSERTED.ApprovalRequestId
        VALUES (@docType, @docId, @requestedBy, @notes, 'pending', 1)
      `);

      const requestId = resHeader.recordset[0].ApprovalRequestId;

      // 2. สร้าง Steps
      let resolvedSteps = Array.isArray(steps) ? steps : [];
      if (resolvedSteps.length === 0) {
        const wfReq = new sql.Request(tx);
        wfReq.input('docType', sql.NVarChar(40), documentType);
        const wfRes = await wfReq.query(`
          SELECT TOP 2 WorkflowDefinitionId
          FROM dbo.WorkflowDefinitions
          WHERE DocumentType = @docType AND IsActive = 1
          ORDER BY CreatedAt DESC, WorkflowDefinitionId DESC
        `);

        if (wfRes.recordset.length === 1) {
          const workflowDefinitionId = wfRes.recordset[0].WorkflowDefinitionId;
          const stepReq = new sql.Request(tx);
          stepReq.input('defId', sql.Int, workflowDefinitionId);
          const stepRes = await stepReq.query(`
            SELECT StepNo, ApproverUserId, ApproverRoleId, IsRequired
            FROM dbo.WorkflowSteps
            WHERE WorkflowDefinitionId = @defId
            ORDER BY StepNo ASC
          `);
          resolvedSteps = stepRes.recordset.map((r) => ({
            approverUserId: r.ApproverUserId,
            approverRoleId: r.ApproverRoleId,
            isRequired: r.IsRequired,
          }));
        } else if (wfRes.recordset.length > 1) {
          throw badRequest(`Multiple active workflows found for documentType: ${documentType}`);
        }
      }

      if (resolvedSteps.length > 0) {
        for (let i = 0; i < resolvedSteps.length; i++) {
          const step = resolvedSteps[i];
          const reqStep = new sql.Request(tx);
          reqStep.input('reqId', sql.BigInt, requestId);
          reqStep.input('stepNo', sql.Int, i + 1);
          reqStep.input('userId', sql.Int, step.approverUserId || null);
          reqStep.input('roleId', sql.Int, step.approverRoleId || null);

          if (!step.approverUserId && !step.approverRoleId) {
            throw badRequest(`Step ${i + 1} must have either an approver user or role.`);
          }

          await reqStep.query(`
            INSERT INTO dbo.ApprovalSteps (ApprovalRequestId, StepNo, ApproverUserId, ApproverRoleId, Status)
            VALUES (@reqId, @stepNo, @userId, @roleId, 'pending')
          `);
        }
      }

      const auditReq = new sql.Request(tx);
      auditReq.input('reqId', sql.BigInt, requestId);
      auditReq.input('stepNo', sql.Int, 0);
      auditReq.input('actionBy', sql.Int, requestedBy);
      auditReq.input('comments', sql.NVarChar(1000), notes || null);
      await auditReq.query(`
        INSERT INTO dbo.ApprovalActions (ApprovalRequestId, StepNo, ActionBy, Action, Comments)
        VALUES (@reqId, @stepNo, @actionBy, 'submitted', @comments)
      `);

      return requestId;
    };

    return existingTx ? await execute(existingTx) : await mssqlTransaction('DEFAULT', execute);
  },

  /**
   * เพิ่ม/แก้ไข/ลบ Steps การอนุมัติ (ใช้ได้เฉพาะตอนที่ Request ยังเป็น Pending)
   */
  async updateSteps(requestId, newSteps, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const checkReq = new sql.Request(tx);
      checkReq.input('reqId', sql.BigInt, requestId);
      const checkRes = await checkReq.query(`SELECT Status FROM dbo.ApprovalRequests WHERE ApprovalRequestId = @reqId`);

      if (checkRes.recordset.length === 0) throw badRequest('Approval request not found');
      if (checkRes.recordset[0].Status !== 'pending') throw badRequest('Can only modify steps for pending requests');

      // ลบ Steps เดิมที่ยังไม่ได้อนุมัติ (Pending)
      const delReq = new sql.Request(tx);
      delReq.input('reqId', sql.BigInt, requestId);
      await delReq.query(`DELETE FROM dbo.ApprovalSteps WHERE ApprovalRequestId = @reqId AND Status = 'pending'`);

      // นับหาว่าตอนนี้ Step ล่าสุดที่อนุมัติไปแล้วคือเลขอะไร เพื่อรัน Step ถัดไป
      const maxReq = new sql.Request(tx);
      maxReq.input('reqId', sql.BigInt, requestId);
      const maxRes = await maxReq.query(`SELECT ISNULL(MAX(StepNo), 0) AS MaxStep FROM dbo.ApprovalSteps WHERE ApprovalRequestId = @reqId`);
      let nextStepNo = maxRes.recordset[0].MaxStep + 1;

      // เพิ่ม Steps เข้าไปใหม่
      for (const step of newSteps) {
        const reqStep = new sql.Request(tx);
        reqStep.input('reqId', sql.BigInt, requestId);
        reqStep.input('stepNo', sql.Int, nextStepNo);
        reqStep.input('userId', sql.Int, step.approverUserId || null);
        reqStep.input('roleId', sql.Int, step.approverRoleId || null);

        if (!step.approverUserId && !step.approverRoleId) {
          throw badRequest('Each step must have an approver user or role.');
        }

        await reqStep.query(`
          INSERT INTO dbo.ApprovalSteps (ApprovalRequestId, StepNo, ApproverUserId, ApproverRoleId, Status)
          VALUES (@reqId, @stepNo, @userId, @roleId, 'pending')
        `);
        nextStepNo++;
      }

      return { success: true };
    });
  },

  /**
   * ดำเนินการอนุมัติหรือปฏิเสธ
   */
  async actionStep(requestId, approverUserId, approverRoleIds, action, comments) {
    if (!['approved', 'rejected'].includes(action)) throw badRequest('Action must be approved or rejected');

    return mssqlTransaction('DEFAULT', async (tx) => {
      // 1. ตรวจสอบ Request
      const reqHeader = new sql.Request(tx);
      reqHeader.input('reqId', sql.BigInt, requestId);
      const resHeader = await reqHeader.query(`
        SELECT DocumentType, DocumentId, Status, CurrentStepNo 
        FROM dbo.ApprovalRequests 
        WHERE ApprovalRequestId = @reqId
      `);

      if (resHeader.recordset.length === 0) throw badRequest('Approval request not found');
      const request = resHeader.recordset[0];

      if (request.Status !== 'pending') throw badRequest(`Approval request is already ${request.Status}`);

      // 2. ดึง Step ปัจจุบัน
      const stepReq = new sql.Request(tx);
      stepReq.input('reqId', sql.BigInt, requestId);
      stepReq.input('stepNo', sql.Int, request.CurrentStepNo);
      const stepRes = await stepReq.query(`
        SELECT ApprovalStepId, ApproverUserId, ApproverRoleId, Status 
        FROM dbo.ApprovalSteps 
        WHERE ApprovalRequestId = @reqId AND StepNo = @stepNo
      `);

      if (stepRes.recordset.length === 0) throw badRequest('Current approval step not found');
      const step = stepRes.recordset[0];

      // 3. ตรวจสอบสิทธิ์ว่า User มีสิทธิ์อนุมัติ Step นี้ไหม
      const isUserMatch = step.ApproverUserId && step.ApproverUserId === approverUserId;
      const isRoleMatch = step.ApproverRoleId && approverRoleIds.includes(step.ApproverRoleId);

      if (!isUserMatch && !isRoleMatch) {
        throw badRequest('You are not authorized to approve this step.');
      }

      // 4. อัปเดต Step
      const updateStepReq = new sql.Request(tx);
      updateStepReq.input('stepId', sql.BigInt, step.ApprovalStepId);
      updateStepReq.input('status', sql.NVarChar(30), action);
      updateStepReq.input('comments', sql.NVarChar(1000), comments || null);

      await updateStepReq.query(`
        UPDATE dbo.ApprovalSteps 
        SET Status = @status, ActionAt = SYSUTCDATETIME(), Comments = @comments
        WHERE ApprovalStepId = @stepId
      `);

      const auditReq = new sql.Request(tx);
      auditReq.input('reqId', sql.BigInt, requestId);
      auditReq.input('stepNo', sql.Int, request.CurrentStepNo);
      auditReq.input('actionBy', sql.Int, approverUserId);
      auditReq.input('comments', sql.NVarChar(1000), comments || null);
      await auditReq.query(`
        INSERT INTO dbo.ApprovalActions (ApprovalRequestId, StepNo, ActionBy, Action, Comments)
        VALUES (@reqId, @stepNo, @actionBy, @action, @comments)
      `);

      // 5. ตัดสินใจสถานะ Request ต่อไป
      if (action === 'rejected') {
        // ถ้าระงับ (Reject) ก็ให้ Request จบเลย
        const updateReqReq = new sql.Request(tx);
        updateReqReq.input('reqId', sql.BigInt, requestId);
        await updateReqReq.query(`
          UPDATE dbo.ApprovalRequests 
          SET Status = 'rejected' 
          WHERE ApprovalRequestId = @reqId
        `);
        return { success: true, finalStatus: 'rejected' };
      }

      // ถ้า Approved ให้เช็คว่ามี Step ถัดไปไหม
      const checkNextReq = new sql.Request(tx);
      checkNextReq.input('reqId', sql.BigInt, requestId);
      checkNextReq.input('nextStepNo', sql.Int, request.CurrentStepNo + 1);
      const checkNextRes = await checkNextReq.query(`
        SELECT 1 FROM dbo.ApprovalSteps 
        WHERE ApprovalRequestId = @reqId AND StepNo = @nextStepNo
      `);

      if (checkNextRes.recordset.length > 0) {
        // ไป Step ถัดไป
        const updateReqReq = new sql.Request(tx);
        updateReqReq.input('reqId', sql.BigInt, requestId);
        updateReqReq.input('nextStepNo', sql.Int, request.CurrentStepNo + 1);
        await updateReqReq.query(`
          UPDATE dbo.ApprovalRequests 
          SET CurrentStepNo = @nextStepNo 
          WHERE ApprovalRequestId = @reqId
        `);
        return { success: true, finalStatus: 'pending', nextStep: request.CurrentStepNo + 1 };
      } else {
        // ไม่มี Step ถัดไปแล้ว ถือว่าผ่านสมบูรณ์
        const updateReqReq = new sql.Request(tx);
        updateReqReq.input('reqId', sql.BigInt, requestId);
        await updateReqReq.query(`
          UPDATE dbo.ApprovalRequests 
          SET Status = 'approved' 
          WHERE ApprovalRequestId = @reqId
        `);
        return { success: true, finalStatus: 'approved', documentType: request.DocumentType, documentId: request.DocumentId };
      }
    });
  },

  /**
   * ดึงข้อมูล Approval Request พร้อม Steps ทั้งหมด
   */
  async getRequestDetails(requestId) {
    const reqRes = await mssqlQuery('DEFAULT', `
      SELECT 
        ar.ApprovalRequestId, ar.DocumentType, ar.DocumentId, 
        ar.RequestedBy, u.DisplayName AS RequesterDisplayName,
        ar.RequestedAt, ar.Status, ar.CurrentStepNo, ar.Notes
      FROM dbo.ApprovalRequests ar
      JOIN dbo.Users u ON u.UserId = ar.RequestedBy
      WHERE ar.ApprovalRequestId = @reqId
    `, { inputs: { reqId: { type: sql.BigInt, value: requestId } } });

    if (reqRes.length === 0) return null;
    const request = reqRes[0];

    const stepsRes = await mssqlQuery('DEFAULT', `
      SELECT 
        s.ApprovalStepId, s.StepNo, 
        s.ApproverUserId, u.DisplayName AS ApproverDisplayName,
        s.ApproverRoleId, r.RoleName AS ApproverRoleName,
        s.Status, s.ActionAt, s.Comments
      FROM dbo.ApprovalSteps s
      LEFT JOIN dbo.Users u ON u.UserId = s.ApproverUserId
      LEFT JOIN dbo.Roles r ON r.RoleId = s.ApproverRoleId
      WHERE s.ApprovalRequestId = @reqId
      ORDER BY s.StepNo ASC
    `, { inputs: { reqId: { type: sql.BigInt, value: requestId } } });

    return {
      id: request.ApprovalRequestId,
      documentType: request.DocumentType,
      documentId: request.DocumentId,
      requestedBy: request.RequestedBy,
      requestedByName: request.RequesterDisplayName,
      requestedAt: request.RequestedAt,
      status: request.Status,
      currentStepNo: request.CurrentStepNo,
      notes: request.Notes,
      steps: stepsRes.map(s => ({
        id: s.ApprovalStepId,
        stepNo: s.StepNo,
        approverUserId: s.ApproverUserId,
        approverUserName: s.ApproverDisplayName,
        approverRoleId: s.ApproverRoleId,
        approverRoleName: s.ApproverRoleName,
        status: s.Status,
        actionAt: s.ActionAt,
        comments: s.Comments
      }))
    };
  },

  async getRequestByDocument(documentType, documentId) {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT TOP 1 ApprovalRequestId
      FROM dbo.ApprovalRequests
      WHERE DocumentType = @docType
        AND DocumentId = @docId
      ORDER BY RequestedAt DESC
    `, {
      inputs: {
        docType: { type: sql.NVarChar(40), value: documentType },
        docId: { type: sql.Int, value: documentId },
      },
    });

    if (rows.length === 0) return null;
    return this.getRequestDetails(rows[0].ApprovalRequestId);
  }
};
