import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password, recordar });
      login(data.token, data.refreshToken);
      if (data.debe_cambiar_password) {
        localStorage.setItem('debeCambiarPassword', '1');
        navigate('/perfil');
      } else {
        localStorage.removeItem('debeCambiarPassword');
        navigate('/empleados');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales incorrectas');
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <ThemeToggle className="login-theme-toggle" />
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-img-wrap">
            <img src={import.meta.env.BASE_URL + 'emblema.png'} alt="Favila" />
          </div>
          <div>
            <div className="login-logo-text">Favila</div>
          </div>
        </div>
        <h2 className="login-title">Entrar</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input type="text" className="form-input" value={email} autoComplete="username" autoCapitalize="none"
              onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input type="password" className="form-input" value={password} autoComplete="current-password"
              onChange={e => setPassword(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)', margin: '2px 0 14px' }}>
            <input type="checkbox" checked={recordar} onChange={e => setRecordar(e.target.checked)} />
            Mantener la sesión iniciada 30 días
          </label>
          <div className="login-error">{error}</div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
