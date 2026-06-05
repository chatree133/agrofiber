import React from 'react';
import DoDocumentTemplate from './DoDocumentTemplate';
import InvDocumentTemplate from './InvDocumentTemplate';
import RcptDocumentTemplate from './RcptDocumentTemplate';

export default function CombinedBillingTemplate({ docData }) {
  if (!docData) return null;
  const { doData, invData, rcptData } = docData;

  return (
    <div className="combined-billing-print flex flex-col gap-8">
      {doData && (
        <div className="print-section border-b border-dashed border-slate-300 pb-8 last:border-0 last:pb-0">
          <DoDocumentTemplate docData={doData} />
        </div>
      )}
      {invData && (
        <div className="print-section border-b border-dashed border-slate-300 pb-8 last:border-0 last:pb-0 break-before-page">
          <InvDocumentTemplate docData={invData} />
        </div>
      )}
      {rcptData && (
        <div className="print-section last:border-0 last:pb-0 break-before-page">
          <RcptDocumentTemplate docData={rcptData} />
        </div>
      )}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          .break-before-page {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      ` }} />
    </div>
  );
}
