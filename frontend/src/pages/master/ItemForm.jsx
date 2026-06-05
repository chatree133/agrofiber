import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined, FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Switch,
  Table,
  Tabs,
  message,
  Tooltip,
  Space,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ItemSpecModal from '../../components/items/ItemSpecModal.jsx';
import { useMasterData } from '../../context/MasterDataContext.jsx';
import { useItem } from '../../context/ItemContext.jsx';

export default function ItemForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [itemSpecs, setItemSpecs] = useState([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState(null);
  const [searchSpecText, setSearchSpecText] = useState('');

  const { lookups, fetchLookups } = useMasterData();
  const {
    getItem,
    createItem,
    updateItem,
    getItemSpecs,
    createItemSpec,
    updateItemSpec,
    deleteItemSpec,
  } = useItem();

  const isEdit = Boolean(id);

  const widthId = Form.useWatch('widthId', form);
  const lengthId = Form.useWatch('lengthId', form);

  useEffect(() => {
    if (widthId && lengthId && lookups.widths.length && lookups.lengths.length) {
      const w = lookups.widths.find(x => x.value === widthId)?.widthM;
      const l = lookups.lengths.find(x => x.value === lengthId)?.lengthM;
      if (w !== undefined && l !== undefined) {
        const area = (w * l).toFixed(4);
        form.setFieldValue('areaSqm', Number(area));
      }
    }
  }, [widthId, lengthId, lookups.widths, lookups.lengths, form]);

  useEffect(() => {
    if (!lookups || Object.keys(lookups).length === 0) {
      fetchLookups();
    }
  }, [lookups, fetchLookups]);

  useEffect(() => {
    if (isEdit) {
      loadItem();
      loadSpecs();
    }
  }, [id]);

  const loadItem = async () => {
    setLoading(true);
    try {
      const itemData = await getItem(id);
      if (itemData) {
        form.setFieldsValue({
          ...itemData,
          isActive: itemData.isActive ?? true,
          status: itemData.status ?? 'draft',
        });
      }
    } catch (err) {
      message.error('โหลดข้อมูลสินค้าไม่สำเร็จ');
      navigate('/master/items');
    } finally {
      setLoading(false);
    }
  };

  const loadSpecs = async () => {
    setLoadingSpecs(true);
    try {
      const specsData = await getItemSpecs(id);
      setItemSpecs(specsData || []);
    } catch (err) {
      message.error('โหลดข้อมูลสเปกไม่สำเร็จ');
    } finally {
      setLoadingSpecs(false);
    }
  };

  const handleSaveItem = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = { ...values };

      if (isEdit) {
        await updateItem(id, payload);
        message.success('บันทึกข้อมูลสินค้าสำเร็จ');
      } else {
        const newItem = await createItem(payload);
        message.success('สร้างข้อมูลสินค้าสำเร็จ');
        navigate(`/master/items/${newItem.id || newItem.itemId}/edit`);
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // --- Spec Management ---
  const handleOpenSpecModal = (spec = null) => {
    setEditingSpec(spec);
    setSpecModalOpen(true);
  };

  const handleSaveSpec = async (values) => {
    try {
      if (editingSpec) {
        await updateItemSpec(id, editingSpec.itemSpecId, values);
        message.success('แก้ไขสเปกสำเร็จ');
      } else {
        await createItemSpec(id, values);
        message.success('เพิ่มสเปกสำเร็จ');
      }
      setSpecModalOpen(false);
      loadSpecs();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'บันทึกสเปกไม่สำเร็จ');
    }
  };

  const handleDeleteSpec = async (specId) => {
    try {
      await deleteItemSpec(id, specId);
      message.success('ลบสเปกสำเร็จ');
      loadSpecs();
    } catch (err) {
      message.error(err.response?.data?.message || 'ลบสเปกไม่สำเร็จ');
    }
  };

  const loadPricingPolicies = async () => {
    if (!id) return;
    setLoadingPolicies(true);
    try {
      const data = await getItemPricingPolicies(id);
      setPricingPolicies(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error('โหลด Pricing Policies ไม่สำเร็จ');
    } finally {
      setLoadingPolicies(false);
    }
  };

  const filteredItemSpecs = itemSpecs.filter(spec => {
    if (!searchSpecText) return true;
    const term = searchSpecText.toLowerCase();
    return (
      (spec.salesSku || '').toLowerCase().includes(term) ||
      (spec.specName || '').toLowerCase().includes(term)
    );
  });

  const handleExportSpecs = () => {
    const header = ['Sales SKU', 'รหัสสเปก', 'ชื่อสเปก', 'ชื่อพื้นผิว', 'ชื่อเกรด', 'Active'];
    const rows = filteredItemSpecs.map(spec => [
      spec.salesSku || '',
      spec.specCode || '',
      spec.specName || '',
      spec.surfaceName || '',
      spec.gradeName || '',
      spec.isActive ? 'Yes' : 'No'
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'item_specs.csv';
    link.click();
  };

  const specColumns = [
    {
      title: '',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          <Popconfirm title="ยืนยันการลบ?" onConfirm={() => handleDeleteSpec(record.itemSpecId)}>
            <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600" />
          </Popconfirm>
          <EditOutlined className="text-slate-600 cursor-pointer hover:text-blue-600" onClick={() => handleOpenSpecModal(record)} />
        </div>
      ),
    },
    { title: 'Sales SKU', dataIndex: 'salesSku', key: 'salesSku' },
    { title: 'รหัสสเปก', dataIndex: 'specCode', key: 'specCode' },
    { title: 'ชื่อสเปก', dataIndex: 'specName', key: 'specName' },
    { title: 'ชื่อพื้นผิว', dataIndex: 'surfaceName', key: 'surfaceName' },
    { title: 'ชื่อเกรด', dataIndex: 'gradeName', key: 'gradeName' },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val) => val ? 'Yes' : 'No'
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/master/items")} style={{ marginRight: "12px" }} />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              {isEdit ? 'แก้ไขข้อมูลสินค้า' : 'สร้างสินค้าใหม่'}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveItem} loading={saving}>
            บันทึกสินค้า
          </Button>
        </div>
      </div>

      <Tabs
        defaultActiveKey="general"
        items={[
          {
            key: 'general',
            label: 'ข้อมูลทั่วไป (General Information)',
            children: (
              <Card loading={loading} className="shadow-sm">
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{ status: 'draft', isActive: true }}
                  className="[&_.ant-form-item-label>label]:text-xs [&_.ant-form-item-label>label]:font-semibold [&_.ant-form-item-label>label]:text-slate-500 [&_.ant-form-item]:mb-4"
                >
                  <Row gutter={32}>
                    {/* Column 1: Core Information */}
                    <Col span={8}>
                      <Form.Item name="code" label="ITEM CODE" rules={[{ required: true }]}>
                        <Input placeholder="MDF-001" disabled={isEdit} />
                      </Form.Item>
                      <Form.Item name="name" label="DISPLAY NAME" rules={[{ required: true }]}>
                        <Input placeholder="แผ่นไม้ MDF" />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="status" label="STATUS">
                            <Select options={[
                              { value: 'draft', label: 'Draft' },
                              { value: 'active', label: 'Active' },
                              { value: 'obsolete', label: 'Obsolete' }
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="isActive" label="ACTIVE" valuePropName="checked">
                            <Switch />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="isLotControlled" label="LOT CONTROL" valuePropName="checked">
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="allowNegativeStock" label="ALLOW NEGATIVE" valuePropName="checked">
                            <Switch />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>

                    {/* Column 2: Categorization & Config */}
                    <Col span={8}>
                      <Form.Item name="itemTypeId" label="ITEM CATEGORY" rules={[{ required: true }]}>
                        <Select options={lookups.itemTypes} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="productTypeId" label="PRODUCT GROUP">
                        <Select options={lookups.productTypes} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="taxCodeId" label="TAX CODE">
                        <Select options={lookups.taxCodes} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="defaultWarehouseId" label="DEFAULT WAREHOUSE">
                        <Select options={lookups.warehouses} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="valuationMethod" label="VALUATION METHOD">
                        <Select options={[
                          { value: 'average', label: 'Average' },
                          { value: 'fifo', label: 'FIFO' },
                          { value: 'standard', label: 'Standard' }
                        ]} />
                      </Form.Item>
                    </Col>

                    {/* Column 3: Dimensions & UOM */}
                    <Col span={8}>
                      <Form.Item name="thicknessId" label="THICKNESS (MM)">
                        <Select options={lookups.thicknesses} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="widthId" label="WIDTH (M)">
                        <Select options={lookups.widths} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="lengthId" label="LENGTH (M)">
                        <Select options={lookups.lengths} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="areaSqm" label="AREA (SQM)">
                        <InputNumber className="w-full" placeholder="0.0000" precision={4} disabled />
                      </Form.Item>
                      <Form.Item name="unitId" label="UNIT OF MEASURE" rules={[{ required: true }]}>
                        <Select options={lookups.units} placeholder="<Type then tab>" showSearch optionFilterProp="label" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Card>
            )
          },
          {
            key: 'specs',
            label: 'สเปกย่อย (Item Specs)',
            children: isEdit ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex w-full md:max-w-[400px]">
                    <Input
                      placeholder="ค้นหา Sales SKU, ชื่อสเปก..."
                      value={searchSpecText}
                      onChange={(e) => setSearchSpecText(e.target.value)}
                      className="rounded-r-none"
                    />
                    <Button type="primary" icon={<SearchOutlined />} className="rounded-l-none" />
                  </div>
                  <Space>
                    <Tooltip title="Export CSV">
                      <Button icon={<FileExcelOutlined />} onClick={handleExportSpecs} />
                    </Tooltip>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenSpecModal()}>
                      เพิ่มสเปก
                    </Button>
                  </Space>
                </div>
                <div className="rounded-lg border border-slate-200">
                  <Table
                    columns={specColumns}
                    dataSource={filteredItemSpecs}
                    rowKey="itemSpecId"
                    loading={loadingSpecs}
                    pagination={false}
                    size="small"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
                กรุณาบันทึกข้อมูลสินค้าหลักก่อนเพื่อเพิ่มสเปกย่อย
              </div>
            )
          },

        ]}
      />

      <ItemSpecModal
        open={specModalOpen}
        initialValues={editingSpec}
        onSave={handleSaveSpec}
        onCancel={() => setSpecModalOpen(false)}
        lookups={lookups}
      />

    </div>
  );
}
