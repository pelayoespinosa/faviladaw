import { Fragment, useEffect, useState } from 'react';
import api from '../api/axios';
import SearchSelect from '../components/SearchSelect';
import Icon from '../components/Icon';
import ObservacionesCell from '../components/ObservacionesCell';
import { normalizar } from '../utils/texto';
import { FRECUENCIAS, FRECUENCIAS_ITEMS, calcHSemProrr, formatH } from '../constants/tareas';

const DIAS=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_L={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'};

const emptyFurgoneta = { numero:'', matricula:'', modelo:'', tarjeta_combustible:'', contacto_aseguradora:'', conductores:[], observaciones:'' };
const emptyHoras     = { empleado:'', horas_semana:'', frecuencia:'semanal', dias_semana:[] };
const emptyNota      = { texto:'', fecha:'' };

function diasDesdeHoy(fecha) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha); f.setHours(0,0,0,0);
  return Math.round((f - hoy) / 86400000);
}

function NotaFechaBadge({ fecha }) {
  if (!fecha) return null;
  const diff = diasDesdeHoy(fecha);
  let bg, color;
  if (diff < 0)        { bg='var(--coral-lt)'; color='var(--coral)'; }
  else if (diff <= 14) { bg='var(--amber-lt)'; color='var(--amber)'; }
  else                 { bg='var(--accent-lt)'; color='var(--accent)'; }
  return (
    <span style={{display:'inline-flex',padding:'2px 8px',background:bg,color,borderRadius:6,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
      {new Date(fecha).toLocaleDateString('es-ES')} · {diff<0?`hace ${Math.abs(diff)}d`:diff===0?'hoy':`en ${diff}d`}
    </span>
  );
}

export default function Flota() {
  const [furgonetas, setFurgonetas] = useState([]);
  const [empleados,  setEmpleados]  = useState([]);
  const [turnos,     setTurnos]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busqueda,   setBusqueda]   = useState('');

  const [form,   setForm]   = useState(emptyFurgoneta);
  const [editId, setEditId] = useState(null);
  const [error,  setError]  = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [horasForm,  setHorasForm]  = useState(emptyHoras);
  const [horasError, setHorasError] = useState('');

  const [notaForm,   setNotaForm]   = useState(emptyNota);
  const [notaError,  setNotaError]  = useState('');
  const [subiendoId, setSubiendoId] = useState(null);
  const [archivoError, setArchivoError] = useState('');

  const cargar = () => Promise.all([
    api.get('/flota').then(r => setFurgonetas(r.data)),
    api.get('/turnos').then(r => setTurnos(r.data.filter(t => t.furgoneta))),
  ]).then(() => setLoading(false));

  useEffect(() => {
    cargar();
    api.get('/empleados').then(r => setEmpleados(r.data));
  }, []);

  const guardar = async () => {
    if (!form.numero)    return setError('Indica el número de furgoneta');
    if (!form.matricula) return setError('Indica la matrícula');
    try {
      const payload = { ...form, modelo: form.modelo || null, tarjeta_combustible: form.tarjeta_combustible || null, contacto_aseguradora: form.contacto_aseguradora || null, observaciones: form.observaciones || null };
      if (editId) await api.put(`/flota/${editId}`, payload);
      else        await api.post('/flota', payload);
      setForm(emptyFurgoneta); setEditId(null); setError(''); cargar();
    } catch (e) { setError(e.response?.data?.error || 'Error al guardar'); }
  };

  const editar = f => {
    setForm({
      numero: f.numero || '', matricula: f.matricula || '', modelo: f.modelo || '',
      tarjeta_combustible: f.tarjeta_combustible || '', contacto_aseguradora: f.contacto_aseguradora || '',
      observaciones: f.observaciones || '',
      conductores: (f.conductores || []).map(c => c._id),
    });
    setEditId(f._id);
    window.scrollTo(0, 0);
  };
  const cancelar = () => { setForm(emptyFurgoneta); setEditId(null); setError(''); };

  const eliminar = async f => {
    const horasAsociadas = turnos.filter(t => t.furgoneta?._id === f._id).length;
    const aviso = horasAsociadas
      ? `¿Eliminar la furgoneta ${f.numero}? Tiene ${horasAsociadas} registro(s) de horas que quedarán sin furgoneta asignada.`
      : `¿Eliminar la furgoneta ${f.numero}?`;
    if (confirm(aviso)) { await api.delete(`/flota/${f._id}`); if (expandedId===f._id) setExpandedId(null); cargar(); }
  };

  const añadirConductor = id => setForm(f => f.conductores.includes(id) ? f : { ...f, conductores: [...f.conductores, id] });
  const quitarConductor = id => setForm(f => ({ ...f, conductores: f.conductores.filter(c => c !== id) }));

  const toggleExpand = f => {
    setExpandedId(id => id === f._id ? null : f._id);
    setHorasForm(emptyHoras); setHorasError('');
    setNotaForm(emptyNota); setNotaError(''); setArchivoError('');
  };

  const toggleDiaHoras = d => setHorasForm(f => ({
    ...f, dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter(x=>x!==d) : [...f.dias_semana, d],
  }));

  const guardarHoras = async furgonetaId => {
    if (!horasForm.empleado)     return setHorasError('Selecciona el conductor');
    if (!horasForm.horas_semana) return setHorasError('Indica las horas');
    try {
      await api.post('/turnos', {
        empleado: horasForm.empleado, furgoneta: furgonetaId, tipo_tarea: 'otros',
        frecuencia: horasForm.frecuencia, dias_semana: horasForm.dias_semana,
        horas_semana: parseFloat(horasForm.horas_semana),
      });
      setHorasForm(emptyHoras); setHorasError(''); cargar();
    } catch (e) { setHorasError(e.response?.data?.error || 'Error al guardar'); }
  };

  const eliminarHoras = async id => {
    if (confirm('¿Eliminar este registro de horas?')) { await api.delete(`/turnos/${id}`); cargar(); }
  };

  const guardarNota = async furgonetaId => {
    if (!notaForm.texto.trim()) return setNotaError('Escribe el texto de la nota');
    try {
      await api.post(`/flota/${furgonetaId}/notas`, { texto: notaForm.texto, fecha: notaForm.fecha || undefined });
      setNotaForm(emptyNota); setNotaError(''); cargar();
    } catch (e) { setNotaError(e.response?.data?.error || 'Error al guardar'); }
  };

  const eliminarNota = async (furgonetaId, notaId) => {
    if (confirm('¿Eliminar esta nota?')) { await api.delete(`/flota/${furgonetaId}/notas/${notaId}`); cargar(); }
  };

  const subirArchivo = async (furgonetaId, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('archivo', file);
    setSubiendoId(furgonetaId); setArchivoError('');
    try {
      await api.post(`/flota/${furgonetaId}/archivos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      cargar();
    } catch (e) { setArchivoError(e.response?.data?.error || 'Error al subir el archivo'); }
    finally { setSubiendoId(null); }
  };

  const verArchivo = async (furgonetaId, archivo) => {
    const r = await api.get(`/flota/${furgonetaId}/archivos/${archivo._id}`, { responseType: 'blob' });
    window.open(URL.createObjectURL(r.data), '_blank');
  };

  const eliminarArchivo = async (furgonetaId, archivoId) => {
    if (confirm('¿Eliminar este archivo?')) { await api.delete(`/flota/${furgonetaId}/archivos/${archivoId}`); cargar(); }
  };

  const furgonetasF = furgonetas.filter(f => {
    if (!busqueda) return true;
    const q = normalizar(busqueda);
    return normalizar(f.numero).includes(q) || normalizar(f.matricula).includes(q)
      || normalizar(f.modelo).includes(q) || normalizar(f.tarjeta_combustible).includes(q)
      || normalizar(f.contacto_aseguradora).includes(q)
      || (f.conductores||[]).some(c => normalizar(c.nombre_display||c.nombre).includes(q));
  });

  return (<>
    <div className="panel">
      <div className="panel-title">{editId ? 'Editar furgoneta' : 'Nueva furgoneta'}</div>

      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
        <div className="filter-group" style={{flex:1,minWidth:150}}>
          <span className="filter-label">Número de furgoneta <span style={{color:'var(--coral)',marginLeft:3}}>*</span></span>
          <input className="form-input" value={form.numero} onChange={e=>setForm(f=>({...f,numero:e.target.value}))} placeholder="Ej: 3" />
        </div>
        <div className="filter-group" style={{flex:1,minWidth:170}}>
          <span className="filter-label">Matrícula <span style={{color:'var(--coral)',marginLeft:3}}>*</span></span>
          <input className="form-input" value={form.matricula} onChange={e=>setForm(f=>({...f,matricula:e.target.value.toUpperCase()}))} placeholder="1234 ABC" />
        </div>
        <div className="filter-group" style={{flex:1,minWidth:170}}>
          <span className="filter-label">Modelo</span>
          <input className="form-input" value={form.modelo} onChange={e=>setForm(f=>({...f,modelo:e.target.value}))} placeholder="Ej: Citroën Berlingo" />
        </div>
        <div className="filter-group" style={{flex:1,minWidth:200}}>
          <span className="filter-label">Tarjeta de combustible</span>
          <input className="form-input" value={form.tarjeta_combustible} onChange={e=>setForm(f=>({...f,tarjeta_combustible:e.target.value}))} placeholder="Nº de tarjeta" />
        </div>
        <div className="filter-group" style={{flex:1,minWidth:200}}>
          <span className="filter-label">Contacto aseguradora</span>
          <input className="form-input" value={form.contacto_aseguradora} onChange={e=>setForm(f=>({...f,contacto_aseguradora:e.target.value}))} placeholder="Compañía, teléfono…" />
        </div>
      </div>

      <div style={{marginBottom:16}}>
        <div className="filter-label" style={{marginBottom:8}}>Conductores asignados</div>
        {form.conductores.length > 0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
            {form.conductores.map(id => {
              const e = empleados.find(e => e._id === id);
              return (
                <span key={id} className="service-chip" style={{display:'inline-flex',alignItems:'center',gap:6}}>
                  {e?.nombre_display || '—'}
                  <button type="button" onClick={()=>quitarConductor(id)} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>×</button>
                </span>
              );
            })}
          </div>
        )}
        <SearchSelect items={empleados.filter(e=>!form.conductores.includes(e._id))} value=""
          onChange={v => v && añadirConductor(v)} placeholder="Buscar empleado para añadir como conductor…" />
      </div>

      <div style={{marginBottom:16}}>
        <div className="filter-label" style={{marginBottom:6}}>Observaciones</div>
        <input className="form-input" value={form.observaciones}
          onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))}
          placeholder="Notas adicionales…" style={{width:'100%'}} />
      </div>

      {error && <div className="error-msg">{error}</div>}
      <div style={{display:'flex',gap:8}}>
        <button className="btn-save" onClick={guardar}>{editId?'Guardar cambios':'Añadir furgoneta'}</button>
        {editId && <button className="btn-cancel" onClick={cancelar}>Cancelar</button>}
      </div>
    </div>

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar furgoneta</span>
        <input className="filter-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
          placeholder="Número, matrícula, tarjeta o conductor…" style={{width:300}} />
      </div>
      <div className="filters-count">{furgonetasF.length} furgonetas</div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Furgoneta','Matrícula','Modelo','Tarjeta combustible','Aseguradora','Conductores','Observaciones','Horas/sem','Acciones'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading && <tr className="loading-row"><td colSpan={9}><div className="spinner"/><div>Cargando…</div></td></tr>}
          {!loading && furgonetasF.length===0 && <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-text">{busqueda?'No se encontraron furgonetas':'No hay furgonetas registradas'}</div></div></td></tr>}
          {!loading && furgonetasF.map(f => {
            const turnosF = turnos.filter(t => t.furgoneta?._id === f._id);
            const totalHSem = turnosF.reduce((acc,t) => acc + calcHSemProrr(t), 0);
            const open = expandedId === f._id;
            return (<Fragment key={f._id}>
              <tr className={`row-parent${open?' open':''}`} onClick={()=>toggleExpand(f)}>
                <td data-label="Furgoneta"><div className="cell-name"><div className="chevron">▶</div>
                  <span style={{display:'inline-flex',alignItems:'center',gap:7,color:'var(--blue)',fontWeight:600}}><Icon name="van" size={15}/>Furgoneta {f.numero}</span>
                </div></td>
                <td data-label="Matrícula"><span className="cell-mono" style={{color:'var(--blue)'}}>{f.matricula}</span></td>
                <td data-label="Modelo" className="cell-muted">{f.modelo || '—'}</td>
                <td data-label="Tarjeta combustible" className="cell-muted">{f.tarjeta_combustible || '—'}</td>
                <td data-label="Aseguradora" className="cell-muted">{f.contacto_aseguradora || '—'}</td>
                <td data-label="Conductores">{(f.conductores||[]).length ? <div className="days-wrap">{f.conductores.map(c=><span key={c._id} className="day-pill">{c.nombre_display||c.nombre}</span>)}</div> : <span className="cell-muted">Sin conductores</span>}</td>
                <td data-label="Observaciones" className="cell-muted" style={{fontSize:12}} onClick={e=>e.stopPropagation()}><ObservacionesCell texto={f.observaciones}/></td>
                <td data-label="Horas/sem">{totalHSem>0 ? <span className="badge-hours">{formatH(totalHSem)}/sem</span> : <span className="cell-muted">—</span>}</td>
                <td data-label="Acciones" onClick={e=>e.stopPropagation()}><div style={{display:'flex',gap:6}}>
                  <button className="btn-edit" onClick={()=>editar(f)}>Editar</button>
                  <button className="btn-delete" onClick={()=>eliminar(f)}>Eliminar</button>
                </div></td>
              </tr>
              {open && (
                <tr className="row-child">
                  <td colSpan={9} style={{padding:'18px 20px',cursor:'default'}} onClick={e=>e.stopPropagation()}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Horas de conducción por conductor</div>

                    {turnosF.length>0 && (
                      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                        {turnosF.map(t => (
                          <div key={t._id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--surface-2)',borderRadius:'var(--radius)'}}>
                            <span style={{flex:1,fontSize:13,fontWeight:500}}>{t.empleado?.nombre_display||'—'}</span>
                            <span className="badge-hours">{t.horas_semana}h{t.frecuencia!=='semanal'?` (${formatH(calcHSemProrr(t))}/sem)`:''}</span>
                            <span className="cell-muted" style={{fontSize:12}}>{FRECUENCIAS.find(fr=>fr.value===t.frecuencia)?.label}</span>
                            <div className="days-wrap">{(t.dias_semana||[]).map(d=><span key={d} className="day-pill">{DIAS_L[d]}</span>)}</div>
                            <button className="btn-delete" onClick={()=>eliminarHoras(t._id)}>Eliminar</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {(f.conductores||[]).length===0 ? (
                      <div style={{fontSize:13,color:'var(--text-3)'}}>Asigna primero un conductor a esta furgoneta para poder añadirle horas.</div>
                    ) : (
                      <div className="form-row-fields" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
                        <SearchSelect label="Conductor" items={f.conductores} value={horasForm.empleado}
                          onChange={v=>setHorasForm(h=>({...h,empleado:v}))} placeholder="Buscar conductor…" />
                        <div className="filter-group" style={{minWidth:120}}>
                          <span className="filter-label">Horas/sem</span>
                          <input type="number" step="0.25" min="0" className="form-input" value={horasForm.horas_semana}
                            onChange={e=>setHorasForm(h=>({...h,horas_semana:e.target.value}))} placeholder="Ej: 5" />
                        </div>
                        <SearchSelect label="Frecuencia" items={FRECUENCIAS_ITEMS} value={horasForm.frecuencia}
                          onChange={v=>setHorasForm(h=>({...h,frecuencia:v}))} placeholder="Buscar frecuencia…" />
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {DIAS.map(d=>(
                            <button key={d} type="button" onClick={()=>toggleDiaHoras(d)} className="pill-toggle" style={{
                              background: horasForm.dias_semana.includes(d)?'var(--blue)':'transparent',
                              color:      horasForm.dias_semana.includes(d)?'#fff':'var(--text-2)',
                              borderColor:horasForm.dias_semana.includes(d)?'var(--blue)':'var(--border-2)',
                            }}>{DIAS_L[d]}</button>
                          ))}
                        </div>
                        <button className="btn-save" onClick={()=>guardarHoras(f._id)}>Añadir horas</button>
                      </div>
                    )}
                    {horasError && <div className="error-msg" style={{marginTop:10}}>{horasError}</div>}

                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))',gap:20,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Notas</div>
                        {(f.notas||[]).length>0 && (
                          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                            {[...f.notas].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(n => (
                              <div key={n._id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 12px',background:'var(--surface-2)',borderRadius:'var(--radius)'}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:13}}>{n.texto}</div>
                                  {n.fecha && <div style={{marginTop:4}}><NotaFechaBadge fecha={n.fecha}/></div>}
                                </div>
                                <button className="btn-delete" onClick={()=>eliminarNota(f._id,n._id)}>Eliminar</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="form-row-fields" style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
                          <div className="filter-group" style={{flex:1,minWidth:160}}>
                            <span className="filter-label">Texto</span>
                            <input className="form-input" value={notaForm.texto}
                              onChange={e=>setNotaForm(n=>({...n,texto:e.target.value}))}
                              placeholder="Ej: Próxima ITV" />
                          </div>
                          <div className="filter-group" style={{minWidth:150}}>
                            <span className="filter-label">Fecha <span style={{color:'var(--text-3)',fontWeight:400,fontSize:10}}>(opcional)</span></span>
                            <input type="date" className="form-input" value={notaForm.fecha}
                              onChange={e=>setNotaForm(n=>({...n,fecha:e.target.value}))} />
                          </div>
                          <button className="btn-save" onClick={()=>guardarNota(f._id)}>Añadir nota</button>
                        </div>
                        {notaError && <div className="error-msg" style={{marginTop:8}}>{notaError}</div>}
                      </div>

                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Archivos</div>
                        {(f.archivos||[]).length>0 && (
                          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                            {[...f.archivos].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(a => (
                              <div key={a._id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--surface-2)',borderRadius:'var(--radius)'}}>
                                <span style={{color:'var(--text-2)'}}><Icon name="filetext" size={16}/></span>
                                <button type="button" onClick={()=>verArchivo(f._id,a)} style={{flex:1,minWidth:0,textAlign:'left',background:'none',border:'none',padding:0,cursor:'pointer',fontSize:13,color:'var(--accent)',textDecoration:'underline',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nombre}</button>
                                <button className="btn-delete" onClick={()=>eliminarArchivo(f._id,a._id)}>Eliminar</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input type="file" id={`file-${f._id}`} style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={e=>{ const file=e.target.files[0]; e.target.value=''; subirArchivo(f._id,file); }} />
                        <label htmlFor={`file-${f._id}`} className="btn-edit" style={{cursor:'pointer',display:'inline-block'}}>
                          {subiendoId===f._id ? 'Subiendo…' : '+ Subir archivo (PDF o imagen)'}
                        </label>
                        {archivoError && <div className="error-msg" style={{marginTop:8}}>{archivoError}</div>}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>);
          })}
        </tbody>
      </table>
    </div>
  </>);
}
