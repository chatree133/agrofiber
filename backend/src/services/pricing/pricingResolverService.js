import { sql, getMssqlPool } from "../../lib/mssql.js";
import { calculateMargin, calculateMarkup } from "./pricingUtils.js";

function buildPricingResult(data = {}) {
    return {
        unitCost: Number(data.unitCost || 0),

        unitPrice: Number(data.unitPrice || 0),

        pricingSource: data.pricingSource || null,

        pricingReferenceTable: data.pricingReferenceTable || null,

        pricingReferenceId: data.pricingReferenceId || null,

        pricingMethod: data.pricingMethod || "FIXED_PRICE",

        pricingValue: Number(data.pricingValue || 0),

        stopProcessing: data.stopProcessing ?? false,
    };
}

export const pricingResolverService = {
    async resolvePricing(context, tx) {
        const basePrice = await this.resolveBasePrice(context, tx);
        let pricingResult = {
            basePrice: Number(basePrice.unitPrice || 0), //ราคาก่อนปรับส่วนลดหรือโปรโมชั่นใดๆ

            unitCost: Number(basePrice.unitCost || 0), //ต้นทุนต่อหน่วย ณ เวลาที่คำนวณราคา

            finalPrice: Number(basePrice.unitPrice || 0), //ราคาหลังปรับส่วนลดหรือโปรโมชั่น แต่ก่อนภาษี

            pricingSource: basePrice.pricingSource, //แหล่งที่มาของราคาฐาน เช่น สัญญา, ราคากลุ่มลูกค้า, หรือ ปลีกย่อย

            pricingReferenceTable: basePrice.pricingReferenceTable, //ตารางที่ใช้เป็น reference สำหรับราคาฐาน เช่น CustomerPriceContractLines, PriceListItems

            pricingReferenceId: basePrice.pricingReferenceId, //ID ที่ใช้เป็น reference สำหรับราคาฐาน เช่น CustomerPriceContractLineId หรือ PriceListItemId

            pricingMethod: basePrice.pricingMethod, //วิธีการคำนวณราคาจากต้นทุน เช่น FIXED_PRICE, MARKUP, MARGIN, DISCOUNT_PERCENT, DISCOUNT_AMOUNT

            discountPercent: 0, //ส่วนลดเป็นเปอร์เซ็นต์ที่ปรับจากราคาฐาน

            discountAmount: 0, //ส่วนลดเป็นจำนวนเงินที่ปรับจากราคาฐาน

            stopProcessing: basePrice.stopProcessing ?? false, //ตัวแปรที่บ่งบอกว่าหลังจากนี้จะหยุดการคำนวณราคาเพิ่มเติมหรือไม่ เช่น หยุดถ้าราคาถูกกำหนดมาจากสัญญาและไม่ต้องการให้มีส่วนลดเพิ่มเติม

            adjustments: [], //อาร์เรย์ที่เก็บรายละเอียดของการปรับราคาในแต่ละขั้นตอน เช่น ส่วนลดที่ใช้, แหล่งที่มาของส่วนลด, จำนวนเงินที่ปรับ, ราคาหลังปรับ, และคำอธิบาย
        };

        // ถ้า stopProcessing เป็น true จะไม่ปรับราคาเพิ่มเติม และคำนวณ margin/markup จากราคาปัจจุบันแล้ว return ทันที
        if (pricingResult.stopProcessing) {
            pricingResult.marginPercent = calculateMargin(
                pricingResult.finalPrice,
                pricingResult.unitCost,
            );

            pricingResult.markupPercent = calculateMarkup(
                pricingResult.finalPrice,
                pricingResult.unitCost,
            );

            return pricingResult;
        }

        // คำนวณราคาหลังปรับส่วนลดระดับบรรทัด (ถ้ามี)
        pricingResult = await this.applyLineDiscounts(
            context,
            pricingResult,
            tx,
        );

        // ปัดทศนิยมของราคาสุดท้ายก่อนคำนวณ margin/markup เพื่อให้แสดงราคาที่ลูกค้าเห็นใน margin/markup ด้วย
        pricingResult.finalPrice = Number(pricingResult.finalPrice.toFixed(4));

        // คำนวณ margin และ markup จากราคาสุดท้าย
        pricingResult.marginPercent = calculateMargin(
            pricingResult.finalPrice,
            pricingResult.unitCost,
        );

        pricingResult.markupPercent = calculateMarkup(
            pricingResult.finalPrice,
            pricingResult.unitCost,
        );

        return pricingResult;
    },

    async resolveBasePrice(context, tx) {
        // ลำดับการค้นหาราคาฐาน (Base Price) จะเริ่มจากแหล่งที่มีความเฉพาะเจาะจงมากที่สุดไปยังน้อยที่สุด เพื่อให้ได้ราคาที่เหมาะสมกับบริบทของลูกค้าและรายการสินค้า โดยมีลำดับดังนี้:
        // 1 Contract
        // 2 Customer Price Group
        // 3 Price List

        const contractPrice = await this.findContractPrice(context, tx);
        console.log("contractPrice", contractPrice);
        if (contractPrice) {
            // return this.applyPricingMethod(contractPrice);
            // ฉันจะคุมว่่า ราคาที่ได้จากสัญญา UnitPrice คือราคาหลังจากที่ถูกปรับด้วยวิธีการต่างๆ ตามที่กำหนดในสัญญาแล้ว ดังนั้นจะ return ทันทีโดยไม่ต้องผ่าน applyPricingMethod อีกครั้ง เพราะมันจะทำให้ราคาที่ได้ผิดพลาดได้ถ้า applyPricingMethod ถูกใช้ซ้ำอีกครั้งกับราคาที่ผ่านการปรับมาแล้ว
            return contractPrice;
        }

        // findCustomerPrice ต่างกับ findPriceListPrice ตรงที่ findCustomerPrice จะเชื่อมโยงกับกลุ่มราคาของลูกค้า (Customer Price Group) ซึ่งอาจจะมีการกำหนดราคาที่แตกต่างกันสำหรับลูกค้าที่อยู่ในกลุ่มราคาต่างๆ กัน
        // ในขณะที่ findPriceListPrice จะค้นหาราคาจากรายการราคาทั่วไปที่ไม่ได้เชื่อมโยงกับกลุ่มลูกค้าโดยตรง ดังนั้น findCustomerPrice จะมีความเฉพาะเจาะจงมากกว่า findPriceListPrice เพราะมันพิจารณาถึงกลุ่มราคาของลูกค้าในการค้นหาราคา
        // ในขณะที่ findPriceListPrice จะค้นหาราคาที่เป็นมาตรฐานสำหรับสินค้านั้นๆ โดยไม่คำนึงถึงกลุ่มลูกค้า
        const customerPrice = await this.findCustomerPrice(context, tx);
        console.log("customerPrice", customerPrice);
        if (customerPrice) {
            // return this.applyPricingMethod(customerPrice);
            // เช่นเดียวกับ contractPrice ฉันจะคุมว่่า ราคาที่ได้จาก customerPrice UnitPrice คือราคาหลังจากที่ถูกปรับด้วยวิธีการต่างๆ ตามที่กำหนดในกลุ่มราคาของลูกค้าแล้ว ดังนั้นจะ return ทันทีโดยไม่ต้องผ่าน applyPricingMethod อีกครั้ง เพราะมันจะทำให้ราคาที่ได้ผิดพลาดได้ถ้า applyPricingMethod ถูกใช้ซ้ำอีกครั้งกับราคาที่ผ่านการปรับมาแล้ว
            return customerPrice;
        }

        const priceListPrice = await this.findPriceListPrice(context, tx);
        console.log("priceListPrice", priceListPrice);
        if (priceListPrice) {
            // return this.applyPricingMethod(priceListPrice);
            // เช่นเดียวกับ contractPrice และ customerPrice ฉันจะคุมว่่า ราคาที่ได้จาก priceListPrice UnitPrice คือราคาหลังจากที่ถูกปรับด้วยวิธีการต่างๆ ตามที่กำหนดในรายการราคาแล้ว ดังนั้นจะ return ทันทีโดยไม่ต้องผ่าน applyPricingMethod อีกครั้ง เพราะมันจะทำให้ราคาที่ได้ผิดพลาดได้ถ้า applyPricingMethod ถูกใช้ซ้ำอีกครั้งกับราคาที่ผ่านการปรับมาแล้ว
            return priceListPrice;
        }

        throw new Error(`Price not found for ItemId=${context.itemId}`);
    },

    applyPricingMethod(price) {
        let unitPrice = Number(price.unitPrice || 0);
        const unitCost = Number(price.unitCost || 0);
        const value = Number(price.pricingValue || 0);
        switch (price.pricingMethod) {
            case "FIXED_PRICE":
                break;

            case "MARKUP":
                unitPrice = unitCost + unitCost * (value / 100);
                break;

            case "MARGIN":
                if (value >= 100) {
                    throw new Error("Margin percent cannot be >= 100");
                }

                if (unitCost <= 0) {
                    throw new Error("Cannot calculate margin with zero cost");
                }
                unitPrice = unitCost / (1 - value / 100);
                break;

            case "DISCOUNT_PERCENT":
                unitPrice = unitPrice - unitPrice * (value / 100);
                break;

            case "DISCOUNT_AMOUNT":
                unitPrice = unitPrice - value;
                break;

            default:
                break;
        }

        return {
            ...price,
            unitPrice: Number(unitPrice.toFixed(4)),
        };
    },

    async findContractPrice(context, tx) {
        // ราคาที่เก็บไว้ใน CustomerPriceContractLines ถูกจัดเก็บเป็น UnitPrice หลังจากปรับตาม PricingMethod แล้ว
        const { customerId, itemId, itemSpecId, quantity, documentDate, unitId } = context;

        const pool = tx ? null : await getMssqlPool('DEFAULT');
        const req = new sql.Request(tx || pool);

        req.input("CustomerId", sql.Int, customerId);

        req.input("ItemId", sql.Int, itemId);

        req.input("ItemSpecId", sql.Int, itemSpecId);

        req.input("Quantity", sql.Decimal(18, 4), quantity);

        req.input("DocumentDate", sql.Date, documentDate);

        req.input("UnitId", sql.Int, unitId);

        const result = await req.query(`
                SELECT TOP 1

                    cpcl.CustomerPriceContractLineId
                        AS pricingReferenceId,

                    cpcl.UnitPrice
                        AS unitPrice,

                    cpcl.UnitCost
                        AS unitCost,

                    cpcl.PricingMethod
                        AS pricingMethod,

                    CASE

                        WHEN cpcl.PricingMethod = 'MARKUP'
                            THEN cpcl.MarkupPercent

                        WHEN cpcl.PricingMethod = 'MARGIN'
                            THEN cpcl.MarginPercent

                        WHEN cpcl.PricingMethod = 'DISCOUNT_PERCENT'
                            THEN cpcl.DiscountPercent

                        WHEN cpcl.PricingMethod = 'DISCOUNT_AMOUNT'
                            THEN cpcl.DiscountAmount

                        ELSE 0

                    END
                        AS pricingValue,

                    'CONTRACT'
                        AS pricingSource,

                    'CustomerPriceContractLines'
                        AS pricingReferenceTable,

                    cpc.StopProcessing
                        AS stopProcessing

                FROM dbo.CustomerPriceContracts cpc

                INNER JOIN dbo.CustomerPriceContractLines cpcl
                    ON cpcl.CustomerPriceContractId =
                        cpc.CustomerPriceContractId

                WHERE

                    cpc.CustomerId = @CustomerId

                    AND cpcl.ItemId = @ItemId

                    AND (
                        cpcl.ItemSpecId IS NULL
                        OR cpcl.ItemSpecId = @ItemSpecId
                    )

                    AND (
                        cpcl.UnitId IS NULL
                        OR cpcl.UnitId = @UnitId
                    )

                    AND @Quantity >=
                        ISNULL(cpcl.MinQuantity, 0)

                    AND (
                        cpcl.MaxQuantity IS NULL
                        OR @Quantity <= cpcl.MaxQuantity
                    )

                    AND (
                        cpc.EffectiveFrom IS NULL
                        OR cpc.EffectiveFrom <= @DocumentDate
                    )

                    AND (
                        cpc.EffectiveTo IS NULL
                        OR cpc.EffectiveTo >= @DocumentDate
                    )

                    AND cpc.IsActive = 1

                ORDER BY
                    CASE
                        WHEN cpcl.ItemSpecId = @ItemSpecId THEN 0
                        WHEN cpcl.ItemSpecId IS NULL THEN 1
                        ELSE 2
                    END,
                    cpc.Priority DESC,
                    cpcl.MinQuantity DESC,
                    cpc.EffectiveFrom DESC
            `);

        const row = result?.recordset?.[0];

        if (!row) return null;

        return buildPricingResult(row);
    },

    async findCustomerPrice(context, tx) {
        // ราคาที่เก็บไว้ใน PriceListItems ถูกจัดเก็บเป็น UnitPrice หลังจากปรับตาม PricingMethod แล้ว
        const { customerId, itemId, itemSpecId, quantity, documentDate, unitId } = context;

        const pool = tx ? null : await getMssqlPool('DEFAULT');
        const req = new sql.Request(tx || pool);

        req.input("CustomerId", sql.Int, customerId);

        req.input("ItemId", sql.Int, itemId);

        req.input("ItemSpecId", sql.Int, itemSpecId);

        req.input("Quantity", sql.Decimal(18, 4), quantity);

        req.input("DocumentDate", sql.Date, documentDate);

        req.input("UnitId", sql.Int, unitId);

        const result = await req.query(`
                SELECT TOP 1

                    pli.PriceListItemId
                        AS pricingReferenceId,

                    pli.UnitPrice
                        AS unitPrice,

                    pli.UnitCost
                        AS unitCost,

                    pli.PricingMethod
                        AS pricingMethod,

                    CASE

                        WHEN pli.PricingMethod = 'MARKUP'
                            THEN pli.MarkupPercent

                        WHEN pli.PricingMethod = 'MARGIN'
                            THEN pli.MarginPercent

                        WHEN pli.PricingMethod = 'DISCOUNT_PERCENT'
                            THEN pli.DiscountPercent

                        WHEN pli.PricingMethod = 'DISCOUNT_AMOUNT'
                            THEN pli.DiscountAmount

                        ELSE 0

                    END
                        AS pricingValue,

                    'CUSTOMER_PRICE_LIST'
                        AS pricingSource,

                    'PriceListItems'
                        AS pricingReferenceTable,

                    CAST(0 AS BIT)
                        AS stopProcessing

                FROM dbo.Customers c

                INNER JOIN dbo.PriceLists pl
                    ON pl.CustomerPriceGroupId =
                        c.CustomerPriceGroupId

                INNER JOIN dbo.PriceListItems pli
                    ON pli.PriceListId =
                        pl.PriceListId

                WHERE
                    c.CustomerId = @CustomerId

                    AND pli.ItemId = @ItemId

                    AND (
                        pli.ItemSpecId IS NULL
                        OR pli.ItemSpecId = @ItemSpecId
                    )

                    AND (
                        pli.UnitId IS NULL
                        OR pli.UnitId = @UnitId
                    )

                    AND @Quantity >=
                        ISNULL(pli.MinQuantity, 0)

                    AND (
                        pli.MaxQuantity IS NULL
                        OR @Quantity <= pli.MaxQuantity
                    )

                    AND (
                        pli.EffectiveFrom IS NULL
                        OR pli.EffectiveFrom <= @DocumentDate
                    )

                    AND (
                        pli.EffectiveTo IS NULL
                        OR pli.EffectiveTo >= @DocumentDate
                    )

                    AND pl.IsActive = 1

                ORDER BY
                    CASE
                        WHEN pli.ItemSpecId = @ItemSpecId THEN 0
                        WHEN pli.ItemSpecId IS NULL THEN 1
                        ELSE 2
                    END,
                    pl.Priority DESC,
                    pli.MinQuantity DESC,
                    pli.EffectiveFrom DESC
            `);

        const row = result?.recordset?.[0];

        if (!row) return null;

        return buildPricingResult(row);
    },

    async findPriceListPrice(context, tx) {
        // ราคาที่เก็บไว้ใน PriceListItems ถูกจัดเก็บเป็น UnitPrice หลังจากปรับตาม PricingMethod แล้ว
        const { itemId, itemSpecId, quantity, documentDate, unitId, priceListId } = context;

        const pool = tx ? null : await getMssqlPool('DEFAULT');
        const req = new sql.Request(tx || pool);

        req.input("ItemId", sql.Int, itemId);

        req.input("ItemSpecId", sql.Int, itemSpecId);

        req.input("Quantity", sql.Decimal(18, 4), quantity);

        req.input("DocumentDate", sql.Date, documentDate);

        req.input("UnitId", sql.Int, unitId);

        req.input("PriceListId", sql.Int, priceListId);

        const result = await req.query(`
                SELECT TOP 1

                    pli.PriceListItemId
                        AS pricingReferenceId,

                    pli.UnitPrice
                        AS unitPrice,

                    pli.UnitCost
                        AS unitCost,

                    pli.PricingMethod
                        AS pricingMethod,

                    CASE

                        WHEN pli.PricingMethod = 'MARKUP'
                            THEN pli.MarkupPercent

                        WHEN pli.PricingMethod = 'MARGIN'
                            THEN pli.MarginPercent

                        WHEN pli.PricingMethod = 'DISCOUNT_PERCENT'
                            THEN pli.DiscountPercent

                        WHEN pli.PricingMethod = 'DISCOUNT_AMOUNT'
                            THEN pli.DiscountAmount

                        ELSE 0

                    END
                        AS pricingValue,

                    'DEFAULT_PRICE_LIST'
                        AS pricingSource,

                    'PriceListItems'
                        AS pricingReferenceTable,

                    CAST(0 AS BIT)
                        AS stopProcessing

                FROM dbo.PriceListItems pli

                INNER JOIN dbo.PriceLists pl
                    ON pl.PriceListId =
                        pli.PriceListId

                WHERE
                    (
                        @PriceListId IS NOT NULL AND pli.PriceListId = @PriceListId
                        OR @PriceListId IS NULL AND pl.CustomerPriceGroupId IS NULL
                    )

                    AND pli.ItemId = @ItemId

                    AND (
                        pli.ItemSpecId IS NULL
                        OR pli.ItemSpecId = @ItemSpecId
                    )

                    AND (
                        pli.UnitId IS NULL
                        OR pli.UnitId = @UnitId
                    )

                    AND @Quantity >=
                        ISNULL(pli.MinQuantity, 0)

                    AND (
                        pli.MaxQuantity IS NULL
                        OR @Quantity <= pli.MaxQuantity
                    )

                    AND (
                        pli.EffectiveFrom IS NULL
                        OR pli.EffectiveFrom <= @DocumentDate
                    )

                    AND (
                        pli.EffectiveTo IS NULL
                        OR pli.EffectiveTo >= @DocumentDate
                    )

                    AND pl.IsActive = 1

                ORDER BY
                    CASE
                        WHEN pli.ItemSpecId = @ItemSpecId THEN 0
                        WHEN pli.ItemSpecId IS NULL THEN 1
                        ELSE 2
                    END,
                    pl.Priority DESC,
                    pli.MinQuantity DESC,
                    pli.EffectiveFrom DESC
                    
            `);

        const row = result?.recordset?.[0];

        if (!row) return null;

        return buildPricingResult(row);
    },

    async applyLineDiscounts(context, pricingResult, tx) {
        // STOP pricing pipeline
        if (pricingResult.stopProcessing) {
            return pricingResult;
        }

        // ส่วนลดระดับบรรทัดจะถูกคำนวณจากตาราง DiscountRules โดยจะพิจารณากฎส่วนลดที่มี ApplyLevel = 'LINE' และตรงกับเงื่อนไขต่างๆ
        // เช่น สินค้า, ลูกค้า, ปริมาณ, และช่วงเวลาที่มีผลบังคับใช้ ซึ่งถ้าพบกฎส่วนลดที่ตรงกัน จะนำมาปรับราคาต่อหน่วย (finalPrice)
        // ตามวิธีการที่กำหนดในกฎส่วนลดนั้นๆ เช่น ลดเป็นเปอร์เซ็นต์ หรือ ลดเป็นจำนวนเงิน 
        // และจะเก็บรายละเอียดของการปรับราคาในแต่ละขั้นตอนลงใน adjustments
        // เพื่อให้สามารถตรวจสอบย้อนหลังได้ว่าราคาถูกปรับด้วยกฎส่วนลดอะไรบ้าง และสุดท้ายถ้ามีกฎส่วนลดที่มี StopProcessing = true
        // จะหยุดการคำนวณราคาเพิ่มเติมหลังจากนั้นทันที

        // แต่ยังยังไม่มี login volume discount และ promotion ต่างๆ ที่จะตามมาในอนาคต ซึ่งจะต้องมีการปรับปรุงฟังก์ชันนี้ให้รองรับการคำนวณส่วนลดและโปรโมชั่นในระดับบรรทัดเพิ่มเติมจากกฎส่วนลดที่เก็บในตาราง DiscountRules ด้วย
        const { customerId, itemId, quantity, documentDate } = context;

        const pool = tx ? null : await getMssqlPool('DEFAULT');
        const req = new sql.Request(tx || pool);

        req.input("CustomerId", sql.Int, customerId);

        req.input("ItemId", sql.Int, itemId);

        req.input("Quantity", sql.Decimal(18, 4), quantity);

        req.input("DocumentDate", sql.Date, documentDate);

        const result = await req.query(`
            SELECT TOP 1

                dr.DiscountRuleId,

                dr.DiscountPercent,

                dr.DiscountAmount,

                dr.CanCombine,

                dr.StopProcessing,

                dr.Priority,

                dr.Description

            FROM dbo.DiscountRules dr

            WHERE

                dr.ApplyLevel = 'LINE'

                AND dr.IsActive = 1

                AND (
                    dr.ItemId IS NULL
                    OR dr.ItemId = @ItemId
                )

                AND (
                    dr.CustomerId IS NULL
                    OR dr.CustomerId = @CustomerId
                )

                AND @Quantity >=
                    ISNULL(dr.MinOrderAmount, 0)

                AND (
                    dr.MaxOrderAmount IS NULL
                    OR @Quantity <= dr.MaxOrderAmount
                )

                AND (
                    dr.EffectiveFrom IS NULL
                    OR dr.EffectiveFrom <= @DocumentDate
                )

                AND (
                    dr.EffectiveTo IS NULL
                    OR dr.EffectiveTo >= @DocumentDate
                )

            ORDER BY
                dr.Priority DESC,
                dr.MinOrderAmount DESC,
                dr.EffectiveFrom DESC
        `);

        const rule = result?.recordset?.[0];

        // no discount
        if (!rule) {
            return pricingResult;
        }

        const beforeAmount = Number(pricingResult.finalPrice || 0);

        let adjustmentAmount = 0;

        // percent discount
        if (rule.DiscountPercent && Number(rule.DiscountPercent) > 0) {
            adjustmentAmount =
                beforeAmount * (Number(rule.DiscountPercent) / 100);

            pricingResult.discountPercent = Number(rule.DiscountPercent);
        }

        // amount discount
        else if (rule.DiscountAmount && Number(rule.DiscountAmount) > 0) {
            adjustmentAmount = Number(rule.DiscountAmount);
        }

        const afterAmount = beforeAmount - adjustmentAmount;

        pricingResult.finalPrice = Number(afterAmount.toFixed(4));

        pricingResult.discountAmount = Number(adjustmentAmount.toFixed(4));

        pricingResult.stopProcessing = rule.StopProcessing ?? false;

        // pricing trace
        pricingResult.adjustments.push({
            stage: "LINE_DISCOUNT",

            pricingSource: "DISCOUNT_RULE",

            pricingReferenceTable: "DiscountRules",

            pricingReferenceId: rule.DiscountRuleId,

            beforeAmount: Number(beforeAmount.toFixed(4)),

            adjustmentAmount: Number((-adjustmentAmount).toFixed(4)),

            afterAmount: Number(afterAmount.toFixed(4)),

            description: rule.Description || "Line Discount",
        });

        return pricingResult;
    },
    async writePricingLogs(salesOrderId, salesOrderLineId, pricingResult, tx) {
        const adjustments = [
            // BASE PRICE LOG
            {
                stage: "BASE_PRICE",

                pricingSource: pricingResult.pricingSource,

                pricingReferenceTable: pricingResult.pricingReferenceTable,

                pricingReferenceId: pricingResult.pricingReferenceId,

                beforeAmount: 0,

                adjustmentAmount: pricingResult.basePrice,

                afterAmount: pricingResult.basePrice,

                description: "Base Price Resolution",
            },

            // DISCOUNT LOGS
            ...pricingResult.adjustments,
        ];

        const pool = tx ? null : await getMssqlPool('DEFAULT');

        for (const adjustment of adjustments) {
            const req = new sql.Request(tx || pool);

            req.input("SalesOrderId", sql.Int, salesOrderId);

            req.input("SalesOrderLineId", sql.Int, salesOrderLineId);

            req.input(
                "PricingSourceCode",
                sql.NVarChar(40),
                adjustment.pricingSource,
            );

            req.input(
                "PricingReferenceTable",
                sql.NVarChar(100),
                adjustment.pricingReferenceTable,
            );

            req.input(
                "PricingReferenceId",
                sql.Int,
                adjustment.pricingReferenceId,
            );

            req.input(
                "BaseAmount",
                sql.Decimal(18, 4),
                adjustment.beforeAmount,
            );

            req.input(
                "AdjustmentAmount",
                sql.Decimal(18, 4),
                adjustment.adjustmentAmount,
            );

            req.input(
                "ResultAmount",
                sql.Decimal(18, 4),
                adjustment.afterAmount,
            );

            req.input("Description", sql.NVarChar(500), adjustment.description);

            await req.query(`
            INSERT INTO dbo.SalesOrderPricingLogs
            (
                SalesOrderId,
                SalesOrderLineId,

                PricingSourceCode,

                PricingReferenceTable,
                PricingReferenceId,

                BaseAmount,
                AdjustmentAmount,
                ResultAmount,

                Description
            )
            VALUES
            (
                @SalesOrderId,
                @SalesOrderLineId,

                @PricingSourceCode,

                @PricingReferenceTable,
                @PricingReferenceId,

                @BaseAmount,
                @AdjustmentAmount,
                @ResultAmount,

                @Description
            )
        `);
        }
    },
};
