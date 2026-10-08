import { useEffect, useState } from 'react';
import api from '../api/axios';
import { TAREAS } from '../constants/tareas';

export default function Servicios() {
  const [precios, setPrecios]   = useState({});
  const [edits, setEdits]       = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [error, setError]       = useState('');
  const [ok, setOk]             = useState('');

  const cargar = () => api.get('/precios-servicio').then(r => {
    const mapa = Object.fromEntries(r.data.map(p => [p.tipo_tarea, p.precio_hora]));
    setPrecios(mapa);
    setEdits(Object.fromEntries(TAREAS.map(t => [t.value, mapa[t.value] ?? ''])));
  }).finally(() => setCargando(false));

  useEffect(() => { cargar(); }, []);

  const cambiado = tipo => String(edits[tipo] ?? '') !== String(precios[tipo] ?? '');

  const guardar = async tipo => {
    const valor = Number(edits[tipo]);
    if (edits[tipo] === '' || Number.isNaN(valor) || valor < 0) { setError('Escribe un precio válido (0 o más).'); return; }
    setGuardando(tipo); setError(''); setOk('');
    try {
      await api.put(`/precios-servicio/${tipo}`, { precio_hora: valor });
      await cargar();
      setOk('Precio guardado. La facturación de los clientes se ha recalculado.');
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(null);
    }
  };

  return (
    <>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {ok && <div className="fichar-aviso ok" style={{ marginBottom: 12 }}>{ok}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr>{['Servicio', 'Tipo', 'Precio por hora (€)', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={4}><div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div></td></tr>}
            {!cargando && TAREAS.map(t => (
              <tr key={t.value} className="row-parent" style={{ cursor: 'default' }}>
                <td data-label="Servicio" style={{ fontWeight: 500, color: 'var(--text)' }}>{t.label}</td>
                <td data-label="Tipo">
                  <span className="chip" style={t.mecanizada ? { background: 'var(--amber-lt)', color: 'var(--amber)' } : undefined}>
                    {t.mecanizada ? 'Mecanizado' : 'Manual'}
                  </span>
                </td>
                <td data-label="Precio por hora (€)">
                  <input
                    type="number" step="0.01" min="0" className="form-input" style={{ width: 110 }}
                    value={edits[t.value] ?? ''} placeholder="Sin precio"
                    aria-label={`Precio por hora de ${t.label}`}
                    onChange={e => setEdits(ed => ({ ...ed, [t.value]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && cambiado(t.value)) guardar(t.value); }}
                  />
                </td>
                <td data-label="Acciones">
                  <button className="btn-edit" disabled={!cambiado(t.value) || guardando === t.value} onClick={() => guardar(t.value)}>
                    {guardando === t.value ? 'Guardando…' : 'Guardar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
