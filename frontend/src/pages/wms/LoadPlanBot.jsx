import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Card,
    Col,
    Row,
    Spin,
    Alert,
    Button,
    Typography,
    Space,
    Tag,
    message,
    Timeline,
    Statistic
} from "antd";
import {
    EnvironmentOutlined,
    TruckOutlined,
    DatabaseOutlined,
    CheckCircleOutlined,
    PlayCircleOutlined,
    GlobalOutlined,
    ShopOutlined,
    DollarOutlined,
    DashboardOutlined
} from "@ant-design/icons";
import { useWms } from "../../context/WmsContext";

const { Title, Text, Paragraph } = Typography;

export default function LoadPlanBot() {
    const { getLoadPlanBotPayload, createLoadPlan } = useWms();
    const [searchParams] = useSearchParams();
    const date = searchParams.get("date");
    const branch = searchParams.get("branch");

    const [loading, setLoading] = useState(false);
    const [payload, setPayload] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!date || !branch) {
            setError("ไม่พบข้อมูลพารามิเตอร์ date หรือ branch ใน URL เช่น /wms/load-plans/bot?date=2026-06-13&branch=1");
            return;
        }

        async function fetchPayload() {
            setLoading(true);
            setError(null);
            try {
                const res = await getLoadPlanBotPayload(date, branch);
                setPayload(res);
            } catch (err) {
                console.error("Failed to load bot payload", err);
                setError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
            } finally {
                setLoading(false);
            }
        }

        fetchPayload();
    }, [date, branch]);

    const formatMinutesToTime = (min) => {
        if (min === null || min === undefined) return "N/A";
        const hrs = Math.floor(min / 60);
        const mins = min % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    };

    const handleConfirm = async () => {
        if (!payload || !payload.routes) return;
        setSaving(true);
        try {
            const activeRoutes = payload.routes.filter(r => r.route?.some(stop => stop.order_id !== 'depot'));

            if (activeRoutes.length === 0) {
                message.warning("ไม่มีเส้นทางที่ประมวลผลได้สำหรับการบันทึก");
                setSaving(false);
                return;
            }

            // Create a load plan sequentially for each active vehicle route
            for (const route of activeRoutes) {
                const stopsWithData = route.route.filter(stop => stop.order_id !== 'depot' && stop.deliveryOrderId);
                const deliveryOrderIds = stopsWithData.map(stop => stop.deliveryOrderId);

                if (deliveryOrderIds.length === 0) continue;

                const deliveryOrders = stopsWithData.map(stop => ({
                    deliveryOrderId: stop.deliveryOrderId,
                    lat: stop.lat,
                    lng: stop.lng
                }));

                const planPayload = {
                    planDate: date,
                    vehicleId: parseInt(route.vehicle_id, 10),
                    driverId: route.driver_id && !isNaN(parseInt(route.driver_id, 10)) ? parseInt(route.driver_id, 10) : null,
                    remarks: `แผนจัดส่งอัตโนมัติ AI (ระยะทาง ${(route.total_distance_meters / 1000).toFixed(1)} กม., ค่าใช้จ่าย ${route.total_cost.toFixed(2)} บาท)`,
                    deliveryOrderIds,
                    deliveryOrders,
                    branchId: parseInt(branch, 10)
                };

                await createLoadPlan(planPayload);
            }

            message.success("ยืนยันและเปิดใช้งานแผนเดินรถสำเร็จ!");

            // Delay closing the popup so the user can read the success message
            setTimeout(() => {
                // Redirect opener parent window
                if (window.opener && !window.opener.closed) {
                    window.opener.location.href = "/wms/load-plans";
                }
                // Close popup
                window.close();
            }, 1500);
        } catch (err) {
            console.error("Failed to save load plans", err);
            message.error("ไม่สามารถสร้างแผนจัดส่งได้: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const activeRoutes = (payload?.routes || []).filter(r => r.route?.some(stop => stop.order_id !== 'depot'));
    const depotName = payload?.routes?.[0]?.route?.[0]?.customerName || `สาขา ID: ${branch}`;

    return (
        <div style={{ padding: "24px", minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif" }}>

            {/* Header Title */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        <GlobalOutlined style={{ color: "#7c3aed", marginRight: "10px" }} />
                        แผนจัดเส้นทางและลำดับการเดินรถ (AI Route Optimization)
                    </h1>
                    <Paragraph style={{ margin: "4px 0 0 0", color: "#64748b" }}>
                        ประมวลผลการจัดส่งตามความสามารถในการบรรทุกรถ ระยะทางเดินทาง และสล็อตช่วงเวลา (Time Windows)
                    </Paragraph>
                </div>
                <Space>
                    <Tag color="purple" style={{ fontSize: "14px", padding: "4px 10px", borderRadius: "6px" }}>
                        วันที่จัดส่ง: {date}
                    </Tag>
                    <Tag color="geekblue" style={{ fontSize: "14px", padding: "4px 10px", borderRadius: "6px" }}>
                        สาขาต้นทาง: {depotName}
                    </Tag>
                </Space>
            </div>

            {error && (
                <Alert
                    message="ไม่สามารถประมวลผลแผนจัดเส้นทางได้"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: "24px", borderRadius: "12px" }}
                />
            )}

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px", flexDirection: "column", gap: "16px" }}>
                    <Spin size="large" />
                    <Text type="secondary">ระบบกำลังจัดลำดับเส้นทางเดินรถและวิเคราะห์ข้อมูลพิกัดภูมิศาสตร์ (VRP)...</Text>
                </div>
            ) : payload ? (
                <>
                    {/* Fleet Stats Overview */}
                    <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
                        <Col xs={12} sm={6}>
                            <Card bordered={false} style={{ borderRadius: "16px", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)", background: "#ffffff" }}>
                                <Statistic
                                    title={<Text type="secondary">ระยะทางรวมทั้งหมด</Text>}
                                    value={(payload.total_distance_meters / 1000).toFixed(2)}
                                    suffix="กม."
                                    valueStyle={{ fontSize: "22px", color: "#7c3aed", fontWeight: "800" }}
                                    prefix={<DashboardOutlined style={{ marginRight: 6 }} />}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card bordered={false} style={{ borderRadius: "16px", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)", background: "#ffffff" }}>
                                <Statistic
                                    title={<Text type="secondary">ค่าใช้จ่ายรวมโดยประมาณ</Text>}
                                    value={payload.total_cost || 0}
                                    precision={2}
                                    suffix="บาท"
                                    valueStyle={{ fontSize: "22px", color: "#2563eb", fontWeight: "800" }}
                                    prefix={<DollarOutlined style={{ marginRight: 6 }} />}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card bordered={false} style={{ borderRadius: "16px", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)", background: "#ffffff" }}>
                                <Statistic
                                    title={<Text type="secondary">น้ำหนักสินค้าจัดส่งรวม</Text>}
                                    value={payload.total_weight || 0}
                                    precision={2}
                                    suffix="kg"
                                    valueStyle={{ fontSize: "22px", color: "#059669", fontWeight: "800" }}
                                    prefix={<DatabaseOutlined style={{ marginRight: 6 }} />}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card bordered={false} style={{ borderRadius: "16px", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)", background: "#ffffff" }}>
                                <Statistic
                                    title={<Text type="secondary">จำนวนแผนที่วิ่งจริง</Text>}
                                    value={activeRoutes.length}
                                    suffix="คัน"
                                    valueStyle={{ fontSize: "22px", color: "#d97706", fontWeight: "800" }}
                                    prefix={<TruckOutlined style={{ marginRight: 6 }} />}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {payload.unassigned_orders && payload.unassigned_orders.length > 0 && (
                        <Alert
                            message="มีใบส่งของที่ยังไม่ถูกจัดลงรถ"
                            description={`ใบสั่งงานเหล่านี้ไม่สามารถจัดลงรถได้เนื่องจากข้อจำกัดด้านความจุหรือเวลาทำงานของรถ: ${payload.unassigned_orders.join(", ")}`}
                            type="warning"
                            showIcon
                            style={{ marginBottom: "24px", borderRadius: "12px" }}
                        />
                    )}

                    {activeRoutes.length === 0 ? (
                        <Card style={{ borderRadius: "16px", textAlign: "center", padding: "40px" }}>
                            <Text type="secondary">ไม่มีรถที่มีกำหนดการขนส่ง (ไม่มีออเดอร์จัดส่งในวันที่ระบุ)</Text>
                        </Card>
                    ) : (
                        <Row gutter={[16, 16]} style={{ marginBottom: "80px" }}>
                            {activeRoutes.map((route, rIdx) => (
                                <Col xs={24} lg={12} key={route.vehicle_id}>
                                    <Card
                                        title={
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Space>
                                                    <TruckOutlined style={{ color: "#7c3aed" }} />
                                                    <Text strong style={{ fontSize: "14px" }}>
                                                        รถคันที่ {route.vehicle_id} {route.licensePlate ? `[${route.licensePlate}] [${route.vehicleType ? route.vehicleType : ''}]` : ''}
                                                    </Text>
                                                </Space>
                                                <Tag color="purple">
                                                    ความจุสูงสุด: {route.weight_capacity} kg / {route.volume_capacity} CBM
                                                </Tag>
                                            </div>
                                        }
                                        bordered={false}
                                        style={{
                                            borderRadius: "16px",
                                            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                                            height: "100%",
                                            display: "flex",
                                            flexDirection: "column"
                                        }}
                                        bodyStyle={{ flexGrow: 1, padding: "20px" }}
                                    >
                                        <Timeline mode="left" style={{ marginTop: "10px" }}>
                                            {route.route.map((stop, sIdx) => {
                                                const isDepot = stop.order_id === "depot";

                                                return (
                                                    <Timeline.Item
                                                        key={sIdx}
                                                        dot={isDepot ? <ShopOutlined style={{ fontSize: '16px', color: '#0f766e' }} /> : <EnvironmentOutlined style={{ fontSize: '16px', color: '#3b82f6' }} />}
                                                        color={isDepot ? "teal" : "blue"}
                                                    >
                                                        <div style={{ padding: "0 0 16px 8px" }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                                                <Text strong style={{ fontSize: "14px", color: isDepot ? "#0f766e" : "#1e293b" }}>
                                                                    {isDepot ? `สาขา: ${stop.customerName}` : `ใบสั่งงาน: ${stop.order_id}`}
                                                                </Text>
                                                                <Text type="secondary" style={{ fontSize: "12px" }}>
                                                                    เวลาที่เข้าจอด: {formatMinutesToTime(stop.arrival_time_min)} - {formatMinutesToTime(stop.departure_time_min)}
                                                                </Text>
                                                            </div>
                                                            {!isDepot && (
                                                                <div style={{ marginTop: "4px" }}>
                                                                    <Text style={{ display: "block", fontSize: "13px", color: "#475569" }}>
                                                                        ลูกค้า: <strong>{stop.customerName}</strong>
                                                                    </Text>
                                                                    <Text type="secondary" style={{ display: "block", fontSize: "12px", color: "#64748b", margin: "2px 0" }}>
                                                                        ที่อยู่: {stop.shippingAddress}
                                                                    </Text>
                                                                    <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                                                        <Tag color="cyan">น้ำหนัก: {stop.weight?.toFixed(2)} kg</Tag>
                                                                        <Tag color="purple">ปริมาตร: {stop.volume?.toFixed(3)} CBM</Tag>
                                                                        {stop.lat && stop.lng && (
                                                                            <>
                                                                                <Text type="secondary" style={{ fontSize: "12px", marginRight: "4px" }}>
                                                                                    พิกัด: {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}
                                                                                </Text>
                                                                                <Button
                                                                                    type="link"
                                                                                    size="small"
                                                                                    icon={<EnvironmentOutlined />}
                                                                                    href={`https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`}
                                                                                    target="_blank"
                                                                                    style={{ padding: 0, height: "auto" }}
                                                                                >
                                                                                    เปิดพิกัดแผนที่
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {isDepot && (
                                                                <Text type="secondary" style={{ display: "block", fontSize: "12px" }}>
                                                                    จุดพักคอยรถบรรทุก
                                                                </Text>
                                                            )}
                                                        </div>
                                                    </Timeline.Item>
                                                );
                                            })}
                                        </Timeline>

                                        {/* Card Footer Summary */}
                                        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "15px", marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <Space direction="vertical" size={2}>
                                                <Text type="secondary" style={{ fontSize: "12px" }}>ประสิทธิภาพในการบรรทุก</Text>
                                                <Text strong style={{ color: "#334155" }}>
                                                    น้ำหนัก: {route.total_weight?.toLocaleString()} kg | ปริมาตร: {route.total_volume?.toFixed(3)} CBM
                                                </Text>
                                            </Space>
                                            <Space direction="vertical" size={2} align="end">
                                                <Text type="secondary" style={{ fontSize: "12px" }}>ระยะทาง & ค่าเดินทาง</Text>
                                                <Text strong style={{ color: "#7c3aed" }}>
                                                    {(route.total_distance_meters / 1000).toFixed(1)} กม. / {route.total_cost?.toFixed(2)} บาท
                                                </Text>
                                            </Space>
                                        </div>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}

                    {/* Bottom Action Footer Bar */}
                    <div style={{
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "16px 24px",
                        background: "#ffffff",
                        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.05)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        zIndex: 1000
                    }}>
                        <Text type="secondary">
                            * การบันทึกแผนงานจะสร้าง Load Plans ในระบบแยกตามรายรถที่ทำงานจริง
                        </Text>
                        <Space>
                            <Button
                                size="large"
                                onClick={() => window.close()}
                                style={{ borderRadius: "8px", minWidth: "120px" }}
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                type="primary"
                                size="large"
                                icon={<CheckCircleOutlined />}
                                loading={saving}
                                onClick={handleConfirm}
                                style={{
                                    borderRadius: "8px",
                                    minWidth: "160px",
                                    background: "#0f766e",
                                    borderColor: "#0f766e"
                                }}
                            >
                                ยืนยันใช้แผนงาน
                            </Button>
                        </Space>
                    </div>
                </>
            ) : (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <Text type="secondary">กรุณาระบุพารามิเตอร์ date และ branch ใน URL เพื่อเริ่มต้นประมวลผล</Text>
                </div>
            )}
        </div>
    );
}
