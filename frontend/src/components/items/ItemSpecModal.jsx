import { AutoComplete, Col, Form, Input, Modal, Row, Select, Switch } from 'antd';
import { useEffect } from 'react';

export default function ItemSpecModal({ open, initialValues, onSave, onCancel, confirmLoading, lookups }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.resetFields();
        form.setFieldsValue({ isActive: true });
      }
    }
  }, [open, initialValues, form]);

  const surfaceOptions = (lookups?.surfaces || []).map(s => ({
    value: s.label,
    label: s.label
  }));

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSave(values);
    } catch (err) {
      // Validation failed or save failed
    }
  };

  return (
    <Modal
      title={initialValues ? 'แก้ไขสเปกย่อย (Edit Item Spec)' : 'เพิ่มสเปกใหม่ (Add Item Spec)'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      destroyOnClose
      width={800}
    >
      <Form
        form={form}
        layout="vertical"
        className="[&_.ant-form-item-label>label]:text-xs [&_.ant-form-item-label>label]:font-semibold [&_.ant-form-item-label>label]:text-slate-500 [&_.ant-form-item]:mb-4 mt-4"
      >
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item name="salesSku" label="SALES SKU" rules={[{ required: true }]}>
              <Input placeholder="MDF-A-SMOOTH" />
            </Form.Item>
            <Form.Item name="isActive" label="ACTIVE" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="specCode" label="SPEC CODE">
              <Input placeholder="รหัสสเปก" />
            </Form.Item>
            <Form.Item name="specName" label="SPEC NAME">
              <Input placeholder="ชื่อสเปก" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="surfaceName" label="SURFACE NAME">
              <AutoComplete
                options={surfaceOptions}
                placeholder="พิมพ์หรือเลือกชื่อพื้นผิว"
                filterOption={(inputValue, option) =>
                  option.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                }
              />
            </Form.Item>
            <Form.Item name="gradeId" label="GRADE">
              <Select
                options={lookups?.grades || []}
                placeholder="เลือกเกรด"
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
