import React, { useEffect, useState, useRef } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography, message, Modal, Checkbox } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, PrinterOutlined, BranchesOutlined, ScanOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useWms } from '../../context/WmsContext.jsx';
import { useMasterData } from '../../context/MasterDataContext.jsx';
import { Scanner } from '@yudiel/react-qr-scanner';

const { Title, Text, Paragraph } = Typography;

export default function WavePickingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getWmsWaveDetail, getWarehouseLocations, confirmWmsTask, allocateWaveInventory, splitWmsTaskLine } = useWms();
  const { lookups, fetchLookups } = useMasterData();
  const grades = lookups.grades || [];

  const [wave, setWave] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [lineInputs, setLineInputs] = useState({}); // WmsTaskLineId -> { qtyCompleted, lotNo, locationId, palletNo, scannedLocationCode, isPicked, condition }

  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitQty, setSplitQty] = useState(1);
  const [activeLineToSplit, setActiveLineToSplit] = useState(null);

  // Handheld Picking Modal States
  const [pickingModalOpen, setPickingModalOpen] = useState(false);
  const [activePickingLine, setActivePickingLine] = useState(null);
  const [pickedLocationCode, setPickedLocationCode] = useState('');
  const [pickedPalletNo, setPickedPalletNo] = useState('');
  const [pickedQty, setPickedQty] = useState(1);
  const [pickedCondition, setPickedCondition] = useState('good');
  const [overrideActive, setOverrideActive] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState('location');

  // Input Refs for focusing flow
  const locationInputRef = useRef(null);
  const palletInputRef = useRef(null);
  const qtyInputRef = useRef(null);

  const fetchWaveDetails = async () => {
    setLoading(true);
    try {
      const waveData = await getWmsWaveDetail(id);
      setWave(waveData);

      // Initialize inputs
      const initialInputs = {};
      waveData?.tasks?.forEach(task => {
        task.lines?.forEach(line => {
          initialInputs[line.id] = {
            qtyCompleted: line.quantityCompleted || line.quantityRequired,
            lotNo: line.lotNo || '',
            locationId: line.fromLocationId || undefined,
            palletNo: line.palletNo || ''
          };
        });
      });
      setLineInputs(initialInputs);

      // Load locations if tasks have warehouse
      if (waveData?.tasks?.length > 0) {
        const whId = waveData.tasks[0].warehouseId;
        const locData = await getWarehouseLocations(whId);
        setLocations(locData || []);
      }
    } catch (err) {
      message.error('โหลดรายละเอียดคลื่นงานไม่สำเร็จ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaveDetails();
    fetchLookups();
  }, [id, fetchLookups]);

  // Focus location input when modal opens
  useEffect(() => {
    if (pickingModalOpen) {
      setTimeout(() => {
        locationInputRef.current?.focus();
      }, 150);
    }
  }, [pickingModalOpen]);

  const handleLocationKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      palletInputRef.current?.focus();
    }
  };

  const handlePalletKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      qtyInputRef.current?.focus();
    }
  };

  const openPickingModal = (line) => {
    const inputs = lineInputs[line.id] || {};
    setActivePickingLine(line);
    setPickedLocationCode(inputs.scannedLocationCode || '');
    setPickedPalletNo(inputs.palletNo || '');
    setPickedQty(inputs.qtyCompleted || line.quantityRequired);
    setPickedCondition(inputs.condition || 'good');
    setOverrideActive(false);
    setPickingModalOpen(true);
  };

  const handleConfirmLine = (line, next = false) => {
    const scannedLoc = pickedLocationCode.trim();
    const scannedPallet = pickedPalletNo.trim();

    const recommendedLocCode = line.fromLocationCode || '';
    const recommendedPallet = line.palletNo || '';

    const locMismatch = recommendedLocCode && scannedLoc.toLowerCase() !== recommendedLocCode.toLowerCase();
    const palletMismatch = recommendedPallet && scannedPallet.toLowerCase() !== recommendedPallet.toLowerCase();

    if ((locMismatch || palletMismatch) && !overrideActive) {
      message.error(`พิกัดหรือพาเลทไม่ตรงกับคำแนะนำ! (แนะนำ: พิกัด ${recommendedLocCode || '-'}, พาเลท ${recommendedPallet || '-'}). กรุณาเปิดใช้งานระบบข้ามการตรวจสอบ (Override) หากต้องการยืนยันค่าต่าง`);
      return;
    }

    // Find locationId matching scannedLoc
    let finalLocationId = line.fromLocationId;
    if (scannedLoc) {
      const matchedLoc = locations.find(loc => loc.label.toLowerCase() === scannedLoc.toLowerCase());
      if (matchedLoc) {
        finalLocationId = matchedLoc.value;
      } else if (!overrideActive) {
        message.error(`ไม่พบรหัสตำแหน่ง "${scannedLoc}" ในระบบคลังสินค้า!`);
        return;
      }
    }

    // Update lineInputs
    setLineInputs(prev => ({
      ...prev,
      [line.id]: {
        ...prev[line.id],
        qtyCompleted: pickedQty,
        locationId: finalLocationId,
        scannedLocationCode: scannedLoc,
        palletNo: scannedPallet,
        isPicked: true,
        condition: pickedCondition
      }
    }));

    message.success(`บันทึกการหยิบสินค้าแถว ${line.itemCode} สำเร็จ`);

    if (next) {
      const currentIndex = allLines.findIndex(l => l.id === line.id);
      const nextLine = allLines.slice(currentIndex + 1).find(l => l.taskStatus !== 'completed');
      if (nextLine) {
        openPickingModal(nextLine);
      } else {
        setPickingModalOpen(false);
        message.info('หยิบสินค้าครบทุกแถวในคลื่นงานนี้แล้ว!');
      }
    } else {
      setPickingModalOpen(false);
    }
  };

  const handleClearInputs = () => {
    Modal.confirm({
      title: 'ยืนยันการล้างข้อมูลที่กรอกทั้งหมด?',
      content: 'การดำเนินการนี้จะรีเซ็ตจำนวนที่หยิบและตำแหน่งที่ระบุทั้งหมดในหน้านี้กลับเป็นค่าเริ่มต้น',
      okText: 'ล้างข้อมูล',
      okType: 'danger',
      cancelText: 'ยกเลิก',
      onOk: () => {
        const initialInputs = {};
        wave?.tasks?.forEach(task => {
          task.lines?.forEach(line => {
            initialInputs[line.id] = {
              qtyCompleted: line.quantityCompleted || line.quantityRequired,
              lotNo: line.lotNo || '',
              locationId: line.fromLocationId || undefined,
              palletNo: line.palletNo || '',
              isPicked: false,
              condition: 'good'
            };
          });
        });
        setLineInputs(initialInputs);
        message.success('ล้างข้อมูลเรียบร้อยแล้ว');
      }
    });
  };

  const handleConfirmWaveWithConfirm = () => {
    Modal.confirm({
      title: 'ยืนยันการหยิบคลื่นใบงานนี้?',
      content: 'กรุณาตรวจสอบให้มั่นใจว่าสแกนพิกัดและหยิบสินค้าตามจำนวนที่ถูกต้องครบถ้วนแล้ว ระบบจะทำการอัปเดตและสร้างเอกสารที่เกี่ยวข้อง',
      okText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      onOk: () => {
        handleConfirmWave();
      }
    });
  };

  const handleInputChange = (lineId, field, value) => {
    setLineInputs(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value
      }
    }));
  };

  const handleConfirmWave = async () => {
    // console.log("wave", wave);
    if (!wave) return;
    setSubmitting(true);
    try {
      for (const task of wave.tasks) {
        if (task.status === 'completed') continue;

        const taskLines = task.lines.map(line => {
          const inputs = lineInputs[line.id] || {};
          return {
            lineId: line.id,
            quantityCompleted: inputs.qtyCompleted,
            lotId: line.lotId || null,
            fromLocationId: inputs.locationId || null,
            toLocationId: line.toLocationId || null,
            inventoryUnitId: line.inventoryUnitId || null,
            palletNo: inputs.palletNo || null
          };
        });

        await confirmWmsTask(task.id, {
          lines: taskLines
        });
      }
      message.success('ยืนยันหยิบสินค้าคลื่นใบงานสำเร็จ! ใบส่งสินค้า (DO) ได้ถูกสร้างแล้ว');
      fetchWaveDetails();
    } catch (err) {
      message.error('ยืนยันหยิบสินค้าล้มเหลว: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReallocate = async () => {
    if (!wave) return;
    setSubmitting(true);
    try {
      await allocateWaveInventory(wave.id);
      message.success('คำนวณตำแหน่งและ Lot แนะนำ (FIFO) ใหม่สำเร็จ!');
      fetchWaveDetails();
    } catch (err) {
      message.error('คำนวณใหม่ล้มเหลว: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const showSplitModal = (lineId, taskId, maxQty, taskNo) => {
    setActiveLineToSplit({ lineId, taskId, maxQty, taskNo });
    setSplitQty(1);
    setIsSplitModalOpen(true);
  };

  const handleSplitLine = async () => {
    if (!activeLineToSplit) return;
    const { taskId, lineId, maxQty } = activeLineToSplit;

    if (splitQty <= 0 || splitQty >= maxQty) {
      message.error(`จำนวนที่แยกต้องมากกว่า 0 และน้อยกว่า ${maxQty}`);
      return;
    }

    setSubmitting(true);
    try {
      await splitWmsTaskLine(taskId, lineId, splitQty);
      message.success('แยกรายการหยิบสินค้าสำเร็จ!');
      setIsSplitModalOpen(false);
      fetchWaveDetails();
    } catch (err) {
      message.error('แยกรายการล้มเหลว: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8">กำลังโหลดข้อมูล...</div>;
  if (!wave) return <div className="text-center py-8">ไม่พบข้อมูลคลื่นงาน</div>;

  const allLines = [];
  wave.tasks?.forEach(task => {
    task.lines?.forEach(line => {
      allLines.push({
        ...line,
        taskNo: `Task #${task.id}`,
        taskId: task.id,
        taskRef: task.referenceType ? `${task.referenceType} (ID: ${task.referenceId})` : '-',
        taskStatus: task.status,
        warehouseName: task.warehouseName
      });
    });
  });

  const columns = [
    {
      title: 'การหยิบสินค้า',
      key: 'handheldPick',
      width: 100,
      align: 'center',
      render: (_, r) => {
        if (r.taskStatus === 'completed') {
          return <Tag color="green">เสร็จสิ้น</Tag>;
        }
        const picked = lineInputs[r.id]?.isPicked;
        return (
          <Button
            icon={<ScanOutlined />}
            type={picked ? 'primary' : 'default'}
            ghost={picked}
            size="small"
            style={{
              borderColor: picked ? '#52c41a' : undefined,
              color: picked ? '#52c41a' : undefined,
              backgroundColor: picked ? '#f6ffed' : undefined
            }}
            onClick={() => openPickingModal(r)}
          >
            {picked ? 'หยิบเสร็จแล้ว' : 'สแกน/หยิบ'}
          </Button>
        );
      }
    },
    {
      title: 'ใบสั่งงาน',
      dataIndex: 'taskNo',
      width: 100,
      key: 'taskNo',
      render: (text, r) => (
        <Space direction="vertical" size="0">
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{r.taskRef}</Text>
        </Space>
      )
    },
    {
      title: 'สินค้า',
      dataIndex: 'itemName',
      width: 300,
      key: 'itemName',
      render: (name, r) => (
        <Space direction="vertical" size="0">
          <Text strong>{r.itemCode}</Text>
          <Text type="secondary">{name}</Text>
          {r.remark && (
            <Text style={{ color: '#fa8c16', fontSize: '12px' }}>
              [หมายเหตุ: {r.remark}]
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'เลขที่ Lot',
      key: 'lotNo',
      render: (_, r) => (
        <Text>{r.lotNo || '-'}</Text>
      )
    },
    {
      title: 'จำนวนต้องหยิบ',
      width: 120,
      dataIndex: 'quantityRequired',
      key: 'quantityRequired',
      render: (qty) => <Text>{qty} แผ่น</Text>
    },
    {
      title: 'จำนวนหยิบจริง',
      key: 'qtyCompleted',
      render: (_, r) => {
        const val = lineInputs[r.id]?.qtyCompleted ?? r.quantityRequired;
        return r.taskStatus === 'completed' ? (
          <Text>{r.quantityCompleted} แผ่น</Text>
        ) : (
          <InputNumber
            size='small'
            min={0}
            value={val}
            onChange={(v) => handleInputChange(r.id, 'qtyCompleted', v)}
            style={{ width: '100px' }}
          />
        );
      }
    },
    {
      title: 'ระบุตำแหน่งคลัง',
      width: 100,
      key: 'locationId',
      render: (_, r) => {
        const val = lineInputs[r.id]?.locationId;
        const isSuggested = val && r.fromLocationId && val === r.fromLocationId && !r.quantityCompleted;
        return r.taskStatus === 'completed' ? (
          <Text>{r.fromLocationCode || '-'}</Text>
        ) : (
          <Select
            size='small'
            placeholder="เลือกตำแหน่ง"
            options={locations}
            value={val}
            onChange={(v) => handleInputChange(r.id, 'locationId', v)}
            style={{ width: '120px', border: isSuggested ? '1px solid #52c41a' : undefined, borderRadius: isSuggested ? '6px' : undefined }}
            allowClear
          />
        );
      }
    },
    {
      title: 'ระบุพาเลท',
      key: 'palletNo',
      render: (_, r) => {
        const val = lineInputs[r.id]?.palletNo ?? '';
        const isSuggested = val && r.palletNo && val.trim().toLowerCase() === r.palletNo.trim().toLowerCase() && !r.quantityCompleted;
        return r.taskStatus === 'completed' ? (
          <Text>{r.palletNo || '-'}</Text>
        ) : (
          <Input
            size='small'
            placeholder="เลขพาเลท"
            value={val}
            onChange={(e) => handleInputChange(r.id, 'palletNo', e.target.value)}
            style={{ width: '120px', borderColor: isSuggested ? '#52c41a' : undefined }}
          />
        );
      }
    },
    {
      title: 'แยกรายการ',
      key: 'actions',
      render: (_, r) => {
        const canSplit = r.taskStatus !== 'completed' && r.quantityRequired > 1;
        return (
          <Space>
            {canSplit && (
              <Button
                icon={<BranchesOutlined />}
                size="small"
                type="primary"
                onClick={() => showSplitModal(r.id, r.taskId, r.quantityRequired, r.taskNo)}
              >
                กดแยก
              </Button>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Space size="middle">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/wms/picking')} />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              Wave Picking: {wave.waveNo}
            </h1>
          </div>
        </Space>
        <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
          <Button
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/document/print?form=WAVE&docId=${wave.id}`, '_blank')}
            className="hidden sm:inline-flex"
          >
            พิมพ์ใบจัดกลุ่มหยิบสินค้า
          </Button>
          {wave.status !== 'completed' && (
            <>
              <Button
                onClick={handleReallocate}
                loading={submitting}
                className="hidden sm:inline-flex"
              >
                คำนวณตำแหน่งใหม่ (Re-allocate)
              </Button>
              <Button
                icon={<UndoOutlined />}
                onClick={handleClearInputs}
                danger
              >
                ล้างค่า
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleConfirmWaveWithConfirm}
                loading={submitting}
              >
                ยืนยันการหยิบคลื่นนี้
              </Button>
            </>
          )}
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="shadow-sm">
            <Row gutter={[32, 16]}>
              <Col xs={24} sm={8}>
                <Text type="secondary">สถานะกลุ่ม Wave</Text>
                <div className="mt-1">
                  <Tag color={wave.status === 'completed' ? 'green' : 'orange'} style={{ fontSize: '14px', padding: '4px 10px' }}>
                    {wave.status === 'completed' ? 'เสร็จสิ้นครบถ้วน' : 'กำลังดำเนินการ'}
                  </Tag>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">วันที่สร้าง</Text>
                <div className="mt-1 text-base font-medium">
                  {new Date(wave.createdAt).toLocaleString('th-TH')}
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">ผู้บันทึก Wave</Text>
                <div className="mt-1 text-base font-medium">
                  {wave.createdByName || '-'}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="รายการสินค้าที่จัดกลุ่มในคลื่นงานนี้" className="shadow-sm">
            <Table
              columns={columns}
              dataSource={allLines.map((l) => ({ ...l, key: l.id }))}
              pagination={false}
              size='small'
              scroll={{ x: 1300 }}
              rowClassName={(record) => lineInputs[record.id]?.isPicked ? 'bg-green-50 font-medium' : ''}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={`แยกรายการหยิบสินค้า (${activeLineToSplit?.taskNo || ''})`}
        open={isSplitModalOpen}
        onOk={handleSplitLine}
        onCancel={() => setIsSplitModalOpen(false)}
        okButtonProps={{ loading: submitting }}
        destroyOnClose
      >
        <div className="py-4">
          <Paragraph>
            ระบุจำนวนที่ต้องการแยกออกไปเป็นแถวใหม่ (สูงสุดไม่เกิน {activeLineToSplit ? activeLineToSplit.maxQty - 1 : 0} แผ่น):
          </Paragraph>
          <Form layout="vertical">
            <Form.Item label="จำนวนที่จะแยก (แผ่น)" required>
              <InputNumber
                min={1}
                max={activeLineToSplit ? activeLineToSplit.maxQty - 1 : 1}
                value={splitQty}
                onChange={setSplitQty}
                className="w-full"
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* Modal ยืนยันการหยิบสินค้าผ่าน Handheld */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800 border-b pb-2">
            <Title level={4} style={{ margin: 0 }}>ยืนยันการหยิบสินค้า (Handheld Pick)</Title>
          </div>
        }
        open={pickingModalOpen}
        onCancel={() => setPickingModalOpen(false)}
        footer={null}
        width={500}
        destroyOnClose
      >
        {activePickingLine && (
          <div className="space-y-5 pt-3">
            {/* รายละเอียดสินค้า */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-xs text-slate-400">สินค้า (Product Info)</div>
              <div className="text-base font-semibold text-slate-800">
                {activePickingLine.salesSKU || activePickingLine.itemCode}
              </div>
              <div className="text-sm text-slate-600">
                {activePickingLine.itemName}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                <div>
                  <div className="text-xs text-slate-400">แนะนำตำแหน่ง</div>
                  <Tag color="blue" className="mt-1 text-sm font-medium">
                    {activePickingLine.fromLocationCode || '-'}
                  </Tag>
                </div>
                <div>
                  <div className="text-xs text-slate-400">แนะนำพาเลท / Lot</div>
                  <Tag color="cyan" className="mt-1 text-sm font-medium">
                    {activePickingLine.palletNo || '-'}
                  </Tag>
                </div>
              </div>
            </div>

            {/* ช่องระบุ Location */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 block">
                1. สแกนพิกัดต้นทาง (Scan Location) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  ref={locationInputRef}
                  placeholder="สแกนหรือพิมพ์พิกัด..."
                  value={pickedLocationCode}
                  onChange={(e) => setPickedLocationCode(e.target.value)}
                  onKeyDown={handleLocationKeyDown}
                  className="font-mono text-base"
                />
                <Button
                  icon={<ScanOutlined />}
                  onClick={() => {
                    setScanTarget('location');
                    setScannerOpen(true);
                  }}
                  className="flex items-center justify-center"
                />
              </div>
            </div>

            {/* ช่องระบุ Pallet */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 block">
                2. สแกนเลขพาเลท (Scan Pallet) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  ref={palletInputRef}
                  placeholder="สแกนหรือพิมพ์พาเลท..."
                  value={pickedPalletNo}
                  onChange={(e) => setPickedPalletNo(e.target.value)}
                  onKeyDown={handlePalletKeyDown}
                  className="font-mono text-base"
                />
                <Button
                  icon={<ScanOutlined />}
                  onClick={() => {
                    setScanTarget('pallet');
                    setScannerOpen(true);
                  }}
                  className="flex items-center justify-center"
                />
              </div>
            </div>

            {/* จำนวนหยิบ */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 block">
                3. จำนวนสินค้าที่หยิบ (Quantity)
              </label>
              <InputNumber
                ref={qtyInputRef}
                min={0}
                max={activePickingLine.quantityRequired * 2}
                value={pickedQty}
                onChange={setPickedQty}
                size="large"
                className="w-full text-lg font-bold"
                style={{ textAlign: 'center' }}
              />
              <div className="text-xs text-slate-400 text-right">
                จำนวนที่ต้องการ: {activePickingLine.quantityRequired} แผ่น
              </div>
            </div>

            {/* สภาพสินค้า */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 block">
                4. สภาพสินค้า (Item Condition)
              </label>
              <Select
                value={pickedCondition}
                onChange={setPickedCondition}
                className="w-full"
                options={[
                  { value: 'good', label: 'ปกติ (Good)' },
                  { value: 'damaged', label: 'ชำรุด (Damaged)' },
                  { value: 'missing', label: 'สต็อกหาย (Missing)' },
                ]}
              />
            </div>

            {/* Override System Check */}
            <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-100 text-xs text-amber-700">
              <Checkbox
                checked={overrideActive}
                onChange={(e) => setOverrideActive(e.target.checked)}
              />
              <span>
                ข้ามระบบตรวจสอบ (Override) ยอมรับการหยิบจากตำแหน่ง/พาเลทที่ต่างจากคำแนะนำ
              </span>
            </div>

            {/* ปุ่มกดเสร็จสิ้น / ถัดไป */}
            <div className="flex gap-3 pt-3 border-t">
              <Button
                onClick={() => handleConfirmLine(activePickingLine, false)}
                className="flex-1"
                size="large"
              >
                ยืนยัน-จบ
              </Button>
              {allLines.findIndex(l => l.id === activePickingLine.id) < allLines.length - 1 && (
                <Button
                  type="primary"
                  onClick={() => handleConfirmLine(activePickingLine, true)}
                  className="flex-1"
                  size="large"
                >
                  เสร็จ-ถัดไป
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal เปิดกล้องหลังเพื่อสแกน QR/Barcode */}
      <Modal
        title={`สแกนคิวอาร์โค้ด / บาร์โค้ด (${scanTarget === 'location' ? 'ตำแหน่งสินค้า' : 'พาเลท'})`}
        open={scannerOpen}
        onCancel={() => setScannerOpen(false)}
        footer={null}
        destroyOnClose
        width={400}
      >
        <div style={{ width: '100%', maxWidth: '350px', margin: '0 auto' }}>
          <Scanner
            onScan={(result) => {
              if (result && result.length > 0) {
                const text = result[0]?.rawValue || result[0]?.text || '';
                if (text) {
                  if (scanTarget === 'location') {
                    setPickedLocationCode(text);
                  } else {
                    setPickedPalletNo(text);
                  }
                  setScannerOpen(false);
                  message.success(`สแกนสำเร็จ: ${text}`);
                }
              }
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
