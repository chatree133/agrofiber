import { DeleteOutlined, CopyOutlined, EyeOutlined } from '@ant-design/icons';
import { Table, Tag, Typography, Tooltip } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

const statusColors = {
  draft: 'default',
  requested: 'warning',
  approved: 'success',
  rejected: 'error',
  closed: 'default',
};

const statusLabels = {
  draft: 'ร่าง',
  requested: 'รออนุมัติ',
  approved: 'อนุมัติ',
  rejected: 'ไม่อนุมัติ',
  closed: 'ปิดเอกสาร',
};

export default function QuotationsTable({
  quotations,
  loading,
  onEdit,
  onDelete,
  onView,
}) {
  const columns = [
    {
      title: 'การจัดการ',
      key: 'actions',
      width: 120,
      fixed: 'left',
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-3">
          <Tooltip title="ทำสำเนา">
            <CopyOutlined
              className="text-slate-600 cursor-pointer hover:text-blue-600 text-base"
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          {record.status !== 'closed' && (
            <Tooltip title="ลบ (ปิดเอกสาร)">
              <DeleteOutlined
                className="text-red-500 cursor-pointer hover:text-red-600 text-base"
                onClick={() => onDelete(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="ดูรายละเอียด">
            <EyeOutlined
              className="text-blue-500 cursor-pointer hover:text-blue-600 text-base"
              onClick={() => onView(record)}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'เลขที่เอกสาร',
      dataIndex: 'documentNo',
      key: 'documentNo',
      width: 160,
      fixed: 'left',
      render: (val) => <Text strong style={{ color: '#1a3353' }}>{val}</Text>,
    },
    {
      title: 'วันที่เอกสาร',
      dataIndex: 'documentDate',
      key: 'documentDate',
      width: 130,
      render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'รหัสลูกค้า',
      dataIndex: 'customerCode',
      key: 'customerCode',
      width: 120,
      render: (val) => val || '-',
    },
    {
      title: 'ชื่อลูกค้า',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 250,
      render: (val) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'ยอดรวมสุทธิ',
      dataIndex: 'grandTotalAmount',
      key: 'grandTotalAmount',
      width: 140,
      align: 'right',
      render: (val) => (
        <Text strong style={{ color: '#0d9488' }}>
          {(val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'วันที่หมดอายุ',
      dataIndex: 'validUntil',
      key: 'validUntil',
      width: 130,
      render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'} className="px-3 py-0.5 rounded text-xs font-semibold">
          {statusLabels[status]?.toUpperCase() || status?.toUpperCase()}
        </Tag>
      ),
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
      <Table
        columns={columns}
        dataSource={quotations}
        rowKey={(record) => `quotation-${record.id}`}
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        size="small"
        className="quotations-table"
      />
    </div>
  );
}
