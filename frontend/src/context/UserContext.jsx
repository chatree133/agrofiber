import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { authHeaders } = useAuth();

  const getUsers = async (params) => {
    const data = await ApiClient.get('/api/accounts', { headers: authHeaders, params });
    return data;
  };

  const createUser = async (payload) => {
    const data = await ApiClient.post('/api/accounts', payload, { headers: authHeaders });
    return data.data;
  };

  const updateUser = async (id, payload) => {
    await ApiClient.put(`/api/accounts/${id}`, payload, { headers: authHeaders });
  };

  const deleteUsers = async (ids) => {
    if (ids.length === 1) {
      await ApiClient.delete(`/api/accounts/${ids[0]}`, { headers: authHeaders });
    } else {
      await ApiClient.delete('/api/accounts', { headers: authHeaders, data: { ids } });
    }
  };

  const getRoles = async () => {
    const data = await ApiClient.get('/api/accounts/roles', { headers: authHeaders });
    return data.data;
  };

  const createRole = async (payload) => {
    const data = await ApiClient.post('/api/accounts/roles', payload, { headers: authHeaders });
    return data.data;
  };

  const updateRole = async (id, payload) => {
    const data = await ApiClient.put(`/api/accounts/roles/${id}`, payload, { headers: authHeaders });
    return data.data;
  };

  const deleteRole = async (id) => {
    await ApiClient.delete(`/api/accounts/roles/${id}`, { headers: authHeaders });
  };

  const value = useMemo(() => ({
    getUsers,
    createUser,
    updateUser,
    deleteUsers,
    getRoles,
    createRole,
    updateRole,
    deleteRole,
  }), [authHeaders]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
