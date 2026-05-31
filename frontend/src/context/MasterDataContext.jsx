import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext';

const MasterDataContext = createContext(null);

export function MasterDataProvider({ children }) {
  const { authHeaders } = useAuth();
  const [lookups, setLookups] = useState({});

  const fetchLookups = useCallback(async () => {
    if (!authHeaders) return;
    try {
      const data = await ApiClient.get('/api/master-data/lookups', { headers: authHeaders });
      setLookups(data.data || {});
    } catch (err) {
      console.error('Failed to fetch lookups:', err);
    }
  }, [authHeaders]);

  const value = useMemo(() => ({
    lookups,
    fetchLookups
  }), [lookups, fetchLookups]);

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
}

export const useMasterData = () => useContext(MasterDataContext);
