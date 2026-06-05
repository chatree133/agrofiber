import { Router } from "express";
import { mssqlQuery, mssqlTransaction, sql } from "../lib/mssql.js";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger.js";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { refreshLookupsCache } from "./masterData.js";
import { pricingPolicyService } from "../services/pricing/pricingPolicyService.js";
import { approvalService } from "../services/common/approvalService.js";
import { validatePricingPolicy } from "../services/pricing/pricingUtils.js";

const router = Router();

router.use(authenticate);

const readRoles = allowRoles("admin", "accounting", "user", "audit");
const writeRoles = allowRoles("admin", "accounting", "user");

function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function parseId(value, name = "id") {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0)
        throw badRequest(`${name} must be a positive integer`);
    return id;
}

function parseBool(value) {
    return value === true || value === "true" || value === "1" || value === 1;
}

function parseOptionalId(value, name) {
    if (value === null || value === undefined || value === "") return null;
    return parseId(value, name);
}

function parseOptionalNumber(value, name) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw badRequest(`${name} must be a number`);
    return n;
}

function parseOptionalDate(value, name) {
    if (value === null || value === undefined || value === "") return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        throw badRequest(`${name} must be a valid date`);
    return d;
}

function getUserId(req) {
    const raw = req.user?.sub;
    const userId = Number(raw);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw badRequest('Invalid authenticated user');
    }
    return userId;
}

function normalizeEnum(value, allowed, name) {
    if (value === null || value === undefined || value === "") return null;
    const v = String(value).toLowerCase();
    if (!allowed.includes(v))
        throw badRequest(`${name} must be one of: ${allowed.join(", ")}`);
    return v;
}

function formatUtcTimestampYYYYMMDDHHMMSS() {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mi = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function generatePricingPolicyVersionNo() {
    const suffix = randomBytes(3).toString("hex").toUpperCase(); // 6 chars
    return `V${formatUtcTimestampYYYYMMDDHHMMSS()}-${suffix}`;
}

async function resolveSalesSku(tx, salesSkuRaw) {
    const salesSku = String(salesSkuRaw || "").trim();
    if (!salesSku) return null;

    const req = new sql.Request(tx);
    req.input("salesSku", sql.NVarChar(100), salesSku);
    const res = await req.query(`
      SELECT TOP 1 s.ItemId, s.ItemSpecId, i.UnitId
      FROM dbo.ItemSpecs s
      JOIN dbo.Items i ON i.ItemId = s.ItemId
      WHERE s.SalesSKU = @salesSku
    `);
    return res.recordset[0] || null;
}

function mapItem(row) {
    if (!row) return null;
    return {
        id: row.ItemId,
        code: row.ItemCode,
        name: row.ItemName,
        itemTypeId: row.ItemTypeId,
        itemTypeCode: row.ItemTypeCode,
        itemTypeName: row.ItemTypeName,
        productTypeId: row.ProductTypeId,
        productTypeCode: row.ProductTypeCode,
        productTypeName: row.ProductTypeName,
        thicknessId: row.ThicknessId,
        thicknessMm: row.ThicknessMm,
        widthId: row.WidthId,
        widthM: row.WidthM,
        lengthId: row.LengthId,
        lengthM: row.LengthM,
        areaSqm: row.AreaSqm,
        unitId: row.UnitId,
        unitCode: row.UnitCode,
        unitName: row.UnitName,
        taxCodeId: row.TaxCodeId,
        taxCode: row.TaxCode,
        taxName: row.TaxName,
        defaultWarehouseId: row.DefaultWarehouseId,
        defaultWarehouseCode: row.WarehouseCode,
        defaultWarehouseName: row.WarehouseName,
        valuationMethod: row.ValuationMethod,
        allowNegativeStock: Boolean(row.AllowNegativeStock),
        status: row.Status,
        isLotControlled: Boolean(row.IsLotControlled),
        isActive: Boolean(row.IsActive),
    };
}

function mapItemListRow(row) {
    if (!row) return null;
    return {
        rowKey: row.ItemSpecId
            ? `itemSpec-${row.ItemId}-${row.ItemSpecId}`
            : `item-${row.ItemId}`,
        itemId: row.ItemId,
        itemSpecId: row.ItemSpecId,
        rowType: row.RowType,
        code: row.DisplayCode,
        displayCode: row.DisplayCode,
        itemCode: row.ItemCode,
        name: row.DisplayName,
        itemTypeId: row.ItemTypeId,
        itemTypeCode: row.ItemTypeCode,
        itemTypeName: row.ItemTypeName,
        productTypeId: row.ProductTypeId,
        productTypeCode: row.ProductTypeCode,
        productTypeName: row.ProductTypeName,
        thicknessId: row.ThicknessId,
        thicknessMm: row.ThicknessMm,
        widthId: row.WidthId,
        widthM: row.WidthM,
        lengthId: row.LengthId,
        lengthM: row.LengthM,
        areaSqm: row.AreaSqm,
        unitId: row.UnitId,
        unitCode: row.UnitCode,
        unitName: row.UnitName,
        taxCodeId: row.TaxCodeId,
        taxCode: row.TaxCode,
        taxName: row.TaxName,
        defaultWarehouseId: row.DefaultWarehouseId,
        defaultWarehouseCode: row.WarehouseCode,
        defaultWarehouseName: row.WarehouseName,
        valuationMethod: row.ValuationMethod,
        allowNegativeStock: Boolean(row.AllowNegativeStock),
        status: row.Status,
        isLotControlled: Boolean(row.IsLotControlled),
        isActive: Boolean(row.IsActive),
        salesSku: row.SalesSKU,
        specCode: row.SpecCode,
        specName: row.SpecName,
        surfaceId: row.SurfaceId,
        surfaceName: row.SurfaceName,
        gradeId: row.GradeId,
        gradeName: row.GradeName,
    };
}

async function getItem(itemId) {
    const rows = await mssqlQuery(
        "DEFAULT",
        `
    SELECT
      i.ItemId,
      i.ItemCode,
      i.ItemName,
      i.ItemTypeId,
      it.ItemTypeCode,
      it.ItemTypeName,
      i.ProductTypeId,
      pt.ProductTypeCode,
      pt.ProductTypeName,
      i.ThicknessId,
      th.ThicknessMm,
      i.WidthId,
      w.WidthM,
      i.LengthId,
      l.LengthM,
      i.AreaSqm,
      i.UnitId,
      u.UnitCode,
      u.UnitName,
      i.TaxCodeId,
      tc.TaxCode,
      tc.TaxName,
      i.DefaultWarehouseId,
      wh.WarehouseCode,
      wh.WarehouseName,
      i.ValuationMethod,
      i.AllowNegativeStock,
      i.Status,
      i.IsLotControlled,
      i.IsActive
    FROM dbo.Items i
    JOIN dbo.ItemTypes it ON it.ItemTypeId = i.ItemTypeId
    JOIN dbo.Units u ON u.UnitId = i.UnitId
    LEFT JOIN dbo.ProductTypes pt ON pt.ProductTypeId = i.ProductTypeId
    LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
    LEFT JOIN dbo.ItemWidths w ON w.WidthId = i.WidthId
    LEFT JOIN dbo.ItemLengths l ON l.LengthId = i.LengthId
    LEFT JOIN dbo.TaxCodes tc ON tc.TaxCodeId = i.TaxCodeId
    LEFT JOIN dbo.Warehouses wh ON wh.WarehouseId = i.DefaultWarehouseId
    WHERE i.ItemId = @itemId
  `,
        { inputs: { itemId: { type: sql.Int, value: itemId } } },
    );

    return mapItem(rows[0]);
}

// function buildItemFilters(query) {
//   const page = Math.max(Number(query.page || 1), 1);
//   const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
//   const inputs = {};

//   // Build parent item filter (ItemCode, ItemName only)
//   const parentConditions = [];
//   if (query.search) {
//     const terms = String(query.search).trim().split(/\s+/).filter(Boolean);
//     if (terms.length > 0) {
//       const searchConditions = [];
//       terms.forEach((term, idx) => {
//         const paramName = `search${idx}`;
//         searchConditions.push(`(i.ItemCode LIKE @${paramName} OR i.ItemName LIKE @${paramName})`);
//         inputs[paramName] = { type: sql.NVarChar(255), value: `%${term}%` };
//       });
//       parentConditions.push(`(${searchConditions.join(' AND ')})`);
//     }
//   }

//   if (query.itemTypeId) {
//     parentConditions.push('i.ItemTypeId = @itemTypeId');
//     inputs.itemTypeId = { type: sql.Int, value: parseId(query.itemTypeId, 'itemTypeId') };
//   }

//   if (query.productTypeId) {
//     parentConditions.push('i.ProductTypeId = @productTypeId');
//     inputs.productTypeId = { type: sql.Int, value: parseId(query.productTypeId, 'productTypeId') };
//   }

//   if (query.widthId) {
//     parentConditions.push('i.WidthId = @widthId');
//     inputs.widthId = { type: sql.Int, value: parseId(query.widthId, 'widthId') };
//   }

//   if (query.lengthId) {
//     parentConditions.push('i.LengthId = @lengthId');
//     inputs.lengthId = { type: sql.Int, value: parseId(query.lengthId, 'lengthId') };
//   }

//   if (query.thicknessId) {
//     parentConditions.push('i.ThicknessId = @thicknessId');
//     inputs.thicknessId = { type: sql.Int, value: parseId(query.thicknessId, 'thicknessId') };
//   }

//   if (query.surfaceId) {
//     specConditions.push('ispec.SurfaceId = @surfaceId');
//     inputs.surfaceId = { type: sql.Int, value: parseId(query.surfaceId, 'surfaceId') };
//   }

//   if (query.gradeId) {
//     specConditions.push('ispec.GradeId = @gradeId');
//     inputs.gradeId = { type: sql.Int, value: parseId(query.gradeId, 'gradeId') };
//   }

//   if (query.status !== undefined && query.status !== '') {
//     const status = normalizeEnum(query.status, ['draft', 'active', 'obsolete'], 'status');
//     parentConditions.push('i.Status = @status');
//     inputs.status = { type: sql.NVarChar(30), value: status };
//   }

//   if (query.isActive !== undefined && query.isActive !== '') {
//     parentConditions.push('i.IsActive = @isActive');
//     inputs.isActive = { type: sql.Bit, value: parseBool(query.isActive) };
//   }

//   // Build child spec filter (SalesSKU, SpecCode, SpecName, SurfaceName, GradeName)
//   const specConditions = [];
//   let hasSpecSearch = false;
//   if (query.search) {
//     const terms = String(query.search).trim().split(/\s+/).filter(Boolean);
//     if (terms.length > 0) {
//       hasSpecSearch = true;
//       const searchConditions = [];
//       terms.forEach((term, idx) => {
//         const paramName = `specSearch${idx}`;
//         searchConditions.push(`(
//           ispec.SalesSKU LIKE @${paramName} OR
//           ispec.SpecCode LIKE @${paramName} OR
//           ispec.SpecName LIKE @${paramName} OR
//           surf.SurfaceName LIKE @${paramName} OR
//           g.GradeName LIKE @${paramName}
//         )`);
//         inputs[paramName] = { type: sql.NVarChar(255), value: `%${term}%` };
//       });
//       specConditions.push(`(${searchConditions.join(' AND ')})`);
//     }
//   }

//   return {
//     page,
//     pageSize,
//     parentWhereSql: parentConditions.length ? `WHERE ${parentConditions.join(' AND ')}` : '',
//     specWhereSql: specConditions.length ? `WHERE ${specConditions.join(' AND ')} AND ispec.ItemSpecId IS NOT NULL` : 'WHERE ispec.ItemSpecId IS NOT NULL',
//     hasSpecSearch,
//     inputs,
//   };
// }

router.post(
    "/bulk/pricing-policies",
    writeRoles,
    asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        if (rows.length === 0) throw badRequest("rows must be a non-empty array");
        if (rows.length > 20_000) throw badRequest("rows exceeds maximum of 20000");

        const versionNo = generatePricingPolicyVersionNo();

        res.status(202).json({
            data: {
                versionNo,
                totalCount: rows.length,
                message: "Bulk import accepted (processing in background)",
            },
        });

        setImmediate(async () => {
            try {
                // 0. Load Units lookup for mapping
                const unitRows = await mssqlQuery('DEFAULT', `SELECT UnitId, UnitCode FROM dbo.Units`);
                const unitMap = {};
                unitRows.forEach(u => {
                    unitMap[String(u.UnitCode).toUpperCase().trim()] = u.UnitId;
                });

                // 1. Create version header record in database
                await mssqlTransaction("DEFAULT", async (tx) => {
                    const versionReq = new sql.Request(tx);
                    versionReq.input("versionNo", sql.NVarChar(30), versionNo);
                    versionReq.input("createdBy", sql.Int, userId);
                    await versionReq.query(`
                      INSERT INTO dbo.ItemPricingPolicyVersions (VersionNo, Status, CreatedBy)
                      VALUES (@versionNo, 'draft', @createdBy)
                    `);
                });

                const chunkSize = 250;
                for (let offset = 0; offset < rows.length; offset += chunkSize) {
                    const chunk = rows.slice(offset, offset + chunkSize);
                    // eslint-disable-next-line no-await-in-loop
                    await mssqlTransaction("DEFAULT", async (tx) => {
                        for (const row of chunk) {
                            const salesSku = String(
                                row?.salesSku ?? row?.salesSKU ?? "",
                            ).trim();
                            const pricingMethodId = Number(row?.pricingMethodId);
                            if (
                                !salesSku ||
                                !Number.isInteger(pricingMethodId) ||
                                pricingMethodId <= 0
                            ) {
                                continue;
                            }

                            const resolved = await resolveSalesSku(tx, salesSku);
                            const itemId = resolved?.ItemId ?? -1;
                            const itemSpecId = resolved?.ItemSpecId ?? null;

                            const remark =
                                itemId === -1
                                    ? `SKU ${salesSku} NOT FOUND`
                                    : row?.remark
                                        ? String(row.remark)
                                        : null;

                            // Resolve unitId: map excel UnitCode to UnitId, fallback to default SKU unitId or 1
                            const rawUnitCode = String(row?.unitCode ?? row?.UnitCode ?? row?.unit ?? row?.Unit ?? '').toUpperCase().trim();
                            const unitId = unitMap[rawUnitCode] || resolved?.UnitId || 1;

                            const insertReq = new sql.Request(tx);
                            insertReq.input("itemId", sql.Int, itemId);
                            insertReq.input("itemSpecId", sql.Int, itemSpecId);
                            insertReq.input("unitId", sql.Int, unitId);
                            insertReq.input(
                                "pricingMethodId",
                                sql.Int,
                                pricingMethodId,
                            );
                            insertReq.input("createdBy", sql.Int, userId);
                            insertReq.input(
                                "versionNo",
                                sql.NVarChar(30),
                                versionNo,
                            );
                            insertReq.input(
                                "priority",
                                sql.Int,
                                Number(row?.priority) || 0,
                            );
                            insertReq.input("remark", sql.NVarChar(4000), remark);

                            insertReq.input(
                                "standardPrice",
                                sql.Decimal(18, 4),
                                Number(row?.standardPrice) || 0,
                            );
                            insertReq.input(
                                "standardCost",
                                sql.Decimal(18, 4),
                                Number(row?.standardCost) || 0,
                            );

                            const toNullableNumber = (v) => {
                                if (v === "" || v === null || v === undefined) return null;
                                const n = Number(v);
                                return Number.isFinite(n) ? n : null;
                            };

                            insertReq.input(
                                "minMarginPercent",
                                sql.Decimal(9, 4),
                                toNullableNumber(row?.minMarginPercent),
                            );
                            insertReq.input(
                                "targetMarginPercent",
                                sql.Decimal(9, 4),
                                toNullableNumber(row?.targetMarginPercent),
                            );
                            insertReq.input(
                                "minMarkupPercent",
                                sql.Decimal(9, 4),
                                toNullableNumber(row?.minMarkupPercent),
                            );
                            insertReq.input(
                                "targetMarkupPercent",
                                sql.Decimal(9, 4),
                                toNullableNumber(row?.targetMarkupPercent),
                            );

                            insertReq.input(
                                "currencyCode",
                                sql.Char(3),
                                row?.currencyCode
                                    ? String(row.currencyCode)
                                        .toUpperCase()
                                        .slice(0, 3)
                                    : "THB",
                            );

                            const toNullableDate = (v) => {
                                if (v === "" || v === null || v === undefined) return null;
                                const d = new Date(v);
                                return Number.isNaN(d.getTime()) ? null : d;
                            };

                            insertReq.input(
                                "effectiveFrom",
                                sql.Date,
                                toNullableDate(row?.effectiveFrom),
                            );
                            insertReq.input(
                                "effectiveTo",
                                sql.Date,
                                toNullableDate(row?.effectiveTo),
                            );
                            insertReq.input(
                                "isActive",
                                sql.Bit,
                                row?.isActive === undefined
                                    ? null
                                    : Boolean(row.isActive),
                            );

                            await insertReq.query(`
                              INSERT INTO dbo.ItemPricingPolicies (
                                ItemId,
                                ItemSpecId,
                                UnitId,
                                PricingMethodId,
                                Status,
                                VersionNo,
                                Priority,
                                Remark,
                                StandardPrice,
                                StandardCost,
                                MinMarginPercent,
                                TargetMarginPercent,
                                MinMarkupPercent,
                                TargetMarkupPercent,
                                CurrencyCode,
                                EffectiveFrom,
                                EffectiveTo,
                                IsActive,
                                CreatedBy
                              )
                              VALUES (
                                @itemId,
                                @itemSpecId,
                                @unitId,
                                @pricingMethodId,
                                'draft',
                                @versionNo,
                                ISNULL(@priority, 0),
                                @remark,
                                ISNULL(@standardPrice, 0),
                                ISNULL(@standardCost, 0),
                                @minMarginPercent,
                                @targetMarginPercent,
                                @minMarkupPercent,
                                @targetMarkupPercent,
                                ISNULL(@currencyCode, 'THB'),
                                ISNULL(@effectiveFrom, CAST(SYSUTCDATETIME() AS DATE)),
                                @effectiveTo,
                                ISNULL(@isActive, 1),
                                @createdBy
                              )
                            `);
                        }
                    });
                }

                // 2. Trigger bulk approval request for the entire version batch
                await pricingPolicyService.requestVersionApproval(versionNo, userId);

                logger.info(
                    { versionNo, totalCount: rows.length },
                    "[bulk pricing policies] completed",
                );
            } catch (err) {
                logger.error(
                    { err, versionNo, totalCount: rows.length },
                    "[bulk pricing policies] failed",
                );
            }
        });
    }),
);

router.get(
    "/pricing-policies/history",
    readRoles,
    asyncHandler(async (req, res) => {
        const page = Math.max(Number(req.query.page || 1), 1);
        const pageSize = Math.min(
            Math.max(Number(req.query.pageSize || 50), 1),
            200,
        );
        const offset = (page - 1) * pageSize;
        const versionNo = req.query.versionNo
            ? String(req.query.versionNo).trim()
            : null;

        const whereSql = versionNo ? "WHERE ipv.VersionNo LIKE @versionNo OR pc.VersionNo LIKE @versionNo" : "";
        const rows = await mssqlQuery(
            "DEFAULT",
            `
        WITH policy_counts AS (
          SELECT
            ipp.VersionNo,
            COUNT(1) AS TotalCount,
            SUM(CASE WHEN ipp.Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedCount,
            SUM(CASE WHEN ipp.Status = 'requested' THEN 1 ELSE 0 END) AS RequestedCount,
            SUM(CASE WHEN ipp.Status = 'rejected' THEN 1 ELSE 0 END) AS RejectedCount,
            SUM(CASE WHEN ipp.Status = 'draft' THEN 1 ELSE 0 END) AS DraftCount
          FROM dbo.ItemPricingPolicies ipp
          GROUP BY ipp.VersionNo
        )
        SELECT
          COALESCE(ipv.VersionNo, pc.VersionNo) AS VersionNo,
          COALESCE(ipv.CreatedAt, (SELECT MIN(ipp2.CreatedAt) FROM dbo.ItemPricingPolicies ipp2 WHERE ipp2.VersionNo = pc.VersionNo)) AS CreatedAt,
          COALESCE(ipv.CreatedBy, (SELECT MIN(ipp2.CreatedBy) FROM dbo.ItemPricingPolicies ipp2 WHERE ipp2.VersionNo = pc.VersionNo)) AS CreatedBy,
          u.DisplayName AS CreatedByName,
          COALESCE(pc.TotalCount, 0) AS TotalCount,
          COALESCE(ipv.Status, 
            CASE 
              WHEN pc.ApprovedCount = pc.TotalCount THEN 'approved'
              WHEN pc.RejectedCount > 0 THEN 'rejected'
              WHEN pc.RequestedCount > 0 THEN 'requested'
              ELSE 'draft'
            END
          ) AS Status,
          COALESCE(pc.ApprovedCount, 0) AS ApprovedCount,
          COALESCE(pc.RequestedCount, 0) AS RequestedCount,
          COALESCE(pc.RejectedCount, 0) AS RejectedCount,
          COALESCE(pc.DraftCount, 0) AS DraftCount
        FROM policy_counts pc
        LEFT JOIN dbo.ItemPricingPolicyVersions ipv ON ipv.VersionNo = pc.VersionNo
        LEFT JOIN dbo.Users u ON u.UserId = COALESCE(ipv.CreatedBy, (SELECT MIN(ipp2.CreatedBy) FROM dbo.ItemPricingPolicies ipp2 WHERE ipp2.VersionNo = pc.VersionNo))
        ${whereSql}
        ORDER BY CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
      `,
            {
                inputs: {
                    offset: { type: sql.Int, value: offset },
                    pageSize: { type: sql.Int, value: pageSize },
                    ...(versionNo
                        ? {
                            versionNo: {
                                type: sql.NVarChar(30),
                                value: `%${versionNo}%`,
                            },
                        }
                        : {}),
                },
            },
        );

        res.json({
            data: rows.map((r) => ({
                versionNo: r.VersionNo,
                createdAt: r.CreatedAt,
                createdBy: r.CreatedBy,
                createdByName: r.CreatedByName,
                totalCount: r.TotalCount,
                status: r.Status,
                approvedCount: r.ApprovedCount,
                requestedCount: r.RequestedCount,
                rejectedCount: r.RejectedCount,
                draftCount: r.DraftCount,
            })),
            paging: { page, pageSize },
        });
    }),
);

router.get(
    "/pricing-policies/by-version/:versionNo",
    readRoles,
    asyncHandler(async (req, res) => {
        const versionNo = String(req.params.versionNo || "").trim();
        if (!versionNo) throw badRequest("versionNo is required");

        const rows = await mssqlQuery(
            "DEFAULT",
            `
            SELECT
                ipp.ItemPricingPolicyId,
                ipp.ItemId,
                ipp.UnitId,
                unit.UnitCode,
                unit.UnitName,
                i.ItemCode,
                i.ItemName,
                ipp.ItemSpecId,
                ispec.SalesSKU,
                ipp.PricingMethodId,
                pm.PricingMethodCode,
                pm.PricingMethodName,
                ipp.Status,
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
                ipp.IsActive,
                ipp.CreatedBy,
                u.DisplayName AS CreatedByName,
                ipp.CreatedAt
            FROM dbo.ItemPricingPolicies ipp
            JOIN dbo.PricingMethods pm ON pm.PricingMethodId = ipp.PricingMethodId
            LEFT JOIN dbo.Units unit ON unit.UnitId = ipp.UnitId
            LEFT JOIN dbo.Items i ON i.ItemId = ipp.ItemId
            LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = ipp.ItemSpecId
            LEFT JOIN dbo.Users u ON u.UserId = ipp.CreatedBy
            WHERE ipp.VersionNo = @versionNo
            ORDER BY ipp.CreatedAt ASC, ipp.ItemPricingPolicyId ASC
            `,
            {
                inputs: {
                    versionNo: { type: sql.NVarChar(30), value: versionNo },
                },
            },
        );

        const mappedData = rows.map((r) => {
            const validation = validatePricingPolicy(r);
            return {
                id: r.ItemPricingPolicyId,
                itemId: r.ItemId,
                unitId: r.UnitId,
                unitCode: r.UnitCode,
                unitName: r.UnitName,
                itemCode: r.ItemCode,
                itemName: r.ItemName,
                itemSpecId: r.ItemSpecId,
                salesSku: r.SalesSKU,
                pricingMethodId: r.PricingMethodId,
                pricingMethodCode: r.PricingMethodCode,
                pricingMethodName: r.PricingMethodName,
                status: r.Status,
                versionNo: r.VersionNo,
                priority: r.Priority,
                remark: r.Remark,
                standardPrice: Number(r.StandardPrice || 0),
                standardCost: Number(r.StandardCost || 0),
                minMarginPercent: r.MinMarginPercent,
                targetMarginPercent: r.TargetMarginPercent,
                minMarkupPercent: r.MinMarkupPercent,
                targetMarkupPercent: r.TargetMarkupPercent,
                currencyCode: r.CurrencyCode,
                effectiveFrom: r.EffectiveFrom,
                effectiveTo: r.EffectiveTo,
                isActive: Boolean(r.IsActive),
                createdBy: r.CreatedBy,
                createdByName: r.CreatedByName,
                createdAt: r.CreatedAt,
                
                ...validation,
            };
        });

        res.json({
            data: mappedData,
        });
    }),
);

router.get(
    "/",
    readRoles,
    asyncHandler(async (req, res) => {
        const page = Math.max(Number(req.query.page || 1), 1);
        const pageSize = Math.min(
            Math.max(Number(req.query.pageSize || 20), 1),
            100,
        );

        const offset = (page - 1) * pageSize;

        const inputs = {
            offset: { type: sql.Int, value: offset },
            pageSize: { type: sql.Int, value: pageSize },
        };

        const parentConditions = [];
        const childConditions = [];

        // -----------------------------------
        // Parent filters
        // -----------------------------------

        if (req.query.productTypeId) {
            parentConditions.push("i.ProductTypeId = @productTypeId");

            inputs.productTypeId = {
                type: sql.Int,
                value: parseId(req.query.productTypeId),
            };
        }

        if (req.query.thicknessId) {
            parentConditions.push("i.ThicknessId = @thicknessId");

            inputs.thicknessId = {
                type: sql.Int,
                value: parseId(req.query.thicknessId),
            };
        }

        if (req.query.widthId) {
            parentConditions.push("i.WidthId = @widthId");

            inputs.widthId = {
                type: sql.Int,
                value: parseId(req.query.widthId),
            };
        }

        if (req.query.lengthId) {
            parentConditions.push("i.LengthId = @lengthId");

            inputs.lengthId = {
                type: sql.Int,
                value: parseId(req.query.lengthId),
            };
        }

        // -----------------------------------
        // Search
        // -----------------------------------

        if (req.query.search) {
            const terms = String(req.query.search)
                .trim()
                .split(/\s+/)
                .filter(Boolean);

            // -----------------------------
            // Parent search
            // -----------------------------

            const parentSearchConditions = [];

            terms.forEach((term, idx) => {
                const paramName = `search${idx}`;

                inputs[paramName] = {
                    type: sql.NVarChar(255),
                    value: `%${term}%`,
                };

                parentSearchConditions.push(`(
                  i.ItemCode LIKE @${paramName}
                  OR i.ItemName LIKE @${paramName}

                  OR EXISTS (
                    SELECT 1
                    FROM dbo.ItemSpecs s
                    LEFT JOIN dbo.Surfaces surf
                      ON surf.SurfaceId = s.SurfaceId
                    LEFT JOIN dbo.Grades g
                      ON g.GradeId = s.GradeId
                    WHERE s.ItemId = i.ItemId
                    AND (
                      s.SalesSKU LIKE @${paramName}
                      OR s.SpecCode LIKE @${paramName}
                      OR s.SpecName LIKE @${paramName}
                      OR surf.SurfaceName LIKE @${paramName}
                      OR g.GradeName LIKE @${paramName}
                    )
                  )
                )`);
            });

            parentConditions.push(`(${parentSearchConditions.join(" AND ")})`);

            // -----------------------------
            // Child search
            // -----------------------------

            const childSearchConditions = [];

            terms.forEach((term, idx) => {
                const paramName = `search${idx}`;

                childSearchConditions.push(`(
                ispec.SalesSKU LIKE @${paramName}
                OR ispec.SpecCode LIKE @${paramName}
                OR ispec.SpecName LIKE @${paramName}
                OR surf.SurfaceName LIKE @${paramName}
                OR g.GradeName LIKE @${paramName}
              )`);
            });

            childConditions.push(`(${childSearchConditions.join(" AND ")})`);
        }

        // -----------------------------------
        // Child filters
        // -----------------------------------

        if (req.query.surfaceId) {
            childConditions.push("ispec.SurfaceId = @surfaceId");

            inputs.surfaceId = {
                type: sql.Int,
                value: parseId(req.query.surfaceId),
            };
        }

        if (req.query.gradeId) {
            childConditions.push("ispec.GradeId = @gradeId");

            inputs.gradeId = {
                type: sql.Int,
                value: parseId(req.query.gradeId),
            };
        }

        const parentWhereSql = parentConditions.length
            ? `WHERE i.ItemId > 0 AND ${parentConditions.join(" AND ")}`
            : "WHERE i.ItemId > 0";

        const childWhereSql = childConditions.length
            ? `WHERE ${childConditions.join(" AND ")}`
            : "";

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      WITH ParentRows AS (
        SELECT
          i.ItemId,
          CAST(NULL AS INT) AS ItemSpecId,
          i.ItemCode,
          i.ItemCode AS DisplayCode,
          i.ItemName AS DisplayName,

          i.ItemTypeId,
          it.ItemTypeCode,
          it.ItemTypeName,

          i.ProductTypeId,
          pt.ProductTypeCode,
          pt.ProductTypeName,

          i.ThicknessId,
          th.ThicknessMm,

          i.WidthId,
          w.WidthM,

          i.LengthId,
          l.LengthM,

          i.AreaSqm,

          i.UnitId,
          u.UnitCode,
          u.UnitName,

          i.TaxCodeId,
          tc.TaxCode,
          tc.TaxName,

          i.DefaultWarehouseId,
          wh.WarehouseCode,
          wh.WarehouseName,

          i.ValuationMethod,
          i.AllowNegativeStock,
          i.Status,
          i.IsLotControlled,
          i.IsActive,

          CAST(NULL AS NVARCHAR(100)) AS SalesSKU,
          CAST(NULL AS NVARCHAR(50)) AS SpecCode,
          CAST(NULL AS NVARCHAR(255)) AS SpecName,

          CAST(NULL AS INT) AS SurfaceId,
          CAST(NULL AS NVARCHAR(100)) AS SurfaceName,

          CAST(NULL AS INT) AS GradeId,
          CAST(NULL AS NVARCHAR(100)) AS GradeName,

          N'parent' AS RowType

        FROM dbo.Items i
        JOIN dbo.ItemTypes it
          ON it.ItemTypeId = i.ItemTypeId
        JOIN dbo.Units u
          ON u.UnitId = i.UnitId

        LEFT JOIN dbo.ProductTypes pt
          ON pt.ProductTypeId = i.ProductTypeId

        LEFT JOIN dbo.ItemThicknesses th
          ON th.ThicknessId = i.ThicknessId

        LEFT JOIN dbo.ItemWidths w
          ON w.WidthId = i.WidthId

        LEFT JOIN dbo.ItemLengths l
          ON l.LengthId = i.LengthId

        LEFT JOIN dbo.TaxCodes tc
          ON tc.TaxCodeId = i.TaxCodeId

        LEFT JOIN dbo.Warehouses wh
          ON wh.WarehouseId = i.DefaultWarehouseId

        ${parentWhereSql}
      ),

      ChildRows AS (
        SELECT
          i.ItemId,
          ispec.ItemSpecId,

          i.ItemCode,

          COALESCE(
            NULLIF(ispec.SalesSKU, ''),
            i.ItemCode
          ) AS DisplayCode,

          CASE
            WHEN ISNULL(ispec.SpecName, '') <> ''
            THEN i.ItemName + ' - ' + ispec.SpecName
            ELSE i.ItemName
          END AS DisplayName,

          i.ItemTypeId,
          it.ItemTypeCode,
          it.ItemTypeName,

          i.ProductTypeId,
          pt.ProductTypeCode,
          pt.ProductTypeName,

          i.ThicknessId,
          th.ThicknessMm,

          i.WidthId,
          w.WidthM,

          i.LengthId,
          l.LengthM,

          i.AreaSqm,

          i.UnitId,
          u.UnitCode,
          u.UnitName,

          i.TaxCodeId,
          tc.TaxCode,
          tc.TaxName,

          i.DefaultWarehouseId,
          wh.WarehouseCode,
          wh.WarehouseName,

          i.ValuationMethod,
          i.AllowNegativeStock,
          i.Status,
          i.IsLotControlled,
          i.IsActive,

          ispec.SalesSKU,
          ispec.SpecCode,
          ispec.SpecName,

          ispec.SurfaceId,
          surf.SurfaceName,

          ispec.GradeId,
          g.GradeName,

          N'child' AS RowType

        FROM dbo.ItemSpecs ispec

        JOIN dbo.Items i
          ON i.ItemId = ispec.ItemId

        JOIN dbo.ItemTypes it
          ON it.ItemTypeId = i.ItemTypeId

        JOIN dbo.Units u
          ON u.UnitId = i.UnitId

        LEFT JOIN dbo.ProductTypes pt
          ON pt.ProductTypeId = i.ProductTypeId

        LEFT JOIN dbo.ItemThicknesses th
          ON th.ThicknessId = i.ThicknessId

        LEFT JOIN dbo.ItemWidths w
          ON w.WidthId = i.WidthId

        LEFT JOIN dbo.ItemLengths l
          ON l.LengthId = i.LengthId

        LEFT JOIN dbo.TaxCodes tc
          ON tc.TaxCodeId = i.TaxCodeId

        LEFT JOIN dbo.Warehouses wh
          ON wh.WarehouseId = i.DefaultWarehouseId

        LEFT JOIN dbo.Surfaces surf
          ON surf.SurfaceId = ispec.SurfaceId

        LEFT JOIN dbo.Grades g
          ON g.GradeId = ispec.GradeId

        ${[...parentConditions, ...childConditions].length
                ? `WHERE ${[...parentConditions, ...childConditions].join(
                    " AND ",
                )}`
                : ""
            }
      ),

      CombinedRows AS (
        SELECT * FROM ParentRows
        UNION ALL
        SELECT * FROM ChildRows
      ),

      Counted AS (
        SELECT COUNT(1) AS TotalCount
        FROM CombinedRows
      )

      SELECT
        r.*,
        c.TotalCount
      FROM CombinedRows r
      CROSS JOIN Counted c

      ORDER BY
        r.ItemCode,
        CASE WHEN r.ItemSpecId IS NULL THEN 0 ELSE 1 END,
        r.SpecCode

      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `,
            { inputs },
        );

        res.json({
            data: rows.map(mapItemListRow),
            pagination: {
                page,
                pageSize,
                total: rows[0]?.TotalCount || 0,
            },
        });
    }),
);

router.get(
    "/skus",
    readRoles,
    asyncHandler(async (req, res) => {
        const page = Math.max(Number(req.query.page || 1), 1);
        const pageSize = Math.min(
            Math.max(Number(req.query.pageSize || 20), 1),
            100,
        );
        const offset = (page - 1) * pageSize;

        const conditions = ["i.IsActive = 1 AND i.ItemId > 0"];
        const inputs = {};

        if (req.query.search) {
            const terms = String(req.query.search)
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            if (terms.length > 0) {
                const searchConditions = [];
                terms.forEach((term, idx) => {
                    const paramName = `search${idx}`;
                    searchConditions.push(`(
            i.ItemCode LIKE @${paramName} OR 
            i.ItemName LIKE @${paramName} OR 
            ispec.SalesSKU LIKE @${paramName} OR 
            ispec.SpecCode LIKE @${paramName} OR 
            ispec.SpecName LIKE @${paramName} OR 
            surf.SurfaceName LIKE @${paramName} OR 
            g.GradeName LIKE @${paramName}
          )`);
                    inputs[paramName] = {
                        type: sql.NVarChar(255),
                        value: `%${term}%`,
                    };
                });
                conditions.push(`(${searchConditions.join(" AND ")})`);
            }
        }

        const whereSql = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      WITH FlattenedSkus AS (
        SELECT 
          i.ItemId,
          i.ItemCode,
          i.ItemName,
          ispec.ItemSpecId,
          ispec.SalesSKU,
          ispec.SpecCode,
          ispec.SpecName,
          ispec.SurfaceId,
          surf.SurfaceName,
          ispec.GradeId,
          g.GradeName,
          i.UnitId,
          u.UnitCode,
          u.UnitName,
          i.TaxCodeId,
          tc.TaxCode,
          tc.TaxRatePercent,
          pt.ProductTypeCode,
          th.ThicknessMm,
          th.ThicknessLabel,
          w.WidthM,
          w.WidthLabel,
          l.LengthM,
          l.LengthLabel
        FROM dbo.Items i
        LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemId = i.ItemId AND ispec.IsActive = 1
        LEFT JOIN dbo.Surfaces surf ON surf.SurfaceId = ispec.SurfaceId
        LEFT JOIN dbo.Grades g ON g.GradeId = ispec.GradeId
        JOIN dbo.Units u ON u.UnitId = i.UnitId
        LEFT JOIN dbo.TaxCodes tc ON tc.TaxCodeId = i.TaxCodeId
        LEFT JOIN dbo.ProductTypes pt ON pt.ProductTypeId = i.ProductTypeId
        LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
        LEFT JOIN dbo.ItemWidths w ON w.WidthId = i.WidthId
        LEFT JOIN dbo.ItemLengths l ON l.LengthId = i.LengthId
        ${whereSql}
      ), Counted AS (
        SELECT COUNT(1) AS TotalCount FROM FlattenedSkus
      )
      SELECT 
        fs.*,
        c.TotalCount
      FROM FlattenedSkus fs
      CROSS JOIN Counted c
      ORDER BY fs.ItemCode, fs.SpecCode
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `,
            {
                inputs: {
                    ...inputs,
                    offset: { type: sql.Int, value: offset },
                    pageSize: { type: sql.Int, value: pageSize },
                },
            },
        );

        res.json({
            data: rows.map((r) => ({
                itemId: r.ItemId,
                itemCode: r.ItemCode,
                itemSpecId: r.ItemSpecId,
                salesSku: r.SalesSKU,
                specCode: r.SpecCode,
                surfaceId: r.SurfaceId,
                surfaceName: r.SurfaceName,
                gradeId: r.GradeId,
                gradeName: r.GradeName,
                displayName: r.SpecName
                    ? `${r.ItemName} - ${r.SpecName}`
                    : r.ItemName,
                unitId: r.UnitId,
                unitCode: r.UnitCode,
                unitName: r.UnitName,
                taxCodeId: r.TaxCodeId,
                taxCode: r.TaxCode,
                taxRatePercent: r.TaxRatePercent || 0,
                productTypeCode: r.ProductTypeCode || 'FG',
                thicknessLabel: r.ThicknessLabel || (r.ThicknessMm ? `${r.ThicknessMm} mm` : '-'),
                widthLabel: r.WidthLabel || (r.WidthM ? `${r.WidthM} m` : '-'),
                lengthLabel: r.LengthLabel || (r.LengthM ? `${r.LengthM} m` : '-'),
            })),
            pagination: {
                page,
                pageSize,
                total: rows[0]?.TotalCount || 0,
            },
        });
    }),
);

router.get(
    "/:id",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const item = await getItem(itemId);

        if (!item) {
            res.status(404).json({ message: "Item not found" });
            return;
        }

        res.json({ data: item });
    }),
);

router.post(
    "/",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemCode = String(
            req.body.itemCode || req.body.code || "",
        ).trim();
        const itemName = String(
            req.body.itemName || req.body.name || "",
        ).trim();
        const itemTypeId = parseId(req.body.itemTypeId, "itemTypeId");
        const unitId = parseId(req.body.unitId, "unitId");

        if (!itemCode) throw badRequest("itemCode is required");
        if (!itemName) throw badRequest("itemName is required");

        const productTypeId = parseOptionalId(
            req.body.productTypeId,
            "productTypeId",
        );
        const thicknessId = parseOptionalId(
            req.body.thicknessId,
            "thicknessId",
        );
        const widthId = parseOptionalId(req.body.widthId, "widthId");
        const lengthId = parseOptionalId(req.body.lengthId, "lengthId");
        const areaSqm = parseOptionalNumber(req.body.areaSqm, "areaSqm");
        const taxCodeId = parseOptionalId(req.body.taxCodeId, "taxCodeId");
        const defaultWarehouseId = parseOptionalId(
            req.body.defaultWarehouseId,
            "defaultWarehouseId",
        );

        const valuationMethod = normalizeEnum(
            req.body.valuationMethod,
            ["fifo", "average", "standard"],
            "valuationMethod",
        );
        const status = normalizeEnum(
            req.body.status,
            ["draft", "active", "obsolete"],
            "status",
        );

        const allowNegativeStock =
            req.body.allowNegativeStock === undefined
                ? null
                : parseBool(req.body.allowNegativeStock);
        const isLotControlled =
            req.body.isLotControlled === undefined
                ? null
                : parseBool(req.body.isLotControlled);
        const isActive =
            req.body.isActive === undefined
                ? null
                : parseBool(req.body.isActive);

        let insertedId;
        try {
            const rows = await mssqlQuery(
                "DEFAULT",
                `
        INSERT INTO dbo.Items (
          ItemCode,
          ItemName,
          ItemTypeId,
          ProductTypeId,
          ThicknessId,
          WidthId,
          LengthId,
          AreaSqm,
          UnitId,
          TaxCodeId,
          DefaultWarehouseId,
          ValuationMethod,
          AllowNegativeStock,
          Status,
          IsLotControlled,
          IsActive
        )
        OUTPUT INSERTED.ItemId
        VALUES (
          @itemCode,
          @itemName,
          @itemTypeId,
          @productTypeId,
          @thicknessId,
          @widthId,
          @lengthId,
          @areaSqm,
          @unitId,
          @taxCodeId,
          @defaultWarehouseId,
          ISNULL(@valuationMethod, N'average'),
          ISNULL(@allowNegativeStock, 0),
          ISNULL(@status, N'draft'),
          ISNULL(@isLotControlled, 0),
          ISNULL(@isActive, 1)
        )
      `,
                {
                    inputs: {
                        itemCode: { type: sql.NVarChar(80), value: itemCode },
                        itemName: { type: sql.NVarChar(255), value: itemName },
                        itemTypeId: { type: sql.Int, value: itemTypeId },
                        productTypeId: { type: sql.Int, value: productTypeId },
                        thicknessId: { type: sql.Int, value: thicknessId },
                        widthId: { type: sql.Int, value: widthId },
                        lengthId: { type: sql.Int, value: lengthId },
                        areaSqm: { type: sql.Decimal(18, 6), value: areaSqm },
                        unitId: { type: sql.Int, value: unitId },
                        taxCodeId: { type: sql.Int, value: taxCodeId },
                        defaultWarehouseId: {
                            type: sql.Int,
                            value: defaultWarehouseId,
                        },
                        valuationMethod: {
                            type: sql.NVarChar(20),
                            value: valuationMethod,
                        },
                        allowNegativeStock: {
                            type: sql.Bit,
                            value: allowNegativeStock,
                        },
                        status: { type: sql.NVarChar(30), value: status },
                        isLotControlled: {
                            type: sql.Bit,
                            value: isLotControlled,
                        },
                        isActive: { type: sql.Bit, value: isActive },
                    },
                },
            );
            insertedId = rows[0]?.ItemId;
        } catch (e) {
            if (e && (e.number === 2627 || e.number === 2601)) {
                e.status = 409;
                e.message = "Duplicate key (ItemCode/SalesSKU/etc.)";
            }
            throw e;
        }

        const item = insertedId ? await getItem(insertedId) : null;
        res.status(201).json({ data: item || { id: insertedId } });
    }),
);

router.put(
    "/:id",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const existing = await getItem(itemId);
        if (!existing) {
            res.status(404).json({ message: "Item not found" });
            return;
        }

        const has = (key) =>
            Object.prototype.hasOwnProperty.call(req.body || {}, key);

        const itemCode = req.body.itemCode ?? req.body.code;
        const itemName = req.body.itemName ?? req.body.name;

        const valuationMethod = normalizeEnum(
            req.body.valuationMethod,
            ["fifo", "average", "standard"],
            "valuationMethod",
        );
        const status = normalizeEnum(
            req.body.status,
            ["draft", "active", "obsolete"],
            "status",
        );

        const allowNegativeStock =
            req.body.allowNegativeStock === undefined
                ? null
                : parseBool(req.body.allowNegativeStock);
        const isLotControlled =
            req.body.isLotControlled === undefined
                ? null
                : parseBool(req.body.isLotControlled);
        const isActive =
            req.body.isActive === undefined
                ? null
                : parseBool(req.body.isActive);

        const setProductTypeId = has("productTypeId");
        const setThicknessId = has("thicknessId");
        const setWidthId = has("widthId");
        const setLengthId = has("lengthId");
        const setAreaSqm = has("areaSqm");
        const setTaxCodeId = has("taxCodeId");
        const setDefaultWarehouseId = has("defaultWarehouseId");

        const productTypeId = setProductTypeId
            ? parseOptionalId(req.body.productTypeId, "productTypeId")
            : null;
        const thicknessId = setThicknessId
            ? parseOptionalId(req.body.thicknessId, "thicknessId")
            : null;
        const widthId = setWidthId
            ? parseOptionalId(req.body.widthId, "widthId")
            : null;
        const lengthId = setLengthId
            ? parseOptionalId(req.body.lengthId, "lengthId")
            : null;
        const areaSqm = setAreaSqm
            ? parseOptionalNumber(req.body.areaSqm, "areaSqm")
            : null;
        const taxCodeId = setTaxCodeId
            ? parseOptionalId(req.body.taxCodeId, "taxCodeId")
            : null;
        const defaultWarehouseId = setDefaultWarehouseId
            ? parseOptionalId(req.body.defaultWarehouseId, "defaultWarehouseId")
            : null;

        await mssqlQuery(
            "DEFAULT",
            `
      UPDATE dbo.Items
      SET
        ItemCode = COALESCE(@itemCode, ItemCode),
        ItemName = COALESCE(@itemName, ItemName),
        ItemTypeId = COALESCE(@itemTypeId, ItemTypeId),
        ProductTypeId = CASE WHEN @setProductTypeId = 1 THEN @productTypeId ELSE ProductTypeId END,
        ThicknessId = CASE WHEN @setThicknessId = 1 THEN @thicknessId ELSE ThicknessId END,
        WidthId = CASE WHEN @setWidthId = 1 THEN @widthId ELSE WidthId END,
        LengthId = CASE WHEN @setLengthId = 1 THEN @lengthId ELSE LengthId END,
        AreaSqm = CASE WHEN @setAreaSqm = 1 THEN @areaSqm ELSE AreaSqm END,
        UnitId = COALESCE(@unitId, UnitId),
        TaxCodeId = CASE WHEN @setTaxCodeId = 1 THEN @taxCodeId ELSE TaxCodeId END,
        DefaultWarehouseId = CASE WHEN @setDefaultWarehouseId = 1 THEN @defaultWarehouseId ELSE DefaultWarehouseId END,
        ValuationMethod = COALESCE(@valuationMethod, ValuationMethod),
        AllowNegativeStock = COALESCE(@allowNegativeStock, AllowNegativeStock),
        Status = COALESCE(@status, Status),
        IsLotControlled = COALESCE(@isLotControlled, IsLotControlled),
        IsActive = COALESCE(@isActive, IsActive)
      WHERE ItemId = @itemId
    `,
            {
                inputs: {
                    itemId: { type: sql.Int, value: itemId },
                    itemCode:
                        itemCode === undefined
                            ? { type: sql.NVarChar(80), value: null }
                            : {
                                type: sql.NVarChar(80),
                                value: String(itemCode).trim(),
                            },
                    itemName:
                        itemName === undefined
                            ? { type: sql.NVarChar(255), value: null }
                            : {
                                type: sql.NVarChar(255),
                                value: String(itemName).trim(),
                            },
                    itemTypeId:
                        req.body.itemTypeId === undefined
                            ? { type: sql.Int, value: null }
                            : {
                                type: sql.Int,
                                value: parseId(
                                    req.body.itemTypeId,
                                    "itemTypeId",
                                ),
                            },
                    setProductTypeId: {
                        type: sql.Bit,
                        value: setProductTypeId,
                    },
                    setThicknessId: { type: sql.Bit, value: setThicknessId },
                    setWidthId: { type: sql.Bit, value: setWidthId },
                    setLengthId: { type: sql.Bit, value: setLengthId },
                    setAreaSqm: { type: sql.Bit, value: setAreaSqm },
                    setTaxCodeId: { type: sql.Bit, value: setTaxCodeId },
                    setDefaultWarehouseId: {
                        type: sql.Bit,
                        value: setDefaultWarehouseId,
                    },
                    productTypeId: { type: sql.Int, value: productTypeId },
                    thicknessId: { type: sql.Int, value: thicknessId },
                    widthId: { type: sql.Int, value: widthId },
                    lengthId: { type: sql.Int, value: lengthId },
                    areaSqm: { type: sql.Decimal(18, 6), value: areaSqm },
                    unitId:
                        req.body.unitId === undefined
                            ? { type: sql.Int, value: null }
                            : {
                                type: sql.Int,
                                value: parseId(req.body.unitId, "unitId"),
                            },
                    taxCodeId: { type: sql.Int, value: taxCodeId },
                    defaultWarehouseId: {
                        type: sql.Int,
                        value: defaultWarehouseId,
                    },
                    valuationMethod: {
                        type: sql.NVarChar(20),
                        value: valuationMethod,
                    },
                    allowNegativeStock: {
                        type: sql.Bit,
                        value: allowNegativeStock,
                    },
                    status: { type: sql.NVarChar(30), value: status },
                    isLotControlled: { type: sql.Bit, value: isLotControlled },
                    isActive: { type: sql.Bit, value: isActive },
                },
            },
        );

        const item = await getItem(itemId);
        res.json({ data: item || existing });
    }),
);

router.get(
    "/:id/specs",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT
        s.ItemSpecId,
        s.ItemId,
        s.SalesSKU,
        s.SpecCode,
        s.SpecName,
        s.SurfaceId,
        surf.SurfaceName,
        s.GradeId,
        g.GradeName,
        s.IsActive
      FROM dbo.ItemSpecs s
      LEFT JOIN dbo.Surfaces surf ON s.SurfaceId = surf.SurfaceId
      LEFT JOIN dbo.Grades g ON s.GradeId = g.GradeId
      WHERE s.ItemId = @itemId
      ORDER BY s.SpecCode
    `,
            { inputs: { itemId: { type: sql.Int, value: itemId } } },
        );

        res.json({
            data: rows.map((r) => ({
                itemSpecId: r.ItemSpecId,
                itemId: r.ItemId,
                salesSku: r.SalesSKU,
                specCode: r.SpecCode,
                specName: r.SpecName,
                surfaceId: r.SurfaceId,
                surfaceName: r.SurfaceName,
                gradeId: r.GradeId,
                gradeName: r.GradeName,
                isActive: Boolean(r.IsActive),
            })),
        });
    }),
);

router.post(
    "/:id/specs",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const salesSku = String(
            req.body.salesSku || req.body.salesSKU || "",
        ).trim();
        const specCode = String(req.body.specCode || "").trim();
        const specName = String(req.body.specName || "").trim();
        const surfaceNameInput = String(req.body.surfaceName || "").trim();
        const gradeId = req.body.gradeId
            ? parseInt(req.body.gradeId, 10)
            : null;
        const isActive =
            req.body.isActive === undefined ? true : Boolean(req.body.isActive);

        if (!salesSku) throw badRequest("salesSku is required");
        if (!specCode) throw badRequest("specCode is required");
        if (!specName) throw badRequest("specName is required");

        let finalSurfaceId = null;
        if (surfaceNameInput) {
            const surfRes = await mssqlQuery(
                "DEFAULT",
                `SELECT SurfaceId FROM dbo.Surfaces WHERE SurfaceName = @name`,
                {
                    inputs: {
                        name: { type: sql.NVarChar, value: surfaceNameInput },
                    },
                },
            );
            if (surfRes.length > 0) {
                finalSurfaceId = surfRes[0].SurfaceId;
            } else {
                const maxRes = await mssqlQuery(
                    "DEFAULT",
                    `SELECT ISNULL(MAX(SurfaceId), 0) AS maxId FROM dbo.Surfaces`,
                );
                const nextId = maxRes[0].maxId + 1;
                const newCode = "S" + nextId;
                const insertSurf = await mssqlQuery(
                    "DEFAULT",
                    `
          INSERT INTO dbo.Surfaces (SurfaceCode, SurfaceName) 
          OUTPUT INSERTED.SurfaceId 
          VALUES (@code, @name)
        `,
                    {
                        inputs: {
                            code: { type: sql.NVarChar, value: newCode },
                            name: {
                                type: sql.NVarChar,
                                value: surfaceNameInput,
                            },
                        },
                    },
                );
                finalSurfaceId = insertSurf[0].SurfaceId;
                await refreshLookupsCache();
            }
        }

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      INSERT INTO dbo.ItemSpecs (
        ItemId,
        SalesSKU,
        SpecCode,
        SpecName,
        SurfaceId,
        GradeId,
        IsActive
      )
      OUTPUT INSERTED.ItemSpecId
      VALUES (
        @itemId,
        @salesSku,
        @specCode,
        @specName,
        @surfaceId,
        @gradeId,
        @isActive
      )
    `,
            {
                inputs: {
                    itemId: { type: sql.Int, value: itemId },
                    salesSku: { type: sql.NVarChar(100), value: salesSku },
                    specCode: { type: sql.NVarChar(50), value: specCode },
                    specName: { type: sql.NVarChar(255), value: specName },
                    surfaceId: { type: sql.Int, value: finalSurfaceId },
                    gradeId: { type: sql.Int, value: gradeId },
                    isActive: { type: sql.Bit, value: isActive },
                },
            },
        );

        res.status(201).json({ data: { id: rows[0]?.ItemSpecId } });
    }),
);

router.get(
    "/:id/conversions",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT
        iuc.ItemUnitConversionId,
        iuc.ItemId,
        iuc.FromUnitId,
        fu.UnitCode AS FromUnitCode,
        fu.UnitName AS FromUnitName,
        iuc.ToUnitId,
        tu.UnitCode AS ToUnitCode,
        tu.UnitName AS ToUnitName,
        iuc.ConversionFactor,
        iuc.EffectiveFrom,
        iuc.EffectiveTo,
        iuc.IsActive
      FROM dbo.ItemUnitConversions iuc
      JOIN dbo.Units fu ON fu.UnitId = iuc.FromUnitId
      JOIN dbo.Units tu ON tu.UnitId = iuc.ToUnitId
      WHERE iuc.ItemId = @itemId
      ORDER BY iuc.EffectiveFrom DESC, fu.UnitCode, tu.UnitCode
    `,
            { inputs: { itemId: { type: sql.Int, value: itemId } } },
        );

        res.json({
            data: rows.map((r) => ({
                id: r.ItemUnitConversionId,
                itemId: r.ItemId,
                fromUnitId: r.FromUnitId,
                fromUnitCode: r.FromUnitCode,
                fromUnitName: r.FromUnitName,
                toUnitId: r.ToUnitId,
                toUnitCode: r.ToUnitCode,
                toUnitName: r.ToUnitName,
                conversionFactor: r.ConversionFactor,
                effectiveFrom: r.EffectiveFrom,
                effectiveTo: r.EffectiveTo,
                isActive: Boolean(r.IsActive),
            })),
        });
    }),
);

router.post(
    "/:id/conversions",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const fromUnitId = parseId(req.body.fromUnitId, "fromUnitId");
        const toUnitId = parseId(req.body.toUnitId, "toUnitId");
        const conversionFactor = parseOptionalNumber(
            req.body.conversionFactor,
            "conversionFactor",
        );
        if (conversionFactor === null)
            throw badRequest("conversionFactor is required");
        if (conversionFactor <= 0)
            throw badRequest("conversionFactor must be > 0");

        const effectiveFrom = parseOptionalDate(
            req.body.effectiveFrom,
            "effectiveFrom",
        );
        const effectiveTo = parseOptionalDate(
            req.body.effectiveTo,
            "effectiveTo",
        );
        const isActive =
            req.body.isActive === undefined
                ? null
                : parseBool(req.body.isActive);

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      INSERT INTO dbo.ItemUnitConversions (
        ItemId,
        FromUnitId,
        ToUnitId,
        ConversionFactor,
        EffectiveFrom,
        EffectiveTo,
        IsActive
      )
      OUTPUT INSERTED.ItemUnitConversionId
      VALUES (
        @itemId,
        @fromUnitId,
        @toUnitId,
        @conversionFactor,
        ISNULL(@effectiveFrom, CAST(SYSUTCDATETIME() AS DATE)),
        @effectiveTo,
        ISNULL(@isActive, 1)
      )
    `,
            {
                inputs: {
                    itemId: { type: sql.Int, value: itemId },
                    fromUnitId: { type: sql.Int, value: fromUnitId },
                    toUnitId: { type: sql.Int, value: toUnitId },
                    conversionFactor: {
                        type: sql.Decimal(18, 8),
                        value: conversionFactor,
                    },
                    effectiveFrom: { type: sql.Date, value: effectiveFrom },
                    effectiveTo: { type: sql.Date, value: effectiveTo },
                    isActive: { type: sql.Bit, value: isActive },
                },
            },
        );

        res.status(201).json({ data: { id: rows[0]?.ItemUnitConversionId } });
    }),
);

router.get(
    "/:id/pricing-policies",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT
        ipp.ItemPricingPolicyId,
        ipp.ItemId,
        ipp.UnitId,
        unit.UnitCode,
        unit.UnitName,
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
        ipp.IsActive,
        ipp.CreatedAt
      FROM dbo.ItemPricingPolicies ipp
      JOIN dbo.PricingMethods pm ON pm.PricingMethodId = ipp.PricingMethodId
      LEFT JOIN dbo.Units unit ON unit.UnitId = ipp.UnitId
      WHERE ipp.ItemId = @itemId
      ORDER BY ipp.EffectiveFrom DESC, ipp.CreatedAt DESC
    `,
            { inputs: { itemId: { type: sql.Int, value: itemId } } },
        );

        res.json({
            data: rows.map((r) => ({
                id: r.ItemPricingPolicyId,
                itemId: r.ItemId,
                unitId: r.UnitId,
                unitCode: r.UnitCode,
                unitName: r.UnitName,
                pricingMethodId: r.PricingMethodId,
                pricingMethodCode: r.PricingMethodCode,
                pricingMethodName: r.PricingMethodName,
                status: r.Status,
                approvedBy: r.ApprovedBy,
                approvedAt: r.ApprovedAt,
                versionNo: r.VersionNo,
                priority: r.Priority,
                remark: r.Remark,
                itemSpecId: r.ItemSpecId,
                standardPrice: r.StandardPrice,
                standardCost: r.StandardCost,
                minMarginPercent: r.MinMarginPercent,
                targetMarginPercent: r.TargetMarginPercent,
                minMarkupPercent: r.MinMarkupPercent,
                targetMarkupPercent: r.TargetMarkupPercent,
                currencyCode: r.CurrencyCode,
                effectiveFrom: r.EffectiveFrom,
                effectiveTo: r.EffectiveTo,
                isActive: Boolean(r.IsActive),
                createdAt: r.CreatedAt,
            })),
        });
    }),
);

router.get(
    "/:id/pricing-policies/:policyId",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const policyId = parseId(req.params.policyId, "policyId");
        const policy = await pricingPolicyService.getPolicy(policyId);

        if (!policy || policy.ItemId !== itemId) {
            return res.status(404).json({ message: 'Pricing policy not found' });
        }

        res.json({
            data: {
                id: policy.ItemPricingPolicyId,
                itemId: policy.ItemId,
                unitId: policy.UnitId,
                unitCode: policy.UnitCode,
                unitName: policy.UnitName,
                itemSpecId: policy.ItemSpecId,
                pricingMethodId: policy.PricingMethodId,
                pricingMethodCode: policy.PricingMethodCode,
                pricingMethodName: policy.PricingMethodName,
                status: policy.Status,
                approvedBy: policy.ApprovedBy,
                approvedAt: policy.ApprovedAt,
                versionNo: policy.VersionNo,
                priority: policy.Priority,
                remark: policy.Remark,
                standardPrice: policy.StandardPrice,
                standardCost: policy.StandardCost,
                minMarginPercent: policy.MinMarginPercent,
                targetMarginPercent: policy.TargetMarginPercent,
                minMarkupPercent: policy.MinMarkupPercent,
                targetMarkupPercent: policy.TargetMarkupPercent,
                currencyCode: policy.CurrencyCode,
                effectiveFrom: policy.EffectiveFrom,
                effectiveTo: policy.EffectiveTo,
                isActive: Boolean(policy.IsActive),
            },
        });
    }),
);

router.get(
    "/:id/pricing-policies/:policyId/approval-request",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const policyId = parseId(req.params.policyId, "policyId");
        const policy = await pricingPolicyService.getPolicy(policyId);

        if (!policy || policy.ItemId !== itemId) {
            return res.status(404).json({ message: 'Pricing policy not found' });
        }

        let request = await approvalService.getRequestByDocument('ITEM_PRICING_POLICY', policyId);
        if (!request && policy.VersionNo && policy.VersionNo !== 'V1') {
            const versionRes = await mssqlQuery('DEFAULT', `
                SELECT ItemPricingPolicyVersionId FROM dbo.ItemPricingPolicyVersions WHERE VersionNo = @versionNo
            `, { inputs: { versionNo: { type: sql.NVarChar(30), value: policy.VersionNo } } });
            if (versionRes.length > 0) {
                const versionId = versionRes[0].ItemPricingPolicyVersionId;
                request = await approvalService.getRequestByDocument('ITEM_PRICING_POLICY_BULK', versionId);
            }
        }

        if (!request) {
            return res.status(404).json({ message: 'Approval request not found' });
        }
        res.json({ data: request });
    }),
);

router.post(
    "/:id/pricing-policies",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const userId = getUserId(req);
        const itemSpecId = parseOptionalId(req.body.itemSpecId, "itemSpecId");
        const pricingMethodId = parseId(
            req.body.pricingMethodId,
            "pricingMethodId",
        );
        const versionNo = generatePricingPolicyVersionNo();
        const priority = parseOptionalNumber(req.body.priority, "priority");
        const remark = req.body.remark ? String(req.body.remark) : null;
        const standardPrice =
            parseOptionalNumber(req.body.standardPrice, "standardPrice") ?? 0;
        const standardCost =
            parseOptionalNumber(req.body.standardCost, "standardCost") ?? 0;

        let unitId = parseOptionalId(req.body.unitId, "unitId");
        if (!unitId) {
            const itemRes = await mssqlQuery(
                "DEFAULT",
                "SELECT UnitId FROM dbo.Items WHERE ItemId = @itemId",
                { inputs: { itemId: { type: sql.Int, value: itemId } } }
            );
            if (itemRes.length > 0) {
                unitId = itemRes[0].UnitId;
            }
        }
        if (!unitId) {
            throw badRequest("unitId is required or could not be determined from the item.");
        }

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      INSERT INTO dbo.ItemPricingPolicies (
        ItemId,
        UnitId,
        ItemSpecId,
        PricingMethodId,
        Status,
        VersionNo,
        Priority,
        Remark,
        StandardPrice,
        StandardCost,
        MinMarginPercent,
        TargetMarginPercent,
        MinMarkupPercent,
        TargetMarkupPercent,
        CurrencyCode,
        EffectiveFrom,
        EffectiveTo,
        IsActive,
        CreatedBy
      )
      OUTPUT INSERTED.ItemPricingPolicyId
      VALUES (
        @itemId,
        @unitId,
        @itemSpecId,
        @pricingMethodId,
        'draft',
        @versionNo,
        ISNULL(@priority, 0),
        @remark,
        @standardPrice,
        @standardCost,
        @minMarginPercent,
        @targetMarginPercent,
        @minMarkupPercent,
        @targetMarkupPercent,
        ISNULL(@currencyCode, 'THB'),
        ISNULL(@effectiveFrom, CAST(SYSUTCDATETIME() AS DATE)),
        @effectiveTo,
        ISNULL(@isActive, 1),
        @createdBy
      )
    `,
            {
                inputs: {
                    itemId: { type: sql.Int, value: itemId },
                    unitId: { type: sql.Int, value: unitId },
                    itemSpecId: {
                        type: sql.Int,
                        value: itemSpecId,
                    },
                    pricingMethodId: { type: sql.Int, value: pricingMethodId },
                    createdBy: { type: sql.Int, value: userId },
                    versionNo: {
                        type: sql.NVarChar(30),
                        value: versionNo,
                    },
                    priority: {
                        type: sql.Int,
                        value: priority,
                    },
                    remark: {
                        type: sql.NVarChar(4000),
                        value: remark,
                    },
                    standardPrice: {
                        type: sql.Decimal(18, 4),
                        value: standardPrice,
                    },
                    standardCost: {
                        type: sql.Decimal(18, 4),
                        value: standardCost,
                    },
                    minMarginPercent: {
                        type: sql.Decimal(9, 4),
                        value: parseOptionalNumber(
                            req.body.minMarginPercent,
                            "minMarginPercent",
                        ),
                    },
                    targetMarginPercent: {
                        type: sql.Decimal(9, 4),
                        value: parseOptionalNumber(
                            req.body.targetMarginPercent,
                            "targetMarginPercent",
                        ),
                    },
                    minMarkupPercent: {
                        type: sql.Decimal(9, 4),
                        value: parseOptionalNumber(
                            req.body.minMarkupPercent,
                            "minMarkupPercent",
                        ),
                    },
                    targetMarkupPercent: {
                        type: sql.Decimal(9, 4),
                        value: parseOptionalNumber(
                            req.body.targetMarkupPercent,
                            "targetMarkupPercent",
                        ),
                    },
                    currencyCode: {
                        type: sql.Char(3),
                        value: req.body.currencyCode
                            ? String(req.body.currencyCode)
                                .toUpperCase()
                                .slice(0, 3)
                            : null,
                    },
                    effectiveFrom: {
                        type: sql.Date,
                        value: parseOptionalDate(
                            req.body.effectiveFrom,
                            "effectiveFrom",
                        ),
                    },
                    effectiveTo: {
                        type: sql.Date,
                        value: parseOptionalDate(
                            req.body.effectiveTo,
                            "effectiveTo",
                        ),
                    },
                    isActive:
                        req.body.isActive === undefined
                            ? { type: sql.Bit, value: null }
                            : {
                                type: sql.Bit,
                                value: parseBool(req.body.isActive),
                            },
                },
            },
        );

        res.status(201).json({ data: { id: rows[0]?.ItemPricingPolicyId } });
    }),
);

router.post(
    "/:id/pricing-policies/:policyId/validate",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const policyId = parseId(req.params.policyId, "policyId");

        const result = await pricingPolicyService.validatePolicy(policyId);
        if (result.policy.ItemId !== itemId) {
            throw badRequest("Pricing policy does not belong to the requested item");
        }

        res.json({ data: { isValid: result.isValid, errors: result.errors } });
    }),
);

router.post(
    "/:id/pricing-policies/:policyId/request-approval",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const policyId = parseId(req.params.policyId, "policyId");
        const userId = getUserId(req);
        const steps = Array.isArray(req.body.steps) ? req.body.steps : [];

        const policy = await pricingPolicyService.getPolicy(policyId);
        if (!policy || policy.ItemId !== itemId) {
            throw badRequest("Pricing policy does not belong to the requested item");
        }

        const result = await pricingPolicyService.requestApproval(policyId, userId, steps);
        res.json({ data: result });
    }),
);

router.post(
    "/:id/pricing-policies/:policyId/approve",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const policyId = parseId(req.params.policyId, "policyId");
        const userId = getUserId(req);

        const policy = await pricingPolicyService.getPolicy(policyId);
        if (!policy || policy.ItemId !== itemId) {
            throw badRequest("Pricing policy does not belong to the requested item");
        }

        const result = await pricingPolicyService.approvePolicy(policyId, userId);
        res.json({ data: result });
    }),
);

router.post(
    "/:id/pricing-policies/:policyId/publish",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const policyId = parseId(req.params.policyId, "policyId");
        const userId = getUserId(req);
        const priceListId = parseId(req.body.priceListId, "priceListId");
        const unitId = parseId(req.body.unitId, "unitId");

        const policy = await pricingPolicyService.getPolicy(policyId);
        if (!policy || policy.ItemId !== itemId) {
            throw badRequest("Pricing policy does not belong to the requested item");
        }

        const result = await pricingPolicyService.publishPolicy(policyId, priceListId, unitId, userId);
        res.json({ data: result });
    }),
);

router.get(
    "/:id/costs",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT
        ItemCostId,
        ItemId,
        CostMethod,
        UnitCost,
        CurrencyCode,
        EffectiveFrom,
        EffectiveTo,
        SourceReference,
        CreatedAt
      FROM dbo.ItemCosts
      WHERE ItemId = @itemId
      ORDER BY EffectiveFrom DESC, CreatedAt DESC
    `,
            { inputs: { itemId: { type: sql.Int, value: itemId } } },
        );

        res.json({
            data: rows.map((r) => ({
                id: r.ItemCostId,
                itemId: r.ItemId,
                costMethod: r.CostMethod,
                unitCost: r.UnitCost,
                currencyCode: r.CurrencyCode,
                effectiveFrom: r.EffectiveFrom,
                effectiveTo: r.EffectiveTo,
                sourceReference: r.SourceReference,
                createdAt: r.CreatedAt,
            })),
        });
    }),
);

router.post(
    "/:id/costs",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const costMethod = normalizeEnum(
            req.body.costMethod,
            ["bom", "rm", "average", "manual"],
            "costMethod",
        );
        if (!costMethod) throw badRequest("costMethod is required");

        const unitCost = parseOptionalNumber(req.body.unitCost, "unitCost");
        if (unitCost === null) throw badRequest("unitCost is required");

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      INSERT INTO dbo.ItemCosts (
        ItemId,
        CostMethod,
        UnitCost,
        CurrencyCode,
        EffectiveFrom,
        EffectiveTo,
        SourceReference
      )
      OUTPUT INSERTED.ItemCostId
      VALUES (
        @itemId,
        @costMethod,
        @unitCost,
        ISNULL(@currencyCode, 'THB'),
        ISNULL(@effectiveFrom, CAST(SYSUTCDATETIME() AS DATE)),
        @effectiveTo,
        @sourceReference
      )
    `,
            {
                inputs: {
                    itemId: { type: sql.Int, value: itemId },
                    costMethod: { type: sql.NVarChar(30), value: costMethod },
                    unitCost: { type: sql.Decimal(18, 4), value: unitCost },
                    currencyCode: {
                        type: sql.Char(3),
                        value: req.body.currencyCode
                            ? String(req.body.currencyCode)
                                .toUpperCase()
                                .slice(0, 3)
                            : null,
                    },
                    effectiveFrom: {
                        type: sql.Date,
                        value: parseOptionalDate(
                            req.body.effectiveFrom,
                            "effectiveFrom",
                        ),
                    },
                    effectiveTo: {
                        type: sql.Date,
                        value: parseOptionalDate(
                            req.body.effectiveTo,
                            "effectiveTo",
                        ),
                    },
                    sourceReference: {
                        type: sql.NVarChar(100),
                        value: req.body.sourceReference
                            ? String(req.body.sourceReference).trim()
                            : null,
                    },
                },
            },
        );

        res.status(201).json({ data: { id: rows[0]?.ItemCostId } });
    }),
);

router.get(
    "/:id/boms",
    readRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT
        b.BomId,
        b.FinishedGoodItemId,
        b.BomCode,
        b.BomName,
        b.RevisionNo,
        b.YieldQuantity,
        b.UnitId,
        u.UnitCode,
        u.UnitName,
        b.EffectiveFrom,
        b.EffectiveTo,
        b.IsActive
      FROM dbo.Boms b
      JOIN dbo.Units u ON u.UnitId = b.UnitId
      WHERE b.FinishedGoodItemId = @itemId
      ORDER BY b.IsActive DESC, b.EffectiveFrom DESC, b.BomCode
    `,
            { inputs: { itemId: { type: sql.Int, value: itemId } } },
        );

        res.json({
            data: rows.map((r) => ({
                id: r.BomId,
                finishedGoodItemId: r.FinishedGoodItemId,
                code: r.BomCode,
                name: r.BomName,
                revisionNo: r.RevisionNo,
                yieldQuantity: r.YieldQuantity,
                unitId: r.UnitId,
                unitCode: r.UnitCode,
                unitName: r.UnitName,
                effectiveFrom: r.EffectiveFrom,
                effectiveTo: r.EffectiveTo,
                isActive: Boolean(r.IsActive),
            })),
        });
    }),
);

router.delete(
    "/:id",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");

        // Soft delete Item
        await mssqlQuery(
            "DEFAULT",
            `
      UPDATE dbo.Items
      SET IsActive = 0, Status = 'obsolete'
      WHERE ItemId = @itemId
    `,
            { inputs: { itemId: { type: sql.Int, value: itemId } } },
        );

        res.json({ message: "Soft deleted successfully" });
    }),
);

router.delete(
    "/",
    writeRoles,
    asyncHandler(async (req, res) => {
        const ids = req.body.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            throw badRequest("ids array is required");
        }

        const validIds = ids.map((id) => parseId(id)).join(",");

        // Soft delete multiple Items
        await mssqlQuery(
            "DEFAULT",
            `
      UPDATE dbo.Items
      SET IsActive = 0, Status = 'obsolete'
      WHERE ItemId IN (${validIds})
    `,
        );

        res.json({ message: "Soft deleted successfully" });
    }),
);

router.put(
    "/:id/specs/:specId",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const specId = parseId(req.params.specId, "specId");
        const salesSku = String(
            req.body.salesSku || req.body.salesSKU || "",
        ).trim();
        const specCode = String(req.body.specCode || "").trim();
        const specName = String(req.body.specName || "").trim();
        const surfaceNameInput = String(req.body.surfaceName || "").trim();
        const gradeId = req.body.gradeId
            ? parseInt(req.body.gradeId, 10)
            : null;
        const isActive =
            req.body.isActive === undefined ? true : Boolean(req.body.isActive);

        if (!salesSku) throw badRequest("salesSku is required");
        if (!specCode) throw badRequest("specCode is required");
        if (!specName) throw badRequest("specName is required");

        let finalSurfaceId = null;
        if (surfaceNameInput) {
            // Find existing surface
            const surfRes = await mssqlQuery(
                "DEFAULT",
                `SELECT SurfaceId FROM dbo.Surfaces WHERE SurfaceName = @name`,
                {
                    inputs: {
                        name: { type: sql.NVarChar, value: surfaceNameInput },
                    },
                },
            );
            if (surfRes.length > 0) {
                finalSurfaceId = surfRes[0].SurfaceId;
            } else {
                // Auto-create new surface
                const maxRes = await mssqlQuery(
                    "DEFAULT",
                    `SELECT ISNULL(MAX(SurfaceId), 0) AS maxId FROM dbo.Surfaces`,
                );
                const nextId = maxRes[0].maxId + 1;
                const newCode = "S" + nextId;
                const insertSurf = await mssqlQuery(
                    "DEFAULT",
                    `
          INSERT INTO dbo.Surfaces (SurfaceCode, SurfaceName) 
          OUTPUT INSERTED.SurfaceId 
          VALUES (@code, @name)
        `,
                    {
                        inputs: {
                            code: { type: sql.NVarChar, value: newCode },
                            name: {
                                type: sql.NVarChar,
                                value: surfaceNameInput,
                            },
                        },
                    },
                );
                finalSurfaceId = insertSurf[0].SurfaceId;
                await refreshLookupsCache();
            }
        }

        await mssqlQuery(
            "DEFAULT",
            `
      UPDATE dbo.ItemSpecs SET
        SalesSKU = @salesSku,
        SpecCode = @specCode,
        SpecName = @specName,
        SurfaceId = @surfaceId,
        GradeId = @gradeId,
        IsActive = @isActive
      WHERE ItemId = @itemId AND ItemSpecId = @specId
    `,
            {
                inputs: {
                    itemId: { type: sql.Int, value: itemId },
                    specId: { type: sql.Int, value: specId },
                    salesSku: { type: sql.NVarChar(100), value: salesSku },
                    specCode: { type: sql.NVarChar(50), value: specCode },
                    specName: { type: sql.NVarChar(255), value: specName },
                    surfaceId: { type: sql.Int, value: finalSurfaceId },
                    gradeId: { type: sql.Int, value: gradeId },
                    isActive: { type: sql.Bit, value: isActive },
                },
            },
        );

        res.json({ message: "Spec updated successfully" });
    }),
);

router.delete(
    "/:id/specs/:specId",
    writeRoles,
    asyncHandler(async (req, res) => {
        const itemId = parseId(req.params.id, "itemId");
        const specId = parseId(req.params.specId, "specId");

        // Soft delete Item Spec
        await mssqlQuery(
            "DEFAULT",
            `
      UPDATE dbo.ItemSpecs
      SET IsActive = 0
      WHERE ItemId = @itemId AND ItemSpecId = @specId
    `,
            {
                inputs: {
                    itemId: { type: sql.Int, value: itemId },
                    specId: { type: sql.Int, value: specId },
                },
            },
        );

        res.json({ message: "Spec soft deleted successfully" });
    }),
);

// --- Price Lists & Price List Items Management ---
router.get(
    "/price-lists/list",
    readRoles,
    asyncHandler(async (req, res) => {
        const rows = await mssqlQuery(
            "DEFAULT",
            `
            SELECT 
                pl.PriceListId,
                pl.PriceListCode,
                pl.PriceListName,
                pl.CurrencyCode,
                pl.IsActive,
                pl.Priority,
                pl.CustomerPriceGroupId,
                cpg.PriceGroupCode,
                cpg.PriceGroupName
            FROM dbo.PriceLists pl
            LEFT JOIN dbo.CustomerPriceGroups cpg ON cpg.CustomerPriceGroupId = pl.CustomerPriceGroupId
            ORDER BY pl.PriceListCode ASC, pl.PriceListName ASC
            `
        );
        res.json({ data: rows });
    })
);

router.get(
    "/price-lists/:priceListId/items",
    readRoles,
    asyncHandler(async (req, res) => {
        const priceListId = parseId(req.params.priceListId, "priceListId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
            SELECT 
                pli.PriceListItemId,
                pli.PriceListId,
                pli.ItemId,
                i.ItemCode,
                i.ItemName,
                pli.ItemSpecId,
                ispec.SpecName,
                ispec.SalesSKU,
                pli.UnitId,
                unit.UnitCode,
                unit.UnitName,
                pli.UnitPrice,
                pli.UnitCost,
                pli.CurrencyCode,
                pli.EffectiveFrom,
                pli.EffectiveTo,
                pli.IsActive,
                pli.PricingMethod,
                pli.MarkupPercent,
                pli.MarginPercent
            FROM dbo.PriceListItems pli
            LEFT JOIN dbo.Items i ON i.ItemId = pli.ItemId
            LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = pli.ItemSpecId
            LEFT JOIN dbo.Units unit ON unit.UnitId = pli.UnitId
            WHERE pli.PriceListId = @priceListId
            ORDER BY i.ItemCode ASC, pli.EffectiveFrom DESC
            `,
            {
                inputs: {
                    priceListId: { type: sql.Int, value: priceListId }
                }
            }
        );
        res.json({ data: rows });
    })
);

router.put(
    "/price-lists/:priceListId/toggle",
    writeRoles,
    asyncHandler(async (req, res) => {
        const priceListId = parseId(req.params.priceListId, "priceListId");
        const isActive = parseBool(req.body.isActive);

        await mssqlQuery(
            "DEFAULT",
            `
            UPDATE dbo.PriceLists
            SET IsActive = @isActive
            WHERE PriceListId = @priceListId
            `,
            {
                inputs: {
                    priceListId: { type: sql.Int, value: priceListId },
                    isActive: { type: sql.Bit, value: isActive }
                }
            }
        );
        res.json({ message: "Price list status updated successfully" });
    })
);

router.put(
    "/price-lists/items/:priceListItemId/toggle",
    writeRoles,
    asyncHandler(async (req, res) => {
        const priceListItemId = parseId(req.params.priceListItemId, "priceListItemId");
        const isActive = parseBool(req.body.isActive);

        await mssqlQuery(
            "DEFAULT",
            `
            UPDATE dbo.PriceListItems
            SET IsActive = @isActive
            WHERE PriceListItemId = @priceListItemId
            `,
            {
                inputs: {
                    priceListItemId: { type: sql.Int, value: priceListItemId },
                    isActive: { type: sql.Bit, value: isActive }
                }
            }
        );
        res.json({ message: "Price list item status updated successfully" });
    })
);

export default router;
