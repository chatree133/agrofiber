import React, { useEffect, useState } from "react";
import {
    Button,
    Card,
    Col,
    DatePicker,
    Form,
    Input,
    Progress,
    Row,
    Select,
    Space,
    Table,
    Tag,
    Typography,
    message,
} from "antd";
import {
    ArrowDownOutlined,
    ArrowUpOutlined,
    SaveOutlined,
    TruckOutlined,
    ArrowLeftOutlined,
    PlayCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWms } from "../../context/WmsContext.jsx";
import { useCompany } from "../../context/CompanyContext.jsx";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function LoadPlanCreate() {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const {
        getLoadPlanVehicles,
        getLoadPlanDrivers,
        getPendingDeliveryOrders,
        createLoadPlan,
    } = useWms();
    const { getBranches } = useCompany();

    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(undefined);
    const [pendingDos, setPendingDos] = useState([]);
    const [selectedDos, setSelectedDos] = useState([]); // List of selected DOs in sequence

    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedDriver, setSelectedDriver] = useState(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vehicleData, driverData, branchesData] = await Promise.all([
                getLoadPlanVehicles(),
                getLoadPlanDrivers(),
                getBranches(1),
            ]);
            setVehicles(vehicleData);
            setDrivers(driverData);
            setBranches(branchesData || []);
        } catch (err) {
            message.error("ไม่สามารถโหลดข้อมูลเบื้องต้นได้: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBranchChange = async (value) => {
        setSelectedBranchId(value);
        setSelectedDos([]); // Reset selected DOs
        setPendingDos([]); // Clear pending DOs
        form.setFieldsValue({ vehicleId: undefined }); // Clear selected vehicle
        setSelectedVehicle(null);
        if (!value) return;

        setLoading(true);
        try {
            const [pendingDoData, vehicleData] = await Promise.all([
                getPendingDeliveryOrders(value),
                getLoadPlanVehicles({ branchId: value }),
            ]);
            setPendingDos(pendingDoData || []);
            setVehicles(vehicleData || []);
        } catch (err) {
            message.error("ไม่สามารถโหลดข้อมูลใบนำส่งหรือยานพาหนะได้: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectDo = (record, checked) => {
        if (checked) {
            // Add to selected in order
            setSelectedDos([...selectedDos, record]);
            // Remove from pending
            setPendingDos(pendingDos.filter((item) => item.id !== record.id));
        } else {
            // Remove from selected
            setSelectedDos(selectedDos.filter((item) => item.id !== record.id));
            // Add back to pending
            setPendingDos([...pendingDos, record]);
        }
    };

    const handleRemoveDo = (record) => {
        setSelectedDos(selectedDos.filter((item) => item.id !== record.id));
        setPendingDos([record, ...pendingDos]);
    };

    const moveUp = (index) => {
        if (index === 0) return;
        const newSeq = [...selectedDos];
        const temp = newSeq[index];
        newSeq[index] = newSeq[index - 1];
        newSeq[index - 1] = temp;
        setSelectedDos(newSeq);
    };

    const moveDown = (index) => {
        if (index === selectedDos.length - 1) return;
        const newSeq = [...selectedDos];
        const temp = newSeq[index];
        newSeq[index] = newSeq[index + 1];
        newSeq[index + 1] = temp;
        setSelectedDos(newSeq);
    };

    // Calculate accumulated weight and volume
    const totalWeight = selectedDos.reduce(
        (sum, item) => sum + (item.totalWeightKg || 0),
        0,
    );
    const totalVolume = selectedDos.reduce(
        (sum, item) => sum + (item.totalVolumeCbm || 0),
        0,
    );

    const vehicleWeightLimit = selectedVehicle
        ? selectedVehicle.MaxWeightKg
        : 0;
    const vehicleVolumeLimit = selectedVehicle
        ? selectedVehicle.MaxVolumeCbm
        : 0;

    const weightPercent =
        vehicleWeightLimit > 0 ? (totalWeight / vehicleWeightLimit) * 100 : 0;
    const volumePercent =
        vehicleVolumeLimit > 0 ? (totalVolume / vehicleVolumeLimit) * 100 : 0;

    const handleVehicleChange = (value) => {
        const v = vehicles.find((item) => item.VehicleId === value);
        setSelectedVehicle(v);
    };

    const handleOptimizeClick = () => {
        const branchVal = form.getFieldValue("branchId");
        const dateVal = form.getFieldValue("planDate");

        if (!branchVal) {
            message.error("กรุณาเลือกสาขาจัดส่งก่อนทำการประมวลผลด้วย AI");
            return;
        }
        if (!dateVal) {
            message.error("กรุณาเลือกวันที่จัดส่งก่อนทำการประมวลผลด้วย AI");
            return;
        }

        const dateStr = dateVal.format("YYYY-MM-DD");
        
        // Open Bot optimizer page in a centered popup window
        const width = 1100;
        const height = 750;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        window.open(
            `/wms/load-plans/bot?date=${dateStr}&branch=${branchVal}`,
            "LoadPlanBotWindow",
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );
    };

    const handleSubmit = async (values) => {
        if (selectedDos.length === 0) {
            message.error(
                "กรุณาเลือกใบจัดส่ง (DO) อย่างน้อย 1 รายการเพื่อวางแผน",
            );
            return;
        }

        if (totalWeight > vehicleWeightLimit) {
            message.warning(
                "น้ำหนักสินค้าเกินขีดจำกัดของยานพาหนะ กรุณาปรับเปลี่ยนสินค้าขึ้นรถ",
            );
        }

        setSaving(true);
        try {
            const payload = {
                planDate: values.planDate.format("YYYY-MM-DD"),
                vehicleId: values.vehicleId,
                driverId: values.driverId,
                remarks: values.remarks,
                deliveryOrderIds: selectedDos.map((item) => item.id),
                branchId: selectedBranchId,
            };

            await createLoadPlan(payload);
            message.success("สร้างแผนจัดส่งเรียบร้อยแล้ว");
            navigate("/wms/load-plans");
        } catch (err) {
            message.error("ไม่สามารถบันทึกแผนจัดส่งได้: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const pendingColumns = [
        {
            title: "เลขที่ DO",
            dataIndex: "documentNo",
            key: "documentNo",
            render: (text) => (
                <Text strong className="text-teal-600">
                    {text}
                </Text>
            ),
        },
        {
            title: "ลูกค้า",
            dataIndex: "customerName",
            key: "customerName",
            render: (text, r) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{text}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.customerCode}
                    </Text>
                </div>
            ),
        },
        {
            title: "ที่อยู่จัดส่ง",
            dataIndex: "shipToAddress",
            key: "shipToAddress",
            ellipsis: true,
            render: (text) => (
                <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ margin: 0, fontSize: 13 }}
                >
                    {text}
                </Paragraph>
            ),
        },
        {
            title: "น้ำหนัก (kg)",
            dataIndex: "totalWeightKg",
            key: "totalWeightKg",
            render: (val) => (
                <Text style={{ fontFamily: "monospace" }}>
                    {val.toFixed(2)}
                </Text>
            ),
        },
        {
            title: "ปริมาตร (CBM)",
            dataIndex: "totalVolumeCbm",
            key: "totalVolumeCbm",
            render: (val) => (
                <Text style={{ fontFamily: "monospace" }}>
                    {val.toFixed(3)}
                </Text>
            ),
        },
        {
            title: "เลือก",
            key: "action",
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    onClick={() => handleSelectDo(record, true)}
                    style={{
                        backgroundColor: "#0f766e",
                        borderColor: "#0f766e",
                    }}
                >
                    จัดส่ง
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                }}
            >
                <div style={{ display: "flex", alignItems: "center" }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate("/wms/load-plans")}
                        style={{ marginRight: "12px" }}
                    />
                    <h1 className="text-lg font-semibold text-slate-800">
                        สร้างแผนการบรรทุกและจัดส่งสินค้า
                    </h1>
                </div>
            </div>

            <Row gutter={24}>
                {/* Left Side: Create Form & Selected Items Capacity Summary */}
                <Col xs={24} lg={10}>
                    <Card
                        title={
                            <Space>
                                <TruckOutlined style={{ color: "#0f766e" }} />
                                ข้อมูลและขีดจำกัดยานพาหนะ
                            </Space>
                        }
                        // bordered={false}
                        style={{
                            borderRadius: 12,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            marginBottom: 24,
                        }}
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleSubmit}
                            initialValues={{ planDate: dayjs() }}
                        >
                            <Row gutter={16}>
                                <Col span={12}><Form.Item
                                    name="branchId"
                                    label="สาขาจัดส่ง"
                                    rules={[
                                        {
                                            required: true,
                                            message: "กรุณาเลือกสาขาจัดส่ง",
                                        },
                                    ]}
                                >
                                    <Select
                                        placeholder="เลือกสาขาเพื่อโหลดรายการจัดส่ง"
                                        onChange={handleBranchChange}
                                        style={{ borderRadius: 6 }}
                                    >
                                        {branches.map((b) => (
                                            <Option key={b.branchId} value={b.branchId}>
                                                {b.branchCode} - {b.branchName}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item></Col>
                                <Col span={12}>                                    <Form.Item
                                    name="planDate"
                                    label="วันที่จัดส่ง"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "กรุณาเลือกวันที่จัดส่ง",
                                        },
                                    ]}
                                >
                                    <DatePicker
                                        style={{
                                            width: "100%",
                                            borderRadius: 6,
                                        }}
                                        format="YYYY-MM-DD"
                                    />
                                </Form.Item></Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        name="vehicleId"
                                        label="ยานพาหนะขนส่ง"
                                        rules={[
                                            {
                                                required: true,
                                                message: "กรุณาเลือกยานพาหนะ",
                                            },
                                        ]}
                                    >
                                        <Select
                                            placeholder="เลือกรถจัดส่ง"
                                            onChange={handleVehicleChange}
                                            disabled={!selectedBranchId}
                                            style={{ borderRadius: 6 }}
                                        >
                                            {vehicles.map((v) => (
                                                <Option
                                                    key={v.VehicleId}
                                                    value={v.VehicleId}
                                                >
                                                    {v.LicensePlate} ({v.VehicleType})
                                                    {v.WorkingStart && v.WorkingEnd ? ` [เวลาทำงาน: ${v.WorkingStart}-${v.WorkingEnd}]` : ''}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="driverId"
                                        label="พนักงานขับรถ"
                                        rules={[
                                            {
                                                required: true,
                                                message: "กรุณาเลือกพนักงานขับรถ",
                                            },
                                        ]}
                                    >
                                        <Select
                                            placeholder="เลือกคนขับรถ"
                                            style={{ borderRadius: 6 }}
                                        >
                                            {drivers.map((d) => (
                                                <Option
                                                    key={d.DriverId}
                                                    value={d.DriverId}
                                                >
                                                    {d.DriverName} (เขตพื้นที่วิ่ง:{" "}
                                                    {d.PreferredProvince ||
                                                        "ทุกจังหวัด"}
                                                    )
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>


                            <Form.Item
                                name="remarks"
                                label="หมายเหตุ (ออปชั่น)"
                            >
                                <Input.TextArea
                                    rows={2}
                                    placeholder="หมายเหตุแผนจัดส่ง..."
                                    style={{ borderRadius: 6 }}
                                />
                            </Form.Item>

                            {/* Capacities indicators */}
                            {selectedVehicle && (
                                <div
                                    style={{
                                        marginTop: 20,
                                        padding: 16,
                                        backgroundColor: "#f1f5f9",
                                        borderRadius: 8,
                                    }}
                                >
                                    <Text strong>
                                        สรุปความสามารถในการบรรทุกสินค้า
                                    </Text>

                                    <div style={{ marginTop: 12 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                marginBottom: 4,
                                            }}
                                        >
                                            <Text style={{ fontSize: 13 }}>
                                                น้ำหนักที่บรรทุก:{" "}
                                                {totalWeight.toFixed(1)} /{" "}
                                                {vehicleWeightLimit.toFixed(0)}{" "}
                                                kg
                                            </Text>
                                            <Text
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                {weightPercent.toFixed(1)}%
                                            </Text>
                                        </div>
                                        <Progress
                                            percent={Math.min(
                                                weightPercent,
                                                100,
                                            )}
                                            status={
                                                weightPercent > 100
                                                    ? "exception"
                                                    : "active"
                                            }
                                            strokeColor={
                                                weightPercent > 100
                                                    ? "#ef4444"
                                                    : "#10b981"
                                            }
                                            showInfo={false}
                                        />
                                    </div>

                                    <div style={{ marginTop: 12 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                marginBottom: 4,
                                            }}
                                        >
                                            <Text style={{ fontSize: 13 }}>
                                                ปริมาตรสินค้า:{" "}
                                                {totalVolume.toFixed(2)} /{" "}
                                                {vehicleVolumeLimit.toFixed(1)}{" "}
                                                CBM
                                            </Text>
                                            <Text
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                {volumePercent.toFixed(1)}%
                                            </Text>
                                        </div>
                                        <Progress
                                            percent={Math.min(
                                                volumePercent,
                                                100,
                                            )}
                                            status={
                                                volumePercent > 100
                                                    ? "exception"
                                                    : "active"
                                            }
                                            strokeColor={
                                                volumePercent > 100
                                                    ? "#ef4444"
                                                    : "#06b6d4"
                                            }
                                            showInfo={false}
                                        />
                                    </div>
                                </div>
                            )}

                            <Form.Item
                                style={{ marginTop: 24, marginBottom: 0 }}
                            >
                                <div style={{ display: "flex", gap: 12 }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        icon={<SaveOutlined />}
                                        loading={saving}
                                        style={{
                                            flex: 1,
                                            height: 42,
                                            background: "#0f766e",
                                            borderColor: "#0f766e",
                                            borderRadius: 6,
                                            fontWeight: 600,
                                        }}
                                    >
                                        บันทึกแผนจัดส่ง
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<PlayCircleOutlined />}
                                        onClick={handleOptimizeClick}
                                        style={{
                                            flex: 1,
                                            height: 42,
                                            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                                            borderColor: "#4f46e5",
                                            borderRadius: 6,
                                            fontWeight: 600,
                                        }}
                                    >
                                        ประมวลผลด้วย AI
                                    </Button>
                                </div>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>

                {/* Right Side: Selected Drops Sequence */}
                <Col xs={24} lg={14}>
                    <Card
                        title={
                            <Space>
                                <Text strong>
                                    ลำดับจุดจอดและส่งของ (Drop Sequence)
                                </Text>
                                <Tag color="blue">
                                    {selectedDos.length} ใบสั่งงาน
                                </Tag>
                            </Space>
                        }
                        // bordered={false}
                        style={{
                            borderRadius: 12,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            marginBottom: 24,
                        }}
                    >
                        {selectedDos.length === 0 ? (
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: "48px 0",
                                    color: "#94a3b8",
                                }}
                            >
                                <Paragraph>
                                    กรุณาเลือกใบนำส่งสินค้า (DO)
                                    จากตารางด้านล่างเพื่อจัดขึ้นรถ
                                </Paragraph>
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 12,
                                }}
                            >
                                {selectedDos.map((item, index) => (
                                    <div
                                        key={item.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "12px 16px",
                                            background: "#ffffff",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: 8,
                                            transition: "all 0.2s",
                                            boxShadow:
                                                "0 1px 3px 0 rgb(0 0 0 / 0.05)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    background: "#0f766e",
                                                    color: "#ffffff",
                                                    borderRadius: "50%",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontWeight: "bold",
                                                    fontSize: 13,
                                                }}
                                            >
                                                {index + 1}
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    {item.documentNo} -{" "}
                                                    {item.customerName}
                                                </div>
                                                <Text
                                                    type="secondary"
                                                    style={{ fontSize: 12 }}
                                                >
                                                    {item.shipToAddress}
                                                </Text>
                                                <div style={{ marginTop: 4 }}>
                                                    <Tag color="cyan">
                                                        น้ำหนัก:{" "}
                                                        {item.totalWeightKg.toFixed(
                                                            1,
                                                        )}{" "}
                                                        kg
                                                    </Tag>
                                                    <Tag color="purple">
                                                        ปริมาตร:{" "}
                                                        {item.totalVolumeCbm.toFixed(
                                                            3,
                                                        )}{" "}
                                                        CBM
                                                    </Tag>
                                                </div>
                                            </div>
                                        </div>

                                        <Space>
                                            <Button
                                                icon={<ArrowUpOutlined />}
                                                size="small"
                                                disabled={index === 0}
                                                onClick={() => moveUp(index)}
                                            />
                                            <Button
                                                icon={<ArrowDownOutlined />}
                                                size="small"
                                                disabled={
                                                    index ===
                                                    selectedDos.length - 1
                                                }
                                                onClick={() => moveDown(index)}
                                            />
                                            <Button
                                                danger
                                                size="small"
                                                onClick={() =>
                                                    handleRemoveDo(item)
                                                }
                                            >
                                                นำออก
                                            </Button>
                                        </Space>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Bottom Table: Pending Delivery Orders */}
            <Card
                title={
                    <Space>
                        <Text strong>
                            รายการใบจัดส่งสินค้าที่พร้อมขึ้นรถ (Pending DOs)
                        </Text>
                        <Tag color="orange">{pendingDos.length} รายการ</Tag>
                    </Space>
                }
                // bordered={false}
                style={{
                    borderRadius: 12,
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                bodyStyle={{ padding: 12 }}
            >
                <Table
                    dataSource={pendingDos}
                    columns={pendingColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    style={{ width: "100%" }}
                />
            </Card>
        </div>
    );
}
