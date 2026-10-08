import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { TAREAS_LABEL, TAREAS_MEC } from '../constants/tareas';
import Icon from './Icon';

function diasDesdeHoy(fecha) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha); f.setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / 86400000);
}

function urgencia(diff) {
  if (diff < 0) return { bg: 'var(--coral-lt)', color: 'var(--coral)' };
  if (diff <= 7) return { bg: 'var(--amber-lt)', color: 'var(--amber)' };
  return { bg: 'var(--accent-lt)', color: 'var(--accent)' };
}

function etiquetaDia(diff) {
  if (diff < 0) return `Hace ${Math.abs(diff)}d`;
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return `En ${diff}d`;
}

function AvisoRow({ icon, titulo, subtitulo, fecha }) {
  const diff = diasDesdeHoy(fecha);
  const { bg, color } = urgencia(diff);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>{subtitulo}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{new Date(fecha).toLocaleDateString('es-ES')}</span>
        <span style={{ fontSize: 10, color, opacity: 0.8 }}>{etiquetaDia(diff)}</span>
      </div>
    </div>
  );
}

export default function AvisosBell() {
  const [open, setOpen] = useState(false);
  const [serviciosProximos, setServiciosProximos] = useState([]);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef(null);

  useEffect(() => {
    api.get('/turnos').then(tRes => {
      const servicios = tRes.data
        .filter(t => TAREAS_MEC.has(t.tipo_tarea) && t.proxima_fecha)
        .map(t => ({ ...t, _diff: diasDesdeHoy(t.proxima_fecha) }))
        .filter(t => t._diff >= -14 && t._diff <= 30)
        .sort((a, b) => a._diff - b._diff);
      setServiciosProximos(servicios);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const total = serviciosProximos.length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button className="theme-toggle" onClick={() => setOpen(o => !o)} aria-label="Avisos" style={{ position: 'relative' }}>
        <Icon name="bell" size={16} />
        {total > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 8, background: 'var(--coral)', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>{total}</span>
        )}
      </button>

      {open && (
        <div className="avisos-pop">
          <div className="panel-title" style={{ marginBottom: 12 }}>Avisos</div>

          {loading && <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '8px 2px' }}>Cargando…</div>}

          {!loading && total === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '8px 2px' }}>Sin avisos pendientes</div>
          )}

          {!loading && serviciosProximos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Abrillantados y limpiezas mecanizadas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {serviciosProximos.map(t => (
                  <AvisoRow key={t._id} icon="sparkle"
                    titulo={t.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : (t.cliente?.nombre || '—')}
                    subtitulo={TAREAS_LABEL[t.tipo_tarea] || t.tipo_tarea}
                    fecha={t.proxima_fecha} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
