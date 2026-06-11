import { useState, useEffect } from 'react';
import { Button, Card, Col, Row, Select, Typography, Space, Tag, Spin, message, Alert } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  SyncOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  CheckOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ApiClient from '../../context/Api';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title, Text } = Typography;

const SLOTS = [
  { number: 1, time: '08:00-10:00', start: '08:00' },
  { number: 2, time: '10:00-12:00', start: '10:00' },
  { number: 3, time: '13:00-15:00', start: '13:00' },
  { number: 4, time: '15:00-17:00', start: '15:00' }
];

export default function DeliveryScheduler() {
  const { authHeaders } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [currentStartDate, setCurrentStartDate] = useState(() => dayjs().startOf('week'));
  const [reservations, setReservations] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null); // { dateStr, slotNumber, slotTime }
  const [loading, setLoading] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  // Extract currentReservationId from URL
  const currentReservationId = new URLSearchParams(window.location.search).get('currentReservationId');

  // 1. Fetch active vehicles
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await ApiClient.get('/api/sale-orders/delivery-scheduler/vehicles', { headers: authHeaders });
        setVehicles(res || []);
        if (res && res.length > 0) {
          setSelectedVehicleId(res[0].VehicleId);
        }
      } catch (err) {
        console.error('Failed to load vehicles', err);
        message.error('ไม่สามารถโหลดข้อมูลยานพาหนะได้');
      } finally {
        setVehiclesLoading(false);
      }
    }
    loadVehicles();
  }, [authHeaders]);

  // 2. Fetch slot reservations for selected vehicle and date range
  const loadSlots = async () => {
    if (!selectedVehicleId) return;
    setLoading(true);
    try {
      const res = await ApiClient.get('/api/sale-orders/delivery-scheduler/slots', {
        params: {
          vehicleId: selectedVehicleId,
          startDate: currentStartDate.format('YYYY-MM-DD')
        },
        headers: authHeaders
      });
      setReservations(res || []);
    } catch (err) {
      console.error('Failed to load reservation slots', err);
      message.error('ไม่สามารถโหลดข้อมูลสล็อตเวลาได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
    // Clear selection when range or vehicle changes
    setSelectedSlot(null);
  }, [selectedVehicleId, currentStartDate]);

  // Map reservations by Date and Slot number for O(1) lookup
  const reservationMap = {};
  reservations.forEach(r => {
    const dStr = dayjs(r.ReservationDate).format('YYYY-MM-DD');
    if (!reservationMap[dStr]) {
      reservationMap[dStr] = {};
    }
    reservationMap[dStr][r.SlotNumber] = r;
  });

  // Calculate 21 days for the 3-week Sun-Sat calendar
  const calendarDates = [];
  for (let i = 0; i < 21; i++) {
    calendarDates.push(currentStartDate.add(i, 'day'));
  }

  // Next and Prev pagination (3 weeks)
  const handlePrevRange = () => {
    setCurrentStartDate(prev => prev.subtract(21, 'day'));
  };

  const handleNextRange = () => {
    setCurrentStartDate(prev => prev.add(21, 'day'));
  };

  // Find active vehicle object
  const activeVehicle = vehicles.find(v => v.VehicleId === selectedVehicleId);

  // Reserve a slot (first click selects, second click confirms and closes popup)
  const handleSlotClick = async (dateStr, slotNumber, slotTime) => {
    if (selectedSlot && selectedSlot.dateStr === dateStr && selectedSlot.slotNumber === slotNumber) {
      // Second click: confirm and save reservation!
      setLoading(true);
      try {
        const res = await ApiClient.post('/api/sale-orders/delivery-scheduler/reserve', {
          vehicleId: selectedVehicleId,
          reservationDate: dateStr,
          slotNumber,
          oldReservationId: currentReservationId ? parseInt(currentReservationId) : null
        }, { headers: authHeaders });

        if (res && res.success) {
          message.success('จองสล็อตเวลาจัดส่งสำเร็จ!');
          // Send slot details back to the parent window
          if (window.opener && typeof window.opener.onSelectDeliverySlot === 'function') {
            window.opener.onSelectDeliverySlot({
              reservationId: res.reservationId,
              vehicleId: selectedVehicleId,
              vehicleLicensePlate: activeVehicle?.LicensePlate || '',
              date: dateStr,
              slotNumber,
              slotTime
            });
            window.close();
          } else {
            message.warning('ไม่พบหน้าต่างหลัก (Opener Window Closed)');
          }
        }
      } catch (err) {
        console.error('Failed to reserve slot', err);
        const errMsg = err.response?.data?.message || err.message || 'ไม่สามารถทำการจองได้';
        // Alert race condition: "ไม่ว่าง-กรุณาเลือกวันและเวลาอื่น"
        if (errMsg.includes('ไม่ว่าง')) {
          message.error('ไม่ว่าง-กรุณาเลือกวันและเวลาอื่น');
        } else {
          message.error(errMsg);
        }
        // Auto-refresh the slots
        setSelectedSlot(null);
        loadSlots();
      } finally {
        setLoading(false);
      }
    } else {
      // First click: select the slot
      setSelectedSlot({ dateStr, slotNumber, slotTime });
    }
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Card
        bordered={false}
        style={{
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
        {/* Title and Controls Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              <CalendarOutlined style={{ color: '#3b82f6' }} />
              ตารางนัดหมายจัดส่งสินค้า (3 สัปดาห์)
            </h1>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              คลิกครั้งแรกเพื่อเลือก slot เวลา และคลิกอีกครั้งเพื่อยืนยันการจอง
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#475569' }}>เลือกยานพาหนะ:</span>
            <Select
              style={{ width: '220px' }}
              placeholder="เลือกยานพาหนะ..."
              value={selectedVehicleId}
              onChange={setSelectedVehicleId}
              loading={vehiclesLoading}
            >
              {vehicles.map(v => (
                <Select.Option key={v.VehicleId} value={v.VehicleId}>
                  {v.LicensePlate} ({v.VehicleType})
                </Select.Option>
              ))}
            </Select>

            <Button
              icon={<SyncOutlined />}
              onClick={loadSlots}
              loading={loading}
              title="รีเฟรชข้อมูลปฏิทิน"
            >
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Date Navigator & Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#f1f5f9', padding: '10px 15px', borderRadius: '8px' }}>
          <Space>
            <Button icon={<LeftOutlined />} onClick={handlePrevRange} disabled={loading}>
              ย้อนกลับ 3 สัปดาห์
            </Button>
            <Text strong style={{ fontSize: '14px', color: '#334155' }}>
              {calendarDates[0].format('DD MMM YYYY')} - {calendarDates[20].format('DD MMM YYYY')}
            </Text>
            <Button onClick={handleNextRange} disabled={loading}>
              ถัดไป 3 สัปดาห์ <RightOutlined />
            </Button>
          </Space>

          <Space size="middle" style={{ fontSize: '12px' }}>
            <span><span style={{ width: '12px', height: '12px', display: 'inline-block', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px', marginRight: '4px', verticalAlign: 'middle' }} /> ว่าง</span>
            <span><span style={{ width: '12px', height: '12px', display: 'inline-block', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '3px', marginRight: '4px', verticalAlign: 'middle' }} /> จองชั่วคราว</span>
            <span><span style={{ width: '12px', height: '12px', display: 'inline-block', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '3px', marginRight: '4px', verticalAlign: 'middle' }} /> ไม่ว่าง (Confirmed)</span>
            <span><span style={{ width: '12px', height: '12px', display: 'inline-block', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '3px', marginRight: '4px', verticalAlign: 'middle' }} /> สล็อตปัจจุบัน / กำลังเลือก</span>
          </Space>
        </div>

        {/* Calendar Grid Container */}
        {
          loading && reservations.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Spin size="large" tip="กำลังโหลดตารางสล็อตเวลา..." />
            </div>
          ) : (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              {/* Sun - Sat Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#cbd5e1', borderBottom: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>
                {['อาทิตย์ (Sun)', 'จันทร์ (Mon)', 'อังคาร (Tue)', 'พุธ (Wed)', 'พฤหัสบดี (Thu)', 'ศุกร์ (Fri)', 'เสาร์ (Sat)'].map((day, idx) => (
                  <div key={idx} style={{ padding: '10px 5px', color: idx === 0 ? '#ef4444' : idx === 6 ? '#2563eb' : '#1e293b', fontSize: '13px' }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(140px, auto)', background: '#cbd5e1', gap: '1px' }}>
                {calendarDates.map((date, idx) => {
                  const dateStr = date.format('YYYY-MM-DD');
                  const isToday = date.isSame(dayjs(), 'day');
                  const dayReservations = reservationMap[dateStr] || {};

                  return (
                    <div
                      key={idx}
                      style={{
                        background: isToday ? '#eff6ff' : '#ffffff',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      {/* Day Number Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                        <Text strong style={{ color: isToday ? '#1d4ed8' : '#334155', fontSize: '14px' }}>
                          {date.format('D')}
                        </Text>
                        <Text style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {date.format('MMM')}
                        </Text>
                      </div>

                      {/* 4 Time Slots */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1, justifyContent: 'space-around' }}>
                        {SLOTS.map(slot => {
                          const reservation = dayReservations[slot.number];
                          const status = reservation ? reservation.DisplayStatus : 'available';

                          let bg = '#ffffff';
                          let color = '#475569';
                          let border = '1px solid #e2e8f0';
                          let text = slot.time;
                          let disabled = false;
                          let hoverStyle = {};

                          const isSelected = selectedSlot && selectedSlot.dateStr === dateStr && selectedSlot.slotNumber === slot.number;

                          const isCurrentOurs = reservation && currentReservationId && String(reservation.ReservationId) === String(currentReservationId);

                          if (isSelected) {
                            bg = '#e0f2fe';
                            color = '#0369a1';
                            border = '2px solid #0284c7';
                            text = `ยืนยันจอง ${slot.time}`;
                          } else if (isCurrentOurs) {
                            bg = '#e0f2fe';
                            color = '#0369a1';
                            border = '1px solid #bae6fd';
                            text = `สล็อตปัจจุบัน (${slot.time})`;
                            disabled = false;
                          } else if (status === 'confirmed') {
                            bg = '#dcfce7';
                            color = '#15803d';
                            border = '1px solid #bbf7d0';
                            text = `ไม่ว่าง (${slot.time})`;
                            disabled = true;
                          } else if (status === 'reserved') {
                            bg = '#fef3c7';
                            color = '#92400e';
                            border = '1px solid #fcd34d';
                            text = `จองชั่วคราว (${slot.time})`;
                            disabled = true;
                          }

                          return (
                            <div
                              key={slot.number}
                              onClick={() => !disabled && handleSlotClick(dateStr, slot.number, slot.time)}
                              style={{
                                padding: '5px 4px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: isSelected || disabled ? '6px' : '500',
                                textAlign: 'center',
                                background: bg,
                                color: color,
                                border: border,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                userSelect: 'none',
                                transition: 'all 0.15s ease-in-out',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '3px'
                              }}
                              className="slot-cell"
                            >
                              {isSelected && <CheckOutlined style={{ fontSize: '10px' }} />}
                              {text}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        }
      </Card >
    </div >
  );
}
