import {
    EyeOutlined,
    DownloadOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import { Button, Card, Input, Space, Table, Typography, message } from "antd";
import { useMemo, useState, useEffect } from "react";
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
    const { getItemPricingPolicyHistory, getItemPricingPoliciesByVersionNo } =
        useItem();

    const [versionNoSearch, setVersionNoSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);

    const handleExport = async (versionNo) => {
        setLoading(true);
        try {
            // console.log("Exporting CSV for versionNo:", versionNo);
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
                key: "",
                align: "center",
                width: 80,
                render: (_, record) => (
                    <Space>
                        {/* <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() =>
                                message.info(
                                    `VersionNo: ${record.versionNo} (ดูรายการทั้งหมดด้วย Export)`,
                                )
                            }
                        /> */}
                        <DownloadOutlined
                            className="text-blue-600 cursor-pointer hover:text-blue-700"
                            onClick={() => handleExport(record.versionNo)}
                        />
                    </Space>
                ),
            },
            {
                title: "เลขที่ Version",
                dataIndex: "versionNo",
                key: "versionNo",
                width: 180,
            },
            {
                title: "ถูกสร้างเมื่อ",
                dataIndex: "createdAt",
                key: "createdAt",
                width: 180,
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
                width: 80,
                align: "right",
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

    // useEffect(() => {
    //     if (versionNoSearch?.trim()) loadHistory();
    // }, [versionNoSearch]);

    useEffect(() => {
        (async () => {
            try {
                await loadHistory();
            } catch (err) {
                message.error(err.message || "โหลดประวัติไม่สำเร็จ");
            }
        })();
    }, []);

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

    return (
        <div className="space-y-4">
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

            <div className="rounded-lg border border-slate-200">
                <Table
                    columns={columns}
                    dataSource={rows}
                    rowKey="versionNo"
                    loading={loading}
                    pagination={false}
                    size="small"
                    scroll={{ x: 1100 }}
                />
            </div>
        </div>
    );
}
