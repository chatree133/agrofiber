import { DatePicker, Form, Modal, Select } from 'antd';

const { RangePicker } = DatePicker;

const statusOptions = [
  { value: 'draft', label: 'ร่าง (Draft)' },
  { value: 'requested', label: 'รออนุมัติ (Requested)' },
  { value: 'approved', label: 'อนุมัติ (Approved)' },
  { value: 'rejected', label: 'ไม่อนุมัติ (Rejected)' },
  { value: 'closed', label: 'ปิดเอกสาร (Closed)' },
];

export default function QuotationsFilterModal({
  open,
  form,
  initialValues,
  onCancel,
  onSubmit,
}) {
  return (
    <Modal
      title="กรองข้อมูลใบเสนอราคา (Filter Quotations)"
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
      okText="กรองข้อมูล"
      cancelText="ยกเลิก"
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="dateRange" label="ช่วงวันที่เอกสาร (Document Date Range)">
          <RangePicker
            placeholder={['เริ่มวันที่', 'ถึงวันที่']}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="status" label="สถานะเอกสาร (Document Status)">
          <Select
            allowClear
            placeholder="เลือกสถานะ..."
            options={statusOptions}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
