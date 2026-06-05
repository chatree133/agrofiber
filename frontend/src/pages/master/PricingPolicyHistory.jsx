import {
    EyeOutlined,
    DownloadOutlined,
    SearchOutlined,
    ReloadOutlined,
    FileTextOutlined,
    FolderOpenOutlined,
} from "@ant-design/icons";
import { Button, Card, Input, Space, Table, Typography, message, Tabs, Switch, Tag, Row, Col, Tooltip, Modal } from "antd";
import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import { useItem } from "../../context/ItemContext.jsx";

const { Text } = Typography;

function toCsvValue(value) {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function downloadCsv(filename, headers, rows) {
    const csv =
        `${headers.map(toCsvValue).join(",")}\n` +
        rows
            .map((r) => headers.map((h) => toCsvValue(r[h])).join(","))
            .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function PricingPolicyHistory() {
    const {
        getItemPricingPolicyHistory,
        getItemPricingPoliciesByVersionNo,
        getPriceLists,
        getPriceListItems,
        togglePriceList,
        togglePriceListItem
    } = useItem();

    const [activeTab, setActiveTab] = useState("upload_history");

    // Tab 1: Upload History States
    const [versionNoSearch, setVersionNoSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);

    // Tab 2: Price Structure States
    const [priceLists, setPriceLists] = useState([]);
    const [selectedPriceList, setSelectedPriceList] = useState(null);
    const [priceListItems, setPriceListItems] = useState([]);
    const [priceListsLoading, setPriceListsLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleExport = async (versionNo) => {
        setLoading(true);
        try {
            const data = await getItemPricingPoliciesByVersionNo(versionNo);
            const list = Array.isArray(data) ? data : [];
            if (list.length === 0) {
                message.warning("ไม่พบรายการสำหรับ VersionNo นี้");
                return;
            }

            const headers = [
                "id",
                "versionNo",
                "createdAt",
                "status",
                "itemId",
                "itemCode",
                "itemName",
                "itemSpecId",
                "salesSku",
                "pricingMethodId",
                "pricingMethodCode",
                "pricingMethodName",
                "priority",
                "remark",
                "standardPrice",
                "standardCost",
                "minMarginPercent",
                "targetMarginPercent",
                "minMarkupPercent",
                "targetMarkupPercent",
                "currencyCode",
                "effectiveFrom",
                "effectiveTo",
                "isActive",
            ];

            downloadCsv(
                `item_pricing_policies_${versionNo}.csv`,
                headers,
                list,
            );
        } catch (err) {
            message.error("Export CSV ไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    const columns = useMemo(
        () => [
            {
                title: "",
                key: "export",
                align: "center",
                width: 80,
                render: (_, record) => (
                    <Space>
                        <Tooltip title="ดาวน์โหลดไฟล์อัปโหลดในอดีต (CSV)">
                            <DownloadOutlined
                                className="text-blue-600 cursor-pointer hover:text-blue-700 text-lg"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExport(record.versionNo);
                                }}
                            />
                        </Tooltip>
                    </Space>
                ),
            },
            {
                title: "เลขที่ Version",
                dataIndex: "versionNo",
                key: "versionNo",
                width: 180,
                render: (val) => <Text strong className="text-slate-800">{val}</Text>
            },
            {
                title: "ถูกสร้างเมื่อ",
                dataIndex: "createdAt",
                key: "createdAt",
                width: 180,
                render: (val) => val ? (
                    <div>
                        <Text block style={{ fontSize: '13px', color: '#475569' }}>{dayjs(val).format('DD/MM/YYYY')}</Text>
                        <Text type="secondary" style={{ fontSize: '11px', marginLeft: '4px' }}>{dayjs(val).format('HH:mm น.')}</Text>
                    </div>
                ) : '-'
            },
            {
                title: "อัพโหลดโดย",
                dataIndex: "createdByName",
                key: "createdByName",
                width: 180,
                render: (value, record) =>
                    value ||
                    (record.createdBy ? `UserId ${record.createdBy}` : "-"),
            },
            {
                title: "จำนวนรายการ",
                dataIndex: "totalCount",
                key: "totalCount",
                width: 120,
                align: "right",
                render: (val) => <Text strong>{val?.toLocaleString()}</Text>
            },
            {
                title: "สถานะ",
                dataIndex: "status",
                key: "status",
                width: 120,
                render: (status) => {
                    const colors = {
                        draft: { bg: "#f3f4f6", text: "#4b5563", label: "ร่าง" },
                        requested: { bg: "#ffedd5", text: "#d97706", label: "รออนุมัติ" },
                        approved: { bg: "#dcfce7", text: "#15803d", label: "อนุมัติแล้ว" },
                        rejected: { bg: "#fee2e2", text: "#b91c1c", label: "ไม่อนุมัติ" },
                    };
                    const config = colors[status] || { bg: "#f3f4f6", text: "#4b5563", label: status || "ร่าง" };
                    return (
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 12px",
                                borderRadius: "9999px",
                                fontSize: "12px",
                                fontWeight: "600",
                                backgroundColor: config.bg,
                                color: config.text,
                                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            }}
                        >
                            {config.label}
                        </span>
                    );
                }
            },
        ],
        [handleExport],
    );

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await getItemPricingPolicyHistory({
                page: 1,
                pageSize: 200,
                versionNo: versionNoSearch || undefined,
            });
            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            message.error("โหลด pricing policy history ไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    // Tab 2: Pricing Structure Logic
    const loadPriceLists = async () => {
        setPriceListsLoading(true);
        try {
            const res = await getPriceLists();
            const lists = Array.isArray(res) ? res : [];
            setPriceLists(lists);
        } catch (err) {
            message.error("โหลดข้อมูลสมุดราคาล้มเหลว");
        } finally {
            setPriceListsLoading(false);
        }
    };

    const loadPriceListItems = async (priceListId) => {
        setItemsLoading(true);
        try {
            const res = await getPriceListItems(priceListId);
            setPriceListItems(Array.isArray(res) ? res : []);
        } catch (err) {
            message.error("โหลดรายการสินค้าในสมุดราคาล้มเหลว");
        } finally {
            setItemsLoading(false);
        }
    };

    const handleTogglePriceList = async (priceListId, checked) => {
        try {
            await togglePriceList(priceListId, checked);
            message.success(checked ? "เปิดใช้งานสมุดราคาเรียบร้อย" : "ปิดใช้งานสมุดราคาเรียบร้อย");
            loadPriceLists();
        } catch (err) {
            message.error("ปรับปรุงสถานะสมุดราคาล้มเหลว");
        }
    };

    const handleTogglePriceListItem = async (priceListItemId, checked) => {
        try {
            await togglePriceListItem(priceListItemId, checked);
            message.success(checked ? "เปิดใช้งานรายการราคาสินค้าเรียบร้อย" : "ปิดใช้งานรายการราคาสินค้าเรียบร้อย");
            if (selectedPriceList) {
                loadPriceListItems(selectedPriceList.PriceListId);
            }
        } catch (err) {
            message.error("ปรับปรุงสถานะรายการราคาสินค้าล้มเหลว");
        }
    };

    useEffect(() => {
        loadHistory();
        loadPriceLists();
    }, []);

    useEffect(() => {
        if (selectedPriceList && isModalOpen) {
            loadPriceListItems(selectedPriceList.PriceListId);
        } else {
            setPriceListItems([]);
        }
    }, [selectedPriceList?.PriceListId, isModalOpen]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        จัดการโครงสร้างราคาและการอัปโหลด
                    </h1>
                </div>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: "upload_history",
                        label: "ประวัติการอัพโหลดราคาโครงสร้าง",
                        children: (
                            <div className="space-y-4 pt-2">
                                <div className="flex max-w-[560px]">
                                    <Input
                                        allowClear
                                        placeholder="ค้นหา VersionNo"
                                        value={versionNoSearch}
                                        onChange={(e) => setVersionNoSearch(e.target.value)}
                                        onPressEnter={() => {
                                            loadHistory();
                                        }}
                                        className="rounded-r-none"
                                    />
                                    <Button
                                        type="primary"
                                        icon={<SearchOutlined />}
                                        className="rounded-l-none"
                                        onClick={() => {
                                            loadHistory();
                                        }}
                                    />
                                </div>

                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                    <Table
                                        columns={columns}
                                        dataSource={rows}
                                        rowKey="versionNo"
                                        loading={loading}
                                        pagination={{ pageSize: 15 }}
                                        size="small"
                                        scroll={{ x: 900 }}
                                    />
                                </div>
                            </div>
                        )
                    },
                    {
                        key: "price_structure",
                        label: "โครงสร้างราคา",
                        children: (
                            <div className="pt-2">
                                <Card
                                    title="รายการสมุดราคาขายจริง (Live Price Lists)"
                                    className="shadow-sm border-slate-200"
                                    extra={
                                        <Button
                                            icon={<ReloadOutlined />}
                                            size="small"
                                            onClick={loadPriceLists}
                                            loading={priceListsLoading}
                                        >
                                            โหลดใหม่
                                        </Button>
                                    }
                                    bodyStyle={{ padding: 0 }}
                                >
                                    <Table
                                        dataSource={priceLists}
                                        rowKey="PriceListId"
                                        loading={priceListsLoading}
                                        pagination={{ pageSize: 10 }}
                                        size="small"
                                        scroll={{ x: 1000 }}
                                        columns={[
                                            {
                                                title: "รหัสสมุดราคา",
                                                dataIndex: "PriceListCode",
                                                key: "PriceListCode",
                                                width: 250,
                                                render: (text) => <Text strong className="text-slate-800">{text}</Text>
                                            },
                                            {
                                                title: "ชื่อสมุดราคา",
                                                dataIndex: "PriceListName",
                                                key: "PriceListName",
                                                render: (text) => <Text className="text-slate-700">{text}</Text>
                                            },
                                            {
                                                title: "กลุ่มราคาขายลูกค้า",
                                                dataIndex: "PriceGroupName",
                                                key: "PriceGroupName",
                                                width: 200,
                                                render: (text) => text ? <Tag color="blue">{text}</Tag> : <Tag color="default">ทั่วไป (Standard Price List)</Tag>
                                            },
                                            {
                                                title: "สกุลเงิน",
                                                dataIndex: "CurrencyCode",
                                                key: "CurrencyCode",
                                                width: 100,
                                                align: "center",
                                                render: (text) => <Tag color="cyan">{text || 'THB'}</Tag>
                                            },
                                            {
                                                title: "เปิดใช้งานสมุดราคา",
                                                dataIndex: "IsActive",
                                                key: "IsActive",
                                                width: 150,
                                                align: "center",
                                                fixed: "right",
                                                render: (val, record) => (
                                                    <Switch
                                                        size="small"
                                                        checked={Boolean(val)}
                                                        onChange={(checked) => handleTogglePriceList(record.PriceListId, checked)}
                                                    />
                                                )
                                            },
                                            {
                                                title: "รายการสินค้า",
                                                key: "actions",
                                                width: 150,
                                                align: "center",
                                                fixed: "right",
                                                render: (_, record) => (
                                                    <Button
                                                        type="primary"
                                                        ghost
                                                        size="small"
                                                        icon={<EyeOutlined />}
                                                        onClick={() => {
                                                            setSelectedPriceList(record);
                                                            setIsModalOpen(true);
                                                        }}
                                                    >
                                                        ดูราคาสินค้า
                                                    </Button>
                                                )
                                            }
                                        ]}
                                    />
                                </Card>
                            </div>
                        )
                    }
                ]}
            />

            {/* Price List Items Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <FolderOpenOutlined className="text-blue-600 text-lg" />
                        <span>
                            ราคาสินค้าในสมุดราคา: <Text strong className="text-blue-600">{selectedPriceList?.PriceListName}</Text> ({selectedPriceList?.PriceListCode})
                        </span>
                    </div>
                }
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    setSelectedPriceList(null);
                }}
                footer={[
                    <Button
                        key="close"
                        type="primary"
                        onClick={() => {
                            setIsModalOpen(false);
                            setSelectedPriceList(null);
                        }}
                    >
                        ปิดหน้าต่าง
                    </Button>
                ]}
                width={1100}
                centered
            >
                <div className="space-y-4 py-2">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Space direction="vertical" size={2}>
                            <Text type="secondary" className="text-xs">สมุดราคานี้อิงกลุ่มลูกค้า:</Text>
                            <Text strong className="text-slate-700">{selectedPriceList?.PriceGroupName || "ทั่วไป (Standard)"}</Text>
                        </Space>
                        <Button
                            type="dashed"
                            icon={<ReloadOutlined />}
                            onClick={() => selectedPriceList && loadPriceListItems(selectedPriceList.PriceListId)}
                            loading={itemsLoading}
                            size="small"
                        >
                            รีเฟรชข้อมูลสินค้า
                        </Button>
                    </div>

                    <Table
                        dataSource={priceListItems}
                        rowKey="PriceListItemId"
                        loading={itemsLoading}
                        pagination={{ pageSize: 8, showSizeChanger: true }}
                        size="small"
                        scroll={{ x: 1250 }}
                        columns={[
                            {
                                title: "รหัส SKU",
                                dataIndex: "SalesSKU",
                                key: "SalesSKU",
                                width: 280,
                                render: (val, record) => <Text strong className="text-slate-800">{val || record.ItemCode}</Text>
                            },
                            {
                                title: "ชื่อสินค้า",
                                key: "ItemName",
                                ellipsis: true,
                                render: (_, record) => record.SpecName ? `${record.ItemName} - ${record.SpecName}` : record.ItemName
                            },
                            {
                                title: "หน่วยขาย",
                                dataIndex: "UnitCode",
                                key: "UnitCode",
                                width: 90,
                                align: "center",
                                render: (text) => text ? <Tag color="purple">{text}</Tag> : "-"
                            },
                            {
                                title: "ราคาเสนอขาย",
                                dataIndex: "UnitPrice",
                                key: "UnitPrice",
                                width: 130,
                                align: "right",
                                render: (val) => (
                                    <Text strong className="text-teal-600">
                                        {Number(val || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </Text>
                                )
                            },
                            {
                                title: "ราคาทุน",
                                dataIndex: "UnitCost",
                                key: "UnitCost",
                                width: 110,
                                align: "right",
                                render: (val) => Number(val || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })
                            },
                            {
                                title: "วิธีการตั้งราคา",
                                dataIndex: "PricingMethod",
                                key: "PricingMethod",
                                width: 120,
                                render: (text) => text ? <Tag color="cyan">{text}</Tag> : "-"
                            },
                            {
                                title: "มีผลตั้งแต่",
                                dataIndex: "EffectiveFrom",
                                key: "EffectiveFrom",
                                width: 120,
                                render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : "-"
                            },
                            {
                                title: "สถานะสินค้า",
                                dataIndex: "IsActive",
                                key: "IsActive",
                                width: 110,
                                align: "center",
                                fixed: "right",
                                render: (val, record) => (
                                    <Switch
                                        size="small"
                                        checked={Boolean(val)}
                                        onChange={(checked) => handleTogglePriceListItem(record.PriceListItemId, checked)}
                                    />
                                )
                            }
                        ]}
                    />
                </div>
            </Modal>
        </div>
    );
}
