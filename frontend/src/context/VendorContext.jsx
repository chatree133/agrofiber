import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const VendorContext = createContext(null);

export function VendorProvider({ children }) {
  const { authHeaders } = useAuth();

  const getVendors = async (params = {}) => {
    const res = await ApiClient.get('/api/master-data/vendors', { headers: authHeaders, params });
    return res.data;
  };

  const value = useMemo(() => ({
    getVendors,
  }), [authHeaders]);

  return (
    <VendorContext.Provider value={value}>
      {children}
    </VendorContext.Provider>
  );
}

export const useVendor = () => useContext(VendorContext);
