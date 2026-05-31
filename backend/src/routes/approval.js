import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { approvalService } from "../services/common/approvalService.js";
import { salesOrderService } from '../services/sales/salesOrderService.js';
import { quotationService } from '../services/sales/quotationService.js';
import { goodsIssueService } from '../services/inventory/goodsIssueService.js';
import { productionOrderService } from '../services/production/productionOrderService.js';
import { pricingService } from '../services/sales/pricingService.js';
import { pricingPolicyService } from '../services/pricing/pricingPolicyService.js';
import { sql, mssqlQuery } from '../lib/mssql.js';

const router = Router();
router.use(authenticate);

function getUserId(req) {
  const raw = req.user?.sub;
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid authenticated user');
  return userId;
}

// 0. ดึงรายการคำขออนุมัติทั้งหมด (สำหรับหน้าจออนุมัติหลัก)
router.get('/', asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  const docType = req.query.documentType;

  const conditions = [];
  const inputs = {};

  if (status !== 'all') {
    conditions.push('ar.Status = @status');
    inputs.status = { type: sql.NVarChar(30), value: status };
  }
  if (docType) {
    conditions.push('ar.DocumentType = @docType');
    inputs.docType = { type: sql.NVarChar(40), value: docType };
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await mssqlQuery('DEFAULT', `
    SELECT 
      ar.ApprovalRequestId AS id,
      ar.DocumentType AS documentType,
      ar.DocumentId AS documentId,
      ar.RequestedBy AS requestedBy,
      u.DisplayName AS requesterName,
      ar.RequestedAt AS requestedAt,
      ar.Status AS status,
      ar.CurrentStepNo AS currentStepNo,
      ar.Notes AS notes,
      COALESCE(
        qt.DocumentNo, 
        so.DocumentNo, 
        ipv.VersionNo,
        CAST(ar.DocumentId AS NVARCHAR(50))
      ) AS documentNo
    FROM dbo.ApprovalRequests ar
    JOIN dbo.Users u ON u.UserId = ar.RequestedBy
    LEFT JOIN dbo.Quotations qt ON ar.DocumentType = 'QT' AND qt.QuotationId = ar.DocumentId
    LEFT JOIN dbo.SalesOrders so ON ar.DocumentType = 'SO' AND so.SalesOrderId = ar.DocumentId
    LEFT JOIN dbo.ItemPricingPolicyVersions ipv ON ar.DocumentType = 'ITEM_PRICING_POLICY_BULK' AND ipv.ItemPricingPolicyVersionId = ar.DocumentId
    ${whereSql}
    ORDER BY ar.RequestedAt DESC, ar.ApprovalRequestId DESC
  `, { inputs });

  res.json({ data: rows });
}));

// 1. ดึงข้อมูล Request พร้อม Steps
router.get('/:id', asyncHandler(async (req, res) => {
  const requestId = Number(req.params.id);
  const data = await approvalService.getRequestDetails(requestId);
  if (!data) return res.status(404).json({ message: 'Approval request not found' });
  res.json({ data });
}));

// 2. สร้าง Approval Request (สามารถกำหนด Steps ผ่าน Body ได้เลย)
router.post('/', asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { documentType, documentId, notes, steps } = req.body;

  const requestId = await approvalService.createRequest({
    documentType, documentId, notes, requestedBy: userId, steps
  });

  const data = await approvalService.getRequestDetails(requestId);
  res.status(201).json({ data });
}));

// 3. แก้ไข/เพิ่ม/ลบ Steps การอนุมัติ (ส่ง Array ของ steps ใหม่เข้าไปแทนที่ steps ที่เป็น pending)
router.put('/:id/steps', allowRoles('admin', 'manager'), asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const requestId = Number(req.params.id);
  const { steps } = req.body; // Expect array: [{ approverUserId: 1 }, { approverRoleId: 2 }]

  await approvalService.updateSteps(requestId, steps, userId);
  const data = await approvalService.getRequestDetails(requestId);
  res.json({ data });
}));

// 4. อนุมัติ / ปฏิเสธ Step ปัจจุบัน
router.post('/:id/action', asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  // หา RoleIds ของ User นี้เพื่อเอาไปเช็คสิทธิ์ (กรณีอนุมัติระดับ Role)
  const roleRes = await mssqlQuery('DEFAULT', `
    SELECT RoleId FROM dbo.UserRoles WHERE UserId = @userId
  `, { inputs: { userId: { type: sql.Int, value: userId } } });
  const userRoleIds = roleRes.map(r => r.RoleId);

  const requestId = Number(req.params.id);
  const { action, comments } = req.body; // action = 'approved' | 'rejected'

  const result = await approvalService.actionStep(requestId, userId, userRoleIds, action, comments);

  // Trigger business logic automatically if request is finalized
  if (result.finalStatus === 'approved' || result.finalStatus === 'rejected') {
    switch (result.documentType) {
      case 'SO':
        if (result.finalStatus === 'approved') {
          await salesOrderService.approveSalesOrder(result.documentId, userId);
        } else {
          await salesOrderService.rejectSalesOrder(result.documentId, userId);
        }
        break;

      case 'QT':
        if (result.finalStatus === 'approved') {
          await quotationService.approveQuotation(result.documentId, userId);
        } else {
          await quotationService.rejectQuotation(result.documentId, userId);
        }
        break;

      case 'GI':
        if (result.finalStatus === 'approved') {
          await goodsIssueService.approveGoodsIssue(result.documentId, userId);
        }
        break;

      case 'MO':
        if (result.finalStatus === 'approved') {
          await productionOrderService.approveProductionOrder(result.documentId, userId);
        }
        break;

      case 'PRICE_LIST':
        if (result.finalStatus === 'approved') {
          await pricingService.approvePriceList(result.documentId, userId);
        }
        break;

      case 'PRICE_CONTRACT':
        if (result.finalStatus === 'approved') {
          await pricingService.approvePriceContract(result.documentId, userId);
        }
        break;

      case 'ITEM_PRICING_POLICY':
        if (result.finalStatus === 'approved') {
          await pricingPolicyService.approvePolicy(result.documentId, userId);
        } else {
          await pricingPolicyService.rejectPolicy(result.documentId, userId);
        }
        break;

      case 'ITEM_PRICING_POLICY_BULK':
        if (result.finalStatus === 'approved') {
          await pricingPolicyService.approveVersion(result.documentId, userId);
        } else {
          await pricingPolicyService.rejectVersion(result.documentId, userId);
        }
        break;
    }
  }

  const data = await approvalService.getRequestDetails(requestId);
  res.json({ data, finalStatus: result.finalStatus });
}));

export default router;
