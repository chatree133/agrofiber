import React, { useEffect, useState } from 'react';
import { Button, Card, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { ReloadOutlined, ScanOutlined, StopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWms } from '../../context/WmsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const { Text } = Typography;

export default function TransferTasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles || [];
  const canCancel = roles.includes('admin') || roles.includes('warehouse_manager');

  const { getWmsTasks, cancelWmsTask } = useWms();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
        <Space>
          <Button type="primary" size="small" icon={<ScanOutlined />} onClick={() => navigate(`/wms/transfers/${r.id}`)}>
            เปิดหน้าสแกน
          </Button>
          {canCancel ? (
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              loading={actionLoading}
              onClick={() => {
                Modal.confirm({
                  title: `ยกเลิก Task #${r.id}`,
                  content: 'ต้องการยกเลิกใบงานโอนย้ายนี้หรือไม่?',
                  okText: 'ยกเลิกใบงาน',
                  okType: 'danger',
                  cancelText: 'ปิด',
                  onOk: async () => {
                    setActionLoading(true);
                    try {
                      await cancelWmsTask(r.id);
                      message.success(`ยกเลิก Task #${r.id} แล้ว`);
                      await fetchTasks();
                    } catch (err) {
                      message.error('ยกเลิกใบงานไม่สำเร็จ: ' + err.message);
                    } finally {
                      setActionLoading(false);
                    }
                  },
                });
              }}
            >
              ยกเลิก
            </Button>
          ) : null}
        </Space>
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
