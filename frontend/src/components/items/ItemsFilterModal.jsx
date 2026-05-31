import { DatePicker, Form, Modal, Select } from 'antd';

const { RangePicker } = DatePicker;

export default function ItemsFilterModal({ open, form, productTypeOptions, widthOptions, lengthOptions, surfaceOptions, gradeOptions, thicknessOptions, initialValues, onCancel, onSubmit }) {
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
        <Form.Item name="productTypeId" label="ชนิดสินค้า (Product Type)">
          <Select allowClear options={productTypeOptions} />
        </Form.Item>
        <Form.Item name="thicknessId" label="ความหนา (Thickness)">
          <Select allowClear options={thicknessOptions} />
        </Form.Item>
        <Form.Item name="widthId" label="ความกว้าง (Width)">
          <Select allowClear options={widthOptions} />
        </Form.Item>
        <Form.Item name="lengthId" label="ความยาว (Length)">
          <Select allowClear options={lengthOptions} />
        </Form.Item>
        <Form.Item name="surfaceId" label="พื้นผิว (Surface)">
          <Select allowClear options={surfaceOptions} />
        </Form.Item>
        <Form.Item name="gradeId" label="เกรด (Grade)">
          <Select allowClear options={gradeOptions} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
