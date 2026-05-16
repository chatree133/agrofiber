import { createContext, useContext, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const defaultUser = {
  id: 1,
  name: 'Chatree Kueakachai',
  username: 'chatree',
  roles: ['admin', 'accounting', 'user'],
  avatarUrl: 'https://i.pravatar.cc/160?img=12',
  favoriteMenus: ['/salesorder/create', '/inventory/stock'],
};

export function AuthProvider({ children }) {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState(storedUser ? JSON.parse(storedUser) : defaultUser);

  const login = async (username, password) => {
    try {
      const { data } = await axios.post('/api/auth/login', { username, password });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } catch {
      const dummyToken = 'dummy-jwt-token';
      setToken(dummyToken);
      setUser(defaultUser);
      localStorage.setItem('token', dummyToken);
      localStorage.setItem('user', JSON.stringify(defaultUser));
      return defaultUser;
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateFavoriteMenus = async (menuKey) => {
    const favoriteMenus = user.favoriteMenus || [];
    const nextFavorites = favoriteMenus.includes(menuKey)
      ? favoriteMenus.filter((key) => key !== menuKey)
      : [...favoriteMenus, menuKey];

    const nextUser = { ...user, favoriteMenus: nextFavorites };
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));

    try {
      await axios.put(
        '/api/users/menus/favorite',
        { menuKey },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch {
      // Offline dummy mode keeps UX available while API/DB are not ready.
    }
  };

  const value = useMemo(
    () => ({ token, user, login, logout, updateFavoriteMenus }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
