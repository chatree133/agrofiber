import { createContext, useContext, useMemo, useState } from 'react';
import ApiClient from './Api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState(storedUser ? JSON.parse(storedUser) : null);

  const login = async (username, password) => {
    const data = await ApiClient.post('/api/auth/login', { username, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateFavoriteMenus = async (menuKey) => {
    if (!user) return;

    const prevUser = user;
    const favoriteMenus = user.favoriteMenus || [];
    const nextFavorites = favoriteMenus.includes(menuKey)
      ? favoriteMenus.filter((key) => key !== menuKey)
      : [...favoriteMenus, menuKey];

    const nextUser = { ...user, favoriteMenus: nextFavorites };
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));

    try {
      const data = await ApiClient.put('/api/users/menus/favorite', { menuKey }, { headers: { Authorization: `Bearer ${token}` } });
      if (data?.favoriteMenus) {
        const syncedUser = { ...nextUser, favoriteMenus: data.favoriteMenus };
        setUser(syncedUser);
        localStorage.setItem('user', JSON.stringify(syncedUser));
      }
    } catch {
      setUser(prevUser);
      localStorage.setItem('user', JSON.stringify(prevUser));
    }
  };

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const value = useMemo(
    () => ({ token, user, authHeaders, login, logout, updateFavoriteMenus }),
    [token, user, authHeaders],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
