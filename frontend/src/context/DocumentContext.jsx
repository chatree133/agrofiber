import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const DocumentContext = createContext(null);

export function DocumentProvider({ children }) {
  const { authHeaders } = useAuth();

  const getDeliveryOrderDetail = async (docId) => {
    const res = await ApiClient.get(`/api/delivery-orders/${docId}`, null, { headers: authHeaders });
    return res?.data || res;
  };

  const getSalesInvoiceDetail = async (docId) => {
    const res = await ApiClient.get(`/api/sales-invoices/${docId}`, null, { headers: authHeaders });
    return res?.data || res;
  };

  const getCustomerPaymentDetail = async (docId) => {
    const res = await ApiClient.get(`/api/customer-payments/${docId}`, null, { headers: authHeaders });
    return res?.data || res;
  };

  const getWmsWaveDetail = async (docId) => {
    const res = await ApiClient.get(`/api/wms/waves/${docId}`, null, { headers: authHeaders });
    return res?.data || res;
  };

  const getGoodsReceiptDetail = async (docId) => {
    const res = await ApiClient.get(`/api/goods-receipts/${docId}`, null, { headers: authHeaders });
    return res?.data || res;
  };

  const getGoodsIssueDetail = async (docId) => {
    const res = await ApiClient.get(`/api/goods-issues/${docId}`, null, { headers: authHeaders });
    return res?.data || res;
  };

  const getSalesInvoices = async (params) => {
    const res = await ApiClient.get('/api/sales-invoices', params, { headers: authHeaders });
    return res?.data || res;
  };

  const getCustomerPayments = async (params) => {
    const res = await ApiClient.get('/api/customer-payments', params, { headers: authHeaders });
    return res?.data || res;
  };

  const value = useMemo(() => ({
    getDeliveryOrderDetail,
    getSalesInvoiceDetail,
    getCustomerPaymentDetail,
    getWmsWaveDetail,
    getGoodsReceiptDetail,
    getGoodsIssueDetail,
    getSalesInvoices,
    getCustomerPayments
  }), [authHeaders]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export const useDocument = () => useContext(DocumentContext);
