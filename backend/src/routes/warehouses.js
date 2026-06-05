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

router.get(
  '/:id/locations',
  readRoles,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await mssqlQuery('DEFAULT', `
      SELECT LocationId, WarehouseId, LocationCode, LocationName, IsPickable, IsActive
      FROM dbo.WarehouseLocations
      WHERE WarehouseId = @whId AND IsActive = 1
      ORDER BY LocationCode
    `, { inputs: { whId: { type: sql.Int, value: parseInt(id, 10) } } });
    // res.json({ data: rows.map(r => ({ value: r.LocationId, label: r.LocationCode + (r.LocationName ? ' - ' + r.LocationName : '') })) });
    res.json({ data: rows.map(r => ({ value: r.LocationId, label: r.LocationCode })) });
  })
);

router.get(
  '/:id/locations-raw',
  readRoles,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await mssqlQuery('DEFAULT', `
      SELECT LocationId, WarehouseId, LocationCode, LocationName, IsPickable, IsActive
      FROM dbo.WarehouseLocations
      WHERE WarehouseId = @whId
      ORDER BY LocationCode
    `, { inputs: { whId: { type: sql.Int, value: parseInt(id, 10) } } });
    res.json({ data: rows });
  })
);

router.post(
  '/:id/locations',
  writeRoles,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { locationCode, locationName, isPickable, isActive } = req.body;
    if (!locationCode) throw new Error('LocationCode is required');

    try {
      const result = await mssqlQuery('DEFAULT', `
        INSERT INTO dbo.WarehouseLocations (WarehouseId, LocationCode, LocationName, IsPickable, IsActive)
        OUTPUT INSERTED.*
        VALUES (@whId, @code, @name, @isPickable, @isActive)
      `, {
        inputs: {
          whId: { type: sql.Int, value: parseInt(id, 10) },
          code: { type: sql.NVarChar, value: locationCode.trim() },
          name: { type: sql.NVarChar, value: locationName ? locationName.trim() : null },
          isPickable: { type: sql.Bit, value: isPickable === undefined ? 1 : (isPickable ? 1 : 0) },
          isActive: { type: sql.Bit, value: isActive === undefined ? 1 : (isActive ? 1 : 0) }
        }
      });
      await refreshLookupsCache();
      res.json({ data: result[0] });
    } catch (error) {
      if (error.message.includes('UQ_WarehouseLocations') || error.message.includes('unique key') || error.message.includes('UNIQUE constraint')) {
        throw new Error('รหัสตำแหน่งนี้มีอยู่แล้วในคลังสินค้านี้');
      }
      throw error;
    }
  })
);

router.put(
  '/:id/locations/:locationId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const { id, locationId } = req.params;
    const { locationCode, locationName, isPickable, isActive } = req.body;
    if (!locationCode) throw new Error('LocationCode is required');

    try {
      const result = await mssqlQuery('DEFAULT', `
        UPDATE dbo.WarehouseLocations
        SET LocationCode = @code,
            LocationName = @name,
            IsPickable = @isPickable,
            IsActive = @isActive
        OUTPUT INSERTED.*
        WHERE WarehouseId = @whId AND LocationId = @locId
      `, {
        inputs: {
          whId: { type: sql.Int, value: parseInt(id, 10) },
          locId: { type: sql.Int, value: parseInt(locationId, 10) },
          code: { type: sql.NVarChar, value: locationCode.trim() },
          name: { type: sql.NVarChar, value: locationName ? locationName.trim() : null },
          isPickable: { type: sql.Bit, value: isPickable === undefined ? 1 : (isPickable ? 1 : 0) },
          isActive: { type: sql.Bit, value: isActive === undefined ? 1 : (isActive ? 1 : 0) }
        }
      });

      if (result.length === 0) throw new Error('Location not found');
      await refreshLookupsCache();
      res.json({ data: result[0] });
    } catch (error) {
      if (error.message.includes('UQ_WarehouseLocations') || error.message.includes('unique key') || error.message.includes('UNIQUE constraint')) {
        throw new Error('รหัสตำแหน่งนี้มีอยู่แล้วในคลังสินค้านี้');
      }
      throw error;
    }
  })
);

router.delete(
  '/:id/locations/:locationId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const { id, locationId } = req.params;
    try {
      await mssqlQuery('DEFAULT', `
        DELETE FROM dbo.WarehouseLocations 
        WHERE WarehouseId = @whId AND LocationId = @locId
      `, {
        inputs: {
          whId: { type: sql.Int, value: parseInt(id, 10) },
          locId: { type: sql.Int, value: parseInt(locationId, 10) }
        }
      });
      await refreshLookupsCache();
      res.json({ success: true });
    } catch (error) {
      if (error.message.includes('REFERENCE constraint')) {
        throw new Error('ไม่สามารถลบตำแหน่งนี้ได้เนื่องจากมีข้อมูลสินค้าหรือธุรกรรมอ้างอิงอยู่');
      }
      throw error;
    }
  })
);

export default router;
