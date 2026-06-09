import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Avatar,
    Button,
    Card,
    Divider,
    Input,
    Space,
    Table,
    Tag,
    Typography,
    message,
    Tooltip,
} from "antd";
import {
    PauseOutlined,
    PlayCircleOutlined,
    ReloadOutlined,
    SearchOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useWms } from "../../context/WmsContext.jsx";

const { Text } = Typography;

function toDate(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return d;
}

function formatTime(value) {
    const d = toDate(value);
    return d ? d.toLocaleString("th-TH") : "-";
}

function normalize(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function cssEscape(value) {
    const raw = String(value ?? "");
    if (
        typeof globalThis !== "undefined" &&
        globalThis.CSS &&
        typeof globalThis.CSS.escape === "function"
    ) {
        return globalThis.CSS.escape(raw);
    }
    // Minimal fallback: escape quotes and backslashes for attribute selector usage.
    return raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function deriveSortTime(row) {
    return (
        toDate(row.actionAt) ||
        toDate(row.createdAt) ||
        toDate(row.completedAt) ||
        new Date(0)
    );
}

function statusColor(status) {
    if (status === "completed") return "green";
    if (status === "in_progress") return "blue";
    if (status === "open") return "orange";
    return "default";
}

function typeTag(type) {
    if (type === "wave") return <Tag color="geekblue">Wave Picking</Tag>;
    if (type === "putaway") return <Tag color="gold">Putaway</Tag>;
    if (type === "transfer") return <Tag color="purple">Transfer</Tag>;
    return <Tag>{type}</Tag>;
}

function kv(label, value) {
    return (
        <div className="flex flex-col gap-1">
            <Text className="wms-dashboard-muted text-xs">{label}</Text>
            <Text className="wms-dashboard-text text-sm">{value ?? "-"}</Text>
        </div>
    );
}

function sumQty(lines = []) {
    return lines.reduce((acc, l) => acc + Number(l.quantityRequired || 0), 0);
}

export default function WmsDashboard() {
    const { getWmsWaves, getWmsTasks, getWmsWaveDetail, getWmsTaskDetail } =
        useWms();

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [rows, setRows] = useState([]);
    const [selectedKey, setSelectedKey] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState(null);
    const [search, setSearch] = useState("");

    const [autoRun, setAutoRun] = useState(true);
    const intervalRef = useRef(null);
    const pausedByHoverRef = useRef(false);
    const detailCacheRef = useRef(new Map());
    const cycleRowsRef = useRef([]);
    const cycleCursorRef = useRef(0);
    const timelineHostRef = useRef(null);

    const fetchTimeline = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const [wavesRes, putawayRes, transferRes] = await Promise.all([
                getWmsWaves({ status: "open" }),
                getWmsTasks({ status: "open", taskType: "putaway" }),
                getWmsTasks({ status: "open", taskType: "transfer" }),
            ]);

            const waves = (wavesRes?.data || []).map((w) => ({
                key: `wave:${w.id}`,
                type: "wave",
                id: w.id,
                code: w.waveNo,
                status:
                    w.status === "open" && w.actionByName
                        ? "in_progress"
                        : w.status,
                createdAt: w.createdAt,
                actionAt: w.actionAt,
                completedAt: w.completedAt,
                actionByName: w.actionByName,
                createdByName: w.createdByName,
                summary: `${w.taskCount || 0} งาน`,
            }));

            const tasks = (putawayRes?.data || [])
                .concat(transferRes?.data || [])
                .map((t) => ({
                    key: `task:${t.id}`,
                    type: t.taskType,
                    id: t.id,
                    code: `Task #${t.id}`,
                    status:
                        t.status === "open" && t.actionByName
                            ? "in_progress"
                            : t.status,
                    createdAt: t.createdAt,
                    actionAt: t.actionAt,
                    completedAt: t.completedAt,
                    actionByName: t.actionByName,
                    createdByName: null,
                    summary: t.referenceType
                        ? `${t.referenceType} (${t.referenceId ?? "-"})`
                        : "-",
                }));

            const merged = [...waves, ...tasks]
                .sort(
                    (a, b) =>
                        deriveSortTime(b).getTime() -
                        deriveSortTime(a).getTime(),
                )
                .slice(0, 150);

            setRows(merged);
            setLastUpdatedAt(new Date().toISOString());

            if (merged.length) {
                setSelectedKey((prev) => prev ?? merged[0].key);
            }
        } catch (err) {
            message.error("ไม่สามารถโหลด WMS timeline ได้: " + err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTimeline();
        const t = setInterval(() => fetchTimeline({ silent: true }), 15000);
        return () => clearInterval(t);
    }, []);

    const filteredRows = useMemo(() => {
        const q = normalize(search);
        if (!q) return rows;
        return rows.filter((r) => {
            const hay = [
                r.type,
                r.code,
                r.status,
                r.actionByName,
                r.createdByName,
                r.summary,
            ]
                .filter(Boolean)
                .join(" ");
            return normalize(hay).includes(q);
        });
    }, [rows, search]);

    useEffect(() => {
        const row = filteredRows.find((r) => r.key === selectedKey) || null;
        setSelectedRow(row);
        if (!row && filteredRows.length) {
            const fallbackIndex = Math.min(
                cycleCursorRef.current,
                filteredRows.length - 1,
            );
            setSelectedKey(
                filteredRows[fallbackIndex]?.key || filteredRows[0].key,
            );
        }
    }, [filteredRows, selectedKey]);

    const loadDetail = async (row) => {
        if (!row) {
            setDetail(null);
            return;
        }
        try {
            const cacheKey = row.key;
            const cached = detailCacheRef.current.get(cacheKey);
            const now = Date.now();
            const ttlMs = 15000;

            if (cached && now - cached.ts < ttlMs) {
                setDetail(cached.value);
                return;
            }

            setDetailLoading(true);
            if (row.type === "wave") {
                const data = await getWmsWaveDetail(row.id);
                const next = { type: "wave", data: data?.data || data };
                detailCacheRef.current.set(cacheKey, { ts: now, value: next });
                setDetail(next);
            } else {
                const data = await getWmsTaskDetail(row.id);
                const next = { type: "task", data: data?.data || data };
                detailCacheRef.current.set(cacheKey, { ts: now, value: next });
                setDetail(next);
            }
        } catch (err) {
            setDetail(null);
            message.error("โหลดรายละเอียดไม่สำเร็จ: " + err.message);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedRow) return;
        loadDetail(selectedRow);
    }, [selectedRow?.key]);

    const cycleRows = useMemo(() => {
        const openRows = filteredRows.filter((r) => r.status !== "completed");
        return openRows.length ? openRows : filteredRows;
    }, [filteredRows]);

    useEffect(() => {
        cycleRowsRef.current = cycleRows;
        const idx = cycleRows.findIndex((r) => r.key === selectedKey);
        if (idx >= 0) {
            cycleCursorRef.current = idx;
        } else {
            cycleCursorRef.current = Math.min(
                cycleCursorRef.current,
                Math.max(cycleRows.length - 1, 0),
            );
        }
    }, [cycleRows]);

    const cycleMeta = useMemo(() => {
        const list = cycleRowsRef.current || [];
        const total = list.length || cycleRows.length;
        const idx = cycleRows.findIndex((r) => r.key === selectedKey);
        return { total, idx: idx >= 0 ? idx : cycleCursorRef.current };
    }, [cycleRows, selectedKey]);

    const startAuto = () => {
        if (intervalRef.current) return;
        intervalRef.current = setInterval(() => {
            if (pausedByHoverRef.current) return;
            setSelectedKey((prev) => {
                const list = cycleRowsRef.current || [];
                if (!list.length) return prev;
                const idx = list.findIndex((r) => r.key === prev);
                if (idx >= 0) cycleCursorRef.current = idx;

                const nextIndex = (cycleCursorRef.current + 1) % list.length;
                cycleCursorRef.current = nextIndex;
                return list[nextIndex]?.key || prev;
            });
        }, 4000);
    };

    const stopAuto = () => {
        if (!intervalRef.current) return;
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    };

    useEffect(() => {
        if (autoRun) startAuto();
        else stopAuto();
        return () => stopAuto();
    }, [autoRun]);

    // Keep the active row in view during autoplay (prevents the illusion of "reset" when it scrolls offscreen)
    useEffect(() => {
        if (!autoRun) return;
        if (!selectedKey) return;
        if (pausedByHoverRef.current) return;

        const host = timelineHostRef.current;
        if (!host) return;

        const bodyEl = host.querySelector(".ant-table-body");
        const safeKey = cssEscape(selectedKey);
        const rowEl = host.querySelector(`tr[data-row-key="${safeKey}"]`);
        if (rowEl) {
            rowEl.scrollIntoView({ block: "nearest", inline: "nearest" });
            return;
        }

        // Fallback: if row element isn't found, at least keep scrolling moving forward.
        if (bodyEl) {
            const list = cycleRowsRef.current || [];
            const nearEnd =
                list.length > 0 && cycleCursorRef.current >= list.length - 2;
            bodyEl.scrollTop = nearEnd ? bodyEl.scrollHeight : 0;
        }
    }, [autoRun, selectedKey]);

    const columns = useMemo(
        () => [
            {
                title: "",
                key: "active",
                align: "center",
                width: 34,
                render: (_, r) => (
                    <span className="inline-block w-3">
                        {r.key === selectedKey ? (
                            <span className="wms-dashboard-dot" />
                        ) : null}
                    </span>
                ),
            },
            {
                title: "ชนิด",
                key: "type",
                width: 120,
                render: (_, r) => typeTag(r.type),
            },
            {
                title: "Wave/Task",
                dataIndex: "code",
                key: "code",
                width: 170,
                render: (text) => (
                    <Text className="wms-dashboard-text" strong>
                        {text}
                    </Text>
                ),
            },
            {
                title: "สถานะ",
                dataIndex: "status",
                key: "status",
                width: 120,
                render: (status) => (
                    <Tag color={statusColor(status)}>{status}</Tag>
                ),
            },
            {
                title: "ผู้ดำเนินการ",
                dataIndex: "actionByName",
                key: "actionByName",
                width: 170,
                render: (text) => (
                    <Text className="wms-dashboard-text">{text || "-"}</Text>
                ),
            },
            {
                title: "เวลา",
                key: "time",
                width: 170,
                render: (_, r) => (
                    <Text className="wms-dashboard-muted">
                        {formatTime(r.actionAt || r.createdAt)}
                    </Text>
                ),
            },
        ],
        [selectedKey],
    );

    const detailData = detail?.data || null;

    const derivedDetail = useMemo(() => {
        if (!detailData) return null;

        const lines = [];
        let headerType = detail.type === "wave" ? "wave" : detailData.taskType;
        let headerCode =
            detail.type === "wave"
                ? detailData.waveNo
                : `Task #${detailData.id}`;
        let status =
            detail.type === "wave" ? detailData.status : detailData.status;
        let createdAt =
            detail.type === "wave"
                ? detailData.createdAt
                : detailData.createdAt;
        let actionAt =
            detail.type === "wave" ? detailData.actionAt : detailData.actionAt;
        let completedAt =
            detail.type === "wave"
                ? detailData.completedAt
                : detailData.completedAt;
        let createdByName =
            detail.type === "wave" ? detailData.createdByName : null;
        let actionByName =
            detail.type === "wave"
                ? detailData.actionByName
                : detailData.actionByName;
        let actionByAvatarUrl =
            detail.type === "wave"
                ? detailData.actionByAvatarUrl
                : detailData.actionByAvatarUrl;

        if (detail.type === "wave") {
            detailData?.tasks?.forEach((t) => {
                t.lines?.forEach((l) => {
                    lines.push({
                        key: `${t.id}:${l.id}`,
                        itemCode: l.itemCode,
                        itemName: l.itemName,
                        qty: Number(l.quantityRequired || 0),
                        uom: "แผ่น",
                        from: l.fromLocationCode,
                        to: l.toLocationCode,
                        pallet: l.palletNo,
                    });
                });
            });
        } else {
            detailData?.lines?.forEach((l) => {
                lines.push({
                    key: `${detailData.id}:${l.id}`,
                    itemCode: l.itemCode,
                    itemName: l.itemName,
                    qty: Number(l.quantityRequired || 0),
                    uom: "แผ่น",
                    from: l.fromLocationCode,
                    to: l.toLocationCode,
                    pallet: l.palletNo,
                });
            });
        }

        const itemAgg = new Map();
        for (const l of lines) {
            const k = l.itemCode || "-";
            const prev = itemAgg.get(k) || {
                itemCode: k,
                itemName: l.itemName,
                qty: 0,
                uom: l.uom || "-",
            };
            prev.qty += Number(l.qty || 0);
            itemAgg.set(k, prev);
        }
        const items = Array.from(itemAgg.values()).sort((a, b) =>
            a.itemCode.localeCompare(b.itemCode),
        );

        const pickLocations = Array.from(
            new Map(
                lines
                    .filter((l) => l.from)
                    .map((l) => [
                        `${l.from}|${l.pallet || ""}`,
                        { location: l.from, pallet: l.pallet || "-" },
                    ]),
            ).values(),
        );
        const putLocations = Array.from(
            new Map(
                lines
                    .filter((l) => l.to)
                    .map((l) => [
                        `${l.to}|${l.pallet || ""}`,
                        { location: l.to, pallet: l.pallet || "-" },
                    ]),
            ).values(),
        );

        const totals = {
            lineCount: lines.length,
            skuCount: items.length,
            totalQty: items.reduce((acc, it) => acc + Number(it.qty || 0), 0),
        };

        return {
            header: {
                type: headerType,
                code: headerCode,
                status,
                createdAt,
                actionAt,
                completedAt,
                createdByName,
                actionByName,
                actionByAvatarUrl,
            },
            items,
            pickLocations,
            putLocations,
            totals,
        };
    }, [detail?.type, detailData]);

    const detailHeader = useMemo(() => {
        if (!derivedDetail) return null;
        const h = derivedDetail.header;
        return (
            <div className="wms-dashboard-block">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Tooltip
                            title={
                                h.actionByName
                                    ? `ผู้ดำเนินการ: ${h.actionByName}`
                                    : "ยังไม่มีผู้ดำเนินการ"
                            }
                        >
                            <Avatar
                                size={44}
                                src={h.actionByAvatarUrl || undefined}
                                icon={
                                    !h.actionByAvatarUrl ? (
                                        <UserOutlined />
                                    ) : undefined
                                }
                                style={
                                    !h.actionByAvatarUrl
                                        ? {
                                              backgroundColor: "#334155",
                                              color: "#cbd5e1",
                                          }
                                        : undefined
                                }
                            />
                        </Tooltip>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                {typeTag(h.type === "wave" ? "wave" : h.type)}
                                <Text
                                    className="wms-dashboard-text text-base"
                                    strong
                                >
                                    {h.code}
                                </Text>
                            </div>
                            <Text className="wms-dashboard-muted text-xs">
                                สร้าง: {formatTime(h.createdAt)} | เริ่มทำ:{" "}
                                {formatTime(h.actionAt)} | เสร็จ:{" "}
                                {formatTime(h.completedAt)}
                            </Text>
                        </div>
                    </div>
                    <Tag
                        className="wms-dashboard-status"
                        color={statusColor(h.status)}
                    >
                        {h.status}
                    </Tag>
                </div>

                <Divider className="wms-dashboard-divider" />

                <div className="grid grid-cols-2 gap-3">
                    {kv("ผู้ดำเนินการ", h.actionByName || "-")}
                    {kv("ผู้สร้าง", h.createdByName || "-")}
                    {kv("SKU รวม", derivedDetail.totals.skuCount)}
                    {kv(
                        "จำนวนรวม",
                        `${Number(derivedDetail.totals.totalQty || 0).toLocaleString("th-TH")} ${derivedDetail.items[0]?.uom || ""}`,
                    )}
                </div>
            </div>
        );
    }, [derivedDetail]);

    const itemsTable = useMemo(() => {
        if (!derivedDetail) return null;
        const cols = [
            {
                title: "SKU | ชื่อสินค้า",
                dataIndex: "itemCode",
                key: "itemCode",
                width: 240,
                render: (t, r) => (
                    <div>
                        <Text className="wms-dashboard-text" strong>
                            {t}
                        </Text>
                        {r.itemName && (
                            <Text className="wms-dashboard-muted block">
                                {r.itemName}
                            </Text>
                        )}
                    </div>
                ),
            },
            {
                title: "จำนวน",
                dataIndex: "qty",
                key: "qty",
                width: 40,
                align: "right",
                render: (v) => (
                    <Text className="wms-dashboard-text">
                        {Number(v || 0).toLocaleString("th-TH")}
                    </Text>
                ),
            },
            {
                title: "หน่วย",
                dataIndex: "uom",
                key: "uom",
                width: 40,
                render: (t) => (
                    <Text className="wms-dashboard-muted">{t || "-"}</Text>
                ),
            },
        ];
        return (
            <div className="wms-dashboard-block">
                <div className="flex items-center justify-between">
                    <Text className="wms-dashboard-text" strong>
                        รายการสินค้า
                    </Text>
                    <Text className="wms-dashboard-muted text-xs">
                        รวม {derivedDetail.totals.skuCount} SKU /{" "}
                        {derivedDetail.totals.lineCount} รายการ
                    </Text>
                </div>
                <div className="mt-2">
                    <Table
                        size="small"
                        columns={cols}
                        dataSource={derivedDetail.items.map((it) => ({
                            ...it,
                            key: it.itemCode,
                        }))}
                        pagination={false}
                        className="wms-dashboard-table"
                    />
                </div>
            </div>
        );
    }, [derivedDetail]);

    const pickPutBlocks = useMemo(() => {
        if (!derivedDetail) return null;
        const type =
            derivedDetail.header.type === "wave"
                ? "picking"
                : derivedDetail.header.type;

        const pickTitle =
            type === "putaway"
                ? "ตำแหน่งที่ต้องไปหยิบ (N/A)"
                : "ตำแหน่งที่ต้องไปหยิบ";
        const putTitle =
            type === "picking"
                ? "ตำแหน่งที่ต้องไปวาง (N/A)"
                : "ตำแหน่งที่ต้องไปวาง";

        const pickData = derivedDetail.pickLocations;
        const putData = derivedDetail.putLocations;

        const locCols = [
            {
                title: "Location",
                dataIndex: "location",
                key: "location",
                width: 140,
                render: (t) => (
                    <Text className="wms-dashboard-text">{t || "-"}</Text>
                ),
            },
            {
                title: "Pallet",
                dataIndex: "pallet",
                key: "pallet",
                width: 160,
                render: (t) => (
                    <Text className="wms-dashboard-muted">{t || "-"}</Text>
                ),
            },
        ];

        return (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div
                    className={`wms-dashboard-block ${type === "putaway" ? "opacity-50" : ""}`}
                >
                    <Text className="wms-dashboard-text" strong>
                        {pickTitle}
                    </Text>
                    <div className="mt-2">
                        <Table
                            size="small"
                            columns={locCols}
                            dataSource={(pickData || [])
                                .slice(0, 10)
                                .map((d, idx) => ({ key: idx, ...d }))}
                            pagination={false}
                            className="wms-dashboard-table"
                        />
                    </div>
                </div>
                <div
                    className={`wms-dashboard-block ${type === "picking" ? "opacity-50" : ""}`}
                >
                    <Text className="wms-dashboard-text" strong>
                        {putTitle}
                    </Text>
                    <div className="mt-2">
                        <Table
                            size="small"
                            columns={locCols}
                            dataSource={(putData || [])
                                .slice(0, 10)
                                .map((d, idx) => ({ key: idx, ...d }))}
                            pagination={false}
                            className="wms-dashboard-table"
                        />
                    </div>
                </div>
            </div>
        );
    }, [derivedDetail]);

    return (
        <div className="wms-dashboard flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col">
                    <h1 className="text-lg font-semibold wms-dashboard-text">
                        WMS Dashboard
                    </h1>
                    <Text className="wms-dashboard-muted text-sm">
                        งานคลังแบบ timeline + รายละเอียดแบบเรียลไทม์
                    </Text>
                    <Text className="wms-dashboard-muted text-xs">
                        อัปเดตล่าสุด:{" "}
                        {lastUpdatedAt
                            ? new Date(lastUpdatedAt).toLocaleTimeString(
                                  "th-TH",
                              )
                            : "-"}{" "}
                        {refreshing ? " (กำลังรีเฟรช...)" : ""}
                    </Text>
                    <Text className="wms-dashboard-muted text-xs">
                        Auto-play:{" "}
                        {cycleMeta.total
                            ? `${cycleMeta.idx + 1}/${cycleMeta.total}`
                            : "-"}
                    </Text>
                </div>
                <Space>
                    <Input
                        allowClear
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ค้นหา wave/task, status, action by"
                        prefix={<SearchOutlined />}
                        style={{ width: 320 }}
                        className="wms-dashboard-input"
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => fetchTimeline({ silent: false })}
                        loading={loading}
                    >
                        รีเฟรช
                    </Button>
                    <Button
                        icon={
                            autoRun ? <PauseOutlined /> : <PlayCircleOutlined />
                        }
                        onClick={() => setAutoRun((v) => !v)}
                    >
                        {autoRun ? "หยุดไฮไลท์" : "เริ่มไฮไลท์"}
                    </Button>
                </Space>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_1fr]">
                <Card
                    title="Work List (Timeline)"
                    className="wms-dashboard-card shadow-sm"
                    bodyStyle={{ padding: 0 }}
                    onMouseEnter={() => {
                        pausedByHoverRef.current = true;
                    }}
                    onMouseLeave={() => {
                        pausedByHoverRef.current = false;
                    }}
                >
                    <div ref={timelineHostRef}>
                        <Table
                            size="small"
                            columns={columns}
                            dataSource={filteredRows}
                            loading={loading}
                            pagination={false}
                            rowKey="key"
                            scroll={{ x: 900, y: 560 }}
                            className="wms-dashboard-table"
                            rowClassName={(record) =>
                                record.key === selectedKey
                                    ? "wms-dashboard-row-active"
                                    : ""
                            }
                            onRow={(record) => ({
                                onClick: () => {
                                    const idx = (
                                        cycleRowsRef.current || []
                                    ).findIndex((r) => r.key === record.key);
                                    if (idx >= 0) cycleCursorRef.current = idx;
                                    setSelectedKey(record.key);
                                },
                            })}
                        />
                    </div>
                </Card>

                <Card
                    title="Task Detail"
                    className="wms-dashboard-card shadow-sm"
                >
                    <div className="flex flex-col gap-3">
                        {detailHeader}
                        {/* {detailLoading ? (
              <div className="wms-dashboard-muted text-sm">กำลังโหลดรายละเอียด...</div>
            ) : null} */}
                        {itemsTable}
                        {pickPutBlocks}
                    </div>
                </Card>
            </div>
        </div>
    );
}
