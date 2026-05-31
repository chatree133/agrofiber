import { sql, mssqlQuery, mssqlTransaction } from '../../lib/mssql.js';
import { approvalService } from '../common/approvalService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function calculatePublishedUnitPrice(policy) {
  const standardPrice = Number(policy.StandardPrice || 0);
  const standardCost = Number(policy.StandardCost || 0);
  const markup = Number(policy.TargetMarkupPercent ?? 0);
  const margin = Number(policy.TargetMarginPercent ?? 0);
  switch (policy.PricingMethodCode) {
    case 'FIXED_PRICE':
      return Number(standardPrice.toFixed(4));

    case 'MARKUP':
      return Number((standardCost + standardCost * (markup / 100)).toFixed(4));

    case 'MARGIN':
      if (margin >= 100) {
        throw badRequest('TargetMarginPercent must be less than 100 when using MARGIN_BASED pricing');
      }
      if (standardCost <= 0) {
        throw badRequest('StandardCost must be greater than zero when using MARGIN_BASED pricing');
      }
      return Number((standardCost / (1 - margin / 100)).toFixed(4));

    default:
      return Number(standardPrice.toFixed(4));
  }
}

export const pricingPolicyService = {
  async getPolicy(policyId, tx = null) {
    const query = `
      SELECT
        ipp.ItemPricingPolicyId,
        ipp.ItemId,
        ipp.ItemSpecId,
        ipp.PricingMethodId,
        pm.PricingMethodCode,
        pm.PricingMethodName,
        ipp.Status,
        ipp.ApprovedBy,
        ipp.ApprovedAt,
        ipp.VersionNo,
        ipp.Priority,
        ipp.Remark,
        ipp.StandardPrice,
        ipp.StandardCost,
        ipp.MinMarginPercent,
        ipp.TargetMarginPercent,
        ipp.MinMarkupPercent,
        ipp.TargetMarkupPercent,
        ipp.CurrencyCode,
        ipp.EffectiveFrom,
        ipp.EffectiveTo,
        ipp.IsActive
      FROM dbo.ItemPricingPolicies ipp
      JOIN dbo.PricingMethods pm on pm.PricingMethodId = ipp.PricingMethodId
      WHERE ipp.ItemPricingPolicyId = @policyId
    `;

    if (tx) {
      const req = new sql.Request(tx);
      req.input('policyId', sql.Int, policyId);
      const result = await req.query(query);
      return result.recordset[0] || null;
    }

    const rows = await mssqlQuery('DEFAULT', query, {
      inputs: { policyId: { type: sql.Int, value: policyId } },
    });
    return rows[0] || null;
  },

  async validatePolicy(policyId) {
    const policy = await this.getPolicy(policyId);
    if (!policy) throw badRequest('Item pricing policy not found');

    const errors = [];
    if (policy.StandardPrice < 0) {
      errors.push('ราคามาตรฐาน (StandardPrice) ต้องเป็นจำนวนที่มากกว่าหรือเท่ากับ 0');
    }
    if (policy.StandardCost < 0) {
      errors.push('ราคาต้นทุน (StandardCost) ต้องเป็นจำนวนที่มากกว่าหรือเท่ากับ 0');
    }
    if (policy.EffectiveTo && policy.EffectiveTo < policy.EffectiveFrom) {
      errors.push('วันที่สิ้นสุด (EffectiveTo) ต้องอยู่ในวันที่เท่ากับหรือหลังจากวันที่เริ่มต้น (EffectiveFrom)');
    }
    if (!policy.PricingMethodCode) {
      errors.push('วิธีการตั้งราคา (PricingMethodCode) ต้องไม่เป็นค่าว่าง');
    }
    if (policy.PricingMethodCode === 'MARGIN' && policy.TargetMarginPercent >= 100) {
      errors.push('เปอร์เซ็นต์เป้าหมาย (TargetMarginPercent) ต้องน้อยกว่า 100 สำหรับการตั้งราคาแบบมาร์จิ้น');
    }
    if (policy.PricingMethodCode === 'MARKUP' && policy.TargetMarkupPercent === null) {
      errors.push('เปอร์เซ็นต์มาร์กอัป (TargetMarkupPercent) จำเป็นสำหรับการตั้งราคาแบบต้นทุนบวก');
    }
    if (policy.PricingMethodCode === 'MARGIN' && policy.TargetMarginPercent === null) {
      errors.push('เปอร์เซ็นต์เป้าหมาย (TargetMarginPercent) จำเป็นสำหรับการตั้งราคาแบบมาร์จิ้น');
    }
    if ((policy.PricingMethodCode === 'MARKUP' || policy.PricingMethodCode === 'MARGIN')
      && (policy.TargetMarkupPercent !== null || policy.TargetMarginPercent !== null)
      && policy.StandardCost < calculatePublishedUnitPrice(policy)) {
      errors.push('ราคาต้นทุน (StandardCost) ต่ำกว่าราคาที่คำนวณด้วยเปอร์เซ็นต์ markup/margin ที่กำหนด, ราคาที่คำนวณได้คือ ' + calculatePublishedUnitPrice(policy));
    }

    return {
      isValid: errors.length === 0,
      errors,
      policy,
    };
  },

  async requestApproval(policyId, userId, steps = [], existingTx = null) {
    const execute = async (tx) => {
      const policy = await this.getPolicy(policyId, tx);
      if (!policy) throw badRequest('Item pricing policy not found');
      if (policy.Status !== 'draft') {
        console.log(policy.Status);
        throw badRequest(`ไม่สามารถขออนุมัติได้ เนื่องจากสถานะปัจจุบันของนโยบายคือ ${policy.Status}`);
      }

      const updateReq = new sql.Request(tx);
      updateReq.input('policyId', sql.Int, policyId);
      await updateReq.query(`
        UPDATE dbo.ItemPricingPolicies
        SET Status = 'requested'
        WHERE ItemPricingPolicyId = @policyId
      `);

      const requestId = await approvalService.createRequest(
        {
          documentType: 'ITEM_PRICING_POLICY',
          documentId: policyId,
          requestedBy: userId,
          notes: `Approval request for Item Pricing Policy ${policyId} (VersionNo: ${policy.VersionNo})`,
          steps,
        },
        tx,
      );

      return { requestId, policyId };
    };

    return existingTx ? await execute(existingTx) : await mssqlTransaction('DEFAULT', execute);
  },

  async requestVersionApproval(versionNo, userId, steps = [], existingTx = null) {
    const execute = async (tx) => {
      const versionReq = new sql.Request(tx);
      versionReq.input('versionNo', sql.NVarChar(30), versionNo);
      const versionRes = await versionReq.query(`
        SELECT ItemPricingPolicyVersionId, Status FROM dbo.ItemPricingPolicyVersions
        WHERE VersionNo = @versionNo
      `);
      if (versionRes.recordset.length === 0) {
        throw badRequest(`Pricing policy version ${versionNo} not found`);
      }
      const version = versionRes.recordset[0];
      if (version.Status !== 'draft') {
        throw badRequest(`Cannot request approval when version status is ${version.Status}`);
      }

      const updateVersionReq = new sql.Request(tx);
      updateVersionReq.input('versionId', sql.Int, version.ItemPricingPolicyVersionId);
      await updateVersionReq.query(`
        UPDATE dbo.ItemPricingPolicyVersions
        SET Status = 'requested'
        WHERE ItemPricingPolicyVersionId = @versionId
      `);

      const updatePoliciesReq = new sql.Request(tx);
      updatePoliciesReq.input('versionNo', sql.NVarChar(30), versionNo);
      await updatePoliciesReq.query(`
        UPDATE dbo.ItemPricingPolicies
        SET Status = 'requested'
        WHERE VersionNo = @versionNo
      `);

      const requestId = await approvalService.createRequest(
        {
          documentType: 'ITEM_PRICING_POLICY_BULK',
          documentId: version.ItemPricingPolicyVersionId,
          requestedBy: userId,
          notes: `Approval request for Pricing Policy Batch (VersionNo: ${versionNo})`,
          steps,
        },
        tx,
      );

      return { requestId, versionNo, versionId: version.ItemPricingPolicyVersionId };
    };

    return existingTx ? await execute(existingTx) : await mssqlTransaction('DEFAULT', execute);
  },

  async approveVersion(versionId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const versionReq = new sql.Request(tx);
      versionReq.input('versionId', sql.Int, versionId);
      const versionRes = await versionReq.query(`
        SELECT VersionNo, Status FROM dbo.ItemPricingPolicyVersions
        WHERE ItemPricingPolicyVersionId = @versionId
      `);
      if (versionRes.recordset.length === 0) {
        throw badRequest('Pricing policy version not found');
      }
      const version = versionRes.recordset[0];
      if (version.Status !== 'requested') {
        throw badRequest(`Cannot approve when version status is ${version.Status}`);
      }

      const updateVersionReq = new sql.Request(tx);
      updateVersionReq.input('versionId', sql.Int, versionId);
      updateVersionReq.input('userId', sql.Int, userId);
      await updateVersionReq.query(`
        UPDATE dbo.ItemPricingPolicyVersions
        SET Status = 'approved', ApprovedBy = @userId, ApprovedAt = SYSUTCDATETIME()
        WHERE ItemPricingPolicyVersionId = @versionId
      `);

      const updatePoliciesReq = new sql.Request(tx);
      updatePoliciesReq.input('versionNo', sql.NVarChar(30), version.VersionNo);
      updatePoliciesReq.input('userId', sql.Int, userId);
      await updatePoliciesReq.query(`
        UPDATE dbo.ItemPricingPolicies
        SET Status = 'approved', ApprovedBy = @userId, ApprovedAt = SYSUTCDATETIME()
        WHERE VersionNo = @versionNo
      `);

      return { versionId, versionNo: version.VersionNo, approvedBy: userId };
    });
  },

  async rejectVersion(versionId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const versionReq = new sql.Request(tx);
      versionReq.input('versionId', sql.Int, versionId);
      const versionRes = await versionReq.query(`
        SELECT VersionNo, Status FROM dbo.ItemPricingPolicyVersions
        WHERE ItemPricingPolicyVersionId = @versionId
      `);
      if (versionRes.recordset.length === 0) {
        throw badRequest('Pricing policy version not found');
      }
      const version = versionRes.recordset[0];
      if (version.Status !== 'requested') {
        throw badRequest(`Cannot reject when version status is ${version.Status}`);
      }

      const updateVersionReq = new sql.Request(tx);
      updateVersionReq.input('versionId', sql.Int, versionId);
      await updateVersionReq.query(`
        UPDATE dbo.ItemPricingPolicyVersions
        SET Status = 'rejected'
        WHERE ItemPricingPolicyVersionId = @versionId
      `);

      const updatePoliciesReq = new sql.Request(tx);
      updatePoliciesReq.input('versionNo', sql.NVarChar(30), version.VersionNo);
      await updatePoliciesReq.query(`
        UPDATE dbo.ItemPricingPolicies
        SET Status = 'rejected'
        WHERE VersionNo = @versionNo
      `);

      return { versionId, versionNo: version.VersionNo, rejectedBy: userId };
    });
  },

  async approvePolicy(policyId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const policy = await this.getPolicy(policyId, tx);
      if (!policy) throw badRequest('Item pricing policy not found');
      if (policy.Status !== 'requested') {
        throw badRequest(`Cannot approve when policy status is ${policy.Status}`);
      }

      const approveReq = new sql.Request(tx);
      approveReq.input('policyId', sql.Int, policyId);
      approveReq.input('userId', sql.Int, userId);
      await approveReq.query(`
        UPDATE dbo.ItemPricingPolicies
        SET Status = 'approved', ApprovedBy = @userId, ApprovedAt = SYSUTCDATETIME()
        WHERE ItemPricingPolicyId = @policyId
      `);

      return { policyId, approvedBy: userId };
    });
  },

  async rejectPolicy(policyId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const policy = await this.getPolicy(policyId, tx);
      if (!policy) throw badRequest('Item pricing policy not found');
      if (policy.Status !== 'requested') {
        throw badRequest(`Cannot reject when policy status is ${policy.Status}`);
      }

      const rejectReq = new sql.Request(tx);
      rejectReq.input('policyId', sql.Int, policyId);
      await rejectReq.query(`
        UPDATE dbo.ItemPricingPolicies
        SET Status = 'rejected'
        WHERE ItemPricingPolicyId = @policyId
      `);

      return { policyId, rejectedBy: userId };
    });
  },

  async publishPolicy(policyId, priceListId, unitId, userId) {
    return mssqlTransaction('DEFAULT', async (tx) => {
      const policy = await this.getPolicy(policyId, tx);
      if (!policy) throw badRequest('Item pricing policy not found');
      if (policy.Status !== 'approved') {
        throw badRequest(`Cannot publish when policy status is ${policy.Status}`);
      }

      if (!Number.isInteger(priceListId) || priceListId <= 0) {
        throw badRequest('priceListId must be a positive integer');
      }
      if (!Number.isInteger(unitId) || unitId <= 0) {
        throw badRequest('unitId must be a positive integer');
      }

      const unitPrice = calculatePublishedUnitPrice(policy);

      const deleteReq = new sql.Request(tx);
      deleteReq.input('priceListId', sql.Int, priceListId);
      deleteReq.input('itemId', sql.Int, policy.ItemId);
      deleteReq.input('itemSpecId', sql.Int, policy.ItemSpecId);
      deleteReq.input('unitId', sql.Int, unitId);
      deleteReq.input('effectiveFrom', sql.Date, policy.EffectiveFrom);
      await deleteReq.query(`
        DELETE FROM dbo.PriceListItems
        WHERE PriceListId = @priceListId
          AND ItemId = @itemId
          AND UnitId = @unitId
          AND EffectiveFrom = @effectiveFrom
          AND ((ItemSpecId IS NULL AND @itemSpecId IS NULL) OR ItemSpecId = @itemSpecId)
      `);

      const insertReq = new sql.Request(tx);
      insertReq.input('priceListId', sql.Int, priceListId);
      insertReq.input('itemId', sql.Int, policy.ItemId);
      insertReq.input('itemSpecId', sql.Int, policy.ItemSpecId);
      insertReq.input('unitId', sql.Int, unitId);
      insertReq.input('unitPrice', sql.Decimal(18, 4), unitPrice);
      insertReq.input('unitCost', sql.Decimal(18, 4), policy.StandardCost);
      insertReq.input('currencyCode', sql.Char(3), policy.CurrencyCode || 'THB');
      insertReq.input('effectiveFrom', sql.Date, policy.EffectiveFrom);
      insertReq.input('effectiveTo', sql.Date, policy.EffectiveTo);
      insertReq.input('pricingMethod', sql.NVarChar(30), policy.PricingMethodCode);
      insertReq.input('discountPercent', sql.Decimal(9, 4), null);
      insertReq.input('discountAmount', sql.Decimal(18, 4), null);
      insertReq.input('markupPercent', sql.Decimal(9, 4), policy.TargetMarkupPercent);
      insertReq.input('marginPercent', sql.Decimal(9, 4), policy.TargetMarginPercent);
      insertReq.input('isActive', sql.Bit, true);

      const inserted = await insertReq.query(`
        INSERT INTO dbo.PriceListItems (
          PriceListId,
          ItemId,
          ItemSpecId,
          UnitId,
          UnitPrice,
          UnitCost,
          CurrencyCode,
          EffectiveFrom,
          EffectiveTo,
          IsActive,
          PricingMethod,
          DiscountPercent,
          DiscountAmount,
          MarkupPercent,
          MarginPercent
        )
        OUTPUT INSERTED.PriceListItemId
        VALUES (
          @priceListId,
          @itemId,
          @itemSpecId,
          @unitId,
          @unitPrice,
          @unitCost,
          @currencyCode,
          @effectiveFrom,
          @effectiveTo,
          @isActive,
          @pricingMethod,
          @discountPercent,
          @discountAmount,
          @markupPercent,
          @marginPercent
        )
      `);

      const updatePolicyReq = new sql.Request(tx);
      updatePolicyReq.input('policyId', sql.Int, policyId);
      await updatePolicyReq.query(`
        UPDATE dbo.ItemPricingPolicies
        SET Status = 'published'
        WHERE ItemPricingPolicyId = @policyId
      `);

      return {
        priceListItemId: inserted.recordset[0]?.PriceListItemId,
        policyId,
      };
    });
  },
};
