import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import FichajeMapaModal from '../components/FichajeMapaModal';
import SearchSelect from '../components/SearchSelect';
import { calcHMesProrr, calcHSemProrr } from '../constants/tareas';
import { useAuth } from '../context/AuthContext';

const UMBRAL_AVISO = 0.9;

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_LABEL = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const pad = n => String(n).padStart(2, '0');
const claveDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHora  = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
const toDatetimeLocal = d => {
  if (!d) return '';
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
};

function generarCeldas(year, month) {
  const primero = new Date(year, month, 1);
  const offset = (primero.getDay() + 6) % 7;
  const inicio = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

async function descargar(url, params, filename) {
  const r = await api.get(url, { responseType: 'blob', params });
  const blobUrl = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = blobUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(blobUrl);
}

export default function Fichajes() {
  const { esAdmin, esEncargado, esGestoria } = useAuth();
  const puedeGestionarJornada = esAdmin || esEncargado;
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [empleados, setEmpleados] = useState([]);
  const [empleadoFiltro, setEmpleadoFiltro] = useState('');
  const [fichajes, setFichajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [mapaFichaje, setMapaFichaje] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState({ entrada: '', salida: '', motivo: '' });
  const [editError, setEditError] = useState('');

  const [turnos, setTurnos] = useState([]);
  const [fichajesAnio, setFichajesAnio] = useState([]);

  const [modalManual, setModalManual] = useState(false);
  const [formManual, setFormManual] = useState({ empleadoId: '', fecha: '', horaEntrada: '', horaSalida: '', motivo: '' });
  const [errorManual, setErrorManual] = useState('');
  const [guardandoManual, setGuardandoManual] = useState(false);

  useEffect(() => {
    api.get('/empleados').then(r => setEmpleados(r.data));
    api.get('/turnos').then(r => setTurnos(r.data));
    api.get('/fichajes', {
      params: { desde: claveDia(new Date(hoy.getFullYear(), 0, 1)), hasta: claveDia(new Date(hoy.getFullYear(), 11, 31)), empleado: 'todos' },
    }).then(r => setFichajesAnio(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const desde = claveDia(new Date(mesActual.getFullYear(), mesActual.getMonth(), 1));
  const hasta = claveDia(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0));

  const cargar = () => {
    setLoading(true);
    api.get('/fichajes', { params: { desde, hasta, empleado: empleadoFiltro || 'todos', incluirAnulados: '1' } })
      .then(r => setFichajes(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mesActual, empleadoFiltro]);

  const porDia = useMemo(() => {
    const map = {};
    fichajes.forEach(f => {
      const k = claveDia(new Date(f.entrada.fecha_hora));
      (map[k] ||= []).push(f);
    });
    return map;
  }, [fichajes]);

  const sinSalida = useMemo(() => fichajesAnio
    .filter(f => f.estado === 'abierto' && claveDia(new Date(f.entrada.fecha_hora)) < claveDia(new Date()))
    .sort((a, b) => new Date(b.entrada.fecha_hora) - new Date(a.entrada.fecha_hora)), [fichajesAnio]);

  const celdas = useMemo(() => generarCeldas(mesActual.getFullYear(), mesActual.getMonth()), [mesActual]);

  const cambiarMes = delta => setMesActual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const statsPorEmpleado = useMemo(() => {
    const contratadasMes = {}, contratadasAnio = {};
    turnos.forEach(t => {
      const id = t.empleado?._id;
      if (!id) return;
      contratadasMes[id]  = (contratadasMes[id]  || 0) + calcHMesProrr(t);
      contratadasAnio[id] = (contratadasAnio[id] || 0) + calcHSemProrr(t) * 52;
    });

    const fichadasMes = {}, fichadasAnio = {};
    fichajesAnio.forEach(f => {
      const id = f.empleado?._id;
      if (!id || f.duracion_horas == null) return;
      const fecha = new Date(f.entrada.fecha_hora);
      fichadasAnio[id] = (fichadasAnio[id] || 0) + f.duracion_horas;
      if (fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth()) {
        fichadasMes[id] = (fichadasMes[id] || 0) + f.duracion_horas;
      }
    });

    const map = {};
    empleados.forEach(e => {
      const hContratadasMes  = contratadasMes[e._id]  || 0;
      const hContratadasAnio = contratadasAnio[e._id] || 0;
      const hFichadasMes     = fichadasMes[e._id]     || 0;
      const hFichadasAnio    = fichadasAnio[e._id]    || 0;
      const pctMes  = hContratadasMes  ? hFichadasMes  / hContratadasMes  : 0;
      const pctAnio = hContratadasAnio ? hFichadasAnio / hContratadasAnio : 0;
      map[e._id] = { empleado: e, hContratadasMes, hContratadasAnio, hFichadasMes, hFichadasAnio, pctMes, pctAnio };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleados, turnos, fichajesAnio]);

  const avisos = useMemo(() => Object.values(statsPorEmpleado)
    .filter(a => a.hContratadasMes > 0 && (a.pctMes >= UMBRAL_AVISO || a.pctAnio >= UMBRAL_AVISO))
    .sort((a, b) => Math.max(b.pctMes, b.pctAnio) - Math.max(a.pctMes, a.pctAnio)),
  [statsPorEmpleado]);

  const guardarEdicion = async (f) => {
    if (!editForm.motivo.trim()) { setEditError('Indica el motivo de la corrección: queda registrado en el historial del fichaje (obligatorio por el registro de jornada).'); return; }
    const entrada = { ...f.entrada, fecha_hora: editForm.entrada ? new Date(editForm.entrada) : f.entrada.fecha_hora };
    const salida = editForm.salida ? { ...(f.salida || {}), fecha_hora: new Date(editForm.salida) } : f.salida;
    try {
      await api.put(`/fichajes/${f._id}`, { entrada, salida, estado: salida?.fecha_hora ? 'cerrado' : 'abierto', motivo: editForm.motivo.trim() });
      setEditandoId(null); setEditError('');
      cargar();
    } catch (e) { setEditError(e.response?.data?.error || 'Error al guardar'); }
  };

  const anular = async (f) => {
    const motivo = window.prompt(`Anular el fichaje de ${f.empleado?.nombre_display || 'este empleado'}.\n\nEl registro no se borra (obligación legal): quedará marcado como anulado y dejará de computar.\n\nMotivo de la anulación (obligatorio):`);
    if (motivo === null) return;
    if (!motivo.trim()) { alert('Debes indicar un motivo.'); return; }
    try {
      await api.put(`/fichajes/${f._id}/anular`, { motivo: motivo.trim() });
      cargar();
    } catch (e) { alert(e.response?.data?.error || 'Error al anular'); }
  };

  const abrirModalManual = () => {
    setFormManual({ empleadoId: '', fecha: claveDia(new Date()), horaEntrada: '', horaSalida: '', motivo: '' });
    setErrorManual('');
    setModalManual(true);
  };

  const guardarManual = async () => {
    setErrorManual('');
    if (!formManual.empleadoId) return setErrorManual('Selecciona un empleado');
    if (!formManual.fecha || !formManual.horaEntrada) return setErrorManual('Indica la fecha y la hora de entrada');
    if (!formManual.motivo.trim()) return setErrorManual('Indica el motivo (lo verá el empleado)');
    setGuardandoManual(true);
    try {
      await api.post('/fichajes/manual', {
        empleadoId: formManual.empleadoId,
        entrada: { fecha_hora: new Date(`${formManual.fecha}T${formManual.horaEntrada}`) },
        salida: formManual.horaSalida ? { fecha_hora: new Date(`${formManual.fecha}T${formManual.horaSalida}`) } : undefined,
        motivo: formManual.motivo.trim(),
      });
      setModalManual(false);
      cargar();
    } catch (e) {
      setErrorManual(e.response?.data?.error || 'Error al guardar el fichaje');
    } finally {
      setGuardandoManual(false);
    }
  };

  const fichajesDelDia = diaSeleccionado ? (porDia[claveDia(diaSeleccionado)] || []) : [];

  return (
    <>
      {puedeGestionarJornada && (
        <div className="panel" style={{ marginBottom: 20, borderColor: avisos.length ? 'color-mix(in srgb,var(--coral) 30%,transparent)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div className="panel-title" style={{ margin: 0 }}>⚠️ Avisos de horas</div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: avisos.length ? 12 : 0 }}>
            {avisos.length > 0
              ? 'Empleados cuyas horas fichadas se acercan o superan las horas contratadas según sus turnos:'
              : 'No hay ningún empleado cerca del límite de horas ahora mismo.'}
          </div>
          {avisos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {avisos.map(a => {
                const color = Math.max(a.pctMes, a.pctAnio) >= 1 ? 'var(--coral)' : 'var(--amber)';
                return (
                  <div key={a.empleado._id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '10px 14px', borderRadius: 8, border: `1px solid ${color}44`, background: `${color}14`,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{a.empleado.nombre_display}</div>
                      <div style={{ fontSize: 12, color, marginTop: 2 }}>
                        Mes: {a.hFichadasMes.toFixed(1)}h / {a.hContratadasMes.toFixed(1)}h ({Math.round(a.pctMes * 100)}%)
                        {' · '}Año: {a.hFichadasAnio.toFixed(1)}h / {a.hContratadasAnio.toFixed(1)}h ({Math.round(a.pctAnio * 100)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="filters-bar">
        <SearchSelect label="Empleado" items={empleados} value={empleadoFiltro}
          onChange={setEmpleadoFiltro} placeholder="Todos (buscar empleado…)" />
        <div className="filter-group">
          <div className="filter-label">Mes</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-cancel" onClick={() => cambiarMes(-1)}>‹</button>
            <div style={{ fontSize: 13.5, fontWeight: 500, minWidth: 130, textAlign: 'center' }}>
              {MESES[mesActual.getMonth()]} {mesActual.getFullYear()}
            </div>
            <button className="btn-cancel" onClick={() => cambiarMes(1)}>›</button>
          </div>
        </div>
        {(esAdmin || esGestoria) && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {esAdmin && <button className="btn-save" onClick={abrirModalManual}>+ Añadir fichaje olvidado</button>}
            <button className="btn-save" onClick={() => descargar('/fichajes/export/pdf', { desde, hasta, empleado: empleadoFiltro || 'todos' }, 'fichajes.pdf')}>⬇ PDF</button>
            <button className="btn-save" onClick={() => descargar('/fichajes/export/xlsx', { desde, hasta, empleado: empleadoFiltro || 'todos' }, 'fichajes.xlsx')}>⬇ XLSX</button>
          </div>
        )}
      </div>

      {sinSalida.length > 0 && (
        <div className="panel" style={{ borderColor: 'color-mix(in srgb,var(--coral) 35%,var(--border))' }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Incidencias: fichajes sin salida <span className="chip crit nod">{sinSalida.length}</span></div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '-8px 0 10px' }}>Entradas de días anteriores que siguen abiertas. Abre el día para corregir la salida (con motivo) o anular el fichaje.</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {sinSalida.slice(0, 12).map(f => {
              const dia = new Date(f.entrada.fecha_hora);
              return (
                <div key={f._id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <span className="chip crit">Sin salida</span>
                  <b style={{ flex: 1, minWidth: 160 }}>{f.empleado?.nombre_display || '—'}</b>
                  <span className="num" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{dia.toLocaleDateString('es-ES')} · entrada {fmtHora(f.entrada.fecha_hora)}</span>
                  <button className="btn-edit" onClick={() => { setMesActual(new Date(dia.getFullYear(), dia.getMonth(), 1)); setEmpleadoFiltro(''); setDiaSeleccionado(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate())); }}>Abrir día</button>
                </div>
              );
            })}
            {sinSalida.length > 12 && <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Y {sinSalida.length - 12} más este año.</div>}
          </div>
        </div>
      )}

      <div className="panel">
        {loading && <div className="empty-state"><div className="spinner" /></div>}
        {!loading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
              {DIAS_LABEL.map(d => (
                <div key={d} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
              {celdas.map((d, i) => {
                const enMes = d.getMonth() === mesActual.getMonth();
                const esHoy = claveDia(d) === claveDia(hoy);
                const lista = porDia[claveDia(d)] || [];
                const nEmpleados = new Set(lista.map(f => f.empleado?._id)).size;
                return (
                  <button
                    key={i}
                    onClick={() => lista.length && setDiaSeleccionado(d)}
                    style={{
                      minHeight: 68, borderRadius: 8, border: `1px solid ${esHoy ? 'var(--accent)' : 'var(--border)'}`,
                      background: enMes ? 'var(--surface-2)' : 'transparent', opacity: enMes ? 1 : 0.35,
                      padding: '6px 8px', textAlign: 'left', cursor: lista.length ? 'pointer' : 'default',
                      display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--f-ui)',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', width: '100%' }}>{d.getDate()}{lista.some(f => f.estado === 'abierto' && claveDia(d) < claveDia(hoy)) && <span title="Fichaje sin salida" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)', marginTop: 3 }} />}</span>
                    {lista.length > 0 && (
                      empleadoFiltro
                        ? <span style={{ fontSize: 11, color: 'var(--text)' }}>{fmtHora(lista[0].entrada.fecha_hora)}–{fmtHora(lista[0].salida?.fecha_hora)}</span>
                        : <span className="badge-count">{nEmpleados} 👷</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {diaSeleccionado && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setDiaSeleccionado(null); setEditandoId(null); } }}>
          <div className="modal-upload" style={{ maxWidth: 640 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>
                {diaSeleccionado.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <button className="modal-close" onClick={() => { setDiaSeleccionado(null); setEditandoId(null); }}>✕</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto' }}>
              {fichajesDelDia.map(f => (
                <div key={f._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  {editandoId === f._id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 600 }}>{f.empleado?.nombre_display}</div>
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <div>
                          <div className="filter-label" style={{ marginBottom: 4 }}>Entrada</div>
                          <input type="datetime-local" className="filter-input" style={{ width: '100%' }}
                            value={editForm.entrada} onChange={e => setEditForm(s => ({ ...s, entrada: e.target.value }))} />
                        </div>
                        <div>
                          <div className="filter-label" style={{ marginBottom: 4 }}>Salida</div>
                          <input type="datetime-local" className="filter-input" style={{ width: '100%' }}
                            value={editForm.salida} onChange={e => setEditForm(s => ({ ...s, salida: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <div className="filter-label" style={{ marginBottom: 4 }}>Motivo de la corrección *</div>
                        <input className="filter-input" style={{ width: '100%' }} placeholder="Ej: olvidó fichar la salida"
                          value={editForm.motivo} onChange={e => setEditForm(s => ({ ...s, motivo: e.target.value }))} />
                      </div>
                      {editError && <div className="error-msg">{editError}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-save" onClick={() => guardarEdicion(f)}>Guardar</button>
                        <button className="btn-cancel" onClick={() => { setEditandoId(null); setEditError(''); }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: f.estado === 'anulado' ? 0.55 : 1 }}>
                      <div>
                        <div style={{ fontWeight: 600, textDecoration: f.estado === 'anulado' ? 'line-through' : 'none' }}>
                          {f.empleado?.nombre_display}
                          {f.estado === 'anulado' && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: 'color-mix(in srgb,var(--coral) 12%,transparent)', color: 'var(--coral)', textDecoration: 'none', display: 'inline-block' }}>ANULADO</span>}
                        </div>
                        <div className="cell-mono" style={{ fontSize: 12, marginTop: 2 }}>
                          {fmtHora(f.entrada.fecha_hora)}
                          {' – '}
                          {f.estado === 'abierto' ? <span style={{ color: 'var(--coral)' }}>abierto</span> : <>{fmtHora(f.salida?.fecha_hora)}</>}
                          {f.estado !== 'anulado' && f.duracion_horas != null && <span className="badge-hours" style={{ marginLeft: 8 }}>{f.duracion_horas}h</span>}
                        </div>
                        {f.estado === 'anulado' && f.anulacion?.motivo && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Motivo: {f.anulacion.motivo}</div>
                        )}
                        {f.modificaciones?.length > 0 && f.estado !== 'anulado' && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>✎ Corregido {f.modificaciones.length === 1 ? '1 vez' : `${f.modificaciones.length} veces`} — última: {f.modificaciones[f.modificaciones.length - 1].motivo}</div>
                        )}
                        {f.creado_manualmente && (
                          <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>⚠ Añadido manualmente — {f.creado_manualmente.motivo}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-edit" onClick={() => setMapaFichaje(f)}>📍 Mapa</button>
                        <button className="btn-edit" onClick={() => descargar(`/fichajes/${f._id}/pdf`, undefined, `fichaje-${f.empleado?.nombre_completo || f.empleado?.nombre || 'empleado'}-${claveDia(new Date(f.entrada.fecha_hora))}.pdf`)}>⬇ Descargar</button>
                        {esAdmin && f.estado !== 'anulado' && <button className="btn-edit" onClick={() => { setEditandoId(f._id); setEditError(''); setEditForm({ entrada: toDatetimeLocal(f.entrada.fecha_hora), salida: toDatetimeLocal(f.salida?.fecha_hora), motivo: '' }); }}>Editar</button>}
                        {esAdmin && f.estado !== 'anulado' && <button className="btn-delete" onClick={() => anular(f)}>Anular</button>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mapaFichaje && <FichajeMapaModal fichaje={mapaFichaje} onClose={() => setMapaFichaje(null)} />}

      {esAdmin && modalManual && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalManual(false); }}>
          <div className="modal-upload" style={{ maxWidth: 420 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16 }}>Añadir fichaje olvidado</div>
              <button className="modal-close" onClick={() => setModalManual(false)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Quedará marcado como añadido manualmente y el empleado lo verá en «Mis fichajes», con el motivo.
              </div>
              <SearchSelect label="Empleado" items={empleados} value={formManual.empleadoId}
                onChange={id => setFormManual(f => ({ ...f, empleadoId: id }))} placeholder="Buscar empleado…" required />
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Fecha *</label>
                <input type="date" className="form-input" value={formManual.fecha}
                  onChange={e => setFormManual(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div>
                  <div className="filter-label" style={{ marginBottom: 4 }}>Hora entrada *</div>
                  <input type="time" className="filter-input" style={{ width: '100%' }}
                    value={formManual.horaEntrada} onChange={e => setFormManual(f => ({ ...f, horaEntrada: e.target.value }))} />
                </div>
                <div>
                  <div className="filter-label" style={{ marginBottom: 4 }}>Hora salida</div>
                  <input type="time" className="filter-input" style={{ width: '100%' }}
                    value={formManual.horaSalida} onChange={e => setFormManual(f => ({ ...f, horaSalida: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Déjala vacía si solo quieres registrar la entrada (queda abierto).</div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Motivo *</label>
                <input className="form-input" placeholder="Ej: se olvidó de fichar, confirmado por el encargado de turno"
                  value={formManual.motivo} onChange={e => setFormManual(f => ({ ...f, motivo: e.target.value }))} />
              </div>
              {errorManual && <div className="error-msg">{errorManual}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-cancel" style={{ flex: 1 }} onClick={() => setModalManual(false)}>Cancelar</button>
                <button className="btn-save" style={{ flex: 2 }} disabled={guardandoManual} onClick={guardarManual}>
                  {guardandoManual ? 'Guardando…' : 'Añadir fichaje'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
