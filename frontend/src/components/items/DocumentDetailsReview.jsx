import { useEffect, useState } from 'react';
import { Table, Descriptions, Card, Button, Input, Modal, message, Row, Col, Typography, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuotation } from '../../context/QuotationContext.jsx';
import { useSalesOrder } from '../../context/SalesOrderContext.jsx';
import { useWorkflow } from '../../context/WorkflowContext.jsx';

const { Text, Title } = Typography;
const { TextArea } = Input;

export default function DocumentDetailsReview({
  documentType,
  documentId,
  requestId,
  onClose,
  onActionSuccess,
}) {
  const { getQuotationDetail } = useQuotation();
  const { getSalesOrderDetail } = useSalesOrder();
  const { executeApprovalAction } = useWorkflow();

  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch document details based on type (QT or SO)
  const loadDocumentDetails = async () => {
    setLoading(true);
    try {
      let data = null;
      if (documentType === 'QT') {
        data = await getQuotationDetail(documentId);
      } else if (documentType === 'SO') {
        data = await getSalesOrderDetail(documentId);
      }
      setDocData(data);
    } catch (err) {
      console.error(`Failed to load document details for ${documentType} id ${documentId}`, err);
      message.error(`โหลดรายละเอียดของเอกสารอ้างอิงไม่สำเร็จ`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentType && documentId) {
      loadDocumentDetails();
    }
  }, [documentType, documentId]);

  const handleAction = (action) => {
    const isApprove = action === 'approved';
    const text = isApprove ? 'อนุมัติเอกสาร (Approve)' : 'ปฏิเสธคำขอ (Reject)';
    const color = isApprove ? '#389e0d' : '#d4380d';

    Modal.confirm({
      title: `ยืนยันการ${text}?`,
      content: `คุณแน่ใจหรือไม่ว่าต้องการดำเนินการ${text} สำหรับเอกสารเลขที่ ${docData?.DocumentNo || documentId}?`,
      okText: isApprove ? 'อนุมัติเอกสาร' : 'ปฏิเสธเอกสาร',
      okButtonProps: { style: { backgroundColor: color, borderColor: color } },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        setSubmitting(true);
        try {
          await executeApprovalAction(requestId, action, comments);
          message.success(`${isApprove ? 'อนุมัติ' : 'ปฏิเสธ'}เอกสารเลขที่ ${docData?.DocumentNo || documentId} เรียบร้อยแล้ว`);
          onActionSuccess();
          onClose();
        } catch (err) {
          console.error(`Failed to submit approval action for request ${requestId}`, err);
          message.error(err.message || 'ดำเนินการอนุมัติล้มเหลว');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">กำลังโหลดรายละเอียดเอกสาร...</div>;
  }

  if (!docData) {
    return <div className="text-center py-8 text-red-500">ไม่พบข้อมูลรายละเอียดเอกสาร</div>;
  }

  // Define table columns for detail items
  const columns = [
    {
      title: 'รายการบรรทัด',
      dataIndex: 'LineNum',
      key: 'LineNum',
      width: 100,
      align: 'center',
    },
    {
      title: 'รหัสสินค้า (SKU)',
      key: 'skuCode',
      width: 150,
      render: (_, record) => record.SalesSKU || record.ItemCode || '-',
    },
    {
      title: 'ชื่อสินค้า / รายละเอียด',
      key: 'itemName',
      width: 250,
      render: (_, record) => record.SpecName ? `${record.ItemName} - ${record.SpecName}` : record.ItemName,
    },
    {
      title: 'จำนวน',
      dataIndex: 'Quantity',
      key: 'Quantity',
      width: 100,
      align: 'right',
      render: (val) => val.toLocaleString(),
    },
    {
      title: 'หน่วย',
      dataIndex: 'UnitCode',
      key: 'UnitCode',
      width: 100,
      align: 'center',
    },
    {
      title: 'ราคาต่อหน่วย',
      dataIndex: 'UnitPrice',
      key: 'UnitPrice',
      width: 140,
      align: 'right',
      render: (val) => val.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'ส่วนลด (%)',
      dataIndex: 'DiscountPercent',
      key: 'DiscountPercent',
      width: 120,
      align: 'right',
      render: (val) => val ? `${val.toFixed(2)}%` : '-',
    },
    {
      title: 'จำนวนเงิน',
      dataIndex: 'LineAmount',
      key: 'LineAmount',
      width: 140,
      align: 'right',
      render: (val) => val.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Descriptions card */}
      <Card size="small" title={<span style={{ color: '#1a3353', fontWeight: 'bold' }}>ข้อมูลทั่วไปของเอกสาร</span>}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
          <Descriptions.Item label="เลขที่เอกสาร">{docData.DocumentNo}</Descriptions.Item>
          <Descriptions.Item label="วันที่เอกสาร">{dayjs(docData.DocumentDate).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="สถานะปัจจุบัน">
            <Tag color={docData.Status === 'approved' ? 'success' : 'processing'}>{docData.Status?.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="รหัสลูกค้า">{docData.CustomerCode}</Descriptions.Item>
          <Descriptions.Item label="ชื่อลูกค้า" span={2}>{docData.CustomerName}</Descriptions.Item>
          <Descriptions.Item label="ประเภทภาษี">{docData.TaxType?.toUpperCase()}</Descriptions.Item>
          <Descriptions.Item label="สกุลเงิน">{docData.CurrencyCode || 'THB'}</Descriptions.Item>
          <Descriptions.Item label="หมายเหตุ">{docData.Remarks || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Lines Grid */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table
          columns={columns}
          dataSource={docData.lines || []}
          rowKey={(record) => `line-${record.LineNum}`}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content', y: 300 }}
        />
      </div>

      {/* Totals & Remarks */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 h-full">
            <h4 className="text-sm font-semibold text-slate-800">ความคิดเห็นประกอบการพิจารณา (Approval Remarks)</h4>
            <TextArea
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="ระบุความคิดเห็นในการอนุมัติ หรือเหตุผลการปฏิเสธใบเสนอราคา / ใบสั่งขายนี้..."
              disabled={submitting}
            />
          </div>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="สรุปมูลค่าท้ายบิล" className="h-full">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <Text type="secondary">รวมเงิน (Subtotal)</Text>
                <Text strong>{(docData.SubTotalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">ส่วนลดท้ายบิล (Discount)</Text>
                <Text strong style={{ color: '#ff4d4f' }}>-{(docData.DiscountAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">ภาษีมูลค่าเพิ่ม (VAT 7%)</Text>
                <Text strong>{(docData.TaxAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-base">
                <Text style={{ color: '#1a3353' }}>จำนวนเงินสุทธิ (Grand Total)</Text>
                <Text style={{ color: '#0d9488' }}>{(docData.GrandTotalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleAction('rejected')}
                loading={submitting}
              >
                ปฏิเสธคำขอ
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ backgroundColor: '#389e0d', borderColor: '#389e0d' }}
                onClick={() => handleAction('approved')}
                loading={submitting}
              >
                อนุมัติเอกสาร
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
