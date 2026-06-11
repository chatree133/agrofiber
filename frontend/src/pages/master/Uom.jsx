import { useEffect, useState } from "react";
import {
    Button,
    Form,
    Input,
    message,
    Modal,
    Space,
    Table,
    Tag,
} from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMasterData } from "../../context/MasterDataContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Uom() {
    const { getUnits, createUnit, updateUnit, fetchLookups } = useMasterData();
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes("admin");

    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const loadUnits = async () => {
        setLoading(true);
        try {
            const data = await getUnits();
            setUnits(Array.isArray(data) ? data : []);
        } catch (error) {
            message.error(
                error.response?.data?.message || "โหลดข้อมูลหน่วยนับไม่สำเร็จ",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUnits();
    }, []);

    const openCreate = () => {
        if (!isAdmin) return;
        setEditingUnit(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEdit = (unit) => {
        if (!isAdmin) return;
        setEditingUnit(unit);
        form.setFieldsValue({ code: unit.code, name: unit.name });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        form.resetFields();
        setEditingUnit(null);
    };

    const handleSave = async () => {
        if (!isAdmin) return;
        try {
            const values = await form.validateFields();
            setSaving(true);

            const payload = {
                code: values.code.trim().toUpperCase(),
                name: values.name.trim(),
            };

            if (editingUnit) {
                await updateUnit(editingUnit.id, payload);
                message.success("แก้ไขหน่วยนับสำเร็จ");
            } else {
                await createUnit(payload);
                message.success("สร้างหน่วยนับสำเร็จ");
            }

            // Sync master lookups cache globally
            await fetchLookups();

            closeModal();
            await loadUnits();
        } catch (error) {
            if (error.errorFields) return;
            message.error(
                error.response?.data?.message || "บันทึกข้อมูลไม่สำเร็จ",
            );
        } finally {
            setSaving(false);
        }
    };

    const columns = [
        ...(isAdmin
            ? [
                {
                    title: "จัดการ",
                    key: "actions",
                    width: 80,
                    align: "center",
                    render: (_, record) => (
                        <Space size={4}>
                            <EditOutlined
                                className="text-slate-600 cursor-pointer hover:text-blue-600 text-base"
                                onClick={() => openEdit(record)}
                            />
                        </Space>
                    ),
                },
            ]
            : []),
        {
            title: "รหัสหน่วยนับ (Unit Code)",
            dataIndex: "code",
            key: "code",
            width: 250,
            render: (value) => <Tag color="cyan" className="font-semibold text-xs py-0.5 px-2">{value}</Tag>,
        },
        {
            title: "ชื่อหน่วยนับ (Unit Name)",
            dataIndex: "name",
            key: "name",
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">จัดการหน่วยนับ (UOM)</h1>
                    <p className="text-sm text-slate-500">
                        แสดงและกำหนดข้อมูลหน่วยนับสำหรับใช้ในการแปลงหน่วยและนับสต็อกสินค้า
                    </p>
                </div>
                {isAdmin && (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreate}
                        className="bg-indigo-600 hover:bg-indigo-700 border-none shadow-sm rounded-md"
                    >
                        เพิ่มหน่วยนับ
                    </Button>
                )}
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={units}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "ไม่มีหน่วยนับให้แสดง" }}
                />
            </div>

            {isAdmin && (
                <Modal
                    title={editingUnit ? "แก้ไขข้อมูลหน่วยนับ" : "เพิ่มหน่วยนับใหม่"}
                    open={modalOpen}
                    onOk={handleSave}
                    onCancel={closeModal}
                    confirmLoading={saving}
                    okText="บันทึก"
                    cancelText="ยกเลิก"
                >
                    <Form
                        form={form}
                        layout="vertical"
                        className="mt-4"
                    >
                        <Form.Item
                            label="รหัสหน่วยนับ (Unit Code)"
                            name="code"
                            rules={[
                                { required: true, message: "กรุณากรอกรหัสหน่วยนับ" },
                                { max: 30, message: "รหัสหน่วยนับห้ามเกิน 30 ตัวอักษร" },
                            ]}
                        >
                            <Input placeholder="เช่น PCS, PALLET, SHEET (ตัวอังกฤษพิมพ์ใหญ่)" />
                        </Form.Item>
                        <Form.Item
                            label="ชื่อหน่วยนับ (Unit Name)"
                            name="name"
                            rules={[
                                { required: true, message: "กรุณากรอกชื่อหน่วยนับ" },
                                { max: 100, message: "ชื่อหน่วยนับห้ามเกิน 100 ตัวอักษร" },
                            ]}
                        >
                            <Input placeholder="เช่น แผ่น, พาเลท, ตัว" />
                        </Form.Item>
                    </Form>
                </Modal>
            )}
        </div>
    );
}
