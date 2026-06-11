import { Router } from 'express';
import { mssqlQuery, mssqlQueryFull, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

// --- In-Memory Cache for Master Data Lookups ---
let lookupsCache = null;
let lookupsCacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 ชั่วโมง

// เคลียร์ Cache (ใช้ตอนที่มีการเพิ่ม/ลบ ข้อมูล Master Data จากระบบ)
export function invalidateLookupsCache() {
  lookupsCache = null;
  lookupsCacheTimestamp = 0;
}

export async function refreshLookupsCache() {
  const sql = `
    -- 0: ItemTypes
    SELECT ItemTypeId AS value, ItemTypeCode + ' - ' + ItemTypeName AS label 
    FROM dbo.ItemTypes WHERE IsActive = 1 ORDER BY ItemTypeCode;

    -- 1: ProductTypes
    SELECT ProductTypeId AS value, ProductTypeCode + ' - ' + ProductTypeName AS label 
    FROM dbo.ProductTypes WHERE IsActive = 1 ORDER BY ProductTypeCode;

    -- 2: Units
    SELECT UnitId AS value, UnitCode + ' - ' + UnitName AS label 
    FROM dbo.Units
    WHERE UnitCode IN ('PACK', 'PALLET', 'PCS', 'SHEET')
    ORDER BY CASE UnitCode
      WHEN 'PACK' THEN 1
      WHEN 'PALLET' THEN 2
      WHEN 'PCS' THEN 3
      WHEN 'SHEET' THEN 4
      ELSE 99
    END;

    -- 3: TaxCodes
    SELECT TaxCodeId AS value, TaxCode + ' (' + CAST(TaxRatePercent AS NVARCHAR) + '%)' AS label, TaxRatePercent 
    FROM dbo.TaxCodes WHERE IsActive = 1 ORDER BY TaxCode;

    -- 4: ItemThicknesses
    SELECT ThicknessId AS value, CAST(ThicknessMm AS NVARCHAR) + ' mm' AS label 
    FROM dbo.ItemThicknesses WHERE IsActive = 1 ORDER BY ThicknessMm;

    -- 5: ItemWidths
    SELECT WidthId AS value, CAST(WidthM AS NVARCHAR) + ' m' AS label, WidthM AS widthM
    FROM dbo.ItemWidths WHERE IsActive = 1 ORDER BY WidthM;

    -- 6: ItemLengths
    SELECT LengthId AS value, CAST(LengthM AS NVARCHAR) + ' m' AS label, LengthM AS lengthM
    FROM dbo.ItemLengths WHERE IsActive = 1 ORDER BY LengthM;
    
    -- 7: Warehouses
    SELECT WarehouseId AS value, WarehouseCode + ' - ' + WarehouseName AS label 
    FROM dbo.Warehouses WHERE IsActive = 1 ORDER BY WarehouseCode;
    
    -- 8: PaymentTerms
    SELECT PaymentTermId AS value, PaymentTermCode + ' - ' + PaymentTermName AS label 
    FROM dbo.PaymentTerms WHERE IsActive = 1 ORDER BY PaymentTermName;

    -- 9: Surfaces
    SELECT SurfaceId AS value, SurfaceName AS label 
    FROM dbo.Surfaces WHERE IsActive = 1 ORDER BY SurfaceName;

    -- 10: Grades
    SELECT GradeId AS value, GradeName AS label 
    FROM dbo.Grades WHERE IsActive = 1 ORDER BY GradeName;

    -- 11: CustomerSegments
    SELECT CustomerSegmentId AS value, SegmentCode + ' - ' + SegmentName AS label
    FROM dbo.CustomerSegments WHERE IsActive = 1 ORDER BY SegmentCode;

    -- 12: CustomerPriceGroups
    SELECT CustomerPriceGroupId AS value, PriceGroupCode + ' - ' + PriceGroupName AS label
    FROM dbo.CustomerPriceGroups WHERE IsActive = 1 ORDER BY PriceGroupCode;

    -- 13: Roles (ถ้าต้องการให้ Frontend รู้จัก Role ต่างๆ ด้วย)
    SELECT RoleId AS value, RoleName AS label 
    FROM dbo.Roles ORDER BY RoleName;

    -- 14: Provices (สำหรับ Dropdown ที่ต้องการเลือกจังหวัด)
    SELECT PROVINCE_ID AS value, PROVINCE_THAI AS label 
    FROM dbo.provinces ORDER BY PROVINCE_THAI COLLATE Thai_100_CI_AI;
  `;

  const result = await mssqlQueryFull('DEFAULT', sql);

  const newData = {
    itemTypes: result.recordsets[0] || [],
    productTypes: result.recordsets[1] || [],
    units: result.recordsets[2] || [],
    taxCodes: result.recordsets[3] || [],
    thicknesses: result.recordsets[4] || [],
    widths: result.recordsets[5] || [],
    lengths: result.recordsets[6] || [],
    warehouses: result.recordsets[7] || [],
    paymentTerms: result.recordsets[8] || [],
    surfaces: result.recordsets[9] || [],
    grades: result.recordsets[10] || [],
    customerSegments: result.recordsets[11] || [],
    customerPriceGroups: result.recordsets[12] || [],
    roles: result.recordsets[13] || [],
    provinces: result.recordsets[14] || [],
  };

  lookupsCache = newData;
  lookupsCacheTimestamp = Date.now();
  return lookupsCache;
}

router.get(
  '/lookups',
  allowRoles('admin', 'accounting', 'user', 'audit'),
  asyncHandler(async (req, res) => {
    const now = Date.now();

    // 1. ถ้ามี Cache อยู่และยังไม่หมดอายุ ให้ส่งกลับได้เลยทันที (เร็วมาก)
    if (lookupsCache && now - lookupsCacheTimestamp < CACHE_DURATION_MS) {
      // ไม่บอก Browser ให้จำ เพื่อแก้ปัญหา Browser Cache

      res.json({ data: lookupsCache, cached: true });
      return;
    }

    // 2. ถ้าหมดอายุ หรือ ยังไม่เคยดึงข้อมูล ให้ดึงข้อมูลทั้งหมดพร้อมกัน
    const freshData = await refreshLookupsCache();
    res.json({ data: freshData, cached: false });
  })
);

router.post(
  '/lookups/refresh',
  allowRoles('admin', 'accounting', 'user', 'audit'),
  asyncHandler(async (req, res) => {
    const freshData = await refreshLookupsCache();
    res.json({ message: 'Cache refreshed successfully', data: freshData });
  })
);

// --- Endpoints ย่อย (เผื่อกรณีต้องการ Force โหลดเฉพาะบางตาราง) ---

router.get(
  '/salespersons',
  allowRoles('admin', 'accounting', 'user', 'audit'),
  asyncHandler(async (req, res) => {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const inputs = {};
    let whereSql = "WHERE IsActive = 1";
    if (search) {
      whereSql += " AND (StaffId LIKE @search OR DisplayName LIKE @search OR Username LIKE @search)";
      inputs.search = { type: sql.NVarChar(255), value: `%${search}%` };
    }
    const rows = await mssqlQuery('DEFAULT', `
      SELECT UserId AS value, StaffId, DisplayName, StaffId + ' - ' + DisplayName AS label
      FROM dbo.Users
      ${whereSql}
      ORDER BY StaffId
    `, { inputs });
    res.json({ data: rows });
  })
);

router.get('/customers', allowRoles('admin', 'accounting', 'user', 'audit'), (_req, res) => {
  // TODO: Implement actual query or leave it for pagination
  res.json({ data: [{ id: 1, code: 'CUST-001', name: 'Advance Agro Public Co., Ltd.' }] });
});

router.get(
  '/vendors',
  allowRoles('admin', 'accounting', 'audit', 'user', 'inventory', 'warehouse'),
  asyncHandler(async (req, res) => {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const inputs = {};
    let whereSql = "WHERE IsActive = 1";
    if (search) {
      whereSql += " AND (VendorCode LIKE @search OR VendorName LIKE @search)";
      inputs.search = { type: sql.NVarChar(255), value: `%${search}%` };
    }
    try {
      const rows = await mssqlQuery('DEFAULT', `
        SELECT VendorId AS id, VendorCode AS code, VendorName AS name, VendorCode + ' - ' + VendorName AS label
        FROM dbo.Vendors
        ${whereSql}
        ORDER BY VendorCode
      `, { inputs });

      if (rows.length === 0 && !search) {
        res.json({
          data: [
            { id: 1, code: 'VEND-001', name: 'Double A Paper', label: 'VEND-001 - Double A Paper' },
            { id: 2, code: 'VEND-002', name: 'Siam Forestry', label: 'VEND-002 - Siam Forestry' }
          ]
        });
      } else {
        res.json({ data: rows });
      }
    } catch (err) {
      console.error('Failed to query vendors, returning fallback:', err);
      res.json({
        data: [
          { id: 1, code: 'VEND-001', name: 'Double A Paper', label: 'VEND-001 - Double A Paper' },
          { id: 2, code: 'VEND-002', name: 'Siam Forestry', label: 'VEND-002 - Siam Forestry' }
        ]
      });
    }
  })
);

router.get(
  '/postal-code/:code',
  allowRoles('admin', 'accounting', 'user', 'audit'),
  asyncHandler(async (req, res) => {
    const postalCode = req.params.code;
    const rows = await mssqlQuery('DEFAULT', `
      SELECT TOP 1
        sd.SUB_DISTRICT_ID AS subDistrictId,
        sd.SUB_DISTRICT_THAI AS subDistrictThai,
        sd.POSTAL_CODE AS postalCode,
        d.DISTRICT_ID AS districtId,
        d.DISTRICT_THAI AS districtThai,
        p.PROVINCE_ID AS provinceId,
        p.PROVINCE_THAI AS provinceThai
      FROM dbo.sub_districts sd
      JOIN dbo.districts d ON d.DISTRICT_ID = sd.DISTRICT_ID
      JOIN dbo.provinces p ON p.PROVINCE_ID = d.PROVINCE_ID
      WHERE sd.POSTAL_CODE = @postalCode
    `, {
      inputs: {
        postalCode: { type: sql.NVarChar(20), value: postalCode }
      }
    });

    if (!rows.length) {
      return res.status(404).json({ message: 'Postal code not found' });
    }

    res.json({ data: rows[0] });
  })
);

// --- Units (UOM) CRUD ---

// Get all Units
router.get(
  '/units',
  allowRoles('admin', 'accounting', 'user', 'audit'),
  asyncHandler(async (req, res) => {
    const rows = await mssqlQuery('DEFAULT', `
      SELECT UnitId AS id, UnitCode AS code, UnitName AS name
      FROM dbo.Units
      ORDER BY UnitCode
    `);
    res.json({ data: rows });
  })
);

// Create a new Unit (admin only)
router.post(
  '/units',
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const code = String(req.body.code || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();

    if (!code) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสหน่วยนับ (Code is required)' });
    }
    if (!name) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อหน่วยนับ (Name is required)' });
    }

    // Check if code already exists
    const existing = await mssqlQuery('DEFAULT', `
      SELECT 1 FROM dbo.Units WHERE UnitCode = @code
    `, {
      inputs: {
        code: { type: sql.NVarChar(30), value: code }
      }
    });

    if (existing.length > 0) {
      return res.status(400).json({ message: `รหัสหน่วยนับ '${code}' มีในระบบแล้ว` });
    }

    const result = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.Units (UnitCode, UnitName)
      OUTPUT INSERTED.UnitId AS id
      VALUES (@code, @name)
    `, {
      inputs: {
        code: { type: sql.NVarChar(30), value: code },
        name: { type: sql.NVarChar(100), value: name }
      }
    });

    invalidateLookupsCache();

    res.status(201).json({
      success: true,
      data: {
        id: result[0].id,
        code,
        name
      }
    });
  })
);

// Update a Unit (admin only)
router.put(
  '/units/:id',
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid ID parameter' });
    }

    const code = String(req.body.code || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();

    if (!code) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสหน่วยนับ (Code is required)' });
    }
    if (!name) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อหน่วยนับ (Name is required)' });
    }

    // Check duplicate code for other IDs
    const duplicate = await mssqlQuery('DEFAULT', `
      SELECT 1 FROM dbo.Units WHERE UnitCode = @code AND UnitId <> @id
    `, {
      inputs: {
        code: { type: sql.NVarChar(30), value: code },
        id: { type: sql.Int, value: id }
      }
    });

    if (duplicate.length > 0) {
      return res.status(400).json({ message: `รหัสหน่วยนับ '${code}' ซ้ำกับหน่วยนับอื่นในระบบ` });
    }

    await mssqlQuery('DEFAULT', `
      UPDATE dbo.Units
      SET UnitCode = @code, UnitName = @name
      WHERE UnitId = @id
    `, {
      inputs: {
        code: { type: sql.NVarChar(30), value: code },
        name: { type: sql.NVarChar(100), value: name },
        id: { type: sql.Int, value: id }
      }
    });

    invalidateLookupsCache();

    res.json({
      success: true,
      data: {
        id,
        code,
        name
      }
    });
  })
);

// Delete a Unit (blocked)
router.delete(
  '/units/:id',
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    return res.status(400).json({ message: 'ไม่อนุญาตให้ลบหน่วยนับเนื่องจากมีผลกระทบต่อประวัติสินค้าและการแปลงหน่วย' });
  })
);

export default router;
