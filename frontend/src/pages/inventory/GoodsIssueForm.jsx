import React, { useEffect, useState } from "react";
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space, Table, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { useGoodsIssue } from "../../context/GoodsIssueContext.jsx";
import { useWarehouse } from "../../context/WarehouseContext.jsx";
import { useCustomer } from "../../context/CustomerContext.jsx";
import { useCompany } from "../../context/CompanyContext.jsx";
import { useItem } from "../../context/ItemContext.jsx";
import { useWms } from "../../context/WmsContext.jsx";
import { useMasterData } from "../../context/MasterDataContext.jsx";

const { Title, Paragraph } = Typography;

export default function GoodsIssueForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const [form] = Form.useForm();
    const { lookups, fetchLookups } = useMasterData();

    // Context hooks
    const { getGoodsIssue, createGoodsIssue, updateGoodsIssue, getGoodsIssueTypes } = useGoodsIssue();
    const { getWarehouses } = useWarehouse();
    const { getCustomers } = useCustomer();
    const { getBranches } = useCompany();
    const { searchSkus } = useItem();
    const { getWarehouseLocations } = useWms();

    // Data lists
    const [giTypes, setGiTypes] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [locations, setLocations] = useState([]); // Locations for selected warehouse
    const [selectedType, setSelectedType] = useState(null);

    // Sku autocomplete states
    const [skuSearchVal, setSkuSearchVal] = useState("");
    const [skuItemsMap, setSkuItemsMap] = useState({});

    // Page states
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lineItems, setLineItems] = useState([
        { key: 1, itemId: null, itemSpecId: null, sku: "", name: "", unitId: null, requestedQuantity: 1, locationId: null, lotNo: "", remark: "" }
    ]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await fetchLookups();

            const [typesData, whData, branchData] = await Promise.all([
                getGoodsIssueTypes(),
                getWarehouses(),
                getBranches(1),
            ]);

            setGiTypes(typesData || []);
            setWarehouses(whData || []);
            setBranches(branchData || []);

            if (isEdit) {
                const gi = await getGoodsIssue(id);

                // Set form values
                form.setFieldsValue({
                    branchId: gi.branchId,
                    goodsIssueTypeId: gi.goodsIssueTypeId,
                    warehouseId: gi.warehouseId,
                    customerId: gi.customerId,
                    requestDate: gi.requestDate ? dayjs(gi.requestDate) : dayjs(),
                    remark: gi.remark,
                });

                // Find type details
                const foundType = typesData.find(t => t.goodsIssueTypeId === gi.goodsIssueTypeId);
                setSelectedType(foundType);

                // Fetch locations for that warehouse
                if (gi.warehouseId) {
                    const locRes = await getWarehouseLocations(gi.warehouseId);
                    setLocations(locRes || []);
                }

                // Pre-populate customer option if it exists
                if (gi.customerId) {
                    setCustomers([{
                        id: gi.customerId,
                        code: gi.customerCode || "",
                        name: gi.customerName || "",
                    }]);
                }

                // Map lines
                const initialSkuMap = {};
                const mappedLines = (gi.lines || []).map((l, index) => {
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
                        requestedQuantity: l.requestedQuantity,
                        locationId: l.locationId,
                        lotNo: l.lotNo || "",
                        remark: l.remark || "",
                    };
                });
                setSkuItemsMap(initialSkuMap);
                setLineItems(mappedLines.length ? mappedLines : [{ key: 1, itemId: null, itemSpecId: null, sku: "", name: "", unitId: null, requestedQuantity: 1, locationId: null, lotNo: "", remark: "" }]);
            } else {
                form.setFieldsValue({
                    requestDate: dayjs(),
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
        const type = giTypes.find(t => t.goodsIssueTypeId === typeId);
        setSelectedType(type);
        if (type && !type.requiresCustomer) {
            form.setFieldValue("customerId", null);
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
            { key: newKey, itemId: null, itemSpecId: null, sku: "", name: "", unitId: null, requestedQuantity: 1, locationId: null, lotNo: "", remark: "" }
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
            const invalidLine = lineItems.find(l => !l.itemId || !l.unitId || !l.requestedQuantity);
            if (invalidLine) {
                message.error("กรุณากรอกข้อมูลสินค้า หน่วย และจำนวนให้ครบถ้วนในทุกบรรทัด");
                return;
            }

            setSubmitting(true);

            const payload = {
                branchId: values.branchId,
                goodsIssueTypeId: values.goodsIssueTypeId,
                warehouseId: values.warehouseId,
                customerId: values.customerId || null,
                requestDate: values.requestDate.format("YYYY-MM-DD"),
                remark: values.remark || null,
                status,
                lines: lineItems.map(l => ({
                    itemId: l.itemId,
                    itemSpecId: l.itemSpecId,
                    unitId: l.unitId,
                    requestedQuantity: l.requestedQuantity,
                    issuedQuantity: l.requestedQuantity, // Default issued quantity to same as requested
                    warehouseId: values.warehouseId,
                    locationId: l.locationId,
                    lotNo: l.lotNo || null,
                    remark: l.remark || null,
                }))
            };

            if (isEdit) {
                await updateGoodsIssue(id, payload);
                message.success("แก้ไขใบจ่ายสินค้าสำเร็จ");
            } else {
                await createGoodsIssue(payload);
                message.success("สร้างใบจ่ายสินค้าสำเร็จ");
            }
            navigate("/inventory/goods-issues");
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
            width: "25%",
            render: (record) => (
                <Typography.Text strong style={{ color: "#1a3353" }}>
                    {record.name || "-"}
                </Typography.Text>
            ),
        },
        {
            title: "หน่วย (Unit)",
            key: "unitId",
            width: "12%",
            render: (record, _, idx) => (
                <Select
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
            title: "จำนวนเบิก",
            key: "requestedQuantity",
            width: "8%",
            render: (record, _, idx) => (
                <InputNumber
                    min={0.0001}
                    style={{ width: "100%" }}
                    value={record.requestedQuantity}
                    onChange={(val) => handleLineFieldChange(val, "requestedQuantity", idx)}
                />
            ),
        },
        {
            title: "ตำแหน่งจัดเก็บ",
            key: "locationId",
            width: "15%",
            render: (record, _, idx) => (
                <Select
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
            title: "Lot No.",
            key: "lotNo",
            width: "15%",
            render: (record, _, idx) => (
                <Input
                    placeholder="แมนนวลล็อต"
                    value={record.lotNo}
                    onChange={(e) => handleLineFieldChange(e.target.value, "lotNo", idx)}
                />
            ),
        },
        {
            title: "ลบ",
            key: "delete",
            width: "50px",
            render: (_, __, idx) => (
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => deleteLine(idx)} />
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory/goods-issues")} style={{ marginRight: "12px" }} />
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        {isEdit ? "แก้ไขใบจ่ายสินค้า" : "สร้างใบจ่ายสินค้า (Goods Issue)"}
                    </h1>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {isEdit ? "แก้ไขข้อมูลใบจ่ายสินค้าแบบ Draft" : "บันทึกข้อมูลและเพิ่มรายการคีย์มือตัดจ่ายสต็อกคงคลัง"}
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
                            name="goodsIssueTypeId"
                            label="ประเภทธุรกรรม/วัตถุประสงค์การเบิก"
                            rules={[{ required: true, message: "กรุณาเลือกประเภทการเบิก" }]}
                        >
                            <Select placeholder="เลือกวัตถุประสงค์" onChange={handleTypeChange}>
                                {giTypes.filter(t => t.isActive).map((t) => (
                                    <Select.Option key={t.goodsIssueTypeId} value={t.goodsIssueTypeId}>
                                        {t.goodsIssueTypeName}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="warehouseId"
                            label="คลังสินค้าต้นทาง"
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
                            name="customerId"
                            label="ลูกค้า"
                            rules={[{ required: selectedType?.requiresCustomer, message: "กรุณาเลือกลูกค้า" }]}
                        >
                            <Select
                                showSearch
                                filterOption={false}
                                onSearch={handleCustomerSearch}
                                optionLabelProp="label"
                                placeholder={selectedType?.requiresCustomer ? "พิมพ์เพื่อค้นหาลูกค้า (จำเป็นสำหรับธุรกรรมนี้)" : "พิมพ์เพื่อค้นหาลูกค้า (ตัวเลือก)"}
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
                            name="requestDate"
                            label="วันที่แจ้งเบิก"
                            rules={[{ required: true, message: "กรุณาระบุวันที่แจ้งเบิก" }]}
                        >
                            <DatePicker style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="remark" label="คำชี้แจง / รายละเอียดเพิ่มเติม">
                    <Input.TextArea placeholder="ระบุเหตุผลในการเบิกจ่าย เช่น เบิกชดเชยกรณีสินค้าล็อตเดิมชำรุด..." rows={2} />
                </Form.Item>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", marginBottom: "12px" }}>
                    <Title level={4} style={{ marginBottom: 0 }}>
                        รายการสินค้าคีย์เบิกจ่าย
                    </Title>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={addLine}>
                        เพิ่มรายการสินค้า
                    </Button>
                </div>

                <Table
                    columns={columns}
                    dataSource={lineItems}
                    pagination={false}
                    rowKey="key"
                    bordered
                    style={{ marginBottom: "24px" }}
                />

                <div className="flex justify-end gap-3" style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                    <Button onClick={() => navigate("/inventory/goods-issues")}>
                        ยกเลิก
                    </Button>
                    <Button
                        type="primary"
                        loading={submitting}
                        onClick={() => handleSave("draft")}
                    >
                        บันทึกแบบร่าง (Draft)
                    </Button>
                    {selectedType?.requiresApproval ? (
                        <Button
                            type="primary"
                            ghost
                            loading={submitting}
                            onClick={() => handleSave("requested")}
                        >
                            เสนออนุมัติ (Request Approval)
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            ghost
                            loading={submitting}
                            onClick={() => handleSave("approved")}
                        >
                            ยืนยันพร้อมโพสต์จ่าย
                        </Button>
                    )}
                </div>
            </Form>
        </div>
    );
}
