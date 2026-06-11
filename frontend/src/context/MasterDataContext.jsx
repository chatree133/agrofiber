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

  const getUnits = useCallback(async () => {
    if (!authHeaders) return [];
    const res = await ApiClient.get('/api/master-data/units', { headers: authHeaders });
    return res.data || [];
  }, [authHeaders]);

  const createUnit = useCallback(async (payload) => {
    if (!authHeaders) return;
    const res = await ApiClient.post('/api/master-data/units', payload, { headers: authHeaders });
    return res.data;
  }, [authHeaders]);

  const updateUnit = useCallback(async (id, payload) => {
    if (!authHeaders) return;
    const res = await ApiClient.put(`/api/master-data/units/${id}`, payload, { headers: authHeaders });
    return res.data;
  }, [authHeaders]);

  const value = useMemo(() => ({
    lookups,
    fetchLookups,
    getUnits,
    createUnit,
    updateUnit
  }), [lookups, fetchLookups, getUnits, createUnit, updateUnit]);

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
}

export const useMasterData = () => useContext(MasterDataContext);
