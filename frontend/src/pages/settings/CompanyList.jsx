import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { Button, Table, Tooltip, message, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext.jsx';

export default function CompanyList() {
  const navigate = useNavigate();
  const { getCompanies } = useCompany();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'ไม่สามารถโหลดข้อมูลบริษัทได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExport = () => {
    const header = ['รหัสบริษัท', 'ชื่อบริษัท', 'เลขประจำตัวผู้เสียภาษี', 'เบอร์โทร', 'อีเมล', 'สถานะ'];
    const rows = companies.map((c) => [
      c.companyCode || '',
      c.companyName || '',
      c.taxId || '',
      c.phone || '',
      c.email || '',
      c.isActive ? 'เปิดใช้' : 'ปิดใช้',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'companies.csv';
    link.click();
  };

  const columns = [
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          <EditOutlined className="text-blue-600 cursor-pointer hover:text-blue-700" onClick={() => navigate(`/settings/company/${record.companyId}/edit`)} />
        </div>
      ),
    },
    { title: 'รหัสบริษัท', dataIndex: 'companyCode', key: 'companyCode' },
    { title: 'ชื่อบริษัท', dataIndex: 'companyName', key: 'companyName' },
    { title: 'เลขประจำตัวผู้เสียภาษี', dataIndex: 'taxId', key: 'taxId' },
    { title: 'เบอร์โทร', dataIndex: 'phone', key: 'phone' },
    {
      title: 'เปิด-ปิดใช้',
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          ข้อมูลบริษัท (Companies)
        </h1>
        <div className="flex gap-2">
          <Button icon={<FileExcelOutlined />} onClick={handleExport} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/settings/company/create')}>
            เพิ่มบริษัท
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200">
        <Table
          columns={columns}
          dataSource={companies}
          rowKey="companyId"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  );
}
