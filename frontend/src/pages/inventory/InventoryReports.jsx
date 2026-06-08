import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Input, Select, DatePicker, Row, Col, Typography, Button, Space, Empty, Menu } from 'antd';
import {
  FileTextOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  BookOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClearOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWarehouse } from '../../context/WarehouseContext';
import { useStock } from '../../context/StockContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function InventoryReports() {
  const { getWarehouses } = useWarehouse();
  const { getStockMovements, getLots, getReservations } = useStock();

  // Active Tab / Report Key
  const [activeTab, setActiveTab] = useState('movements');

  // Warehouses list lookup
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    const loadWhs = async () => {
      try {
        const res = await getWarehouses();
        setWarehouses(res || []);
      } catch (err) {
        console.error('Failed to load warehouses', err);
      }
    };
    loadWhs();
  }, []);

  // ----------------------------------------------------------------
  // Tab 1: Stock Card / Movements Report States & Logic
  // ----------------------------------------------------------------
  const [mSearch, setMSearch] = useState('');
  const [mWarehouse, setMWarehouse] = useState(null);
  const [mType, setMType] = useState(null);
  const [mDateRange, setMDateRange] = useState([]);
  const [movements, setMovements] = useState([]);
  const [mLoading, setMLoading] = useState(false);
  const [mPage, setMPage] = useState(1);
  const [mPageSize, setMPageSize] = useState(15);
  const [mTotal, setMTotal] = useState(0);

  const fetchMovementsReport = async (page = 1) => {
    setMLoading(true);
    try {
      const params = {
        search: mSearch || undefined,
        warehouseId: mWarehouse || undefined,
        movementType: mType || undefined,
        dateFrom: mDateRange?.[0] ? mDateRange[0].startOf('day').toISOString() : undefined,
        dateTo: mDateRange?.[1] ? mDateRange[1].endOf('day').toISOString() : undefined,
        page,
        pageSize: mPageSize
      };
      const res = await getStockMovements(params);
      setMovements(res.data || []);
      setMTotal(res.pagination?.total || 0);
      setMPage(page);
    } catch (err) {
      console.error('Failed to fetch movements report', err);
    } finally {
      setMLoading(false);
    }
  };

  const handleResetMovements = () => {
    setMSearch('');
    setMWarehouse(null);
    setMType(null);
    setMDateRange([]);
  };

  // ----------------------------------------------------------------
  // Tab 2: Lot Tracking & Quality Control States & Logic
  // ----------------------------------------------------------------
  const [lSearch, setLSearch] = useState('');
  const [lQCStatus, setLQCStatus] = useState(null);
  const [lots, setLots] = useState([]);
  const [lLoading, setLLoading] = useState(false);
  const [lPage, setLPage] = useState(1);
  const [lPageSize, setLPageSize] = useState(15);
  const [lTotal, setLTotal] = useState(0);

  const fetchLotsReport = async (page = 1) => {
    setLLoading(true);
    try {
      const params = {
        search: lSearch || undefined,
        qualityStatus: lQCStatus || undefined,
        page,
        pageSize: lPageSize
      };
      const res = await getLots(params);
      setLots(res.data || []);
      setLTotal(res.pagination?.total || 0);
      setLPage(page);
    } catch (err) {
      console.error('Failed to fetch lots report', err);
    } finally {
      setLLoading(false);
    }
  };

  const handleResetLots = () => {
    setLSearch('');
    setLQCStatus(null);
  };

  // ----------------------------------------------------------------
  // Tab 3: Inventory Reservations States & Logic
  // ----------------------------------------------------------------
  const [rSearch, setRSearch] = useState('');
  const [rRefType, setRRefType] = useState(null);
  const [rStatus, setRStatus] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [rLoading, setRLoading] = useState(false);
  const [rPage, setRPage] = useState(1);
  const [rPageSize, setRPageSize] = useState(15);
  const [rTotal, setRTotal] = useState(0);

  const fetchReservationsReport = async (page = 1) => {
    setRLoading(true);
    try {
      const params = {
        search: rSearch || undefined,
        referenceType: rRefType || undefined,
        status: rStatus || undefined,
        page,
        pageSize: rPageSize
      };
      const res = await getReservations(params);
      setReservations(res.data || []);
      setRTotal(res.pagination?.total || 0);
      setRPage(page);
    } catch (err) {
      console.error('Failed to fetch reservations report', err);
    } finally {
      setRLoading(false);
    }
  };

  const handleResetReservations = () => {
    setRSearch('');
    setRRefType(null);
    setRStatus(null);
  };

  // Trigger loading based on tab change
  useEffect(() => {
    if (activeTab === 'movements') {
      fetchMovementsReport(1);
    } else if (activeTab === 'lots') {
      fetchLotsReport(1);
    } else if (activeTab === 'reservations') {
      fetchReservationsReport(1);
    }
  }, [activeTab, mWarehouse, mType, mDateRange, lQCStatus, rRefType, rStatus]);

  // ----------------------------------------------------------------
  // Table Columns Setup
  // ----------------------------------------------------------------
  const movementColumns = [
    {
      title: 'วัน-เวลา',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm:ss')
    },
    {
      title: 'ประเภทรายการ',
      dataIndex: 'movementType',
      key: 'movementType',
      width: 120,
      render: (val) => {
        const typeMap = {
          'receipt': { label: 'รับสินค้าเข้า (GR)', color: 'green' },
          'issue': { label: 'เบิกสินค้าออก (GI)', color: 'red' },
          'transfer': { label: 'โอนย้ายภายใน', color: 'blue' },
          'adjustment': { label: 'ปรับปรุงสต็อก', color: 'purple' }
        };
        const mapped = typeMap[val.toLowerCase()] || { label: val, color: 'default' };
        return <Tag color={mapped.color}>{mapped.label}</Tag>;
      }
    },
    {
      title: 'สินค้า',
      key: 'item',
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ color: '#071d2c' }}>
            {record.itemName}{record.specName ? ` - ${record.specName}` : ''}
          </Text>
          {(record.salesSku || record.itemCode) && (
            <Tag color="blue" style={{ fontSize: '11px', marginTop: '4px', width: 'fit-content' }}>
              SKU: {record.salesSku || record.itemCode}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'คลัง/ตำแหน่ง (ต้นทาง)',
      key: 'fromLoc',
      render: (_, record) => record.fromWarehouseCode ? (
        <Text style={{ fontSize: '13px' }}>
          {record.fromWarehouseCode} {record.fromLocationCode && `(${record.fromLocationCode})`}
        </Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: 'คลัง/ตำแหน่ง (ปลายทาง)',
      key: 'toLoc',
      render: (_, record) => record.toWarehouseCode ? (
        <Text style={{ fontSize: '13px' }}>
          {record.toWarehouseCode} {record.toLocationCode && `(${record.toLocationCode})`}
        </Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: 'เลขล็อต',
      dataIndex: 'lotNo',
      key: 'lotNo',
      render: (val) => val ? <Tag color="geekblue">{val}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: 'จำนวน',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (val, record) => {
        const isOut = ['issue'].includes(record.movementType.toLowerCase());
        return (
          <Text strong style={{ color: isOut ? '#ff4d4f' : '#52c41a' }}>
            {isOut ? '-' : '+'}{Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </Text>
        );
      }
    },
    {
      title: 'หน่วย',
      dataIndex: 'unitCode',
      key: 'unitCode',
      width: 70
    },
    {
      title: 'ต้นทุนต่อหน่วย',
      dataIndex: 'unitCost',
      key: 'unitCost',
      align: 'right',
      render: (val) => val ? `${Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿` : <Text type="secondary">-</Text>
    },
    {
      title: 'มูลค่ารวม',
      dataIndex: 'totalCost',
      key: 'totalCost',
      align: 'right',
      render: (val) => val ? `${Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿` : <Text type="secondary">-</Text>
    }
  ];

  const lotColumns = [
    {
      title: 'รหัสล็อตสินค้า',
      dataIndex: 'lotNo',
      key: 'lotNo',
      render: (val) => <Text strong style={{ color: '#071d2c' }}>{val}</Text>
    },
    {
      title: 'สินค้า',
      key: 'item',
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ color: '#071d2c' }}>
            {record.itemName}{record.specName ? ` - ${record.specName}` : ''}
          </Text>
          {(record.salesSku || record.itemCode) && (
            <Tag color="blue" style={{ fontSize: '11px', marginTop: '4px', width: 'fit-content' }}>
              SKU: {record.salesSku || record.itemCode}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'เกรด',
      dataIndex: 'grade',
      key: 'grade',
      render: (val) => val ? <Tag color="blue">{val}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: 'วันที่ผลิต',
      dataIndex: 'productionDate',
      key: 'productionDate',
      render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : <Text type="secondary">-</Text>
    },
    {
      title: 'วันหมดอายุ',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : <Text type="secondary">-</Text>
    },
    {
      title: 'ความชื้น (%)',
      dataIndex: 'moisturePercent',
      key: 'moisturePercent',
      align: 'right',
      render: (val) => val !== null && val !== undefined ? `${Number(val).toFixed(2)}%` : <Text type="secondary">-</Text>
    },
    {
      title: 'ความหนาแน่น (kg/m³)',
      dataIndex: 'densityKgM3',
      key: 'densityKgM3',
      align: 'right',
      render: (val) => val !== null && val !== undefined ? Number(val).toFixed(2) : <Text type="secondary">-</Text>
    },
    {
      title: 'สถานะตรวจสอบ (QC)',
      dataIndex: 'qualityStatus',
      key: 'qualityStatus',
      align: 'center',
      render: (val) => {
        const qcMap = {
          'approved': { label: 'ผ่าน QC (Approved)', color: 'success' },
          'pending': { label: 'รอตรวจ (Pending)', color: 'warning' },
          'rejected': { label: 'ตกเกรด (Rejected)', color: 'error' },
          'hold': { label: 'กักสินค้า (Hold)', color: 'default' }
        };
        const mapped = qcMap[val?.toLowerCase()] || { label: val, color: 'default' };
        return <Tag color={mapped.color}>{mapped.label}</Tag>;
      }
    }
  ];

  const reservationColumns = [
    {
      title: 'เอกสารอ้างอิง',
      key: 'reference',
      render: (_, record) => (
        <div>
          <Text strong>{record.referenceType} #{record.referenceId}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>ไลน์ ID: #{record.referenceLineId}</Text>
        </div>
      )
    },
    {
      title: 'สินค้า',
      key: 'item',
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ color: '#071d2c' }}>
            {record.itemName}{record.specName ? ` - ${record.specName}` : ''}
          </Text>
          {record.salesSku && (
            <Tag color="blue" style={{ fontSize: '11px', marginTop: '4px', width: 'fit-content' }}>
              SKU: {record.salesSku}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'คลัง & ตำแหน่งจัดเก็บ',
      key: 'location',
      render: (_, record) => (
        <div>
          <Text>{record.warehouseCode}</Text>
          {record.locationCode && <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>({record.locationCode})</Text>}
        </div>
      )
    },
    {
      title: 'เลขพาเลท / Tracking No',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      render: (val) => val ? <Tag color="cyan">{val}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: 'เลขล็อต',
      dataIndex: 'lotNo',
      key: 'lotNo',
      render: (val) => val ? <Tag color="purple">{val}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: 'จำนวนที่จอง (Reserved)',
      dataIndex: 'reservedQty',
      key: 'reservedQty',
      align: 'right',
      render: (val) => <Text strong style={{ color: '#fa8c16' }}>{Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: 'จำนวนที่เบิกแล้ว (Picked)',
      dataIndex: 'pickedQty',
      key: 'pickedQty',
      align: 'right',
      render: (val) => <Text style={{ color: val > 0 ? '#52c41a' : '#bfbfbf' }}>{Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: 'สถานะการจอง',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (val) => {
        const resMap = {
          'open': { label: 'เริ่มจอง (Open)', color: 'blue' },
          'allocated': { label: 'จัดสรรแล้ว', color: 'cyan' },
          'picked': { label: 'หยิบของแล้ว', color: 'success' },
          'released': { label: 'คืนชั้นวาง', color: 'default' },
          'cancelled': { label: 'ยกเลิกการจอง', color: 'error' }
        };
        const mapped = resMap[val?.toLowerCase()] || { label: val, color: 'default' };
        return <Tag color={mapped.color}>{mapped.label}</Tag>;
      }
    },
    {
      title: 'วันที่จอง',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm')
    }
  ];

  // Vertical Sidebar Menu items
  const menuItems = [
    {
      key: 'grp_movements',
      label: 'รายงานการเคลื่อนไหว',
      type: 'group',
      children: [
        {
          key: 'movements',
          label: 'ประวัติเคลื่อนไหว (Stock Card)',
          icon: <HistoryOutlined />
        }
      ]
    },
    {
      key: 'grp_lots',
      label: 'รายงานล็อตและคุณภาพ',
      type: 'group',
      children: [
        {
          key: 'lots',
          label: 'ล็อตสินค้าและคุณภาพ (Lot & QC)',
          icon: <SafetyCertificateOutlined />
        }
      ]
    },
    {
      key: 'grp_reservations',
      label: 'รายงานการจองสต็อก',
      type: 'group',
      children: [
        {
          key: 'reservations',
          label: 'รายการจองคงคลัง (Reservations)',
          icon: <BookOutlined />
        }
      ]
    }
  ];

  const renderReportContent = () => {
    if (activeTab === 'movements') {
      return (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Filters Panel */}
          <Card size="small" style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={6}>
                <Input
                  placeholder="ค้นหา รหัส, ชื่อสินค้า หรือเลขล็อต"
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  value={mSearch}
                  onChange={(e) => setMSearch(e.target.value)}
                  onPressEnter={() => fetchMovementsReport(1)}
                  allowClear
                />
              </Col>
              <Col xs={12} md={5}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="คลังสินค้า"
                  allowClear
                  value={mWarehouse}
                  onChange={(val) => setMWarehouse(val)}
                >
                  {warehouses.map(w => (
                    <Select.Option key={w.WarehouseId} value={w.WarehouseId}>
                      {w.WarehouseCode} - {w.WarehouseName}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={12} md={4}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="ประเภทรายการ"
                  allowClear
                  value={mType}
                  onChange={(val) => setMType(val)}
                >
                  <Select.Option value="receipt">รับสินค้าเข้า (Receipt)</Select.Option>
                  <Select.Option value="issue">เบิกสินค้าออก (Issue)</Select.Option>
                  <Select.Option value="transfer">โอนย้ายภายใน (Transfer)</Select.Option>
                  <Select.Option value="adjustment">ปรับปรุงสต็อก (Adjustment)</Select.Option>
                </Select>
              </Col>
              <Col xs={24} md={5}>
                <RangePicker
                  style={{ width: '100%' }}
                  value={mDateRange}
                  onChange={(dates) => setMDateRange(dates || [])}
                  placeholder={['วันที่เริ่มต้น', 'วันที่สิ้นสุด']}
                />
              </Col>
              <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                <Space>
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#0b733e', borderColor: '#0b733e' }}
                    onClick={() => fetchMovementsReport(1)}
                  >
                    ค้นหา
                  </Button>
                  <Button icon={<ClearOutlined />} onClick={() => { handleResetMovements(); fetchMovementsReport(1); }} />
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Movements Table */}
          <Card size="small" bodyStyle={{ padding: 0 }} style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <Table
              columns={movementColumns}
              dataSource={movements}
              rowKey="id"
              loading={mLoading}
              pagination={{
                current: mPage,
                pageSize: mPageSize,
                total: mTotal,
                onChange: (page) => fetchMovementsReport(page),
                showTotal: (total, range) => `แสดง ${range[0]}-${range[1]} จากทั้งหมด ${total} รายการ`
              }}
              locale={{
                emptyText: <Empty description="ไม่พบข้อมูลความเคลื่อนไหวสินค้าในช่วงเวลาที่กำหนด" />
              }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Space>
      );
    }

    if (activeTab === 'lots') {
      return (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Filters Panel */}
          <Card size="small" style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={10}>
                <Input
                  placeholder="ค้นหา เลขล็อต, รหัสสินค้า หรือชื่อสินค้า"
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  value={lSearch}
                  onChange={(e) => setLSearch(e.target.value)}
                  onPressEnter={() => fetchLotsReport(1)}
                  allowClear
                />
              </Col>
              <Col xs={12} md={6}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="สถานะตรวจสอบคุณภาพ (QC)"
                  allowClear
                  value={lQCStatus}
                  onChange={(val) => setLQCStatus(val)}
                >
                  <Select.Option value="pending">รอการตรวจสอบ (Pending)</Select.Option>
                  <Select.Option value="approved">ผ่าน QC (Approved)</Select.Option>
                  <Select.Option value="rejected">ตกเกรด/ไม่ผ่าน (Rejected)</Select.Option>
                  <Select.Option value="hold">กักสินค้า (Hold)</Select.Option>
                </Select>
              </Col>
              <Col xs={12} md={8} style={{ textAlign: 'right' }}>
                <Space>
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#0b733e', borderColor: '#0b733e' }}
                    onClick={() => fetchLotsReport(1)}
                  >
                    ค้นหา
                  </Button>
                  <Button icon={<ClearOutlined />} onClick={() => { handleResetLots(); fetchLotsReport(1); }} />
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Lots Table */}
          <Card size="small" bodyStyle={{ padding: 0 }} style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <Table
              columns={lotColumns}
              dataSource={lots}
              rowKey="id"
              loading={lLoading}
              pagination={{
                current: lPage,
                pageSize: lPageSize,
                total: lTotal,
                onChange: (page) => fetchLotsReport(page),
                showTotal: (total, range) => `แสดง ${range[0]}-${range[1]} จากทั้งหมด ${total} รายการ`
              }}
              locale={{
                emptyText: <Empty description="ไม่พบข้อมูลล็อตสินค้าตามเงื่อนไขที่เลือก" />
              }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Space>
      );
    }

    if (activeTab === 'reservations') {
      return (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Filters Panel */}
          <Card size="small" style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={8}>
                <Input
                  placeholder="ค้นหา รหัสสินค้า หรือชื่อสินค้าที่จอง"
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  value={rSearch}
                  onChange={(e) => setRSearch(e.target.value)}
                  onPressEnter={() => fetchReservationsReport(1)}
                  allowClear
                />
              </Col>
              <Col xs={12} md={5}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="ประเภทเอกสารอ้างอิง"
                  allowClear
                  value={rRefType}
                  onChange={(val) => setRRefType(val)}
                >
                  <Select.Option value="so">ใบสั่งขาย (Sales Order - SO)</Select.Option>
                  <Select.Option value="gi">ใบเบิกสินค้า (Goods Issue - GI)</Select.Option>
                  <Select.Option value="transfer">ใบโอนย้ายคลัง (Transfer)</Select.Option>
                </Select>
              </Col>
              <Col xs={12} md={5}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="สถานะการจอง"
                  allowClear
                  value={rStatus}
                  onChange={(val) => setRStatus(val)}
                >
                  <Select.Option value="open">เริ่มจอง (Open)</Select.Option>
                  <Select.Option value="allocated">จัดสรรแล้ว (Allocated)</Select.Option>
                  <Select.Option value="picked">หยิบแล้ว (Picked)</Select.Option>
                  <Select.Option value="released">ปล่อยจอง (Released)</Select.Option>
                  <Select.Option value="cancelled">ยกเลิก (Cancelled)</Select.Option>
                </Select>
              </Col>
              <Col xs={24} md={6} style={{ textAlign: 'right' }}>
                <Space>
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#0b733e', borderColor: '#0b733e' }}
                    onClick={() => fetchReservationsReport(1)}
                  >
                    ค้นหา
                  </Button>
                  <Button icon={<ClearOutlined />} onClick={() => { handleResetReservations(); fetchReservationsReport(1); }} />
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Reservations Table */}
          <Card size="small" bodyStyle={{ padding: 0 }} style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <Table
              columns={reservationColumns}
              dataSource={reservations}
              rowKey="id"
              loading={rLoading}
              pagination={{
                current: rPage,
                pageSize: rPageSize,
                total: rTotal,
                onChange: (page) => fetchReservationsReport(page),
                showTotal: (total, range) => `แสดง ${range[0]}-${range[1]} จากทั้งหมด ${total} รายการ`
              }}
              locale={{
                emptyText: <Empty description="ไม่พบประวัติรายการจองสินค้าใดๆ ในขณะนี้" />
              }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Space>
      );
    }

    return null;
  };

  return (
    <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            ศูนย์รายงานสินค้าคงคลัง (Inventory Reports Portal)
          </h1>
          <Text type="secondary">ออกรายงาน ตรวจสอบประวัติความเคลื่อนไหว ควบคุมล็อต และสืบค้นรายการจองสินค้าคงคลังปลายทาง</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            if (activeTab === 'movements') fetchMovementsReport(mPage);
            else if (activeTab === 'lots') fetchLotsReport(lPage);
            else if (activeTab === 'reservations') fetchReservationsReport(rPage);
          }}
        >
          โหลดข้อมูลใหม่
        </Button>
      </div>

      {/* 2-Column Sidebar Layout */}
      <Row gutter={[24, 24]}>
        {/* Left Side: Sidebar Menu of Reports */}
        <Col xs={24} lg={6}>
          <Card
            bodyStyle={{ padding: '8px 0' }}
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
              position: 'sticky',
              top: '24px',
              border: '1px solid #f0f0f0'
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', marginBottom: '8px' }}>
              <Text strong style={{ color: '#071d2c' }}>ประเภทรายงานทั้งหมด</Text>
            </div>
            <Menu
              mode="inline"
              selectedKeys={[activeTab]}
              onClick={(e) => setActiveTab(e.key)}
              items={menuItems}
              style={{ borderRight: 0 }}
            />
          </Card>
        </Col>

        {/* Right Side: Render Selected Report */}
        <Col xs={24} lg={18}>
          <Card
            title={
              <Space>
                {activeTab === 'movements' && <HistoryOutlined style={{ color: '#0b733e' }} />}
                {activeTab === 'lots' && <SafetyCertificateOutlined style={{ color: '#0b733e' }} />}
                {activeTab === 'reservations' && <BookOutlined style={{ color: '#0b733e' }} />}
                <span style={{ fontWeight: 'bold', color: '#071d2c' }}>
                  {activeTab === 'movements' && 'ประวัติความเคลื่อนไหวสินค้า (Stock Card)'}
                  {activeTab === 'lots' && 'รายงานล็อตสินค้าและคุณภาพ (Lot & QC)'}
                  {activeTab === 'reservations' && 'รายการจองคงคลัง (Reservations)'}
                </span>
              </Space>
            }
            style={{ borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}
          >
            {renderReportContent()}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
