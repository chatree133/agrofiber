import { useEffect, useState } from "react";
import {
    Button,
    Form,
    Input,
    message,
    Modal,
    Popconfirm,
    Space,
    Table,
    Tag,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useUser } from "../../context/UserContext.jsx";

export default function Roles() {
    const { getRoles, createRole, updateRole, deleteRole } = useUser();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [form] = Form.useForm();

    const loadRoles = async () => {
        setLoading(true);
        try {
            const data = await getRoles();
            setRoles(Array.isArray(data) ? data : []);
        } catch (error) {
            message.error(
                error.response?.data?.message || "โหลดบทบาทไม่สำเร็จ",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoles();
    }, []);

    const openCreate = () => {
        setEditingRole(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEdit = (role) => {
        setEditingRole(role);
        form.setFieldsValue({ roleCode: role.code, roleName: role.name });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        form.resetFields();
        setEditingRole(null);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            if (editingRole) {
                await updateRole(editingRole.id, values);
                message.success("แก้ไขบทบาทสำเร็จ");
            } else {
                await createRole(values);
                message.success("สร้างบทบาทสำเร็จ");
            }

            closeModal();
            await loadRoles();
        } catch (error) {
            if (error.errorFields) return;
            message.error(
                error.response?.data?.message || "บันทึกบทบาทไม่สำเร็จ",
            );
        }
    };

    const handleDelete = async (roleId) => {
        try {
            await deleteRole(roleId);
            message.success("ลบบทบาทสำเร็จ");
            setRoles((current) => current.filter((role) => role.id !== roleId));
        } catch (error) {
            message.error(error.response?.data?.message || "ลบบทบาทไม่สำเร็จ");
        }
    };

    const columns = [
        {
            title: "",
            key: "actions",
            width: 78,
            render: (_, record) => (
                <Space size={4}>
                    <Popconfirm
                        title="ยืนยันลบบทบาทนี้?"
                        okText="ลบ"
                        cancelText="ยกเลิก"
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600"  />
                    </Popconfirm>
                    <EditOutlined className="text-slate-600 cursor-pointer hover:text-blue-600" onClick={() => openEdit(record)} />
                </Space>
            ),
        },
        {
            title: "Role Code",
            dataIndex: "code",
            key: "code",
            render: (value) => <Tag color="blue">{value}</Tag>,
        },
        {
            title: "Role Name",
            dataIndex: "name",
            key: "name",
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-semibold">จัดการบทบาท</h1>
                    <p className="text-sm text-slate-500">
                        สร้าง แก้ไข และลบบทบาทระบบ
                    </p>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreate}
                >
                    เพิ่มบทบาท
                </Button>
            </div>

            <Table
                rowKey="id"
                loading={loading}
                columns={columns}
                dataSource={roles}
                pagination={false}
                size="small"
                locale={{ emptyText: "ไม่มีบทบาทให้แสดง" }}
            />

            <Modal
                title={editingRole ? "แก้ไขบทบาท" : "สร้างบทบาทใหม่"}
                open={modalOpen}
                onOk={handleSave}
                onCancel={closeModal}
                okText="บันทึก"
                cancelText="ยกเลิก"
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{ roleCode: "", roleName: "" }}
                >
                    <Form.Item
                        label="Role Code"
                        name="roleCode"
                        rules={[
                            { required: true, message: "กรุณากรอกรหัสบทบาท" },
                        ]}
                    >
                        <Input placeholder="กรอก Role Code" />
                    </Form.Item>
                    <Form.Item
                        label="Role Name"
                        name="roleName"
                        rules={[
                            { required: true, message: "กรุณากรอกชื่อบทบาท" },
                        ]}
                    >
                        <Input placeholder="กรอกชื่อบทบาท" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
