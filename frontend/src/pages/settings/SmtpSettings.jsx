import React, { useState, useEffect } from "react";
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Space,
    Empty,
    message,
    Card,
    Tooltip,
    Switch,
    Tag,
} from "antd";
import { EditOutlined, FileExcelOutlined } from "@ant-design/icons";
import { useCompany } from "../../context/CompanyContext";

const SmtpSettings = () => {
    const { getSmtpSettings, updateSmtpSettings } = useCompany();
    const [smtpData, setSmtpData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        loadSmtp();
    }, []);

    const loadSmtp = async () => {
        setLoading(true);
        try {
            const data = await getSmtpSettings();
            setSmtpData(Array.isArray(data) ? data : data ? [data] : []);
        } catch (error) {
            message.error("ไม่สามารถโหลดข้อมูล SMTP ได้");
            setSmtpData([]);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (record) => {
        setEditingRecord(record);
        form.setFieldsValue({
            smtpHost: record.smtpHost,
            smtpPort: record.smtpPort,
            smtpUser: record.smtpUser,
            smtpPassword: record.smtpPassword,
            smtpSender: record.smtpSender,
            isActive: record.isActive === 1 || record.isActive === true,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingRecord(null);
        form.resetFields();
    };

    const handleSave = async () => {
        if (!editingRecord) return;
        try {
            const values = await form.validateFields();
            setSaving(true);

            const payload = {
                smtpHost: values.smtpHost,
                smtpPort: values.smtpPort,
                smtpUser: values.smtpUser,
                smtpPassword: values.smtpPassword,
                smtpSender: values.smtpSender,
                isActive: values.isActive ? 1 : 0,
            };

            await updateSmtpSettings(editingRecord.smtpSettingId, payload);
            message.success("บันทึกการตั้งค่า SMTP สำเร็จ");
            closeModal();
            await loadSmtp();
        } catch (error) {
            if (error.errorFields) return;
            message.error(error.message || "บันทึกไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const toCsvValue = (value) => {
        if (value === null || value === undefined) return "";
        const strValue = String(value);
        return strValue.includes('"')
            ? `"${strValue.replace(/"/g, '""')}"`
            : strValue;
    };

    const handleExportCsv = () => {
        if (smtpData.length === 0) {
            message.warning("ไม่มีข้อมูลเพื่อสำหรับส่งออก");
            return;
        }

        const headers = [
            "SmtpHost",
            "SmtpPort",
            "SmtpUser",
            "SmtpSender",
            "IsActive",
        ];
        const rows = smtpData.map((item) => [
            toCsvValue(item.smtpHost),
            toCsvValue(item.smtpPort),
            toCsvValue(item.smtpUser),
            toCsvValue(item.smtpSender),
            item.isActive ? "Yes" : "No",
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row) => row.join(",")),
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "smtp_settings.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = [
        {
            title: "",
            key: "actions",
            align: "center",
            width: 80,
            render: (_, record) => (
                <EditOutlined
                    className="cursor-pointer hover:text-blue-600"
                    onClick={() => openEditModal(record)}
                />
            ),
        },
        {
            title: "SMTP Host",
            dataIndex: "smtpHost",
            key: "smtpHost",
        },
        {
            title: "Port",
            dataIndex: "smtpPort",
            key: "smtpPort",
            width: 80,
        },
        {
            title: "User",
            dataIndex: "smtpUser",
            key: "smtpUser",
        },
        {
            title: "Sender",
            dataIndex: "smtpSender",
            key: "smtpSender",
        },
        {
            title: "Active",
            dataIndex: "isActive",
            key: "isActive",
            width: 100,
            align: "center",
            render: (value) => (
                <Tag color={value ? "blue" : "red"}>
                    {value ? "ใช้งาน" : "ปิดใช้งาน"}
                </Tag>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        การตั้งค่า SMTP
                    </h1>
                </div>
                <Space wrap>
                    <Button
                        icon={<FileExcelOutlined />}
                        onClick={handleExportCsv}
                        disabled={smtpData.length === 0}
                    >
                        Export CSV
                    </Button>
                </Space>
            </div>

            <div className="rounded-lg border border-slate-200">
                <Table
                    columns={columns}
                    dataSource={smtpData}
                    rowKey="smtpSettingId"
                    loading={loading}
                    pagination={false}
                    size="small"
                    scroll={{ x: "max-content" }}
                    className="users-table-nowrap"
                    locale={{ emptyText: <Empty description="ไม่มีข้อมูล" /> }}
                />
            </div>

            <Modal
                title="แก้ไขการตั้งค่า SMTP"
                open={modalOpen}
                onOk={handleSave}
                onCancel={closeModal}
                confirmLoading={saving}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="SMTP Host"
                        name="smtpHost"
                        rules={[
                            { required: true, message: "โปรดระบุ SMTP Host" },
                        ]}
                    >
                        <Input placeholder="e.g., smtp.gmail.com" />
                    </Form.Item>

                    <Form.Item
                        label="SMTP Port"
                        name="smtpPort"
                        rules={[{ required: true, message: "โปรดระบุ Port" }]}
                    >
                        <InputNumber
                            min={1}
                            max={65535}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Username"
                        name="smtpUser"
                        rules={[
                            { required: true, message: "โปรดระบุ Username" },
                        ]}
                    >
                        <Input placeholder="e.g., your-email@gmail.com" />
                    </Form.Item>

                    <Form.Item
                        label="Password"
                        name="smtpPassword"
                        rules={[
                            { required: true, message: "โปรดระบุ Password" },
                        ]}
                    >
                        <Input.Password placeholder="Enter password or app password" />
                    </Form.Item>

                    <Form.Item
                        label="Sender Email"
                        name="smtpSender"
                        rules={[
                            {
                                required: true,
                                message: "โปรดระบุ Sender Email",
                            },
                            {
                                type: "email",
                                message: "กรุณาระบุอีเมลที่ถูกต้อง",
                            },
                        ]}
                    >
                        <Input placeholder="e.g., noreply@agrofiber.com" />
                    </Form.Item>

                    <Form.Item
                        label="Active"
                        name="isActive"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default SmtpSettings;
