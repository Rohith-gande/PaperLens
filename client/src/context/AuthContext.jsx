import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
  };

  const register = async (username, password) => {
    await api.post('/auth/register', { username, password });
    return login(username, password);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const value = useMemo(() => ({ token, login, register, logout }), [token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}