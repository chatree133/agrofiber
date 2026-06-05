import React, { useEffect, useState } from "react";
import { ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, PlayCircleOutlined, PrinterOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, Divider, Row, Space, Table, Tag, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useGoodsReceipt } from "../../context/GoodsReceiptContext.jsx";

const { Title, Paragraph, Text } = Typography;

export default function GoodsReceiptDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getGoodsReceipt, getGoodsReceiptStatusHistory, postGoodsReceipt } = useGoodsReceipt();

    const [loading, setLoading] = useState(false);
    const [goodsReceipt, setGoodsReceipt] = useState(null);
    const [statusHistory, setStatusHistory] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const [detailRes, historyRes] = await Promise.all([
                getGoodsReceipt(id),
                getGoodsReceiptStatusHistory(id),
            ]);
            setGoodsReceipt(detailRes);
            setStatusHistory(historyRes || []);
        } catch (err) {
            message.error("โหลดรายละเอียดใบรับสินค้าล้มเหลว: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const handlePostReceipt = async () => {
        setActionLoading(true);
        try {
            await postGoodsReceipt(id);
            message.success("โพสต์รับสินค้าเข้าคลังเรียบร้อยแล้ว");
            fetchDetails();
        } catch (err) {
            message.error("โพสต์รับสินค้าล้มเหลว: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusTag = (status) => {
        const statuses = {
            draft: { label: "ร่าง (Draft)", color: "default" },
            received: { label: "รับสินค้าแล้ว (Received)", color: "blue" },
            posted: { label: "โพสต์เข้าคลังแล้ว (Posted)", color: "success" },
            cancelled: { label: "ยกเลิก (Cancelled)", color: "error" },
        };
        const config = statuses[status] || { label: status, color: "default" };
        return <Tag color={config.color} style={{ fontSize: "14px", padding: "4px 8px" }}>{config.label}</Tag>;
    };

    if (loading && !goodsReceipt) {
        return <Card loading={true} style={{ borderRadius: "8px" }} />;
    }

    if (!goodsReceipt) {
        return (
            <Card style={{ borderRadius: "8px", textAlign: "center" }}>
                <Title level={4} type="danger">ไม่พบเอกสารใบรับสินค้า</Title>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory/goods-receipts")}>กลับสู่รายการ</Button>
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
        {
            title: "รหัสสินค้า / SKU / ชื่อสินค้า",
            dataIndex: "specName",
            key: "specName",
            render: (val, record) => <>
                <div><Text strong>{record.salesSKU || record.itemCode}</Text></div>
                <div><Text>{record.itemName}{record.specName ? ` - ${record.specName}` : ""}</Text></div>
            </>
        },
        {
            title: "หน่วย",
            dataIndex: "unitName",
            key: "unitName",
        },
        {
            title: "จำนวนรับสินค้า",
            dataIndex: "receivedQuantity",
            key: "receivedQuantity",
            render: (val) => Number(val).toLocaleString(),
        },
        {
            title: "ต้นทุน/หน่วย (บาท)",
            dataIndex: "unitCostSnapshot",
            key: "unitCostSnapshot",
            render: (val) => val ? `${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "0.00",
        },
        {
            title: "ราคารวม (บาท)",
            key: "totalCost",
            render: (_, record) => {
                const total = Number(record.receivedQuantity || 0) * Number(record.unitCostSnapshot || 0);
                return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        },
        {
            title: "ตำแหน่งจัดเก็บ (Location)",
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
        {
            title: "จัดการ",
            key: "action",
            align: "center",
            width: "120px",
            render: (_, record) => (
                <Button 
                    type="primary" 
                    ghost 
                    icon={<PrinterOutlined />} 
                    onClick={() => window.open(`/document/print?form=LABEL&docId=${id}&lineId=${record.id}`, '_blank')}
                    size="small"
                >
                    พิมพ์ลาเบล
                </Button>
            )
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
            render: (val, record) => val ? `${val} (${record.changedBy})` : record.changedBy || "-",
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
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory/goods-receipts")} style={{ marginRight: "12px" }} />
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">
                            ใบรับสินค้า: {goodsReceipt.documentNo}
                        </h1>
                        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            วัตถุประสงค์: <Tag color="cyan">{goodsReceipt.goodsReceiptTypeName}</Tag>
                        </Paragraph>
                    </div>
                </div>
                <div>
                    {getStatusTag(goodsReceipt.status)}
                </div>
            </div>

            {/* General Info */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: "24px" }}>
                <Descriptions.Item label="สาขา">{goodsReceipt.branchName || "-"}</Descriptions.Item>
                <Descriptions.Item label="คลังสินค้าจัดเก็บ">{goodsReceipt.warehouseName}</Descriptions.Item>
                <Descriptions.Item label="ผู้จัดจำหน่าย (Vendor)">{goodsReceipt.vendorName ? `[${goodsReceipt.vendorCode}] ${goodsReceipt.vendorName}` : "-"}</Descriptions.Item>
                <Descriptions.Item label="ลูกค้า (Customer)">{goodsReceipt.customerName ? `[${goodsReceipt.customerCode}] ${goodsReceipt.customerName}` : "-"}</Descriptions.Item>
                <Descriptions.Item label="ใบสั่งซื้อ (PO)">{goodsReceipt.purchaseOrderId || "-"}</Descriptions.Item>
                <Descriptions.Item label="วันที่รับสินค้า">{goodsReceipt.receiptDate ? new Date(goodsReceipt.receiptDate).toLocaleDateString("th-TH") : "-"}</Descriptions.Item>
                <Descriptions.Item label="ผู้สร้างเอกสาร">{goodsReceipt.createdByName ? `${goodsReceipt.createdByName} (${goodsReceipt.createdBy})` : goodsReceipt.createdBy || "-"}</Descriptions.Item>
                <Descriptions.Item label="ผู้โพสต์เอกสาร">{goodsReceipt.postedByName ? `${goodsReceipt.postedByName} (${goodsReceipt.postedBy})` : goodsReceipt.postedBy || "-"}</Descriptions.Item>
                <Descriptions.Item label="โพสต์เข้าคลังเมื่อ">{goodsReceipt.postedAt ? new Date(goodsReceipt.postedAt).toLocaleString("th-TH") : "-"}</Descriptions.Item>
                <Descriptions.Item label="สร้างเมื่อ">{goodsReceipt.createdAt ? new Date(goodsReceipt.createdAt).toLocaleString("th-TH") : "-"}</Descriptions.Item>
                <Descriptions.Item label="คำชี้แจง / หมายเหตุ" span={2}>{goodsReceipt.remark || "-"}</Descriptions.Item>
            </Descriptions>

            {/* Actions Bar */}
            <Card style={{ marginBottom: "24px", background: "#f8fafc" }} bodyStyle={{ padding: "12px 24px" }}>
                <Space size="middle">
                    {goodsReceipt.status === "draft" && (
                        <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/inventory/goods-receipts/${id}/edit`)}>
                            แก้ไขข้อมูลเอกสาร
                        </Button>
                    )}

                    {(goodsReceipt.status === "draft" || goodsReceipt.status === "received") && (
                        <Button
                            type="primary"
                            color="success"
                            icon={<PlayCircleOutlined />}
                            loading={actionLoading}
                            onClick={handlePostReceipt}
                        >
                            โพสต์ยอดรับเข้าคลังคงคลัง (Post Goods Receipt)
                        </Button>
                    )}

                    {goodsReceipt.status === "posted" && (
                        <Text type="success" strong>
                            <CheckCircleOutlined /> เอกสารโพสต์เข้าคลังและสร้างงาน Putaway ในระบบ WMS สำเร็จแล้ว
                        </Text>
                    )}
                </Space>
            </Card>

            {/* Items Table */}
            <Title level={4} style={{ marginBottom: "12px" }}>รายการสินค้าในเอกสาร</Title>
            <Table
                columns={columns}
                dataSource={goodsReceipt.lines || []}
                rowKey="id"
                pagination={false}
                bordered
                style={{ marginBottom: "32px" }}
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
