import React from 'react';
import dayjs from 'dayjs';

export default function GrDocumentTemplate({ docData }) {
  if (!docData) return null;

  const docNo = docData.documentNo || docData.DocumentNo || '-';
  const createdAt = docData.createdAt ? dayjs(docData.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-';
  const createdBy = docData.createdByName || docData.createdBy || '-';
  const receiptDate = docData.receiptDate ? dayjs(docData.receiptDate).format('YYYY-MM-DD') : '-';
  const vendor = docData.vendorName
    ? `${docData.vendorCode ? `[${docData.vendorCode}] ` : ''}${docData.vendorName}`
    : '-';
  const warehouse = docData.warehouseName || docData.warehouseCode || '-';
  const status = docData.status || '-';

  const typeStr = docData.goodsReceiptTypeName || docData.goodsReceiptTypeCode || '-';
  const lines = docData.lines || [];

  const totalQty = lines.reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0);

  return (
    <div className="print-page pb-8 text-black font-sans text-[11px] leading-relaxed">
      <div className="text-center mb-6">
        <h1 className="text-lg font-bold tracking-wide">Goods Receipt</h1>
      </div>

      <div className="border border-slate-300 rounded mb-4 overflow-hidden">
        <div className="grid grid-cols-12">
          <div className="col-span-8 grid grid-cols-12 border-r border-slate-300">
            <div className="col-span-4 bg-slate-50 p-2 font-semibold border-b border-slate-200">Created Date</div>
            <div className="col-span-8 p-2 border-b border-slate-200 font-mono">{createdAt}</div>

            <div className="col-span-4 bg-slate-50 p-2 font-semibold border-b border-slate-200">Created by</div>
            <div className="col-span-8 p-2 border-b border-slate-200">{createdBy}</div>

            <div className="col-span-4 bg-slate-50 p-2 font-semibold border-b border-slate-200">Receipt Date</div>
            <div className="col-span-8 p-2 border-b border-slate-200 font-mono">{receiptDate}</div>

            <div className="col-span-4 bg-slate-50 p-2 font-semibold border-b border-slate-200">Vendor</div>
            <div className="col-span-8 p-2 border-b border-slate-200">{vendor}</div>

            <div className="col-span-4 bg-slate-50 p-2 font-semibold">Warehouse</div>
            <div className="col-span-8 p-2 font-medium">{warehouse}</div>
          </div>

          <div className="col-span-4 flex flex-col justify-between">
            <div className="flex p-3 gap-3 border-b border-slate-300 items-center justify-between bg-white flex-grow">
              <div className="flex flex-col justify-center">
                <div className="text-[10px] font-bold text-slate-500 mb-0.5">Goods Receipt No.</div>
                <div className="text-sm font-bold font-mono tracking-tight text-slate-900">{docNo}</div>
              </div>
              <div className="border border-slate-100 p-0.5 rounded bg-white shrink-0">
                <img
                  src={`/api/auth/qrcode/${encodeURIComponent(docNo)}`}
                  alt="Goods Receipt QR"
                  className="w-14 h-14"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 bg-slate-50 text-[10px]">
              <div className="col-span-4 font-semibold p-1.5 border-r border-slate-200 border-b border-slate-300">Type:</div>
              <div className="col-span-8 p-1.5 border-b border-slate-300 font-medium">{typeStr}</div>

              <div className="col-span-4 font-semibold p-1.5 border-r border-slate-200 border-b border-slate-300">Status:</div>
              <div className="col-span-8 p-1.5 border-b border-slate-300 font-mono">{status}</div>

              <div className="col-span-4 font-semibold p-1.5 border-r border-slate-200">Qty.</div>
              <div className="col-span-8 p-1.5 font-bold text-slate-900 text-xs">
                {totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 className="font-bold text-slate-900 mb-2 mt-4 text-[12px] border-b border-slate-200 pb-1">
        Receipt details
      </h3>

      <table className="w-full border-collapse border border-slate-300 mb-8 text-[11px]">
        <thead>
          <tr className="bg-slate-50 text-slate-800 text-left font-bold border-b border-slate-300">
            <th className="border border-slate-300 p-2 text-center w-12">ลำดับ</th>
            <th className="border border-slate-300 p-2">SKU | สินค้า</th>            
            <th className="border border-slate-300 p-2 text-right w-15">Qty.</th>
            <th className="border border-slate-300 p-2 text-center w-18">Unit</th>
            <th className="border border-slate-300 p-2 w-14">Lot</th>
            <th className="border border-slate-300 p-2 w-30">Location</th>
            <th className="border border-slate-300 p-2 w-30">Pallet/Tracking</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const sku = line.salesSKU || line.salesSku || line.itemCode || '-';
            const name = line.itemName ? `${line.itemName}${line.specName ? ` - ${line.specName}` : ''}` : '-';
            const qty = Number(line.receivedQuantity || 0);
            const unit = line.unitName || line.unitCode || '-';
            const lot = line.lotNo || '-';
            const location = line.locationCode
              ? `${line.warehouseCode || ''}${line.warehouseCode ? ' / ' : ''}${line.locationCode}`
              : '-';
            const pallet = line.palletNo || '-';

            return (
              <tr key={line.id || idx} className="border-b border-slate-200">
                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-300 p-2 font-mono font-semibold text-slate-700"><div>{sku}</div><div>{name}</div></td>                
                <td className="border border-slate-300 p-2 text-right font-semibold">
                  {qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border border-slate-300 p-2 text-center">{unit}</td>
                <td className="border border-slate-300 p-2 font-mono text-slate-600">{lot}</td>
                <td className="border border-slate-300 p-2 font-mono text-slate-700">{location}</td>
                <td className="border border-slate-300 p-2 font-mono text-slate-700">{pallet}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan="8" className="border border-slate-300 p-6 text-center text-slate-400">
                ไม่มีรายการสินค้า
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="grid grid-cols-4 gap-4 text-center text-[10px] mt-12 pt-8 border-t border-slate-200">
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Received by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Checked by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Approved by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
        <div className="flex flex-col items-center justify-between min-h-[70px]">
          <span className="text-slate-500">Putaway by:</span>
          <div className="w-full border-b border-dashed border-slate-300 mt-6 mb-1"></div>
          <span className="text-slate-400">..................................................</span>
        </div>
      </div>
    </div>
  );
}

