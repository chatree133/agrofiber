import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Empty, message } from 'antd';
import { useReactToPrint } from 'react-to-print';
import { useQuotation } from '../../context/QuotationContext';
import { useSalesOrder } from '../../context/SalesOrderContext';
import QtDocumentTemplate from './templates/QtDocumentTemplate';
import SoDocumentTemplate from './templates/SoDocumentTemplate';
import CpoDocumentTemplate from './templates/CpoDocumentTemplate';
import DoDocumentTemplate from './templates/DoDocumentTemplate';
import InvDocumentTemplate from './templates/InvDocumentTemplate';
import RcptDocumentTemplate from './templates/RcptDocumentTemplate';
import CombinedBillingTemplate from './templates/CombinedBillingTemplate';
import WavePrintTemplate from './templates/WavePrintTemplate';
import LabelPrintTemplate from './templates/LabelPrintTemplate';
import ApiClient from '../../context/Api.jsx';

export default function DocumentPrint() {
  const [searchParams] = useSearchParams();
  const formType = searchParams.get('form') || 'QT'; // 'QT', 'SO', 'CPO', 'DO', 'INV', 'RCPT', or 'COMBINED'
  const docId = searchParams.get('docId');
  const lineId = searchParams.get('lineId');

  const { getQuotationDetail } = useQuotation();
  const { getSalesOrderDetail } = useSalesOrder();

  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState(null);

  const printAreaRef = useRef(null);

  // Helper to determine document title in print metadata
  const getDocTitleForPrint = () => {
    if (!docData) return 'document';
    
    if (formType === 'COMBINED') {
      const doNo = docData.doData?.DocumentNo || docData.doData?.documentNo || '';
      return `ชุดเอกสารส่งมอบและรับเงิน_${doNo}`;
    }

    const docNoRaw = docData.DocumentNo || docData.documentNo || docData.PaymentNo || docData.paymentNo || '';
    const docNo = formType === 'CPO' ? docNoRaw.replace(/^QT(\d*)-/, 'PO-C$1-') : docNoRaw;
    
    let prefix = 'เอกสาร';
    if (formType === 'QT') prefix = 'ใบเสนอราคา';
    else if (formType === 'SO') prefix = 'ใบสั่งขาย';
    else if (formType === 'CPO') prefix = 'ใบสั่งซื้อ';
    else if (formType === 'DO') prefix = 'ใบส่งสินค้า';
    else if (formType === 'INV') prefix = 'ใบกำกับภาษี';
    else if (formType === 'RCPT') prefix = 'ใบเสร็จรับเงิน';
    
    return `${prefix}_${docNo}`;
  };

  // Setup react-to-print v3
  const handlePrint = useReactToPrint({
    contentRef: printAreaRef,
    documentTitle: getDocTitleForPrint(),
  });

  useEffect(() => {
    if (!docId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        let res = null;
        if (formType === 'QT' || formType === 'CPO') {
          res = await getQuotationDetail(docId);
        } else if (formType === 'SO') {
          res = await getSalesOrderDetail(docId);
        } else if (formType === 'DO') {
          const doRes = await ApiClient.get(`/api/delivery-orders/${docId}`);
          res = doRes.data;
        } else if (formType === 'INV') {
          const invRes = await ApiClient.get(`/api/sales-invoices/${docId}`);
          res = invRes.data;
        } else if (formType === 'RCPT') {
          const rcptRes = await ApiClient.get(`/api/customer-payments/${docId}`);
          res = rcptRes.data;
        } else if (formType === 'WAVE') {
          const waveRes = await ApiClient.get(`/api/wms/waves/${docId}`);
          res = waveRes.data;
        } else if (formType === 'LABEL') {
          const grRes = await ApiClient.get(`/api/goods-receipts/${docId}`);
          res = grRes.data;
        } else if (formType === 'COMBINED') {
          // docId is the deliveryOrderId
          // Fetch DO
          const doRes = await ApiClient.get(`/api/delivery-orders/${docId}`);
          const doData = doRes.data;

          // Fetch Invoice
          let invData = null;
          const invListRes = await ApiClient.get('/api/sales-invoices', { deliveryOrderId: docId });
          if (invListRes.data?.length > 0) {
            const invDetailRes = await ApiClient.get(`/api/sales-invoices/${invListRes.data[0].id}`);
            invData = invDetailRes.data;
          }

          // Fetch Receipt
          let rcptData = null;
          if (invData) {
            const pmtListRes = await ApiClient.get('/api/customer-payments', { salesInvoiceId: invData.SalesInvoiceId || invData.id });
            if (pmtListRes.data?.length > 0) {
              const pmtDetailRes = await ApiClient.get(`/api/customer-payments/${pmtListRes.data[0].id}`);
              rcptData = pmtDetailRes.data;
            }
          }

          res = { doData, invData, rcptData };
        }
        setDocData(res);
      } catch (err) {
        console.error('Failed to load print document', err);
        message.error('โหลดข้อมูลพิมพ์เอกสารไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [docId, formType]);

  // Trigger print dialog once loaded
  useEffect(() => {
    if (!loading && docData) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading, docData, handlePrint]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <Spin size="large" tip="กำลังจัดเตรียมเอกสารสำหรับพิมพ์..." />
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="p-8">
        <Empty description="ไม่พบข้อมูลเอกสารที่ต้องการพิมพ์" />
      </div>
    );
  }

  // Render correct template component based on formType
  const renderTemplate = () => {
    switch (formType) {
      case 'QT':
        return <QtDocumentTemplate docData={docData} />;
      case 'SO':
        return <SoDocumentTemplate docData={docData} />;
      case 'CPO':
        return <CpoDocumentTemplate docData={docData} />;
      case 'DO':
        return <DoDocumentTemplate docData={docData} />;
      case 'INV':
        return <InvDocumentTemplate docData={docData} />;
      case 'RCPT':
        return <RcptDocumentTemplate docData={docData} />;
      case 'WAVE':
        return <WavePrintTemplate docData={docData} />;
      case 'LABEL':
        return <LabelPrintTemplate docData={docData} lineId={lineId} />;
      case 'COMBINED':
        return <CombinedBillingTemplate docData={docData} />;
      default:
        return <Empty description="ไม่พบรูปแบบฟอร์มสำหรับพิมพ์" />;
    }
  };

  return (
    <div className="bg-slate-100 min-h-screen py-8 px-4 no-print-bg">
      {/* Dynamic Printing Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-document {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            min-height: auto !important;
          }
          @page {
            size: ${formType === 'LABEL' ? 'auto' : 'A4 portrait'};
            margin: ${formType === 'LABEL' ? '0.5cm' : '1.5cm'};
          }
        }
      ` }} />

      {/* Manual print button helper for browser check */}
      <div className="no-print flex justify-end gap-2 mb-6 max-w-[800px] mx-auto bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <span className="text-slate-600 self-center font-medium mr-auto">
          พรีวิวเอกสารพิมพ์ (A4 Portrait)
        </span>
        <button
          onClick={handlePrint}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded shadow-sm text-xs transition"
        >
          พิมพ์เอกสาร (Print)
        </button>
      </div>

      {/* Printable Area Wrapper */}
      <div
        ref={printAreaRef}
        className="print-document bg-white font-sans text-slate-800 text-xs p-10 max-w-[800px] mx-auto min-h-[1000px] shadow-lg rounded-sm relative"
      >
        {renderTemplate()}
      </div>
    </div>
  );
}
