import { Router } from "express";
import { mssqlQuery, sql, mssqlTransaction, getMssqlPool } from "../lib/mssql.js";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { salesOrderService } from "../services/sales/salesOrderService.js";
import { documentService } from "../services/common/documentService.js";
import { pricingResolverService } from "../services/pricing/pricingResolverService.js";
import { wmsTaskService } from "../services/wms/wmsTaskService.js";
import { reservationService } from "../services/inventory/reservationService.js";
import { approvalService } from "../services/common/approvalService.js";

const router = Router();

router.use(authenticate);

const readRoles = allowRoles("admin", "accounting", "user", "audit");
const writeRoles = allowRoles("admin", "accounting", "user");
const approveRoles = allowRoles("admin", "accounting");

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

function parseOptionalId(value, name) {
    if (value === null || value === undefined || value === "") return null;
    return parseId(value, name);
}

function parseBool(value) {
    return value === true || value === "true" || value === "1" || value === 1;
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

function normalizeEnum(value, allowed, name) {
    if (value === null || value === undefined || value === "") return null;
    const v = String(value).toLowerCase();
    if (!allowed.includes(v))
        throw badRequest(`${name} must be one of: ${allowed.join(", ")}`);
    return v;
}

function getUserId(req) {
    const raw = req.user?.sub;
    const userId = Number(raw);
    if (!Number.isInteger(userId) || userId <= 0)
        throw new Error("Invalid authenticated user");
    return userId;
}

function buildPagination(query) {
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    return { page, pageSize, offset: (page - 1) * pageSize };
}

function mapSalesOrder(row) {
    if (!row) return null;
    return {
        id: row.SalesOrderId,
        documentNo: row.DocumentNo,
        branchId: row.BranchId,
        branchCode: row.BranchCode,
        branchName: row.BranchName,
        customerId: row.CustomerId,
        customerCode: row.CustomerCode,
        customerName: row.CustomerName,
        documentDate: row.DocumentDate,
        requiredDate: row.RequiredDate,
        status: row.Status,
        customerPoNo: row.CustomerPoNo,
        customerPoDate: row.CustomerPoDate,
        salesPersonId: row.SalesPersonId,
        paymentTermId: row.PaymentTermId,
        priceListId: row.PriceListId,
        warehouseId: row.WarehouseId,
        taxType: row.TaxType,
        taxId: row.TaxId,
        remarks: row.Remarks,
        shippingAddress: row.ShippingAddress,
        currencyCode: row.CurrencyCode,
        subTotalAmount: row.SubTotalAmount,
        discountAmount: row.DiscountAmount,
        taxCodeId: row.TaxCodeId,
        taxAmount: row.TaxAmount,
        grandTotalAmount: row.GrandTotalAmount,
        createdBy: row.CreatedBy,
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
        deliveryOrderCount: row.DeliveryOrderCount || 0,
        invoiceCount: row.InvoiceCount || 0,
    };
}

function mapSalesOrderLine(row) {
    return {
        id: row.SalesOrderLineId,
        salesOrderId: row.SalesOrderId,
        lineNum: row.LineNum,
        itemId: row.ItemId,
        itemCode: row.ItemCode,
        itemName: row.ItemName,
        itemSpecId: row.ItemSpecId,
        salesSku: row.SalesSKU,
        specCode: row.SpecCode,
        specName: row.SpecName,
        quantity: row.Quantity,
        unitId: row.UnitId,
        unitCode: row.UnitCode,
        unitName: row.UnitName,
        unitPrice: row.UnitPrice,
        discountPercent: row.DiscountPercent,
        discountAmount: row.DiscountAmount,
        taxRatePercent: row.TaxRatePercent,
        unitCostSnapshot: row.UnitCostSnapshot,
        pricingSource: row.PricingSource,
        pricingReferenceId: row.PricingReferenceId,
        marginPercentSnapshot: row.MarginPercentSnapshot,
        markupPercentSnapshot: row.MarkupPercentSnapshot,
        lineAmount: row.LineAmount,
        taxCodeId: row.TaxCodeId,
        taxAmount: row.TaxAmount,
        productTypeCode: row.ProductTypeCode,
        thicknessMm: row.ThicknessMm,
        thicknessLabel: row.ThicknessLabel,
        widthM: row.WidthM,
        widthLabel: row.WidthLabel,
        lengthM: row.LengthM,
        lengthLabel: row.LengthLabel,
        remark: row.Remark,
    };
}

async function getSalesOrder(salesOrderId) {
    const rows = await mssqlQuery(
        "DEFAULT",
        `
    SELECT
      so.SalesOrderId,
      so.DocumentNo,
      so.BranchId,
      b.BranchCode,
      b.BranchName,
      so.CustomerId,
      c.CustomerCode,
      c.TaxId,
      c.CustomerName,
      so.DocumentDate,
      so.RequiredDate,
      so.Status,
      so.CustomerPoNo,
      so.CustomerPoDate,
      so.SalesPersonId,
      so.PaymentTermId,
      so.PriceListId,
      so.WarehouseId,
      so.TaxType,
      so.Remarks,
      so.ShippingAddress,
      so.CurrencyCode,
      so.SubTotalAmount,
      so.DiscountAmount,
      so.TaxAmount,
      so.GrandTotalAmount,
      so.CreatedBy,
      so.CreatedAt,
      so.UpdatedAt,
      (SELECT COUNT(1) FROM dbo.DeliveryOrders WHERE SalesOrderId = so.SalesOrderId AND Status != 'cancelled') AS DeliveryOrderCount,
      (SELECT COUNT(1) FROM dbo.SalesInvoices WHERE SalesOrderId = so.SalesOrderId AND Status != 'cancelled') AS InvoiceCount
    FROM dbo.SalesOrders so
    JOIN dbo.Customers c ON c.CustomerId = so.CustomerId
    LEFT JOIN dbo.Branches b ON b.BranchId = so.BranchId
    WHERE so.SalesOrderId = @salesOrderId
  `,
        { inputs: { salesOrderId: { type: sql.Int, value: salesOrderId } } },
    );

    return mapSalesOrder(rows[0]);
}

async function getSalesOrderLines(salesOrderId) {
    const rows = await mssqlQuery(
        "DEFAULT",
        `
    SELECT
      sol.SalesOrderLineId,
      sol.SalesOrderId,
      sol.LineNum,
      sol.ItemId,
      i.ItemCode,
      i.ItemName,
      sol.ItemSpecId,
      ispec.SalesSKU,
      ispec.SpecCode,
      ispec.SpecName,
      sol.Quantity,
      sol.UnitPrice,
      sol.DiscountPercent,
      sol.DiscountAmount,
      sol.TaxRatePercent,
      sol.UnitCostSnapshot,
      sol.PricingSource,
      sol.PricingReferenceId,
      sol.MarginPercentSnapshot,
      sol.MarkupPercentSnapshot,
      sol.LineAmount,
      sol.TaxCodeId,
      sol.TaxAmount,
      sol.UnitId,
      sol.Remark,
      u.UnitCode,
      u.UnitName,
      pt.ProductTypeCode,
      th.ThicknessMm,
      th.ThicknessLabel,
      w.WidthM,
      w.WidthLabel,
      l.LengthM,
      l.LengthLabel
    FROM dbo.SalesOrderLines sol
    JOIN dbo.Items i ON i.ItemId = sol.ItemId
    JOIN dbo.Units u ON u.UnitId = sol.UnitId
    LEFT JOIN dbo.ItemSpecs ispec ON ispec.ItemSpecId = sol.ItemSpecId
    LEFT JOIN dbo.ProductTypes pt ON pt.ProductTypeId = i.ProductTypeId
    LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
    LEFT JOIN dbo.ItemWidths w ON w.WidthId = i.WidthId
    LEFT JOIN dbo.ItemLengths l ON l.LengthId = i.LengthId
    WHERE sol.SalesOrderId = @salesOrderId
    ORDER BY sol.LineNum
  `,
        { inputs: { salesOrderId: { type: sql.Int, value: salesOrderId } } },
    );

    return rows.map(mapSalesOrderLine);
}

function buildSalesOrderFilters(query) {
    const { page, pageSize, offset } = buildPagination(query);
    const conditions = [];
    const inputs = {};

    if (query.customerId) {
        conditions.push("so.CustomerId = @customerId");
        inputs.customerId = {
            type: sql.Int,
            value: parseId(query.customerId, "customerId"),
        };
    }
    if (query.branchId) {
        conditions.push("so.BranchId = @branchId");
        inputs.branchId = {
            type: sql.Int,
            value: parseId(query.branchId, "branchId"),
        };
    }
    if (query.status !== undefined && query.status !== "") {
        const status = normalizeEnum(
            query.status,
            ["draft", "approved", "cancelled"],
            "status",
        );
        conditions.push("so.Status = @status");
        inputs.status = { type: sql.NVarChar(30), value: status };
    }
    if (query.search) {
        conditions.push(
            "(so.DocumentNo LIKE @search OR c.CustomerCode LIKE @search OR c.CustomerName LIKE @search)",
        );
        inputs.search = { type: sql.NVarChar(255), value: `%${query.search}%` };
    }
    if (query.dateFrom) {
        inputs.dateFrom = {
            type: sql.Date,
            value: parseOptionalDate(query.dateFrom, "dateFrom"),
        };
        conditions.push("so.DocumentDate >= @dateFrom");
    }
    if (query.dateTo) {
        inputs.dateTo = {
            type: sql.Date,
            value: parseOptionalDate(query.dateTo, "dateTo"),
        };
        conditions.push("so.DocumentDate <= @dateTo");
    }

    return {
        page,
        pageSize,
        offset,
        whereSql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        inputs,
    };
}

function calculateHeaderTotals(lines) {
    let subTotalAmount = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    let grandTotalAmount = 0;

    for (const line of lines) {
        subTotalAmount +=
            Number(line.quantity || 0) * Number(line.unitPrice || 0);
        discountAmount += Number(line.discountAmount || 0);
        taxAmount += Number(line.taxAmount || 0);
        grandTotalAmount +=
            Number(line.lineAmount || 0) + Number(line.taxAmount || 0);
    }

    return { subTotalAmount, discountAmount, taxAmount, grandTotalAmount };
}

function buildLineSnapshots(rawLines) {
    if (!Array.isArray(rawLines) || !rawLines.length)
        throw badRequest("lines is required");
    const lines = [];

    for (let idx = 0; idx < rawLines.length; idx += 1) {
        const raw = rawLines[idx] || {};
        console.log("raw", idx, raw);
        const lineNum =
            Number.isInteger(raw.lineNum) && raw.lineNum > 0
                ? raw.lineNum
                : idx + 1;
        const quantity = parseOptionalNumber(
            raw.quantity,
            `lines[${idx}].quantity`,
        );
        if (quantity === null)
            throw badRequest(`lines[${idx}].quantity is required`);
        const unitPrice =
            parseOptionalNumber(raw.unitPrice, `lines[${idx}].unitPrice`) ?? 0;

        const discountPercent =
            raw.discountPercent === undefined
                ? null
                : parseOptionalNumber(
                    raw.discountPercent,
                    `lines[${idx}].discountPercent`,
                );
        const discountAmount =
            parseOptionalNumber(
                raw.discountAmount,
                `lines[${idx}].discountAmount`,
            ) ?? 0;
        const taxRatePercent =
            parseOptionalNumber(
                raw.taxRatePercent,
                `lines[${idx}].taxRatePercent`,
            ) ?? 0;

        const lineBase = quantity * unitPrice;
        const lineNet = lineBase - discountAmount;
        const lineTax = (lineNet * taxRatePercent) / 100;
        const lineAmount = lineNet;

        lines.push({
            lineNum,
            itemId: parseId(raw.itemId, `lines[${idx}].itemId`),
            itemSpecId: parseOptionalId(
                raw.itemSpecId,
                `lines[${idx}].itemSpecId`,
            ),
            unitId: parseId(raw.unitId, `lines[${idx}].unitId`),
            quantity,
            unitPrice,
            discountPercent,
            discountAmount,
            taxRatePercent,
            unitCostSnapshot:
                raw.unitCostSnapshot === undefined
                    ? null
                    : parseOptionalNumber(
                        raw.unitCostSnapshot,
                        `lines[${idx}].unitCostSnapshot`,
                    ),
            pricingSource: raw.pricingSource
                ? normalizeEnum(
                    raw.pricingSource,
                    [
                        "contract",
                        "customer_price_list",
                        "item_default",
                        "manual",
                        "default_price_list",
                        "discount_rule",
                    ],
                    `lines[${idx}].pricingSource`,
                )
                : null,
            pricingReferenceId:
                raw.pricingReferenceId === undefined
                    ? null
                    : parseOptionalId(
                        raw.pricingReferenceId,
                        `lines[${idx}].pricingReferenceId`,
                    ),
            marginPercentSnapshot:
                raw.marginPercentSnapshot === undefined
                    ? null
                    : parseOptionalNumber(
                        raw.marginPercentSnapshot,
                        `lines[${idx}].marginPercentSnapshot`,
                    ),
            markupPercentSnapshot:
                raw.markupPercentSnapshot === undefined
                    ? null
                    : parseOptionalNumber(
                        raw.markupPercentSnapshot,
                        `lines[${idx}].markupPercentSnapshot`,
                    ),
            lineAmount,
            taxAmount: lineTax,
        });
    }

    return lines;
}

async function writeStatusHistory(
    documentType,
    documentId,
    fromStatus,
    toStatus,
    changedBy,
    notes,
    tx = null,
) {
    const pool = tx ? null : await getMssqlPool("DEFAULT");
    const req = new sql.Request(tx || pool);
    req.input("documentType", sql.NVarChar(40), documentType);
    req.input("documentId", sql.Int, documentId);
    req.input("fromStatus", sql.NVarChar(30), fromStatus);
    req.input("toStatus", sql.NVarChar(30), toStatus);
    req.input("changedBy", sql.Int, changedBy);
    req.input("notes", sql.NVarChar(1000), notes || null);
    await req.query(`
    INSERT INTO dbo.DocumentStatusHistory (
      DocumentType,
      DocumentId,
      FromStatus,
      ToStatus,
      ChangedBy,
      Notes
    )
    VALUES (
      @documentType,
      @documentId,
      @fromStatus,
      @toStatus,
      @changedBy,
      @notes
    )
  `);
}

router.get(
    "/customer-history/:customerId",
    readRoles,
    asyncHandler(async (req, res) => {
        const customerId = parseId(req.params.customerId, "customerId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT SalesOrderId AS id, DocumentNo, DocumentDate, Status
      FROM dbo.SalesOrders
      WHERE CustomerId = @customerId
      ORDER BY DocumentDate DESC, SalesOrderId DESC
    `,
            { inputs: { customerId: { type: sql.Int, value: customerId } } },
        );

        res.json({ data: rows });
    }),
);

router.get(
    "/",
    readRoles,
    asyncHandler(async (req, res) => {
        const { page, pageSize, offset, whereSql, inputs } =
            buildSalesOrderFilters(req.query);

        const rows = await mssqlQuery(
            "DEFAULT",
            `
      WITH FilteredOrders AS (
        SELECT so.SalesOrderId
        FROM dbo.SalesOrders so
        JOIN dbo.Customers c ON c.CustomerId = so.CustomerId
        ${whereSql}
      )
      SELECT
        so.SalesOrderId,
        so.DocumentNo,
        so.BranchId,
        b.BranchCode,
        b.BranchName,
        so.CustomerId,
        c.CustomerCode,
        c.CustomerName,
        so.DocumentDate,
        so.RequiredDate,
        so.Status,
      so.CustomerPoNo,
      so.CustomerPoDate,
      so.SalesPersonId,
      so.PaymentTermId,
      so.PriceListId,
      so.WarehouseId,
      so.TaxType,
      so.Remarks,
        so.CurrencyCode,
        so.GrandTotalAmount,
        so.CreatedAt,
        (SELECT COUNT(1) FROM FilteredOrders) AS TotalCount
      FROM FilteredOrders fo
      JOIN dbo.SalesOrders so ON so.SalesOrderId = fo.SalesOrderId
      JOIN dbo.Customers c ON c.CustomerId = so.CustomerId
      LEFT JOIN dbo.Branches b ON b.BranchId = so.BranchId
      ORDER BY so.CreatedAt DESC, so.SalesOrderId DESC
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
                id: r.SalesOrderId,
                documentNo: r.DocumentNo,
                branchId: r.BranchId,
                branchCode: r.BranchCode,
                branchName: r.BranchName,
                customerId: r.CustomerId,
                customerCode: r.CustomerCode,
                customerName: r.CustomerName,
                documentDate: r.DocumentDate,
                requiredDate: r.RequiredDate,
                status: r.Status,
                currencyCode: r.CurrencyCode,
                grandTotalAmount: r.GrandTotalAmount,
                createdAt: r.CreatedAt,
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
        const salesOrderId = parseId(req.params.id, "salesOrderId");
        const order = await getSalesOrder(salesOrderId);
        if (!order) {
            res.status(404).json({ message: "Sales order not found" });
            return;
        }
        const lines = await getSalesOrderLines(salesOrderId);
        res.json({ data: { ...order, lines } });
    }),
);

router.post(
    "/",
    writeRoles,
    asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const customerId = parseId(req.body.customerId, "customerId");
        const branchId = parseOptionalId(req.body.branchId, "branchId");
        const documentDate =
            parseOptionalDate(req.body.documentDate, "documentDate") ||
            new Date();
        const requiredDate = parseOptionalDate(
            req.body.requiredDate,
            "requiredDate",
        );
        const shippingAddress = req.body.shippingAddress
            ? String(req.body.shippingAddress).trim()
            : null;
        const currencyCode = req.body.currencyCode
            ? String(req.body.currencyCode).toUpperCase().slice(0, 3)
            : "THB";
        const customerPoNo = req.body.customerPoNo
            ? String(req.body.customerPoNo).trim()
            : null;
        const customerPoDate = parseOptionalDate(
            req.body.customerPoDate,
            "customerPoDate",
        );
        const salesPersonId = parseOptionalId(
            req.body.salesPersonId,
            "salesPersonId",
        );
        const paymentTermId = parseOptionalId(
            req.body.paymentTermId,
            "paymentTermId",
        );
        const priceListId = parseOptionalId(
            req.body.priceListId,
            "priceListId",
        );
        const warehouseId = parseOptionalId(
            req.body.warehouseId,
            "warehouseId",
        );
        const taxType =
            normalizeEnum(
                req.body.taxType,
                ["exclusive", "inclusive", "no_vat"],
                "taxType",
            ) || "exclusive";
        const remarks = req.body.remarks
            ? String(req.body.remarks).trim()
            : null;

        const customerRes = await mssqlQuery('DEFAULT', 'SELECT PriceListId FROM dbo.Customers WHERE CustomerId = @customerId', {
            inputs: { customerId: { type: sql.Int, value: customerId } }
        });
        const resolvedPriceListId = priceListId || customerRes[0]?.PriceListId || null;
        const lineSnapshots = buildLineSnapshots(req.body.lines);
        const totals = calculateHeaderTotals(lineSnapshots);

        let salesOrderId;
        try {
            await mssqlTransaction("DEFAULT", async (tx) => {
                const documentNo = await documentService.generateDocumentNumber(
                    tx,
                    "SO",
                    branchId,
                    documentDate,
                );

                // 1. Resolve pricing and check if approval is required
                let requiresApproval = false;
                const basePricingContext = {
                    customerId,
                    currencyCode,
                    documentDate,
                    warehouseId,
                    priceListId: resolvedPriceListId,
                };

                const resolvedLines = [];
                for (const line of lineSnapshots) {
                    const pricingContext = {
                        ...basePricingContext,
                        itemId: line.itemId,
                        itemSpecId: line.itemSpecId,
                        quantity: line.quantity,
                        unitId: line.unitId,
                    };
                    const pricing = await pricingResolverService.resolvePricing(
                        pricingContext,
                        tx,
                    );

                    if (line.unitPrice < pricing.finalPrice) {
                        requiresApproval = true;
                    }

                    resolvedLines.push({
                        line,
                        pricing,
                    });
                }

                // Determine final status
                const finalStatus = req.body.status === 'requested'
                    ? (requiresApproval ? 'requested' : 'approved')
                    : req.body.status;


                const headerReq = new sql.Request(tx);
                headerReq.input("documentNo", sql.NVarChar(50), documentNo);
                headerReq.input("branchId", sql.Int, branchId);
                headerReq.input("customerId", sql.Int, customerId);
                headerReq.input("documentDate", sql.Date, documentDate);
                headerReq.input("requiredDate", sql.Date, requiredDate);
                headerReq.input("status", sql.NVarChar(30), finalStatus);
                headerReq.input(
                    "shippingAddress",
                    sql.NVarChar(1000),
                    shippingAddress,
                );
                headerReq.input("currencyCode", sql.Char(3), currencyCode);
                headerReq.input(
                    "customerPoNo",
                    sql.NVarChar(100),
                    customerPoNo,
                );
                headerReq.input("customerPoDate", sql.Date, customerPoDate);
                headerReq.input("salesPersonId", sql.Int, salesPersonId);
                headerReq.input("paymentTermId", sql.Int, paymentTermId);
                headerReq.input("priceListId", sql.Int, resolvedPriceListId);
                headerReq.input("warehouseId", sql.Int, warehouseId);
                headerReq.input("taxType", sql.NVarChar(20), taxType);
                headerReq.input("remarks", sql.NVarChar(sql.MAX), remarks);
                headerReq.input(
                    "subTotalAmount",
                    sql.Decimal(18, 4),
                    totals.subTotalAmount,
                );
                headerReq.input(
                    "discountAmount",
                    sql.Decimal(18, 4),
                    totals.discountAmount,
                );
                headerReq.input(
                    "taxAmount",
                    sql.Decimal(18, 4),
                    totals.taxAmount,
                );
                headerReq.input(
                    "grandTotalAmount",
                    sql.Decimal(18, 4),
                    totals.grandTotalAmount,
                );
                headerReq.input("createdBy", sql.Int, userId);

                const headerRes = await headerReq.query(`
                  INSERT INTO dbo.SalesOrders (
                    DocumentNo, BranchId, CustomerId, DocumentDate, RequiredDate,
                    Status, ShippingAddress, CustomerPoNo, CustomerPoDate, SalesPersonId, PaymentTermId, PriceListId, WarehouseId, TaxType, Remarks, CurrencyCode, SubTotalAmount, DiscountAmount, TaxAmount, GrandTotalAmount, CreatedBy
                  )
                  OUTPUT INSERTED.SalesOrderId
                  VALUES (
                    @documentNo, @branchId, @customerId, @documentDate, @requiredDate,
                    @status, @shippingAddress, @customerPoNo, @customerPoDate, @salesPersonId, @paymentTermId, @priceListId, @warehouseId, @taxType, @remarks, @currencyCode, @subTotalAmount, @discountAmount, @taxAmount, @grandTotalAmount, @createdBy
                  )
                `);
                salesOrderId = headerRes.recordset[0].SalesOrderId;

                const dbLines = [];
                for (const item of resolvedLines) {
                    const line = item.line;
                    const pricing = item.pricing;

                    const lineReq = new sql.Request(tx);
                    lineReq.input("salesOrderId", sql.Int, salesOrderId);
                    lineReq.input("lineNum", sql.Int, line.lineNum);
                    lineReq.input("itemId", sql.Int, line.itemId);
                    lineReq.input("itemSpecId", sql.Int, line.itemSpecId);
                    lineReq.input("quantity", sql.Decimal(18, 4), line.quantity);
                    lineReq.input("unitPrice", sql.Decimal(18, 4), line.unitPrice); // Always save line.unitPrice from frontend!
                    lineReq.input("discountPercent", sql.Decimal(9, 4), line.discountPercent);
                    lineReq.input("discountAmount", sql.Decimal(18, 4), line.discountAmount);
                    lineReq.input("taxRatePercent", sql.Decimal(9, 4), line.taxRatePercent);
                    lineReq.input("unitCostSnapshot", sql.Decimal(18, 4), pricing.unitCost ?? line.unitCostSnapshot);
                    lineReq.input("pricingSource", sql.NVarChar(40), pricing.pricingSource ?? line.pricingSource);
                    lineReq.input("pricingReferenceId", sql.Int, pricing.pricingReferenceId ?? line.pricingReferenceId);
                    lineReq.input("marginPercentSnapshot", sql.Decimal(9, 4), line.marginPercentSnapshot);
                    lineReq.input("markupPercentSnapshot", sql.Decimal(9, 4), line.markupPercentSnapshot);
                    lineReq.input("lineAmount", sql.Decimal(18, 4), line.lineAmount);
                    lineReq.input("taxCodeId", sql.Int, line.taxCodeId);
                    lineReq.input("taxAmount", sql.Decimal(18, 4), line.taxAmount);
                    lineReq.input("unitId", sql.Int, line.unitId);
                    lineReq.input("remark", sql.NVarChar(1000), line.remark ? String(line.remark).trim() : null);

                    const lineResult = await lineReq.query(`
                      INSERT INTO dbo.SalesOrderLines (
                        SalesOrderId, LineNum, ItemId, ItemSpecId, Quantity, UnitPrice,
                        DiscountPercent, DiscountAmount, TaxRatePercent, UnitCostSnapshot,
                        PricingSource, PricingReferenceId, MarginPercentSnapshot, MarkupPercentSnapshot,
                        LineAmount, TaxCodeId, TaxAmount, UnitId, Remark
                      )
                      OUTPUT INSERTED.ItemId, INSERTED.ItemSpecId, INSERTED.Quantity, INSERTED.SalesOrderLineId
                      VALUES (
                        @salesOrderId, @lineNum, @itemId, @itemSpecId, @quantity, @unitPrice,
                        @discountPercent, @discountAmount, @taxRatePercent, @unitCostSnapshot,
                        @pricingSource, @pricingReferenceId, @marginPercentSnapshot, @markupPercentSnapshot,
                        @lineAmount, @taxCodeId, @taxAmount, @unitId, @remark
                      )                      
                    `);

                    const record = lineResult.recordset[0];
                    dbLines.push({
                        ItemId: record.ItemId,
                        ItemSpecId: record.ItemSpecId,
                        Quantity: record.Quantity,
                        Remark: line.remark || null
                    });

                    const salesOrderLineId = record.SalesOrderLineId;
                    await pricingResolverService.writePricingLogs(
                        salesOrderId,
                        salesOrderLineId,
                        pricing,
                        tx,
                    );
                }

                // Add Status History
                const histReq = new sql.Request(tx);
                histReq.input("soId", sql.Int, salesOrderId);
                histReq.input("userId", sql.Int, userId);
                histReq.input("status", sql.NVarChar(30), finalStatus);
                await histReq.query(`
                  INSERT INTO dbo.DocumentStatusHistory (DocumentType, DocumentId, ToStatus, ChangedBy, Notes)
                  VALUES ('SO', @soId, @status, @userId, 'Order created')
                `);

                // Post-insert automations
                if (finalStatus === 'approved') {
                    // Sync stock reservations
                    await reservationService.syncReservationsForApprovedOrder(tx, salesOrderId, dbLines, userId);

                    // Create WMS Picking Task
                    const resolvedWarehouseId = warehouseId || 1;
                    await wmsTaskService.createTask({
                        taskType: 'picking',
                        referenceType: 'SO',
                        referenceId: salesOrderId,
                        warehouseId: resolvedWarehouseId,
                        assignedTo: null,
                        lines: dbLines.map(line => ({
                            itemId: line.ItemId,
                            itemSpecId: line.ItemSpecId,
                            quantityRequired: line.Quantity,
                            remark: line.Remark || null,
                            fromLocationId: null,
                            toLocationId: null
                        }))
                    }, tx);
                } else if (finalStatus === 'requested') {
                    // Submit for approval automatically
                    await approvalService.createRequest({
                        documentType: 'SO',
                        documentId: salesOrderId,
                        requestedBy: userId,
                        notes: `Approval request for Sales Order ${documentNo} (sold below standard price)`,
                        steps: []
                    }, tx);
                }
            });
        } catch (e) {
            if (e.message && e.message.includes("Document Series")) {
                e.status = 400;
            }
            throw e;
        }

        const order = await getSalesOrder(salesOrderId);
        if (!order) {
            res.status(404).json({ message: "Sales order not found" });
            return;
        }
        const lines = await getSalesOrderLines(salesOrderId);
        res.json({ data: { ...order, lines } });
    }),
);

router.put(
    "/:id",
    writeRoles,
    asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const salesOrderId = parseId(req.params.id, "salesOrderId");
        const existing = await getSalesOrder(salesOrderId);
        if (!existing) {
            res.status(404).json({ message: "Sales order not found" });
            return;
        }
        if (existing.deliveryOrderCount > 0 || existing.invoiceCount > 0) {
            res.status(409).json({
                message: "Cannot edit sales order because it has already been processed to a Delivery Order or Invoice.",
            });
            return;
        }
        if (["closed", "cancelled"].includes(existing.status)) {
            res.status(409).json({
                message: `Cannot update sales order in status: ${existing.status}`,
            });
            return;
        }

        const activeTasks = await mssqlQuery("DEFAULT", `
            SELECT COUNT(1) AS cnt
            FROM dbo.WmsTasks
            WHERE ReferenceType = 'SO'
              AND ReferenceId = @salesOrderId
              AND Status NOT IN ('open', 'cancelled')
        `, {
            inputs: { salesOrderId: { type: sql.Int, value: salesOrderId } }
        });

        if (activeTasks[0].cnt > 0) {
            res.status(409).json({
                message: "Cannot edit sales order because warehouse picking has already started or completed.",
            });
            return;
        }

        const customerId =
            req.body.customerId === undefined
                ? null
                : parseId(req.body.customerId, "customerId");
        const branchId =
            req.body.branchId === undefined
                ? null
                : parseOptionalId(req.body.branchId, "branchId");
        const documentDate =
            req.body.documentDate === undefined
                ? null
                : parseOptionalDate(req.body.documentDate, "documentDate");
        const requiredDate =
            req.body.requiredDate === undefined
                ? null
                : parseOptionalDate(req.body.requiredDate, "requiredDate");
        const shippingAddress =
            req.body.shippingAddress === undefined
                ? null
                : req.body.shippingAddress
                    ? String(req.body.shippingAddress).trim()
                    : null;
        const currencyCode =
            req.body.currencyCode === undefined
                ? null
                : req.body.currencyCode
                    ? String(req.body.currencyCode).toUpperCase().slice(0, 3)
                    : "THB";
        const customerPoNo =
            req.body.customerPoNo === undefined
                ? null
                : req.body.customerPoNo
                    ? String(req.body.customerPoNo).trim()
                    : null;
        const customerPoDate =
            req.body.customerPoDate === undefined
                ? null
                : parseOptionalDate(req.body.customerPoDate, "customerPoDate");
        const salesPersonId =
            req.body.salesPersonId === undefined
                ? null
                : parseOptionalId(req.body.salesPersonId, "salesPersonId");
        const paymentTermId =
            req.body.paymentTermId === undefined
                ? null
                : parseOptionalId(req.body.paymentTermId, "paymentTermId");
        const priceListId =
            req.body.priceListId === undefined
                ? null
                : parseOptionalId(req.body.priceListId, "priceListId");
        const warehouseId =
            req.body.warehouseId === undefined
                ? null
                : parseOptionalId(req.body.warehouseId, "warehouseId");
        const taxType =
            req.body.taxType === undefined
                ? null
                : normalizeEnum(
                    req.body.taxType,
                    ["exclusive", "inclusive", "no_vat"],
                    "taxType",
                );
        const remarks =
            req.body.remarks === undefined
                ? null
                : req.body.remarks
                    ? String(req.body.remarks).trim()
                    : null;

        const replaceLines = parseBool(req.body.replaceLines ?? true);
        const lineSnapshots = replaceLines
            ? buildLineSnapshots(req.body.lines)
            : null;
        const totals = lineSnapshots
            ? calculateHeaderTotals(lineSnapshots)
            : null;

        const customerRes = await mssqlQuery("DEFAULT", `
            SELECT PriceListId FROM dbo.Customers WHERE CustomerId = @customerId
        `, {
            inputs: { customerId: { type: sql.Int, value: customerId || existing.customerId } }
        });
        const resolvedPriceListId = priceListId || customerRes[0]?.PriceListId || null;

        let finalStatus = existing.status;
        const dbLines = [];

        await mssqlTransaction("DEFAULT", async (tx) => {
            if (replaceLines) {
                // 1. Resolve pricing and check if approval is required
                let requiresApproval = false;
                const basePricingContext = {
                    customerId: customerId || existing.customerId,
                    currencyCode: currencyCode || existing.currencyCode,
                    documentDate: documentDate || existing.documentDate,
                    warehouseId: warehouseId || existing.warehouseId,
                    priceListId: resolvedPriceListId,
                };

                const resolvedLines = [];
                for (const line of lineSnapshots) {
                    const pricingContext = {
                        ...basePricingContext,
                        itemId: line.itemId,
                        itemSpecId: line.itemSpecId,
                        quantity: line.quantity,
                        unitId: line.unitId,
                    };
                    const pricing = await pricingResolverService.resolvePricing(
                        pricingContext,
                        tx,
                    );

                    if (line.unitPrice < pricing.finalPrice) {
                        requiresApproval = true;
                    }

                    resolvedLines.push({
                        line,
                        pricing,
                    });
                }

                // Determine final status
                if (existing.status !== "draft") {
                    finalStatus = requiresApproval ? "requested" : "approved";
                }

                // 2. Update Header (within transaction)
                const headerReq = new sql.Request(tx);
                headerReq.input("salesOrderId", sql.Int, salesOrderId);
                headerReq.input("customerId", sql.Int, customerId || existing.customerId);
                headerReq.input("branchId", sql.Int, branchId);
                headerReq.input("documentDate", sql.Date, documentDate || existing.documentDate);
                headerReq.input("requiredDate", sql.Date, requiredDate);
                headerReq.input("shippingAddress", sql.NVarChar(1000), shippingAddress);
                headerReq.input("currencyCode", sql.Char(3), currencyCode || existing.currencyCode);
                headerReq.input("customerPoNo", sql.NVarChar(100), customerPoNo);
                headerReq.input("customerPoDate", sql.Date, customerPoDate);
                headerReq.input("salesPersonId", sql.Int, salesPersonId);
                headerReq.input("paymentTermId", sql.Int, paymentTermId);
                headerReq.input("priceListId", sql.Int, resolvedPriceListId);
                headerReq.input("warehouseId", sql.Int, warehouseId || existing.warehouseId);
                headerReq.input("taxType", sql.NVarChar(20), taxType || existing.taxType);
                headerReq.input("remarks", sql.NVarChar(sql.MAX), remarks);
                headerReq.input("subTotalAmount", sql.Decimal(18, 4), totals?.subTotalAmount ?? existing.subTotalAmount);
                headerReq.input("discountAmount", sql.Decimal(18, 4), totals?.discountAmount ?? existing.discountAmount);
                headerReq.input("taxAmount", sql.Decimal(18, 4), totals?.taxAmount ?? existing.taxAmount);
                headerReq.input("grandTotalAmount", sql.Decimal(18, 4), totals?.grandTotalAmount ?? existing.grandTotalAmount);
                headerReq.input("status", sql.NVarChar(30), finalStatus);

                await headerReq.query(`
                  UPDATE dbo.SalesOrders
                  SET
                    CustomerId = @customerId,
                    BranchId = @branchId,
                    DocumentDate = @documentDate,
                    RequiredDate = @requiredDate,
                    ShippingAddress = @shippingAddress,
                    CustomerPoNo = @customerPoNo,
                    CustomerPoDate = @customerPoDate,
                    SalesPersonId = @salesPersonId,
                    PaymentTermId = @paymentTermId,
                    PriceListId = @priceListId,
                    WarehouseId = @warehouseId,
                    TaxType = @taxType,
                    Remarks = @remarks,
                    CurrencyCode = @currencyCode,
                    SubTotalAmount = @subTotalAmount,
                    DiscountAmount = @discountAmount,
                    TaxAmount = @taxAmount,
                    GrandTotalAmount = @grandTotalAmount,
                    Status = @status,
                    UpdatedAt = SYSUTCDATETIME()
                  WHERE SalesOrderId = @salesOrderId
                `);

                // 3. Delete existing lines
                const deleteReq = new sql.Request(tx);
                deleteReq.input("salesOrderId", sql.Int, salesOrderId);
                await deleteReq.query(`
                    DELETE FROM dbo.SalesOrderLines
                    WHERE SalesOrderId = @salesOrderId
                `);

                // 4. Insert new lines & write pricing logs
                for (const item of resolvedLines) {
                    const line = item.line;
                    const pricing = item.pricing;

                    const lineReq = new sql.Request(tx);
                    lineReq.input("salesOrderId", sql.Int, salesOrderId);
                    lineReq.input("lineNum", sql.Int, line.lineNum);
                    lineReq.input("itemId", sql.Int, line.itemId);
                    lineReq.input("itemSpecId", sql.Int, line.itemSpecId);
                    lineReq.input("quantity", sql.Decimal(18, 4), line.quantity);
                    lineReq.input("unitPrice", sql.Decimal(18, 4), line.unitPrice);
                    lineReq.input("discountPercent", sql.Decimal(9, 4), line.discountPercent);
                    lineReq.input("discountAmount", sql.Decimal(18, 4), line.discountAmount);
                    lineReq.input("taxRatePercent", sql.Decimal(9, 4), line.taxRatePercent);
                    lineReq.input("unitCostSnapshot", sql.Decimal(18, 4), pricing.unitCost ?? line.unitCostSnapshot);
                    lineReq.input("pricingSource", sql.NVarChar(40), pricing.pricingSource ?? line.pricingSource);
                    lineReq.input("pricingReferenceId", sql.Int, pricing.pricingReferenceId ?? line.pricingReferenceId);
                    lineReq.input("marginPercentSnapshot", sql.Decimal(9, 4), line.marginPercentSnapshot);
                    lineReq.input("markupPercentSnapshot", sql.Decimal(9, 4), line.markupPercentSnapshot);
                    lineReq.input("lineAmount", sql.Decimal(18, 4), line.lineAmount);
                    lineReq.input("taxCodeId", sql.Int, line.taxCodeId);
                    lineReq.input("taxAmount", sql.Decimal(18, 4), line.taxAmount);
                    lineReq.input("unitId", sql.Int, line.unitId);
                    lineReq.input("remark", sql.NVarChar(1000), line.remark ? String(line.remark).trim() : null);

                    const lineResult = await lineReq.query(`
                      INSERT INTO dbo.SalesOrderLines (
                        SalesOrderId, LineNum, ItemId, ItemSpecId, Quantity, UnitPrice,
                        DiscountPercent, DiscountAmount, TaxRatePercent, UnitCostSnapshot,
                        PricingSource, PricingReferenceId, MarginPercentSnapshot, MarkupPercentSnapshot,
                        LineAmount, TaxCodeId, TaxAmount, UnitId, Remark
                      )
                      OUTPUT INSERTED.ItemId, INSERTED.ItemSpecId, INSERTED.Quantity, INSERTED.SalesOrderLineId
                      VALUES (
                        @salesOrderId, @lineNum, @itemId, @itemSpecId, @quantity, @unitPrice,
                        @discountPercent, @discountAmount, @taxRatePercent, @unitCostSnapshot,
                        @pricingSource, @pricingReferenceId, @marginPercentSnapshot, @markupPercentSnapshot,
                        @lineAmount, @taxCodeId, @taxAmount, @unitId, @remark
                      )                      
                    `);

                    const record = lineResult.recordset[0];
                    dbLines.push({
                        ItemId: record.ItemId,
                        ItemSpecId: record.ItemSpecId,
                        Quantity: record.Quantity,
                        SalesOrderLineId: record.SalesOrderLineId,
                        Remark: line.remark || null
                    });

                    const salesOrderLineId = record.SalesOrderLineId;
                    await pricingResolverService.writePricingLogs(
                        salesOrderId,
                        salesOrderLineId,
                        pricing,
                        tx,
                    );
                }

                // 5. Sync stock reservations or release them, and manage WMS Tasks
                if (finalStatus === "approved") {
                    // Cancel existing open picking tasks
                    const cancelTasksReq = new sql.Request(tx);
                    cancelTasksReq.input("salesOrderId", sql.Int, salesOrderId);
                    await cancelTasksReq.query(`
                      UPDATE dbo.WmsTasks
                      SET Status = 'cancelled'
                      WHERE ReferenceType = 'SO'
                        AND ReferenceId = @salesOrderId
                        AND Status = 'open'
                    `);

                    await reservationService.syncReservationsForApprovedOrder(tx, salesOrderId, dbLines, userId);

                    // Recreate picking task
                    const resolvedWarehouseId = warehouseId || existing.warehouseId || 1;
                    await wmsTaskService.createTask({
                        taskType: 'picking',
                        referenceType: 'SO',
                        referenceId: salesOrderId,
                        warehouseId: resolvedWarehouseId,
                        assignedTo: null,
                        lines: dbLines.map(line => ({
                            itemId: line.ItemId,
                            itemSpecId: line.ItemSpecId,
                            quantityRequired: line.Quantity,
                            remark: line.Remark || null,
                            fromLocationId: null,
                            toLocationId: null
                        }))
                    }, tx);
                } else if (finalStatus === "requested") {
                    // Cancel existing open picking tasks
                    const cancelTasksReq = new sql.Request(tx);
                    cancelTasksReq.input("salesOrderId", sql.Int, salesOrderId);
                    await cancelTasksReq.query(`
                      UPDATE dbo.WmsTasks
                      SET Status = 'cancelled'
                      WHERE ReferenceType = 'SO'
                        AND ReferenceId = @salesOrderId
                        AND Status = 'open'
                    `);

                    const releaseReq = new sql.Request(tx);
                    releaseReq.input("salesOrderId", sql.Int, salesOrderId);
                    await releaseReq.query(`
                      UPDATE dbo.InventoryReservations
                      SET Status = 'released'
                      WHERE ReferenceType = 'SO'
                        AND ReferenceId = @salesOrderId
                        AND Status IN ('open', 'allocated', 'picked')
                    `);
                    
                    await approvalService.cancelActiveRequests("SO", salesOrderId, tx);
                    await approvalService.createRequest({
                        documentType: "SO",
                        documentId: salesOrderId,
                        requestedBy: userId,
                        notes: "Approval request for Sales Order (price modified below standard price)",
                        steps: []
                    }, tx);
                }
            }

            // 6. Write status history
            if (existing.status !== finalStatus) {
                await writeStatusHistory(
                    "SO",
                    salesOrderId,
                    existing.status,
                    finalStatus,
                    userId,
                    `Updated & status changed to ${finalStatus}`,
                    tx,
                );
            } else {
                await writeStatusHistory(
                    "SO",
                    salesOrderId,
                    existing.status,
                    existing.status,
                    userId,
                    "Updated",
                    tx,
                );
            }
        });

        const order = await getSalesOrder(salesOrderId);
        const lines = await getSalesOrderLines(salesOrderId);
        res.json({ data: { ...order, lines } });
    }),
);

router.get(
    "/:id/status-history",
    readRoles,
    asyncHandler(async (req, res) => {
        const salesOrderId = parseId(req.params.id, "salesOrderId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
      SELECT
        DocumentStatusHistoryId,
        DocumentType,
        DocumentId,
        FromStatus,
        ToStatus,
        ChangedBy,
        ChangedAt,
        Notes
      FROM dbo.DocumentStatusHistory
      WHERE DocumentType = 'SO' AND DocumentId = @salesOrderId
      ORDER BY ChangedAt DESC, DocumentStatusHistoryId DESC
    `,
            {
                inputs: {
                    salesOrderId: { type: sql.Int, value: salesOrderId },
                },
            },
        );

        res.json({
            data: rows.map((r) => ({
                id: r.DocumentStatusHistoryId,
                documentType: r.DocumentType,
                documentId: r.DocumentId,
                fromStatus: r.FromStatus,
                toStatus: r.ToStatus,
                changedBy: r.ChangedBy,
                changedAt: r.ChangedAt,
                notes: r.Notes,
            })),
        });
    }),
);

router.post(
    "/:id/request-approval",
    writeRoles,
    asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const salesOrderId = parseId(req.params.id, "salesOrderId");
        const { steps } = req.body; // Can accept default steps from frontend or resolve logic later
        const result = await salesOrderService.requestApproval(
            salesOrderId,
            userId,
            steps,
        );
        res.json(result);
    }),
);

router.post(
    "/:id/approve",
    approveRoles,
    asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const salesOrderId = parseId(req.params.id, "salesOrderId");
        const result = await salesOrderService.approveSalesOrder(
            salesOrderId,
            userId,
        );
        res.json(result);
    }),
);

router.post(
    "/:id/cancel",
    writeRoles,
    asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const salesOrderId = parseId(req.params.id, "salesOrderId");
        const existing = await getSalesOrder(salesOrderId);
        if (!existing) {
            res.status(404).json({ message: "Sales order not found" });
            return;
        }
        if (existing.status === "cancelled") {
            res.json({ data: existing });
            return;
        }
        if (existing.deliveryOrderCount > 0 || existing.invoiceCount > 0) {
            res.status(409).json({
                message: "Cannot cancel sales order because it has already been processed to a Delivery Order or Invoice.",
            });
            return;
        }
        if (!["draft", "approved", "requested"].includes(existing.status)) {
            res.status(409).json({
                message: `Cannot cancel sales order in status: ${existing.status}`,
            });
            return;
        }

        // Active Picking Task Check
        const activeTasks = await mssqlQuery("DEFAULT", `
            SELECT COUNT(1) AS cnt
            FROM dbo.WmsTasks
            WHERE ReferenceType = 'SO'
              AND ReferenceId = @salesOrderId
              AND Status NOT IN ('open', 'cancelled')
        `, {
            inputs: { salesOrderId: { type: sql.Int, value: salesOrderId } }
        });

        if (activeTasks[0].cnt > 0) {
            res.status(409).json({
                message: "Cannot cancel sales order because warehouse picking has already started or completed.",
            });
            return;
        }

        // Cancel open picking tasks
        await mssqlQuery("DEFAULT", `
            UPDATE dbo.WmsTasks
            SET Status = 'cancelled'
            WHERE ReferenceType = 'SO'
              AND ReferenceId = @salesOrderId
              AND Status = 'open'
        `, {
            inputs: { salesOrderId: { type: sql.Int, value: salesOrderId } }
        });

        await mssqlQuery(
            "DEFAULT",
            `
      UPDATE dbo.SalesOrders
      SET
        Status = 'cancelled',
        UpdatedAt = SYSUTCDATETIME()
      WHERE SalesOrderId = @salesOrderId
    `,
            {
                inputs: {
                    salesOrderId: { type: sql.Int, value: salesOrderId },
                },
            },
        );

        // Release active reservations tied to this SO.
        await mssqlQuery(
            "DEFAULT",
            `
      UPDATE dbo.InventoryReservations
      SET Status = 'released'
      WHERE ReferenceType = 'SO'
        AND ReferenceId = @salesOrderId
        AND Status IN ('open', 'allocated', 'picked')
    `,
            {
                inputs: {
                    salesOrderId: { type: sql.Int, value: salesOrderId },
                },
            },
        );

        await writeStatusHistory(
            "SO",
            salesOrderId,
            existing.status,
            "cancelled",
            userId,
            req.body?.notes ? String(req.body.notes).trim() : null,
        );

        // Cancel active approval requests
        await approvalService.cancelActiveRequests("SO", salesOrderId);

        const order = await getSalesOrder(salesOrderId);
        res.json({ data: order });
    }),
);

export default router;
