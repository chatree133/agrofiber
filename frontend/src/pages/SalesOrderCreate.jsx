import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Table } from 'antd';

const items = [
  { key: 1, sku: 'FG-PAPER-A4-80', name: 'Double A A4 80gsm', qty: 100, unit: 'รีม' },
  { key: 2, sku: 'FG-PALLET-001', name: 'Paper pallet export', qty: 12, unit: 'พาเลท' },
];

export default function SalesOrderCreate() {
  return (
    <div className="space-y-4">
      <Card title="สร้างใบสั่งขาย" size="small">
        <Form layout="vertical" size="small">
          <Row gutter={[16, 4]}>
            <Col xs={24} md={8}>
              <Form.Item label="ลูกค้า">
                <Select
                  defaultValue="advance-agro"
                  options={[
                    { value: 'advance-agro', label: 'Advance Agro Public Co., Ltd.' },
                    { value: 'double-a', label: 'Double A Paper' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="วันที่เอกสาร">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="เลขที่อ้างอิง">
                <Input placeholder="REF-0001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 4]}>
            <Col xs={24} md={12}>
              <Form.Item label="ที่อยู่จัดส่ง">
                <Input.TextArea rows={2} defaultValue="123 Industrial Estate, Prachinburi" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="หมายเหตุ">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="รายการสินค้า"
        size="small"
        extra={
          <Button type="primary">
            เพิ่มสินค้า
          </Button>
        }
      >
        <Table
          size="small"
          pagination={false}
          dataSource={items}
          columns={[
            { title: 'รหัสสินค้า', dataIndex: 'sku' },
            { title: 'ชื่อสินค้า', dataIndex: 'name' },
            {
              title: 'จำนวน',
              dataIndex: 'qty',
              render: (value) => <InputNumber min={1} defaultValue={value} size="small" />,
            },
            { title: 'หน่วย', dataIndex: 'unit' },
          ]}
        />
      </Card>

      <div className="flex justify-end gap-2">
        <Button>บันทึกร่าง</Button>
        <Button type="primary">บันทึกใบสั่งขาย</Button>
      </div>
    </div>
  );
}
