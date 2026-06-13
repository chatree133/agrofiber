import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Table, Tabs, Tag, TimePicker, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useWms } from '../../context/WmsContext.jsx';
import { useCompany } from '../../context/CompanyContext.jsx';
import { useMasterData } from "../../context/MasterDataContext.jsx";
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function TransportMaster() {
  const {
    getLoadPlanVehicles,
    createLoadPlanVehicle,
    updateLoadPlanVehicle,
    getLoadPlanDriverUsers,
    getLoadPlanDrivers,
    createLoadPlanDriver,
    updateLoadPlanDriver,
  } = useWms();
  const { getBranches } = useCompany();

  const [activeTab, setActiveTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const { lookups, fetchLookups } = useMasterData();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!lookups || Object.keys(lookups).length === 0) {
      fetchLookups();
    }
  }, [lookups, fetchLookups]);

  const userOptions = useMemo(() => users.map((user) => ({
    value: user.UserId,
    label: `${user.StaffId || user.Username} - ${user.DisplayName || user.Username}`,
  })), [users]);

  const loadVehicles = async () => {
    const data = await getLoadPlanVehicles({ includeInactive: 1 });
    setVehicles(data);
  };

  const loadDrivers = async () => {
    const data = await getLoadPlanDrivers({ includeInactive: 1 });
    setDrivers(data);
  };

  const loadUsers = async () => {
    const data = await getLoadPlanDriverUsers();
    setUsers(data);
  };

  const loadBranches = async () => {
    const data = await getBranches(1);
    setBranches(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadVehicles(), loadDrivers(), loadUsers(), loadBranches()]);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถโหลดข้อมูลขนส่งได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (record = null) => {
    console.log('Opening modal for record:', record);
    setEditingRecord(record);
    form.resetFields();

    if (record) {
      if (activeTab === 'vehicles') {
        form.setFieldsValue({
          licensePlate: record.LicensePlate,
          vehicleType: record.VehicleType,
          maxWeightKg: Number(record.MaxWeightKg),
          maxVolumeCbm: Number(record.MaxVolumeCbm),
          costPerKm: record.CostPerKm !== undefined && record.CostPerKm !== null ? Number(record.CostPerKm) : undefined,
          workingTimeRange: record.WorkingStart && record.WorkingEnd
            ? [dayjs(record.WorkingStart, 'HH:mm'), dayjs(record.WorkingEnd, 'HH:mm')]
            : null,
          isActive: Boolean(record.IsActive),
          branchId: record.BranchId || undefined,
          defaultDriverId: record.DefaultDriverId || undefined,
        });
      } else {
        form.setFieldsValue({
          userId: record.UserId,
          driverName: record.DriverName,
          phone: record.Phone,
          preferredProvinceId: record.PreferredProvinceId,
          isActive: Boolean(record.IsActive),
        });
      }
    } else {
      form.setFieldsValue({ isActive: true, costPerKm: 1.00 });
    }

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const saveRecord = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (activeTab === 'vehicles') {
        const [start, end] = values.workingTimeRange || [];
        const payload = {
          licensePlate: values.licensePlate,
          vehicleType: values.vehicleType,
          maxWeightKg: values.maxWeightKg,
          maxVolumeCbm: values.maxVolumeCbm,
          costPerKm: values.costPerKm !== undefined && values.costPerKm !== null ? values.costPerKm : null,
          workingStart: start ? start.format('HH:mm') : null,
          workingEnd: end ? end.format('HH:mm') : null,
          isActive: values.isActive,
          branchId: values.branchId || null,
          defaultDriverId: values.defaultDriverId || null,
        };

        if (editingRecord) {
          await updateLoadPlanVehicle(editingRecord.VehicleId, payload);
          message.success('อัปเดตยานพาหนะสำเร็จ');
        } else {
          await createLoadPlanVehicle(payload);
          message.success('เพิ่มยานพาหนะสำเร็จ');
        }

        await loadVehicles();
      } else {
        const payload = {
          userId: values.userId,
          driverName: values.driverName,
          phone: values.phone,
          preferredProvinceId: values.preferredProvinceId,
          isActive: values.isActive,
        };

        if (editingRecord) {
          await updateLoadPlanDriver(editingRecord.DriverId, payload);
          message.success('อัปเดตคนขับสำเร็จ');
        } else {
          await createLoadPlanDriver(payload);
          message.success('เพิ่มคนขับสำเร็จ');
        }

        await loadDrivers();
      }

      closeModal();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  const vehicleColumns = [
    {
      title: 'การจัดการ',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openModal(record)}>
          แก้ไข
        </Button>
      ),
    },
    { title: 'ทะเบียนรถ', dataIndex: 'LicensePlate', key: 'LicensePlate' },
    {
      title: 'สาขาประจำ',
      dataIndex: 'BranchName',
      key: 'BranchName',
      render: (text) => text || '-',
    },
    {
      title: 'คนขับประจำ',
      dataIndex: 'DefaultDriverName',
      key: 'DefaultDriverName',
      render: (text) => text || '-',
    },
    { title: 'ประเภทรถ', dataIndex: 'VehicleType', key: 'VehicleType' },
    {
      title: 'น้ำหนักสูงสุด (kg)',
      dataIndex: 'MaxWeightKg',
      key: 'MaxWeightKg',
      align: 'right',
      render: (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    },
    {
      title: 'ปริมาตรสูงสุด (CBM)',
      dataIndex: 'MaxVolumeCbm',
      key: 'MaxVolumeCbm',
      align: 'right',
      render: (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 }),
    },
    {
      title: 'ค่าเดินทาง/กม. (บาท)',
      dataIndex: 'CostPerKm',
      key: 'CostPerKm',
      align: 'right',
      render: (value) => value !== null && value !== undefined ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '1.00',
    },
    {
      title: 'เวลาทำงาน',
      key: 'workingTime',
      render: (_, record) => record.WorkingStart && record.WorkingEnd
        ? `${record.WorkingStart} - ${record.WorkingEnd}`
        : '-',
    },
    {
      title: 'สถานะ',
      dataIndex: 'IsActive',
      key: 'IsActive',
      render: (value) => (value ? <Tag color="success">ใช้งาน</Tag> : <Tag color="default">ปิดใช้</Tag>),
    },
  ];

  const driverColumns = [
    {
      title: 'การจัดการ',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openModal(record)}>
          แก้ไข
        </Button>
      ),
    },
    { title: 'ชื่อคนขับ', dataIndex: 'DriverName', key: 'DriverName' },
    { title: 'ผู้ใช้ระบบ', dataIndex: 'Username', key: 'Username' },
    { title: 'เบอร์โทร', dataIndex: 'Phone', key: 'Phone', render: (value) => value || '-' },
    { title: 'จังหวัดที่ถนัด', dataIndex: 'PreferredProvince', key: 'PreferredProvince', render: (value) => value || '-' },
    {
      title: 'สถานะ',
      dataIndex: 'IsActive',
      key: 'IsActive',
      render: (value) => (value ? <Tag color="success">ใช้งาน</Tag> : <Tag color="default">ปิดใช้</Tag>),
    },
  ];

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            จัดการยานพาหนะและคนขับที่ใช้ในแผนจัดส่งสินค้า
          </h1>
          <Text type="secondary">จัดการยานพาหนะและคนขับที่ใช้ในแผนจัดส่งสินค้า</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            รีเฟรช
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            {activeTab === 'vehicles' ? 'เพิ่มยานพาหนะ' : 'เพิ่มคนขับ'}
          </Button>
        </Space>
      </div>

      <Card bordered={true} style={{ borderRadius: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setEditingRecord(null);
            form.resetFields();
          }}
          items={[
            {
              key: 'vehicles',
              label: 'ยานพาหนะ',
              children: (
                <Table
                  size='small'
                  rowKey="VehicleId"
                  columns={vehicleColumns}
                  dataSource={vehicles}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: "max-content" }}
                />
              ),
            },
            {
              key: 'drivers',
              label: 'คนขับ',
              children: (
                <Table
                  size='small'
                  rowKey="DriverId"
                  columns={driverColumns}
                  dataSource={drivers}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={activeTab === 'vehicles' ? 'ข้อมูลยานพาหนะ' : 'ข้อมูลคนขับ'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={saveRecord}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        width={activeTab === 'vehicles' ? 700 : 520}
      // destroyOnClose
      >
        <Form form={form} layout="vertical">
          {activeTab === 'vehicles' ? (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="licensePlate" label="ทะเบียนรถ" rules={[{ required: true, message: 'กรุณากรอกทะเบียนรถ' }]}>
                  <Input maxLength={30} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="vehicleType" label="ประเภทรถ" rules={[{ required: true, message: 'กรุณากรอกประเภทรถ' }]}>
                  <Input maxLength={50} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="maxWeightKg" label="น้ำหนักสูงสุด (kg)" rules={[{ required: true, message: 'กรุณากรอกน้ำหนักสูงสุด' }]}>
                  <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="maxVolumeCbm" label="ปริมาตรสูงสุด (CBM)" rules={[{ required: true, message: 'กรุณากรอกปริมาตรสูงสุด' }]}>
                  <InputNumber min={0.01} precision={3} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="workingTimeRange" label="เวลาทำงาน">
                  <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} placeholder={['เวลาเริ่ม', 'เวลาสิ้นสุด']} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="costPerKm" label="ค่าเดินทางต่อกม. (บาท)" rules={[{ required: true, message: 'กรุณากรอกค่าเดินทางต่อกม.' }]}>
                  <InputNumber min={0.00} precision={2} placeholder="เช่น 5.50" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="branchId" label="สาขาประจำรถ">
                  <Select placeholder="เลือกสาขาประจำการของรถ (ออปชั่น)" allowClear style={{ width: '100%' }}>
                    {branches.map((b) => (
                      <Select.Option key={b.branchId} value={b.branchId}>
                        {b.branchCode} - {b.branchName}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="defaultDriverId" label="คนขับประจำรถ (Default Driver)">
                  <Select
                    placeholder="เลือกคนขับประจำรถ (ออปชั่น)"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                    options={drivers.map(d => ({
                      value: d.DriverId,
                      label: `${d.DriverName} (${d.Phone || 'ไม่มีเบอร์โทร'})`
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <>
              <Form.Item name="userId" label="ผู้ใช้ระบบ" rules={[{ required: true, message: 'กรุณาเลือกผู้ใช้ระบบ' }]}>
                <Select
                  showSearch
                  options={userOptions}
                  optionFilterProp="label"
                  placeholder="เลือก user ที่จะผูกกับคนขับ"
                />
              </Form.Item>
              <Form.Item name="driverName" label="ชื่อคนขับ" rules={[{ required: true, message: 'กรุณากรอกชื่อคนขับ' }]}>
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item name="phone" label="เบอร์โทร">
                <Input maxLength={30} />
              </Form.Item>
              {/* <Form.Item name="preferredProvince" label="จังหวัดที่ถนัด">
                <Input maxLength={100} />
              </Form.Item> */}
              <Form.Item name="preferredProvinceId" label="จังหวัดที่ถนัด">
                <Select
                  showSearch
                  options={lookups?.provinces || []}
                  optionFilterProp="label"
                  placeholder="เลือกจังหวัดที่ถนัด"
                // allowClear
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="isActive" label="สถานะ" valuePropName="checked">
            <Switch checkedChildren="ใช้งาน" unCheckedChildren="ปิดใช้" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
