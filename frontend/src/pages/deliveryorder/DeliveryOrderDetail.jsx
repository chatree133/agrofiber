import React, { useEffect, useState } from 'react';
import { ArrowLeftOutlined, CheckCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useDeliveryOrder } from '../../context/DeliveryOrderContext.jsx';
import { useSalesOrder } from '../../context/SalesOrderContext.jsx';
import { useMasterData } from '../../context/MasterDataContext.jsx';

const { Title, Text, Paragraph } = Typography;

export default function DeliveryOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getDeliveryOrderDetail, deliverAndBill, getSalesInvoices, updateDeliveryOrder } = useDeliveryOrder();
  const { getSalesOrderDetail } = useSalesOrder();
  const { lookups, fetchLookups } = useMasterData();

  const [deliveryOrder, setDeliveryOrder] = useState(null);
  const [salesOrder, setSalesOrder] = useState(null);
  const [invoiceId, setInvoiceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  
  // Shipping Edit Modal states
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingForm] = Form.useForm();

  const handleOpenShippingModal = () => {
    shippingForm.setFieldsValue({
      deliveryType: deliveryOrder.deliveryType || 'delivery',
      shipToAddress: deliveryOrder.shipToAddress || '',
    });
    setShippingModalOpen(true);
  };

  const handleSaveShipping = async (values) => {
    setSavingShipping(true);
    try {
      await updateDeliveryOrder(id, {
        deliveryType: values.deliveryType,
        shipToAddress: values.shipToAddress,
      });
      message.success('แก้ไขข้อมูลการจัดส่งสำเร็จ');
      setShippingModalOpen(false);
      fetchDetails();
    } catch (err) {
      message.error('ไม่สามารถบันทึกได้: ' + err.message);
    } finally {
      setSavingShipping(false);
    }
  };

  // Calculation states
  const [subTotal, setSubTotal] = useState(0);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [taxTotal, setTaxTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const doData = await getDeliveryOrderDetail(id);
      setDeliveryOrder(doData);

      if (doData.salesOrderId) {
        const soData = await getSalesOrderDetail(doData.salesOrderId);
        setSalesOrder(soData);
        calculateBilling(doData, soData);
      }

      // Check if invoice already exists for this DO
      const invRes = await getSalesInvoices({ deliveryOrderId: id });
      if (invRes.data?.length > 0) {
        setInvoiceId(invRes.data[0].id);
      }
    } catch (err) {
      message.error('โหลดข้อมูลล้มเหลว: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateBilling = (doData, soData) => {
    if (!doData?.lines || !soData?.lines) return;

    let sub = 0;
    let disc = 0;
    let tax = 0;

    doData.lines.forEach(doLine => {
      const soLine = soData.lines.find(sl => sl.itemId === doLine.itemId);
      if (soLine) {
        const qty = doLine.quantity;
        const price = soLine.unitPrice || 0;

        // Pro-rate discount
        const soQty = soLine.quantity || qty;
        const discPerUnit = (soLine.discountAmount || 0) / soQty;
        const lineDisc = qty * discPerUnit;

        const netAmt = (qty * price) - lineDisc;
        const taxRate = soLine.taxRatePercent || 0;
        const lineTax = (netAmt * taxRate) / 100;

        sub += qty * price;
        disc += lineDisc;
        tax += lineTax;
      }
    });

    const total = (sub - disc) + tax;
    setSubTotal(sub);
    setDiscountTotal(disc);
    setTaxTotal(tax);
    setGrandTotal(total);
    form.setFieldsValue({ amountPaid: total });
  };

  useEffect(() => {
    const doId = Number(id);
    if (isNaN(doId) || doId <= 0) {
      message.error('ไม่พบเลขที่ใบส่งสินค้าที่ระบุ');
      navigate('/deliveryorder/list');
      return;
    }
    fetchDetails();
    fetchLookups();
  }, [id, fetchLookups]);

  const handleDeliverAndBill = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        actualDeliveryDate: values.actualDeliveryDate?.toDate() || new Date(),
        recipientName: values.recipientName,
        signatureUrl: values.signatureUrl || '/uploads/signatures/mock_sig.png',
        photoUrl: values.photoUrl || '/uploads/photos/mock_photo.png',
        remarks: values.remarks,
        paymentMethod: values.paymentMethod,
        amountPaid: values.amountPaid
      };

      await deliverAndBill(id, payload);
      message.success('บันทึกการส่งมอบสินค้าและตั้งหนี้ออกบิลสำเร็จ!');
      setModalOpen(false);
      fetchDetails();
    } catch (err) {
      message.error('บันทึกรายการผิดพลาด: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8">กำลังโหลดข้อมูล...</div>;
  if (!deliveryOrder) return <div className="text-center py-8">ไม่พบข้อมูลใบส่งสินค้า</div>;

  const columns = [
    {
      title: 'ลำดับ',
      dataIndex: 'lineNum',
      key: 'lineNum',
      width: 80,
    },
    {
      title: 'รหัสสินค้า',
      dataIndex: 'itemCode',
      key: 'itemCode',
    },
    {
      title: 'ชื่อสินค้า',
      dataIndex: 'itemName',
      key: 'itemName',
    },
    {
      title: 'จำนวนจัดส่ง',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty, r) => `${qty} ${r.unitCode || 'แผ่น'}`,
    },
  ];

  const paymentMethodOptions = (lookups.paymentTerms || []).map(t => ({
    value: t.value,
    label: t.label
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Space size="middle">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/deliveryorder/list')} />
          <h1 className="text-lg font-semibold text-slate-800">
            ใบส่งสินค้า: {deliveryOrder.documentNo}
          </h1>
        </Space>
        <Space>
          {deliveryOrder.Status === 'closed' ? (
            <>
              <Button
                icon={<PrinterOutlined />}
                onClick={() => window.open(`/document/print?form=DO&docId=${id}`, '_blank')}
              >
                พิมพ์ใบส่งสินค้า (DN)
              </Button>
              {invoiceId && (
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={() => window.open(`/document/print?form=COMBINED&docId=${id}`, '_blank')}
                >
                  พิมพ์ใบกำกับ/ใบเสร็จรวม
                </Button>
              )}
            </>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => setModalOpen(true)}
            >
              บันทึกส่งมอบ & เก็บเงิน (Deliver & Bill)
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="รายการสินค้าที่จัดส่ง" className="shadow-sm">
            <Table
              columns={columns}
              dataSource={deliveryOrder.lines?.map(l => ({ ...l, key: l.lineNum }))}
              pagination={false}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title="ข้อมูลการขนส่งและเอกสาร" 
            className="shadow-sm"
            extra={
              ['draft', 'ready'].includes(deliveryOrder.Status || deliveryOrder.status) && (
                <Button size="small" type="link" onClick={handleOpenShippingModal}>
                  แก้ไขการจัดส่ง
                </Button>
              )
            }
          >
            <div className="flex flex-col gap-3">
              <div>
                <Text type="secondary" style={{ marginRight: 8 }} block>สถานะการส่งสินค้า</Text>
                <Tag color={(deliveryOrder.Status || deliveryOrder.status) === 'closed' || (deliveryOrder.Status || deliveryOrder.status) === 'delivered' ? 'green' : 'orange'} className="mt-1">
                  {((deliveryOrder.Status || deliveryOrder.status) === 'closed' || (deliveryOrder.Status || deliveryOrder.status) === 'delivered') ? 'ส่งมอบและปิดงานแล้ว' : 'รอการส่งมอบ'}
                </Tag>
              </div>
              <div>
                <Text type="secondary" style={{ marginRight: 8 }} block>รูปแบบการจัดส่ง</Text>
                <Tag color={deliveryOrder.deliveryType === 'pickup' ? 'orange' : 'blue'} className="mt-1">
                  {deliveryOrder.deliveryType === 'pickup' ? 'รับที่สาขา' : 'จัดส่งสินค้า'}
                </Tag>
              </div>
              <div>
                <Text type="secondary" style={{ marginRight: 8 }} block>ลูกค้า</Text>
                <Text strong>{deliveryOrder.customerCode} - {deliveryOrder.customerName}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ marginRight: 8 }} block>อ้างอิงใบสั่งขาย</Text>
                <Text strong>{deliveryOrder.salesOrderNo || '-'}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ marginRight: 8 }} block>ที่อยู่สำหรับจัดส่ง</Text>
                <Paragraph style={{ margin: 0 }}>{deliveryOrder.shipToAddress || '-'}</Paragraph>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="บันทึกหลักฐานส่งมอบสินค้า & ชำระเงิน (Proof of Delivery & COD)"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleDeliverAndBill}
          initialValues={{
            actualDeliveryDate: null,
            paymentMethod: undefined
          }}
        >
          <div className="bg-slate-50 p-4 rounded-lg mb-4">
            <Title level={5} style={{ margin: 0, color: '#1e293b' }}>ยอดคำนวณบิลเรียกเก็บเงิน</Title>
            <Row className="mt-2" gutter={[16, 8]}>
              <Col span={12}><Text type="secondary">มูลค่าสินค้า:</Text></Col>
              <Col span={12} className="text-right"><Text strong>{subTotal.toLocaleString()} THB</Text></Col>
              <Col span={12}><Text type="secondary">ส่วนลด:</Text></Col>
              <Col span={12} className="text-right"><Text type="danger">-{discountTotal.toLocaleString()} THB</Text></Col>
              <Col span={12}><Text type="secondary">ภาษีมูลค่าเพิ่ม (VAT 7%):</Text></Col>
              <Col span={12} className="text-right"><Text strong>{taxTotal.toLocaleString()} THB</Text></Col>
              <Col span={24} className="border-t border-slate-200 my-1"></Col>
              <Col span={12}><Text strong style={{ fontSize: '16px' }}>ยอดรวมสุทธิ:</Text></Col>
              <Col span={12} className="text-right"><Text strong style={{ fontSize: '18px', color: '#16a34a' }}>{grandTotal.toLocaleString()} THB</Text></Col>
            </Row>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="วันที่ส่งมอบของจริง"
                name="actualDeliveryDate"
                rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="ชื่อผู้รับของปลายทาง"
                name="recipientName"
                rules={[{ required: true, message: 'กรุณากรอกชื่อผู้รับ' }]}
              >
                <Input placeholder="ชื่อผู้เซ็นรับสินค้า" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="วิธีการชำระเงิน"
                name="paymentMethod"
                rules={[{ required: true, message: 'กรุณาเลือกวิธีการชำระเงิน' }]}
              >
                <Select
                  // defaultValue={"CASH"}
                  placeholder="เลือกเงื่อนไข/วิธีชำระเงิน"
                  options={paymentMethodOptions}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="ยอดเงินชำระจริงหน้างาน"
                name="amountPaid"
                rules={[{ required: true, message: 'กรุณากรอกยอดเงิน' }]}
              >
                <InputNumber min={0} className="w-full" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\$\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="ภาพถ่ายลายเซ็น (จำลอง URL)" name="signatureUrl">
            <Input placeholder="/uploads/signatures/sign_do1.png" />
          </Form.Item>

          <Form.Item label="ภาพถ่ายสินค้าส่งมอบสำเร็จ (จำลอง URL)" name="photoUrl">
            <Input placeholder="/uploads/photos/delivered_do1.png" />
          </Form.Item>

          <Form.Item label="หมายเหตุ (Remarks)" name="remarks">
            <Input.TextArea placeholder="ระบุเงื่อนไขหรือการปฏิเสธของบางส่วน (ถ้ามี)" rows={2} />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setModalOpen(false)}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              ยืนยันจัดส่ง & พิมพ์เอกสารทั้งหมด
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Edit Shipping Details Modal */}
      <Modal
        title="แก้ไขรายละเอียดและช่องทางจัดส่ง"
        open={shippingModalOpen}
        onCancel={() => !savingShipping && setShippingModalOpen(false)}
        footer={null}
        width={450}
      >
        <Form
          form={shippingForm}
          layout="vertical"
          onFinish={handleSaveShipping}
        >
          <Form.Item
            name="deliveryType"
            label="รูปแบบการจัดส่ง/รับสินค้า"
            rules={[{ required: true, message: 'กรุณาเลือกรูปแบบจัดส่ง' }]}
          >
            <Select placeholder="เลือกรูปแบบการจัดส่ง">
              <Select.Option value="delivery">จัดส่งสินค้า (Delivery)</Select.Option>
              <Select.Option value="pickup">รับสินค้าที่สาขา (Branch Pickup)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="shipToAddress"
            label="ที่อยู่สำหรับจัดส่ง"
          >
            <Input.TextArea rows={4} placeholder="ป้อนที่อยู่จัดส่ง..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setShippingModalOpen(false)} disabled={savingShipping}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={savingShipping}>
              บันทึกข้อมูล
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
