import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Button,
    Card,
    DatePicker,
    Form,
    InputNumber,
    Select,
    Space,
    Table,
    Tag,
    Typography,
    message,
} from "antd";
import { PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useItem } from "../../context/ItemContext.jsx";
import { useMasterData } from "../../context/MasterDataContext.jsx";

const { Text } = Typography;

function toIsoDateOrNull(value) {
    if (!value) return null;
    const d = dayjs(value);
    if (!d.isValid()) return null;
    return d.format("YYYY-MM-DD");
}

export default function Conversions() {
    const { lookups, fetchLookups } = useMasterData();
    const { searchSkus, getItemSpecs, getItemConversions, createItemConversion } =
        useItem();

    const units = lookups?.units || [];

    const [skuOptions, setSkuOptions] = useState([]);
    const [skuLoading, setSkuLoading] = useState(false);
    const [skuSearchValue, setSkuSearchValue] = useState("");
    const skuReqSeqRef = useRef(0);
    const skuDebounceRef = useRef(null);
    const skuOptionsQueryRef = useRef("");

    const [itemId, setItemId] = useState(null);
    const [itemLabel, setItemLabel] = useState(null);

    const [specOptions, setSpecOptions] = useState([]);
    const [specLoading, setSpecLoading] = useState(false);
    const [itemSpecId, setItemSpecId] = useState(null); // null = default (item-level)

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchLookups();
    }, [fetchLookups]);

    const buildSkuOptions = (rows) => {
        const map = new Map();
        for (const r of rows || []) {
            if (!map.has(r.itemId)) {
                map.set(r.itemId, {
                    value: r.itemId,
                    label: r.itemCode,
                    itemCode: r.itemCode,
                    count: 1,
                });
            } else {
                map.get(r.itemId).count += 1;
            }
        }

        return Array.from(map.values()).map((o) => ({
            value: o.value,
            label: o.count > 1 ? `${o.label} (${o.count} สเปค)` : o.label,
            itemCode: o.itemCode,
        }));
    };

    const loadSkuOptions = async (q, { force = false } = {}) => {
        const searchTerm = String(q || "").trim();
        if (!force && !searchTerm) return [];

        const seq = ++skuReqSeqRef.current;
        setSkuLoading(true);
        try {
            const res = await searchSkus(searchTerm, 1, 30);
            const data = Array.isArray(res) ? res : res?.data || [];
            const options = buildSkuOptions(data);
            if (seq !== skuReqSeqRef.current) return [];
            skuOptionsQueryRef.current = searchTerm;
            setSkuOptions(options);
            return options;
        } catch (err) {
            if (seq !== skuReqSeqRef.current) return [];
            message.error("ค้นหาสินค้าไม่สำเร็จ: " + err.message);
            return [];
        } finally {
            if (seq !== skuReqSeqRef.current) return;
            setSkuLoading(false);
        }
    };

    const clearSkuDebounce = () => {
        if (!skuDebounceRef.current) return;
        clearTimeout(skuDebounceRef.current);
        skuDebounceRef.current = null;
    };

    useEffect(() => {
        loadSkuOptions("", { force: true });
    }, []);

    useEffect(() => {
        return clearSkuDebounce;
    }, []);

    const loadSpecs = async (id) => {
        if (!id) return;
        setSpecLoading(true);
        try {
            const specs = await getItemSpecs(id);
            const options = (specs || []).map((s) => ({
                value: s.itemSpecId,
                label: s.specName
                    ? `${s.specCode || s.salesSku || ""} - ${s.specName}`.trim()
                    : s.specCode || s.salesSku || `Spec #${s.itemSpecId}`,
                salesSku: s.salesSku,
                specName: s.specName,
                specCode: s.specCode,
            }));
            setSpecOptions(options);
        } catch (err) {
            setSpecOptions([]);
            message.error("โหลดสเปคสินค้าไม่สำเร็จ: " + err.message);
        } finally {
            setSpecLoading(false);
        }
    };

    const loadConversions = async (id) => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await getItemConversions(id);
            setRows(Array.isArray(res) ? res : res?.data || []);
        } catch (err) {
            message.error("โหลด conversions ไม่สำเร็จ: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectSkuOption = (option) => {
        if (!option) return;
        clearSkuDebounce();
        setItemId(option.value);
        setItemLabel(option.label || null);
        setSkuSearchValue("");
    };

    const handleSkuSearch = (q) => {
        const searchTerm = String(q || "").trim();
        setSkuSearchValue(q);
        clearSkuDebounce();
        if (!searchTerm) return;

        skuDebounceRef.current = setTimeout(() => {
            loadSkuOptions(searchTerm);
        }, 250);
    };

    const handleSkuEnter = async (e) => {
        if (e.key !== "Enter" || itemId) return;

        const searchTerm = String(
            e.currentTarget?.value || skuSearchValue || "",
        ).trim();
        if (!searchTerm) return;

        e.preventDefault();
        e.stopPropagation();
        clearSkuDebounce();

        const options =
            skuOptionsQueryRef.current === searchTerm
                ? skuOptions
                : await loadSkuOptions(searchTerm);
        selectSkuOption(options[0]);
    };

    const handleSkuClear = () => {
        clearSkuDebounce();
        setItemId(null);
        setItemLabel(null);
        setSkuSearchValue("");
        loadSkuOptions("", { force: true });
    };

    useEffect(() => {
        if (!itemId) return;
        loadSpecs(itemId);
        loadConversions(itemId);
        setItemSpecId(null);
        form.setFieldsValue({ itemSpecId: null });
    }, [itemId]);

    const filteredRows = useMemo(() => {
        if (!itemId) return [];
        if (itemSpecId === "__ALL__") return rows;
        if (itemSpecId === null) return rows.filter((r) => r.itemSpecId == null);
        // show selected spec overrides + default
        return rows.filter((r) => r.itemSpecId === itemSpecId || r.itemSpecId == null);
    }, [rows, itemId, itemSpecId]);

    const columns = [
        {
            title: "Scope",
            key: "scope",
            width: 130,
            render: (_, r) =>
                r.itemSpecId ? (
                    <Tag color="purple">Spec Override</Tag>
                ) : (
                    <Tag color="blue">Default</Tag>
                ),
        },
        {
            title: "จากหน่วย (From)",
            key: "from",
            width: 160,
            render: (_, r) => (
                <Text>
                    {r.fromUnitCode}{" "}
                    <Text type="secondary">({r.fromUnitName})</Text>
                </Text>
            ),
        },
        {
            title: "ถึงหน่วย (To)",
            key: "to",
            width: 160,
            render: (_, r) => (
                <Text>
                    {r.toUnitCode} <Text type="secondary">({r.toUnitName})</Text>
                </Text>
            ),
        },
        {
            title: "Factor",
            dataIndex: "conversionFactor",
            key: "conversionFactor",
            width: 120,
            align: "right",
            render: (v) => (
                <Text strong>{Number(v || 0).toLocaleString("th-TH")}</Text>
            ),
        },
        {
            title: "คำอธิบาย",
            key: "description",
            width: 220,
            render: (_, r) => (
                <Text>
                    1 {r.fromUnitCode} ={" "}
                    {Number(r.conversionFactor || 0).toLocaleString("th-TH")}{" "}
                    {r.toUnitCode}
                </Text>
            ),
        },
        {
            title: "เริ่ม-สิ้นสุดใช้",
            key: "effective",
            width: 220,
            render: (_, r) => (
                <Text type="secondary">
                    {r.effectiveFrom
                        ? dayjs(r.effectiveFrom).format("YYYY-MM-DD")
                        : "-"}
                    {" → "}
                    {r.effectiveTo ? dayjs(r.effectiveTo).format("YYYY-MM-DD") : "∞"}
                </Text>
            ),
        },
        {
            title: "Active",
            key: "active",
            width: 100,
            render: (_, r) =>
                r.isActive ? (
                    <Tag color="green">Active</Tag>
                ) : (
                    <Tag color="default">Inactive</Tag>
                ),
        },
    ];

    const unitOptions = units.map((u) => ({ value: u.value, label: u.label }));

    const specSelectOptions = [
        { value: "__ALL__", label: "ดูทั้งหมด (All)" },
        { value: null, label: "Default (Item)" },
        ...specOptions,
    ];

    const handleCreate = async (values) => {
        if (!itemId) return;
        setSaving(true);
        try {
            await createItemConversion(itemId, {
                itemSpecId:
                    values.itemSpecId === "__ALL__" ? null : values.itemSpecId,
                fromUnitId: values.fromUnitId,
                toUnitId: values.toUnitId,
                conversionFactor: values.conversionFactor,
                effectiveFrom: toIsoDateOrNull(values.effectiveFrom),
                effectiveTo: toIsoDateOrNull(values.effectiveTo),
                isActive: values.isActive,
            });
            message.success("บันทึก conversion แล้ว");
            form.resetFields(["fromUnitId", "toUnitId", "conversionFactor", "effectiveFrom", "effectiveTo"]);
            await loadConversions(itemId);
        } catch (err) {
            message.error("บันทึกไม่สำเร็จ: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex flex-col">
                    <h1 className="text-lg font-semibold text-slate-800">
                        Unit Conversions
                    </h1>
                    <Text type="secondary" className="text-sm">
                        ตั้งค่า conversion แบบ Default (Item) และ Spec Override
                    </Text>
                </div>
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => itemId && loadConversions(itemId)}
                        loading={loading}
                        disabled={!itemId}
                    >
                        รีเฟรช
                    </Button>
                </Space>
            </div>

            <Card className="shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="flex flex-col gap-1">
                        <Text type="secondary">สินค้า</Text>
                        <Select
                            showSearch
                            value={itemId}
                            searchValue={skuSearchValue}
                            placeholder="ค้นหา Item แล้วเลือก"
                            filterOption={false}
                            onSearch={handleSkuSearch}
                            onInputKeyDown={handleSkuEnter}
                            onChange={(val, option) => {
                                selectSkuOption({ value: val, label: option?.label });
                            }}
                            allowClear
                            onClear={handleSkuClear}
                            options={skuOptions}
                            loading={skuLoading}
                            suffixIcon={<SearchOutlined />}
                        />
                        {itemLabel ? (
                            <Text className="text-xs text-slate-500">
                                เลือก: {itemLabel}
                            </Text>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-1">
                        <Text type="secondary">มุมมองสเปค</Text>
                        <Select
                            value={itemSpecId}
                            placeholder="เลือกสเปค (เพื่อกรองตาราง)"
                            disabled={!itemId}
                            loading={specLoading}
                            options={specSelectOptions}
                            onChange={(v) => setItemSpecId(v)}
                        />
                        <Text className="text-xs text-slate-500">
                            กรองตาราง: เลือก Spec จะโชว์ Spec Override + Default
                        </Text>
                    </div>

                    <div className="flex flex-col gap-1">
                        <Text type="secondary">เพิ่ม Conversion</Text>
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleCreate}
                            initialValues={{
                                itemSpecId: null,
                                isActive: true,
                                effectiveFrom: dayjs(),
                            }}
                        >
                            <div className="grid grid-cols-2 gap-2">
                                <Form.Item
                                    name="itemSpecId"
                                    label="Scope"
                                    style={{ marginBottom: 8 }}
                                >
                                    <Select
                                        disabled={!itemId}
                                        loading={specLoading}
                                        options={[
                                            { value: null, label: "Default (Item)" },
                                            ...specOptions,
                                        ]}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="conversionFactor"
                                    label="Factor"
                                    rules={[{ required: true, message: "กรอก factor" }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <InputNumber
                                        min={0}
                                        step={0.0001}
                                        style={{ width: "100%" }}
                                        placeholder="เช่น 100"
                                    />
                                </Form.Item>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Form.Item
                                    name="fromUnitId"
                                    label="จากหน่วย (From)"
                                    rules={[
                                        { required: true, message: "เลือกหน่วย From" },
                                    ]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <Select
                                        disabled={!itemId}
                                        options={unitOptions}
                                        showSearch
                                        optionFilterProp="label"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="toUnitId"
                                    label="ถึงหน่วย (To)"
                                    rules={[{ required: true, message: "เลือกหน่วย To" }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <Select
                                        disabled={!itemId}
                                        options={unitOptions}
                                        showSearch
                                        optionFilterProp="label"
                                    />
                                </Form.Item>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Form.Item
                                    name="effectiveFrom"
                                    label="เริ่มใช้"
                                    style={{ marginBottom: 8 }}
                                >
                                    <DatePicker
                                        style={{ width: "100%" }}
                                        disabled={!itemId}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="effectiveTo"
                                    label="สิ้นสุดใช้"
                                    style={{ marginBottom: 8 }}
                                >
                                    <DatePicker
                                        style={{ width: "100%" }}
                                        disabled={!itemId}
                                    />
                                </Form.Item>
                            </div>

                            <div className="flex items-center justify-end">
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    htmlType="submit"
                                    loading={saving}
                                    disabled={!itemId}
                                    style={{
                                        backgroundColor: "#0b733e",
                                        borderColor: "#0b733e",
                                    }}
                                >
                                    เพิ่ม
                                </Button>
                            </div>
                        </Form>
                    </div>
                </div>
            </Card>

            <Card className="shadow-sm" bodyStyle={{ padding: 0 }}>
                <Table
                    size="small"
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredRows}
                    loading={loading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 900 }}
                />
            </Card>
        </div>
    );
}
