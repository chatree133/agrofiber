import React from 'react';
import dayjs from 'dayjs';

export default function GiDocumentTemplate({ docData }) {
  if (!docData) return null;

  const docNo = docData.documentNo || docData.DocumentNo || '-';
  const createdAt = docData.createdAt ? dayjs(docData.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-';
  const createdBy = docData.createdByName || docData.createdBy || '-';
  const dateStr = docData.issueDate
    ? dayjs(docData.issueDate).format('YYYY-MM-DD')
    : docData.requestDate
      ? dayjs(docData.requestDate).format('YYYY-MM-DD')
      : '-';

  const typeStr = docData.goodsIssueTypeName || docData.goodsIssueTypeCode || '-';
  const lines = docData.lines || [];

  // Determine the overall Mat Code (salesSku of first item or unique list of salesSkus)
  const uniqueMatCodes = Array.from(
    new Set(
      lines
        .map(line => line.salesSKU || line.salesSku || line.itemCode)
        .filter(Boolean)
    )
  );
  const matCodeDisplay = uniqueMatCodes.length > 0 ? uniqueMatCodes.join(', ') : '-';

  // Calculate total qty sheets
  const totalQtySheets = lines.reduce((sum, line) => {
    const qty = line.issuedSheetQty !== null && line.issuedSheetQty !== undefined
      ? Number(line.issuedSheetQty)
      : Number(line.requestedSheetQty || 0);
    return sum + qty;
  }, 0);

  return (
    <div className="print-page pb-8 text-black font-sans text-[11px] leading-relaxed">
      {/* Document Title */}
      <div className="text-center mb-6">
        <h1 className="text-lg font-bold tracking-wide">Goods Issue</h1>
      </div>

      {/* Main Info Box Grid */}
      <div className="border border-slate-300 rounded mb-4 overflow-hidden">
        <div className="grid grid-cols-12">
          {/* Left Column: Metadata */}
          <div className="col-span-8 grid grid-cols-12 border-r border-slate-300">
            <div className="col-span-4 bg-slate-50 p-2 font-semibold border-b border-slate-200">Created Date</div>
            <div className="col-span-8 p-2 border-b border-slate-200 font-mono">{createdAt}</div>

            <div className="col-span-4 bg-slate-50 p-2 font-semibold border-b border-slate-200">Created by</div>
            <div className="col-span-8 p-2 border-b border-slate-200">{createdBy}</div>

            <div className="col-span-4 bg-slate-50 p-2 font-semibold border-b border-slate-200">Date</div>
            <div className="col-span-8 p-2 border-b border-slate-200 font-mono">{dateStr}</div>

            <div className="col-span-4 bg-slate-50 p-2 font-semibold">Mat Code</div>
            <div className="col-span-8 p-2 font-mono break-all font-semibold text-slate-800">{matCodeDisplay}</div>
          </div>

          {/* Right Column: QR & Totals */}
          <div className="col-span-4 flex flex-col justify-between">
            {/* QR Code and Doc No */}
            <div className="flex p-3 gap-3 border-b border-slate-300 items-center justify-between bg-white flex-grow">
              <div className="flex flex-col justify-center">
                <div className="text-[10px] font-bold text-slate-500 mb-0.5">Goods Issue No.</div>
                <div className="text-sm font-bold font-mono tracking-tight text-slate-900">{docNo}</div>
              </div>
              <div className="border border-slate-100 p-0.5 rounded bg-white shrink-0">
                <img
                  src={`/api/auth/qrcode/${encodeURIComponent(docNo)}`}
                  alt="Goods Issue QR"
                  className="w-14 h-14"
                />
              </div>
            </div>

            {/* Type & Total Qty */}
            <div className="grid grid-cols-12 bg-slate-50 text-[10px]">
              <div className="col-span-4 font-semibold p-1.5 border-r border-slate-200 border-b border-slate-300">Type:</div>
              <div className="col-span-8 p-1.5 border-b border-slate-300 font-medium">{typeStr}</div>

              <div className="col-span-4 font-semibold p-1.5 border-r border-slate-200">Qty.</div>
              <div className="col-span-8 p-1.5 font-bold text-slate-900 text-xs">
                {totalQtySheets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Header */}
      <h3 className="font-bold text-slate-900 mb-2 mt-4 text-[12px] border-b border-slate-200 pb-1">
        Issue details
      </h3>

      {/* Items Table */}
      <table className="w-full border-collapse border border-slate-300 mb-8 text-[11px]">
        <thead>
          <tr className="bg-slate-50 text-slate-800 text-left font-bold border-b border-slate-300">
            <th className="border border-slate-300 p-2 text-center w-12">ลำดับ</th>
            <th className="border border-slate-300 p-2">Matcode</th>
            <th className="border border-slate-300 p-2 w-24">Tracking No.</th>
            <th className="border border-slate-300 p-2">Lot</th>
            <th className="border border-slate-300 p-2 text-center w-20">Customer</th>
            <th className="border border-slate-300 p-2 text-center w-16">Grade</th>
            <th className="border border-slate-300 p-2 text-right w-22">Qty. Sheets</th>
            <th className="border border-slate-300 p-2 text-center w-12">P</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const matcode = line.salesSKU || line.salesSku || line.itemCode || '-';
            const trackingNo = line.palletNo || '-';
            const lot = line.lotNo || '-';
            const customer = docData.customerCode || docData.customerId || '-';
            const grade = line.grade || '-';
            const qty = line.issuedSheetQty !== null && line.issuedSheetQty !== undefined
              ? Number(line.issuedSheetQty)
              : Number(line.requestedSheetQty || 0);

            return (
              <tr key={line.id || idx} className="border-b border-slate-200">
                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-300 p-2 font-mono font-semibold text-slate-700">{matcode}</td>
                <td className="border border-slate-300 p-2 font-mono text-slate-700">{trackingNo}</td>
                <td className="border border-slate-300 p-2 font-mono text-slate-600">{lot}</td>
                <td className="border border-slate-300 p-2 text-center font-mono">{customer}</td>
                <td className="border border-slate-300 p-2 text-center font-bold text-slate-700">{grade}</td>
                <td className="border border-slate-300 p-2 text-right font-semibold">
                  {qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border border-slate-300 p-2 text-center">
                  <div className="w-3.5 h-3.5 border border-slate-400 rounded-sm mx-auto bg-white"></div>
                </td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan="8" className="border border-slate-300 p-6 text-center text-slate-400">
                ไม่มีข้อมูลการหยิบสินค้า (No actual warehouse picking data)
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Signature Section */}
      <div className="grid grid-cols-4 gap-4 text-center text-[10px] mt-12 pt-8 border-t border-slate-200">
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Issue by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Check by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Approved by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Received by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
      </div>
    </div>
  );
}
