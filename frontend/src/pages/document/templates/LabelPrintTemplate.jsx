import React from 'react';

export default function LabelPrintTemplate({ docData, lineId }) {
  let lines = docData.lines || [];

  // If lineId is provided and not '0', filter to print only that specific line
  if (lineId && lineId !== '0' && lineId !== 0) {
    lines = lines.filter(line => String(line.id || line.GoodsReceiptLineId) === String(lineId));
  }

  const receiptDateStr = docData.receiptDate
    ? new Date(docData.receiptDate).toLocaleDateString('th-TH')
    : new Date().toLocaleDateString('th-TH');

  return (
    <div className="flex flex-col gap-10">
      {lines.map((line, index) => {
        // Fallbacks for Location format
        const locCode = line.locationCode || 'STG-01';
        const parts = locCode.split('-');
        const zone = parts[0] || 'A';
        const aisle = parts[1] || '01';
        const rack = parts[2] || '02';
        const level = parts[3] || '03';
        const position = parts[4] || '-';

        // Pallet ID parsing - running sequence takes priority, fallback to lotNo
        const rawLot = line.lotNo || '0626';
        const palletId = line.palletNo || `PLT${rawLot}`;

        // Dimensions parsing
        const thickness = line.thicknessLabel || (line.thicknessMm ? `${line.thicknessMm} mm` : '18 mm');
        const size = line.widthMm && line.lengthMm
          ? `${line.widthMm} x ${line.lengthMm} mm`
          : '1220 x 2440 mm';

        // Qty formatting
        const qtyText = `${line.receivedQuantity || 0} ${line.unitName || 'Sheet'}`;
        const itemCodeText = line.salesSKU || line.itemCode || '-';
        const itemNameText = line.itemName
          ? `${line.itemName}${line.specName ? ` - ${line.specName}` : ''}`
          : '-';

        // Parse level number for SVG highlights
        const levelNum = parseInt(level, 10) || 1;

        return (
          <div
            key={line.id || index}
            className="flex flex-row gap-4 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 items-start justify-center page-break max-w-[700px] mx-auto"
            style={{ breakAfter: 'page', pageBreakAfter: 'always' }}
          >
            {/* 1. LOCATION LABEL */}
            <div
              className="bg-white border-2 border-slate-900 rounded-lg overflow-hidden flex flex-col font-sans shadow-sm"
              style={{ width: '315px', height: '550px' }}
            >
              {/* Header */}
              <div className="bg-slate-900 text-white text-center font-bold text-[12px] py-2 tracking-wider">
                LOCATION LABEL
              </div>

              {/* Location Block */}
              <div className="bg-[#FFC107] text-slate-900 px-4 py-3 text-center border-b-2 border-slate-900">
                <div className="text-[10px] uppercase font-extrabold tracking-widest opacity-80">LOCATION</div>
                <div className="text-3xl font-black tracking-wider font-mono mt-0.5">{locCode}</div>
              </div>

              {/* Grid Details and Visual Rack */}
              <div className="grid grid-cols-12 p-3 border-b-2 border-slate-900 flex-grow items-center">
                <div className="col-span-6 flex flex-col gap-1.5 text-[11px] font-bold text-slate-700 pr-2">
                  <div className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span>ZONE</span>
                    <span className="font-mono text-slate-900">: {zone}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span>AISLE</span>
                    <span className="font-mono text-slate-900">: {aisle}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span>RACK</span>
                    <span className="font-mono text-slate-900">: {rack}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span>LEVEL</span>
                    <span className="font-mono text-slate-900">: {level}</span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span>POSITION</span>
                    <span className="font-mono text-slate-900">: {position}</span>
                  </div>
                </div>

                {/* Vector Rack Diagram */}
                <div className="col-span-6 flex justify-center items-center border-l border-slate-100 pl-2">
                  <svg width="85" height="105" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
                    {/* Uprights */}
                    <rect x="15" y="10" width="4" height="100" fill="#475569" rx="1" />
                    <rect x="65" y="10" width="4" height="100" fill="#475569" rx="1" />

                    {/* Diagonal cross braces */}
                    <line x1="19" y1="20" x2="65" y2="40" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="65" y1="40" x2="19" y2="60" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="19" y1="60" x2="65" y2="80" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="65" y1="80" x2="19" y2="100" stroke="#cbd5e1" strokeWidth="1" />

                    {/* Shelves */}
                    <rect x="15" y="38" width="54" height="4" fill="#334155" />
                    <rect x="15" y="68" width="54" height="4" fill="#334155" />
                    <rect x="15" y="98" width="54" height="4" fill="#334155" />

                    {/* Dynamic Pallet/Load Highlighting */}
                    <rect x="22" y="18" width="40" height="18" fill={levelNum === 3 ? '#FFC107' : 'transparent'} stroke={levelNum === 3 ? '#D97706' : 'transparent'} strokeWidth={levelNum === 3 ? '1.5' : '0'} rx="1.5" />
                    <rect x="22" y="48" width="40" height="18" fill={levelNum === 2 ? '#FFC107' : 'transparent'} stroke={levelNum === 2 ? '#D97706' : 'transparent'} strokeWidth={levelNum === 2 ? '1.5' : '0'} rx="1.5" />
                    <rect x="22" y="78" width="40" height="18" fill={levelNum === 1 ? '#FFC107' : 'transparent'} stroke={levelNum === 1 ? '#D97706' : 'transparent'} strokeWidth={levelNum === 1 ? '1.5' : '0'} rx="1.5" />

                    {/* Level indicators */}
                    <g opacity="0.9">
                      <rect x="74" y="23" width="22" height="9" fill="#1e293b" rx="1" />
                      <text x="85" y="30" fill="#fff" fontSize="5.5" fontWeight="bold" textAnchor="middle">LEVEL 03</text>
                      <path d="M 69 27.5 L 74 27.5" stroke="#475569" strokeWidth="0.75" strokeDasharray="1 1" />
                    </g>
                    <g opacity="0.9">
                      <rect x="74" y="53" width="22" height="9" fill="#1e293b" rx="1" />
                      <text x="85" y="60" fill="#fff" fontSize="5.5" fontWeight="bold" textAnchor="middle">LEVEL 02</text>
                      <path d="M 69 57.5 L 74 57.5" stroke="#475569" strokeWidth="0.75" strokeDasharray="1 1" />
                    </g>
                    <g opacity="0.9">
                      <rect x="74" y="83" width="22" height="9" fill="#1e293b" rx="1" />
                      <text x="85" y="90" fill="#fff" fontSize="5.5" fontWeight="bold" textAnchor="middle">LEVEL 01</text>
                      <path d="M 69 87.5 L 74 87.5" stroke="#475569" strokeWidth="0.75" strokeDasharray="1 1" />
                    </g>
                    <g opacity="0.9">
                      <rect x="34" y="109" width="32" height="8" fill="#1e293b" rx="1" />
                      <text x="50" y="115" fill="#fff" fontSize="5" fontWeight="bold" textAnchor="middle">ZONE {zone}</text>
                    </g>
                  </svg>
                </div>
              </div>

              {/* QR Section */}
              <div className="flex flex-col items-center py-2 px-3 border-b-2 border-slate-900 bg-white min-h-[120px] justify-center">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">LOCATION QR CODE</div>
                {line.locationCode ? (
                  <img
                    src={`/api/auth/qrcode/${encodeURIComponent(locCode)}`}
                    alt="Location QR"
                    className="w-[90px] h-[90px]"
                  />
                ) : (
                  <div className="w-[90px] h-[90px] border border-dashed border-slate-300 rounded flex flex-col justify-center items-center text-center text-[9px] font-bold text-amber-600 bg-amber-50 px-1">
                    <svg className="w-5 h-5 text-amber-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>รอสแกนจัดเก็บ<br/>(Putaway)</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-50 py-4 px-3 flex justify-between items-center text-[9px] font-bold text-slate-700 uppercase">
                <div className="flex items-center gap-1">
                  {/* Warehouse SVG Icon */}
                  <svg className="w-3 h-3 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>SCAN FOR PUT AWAY / PICK / COUNT</span>
                </div>
                <div className="flex items-center gap-1 border-l border-slate-300 pl-2">
                  {/* Warning SVG Icon */}
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-slate-700">KEEP CLEAN</span>
                </div>
              </div>
            </div>

            {/* 2. PALLET LABEL */}
            <div
              className="bg-white border-2 border-slate-900 rounded-lg overflow-hidden flex flex-col font-sans shadow-sm"
              style={{ width: '350px', height: '550px' }}
            >
              {/* Header */}
              <div className="bg-slate-900 text-white text-center font-bold text-[12px] py-2 tracking-wider">
                PALLET LABEL
              </div>

              {/* Pallet ID & QR Header */}
              <div className="flex border-b-2 border-slate-900 items-center p-3 justify-between bg-slate-50">
                <div>
                  <div className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">PALLET ID</div>
                  <div className="text-xl font-black font-mono text-slate-900 tracking-tight mt-0.5">{palletId}</div>
                </div>
                <div className="text-center">
                  <div className="text-[7.5px] font-bold text-slate-400 uppercase mb-0.5">QR CODE (PALLET)</div>
                  <img
                    src={`/api/auth/qrcode/${encodeURIComponent(palletId)}`}
                    alt="Pallet QR"
                    className="w-[60px] h-[60px] mx-auto border border-slate-100 rounded bg-white p-0.5"
                  />
                </div>
              </div>

              {/* Grid Details Table */}
              <div className="flex-grow p-2 text-[10.5px]">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500 font-bold uppercase w-[110px] flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </span>
                        <span>ITEM</span>
                      </td>
                      <td className="py-1.5 font-bold text-slate-900 truncate max-w-[190px]" title={itemCodeText}>
                        <div>{itemCodeText}</div>
                        <div className="text-[8.5px] text-slate-500 font-normal truncate max-w-[190px]">{itemNameText}</div>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500 font-bold uppercase flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h2v12H4zm4 0h1v12H8zm3 0h3v12h-3zm5 0h2v12h-2zm3 0h1v12h-1z" />
                          </svg>
                        </span>
                        <span>LOT</span>
                      </td>
                      <td className="py-1.5 font-bold text-slate-900 font-mono text-xs">{rawLot}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500 font-bold uppercase flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m0 11v1m0-6V4m0 8h4m-4-4h2m-2 8h3M4 8h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z" />
                          </svg>
                        </span>
                        <span>SIZE</span>
                      </td>
                      <td className="py-1.5 text-slate-700 font-mono font-medium">{size}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500 font-bold uppercase flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10M7 21h10M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3" />
                          </svg>
                        </span>
                        <span>THICKNESS</span>
                      </td>
                      <td className="py-1.5 text-slate-700 font-mono font-medium">{thickness}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500 font-bold uppercase flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </span>
                        <span>QTY</span>
                      </td>
                      <td className="py-1.5 font-bold text-slate-900 text-xs">{qtyText}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500 font-bold uppercase flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </span>
                        <span>MFG DATE</span>
                      </td>
                      <td className="py-1.5 text-slate-700 font-mono font-medium">{receiptDateStr}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500 font-bold uppercase flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                          </svg>
                        </span>
                        <span>GROSS WT.</span>
                      </td>
                      <td className="py-1.5 text-slate-700 font-mono font-medium">-</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-slate-500 font-bold uppercase flex items-center gap-1.5">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded">
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </span>
                        <span>REMARK</span>
                      </td>
                      <td className="py-1.5 text-slate-700 truncate max-w-[190px]" title={line.remark}>
                        {line.remark || '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Barcode Section */}
              <div className="bg-slate-50 border-t-2 border-slate-900 py-2 flex flex-col items-center justify-center">
                <img
                  src={`/api/auth/barcode/${encodeURIComponent(palletId)}`}
                  alt="Barcode"
                  className="h-[55px] max-w-[290px]"
                />
                <div className="text-[10px] font-mono font-bold tracking-widest text-slate-800 mt-1.5">
                  {palletId}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
