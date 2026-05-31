import re

def patch_file(filepath, header_table, line_table, alias):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. map Header
    content = re.sub(
        r"(status: row\.Status,)",
        r"\1\n    customerPoNo: row.CustomerPoNo,\n    customerPoDate: row.CustomerPoDate,\n    salesPersonId: row.SalesPersonId,\n    paymentTermId: row.PaymentTermId,\n    priceListId: row.PriceListId,\n    warehouseId: row.WarehouseId,\n    taxType: row.TaxType,\n    remarks: row.Remarks,",
        content
    )

    # 2. get Header query
    content = re.sub(
        rf"({alias}\.Status,)",
        rf"\1\n      {alias}.CustomerPoNo,\n      {alias}.CustomerPoDate,\n      {alias}.SalesPersonId,\n      {alias}.PaymentTermId,\n      {alias}.PriceListId,\n      {alias}.WarehouseId,\n      {alias}.TaxType,\n      {alias}.Remarks,",
        content
    )

    # 3. POST inputs
    content = re.sub(
        r"(const currencyCode = [^\n]*\n)",
        r"\1    const customerPoNo = req.body.customerPoNo ? String(req.body.customerPoNo).trim() : null;\n    const customerPoDate = parseOptionalDate(req.body.customerPoDate, 'customerPoDate');\n    const salesPersonId = parseOptionalId(req.body.salesPersonId, 'salesPersonId');\n    const paymentTermId = parseOptionalId(req.body.paymentTermId, 'paymentTermId');\n    const priceListId = parseOptionalId(req.body.priceListId, 'priceListId');\n    const warehouseId = parseOptionalId(req.body.warehouseId, 'warehouseId');\n    const taxType = normalizeEnum(req.body.taxType, ['exclusive', 'inclusive', 'no_vat'], 'taxType') || 'exclusive';\n    const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;\n",
        content,
        count=1
    )

    # 4. POST headerReq
    content = re.sub(
        r"(headerReq\.input\('currencyCode', sql\.Char\(3\), currencyCode\);)",
        r"\1\n        headerReq.input('customerPoNo', sql.NVarChar(100), customerPoNo);\n        headerReq.input('customerPoDate', sql.Date, customerPoDate);\n        headerReq.input('salesPersonId', sql.Int, salesPersonId);\n        headerReq.input('paymentTermId', sql.Int, paymentTermId);\n        headerReq.input('priceListId', sql.Int, priceListId);\n        headerReq.input('warehouseId', sql.Int, warehouseId);\n        headerReq.input('taxType', sql.NVarChar(20), taxType);\n        headerReq.input('remarks', sql.NVarChar(sql.MAX), remarks);",
        content
    )

    # 5. POST INSERT
    content = re.sub(
        r"(CurrencyCode, SubTotalAmount)",
        r"CustomerPoNo, CustomerPoDate, SalesPersonId, PaymentTermId, PriceListId, WarehouseId, TaxType, Remarks, CurrencyCode, SubTotalAmount",
        content
    )

    # 6. POST VALUES
    content = re.sub(
        r"(@currencyCode, @subTotalAmount)",
        r"@customerPoNo, @customerPoDate, @salesPersonId, @paymentTermId, @priceListId, @warehouseId, @taxType, @remarks, @currencyCode, @subTotalAmount",
        content
    )

    # 7. PUT inputs
    content = re.sub(
        r"(const currencyCode = req\.body\.currencyCode === undefined [^\n]*\n)",
        r"\1    const customerPoNo = req.body.customerPoNo === undefined ? null : (req.body.customerPoNo ? String(req.body.customerPoNo).trim() : null);\n    const customerPoDate = req.body.customerPoDate === undefined ? null : parseOptionalDate(req.body.customerPoDate, 'customerPoDate');\n    const salesPersonId = req.body.salesPersonId === undefined ? null : parseOptionalId(req.body.salesPersonId, 'salesPersonId');\n    const paymentTermId = req.body.paymentTermId === undefined ? null : parseOptionalId(req.body.paymentTermId, 'paymentTermId');\n    const priceListId = req.body.priceListId === undefined ? null : parseOptionalId(req.body.priceListId, 'priceListId');\n    const warehouseId = req.body.warehouseId === undefined ? null : parseOptionalId(req.body.warehouseId, 'warehouseId');\n    const taxType = req.body.taxType === undefined ? null : normalizeEnum(req.body.taxType, ['exclusive', 'inclusive', 'no_vat'], 'taxType');\n    const remarks = req.body.remarks === undefined ? null : (req.body.remarks ? String(req.body.remarks).trim() : null);\n",
        content,
        count=1
    )

    # 8. PUT UPDATE SET
    content = re.sub(
        r"(CurrencyCode = COALESCE\(@currencyCode, CurrencyCode\),)",
        r"CustomerPoNo = COALESCE(@customerPoNo, CustomerPoNo),\n        CustomerPoDate = COALESCE(@customerPoDate, CustomerPoDate),\n        SalesPersonId = COALESCE(@salesPersonId, SalesPersonId),\n        PaymentTermId = COALESCE(@paymentTermId, PaymentTermId),\n        PriceListId = COALESCE(@priceListId, PriceListId),\n        WarehouseId = COALESCE(@warehouseId, WarehouseId),\n        TaxType = COALESCE(@taxType, TaxType),\n        Remarks = COALESCE(@remarks, Remarks),\n        \1",
        content
    )

    # 9. PUT query inputs
    content = re.sub(
        r"(currencyCode: \{ type: sql\.Char\(3\), value: currencyCode \},)",
        r"\1\n        customerPoNo: { type: sql.NVarChar(100), value: customerPoNo },\n        customerPoDate: { type: sql.Date, value: customerPoDate },\n        salesPersonId: { type: sql.Int, value: salesPersonId },\n        paymentTermId: { type: sql.Int, value: paymentTermId },\n        priceListId: { type: sql.Int, value: priceListId },\n        warehouseId: { type: sql.Int, value: warehouseId },\n        taxType: { type: sql.NVarChar(20), value: taxType },\n        remarks: { type: sql.NVarChar(sql.MAX), value: remarks },",
        content
    )

    # LINE ITEMS
    # 1. map Line
    content = re.sub(
        r"(taxAmount: row\.TaxAmount,)",
        r"taxCodeId: row.TaxCodeId,\n    \1",
        content
    )

    # 2. get Line query
    content = re.sub(
        r"(sol\.TaxAmount,|ql\.TaxAmount,|sil\.TaxAmount,)",
        r"sol.TaxCodeId,\n      ql.TaxCodeId,\n      sil.TaxCodeId,\n      \1", # Handle aliasing cleanly
        content
    )
    # Cleanup get line query
    content = content.replace("sol.TaxCodeId,\n      ql.TaxCodeId,\n      sil.TaxCodeId,\n      sol.TaxAmount,", "sol.TaxCodeId,\n      sol.TaxAmount,")
    content = content.replace("sol.TaxCodeId,\n      ql.TaxCodeId,\n      sil.TaxCodeId,\n      ql.TaxAmount,", "ql.TaxCodeId,\n      ql.TaxAmount,")
    content = content.replace("sol.TaxCodeId,\n      ql.TaxCodeId,\n      sil.TaxCodeId,\n      sil.TaxAmount,", "sil.TaxCodeId,\n      sil.TaxAmount,")

    # 3. buildLineSnapshots
    content = re.sub(
        r"(taxAmount: parseOptionalNumber\(raw\.taxAmount, `lines\[\$\{idx\}\]\.taxAmount`\) \?\? 0,)",
        r"taxCodeId: parseOptionalId(raw.taxCodeId, `lines[${idx}].taxCodeId`),\n      \1",
        content
    )

    # 4. POST lineReq
    content = re.sub(
        r"(lineReq\.input\('taxAmount', sql\.Decimal\(18, 4\), line\.taxAmount\);)",
        r"lineReq.input('taxCodeId', sql.Int, line.taxCodeId);\n          \1",
        content
    )

    # 5. POST line INSERT
    content = re.sub(
        r"(LineAmount, TaxAmount, UnitId)",
        r"LineAmount, TaxCodeId, TaxAmount, UnitId",
        content
    )

    # 6. POST line VALUES
    content = re.sub(
        r"(@lineAmount, @taxAmount, @unitId)",
        r"@lineAmount, @taxCodeId, @taxAmount, @unitId",
        content
    )

    with open(filepath, 'w') as f:
        f.write(content)

patch_file('backend/src/routes/saleOrder.js', 'SalesOrders', 'SalesOrderLines', 'so')
patch_file('backend/src/routes/quotation.js', 'Quotations', 'QuotationLines', 'q')
patch_file('backend/src/routes/salesInvoice.js', 'SalesInvoices', 'SalesInvoiceLines', 'inv')
