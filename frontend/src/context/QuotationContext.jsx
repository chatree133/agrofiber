import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const QuotationContext = createContext(null);

export function QuotationProvider({ children }) {
  const { authHeaders } = useAuth();

  const getSalespersons = async (searchVal) => {
    const res = await ApiClient.get(`/api/master-data/salespersons?search=${encodeURIComponent(searchVal)}`, { headers: authHeaders });
    return res.data;
  };

  const uploadAttachment = async (payload) => {
    const res = await ApiClient.post('/api/quotations/upload', payload, { headers: authHeaders });
    return res.data;
  };

  const getPriceLookup = async (customerId, itemId, unitId, itemSpecId = null) => {
    const res = await ApiClient.get(`/api/quotations/price-lookup`, {
      params: { customerId, itemId, unitId, itemSpecId },
      headers: authHeaders
    });
    return res.data;
  };

  const searchSkus = async (searchVal, page = 1, pageSize = 20) => {
    const res = await ApiClient.get(`/api/items/skus`, {
      params: {
        search: searchVal,
        page,
        pageSize
      },
      headers: authHeaders
    });
    return res.data;
  };

  const getCustomerHistory = async (customerId) => {
    const res = await ApiClient.get(`/api/quotations/customer-history/${customerId}`, { headers: authHeaders });
    return res.data;
  };

  const getQuotationDetail = async (quotationId) => {
    const res = await ApiClient.get(`/api/quotations/${quotationId}`, { headers: authHeaders });
    return res.data;
  };

  const createQuotation = async (payload) => {
    const res = await ApiClient.post('/api/quotations', payload, { headers: authHeaders });
    return res.data;
  };

  const getQuotations = async (params = {}) => {
    const res = await ApiClient.get('/api/quotations', { headers: authHeaders, params });
    return res;
  };

  const deleteQuotation = async (id) => {
    const res = await ApiClient.delete(`/api/quotations/${id}`, { headers: authHeaders });
    return res;
  };

  const requestApproval = async (id, steps = []) => {
    const res = await ApiClient.post(`/api/quotations/${id}/request-approval`, { steps }, { headers: authHeaders });
    return res.data;
  };

  const value = useMemo(() => ({
    getSalespersons,
    uploadAttachment,
    getPriceLookup,
    searchSkus,
    getCustomerHistory,
    getQuotationDetail,
    createQuotation,
    getQuotations,
    deleteQuotation,
    requestApproval
  }), [authHeaders]);

  return (
    <QuotationContext.Provider value={value}>
      {children}
    </QuotationContext.Provider>
  );
}

export const useQuotation = () => useContext(QuotationContext);
