import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Divider, Modal, Row, Select, Space, Table, Tag, Typography, message, Input, Tooltip, Badge, Pagination, DatePicker, Tabs } from 'antd';
import { PlusOutlined, TruckOutlined, UserOutlined, CalendarOutlined, EyeOutlined, SearchOutlined, FileExcelOutlined, FilterOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWms } from '../../context/WmsContext.jsx';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function LoadPlanList() {
  const navigate = useNavigate();
  const { getLoadPlans, getLoadPlanDetail, updateLoadPlanStatus, getLoadPlanVehicles, getGoogleMapsKey } = useWms();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [planDetail, setPlanDetail] = useState(null);

  // Map and tabs states
  const [mapLoading, setMapLoading] = useState(false);
  const [mapsKey, setMapsKey] = useState('');
  const [totalDistanceText, setTotalDistanceText] = useState('');
  const mapRef = React.useRef(null);

  const loadGoogleMapsScript = (key, callback) => {
    if (window.google && window.google.maps) {
      callback();
      return;
    }
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', callback);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', callback);
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps || !planDetail) return;

    // Define coordinates
    const branchLat = planDetail.branchLatitude;
    const branchLng = planDetail.branchLongitude;

    // Filter lines with valid lat/lng and sort by stopSequence
    const stops = (planDetail.lines || [])
      .filter(l => l.latitude && l.longitude)
      .sort((a, b) => a.stopSequence - b.stopSequence);

    if (!branchLat || !branchLng || stops.length === 0) {
      setMapLoading(false);
      return;
    }

    const mapOptions = {
      zoom: 12,
      center: { lat: branchLat, lng: branchLng },
    };

    const map = new window.google.maps.Map(mapRef.current, mapOptions);
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
    });

    const origin = new window.google.maps.LatLng(branchLat, branchLng);
    const lastStop = stops[stops.length - 1];
    const destination = new window.google.maps.LatLng(lastStop.latitude, lastStop.longitude);

    const intermediateStops = stops.slice(0, -1);
    const waypoints = intermediateStops.map(stop => ({
      location: new window.google.maps.LatLng(stop.latitude, stop.longitude),
      stopover: true
    }));

    directionsService.route({
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (result, status) => {
      setMapLoading(false);
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        let totalDistance = 0;
        const route = result.routes[0];
        for (let i = 0; i < route.legs.length; i++) {
          totalDistance += route.legs[i].distance.value;
        }
        setTotalDistanceText((totalDistance / 1000).toFixed(1) + ' กม.');
      } else {
        message.error('ไม่สามารถคำนวณเส้นทางได้: ' + status);
      }
    });
  };

  const handleLoadMapTab = async () => {
    if (!planDetail) return;
    
    const branchLat = planDetail.branchLatitude;
    const branchLng = planDetail.branchLongitude;
    const stops = (planDetail.lines || []).filter(l => l.latitude && l.longitude);
    
    if (!branchLat || !branchLng) {
      message.warning('ไม่พบพิกัดของสาขา (จุดเริ่มต้น)');
      return;
    }
    
    if (stops.length === 0) {
      message.warning('ไม่พบจุดส่งสินค้าที่มีพิกัดละติจูด/ลองจิจูด');
      return;
    }

    setMapLoading(true);
    setTotalDistanceText('');
    try {
      const key = await getGoogleMapsKey();
      setMapsKey(key);
      if (key) {
        loadGoogleMapsScript(key, () => {
          setTimeout(() => {
            initializeMap();
          }, 200);
        });
      } else {
        setMapLoading(false);
        // If no key, open in new tab automatically
        const coordsArray = [`${branchLat},${branchLng}`];
        stops
          .sort((a, b) => a.stopSequence - b.stopSequence)
          .slice(0, 9)
          .forEach(s => {
            coordsArray.push(`${s.latitude},${s.longitude}`);
          });
        const googleMapsDirUrl = `https://www.google.com/maps/dir/${coordsArray.join('/')}`;
        window.open(googleMapsDirUrl, '_blank');
      }
    } catch (err) {
      console.error(err);
      message.error('ไม่สามารถโหลดข้อมูล Google Maps Key ได้');
      setMapLoading(false);
    }
  };

  const renderMapTabContent = () => {
    const branchLat = planDetail?.branchLatitude;
    const branchLng = planDetail?.branchLongitude;
    const stops = (planDetail?.lines || [])
      .filter(l => l.latitude && l.longitude)
      .sort((a, b) => a.stopSequence - b.stopSequence)
      .slice(0, 9);

    const coordsArray = [];
    if (branchLat && branchLng) {
      coordsArray.push(`${branchLat},${branchLng}`);
    }
    stops.forEach(s => {
      coordsArray.push(`${s.latitude},${s.longitude}`);
    });

    const googleMapsDirUrl = `https://www.google.com/maps/dir/${coordsArray.join('/')}`;

    if (mapLoading && !mapsKey) {
      return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดรายละเอียดแผนที่...</div>;
    }

    if (!mapsKey) {
      return (
        <div className="p-6 text-center space-y-4 border border-slate-200 rounded-lg bg-slate-50 my-2">
          <div className="text-slate-600 text-sm font-semibold">
            ไม่มี Google Maps API Key ในระบบ จึงไม่สามารถแสดงแผนที่จำลองบนหน้านี้ได้
          </div>
          <div className="text-slate-500 text-xs">
            คุณสามารถเปิดแผนที่เส้นทางนำทาง (สาขา + 9 จุดแรก) โดยตรงบน Google Maps
          </div>
          <div>
            <Button
              type="primary"
              onClick={() => window.open(googleMapsDirUrl, '_blank')}
            >
              เปิดเส้นทางบน Google Maps
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3 py-2" style={{ position: 'relative' }}>
        {mapLoading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: '8px'
            }}
          >
            <span className="text-slate-500 font-medium">กำลังโหลดแผนที่เส้นทางการจัดส่ง...</span>
          </div>
        )}
        {totalDistanceText && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
            ระยะทางรวมของเส้นทาง: {totalDistanceText}
          </div>
        )}
        <div
          ref={mapRef}
          style={{ width: '100%', height: '450px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        />
      </div>
    );
  };

  const handleCloseDetailModal = () => {
    setDetailModalVisible(false);
    setTotalDistanceText('');
    setMapsKey('');
  };

  // Search and Filter states
  const [searchText, setSearchText] = useState('');
  const [filteredPlans, setFilteredPlans] = useState([]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    date: dayjs(), // default today
    status: undefined,
    vehicleId: undefined,
  });

  const [tempDate, setTempDate] = useState(dayjs());
  const [tempStatus, setTempStatus] = useState(undefined);
  const [tempVehicleId, setTempVehicleId] = useState(undefined);

  const [vehicles, setVehicles] = useState([]);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  const filterCount = (appliedFilters.status ? 1 : 0) + (appliedFilters.vehicleId ? 1 : 0);

  useEffect(() => {
    // Load vehicles for filter dropdown
    const fetchVehicles = async () => {
      try {
        const data = await getLoadPlanVehicles();
        setVehicles(data);
      } catch (err) {
        console.error('Failed to load vehicles:', err);
      }
    };
    fetchVehicles();
  }, [getLoadPlanVehicles]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const params = {};
      if (appliedFilters.date) {
        params.date = appliedFilters.date.format('YYYY-MM-DD');
      }
      if (appliedFilters.status) {
        params.status = appliedFilters.status;
      }
      if (appliedFilters.vehicleId) {
        params.vehicleId = appliedFilters.vehicleId;
      }

      const data = await getLoadPlans(params);
      setPlans(data);

      // Filter client side on the fetched plans
      const filtered = filterPlansClientSide(data, searchText);
      setFilteredPlans(filtered);

      setPagination(prev => ({
        ...prev,
        total: filtered.length,
        page: 1, // Reset page to 1
      }));
    } catch (err) {
      message.error('ไม่สามารถโหลดแผนจัดส่งได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  // Client side search logic
  const filterPlansClientSide = (allPlans, query) => {
    if (!query) return allPlans;
    const lowerQuery = query.toLowerCase();
    return allPlans.filter(p => {
      const matchNo = p.loadPlanNo?.toLowerCase().includes(lowerQuery);
      const matchDriver = p.driverName?.toLowerCase().includes(lowerQuery);
      const matchVehicle = p.licensePlate?.toLowerCase().includes(lowerQuery);

      // Search inside the document numbers or customer names arrays
      const matchDO = p.documentNos?.some(no => no.toLowerCase().includes(lowerQuery));
      const matchCustomer = p.customerNames?.some(name => name.toLowerCase().includes(lowerQuery));

      return matchNo || matchDriver || matchVehicle || matchDO || matchCustomer;
    });
  };

  const onSearchChange = (value) => {
    setSearchText(value);
    const filtered = filterPlansClientSide(plans, value);
    setFilteredPlans(filtered);
    setPagination(prev => ({
      ...prev,
      total: filtered.length,
      page: 1,
    }));
  };

  const onSearch = (value) => {
    const filtered = filterPlansClientSide(plans, value);
    setFilteredPlans(filtered);
    setPagination(prev => ({
      ...prev,
      total: filtered.length,
      page: 1,
    }));
  };

  const onExport = () => {
    try {
      const header = [
        'เลขที่แผนงาน',
        'สาขา',
        'วันที่จัดส่ง',
        'ทะเบียนรถ',
        'ประเภทรถ',
        'พนักงานขับรถ',
        'น้ำหนัก (kg)',
        'ปริมาตร (CBM)',
        'สถานะ'
      ];

      const rows = filteredPlans.map((p) => [
        p.loadPlanNo || '',
        p.branchName || '',
        p.planDate ? dayjs(p.planDate).format('YYYY-MM-DD') : '',
        p.licensePlate || '',
        p.vehicleType || '',
        p.driverName || '',
        p.totalWeightKg !== undefined ? p.totalWeightKg.toFixed(1) : '0.0',
        p.totalVolumeCbm !== undefined ? p.totalVolumeCbm.toFixed(3) : '0.000',
        getStatusText(p.status) || p.status || '',
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
        .join('\n');

      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
      link.download = `load_plans_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      link.click();
      message.success('ส่งออกข้อมูล CSV เรียบร้อยแล้ว');
    } catch (err) {
      message.error('ไม่สามารถส่งออกข้อมูล CSV ได้: ' + err.message);
    }
  };

  const onFilter = () => {
    setTempDate(appliedFilters.date);
    setTempStatus(appliedFilters.status);
    setTempVehicleId(appliedFilters.vehicleId);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setAppliedFilters({
      date: tempDate,
      status: tempStatus,
      vehicleId: tempVehicleId,
    });
    setFilterOpen(false);
  };

  const onPageChange = (page, pageSize) => {
    setPagination(prev => ({ ...prev, page, pageSize }));
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
      render: (text, r) => <div><Tag color={getStatusTagColor(r.status)}>{getStatusText(r.status)}</Tag><a onClick={() => handleViewDetails(r.id)} style={{ fontWeight: 'bold' }}>{text}</a></div>
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
      render: (text) => text || 'ไม่ระบุ'
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
    // {
    //   title: 'สถานะแผน',
    //   dataIndex: 'status',
    //   key: 'status',
    //   render: (status) => <Tag color={getStatusTagColor(status)}>{getStatusText(status)}</Tag>
    // },
    {
      title: '',
      key: 'action',
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record.id)}
            size="small"
          >
            เรียกดู
          </Button>

          <Button
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/document/print?form=LP&date=${dayjs(record.planDate).format('YYYY-MM-DD')}&docId=${record.id}`, '_blank')}
            size="small"
          >
            พิมพ์แผนนี้
          </Button>

          <Select
            value={record.status}
            size="small"
            onChange={(val) => handleUpdateStatus(record.id, val)}
            style={{ width: 150 }}
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

  // Slice paginated items client-side
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  const paginatedPlans = filteredPlans.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            รายการแผนการจัดส่งสินค้า (Load Plans)
          </h1>
          <Text type="secondary">ตรวจสอบ ติดตามสถานะจัดส่ง และปรับเปลี่ยนขั้นตอนแผนจัดส่งสินค้า</Text>
        </div>
        <Space>
          <Button
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/document/print?form=LP&date=${appliedFilters.date.format('YYYY-MM-DD')}`, '_blank')}
            style={{ borderRadius: 6, fontWeight: 600 }}
          >
            พิมพ์แผนการส่งสินค้า
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/wms/load-plans/create')}
            style={{ background: '#0f766e', borderColor: '#0f766e', borderRadius: 6, fontWeight: 600 }}
          >
            สร้างแผนจัดส่งใหม่
          </Button>
        </Space>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Left: Search Input */}
        <div className="flex w-full md:max-w-[560px]">
          <Input
            allowClear
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            onPressEnter={() => onSearch(searchText)}
            placeholder="ค้นหาเลข DO หรือชื่อลูกค้า"
            className="rounded-r-none"
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            className="rounded-l-none bg-[#1890ff] border-[#1890ff]"
            onClick={() => onSearch(searchText)}
          />
        </div>

        {/* Right: Controls matching the image layout */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge count={filterCount} size="small">
            <Button icon={<FilterOutlined />} onClick={onFilter} className="flex items-center justify-center" />
          </Badge>

          <span className="text-slate-600 text-xs">
            {pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0}-
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} จากทั้งหมด {pagination.total} รายการ
          </span>

          <Pagination
            simple
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={onPageChange}
            showSizeChanger={false}
          />

          <Select
            value={pagination.pageSize}
            className="w-28 text-xs"
            options={[10, 20, 50, 100].map((value) => ({ value, label: `${value}/page` }))}
            onChange={(pageSize) => setPagination(prev => ({ ...prev, page: 1, pageSize }))}
          />

          <Tooltip title="Export CSV">
            <Button icon={<FileExcelOutlined />} onClick={onExport} />
          </Tooltip>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <Table
          dataSource={paginatedPlans}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </div>

      {/* Filter Modal */}
      <Modal
        title="ตัวกรองแผนการจัดส่ง"
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        onOk={applyFilter}
        okText="ตกลง"
        cancelText="ยกเลิก"
      >
        <div className="space-y-4 py-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-slate-600 text-xs font-semibold">วันที่จัดส่ง:</span>
            <DatePicker
              value={tempDate}
              onChange={(date) => setTempDate(date)}
              className="w-full"
              allowClear={false}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-slate-600 text-xs font-semibold">สถานะแผนงาน:</span>
            <Select
              placeholder="เลือกสถานะ"
              value={tempStatus}
              onChange={(val) => setTempStatus(val)}
              className="w-full"
              allowClear
            >
              <Option value="draft">ฉบับร่าง</Option>
              <Option value="ready">ปล่อยงาน (Ready)</Option>
              <Option value="in_transit">จัดส่งจริง (In Transit)</Option>
              <Option value="completed">เสร็จสิ้น (Completed)</Option>
              <Option value="cancelled">ยกเลิกแผน (Cancelled)</Option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-slate-600 text-xs font-semibold">ยานพาหนะ:</span>
            <Select
              placeholder="เลือกยานพาหนะ"
              value={tempVehicleId}
              onChange={(val) => setTempVehicleId(val)}
              className="w-full"
              allowClear
            >
              {vehicles.map(v => (
                <Option key={v.VehicleId} value={v.VehicleId}>
                  {v.LicensePlate} ({v.VehicleType})
                </Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* Load Plan Details Modal */}
      <Modal
        title={`รายละเอียดแผนจัดส่ง: ${planDetail?.loadPlanNo || ''}`}
        open={detailModalVisible}
        onCancel={handleCloseDetailModal}
        width={900}
        footer={[
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/document/print?form=LP&date=${planDetail ? dayjs(planDetail.planDate).format('YYYY-MM-DD') : ''}&docId=${planDetail?.id}`, '_blank')}
          >
            พิมพ์แผนการส่งสินค้า
          </Button>,
          <Button key="close" onClick={handleCloseDetailModal}>
            ปิดหน้าต่าง
          </Button>
        ]}
      >
        {detailLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลด...</div>
        ) : planDetail ? (
          <Tabs
            defaultActiveKey="details"
            onChange={(key) => {
              if (key === 'map') {
                handleLoadMapTab();
              }
            }}
            items={[
              {
                key: 'details',
                label: 'รายละเอียดแผนจัดส่ง',
                children: (
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
                          <div style={{ marginTop: 8 }}><UserOutlined /> พนักงาน: {planDetail.driver?.driverName || 'ไม่ระบุ'}</div>
                          <div style={{ marginTop: 8 }}>เบอร์ติดต่อ: {planDetail.driver?.phone || '-'}</div>
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
                )
              },
              {
                key: 'map',
                label: 'แผนที่การเดินทาง',
                children: renderMapTabContent()
              }
            ]}
          />
        ) : null}
      </Modal>
    </div>
  );
}
