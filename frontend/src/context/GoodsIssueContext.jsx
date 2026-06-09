import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const GoodsIssueContext = createContext(null);

export function GoodsIssueProvider({ children }) {
  const { authHeaders } = useAuth();

  const getGoodsIssues = async (params = {}) => {
    const res = await ApiClient.get('/api/goods-issues', { headers: authHeaders, params });
    return res;
  };

  const getGoodsIssue = async (id) => {
    const res = await ApiClient.get(`/api/goods-issues/${id}`, { headers: authHeaders });
    return res.data;
  };

  const createGoodsIssue = async (payload) => {
    const res = await ApiClient.post('/api/goods-issues', payload, { headers: authHeaders });
    return res.data;
  };

  const updateGoodsIssue = async (id, payload) => {
    const res = await ApiClient.put(`/api/goods-issues/${id}`, payload, { headers: authHeaders });
    return res.data;
  };

  const getGoodsIssueTypes = async () => {
    const res = await ApiClient.get('/api/goods-issues/types', { headers: authHeaders });
    return res.data;
  };

  const createGoodsIssueType = async (payload) => {
    const res = await ApiClient.post('/api/goods-issues/types', payload, { headers: authHeaders });
    return res.data;
  };

  const updateGoodsIssueType = async (id, payload) => {
    const res = await ApiClient.put(`/api/goods-issues/types/${id}`, payload, { headers: authHeaders });
    return res.data;
  };

  const getGoodsIssueStatusHistory = async (id) => {
    const res = await ApiClient.get(`/api/goods-issues/${id}/status-history`, { headers: authHeaders });
    return res.data;
  };

  const requestGoodsIssueApproval = async (id) => {
    const res = await ApiClient.post(`/api/goods-issues/${id}/request-approval`, { steps: [] }, { headers: authHeaders });
    return res.data;
  };

  const approveGoodsIssue = async (id) => {
    const res = await ApiClient.post(`/api/goods-issues/${id}/approve`, {}, { headers: authHeaders });
    return res.data;
  };

  const postGoodsIssue = async (id) => {
    const res = await ApiClient.post(`/api/goods-issues/${id}/post`, {}, { headers: authHeaders });
    return res.data;
  };

  const cancelGoodsIssue = async (id, notes = null) => {
    const payload = notes ? { notes } : {};
    const res = await ApiClient.post(`/api/goods-issues/${id}/cancel`, payload, { headers: authHeaders });
    return res.data;
  };

  const value = useMemo(() => ({
    getGoodsIssues,
    getGoodsIssue,
    createGoodsIssue,
    updateGoodsIssue,
    getGoodsIssueTypes,
    createGoodsIssueType,
    updateGoodsIssueType,
    getGoodsIssueStatusHistory,
    requestGoodsIssueApproval,
    approveGoodsIssue,
    postGoodsIssue,
    cancelGoodsIssue,
  }), [authHeaders]);

  return (
    <GoodsIssueContext.Provider value={value}>
      {children}
    </GoodsIssueContext.Provider>
  );
}

export const useGoodsIssue = () => useContext(GoodsIssueContext);
