import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const fmtHora = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtFecha = d => d ? new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' }) : '';

function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este navegador no soporta geolocalización. No se puede fichar desde aquí.'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
      () => reject(new Error('No se pudo obtener tu ubicación. Activa el permiso de ubicación e inténtalo de nuevo.')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export default function Fichar() {
  const { empleadoId } = useAuth();
  const [abierto, setAbierto] = useState(undefined);
  const [cargando, setCargando] = useState(false);
  const [pasoActual, setPasoActual] = useState('');
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => new Date());
  const [turnos, setTurnos] = useState([]);

  useEffect(() => { const id = setInterval(() => setAhora(new Date()), 30_000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!empleadoId) return;
    api.get('/turnos', { params: { empleado: empleadoId } }).then(r => setTurnos(r.data || [])).catch(() => {});
  }, [empleadoId]);

  const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const hoyK = ahora.toDateString();
  const turnosHoy = turnos
    .filter(t => (t.empleado?._id || t.empleado) === empleadoId && (t.dias_semana || []).includes(DIAS_SEM[ahora.getDay()])
      && ((t.frecuencia || 'semanal') === 'semanal' || (t.proxima_fecha && new Date(t.proxima_fecha).toDateString() === hoyK)))
    .sort((a, b) => String(a.tramos?.[0]?.hora_llegada || '99').localeCompare(String(b.tramos?.[0]?.hora_llegada || '99')));
  const proximo = turnosHoy.length ? `${turnosHoy[0].cliente?.nombre || (turnosHoy[0].furgoneta ? `Furgoneta ${turnosHoy[0].furgoneta.numero}` : '')}${turnosHoy[0].tramos?.[0] ? ` · ${turnosHoy[0].tramos[0].hora_llegada}` : ''}` : '';

  const cargarEstado = () => {
    api.get('/fichajes/estado').then(r => setAbierto(r.data)).catch(() => setAbierto(null));
  };

  useEffect(() => {
    if (empleadoId) cargarEstado();
  }, [empleadoId]);

  const fichar = async (tipo) => {
    setError('');
    setCargando(true);
    try {
      setPasoActual('Obteniendo ubicación…');
      let ubicacion;
      try { ubicacion = await obtenerUbicacion(); }
      catch (e) {
        setError(e.message);
        return;
      }
      setPasoActual('Guardando…');

      const r = await api.post(`/fichajes/${tipo}`, ubicacion);
      setAbierto(tipo === 'entrada' ? r.data : null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al fichar');
    } finally {
      setCargando(false);
      setPasoActual('');
    }
  };

  if (!empleadoId) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-state-icon">⏱️</div>
          <div className="empty-state-text">Tu usuario no está vinculado a un empleado, así que no puedes fichar.</div>
        </div>
      </div>
    );
  }

  const transcurrido = abierto ? Math.max(0, Math.floor((ahora - new Date(abierto.entrada.fecha_hora)) / 60000)) : 0;
  const errorUbicacion = /ubicaci|geolocaliz/i.test(error);
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  return (
    <div className="fichar-wrap">
      <div className="fichar-fecha">{fmtFecha(ahora)}</div>
      <div className="fichar-reloj" aria-live="polite">
        {abierto ? `${Math.floor(transcurrido / 60)} h ${String(transcurrido % 60).padStart(2, '0')} min` : ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </div>

      {abierto === undefined && <div className="spinner" />}

      {abierto !== undefined && (
        <>
          <div className="fichar-estado">
            {abierto
              ? <>Dentro desde las <strong style={{ color: 'var(--text)' }}>{fmtHora(abierto.entrada.fecha_hora)}</strong></>
              : 'Aún no has fichado entrada hoy'}
          </div>

          <button
            type="button"
            className={`fichar-btn${abierto ? ' salida' : ''}`}
            onClick={() => fichar(abierto ? 'salida' : 'entrada')}
            disabled={cargando}
          >
            <span>
              {cargando ? pasoActual : abierto ? <>Fichar<br />salida</> : <>Fichar<br />entrada</>}
              {!cargando && proximo && !abierto && <small>{proximo}</small>}
            </span>
          </button>

          {error && (
            <div className="fichar-aviso crit" role="alert">
              <b>{errorUbicacion ? 'Necesitamos tu ubicación para fichar' : 'No se ha podido fichar'}</b>
              <div style={{ marginTop: 4 }}>{error}</div>
              {errorUbicacion && (
                <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {esIOS
                    ? <><li>Ajustes → Privacidad y seguridad → Localización: activada.</li><li>Más abajo, Safari (o Favila): «Al usar la app».</li></>
                    : <><li>Ajustes → Ubicación: activada.</li><li>Permisos de la app o del navegador → Ubicación: «Permitir».</li></>}
                  <li>Vuelve aquí y pulsa el botón otra vez.</li>
                </ol>
              )}
            </div>
          )}

          {turnosHoy.length > 0 && (
            <div className="panel" style={{ width: '100%', textAlign: 'left', marginBottom: 0, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Tus turnos de hoy</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {turnosHoy.map(t => (
                  <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                    <b style={{ minWidth: 0 }}>{t.cliente ? (t.cliente.nombre + (t.cliente.sucursal ? ` · ${t.cliente.sucursal}` : '')) : t.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : '—'}</b>
                    <span className="num" style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{(t.tramos || []).map(x => `${x.hora_llegada}–${x.hora_salida}`).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="fichar-nota">
            Al fichar se registran la fecha, la hora y tu ubicación en ese momento,
            para cumplir el registro de jornada (art. 34.9 del Estatuto de los Trabajadores).
            Puedes consultar y descargar tus fichajes en <Link to="/mis-fichajes" style={{ color: 'var(--accent-ink)' }}>Mis fichajes</Link>.
          </div>
        </>
      )}
    </div>
  );
}
