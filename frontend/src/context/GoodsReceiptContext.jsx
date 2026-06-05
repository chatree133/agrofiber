import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const GoodsReceiptContext = createContext(null);

export function GoodsReceiptProvider({ children }) {
  const { authHeaders } = useAuth();

  const getGoodsReceipts = async (params = {}) => {
    const res = await ApiClient.get('/api/goods-receipts', { headers: authHeaders, params });
    return res;
  };

  const getGoodsReceipt = async (id) => {
    const res = await ApiClient.get(`/api/goods-receipts/${id}`, { headers: authHeaders });
    return res.data;
  };

  const createGoodsReceipt = async (payload) => {
    const res = await ApiClient.post('/api/goods-receipts', payload, { headers: authHeaders });
    return res.data;
  };

  const updateGoodsReceipt = async (id, payload) => {
    const res = await ApiClient.put(`/api/goods-receipts/${id}`, payload, { headers: authHeaders });
    return res.data;
  };

  const getGoodsReceiptTypes = async () => {
    const res = await ApiClient.get('/api/goods-receipts/types', { headers: authHeaders });
    return res.data;
  };

  const createGoodsReceiptType = async (payload) => {
    const res = await ApiClient.post('/api/goods-receipts/types', payload, { headers: authHeaders });
    return res.data;
  };

  const updateGoodsReceiptType = async (id, payload) => {
    const res = await ApiClient.put(`/api/goods-receipts/types/${id}`, payload, { headers: authHeaders });
    return res.data;
  };

  const getGoodsReceiptStatusHistory = async (id) => {
    const res = await ApiClient.get(`/api/goods-receipts/${id}/status-history`, { headers: authHeaders });
    return res.data;
  };

  const postGoodsReceipt = async (id) => {
    const res = await ApiClient.post(`/api/goods-receipts/${id}/post`, {}, { headers: authHeaders });
    return res.data;
  };

  const value = useMemo(() => ({
    getGoodsReceipts,
    getGoodsReceipt,
    createGoodsReceipt,
    updateGoodsReceipt,
    getGoodsReceiptTypes,
    createGoodsReceiptType,
    updateGoodsReceiptType,
    getGoodsReceiptStatusHistory,
    postGoodsReceipt,
  }), [authHeaders]);

  return (
    <GoodsReceiptContext.Provider value={value}>
      {children}
    </GoodsReceiptContext.Provider>
  );
}

export const useGoodsReceipt = () => useContext(GoodsReceiptContext);
