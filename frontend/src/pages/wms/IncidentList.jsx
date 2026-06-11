import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, message, Modal, Select, Input, Radio } from 'antd';
import { CheckCircleOutlined, BranchesOutlined, CloseCircleOutlined, WarningOutlined, SearchOutlined, AuditOutlined, SyncOutlined } from '@ant-design/icons';
import { useWms } from '../../context/WmsContext.jsx';

const { Title, Text, Paragraph } = Typography;

export default function IncidentList() {
  const { getWmsIncidents, resolveWmsIncident } = useWms();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveAction, setResolveAction] = useState('re_pick');
  const [resolveDetails, setResolveDetails] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const data = await getWmsIncidents({ status: statusFilter === 'all' ? undefined : statusFilter });
      setIncidents(data || []);
    } catch (err) {
      message.error('โหลดข้อมูลความผิดปกติล้มเหลว: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter]);

  const openResolveModal = (incident) => {
    setResolvingId(incident.id);
    setResolveAction('re_pick');
    setResolveDetails('');
    setIsResolveModalOpen(true);
  };

  const handleResolve = async () => {
    if (!resolvingId) return;
    setLoading(true);
    try {
      await resolveWmsIncident(resolvingId, {
        action: resolveAction,
        details: resolveDetails.trim()
      });
      message.success('แก้ไขปัญหาสำเร็จเรียบร้อยแล้ว');
      setIsResolveModalOpen(false);
      fetchIncidents();
    } catch (err) {
      message.error('แก้ไขปัญหาล้มเหลว: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={status === 'resolved' ? 'green' : 'orange'} style={{ fontSize: '13px', padding: '3px 8px' }}>
          {status === 'resolved' ? 'แก้ไขแล้ว' : 'รอการแก้ไข'}
        </Tag>
      )
    },
    {
      title: 'ใบสั่งงาน / อ้างอิง',
      key: 'taskRef',
      width: 180,
      render: (_, r) => (
        <Space direction="vertical" size="0">
          <Text strong>Task #{r.wmsTaskId}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {r.sourceType}: {r.sourceId || '-'}
          </Text>
        </Space>
      )
    },
    {
      title: 'สินค้า (Product SKU)',
      key: 'product',
      width: 280,
      render: (_, r) => (
        <Space direction="vertical" size="0">
          <Text strong>{r.salesSku || r.itemCode}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{r.itemName}</Text>
          {r.specName && <Tag color="blue" size="small" style={{ marginTop: '2px' }}>{r.specName}</Tag>}
        </Space>
      )
    },
    {
      title: 'ยอดขอหยิบ',
      dataIndex: 'qtyRequired',
      key: 'qtyRequired',
      align: 'right',
      render: (qty) => <Text strong>{Number(qty).toLocaleString('th-TH')} แผ่น</Text>
    },
    {
      title: 'หยิบได้จริง',
      dataIndex: 'qtyCompleted',
      key: 'qtyCompleted',
      align: 'right',
      render: (qty) => <Text style={{ color: '#52c41a' }}>{Number(qty).toLocaleString('th-TH')} แผ่น</Text>
    },
    {
      title: 'ขาดแคลน',
      dataIndex: 'qtyShortage',
      key: 'qtyShortage',
      align: 'right',
      render: (qty) => <Text type="danger" strong>{Number(qty).toLocaleString('th-TH')} แผ่น</Text>
    },
    {
      title: 'สภาพสินค้า / สาเหตุ',
      dataIndex: 'condition',
      key: 'condition',
      width: 150,
      render: (cond) => {
        if (!cond || cond === 'good') return <Text type="secondary">-</Text>;
        const color = cond === 'damaged' ? 'red' : 'volcano';
        const text = cond === 'damaged' ? 'ชำรุด (Damaged)' : 'สต็อกหาย (Missing)';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'การดำเนินการ',
      key: 'resolution',
      render: (_, r) => {
        if (r.status === 'resolved') {
          return (
            <Space direction="vertical" size="0">
              <Tag color="blue">
                {r.resolutionAction === 're_pick' ? 'สั่งหยิบเพิ่ม (Re-pick)' : 'ยกเลิกยอดค้างส่ง'}
              </Tag>
              {r.resolutionDetails && (
                <Text type="secondary" style={{ fontSize: '11px', maxWidth: '200px' }} ellipsis>
                  โน้ต: {r.resolutionDetails}
                </Text>
              )}
              {r.resolvedByName && (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  โดย {r.resolvedByName} ({new Date(r.resolvedAt).toLocaleString('th-TH')})
                </Text>
              )}
            </Space>
          );
        }
        return (
          <Button
            type="primary"
            icon={<AuditOutlined />}
            size="small"
            onClick={() => openResolveModal(r)}
          >
            จัดการปัญหา
          </Button>
        );
      }
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            <WarningOutlined className="text-amber-500 mr-2" />
            รายการหยิบขาด/ปัญหาคลังสินค้า
          </h1>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            ตรวจสอบและจัดการความผิดปกติในการหยิบสินค้าของคลัง (Short-pick Exceptions)
          </Paragraph>
        </div>
        <Button icon={<SyncOutlined />} onClick={fetchIncidents} loading={loading}>
          รีเฟรช
        </Button>
      </div>

      <Card className="shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <Text strong>สถานะปัญหา:</Text>
          <Radio.Group
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="pending">รอการแก้ไข (Pending)</Radio.Button>
            <Radio.Button value="resolved">แก้ไขแล้ว (Resolved)</Radio.Button>
            <Radio.Button value="all">ทั้งหมด (All)</Radio.Button>
          </Radio.Group>
        </div>

        <Table
          columns={columns}
          dataSource={incidents.map(inc => ({ ...inc, key: inc.id }))}
          loading={loading}
          pagination={{ pageSize: 15 }}
          size="small"
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2 border-b pb-2">
            <AuditOutlined className="text-blue-500 text-lg" />
            <Title level={4} style={{ margin: 0 }}>เลือกแนวทางการแก้ไขปัญหา (Resolve Exception)</Title>
          </div>
        }
        open={isResolveModalOpen}
        onOk={handleResolve}
        onCancel={() => setIsResolveModalOpen(false)}
        okText="ยืนยันการแก้ไข"
        cancelText="ยกเลิก"
        confirmLoading={loading}
        destroyOnClose
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Text strong block>แนวทางการแก้ไข (Action)</Text>
            <Radio.Group
              value={resolveAction}
              onChange={(e) => setResolveAction(e.target.value)}
              className="flex flex-col gap-2"
            >
              <Radio value="re_pick">
                <Space direction="vertical" size="0">
                  <Text strong>สั่งหยิบเพิ่ม (Split & Re-issue Task)</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    สร้าง Picking Task ใหม่สำหรับชิ้นที่ขาดเพื่อรอการหยิบภายหลัง
                  </Text>
                </Space>
              </Radio>
              <Radio value="cancel_remaining">
                <Space direction="vertical" size="0">
                  <Text strong>ยกเลิกจำนวนค้างส่ง (Cancel Remaining / Release Reservation)</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    ตัดยอดค้างส่งและยกเลิกการจองสต็อกในระบบเพื่อคืนสต็อกให้กับการขายอื่น
                  </Text>
                </Space>
              </Radio>
            </Radio.Group>
          </div>

          <div className="space-y-1">
            <Text strong block>บันทึกช่วยจำ / หมายเหตุ (Resolution Note)</Text>
            <Input.TextArea
              rows={3}
              placeholder="ระบุเหตุผลการตัดสินใจ หรือบันทึกเพื่อใช้ในการตรวจสอบภายหลัง..."
              value={resolveDetails}
              onChange={(e) => setResolveDetails(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
