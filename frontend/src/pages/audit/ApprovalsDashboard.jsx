import { useState, useEffect, useMemo } from 'react';
import { Table, Card, Typography, Tabs, Select, Space, Button, Badge, Modal, Tag, Alert, Row, Col, Statistic, Tooltip } from 'antd';
import { AuditOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkflow } from '../../context/WorkflowContext.jsx';
import PricingPolicyBulkReview from '../../components/items/PricingPolicyBulkReview.jsx';
import DocumentDetailsReview from '../../components/items/DocumentDetailsReview.jsx';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ApprovalsDashboard() {
  const { getApprovalRequests } = useWorkflow();

  // State variables
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  
  // Review Modal State
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  // Load request list
  const loadRequests = async () => {
    setLoading(true);
    try {
      // Determine backend status parameter based on tab
      const statusParam = activeTab === 'pending' ? 'pending' : 'all';
      const params = {};
      if (statusParam !== 'all') {
        params.status = statusParam;
      }
      if (docTypeFilter !== 'ALL') {
        params.documentType = docTypeFilter;
      }

      const res = await getApprovalRequests(params);
      const rows = res?.data || [];
      setRequests(rows);

      // Fetch overview statistics by requesting 'all' (once or during refresh)
      const allRes = await getApprovalRequests({ status: 'all' });
      const allRows = allRes?.data || [];
      
      const counts = { pending: 0, approved: 0, rejected: 0 };
      allRows.forEach(row => {
        if (row.status === 'pending') counts.pending++;
        else if (row.status === 'approved') counts.approved++;
        else if (row.status === 'rejected') counts.rejected++;
      });
      setStats(counts);
    } catch (err) {
      console.error('Failed to fetch approval requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [activeTab, docTypeFilter]);

  const handleOpenReview = (record) => {
    setSelectedRequest(record);
    setReviewOpen(true);
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
    setReviewOpen(false);
  };

  // Helper to map document types to beautiful tags/labels
  const renderDocType = (type) => {
    switch (type) {
      case 'QT':
        return <Tag color="blue" style={{ borderRadius: '6px', fontWeight: 500 }}>ใบเสนอราคา (QT)</Tag>;
      case 'SO':
        return <Tag color="cyan" style={{ borderRadius: '6px', fontWeight: 500 }}>ใบสั่งขาย (SO)</Tag>;
      case 'ITEM_PRICING_POLICY_BULK':
        return <Tag color="purple" style={{ borderRadius: '6px', fontWeight: 500 }}>ราคาโครงสร้าง (Pricing Batch)</Tag>;
      case 'PRICE_LIST':
        return <Tag color="geekblue" style={{ borderRadius: '6px', fontWeight: 500 }}>รายการราคาขาย (Price List)</Tag>;
      case 'PRICE_CONTRACT':
        return <Tag color="magenta" style={{ borderRadius: '6px', fontWeight: 500 }}>ราคาพิเศษสัญญา (Price Contract)</Tag>;
      default:
        return <Tag color="default" style={{ borderRadius: '6px', fontWeight: 500 }}>{type}</Tag>;
    }
  };

  // Helper to map status to tags
  const renderStatus = (status) => {
    switch (status) {
      case 'pending':
        return (
          <Tag color="warning" icon={<SyncOutlined spin />} style={{ borderRadius: '6px', fontWeight: 600 }}>
            รอการอนุมัติ
          </Tag>
        );
      case 'approved':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: '6px', fontWeight: 600 }}>
            อนุมัติแล้ว
          </Tag>
        );
      case 'rejected':
        return (
          <Tag color="error" icon={<CloseCircleOutlined />} style={{ borderRadius: '6px', fontWeight: 600 }}>
            ปฏิเสธแล้ว
          </Tag>
        );
      default:
        return <Tag style={{ borderRadius: '6px', fontWeight: 600 }}>{status?.toUpperCase()}</Tag>;
    }
  };

  // Columns definition
  const columns = [
    {
      title: 'เลขที่คำขอ',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      align: 'center',
      render: (val) => <Text strong style={{ color: '#475569' }}>#{val}</Text>,
    },
    {
      title: 'ประเภทเอกสาร',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 220,
      render: (val) => renderDocType(val),
    },
    {
      title: 'เลขที่เอกสารอ้างอิง',
      dataIndex: 'documentNo',
      key: 'documentNo',
      width: 180,
      render: (val, record) => (
        <Tooltip title={`Document ID: ${record.documentId}`}>
          <Text strong style={{ color: '#0f172a' }}>{val || record.documentId}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'ผู้เสนอขออนุมัติ',
      dataIndex: 'requesterName',
      key: 'requesterName',
      width: 180,
      render: (val, record) => (
        <div>
          <Text block style={{ fontWeight: 500, color: '#334155' }}>{val || '-'}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>ID: {record.requestedBy}</Text>
        </div>
      ),
    },
    {
      title: 'วันที่เสนอขอ',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      width: 180,
      render: (val) => (
        <div>
          <Text block style={{ fontSize: '13px', color: '#475569' }}>{dayjs(val).format('DD/MM/YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>{dayjs(val).format('HH:mm น.')}</Text>
        </div>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      align: 'center',
      render: (val) => renderStatus(val),
    },
    {
      title: 'รายละเอียดคำขอ',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      minWidth: 200,
      render: (val) => <Text type="secondary" style={{ fontSize: '13px' }}>{val || '-'}</Text>,
    },
    {
      title: 'การจัดการ',
      key: 'actions',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const isPending = record.status === 'pending';
        return (
          <Button
            type={isPending ? 'primary' : 'default'}
            icon={<EyeOutlined />}
            size="small"
            style={
              isPending 
                ? { backgroundColor: '#0d9488', borderColor: '#0d9488', borderRadius: '6px' }
                : { borderRadius: '6px' }
            }
            onClick={() => handleOpenReview(record)}
          >
            {isPending ? 'รีวิว' : 'ดูรายละเอียด'}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <AuditOutlined style={{ fontSize: '24px' }} />
            </div>
            <div>
              <Title level={2} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
                ศูนย์อนุมัติเอกสารกลาง (Centralized Approval Center)
              </Title>
              <Text type="secondary">
                จัดการคำขออนุมัติใบเสนอราคา ใบสั่งขาย และการเผยแพร่ราคาพิเศษโครงสร้างของระบบ Agrofiber
              </Text>
            </div>
          </div>
        </div>
        <div>
          <Button 
            icon={<SyncOutlined />} 
            onClick={loadRequests} 
            loading={loading}
            style={{ borderRadius: '6px' }}
          >
            รีเฟรชข้อมูล
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card 
            bordered={false} 
            className="shadow-sm border border-slate-100" 
            style={{ borderRadius: '12px', background: 'linear-gradient(to right, #fffdfa, #fffbeb)' }}
          >
            <Statistic
              title={<span className="text-slate-500 font-medium text-sm">รอดำเนินการ (Pending Requests)</span>}
              value={stats.pending}
              valueStyle={{ color: '#d97706', fontWeight: 800, fontSize: '28px' }}
              prefix={<SyncOutlined className="mr-2 animate-spin text-amber-500" style={{ fontSize: '20px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            bordered={false} 
            className="shadow-sm border border-slate-100" 
            style={{ borderRadius: '12px', background: 'linear-gradient(to right, #f0fdf4, #dcfce7)' }}
          >
            <Statistic
              title={<span className="text-slate-500 font-medium text-sm">อนุมัติแล้ว (Approved Requests)</span>}
              value={stats.approved}
              valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: '28px' }}
              prefix={<CheckCircleOutlined className="mr-2 text-emerald-500" style={{ fontSize: '20px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            bordered={false} 
            className="shadow-sm border border-slate-100" 
            style={{ borderRadius: '12px', background: 'linear-gradient(to right, #fef2f2, #fee2e2)' }}
          >
            <Statistic
              title={<span className="text-slate-500 font-medium text-sm">ปฏิเสธแล้ว (Rejected Requests)</span>}
              value={stats.rejected}
              valueStyle={{ color: '#dc2626', fontWeight: 800, fontSize: '28px' }}
              prefix={<CloseCircleOutlined className="mr-2 text-rose-500" style={{ fontSize: '20px' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Controls & Grid Area */}
      <Card 
        bordered={false} 
        className="shadow-sm border border-slate-100" 
        style={{ borderRadius: '12px' }}
        styles={{ body: { padding: '20px' } }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            style={{ marginBottom: 0 }}
            items={[
              {
                key: 'pending',
                label: (
                  <span className="font-semibold text-sm">
                    รายการที่รอรีวิว <Badge count={stats.pending} offset={[8, -4]} size="small" style={{ backgroundColor: '#d97706' }} />
                  </span>
                ),
              },
              {
                key: 'history',
                label: (
                  <span className="font-semibold text-sm">
                    ประวัติการพิจารณาอนุมัติ
                  </span>
                ),
              },
            ]}
          />

          <Space size="middle" className="self-end md:self-auto">
            <span className="text-slate-500 text-sm font-medium">ประเภทเอกสาร:</span>
            <Select
              value={docTypeFilter}
              onChange={(val) => setDocTypeFilter(val)}
              style={{ width: 220 }}
              dropdownStyle={{ borderRadius: '8px' }}
            >
              <Option value="ALL">ทั้งหมด (All Documents)</Option>
              <Option value="QT">ใบเสนอราคา (QT)</Option>
              <Option value="SO">ใบสั่งขาย (SO)</Option>
              <Option value="ITEM_PRICING_POLICY_BULK">ราคาโครงสร้าง (Item Pricing Batch)</Option>
            </Select>
          </Space>
        </div>

        {/* List Grid Table */}
        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `แสดงรายการที่ ${range[0]} - ${range[1]} จากทั้งหมด ${total} รายการ`,
          }}
          locale={{
            emptyText: (
              <div className="py-12 text-center text-slate-400">
                <InboxOutlined style={{ fontSize: '48px', color: '#cbd5e1' }} />
                <p className="mt-2 text-sm">ไม่มีรายการคำขออนุมัติในหมวดนี้</p>
              </div>
            )
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Review Modal Dialog */}
      <Modal
        title={
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1 bg-teal-50 text-teal-600 rounded">
              <AuditOutlined style={{ fontSize: '18px' }} />
            </div>
            <div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                รายละเอียดและใบคำขอพิจารณาอนุมัติ #{selectedRequest?.id}
              </span>
              <span className="block text-slate-500 font-normal text-xs mt-0.5">
                ประเภทเอกสารอ้างอิง: {selectedRequest?.documentType} | เลขที่: {selectedRequest?.documentNo || selectedRequest?.documentId}
              </span>
            </div>
          </div>
        }
        open={reviewOpen}
        onCancel={handleCloseReview}
        footer={null}
        width={1000}
        destroyOnClose
        style={{ top: 40 }}
        bodyStyle={{ padding: '16px 24px 24px' }}
      >
        {selectedRequest && (
          <div>
            {/* Show notes if any */}
            {selectedRequest.notes && (
              <Alert
                message={<span className="font-semibold text-slate-800">บันทึกประกอบคำเสนอขออนุมัติ:</span>}
                description={<span className="text-slate-600">{selectedRequest.notes}</span>}
                type="info"
                showIcon
                style={{ marginBottom: '16px', borderRadius: '8px' }}
              />
            )}

            {/* Check the documentType to render the correct view component */}
            {selectedRequest.documentType === 'ITEM_PRICING_POLICY_BULK' ? (
              <PricingPolicyBulkReview
                versionNo={selectedRequest.documentNo} // Pass VersionNo string
                requestId={selectedRequest.id}
                onClose={handleCloseReview}
                onActionSuccess={loadRequests}
              />
            ) : (
              <DocumentDetailsReview
                documentType={selectedRequest.documentType}
                documentId={selectedRequest.documentId}
                requestId={selectedRequest.id}
                onClose={handleCloseReview}
                onActionSuccess={loadRequests}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
