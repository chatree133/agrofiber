import React, { useState, useEffect } from "react";
import {
    Card,
    Table,
    Tag,
    Input,
    Select,
    Row,
    Col,
    Typography,
    Button,
    Space,
    Modal,
    DatePicker,
    Tooltip,
    Empty
} from "antd";
import {
    AuditOutlined,
    SearchOutlined,
    ReloadOutlined,
    EyeOutlined,
    FilterOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAudit } from "../../context/AuditContext.jsx";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function AuditLogs() {
    const { getAuditLogs } = useAudit();

    // Filtering states
    const [searchText, setSearchText] = useState("");
    const [selectedModule, setSelectedModule] = useState("");
    const [selectedAction, setSelectedAction] = useState("");
    const [dateRange, setDateRange] = useState([]);

    // Data states
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        total: 0
    });

    // Detail Modal states
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    const loadAuditLogs = async (nextPage = 1) => {
        setLoading(true);
        try {
            const params = {
                page: nextPage,
                pageSize: pagination.pageSize,
                search: searchText || undefined,
                module: selectedModule || undefined,
                action: selectedAction || undefined,
                startDate: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
                endDate: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : undefined
            };

            const res = await getAuditLogs(params);
            setLogs(res.data || []);
            setPagination(prev => ({
                ...prev,
                page: nextPage,
                total: res.pagination?.total || 0
            }));
        } catch (err) {
            console.error("Failed to load audit logs", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAuditLogs(1);
    }, [selectedModule, selectedAction, dateRange]);

    const handleSearch = () => {
        loadAuditLogs(1);
    };

    const handleReset = () => {
        setSearchText("");
        setSelectedModule("");
        setSelectedAction("");
        setDateRange([]);
    };

    const getModuleColor = (mod) => {
        const colors = {
            Auth: "magenta",
            Settings: "blue",
            WMS: "purple",
            Transportation: "cyan",
            Sales: "orange",
            Master: "green"
        };
        return colors[mod] || "default";
    };

    const getActionColor = (action) => {
        const colors = {
            Login: "success",
            Create: "processing",
            Update: "warning",
            Delete: "error",
            Approve: "geekblue"
        };
        return colors[action] || "default";
    };

    const formatJson = (val) => {
        if (!val) return null;
        try {
            const parsed = typeof val === "string" ? JSON.parse(val) : val;
            return JSON.stringify(parsed, null, 2);
        } catch {
            return String(val);
        }
    };

    const columns = [
        {
            title: "วัน-เวลา",
            dataIndex: "timestamp",
            key: "timestamp",
            width: 170,
            render: (val) => dayjs(val).format("DD/MM/YYYY HH:mm:ss")
        },
        {
            title: "ผู้ดำเนินการ",
            key: "user",
            width: 150,
            render: (_, record) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <Text strong style={{ color: "#334155" }}>
                        {record.displayName}
                    </Text>
                    <Text type="secondary" style={{ fontSize: "11px" }}>
                        @{record.username}
                    </Text>
                </div>
            )
        },
        {
            title: "ระบบ",
            dataIndex: "module",
            key: "module",
            width: 120,
            render: (val) => <Tag color={getModuleColor(val)}>{val}</Tag>
        },
        {
            title: "กิจกรรม",
            dataIndex: "actionType",
            key: "actionType",
            width: 120,
            render: (val) => <Tag color={getActionColor(val)}>{val}</Tag>
        },
        {
            title: "เป้าหมาย/เอกสาร",
            dataIndex: "targetId",
            key: "targetId",
            width: 150,
            render: (val) => val ? <Tag color="gold">{val}</Tag> : <Text type="secondary">-</Text>
        },
        {
            title: "รายละเอียด",
            dataIndex: "description",
            key: "description",
            render: (val) => <span style={{ color: "#475569" }}>{val}</span>
        },
        {
            title: "พิกัด IP",
            dataIndex: "ipAddress",
            key: "ipAddress",
            width: 130,
            render: (val) => val ? <Text type="secondary" style={{ fontSize: "12px" }}>{val}</Text> : <Text type="secondary">-</Text>
        },
        {
            title: "รายละเอียด",
            key: "actions",
            align: "center",
            width: 100,
            render: (_, record) => (
                <Tooltip title="ดูข้อมูลดิบเชิงลึก">
                    <Button
                        type="primary"
                        shape="circle"
                        icon={<EyeOutlined />}
                        style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
                        onClick={() => {
                            setSelectedLog(record);
                            setDetailModalOpen(true);
                        }}
                    />
                </Tooltip>
            )
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Header section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        <AuditOutlined style={{ marginRight: 8, color: "#7c3aed" }} />
                        ประวัติการใช้งานระบบ (Audit Logs)
                    </h1>
                    <Paragraph style={{ margin: "4px 0 0 0", color: "#64748b" }}>
                        ติดตาม ค้นหา และตรวจสอบทุกประวัติการทำรายการ การตั้งค่า และกิจกรรมสำคัญของผู้ใช้ในระบบ
                    </Paragraph>
                </div>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={() => loadAuditLogs(1)}
                    loading={loading}
                >
                    รีเฟรชประวัติ
                </Button>
            </div>

            {/* Filter toolbar card */}
            <Card bordered={false} style={{ borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={8} lg={6}>
                        <Input
                            placeholder="ค้นหาชื่อผู้ดำเนินการ / คำอธิบาย / เอกสาร"
                            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onPressEnter={handleSearch}
                            allowClear
                        />
                    </Col>
                    <Col xs={12} sm={8} lg={4}>
                        <Select
                            style={{ width: "100%" }}
                            placeholder="กรองตามระบบย่อย"
                            value={selectedModule}
                            onChange={setSelectedModule}
                        >
                            <Select.Option value="">ทุกระบบ</Select.Option>
                            <Select.Option value="Auth">ความปลอดภัย (Auth)</Select.Option>
                            <Select.Option value="Settings">การตั้งค่าระบบ (Settings)</Select.Option>
                            <Select.Option value="Transportation">การขนส่ง (Transportation)</Select.Option>
                            <Select.Option value="WMS">คลังสินค้า (WMS)</Select.Option>
                            <Select.Option value="Sales">ใบสั่งซื้อ (Sales)</Select.Option>
                            <Select.Option value="Master">ข้อมูลหลัก (Master)</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={12} sm={8} lg={4}>
                        <Select
                            style={{ width: "100%" }}
                            placeholder="กรองตามกิจกรรม"
                            value={selectedAction}
                            onChange={setSelectedAction}
                        >
                            <Select.Option value="">ทุกกิจกรรม</Select.Option>
                            <Select.Option value="Login">การเข้าระบบ (Login)</Select.Option>
                            <Select.Option value="Create">การสร้าง (Create)</Select.Option>
                            <Select.Option value="Update">การแก้ไข (Update)</Select.Option>
                            <Select.Option value="Delete">การลบ (Delete)</Select.Option>
                            <Select.Option value="Approve">การอนุมัติ (Approve)</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={24} lg={6}>
                        <RangePicker
                            style={{ width: "100%" }}
                            value={dateRange}
                            onChange={setDateRange}
                        />
                    </Col>
                    <Col xs={24} lg={4}>
                        <Space style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Button onClick={handleReset}>ล้างตัวกรอง</Button>
                            <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>กรองข้อมูล</Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Logs Table Card */}
            <Card bordered={false} bodyStyle={{ padding: 0 }} style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                <Table
                    size="small"
                    columns={columns}
                    dataSource={logs}
                    loading={loading}
                    rowKey="id"
                    pagination={{
                        current: pagination.page,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        onChange: (page) => loadAuditLogs(page),
                        showSizeChanger: false,
                        position: ["bottomRight"]
                    }}
                />
            </Card>

            {/* JSON Viewer Detail Modal */}
            <Modal
                title={
                    <Space>
                        <AuditOutlined style={{ color: "#7c3aed" }} />
                        <Text strong>รายละเอียดประวัติการกระทำและข้อมูลเปรียบเทียบ</Text>
                    </Space>
                }
                open={detailModalOpen}
                onCancel={() => {
                    setDetailModalOpen(false);
                    setSelectedLog(null);
                }}
                footer={[
                    <Button key="close" type="primary" onClick={() => setDetailModalOpen(false)}>
                        ปิดหน้าต่าง
                    </Button>
                ]}
                width={850}
                bodyStyle={{ maxHeight: "70vh", overflowY: "auto", padding: "16px" }}
            >
                {selectedLog && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <Row gutter={[16, 16]} style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                            <Col span={12}>
                                <Text type="secondary" style={{ display: "block", fontSize: "12px" }}>วัน-เวลาทำรายการ</Text>
                                <Text strong>{dayjs(selectedLog.timestamp).format("DD/MM/YYYY HH:mm:ss")}</Text>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary" style={{ display: "block", fontSize: "12px" }}>ผู้ดำเนินการ</Text>
                                <Text strong>{selectedLog.displayName} (@{selectedLog.username})</Text>
                            </Col>
                            <Col span={8}>
                                <Text type="secondary" style={{ display: "block", fontSize: "12px" }}>ระบบ</Text>
                                <Tag color={getModuleColor(selectedLog.module)} style={{ marginTop: "4px" }}>{selectedLog.module}</Tag>
                            </Col>
                            <Col span={8}>
                                <Text type="secondary" style={{ display: "block", fontSize: "12px" }}>ประเภทกิจกรรม</Text>
                                <Tag color={getActionColor(selectedLog.actionType)} style={{ marginTop: "4px" }}>{selectedLog.actionType}</Tag>
                            </Col>
                            <Col span={8}>
                                <Text type="secondary" style={{ display: "block", fontSize: "12px" }}>พิกัด IP / อุปกรณ์</Text>
                                <Text strong style={{ display: "block", marginTop: "4px" }}>{selectedLog.ipAddress || 'System'}</Text>
                            </Col>
                            <Col span={24}>
                                <Text type="secondary" style={{ display: "block", fontSize: "12px" }}>คำอธิบายกิจกรรม</Text>
                                <Text strong style={{ fontSize: "14px", color: "#1e293b" }}>{selectedLog.description}</Text>
                            </Col>
                        </Row>

                        {/* Compare raw JSON values */}
                        <Row gutter={16}>
                            <Col span={selectedLog.oldValues ? 12 : 24}>
                                <Card size="small" title="ค่าข้อมูลใหม่ (New/Updated Values)" headStyle={{ background: "#f0fdf4", color: "#166534" }}>
                                    {selectedLog.newValues ? (
                                        <pre style={{
                                            margin: 0,
                                            padding: "12px",
                                            background: "#1e293b",
                                            color: "#38bdf8",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontFamily: "Courier, monospace",
                                            maxHeight: "350px",
                                            overflowY: "auto"
                                        }}>
                                            {formatJson(selectedLog.newValues)}
                                        </pre>
                                    ) : (
                                        <Empty description="ไม่มีข้อมูลรายการใหม่" />
                                    )}
                                </Card>
                            </Col>
                            {selectedLog.oldValues && (
                                <Col span={12}>
                                    <Card size="small" title="ค่าข้อมูลเดิม (Old/Previous Values)" headStyle={{ background: "#fef2f2", color: "#991b1b" }}>
                                        <pre style={{
                                            margin: 0,
                                            padding: "12px",
                                            background: "#1e293b",
                                            color: "#f87171",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontFamily: "Courier, monospace",
                                            maxHeight: "350px",
                                            overflowY: "auto"
                                        }}>
                                            {formatJson(selectedLog.oldValues)}
                                        </pre>
                                    </Card>
                                </Col>
                            )}
                        </Row>
                    </div>
                )}
            </Modal>
        </div>
    );
}
