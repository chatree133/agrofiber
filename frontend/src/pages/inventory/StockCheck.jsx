import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Table, Tag, Row, Col, Statistic, Progress, Typography, Button, Space, Divider } from 'antd';
import { AreaChartOutlined, DatabaseOutlined, HomeOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function StockCheck() {
  const [searchParams] = useSearchParams();
  const sku = searchParams.get('sku') || 'FG-PAPER-A4-80';

  // Dummy inventory data mapping SKU to warehouse levels
  const getDummyStockData = (itemSku) => {
    return [
      {
        key: '1',
        warehouse: 'WH-01 คลังสินค้ากระดาษ (หลัก)',
        location: 'Aisle A - Row 3 - Shelf 2',
        physicalQty: 1250,
        reservedQty: 250,
        availableQty: 1000,
        status: 'Instock',
      },
      {
        key: '2',
        warehouse: 'WH-02 คลังพักสินค้าผ่านทาง',
        location: 'Transit Area B',
        physicalQty: 400,
        reservedQty: 100,
        availableQty: 300,
        status: 'Instock',
      },
      {
        key: '3',
        warehouse: 'WH-03 คลังจองพิเศษ (ลูกค้ารายใหญ่)',
        location: 'VVIP Section C',
        physicalQty: 350,
        reservedQty: 350,
        availableQty: 0,
        status: 'Allocated',
      },
    ];
  };

  const dataSource = getDummyStockData(sku);
  const totalPhysical = dataSource.reduce((acc, curr) => acc + curr.physicalQty, 0);
  const totalReserved = dataSource.reduce((acc, curr) => acc + curr.reservedQty, 0);
  const totalAvailable = dataSource.reduce((acc, curr) => acc + curr.availableQty, 0);
  const reservedPercentage = Math.round((totalReserved / totalPhysical) * 100) || 0;

  const columns = [
    {
      title: 'คลังสินค้า',
      dataIndex: 'warehouse',
      key: 'warehouse',
      render: (text) => (
        <Space>
          <HomeOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'ตำแหน่งจัดเก็บ',
      dataIndex: 'location',
      key: 'location',
      render: (text) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'จำนวนคงคลังทั้งหมด (Physical)',
      dataIndex: 'physicalQty',
      key: 'physicalQty',
      align: 'right',
      render: (val) => <Text>{val.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>,
    },
    {
      title: 'ยอดจอง (Reserved)',
      dataIndex: 'reservedQty',
      key: 'reservedQty',
      align: 'right',
      render: (val) => <Text type="danger">{val.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>,
    },
    {
      title: 'พร้อมขาย (Available)',
      dataIndex: 'availableQty',
      key: 'availableQty',
      align: 'right',
      render: (val) => (
        <Text strong type={val > 0 ? "success" : "secondary"}>
          {val.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => (
        <Tag color={status === 'Instock' ? 'green' : 'orange'}>
          {status === 'Instock' ? 'พร้อมจำหน่าย' : 'จองเต็มจำนวน'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#1f1f1f' }}>
              <DatabaseOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
              ตรวจสอบจำนวนสินค้าคงคลัง (Stock Check)
            </Title>
            <Text type="secondary" style={{ fontSize: '15px' }}>
              ข้อมูลปริมาณสินค้าคงคลังแบบ Real-time ของรหัสสินค้า: <Tag color="blue" style={{ fontSize: '14px', fontWeight: 'bold' }}>{sku}</Tag>
            </Text>
          </div>
          <Button type="primary" size="large" onClick={() => window.print()}>
            พิมพ์รายงานสต็อก
          </Button>
        </div>

        {/* Dashboard Statistics Card */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={8}>
            <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>คงคลังกายภาพรวม (Total Physical)</Text>}
                value={totalPhysical}
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: '28px', fontWeight: 'bold' }}
                suffix={<span style={{ fontSize: '14px', color: '#8c8c8c' }}> หน่วย</span>}
              />
              <div style={{ marginTop: '10px' }}>
                <Progress percent={100} showInfo={false} strokeColor="#1890ff" />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>ยอดจองรวม (Total Reserved)</Text>}
                value={totalReserved}
                precision={2}
                valueStyle={{ color: '#ff4d4f', fontSize: '28px', fontWeight: 'bold' }}
                suffix={<span style={{ fontSize: '14px', color: '#8c8c8c' }}> หน่วย</span>}
              />
              <div style={{ marginTop: '10px' }}>
                <Progress percent={reservedPercentage} showInfo={true} strokeColor="#ff4d4f" />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>พร้อมขายรวม (Total Available)</Text>}
                value={totalAvailable}
                precision={2}
                valueStyle={{ color: '#52c41a', fontSize: '28px', fontWeight: 'bold' }}
                suffix={<span style={{ fontSize: '14px', color: '#8c8c8c' }}> หน่วย</span>}
              />
              <div style={{ marginTop: '10px' }}>
                <Progress percent={100 - reservedPercentage} showInfo={false} strokeColor="#52c41a" />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Detailed Warehouse Breakdown Table */}
        <Card
          title={
            <Space>
              <AreaChartOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontWeight: 'bold' }}>รายละเอียดรายคลังและจุดจัดเก็บ</span>
            </Space>
          }
          bordered={false}
          style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        >
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            bordered
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0} colSpan={2}>ยอดรวมทุกคลังสินค้า (Grand Total)</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    {totalPhysical.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right" style={{ color: '#ff4d4f' }}>
                    {totalReserved.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right" style={{ color: '#52c41a' }}>
                    {totalAvailable.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>

        {/* Footnote */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Space>
            <SafetyCertificateOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              ระบบตรวจสอบสินค้าคงคลัง Agrofiber ERP System • อัพเดทอัตโนมัติทุกการเคลื่อนไหวของสินค้าคงคลัง
            </Text>
          </Space>
        </div>
      </div>
    </div>
  );
}
