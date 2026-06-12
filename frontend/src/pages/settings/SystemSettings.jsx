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
    Tabs,
    Spin,
} from "antd";
import {
    EditOutlined,
    FileExcelOutlined,
    MailOutlined,
    KeyOutlined,
    GlobalOutlined,
    SaveOutlined,
} from "@ant-design/icons";
import { useCompany } from "../../context/CompanyContext";

const SystemSettings = () => {
    const {
        getSmtpSettings,
        updateSmtpSettings,
        getSystemSettings,
        updateSystemSettings,
    } = useCompany();

    // SMTP settings state
    const [smtpData, setSmtpData] = useState([]);
    const [loadingSmtp, setLoadingSmtp] = useState(false);
    const [smtpModalOpen, setSmtpModalOpen] = useState(false);
    const [editingSmtpRecord, setEditingSmtpRecord] = useState(null);
    const [savingSmtp, setSavingSmtp] = useState(false);
    const [smtpForm] = Form.useForm();

    // System keys state
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [savingKeys, setSavingKeys] = useState(false);
    const [keysForm] = Form.useForm();

    useEffect(() => {
        loadSmtp();
        loadKeys();
    }, []);

    // Load SMTP Settings
    const loadSmtp = async () => {
        setLoadingSmtp(true);
        try {
            const data = await getSmtpSettings();
            setSmtpData(Array.isArray(data) ? data : data ? [data] : []);
        } catch (error) {
            message.error("ไม่สามารถโหลดข้อมูล SMTP ได้");
            setSmtpData([]);
        } finally {
            setLoadingSmtp(false);
        }
    };

    // Load System Keys
    const loadKeys = async () => {
        setLoadingKeys(true);
        try {
            const allData = await getSystemSettings();
            const mapsKeyObj = allData.find(item => item.settingKey === 'GOOGLE_MAPS_KEY');
            keysForm.setFieldsValue({
                googleMapsKey: mapsKeyObj ? mapsKeyObj.settingValue : ''
            });
        } catch (error) {
            message.error("ไม่สามารถโหลดข้อมูลคีย์ระบบได้");
        } finally {
            setLoadingKeys(false);
        }
    };

    // Save SMTP
    const openEditSmtpModal = (record) => {
        setEditingSmtpRecord(record);
        smtpForm.setFieldsValue({
            smtpHost: record.smtpHost,
            smtpPort: record.smtpPort,
            smtpUser: record.smtpUser,
            smtpPassword: record.smtpPassword,
            smtpSender: record.smtpSender,
            isActive: record.isActive === 1 || record.isActive === true,
        });
        setSmtpModalOpen(true);
    };

    const closeSmtpModal = () => {
        setSmtpModalOpen(false);
        setEditingSmtpRecord(null);
        smtpForm.resetFields();
    };

    const handleSaveSmtp = async () => {
        if (!editingSmtpRecord) return;
        try {
            const values = await smtpForm.validateFields();
            setSavingSmtp(true);

            const payload = {
                smtpHost: values.smtpHost,
                smtpPort: values.smtpPort,
                smtpUser: values.smtpUser,
                smtpPassword: values.smtpPassword,
                smtpSender: values.smtpSender,
                isActive: values.isActive ? 1 : 0,
            };

            await updateSmtpSettings(editingSmtpRecord.smtpSettingId, payload);
            message.success("บันทึกการตั้งค่า SMTP สำเร็จ");
            closeSmtpModal();
            await loadSmtp();
        } catch (error) {
            if (error.errorFields) return;
            message.error(error.message || "บันทึกไม่สำเร็จ");
        } finally {
            setSavingSmtp(false);
        }
    };

    // Save Keys
    const handleSaveKeys = async () => {
        try {
            const values = await keysForm.validateFields();
            setSavingKeys(true);

            const payload = [
                {
                    settingKey: 'GOOGLE_MAPS_KEY',
                    settingValue: values.googleMapsKey,
                    settingGroup: 'GoogleMaps'
                }
            ];

            await updateSystemSettings(payload);
            message.success("บันทึกการตั้งค่า Google Map Key สำเร็จ");
            await loadKeys();
        } catch (error) {
            message.error(error.message || "บันทึกคีย์ไม่สำเร็จ");
        } finally {
            setSavingKeys(false);
        }
    };

    // CSV Export helper
    const toCsvValue = (value) => {
        if (value === null || value === undefined) return "";
        const strValue = String(value);
        return strValue.includes('"')
            ? `"${strValue.replace(/"/g, '""')}"`
            : strValue;
    };

    const handleExportSmtpCsv = () => {
        if (smtpData.length === 0) {
            message.warning("ไม่มีข้อมูลสำหรับส่งออก");
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

    const smtpColumns = [
        {
            title: "",
            key: "actions",
            align: "center",
            width: 80,
            render: (_, record) => (
                <EditOutlined
                    className="cursor-pointer hover:text-blue-600"
                    onClick={() => openEditSmtpModal(record)}
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

    const tabItems = [
        {
            key: "smtp",
            label: "การตั้งค่า SMTP",
            children: (
                <div className="space-y-4 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-slate-800">
                                การตั้งค่า SMTP สำหรับการส่งอีเมลระบบ
                            </h2>
                        </div>
                        <Space wrap>
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={handleExportSmtpCsv}
                                disabled={smtpData.length === 0}
                            >
                                Export CSV
                            </Button>
                        </Space>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white">
                        <Table
                            columns={smtpColumns}
                            dataSource={smtpData}
                            rowKey="smtpSettingId"
                            loading={loadingSmtp}
                            pagination={false}
                            size="small"
                            scroll={{ x: "max-content" }}
                            className="users-table-nowrap"
                            locale={{ emptyText: <Empty description="ไม่มีข้อมูล" /> }}
                        />
                    </div>
                </div>
            )
        },
        {
            key: "keys",
            label: "การตั้งค่าระบบ & API Keys",
            children: (
                <div className="pt-2">
                    <Spin spinning={loadingKeys}>
                        <div className="max-w-2xl">
                            <Card
                                title={
                                    <div className="flex items-center gap-2">
                                        <GlobalOutlined className="text-blue-500" />
                                        <span>การตั้งค่า Google Map API Key</span>
                                    </div>
                                }
                                className="shadow-sm border-slate-200"
                            >
                                <p className="text-slate-500 text-xs mb-4">
                                    คีย์นี้ถูกใช้เพื่อเรียกใช้ Google Maps JavaScript API ในหน้าแสดงผลแผนที่, หน้าลงพิกัดพิกัดลูกค้า, และบริการค้นหาพิกัด
                                </p>
                                <Form
                                    form={keysForm}
                                    layout="vertical"
                                    onFinish={handleSaveKeys}
                                >
                                    <Form.Item
                                        label="Google Maps API Key"
                                        name="googleMapsKey"
                                        rules={[
                                            { required: true, message: "โปรดระบุ Google Maps API Key" },
                                        ]}
                                    >
                                        <Input.Password
                                            placeholder="ใส่ Google Maps API Key ของคุณที่นี่ (AIzaSy...)"
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item className="mb-0">
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            icon={<SaveOutlined />}
                                            loading={savingKeys}
                                            size="large"
                                        >
                                            บันทึกการตั้งค่า
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </Card>

                            {/* SMS Gateway Section template (ready to extend in the future) */}
                            <div className="mt-6 opacity-60">
                                <Card
                                    title="SMS Gateway settings (เร็วๆ นี้)"
                                    className="border-dashed border-slate-300 bg-slate-50"
                                    size="small"
                                >
                                    <p className="text-slate-500 text-xs">
                                        การเชื่อมต่อ SMS Gateway ที่ต้องการใส่ Key และ Secret ในอนาคต จะถูกแสดงและจัดเก็บผ่านระบบ SystemSettings นี้โดยอัตโนมัติ
                                    </p>
                                </Card>
                            </div>
                        </div>
                    </Spin>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-bold text-slate-800">
                    ตั้งค่าระบบ (System Settings)
                </h1>
            </div>

            <Tabs defaultActiveKey="smtp" items={tabItems} className="system-settings-tabs" />

            {/* SMTP Edit Modal */}
            <Modal
                title="แก้ไขการตั้งค่า SMTP"
                open={smtpModalOpen}
                onOk={handleSaveSmtp}
                onCancel={closeSmtpModal}
                confirmLoading={savingSmtp}
            >
                <Form form={smtpForm} layout="vertical">
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

export default SystemSettings;
