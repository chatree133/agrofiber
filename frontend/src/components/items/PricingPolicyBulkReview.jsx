import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Tooltip, Button, Input, Modal, message, Alert } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useItem } from '../../context/ItemContext.jsx';
import { useWorkflow } from '../../context/WorkflowContext.jsx';

const { TextArea } = Input;

export default function PricingPolicyBulkReview({
  versionNo,
  requestId,
  onClose,
  onActionSuccess,
}) {
  const { getItemPricingPoliciesByVersionNo } = useItem();
  const { executeApprovalAction } = useWorkflow();

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load version policies
  const loadPolicies = async () => {
    setLoading(true);
    try {
      const data = await getItemPricingPoliciesByVersionNo(versionNo);
      setPolicies(data || []);
    } catch (err) {
      console.error('Failed to load version pricing policies', err);
      message.error('โหลดข้อมูล Pricing Policies ใน Batch ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (versionNo) {
      loadPolicies();
    }
  }, [versionNo]);

  // Warning metrics aggregated from backend validations
  const warningsSummary = useMemo(() => {
    let costViolations = 0;
    let marginViolations = 0;
    let belowRecommendedViolations = 0;

    policies.forEach((p) => {
      if (p.isBelowCost) costViolations++;
      if (p.isBelowMinMargin) marginViolations++;
      if (p.isBelowRecommended) belowRecommendedViolations++;
    });

    return {
      costViolations,
      marginViolations,
      belowRecommendedViolations,
      totalViolations: costViolations + marginViolations + belowRecommendedViolations,
    };
  }, [policies]);

  const handleAction = (action) => {
    const isApprove = action === 'approved';
    const text = isApprove ? 'อนุมัติ (Approve & Publish)' : 'ปฏิเสธคำขอ (Reject)';
    const color = isApprove ? '#389e0d' : '#d4380d';

    Modal.confirm({
      title: `ยืนยันการ${text}?`,
      content: (
        <div className="space-y-2 mt-2">
          {isApprove && warningsSummary.totalViolations > 0 && (
            <Alert
              type="warning"
              showIcon
              message={
                <span>
                  พบรายการราคาที่เสี่ยงหรือต่ำกว่าเกณฑ์ <strong>{warningsSummary.totalViolations} รายการ</strong>. 
                  การอนุมัติจะทำการ Publish ราคาพิเศษเหล่านี้เพื่อใช้งานจริงทันที
                </span>
              }
              style={{ marginBottom: '12px' }}
            />
          )}
          <p>คุณแน่ใจหรือไม่ว่าต้องการดำเนินการ{text} สำหรับ Batch อ้างอิง <strong>{versionNo}</strong>?</p>
        </div>
      ),
      okText: isApprove ? 'อนุมัติและใช้งาน' : 'ปฏิเสธคำขอ',
      okButtonProps: { style: { backgroundColor: color, borderColor: color } },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        setSubmitting(true);
        try {
          await executeApprovalAction(requestId, action, comments);
          message.success(`${isApprove ? 'อนุมัติ' : 'ปฏิเสธ'}การกำหนดราคาสำหรับ Batch ${versionNo} เรียบร้อยแล้ว`);
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

  const columns = [
    {
      title: 'รหัสสินค้า (SKU)',
      dataIndex: 'salesSku',
      key: 'salesSku',
      width: 280,
      render: (val, record) => <span style={{ fontWeight: 'bold' }}>{val || record.itemCode}</span>,
    },
    {
      title: 'ชื่อสินค้า',
      dataIndex: 'itemName',
      key: 'itemName',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'วิธีการกำหนดราคา',
      dataIndex: 'pricingMethodName',
      key: 'pricingMethodName',
      width: 150,
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'หน่วยนับ',
      dataIndex: 'unitCode',
      key: 'unitCode',
      width: 100,
      render: (val) => val ? <Tag color="purple">{val}</Tag> : '-',
    },
    {
      title: 'ราคาทุนมาตรฐาน',
      dataIndex: 'standardCost',
      key: 'standardCost',
      width: 140,
      align: 'right',
      render: (val) => val.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'ราคาเสนอขาย',
      dataIndex: 'standardPrice',
      key: 'standardPrice',
      width: 180,
      align: 'right',
      render: (val, record) => {
        const standardPrice = Number(val || 0);
        const proposedPrice = Number(record.proposedPrice || 0);
        if (record.isBelowRecommended) {
          return (
            <Tooltip title={`ราคาเสนอขาย (${standardPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}) ต่ำกว่าราคาควรขาย (${proposedPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })})`}>
              <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                {standardPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ({proposedPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })})
              </span>
            </Tooltip>
          );
        }
        return standardPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 });
      },
    },
    {
      title: 'ราคาควรขาย',
      dataIndex: 'proposedPrice',
      key: 'proposedPrice',
      width: 140,
      align: 'right',
      render: (val) => {
        const proposedPrice = Number(val || 0);
        return <span style={{ fontWeight: 'bold', color: '#0d9488' }}>{proposedPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>;
      },
    },
    {
      title: 'Min Margin %',
      dataIndex: 'minMarginPercent',
      key: 'minMarginPercent',
      width: 150,
      align: 'right',
      render: (val) => val !== null ? `${val.toFixed(2)}%` : '-',
    },
    {
      title: 'Target Margin %',
      dataIndex: 'targetMarginPercent',
      key: 'targetMargin',
      width: 150,
      align: 'right',
      render: (val) => val !== null ? `${val.toFixed(2)}%` : '-',
    },
    {
      title: 'Min Markup %',
      dataIndex: 'minMarkupPercent',
      key: 'minMarkupPercent',
      width: 150,
      align: 'right',
      render: (val) => val !== null ? `${val.toFixed(2)}%` : '-',
    },
    {
      title: 'Target Markup %',
      dataIndex: 'targetMarkupPercent',
      key: 'targetMarkup',
      width: 150,
      align: 'right',
      render: (val) => val !== null ? `${val.toFixed(2)}%` : '-',
    },
    {
      title: 'สถานะตรวจสอบ',
      key: 'warningStatus',
      width: 150,
      align: 'center',
      render: (_, record) => {
        if (!record.hasWarning) {
          return <Tag color="success">ผ่านเกณฑ์</Tag>;
        }
        return (
          <Tooltip title={record.warningTooltip || 'ราคาเสนอมีคำเตือนการตรวจสอบ'}>
            <Tag color="error" icon={<ExclamationCircleOutlined />}>
              {record.warningLabel || 'ต่ำกว่าเกณฑ์'}
            </Tag>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {warningsSummary.totalViolations > 0 ? (
        <Alert
          type="error"
          showIcon
          message={
            <span>
              พบรายการราคาต่ำกว่าราคาทุน อัตรากำไรขั้นต่ำ หรือต่ำกว่าราคาควรขายจำนวน <strong>{warningsSummary.totalViolations} รายการ</strong> (แสดงแถวไฮไลท์สีแดงระเรื่อในตาราง)
            </span>
          }
        />
      ) : (
        <Alert type="success" showIcon message="ผ่านเกณฑ์การตรวจสอบราคาทุน อัตรากำไรขั้นต่ำ และราคาควรขายทั้งหมดทุกรายการ" />
      )}

      {/* Grid Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table
          columns={columns}
          dataSource={policies}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10 }}
          rowClassName={(record) => {
            return record.hasWarning ? 'bg-red-50 hover:bg-red-100 transition-colors' : '';
          }}
          scroll={{ x: 'max-content', y: 400 }}
        />
      </div>

      {/* Review Remarks */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">ความคิดเห็นประกอบการพิจารณา (Approval Remarks)</h4>
        <TextArea
          rows={3}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="ระบุเหตุผลประกอบการอนุมัติ หรือปฏิเสธ เช่น 'อนุมัติราคาพิเศษสำหรับแคมเปญงานจัดแสดงสินค้าประจำปี'..."
          disabled={submitting}
        />
        <div className="flex justify-end gap-2 pt-2">
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
            อนุมัติและเผยแพร่ราคา
          </Button>
        </div>
      </div>
    </div>
  );
}
