import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, Modal, Space, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ScanOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWms } from '../../context/WmsContext.jsx';
import { Scanner } from '@yudiel/react-qr-scanner';

const { Text } = Typography;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default function TransferTaskDetail() {
  const { id } = useParams();
  const taskId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const roles = user?.roles || [];
  const canForceUnclaim = roles.includes('admin') || roles.includes('warehouse_manager');

  const { getWmsTaskDetail, claimWmsTask, unclaimWmsTask, confirmWmsTask } = useWms();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [scanFromLocationCode, setScanFromLocationCode] = useState('');
  const [scanFromPalletNo, setScanFromPalletNo] = useState('');
  const [scanToLocationCode, setScanToLocationCode] = useState('');
  const [scanToPalletNo, setScanToPalletNo] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState('fromLocation'); // fromLocation | fromPallet | toLocation | toPallet

  const fromLocationRef = useRef(null);
  const fromPalletRef = useRef(null);
  const toLocationRef = useRef(null);
  const toPalletRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getWmsTaskDetail(taskId);
      setTask(data?.data || data);
    } catch (err) {
      message.error('ไม่สามารถโหลดรายละเอียดใบงานได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(taskId) || taskId <= 0) {
      message.error('Task ID ไม่ถูกต้อง');
      return;
    }
    load();
  }, [taskId]);

  const line = useMemo(() => task?.lines?.[0] || null, [task]);
  const isClaimedByOther = Boolean(task?.actionBy && currentUserId && task.actionBy !== currentUserId);
  const canUnclaim = Boolean(task?.actionBy && (task.actionBy === currentUserId || canForceUnclaim));

  useEffect(() => {
    if (!task || task.status === 'completed' || isClaimedByOther) return;
    setTimeout(() => {
      fromLocationRef.current?.focus?.();
    }, 120);
  }, [task?.id, task?.status, isClaimedByOther]);

  const handleClaim = async () => {
    if (!task || task.status === 'completed') return;
    if (task.actionBy) return;
    setClaiming(true);
    try {
      await claimWmsTask(task.id);
      await load();
      message.success('เริ่มดำเนินการใบงานแล้ว');
    } catch (err) {
      message.error('ไม่สามารถเริ่มดำเนินการใบงานได้: ' + err.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleUnclaim = async () => {
    if (!task || task.status === 'completed') return;
    if (!task.actionBy) return;
    if (!canUnclaim) {
      message.error('ไม่มีสิทธิ์ unclaim ใบงานนี้');
      return;
    }
    setClaiming(true);
    try {
      await unclaimWmsTask(task.id);
      await load();
      message.success('ยกเลิกการดำเนินการใบงานแล้ว');
    } catch (err) {
      message.error('ไม่สามารถ unclaim ใบงานได้: ' + err.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleResetScan = () => {
    setScanFromLocationCode('');
    setScanFromPalletNo('');
    setScanToLocationCode('');
    setScanToPalletNo('');
  };

  const focusNext = (field) => {
    const nextMap = {
      fromLocation: fromPalletRef.current,
      fromPallet: toLocationRef.current,
      toLocation: toPalletRef.current,
      toPallet: null,
    };
    nextMap[field]?.focus?.();
  };

  const handleOpenScanner = (target) => {
    setScanTarget(target);
    setScannerOpen(true);
  };

  const handleScannedText = (rawText) => {
    const cleanedText = String(rawText || '').trim();
    if (!cleanedText) return;

    if (scanTarget === 'fromLocation') {
      setScanFromLocationCode(cleanedText);
      message.success(`สแกนตำแหน่งต้นทางสำเร็จ: ${cleanedText}`);
      setScannerOpen(false);
      setTimeout(() => focusNext('fromLocation'), 60);
      return;
    }

    if (scanTarget === 'fromPallet') {
      setScanFromPalletNo(cleanedText);
      message.success(`สแกนพาเลทต้นทางสำเร็จ: ${cleanedText}`);
      setScannerOpen(false);
      setTimeout(() => focusNext('fromPallet'), 60);
      return;
    }

    if (scanTarget === 'toLocation') {
      setScanToLocationCode(cleanedText);
      message.success(`สแกนตำแหน่งปลายทางสำเร็จ: ${cleanedText}`);
      setScannerOpen(false);
      setTimeout(() => focusNext('toLocation'), 60);
      return;
    }

    if (scanTarget === 'toPallet') {
      setScanToPalletNo(cleanedText);
      message.success(`สแกนพาเลทปลายทางสำเร็จ: ${cleanedText}`);
      setScannerOpen(false);
      setTimeout(() => focusNext('toPallet'), 60);
    }
  };

  const handleConfirm = async () => {
    if (!task || !line) return;
    if (task.taskType !== 'transfer') {
      message.error('ใบงานนี้ไม่ใช่ใบงานโอนย้าย');
      return;
    }
    if (isClaimedByOther) {
      message.error(`ใบงานนี้กำลังถูกดำเนินการโดย ${task.actionByName || 'ผู้ใช้อื่น'} อยู่แล้ว`);
      return;
    }

    if (normalize(scanFromLocationCode) !== normalize(line.fromLocationCode)) {
      message.error(`ตำแหน่งต้นทางไม่ตรง (แนะนำ: ${line.fromLocationCode || '-'})`);
      return;
    }
    if (!String(scanFromPalletNo || '').trim()) {
      message.error('กรุณาสแกน/กรอกพาเลทต้นทาง');
      return;
    }
    if (normalize(scanToLocationCode) !== normalize(line.toLocationCode)) {
      message.error(`ตำแหน่งปลายทางไม่ตรง (แนะนำ: ${line.toLocationCode || '-'})`);
      return;
    }

    const finalToPalletNo = String(scanToPalletNo || '').trim() || line.palletNo || null;

    setSubmitting(true);
    try {
      if (!task.actionBy) {
        await claimWmsTask(task.id);
      }
      await confirmWmsTask(task.id, {
        lines: [{
          lineId: line.id,
          inventoryUnitId: line.inventoryUnitId,
          quantityCompleted: line.quantityRequired,
          fromLocationId: line.fromLocationId,
          toLocationId: line.toLocationId,
          fromPalletNo: scanFromPalletNo,
          toPalletNo: finalToPalletNo,
        }],
      });
      message.success('ยืนยันการโอนย้ายสำเร็จแล้ว');
      await load();
    } catch (err) {
      message.error('ยืนยันการโอนย้ายไม่สำเร็จ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8">กำลังโหลดข้อมูล...</div>;
  if (!task) return <div className="text-center py-8">ไม่พบใบงาน</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/wms/transfers')} />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Transfer Task #{task.id}</h1>
            <Text type="secondary" className="text-sm">
              {task.warehouseName || '-'} | {task.referenceType ? `${task.referenceType} (${task.referenceId ?? '-'})` : '-'}
            </Text>
          </div>
        </Space>
        <Space>
          <Tag color={task.status === 'completed' ? 'green' : 'orange'}>{task.status}</Tag>
          <Button onClick={handleClaim} disabled={Boolean(task.actionBy) || task.status === 'completed'} loading={claiming}>
            เริ่มดำเนินการ
          </Button>
          {canUnclaim ? (
            <Button danger onClick={handleUnclaim} loading={claiming} disabled={task.status === 'completed'}>
              Unclaim
            </Button>
          ) : null}
        </Space>
      </div>

      <Card className="shadow-sm">
        <div className="flex flex-col gap-2">
          <Text strong>ข้อมูลที่ระบบกำหนด</Text>
          <div className="text-sm text-slate-600">
            ต้นทาง: {line?.fromLocationCode || '-'} | ปลายทาง: {line?.toLocationCode || '-'} | จำนวน: {line?.quantityRequired || 0}
          </div>
          <div className="text-sm text-slate-600">
            พาเลทปลายทาง (ค่าเริ่มต้น): {line?.palletNo || '-'}
          </div>
          {isClaimedByOther ? (
            <Tag color="red" className="w-fit">กำลังถูกดำเนินการโดย {task.actionByName || 'ผู้ใช้อื่น'}</Tag>
          ) : null}
        </div>
      </Card>

      <Card className="shadow-sm">
        <div className="flex flex-col gap-3">
          <Text strong>สแกนต้นทาง</Text>
          <div className="flex gap-2">
            <Input
              placeholder="สแกนรหัสตำแหน่งต้นทาง"
              value={scanFromLocationCode}
              onChange={(e) => setScanFromLocationCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  focusNext('fromLocation');
                }
              }}
              disabled={task.status === 'completed' || isClaimedByOther}
              ref={fromLocationRef}
            />
            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner('fromLocation')} disabled={task.status === 'completed' || isClaimedByOther} />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="สแกนพาเลทต้นทาง (PalletNo/TrackingNo)"
              value={scanFromPalletNo}
              onChange={(e) => setScanFromPalletNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  focusNext('fromPallet');
                }
              }}
              disabled={task.status === 'completed' || isClaimedByOther}
              ref={fromPalletRef}
            />
            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner('fromPallet')} disabled={task.status === 'completed' || isClaimedByOther} />
          </div>

          <Text strong className="pt-2">สแกนปลายทาง</Text>
          <div className="flex gap-2">
            <Input
              placeholder="สแกนรหัสตำแหน่งปลายทาง"
              value={scanToLocationCode}
              onChange={(e) => setScanToLocationCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  focusNext('toLocation');
                }
              }}
              disabled={task.status === 'completed' || isClaimedByOther}
              ref={toLocationRef}
            />
            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner('toLocation')} disabled={task.status === 'completed' || isClaimedByOther} />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="สแกนพาเลทปลายทาง (เว้นว่าง=ใช้ค่าเริ่มต้น)"
              value={scanToPalletNo}
              onChange={(e) => setScanToPalletNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  focusNext('toPallet');
                }
              }}
              disabled={task.status === 'completed' || isClaimedByOther}
              ref={toPalletRef}
            />
            <Button icon={<ScanOutlined />} onClick={() => handleOpenScanner('toPallet')} disabled={task.status === 'completed' || isClaimedByOther} />
          </div>

          <Space className="justify-end pt-2">
            <Button icon={<UndoOutlined />} onClick={handleResetScan} disabled={task.status === 'completed' || isClaimedByOther}>
              ล้างค่า
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleConfirm}
              loading={submitting}
              disabled={task.status === 'completed' || isClaimedByOther}
            >
              ยืนยันการโอนย้าย
            </Button>
          </Space>
        </div>
      </Card>

      <Modal
        title={`สแกนคิวอาร์โค้ด / บาร์โค้ด (${scanTarget === 'fromLocation' || scanTarget === 'toLocation' ? 'ตำแหน่งสินค้า' : 'พาเลท'})`}
        open={scannerOpen}
        onCancel={() => setScannerOpen(false)}
        footer={null}
        destroyOnClose
        width={400}
      >
        <div style={{ width: '100%', maxWidth: '350px', margin: '0 auto' }}>
          <Scanner
            onScan={(result) => {
              if (!result || result.length === 0) return;
              const text = result[0]?.rawValue || result[0]?.text || '';
              handleScannedText(text);
            }}
            onError={(err) => {
              console.error(err);
              message.error('ไม่สามารถเปิดกล้องได้: ' + err.message);
            }}
          />
          <div className="text-center mt-4 text-slate-500 text-xs">
            วางบาร์โค้ดหรือคิวอาร์โค้ดให้อยู่ในกรอบของกล้อง
          </div>
        </div>
      </Modal>
    </div>
  );
}
