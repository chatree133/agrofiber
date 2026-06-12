import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Divider, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, TruckOutlined, UserOutlined, CalendarOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWms } from '../../context/WmsContext.jsx';

const { Title, Text } = Typography;
const { Option } = Select;

export default function LoadPlanList() {
  const navigate = useNavigate();
  const { getLoadPlans, getLoadPlanDetail, updateLoadPlanStatus } = useWms();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [planDetail, setPlanDetail] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await getLoadPlans();
      setPlans(data);
    } catch (err) {
      message.error('ไม่สามารถโหลดแผนจัดส่งได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (planId) => {
    setDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const data = await getLoadPlanDetail(planId);
      setPlanDetail(data);
    } catch (err) {
      message.error('ไม่สามารถโหลดรายละเอียดแผนได้: ' + err.message);
      setDetailModalVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (planId, status) => {
    try {
      await updateLoadPlanStatus(planId, status);
      message.success('อัพเดทสถานะแผนจัดส่งเรียบร้อยแล้ว');
      fetchPlans();
      if (planDetail && planDetail.id === planId) {
        handleViewDetails(planId); // refresh modal detail
      }
    } catch (err) {
      message.error('ไม่สามารถอัพเดทสถานะได้: ' + err.message);
    }
  };

  const getStatusTagColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'ready': return 'processing';
      case 'in_transit': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'draft': return 'ฉบับร่าง';
      case 'ready': return 'พร้อมจัดส่ง';
      case 'in_transit': return 'กำลังจัดส่ง';
      case 'completed': return 'จัดส่งสำเร็จ';
      case 'cancelled': return 'ยกเลิก';
      default: return status;
    }
  };

  const getDeliveryStatusTag = (status) => {
    switch (status) {
      case 'pending': return <Tag color="default">รอดำเนินการ</Tag>;
      case 'delivered': return <Tag color="success">สำเร็จ</Tag>;
      case 'partial': return <Tag color="warning">สำเร็จบางส่วน</Tag>;
      case 'failed': return <Tag color="error">ล้มเหลว</Tag>;
      default: return <Tag color="default">{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'เลขที่แผนงาน',
      dataIndex: 'loadPlanNo',
      key: 'loadPlanNo',
      render: (text, r) => <a onClick={() => handleViewDetails(r.id)} style={{ fontWeight: 'bold' }}>{text}</a>
    },
    {
      title: 'สาขา',
      dataIndex: 'branchName',
      key: 'branchName',
      render: (text) => text || '-'
    },
    {
      title: 'วันที่จัดส่ง',
      dataIndex: 'planDate',
      key: 'planDate',
      render: (date) => <span>{new Date(date).toLocaleDateString('th-TH')}</span>
    },
    {
      title: 'ยานพาหนะ / ทะเบียน',
      key: 'vehicle',
      render: (_, r) => (
        <div>
          <div>{r.licensePlate}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.vehicleType}</Text>
        </div>
      )
    },
    {
      title: 'พนักงานขับรถ',
      dataIndex: 'driverName',
      key: 'driverName',
    },
    {
      title: 'น้ำหนัก (kg)',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      render: (val) => <span style={{ fontFamily: 'monospace' }}>{val.toFixed(1)}</span>
    },
    {
      title: 'ปริมาตร (CBM)',
      dataIndex: 'totalVolumeCbm',
      key: 'totalVolumeCbm',
      render: (val) => <span style={{ fontFamily: 'monospace' }}>{val.toFixed(3)}</span>
    },
    {
      title: 'สถานะแผน',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusTagColor(status)}>{getStatusText(status)}</Tag>
    },
    {
      title: 'ตัวจัดการ',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record.id)}
            size="small"
          >
            ดูรายละเอียด
          </Button>

          <Select
            value={record.status}
            size="small"
            onChange={(val) => handleUpdateStatus(record.id, val)}
            style={{ width: 130 }}
          >
            <Option value="draft">ฉบับร่าง</Option>
            <Option value="ready">ปล่อยงาน (Ready)</Option>
            <Option value="in_transit">จัดส่งจริง (In Transit)</Option>
            <Option value="completed">เสร็จสิ้น (Completed)</Option>
            <Option value="cancelled">ยกเลิกแผน (Cancelled)</Option>
          </Select>
        </Space>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            รายการแผนการจัดส่งสินค้า (Load Plans)
          </h1>
          <Text type="secondary">ตรวจสอบ ติดตามสถานะจัดส่ง และปรับเปลี่ยนขั้นตอนแผนจัดส่งสินค้า</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/wms/load-plans/create')}
          style={{ background: '#0f766e', borderColor: '#0f766e', borderRadius: 6, fontWeight: 600 }}
        >
          สร้างแผนจัดส่งใหม่
        </Button>
      </div>

      <Card bordered={true} style={{ borderRadius: 8}}>
        <Table
          dataSource={plans}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Load Plan Details Modal */}
      <Modal
        title={`รายละเอียดแผนจัดส่ง: ${planDetail?.loadPlanNo || ''}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            ปิดหน้าต่าง
          </Button>
        ]}
      >
        {detailLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลด...</div>
        ) : planDetail ? (
          <div>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={8}>
                <Card size="small" title="ข้อมูลทั่วไป">
                  <div><CalendarOutlined /> วันที่จัดส่ง: {new Date(planDetail.planDate).toLocaleDateString('th-TH')}</div>
                  <div style={{ marginTop: 8 }}>สถานะ: <Tag color={getStatusTagColor(planDetail.status)}>{getStatusText(planDetail.status)}</Tag></div>
                  <div style={{ marginTop: 8 }}>ผู้สร้าง: {planDetail.createdByName}</div>
                  <div style={{ marginTop: 8 }}>สาขา: {planDetail.branchName || '-'}</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="ข้อมูลคนขับและยานพาหนะ">
                  <div><TruckOutlined /> รถยนต์: {planDetail.vehicle.licensePlate} ({planDetail.vehicle.vehicleType})</div>
                  {planDetail.vehicle.workingStart && planDetail.vehicle.workingEnd && (
                    <div style={{ marginTop: 8 }}>เวลาทำงาน: {planDetail.vehicle.workingStart} - {planDetail.vehicle.workingEnd}</div>
                  )}
                  <div style={{ marginTop: 8 }}><UserOutlined /> พนักงาน: {planDetail.driver.driverName}</div>
                  <div style={{ marginTop: 8 }}>เบอร์ติดต่อ: {planDetail.driver.phone || '-'}</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="ความสามารถบรรทุกรวม">
                  <div>น้ำหนักรวม: {planDetail.totalWeightKg.toFixed(1)} / {planDetail.vehicle.maxWeightKg} kg</div>
                  <div style={{ marginTop: 8 }}>ปริมาตรรวม: {planDetail.totalVolumeCbm.toFixed(2)} / {planDetail.vehicle.maxVolumeCbm} CBM</div>
                </Card>
              </Col>
            </Row>

            {planDetail.remarks && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f1f5f9', borderRadius: 6 }}>
                <Text strong>หมายเหตุ: </Text>
                <Text>{planDetail.remarks}</Text>
              </div>
            )}

            <Divider orientation="left" style={{ margin: '12px 0' }}>จุดส่งสินค้าและสถานะจัดส่ง</Divider>

            <Table
              dataSource={planDetail.lines}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'จุดที่',
                  dataIndex: 'stopSequence',
                  key: 'stopSequence',
                  width: 60,
                  render: (val) => <Tag color="blue">{val}</Tag>
                },
                {
                  title: 'เลขที่ DO',
                  dataIndex: 'documentNo',
                  key: 'documentNo',
                  render: (text) => <Text strong>{text}</Text>
                },
                {
                  title: 'ลูกค้า',
                  dataIndex: 'customerName',
                  key: 'customerName',
                  render: (text, r) => <span>{text} ({r.customerCode})</span>
                },
                {
                  title: 'ที่อยู่ส่งของ',
                  dataIndex: 'shipToAddress',
                  key: 'shipToAddress',
                },
                {
                  title: 'น้ำหนัก (kg)',
                  dataIndex: 'weightKg',
                  key: 'weightKg',
                  render: (val) => val.toFixed(1)
                },
                {
                  title: 'สถานะจุดส่ง',
                  dataIndex: 'deliveryStatus',
                  key: 'deliveryStatus',
                  render: (status) => getDeliveryStatusTag(status)
                }
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
