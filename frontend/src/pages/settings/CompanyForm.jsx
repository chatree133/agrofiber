import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
  FileExcelOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
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
  Tabs,
  Tooltip,
  message,
  Card,
  Tag,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext.jsx';

export default function CompanyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getCompany, createCompany, updateCompany, getBranches, createBranch, updateBranch, deleteBranch } = useCompany();

  const isEdit = Boolean(id);

  const [form] = Form.useForm();
  const [branchForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [searchBranchText, setSearchBranchText] = useState('');

  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  useEffect(() => {
    if (isEdit) {
      loadCompany();
      loadBranches();
    } else {
      form.setFieldValue('isActive', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await getCompany(id);
      form.setFieldsValue(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'ไม่สามารถโหลดข้อมูลบริษัทได้');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const data = await getBranches(id);
      setBranches(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'ไม่สามารถโหลดข้อมูลสาขาได้');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSaveCompany = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (isEdit) {
        await updateCompany(id, values);
        message.success('อัปเดตข้อมูลบริษัทสำเร็จ');
        navigate('/settings/company');
      } else {
        const newCompany = await createCompany(values);
        message.success('สร้างบริษัทใหม่สำเร็จ');
        navigate(`/settings/company/${newCompany.companyId}/edit`);
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBranchModal = (record = null) => {
    setEditingBranch(record);
    if (record) {
      branchForm.setFieldsValue(record);
    } else {
      branchForm.resetFields();
      branchForm.setFieldsValue({ isActive: true, isHeadOffice: false });
    }
    setBranchModalOpen(true);
  };

  const handleCloseBranchModal = () => {
    setBranchModalOpen(false);
    branchForm.resetFields();
    setEditingBranch(null);
  };

  const handleSaveBranch = async () => {
    try {
      const values = await branchForm.validateFields();
      if (editingBranch) {
        await updateBranch(id, editingBranch.branchId, values);
        message.success('อัปเดตสาขาสำเร็จ');
      } else {
        await createBranch(id, values);
        message.success('เพิ่มสาขาสำเร็จ');
      }
      handleCloseBranchModal();
      loadBranches();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'บันทึกสาขาไม่สำเร็จ');
    }
  };

  const handleDeleteBranch = async (branchId) => {
    try {
      await deleteBranch(id, branchId);
      message.success('ลบสาขาสำเร็จ');
      loadBranches();
    } catch (err) {
      message.error(err.response?.data?.message || 'ลบสาขาไม่สำเร็จ');
    }
  };

  const filteredBranches = branches.filter((b) => {
    if (!searchBranchText) return true;
    const term = searchBranchText.toLowerCase();
    return (
      (b.branchCode || '').toLowerCase().includes(term) ||
      (b.branchName || '').toLowerCase().includes(term) ||
      (b.taxBranchCode || '').toLowerCase().includes(term)
    );
  });

  const handleExportBranches = () => {
    const header = ['รหัสสาขา', 'ชื่อสาขา', 'รหัสสาขา(สรรพากร)', 'ที่อยู่', 'สำนักงานใหญ่', 'สถานะ'];
    const rows = filteredBranches.map((b) => [
      b.branchCode || '',
      b.branchName || '',
      b.taxBranchCode || '',
      b.address || '',
      b.isHeadOffice ? 'ใช่' : 'ไม่ใช่',
      b.isActive ? 'เปิดใช้' : 'ปิดใช้',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `branches_company_${id}.csv`;
    link.click();
  };

  const branchColumns = [
    {
      title: '',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          <Popconfirm title="ยืนยันการลบ?" onConfirm={() => handleDeleteBranch(record.branchId)}>
            <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600" />
          </Popconfirm>
          <EditOutlined className="text-blue-600 cursor-pointer hover:text-blue-700" onClick={() => handleOpenBranchModal(record)} />
        </div>
      ),
    },
    { title: 'รหัสสาขา', dataIndex: 'branchCode', key: 'branchCode' },
    { title: 'ชื่อสาขา', dataIndex: 'branchName', key: 'branchName' },
    { title: 'Tax Branch', dataIndex: 'taxBranchCode', key: 'taxBranchCode' },
    {
      title: 'สำนักงานใหญ่',
      dataIndex: 'isHeadOffice',
      key: 'isHeadOffice',
      render: (val) => (val ? <Tag color="green">ใช่</Tag> : 'ไม่ใช่'),
    },
    {
      title: 'เปิด-ปิดใช้',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val) => <Tag color={val ? 'blue' : 'red'}>{val ? 'เปิดใช้' : 'ปิดใช้'}</Tag>,
    },
  ];

  const tabItems = [
    {
      key: 'general',
      label: 'ข้อมูลทั่วไป (General Information)',
      children: (
        <Card loading={loading} className="shadow-sm">
          <Form form={form} layout="vertical">
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <Form.Item name="companyCode" label="รหัสบริษัท" rules={[{ required: true, message: 'กรุณากรอกรหัสบริษัท' }]}>
                <Input placeholder="เช่น DB" />
              </Form.Item>
              <Form.Item name="taxId" label="เลขประจำตัวผู้เสียภาษี">
                <Input placeholder="เช่น 01055xxxxxxxx" />
              </Form.Item>
            </div>
            <Form.Item name="companyName" label="ชื่อบริษัท" rules={[{ required: true, message: 'กรุณากรอกชื่อบริษัท' }]}>
              <Input placeholder="เช่น บริษัท ดับเบิ้ลอีสปอร์ท จำกัด" />
            </Form.Item>
            <Form.Item name="address" label="ที่อยู่บริษัท">
              <Input.TextArea rows={3} placeholder="ที่อยู่" />
            </Form.Item>
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <Form.Item name="phone" label="เบอร์โทรศัพท์">
                <Input placeholder="เช่น 02-123-4567" />
              </Form.Item>
              <Form.Item name="email" label="อีเมล">
                <Input placeholder="เช่น contact@example.com" />
              </Form.Item>
            </div>
            <Form.Item name="isActive" label="สถานะการใช้งาน" valuePropName="checked">
              <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'branches',
      label: 'สาขา (Branches)',
      children: isEdit ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full md:max-w-[400px]">
              <Input
                placeholder="ค้นหา สาขา..."
                value={searchBranchText}
                onChange={(e) => setSearchBranchText(e.target.value)}
                className="rounded-r-none"
              />
              <Button type="primary" icon={<SearchOutlined />} className="rounded-l-none" />
            </div>
            <Space>
              <Tooltip title="Export CSV">
                <Button icon={<FileExcelOutlined />} onClick={handleExportBranches} />
              </Tooltip>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenBranchModal()}>
                เพิ่มสาขา
              </Button>
            </Space>
          </div>
          <div className="rounded-lg border border-slate-200">
            <Table
              columns={branchColumns}
              dataSource={filteredBranches}
              rowKey="branchId"
              loading={loadingBranches}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 mt-4">
          กรุณาบันทึกข้อมูลบริษัทก่อนเพื่อเพิ่มสาขา
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/settings/company")} style={{ marginRight: "12px" }} />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              {isEdit ? 'แก้ไขบริษัท' : 'เพิ่มบริษัทใหม่'}
            </h1>
          </div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSaveCompany}
          >
            บันทึก
          </Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="general" items={tabItems} />

      <Modal
        title={editingBranch ? 'แก้ไขสาขา' : 'เพิ่มสาขา'}
        open={branchModalOpen}
        onOk={handleSaveBranch}
        onCancel={handleCloseBranchModal}
        okText="บันทึก"
        cancelText="ยกเลิก"
        width={600}
      >
        <Form form={branchForm} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <Form.Item name="branchCode" label="รหัสสาขา" rules={[{ required: true, message: 'กรุณากรอกรหัสสาขา' }]}>
              <Input placeholder="เช่น B01" />
            </Form.Item>
            <Form.Item name="taxBranchCode" label="รหัสสาขาสรรพากร">
              <Input placeholder="เช่น 00000" />
            </Form.Item>
          </div>
          <Form.Item name="branchName" label="ชื่อสาขา" rules={[{ required: true, message: 'กรุณากรอกชื่อสาขา' }]}>
            <Input placeholder="เช่น สาขาสีลม" />
          </Form.Item>
          <Form.Item name="address" label="ที่อยู่สาขา">
            <Input.TextArea rows={2} placeholder="ที่อยู่..." />
          </Form.Item>
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <Form.Item name="isHeadOffice" label="เป็นสำนักงานใหญ่" valuePropName="checked">
              <Switch checkedChildren="ใช่" unCheckedChildren="ไม่ใช่" />
            </Form.Item>
            <Form.Item name="isActive" label="สถานะการใช้งาน" valuePropName="checked">
              <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
