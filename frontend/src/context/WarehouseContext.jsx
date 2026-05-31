import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const WarehouseContext = createContext(null);

export function WarehouseProvider({ children }) {
  const { authHeaders } = useAuth();

  const getWarehouses = async () => {
    const data = await ApiClient.get('/api/warehouses', { headers: authHeaders });
    return data.data;
  };

  const createWarehouse = async (payload) => {
    const data = await ApiClient.post('/api/warehouses', payload, { headers: authHeaders });
    return data.data;
  };

  const updateWarehouse = async (id, payload) => {
    const data = await ApiClient.put(`/api/warehouses/${id}`, payload, { headers: authHeaders });
    return data.data;
  };

  const deleteWarehouse = async (id) => {
    await ApiClient.delete(`/api/warehouses/${id}`, { headers: authHeaders });
  };

  const value = useMemo(() => ({
    getWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
  }), [authHeaders]);

  return (
    <WarehouseContext.Provider value={value}>
      {children}
    </WarehouseContext.Provider>
  );
}

export const useWarehouse = () => useContext(WarehouseContext);
