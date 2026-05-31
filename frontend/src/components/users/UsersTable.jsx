import { Button, Space, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

export default function UsersTable({
  users,
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
      width: 78,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Delete">
            <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600" onClick={() => onDelete(record)} />
          </Tooltip>
          <Tooltip title="Edit">
            <EditOutlined className="text-slate-600 cursor-pointer hover:text-blue-600" onClick={() => onEdit(record)} />
          </Tooltip>
        </Space>
      ),
    },
    { title: 'Username', dataIndex: 'username', sorter: (a, b) => a.username.localeCompare(b.username) },
    { title: 'รหัสพนักงาน', dataIndex: 'staffId' },
    { title: 'ชื่อแสดง', dataIndex: 'displayName' },
    { title: 'ตำแหน่ง', dataIndex: 'jobTitle' },
    { title: 'อีเมล', dataIndex: 'email' },
    {
      title: 'Roles',
      dataIndex: 'roles',
      render: (value = []) => value.map((role) => <Tag key={role.id}>{role.code}</Tag>),
    },
    {
      title: 'สถานะ',
      dataIndex: 'isActive',
      render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Active' : 'Inactive'}</Tag>,
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200">
      <Table
        className="users-table-nowrap"
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={columns}
        pagination={false}
        tableLayout="auto"
        rowSelection={{
          selectedRowKeys,
          onChange: onSelectionChange,
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
