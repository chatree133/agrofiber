import { Router } from 'express';
import { mssqlQuery, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);
router.use(allowRoles('admin'));

function mapBranch(row) {
  return {
    branchId: row.BranchId,
    companyId: row.CompanyId,
    branchCode: row.BranchCode,
    branchName: row.BranchName,
    taxBranchCode: row.TaxBranchCode,
    address: row.Address,
    isHeadOffice: Boolean(row.IsHeadOffice),
    isActive: Boolean(row.IsActive),
  };
}

router.get(
  '/:branchId',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.Branches
      WHERE BranchId = @branchId
    `, {
      inputs: {
        branchId: {
          type: sql.Int,
          value: Number(req.params.branchId),
        },
      },
    });

    if (!rows.length) {
      res.status(404).json({
        message: 'Branch not found',
      });
      return;
    }

    res.json({
      data: mapBranch(rows[0]),
    });
  }),
);

router.put(
  '/:branchId',
  asyncHandler(async (req, res) => {
    const branchId = Number(req.params.branchId);

    const {
      branchCode,
      branchName,
      taxBranchCode,
      address,
      isHeadOffice,
      isActive,
    } = req.body;

    const updates = [];
    const inputs = {
      branchId: {
        type: sql.Int,
        value: branchId,
      },
    };

    if (branchCode !== undefined) {
      updates.push('BranchCode = @branchCode');
      inputs.branchCode = {
        type: sql.NVarChar(30),
        value: branchCode,
      };
    }

    if (branchName !== undefined) {
      updates.push('BranchName = @branchName');
      inputs.branchName = {
        type: sql.NVarChar(255),
        value: branchName,
      };
    }

    if (taxBranchCode !== undefined) {
      updates.push('TaxBranchCode = @taxBranchCode');
      inputs.taxBranchCode = {
        type: sql.NVarChar(30),
        value: taxBranchCode,
      };
    }

    if (address !== undefined) {
      updates.push('Address = @address');
      inputs.address = {
        type: sql.NVarChar(1000),
        value: address,
      };
    }

    if (isHeadOffice !== undefined) {
      updates.push('IsHeadOffice = @isHeadOffice');
      inputs.isHeadOffice = {
        type: sql.Bit,
        value: Boolean(isHeadOffice),
      };
    }

    if (isActive !== undefined) {
      updates.push('IsActive = @isActive');
      inputs.isActive = {
        type: sql.Bit,
        value: Boolean(isActive),
      };
    }

    if (!updates.length) {
      res.status(400).json({
        message: 'No fields to update',
      });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Branches
      SET ${updates.join(', ')}
      OUTPUT inserted.*
      WHERE BranchId = @branchId
    `, {
      inputs,
    });

    if (!rows.length) {
      res.status(404).json({
        message: 'Branch not found',
      });
      return;
    }

    res.json({
      data: mapBranch(rows[0]),
    });
  }),
);

router.delete(
  '/:branchId',
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Branches
      SET IsActive = 0
      OUTPUT inserted.*
      WHERE BranchId = @branchId
    `, {
      inputs: {
        branchId: {
          type: sql.Int,
          value: Number(req.params.branchId),
        },
      },
    });

    if (!rows.length) {
      res.status(404).json({
        message: 'Branch not found',
      });
      return;
    }

    res.status(204).send();
  }),
);

export default router;