import dayjs from 'dayjs';

export default function RcptDocumentTemplate({ docData }) {
  if (!docData) return null;

  const docNo = docData.PaymentNo || docData.paymentNo || '-';
  const docDate = docData.PaymentDate || docData.paymentDate || docData.createdAt;
  const custName = docData.CustomerName || docData.customerName || '-';
  const custCode = docData.CustomerCode || docData.customerCode || '-';
  const notes = docData.Notes || docData.notes || '-';
  const paymentMethod = docData.PaymentMethod || docData.paymentMethod || 'transfer';
  const amount = Number(docData.Amount || docData.amount || 0);
  const refNo = docData.ReferenceNo || docData.referenceNo || '';
  const allocations = docData.allocations || [];

  const getPaymentMethodText = (method) => {
    switch (method.toLowerCase()) {
      case 'transfer':
        return 'เงินโอน (Bank Transfer)';
      case 'cash':
        return 'เงินสด (Cash)';
      case 'credit':
        return 'เครดิต (Credit Terms)';
      default:
        return method;
    }
  };

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
            ใบเสร็จรับเงิน (RECEIPT)
          </h2>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-left mt-2 border border-slate-200 p-2 rounded bg-slate-50">
            <span className="font-semibold text-slate-600">เลขที่เอกสาร / No:</span>
            <span className="font-bold text-slate-800">{docNo}</span>

            <span className="font-semibold text-slate-600">วันที่ / Date:</span>
            <span className="text-slate-800">{docDate ? dayjs(docDate).format('DD/MM/YYYY') : '-'}</span>

            <span className="font-semibold text-slate-600">ชำระโดย / Method:</span>
            <span className="text-slate-800 font-medium">
              {getPaymentMethodText(paymentMethod)}
              {refNo ? ` (Ref: ${refNo})` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="border border-slate-200 rounded p-3 bg-slate-50 mb-6 min-h-[70px] max-w-[400px]">
        <h3 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[11px]">
          ได้รับเงินจาก (RECEIVED FROM)
        </h3>
        <p className="font-bold text-slate-800 mb-1">{custCode} - {custName}</p>
      </div>

      {/* Allocations Table */}
      <table className="w-full border-collapse border border-slate-200 mb-6 text-[10px]">
        <thead>
          <tr className="bg-indigo-900 text-white text-left font-bold">
            <th className="border border-slate-300 p-2 text-center w-12">ลำดับ</th>
            <th className="border border-slate-300 p-2">เลขที่ใบกำกับภาษี (Invoice No)</th>
            <th className="border border-slate-300 p-2 text-right w-36">ยอดตัดชำระ (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((alloc, idx) => {
            const invNo = alloc.SalesInvoiceNo || alloc.salesInvoiceNo || `Invoice ID: ${alloc.salesInvoiceId}`;
            const amt = Number(alloc.AmountApplied || alloc.amountApplied || 0);

            return (
              <tr key={idx} className="hover:bg-slate-50 odd:bg-slate-50/30">
                <td className="border border-slate-200 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-200 p-2 font-mono">{invNo}</td>
                <td className="border border-slate-200 p-2 text-right font-bold">
                  {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            );
          })}
          {allocations.length === 0 && (
            <tr>
              <td colSpan="3" className="border border-slate-200 p-4 text-center text-slate-400">
                ไม่มีรายการตัดชำระ
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Remarks and Summary Section */}
      <div className="grid grid-cols-12 gap-6 mb-8 items-start">
        <div className="col-span-7 border border-slate-200 rounded p-3 bg-slate-50/50 min-h-[70px]">
          <h4 className="font-bold text-indigo-900 border-b border-slate-200 pb-1 mb-2 text-[10px]">
            หมายเหตุ (NOTES / REMARKS)
          </h4>
          <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap">{notes}</p>
        </div>

        <div className="col-span-5 border border-slate-200 rounded p-3 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <span className="text-indigo-900 text-left font-bold text-xs">ยอดรวมชำระ / Total Paid:</span>
            <span className="text-right text-emerald-600 font-extrabold text-xs">
              {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
            </span>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-12 text-center text-[10px] mt-12 pt-6 border-t border-slate-100">
        <div className="flex flex-col items-center justify-between min-h-[80px] col-start-2">
          <div className="w-48 border-b border-slate-300 mb-2 mt-4"></div>
          <span className="font-bold text-indigo-900">ผู้รับเงิน / เจ้าหน้าที่การเงิน (Received By / Cashier)</span>
          <span className="text-slate-400">วันที่ / Date: ____/____/____</span>
        </div>
      </div>
    </div>
  );
}
