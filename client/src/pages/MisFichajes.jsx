import { useEffect, useState } from 'react';
import api from '../api/axios';

const fmtFecha = d => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora  = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';

const ESTADOS = {
  dentro: { texto: 'En zona', clase: 'firmado', gravedad: 1 },
  dudoso: { texto: 'Sin confirmar', clase: 'dudoso', gravedad: 2 },
  fuera: { texto: 'Fuera de zona', clase: 'pendiente', gravedad: 3 },
  sin_referencia: { texto: 'Sin referencia', clase: 'neutro', gravedad: 0 },
};

const detalleUbicacion = (nombre, v) => {
  if (!v) return null;
  const e = ESTADOS[v.estado];
  const distancia = v.distancia_m != null ? ` (a ${Math.round(v.distancia_m)} m, radio ${Math.round(v.radio_m)} m)` : '';
  return `${nombre}: ${e ? e.texto.toLowerCase() : v.estado}${distancia}`;
};

function UbicacionFichaje({ f }) {
  const puntos = [f.entrada?.validacion, f.salida?.validacion].filter(Boolean);
  if (puntos.length === 0) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const peor = puntos.reduce((a, b) => ((ESTADOS[b.estado]?.gravedad ?? 0) > (ESTADOS[a.estado]?.gravedad ?? 0) ? b : a));
  const e = ESTADOS[peor.estado] || ESTADOS.sin_referencia;
  const titulo = [detalleUbicacion('Entrada', f.entrada?.validacion), detalleUbicacion('Salida', f.salida?.validacion)].filter(Boolean).join('\n');
  return <span className={`badge-firma-estado ${e.clase}`} title={titulo} style={{ cursor: 'help' }}>{e.texto}</span>;
}

export default function MisFichajes() {
  const [fichajes, setFichajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    api.get('/fichajes').then(r => setFichajes(r.data)).finally(() => setLoading(false));
  }, []);

  const descargarPDF = async () => {
    setDescargando(true);
    try {
      const r = await api.get('/fichajes/export/pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'mis-fichajes.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally { setDescargando(false); }
  };

  return (
    <>
    {fichajes.length > 0 && (
      <div className="filters-bar" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-save" onClick={descargarPDF} disabled={descargando}>
          {descargando ? 'Generando…' : '⬇ Descargar mis fichajes (PDF)'}
        </button>
      </div>
    )}
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Fecha', 'Entrada', 'Salida', 'Ubicación', 'Horas'].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading && <tr className="loading-row"><td colSpan={5}><div className="spinner" /><div>Cargando…</div></td></tr>}
          {!loading && fichajes.length === 0 && (
            <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon">🕒</div><div className="empty-state-text">Todavía no tienes fichajes</div></div></td></tr>
          )}
          {!loading && fichajes.map(f => (
            <tr key={f._id} className="row-parent" style={{ cursor: 'default' }}>
              <td data-label="Fecha">{fmtFecha(f.entrada.fecha_hora)}</td>
              <td data-label="Entrada" className="cell-mono">{fmtHora(f.entrada.fecha_hora)}</td>
              <td data-label="Salida" className="cell-mono">
                {f.estado === 'abierto'
                  ? <span className="badge-firma-estado pendiente">Abierto</span>
                  : <>{fmtHora(f.salida?.fecha_hora)}</>}
              </td>
              <td data-label="Ubicación"><UbicacionFichaje f={f} /></td>
              <td data-label="Horas">
                {f.duracion_horas != null ? <span className="badge-hours">{f.duracion_horas}h</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                {f.creado_manualmente && (
                  <div title={f.creado_manualmente.motivo} style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 3, cursor: 'help' }}>
                    ⚠ Añadido por un administrador
                  </div>
                )}
                {!f.creado_manualmente && f.modificaciones?.length > 0 && (
                  <div title={f.modificaciones[f.modificaciones.length - 1].motivo} style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, cursor: 'help' }}>
                    ✎ Corregido por un administrador
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
