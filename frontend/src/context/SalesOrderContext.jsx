import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const SalesOrderContext = createContext(null);

export function SalesOrderProvider({ children }) {
  const { authHeaders } = useAuth();

  const getSalespersons = async (searchVal) => {
    const res = await ApiClient.get(`/api/master-data/salespersons?search=${encodeURIComponent(searchVal)}`, { headers: authHeaders });
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
    const res = await ApiClient.get(`/api/sale-orders/customer-history/${customerId}`, { headers: authHeaders });
    return res.data;
  };

  const getSalesOrderDetail = async (salesOrderId) => {
    const res = await ApiClient.get(`/api/sale-orders/${salesOrderId}`, { headers: authHeaders });
    return res.data;
  };

  const createSalesOrder = async (payload) => {
    const res = await ApiClient.post('/api/sale-orders', payload, { headers: authHeaders });
    return res.data;
  };

  const updateSalesOrder = async (id, payload) => {
    const res = await ApiClient.put(`/api/sale-orders/${id}`, payload, { headers: authHeaders });
    return res.data;
  };

  const requestApproval = async (id, steps = []) => {
    const res = await ApiClient.post(`/api/sale-orders/${id}/request-approval`, { steps }, { headers: authHeaders });
    return res.data;
  };

  const getSalesOrders = async (params = {}) => {
    const res = await ApiClient.get('/api/sale-orders', { headers: authHeaders, params });
    return res;
  };

  const cancelSalesOrder = async (id, notes = '') => {
    const res = await ApiClient.post(`/api/sale-orders/${id}/cancel`, { notes }, { headers: authHeaders });
    return res;
  };

  const getSchedulerVehicles = async (params = {}) => {
    const res = await ApiClient.get('/api/sale-orders/delivery-scheduler/vehicles', { headers: authHeaders, params });
    return res;
  };

  const getSchedulerSlots = async (params = {}) => {
    const res = await ApiClient.get('/api/sale-orders/delivery-scheduler/slots', { headers: authHeaders, params });
    return res;
  };

  const reserveSchedulerSlot = async (payload) => {
    const res = await ApiClient.post('/api/sale-orders/delivery-scheduler/reserve', payload, { headers: authHeaders });
    return res;
  };

  const value = useMemo(() => ({
    getSalespersons,
    getPriceLookup,
    searchSkus,
    getCustomerHistory,
    getSalesOrderDetail,
    createSalesOrder,
    updateSalesOrder,
    requestApproval,
    getSalesOrders,
    cancelSalesOrder,
    getSchedulerVehicles,
    getSchedulerSlots,
    reserveSchedulerSlot
  }), [authHeaders]);

  return (
    <SalesOrderContext.Provider value={value}>
      {children}
    </SalesOrderContext.Provider>
  );
}

export const useSalesOrder = () => useContext(SalesOrderContext);
