import React, { useEffect, useState, useRef } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography, message, Tooltip, Pagination } from 'antd';
import { AppstoreOutlined, ArrowRightOutlined, CheckCircleOutlined, FileExcelFilled, InfoCircleOutlined, PlayCircleOutlined, SearchOutlined, ScanOutlined } from '@ant-design/icons';
import { useWms } from '../../context/WmsContext.jsx';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title, Text } = Typography;

export default function Receiving() {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const roles = user?.roles || [];
  const canForceUnclaim = roles.includes('admin') || roles.includes('warehouse_manager');
  const { getWmsTasks, claimWmsTask, unclaimWmsTask, confirmWmsTask, getWarehouseLocations, getWmsTaskDetail, getLastLocation } = useWms();

  const [tasks, setTasks] = useState([]);
  const [taskPage, setTaskPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [locations, setLocations] = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();

  // Line values state to manage inputs dynamically
  const [lineInputs, setLineInputs] = useState({});

  // Refs for focusing select inputs
  const selectRefs = useRef({});

  // Refs for focusing pallet inputs
  const palletRefs = useRef({});

  // Refs for card elements and modal scroll container (to scroll next row into view)
  const cardRefs = useRef({});
  const modalContentRef = useRef(null);

  // Last locations for items without recommended toLocationId
  const [lastLocations, setLastLocations] = useState({});

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState('pallet'); // 'pallet' or 'location'
  const [scannedLineId, setScannedLineId] = useState(null);

  const handleOpenScanner = (target, lineId) => {
    setScanTarget(target);
    setScannedLineId(lineId);
    setScannerOpen(true);
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await getWmsTasks({ status: 'open', taskType: 'putaway' });
      setTasks(res.data || []);
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูลงานรับสินค้าเข้าคลังได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (isModalVisible && selectedTask && selectedTask.lines && selectedTask.lines.length > 0) {
      const firstLineId = selectedTask.lines[0].id;
      setTimeout(() => {
        if (selectRefs.current[firstLineId] && typeof selectRefs.current[firstLineId].focus === 'function') {
          selectRefs.current[firstLineId].focus();
        }
      }, 150);
    }
  }, [isModalVisible, selectedTask]);

  useEffect(() => {
    if (!isModalVisible) {
      selectRefs.current = {};
      palletRefs.current = {};
      cardRefs.current = {};
    }
  }, [isModalVisible]);

  const loadLocations = async (warehouseId) => {
    setLoadingLocs(true);
    try {
      const res = await getWarehouseLocations(warehouseId);
      setLocations(res || []);
    } catch (err) {
      message.error('ไม่สามารถโหลดรายการตำแหน่งคลังได้: ' + err.message);
    } finally {
      setLoadingLocs(false);
    }
  };

  const handleOpenConfirm = async (task) => {
    if (task?.actionBy && currentUserId && task.actionBy !== currentUserId) {
      message.error(`งานนี้กำลังถูกดำเนินการโดย ${task.actionByName || 'ผู้ใช้อื่น'} อยู่แล้ว`);
      return;
    }

    try {
      await claimWmsTask(task.id);
    } catch (err) {
      message.error('ไม่สามารถเริ่มดำเนินการใบงานนี้ได้: ' + err.message);
      return;
    }

    setSelectedTask(task);
    await loadLocations(task.warehouseId);

    // Fetch task detail to get the lines
    setLoading(true);
    try {
      const taskDetail = await getWmsTaskDetail(task.id);
      console.log("taskDetail", taskDetail);
      setSelectedTask(taskDetail);

      // Initialize inputs for each line
      const initialInputs = {};
      const lastLocsMap = {};

      for (const line of taskDetail.lines) {
        initialInputs[line.id] = {
          lineId: line.id,
          palletId: '',
          toLocationId: undefined,
          quantityCompleted: line.quantityRequired - line.quantityCompleted,
        };

        if (!line.toLocationId) {
          try {
            const locRes = await getLastLocation({
              itemId: line.itemId,
              itemSpecId: line.itemSpecId,
              warehouseId: task.warehouseId
            });
            if (locRes && locRes.data) {
              lastLocsMap[line.id] = locRes.data; // e.g. { locationId: 5, locationCode: 'A-01-02-03' }
            }
          } catch (err) {
            console.error('Error fetching last location for line', line.id, err);
          }
        }
      }
      setLastLocations(lastLocsMap);
      setLineInputs(initialInputs);
      setIsModalVisible(true);
    } catch (err) {
      message.error('ไม่สามารถโหลดรายละเอียดงานได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnclaimTask = async (taskId) => {
    try {
      await unclaimWmsTask(taskId);
      message.success('ยกเลิกการดำเนินการใบงานเรียบร้อยแล้ว');
      setIsModalVisible(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (err) {
      message.error('ไม่สามารถยกเลิกการดำเนินการใบงานได้: ' + err.message);
    }
  };

  const handleLineInputChange = (lineId, field, value) => {
    setLineInputs(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value
      }
    }));
  };

  const focusLineField = (lineId, field) => {
    if (field === 'location') {
      const ref = selectRefs.current[lineId];
      if (ref && typeof ref.focus === 'function') {
        ref.focus();
      }
      return;
    }

    if (field === 'pallet') {
      const ref = palletRefs.current[lineId];
      if (ref && typeof ref.focus === 'function') {
        ref.focus();
      }
    }
  };

  // Focus flow: from location -> pallet in same row; from pallet -> next row location
  const focusNextLine = (currentLineId, fromField = 'location') => {
    if (!selectedTask || !selectedTask.lines) return;
    const lines = selectedTask.lines;
    const idx = lines.findIndex(l => l.id === currentLineId);
    if (idx === -1) return;

    if (fromField === 'location') {
      // Same row: move from location select to pallet input after dropdown close
      setTimeout(() => focusLineField(currentLineId, 'pallet'), 60);
      return;
    }

    const next = lines[idx + 1];
    if (!next) return;
    const nextId = next.id;

    // Scroll next card into view inside modal
    try {
      const el = cardRefs.current[nextId];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } else if (modalContentRef.current && el) {
        modalContentRef.current.scrollTop = el.offsetTop - 24;
      }
    } catch (err) {
      // ignore
    }

    setTimeout(() => {
      try {
        focusLineField(nextId, 'location');
      } catch (err) {
        // ignore
      }
    }, 220);
  };

  const handleConfirmPutaway = async () => {
    if (!selectedTask) return;

    // Validate that all lines have a pallet ID entered/scanned
    const linesToSubmit = Object.values(lineInputs);
    const missingPallet = linesToSubmit.some(line => !line.palletId || !String(line.palletId).trim());
    if (missingPallet) {
      message.warning('กรุณาสแกนหรือระบุหมายเลขพาเลทจริงให้ครบทุกรายการ');
      return;
    }

    // Validate that all lines have a location selected
    const missingLoc = linesToSubmit.some(line => !line.toLocationId);
    if (missingLoc) {
      message.warning('กรุณาเลือกตำแหน่งเก็บจริงให้ครบทุกรายการ');
      return;
    }

    // Check if any value differs from the recommended values
    let hasMismatch = false;
    selectedTask.lines.forEach((line) => {
      const lineInput = lineInputs[line.id];
      if (!lineInput) return;

      const recPallet = line.palletNo || `PLT${line.lotNo || ''}`;

      // Mismatch check for Pallet ID
      if (String(lineInput.palletId || '').trim() !== String(recPallet).trim()) {
        hasMismatch = true;
      }

      // Mismatch check for Target Location
      if (line.toLocationId) {
        if (lineInput.toLocationId !== line.toLocationId) {
          hasMismatch = true;
        }
      }
    });

    const executeConfirm = async () => {
      setConfirmLoading(true);
      try {
        // Format lines payload for API
        const linesPayload = linesToSubmit.map(line => ({
          lineId: line.lineId,
          quantityCompleted: line.quantityCompleted,
          toLocationId: line.toLocationId,
          // Send palletId as palletNo/trackingNo reference
          palletId: line.palletId
        }));

        await confirmWmsTask(selectedTask.id, { lines: linesPayload });
        message.success('คอนเฟิร์มจัดเก็บเข้าตำแหน่งสำเร็จ!');
        setIsModalVisible(false);
        fetchTasks();
      } catch (err) {
        message.error('เกิดข้อผิดพลาดในการคอนเฟิร์มจัดเก็บ: ' + err.message);
      } finally {
        setConfirmLoading(false);
      }
    };

    if (hasMismatch) {
      Modal.confirm({
        title: 'ยืนยันการจัดเก็บ (ข้อมูลต่างจากคำแนะนำ)',
        content: 'พบว่าหมายเลขพาเลท หรือตำแหน่งจัดเก็บสินค้าแตกต่างจากค่าที่ระบบแนะนำ! คุณแน่ใจหรือไม่ว่าต้องการจัดเก็บเข้าชั้นวางตามพิกัดนี้?',
        okText: 'ยืนยันบันทึกข้อมูล',
        cancelText: 'ยกเลิกเพื่อตรวจสอบ',
        okButtonProps: { className: 'bg-indigo-600 border-none' },
        onOk: () => {
          executeConfirm();
        }
      });
    } else {
      await executeConfirm();
    }
  };

  const columns = [
    {
      title: 'เลขที่ใบงาน WMS',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text strong className="text-slate-700">Task #{id}</Text>,
    },
    {
      title: 'ประเภทใบงาน',
      dataIndex: 'taskTypeName',
      key: 'taskTypeName',
      render: (text) => <Tag color="gold" className="px-2 py-0.5 font-medium">{text || 'Putaway'}</Tag>,
    },
    {
      title: 'อ้างอิงเอกสารรับเข้า',
      key: 'reference',
      render: (_, r) => r.referenceType ? (
        <span className="font-semibold text-sky-600">
          {r.referenceType} (ID: {r.referenceId})
        </span>
      ) : '-',
    },
    {
      title: 'คลังสินค้าปลายทาง',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      render: (text) => <span className="text-slate-600">{text}</span>,
    },
    {
      title: 'ผู้ดำเนินการ',
      key: 'actionBy',
      render: (_, r) => (
        <span className="text-slate-600">
          {r.actionByName || '-'}
          {r.actionAt ? ` (${new Date(r.actionAt).toLocaleString('th-TH')})` : ''}
        </span>
      ),
    },
    {
      title: 'วันที่มอบหมาย',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => <span className="text-slate-500">{new Date(date).toLocaleString('th-TH')}</span>,
    },
    {
      fixed: 'right',
      title: 'การจัดการ',
      width: 250,
      key: 'action',
      render: (_, r) => (
        <Space>
          <Button
            size='small'
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handleOpenConfirm(r)}
            disabled={Boolean(r.actionBy && currentUserId && r.actionBy !== currentUserId)}
            className="bg-indigo-600 hover:bg-indigo-700 border-none shadow-sm rounded-md"
          >
            ดำเนินการจัดเก็บ
          </Button>
          {r.actionBy && (r.actionBy === currentUserId || canForceUnclaim) ? (
            <Button
              size="small"
              danger
              onClick={() => handleUnclaimTask(r.id)}
            >
              Unclaim
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-slate-800">
          ระบบรับสินค้าเข้าคลัง (WMS Receiving & Putaway)
        </h1>
        <Text type="secondary" className="text-sm">
          จัดการสแกนและยืนยันตำแหน่งจัดเก็บพาเลทสินค้าบนชั้นวาง (Racks) จากใบงานนำส่งเข้าคลัง (Putaway Tasks)
        </Text>
      </div>

      <Card className="shadow-md border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <InfoCircleOutlined className="text-indigo-500" />
          <Text strong className="text-slate-700">รายการใบงาน Putaway ที่รอดำเนินการ</Text>
        </div>

        <div className="flex justify-end items-center gap-4 mb-2">
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
        <Table
          size="small"
          columns={columns}
          dataSource={tasks.slice((taskPage - 1) * pageSize, taskPage * pageSize).map(t => ({ ...t, key: t.id }))}
          loading={loading && !isModalVisible}
          pagination={false}
          scroll={{ x: 1200 }}
          locale={{ emptyText: 'ไม่พบรายการงานรับเข้าที่รอจัดเก็บ' }}
          className="rounded-lg overflow-hidden border border-slate-50 border-t-0"
        />
      </Card>

      {/* Putaway Confirmation Modal */}
	      <Modal
        title={
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <AppstoreOutlined className="text-indigo-600 text-lg" />
            <span className="text-lg font-bold text-slate-800">
              ดำเนินการนำเก็บสินค้าเข้าตำแหน่ง (Putaway Confirm) - Task #{selectedTask?.id}
            </span>
          </div>
        }
	        open={isModalVisible}
	        onCancel={() => setIsModalVisible(false)}
	        confirmLoading={confirmLoading}
	        width={950}
	        okText="ยืนยันจัดเก็บเข้าคลังทั้งหมด"
	        cancelText="ยกเลิก"
        okButtonProps={{
          className: "bg-indigo-600 hover:bg-indigo-700 border-none px-5 rounded-md",
        }}
	        cancelButtonProps={{
	          className: "rounded-md",
	        }}
          footer={
            <Space className="w-full justify-end">
              <Button onClick={() => setIsModalVisible(false)}>
                ยกเลิก
              </Button>
              {selectedTask?.actionBy && (selectedTask.actionBy === currentUserId || canForceUnclaim) ? (
                <Button danger onClick={() => handleUnclaimTask(selectedTask.id)} disabled={confirmLoading}>
                  Unclaim
                </Button>
              ) : null}
              <Button
                type="primary"
                onClick={handleConfirmPutaway}
                loading={confirmLoading}
                className="bg-indigo-600 hover:bg-indigo-700 border-none px-5 rounded-md"
              >
                ยืนยันจัดเก็บเข้าคลังทั้งหมด
              </Button>
            </Space>
          }
	      >
        <div ref={modalContentRef} className="py-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col md:flex-row justify-between gap-3 text-sm">
            <div>
              <Text type="secondary">คลังสินค้า: </Text>
              <Text strong className="text-slate-700">{selectedTask?.warehouseName}</Text>
            </div>
            <div>
              <Text type="secondary">อ้างอิงเอกสารรับ: </Text>
              <Text strong className="text-slate-700">{selectedTask?.referenceType} (ID: {selectedTask?.referenceId})</Text>
            </div>
          </div>

          <Title level={5} className="m-0 text-slate-700">รายการสินค้าในใบงาน:</Title>

          {selectedTask?.lines?.map((line) => {
            const lineInput = lineInputs[line.id] || {};
            return (
              <Card
                key={line.id}
                ref={(el) => { cardRefs.current[line.id] = el; }}
                className="border border-slate-200 shadow-sm rounded-lg hover:border-indigo-200 transition-colors"
                bodyStyle={{ padding: '16px' }}
              >
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={12}>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">สินค้า</span>
                      <Text strong className="text-slate-800 leading-snug">{line.itemName}</Text>
                      <Text type="secondary" className="text-xs">รหัส: {line.itemCode}</Text>
                    </div>
                  </Col>

                  <Col xs={12} md={6}>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">เลขที่ LOT</span>
                      <Tag color="cyan" className="font-semibold text-xs py-0.5 m-0 w-fit">{line.lotNo || '-'}</Tag>
                    </div>
                  </Col>

                  <Col xs={12} md={6}>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">จำนวนจัดเก็บ (จาก Staging)</span>
                      <Tag color="cyan" className="font-semibold text-xs py-0.5 m-0 w-fit">{line.quantityRequired} แผ่น</Tag>
                    </div>
                  </Col>

                  {/* Horizontal line divider */}
                  <Col xs={24}>
                    <div className="border-t border-slate-100 my-1" />
                  </Col>

                  {/* WMS Input & Selection Row */}
                  <Col xs={24}>
                    <Row gutter={[16, 16]}>
                      {/* Location Group */}
                      <Col xs={24} md={12}>
                        <Row gutter={8}>
                          <Col span={10}>
                            <span className="text-xs font-semibold text-slate-400 block mb-1">ตำแหน่งเก็บแนะนำ</span>
                            {line.toLocationCode ? (
                              <Input
                                value={line.toLocationCode}
                                readOnly
                                disabled
                                className="rounded-md bg-slate-50 border-slate-200 text-slate-500"
                              />
                            ) : lastLocations[line.id] ? (
                              <Tooltip title={`ตำแหน่งล่าสุดที่แนะนำ ${lastLocations[line.id].locationCode} (คลิกเพื่อเลือกอัตโนมัติ)`}>
                                <Input
                                  value={`📍 ${lastLocations[line.id].locationCode}`}
                                  readOnly
                                  className="rounded-md bg-amber-50/50 border-amber-300 text-amber-700 font-semibold cursor-pointer text-xs"
                                  onClick={() => {
                                    handleLineInputChange(line.id, 'toLocationId', lastLocations[line.id].locationId);
                                    setTimeout(() => focusNextLine(line.id, 'location'), 60);
                                  }}
                                />
                              </Tooltip>
                            ) : (
                              <Input
                                value="ไม่ระบุ"
                                readOnly
                                disabled
                                className="rounded-md bg-slate-50 border-slate-200 text-slate-500"
                              />
                            )}
                          </Col>
                          <Col span={14}>
                            <span className="text-xs font-semibold text-slate-500 block mb-1">
                              <span className="text-red-500 mr-1">*</span>ตำแหน่งเก็บจริง
                            </span>
                            <div className="flex gap-1">
                              <Select
                                ref={(el) => { selectRefs.current[line.id] = el; }}
                                showSearch
                                placeholder="เลือกตำแหน่งเก็บ"
                                value={lineInput.toLocationId}
                                onChange={(val) => {
                                  handleLineInputChange(line.id, 'toLocationId', val);
                                  setTimeout(() => focusNextLine(line.id, 'location'), 60);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setTimeout(() => focusNextLine(line.id, 'location'), 60);
                                  }
                                }}
                                loading={loadingLocs}
                                optionFilterProp="label"
                                className={`w-full rounded-md text-xs transition-all ${lineInput.toLocationId && (
                                  (line.toLocationCode && locations.find(loc => loc.value === lineInput.toLocationId)?.label === line.toLocationCode) ||
                                  (!line.toLocationCode && lastLocations[line.id] && lineInput.toLocationId === lastLocations[line.id].locationId)
                                )
                                  ? 'border border-emerald-500 rounded-md bg-emerald-50/5'
                                  : ''
                                  }`}
                                dropdownStyle={{ minWidth: 200 }}
                                options={locations.map(loc => ({
                                  value: loc.value,
                                  label: loc.label,
                                }))}
                              />
                              <Button
                                icon={<ScanOutlined />}
                                onClick={() => handleOpenScanner('location', line.id)}
                                className="border-slate-300 hover:border-indigo-500 hover:text-indigo-500"
                              />
                            </div>
                          </Col>
                        </Row>
                      </Col>

                      {/* Pallet ID Group */}
                      <Col xs={24} md={12}>
                        <Row gutter={8}>
                          <Col span={10}>
                            <span className="text-xs font-semibold text-slate-400 block mb-1">หมายเลขพาเลทแนะนำ</span>
                            <Input
                              value={line.palletNo || `PLT${line.lotNo || ''}`}
                              readOnly
                              disabled
                              className="rounded-md bg-slate-50 border-slate-200 text-slate-500"
                            />
                          </Col>
                          <Col span={14}>
                            <span className="text-xs font-semibold text-slate-500 block mb-1">
                              <span className="text-red-500 mr-1">*</span>หมายเลขพาเลทจริง
                            </span>
                            <div className="flex gap-1">
                              <Input
                                ref={(el) => { palletRefs.current[line.id] = el; }}
                                placeholder="ระบุพาเลทปลายทาง"
                                value={lineInput.palletId}
                                onChange={(e) => handleLineInputChange(line.id, 'palletId', e.target.value)}
                                onPressEnter={() => setTimeout(() => focusNextLine(line.id, 'pallet'), 60)}
                                className={`rounded-md text-xs transition-all ${lineInput.palletId && String(lineInput.palletId || '').trim() === String(line.palletNo || `PLT${line.lotNo || ''}`).trim()
                                  ? 'border-emerald-500 bg-emerald-50/10 text-emerald-700 font-semibold'
                                  : 'border-slate-300'
                                  }`}
                              />
                              <Button
                                icon={<ScanOutlined />}
                                onClick={() => handleOpenScanner('pallet', line.id)}
                                className="border-slate-300 hover:border-indigo-500 hover:text-indigo-500"
                              />
                            </div>
                          </Col>
                        </Row>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Card>
            );
          })}
        </div>
      </Modal>
      {/* Modal เปิดกล้องเพื่อสแกน QR/Barcode */}
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
                if (!text) return;
                const cleanedText = text.trim();
                if (scanTarget === 'location') {
                  const matchedLoc = locations.find(loc => loc.label.toLowerCase() === cleanedText.toLowerCase());
                  if (matchedLoc) {
                    handleLineInputChange(scannedLineId, 'toLocationId', matchedLoc.value);
                    message.success(`สแกนตำแหน่งสำเร็จ: ${matchedLoc.label}`);
                    setScannerOpen(false);
                    setTimeout(() => focusNextLine(scannedLineId, 'location'), 60);
                  } else {
                    message.error(`ไม่พบรหัสตำแหน่ง "${cleanedText}" ในคลังสินค้านี้!`);
                  }
                } else {
                  handleLineInputChange(scannedLineId, 'palletId', cleanedText);
                  message.success(`สแกนพาเลทสำเร็จ: ${cleanedText}`);
                  setScannerOpen(false);
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
