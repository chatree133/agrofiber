import React, { useEffect, useState } from 'react';
import { Button, Card, Space, Table, Tag, Typography, message } from 'antd';
import { ReloadOutlined, ScanOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWms } from '../../context/WmsContext.jsx';

const { Text } = Typography;

export default function TransferTasks() {
  const navigate = useNavigate();
  const { getWmsTasks } = useWms();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await getWmsTasks({ status: 'open', taskType: 'transfer' });
      setTasks(res.data || []);
    } catch (err) {
      message.error('ไม่สามารถโหลดรายการงานโอนย้ายได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const columns = [
    {
      title: 'เลขที่ใบงาน',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text strong>Task #{id}</Text>,
    },
    {
      title: 'คลังต้นทาง',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      render: (text) => text || '-',
    },
    {
      title: 'ผู้ดำเนินการ',
      key: 'actionBy',
      render: (_, r) => r.actionByName || '-',
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'open' ? 'orange' : status === 'completed' ? 'green' : 'blue'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'การกระทำ',
      key: 'actions',
      render: (_, r) => (
        <Button type="primary" size="small" icon={<ScanOutlined />} onClick={() => navigate(`/wms/transfers/${r.id}`)}>
          เปิดหน้าสแกน
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-slate-800">WMS โอนย้ายสินค้า (Transfer Tasks)</h1>
          <Text type="secondary" className="text-sm">รายการใบงานโอนย้ายที่ต้องสแกนต้นทาง/ปลายทางก่อนยืนยัน</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTasks} loading={loading}>
            รีเฟรช
          </Button>
        </Space>
      </div>

      <Card className="shadow-sm">
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={tasks}
          loading={loading}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
}
