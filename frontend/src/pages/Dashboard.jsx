import { Card, Col, Row, Statistic, Table, Tag } from 'antd';

const documents = [
  { key: 1, code: 'SO-2026-0001', type: 'ใบสั่งขาย', customer: 'Advance Agro', status: 'เปิดเอกสาร' },
  { key: 2, code: 'PO-2026-0018', type: 'ใบสั่งซื้อ', customer: 'Double A Paper', status: 'รออนุมัติ' },
  { key: 3, code: 'DO-2026-0009', type: 'ใบส่งสินค้า', customer: 'Agrofiber', status: 'กำลังจัดส่ง' },
];

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="Sales Order" value={128} suffix="รายการ" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="Stock Available" value={8430} suffix="หน่วย" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="WMS Tasks" value={37} suffix="งาน" />
          </Card>
        </Col>
      </Row>

      <Card title="เอกสารล่าสุด" size="small">
        <Table
          size="small"
          pagination={false}
          dataSource={documents}
          columns={[
            { title: 'เลขที่เอกสาร', dataIndex: 'code' },
            { title: 'ประเภท', dataIndex: 'type' },
            { title: 'คู่ค้า', dataIndex: 'customer' },
            {
              title: 'สถานะ',
              dataIndex: 'status',
              render: (status) => <Tag color="blue">{status}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
