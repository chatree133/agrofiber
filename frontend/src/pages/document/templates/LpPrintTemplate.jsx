import React from 'react';
import dayjs from 'dayjs';

export default function LpPrintTemplate({ docData }) {
  const plans = Array.isArray(docData) ? docData : (docData?.data || []);

  if (plans.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans text-sm">
        ไม่มีแผนการจัดส่ง (สถานะ Draft, Ready, หรือ In Transit) ในวันที่ระบุ
      </div>
    );
  }

  return (
    <div className="print-page text-black font-sans text-[11px] leading-relaxed">
      {plans.map((plan, idx) => {
        const totalWeight = plan.lines.reduce((sum, l) => sum + (l.weightKg || 0), 0);
        const totalVolume = plan.lines.reduce((sum, l) => sum + (l.volumeCbm || 0), 0);
        
        return (
          <div
            key={plan.loadPlanId}
            className="mb-8 pb-8"
            style={{ pageBreakAfter: idx === plans.length - 1 ? 'avoid' : 'always' }}
          >
            {/* Header / Document Title */}
            <div className="flex justify-between items-start border-b-2 border-slate-300 pb-3 mb-4">
              <div>
                <h1 className="text-base font-bold text-slate-900">แผนจัดส่งสินค้า (Load Plan)</h1>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  แผนงานเลขที่: <span className="font-bold text-slate-800">{plan.loadPlanNo}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-800 text-xs">
                  วันที่จัดส่ง: {plan.planDate ? dayjs(plan.planDate).format('YYYY-MM-DD') : '-'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  พิมพ์เมื่อ: {dayjs().format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
            </div>

            {/* Vehicle & Driver Metadata Card */}
            <div className="grid grid-cols-12 gap-3 border border-slate-300 rounded p-3 mb-4 bg-slate-50">
              <div className="col-span-4 border-r border-slate-200 pr-2">
                <div className="text-[10px] font-bold text-slate-500">ข้อมูลรถยนต์</div>
                <div className="font-semibold text-slate-800 mt-0.5">{plan.licensePlate || 'ไม่ระบุทะเบียน'}</div>
                <div className="text-slate-600 text-[10px]">{plan.vehicleType || '-'}</div>
              </div>
              
              <div className="col-span-4 border-r border-slate-200 px-2">
                <div className="text-[10px] font-bold text-slate-500">พนักงานขับรถ</div>
                <div className="font-semibold text-slate-800 mt-0.5">{plan.driverName || 'ไม่ระบุพนักงาน'}</div>
                <div className="text-slate-600 text-[10px]">{plan.driverPhone ? `โทร: ${plan.driverPhone}` : 'ไม่มีเบอร์โทร'}</div>
              </div>

              <div className="col-span-4 pl-2">
                <div className="text-[10px] font-bold text-slate-500">ข้อมูลน้ำหนัก / ปริมาตร</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {totalWeight.toFixed(1)} / {plan.maxWeightKg || 0} kg
                </div>
                <div className="text-slate-600 text-[10px]">
                  CBM: {totalVolume.toFixed(2)} / {plan.maxVolumeCbm || 0}
                </div>
              </div>
            </div>

            {plan.remarks && (
              <div className="mb-4 p-2 bg-slate-100 rounded text-slate-700 text-[10px] italic">
                <span className="font-bold not-italic">หมายเหตุ:</span> {plan.remarks}
              </div>
            )}

            {/* Table of Stops */}
            <table className="w-full border-collapse border border-slate-300 text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-left font-bold border-b border-slate-300">
                  <th className="border border-slate-300 p-2 text-center w-12">จุดที่</th>
                  <th className="border border-slate-300 p-2 w-28">เลขที่ DO</th>
                  <th className="border border-slate-300 p-2 w-36">ลูกค้า</th>
                  <th className="border border-slate-300 p-2">ที่อยู่ส่งของ</th>
                  <th className="border border-slate-300 p-2 text-right w-20">น้ำหนัก (kg)</th>
                  <th className="border border-slate-300 p-2 text-center w-20">แผนที่ (QR)</th>
                </tr>
              </thead>
              <tbody>
                {plan.lines && plan.lines.length > 0 ? (
                  plan.lines.map((stop) => {
                    const mapsUrl = (stop.latitude && stop.longitude)
                      ? `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`
                      : null;
                    
                    return (
                      <tr key={stop.loadPlanLineId} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-2 text-center font-bold">
                          <span className="inline-block bg-slate-800 text-white rounded-full w-5 h-5 leading-5 text-center text-[10px]">
                            {stop.stopSequence}
                          </span>
                        </td>
                        <td className="border border-slate-300 p-2 font-mono font-semibold text-slate-700">
                          {stop.documentNo || '-'}
                        </td>
                        <td className="border border-slate-300 p-2 font-medium">
                          {stop.customerName || '-'}
                          {stop.customerCode && (
                            <span className="block text-[9px] text-slate-400">({stop.customerCode})</span>
                          )}
                        </td>
                        <td className="border border-slate-300 p-2 text-slate-600">
                          {stop.shipToAddress || '-'}
                        </td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-semibold">
                          {(stop.weightKg || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td className="border border-slate-300 p-1 text-center">
                          {mapsUrl ? (
                            <div className="inline-block border border-slate-200 p-0.5 rounded bg-white">
                              <img
                                src={`/api/auth/qrcode/${encodeURIComponent(mapsUrl)}`}
                                alt={`Stop ${stop.stopSequence} QR`}
                                className="w-12 h-12"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[9px]">ไม่มีพิกัด</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="border border-slate-300 p-4 text-center text-slate-400">
                      ไม่มีจุดส่งสินค้าสำหรับแผนจัดส่งนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
