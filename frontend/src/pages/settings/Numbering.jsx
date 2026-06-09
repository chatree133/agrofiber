import { EditOutlined, FileExcelOutlined } from "@ant-design/icons";
import {
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Select,
    Space,
    Table,
    Tag,
    Switch,
} from "antd";
import { useEffect, useState } from "react";
import { useCompany } from "../../context/CompanyContext.jsx";

const resetFrequencyOptions = [
    { label: "ไม่รีเซ็ต", value: "never" },
    { label: "รายปี", value: "yearly" },
    { label: "รายเดือน", value: "monthly" },
    { label: "รายวัน", value: "daily" },
];

export default function Numbering() {
    const { getDocumentSeries, updateDocumentSeries } = useCompany();
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const loadSeries = async () => {
        try {
            setLoading(true);
            const data = await getDocumentSeries();
            setSeries(data || []);
        } catch (err) {
            message.error(
                err.message || "ไม่สามารถโหลดการตั้งค่าเลขที่เอกสารได้",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSeries();
    }, []);

    const openEditModal = (record) => {
        setEditing(record);
        form.setFieldsValue({
            prefixFormat: record.prefixFormat,
            paddingLength: record.paddingLength,
            resetFrequency: record.resetFrequency,
            isActive: record.isActive,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
        form.resetFields();
    };

    const handleSave = async () => {
        if (!editing) return;
        try {
            const values = await form.validateFields();
            setSaving(true);
            await updateDocumentSeries(editing.documentSeriesId, values);
            message.success("บันทึกการตั้งค่าเลขที่เอกสารสำเร็จ");
            closeModal();
            await loadSeries();
        } catch (err) {
            if (err.errorFields) return;
            message.error(err.message || "บันทึกไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        const header = [
            "DocumentType",
            "SeriesCode",
            "Branch",
            "PrefixFormat",
            "PaddingLength",
            "ResetFrequency",
            "IsActive",
        ];
        const rows = series.map((row) => [
            row.documentType || "",
            row.seriesCode || "",
            row.branchName || "Default",
            row.prefixFormat || "",
            row.paddingLength ?? "",
            row.resetFrequency || "",
            row.isActive ? "ใช้งาน" : "ปิดใช้งาน",
        ]);
        const csv = [header, ...rows]
            .map((row) =>
                row
                    .map(
                        (cell) =>
                            `"${String(cell ?? "").replaceAll('"', '""')}"`,
                    )
                    .join(","),
            )
            .join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        link.download = "document_series.csv";
        link.click();
    };

    const columns = [
        {
            title: "",
            key: "actions",
            width: 80,
            align: "center",
            render: (_, record) => (
                <EditOutlined
                    className="cursor-pointer hover:text-blue-600"
                    onClick={() => openEditModal(record)}
                />
            ),
        },
        { title: "ชนิดเอกสาร", dataIndex: "documentType", key: "documentType" },
        { title: "รหัสซีรีส์", dataIndex: "seriesCode", key: "seriesCode" },
        {
            title: "สาขา",
            key: "branch",
            render: (_, record) => record.branchName || <Tag>Default</Tag>,
        },
        {
            title: "รูปแบบ Prefix",
            dataIndex: "prefixFormat",
            key: "prefixFormat",
        },
        {
            title: "Padding",
            dataIndex: "paddingLength",
            key: "paddingLength",
            width: 100,
        },
        {
            title: "ความถี่การรีเซ็ต",
            dataIndex: "resetFrequency",
            key: "resetFrequency",
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
                        ตั้งค่าเลขที่เอกสาร
                    </h1>
                </div>
                <Space wrap>
                    <Button
                        icon={<FileExcelOutlined />}
                        onClick={handleExport}
                    ></Button>
                </Space>
            </div>

            <div className="rounded-lg border border-slate-200">
                <Table
                    columns={columns}
                    dataSource={series}
                    rowKey="documentSeriesId"
                    loading={loading}
                    pagination={false}
                    size="small"
                    scroll={{ x: "max-content" }}
                    className="users-table-nowrap"
                />
            </div>

            <Modal
                title="แก้ไขเลขที่เอกสาร"
                open={modalOpen}
                onOk={handleSave}
                onCancel={closeModal}
                confirmLoading={saving}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="Document Type">
                        <Input value={editing?.documentType} disabled />
                    </Form.Item>
                    <Form.Item label="Series Code">
                        <Input value={editing?.seriesCode} disabled />
                    </Form.Item>
                    <Form.Item label="Branch">
                        <Input
                            value={editing?.branchName || "Default"}
                            disabled
                        />
                    </Form.Item>
                    <Form.Item
                        name="prefixFormat"
                        label="Prefix Format"
                        rules={[
                            {
                                required: true,
                                message: "กรุณากรอก Prefix Format",
                            },
                        ]}
                    >
                        <Input placeholder="เช่น SO-{YY}{MM}-" />
                    </Form.Item>
                    <Form.Item
                        name="paddingLength"
                        label="Padding Length"
                        rules={[
                            {
                                required: true,
                                message: "กรุณากรอก Padding Length",
                            },
                        ]}
                    >
                        <InputNumber min={1} className="w-full" />
                    </Form.Item>
                    <Form.Item
                        name="resetFrequency"
                        label="Reset Frequency"
                        rules={[
                            {
                                required: true,
                                message: "กรุณาเลือก Reset Frequency",
                            },
                        ]}
                    >
                        <Select options={resetFrequencyOptions} />
                    </Form.Item>
                    <Form.Item
                        name="isActive"
                        label="เปิดใช้งาน"
                        valuePropName="checked"
                    >
                        <Switch
                            checkedChildren="ใช้งาน"
                            unCheckedChildren="ปิดใช้งาน"
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
