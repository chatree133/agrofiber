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

  const value = useMemo(() => ({
    getUsers,
    createUser,
    updateUser,
    deleteUsers,
    getRoles
  }), [authHeaders]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
