import React, { useEffect, useState } from "react";
import { ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, SendOutlined, PlayCircleOutlined, PrinterOutlined, StopOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, Divider, Modal, Row, Space, Table, Tag, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useGoodsIssue } from "../../context/GoodsIssueContext.jsx";

const { Title, Paragraph, Text } = Typography;

export default function GoodsIssueDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getGoodsIssue, getGoodsIssueStatusHistory, requestGoodsIssueApproval, approveGoodsIssue, postGoodsIssue, cancelGoodsIssue } = useGoodsIssue();

    const [loading, setLoading] = useState(false);
    const [goodsIssue, setGoodsIssue] = useState(null);
    const [statusHistory, setStatusHistory] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const [detailRes, historyRes] = await Promise.all([
                getGoodsIssue(id),
                getGoodsIssueStatusHistory(id),
            ]);
            setGoodsIssue(detailRes);
            setStatusHistory(historyRes || []);
        } catch (err) {
            message.error("โหลดรายละเอียดใบจ่ายสินค้าล้มเหลว: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const handleRequestApproval = async () => {
        setActionLoading(true);
        try {
            await requestGoodsIssueApproval(id);
            message.success("เสนอขออนุมัติการจ่ายสินค้าแล้ว");
            fetchDetails();
        } catch (err) {
            message.error("ส่งอนุมัติล้มเหลว: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await approveGoodsIssue(id);
            message.success("อนุมัติใบจ่ายสินค้าและสร้างงานเบิกจ่าย WMS Picking เรียบร้อยแล้ว");
            fetchDetails();
        } catch (err) {
            message.error("อนุมัติล้มเหลว: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handlePostIssue = async () => {
        setActionLoading(true);
        try {
            await postGoodsIssue(id);
            message.success("โพสต์ตัดสต็อกออกเรียบร้อยแล้ว");
            fetchDetails();
        } catch (err) {
            message.error("โพสต์ตัดสต็อกล้มเหลว: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = () => {
        Modal.confirm({
            title: "ยืนยันการยกเลิกใบจ่ายสินค้า",
            content: "ต้องการยกเลิกเอกสารนี้หรือไม่? (ยังไม่ตัดสต็อก)",
            okText: "ยกเลิกเอกสาร",
            okType: "danger",
            cancelText: "ปิด",
            onOk: async () => {
                setActionLoading(true);
                try {
                    await cancelGoodsIssue(id);
                    message.success("ยกเลิกใบจ่ายสินค้าเรียบร้อยแล้ว");
                    fetchDetails();
                } catch (err) {
                    message.error("ยกเลิกล้มเหลว: " + err.message);
                } finally {
                    setActionLoading(false);
                }
            },
        });
    };

    const getStatusTag = (status) => {
        const statuses = {
            draft: { label: "ร่าง (Draft)", color: "default" },
            requested: { label: "รออนุมัติ (Requested)", color: "orange" },
            approved: { label: "อนุมัติแล้ว (Approved)", color: "blue" },
            issued: { label: "ตัดสต็อกแล้ว (Issued)", color: "success" },
            cancelled: { label: "ยกเลิก (Cancelled)", color: "error" },
        };
        const config = statuses[status] || { label: status, color: "default" };
        return <Tag color={config.color} style={{ fontSize: "14px", padding: "4px 8px" }}>{config.label}</Tag>;
    };

    if (loading && !goodsIssue) {
        return <Card loading={true} style={{ borderRadius: "8px" }} />;
    }

    if (!goodsIssue) {
        return (
            <Card style={{ borderRadius: "8px", textAlign: "center" }}>
                <Title level={4} type="danger">ไม่พบเอกสารใบจ่ายสินค้า</Title>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory/goods-issues")}>กลับสู่รายการ</Button>
            </Card>
        );
    }

    const columns = [
        {
            title: "#",
            key: "index",
            width: "50px",
            render: (_, __, idx) => idx + 1,
        },
        // {
        //     title: "รหัสสินค้า / SKU",
        //     dataIndex: "salesSKU",
        //     key: "salesSKU",
        //     render: (text) => <Text strong>{text}</Text>
        // },
        // {
        //     title: "ชื่อสินค้า",
        //     dataIndex: "itemName",
        //     key: "itemName",
        // },
        {
            title: "รหัสสินค้า / SKU / ชื่อสินค้า",
            dataIndex: "specName",
            key: "specName",
            render: (val, record) => <><div><Text strong>{record.salesSKU}</Text></div><div><Text>{record.itemName} - {record.specName}</Text></div></>
        },
        {
            title: "หน่วย",
            dataIndex: "unitName",
            key: "unitName",
        },
        {
            title: "จำนวนแจ้งเบิก",
            dataIndex: "requestedQuantity",
            key: "requestedQuantity",
            render: (val) => Number(val).toLocaleString(),
        },
        {
            title: "จำนวนที่เบิกจริง",
            dataIndex: "issuedQuantity",
            key: "issuedQuantity",
            render: (val) => Number(val).toLocaleString(),
        },
        {
            title: "คลัง/ตำแหน่งจัดเก็บ",
            key: "location",
            render: (_, record) => record.locationCode ? `${record.warehouseCode || ""} / ${record.locationCode}` : "-",
        },
        {
            title: "ล็อตสินค้า",
            dataIndex: "lotNo",
            key: "lotNo",
            render: (val) => val || "-",
        },
        {
            title: "หมายเหตุรายการ",
            dataIndex: "remark",
            key: "remark",
            render: (val) => val || "-",
        },
    ];

    const historyColumns = [
        {
            title: "สถานะเดิม",
            dataIndex: "fromStatus",
            key: "fromStatus",
            render: (val) => val ? getStatusTag(val) : "-",
        },
        {
            title: "สถานะใหม่",
            dataIndex: "toStatus",
            key: "toStatus",
            render: (val) => getStatusTag(val),
        },
        {
            title: "ผู้ดำเนินการ",
            dataIndex: "changedByName",
            key: "changedByName",
        },
        {
            title: "วันที่/เวลาดำเนินการ",
            dataIndex: "changedAt",
            key: "changedAt",
            render: (val) => val ? new Date(val).toLocaleString("th-TH") : "-",
        },
        {
            title: "บันทึกเพิ่มเติม",
            dataIndex: "notes",
            key: "notes",
            render: (val) => val || "-",
        },
    ];

    return (
        <Card className="shadow-sm border-slate-100" style={{ borderRadius: "8px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory/goods-issues")} style={{ marginRight: "12px" }} />
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">
                            ใบจ่ายสินค้า: {goodsIssue.documentNo}
                        </h1>
                        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            วัตถุประสงค์: <Tag color="cyan">{goodsIssue.goodsIssueTypeName}</Tag>
                        </Paragraph>
                    </div>
                </div>
                <div>
                    {getStatusTag(goodsIssue.status)}
                </div>
            </div>

            {/* General Info */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: "24px" }}>
                <Descriptions.Item label="สาขา">{goodsIssue.branchName || "-"}</Descriptions.Item>
                <Descriptions.Item label="คลังสินค้าต้นทาง">{goodsIssue.warehouseName}</Descriptions.Item>
                <Descriptions.Item label="ลูกค้า">{goodsIssue.customerName ? `[${goodsIssue.customerCode}] ${goodsIssue.customerName}` : "-"}</Descriptions.Item>
                <Descriptions.Item label="วันที่แจ้งเบิก">{goodsIssue.requestDate ? new Date(goodsIssue.requestDate).toLocaleDateString("th-TH") : "-"}</Descriptions.Item>
                <Descriptions.Item label="วันที่ตัดจ่ายจริง">{goodsIssue.issueDate ? new Date(goodsIssue.issueDate).toLocaleDateString("th-TH") : "-"}</Descriptions.Item>
                <Descriptions.Item label="ผู้สร้างเอกสาร">{goodsIssue.createdByName ? `${goodsIssue.createdByName} (${goodsIssue.createdBy})` : goodsIssue.createdBy || "-"}</Descriptions.Item>
                <Descriptions.Item label="ผู้ตัดจ่ายจริง">{goodsIssue.postedByName ? `${goodsIssue.postedByName} (${goodsIssue.postedBy})` : goodsIssue.postedBy || "-"}</Descriptions.Item>
                <Descriptions.Item label="สร้างเมื่อ">{goodsIssue.createdAt ? new Date(goodsIssue.createdAt).toLocaleString("th-TH") : "-"}</Descriptions.Item>
                <Descriptions.Item label="คำชี้แจง / หมายเหตุ" span={2}>{goodsIssue.remark || "-"}</Descriptions.Item>
            </Descriptions>

            {/* Actions Bar */}
            <Card style={{ marginBottom: "24px", background: "#f8fafc" }} bodyStyle={{ padding: "12px 24px" }}>
                <Space size="middle">
                    {goodsIssue.status === "draft" && (
                        <>
                            <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/inventory/goods-issues/${id}/edit`)}>
                                แก้ไขข้อมูลเอกสาร
                            </Button>
                            <Button
                                type="primary"
                                ghost
                                icon={<SendOutlined />}
                                loading={actionLoading}
                                onClick={handleRequestApproval}
                            >
                                ขออนุมัติเบิกจ่าย (Request Approval)
                            </Button>
                        </>
                    )}

                    {goodsIssue.status === "requested" && (
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            loading={actionLoading}
                            onClick={handleApprove}
                        >
                            อนุมัติและสร้างงานเบิกจ่ายคลัง (Approve)
                        </Button>
                    )}

                    {goodsIssue.status === "approved" && (
                        <Button
                            type="primary"
                            color="success"
                            icon={<PlayCircleOutlined />}
                            loading={actionLoading}
                            onClick={handlePostIssue}
                        >
                            โพสต์ตัดยอดจ่ายสินค้าคงคลัง (Post Goods Issue)
                        </Button>
                    )}

                    {["draft", "requested", "approved"].includes(goodsIssue.status) && (
                        <Button
                            danger
                            icon={<StopOutlined />}
                            loading={actionLoading}
                            onClick={handleCancel}
                        >
                            ยกเลิกเอกสาร
                        </Button>
                    )}

                    {goodsIssue.status === "issued" && (
                        <Text type="success" strong>
                            <CheckCircleOutlined /> เอกสารถูกตัดสต็อกเรียบร้อยแล้ว
                        </Text>
                    )}

                    <Button
                        icon={<PrinterOutlined />}
                        onClick={() => window.open(`/document/print?form=GI&docId=${id}`, '_blank')}
                    >
                        พิมพ์รายการ (Print)
                    </Button>
                </Space>
            </Card>

            {/* Items Table */}
            <Title level={4} style={{ marginBottom: "12px" }}>รายการสินค้าในเอกสาร</Title>
            <Table
                columns={columns}
                dataSource={goodsIssue.lines || []}
                rowKey="id"
                pagination={false}
                bordered
                style={{ marginBottom: "32px" }}
                size="small"
            />

            {/* Status History */}
            <Title level={4} style={{ marginBottom: "12px" }}>ประวัติการดำเนินการเอกสาร</Title>
            <Table
                columns={historyColumns}
                dataSource={statusHistory}
                rowKey="id"
                pagination={false}
                bordered
                size="small"
            />
        </Card>
    );
}
