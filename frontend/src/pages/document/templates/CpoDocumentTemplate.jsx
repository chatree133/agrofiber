import dayjs from 'dayjs';

export default function CpoDocumentTemplate({ docData }) {
  if (!docData) return null;

  // Transform document number: Example: QT-2605001 -> PO-C-2605001, QT2-2605001 -> PO-C2-2605001
  const docNoRaw = docData.DocumentNo || docData.documentNo || '-';
  const docNo = docNoRaw.replace(/^QT(\d*)-/, 'PO-C$1-');

  const docDate = docData.DocumentDate || docData.documentDate;
  const custName = docData.CustomerName || docData.customerName || '-';
  const custCode = docData.CustomerCode || docData.customerCode || '-';
  const taxId = docData.TaxId || docData.taxId || '-';
  const remarks = docData.Remarks || docData.remarks || '-';
  const shippingAddress = docData.BillingAddress || docData.billingAddress || docData.ShippingAddress || docData.shippingAddress || '-';
  const subTotal = Number(docData.SubTotalAmount || docData.subTotalAmount || 0);
  const discountTotal = Number(docData.DiscountAmount || docData.discountAmount || 0);
  const vatAmount = Number(docData.TaxAmount || docData.taxAmount || 0);
  const grandTotal = Number(docData.GrandTotalAmount || docData.grandTotalAmount || 0);
  const lines = docData.lines || [];

  return (
    <>
      {/* Header Section */}
      <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-6">
        <div className="pt-2">
          {/* Clean simple placeholder for PO - No company logo to avoid redundancy */}
          <span className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider">
            AGROFIBER PURCHASE ORDER
          </span>
        </div>

        <div className="text-right">
          <h2 className="text-base font-bold text-indigo-900 mb-1">
            ใบสั่งซื้อ (PURCHASE ORDER)
          </h2>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-left mt-2 border border-slate-200 p-2 rounded bg-slate-50">
            <span className="font-semibold text-slate-600">เลขที่เอกสาร / No:</span>
            <span className="font-bold text-slate-800">{docNo}</span>

            <span className="font-semibold text-slate-600">วันที่ / Date:</span>
            <span className="text-slate-800">{docDate ? dayjs(docDate).format('DD/MM/YYYY') : '-'}</span>
          </div>
        </div>
      </div>

      {/* Two-column Seller/Buyer Details for CPO */}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="border border-slate-200 rounded p-3 bg-slate-50 min-h-[100px]">
          <h3 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[11px]">
            ชื่อ-ที่อยู่ผู้ขาย
          </h3>
          <p className="font-bold text-slate-800 mb-1">บริษัท อะโกรไฟเบอร์ จำกัด (AGROFIBER CO., LTD.)</p>
          <p className="text-slate-600 mb-1">สำนักงานใหญ่: เลขที่ 1 หมู่ 2 ตำบลท่าตูม อำเภอศรีมหาโพธิ จังหวัดปราจีนบุรี 25140</p>
          <p className="text-slate-600 mb-1">โทร. 037-208800</p>
          <p className="text-slate-600 mb-1">เลขประจำตัวผู้เสียภาษี / TAX ID: 0105553118941</p>
        </div>

        <div className="border border-slate-200 rounded p-3 bg-slate-50 min-h-[100px]">
          <h3 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[11px]">
            ชื่อ-ที่อยู่ผู้ซื้อ
          </h3>
          <p className="font-bold text-slate-800 mb-1">{custCode} - {custName}</p>
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{shippingAddress}</p>
          <p className="text-slate-700">เลขประจำตัวผู้เสียภาษี: {taxId}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-slate-200 mb-6 text-[10px]">
        <thead>
          <tr className="bg-indigo-900 text-white text-left font-bold">
            <th className="border border-slate-300 p-2 text-center w-10">ลำดับ</th>
            <th className="border border-slate-300 p-2 w-32">รหัสสินค้า (SKU)</th>
            <th className="border border-slate-300 p-2">รายละเอียดสินค้า</th>
            <th className="border border-slate-300 p-2 text-right w-16">จำนวน</th>
            <th className="border border-slate-300 p-2 text-center w-12">หน่วย</th>
            <th className="border border-slate-300 p-2 text-right w-20">ราคา/หน่วย</th>
            <th className="border border-slate-300 p-2 text-right w-24">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const sku = line.SalesSKU || line.salesSku || line.ItemCode || line.itemCode || '-';
            const name = line.SpecName ? `${line.ItemName || line.itemName} - ${line.SpecName}` : (line.ItemName || line.itemName || '-');
            const qty = line.Quantity !== undefined ? line.Quantity : (line.quantity || 0);
            const unit = line.UnitCode || line.unitCode || '';
            const price = line.UnitPrice !== undefined ? line.UnitPrice : (line.unitPrice || 0);
            const amount = line.LineAmount !== undefined ? line.LineAmount : (line.lineAmount || 0);

            return (
              <tr key={idx} className="hover:bg-slate-50 odd:bg-slate-50/30">
                <td className="border border-slate-200 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-200 p-2 font-mono">{sku}</td>
                <td className="border border-slate-200 p-2 font-medium">{name}</td>
                <td className="border border-slate-200 p-2 text-right">{qty.toLocaleString()}</td>
                <td className="border border-slate-200 p-2 text-center">{unit}</td>
                <td className="border border-slate-200 p-2 text-right">{price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">
                  {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Remarks and Summary Section */}
      <div className="grid grid-cols-12 gap-6 mb-8 items-start">
        <div className="col-span-7 border border-slate-200 rounded p-3 bg-slate-50/50 min-h-[110px]">
          <h4 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[10px]">
            เงื่อนไขและหมายเหตุ (TERMS & REMARKS)
          </h4>
          <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap">{remarks}</p>
        </div>

        <div className="col-span-5 border border-slate-200 rounded p-3 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <span className="text-slate-600 text-left font-medium">รวมเป็นเงิน / Subtotal:</span>
            <span className="text-right text-slate-800 font-bold">{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</span>

            <span className="text-slate-600 text-left font-medium">หักส่วนลด / Discount:</span>
            <span className="text-right text-red-500 font-semibold">-{discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</span>

            <span className="text-slate-600 text-left font-medium">ภาษีมูลค่าเพิ่ม / VAT (7%):</span>
            <span className="text-right text-slate-800 font-semibold">{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</span>

            <div className="col-span-2 border-t border-slate-200 my-1"></div>

            <span className="text-indigo-900 text-left font-bold text-xs">ยอดรวมสุทธิ / Grand Total:</span>
            <span className="text-right text-emerald-600 font-extrabold text-xs">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</span>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-3 gap-6 text-center text-[10px] mt-16 pt-8 border-t border-slate-100">
        <div className="flex flex-col items-center justify-between min-h-[100px]">
          <div className="w-32 border-b border-slate-300 mb-2"></div>
          <span className="font-bold text-slate-700">ผู้จัดเตรียม (Prepared By)</span>
          <span className="text-slate-400 mt-1">วันที่ / Date: ____/____/____</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[100px]">
          <div className="w-32 border-b border-slate-300 mb-2"></div>
          <span className="font-bold text-slate-700">ผู้ตรวจสอบ (Checked By)</span>
          <span className="text-slate-400 mt-1">วันที่ / Date: ____/____/____</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[100px]">
          <div className="w-32 border-b border-slate-300 mb-2"></div>
          <span className="font-bold text-indigo-900">ผู้อนุมัติสั่งซื้อ (Authorized Approval)</span>
          <span className="text-slate-400 mt-1">วันที่ / Date: ____/____/____</span>
        </div>
      </div>
    </>
  );
}
