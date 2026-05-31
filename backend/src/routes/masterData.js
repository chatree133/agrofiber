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
    FROM dbo.Units ORDER BY UnitCode;

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
    roles: result.recordsets[13] || []
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

router.get('/vendors', allowRoles('admin', 'accounting', 'audit'), (_req, res) => {
  res.json({ data: [{ id: 1, code: 'VEND-001', name: 'Double A Paper' }] });
});

export default router;
