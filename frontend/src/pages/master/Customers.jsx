import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  FileExcelOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { Button, Input, Space, Table, Tooltip, message, Tag, Pagination, Select } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomer } from '../../context/CustomerContext.jsx';

export default function Customers() {
  const navigate = useNavigate();
  const { getCustomers } = useCustomer();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchParam, setSearchParam] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const loadData = async (page = 1, pageSize = 20, search = searchParam) => {
    try {
      setLoading(true);
      const res = await getCustomers({ page, pageSize, search });
      setCustomers(res.data || []);
      setPagination({
        page: res.pagination?.page || page,
        pageSize: res.pagination?.pageSize || pageSize,
        total: res.pagination?.total || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถโหลดข้อมูลลูกค้าได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, pagination.pageSize, searchParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam]);

  const handleSearch = () => {
    setSearchParam(searchText);
  };

  const handleTableChange = (newPagination) => {
    loadData(newPagination.current, newPagination.pageSize, searchParam);
  };

  const handleExport = async () => {
    try {
      // Fetch all for export or just current page? Usually all.
      // Since it might be large, fetch a large page size for export.
      const res = await getCustomers({ page: 1, pageSize: 10000, search: searchParam });
      const exportData = res.data || [];
      const header = ['รหัสลูกค้า', 'ชื่อลูกค้า', 'Tax ID', 'Price List', 'Discount Rule', 'สถานะ'];
      const rows = exportData.map((c) => [
        c.code || '',
        c.name || '',
        c.taxId || '',
        c.priceListName || '',
        c.discountRuleName || '',
        c.isActive ? 'เปิดใช้' : 'ปิดใช้',
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
        .join('\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
      link.download = 'customers.csv';
      link.click();
    } catch (err) {
      message.error('ไม่สามารถดึงข้อมูลสำหรับ Export ได้');
    }
  };

  const columns = [
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <EditOutlined className="text-blue-600 cursor-pointer hover:text-blue-700" onClick={() => navigate(`/master/customers/${record.id}/edit`)} />
      ),
    },
    { title: 'รหัสลูกค้า', dataIndex: 'code', key: 'code', width: 150 },
    { title: 'ชื่อลูกค้า', dataIndex: 'name', key: 'name', width: 300 },
    { title: 'เลขประจำตัวผู้เสียภาษี', dataIndex: 'taxId', key: 'taxId', width: 150 },
    { title: 'Price List', dataIndex: 'priceListName', key: 'priceListName', width: 150 },
    {
      title: 'สถานะ',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'right',
      render: (isActive) => (
        <Tag color={isActive ? 'blue' : 'red'}>{isActive ? 'เปิดใช้' : 'ปิดใช้'}</Tag>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex max-w-[560px]">
          <Input
            allowClear
            placeholder="ค้นหารหัสลูกค้า, ชื่อลูกค้า, Tax ID..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            className="rounded-r-none"
          />
          <Button type="primary" icon={<SearchOutlined />} className="rounded-l-none" onClick={handleSearch} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space>
            <Tooltip title="เพิ่มลูกค้า">
              <Button icon={<PlusOutlined />} onClick={() => navigate('/master/customers/create')} />
            </Tooltip>
          </Space>

          <Space wrap>
            <Tooltip title="Export CSV">
              <Button icon={<FileExcelOutlined />} onClick={handleExport} />
            </Tooltip>
            <Tooltip title="Filter">
              <Button icon={<FilterOutlined />} />
            </Tooltip>
            <span>
              {pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0}-
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
            </span>
            <Pagination
              simple
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={(page) => loadData(page, pagination.pageSize, searchParam)}
            />
            <Select
              value={pagination.pageSize}
              className="w-28"
              options={[10, 20, 50, 100].map((value) => ({ value, label: `${value}/page` }))}
              onChange={(pageSize) => loadData(1, pageSize, searchParam)}
            />
          </Space>
        </div>
        <div className="rounded-lg border border-slate-200">
          <Table
            columns={columns}
            dataSource={customers}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </div>
      </div>
    </div>
  );
}
