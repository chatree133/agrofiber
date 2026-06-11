import React, { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Space, Table, Tabs, Tag, Typography, message, Pagination } from 'antd';
import { AppstoreOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWms } from '../../context/WmsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title, Text } = Typography;

export default function PickingList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const roles = user?.roles || [];
  const canForceUnclaim = roles.includes('admin') || roles.includes('warehouse_manager');

  const { getWmsTasks, getWmsWaves, createWmsWave, claimWmsWave, unclaimWmsWave } = useWms();
  const [activeTab, setActiveTab] = useState('waves');
  const [tasks, setTasks] = useState([]);
  const [waves, setWaves] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingWaves, setLoadingWaves] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [taskPage, setTaskPage] = useState(1);
  const [wavePage, setWavePage] = useState(1);
  const pageSize = 15;

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await getWmsTasks({ status: 'open', taskType: 'picking', unassociated: true });
      setTasks(res.data || []);
      setTaskPage(1);
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูลงานหยิบได้: ' + err.message);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchWaves = async () => {
    setLoadingWaves(true);
    try {
      const res = await getWmsWaves();
      setWaves(res.data || []);
      setWavePage(1);
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูล Wave Picking ได้: ' + err.message);
    } finally {
      setLoadingWaves(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchWaves();
  }, [activeTab]);

  const handleCreateWave = async () => {
    if (selectedTaskIds.length === 0) {
      message.warning('กรุณาเลือกงานหยิบอย่างน้อย 1 รายการเพื่อสร้าง Wave');
      return;
    }
    try {
      await createWmsWave({ taskIds: selectedTaskIds });
      message.success('สร้าง Wave Picking สำเร็จ!');
      setSelectedTaskIds([]);
      setActiveTab('waves');
      fetchWaves();
    } catch (err) {
      message.error('ไม่สามารถสร้าง Wave ได้: ' + err.message);
    }
  };

  const handleStartPicking = async (wave) => {
    if (wave.actionBy && currentUserId && wave.actionBy !== currentUserId) {
      message.error(`คลื่นงานนี้กำลังถูกดำเนินการโดย ${wave.actionByName || 'ผู้ใช้อื่น'} อยู่แล้ว`);
      return;
    }

    try {
      if (!wave.actionBy) {
        await claimWmsWave(wave.id);
        message.success('เริ่มดำเนินการคลื่นงานนี้แล้ว');
      }
      navigate(`/wms/waves/${wave.id}`);
    } catch (err) {
      message.error('ไม่สามารถเริ่มดำเนินการคลื่นงานนี้ได้: ' + err.message);
    }
  };

  const handleUnclaimWave = async (waveId) => {
    try {
      await unclaimWmsWave(waveId);
      message.success('ยกเลิกการดำเนินการคลื่นงานเรียบร้อยแล้ว');
      fetchWaves();
    } catch (err) {
      message.error('ไม่สามารถยกเลิกการดำเนินการคลื่นงานได้: ' + err.message);
    }
  };

  const taskColumns = [
    {
      title: 'เลขที่เอกสารงาน',
      dataIndex: 'id',
      key: 'id',
      render: (id, record) => <Text strong>Task #{id}</Text>,
    },
    {
      title: 'ประเภทงาน',
      dataIndex: 'taskTypeName',
      key: 'taskTypeName',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'อ้างอิงเอกสาร',
      key: 'reference',
      render: (_, r) => r.referenceType ? `${r.referenceType} (ID: ${r.referenceId})` : '-',
    },
    {
      title: 'คลังสินค้า',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'open' ? 'orange' : 'green'}>
          {status === 'open' ? 'รอดำเนินการ' : status}
        </Tag>
      ),
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('th-TH'),
    },
  ];

  const waveColumns = [
    {
      title: 'เลขที่ Wave',
      dataIndex: 'waveNo',
      key: 'waveNo',
      render: (text, r) => <a onClick={() => navigate(`/wms/waves/${r.id}`)}>{text}</a>,
    },
    {
      title: 'จำนวนงาน',
      dataIndex: 'taskCount',
      key: 'taskCount',
      render: (count) => `${count} งาน`,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'completed' ? 'green' : status === 'in_progress' ? 'blue' : 'orange'}>
          {status === 'completed' ? 'เสร็จสิ้น' : status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
        </Tag>
      ),
    },
    {
      title: 'ผู้สร้าง',
      dataIndex: 'createdByName',
      key: 'createdByName',
    },
    {
      title: 'ผู้ดำเนินการ',
      dataIndex: 'actionByName',
      key: 'actionByName',
      render: (text) => text || '-',
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('th-TH'),
    },
    {
      fixed: 'right',
      title: 'การกระทำ',
      width: 230,
      key: 'actions',
      render: (_, r) => {
        const isClaimedByOther = r.actionBy && currentUserId && r.actionBy !== currentUserId;
        const canUnclaim = r.status !== 'completed' && r.actionBy && (r.actionBy === currentUserId || canForceUnclaim);
        return (
          <Space>
            {r.status !== 'completed' ? (
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartPicking(r)}
                disabled={Boolean(isClaimedByOther)}
              >
                ดำเนินการหยิบ
              </Button>
            ) : (
              <Button
                size="small"
                onClick={() => navigate(`/wms/waves/${r.id}`)}
              >
                ดูรายละเอียด
              </Button>
            )}
            {canUnclaim && (
              <Button
                size="small"
                danger
                onClick={() => handleUnclaimWave(r.id)}
              >
                Unclaim
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-slate-800">
          ระบบบริหารจัดการคลังสินค้า (WMS)
        </h1>
        <Text type="secondary" className="text-sm">
          จัดการคลื่นใบงานและคอนเฟิร์มหยิบสินค้าออกจากคลัง
        </Text>
      </div>

      <Card className="shadow-sm">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'waves',
              label: (
                <span>
                  รายการกลุ่มคลื่นงาน (Wave Picking List)
                </span>
              ),
              children: (
                <div className="flex flex-col">
                  <div className="flex justify-end items-center gap-4 mb-2">
                    <span className="text-slate-500 text-sm">
                      {waves.length ? (wavePage - 1) * pageSize + 1 : 0}-
                      {Math.min(wavePage * pageSize, waves.length)} of {waves.length} items
                    </span>
                    <Pagination
                      simple
                      current={wavePage}
                      pageSize={pageSize}
                      total={waves.length}
                      onChange={setWavePage}
                    />
                  </div>
                  <Table
                    size='small'
                    columns={waveColumns}
                    dataSource={waves.slice((wavePage - 1) * pageSize, wavePage * pageSize).map((w) => ({ ...w, key: w.id }))}
                    loading={loadingWaves}
                    pagination={false}
                    scroll={{ x: 1000 }}
                  />
                </div>
              ),
            },
            {
              key: 'tasks',
              label: (
                <span>
                  งานหยิบรอจัดกลุ่ม ({tasks.length})
                </span>
              ),
              children: (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                    <Text type="secondary" className="hidden md:inline-block">
                      เลือกใบสั่งงานหยิบสินค้าหลายๆ ใบเพื่อจัดรวมกลุ่มเป็น Wave Picking ให้พนักงานเดินหยิบรอบเดียว
                    </Text>
                    <div className="flex justify-between md:justify-end items-center gap-4 w-full md:w-auto">
                      <div className="hidden md:flex items-center gap-4">
                        <span className="text-slate-500 text-sm">
                          {tasks.length ? (taskPage - 1) * pageSize + 1 : 0}-
                          {Math.min(taskPage * pageSize, tasks.length)} of {tasks.length} items
                        </span>
                        <Pagination
                          simple
                          current={taskPage}
                          pageSize={pageSize}
                          total={tasks.length}
                          onChange={setTaskPage}
                        />
                      </div>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreateWave}
                        disabled={selectedTaskIds.length === 0}
                        className="w-full md:w-auto"
                      >
                        สร้าง Wave Picking ({selectedTaskIds.length})
                      </Button>
                    </div>
                  </div>
                  <Table
                    size='small'
                    rowSelection={{
                      selectedRowKeys: selectedTaskIds,
                      onChange: setSelectedTaskIds,
                    }}
                    columns={taskColumns}
                    dataSource={tasks.slice((taskPage - 1) * pageSize, taskPage * pageSize).map((t) => ({ ...t, key: t.id }))}
                    loading={loadingTasks}
                    pagination={false}
                    scroll={{ x: 800 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
