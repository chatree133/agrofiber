import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const StockContext = createContext(null);

export function StockProvider({ children }) {
  const { authHeaders } = useAuth();

  const getStockOnHand = async (params = {}) => {
    const res = await ApiClient.get('/api/stock/on-hand', params, { headers: authHeaders });
    return res;
  };

  const getStockMovements = async (params = {}) => {
    const res = await ApiClient.get('/api/stock/movements', params, { headers: authHeaders });
    return res;
  };

  const getLots = async (params = {}) => {
    const res = await ApiClient.get('/api/inventory/lots', params, { headers: authHeaders });
    return res;
  };

  const getReservations = async (params = {}) => {
    const res = await ApiClient.get('/api/inventory/reservations', params, { headers: authHeaders });
    return res;
  };

  const value = useMemo(() => ({
    getStockOnHand,
    getStockMovements,
    getLots,
    getReservations
  }), [authHeaders]);

  return (
    <StockContext.Provider value={value}>
      {children}
    </StockContext.Provider>
  );
}

export const useStock = () => useContext(StockContext);
