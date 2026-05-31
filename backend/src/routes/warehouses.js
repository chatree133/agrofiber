import { Router } from 'express';
import { mssqlQuery, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { refreshLookupsCache } from './masterData.js';

const router = Router();
router.use(authenticate);

const writeRoles = allowRoles('admin', 'accounting', 'user');
const readRoles = allowRoles('admin', 'accounting', 'user', 'audit');

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT WarehouseId, WarehouseCode, WarehouseName, IsActive
      FROM dbo.Warehouses
      ORDER BY WarehouseCode
    `);
    res.json({ data: rows });
  })
);

router.post(
  '/',
  writeRoles,
  asyncHandler(async (req, res) => {
    const { warehouseCode, warehouseName, isActive } = req.body;
    if (!warehouseCode) throw new Error('WarehouseCode is required');
    if (!warehouseName) throw new Error('WarehouseName is required');

    const result = await mssqlQuery(
      'DEFAULT',
      `
      INSERT INTO dbo.Warehouses (WarehouseCode, WarehouseName, IsActive)
      OUTPUT INSERTED.*
      VALUES (@code, @name, @isActive)
    `,
      {
        inputs: {
          code: { type: sql.NVarChar, value: warehouseCode.trim() },
          name: { type: sql.NVarChar, value: warehouseName.trim() },
          isActive: { type: sql.Bit, value: isActive === undefined ? 1 : (isActive ? 1 : 0) },
        },
      }
    );

    await refreshLookupsCache();
    res.json({ data: result[0] });
  })
);

router.put(
  '/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { warehouseCode, warehouseName, isActive } = req.body;

    if (!warehouseCode) throw new Error('WarehouseCode is required');
    if (!warehouseName) throw new Error('WarehouseName is required');

    const result = await mssqlQuery(
      'DEFAULT',
      `
      UPDATE dbo.Warehouses
      SET WarehouseCode = @code,
          WarehouseName = @name,
          IsActive = @isActive
      OUTPUT INSERTED.*
      WHERE WarehouseId = @id
    `,
      {
        inputs: {
          id: { type: sql.Int, value: parseInt(id, 10) },
          code: { type: sql.NVarChar, value: warehouseCode.trim() },
          name: { type: sql.NVarChar, value: warehouseName.trim() },
          isActive: { type: sql.Bit, value: isActive === undefined ? 1 : (isActive ? 1 : 0) },
        },
      }
    );

    if (result.length === 0) throw new Error('Warehouse not found');

    await refreshLookupsCache();
    res.json({ data: result[0] });
  })
);

router.delete(
  '/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if it's used somewhere? We could just let SQL Server throw an FK constraint error if it's used.
    try {
      await mssqlQuery(
        'DEFAULT',
        `DELETE FROM dbo.Warehouses WHERE WarehouseId = @id`,
        { inputs: { id: { type: sql.Int, value: parseInt(id, 10) } } }
      );
    } catch (error) {
      if (error.message.includes('REFERENCE constraint')) {
        throw new Error('ไม่สามารถลบคลังสินค้านี้ได้เนื่องจากมีข้อมูลที่ถูกนำไปใช้งานแล้ว');
      }
      throw error;
    }

    await refreshLookupsCache();
    res.json({ success: true });
  })
);

export default router;
