import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Divider, Form, Input, Modal, Radio, Space, Tag, Typography, message, Upload } from 'antd';
import { PhoneOutlined, CommentOutlined, CheckCircleOutlined, CameraOutlined, ClearOutlined, SyncOutlined, LockOutlined, CompassOutlined, TruckOutlined } from '@ant-design/icons';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWms } from '../../context/WmsContext.jsx';

const { Title, Text, Paragraph } = Typography;

export default function DriverPortal() {
  const { user, logout } = useAuth();
  const { getTodayDriverLoadPlans, submitLoadPlanPod } = useWms();
  const sigCanvasRef = useRef({});

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePlan, setActivePlan] = useState(null);
  const [searchText, setSearchText] = useState('');

  // POD Modal state
  const [podModalVisible, setPodModalVisible] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [podStatus, setPodStatus] = useState('delivered');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const data = await getTodayDriverLoadPlans();
      setShipments(data);
      if (data.length > 0) {
        // Automatically activate first plan
        setActivePlan(data[0]);
      } else {
        setActivePlan(null);
      }
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูลจัดส่งได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPod = (line) => {
    setSelectedLine(line);
    setPodStatus('delivered');
    setPhotoFile(null);
    setPhotoPreview(null);
    form.resetFields();
    setPodModalVisible(true);
    setTimeout(() => {
      if (sigCanvasRef.current && typeof sigCanvasRef.current.clear === 'function') {
        sigCanvasRef.current.clear();
      }
    }, 150);
  };

  const handleClearSignature = () => {
    if (sigCanvasRef.current && typeof sigCanvasRef.current.clear === 'function') {
      sigCanvasRef.current.clear();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPod = async (values) => {
    if (!selectedLine) return;

    // Signature validation
    let signatureDataUrl = null;
    if (sigCanvasRef.current && typeof sigCanvasRef.current.isEmpty === 'function' && !sigCanvasRef.current.isEmpty()) {
      signatureDataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
    }

    if (podStatus === 'delivered' && !signatureDataUrl) {
      message.error('กรุณาเซ็นชื่อลูกค้าเพื่อเป็นหลักฐาน');
      return;
    }

    if (podStatus === 'delivered' && !photoFile) {
      message.error('กรุณาถ่ายรูปหรืออัพโหลดภาพถ่ายหลักฐานส่งมอบ');
      return;
    }

    setSubmitting(true);
    try {
      let lat = null;
      let lng = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (err) {
          console.warn('Geolocation capture failed:', err);
          message.warning('ไม่สามารถระบุตำแหน่ง GPS ได้ แต่ระบบจะยังคงดำเนินการบันทึกข้อมูลหลักฐานให้');
        }
      }

      const formData = new FormData();
      formData.append('deliveryStatus', podStatus);
      formData.append('recipientName', values.recipientName || '');
      formData.append('remarks', values.remarks || '');
      if (signatureDataUrl) {
        formData.append('signatureDataUrl', signatureDataUrl);
      }
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      if (lat !== null && lng !== null) {
        formData.append('lat', lat);
        formData.append('lng', lng);
      }

      await submitLoadPlanPod(selectedLine.loadPlanLineId, formData);

      message.success('บันทึกหลักฐานการจัดส่งสำเร็จ!');
      setPodModalVisible(false);
      fetchShipments();
    } catch (err) {
      message.error('ไม่สามารถส่งมอบ POD ได้: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getDeliveryStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'default';
      case 'delivered': return 'success';
      case 'partial': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getDeliveryStatusText = (status) => {
    switch (status) {
      case 'pending': return 'รอดำเนินการ';
      case 'delivered': return 'สำเร็จ';
      case 'partial': return 'สำเร็จบางส่วน';
      case 'failed': return 'ไม่สำเร็จ';
      default: return status;
    }
  };

  return (
    <div style={{
      maxWidth: 500,
      margin: '0 auto',
      background: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 0 10px rgba(0,0,0,0.05)',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Portal Header */}
      <div style={{
        padding: '16px 20px',
        background: '#0f766e',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div>
          <Title level={4} style={{ color: '#ffffff', margin: 0, fontSize: 18 }}>Driver Portal</Title>
          <Text style={{ color: '#ccfbf1', fontSize: 13 }}>สวัสดีคุณ, {user?.displayName || 'Driver'}</Text>
        </div>
        <Space>
          <Button
            type="text"
            icon={<SyncOutlined style={{ color: '#ffffff' }} />}
            onClick={fetchShipments}
            loading={loading}
          />
          <Button
            type="text"
            icon={<LockOutlined style={{ color: '#ffffff' }} />}
            onClick={logout}
            style={{ color: '#ffffff', fontSize: 13 }}
          >
            ออก
          </Button>
        </Space>
      </div>

      {/* Portal Body */}
      <div style={{ padding: '16px 12px', flex: 1 }}>
        <Title level={5} style={{ margin: '0 0 12px 4px', color: '#1e293b' }}>
          งานจัดส่งวันนี้ ({new Date().toLocaleDateString('th-TH')})
        </Title>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <SyncOutlined spin style={{ fontSize: 24, color: '#0f766e' }} />
            <div style={{ marginTop: 8, color: '#64748b' }}>กำลังโหลดแผนงานจัดส่ง...</div>
          </div>
        ) : shipments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            color: '#64748b',
            marginTop: 10
          }}>
            <TruckOutlined style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12 }} />
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>ไม่มีงานได้รับมอบหมายในวันนี้</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>หากเพิ่งได้รับมอบหมายงาน กรุณากดปุ่มโหลดข้อมูลใหม่</div>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={fetchShipments}
              style={{ marginTop: 16, background: '#0f766e', borderColor: '#0f766e', borderRadius: 6 }}
            >
              รีเฟรชข้อมูล
            </Button>
          </div>
        ) : (
          <div>
            {/* Load Plan Selector if multiple */}
            {shipments.length > 1 && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>เลือกแผนงาน:</Text>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, overflowX: 'auto', paddingBottom: 4 }}>
                  {shipments.map(s => (
                    <Button
                      key={s.loadPlanId}
                      type={activePlan?.loadPlanId === s.loadPlanId ? 'primary' : 'default'}
                      onClick={() => setActivePlan(s)}
                      style={{
                        borderRadius: 20,
                        fontSize: 12,
                        height: 32,
                        background: activePlan?.loadPlanId === s.loadPlanId ? '#0f766e' : '#ffffff',
                        borderColor: activePlan?.loadPlanId === s.loadPlanId ? '#0f766e' : '#cbd5e1'
                      }}
                    >
                      {s.loadPlanNo} ({s.licensePlate})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Load Plan Info Card */}
            {activePlan && (
              <Card
                size="small"
                style={{
                  borderRadius: 12,
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14 }}>{activePlan.loadPlanNo}</Text>
                  <Tag color={activePlan.status === 'completed' ? 'success' : 'warning'}>
                    {activePlan.status === 'in_transit' ? 'กำลังเดินทาง' : activePlan.status === 'completed' ? 'เสร็จสิ้น' : 'รอออกตัว'}
                  </Tag>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#475569' }}>
                  ทะเบียน: <Text strong>{activePlan.licensePlate}</Text> | {activePlan.vehicleType}
                </div>
              </Card>
            )}

            {/* Search Filter Input */}
            {activePlan && (
              <div style={{ marginBottom: 16 }}>
                <Input.Search
                  placeholder="ค้นหาชื่อลูกค้า, รหัส, เบอร์โทร หรือเลขที่ DO..."
                  allowClear
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onSearch={(value) => setSearchText(value)}
                  style={{
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                />
              </div>
            )}

            {/* Drops List */}
            {activePlan && activePlan.lines
              .filter(line => {
                const searchLower = searchText.toLowerCase().trim();
                if (!searchLower) return true;
                const matchName = line.customerName?.toLowerCase().includes(searchLower);
                const matchCode = line.customerCode?.toLowerCase().includes(searchLower);
                const matchDocNo = line.documentNo?.toLowerCase().includes(searchLower);
                return matchName || matchCode || matchDocNo;
              })
              .map((line, index) => (
              <Card
                key={line.loadPlanLineId}
                bodyStyle={{ padding: 16 }}
                style={{
                  borderRadius: 12,
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Space>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#0f766e',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: 12
                    }}>
                      {line.stopSequence}
                    </div>
                    <Text strong style={{ fontSize: 15 }}>{line.documentNo}</Text>
                  </Space>
                  <Tag color={getDeliveryStatusColor(line.deliveryStatus)}>
                    {getDeliveryStatusText(line.deliveryStatus)}
                  </Tag>
                </div>

                <div style={{ marginLeft: 30 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14, color: '#1e293b' }}>{line.customerName}</div>
                  <Paragraph style={{ color: '#475569', fontSize: 13, margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                    {line.shipToAddress}
                  </Paragraph>

                  {/* Navigation and Call shortcuts */}
                  <Space style={{ marginBottom: 16 }}>
                    <Button
                      icon={<CompassOutlined />}
                      size="small"
                      type="dashed"
                      href={
                        line.latitude !== null && line.longitude !== null && line.latitude !== undefined && line.longitude !== undefined
                          ? `https://www.google.com/maps/search/?api=1&query=${line.latitude},${line.longitude}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line.shipToAddress)}`
                      }
                      target="_blank"
                      style={{ fontSize: 12, borderRadius: 4 }}
                    >
                      แผนที่นำทาง
                    </Button>
                    <Button
                      icon={<PhoneOutlined />}
                      size="small"
                      type="dashed"
                      href="tel:0812345678" // Seeder matches this
                      style={{ fontSize: 12, borderRadius: 4 }}
                    >
                      โทรติดต่อ
                    </Button>
                  </Space>

                  <Divider style={{ margin: '8px 0 12px 0' }} />

                  {/* Complete button */}
                  {line.deliveryStatus === 'pending' ? (
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleOpenPod(line)}
                      style={{
                        width: '100%',
                        height: 38,
                        borderRadius: 6,
                        background: '#0f766e',
                        borderColor: '#0f766e',
                        fontWeight: 600
                      }}
                    >
                      ดำเนินการส่งมอบสินค้า
                    </Button>
                  ) : (
                    <Button
                      type="default"
                      disabled
                      style={{
                        width: '100%',
                        height: 38,
                        borderRadius: 6,
                        fontWeight: 600
                      }}
                    >
                      ทำรายการสำเร็จแล้ว
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* POD Submission Modal */}
      <Modal
        title={`บันทึกการส่งมอบ: ${selectedLine?.documentNo || ''}`}
        open={podModalVisible}
        onCancel={() => !submitting && setPodModalVisible(false)}
        footer={null}
        width={400}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitPod}
        >
          <Form.Item label="สถานะส่งมอบ" required>
            <Radio.Group
              value={podStatus}
              onChange={(e) => setPodStatus(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              style={{ width: '100%', display: 'flex' }}
            >
              <Radio.Button value="delivered" style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>สำเร็จ</Radio.Button>
              <Radio.Button value="partial" style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>บางส่วน</Radio.Button>
              <Radio.Button value="failed" style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>ไม่สำเร็จ</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="recipientName"
            label="ชื่อผู้รับสินค้า"
            rules={[{ required: podStatus === 'delivered', message: 'กรุณากรอกชื่อผู้รับสินค้า' }]}
          >
            <Input placeholder="เช่น สมชาย ใจดี" style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item name="remarks" label="หมายเหตุ / เหตุผลจัดส่ง">
            <Input.TextArea rows={2} placeholder="กรอกหมายเหตุ หรือเหตุผลส่งมอบบางส่วน/ไม่สำเร็จ" style={{ borderRadius: 6 }} />
          </Form.Item>

          {/* Signature Canvas (Only if Delivered or Partial) */}
          {podStatus !== 'failed' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 14 }}>ลายเซ็นผู้รับสินค้า</Text>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<ClearOutlined />}
                  onClick={handleClearSignature}
                >
                  ล้างลายเซ็น
                </Button>
              </div>
              <div style={{
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#ffffff',
                overflow: 'hidden'
              }}>
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="#0f172a"
                  canvasProps={{
                    width: 350,
                    height: 120,
                    className: 'sigCanvas',
                    style: { width: '100%', display: 'block' }
                  }}
                />
              </div>
            </div>
          )}

          {/* Camera Upload Section */}
          <div style={{ marginBottom: 20 }}>
            <Text style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              ถ่ายรูปสินค้า / สถานที่จัดส่ง {podStatus === 'delivered' && <Text type="danger">*</Text>}
            </Text>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label
                htmlFor="camera-input"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 13
                }}
              >
                <CameraOutlined style={{ fontSize: 16, color: '#475569' }} />
                ถ่ายรูปหลักฐาน
              </label>
              <input
                id="camera-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {photoFile && <Text type="secondary" style={{ fontSize: 12 }}>{photoFile.name}</Text>}
            </div>

            {photoPreview && (
              <div style={{ marginTop: 12, border: '1px dashed #cbd5e1', borderRadius: 8, padding: 4, background: '#ffffff' }}>
                <img
                  src={photoPreview}
                  alt="POD Preview"
                  style={{ width: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 6 }}
                />
              </div>
            )}
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 6,
              background: '#0f766e',
              borderColor: '#0f766e',
              fontWeight: 600,
              fontSize: 14
            }}
          >
            บันทึกส่งมอบ (Submit POD)
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
