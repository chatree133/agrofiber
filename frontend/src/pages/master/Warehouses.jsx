import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  FileExcelOutlined,
  SearchOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tooltip,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { useWarehouse } from '../../context/WarehouseContext.jsx';
import { useMasterData } from '../../context/MasterDataContext.jsx';

export default function Warehouses() {
  const { 
    getWarehouses, 
    createWarehouse, 
    updateWarehouse, 
    deleteWarehouse,
    getWarehouseLocationsRaw,
    createWarehouseLocation,
    updateWarehouseLocation,
    deleteWarehouseLocation
  } = useWarehouse();
  const { fetchLookups } = useMasterData();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form] = Form.useForm();

  // Locations State
  const [locationsModalOpen, setLocationsModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationForm] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getWarehouses();
      setWarehouses(data);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถโหลดข้อมูลคลังสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadLocations = async (whId) => {
    try {
      setLocationsLoading(true);
      const res = await getWarehouseLocationsRaw(whId);
      setLocations(res || []);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถโหลดตำแหน่งได้');
    } finally {
      setLocationsLoading(false);
    }
  };

  const handleOpenLocationsModal = (record) => {
    setSelectedWarehouse(record);
    setLocationsModalOpen(true);
    loadLocations(record.WarehouseId);
  };

  const handleOpenLocationEditModal = (location = null) => {
    setEditingLocation(location);
    if (location) {
      locationForm.setFieldsValue({
        LocationCode: location.LocationCode,
        LocationName: location.LocationName,
        IsPickable: location.IsPickable,
        IsActive: location.IsActive,
      });
    } else {
      locationForm.resetFields();
      locationForm.setFieldValue('IsPickable', true);
      locationForm.setFieldValue('IsActive', true);
    }
    setLocationFormOpen(true);
  };

  const handleSaveLocation = async () => {
    try {
      const values = await locationForm.validateFields();
      setLocationSaving(true);

      const payload = {
        locationCode: values.LocationCode,
        locationName: values.LocationName,
        isPickable: values.IsPickable,
        isActive: values.IsActive,
      };

      if (editingLocation) {
        await updateWarehouseLocation(selectedWarehouse.WarehouseId, editingLocation.LocationId, payload);
        message.success('อัปเดตตำแหน่งสำเร็จ');
      } else {
        await createWarehouseLocation(selectedWarehouse.WarehouseId, payload);
        message.success('สร้างตำแหน่งสำเร็จ');
      }

      setLocationFormOpen(false);
      loadLocations(selectedWarehouse.WarehouseId);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถบันทึกตำแหน่งได้');
    } finally {
      setLocationSaving(false);
    }
  };

  const handleDeleteLocation = async (locationId) => {
    try {
      await deleteWarehouseLocation(selectedWarehouse.WarehouseId, locationId);
      message.success('ลบตำแหน่งสำเร็จ');
      loadLocations(selectedWarehouse.WarehouseId);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถลบตำแหน่งได้');
    }
  };

  const handleOpenModal = (record = null) => {
    setEditingId(record ? record.WarehouseId : null);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
      form.setFieldValue('IsActive', true);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    form.resetFields();
    setEditingId(null);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        warehouseCode: values.WarehouseCode,
        warehouseName: values.WarehouseName,
        isActive: values.IsActive,
      };

      if (editingId) {
        await updateWarehouse(editingId, payload);
        message.success('อัปเดตคลังสินค้าสำเร็จ');
      } else {
        await createWarehouse(payload);
        message.success('สร้างคลังสินค้าสำเร็จ');
      }

      await fetchLookups(); // Force update master data cache in frontend too
      handleCloseModal();
      loadData();
    } catch (err) {
      if (err.errorFields) return; // Form validation error
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteWarehouse(id);
      message.success('ลบคลังสินค้าสำเร็จ');
      await fetchLookups(); // Force update master data cache in frontend too
      loadData();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถลบข้อมูลได้');
    }
  };

  const filteredWarehouses = warehouses.filter((w) => {
    if (!searchText) return true;
    const term = searchText.toLowerCase();
    return (
      (w.WarehouseCode || '').toLowerCase().includes(term) ||
      (w.WarehouseName || '').toLowerCase().includes(term)
    );
  });

  const handleExport = () => {
    const header = ['รหัสคลังสินค้า', 'ชื่อคลังสินค้า', 'สถานะ'];
    const rows = filteredWarehouses.map((w) => [
      w.WarehouseCode || '',
      w.WarehouseName || '',
      w.IsActive ? 'เปิดใช้' : 'ปิดใช้',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'warehouses.csv';
    link.click();
  };

  const columns = [
    {
      title: '',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          <Popconfirm title="ยืนยันการลบ?" onConfirm={() => handleDelete(record.WarehouseId)}>
            <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600" />
          </Popconfirm>
          <EditOutlined className="text-slate-600 cursor-pointer hover:text-blue-600" onClick={() => handleOpenModal(record)} />
        </div>
      ),
    },
    { title: 'รหัสคลังสินค้า', dataIndex: 'WarehouseCode', key: 'WarehouseCode' },
    { title: 'ชื่อคลังสินค้า', dataIndex: 'WarehouseName', key: 'WarehouseName' },
    {
      title: 'ตำแหน่งสินค้า',
      key: 'locations',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          icon={<EnvironmentOutlined />}
          onClick={() => handleOpenLocationsModal(record)}
        >
          จัดการตำแหน่ง
        </Button>
      ),
    },
    {
      title: 'Active',
      dataIndex: 'IsActive',
      key: 'IsActive',
      render: (val) => (val ? 'Yes' : 'No'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">ข้อมูลคลังสินค้า (Warehouses)</h1>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full md:max-w-[400px]">
            <Input
              placeholder="ค้นหา WarehouseCode, WarehouseName..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="rounded-r-none"
            />
            <Button type="primary" icon={<SearchOutlined />} className="rounded-l-none" />
          </div>
          <Space>
            <Tooltip title="Export CSV">
              <Button icon={<FileExcelOutlined />} onClick={handleExport} />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              เพิ่มคลังสินค้า
            </Button>
          </Space>
        </div>
        <div className="rounded-lg border border-slate-200">
          <Table
            columns={columns}
            dataSource={filteredWarehouses}
            rowKey="WarehouseId"
            loading={loading}
            pagination={false}
            size="small"
          />
        </div>
      </div>

      <Modal
        title={editingId ? 'แก้ไขคลังสินค้า' : 'เพิ่มคลังสินค้า'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={handleCloseModal}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="WarehouseCode"
            label="รหัสคลังสินค้า (WarehouseCode)"
            rules={[{ required: true, message: 'กรุณากรอกรหัสคลังสินค้า' }]}
          >
            <Input placeholder="เช่น MAIN, RM, FG" />
          </Form.Item>
          <Form.Item
            name="WarehouseName"
            label="ชื่อคลังสินค้า (WarehouseName)"
            rules={[{ required: true, message: 'กรุณากรอกชื่อคลังสินค้า' }]}
          >
            <Input placeholder="เช่น คลังสินค้าสำเร็จรูป" />
          </Form.Item>
          <Form.Item name="IsActive" label="สถานะการใช้งาน" valuePropName="checked">
            <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal จัดการตำแหน่งสินค้า (Locations) */}
      <Modal
        title={`ตำแหน่งสินค้าในคลัง: ${selectedWarehouse?.WarehouseName || ''} (${selectedWarehouse?.WarehouseCode || ''})`}
        open={locationsModalOpen}
        onCancel={() => setLocationsModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setLocationsModalOpen(false)}>
            ปิด
          </Button>
        ]}
        width={800}
      >
        <div className="space-y-4 py-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-slate-700">รายการตำแหน่งสินค้า</h3>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleOpenLocationEditModal()}
            >
              เพิ่มตำแหน่ง
            </Button>
          </div>

          <Table
            dataSource={locations}
            rowKey="LocationId"
            loading={locationsLoading}
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: '',
                key: 'actions',
                width: 100,
                align: 'center',
                render: (_, loc) => (
                  <div className="flex justify-center gap-2">
                    <Popconfirm title="ยืนยันการลบตำแหน่ง?" onConfirm={() => handleDeleteLocation(loc.LocationId)}>
                      <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600" />
                    </Popconfirm>
                    <EditOutlined className="text-slate-600 cursor-pointer hover:text-blue-600" onClick={() => handleOpenLocationEditModal(loc)} />
                  </div>
                )
              },
              {
                title: 'รหัสตำแหน่ง (Code)',
                dataIndex: 'LocationCode',
                key: 'LocationCode',
              },
              {
                title: 'ชื่อตำแหน่ง (Name)',
                dataIndex: 'LocationName',
                key: 'LocationName',
              },
              {
                title: 'เบิกสินค้าได้ (Pickable)',
                dataIndex: 'IsPickable',
                key: 'IsPickable',
                render: (val) => (val ? 'Yes' : 'No'),
              },
              {
                title: 'Active',
                dataIndex: 'IsActive',
                key: 'IsActive',
                render: (val) => (val ? 'Yes' : 'No'),
              },
            ]}
          />
        </div>
      </Modal>

      {/* Modal เพิ่ม/แก้ไขตำแหน่งสินค้า (Nested Location Form) */}
      <Modal
        title={editingLocation ? 'แก้ไขตำแหน่งสินค้า' : 'เพิ่มตำแหน่งสินค้า'}
        open={locationFormOpen}
        onOk={handleSaveLocation}
        onCancel={() => setLocationFormOpen(false)}
        confirmLoading={locationSaving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        width={500}
      >
        <Form form={locationForm} layout="vertical" className="mt-4">
          <Form.Item
            name="LocationCode"
            label="รหัสตำแหน่ง (LocationCode)"
            rules={[{ required: true, message: 'กรุณากรอกรหัสตำแหน่ง' }]}
          >
            <Input placeholder="เช่น A-01-01, RM-01" />
          </Form.Item>
          <Form.Item
            name="LocationName"
            label="ชื่อตำแหน่ง (LocationName)"
          >
            <Input placeholder="เช่น ชั้นที่ 1 ล็อค A" />
          </Form.Item>
          <Form.Item name="IsPickable" label="อนุญาตให้เบิกสินค้าได้ (IsPickable)" valuePropName="checked">
            <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
          </Form.Item>
          <Form.Item name="IsActive" label="สถานะการใช้งาน (IsActive)" valuePropName="checked">
            <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
