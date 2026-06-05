import React, { useEffect, useState } from "react";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Modal, Switch, Table, Tabs, Tag, Typography, message, Select } from "antd";
import { useGoodsIssue } from "../../context/GoodsIssueContext.jsx";
import { useGoodsReceipt } from "../../context/GoodsReceiptContext.jsx";

const { Title, Paragraph } = Typography;

export default function TransactionTypes() {
    const { getGoodsIssueTypes, createGoodsIssueType, updateGoodsIssueType } = useGoodsIssue();
    const { getGoodsReceiptTypes, createGoodsReceiptType, updateGoodsReceiptType } = useGoodsReceipt();

    const [giTypes, setGiTypes] = useState([]);
    const [grTypes, setGrTypes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("gi");
    const [editingType, setEditingType] = useState(null); // null means adding new
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const fetchGiTypes = async () => {
        try {
            const data = await getGoodsIssueTypes();
            setGiTypes(data || []);
        } catch (err) {
            message.error("โหลดข้อมูลประเภทการจ่ายล้มเหลว: " + err.message);
        }
    };

    const fetchGrTypes = async () => {
        try {
            const data = await getGoodsReceiptTypes();
            setGrTypes(data || []);
        } catch (err) {
            message.error("โหลดข้อมูลประเภทการรับล้มเหลว: " + err.message);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        if (activeTab === "gi") {
            await fetchGiTypes();
        } else {
            await fetchGrTypes();
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleOpenModal = (record = null) => {
        setEditingType(record);
        if (record) {
            form.setFieldsValue({
                code: record.goodsIssueTypeCode || record.goodsReceiptTypeCode || record.GoodsIssueTypeCode || record.GoodsReceiptTypeCode,
                name: record.goodsIssueTypeName || record.goodsReceiptTypeName || record.GoodsIssueTypeName || record.GoodsReceiptTypeName,
                movementTypeCode: record.movementTypeCode || record.MovementTypeCode,
                requiresCustomer: record.requiresCustomer === 1 || record.requiresCustomer === true || record.RequiresCustomer === 1 || record.RequiresCustomer === true,
                requiresVendor: record.requiresVendor === 1 || record.requiresVendor === true || record.RequiresVendor === 1 || record.RequiresVendor === true,
                requiresProductionOrder: record.requiresProductionOrder === 1 || record.requiresProductionOrder === true || record.RequiresProductionOrder === 1 || record.RequiresProductionOrder === true,
                requiresApproval: record.requiresApproval === 1 || record.requiresApproval === true || record.RequiresApproval === 1 || record.RequiresApproval === true,
                isActive: record.isActive === 1 || record.isActive === true || record.IsActive === 1 || record.IsActive === true,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({
                movementTypeCode: activeTab === "gi" ? "goods_issue" : "goods_receipt",
                isActive: true,
            });
        }
        setModalOpen(true);
    };

    const handleFormSubmit = async (values) => {
        setSubmitting(true);
        try {
            if (editingType) {
                const id = editingType.goodsIssueTypeId || editingType.goodsReceiptTypeId;
                const payload = {
                    goodsIssueTypeName: activeTab === "gi" ? values.name : undefined,
                    goodsReceiptTypeName: activeTab === "gr" ? values.name : undefined,
                    requiresCustomer: values.requiresCustomer,
                    requiresVendor: values.requiresVendor,
                    requiresProductionOrder: values.requiresProductionOrder,
                    requiresApproval: values.requiresApproval,
                    isActive: values.isActive,
                };
                if (activeTab === "gi") {
                    await updateGoodsIssueType(id, payload);
                } else {
                    await updateGoodsReceiptType(id, payload);
                }
                message.success("แก้ไขประเภทธุรกรรมสำเร็จ");
            } else {
                const payload = {
                    goodsIssueTypeCode: activeTab === "gi" ? values.code : undefined,
                    goodsReceiptTypeCode: activeTab === "gr" ? values.code : undefined,
                    goodsIssueTypeName: activeTab === "gi" ? values.name : undefined,
                    goodsReceiptTypeName: activeTab === "gr" ? values.name : undefined,
                    movementTypeCode: values.movementTypeCode,
                    requiresCustomer: values.requiresCustomer,
                    requiresVendor: values.requiresVendor,
                    requiresProductionOrder: values.requiresProductionOrder,
                    requiresApproval: values.requiresApproval,
                    isActive: values.isActive,
                };
                if (activeTab === "gi") {
                    await createGoodsIssueType(payload);
                } else {
                    await createGoodsReceiptType(payload);
                }
                message.success("สร้างประเภทธุรกรรมสำเร็จ");
            }
            setModalOpen(false);
            fetchData();
        } catch (err) {
            message.error("บันทึกข้อมูลล้มเหลว: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const giColumns = [
        {
            title: "รหัสประเภท (Code)",
            dataIndex: "goodsIssueTypeCode",
            key: "goodsIssueTypeCode",
            render: (code) => <Tag color="blue">{code}</Tag>,
        },
        {
            title: "ชื่อประเภทการเบิกจ่าย",
            dataIndex: "goodsIssueTypeName",
            key: "goodsIssueTypeName",
        },
        {
            title: "ประเภทการเคลื่อนย้าย",
            dataIndex: "movementTypeCode",
            key: "movementTypeCode",
        },
        {
            title: "ระบุลูกค้า",
            dataIndex: "requiresCustomer",
            key: "requiresCustomer",
            render: (val) => (val ? <Tag color="orange">ต้องการ</Tag> : <Tag color="default">ไม่ต้องการ</Tag>),
        },
        {
            title: "ขออนุมัติก่อน",
            dataIndex: "requiresApproval",
            key: "requiresApproval",
            render: (val) => (val ? <Tag color="red">ต้องอนุมัติ</Tag> : <Tag color="green">ไม่ต้องอนุมัติ</Tag>),
        },
        {
            title: "สถานะ",
            dataIndex: "isActive",
            key: "isActive",
            render: (val) => (val ? <Tag color="success">ใช้งาน</Tag> : <Tag color="error">ระงับ</Tag>),
        },
        {
            title: "การจัดการ",
            key: "action",
            render: (_, record) => (
                <Button type="link" icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>
                    แก้ไข
                </Button>
            ),
        },
    ];

    const grColumns = [
        {
            title: "รหัสประเภท (Code)",
            dataIndex: "goodsReceiptTypeCode",
            key: "goodsReceiptTypeCode",
            render: (code) => <Tag color="blue">{code}</Tag>,
        },
        {
            title: "ชื่อประเภทการรับเข้า",
            dataIndex: "goodsReceiptTypeName",
            key: "goodsReceiptTypeName",
        },
        {
            title: "ประเภทการเคลื่อนย้าย",
            dataIndex: "movementTypeCode",
            key: "movementTypeCode",
        },
        {
            title: "ระบุผู้ขาย (Vendor)",
            dataIndex: "requiresVendor",
            key: "requiresVendor",
            render: (val) => (val ? <Tag color="orange">ต้องการ</Tag> : <Tag color="default">ไม่ต้องการ</Tag>),
        },
        {
            title: "ระบุใบสั่งผลิต (PO)",
            dataIndex: "requiresProductionOrder",
            key: "requiresProductionOrder",
            render: (val) => (val ? <Tag color="purple">ต้องการ</Tag> : <Tag color="default">ไม่ต้องการ</Tag>),
        },
        {
            title: "ขออนุมัติก่อน",
            dataIndex: "requiresApproval",
            key: "requiresApproval",
            render: (val) => (val ? <Tag color="red">ต้องอนุมัติ</Tag> : <Tag color="green">ไม่ต้องอนุมัติ</Tag>),
        },
        {
            title: "สถานะ",
            dataIndex: "isActive",
            key: "isActive",
            render: (val) => (val ? <Tag color="success">ใช้งาน</Tag> : <Tag color="error">ระงับ</Tag>),
        },
        {
            title: "การจัดการ",
            key: "action",
            render: (_, record) => (
                <Button type="link" icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>
                    แก้ไข
                </Button>
            ),
        },
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        ตั้งค่าประเภทธุรกรรมคลังสินค้า (Transaction Types)
                    </h1>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal(null)}>
                    เพิ่มประเภทธุรกรรม
                </Button>
            </div>

            <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: "20px" }}>
                <Tabs.TabPane tab="ประเภทการจ่ายสินค้า (Goods Issue Types)" key="gi">
                    <Table
                        size="small"
                        columns={giColumns}
                        dataSource={giTypes}
                        rowKey="goodsIssueTypeId"
                        loading={loading}
                        pagination={false}
                    />
                </Tabs.TabPane>
                <Tabs.TabPane tab="ประเภทการรับสินค้า (Goods Receipt Types)" key="gr">
                    <Table
                        size="small"
                        columns={grColumns}
                        dataSource={grTypes}
                        rowKey="goodsReceiptTypeId"
                        loading={loading}
                        pagination={false}
                    />
                </Tabs.TabPane>
            </Tabs>

            <Modal
                title={editingType ? "แก้ไขประเภทธุรกรรม" : "เพิ่มประเภทธุรกรรม"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                okText="บันทึก"
                cancelText="ยกเลิก"
                confirmLoading={submitting}
                onOk={() => form.submit()}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item
                        name="code"
                        label="รหัสประเภทธุรกรรม (Code)"
                        rules={[
                            { required: true, message: "กรุณาระบุรหัสประเภทธุรกรรม" },
                            { pattern: /^[A-Z0-9_]+$/, message: "รหัสสามารถมีได้เฉพาะภาษาอังกฤษตัวใหญ่ ตัวเลข และเครื่องหมาย _ เท่านั้น" },
                        ]}
                    >
                        <Input placeholder="เช่น CUSTOM_CLAIM, PROMO_SAMPLE" disabled={!!editingType} />
                    </Form.Item>

                    <Form.Item
                        name="name"
                        label="ชื่อประเภทธุรกรรม"
                        rules={[{ required: true, message: "กรุณาระบุชื่อประเภทธุรกรรม" }]}
                    >
                        <Input placeholder="เช่น เบิกชดเชยลูกค้าภายนอก, รับคืนเฉพาะกิจ" />
                    </Form.Item>

                    <Form.Item
                        name="movementTypeCode"
                        label="ประเภทการเคลื่อนย้าย (Stock Movement Type)"
                        rules={[{ required: true }]}
                    >
                        <Select disabled>
                            <Select.Option value="goods_issue">Goods Issue (ตัดจ่ายสต็อก)</Select.Option>
                            <Select.Option value="goods_receipt">Goods Receipt (รับเข้าสต็อก)</Select.Option>
                        </Select>
                    </Form.Item>

                    {activeTab === "gi" && (
                        <Form.Item name="requiresCustomer" label="จำเป็นต้องระบุลูกค้า" valuePropName="checked">
                            <Switch checkedChildren="ใช่" unCheckedChildren="ไม่" />
                        </Form.Item>
                    )}

                    {activeTab === "gr" && (
                        <>
                            <Form.Item name="requiresVendor" label="จำเป็นต้องระบุผู้ขาย (Vendor)" valuePropName="checked">
                                <Switch checkedChildren="ใช่" unCheckedChildren="ไม่" />
                            </Form.Item>
                            <Form.Item name="requiresProductionOrder" label="จำเป็นต้องระบุใบสั่งผลิต (PO)" valuePropName="checked">
                                <Switch checkedChildren="ใช่" unCheckedChildren="ไม่" />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item name="requiresApproval" label="ต้องผ่านการอนุมัติก่อน (Requested -> Approved)" valuePropName="checked">
                        <Switch checkedChildren="ใช่" unCheckedChildren="ไม่" />
                    </Form.Item>

                    <Form.Item name="isActive" label="สถานะการใช้งาน" valuePropName="checked">
                        <Switch checkedChildren="เปิดใช้งาน" unCheckedChildren="ระงับใช้งาน" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
