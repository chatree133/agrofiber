import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const CustomerContext = createContext(null);

export function CustomerProvider({ children }) {
  const { authHeaders } = useAuth();

  const getCustomers = async (params = {}) => {
    const data = await ApiClient.get('/api/customers', { headers: authHeaders, params });
    return data;
  };

  const getCustomer = async (id) => {
    const data = await ApiClient.get(`/api/customers/${id}`, { headers: authHeaders });
    return data.data;
  };

  const createCustomer = async (payload) => {
    const data = await ApiClient.post('/api/customers', payload, { headers: authHeaders });
    return data.data;
  };

  const updateCustomer = async (id, payload) => {
    const data = await ApiClient.put(`/api/customers/${id}`, payload, { headers: authHeaders });
    return data.data;
  };

  const deleteCustomer = async (id) => {
    await ApiClient.delete(`/api/customers/${id}`, { headers: authHeaders });
  };

  const getAddresses = async (customerId) => {
    const data = await ApiClient.get(`/api/customers/${customerId}/addresses`, { headers: authHeaders });
    return data.data;
  };

  const createAddress = async (customerId, payload) => {
    const data = await ApiClient.post(`/api/customers/${customerId}/addresses`, payload, { headers: authHeaders });
    return data.data;
  };

  const updateAddress = async (customerId, addressId, payload) => {
    const data = await ApiClient.put(`/api/customers/${customerId}/addresses/${addressId}`, payload, { headers: authHeaders });
    return data.data;
  };

  const deleteAddress = async (customerId, addressId) => {
    await ApiClient.delete(`/api/customers/${customerId}/addresses/${addressId}`, { headers: authHeaders });
  };

  const getContacts = async (customerId) => {
    const data = await ApiClient.get(`/api/customers/${customerId}/contacts`, { headers: authHeaders });
    return data.data;
  };

  const createContact = async (customerId, payload) => {
    const data = await ApiClient.post(`/api/customers/${customerId}/contacts`, payload, { headers: authHeaders });
    return data.data;
  };

  const updateContact = async (customerId, contactId, payload) => {
    const data = await ApiClient.put(`/api/customers/${customerId}/contacts/${contactId}`, payload, { headers: authHeaders });
    return data.data;
  };

  const deleteContact = async (customerId, contactId) => {
    await ApiClient.delete(`/api/customers/${customerId}/contacts/${contactId}`, { headers: authHeaders });
  };

  const value = useMemo(() => ({
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    getContacts,
    createContact,
    updateContact,
    deleteContact,
  }), [authHeaders]);

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomer = () => useContext(CustomerContext);
