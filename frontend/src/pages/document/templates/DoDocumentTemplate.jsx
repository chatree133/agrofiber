import dayjs from 'dayjs';

export default function DoDocumentTemplate({ docData }) {
  if (!docData) return null;

  const docNo = docData.DocumentNo || docData.documentNo || '-';
  const docDate = docData.DocumentDate || docData.documentDate || docData.createdAt;
  const custName = docData.CustomerName || docData.customerName || '-';
  const custCode = docData.CustomerCode || docData.customerCode || '-';
  const taxId = docData.TaxId || docData.taxId || '-';
  const remarks = docData.Remarks || docData.remarks || '-';
  const shipToAddress = docData.ShipToAddress || docData.shipToAddress || '-';
  const soNo = docData.SalesOrderNo || docData.salesOrderNo || '-';
  const lines = docData.lines || [];

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
            ใบส่งสินค้า / ใบรับของ<br />(DELIVERY NOTE / RECEIPT)
          </h2>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-left mt-2 border border-slate-200 p-2 rounded bg-slate-50">
            <span className="font-semibold text-slate-600">เลขที่เอกสาร / No:</span>
            <span className="font-bold text-slate-800">{docNo}</span>

            <span className="font-semibold text-slate-600">วันที่ / Date:</span>
            <span className="text-slate-800">{docDate ? dayjs(docDate).format('DD/MM/YYYY') : '-'}</span>

            <span className="font-semibold text-slate-600">อ้างอิงใบสั่งขาย / SO:</span>
            <span className="text-slate-800 font-medium">{soNo}</span>
          </div>
        </div>
      </div>

      {/* Customer & Shipping Details */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="border border-slate-200 rounded p-3 bg-slate-50 min-h-[90px]">
          <h3 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[11px]">
            ลูกค้า (CUSTOMER DETAILS)
          </h3>
          <p className="font-bold text-slate-800 mb-1">{custCode} - {custName}</p>
          <p className="text-slate-600 mb-1">เลขประจำตัวผู้เสียภาษี / TAX ID: {taxId}</p>
        </div>

        <div className="border border-slate-200 rounded p-3 bg-slate-50 min-h-[90px]">
          <h3 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[11px]">
            ที่อยู่สำหรับจัดส่ง (SHIPPING ADDRESS)
          </h3>
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{shipToAddress}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-slate-200 mb-6 text-[10px]">
        <thead>
          <tr className="bg-indigo-900 text-white text-left font-bold">
            <th className="border border-slate-300 p-2 text-center w-12">ลำดับ</th>
            <th className="border border-slate-300 p-2 w-48">รหัสสินค้า (SKU)</th>
            <th className="border border-slate-300 p-2">รายละเอียดสินค้า</th>
            <th className="border border-slate-300 p-2 text-right w-28">จำนวนจัดส่ง</th>
            <th className="border border-slate-300 p-2 text-center w-20">หน่วย</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const sku = line.ItemCode || line.itemCode || '-';
            const name = line.ItemName || line.itemName || '-';
            const qty = line.Quantity !== undefined ? line.Quantity : (line.quantity || 0);
            const unit = line.UnitCode || line.unitCode || 'แผ่น';

            return (
              <tr key={idx} className="hover:bg-slate-50 odd:bg-slate-50/30">
                <td className="border border-slate-200 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-200 p-2 font-mono">{sku}</td>
                <td className="border border-slate-200 p-2 font-medium">{name}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">{qty.toLocaleString()}</td>
                <td className="border border-slate-200 p-2 text-center">{unit}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan="5" className="border border-slate-200 p-4 text-center text-slate-400">
                ไม่มีรายการสินค้า
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Remarks Section */}
      <div className="border border-slate-200 rounded p-3 bg-slate-50/50 mb-8 min-h-[70px]">
        <h4 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[10px]">
          หมายเหตุ (REMARKS)
        </h4>
        <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap">{remarks}</p>
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-12 text-center text-[10px] mt-12 pt-6 border-t border-slate-100">
        <div className="flex flex-col items-center justify-between min-h-[90px]">
          <span className="text-slate-500">ได้รับสินค้าตามรายการข้างต้นไว้ในสภาพเรียบร้อยแล้ว</span>
          <div className="w-48 border-b border-slate-300 mt-6 mb-2"></div>
          <span className="font-bold text-slate-700">ผู้เซ็นรับสินค้า (Receiver / Recipient)</span>
          <span className="text-slate-400">วันที่ / Date: ____/____/____</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[90px]">
          <span className="text-slate-500">ได้จัดส่งสินค้าตามรายการข้างต้นเป็นที่เรียบร้อยแล้ว</span>
          <div className="w-48 border-b border-slate-300 mt-6 mb-2"></div>
          <span className="font-bold text-indigo-900">ผู้จัดส่งสินค้า / ผู้มอบ (Delivered By)</span>
          <span className="text-slate-400">วันที่ / Date: ____/____/____</span>
        </div>
      </div>
    </div>
  );
}
