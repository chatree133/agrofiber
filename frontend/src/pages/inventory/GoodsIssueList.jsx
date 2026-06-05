import React, { useEffect, useState } from "react";
import { PlusOutlined, EyeOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Input, Row, Select, Space, Table, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useGoodsIssue } from "../../context/GoodsIssueContext.jsx";
import { useWarehouse } from "../../context/WarehouseContext.jsx";

const { Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function GoodsIssueList() {
    const navigate = useNavigate();
    const { getGoodsIssues, getGoodsIssueTypes } = useGoodsIssue();
    const { getWarehouses } = useWarehouse();

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [giTypes, setGiTypes] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    // Filter states
    const [search, setSearch] = useState("");
    const [typeId, setTypeId] = useState(undefined);
    const [status, setStatus] = useState(undefined);
    const [dates, setDates] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    const fetchGiTypes = async () => {
        try {
            const data = await getGoodsIssueTypes();
            setGiTypes(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const data = await getWarehouses();
            setWarehouses(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchGoodsIssues = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                pageSize,
                search: search || undefined,
                goodsIssueTypeId: typeId || undefined,
                status: status || undefined,
                dateFrom: dates?.[0]?.format("YYYY-MM-DD") || undefined,
                dateTo: dates?.[1]?.format("YYYY-MM-DD") || undefined,
            };
            const res = await getGoodsIssues(params);
            setData(res.data || []);
            setTotal(res.pagination?.total || 0);
        } catch (err) {
            message.error("โหลดข้อมูลใบจ่ายสินค้าล้มเหลว: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGiTypes();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        fetchGoodsIssues();
    }, [page, pageSize, typeId, status, dates]);

    const getStatusTag = (status) => {
        const statuses = {
            draft: { label: "ร่าง", color: "default" },
            requested: { label: "ขออนุมัติ", color: "orange" },
            approved: { label: "อนุมัติแล้ว", color: "blue" },
            issued: { label: "ตัดสต็อกแล้ว", color: "success" },
            cancelled: { label: "ยกเลิก", color: "error" },
        };
        const config = statuses[status] || { label: status, color: "default" };
        return <Tag color={config.color}>{config.label}</Tag>;
    };

    const columns = [
        {
            title: "เลขที่เอกสาร",
            dataIndex: "documentNo",
            key: "documentNo",
            render: (text, record) => (
                <Button type="link" onClick={() => navigate(`/inventory/goods-issues/${record.id}`)} style={{ padding: 0 }}>
                    {text}
                </Button>
            ),
        },
        {
            title: "ประเภทธุรกรรม",
            dataIndex: "goodsIssueTypeName",
            key: "goodsIssueTypeName",
            render: (text, record) => (
                <Tag color="cyan">{text || record.goodsIssueTypeCode}</Tag>
            ),
        },
        {
            title: "คลังสินค้า",
            dataIndex: "warehouseName",
            key: "warehouseName",
        },
        {
            title: "วันที่แจ้งเบิก",
            dataIndex: "requestDate",
            key: "requestDate",
            render: (val) => val ? new Date(val).toLocaleDateString("th-TH") : "-",
        },
        {
            title: "วันที่ตัดสต็อก",
            dataIndex: "issueDate",
            key: "issueDate",
            render: (val) => val ? new Date(val).toLocaleDateString("th-TH") : "-",
        },
        {
            title: "สถานะ",
            dataIndex: "status",
            key: "status",
            render: (val) => getStatusTag(val),
        },
        {
            title: "รายละเอียดเพิ่มเติม",
            dataIndex: "remark",
            key: "remark",
            ellipsis: true,
        },
        {
            title: "การจัดการ",
            key: "action",
            render: (_, record) => (
                <Space size="middle">
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/inventory/goods-issues/${record.id}`)}
                    >
                        ดูรายละเอียด
                    </Button>
                    {record.status === "draft" && (
                        <Button
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => navigate(`/inventory/goods-issues/${record.id}/edit`)}
                        >
                            แก้ไข
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card className="shadow-sm border-slate-100" style={{ borderRadius: "8px" }}>
            <div className="flex justify-between items-center mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        ใบจ่ายสินค้า (Goods Issue)
                    </h1>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        การตัดสต็อกสินค้าแมนนวล เช่น เบิกชดเชยลูกค้า เบิกตัวอย่าง หรือเบิกใช้ภายใน
                    </Paragraph>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/inventory/goods-issues/create")}>
                    สร้างใบจ่ายสินค้า
                </Button>
            </div>

            <Card style={{ marginBottom: "20px", background: "#fafafa" }} bodyStyle={{ padding: "16px" }}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <div style={{ marginBottom: "4px" }}>ค้นหาเอกสาร:</div>
                        <Input.Search
                            placeholder="ค้นหา เลขที่เอกสาร, ลูกค้า..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onSearch={fetchGoodsIssues}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div style={{ marginBottom: "4px" }}>ประเภทธุรกรรม:</div>
                        <Select
                            placeholder="ทั้งหมด"
                            style={{ width: "100%" }}
                            value={typeId}
                            onChange={setTypeId}
                            allowClear
                        >
                            {giTypes.filter(t => t.isActive).map((t) => (
                                <Select.Option key={t.goodsIssueTypeId} value={t.goodsIssueTypeId}>
                                    {t.goodsIssueTypeName}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div style={{ marginBottom: "4px" }}>สถานะ:</div>
                        <Select
                            placeholder="ทั้งหมด"
                            style={{ width: "100%" }}
                            value={status}
                            onChange={setStatus}
                            allowClear
                        >
                            <Select.Option value="draft">ร่าง (Draft)</Select.Option>
                            <Select.Option value="requested">ขออนุมัติ (Requested)</Select.Option>
                            <Select.Option value="approved">อนุมัติแล้ว (Approved)</Select.Option>
                            <Select.Option value="issued">ตัดสต็อกแล้ว (Issued)</Select.Option>
                            <Select.Option value="cancelled">ยกเลิก (Cancelled)</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div style={{ marginBottom: "4px" }}>ช่วงเวลา:</div>
                        <RangePicker
                            style={{ width: "100%" }}
                            value={dates}
                            onChange={setDates}
                        />
                    </Col>
                </Row>
            </Card>

            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                    showSizeChanger: true,
                }}
            />
        </Card>
    );
}
