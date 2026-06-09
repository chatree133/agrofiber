import React, { useState, useEffect, useMemo } from "react";
import {
    Card,
    Table,
    Tag,
    Input,
    Select,
    Checkbox,
    Row,
    Col,
    Statistic,
    Typography,
    Button,
    Space,
    Modal,
    Tooltip,
    Empty,
} from "antd";
import {
    DatabaseOutlined,
    HomeOutlined,
    EnvironmentOutlined,
    SearchOutlined,
    ReloadOutlined,
    HistoryOutlined,
    PieChartOutlined,
    InfoCircleOutlined,
    ArrowRightOutlined,
    FileExcelOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "../../context/AuthContext";
import { useWarehouse } from "../../context/WarehouseContext";
import { useWms } from "../../context/WmsContext";
import { useStock } from "../../context/StockContext";

const { Title, Text } = Typography;

export default function StockList() {
    const { authHeaders } = useAuth();
    const { getWarehouses } = useWarehouse();
    const { getWarehouseLocations } = useWms();
    const { getStockOnHand, getStockMovements } = useStock();

    // Search & Filter States
    const [searchText, setSearchText] = useState("");
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [includeZero, setIncludeZero] = useState(false);

    // Data States
    const [stockData, setStockData] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);

    // Movement Modal States
    const [movementModalOpen, setMovementModalOpen] = useState(false);
    const [selectedStockRow, setSelectedStockRow] = useState(null);
    const [movements, setMovements] = useState([]);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [movementPage, setMovementPage] = useState(1);
    const [movementPageSize] = useState(10);
    const [movementTotal, setMovementTotal] = useState(0);

    // Fetch lookups
    useEffect(() => {
        const loadLookups = async () => {
            try {
                const whs = await getWarehouses();
                setWarehouses(whs || []);
            } catch (err) {
                console.error("Failed to load warehouses", err);
            }
        };
        loadLookups();
    }, []);

    // Fetch locations when warehouse changes
    useEffect(() => {
        const loadLocations = async () => {
            if (!selectedWarehouse) {
                setLocations([]);
                setSelectedLocation(null);
                return;
            }
            try {
                const locs = await getWarehouseLocations(selectedWarehouse);
                setLocations(locs || []);
                setSelectedLocation(null); // Reset location selection
            } catch (err) {
                console.error("Failed to load locations", err);
            }
        };
        loadLocations();
    }, [selectedWarehouse]);

    // Fetch stock data
    const fetchStock = async () => {
        setLoading(true);
        try {
            const params = {
                search: searchText || undefined,
                warehouseId: selectedWarehouse || undefined,
                locationId: selectedLocation || undefined,
                includeZero: includeZero ? "true" : "false",
            };
            const response = await getStockOnHand(params);
            setStockData(response.data || []);
        } catch (err) {
            console.error("Failed to fetch stock on hand", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
    }, [selectedWarehouse, selectedLocation, includeZero]);

    const toCsvValue = (value) =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;

    const handleExportCsv = () => {
        const headers = [
            "สินค้า",
            "SKU",
            "คลังสินค้า",
            "ชื่อคลัง",
            "ตำแหน่งจัดเก็บ",
            "LOT",
            "เกรด",
            "คงคลังทั้งหมด (Physical)",
            "ยอดจอง (Reserved)",
            "พร้อมใช้งาน (Available)",
        ];
        const rows = stockData.map((item) => [
            item.itemName
                ? `${item.itemName}${item.specName ? ` - ${item.specName}` : ""}`
                : "",
            item.salesSku || "",
            item.warehouseCode || "",
            item.warehouseName || "",
            item.locationCode || "",
            item.lotNo || "",
            item.gradeName || "",
            item.qtyOnHand ?? "",
            item.qtyReserved ?? "",
            item.qtyAvailable ?? "",
        ]);

        const csv = [headers, ...rows]
            .map((row) => row.map(toCsvValue).join(","))
            .join("\n");

        const link = document.createElement("a");
        link.href = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        link.download = "stock_on_hand.csv";
        link.click();
    };

    // Fetch stock movements for modal
    const fetchMovements = async (page = 1) => {
        if (!selectedStockRow) return;
        setMovementsLoading(true);
        try {
            const params = {
                itemId: selectedStockRow.itemId,
                itemSpecId: selectedStockRow.itemSpecId,
                warehouseId: selectedStockRow.warehouseId || undefined,
                page,
                pageSize: movementPageSize,
            };
            const response = await getStockMovements(params);
            setMovements(response.data || []);
            setMovementTotal(response.pagination?.total || 0);
            setMovementPage(page);
        } catch (err) {
            console.error("Failed to fetch stock movements", err);
        } finally {
            setMovementsLoading(false);
        }
    };

    useEffect(() => {
        if (movementModalOpen && selectedStockRow) {
            fetchMovements(1);
        }
    }, [movementModalOpen, selectedStockRow]);

    // Handle reload
    const handleReload = () => {
        fetchStock();
    };

    // Handle reset filters
    const handleResetFilters = () => {
        setSearchText("");
        setSelectedWarehouse(null);
        setSelectedLocation(null);
        setIncludeZero(false);
    };

    // Statistic Totals
    const { totalPhysical, totalReserved, totalAvailable, totalUniqueItems } =
        useMemo(() => {
            let physical = 0;
            let reserved = 0;
            let available = 0;
            const itemIds = new Set();

            stockData.forEach((item) => {
                physical += Number(item.qtyOnHand || 0);
                reserved += Number(item.qtyReserved || 0);
                available += Number(item.qtyAvailable || 0);
                if (item.salesSku) itemIds.add(item.salesSku);
            });

            return {
                totalPhysical: physical,
                totalReserved: reserved,
                totalAvailable: available,
                totalUniqueItems: itemIds.size,
            };
        }, [stockData]);

    // Main table columns
    const columns = [
        {
            title: "สินค้า",
            key: "itemInfo",
            sorter: (a, b) => a.itemName.localeCompare(b.itemName),
            render: (_, record) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <Text strong style={{ color: "#071d2c" }}>
                        {record.itemName}
                        {record.specName ? ` - ${record.specName}` : ""}
                    </Text>
                    {record.salesSku && (
                        <Tag
                            color="blue"
                            style={{
                                marginTop: "4px",
                                width: "fit-content",
                                fontSize: "11px",
                            }}
                        >
                            SKU: {record.salesSku}
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: "สเปคสินค้า",
            key: "specs",
            render: (_, record) => {
                const hasSpec = record.specCode || record.specName;
                return (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            fontSize: "13px",
                        }}
                    >
                        {hasSpec ? (
                            <>
                                <Text>
                                    {record.specName || record.specCode}
                                </Text>
                                {record.specCode && (
                                    <Text
                                        type="secondary"
                                        style={{ fontSize: "11px" }}
                                    >
                                        โค้ด: {record.specCode}
                                    </Text>
                                )}
                            </>
                        ) : (
                            <Text type="secondary">-</Text>
                        )}
                    </div>
                );
            },
        },
        {
            title: "คลังสินค้า & ตำแหน่งจัดเก็บ",
            key: "warehouseLocation",
            render: (_, record) => (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                    }}
                >
                    <Space size={4}>
                        <HomeOutlined style={{ color: "#0b733e" }} />
                        <Text strong style={{ fontSize: "13px" }}>
                            {record.warehouseCode}
                        </Text>
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                            {record.warehouseName}
                        </Text>
                    </Space>
                    {record.locationCode && (
                        <Tag
                            color="cyan"
                            style={{
                                width: "fit-content",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            <EnvironmentOutlined />
                            {record.locationCode}
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: "ล็อต & เกรด",
            key: "lotGrade",
            render: (_, record) => (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                    }}
                >
                    {record.lotNo ? (
                        <Tag
                            color="purple"
                            style={{ width: "fit-content", fontWeight: "bold" }}
                        >
                            LOT: {record.lotNo}
                        </Tag>
                    ) : (
                        <Text type="secondary">-</Text>
                    )}
                    {record.gradeName && (
                        <Text style={{ fontSize: "12px", color: "#595959" }}>
                            เกรด: {record.gradeName}
                        </Text>
                    )}
                </div>
            ),
        },
        {
            title: "คงคลังทั้งหมด (Physical)",
            dataIndex: "qtyOnHand",
            key: "qtyOnHand",
            align: "right",
            sorter: (a, b) => a.qtyOnHand - b.qtyOnHand,
            render: (val) => (
                <Text strong style={{ fontSize: "14px", color: "#1890ff" }}>
                    {val.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
            ),
        },
        {
            title: "ยอดจอง (Reserved)",
            dataIndex: "qtyReserved",
            key: "qtyReserved",
            align: "right",
            sorter: (a, b) => a.qtyReserved - b.qtyReserved,
            render: (val) => (
                <Text
                    style={{
                        fontSize: "14px",
                        color: val > 0 ? "#fa8c16" : "#bfbfbf",
                    }}
                >
                    {val > 0
                        ? val.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                          })
                        : "0.00"}
                </Text>
            ),
        },
        {
            title: "พร้อมใช้งาน (Available)",
            dataIndex: "qtyAvailable",
            key: "qtyAvailable",
            align: "right",
            sorter: (a, b) => a.qtyAvailable - b.qtyAvailable,
            render: (val) => (
                <Text
                    strong
                    style={{
                        fontSize: "15px",
                        color: val > 0 ? "#52c41a" : "#fa541c",
                    }}
                >
                    {val.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
            ),
        },
        {
            title: "การจัดการ",
            key: "actions",
            align: "center",
            width: 100,
            render: (_, record) => (
                <Tooltip title="ดูประวัติการเคลื่อนไหวสต็อก">
                    <Button
                        type="primary"
                        shape="circle"
                        icon={<HistoryOutlined />}
                        style={{
                            backgroundColor: "#0b733e",
                            borderColor: "#0b733e",
                        }}
                        onClick={() => {
                            setSelectedStockRow(record);
                            setMovementModalOpen(true);
                        }}
                    />
                </Tooltip>
            ),
        },
    ];

    // Movements Table Columns (Modal)
    const movementColumns = [
        {
            title: "วัน-เวลา",
            dataIndex: "createdAt",
            key: "createdAt",
            render: (val) => dayjs(val).format("DD/MM/YYYY HH:mm:ss"),
        },
        {
            title: "ประเภทรายการ",
            dataIndex: "movementType",
            key: "movementType",
            render: (val) => {
                const typeMap = {
                    receipt: { label: "รับสินค้าเข้า", color: "green" },
                    issue: { label: "เบิกสินค้าออก", color: "red" },
                    transfer: { label: "โอนย้ายภายใน", color: "blue" },
                    adjustment: { label: "ปรับปรุงสต็อก", color: "purple" },
                };
                const mapped = typeMap[val.toLowerCase()] || {
                    label: val,
                    color: "default",
                };
                return <Tag color={mapped.color}>{mapped.label}</Tag>;
            },
        },
        {
            title: "เอกสารอ้างอิง",
            key: "reference",
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: "12px" }}>
                        {record.referenceType || "N/A"}
                    </Text>
                    <Text type="secondary" style={{ fontSize: "11px" }}>
                        ID: #{record.referenceId}
                    </Text>
                </Space>
            ),
        },
        {
            title: "คลัง/ตำแหน่ง (ต้นทาง)",
            key: "fromLocation",
            render: (_, record) => {
                if (!record.fromWarehouseCode)
                    return <Text type="secondary">-</Text>;
                return (
                    <div>
                        <Text>{record.fromWarehouseCode}</Text>
                        {record.fromLocationCode && (
                            <Text
                                type="secondary"
                                style={{ fontSize: "11px", display: "block" }}
                            >
                                ({record.fromLocationCode})
                            </Text>
                        )}
                    </div>
                );
            },
        },
        {
            title: "คลัง/ตำแหน่ง (ปลายทาง)",
            key: "toLocation",
            render: (_, record) => {
                if (!record.toWarehouseCode)
                    return <Text type="secondary">-</Text>;
                return (
                    <div>
                        <Text>{record.toWarehouseCode}</Text>
                        {record.toLocationCode && (
                            <Text
                                type="secondary"
                                style={{ fontSize: "11px", display: "block" }}
                            >
                                ({record.toLocationCode})
                            </Text>
                        )}
                    </div>
                );
            },
        },
        {
            title: "เลขล็อต",
            dataIndex: "lotNo",
            key: "lotNo",
            render: (val) =>
                val ? (
                    <Tag color="geekblue">{val}</Tag>
                ) : (
                    <Text type="secondary">-</Text>
                ),
        },
        {
            title: "จำนวน",
            dataIndex: "quantity",
            key: "quantity",
            align: "right",
            render: (val, record) => {
                const isOut = ["issue"].includes(
                    record.movementType.toLowerCase(),
                );
                return (
                    <Text
                        strong
                        style={{ color: isOut ? "#ff4d4f" : "#52c41a" }}
                    >
                        {isOut ? "-" : "+"}
                        {Number(val).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                        })}
                    </Text>
                );
            },
        },
        {
            title: "หน่วย",
            dataIndex: "unitCode",
            key: "unitCode",
        },
    ];

    return (
        <div
            style={{
                padding: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
            }}
        >
            {/* Header Panel */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                }}
            >
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        ยอดสินค้าคงคลังคงเหลือ (Stock On Hand)
                    </h1>
                    <Text type="secondary">
                        ตรวจสอบและสืบค้นยอดคงเหลือ รายคลัง รายตำแหน่งจัดเก็บ
                        และเลขล็อต แบบ Real-time
                    </Text>
                </div>
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleReload}
                        loading={loading}
                    >
                        รีเฟรชข้อมูล
                    </Button>
                </Space>
            </div>

            {/* KPI Cards Panel */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: "12px",
                            background:
                                "linear-gradient(135deg, #eef7f2 0%, #d8eede 100%)",
                            boxShadow: "0 4px 20px rgba(11, 115, 62, 0.05)",
                        }}
                    >
                        <Statistic
                            title={
                                <Text strong style={{ color: "#0b733e" }}>
                                    รายการสินค้าในสต็อก
                                </Text>
                            }
                            value={totalUniqueItems}
                            valueStyle={{
                                color: "#071d2c",
                                fontSize: "26px",
                                fontWeight: "bold",
                            }}
                            suffix={
                                <span
                                    style={{
                                        fontSize: "13px",
                                        color: "#595959",
                                    }}
                                >
                                    {" "}
                                    SKU
                                </span>
                            }
                            prefix={
                                <PieChartOutlined
                                    style={{
                                        color: "#0b733e",
                                        marginRight: "6px",
                                    }}
                                />
                            }
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: "12px",
                            background:
                                "linear-gradient(135deg, #ebf3ff 0%, #d0e3ff 100%)",
                            boxShadow: "0 4px 20px rgba(24, 144, 255, 0.05)",
                        }}
                    >
                        <Statistic
                            title={
                                <Text strong style={{ color: "#1890ff" }}>
                                    คงคลังกายภาพรวม
                                </Text>
                            }
                            value={totalPhysical}
                            precision={2}
                            valueStyle={{
                                color: "#071d2c",
                                fontSize: "26px",
                                fontWeight: "bold",
                            }}
                            suffix={
                                <span
                                    style={{
                                        fontSize: "13px",
                                        color: "#595959",
                                    }}
                                >
                                    {" "}
                                    แผ่น
                                </span>
                            }
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: "12px",
                            background:
                                "linear-gradient(135deg, #fff3e6 0%, #ffe0cc 100%)",
                            boxShadow: "0 4px 20px rgba(250, 140, 22, 0.05)",
                        }}
                    >
                        <Statistic
                            title={
                                <Text strong style={{ color: "#fa8c16" }}>
                                    ยอดจองสินค้า
                                </Text>
                            }
                            value={totalReserved}
                            precision={2}
                            valueStyle={{
                                color: "#fa8c16",
                                fontSize: "26px",
                                fontWeight: "bold",
                            }}
                            suffix={
                                <span
                                    style={{
                                        fontSize: "13px",
                                        color: "#fa8c16",
                                    }}
                                >
                                    {" "}
                                    แผ่น
                                </span>
                            }
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: "12px",
                            background:
                                "linear-gradient(135deg, #eef9eb 0%, #dbf3d4 100%)",
                            boxShadow: "0 4px 20px rgba(82, 196, 26, 0.05)",
                        }}
                    >
                        <Statistic
                            title={
                                <Text strong style={{ color: "#52c41a" }}>
                                    พร้อมขายรวม
                                </Text>
                            }
                            value={totalAvailable}
                            precision={2}
                            valueStyle={{
                                color: "#52c41a",
                                fontSize: "26px",
                                fontWeight: "bold",
                            }}
                            suffix={
                                <span
                                    style={{
                                        fontSize: "13px",
                                        color: "#52c41a",
                                    }}
                                >
                                    {" "}
                                    แผ่น
                                </span>
                            }
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filter and Search Panel */}
            <Card
                size="small"
                style={{
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                    border: "1px solid #f0f0f0",
                }}
            >
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={5}>
                        <Input
                            placeholder="ค้นหา รหัส, ชื่อสินค้า, SKU หรือเลขล็อต"
                            prefix={
                                <SearchOutlined style={{ color: "#bfbfbf" }} />
                            }
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onPressEnter={fetchStock}
                            allowClear
                        />
                    </Col>
                    <Col xs={12} md={5}>
                        <Select
                            style={{ width: "100%" }}
                            placeholder="กรองตามคลังสินค้า"
                            allowClear
                            value={selectedWarehouse}
                            onChange={(val) => setSelectedWarehouse(val)}
                        >
                            {warehouses.map((w) => (
                                <Select.Option
                                    key={w.WarehouseId}
                                    value={w.WarehouseId}
                                >
                                    {w.WarehouseCode} - {w.WarehouseName}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={12} md={5}>
                        <Select
                            style={{ width: "100%" }}
                            placeholder="กรองตามตำแหน่งจัดเก็บ"
                            allowClear
                            disabled={!selectedWarehouse}
                            value={selectedLocation}
                            onChange={(val) => setSelectedLocation(val)}
                        >
                            {locations.map((l) => (
                                <Select.Option key={l.value} value={l.value}>
                                    {l.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={12} md={4}>
                        <Checkbox
                            checked={includeZero}
                            onChange={(e) => setIncludeZero(e.target.checked)}
                        >
                            แสดงสต็อกที่เป็น 0
                        </Checkbox>
                    </Col>
                    <Col xs={12} md={5} style={{ textAlign: "right" }}>
                        <Space>
                            <Button
                                type="primary"
                                style={{
                                    backgroundColor: "#0b733e",
                                    borderColor: "#0b733e",
                                }}
                                onClick={fetchStock}
                            >
                                ค้นหา
                            </Button>
                            <Button onClick={handleResetFilters}>
                                ล้างตัวกรอง
                            </Button>
                            <Tooltip title="Export CSV">
                                <Button
                                    icon={<FileExcelOutlined />}
                                    onClick={handleExportCsv}
                                    disabled={!stockData.length}
                                />
                            </Tooltip>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Main Stock Table */}
            <Card
                size="small"
                bordered={false}
                bodyStyle={{ padding: 0 }}
                style={{
                    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
                    borderRadius: "10px",
                    overflow: "hidden",
                }}
            >
                <Table
                    columns={columns}
                    dataSource={stockData}
                    loading={loading}
                    rowKey="id"
                    pagination={{
                        pageSize: 15,
                        showSizeChanger: true,
                        pageSizeOptions: ["15", "30", "50", "100"],
                        showTotal: (total, range) =>
                            `แสดง ${range[0]}-${range[1]} จากทั้งหมด ${total} รายการ`,
                    }}
                    locale={{
                        emptyText: (
                            <Empty description="ไม่พบข้อมูลสินค้าคงเหลือในระบบคลังสินค้า" />
                        ),
                    }}
                    scroll={{ x: "max-content" }}
                />
            </Card>

            {/* Stock Movement History Modal */}
            <Modal
                title={
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        <HistoryOutlined
                            style={{ color: "#0b733e", fontSize: "18px" }}
                        />
                        <span>
                            ประวัติการเคลื่อนไหวสต็อก (Stock Movement History)
                        </span>
                    </div>
                }
                open={movementModalOpen}
                onCancel={() => {
                    setMovementModalOpen(false);
                    setSelectedStockRow(null);
                    setMovements([]);
                }}
                footer={[
                    <Button
                        key="close"
                        onClick={() => setMovementModalOpen(false)}
                    >
                        ปิดหน้าต่าง
                    </Button>,
                ]}
                width={950}
            >
                {selectedStockRow && (
                    <div
                        style={{
                            marginBottom: "16px",
                            background: "#f5f8fb",
                            padding: "12px 16px",
                            borderRadius: "8px",
                        }}
                    >
                        <Row gutter={[16, 8]}>
                            <Col xs={24} sm={12}>
                                <Space direction="vertical" size={2}>
                                    <Text
                                        type="secondary"
                                        style={{ fontSize: "12px" }}
                                    >
                                        ข้อมูลสินค้า
                                    </Text>
                                    <Text strong style={{ color: "#071d2c" }}>
                                        {selectedStockRow.itemName} -{" "}
                                        {selectedStockRow.specName || "ไม่มีสเปค"}
                                    </Text>
                                    {selectedStockRow.salesSku && (
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: "12px" }}
                                        >
                                            SKU: {selectedStockRow.salesSku}
                                        </Text>
                                    )}
                                </Space>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Statistic
                                            title={
                                                <span
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#8c8c8c",
                                                    }}
                                                >
                                                    คงคลังกายภาพ
                                                </span>
                                            }
                                            value={selectedStockRow.qtyOnHand}
                                            valueStyle={{
                                                fontSize: "16px",
                                                fontWeight: "bold",
                                                color: "#1890ff",
                                            }}
                                            precision={2}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title={
                                                <span
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#8c8c8c",
                                                    }}
                                                >
                                                    ยอดจอง
                                                </span>
                                            }
                                            value={selectedStockRow.qtyReserved}
                                            valueStyle={{
                                                fontSize: "16px",
                                                fontWeight: "bold",
                                                color: "#fa8c16",
                                            }}
                                            precision={2}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title={
                                                <span
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#8c8c8c",
                                                    }}
                                                >
                                                    พร้อมขาย
                                                </span>
                                            }
                                            value={
                                                selectedStockRow.qtyAvailable
                                            }
                                            valueStyle={{
                                                fontSize: "18px",
                                                fontWeight: "bold",
                                                color: "#52c41a",
                                            }}
                                            precision={2}
                                        />
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                    </div>
                )}

                <Table
                    columns={movementColumns}
                    dataSource={movements}
                    rowKey="id"
                    loading={movementsLoading}
                    pagination={{
                        current: movementPage,
                        pageSize: movementPageSize,
                        total: movementTotal,
                        onChange: (page) => fetchMovements(page),
                        showTotal: (total, range) =>
                            `แสดง ${range[0]}-${range[1]} จากทั้งหมด ${total} รายการ`,
                    }}
                    size="small"
                    bordered
                    locale={{
                        emptyText: (
                            <Empty description="ไม่พบประวัติการเคลื่อนไหวสต็อกสำหรับสินค้านี้" />
                        ),
                    }}
                />
            </Modal>
        </div>
    );
}
