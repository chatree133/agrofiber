import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext';

const ItemContext = createContext(null);

export function ItemProvider({ children }) {
  const { authHeaders } = useAuth();

  const getItems = async (params) => {
    const data = await ApiClient.get('/api/items', { headers: authHeaders, params });
    return data;
  };

  const getItem = async (id) => {
    const data = await ApiClient.get(`/api/items/${id}`, { headers: authHeaders });
    return data.data;
  };

  const createItem = async (payload) => {
    const data = await ApiClient.post('/api/items', payload, { headers: authHeaders });
    return data.data;
  };

  const updateItem = async (id, payload) => {
    await ApiClient.put(`/api/items/${id}`, payload, { headers: authHeaders });
  };

  const deleteItems = async (ids) => {
    if (ids.length === 1) {
      await ApiClient.delete(`/api/items/${ids[0]}`, { headers: authHeaders });
    } else {
      await ApiClient.delete('/api/items', { headers: authHeaders, data: { ids } });
    }
  };

  const getItemSpecs = async (id) => {
    const data = await ApiClient.get(`/api/items/${id}/specs`, { headers: authHeaders });
    return data.data;
  };

  const createItemSpec = async (id, values) => {
    await ApiClient.post(`/api/items/${id}/specs`, values, { headers: authHeaders });
  };

  const updateItemSpec = async (id, specId, values) => {
    await ApiClient.put(`/api/items/${id}/specs/${specId}`, values, { headers: authHeaders });
  };

  const deleteItemSpec = async (id, specId) => {
    await ApiClient.delete(`/api/items/${id}/specs/${specId}`, { headers: authHeaders });
  };

  const createItemPricingPolicy = async (id, payload) => {
    const data = await ApiClient.post(`/api/items/${id}/pricing-policies`, payload, { headers: authHeaders });
    return data.data;
  };

  const createItemPricingPoliciesBulk = async (rows) => {
    const data = await ApiClient.post(
      '/api/items/bulk/pricing-policies',
      { rows },
      { headers: authHeaders },
    );
    return data.data;
  };

  const getItemPricingPolicyHistory = async (params) => {
    const data = await ApiClient.get('/api/items/pricing-policies/history', { headers: authHeaders, params });
    return data.data;
  };

  const getItemPricingPoliciesByVersionNo = async (versionNo) => {
    const data = await ApiClient.get(`/api/items/pricing-policies/by-version/${encodeURIComponent(versionNo)}`, { headers: authHeaders });
    return data.data;
  };

  const getItemPricingPolicies = async (id) => {
    const data = await ApiClient.get(`/api/items/${id}/pricing-policies`, { headers: authHeaders });
    return data.data;
  };

  const getItemPricingPolicy = async (id, policyId) => {
    const data = await ApiClient.get(`/api/items/${id}/pricing-policies/${policyId}`, { headers: authHeaders });
    return data.data;
  };

  const getItemPricingPolicyApprovalRequest = async (id, policyId) => {
    const data = await ApiClient.get(`/api/items/${id}/pricing-policies/${policyId}/approval-request`, { headers: authHeaders });
    return data.data;
  };

  const validateItemPricingPolicy = async (id, policyId) => {
    const data = await ApiClient.post(`/api/items/${id}/pricing-policies/${policyId}/validate`, {}, { headers: authHeaders });
    return data.data;
  };

  const requestItemPricingPolicyApproval = async (id, policyId, steps = []) => {
    const data = await ApiClient.post(
      `/api/items/${id}/pricing-policies/${policyId}/request-approval`,
      { steps },
      { headers: authHeaders },
    );
    return data.data;
  };

  const approveItemPricingPolicy = async (id, policyId) => {
    const data = await ApiClient.post(`/api/items/${id}/pricing-policies/${policyId}/approve`, {}, { headers: authHeaders });
    return data.data;
  };

  const publishItemPricingPolicy = async (id, policyId, priceListId, unitId) => {
    const data = await ApiClient.post(
      `/api/items/${id}/pricing-policies/${policyId}/publish`,
      { priceListId, unitId },
      { headers: authHeaders },
    );
    return data.data;
  };

  const value = useMemo(() => ({
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItems,
    getItemSpecs,
    createItemSpec,
    updateItemSpec,
    deleteItemSpec,
    createItemPricingPolicy,
    createItemPricingPoliciesBulk,
    getItemPricingPolicyHistory,
    getItemPricingPoliciesByVersionNo,
    getItemPricingPolicies,
    getItemPricingPolicy,
    getItemPricingPolicyApprovalRequest,
    validateItemPricingPolicy,
    requestItemPricingPolicyApproval,
    approveItemPricingPolicy,
    publishItemPricingPolicy,
  }), [authHeaders]);

  return (
    <ItemContext.Provider value={value}>
      {children}
    </ItemContext.Provider>
  );
}

export const useItem = () => useContext(ItemContext);
