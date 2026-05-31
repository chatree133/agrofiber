import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  FileExcelOutlined,
  SearchOutlined,
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
  const { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } = useWarehouse();
  const { fetchLookups } = useMasterData();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form] = Form.useForm();

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
    </div>
  );
}
