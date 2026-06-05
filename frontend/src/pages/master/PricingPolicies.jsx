import { UploadOutlined } from "@ant-design/icons";
import {
    Button,
    Card,
    Col,
    Descriptions,
    Form,
    Input,
    message,
    Row,
    Select,
    Space,
    Table,
    Typography,
    Upload,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useItem } from "../../context/ItemContext.jsx";

const { Text } = Typography;

export default function PricingPolicies() {
    const {
        getItems,
        createItemPricingPoliciesBulk,
        getItemPricingPolicies,
        getItemPricingPolicy,
        getItemPricingPolicyApprovalRequest,
        validateItemPricingPolicy,
        requestItemPricingPolicyApproval,
        approveItemPricingPolicy,
        publishItemPricingPolicy,
    } = useItem();
    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemSearchText, setItemSearchText] = useState("");
    const [selectedItemKey, setSelectedItemKey] = useState(null);
    const [pricingPolicies, setPricingPolicies] = useState([]);
    const [selectedPolicyId, setSelectedPolicyId] = useState(null);
    const [selectedPricingPolicy, setSelectedPricingPolicy] = useState(null);
    const [approvalRequest, setApprovalRequest] = useState(null);
    const [validationResult, setValidationResult] = useState(null);
    const [loadingPolicies, setLoadingPolicies] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [uploadErrors, setUploadErrors] = useState([]);

    const itemKey = (item) => `${item?.itemId ?? ""},${item?.itemSpecId ?? ""}`;

    const uniqueItems = useMemo(() => {
        const rows = Array.isArray(items) ? items : [];
        return Array.from(
            new Map(rows.map((row) => [itemKey(row), row])).values(),
        );
    }, [items]);

    const selectedItem = useMemo(
        () =>
            uniqueItems.find((item) => itemKey(item) === selectedItemKey) ||
            null,
        [uniqueItems, selectedItemKey],
    );

    const selectedItemId = selectedItem?.itemId ?? null;
    const selectedItemSpecId = selectedItem?.itemSpecId ?? null;

    const loadItems = async () => {
        setLoadingItems(true);
        try {
            const data = await getItems({
                page: 1,
                pageSize: 100,
                search: itemSearchText || undefined,
            });

            const rows = Array.isArray(data?.data) ? data.data : [];
            const unique = Array.from(
                new Map(rows.map((row) => [itemKey(row), row])).values(),
            );
            setItems(unique);
            if (
                selectedItemKey &&
                !unique.some((item) => itemKey(item) === selectedItemKey)
            ) {
                setSelectedItemKey(null);
                setSelectedPricingPolicy(null);
                setSelectedPolicyId(null);
                setPricingPolicies([]);
                setApprovalRequest(null);
                setValidationResult(null);
            }
        } catch (err) {
            message.error("โหลดรายการสินค้าล้มเหลว");
        } finally {
            setLoadingItems(false);
        }
    };

    const loadPolicies = async (itemId) => {
        if (!itemId) return;
        setLoadingPolicies(true);
        // Clear selection immediately to avoid stale itemId/policyId mismatches during async loads.
        setSelectedPricingPolicy(null);
        setSelectedPolicyId(null);
        setApprovalRequest(null);
        setValidationResult(null);
        try {
            const data = await getItemPricingPolicies(itemId);
            const all = Array.isArray(data) ? data : [];
            const filtered =
                selectedItemSpecId === null
                    ? all.filter(
                          (p) =>
                              p.itemSpecId === null ||
                              p.itemSpecId === undefined,
                      )
                    : all.filter((p) => p.itemSpecId === selectedItemSpecId);
            setPricingPolicies(filtered);
        } catch (err) {
            message.error("โหลด Pricing Policies ไม่สำเร็จ");
        } finally {
            setLoadingPolicies(false);
        }
    };

    const loadPolicyDetails = async (policyId) => {
        if (!selectedItemId || !policyId) return;
        setActionLoading(true);
        try {
            const policy = await getItemPricingPolicy(selectedItemId, policyId);
            setSelectedPricingPolicy(policy);
            setSelectedPolicyId(policyId);
            setApprovalRequest(null);
            setValidationResult(null);
        } catch (err) {
            message.error("โหลดรายละเอียด Pricing Policy ล้มเหลว");
        } finally {
            setActionLoading(false);
        }
    };

    const loadApprovalRequest = async () => {
        if (!selectedItemId || !selectedPolicyId) return;
        setActionLoading(true);
        try {
            const request = await getItemPricingPolicyApprovalRequest(
                selectedItemId,
                selectedPolicyId,
            );
            setApprovalRequest(request);
            message.success("โหลด approval request เรียบร้อย");
        } catch (err) {
            message.error(
                err.response?.data?.message ||
                    "โหลด approval request ไม่สำเร็จ",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleValidatePolicy = async () => {
        if (!selectedItemId || !selectedPolicyId) return;
        console.log("Validating policy", { selectedItemId, selectedPolicyId });
        setActionLoading(true);
        try {
            const result = await validateItemPricingPolicy(
                selectedItemId,
                selectedPolicyId,
            );
            setValidationResult(result);
            message.success("ตรวจสอบ policy สำเร็จ");
        } catch (err) {
            message.error(
                err.response?.data?.message || "ตรวจสอบ policy ไม่สำเร็จ",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestApproval = async () => {
        if (!selectedItemId || !selectedPolicyId) return;
        setActionLoading(true);
        try {
            await requestItemPricingPolicyApproval(
                selectedItemId,
                selectedPolicyId,
            );
            message.success("ส่งคำขออนุมัติสำเร็จ");
            await loadPolicies(selectedItemId);
        } catch (err) {
            message.error(
                err.response?.data?.message || "ส่งคำขออนุมัติไม่สำเร็จ",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprovePolicy = async () => {
        if (!selectedItemId || !selectedPolicyId) return;
        setActionLoading(true);
        try {
            await approveItemPricingPolicy(selectedItemId, selectedPolicyId);
            message.success("อนุมัติ policy เรียบร้อย");
            await loadPolicies(selectedItemId);
            await loadPolicyDetails(selectedPolicyId);
        } catch (err) {
            message.error(
                err.response?.data?.message || "อนุมัติ policy ไม่สำเร็จ",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handlePublishPolicy = async () => {
        message.warning("Publishing ยังไม่ถูกกำหนดในหน้านี้");
    };

    const normalizeCsvKey = (key) =>
        String(key || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "")
            .replace(/[-_]/g, "");

    const splitCsvLine = (line) => {
        const values = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === "," && !inQuotes) {
                values.push(current);
                current = "";
            } else {
                current += char;
            }
        }
        values.push(current);
        return values.map((value) => value.trim().replace(/^"|"$/g, ""));
    };

    const parseCsvText = (text) => {
        const lines = text
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0);
        if (lines.length === 0) return [];

        const headers = splitCsvLine(lines[0]).map(normalizeCsvKey);
        return lines.slice(1).map((line) => {
            const values = splitCsvLine(line);
            return headers.reduce((row, header, index) => {
                row[header] = values[index] ?? "";
                return row;
            }, {});
        });
    };

    const parseCsvFile = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    resolve(parseCsvText(String(reader.result)));
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error("อ่านไฟล์ CSV ไม่สำเร็จ"));
            reader.readAsText(file, "utf-8");
        });

    const normalizeFieldMap = {
        salessku: "salesSku",
        salesku: "salesSku",
        pricingmethodid: "pricingMethodId",
        priority: "priority",
        remark: "remark",
        standardprice: "standardPrice",
        standardcost: "standardCost",
        minmarginpercent: "minMarginPercent",
        targetmarginpercent: "targetMarginPercent",
        minmarkuppercent: "minMarkupPercent",
        targetmarkuppercent: "targetMarkupPercent",
        currencycode: "currencyCode",
        effectivefrom: "effectiveFrom",
        effectiveto: "effectiveTo",
        isactive: "isActive",
    };

    const buildPolicyPayload = (row) => {
        const payload = {};
        Object.entries(row).forEach(([key, value]) => {
            const normalized = normalizeFieldMap[normalizeCsvKey(key)];
            if (!normalized) return;

            let parsedValue = value;
            if (normalized === "isActive") {
                parsedValue = ["1", "true", "yes", "y"].includes(
                    String(value).trim().toLowerCase(),
                );
            } else if (["pricingMethodId", "priority"].includes(normalized)) {
                parsedValue = Number(value || 0) || 0;
            } else if (
                [
                    "standardPrice",
                    "standardCost",
                    "minMarginPercent",
                    "targetMarginPercent",
                    "minMarkupPercent",
                    "targetMarkupPercent",
                ].includes(normalized)
            ) {
                parsedValue = Number(value || 0) || 0;
            } else if (["effectiveFrom", "effectiveTo"].includes(normalized)) {
                parsedValue = value ? String(value).trim() : null;
            } else {
                parsedValue = value ? String(value).trim() : null;
            }

            payload[normalized] = parsedValue;
        });
        return payload;
    };

    const handleProcessUpload = async () => {
        if (!uploadFile) {
            message.warning("กรุณาเลือกไฟล์ CSV ก่อน");
            return;
        }

        setUploadStatus(null);
        setUploadErrors([]);
        setActionLoading(true);

        try {
            const rows = await parseCsvFile(uploadFile);
            if (!rows.length) {
                throw new Error("ไฟล์ CSV ต้องมีข้อมูลอย่างน้อย 1 แถว");
            }

            const payloadRows = [];
            const errors = [];

            for (let index = 0; index < rows.length; index += 1) {
                const row = rows[index];
                const payload = buildPolicyPayload(row);

                const salesSku = String(payload.salesSku || "").trim();
                if (!salesSku) {
                    errors.push(`แถว ${index + 2}: ต้องระบุ salesSku`);
                    continue;
                }

                if (!payload.pricingMethodId) {
                    errors.push(`แถว ${index + 2}: ต้องระบุ pricingMethodId`);
                    continue;
                }

                payloadRows.push({ ...payload, salesSku });
            }

            const result = await createItemPricingPoliciesBulk(payloadRows);
            const versionNo =
                result?.versionNo ??
                result?.data?.versionNo ??
                result?.data?.data?.versionNo ??
                null;

            setUploadStatus({
                versionNo: versionNo || "-",
                acceptedCount: payloadRows.length,
                totalCount: rows.length,
                skippedCount: rows.length - payloadRows.length,
            });
            setUploadErrors(errors.slice(0, 50));

            message.success(
                `รับคำสั่งแล้ว (fire-and-forget) VersionNo: ${versionNo || "-"}`,
            );
        } catch (err) {
            message.error(err.message || "ประมวลผลไฟล์ไม่สำเร็จ");
        } finally {
            setActionLoading(false);
        }
    };

    const handleBeforeUpload = (file) => {
        const ext = String(file.name).split(".").pop()?.toLowerCase();
        if (ext !== "csv") {
            message.error("รองรับเฉพาะไฟล์ CSV ในตอนนี้");
            return false;
        }
        setUploadFile(file);
        return false;
    };

    const policyColumns = [
        { title: "ID", dataIndex: "id", key: "id", width: 80 },
        {
            title: "วิธีการกำหนดราคา",
            dataIndex: "pricingMethodName",
            key: "pricingMethodName",
            width: 150,
        },
        {
            title: "หน่วยนับ",
            dataIndex: "unitCode",
            key: "unitCode",
            width: 100,
        },
        { title: "สถานะ", dataIndex: "status", key: "status", width: 120 },
        {
            title: "ราคามาตรฐาน",
            dataIndex: "standardPrice",
            key: "standardPrice",
            width: 120,
        },
        {
            title: "สกุลเงิน",
            dataIndex: "currencyCode",
            key: "currencyCode",
            width: 100,
        },
        {
            title: "มีผลตั้งแต่วันที่",
            dataIndex: "effectiveFrom",
            key: "effectiveFrom",
            width: 150,
        },
        {
            title: "มีผลจนถึงวันที่",
            dataIndex: "effectiveTo",
            key: "effectiveTo",
            width: 150,
        },
    ];

    useEffect(() => {
        loadItems();
    }, []);

    useEffect(() => {
        if (selectedItemId) {
            loadPolicies(selectedItemId);
        }
    }, [selectedItemId, selectedItemSpecId]);

    const uploadProps = {
        beforeUpload: handleBeforeUpload,
        onRemove: () => {
            setUploadFile(null);
            setUploadStatus(null);
            setUploadErrors([]);
            return false;
        },
        fileList: uploadFile ? [uploadFile] : [],
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        จัดการ Pricing Policies
                    </h1>
                </div>
            </div>

            <Card title="อัปโหลด Batch Pricing Policy" className="shadow-sm">
                <Row gutter={16} align="middle">
                    <Col xs={24} md={14}>
                        <Space
                            direction="vertical"
                            size="middle"
                            className="w-full"
                        >
                            <Text>
                                เลือกไฟล์ batch upload (CSV) เพื่อเตรียมสร้าง
                                pricing policy หลายรายการพร้อมกัน
                            </Text>
                            <Upload {...uploadProps} accept=".csv">
                                <Button icon={<UploadOutlined />}>
                                    เลือกไฟล์ CSV
                                </Button>
                            </Upload>
                            <Button
                                type="primary"
                                onClick={handleProcessUpload}
                                disabled={!uploadFile}
                                loading={actionLoading}
                            >
                                ประมวลผลไฟล์
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Card
                title="ค้นหาสินค้าและดู Pricing Policies"
                className="shadow-sm"
            >
                <Row gutter={16} className="items-end">
                    <Col xs={24} md={10}>
                        <Form layout="vertical">
                            <Form.Item label="ค้นหารายการสินค้า">
                                <Input
                                    value={itemSearchText}
                                    onChange={(e) =>
                                        setItemSearchText(e.target.value)
                                    }
                                    placeholder="ค้นหา SKU หรือ ชื่อสินค้า"
                                />
                            </Form.Item>
                        </Form>
                    </Col>
                    <Col xs={24} md={14}>
                        <Form layout="vertical">
                            <Form.Item>
                                <Space>
                                    <Button
                                        type="primary"
                                        onClick={loadItems}
                                        loading={loadingItems}
                                    >
                                        โหลดรายการสินค้า
                                    </Button>
                                    <Button
                                        onClick={() => setItemSearchText("")}
                                    >
                                        ล้าง
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </Col>
                </Row>

                <Row gutter={16} className="mt-4">
                    <Col xs={24} md={12}>
                        <Card size="small" type="inner" title="เลือกสินค้า">
                            <Form layout="vertical">
                                <Form.Item label="">
                                    <Select
                                        showSearch
                                        placeholder="เลือกสินค้า"
                                        value={selectedItemKey}
                                        onChange={setSelectedItemKey}
                                        options={uniqueItems.map((item) => ({
                                            value: itemKey(item),
                                            label: `${item.salesSku || item.displayCode || item.code || item.itemId} - ${item.name || "-"}`,
                                        }))}
                                        filterOption={(input, option) =>
                                            option?.label
                                                .toLowerCase()
                                                .includes(input.toLowerCase())
                                        }
                                    />
                                </Form.Item>
                            </Form>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        {selectedItem ? (
                            <Card
                                size="small"
                                type="inner"
                                title="ข้อมูลสินค้า"
                            >
                                <Descriptions column={1} size="small">
                                    <Descriptions.Item label="รหัสสินค้า">
                                        {selectedItem.displayCode ||
                                            selectedItem.code ||
                                            selectedItem.itemId}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="ชื่อสินค้า">
                                        {selectedItem.name || "-"}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="สถานะ">
                                        {selectedItem.status || "-"}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="เปิดใช้">
                                        {selectedItem.isActive
                                            ? "ใช่"
                                            : "ไม่ใช่"}
                                    </Descriptions.Item>
                                </Descriptions>
                            </Card>
                        ) : null}
                    </Col>
                </Row>
            </Card>

            <Card title="นโยบายการกำหนดราคา" className="shadow-sm">
                <Table
                    rowSelection={{
                        type: "radio",
                        selectedRowKeys: selectedPolicyId
                            ? [selectedPolicyId]
                            : [],
                        onChange: (keys, rows) => {
                            const selected = rows[0];
                            setSelectedPolicyId(selected?.id);
                            loadPolicyDetails(selected?.id);
                        },
                    }}
                    columns={policyColumns}
                    dataSource={pricingPolicies}
                    rowKey="id"
                    loading={loadingPolicies}
                    pagination={false}
                    size="small"
                />

                {selectedPricingPolicy ? (
                    <div className="space-y-4 mt-4">
                        <Card
                            title={`นโบยายราคาหมายเลข : ${selectedPricingPolicy.id}`}
                            bordered
                        >
                            <Descriptions column={2} size="small">
                                <Descriptions.Item label="สถานะ">
                                    {selectedPricingPolicy.status}
                                </Descriptions.Item>
                                <Descriptions.Item label="วิธีการกำหนดราคา">
                                    {selectedPricingPolicy.pricingMethodName}
                                </Descriptions.Item>
                                <Descriptions.Item label="ราคามาตรฐาน">
                                    {selectedPricingPolicy.standardPrice}
                                </Descriptions.Item>
                                <Descriptions.Item label="สกุลเงิน">
                                    {selectedPricingPolicy.currencyCode}
                                </Descriptions.Item>
                                <Descriptions.Item label="มีผลตั้งแต่วันที่">
                                    {selectedPricingPolicy.effectiveFrom}
                                </Descriptions.Item>
                                <Descriptions.Item label="มีผลจนถึงวันที่">
                                    {selectedPricingPolicy.effectiveTo}
                                </Descriptions.Item>
                                <Descriptions.Item label="Version">
                                    {selectedPricingPolicy.versionNo}
                                </Descriptions.Item>
                                <Descriptions.Item label="หมายเหตุ">
                                    {selectedPricingPolicy.remark || "-"}
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Space wrap>
                            <Button
                                type="default"
                                onClick={handleValidatePolicy}
                                loading={actionLoading}
                                disabled={loadingPolicies || actionLoading}
                            >
                                ตรวจสอบความถูกต้อง
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleRequestApproval}
                                loading={actionLoading}
                            >
                                ส่งขออนุมัติ
                            </Button>
                            <Button
                                disabled={true}
                                type="dashed"
                                onClick={handleApprovePolicy}
                                loading={actionLoading}
                            >
                                อนุมัติ
                            </Button>
                            <Button
                                disabled={true}
                                type="ghost"
                                onClick={handlePublishPolicy}
                                loading={actionLoading}
                            >
                                Publish
                            </Button>
                            <Button
                                type="text"
                                onClick={loadApprovalRequest}
                                loading={actionLoading}
                            >
                                โหลดคำขออนุมัติ
                            </Button>
                        </Space>

                        {validationResult ? (
                            <Card title="ผลการตรวจสอบ" size="small">
                                <div>
                                    ความถูกต้อง:{" "}
                                    {validationResult.isValid
                                        ? "ใช่"
                                        : "ไม่ใช่"}
                                </div>
                                {validationResult.errors?.length ? (
                                    <div className="mt-2 text-sm text-red-600">
                                        {validationResult.errors.map(
                                            (error, index) => (
                                                <div key={index}>{error}</div>
                                            ),
                                        )}
                                    </div>
                                ) : null}
                            </Card>
                        ) : null}

                        {approvalRequest ? (
                            <Card title="คำขออนุมัติ" size="small">
                                <Descriptions column={1} size="small">
                                    <Descriptions.Item label="Request ID">
                                        {approvalRequest.id ||
                                            approvalRequest.ApprovalRequestId}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Status">
                                        {approvalRequest.status}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Requested By">
                                        {approvalRequest.requestedByName ||
                                            approvalRequest.requestedBy}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Notes">
                                        {approvalRequest.notes || "-"}
                                    </Descriptions.Item>
                                </Descriptions>
                            </Card>
                        ) : null}
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 mt-4">
                        เลือก Pricing Policy เพื่อดูรายละเอียดและเรียกใช้ API
                    </div>
                )}
            </Card>
        </div>
    );
}
