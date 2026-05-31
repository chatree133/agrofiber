import { DatePicker, Form, Modal, Select } from 'antd';

const { RangePicker } = DatePicker;

export default function UserFilterModal({ open, form, roleOptions, initialValues, onCancel, onSubmit }) {
  return (
    <Modal
      title="Filter"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      forceRender
      afterOpenChange={(visible) => {
        if (!visible) return;
        form.resetFields();
        form.setFieldsValue(initialValues);
      }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="createdAt" label="Created At">
          <RangePicker className="w-full" />
        </Form.Item>
        <Form.Item name="roleIds" label="Role">
          <Select mode="multiple" allowClear options={roleOptions} />
        </Form.Item>
        <Form.Item name="isActive" label="Is Active">
          <Select
            allowClear
            options={[
              { value: true, label: 'Active' },
              { value: false, label: 'Inactive' },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
