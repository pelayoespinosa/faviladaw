import { useEffect, useState } from 'react';
import api from '../api/axios';

const ROL_LABEL = { admin: 'Administrador', encargado: 'Encargado/a', empleado: 'Empleado', gestoria: 'Gestoría' };

const fmtFechaHora = d => d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Perfil() {
  const [me, setMe] = useState(null);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [debeCambiar, setDebeCambiar] = useState(localStorage.getItem('debeCambiarPassword') === '1');
  const [sesiones, setSesiones] = useState([]);

  const cargarSesiones = () => api.get('/auth/sesiones').then(r => setSesiones(r.data)).catch(() => {});

  useEffect(() => { api.get('/auth/me').then(r => {
    setMe(r.data);
    if (r.data.debe_cambiar_password) { setDebeCambiar(true); localStorage.setItem('debeCambiarPassword', '1'); }
  }); cargarSesiones(); }, []);

  const cerrarSesion = async (id) => {
    try { await api.delete(`/auth/sesiones/${id}`); cargarSesiones(); }
    catch {  }
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    if (passwordNuevo.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres'); return; }
    if (passwordNuevo !== passwordConfirmar) { setError('Las contraseñas nuevas no coinciden'); return; }
    setGuardando(true);
    try {
      await api.put('/auth/password', { passwordActual, passwordNuevo });
      setMensaje('Contraseña actualizada correctamente');
      setPasswordActual(''); setPasswordNuevo(''); setPasswordConfirmar('');
      localStorage.removeItem('debeCambiarPassword');
      setDebeCambiar(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 440, margin: '0 auto' }}>
      {debeCambiar && (
        <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 8, border: '1px solid color-mix(in srgb,var(--amber) 40%,transparent)', background: 'color-mix(in srgb,var(--amber) 10%,transparent)', fontSize: 13 }}>
          🔐 Estás usando una <strong>contraseña temporal</strong>. Por seguridad, cámbiala ahora por una tuya (mínimo 8 caracteres).
        </div>
      )}
      <div className="panel-title">Mi cuenta</div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, fontSize: 13 }}>
        <div>
          <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Usuario</div>
          <div style={{ fontWeight: 600 }}>{me?.email || '—'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Rol</div>
          <div style={{ fontWeight: 600 }}>{ROL_LABEL[me?.rol] || '—'}</div>
        </div>
      </div>

      <div className="panel-title">Cambiar contraseña</div>
      <form onSubmit={cambiarPassword}>
        <div className="form-group">
          <label className="form-label">Contraseña actual</label>
          <input type="password" className="form-input" value={passwordActual} onChange={e => setPasswordActual(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Contraseña nueva</label>
          <input type="password" className="form-input" value={passwordNuevo} onChange={e => setPasswordNuevo(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Confirmar contraseña nueva</label>
          <input type="password" className="form-input" value={passwordConfirmar} onChange={e => setPasswordConfirmar(e.target.value)} />
        </div>
        {error && <div className="error-msg">{error}</div>}
        {mensaje && <div className="error-msg" style={{ color: 'var(--accent)' }}>{mensaje}</div>}
        <button type="submit" className="btn-save" disabled={guardando} style={{ marginTop: 8 }}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      {sesiones.length > 0 && (
        <>
          <div className="panel-title" style={{ marginTop: 28 }}>Sesiones activas</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
            Dispositivos donde tienes marcado «Mantener la sesión iniciada».
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sesiones.map(s => (
              <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.nombre_dispositivo || 'Dispositivo'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Último uso: {fmtFechaHora(s.ultimo_uso)}</div>
                </div>
                <button className="btn-delete" onClick={() => cerrarSesion(s._id)}>Cerrar</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
