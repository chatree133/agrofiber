import React, { useEffect, useState } from "react";
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space, Table, Typography, message, Checkbox } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { useGoodsReceipt } from "../../context/GoodsReceiptContext.jsx";
import { useWarehouse } from "../../context/WarehouseContext.jsx";
import { useCustomer } from "../../context/CustomerContext.jsx";
import { useCompany } from "../../context/CompanyContext.jsx";
import { useItem } from "../../context/ItemContext.jsx";
import { useWms } from "../../context/WmsContext.jsx";
import { usePurchaseOrder } from "../../context/PurchaseOrderContext.jsx";
import { useVendor } from "../../context/VendorContext.jsx";
import { useMasterData } from "../../context/MasterDataContext.jsx";

const { Title, Paragraph } = Typography;

export default function GoodsReceiptForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const [form] = Form.useForm();
    const { lookups, fetchLookups } = useMasterData();

    // Context hooks
    const { getGoodsReceipt, createGoodsReceipt, updateGoodsReceipt, getGoodsReceiptTypes } = useGoodsReceipt();
    const { getWarehouses } = useWarehouse();
    const { getCustomers } = useCustomer();
    const { getBranches } = useCompany();
    const { searchSkus } = useItem();
    const { getWarehouseLocations } = useWms();
    const { getPurchaseOrders } = usePurchaseOrder();
    const { getVendors } = useVendor();

    // Data lists
    const [grTypes, setGrTypes] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [pos, setPos] = useState([]);
    const [locations, setLocations] = useState([]); // Locations for selected warehouse
    const [selectedType, setSelectedType] = useState(null);

    // Sku autocomplete states
    const [skuSearchVal, setSkuSearchVal] = useState("");
    const [skuItemsMap, setSkuItemsMap] = useState({});

    // Page states
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lineItems, setLineItems] = useState([
        { key: 1, itemId: null, itemSpecId: null, sku: "", name: "", unitId: null, receivedQuantity: 100, unitCostSnapshot: 0, locationId: null, lotNo: "", generatePallet: true, remark: "" }
    ]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await fetchLookups();

            const [typesData, whData, vendorData, branchData, posData] = await Promise.all([
                getGoodsReceiptTypes(),
                getWarehouses(),
                getVendors(),
                getBranches(1),
                getPurchaseOrders(),
            ]);

            setGrTypes(typesData || []);
            setWarehouses(whData || []);
            setVendors(vendorData || []);
            setBranches(branchData || []);
            setPos(posData || []);

            if (isEdit) {
                const gr = await getGoodsReceipt(id);

                // Set form values
                form.setFieldsValue({
                    branchId: gr.branchId,
                    goodsReceiptTypeId: gr.goodsReceiptTypeId,
                    warehouseId: gr.warehouseId,
                    vendorId: gr.vendorId,
                    customerId: gr.customerId,
                    purchaseOrderId: gr.purchaseOrderId,
                    receiptDate: gr.receiptDate ? dayjs(gr.receiptDate) : dayjs(),
                    remark: gr.remark,
                });

                // Find type details
                const foundType = typesData.find(t => t.goodsReceiptTypeId === gr.goodsReceiptTypeId);
                setSelectedType(foundType);

                // Fetch locations for that warehouse
                if (gr.warehouseId) {
                    const locRes = await getWarehouseLocations(gr.warehouseId);
                    setLocations(locRes || []);
                }

                // Pre-populate customer option if it exists
                if (gr.customerId) {
                    setCustomers([{
                        id: gr.customerId,
                        code: gr.customerCode || "",
                        name: gr.customerName || "",
                    }]);
                }

                // Map lines
                const initialSkuMap = {};
                const mappedLines = (gr.lines || []).map((l, index) => {
                    const key = index + 1;
                    const skuVal = l.specCode || l.itemCode || "";
                    const displayName = l.specName ? `${l.itemName} - ${l.specName}` : (l.itemName || "");

                    initialSkuMap[key] = [{
                        itemId: l.itemId,
                        itemSpecId: l.itemSpecId,
                        salesSku: skuVal,
                        itemCode: l.itemCode,
                        displayName: displayName,
                        unitId: l.unitId,
                    }];

                    return {
                        key,
                        itemId: l.itemId,
                        itemSpecId: l.itemSpecId,
                        sku: skuVal,
                        name: displayName,
                        unitId: l.unitId,
                        receivedQuantity: l.receivedQuantity,
                        unitCostSnapshot: l.unitCostSnapshot || 0,
                        locationId: l.locationId,
                        lotNo: l.lotNo || "",
                        generatePallet: l.palletNo ? false : true,
                        remark: l.remark || "",
                    };
                });
                setSkuItemsMap(initialSkuMap);
                setLineItems(mappedLines.length ? mappedLines : [{ key: 1, itemId: null, itemSpecId: null, sku: "", name: "", unitId: null, receivedQuantity: 100, unitCostSnapshot: 0, locationId: null, lotNo: "", generatePallet: true, remark: "" }]);
            } else {
                form.setFieldsValue({
                    receiptDate: dayjs(),
                });
            }
        } catch (err) {
            message.error("โหลดข้อมูลล้มเหลว: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleWarehouseChange = async (whId) => {
        setLocations([]);
        if (whId) {
            try {
                const locRes = await getWarehouseLocations(whId);
                setLocations(locRes || []);
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleTypeChange = (typeId) => {
        const type = grTypes.find(t => t.goodsReceiptTypeId === typeId);
        setSelectedType(type);
        if (type && !type.requiresVendor) {
            form.setFieldValue("vendorId", null);
        }
    };

    const handleCustomerSearch = async (value) => {
        if (!value || value.trim().length < 2) {
            setCustomers([]);
            return;
        }
        try {
            const res = await getCustomers({ search: value, page: 1, pageSize: 20 });
            setCustomers(res.data || []);
        } catch (err) {
            console.error("Error fetching customers:", err);
        }
    };

    const handleSkuSearch = async (val, key) => {
        setSkuSearchVal(val);
        if (!val || val.trim().length < 2) return;
        try {
            const res = await searchSkus(val);
            const itemsList = res || [];
            setSkuItemsMap(prev => ({
                ...prev,
                [key]: itemsList
            }));
        } catch (err) {
            console.error("Sku search error", err);
        }
    };

    const handleSkuSelect = (skuVal, key) => {
        const list = skuItemsMap[key] || [];
        const matched = list.find(x => x.salesSku === skuVal || x.itemCode === skuVal);
        if (!matched) return;

        const matchedSku = matched.salesSku || matched.itemCode;
        const existingLine = lineItems.find(line => line.key !== key && line.sku === matchedSku);
        if (existingLine) {
            message.warning(`สินค้า ${matchedSku} มีอยู่ในรายการแล้ว`);
        }

        const updated = lineItems.map(line => {
            if (line.key === key) {
                return {
                    ...line,
                    itemId: matched.itemId,
                    itemSpecId: matched.itemSpecId || null,
                    sku: matchedSku,
                    name: matched.displayName,
                    unitId: matched.unitId,
                };
            }
            return line;
        });
        setLineItems(updated);
    };

    const handleLineFieldChange = (val, field, index) => {
        const updated = [...lineItems];
        updated[index][field] = val;
        setLineItems(updated);
    };

    const addLine = () => {
        const newKey = lineItems.length ? Math.max(...lineItems.map(l => l.key)) + 1 : 1;
        setLineItems([
            ...lineItems,
            { key: newKey, itemId: null, itemSpecId: null, sku: "", name: "", unitId: null, receivedQuantity: 100, unitCostSnapshot: 0, locationId: null, lotNo: "", generatePallet: true, remark: "" }
        ]);
    };

    const deleteLine = (index) => {
        if (lineItems.length === 1) {
            message.warning("ต้องมีรายการสินค้าอย่างน้อย 1 รายการ");
            return;
        }
        const updated = lineItems.filter((_, idx) => idx !== index);
        setLineItems(updated);
    };

    const handleSave = async (status = "draft") => {
        try {
            const values = await form.validateFields();

            // Validate lines
            const invalidLine = lineItems.find(l => !l.itemId || !l.unitId || !l.receivedQuantity || !l.lotNo || !l.lotNo.trim());
            if (invalidLine) {
                message.error("กรุณากรอกข้อมูลสินค้า หน่วย จำนวน และล๊อตสินค้าให้ครบถ้วนในทุกบรรทัด");
                return;
            }

            setSubmitting(true);

            // Get selected warehouse ID
            const whId = values.warehouseId;

            const payload = {
                branchId: values.branchId,
                goodsReceiptTypeId: values.goodsReceiptTypeId,
                warehouseId: whId,
                vendorId: values.vendorId || null,
                customerId: values.customerId || null,
                purchaseOrderId: values.purchaseOrderId || null,
                receiptDate: values.receiptDate.format("YYYY-MM-DD"),
                remark: values.remark || null,
                status,
                lines: lineItems.map(l => ({
                    itemId: l.itemId,
                    itemSpecId: l.itemSpecId,
                    unitId: l.unitId,
                    receivedQuantity: l.receivedQuantity,
                    unitCostSnapshot: l.unitCostSnapshot || 0,
                    warehouseId: whId, // pass header warehouse to each line as required
                    locationId: l.locationId,
                    lotNo: l.lotNo || null,
                    generatePallet: l.generatePallet !== false,
                    remark: l.remark || null,
                }))
            };

            if (isEdit) {
                await updateGoodsReceipt(id, payload);
                message.success("แก้ไขใบรับสินค้าสำเร็จ");
            } else {
                await createGoodsReceipt(payload);
                message.success("สร้างใบรับสินค้าสำเร็จ");
            }
            navigate("/inventory/goods-receipts");
        } catch (err) {
            if (err.errorFields) {
                message.error("กรุณากรอกข้อมูลในฟอร์มให้ถูกต้อง");
            } else {
                message.error("บันทึกล้มเหลว: " + err.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            title: "#",
            key: "index",
            width: "50px",
            render: (_, __, idx) => idx + 1,
        },
        {
            title: "รหัสสินค้า (SKU)",
            key: "sku",
            width: "20%",
            render: (record, _, idx) => (
                <Select
                    size="small"
                    showSearch
                    allowClear
                    filterOption={false}
                    value={record.sku || undefined}
                    onSearch={(val) => handleSkuSearch(val, record.key)}
                    onChange={(val) => {
                        if (!val) {
                            const updated = [...lineItems];
                            updated[idx].itemId = null;
                            updated[idx].itemSpecId = null;
                            updated[idx].sku = "";
                            updated[idx].name = "";
                            updated[idx].unitId = null;
                            setLineItems(updated);
                        }
                    }}
                    onSelect={(val) => handleSkuSelect(val, record.key)}
                    placeholder="ค้นหาด้วยรหัสสินค้า (SKU)..."
                    style={{ width: "100%" }}
                    optionLabelProp="value"
                >
                    {(skuItemsMap[record.key] || []).map((item) => (
                        <Select.Option key={item.salesSku || item.itemCode} value={item.salesSku || item.itemCode}>
                            <Typography.Text strong>{item.salesSku || item.itemCode}</Typography.Text> - {item.displayName}
                        </Select.Option>
                    ))}
                </Select>
            ),
        },
        {
            title: "ชื่อสินค้า",
            key: "name",
            width: "23%",
            render: (record) => (
                <Typography.Text strong style={{ color: "#1a3353" }}>
                    {record.name || "-"}
                </Typography.Text>
            ),
        },
        {
            title: "หน่วย (Unit)",
            key: "unitId",
            width: "10%",
            render: (record, _, idx) => (
                <Select
                    size="small"
                    placeholder="หน่วย"
                    style={{ width: "100%" }}
                    value={record.unitId || undefined}
                    onChange={(val) => handleLineFieldChange(val, "unitId", idx)}
                >
                    {(lookups.units || []).map((u) => (
                        <Select.Option key={u.value} value={u.value}>
                            {u.label}
                        </Select.Option>
                    ))}
                </Select>
            ),
        },
        {
            title: "จำนวนรับ",
            key: "receivedQuantity",
            width: "8%",
            render: (record, _, idx) => (
                <InputNumber
                    size="small"
                    min={0.0001}
                    style={{ width: "100%" }}
                    value={record.receivedQuantity}
                    onChange={(val) => handleLineFieldChange(val, "receivedQuantity", idx)}
                />
            ),
        },
        {
            title: "ต้นทุน ฿/หน่วย",
            key: "unitCostSnapshot",
            width: "10%",
            render: (record, _, idx) => (
                <InputNumber
                    size="small"
                    min={0}
                    style={{ width: "100%" }}
                    value={record.unitCostSnapshot}
                    onChange={(val) => handleLineFieldChange(val, "unitCostSnapshot", idx)}
                />
            ),
        },
        {
            title: "ตำแหน่งจัดเก็บ",
            key: "locationId",
            width: "12%",
            render: (record, _, idx) => (
                <Select
                    size="small"
                    placeholder="ไม่ระบุ"
                    style={{ width: "100%" }}
                    value={record.locationId}
                    onChange={(val) => handleLineFieldChange(val, "locationId", idx)}
                    allowClear
                >
                    {locations.map((loc) => (
                        <Select.Option key={loc.value} value={loc.value}>
                            {loc.label}
                        </Select.Option>
                    ))}
                </Select>
            ),
        },
        {
            title: (
                <span>
                    <span style={{ color: '#ff4d4f', marginRight: '4px' }}>*</span>
                    Lot No.
                </span>
            ),
            key: "lotNo",
            width: "8%",
            render: (record, _, idx) => (
                <Input
                    size="small"
                    placeholder="ระบุล็อตสินค้า"
                    value={record.lotNo}
                    onChange={(e) => handleLineFieldChange(e.target.value, "lotNo", idx)}
                />
            ),
        },
        {
            title: "เจนพาเลท",
            key: "generatePallet",
            width: "8%",
            align: "center",
            render: (record, _, idx) => (
                <Checkbox
                    checked={record.generatePallet !== false}
                    onChange={(e) => handleLineFieldChange(e.target.checked, "generatePallet", idx)}
                />
            ),
        },
        {
            title: "ลบ",
            key: "delete",
            width: "40px",
            render: (_, __, idx) => (
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => deleteLine(idx)} />
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory/goods-receipts")} style={{ marginRight: "12px" }} />
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        {isEdit ? "แก้ไขใบรับสินค้า" : "สร้างใบรับสินค้า (Goods Receipt)"}
                    </h1>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {isEdit ? "แก้ไขข้อมูลใบรับสินค้าแบบ Draft" : "บันทึกข้อมูลและเพิ่มรายการคีย์มือรับสินค้าเข้าคลัง"}
                    </Paragraph>
                </div>
            </div>

            <Form form={form} layout="vertical">
                <Row gutter={24}>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="branchId"
                            label="สาขา"
                            rules={[{ required: true, message: "กรุณาเลือกสาขา" }]}
                        >
                            <Select placeholder="เลือกสาขา">
                                {branches.map((b) => (
                                    <Select.Option key={b.branchId} value={b.branchId}>
                                        {b.branchName}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="goodsReceiptTypeId"
                            label="ประเภทธุรกรรม/วัตถุประสงค์การรับ"
                            rules={[{ required: true, message: "กรุณาเลือกประเภทการรับ" }]}
                        >
                            <Select placeholder="เลือกวัตถุประสงค์" onChange={handleTypeChange}>
                                {grTypes.filter(t => t.isActive).map((t) => (
                                    <Select.Option key={t.goodsReceiptTypeId} value={t.goodsReceiptTypeId}>
                                        {t.goodsReceiptTypeName}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="warehouseId"
                            label="คลังสินค้าจัดเก็บ"
                            rules={[{ required: true, message: "กรุณาเลือกคลังสินค้า" }]}
                        >
                            <Select placeholder="เลือกคลังสินค้า" onChange={handleWarehouseChange}>
                                {warehouses.filter(w => w.IsActive).map((w) => (
                                    <Select.Option key={w.WarehouseId} value={w.WarehouseId}>
                                        {w.WarehouseName}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="vendorId"
                            label="ผู้จัดจำหน่าย (Vendor)"
                            rules={[{ required: selectedType?.requiresVendor, message: "กรุณาเลือกผู้จัดจำหน่าย" }]}
                        >
                            <Select
                                showSearch
                                placeholder={selectedType?.requiresVendor ? "เลือกผู้จัดจำหน่าย (จำเป็นสำหรับธุรกรรมนี้)" : "เลือกผู้จัดจำหน่าย (ตัวเลือก)"}
                                optionFilterProp="children"
                                filterOption={(input, option) => {
                                    const label = Array.isArray(option?.children)
                                        ? option.children.join("")
                                        : (option?.children || "");
                                    return label.toLowerCase().includes(input.toLowerCase());
                                }}
                                allowClear
                            >
                                {vendors.map((v) => (
                                    <Select.Option key={v.id} value={v.id}>
                                        {`[${v.code}] ${v.name}`}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="customerId"
                            label="ลูกค้า (Customer)"
                        >
                            <Select
                                showSearch
                                filterOption={false}
                                onSearch={handleCustomerSearch}
                                optionLabelProp="label"
                                placeholder="พิมพ์เพื่อค้นหาลูกค้า (ตัวเลือก)"
                                allowClear
                            >
                                {customers.map((c) => (
                                    <Select.Option key={c.id} value={c.id} label={`[${c.code}] ${c.name}`}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span><strong>{c.code}</strong> - {c.name}</span>
                                            <span style={{ color: '#bfbfbf', fontSize: '12px' }}>{c.taxId || 'ไม่มีTaxId'}</span>
                                        </div>
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="purchaseOrderId"
                            label="ใบสั่งซื้อสินค้า (PO)"
                        >
                            <Select
                                placeholder="เลือกใบสั่งซื้อ (ตัวเลือก)"
                                allowClear
                            >
                                {pos.map((p) => (
                                    <Select.Option key={p.id} value={p.id}>
                                        {p.documentNo}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="receiptDate"
                            label="วันที่รับสินค้า"
                            rules={[{ required: true, message: "กรุณาระบุวันที่รับสินค้า" }]}
                        >
                            <DatePicker style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="remark" label="คำชี้แจง / รายละเอียดเพิ่มเติม">
                    <Input.TextArea placeholder="ระบุเหตุผลในการรับเข้าคลัง เช่น รับจากการเคลมของลูกค้า รับตัวอย่างวัตถุดิบ..." rows={2} />
                </Form.Item>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", marginBottom: "12px" }}>
                    <Title level={4} style={{ marginBottom: 0 }}>
                        รายการสินค้าจัดเก็บเข้าคลัง
                    </Title>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={addLine}>
                        เพิ่มรายการสินค้า
                    </Button>
                </div>

                <Table
                    size="small"
                    columns={columns}
                    dataSource={lineItems}
                    pagination={false}
                    rowKey="key"
                    bordered
                    style={{ marginBottom: "24px" }}
                />

                <div className="flex justify-end gap-3" style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                    <Button onClick={() => navigate("/inventory/goods-receipts")}>
                        ยกเลิก
                    </Button>
                    <Button
                        type="primary"
                        loading={submitting}
                        onClick={() => handleSave("draft")}
                    >
                        บันทึกแบบร่าง (Draft)
                    </Button>
                    <Button
                        type="primary"
                        ghost
                        loading={submitting}
                        onClick={() => handleSave("received")}
                    >
                        ยืนยันการรับสินค้า (Received)
                    </Button>
                </div>
            </Form>
        </div>
    );
}
