import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const WmsContext = createContext(null);

export function WmsProvider({ children }) {
  const { authHeaders } = useAuth();

  const getWmsTasks = async (params = {}) => {
    const res = await ApiClient.get('/api/wms/tasks', { headers: authHeaders, params });
    return res;
  };

  const getWmsWaves = async (params = {}) => {
    const res = await ApiClient.get('/api/wms/waves', { headers: authHeaders, params });
    return res;
  };

  const createWmsWave = async (payload) => {
    const res = await ApiClient.post('/api/wms/waves', payload, { headers: authHeaders });
    return res.data;
  };

  const getWmsWaveDetail = async (id) => {
    const res = await ApiClient.get(`/api/wms/waves/${id}`, { headers: authHeaders });
    return res.data;
  };

  const claimWmsWave = async (waveId) => {
    const res = await ApiClient.post(`/api/wms/waves/${waveId}/claim`, {}, { headers: authHeaders });
    return res.data;
  };

  const unclaimWmsWave = async (waveId) => {
    const res = await ApiClient.post(`/api/wms/waves/${waveId}/unclaim`, {}, { headers: authHeaders });
    return res.data;
  };

  const getWmsTaskDetail = async (id) => {
    const res = await ApiClient.get(`/api/wms/tasks/${id}`, { headers: authHeaders });
    return res.data;
  };

  const claimWmsTask = async (taskId) => {
    const res = await ApiClient.post(`/api/wms/tasks/${taskId}/claim`, {}, { headers: authHeaders });
    return res.data;
  };

  const unclaimWmsTask = async (taskId) => {
    const res = await ApiClient.post(`/api/wms/tasks/${taskId}/unclaim`, {}, { headers: authHeaders });
    return res.data;
  };

  const confirmWmsTask = async (taskId, payload) => {
    const res = await ApiClient.post(`/api/wms/tasks/${taskId}/confirm`, payload, { headers: authHeaders });
    return res.data;
  };

  const getWarehouseLocations = async (warehouseId) => {
    const res = await ApiClient.get(`/api/warehouses/${warehouseId}/locations`, { headers: authHeaders });
    return res.data;
  };

  const allocateWaveInventory = async (waveId) => {
    const res = await ApiClient.post(`/api/wms/waves/${waveId}/allocate`, {}, { headers: authHeaders });
    return res.data;
  };

  const splitWmsTaskLine = async (taskId, lineId, splitQty) => {
    const res = await ApiClient.post(`/api/wms/tasks/${taskId}/lines/${lineId}/split`, { splitQty }, { headers: authHeaders });
    return res.data;
  };

  const getLastLocation = async (params) => {
    const res = await ApiClient.get('/api/wms/items/last-location', { headers: authHeaders, params });
    return res.data;
  };

  const value = useMemo(() => ({
    getWmsTasks,
    getWmsTaskDetail,
    claimWmsTask,
    unclaimWmsTask,
    getWmsWaves,
    createWmsWave,
    getWmsWaveDetail,
    claimWmsWave,
    unclaimWmsWave,
    confirmWmsTask,
    getWarehouseLocations,
    allocateWaveInventory,
    splitWmsTaskLine,
    getLastLocation
  }), [authHeaders]);

  return (
    <WmsContext.Provider value={value}>
      {children}
    </WmsContext.Provider>
  );
}

export const useWms = () => useContext(WmsContext);
