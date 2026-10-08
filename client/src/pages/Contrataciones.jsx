import { useEffect, useState } from 'react';
import api from '../api/axios';
import { TAREAS, TAREAS_LABEL, TAREAS_MEC, FRECUENCIAS, FREC_LABEL, FREC_LABEL_SHORT, calcHSemProrr, formatH } from '../constants/tareas';
import { normalizar } from '../utils/texto';

function calcContProrr(entry) {
  return calcHSemProrr({ horas_semana: entry.horas, frecuencia: entry.frecuencia, tipo_tarea: entry.tipo_tarea });
}

function EditHorasModal({ cliente, onClose, onSave }) {
  const [entries, setEntries] = useState(
    cliente.horas_contratadas?.length
      ? cliente.horas_contratadas.map(e => ({ ...e }))
      : []
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const addEntry = () => setEntries(prev => [...prev, { tipo_tarea: 'limpieza', horas: '', frecuencia: 'semanal' }]);
  const removeEntry = (i) => setEntries(prev => prev.filter((_, idx) => idx !== i));
  const updateEntry = (i, key, val) => setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [key]: val } : e));

  const guardar = async () => {
    const valid = entries.filter(e => e.tipo_tarea && parseFloat(e.horas) > 0);
    setSaving(true);
    try {
      await api.put(`/clientes/${cliente._id}`, {
        horas_contratadas: valid.map(e => ({
          tipo_tarea: e.tipo_tarea,
          horas: parseFloat(e.horas),
          frecuencia: e.frecuencia || 'semanal',
        })),
      });
      onSave();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 12 }}>
      <div className="modal-contratacion" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 17 }}>Horas contratadas</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>
              {cliente.nombre}{cliente.sucursal ? ` — ${cliente.sucursal}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {entries.length > 0 && (
          <div className="fila-servicio fila-servicio-head" style={{ gap: '6px 8px', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Servicio</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Horas</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frecuencia</span>
            <span />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {entries.map((e, i) => (
            <div key={i} className="fila-servicio" style={{ gap: 8, alignItems: 'center' }}>
              <select className="filter-select" value={e.tipo_tarea} onChange={ev => updateEntry(i, 'tipo_tarea', ev.target.value)}>
                {TAREAS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                className="filter-input"
                type="number"
                min="0"
                step="0.5"
                value={e.horas}
                onChange={ev => updateEntry(i, 'horas', ev.target.value)}
                placeholder="0"
              />
              <select className="filter-select" value={e.frecuencia} onChange={ev => updateEntry(i, 'frecuencia', ev.target.value)}>
                {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <button
                onClick={() => removeEntry(i)}
                style={{ padding: '6px 10px', background: 'var(--coral-lt)', color: 'var(--coral)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              >×</button>
            </div>
          ))}
        </div>

        <button onClick={addEntry} className="btn-cancel" style={{ marginBottom: 20, fontSize: 12 }}>
          + Añadir servicio
        </button>

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-save" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function calcGaps(contratadas, turnos) {
  const asigPorTipo = {};
  for (const t of turnos) {
    const tipo = t.tipo_tarea || 'otros';
    asigPorTipo[tipo] = (asigPorTipo[tipo] || 0) + calcHSemProrr(t);
  }
  const gaps = [];
  for (const e of contratadas) {
    const contProrr = calcContProrr(e);
    const asigProrr = asigPorTipo[e.tipo_tarea] || 0;
    const gap = +(contProrr - asigProrr).toFixed(2);
    if (gap > 0.01) gaps.push({ tipo: e.tipo_tarea, gap });
  }
  return { gaps, asigPorTipo };
}

function ClienteRow({ cliente, turnos, onEdit }) {
  const [open, setOpen] = useState(false);
  const contratadas = cliente.horas_contratadas || [];
  const { gaps, asigPorTipo } = calcGaps(contratadas, turnos);

  const allTipos = [...new Set([
    ...contratadas.map(e => e.tipo_tarea),
    ...Object.keys(asigPorTipo),
  ])];

  const totalContProrr = contratadas.reduce((acc, e) => acc + calcContProrr(e), 0);
  const hasContratadas = contratadas.length > 0;

  return (<>
    <tr className={`row-parent${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
      <td data-label="Cliente"><div className="cell-name">
        <div className="chevron">▶</div>
        <div>
          <div>{cliente.alias||cliente.nombre}</div>
          {cliente.alias&&<div style={{fontSize:11,color:'var(--text-3)',fontWeight:400,marginTop:1}}>{cliente.nombre}</div>}
          {cliente.sucursal && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1 }}>📍 {cliente.sucursal}</div>}
        </div>
      </div></td>
      <td data-label="NIF"><span className="cell-mono">{cliente.nif || '—'}</span></td>
      <td data-label="Zona" className="cell-muted">{cliente.zona || '—'}</td>
      <td data-label="Servicios contratados">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {contratadas.map((e, i) => {
            const esMec = TAREAS_MEC.has(e.tipo_tarea);
            return (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500, background: esMec ? 'var(--amber-lt)' : 'var(--accent-lt)', color: esMec ? 'var(--amber)' : 'var(--accent)' }}>
                {TAREAS_LABEL[e.tipo_tarea] || e.tipo_tarea}
                {e.horas > 0 && <span style={{ opacity: 0.7 }}>· {e.horas}h/{e.frecuencia !== 'semanal' ? FREC_LABEL_SHORT[e.frecuencia] || 'año' : 'sem'}</span>}
              </span>
            );
          })}
          {!hasContratadas && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Sin horas definidas</span>}
        </div>
      </td>
      <td data-label="H/sem contratadas">
        {totalContProrr > 0
          ? (() => {
              const falta = gaps.reduce((a, g) => a + g.gap, 0);
              const pct = Math.round(((totalContProrr - falta) / totalContProrr) * 100);
              return (
                <div style={{ display: 'grid', gap: 4, minWidth: 120 }}>
                  <span className="badge-hours" style={{ justifySelf: 'start' }}>{formatH(totalContProrr)}/sem</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} title={`${pct} % cubierto`}>
                    <div className={`bar${pct < 100 ? ' warn' : ''}`} style={{ flex: 1 }}><i style={{ width: `${pct}%` }} /></div>
                    <span className="num" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{pct} %</span>
                  </div>
                </div>
              );
            })()
          : <span className="cell-muted">—</span>}
      </td>
      <td data-label="Alertas de cobertura">
        {gaps.length > 0
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {gaps.map(g => (
                <span key={g.tipo} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'var(--coral-lt)', color: 'var(--coral)', border: '1px solid color-mix(in srgb,var(--coral) 20%,transparent)', whiteSpace: 'nowrap' }}>
                  ⚠ Falta {formatH(g.gap)} de {TAREAS_LABEL[g.tipo] || g.tipo}
                </span>
              ))}
            </div>
          : hasContratadas
            ? <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>✓ Cubierto</span>
            : <span className="cell-muted">—</span>}
      </td>
      <td data-label="Acciones" onClick={e => e.stopPropagation()}>
        <button className="btn-edit" onClick={() => onEdit(cliente)}>Editar horas</button>
      </td>
    </tr>

    {open && allTipos.length > 0 && (
      <tr className="row-subhead">
        <td style={{ paddingLeft: 44 }}>Tipo de servicio</td>
        <td>Frecuencia</td>
        <td>Horas contratadas</td>
        <td>Equiv. semanal contratado</td>
        <td>Asignado en turnos</td>
        <td colSpan={2}>Estado</td>
      </tr>
    )}
    {open && allTipos.length === 0 && (
      <tr className="row-child">
        <td colSpan={7} style={{ padding: '16px 16px 16px 44px', color: 'var(--text-3)', fontSize: 13 }}>
          Sin servicios ni turnos registrados
        </td>
      </tr>
    )}
    {open && allTipos.map(tipo => {
      const contratado = contratadas.find(e => e.tipo_tarea === tipo);
      const contProrr = contratado ? calcContProrr(contratado) : 0;
      const asigProrr = +(asigPorTipo[tipo] || 0).toFixed(2);
      const gap = +(contProrr - asigProrr).toFixed(2);
      const esMec = TAREAS_MEC.has(tipo);
      return (
        <tr key={tipo} className="row-child">
          <td data-label="Tipo de servicio"><div style={{ paddingLeft: 44, display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500, background: esMec ? 'var(--amber-lt)' : 'var(--accent-lt)', color: esMec ? 'var(--amber)' : 'var(--accent)' }}>
              {TAREAS_LABEL[tipo] || tipo}
            </span>
          </div></td>
          <td data-label="Frecuencia" className="cell-muted" style={{ fontSize: 12 }}>
            {contratado ? (FREC_LABEL[contratado.frecuencia] || contratado.frecuencia) : '—'}
          </td>
          <td data-label="Horas contratadas">
            {contratado
              ? <span className="badge-hours">{contratado.horas}h/{contratado.frecuencia !== 'semanal' ? FREC_LABEL_SHORT[contratado.frecuencia] || 'año' : 'sem'}</span>
              : <span style={{ color: 'var(--text-3)' }}>—</span>}
          </td>
          <td data-label="Equiv. semanal contratado">
            {contProrr > 0
              ? <span className="badge-count">{formatH(contProrr)}/sem</span>
              : <span style={{ color: 'var(--text-3)' }}>—</span>}
          </td>
          <td data-label="Asignado en turnos">
            {asigProrr > 0
              ? <span className="badge-count">{formatH(asigProrr)}/sem</span>
              : <span style={{ color: 'var(--text-3)' }}>—</span>}
          </td>
          <td data-label="Estado" colSpan={2}>
            {gap > 0.01
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'var(--coral-lt)', color: 'var(--coral)', border: '1px solid color-mix(in srgb,var(--coral) 20%,transparent)' }}>
                  Falta por asignar: {formatH(gap)}
                </span>
              : gap < -0.01
                ? <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--amber-lt)', color: 'var(--amber)', border: '1px solid color-mix(in srgb,var(--amber) 20%,transparent)' }}>
                    Exceso: {formatH(Math.abs(gap))}
                  </span>
                : contratado
                  ? <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>✓ Cubierto</span>
                  : <span className="cell-muted">Solo en turnos</span>}
          </td>
        </tr>
      );
    })}
  </>);
}

export default function Contrataciones() {
  const [clientes, setClientes] = useState([]);
  const [turnosPor, setTurnosPor] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [filtroZona, setFiltroZona] = useState('');
  const [filtroAlerta, setFiltroAlerta] = useState('');
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);

  const cargar = () => Promise.all([api.get('/clientes'), api.get('/turnos')]).then(([cR, tR]) => {
    const map = {};
    tR.data.forEach(t => {
      const id = t.cliente?._id; if (!id) return;
      if (!map[id]) map[id] = [];
      map[id].push(t);
    });
    setTurnosPor(map);
    setClientes(cR.data);
    setZonas([...new Set(cR.data.map(c => c.zona).filter(Boolean))].sort());
    setLoading(false);
  });

  useEffect(() => { cargar(); }, []);

  const hasGap = (c) => {
    const { gaps } = calcGaps(c.horas_contratadas || [], turnosPor[c._id] || []);
    return gaps.length > 0;
  };

  const cliF = clientes.filter(c => {
    if (busqueda) {
      const q = normalizar(busqueda);
      if (!normalizar(c.nombre).includes(q) && !normalizar(c.alias).includes(q) && !normalizar(c.nif).includes(q) && !normalizar(c.sucursal).includes(q) && !normalizar(c.direccion_facturacion).includes(q) && !normalizar(c.direccion_real).includes(q)) return false;
    }
    if (filtroZona && c.zona !== filtroZona) return false;
    if (filtroAlerta === 'gap' && !hasGap(c)) return false;
    if (filtroAlerta === 'ok' && (hasGap(c) || !(c.horas_contratadas?.length > 0))) return false;
    return true;
  });

  const totalAlertas = cliF.filter(c => hasGap(c)).length;

  return (<>
    {editando && (
      <EditHorasModal
        cliente={editando}
        onClose={() => setEditando(null)}
        onSave={() => { setEditando(null); cargar(); }}
      />
    )}

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar cliente</span>
        <input className="filter-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="NIF, nombre, alias o dirección…" style={{ width: 260 }} />
      </div>
      <div className="filter-group">
        <span className="filter-label">Zona</span>
        <select className="filter-select" value={filtroZona} onChange={e => setFiltroZona(e.target.value)}>
          <option value="">Todas las zonas</option>
          {zonas.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      </div>
      <div className="filter-group">
        <span className="filter-label">Estado</span>
        <select className="filter-select" value={filtroAlerta} onChange={e => setFiltroAlerta(e.target.value)}>
          <option value="">Todos</option>
          <option value="gap">Con horas pendientes</option>
          <option value="ok">Totalmente cubiertos</option>
        </select>
      </div>
      <div className="filters-count">
        {cliF.length} clientes
        {totalAlertas > 0 && <span style={{ marginLeft: 8, color: 'var(--coral)' }}>· {totalAlertas} con alertas</span>}
      </div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{['Cliente', 'NIF', 'Zona', 'Servicios contratados', 'H/sem contratadas', 'Alertas de cobertura', ''].map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {loading && <tr className="loading-row"><td colSpan={7}><div className="spinner" /><div>Cargando…</div></td></tr>}
          {!loading && cliF.length === 0 && (
            <tr><td colSpan={7}>
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-text">No se encontraron contrataciones</div>
              </div>
            </td></tr>
          )}
          {!loading && cliF.map(c => (
            <ClienteRow key={c._id} cliente={c} turnos={turnosPor[c._id] || []} onEdit={setEditando} />
          ))}
        </tbody>
      </table>
    </div>
  </>);
}
