import dayjs from 'dayjs';

export default function WavePrintTemplate({ docData }) {
  if (!docData) return null;

  const waveNo = docData.waveNo || docData.WaveNo || '-';
  const createdAt = docData.createdAt || docData.CreatedAt;
  const createdByName = docData.createdByName || docData.CreatedByName || '-';
  const tasks = docData.tasks || [];

  // Flatten tasks lines to render in a single picking list
  const lines = [];
  tasks.forEach(task => {
    const taskNo = `Task #${task.id}`;
    const taskRef = task.referenceType ? `${task.referenceType} (ID: ${task.referenceId})` : '-';
    (task.lines || []).forEach(line => {
      lines.push({
        ...line,
        taskNo,
        taskRef,
        warehouseName: task.warehouseName || '-'
      });
    });
  });

  return (
    <div className="print-page pb-8">
      {/* Header Section */}
      <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-base shadow-sm">
              <img src="https://www.agro-thailand.com/wp-content/uploads/2025/12/logo03.png" alt="Company Logo" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-indigo-900 leading-tight">บริษัท อะโกรไฟเบอร์ จำกัด</h1>
              <p className="text-[10px] text-slate-500 font-medium">AGROFIBER CO., LTD.</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 leading-normal max-w-[380px]">
            สำนักงานใหญ่: เลขที่ 1 หมู่ 2 ตำบลท่าตูม อำเภอศรีมหาโพธิ จังหวัดปราจีนบุรี 25140<br />
            โทรศัพท์: 037-208800 | เลขประจำตัวผู้เสียภาษี: 0105553118941
          </p>
        </div>

        <div className="text-right">
          <h2 className="text-base font-bold text-indigo-900 mb-1">
            ใบจัดกลุ่มหยิบสินค้า<br />(WAVE PICKING LIST)
          </h2>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-left mt-2 border border-slate-200 p-2 rounded bg-slate-50">
            <span className="font-semibold text-slate-600">เลขที่ Wave / Wave No:</span>
            <span className="font-bold text-slate-800">{waveNo}</span>

            <span className="font-semibold text-slate-600">วันที่สร้าง / Date:</span>
            <span className="text-slate-800">{createdAt ? dayjs(createdAt).format('DD/MM/YYYY HH:mm') : '-'}</span>

            <span className="font-semibold text-slate-600">ผู้สร้าง / Created By:</span>
            <span className="text-slate-800 font-medium">{createdByName}</span>
          </div>
        </div>
      </div>

      {/* Wave Summary Info */}
      <div className="border border-slate-200 rounded p-3 bg-slate-50 mb-6 text-[11px]">
        <span className="font-semibold text-slate-600">จำนวนใบสั่งงานทั้งหมดในกลุ่ม: </span>
        <span className="font-bold text-slate-800 mr-6">{tasks.length} ใบงาน</span>

        <span className="font-semibold text-slate-600">คลังสินค้าปฏิบัติการ: </span>
        <span className="font-bold text-slate-800">
          {tasks[0]?.warehouseName || '-'}
        </span>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-slate-200 mb-6 text-[10px]">
        <thead>
          <tr className="bg-indigo-900 text-white text-left font-bold">
            <th className="border border-slate-300 p-2 text-center w-10">ลำดับ</th>
            <th className="border border-slate-300 p-2 w-20 text-center">ใบสั่งงาน</th>
            <th className="border border-slate-300 p-2 w-50">
              <div>รหัสสินค้า / SKU</div>
              <div className="text-slate-300">
                ชื่อสินค้า
              </div>
            </th>
            <th className="border border-slate-300 p-2 text-center w-20">ตำแหน่งแนะนำ</th>
            <th className="border border-slate-300 p-2 text-center w-20">Lot แนะนำ</th>
            <th className="border border-slate-300 p-2 text-right w-20">จำนวนหยิบ</th>
            <th className="border border-slate-300 p-2 text-center w-10">หน่วย</th>
            <th className="border border-slate-300 p-2 text-center w-15">ผลตรวจ</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const sku = line.salesSku || line.itemCode || '-';
            const name = line.itemName || '-';
            const baseQty = Number(line.quantityRequired || 0).toLocaleString('th-TH');
            const baseUnit = line.unitCode || 'PCS';
            const requestedQty = line.requestedQuantity;
            const requestedUnit = line.requestedUnitCode;
            const hasRequestedUnit =
              requestedQty != null &&
              requestedUnit &&
              (requestedUnit !== baseUnit || Number(requestedQty) !== Number(line.quantityRequired || 0));
            const qty = hasRequestedUnit
              ? Number(requestedQty || 0).toLocaleString('th-TH')
              : baseQty;
            const unit = hasRequestedUnit ? `${requestedUnit} (${baseQty} ${baseUnit})` : baseUnit;
            const location = line.fromLocationCode || '-';
            const lot = line.lotNo || '-';
            const remark = line.remark;

            return (
              <tr key={idx} className="hover:bg-slate-50 odd:bg-slate-50/30">
                <td className="border border-slate-200 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-200 p-2 text-center">
                  <div className="font-bold text-slate-700">{line.taskNo}</div>
                  <div className="text-[9px] text-slate-500">{line.taskRef}</div>
                </td>
                <td className="border border-slate-200 p-2 font-mono">
                  <div className='font-bold '>{sku}</div>
                  <div className="text-slate-600">
                    <div className="font-medium">{name}</div>
                    {remark && (
                      <div className="text-[#d97706] font-semibold text-[9px] mt-0.5">
                        [หมายเหตุ: {remark}]
                      </div>
                    )}
                  </div>
                </td>
                <td className="border border-slate-200 p-2 text-center font-bold text-indigo-700">{location}</td>
                <td className="border border-slate-200 p-2 text-center font-mono">{lot}</td>
                <td className="border border-slate-200 p-2 text-right font-bold text-base">{qty.toLocaleString()}</td>
                <td className="border border-slate-200 p-2 text-center">{unit}</td>
                <td className="border border-slate-200 p-2 text-center">
                  <div className="w-4 h-4 border border-slate-400 rounded-sm mx-auto"></div>
                </td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan="9" className="border border-slate-200 p-4 text-center text-slate-400">
                ไม่มีรายการสินค้าที่ต้องการหยิบ
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Remarks/Guidelines Section */}
      <div className="border border-slate-200 rounded p-3 bg-slate-50/50 mb-8 text-[9px] text-slate-600">
        <h4 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[10px]">
          แนวทางปฏิบัติสำหรับเจ้าหน้าที่คลังสินค้า (OPERATIONAL GUIDELINES)
        </h4>
        <ul className="list-disc pl-4 space-y-1">
          <li>กรุณาเดินหยิบตามลำดับตำแหน่งคลังสินค้าแนะนำเพื่อประสิทธิภาพสูงสุด</li>
          <li>ตรวจสอบ Lot No. และรายละเอียดหมายเหตุของลูกค้า (เช่น ขอรับสีโทนเดิม Lot เดิม) ให้ถูกต้องตรงตามที่ระบุไว้</li>
          <li>ทำเครื่องหมายในช่อง "ผลตรวจ" เมื่อทำการตรวจสอบและหยิบสินค้าใส่พาเลทเสร็จสิ้นแล้ว</li>
          <li>หากพบสินค้าชำรุด หรือจำนวนของไม่ตรงกับหน้าคลัง ให้รายงานหัวหน้างานทันที</li>
        </ul>
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-12 text-center text-[10px] mt-12 pt-6 border-t border-slate-100">
        <div className="flex flex-col items-center justify-between min-h-[90px]">
          <span className="text-slate-500">ได้จัดหยิบสินค้าตามรายการแนะนำเสร็จสมบูรณ์แล้ว</span>
          <div className="w-48 border-b border-slate-300 mt-6 mb-2"></div>
          <span className="font-bold text-slate-700">ผู้หยิบสินค้า / เจ้าหน้าที่คลัง (Picker / Staff)</span>
          <span className="text-slate-400">วันที่ / Date: ____/____/____</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[90px]">
          <span className="text-slate-500">ได้ตรวจสอบความครบถ้วนและถูกต้องของตัวสินค้าแล้ว</span>
          <div className="w-48 border-b border-slate-300 mt-6 mb-2"></div>
          <span className="font-bold text-indigo-900">ผู้ตรวจสอบ / หัวหน้าคลัง (Auditor / Supervisor)</span>
          <span className="text-slate-400">วันที่ / Date: ____/____/____</span>
        </div>
      </div>
    </div>
  );
}
