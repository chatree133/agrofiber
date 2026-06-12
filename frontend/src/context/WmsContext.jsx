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

  const cancelWmsTask = async (taskId, notes = null) => {
    const payload = notes ? { notes } : {};
    const res = await ApiClient.post(`/api/wms/tasks/${taskId}/cancel`, payload, { headers: authHeaders });
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

  const getWmsIncidents = async (params = {}) => {
    const res = await ApiClient.get('/api/wms/incidents', { headers: authHeaders, params });
    return res.data;
  };

  const resolveWmsIncident = async (incidentId, payload) => {
    const res = await ApiClient.post(`/api/wms/incidents/${incidentId}/resolve`, payload, { headers: authHeaders });
    return res.data;
  };

  const getLoadPlans = async (params = {}) => {
    const res = await ApiClient.get('/api/wms/load-plans', { headers: authHeaders, params });
    return res.data || [];
  };

  const getLoadPlanDetail = async (planId) => {
    const res = await ApiClient.get(`/api/wms/load-plans/${planId}`, { headers: authHeaders });
    return res.data;
  };

  const updateLoadPlanStatus = async (planId, status) => {
    const res = await ApiClient.put(`/api/wms/load-plans/${planId}/status`, { status }, { headers: authHeaders });
    return res.data;
  };

  const getLoadPlanVehicles = async (params = {}) => {
    const res = await ApiClient.get('/api/wms/load-plans/vehicles', { headers: authHeaders, params });
    return res.data || [];
  };

  const createLoadPlanVehicle = async (payload) => {
    const res = await ApiClient.post('/api/wms/load-plans/vehicles', payload, { headers: authHeaders });
    return res.data;
  };

  const updateLoadPlanVehicle = async (vehicleId, payload) => {
    const res = await ApiClient.put(`/api/wms/load-plans/vehicles/${vehicleId}`, payload, { headers: authHeaders });
    return res.data;
  };

  const getLoadPlanDriverUsers = async () => {
    const res = await ApiClient.get('/api/wms/load-plans/driver-users', { headers: authHeaders });
    return res.data || [];
  };

  const getLoadPlanDrivers = async (params = {}) => {
    const res = await ApiClient.get('/api/wms/load-plans/drivers', { headers: authHeaders, params });
    return res.data || [];
  };

  const createLoadPlanDriver = async (payload) => {
    const res = await ApiClient.post('/api/wms/load-plans/drivers', payload, { headers: authHeaders });
    return res.data;
  };

  const updateLoadPlanDriver = async (driverId, payload) => {
    const res = await ApiClient.put(`/api/wms/load-plans/drivers/${driverId}`, payload, { headers: authHeaders });
    return res.data;
  };

  const getPendingDeliveryOrders = async (branchId) => {
    const params = branchId ? { branchId } : {};
    const res = await ApiClient.get('/api/wms/load-plans/pending-dos', { headers: authHeaders, params });
    return res.data || [];
  };

  const getLoadPlanBotPayload = async (date, branch) => {
    const res = await ApiClient.get(
      '/api/wms/load-plans/bot-payload',
      { date, branch },
      { timeout: 120000, headers: authHeaders }
    );
    return res;
  };

  const createLoadPlan = async (payload) => {
    const res = await ApiClient.post('/api/wms/load-plans', payload, { headers: authHeaders });
    return res.data;
  };

  const getTodayDriverLoadPlans = async () => {
    const res = await ApiClient.get('/api/wms/load-plans/drivers/me/today', { headers: authHeaders });
    return res.data || [];
  };

  const submitLoadPlanPod = async (lineId, formData) => {
    const res = await ApiClient.post(`/api/wms/load-plans/lines/${lineId}/pod`, formData, {
      headers: {
        ...authHeaders,
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  };

  const value = useMemo(() => ({
    getWmsTasks,
    getWmsTaskDetail,
    claimWmsTask,
    unclaimWmsTask,
    cancelWmsTask,
    getWmsWaves,
    createWmsWave,
    getWmsWaveDetail,
    claimWmsWave,
    unclaimWmsWave,
    confirmWmsTask,
    getWarehouseLocations,
    allocateWaveInventory,
    splitWmsTaskLine,
    getLastLocation,
    getWmsIncidents,
    resolveWmsIncident,
    getLoadPlans,
    getLoadPlanDetail,
    updateLoadPlanStatus,
    getLoadPlanVehicles,
    createLoadPlanVehicle,
    updateLoadPlanVehicle,
    getLoadPlanDriverUsers,
    getLoadPlanDrivers,
    createLoadPlanDriver,
    updateLoadPlanDriver,
    getPendingDeliveryOrders,
    getLoadPlanBotPayload,
    createLoadPlan,
    getTodayDriverLoadPlans,
    submitLoadPlanPod
  }), [authHeaders]);

  return (
    <WmsContext.Provider value={value}>
      {children}
    </WmsContext.Provider>
  );
}

export const useWms = () => useContext(WmsContext);
