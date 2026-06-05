import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const PurchaseOrderContext = createContext(null);

export function PurchaseOrderProvider({ children }) {
  const { authHeaders } = useAuth();

  const getPurchaseOrders = async () => {
    const res = await ApiClient.get('/api/purchase-orders', { headers: authHeaders });
    return res.data;
  };

  const value = useMemo(() => ({
    getPurchaseOrders,
  }), [authHeaders]);

  return (
    <PurchaseOrderContext.Provider value={value}>
      {children}
    </PurchaseOrderContext.Provider>
  );
}

export const usePurchaseOrder = () => useContext(PurchaseOrderContext);
