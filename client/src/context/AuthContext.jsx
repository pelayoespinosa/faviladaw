import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

function parseToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return {}; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const payload    = token ? parseToken(token) : {};
  const rol        = payload.rol        || 'empleado';
  const empleadoId = payload.empleadoId || null;

  const login = (t, refreshToken) => {
    localStorage.setItem('token', t);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setToken(t);
  };
  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) api.post('/auth/logout', { refreshToken }).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, rol, empleadoId, esAdmin: rol==='admin', esEncargado: rol==='encargado', esEmpleado: rol==='empleado', esGestoria: rol==='gestoria' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
