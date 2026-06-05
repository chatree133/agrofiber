import { useState, useEffect, useMemo } from 'react';
import { Table, Card, Typography, Tabs, Select, Space, Button, Badge, Modal, Tag, Alert, Row, Col, Statistic, Tooltip, Pagination } from 'antd';
import { AuditOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, InboxOutlined, UserOutlined, ClockCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkflow } from '../../context/WorkflowContext.jsx';
import PricingPolicyBulkReview from '../../components/items/PricingPolicyBulkReview.jsx';
import DocumentDetailsReview from '../../components/items/DocumentDetailsReview.jsx';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ApprovalsDashboard() {
  const { getApprovalRequests, getApprovalRequestDetail } = useWorkflow();

  // State variables
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');

  // Client-side pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  // Filter requests to show on the current page
  const displayedRequests = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return requests.slice(startIndex, endIndex);
  }, [requests, pagination.page, pagination.pageSize]);

  // Review Modal State
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  // Load request list
  const loadRequests = async (nextPage) => {
    setLoading(true);
    try {
      // Determine backend status parameter based on tab
      const params = {
        status: activeTab === 'pending' ? 'pending' : 'all'
      };
      if (docTypeFilter !== 'ALL') {
        params.documentType = docTypeFilter;
      }

      const res = await getApprovalRequests(params);
      const rows = res?.data || [];
      setRequests(rows);

      const targetPage = typeof nextPage === 'number' ? nextPage : 1;
      setPagination(prev => ({
        ...prev,
        page: targetPage,
        total: rows.length,
      }));

      // Fetch overview statistics by requesting 'all' (once or during refresh)
      const allRes = await getApprovalRequests({ status: 'all' });
      const allRows = allRes?.data || [];

      const counts = { pending: 0, approved: 0, rejected: 0 };
      allRows.forEach(row => {
        if (row.status === 'pending' && row.isPendingForMe) counts.pending++;
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

  const onPageChange = (page) => {
    setPagination(prev => ({
      ...prev,
      page,
    }));
  };

  useEffect(() => {
    loadRequests(1);
  }, [activeTab, docTypeFilter]);

  const handleOpenReview = async (record) => {
    setSelectedRequest(record);
    setReviewOpen(true);
    setLoadingDetail(true);
    try {
      const res = await getApprovalRequestDetail(record.id);
      if (res) {
        setRequestDetail(res);
      }
    } catch (err) {
      console.error('Failed to load approval request detail', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
    setRequestDetail(null);
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
      width: 220,
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
      width: 210,
      render: (val, record) => (
        <div>
          <Text block style={{ fontWeight: 500, color: '#334155' }}>{val || '-'}</Text>
          <Text type="secondary" style={{ fontSize: '11px', marginLeft: '4px' }}>ID: {record.requestedBy}</Text>
        </div>
      ),
    },
    {
      title: 'วันที่เสนอขอ',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      width: 150,
      render: (val) => (
        <div>
          <Text block style={{ fontSize: '13px', color: '#475569' }}>{dayjs(val).format('DD/MM/YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: '11px', marginLeft: '4px' }}>{dayjs(val).format('HH:mm น.')}</Text>
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
      title: '',
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

  const renderStepper = () => {
    if (loadingDetail) {
      return (
        <div className="flex justify-center items-center py-8">
          <SyncOutlined spin style={{ fontSize: '20px', color: '#0d9488' }} />
          <span className="ml-2 text-slate-500 text-sm">กำลังโหลดขั้นตอนการอนุมัติ...</span>
        </div>
      );
    }

    if (!requestDetail || !requestDetail.steps || requestDetail.steps.length === 0) {
      return null;
    }

    const steps = requestDetail.steps;
    const currentStepNo = requestDetail.currentStepNo;
    const requestStatus = requestDetail.status;

    return (
      <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 mb-6 shadow-sm">
        <div className="flex items-start justify-between mx-auto max-w-3xl relative">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const stepNo = step.stepNo;
            const status = step.status; // 'pending' | 'approved' | 'rejected'

            const isApproved = status === 'approved';
            const isRejected = status === 'rejected';
            const isPending = status === 'pending' && stepNo === currentStepNo && requestStatus === 'pending';
            const isFuture = (status === 'pending' && stepNo > currentStepNo) || (requestStatus === 'rejected' && stepNo > currentStepNo);

            let ringColor = 'border-slate-200 bg-slate-50 text-slate-400';
            let textColor = 'text-slate-400';
            let stepLabelColor = 'text-slate-400 font-medium';
            let badgeIcon = null;

            if (isApproved) {
              ringColor = 'border-emerald-500 ring-4 ring-emerald-50';
              textColor = 'text-slate-800 font-medium';
              stepLabelColor = 'text-emerald-500 font-bold';
            } else if (isRejected) {
              ringColor = 'border-rose-500 ring-4 ring-rose-50';
              textColor = 'text-slate-800 font-medium';
              stepLabelColor = 'text-rose-500 font-bold';
            } else if (isPending) {
              ringColor = 'border-blue-500 ring-4 ring-blue-50';
              textColor = 'text-blue-600 font-semibold';
              stepLabelColor = 'text-blue-500 font-bold';
              badgeIcon = (
                <div
                  className="absolute right-0 bottom-0 bg-amber-500 text-white rounded-full flex items-center justify-center border border-white"
                  style={{ width: '18px', height: '18px', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                >
                  <ClockCircleFilled style={{ color: '#fff' }} />
                </div>
              );
            }

            // Avatar display
            let avatarElement = null;
            let displayName = '-';

            if (isApproved || isRejected) {
              // Approved/Rejected: Must show actor name and avatar if exists
              displayName = step.actorDisplayName || step.approverUserName || '-';
              const avatarUrl = step.actorAvatarUrl;
              if (avatarUrl) {
                avatarElement = (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover rounded-full"
                  />
                );
              } else {
                const initials = displayName.substring(0, 2).toUpperCase();
                avatarElement = (
                  <div className={`w-full h-full flex items-center justify-center text-xs font-semibold rounded-full ${isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {initials}
                  </div>
                );
              }
            } else if (isPending) {
              // Pending step:
              // If rolebased pending, do NOT show name or photo (anonymized)
              if (step.approverRoleId && !step.approverUserId) {
                displayName = step.approverRoleName || 'ผู้มีสิทธิ์อนุมัติ';
                avatarElement = (
                  <div className="w-full h-full flex items-center justify-center text-lg bg-slate-100 text-slate-400 rounded-full">
                    <UserOutlined />
                  </div>
                );
              } else {
                // Userbased pending: Show assigned user
                displayName = step.approverUserName || '-';
                const initials = displayName.substring(0, 2).toUpperCase();
                avatarElement = (
                  <div className="w-full h-full flex items-center justify-center text-xs font-semibold bg-blue-50 text-blue-600 rounded-full">
                    {initials}
                  </div>
                );
              }
            } else {
              // Future step
              if (step.approverRoleId && !step.approverUserId) {
                displayName = step.approverRoleName || 'ผู้มีสิทธิ์อนุมัติ';
              } else {
                displayName = step.approverUserName || 'ผู้มีสิทธิ์อนุมัติ';
              }
              avatarElement = (
                <div className="w-full h-full flex items-center justify-center text-lg bg-slate-100 text-slate-300 rounded-full">
                  <UserOutlined />
                </div>
              );
            }

            return (
              <div key={step.id} className="flex-1 flex flex-col items-center relative z-10">
                {/* Connector line to next step */}
                {!isLast && (
                  <div
                    className="absolute"
                    style={{
                      left: 'calc(50% + 36px)',
                      right: 'calc(-50% + 36px)',
                      top: '28px',
                      height: '3px',
                      backgroundColor: isApproved ? '#10b981' : '#e2e8f0',
                      zIndex: -1,
                    }}
                  />
                )}

                {/* Avatar circle with Ring */}
                <div className="relative">
                  <div
                    className={`w-14 h-14 rounded-full border-2 p-0.5 flex items-center justify-center ${ringColor}`}
                    style={{ transition: 'all 0.3s ease' }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white">
                      {avatarElement}
                    </div>
                  </div>
                  {badgeIcon}
                </div>

                {/* Step labels */}
                <div className="text-center mt-3 px-1 max-w-[140px]">
                  <div className={`text-[11px] uppercase tracking-wider ${stepLabelColor}`}>
                    STEP {step.stepNo}
                  </div>
                  <div
                    className={`text-xs mt-1 font-medium truncate ${textColor}`}
                    title={displayName}
                  >
                    {displayName}
                  </div>

                  {/* Datetime for approved/rejected */}
                  {(isApproved || isRejected) && step.actionAt && (
                    <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                      <div>{dayjs(step.actionAt).format('DD/MM/YYYY HH:mm น.')}</div>
                    </div>
                  )}

                  {/* Action Comments inside tooltip */}
                  {(isApproved || isRejected) && step.comments && (
                    <Tooltip title={step.comments}>
                      <div className="text-[10px] italic text-slate-500 mt-1 truncate cursor-pointer bg-slate-100 rounded px-1 py-0.5 max-w-full">
                        "{step.comments}"
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          ศูนย์อนุมัติเอกสารกลาง (Centralized Approval Center)
        </h1>
        <div className="flex gap-2">
          <Button
            icon={<SyncOutlined />}
            onClick={() => loadRequests()}
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
            <span>
              {pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0}-
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
            </span>
            <Pagination
              simple
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={onPageChange}
            />
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
          dataSource={displayedRequests}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
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

            {/* Stepper Progress Timeline */}
            {renderStepper()}

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
