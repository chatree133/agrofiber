import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Table, Tag } from 'antd';

export default function ItemsTable({
  items,
  loading,
  selectedRowKeys,
  onSelectionChange,
  onEdit,
  onDelete,
}) {
  const columns = [
    {
      title: '',
      key: 'actions',
      width: 70,
      fixed: 'left',
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          <DeleteOutlined
            className="text-red-500 cursor-pointer hover:text-red-600"
            onClick={() => onDelete(record)}
          />
          <EditOutlined
            className="text-slate-600 cursor-pointer hover:text-blue-600"
            onClick={() => onEdit(record)}
          />
        </div>
      ),
    },
    {
      title: 'รหัสสินค้า / SKU',
      dataIndex: 'displayCode',
      key: 'displayCode',
      width: 170,
      fixed: 'left',
      render: (value) => value || '-',
    },
    {
      title: 'ชนิดแถว',
      dataIndex: 'rowType',
      key: 'rowType',
      width: 110,
      render: (value) => (value === 'child' ? 'Child' : 'Parent'),
    },
    {
      title: 'ชื่อสินค้า',
      dataIndex: 'name',
      key: 'name',
      width: 220,
    },
    {
      title: 'ชื่อพื้นผิว',
      dataIndex: 'surfaceName',
      key: 'surfaceName',
      width: 180,
      render: (value) => value || '-',
    },
    {
      title: 'ชื่อเกรด',
      dataIndex: 'gradeName',
      key: 'gradeName',
      width: 140,
      render: (value) => value || '-',
    },
    {
      title: 'ประเภท',
      key: 'type',
      width: 120,
      render: (_, record) => record.itemTypeCode || '-',
    },
    {
      title: 'กลุ่มสินค้า',
      key: 'productGroup',
      width: 120,
      render: (_, record) => record.productTypeCode || '-',
    },
    {
      title: 'ความหนา (มม.)',
      dataIndex: 'thicknessMm',
      key: 'thicknessMm',
      width: 120,
      align: 'right',
      render: (val) => val || '-',
    },
    {
      title: 'กว้าง x ยาว (เมตร)',
      key: 'dimensions',
      width: 150,
      align: 'right',
      render: (_, record) => {
        if (record.widthM && record.lengthM) {
          return `${record.widthM} x ${record.lengthM}`;
        }
        return '-';
      },
    },
    {
      title: 'พื้นที่ (ตร.ม.)',
      dataIndex: 'areaSqm',
      key: 'areaSqm',
      width: 120,
      align: 'right',
      render: (val) => val || '-',
    },
    {
      title: 'หน่วย (Unit)',
      dataIndex: 'unitCode',
      key: 'unitCode',
      width: 100,
      align: 'right',
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'right',
      render: (status) => {
        const colors = { draft: 'default', active: 'success', obsolete: 'error' };
        return <Tag color={colors[status] || 'default'}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'เปิด-ปิดใช้',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      align: 'right',
      render: (isActive) => (
        <Tag color={isActive ? 'blue' : 'red'}>{isActive ? 'เปิดใช้' : 'ปิดใช้'}</Tag>
      ),
    },

  ];

  return (
    <div className="rounded-lg border border-slate-200">
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: onSelectionChange,
        }}
        columns={columns}
        dataSource={items}
        rowKey={(record) => record.rowKey || `item-${record.itemId}`}
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        size="small"
        className="users-table-nowrap"
      />
    </div>
  );
}
