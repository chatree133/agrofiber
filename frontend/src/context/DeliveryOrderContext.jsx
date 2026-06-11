import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const DeliveryOrderContext = createContext(null);

export function DeliveryOrderProvider({ children }) {
  const { authHeaders } = useAuth();

  const getDeliveryOrders = async (params = {}) => {
    const res = await ApiClient.get('/api/delivery-orders', { headers: authHeaders, params });
    return res; // Returns list and pagination
  };

  const getDeliveryOrderDetail = async (id) => {
    const res = await ApiClient.get(`/api/delivery-orders/${id}`, { headers: authHeaders });
    return res.data; // Returns DO detail data object
  };

  const deliverAndBill = async (id, payload) => {
    const res = await ApiClient.post(`/api/delivery-orders/${id}/deliver-and-bill`, payload, { headers: authHeaders });
    return res.data;
  };

  const getSalesInvoices = async (params = {}) => {
    const res = await ApiClient.get('/api/sales-invoices', { headers: authHeaders, params });
    return res;
  };

  const updateDeliveryOrder = async (id, payload) => {
    const res = await ApiClient.put(`/api/delivery-orders/${id}`, payload, { headers: authHeaders });
    return res.data;
  };

  const value = useMemo(() => ({
    getDeliveryOrders,
    getDeliveryOrderDetail,
    deliverAndBill,
    getSalesInvoices,
    updateDeliveryOrder
  }), [authHeaders]);

  return (
    <DeliveryOrderContext.Provider value={value}>
      {children}
    </DeliveryOrderContext.Provider>
  );
}

export const useDeliveryOrder = () => useContext(DeliveryOrderContext);
