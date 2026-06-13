import React, { useState, useEffect, useRef } from "react";
import {
    Card,
    Table,
    Input,
    Select,
    Row,
    Col,
    Button,
    Form,
    InputNumber,
    Modal,
    message,
    Typography,
    Space,
} from "antd";
import { ScanOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import ApiClient from "../../context/Api";
import { useWarehouse } from "../../context/WarehouseContext";
import { useWms } from "../../context/WmsContext";
import { useNavigate } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";

const { Title, Text, Paragraph } = Typography;

export default function InventoryTransfer() {
    const navigate = useNavigate();
    const { getWarehouses } = useWarehouse();
    const { getWarehouseLocations, claimWmsTask, confirmWmsTask } = useWms();

    const [searchText, setSearchText] = useState("");
    const [warehouses, setWarehouses] = useState([]);
    const [sourceWarehouseId, setSourceWarehouseId] = useState(null);
    const [sourceLocationId, setSourceLocationId] = useState(null);
    const [sourceLocations, setSourceLocations] = useState([]);
    const [units, setUnits] = useState([]);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);

    const [targetWarehouseId, setTargetWarehouseId] = useState(null);
    const [targetWarehouseName, setTargetWarehouseName] = useState(null);
    const [targetLocationId, setTargetLocationId] = useState(null);
    const [targetLocationName, setTargetLocationName] = useState(null);
    const [targetLocations, setTargetLocations] = useState([]);
    const [palletNo, setPalletNo] = useState("");
    const [quantity, setQuantity] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferTaskId, setTransferTaskId] = useState(null);
    const [transferLineId, setTransferLineId] = useState(null);
    const [scanFromLocationCode, setScanFromLocationCode] = useState("");
    const [scanFromPalletNo, setScanFromPalletNo] = useState("");
    const [scanToLocationCode, setScanToLocationCode] = useState("");
    const [scanToPalletNo, setScanToPalletNo] = useState("");
    const [confirmingTransfer, setConfirmingTransfer] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanTarget, setScanTarget] = useState("fromLocation"); // fromLocation | fromPallet | toLocation | toPallet

    const fromLocationInputRef = useRef(null);
    const fromPalletInputRef = useRef(null);
    const toLocationInputRef = useRef(null);
    const toPalletInputRef = useRef(null);

    useEffect(() => {
        const loadWarehouses = async () => {
            try {
                const data = await getWarehouses();
                setWarehouses(data || []);
            } catch (err) {
                console.error("Failed to load warehouses", err);
                message.error("ไม่สามารถโหลดคลังสินค้าได้");
            }
        };
        loadWarehouses();
    }, []);

    useEffect(() => {
        const loadLocations = async () => {
            if (!sourceWarehouseId) {
                setSourceLocations([]);
                setSourceLocationId(null);
                return;
            }
            try {
                const data = await getWarehouseLocations(sourceWarehouseId);
                setSourceLocations(data || []);
            } catch (err) {
                console.error("Failed to load source locations", err);
                message.error("ไม่สามารถโหลดตำแหน่งคลังสินค้าต้นทางได้");
            }
        };
        loadLocations();
    }, [sourceWarehouseId]);

    useEffect(() => {
        const loadLocations = async () => {
            if (!targetWarehouseId) {
                setTargetLocations([]);
                setTargetLocationId(null);
                return;
            }
            try {
                const data = await getWarehouseLocations(targetWarehouseId);
                setTargetLocations(data || []);
            } catch (err) {
                console.error("Failed to load target locations", err);
                message.error("ไม่สามารถโหลดตำแหน่งคลังสินค้าปลายทางได้");
            }
        };
        loadLocations();
    }, [targetWarehouseId]);

    useEffect(() => {
        if (selectedUnit) {
            setQuantity(selectedUnit.qtySheet);
            setPalletNo(selectedUnit.palletNo || "");
            setTargetWarehouseId(selectedUnit.warehouseId);
            setTargetWarehouseName(selectedUnit.warehouseName);
        } else {
            setQuantity(null);
            setPalletNo("");
        }
    }, [selectedUnit]);

    useEffect(() => {
        if (!transferModalOpen) return;
        setTimeout(() => {
            fromLocationInputRef.current?.focus?.();
        }, 120);
    }, [transferModalOpen]);

    const loadUnits = async () => {
        setLoadingUnits(true);
        try {
            const params = {
                search: searchText || undefined,
                warehouseId: sourceWarehouseId || undefined,
                locationId: sourceLocationId || undefined,
                page: 1,
                pageSize: 50,
            };
            const response = await ApiClient.get("/api/inventory/units", {
                params,
            });
            setUnits(response.data || []);
        } catch (err) {
            console.error("Failed to load inventory units", err);
            message.error("ไม่สามารถโหลดข้อมูลสินค้าคงคลังได้");
        } finally {
            setLoadingUnits(false);
        }
    };

    useEffect(() => {
        loadUnits();
    }, [sourceWarehouseId, sourceLocationId]);

    const columns = [
        {
            title: "สินค้า",
            dataIndex: "itemName",
            key: "itemName",
            render: (text, record) => (
                <div>
                    <Text strong>{record.itemName}</Text>
                    {record.specName ? (
                        <div style={{ color: "#666" }}>{record.specName}</div>
                    ) : null}
                </div>
            ),
        },
        {
            title: "SKU",
            dataIndex: "salesSku",
            key: "salesSku",
        },
        {
            title: "คลัง",
            dataIndex: "warehouseCode",
            key: "warehouseCode",
            render: (_, record) => (
                <div>
                    <Text>{record.warehouseCode}</Text>
                    <div style={{ color: "#666" }}>{record.warehouseName}</div>
                </div>
            ),
        },
        {
            title: "ตำแหน่ง",
            dataIndex: "locationCode",
            key: "locationCode",
            render: (_, record) => <Text>{record.locationCode || "-"}</Text>,
        },
        {
            title: "Lot",
            dataIndex: "lotNo",
            key: "lotNo",
        },
        {
            title: "จำนวน",
            dataIndex: "qtySheet",
            key: "qtySheet",
            align: "right",
            render: (value) =>
                Number(value || 0).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                }),
        },
        {
            title: "พาเลท",
            dataIndex: "palletNo",
            key: "palletNo",
        },
    ];

    const handleTransfer = async () => {
        if (!selectedUnit) {
            return message.warning("กรุณาเลือกสินค้าคงคลังเพื่อโอนย้าย");
        }
        if (!targetWarehouseId || !targetLocationId) {
            return message.warning("โปรดเลือกคลังและตำแหน่งปลายทาง");
        }

        if (transferTaskId && transferLineId && !transferModalOpen) {
            setTransferModalOpen(true);
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                inventoryUnitId: selectedUnit.id,
                toWarehouseId: targetWarehouseId,
                toLocationId: targetLocationId,
                quantity: quantity || selectedUnit.qtySheet,
                toPalletNo: palletNo || undefined,
                notes: `Transfer from location ${selectedUnit.locationCode || "N/A"} to ${targetLocationId}`,
            };
            const res = await ApiClient.post("/api/inventory/transfers", payload);

            setTransferTaskId(res?.data?.wmsTaskId || null);
            setTransferLineId(res?.data?.wmsTaskLineId || null);
            setScanFromLocationCode("");
            setScanFromPalletNo("");
            setScanToLocationCode("");
            setScanToPalletNo("");
            setTransferModalOpen(true);
            if (res?.data?.reused) {
                message.info("มีใบงานโอนย้ายรายการนี้อยู่แล้ว เปิดใบงานเดิมให้");
            } else {
                message.info("สร้างใบงานโอนย้ายแล้ว กรุณาสแกนต้นทาง/ปลายทางเพื่อยืนยัน");
            }
        } catch (err) {
            console.error("Inventory transfer failed", err);
            message.error(err.message || "การโอนย้ายสินค้าล้มเหลว");
        } finally {
            setSubmitting(false);
        }
    };

    const normalizeScan = (value) => String(value || "").trim().toLowerCase();

    const findLocationIdByCode = (locations, code) => {
        const normalized = normalizeScan(code);
        if (!normalized) return null;
        const match = (locations || []).find((l) => normalizeScan(l.label) === normalized);
        return match ? match.value : null;
    };

    const focusNext = (field) => {
        const nextMap = {
            fromLocation: fromPalletInputRef.current,
            fromPallet: toLocationInputRef.current,
            toLocation: toPalletInputRef.current,
            toPallet: null,
        };
        const next = nextMap[field];
        next?.focus?.();
    };

    const handleOpenScanner = (target) => {
        setScanTarget(target);
        setScannerOpen(true);
    };

    const handleScannedText = (rawText) => {
        const cleanedText = String(rawText || "").trim();
        if (!cleanedText) return;

        const validateLocation = (locs, label) => {
            const found = (locs || []).some((l) => normalizeScan(l.label) === normalizeScan(label));
            return found;
        };

        if (scanTarget === "fromLocation") {
            if (!validateLocation(sourceLocations, cleanedText)) {
                message.error(`ไม่พบรหัสตำแหน่ง "${cleanedText}" ในคลังต้นทาง`);
                return;
            }
            setScanFromLocationCode(cleanedText);
            message.success(`สแกนตำแหน่งต้นทางสำเร็จ: ${cleanedText}`);
            setScannerOpen(false);
            setTimeout(() => focusNext("fromLocation"), 60);
            return;
        }

        if (scanTarget === "fromPallet") {
            setScanFromPalletNo(cleanedText);
            message.success(`สแกนพาเลทต้นทางสำเร็จ: ${cleanedText}`);
            setScannerOpen(false);
            setTimeout(() => focusNext("fromPallet"), 60);
            return;
        }

        if (scanTarget === "toLocation") {
            if (!validateLocation(targetLocations, cleanedText)) {
                message.error(`ไม่พบรหัสตำแหน่ง "${cleanedText}" ในคลังปลายทาง`);
                return;
            }
            setScanToLocationCode(cleanedText);
            message.success(`สแกนตำแหน่งปลายทางสำเร็จ: ${cleanedText}`);
            setScannerOpen(false);
            setTimeout(() => focusNext("toLocation"), 60);
            return;
        }

        if (scanTarget === "toPallet") {
            setScanToPalletNo(cleanedText);
            message.success(`สแกนพาเลทปลายทางสำเร็จ: ${cleanedText}`);
            setScannerOpen(false);
            setTimeout(() => focusNext("toPallet"), 60);
        }
    };

    const expectedFromLocationCode = selectedUnit?.locationCode || "";
    const expectedFromPalletCandidates = [selectedUnit?.palletNo, selectedUnit?.trackingNo]
        .filter(Boolean)
        .map((v) => String(v).trim());

    const expectedToLocationCode =
        (targetLocations.find((l) => l.value === targetLocationId)?.label) || "";

    const handleConfirmTransfer = async () => {
        if (!selectedUnit || !transferTaskId || !transferLineId) {
            message.error("ไม่พบข้อมูลใบงานโอนย้าย");
            return;
        }

        const fromLocOk = normalizeScan(scanFromLocationCode) === normalizeScan(expectedFromLocationCode);
        if (!fromLocOk) {
            message.error(`ตำแหน่งต้นทางไม่ตรงกับที่ระบบระบุ (${expectedFromLocationCode || "-"})`);
            return;
        }

        const scannedFromPallet = String(scanFromPalletNo || "").trim();
        if (!scannedFromPallet) {
            message.error("กรุณาสแกน/กรอกพาเลทต้นทาง");
            return;
        }

        const fromPalletOk = expectedFromPalletCandidates.length
            ? expectedFromPalletCandidates.some((p) => normalizeScan(p) === normalizeScan(scannedFromPallet))
            : true;

        if (!fromPalletOk) {
            message.error(`พาเลทต้นทางไม่ตรงกับหน่วยสต็อกนี้ (${expectedFromPalletCandidates.join(" / ") || "-"})`);
            return;
        }

        const toLocOk = normalizeScan(scanToLocationCode) === normalizeScan(expectedToLocationCode);
        if (!toLocOk) {
            message.error(`ตำแหน่งปลายทางไม่ตรงกับที่เลือกไว้ (${expectedToLocationCode || "-"})`);
            return;
        }

        const fromLocationIdResolved = findLocationIdByCode(sourceLocations, scanFromLocationCode) || selectedUnit.locationId;
        const toLocationIdResolved = findLocationIdByCode(targetLocations, scanToLocationCode) || targetLocationId;

        const finalToPallet = String(scanToPalletNo || "").trim() || String(palletNo || "").trim() || selectedUnit.palletNo || null;

        setConfirmingTransfer(true);
        try {
            await claimWmsTask(transferTaskId);
            await confirmWmsTask(transferTaskId, {
                lines: [{
                    lineId: transferLineId,
                    inventoryUnitId: selectedUnit.id,
                    quantityCompleted: quantity || selectedUnit.qtySheet,
                    fromLocationId: fromLocationIdResolved,
                    toLocationId: toLocationIdResolved,
                    fromPalletNo: scannedFromPallet,
                    toPalletNo: finalToPallet,
                }],
            });

            message.success("โอนย้ายสินค้าสำเร็จแล้ว");
            setTransferModalOpen(false);
            setTransferTaskId(null);
            setTransferLineId(null);
            setSelectedUnit(null);
            setQuantity(null);
            setPalletNo("");
            loadUnits();
        } catch (err) {
            console.error("Confirm transfer failed", err);
            message.error(err.message || "ยืนยันการโอนย้ายไม่สำเร็จ");
        } finally {
            setConfirmingTransfer(false);
        }
    };

    return (
        <div>
            <div
                className="flex justify-between items-center mb-6"
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                }}
            >
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        โอนย้ายสินค้า (Inventory Transfer)
                    </h1>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        โอนย้ายสินค้าคงคลังระหว่างตำแหน่งภายในคลังเดียวกันหรือข้ามคลัง
                    </Paragraph>
                </div>
            </div>
            <Card
                style={{ marginBottom: "20px", background: "#fafafa" }}
                bodyStyle={{ padding: "16px" }}
            >
                <Row gutter={16} align="middle">
                    <Col xs={24} sm={10} md={8}>
                        <Input
                            placeholder="ค้นหา รหัสสินค้า ชื่อสินค้า หรือ LOT"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onPressEnter={loadUnits}
                            suffix={<SearchOutlined />}
                        />
                    </Col>
                    <Col xs={24} sm={7} md={6}>
                        <Select
                            allowClear
                            placeholder="คลังต้นทาง"
                            value={sourceWarehouseId}
                            onChange={setSourceWarehouseId}
                            style={{ width: "100%" }}
                        >
                            {warehouses
                                .filter((w) => w.IsActive)
                                .map((w) => (
                                    <Select.Option
                                        key={w.WarehouseId}
                                        value={w.WarehouseId}
                                    >
                                        {w.WarehouseName}
                                    </Select.Option>
                                ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={7} md={6}>
                        <Select
                            allowClear
                            placeholder="ตำแหน่งต้นทาง"
                            value={sourceLocationId}
                            onChange={setSourceLocationId}
                            style={{ width: "100%" }}
                            disabled={!sourceWarehouseId}
                        >
                            {sourceLocations.map((loc) => (
                                <Select.Option
                                    key={loc.value}
                                    value={loc.value}
                                >
                                    {loc.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={24} md={4}>
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            loading={loadingUnits}
                            onClick={loadUnits}
                        >
                            รีเฟรช
                        </Button>
                    </Col>
                </Row>
            </Card>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Card type="inner" title="ค้นหาและเลือกสินค้าคงคลังต้นทาง">
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={units}
                        loading={loadingUnits}
                        pagination={false}
                        rowSelection={{
                            type: "radio",
                            selectedRowKeys: selectedUnit
                                ? [selectedUnit.id]
                                : [],
                            onChange: (keys, rows) => {
                                setSelectedUnit(rows[0] || null);
                            },
                        }}
                        style={{ marginTop: 16 }}
                    />
                </Card>

                <Card type="inner" title="ข้อมูลปลายทางสำหรับการโอนย้าย">
                    <Row gutter={16}>
                        <Col xs={24} sm={12} md={6}>
                            <Text strong>คลังปลายทาง</Text>
                            <Select
                                placeholder="เลือกคลังปลายทาง"
                                value={targetWarehouseId}
                                onChange={(e) => {
                                    setTargetWarehouseId(e);
                                    const wh = warehouses.find(
                                        (w) => w.WarehouseId === e,
                                    );
                                    setTargetWarehouseName(
                                        wh ? wh.WarehouseName : null,
                                    );
                                }}
                                style={{ width: "100%", marginTop: 8 }}
                            >
                                {warehouses.map((wh) => (
                                    <Select.Option key={wh.WarehouseId} value={wh.WarehouseId}>
                                        {wh.WarehouseName}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Text strong>ตำแหน่งปลายทาง</Text>
                            <Select
                                placeholder="เลือกตำแหน่งปลายทาง"
                                value={targetLocationId}
                                onChange={(e) => {
                                    setTargetLocationId(e);
                                    const loc = targetLocations.find(
                                        (l) => l.value === e,
                                    );
                                    setTargetLocationName(
                                        loc ? loc.label : null,
                                    );
                                }}
                                style={{ width: "100%", marginTop: 8 }}
                                disabled={!targetWarehouseId}
                            >
                                {targetLocations.map((loc) => (
                                    <Select.Option
                                        key={loc.value}
                                        value={loc.value}
                                    >
                                        {loc.label}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Text strong>จำนวนที่จะโอนย้าย</Text>
                            <InputNumber
                                style={{ width: "100%", marginTop: 8 }}
                                min={0.01}
                                step={0.01}
                                value={quantity}
                                onChange={setQuantity}
                                disabled={!selectedUnit}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Text strong>เลขพาเลท (ถ้ามี)</Text>
                            <Input
                                value={palletNo}
                                onChange={(e) => setPalletNo(e.target.value)}
                                placeholder="เลขพาเลทปลายทาง"
                                style={{ width: "100%", marginTop: 8 }}
                            />
                        </Col>
                    </Row>
                    <div style={{ marginTop: 20, textAlign: "right" }}>
                        <Button
                            type="primary"
                            loading={submitting}
                            disabled={
                                !selectedUnit ||
                                !targetWarehouseId ||
                                !targetLocationId
                            }
                            onClick={handleTransfer}
                        >
                            ดำเนินการโอนย้าย
                        </Button>
                    </div>
                </Card>

                {selectedUnit ? (
                    <Card type="inner" title="สินค้าที่เลือกสำหรับโอนย้าย">
                        <Row gutter={16}>
                            <Col xs={24} sm={12} md={6}>
                                <Text strong>รหัสสินค้า</Text>
                                <div>{selectedUnit.salesSku || "-"}</div>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Text strong>คลัง/ตำแหน่งต้นทาง</Text>
                                <div>
                                    {selectedUnit.warehouseCode || "-"} /{" "}
                                    {selectedUnit.locationCode || "-"}
                                </div>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Text strong>คลัง/ตำแหน่งปลายทาง</Text>
                                <div>
                                    {targetWarehouseName || "-"} /{" "}
                                    {targetLocationName || "-"}
                                </div>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Text strong>จำนวน</Text>
                                <div>
                                    {Number(
                                        selectedUnit.qtySheet || 0,
                                    ).toLocaleString("th-TH", {
                                        minimumFractionDigits: 2,
                                    })}
                                </div>
                            </Col>
                        </Row>
                    </Card>
                ) : null}
            </Space>

            <Modal
                title={`ยืนยันการโอนย้าย (Scan) - Task #${transferTaskId || "-"}`}
                open={transferModalOpen}
                onCancel={() => setTransferModalOpen(false)}
                onOk={handleConfirmTransfer}
                okText="ยืนยันการโอนย้าย"
                cancelText="ปิด"
                confirmLoading={confirmingTransfer}
                destroyOnClose
            >
                <div className="flex flex-col gap-3">
                    <div className="text-sm text-slate-600">
                        สแกนให้ตรงกับข้อมูลที่ระบบระบุ เพื่อป้องกันการโอนผิดพาเลท/ผิดตำแหน่ง (สามารถกลับมาเปิดได้ที่เมนู WMS &gt; โอนย้ายสินค้า (สแกน))
                    </div>
                    {transferTaskId ? (
                        <div className="flex justify-end">
                            <Button onClick={() => navigate(`/wms/transfers/${transferTaskId}`)}>
                                ไปหน้าใบงานสแกน
                            </Button>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-2">
                        <Text strong>ต้นทาง</Text>
                        <div className="text-xs text-slate-500">
                            คลัง/ตำแหน่ง: {selectedUnit?.warehouseCode || "-"} / {expectedFromLocationCode || "-"} | พาเลท: {expectedFromPalletCandidates.join(" / ") || "-"}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="สแกนรหัสตำแหน่งต้นทาง"
                                value={scanFromLocationCode}
                                onChange={(e) => setScanFromLocationCode(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        focusNext("fromLocation");
                                    }
                                }}
                                ref={fromLocationInputRef}
                            />
                            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner("fromLocation")} />
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="สแกนพาเลทต้นทาง (PalletNo/TrackingNo)"
                                value={scanFromPalletNo}
                                onChange={(e) => setScanFromPalletNo(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        focusNext("fromPallet");
                                    }
                                }}
                                ref={fromPalletInputRef}
                            />
                            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner("fromPallet")} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-2">
                        <Text strong>ปลายทาง</Text>
                        <div className="text-xs text-slate-500">
                            คลัง/ตำแหน่ง: {targetWarehouseName || "-"} / {expectedToLocationCode || "-"} | พาเลทปลายทาง (ถ้ามี): {palletNo || "-"}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="สแกนรหัสตำแหน่งปลายทาง"
                                value={scanToLocationCode}
                                onChange={(e) => setScanToLocationCode(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        focusNext("toLocation");
                                    }
                                }}
                                ref={toLocationInputRef}
                            />
                            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner("toLocation")} />
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="สแกนพาเลทปลายทาง (เว้นว่าง=ใช้ค่าเดิม/ค่าที่กรอกไว้)"
                                value={scanToPalletNo}
                                onChange={(e) => setScanToPalletNo(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        focusNext("toPallet");
                                    }
                                }}
                                ref={toPalletInputRef}
                            />
                            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner("toPallet")} />
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                title={`สแกนคิวอาร์โค้ด / บาร์โค้ด (${scanTarget === "fromLocation" || scanTarget === "toLocation" ? "ตำแหน่งสินค้า" : "พาเลท"
                    })`}
                open={scannerOpen}
                onCancel={() => setScannerOpen(false)}
                footer={null}
                destroyOnClose
                width={400}
            >
                <div style={{ width: "100%", maxWidth: "350px", margin: "0 auto" }}>
                    <Scanner
                        onScan={(result) => {
                            if (!result || result.length === 0) return;
                            const text = result[0]?.rawValue || result[0]?.text || "";
                            handleScannedText(text);
                        }}
                        onError={(err) => {
                            console.error(err);
                            message.error("ไม่สามารถเปิดกล้องได้: " + err.message);
                        }}
                    />
                    <div className="text-center mt-4 text-slate-500 text-xs">
                        วางบาร์โค้ดหรือคิวอาร์โค้ดให้อยู่ในกรอบของกล้อง
                    </div>
                </div>
            </Modal>
        </div>
    );
}
