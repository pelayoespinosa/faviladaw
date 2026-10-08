import { useEffect, useState } from 'react';
import api from '../api/axios';
import { TAREAS, TAREAS_ITEMS, FRECUENCIAS, FRECUENCIAS_ITEMS, calcHSemProrr, calcHMesProrr, formatH } from '../constants/tareas';
import HorarioTramos from '../components/HorarioTramos';
import SearchSelect from '../components/SearchSelect';
import { normalizar } from '../utils/texto';
import { agruparCoberturasPorTurno } from '../utils/coberturas';

const DIAS=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_L={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'};
const DIA_HOY=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][new Date().getDay()];

function SemanaTurnos({turnos,onEditar}){
  const porEmp={};
  turnos.forEach(t=>{const id=t.empleado?._id||'sin';(porEmp[id]=porEmp[id]||{emp:t.empleado,turnos:[]}).turnos.push(t);});
  const filas=Object.values(porEmp).sort((a,b)=>String(a.emp?.nombre_display||'').localeCompare(String(b.emp?.nombre_display||''),'es'));
  const clase=t=>t.furgoneta?'van':t.frecuencia&&t.frecuencia!=='semanal'?'nosem':TAREAS.find(x=>x.value===t.tipo_tarea)?.mecanizada?'mec':t.tipo_tarea==='cristales'?'cri':'';
  const orden=t=>String(t.tramos?.[0]?.hora_llegada||'99');
  return(<>
    <div className="legend" style={{marginBottom:10}}>
      <span><i/>Limpieza</span><span><i className="l"/>Cristales</span><span><i style={{background:'var(--blue)'}}/>Mecanizada</span><span><i style={{background:'var(--purple)'}}/>Furgoneta</span><span><i style={{background:'var(--amber)'}}/>No semanal</span>
    </div>
    <div className="planner-wrap">
      <div className="planner">
        <div className="h p">Empleado</div>
        {DIAS.map(d=><div key={d} className={`h${d===DIA_HOY?' today':''}`}>{DIAS_L[d]}{d===DIA_HOY?' · hoy':''}</div>)}
        {filas.length===0&&<div style={{gridColumn:'1/-1',padding:24,color:'var(--text-3)'}}>No hay turnos que mostrar.</div>}
        {filas.map(f=>[
          <div key={`${f.emp?._id}-n`} className="p">{f.emp?.nombre_display||'—'}</div>,
          ...DIAS.map(d=>(
            <div key={`${f.emp?._id}-${d}`}>
              {f.turnos.filter(t=>(t.dias_semana||[]).includes(d)).sort((a,b)=>orden(a).localeCompare(orden(b))).map(t=>(
                <button type="button" key={t._id} className={`blk ${clase(t)}`} onClick={()=>onEditar(t)} title="Editar turno">
                  <b>{t.furgoneta?`Furgoneta ${t.furgoneta.numero}`:(t.cliente?.alias||t.cliente?.nombre||'—')}</b>
                  <span>{(t.tramos||[]).filter(x=>x.hora_llegada).map(x=>`${x.hora_llegada}–${x.hora_salida||''}`).join(' · ')||`${t.horas_semana||0} h/sem`}</span>
                </button>
              ))}
            </div>
          )),
        ])}
      </div>
    </div>
    <div style={{fontSize:12,color:'var(--text-3)',marginTop:8}}>Los turnos sin días marcados (por ejemplo, algunos trimestrales) solo aparecen en la vista Lista.</div>
  </>);
}

const emptyTramo = { hora_llegada:'', hora_salida:'' };

function AvisoHoras({ horasInfo }) {
  if (!horasInfo || horasInfo.contrato == null) return null;
  const { contrato, total, excedido } = horasInfo;
  return (
    <div style={{ fontSize: 11, marginTop: 4, color: excedido ? 'var(--amber)' : 'var(--text-3)', fontWeight: excedido ? 600 : 400 }}>
      {excedido ? '⚠ ' : ''}Contrato: {formatH(contrato)}/sem · Total asignado: {formatH(total)}
    </div>
  );
}

function EmpleadoPicker({ empleados, recomendados, cargando, value, onChange, horasInfo }) {
  const inputStyle = horasInfo?.excedido ? { borderColor: 'var(--amber)', background: 'var(--amber-lt)' } : undefined;
  return (<>
    <SearchSelect label="Empleado" items={empleados} value={value} onChange={onChange} placeholder="Buscar empleado…" required inputStyle={inputStyle} />
    <AvisoHoras horasInfo={horasInfo} />
    {cargando && <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '4px 0' }}>Buscando recomendados para este cliente…</div>}
    {!cargando && recomendados.length > 0 && (
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', margin: '4px 0' }}>Recomendados para este cliente/servicio:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 170, overflowY: 'auto' }}>
          {recomendados.map(r => {
            const seleccionado = value === r._id;
            const excedidoAqui = seleccionado && horasInfo?.excedido;
            return (
              <button type="button" key={r._id} onClick={() => onChange(r._id)}
                style={{
                  textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px',
                  borderRadius: 8, border: `1px solid ${excedidoAqui ? 'var(--amber)' : seleccionado ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: excedidoAqui ? 'var(--amber-lt)' : seleccionado ? 'var(--accent-lt)' : 'transparent',
                  color: 'var(--text)', cursor: 'pointer', fontSize: 12.5,
                }}>
                <span>{r.nombre_display}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {r.distancia_km != null ? `${r.distancia_km} km` : 'sin ubicación'}
                  {!r.especialista ? ' · sin especialidad' : ''}
                  {r.horas_libres != null ? ` · ${formatH(r.horas_libres)} libres` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </>);
}

const empty = {
  empleado:'', cliente:'', furgoneta:'', tipo_tarea:'', frecuencia:'semanal',
  dias_semana:[], tramos:[{...emptyTramo}],
  horas_semana:'', proxima_fecha:'', observaciones:'',
};

function formatFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function diasParaFecha(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const f = new Date(fecha);
  f.setHours(0,0,0,0);
  const diff = Math.round((f - hoy) / (1000*60*60*24));
  return diff;
}

function ProximaFechaBadge({ fecha }) {
  if (!fecha) return <span style={{color:'var(--text-3)'}}>—</span>;
  const dias = diasParaFecha(fecha);
  let bg, color;
  if (dias < 0)       { bg='var(--coral-lt)';  color='var(--coral)'; }
  else if (dias <= 7) { bg='var(--amber-lt)';  color='var(--amber)'; }
  else                { bg='var(--accent-lt)'; color='var(--accent)';}
  return (
    <span style={{display:'inline-flex',flexDirection:'column',padding:'3px 8px',background:bg,borderRadius:6,fontSize:11}}>
      <span style={{fontWeight:600,color}}>{formatFecha(fecha)}</span>
      <span style={{color,opacity:0.8,fontSize:10}}>
        {dias < 0 ? `Hace ${Math.abs(dias)} días` : dias === 0 ? 'Hoy' : `En ${dias} días`}
      </span>
    </span>
  );
}

export default function Turnos() {
  const [turnos,    setTurnos]    = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [clientes,  setClientes]  = useState([]);
  const [furgonetas,setFurgonetas]= useState([]);
  const [form,      setForm]      = useState(empty);
  const [editId,    setEditId]    = useState(null);
  const [error,     setError]     = useState('');
  const [busqueda,  setBusqueda]  = useState('');
  const [vista, setVista] = useState(() => { try { return localStorage.getItem('turnosVista') || 'lista'; } catch { return 'lista'; } });
  const cambiarVista = v => { setVista(v); try { localStorage.setItem('turnosVista', v); } catch {  } };

  const [recomendados,   setRecomendados]   = useState([]);
  const [cargandoRecom,  setCargandoRecom]  = useState(false);
  const [coberturasHoy,  setCoberturasHoy]  = useState([]);

  const buscarRecomendados = (clienteId, tipoTarea) => {
    if (!clienteId || !tipoTarea) { setRecomendados([]); return; }
    setCargandoRecom(true);
    api.get('/turnos/recomendaciones', { params: { cliente: clienteId, tipo_tarea: tipoTarea } })
      .then(r => setRecomendados(r.data))
      .catch(() => setRecomendados([]))
      .finally(() => setCargandoRecom(false));
  };

  const cargar = () => api.get('/turnos').then(r => setTurnos(r.data));
  useEffect(() => {
    cargar();
    api.get('/empleados').then(r => setEmpleados(r.data));
    api.get('/clientes').then(r  => setClientes(r.data));
    api.get('/flota').then(r     => setFurgonetas(r.data));
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    api.get('/calendario/coberturas', { params: { desde: hoyStr, empleado: 'todos' } }).then(r => setCoberturasHoy(r.data));
  }, []);

  const coberturaHoyPorTurno = agruparCoberturasPorTurno(coberturasHoy);

  const clientesYFlota = [
    ...clientes,
    ...furgonetas.map(f => ({ _id: f._id, nombre: `Furgoneta ${f.numero}`, matricula: f.matricula, esFlota: true })),
  ];
  const esFurgonetaId = id => furgonetas.some(f => f._id === id);

  const toggleDia = d => setForm(f => ({
    ...f, dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter(x=>x!==d) : [...f.dias_semana, d]
  }));

  const setTramo = (i, campo, valor) => setForm(f => ({
    ...f, tramos: f.tramos.map((tr,idx) => idx===i ? {...tr,[campo]:valor} : tr)
  }));
  const addTramo    = () => setForm(f => ({ ...f, tramos: [...f.tramos, {...emptyTramo}] }));
  const removeTramo = i  => setForm(f => ({ ...f, tramos: f.tramos.filter((_,idx)=>idx!==i) }));

  const guardar = async () => {
    if (!form.empleado)              return setError('Selecciona un empleado');
    if (!form.cliente && !form.furgoneta) return setError('Selecciona un cliente o una furgoneta');
    if (!form.tipo_tarea)            return setError('Selecciona el tipo de servicio');
    try {
      const payload = {
        ...form,
        cliente:       form.cliente   || undefined,
        furgoneta:     form.furgoneta || undefined,
        tramos:        form.tramos.filter(t => t.hora_llegada || t.hora_salida),
        horas_semana:  form.horas_semana  ? parseFloat(form.horas_semana) : undefined,
        proxima_fecha: form.proxima_fecha  || undefined,
      };
      if (editId) await api.put(`/turnos/${editId}`, payload);
      else        await api.post('/turnos', payload);
      setForm(empty); setEditId(null); setError(''); setRecomendados([]); cargar();
    } catch (e) { setError(e.response?.data?.error||'Error al guardar'); }
  };

  const editar = t => {
    setForm({
      empleado:      t.empleado?._id||'',
      cliente:       t.cliente?._id ||'',
      furgoneta:     t.furgoneta?._id||'',
      tipo_tarea:    t.tipo_tarea   ||'',
      frecuencia:    t.frecuencia   ||'semanal',
      dias_semana:   t.dias_semana  ||[],
      tramos:        t.tramos?.length ? t.tramos : [{...emptyTramo}],
      horas_semana:  t.horas_semana ||'',
      proxima_fecha: t.proxima_fecha ? new Date(t.proxima_fecha).toISOString().split('T')[0] : '',
      observaciones: t.observaciones||'',
    });
    setEditId(t._id);
    if (t.cliente?._id && t.tipo_tarea) buscarRecomendados(t.cliente._id, t.tipo_tarea); else setRecomendados([]);
    window.scrollTo(0,0);
  };

  const eliminar = async id => {
    if (confirm('¿Eliminar turno?')) { await api.delete(`/turnos/${id}`); cargar(); }
  };

  const turnosFiltrados = turnos.filter(t => {
    if (!busqueda) return true;
    const q = normalizar(busqueda);
    return (
      normalizar(t.empleado?.nombre_display||t.empleado?.nombre).includes(q) ||
      normalizar(t.cliente?.nombre).includes(q)  ||
      normalizar(t.cliente?.alias).includes(q) ||
      normalizar(t.cliente?.sucursal).includes(q)||
      normalizar(t.cliente?.direccion_facturacion).includes(q)||
      normalizar(t.cliente?.direccion_real).includes(q)||
      normalizar(t.furgoneta?.numero).includes(q)||
      normalizar(t.furgoneta?.matricula).includes(q)||
      normalizar(TAREAS.find(ta=>ta.value===t.tipo_tarea)?.label).includes(q)
    );
  });

  const horasInfo = (() => {
    if (!form.empleado) return null;
    const emp = empleados.find(e => e._id === form.empleado);
    const contrato = emp?.horas_semanales_contrato ?? null;
    if (contrato == null) return { contrato: null, asignadas: 0, nuevo: 0, total: 0, excedido: false };
    const asignadas = turnos
      .filter(t => t.empleado?._id === form.empleado && t._id !== editId)
      .reduce((acc, t) => acc + (t.horas_semanales_prorrateadas || 0), 0);
    const nuevo = calcHSemProrr({ horas_semana: parseFloat(form.horas_semana) || 0, frecuencia: form.frecuencia, tipo_tarea: form.tipo_tarea });
    const total = +(asignadas + nuevo).toFixed(2);
    return { contrato, asignadas, nuevo, total, excedido: total > contrato + 0.01 };
  })();

  return (<>
    <div className="panel">
      <div className="panel-title">{editId?'Editar turno':'Nuevo turno'}</div>

      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
        <EmpleadoPicker empleados={empleados}
          recomendados={recomendados} cargando={cargandoRecom}
          value={form.empleado} onChange={v=>setForm(f=>({...f,empleado:v}))} horasInfo={horasInfo} />
        <SearchSelect label="Cliente / furgoneta" items={clientesYFlota} value={form.cliente||form.furgoneta}
          onChange={v=>{
            const esFurg = esFurgonetaId(v);
            setForm(f=>(esFurg?{...f,cliente:'',furgoneta:v,dias_semana:[]}:{...f,cliente:v,furgoneta:''}));
            if (esFurg) setRecomendados([]); else buscarRecomendados(v, form.tipo_tarea);
          }}
          placeholder="Buscar cliente, sucursal o furgoneta…" required />
        <SearchSelect label="Tipo de servicio" items={TAREAS_ITEMS} value={form.tipo_tarea}
          onChange={v=>{
            setForm(f=>({...f,tipo_tarea:v}));
            if (form.cliente) buscarRecomendados(form.cliente, v);
          }}
          placeholder="Buscar tipo de servicio…" required />
      </div>

      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
        <SearchSelect label="Frecuencia" items={FRECUENCIAS_ITEMS} value={form.frecuencia}
          onChange={v=>setForm(f=>({...f,frecuencia:v}))} placeholder="Buscar frecuencia…" />
        <div className="filter-group" style={{flex:1,minWidth:160}}>
          <span className="filter-label">Próxima fecha <span style={{color:'var(--text-3)',fontWeight:400,fontSize:10}}>(opcional)</span></span>
          <input type="date" className="form-input" value={form.proxima_fecha}
            onChange={e=>setForm(f=>({...f,proxima_fecha:e.target.value}))} />
        </div>
        <div className="filter-group" style={{flex:1,minWidth:150}}>
          <span className="filter-label">Horas a la semana</span>
          <input type="number" step="0.25" min="0" max="40" className="form-input"
            value={form.horas_semana}
            onChange={e=>setForm(f=>({...f,horas_semana:e.target.value}))}
            placeholder="Ej: 3.5" />
        </div>
      </div>

      <div style={{marginBottom:16}}>
        <div className="filter-label" style={{marginBottom:8}}>
          Horario <span style={{color:'var(--text-3)',fontWeight:400,fontSize:10}}>(opcional · añade varios tramos si el horario está partido)</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {form.tramos.map((tr,i)=>(
            <div key={i} className="tramo-row" style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <input type="time" className="form-input" style={{maxWidth:150}} value={tr.hora_llegada}
                onChange={e=>setTramo(i,'hora_llegada',e.target.value)} placeholder="Llegada" />
              <span style={{color:'var(--text-3)'}}>–</span>
              <input type="time" className="form-input" style={{maxWidth:150}} value={tr.hora_salida}
                onChange={e=>setTramo(i,'hora_salida',e.target.value)} placeholder="Salida" />
              {form.tramos.length>1&&(
                <button type="button" className="btn-delete" onClick={()=>removeTramo(i)}>Quitar tramo</button>
              )}
            </div>
          ))}
          <button type="button" className="btn-edit" style={{alignSelf:'flex-start'}} onClick={addTramo}>+ Añadir tramo</button>
        </div>
      </div>

      {form.tipo_tarea==='jardin'&&form.horas_semana&&(
        <div style={{marginBottom:14,padding:'8px 14px',background:'var(--amber-lt)',border:'1px solid color-mix(in srgb,var(--amber) 20%,transparent)',borderRadius:8,fontSize:12,color:'var(--amber)'}}>
          {(()=>{
            const t={ horas_semana: parseFloat(form.horas_semana)||0, tipo_tarea:'jardin' };
            return `Jardín · 27 pasadas/año de media · Equivale a ${formatH(calcHMesProrr(t))}/mes (${calcHSemProrr(t).toFixed(2)}h/sem en el cómputo total)`;
          })()}
        </div>
      )}

      {form.tipo_tarea!=='jardin'&&form.frecuencia!=='semanal'&&form.horas_semana&&(
        <div style={{marginBottom:14,padding:'8px 14px',background:'var(--amber-lt)',border:'1px solid color-mix(in srgb,var(--amber) 20%,transparent)',borderRadius:8,fontSize:12,color:'var(--amber)'}}>
          {(()=>{
            const frec=FRECUENCIAS.find(f=>f.value===form.frecuencia);
            const p=calcHSemProrr({ horas_semana: parseFloat(form.horas_semana)||0, frecuencia: form.frecuencia });
            return `${frec?.label} · Equivale a ${p.toFixed(2)}h/sem en el cómputo total`;
          })()}
        </div>
      )}

      {['semanal','quincenal','mensual'].includes(form.frecuencia)&&!form.furgoneta&&(
        <div style={{marginBottom:14}}>
          <div className="filter-label" style={{marginBottom:8}}>Días de la semana</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {DIAS.map(d=>(
              <button key={d} onClick={()=>toggleDia(d)} className="pill-toggle" style={{
                background: form.dias_semana.includes(d)?'var(--accent)':'transparent',
                color:      form.dias_semana.includes(d)?'var(--on-accent)':'var(--text-2)',
                borderColor:form.dias_semana.includes(d)?'var(--accent)':'var(--border-2)',
              }}>{DIAS_L[d]}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{marginBottom:16}}>
        <div className="filter-label" style={{marginBottom:6}}>Observaciones</div>
        <input className="form-input" value={form.observaciones}
          onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))}
          placeholder="Notas adicionales…" style={{width:'100%'}}/>
      </div>

      {error&&<div className="error-msg">{error}</div>}
      <div style={{display:'flex',gap:8}}>
        <button className="btn-save" onClick={guardar}>{editId?'Guardar cambios':'Añadir turno'}</button>
        {editId&&<button className="btn-cancel" onClick={()=>{setForm(empty);setEditId(null);setError('');setRecomendados([])}}>Cancelar</button>}
      </div>
    </div>

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar turno</span>
        <input className="filter-input" value={busqueda}
          onChange={e=>setBusqueda(e.target.value)}
          placeholder="Empleado, cliente o tipo de servicio…" style={{width:300}}/>
      </div>
      <div className="filter-group" style={{minWidth:0}}>
        <span className="filter-label">Vista</span>
        <div className="seg" role="group" aria-label="Vista">
          <button type="button" aria-pressed={vista==='lista'} onClick={()=>cambiarVista('lista')}>Lista</button>
          <button type="button" aria-pressed={vista==='semana'} onClick={()=>cambiarVista('semana')}>Semana</button>
        </div>
      </div>
      <div className="filters-count">{turnosFiltrados.length} turnos</div>
    </div>

    {vista==='semana'&&<SemanaTurnos turnos={turnosFiltrados} onEditar={t=>{editar(t);window.scrollTo({top:0,behavior:'smooth'});}}/>}

    {vista==='lista'&&<div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{['Empleado','Cliente','Sucursal','Tipo servicio','Frecuencia','Próxima fecha','Días','Horario','H/sem','Acciones'].map(h=><th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {turnosFiltrados.length===0&&<tr><td colSpan={10}><div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">{busqueda?'No se encontraron turnos':'No hay turnos'}</div></div></td></tr>}
          {turnosFiltrados.map(t=>{
            const tarea=TAREAS.find(ta=>ta.value===t.tipo_tarea);
            const hP=calcHSemProrr(t);
            const cobertura=coberturaHoyPorTurno[t._id];
            return(
              <tr key={t._id} className="row-parent" style={{cursor:'default',background:cobertura?'color-mix(in srgb,var(--amber) 7%,transparent)':undefined}}>
                <td data-label="Empleado">
                  <div style={{fontWeight:500,color:'var(--text)'}}>{t.empleado?.nombre_display||t.empleado?.nombre||'—'}</div>
                  {cobertura&&<div style={{fontSize:11,color:'var(--amber)',fontWeight:600,marginTop:2}}>🔶 Cubre: {cobertura.empleado_cubre?.nombre_display||'—'} ({cobertura.desde}{cobertura.desde!==cobertura.hasta?` – ${cobertura.hasta}`:''})</div>}
                </td>
                <td data-label="Cliente" className={t.furgoneta?undefined:'cell-muted'} style={t.furgoneta?{color:'var(--blue)',fontWeight:600}:undefined}>{t.furgoneta?`Furgoneta ${t.furgoneta.numero}`:(t.cliente?.alias||t.cliente?.nombre||'—')}</td>
                <td data-label="Sucursal" className="cell-muted" style={{fontSize:12,color:t.furgoneta?'var(--blue)':undefined,fontFamily:t.furgoneta?'monospace':undefined}}>{t.furgoneta?t.furgoneta.matricula:(t.cliente?.sucursal||'—')}</td>
                <td data-label="Tipo servicio"><span style={{display:'inline-flex',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:500,background:tarea?.mecanizada?'var(--amber-lt)':'var(--accent-lt)',color:tarea?.mecanizada?'var(--amber)':'var(--accent)'}}>{tarea?.label||t.tipo_tarea||'—'}</span></td>
                <td data-label="Frecuencia" className="cell-muted" style={{fontSize:12}}>{FRECUENCIAS.find(f=>f.value===t.frecuencia)?.label||'—'}</td>
                <td data-label="Próxima fecha"><ProximaFechaBadge fecha={t.proxima_fecha}/></td>
                <td data-label="Días"><div className="days-wrap">{(t.dias_semana||[]).map(d=><span key={d} className="day-pill">{DIAS_L[d]||d}</span>)}{!t.dias_semana?.length&&<span style={{color:'var(--text-3)',fontSize:12}}>—</span>}</div></td>
                <td data-label="Horario"><HorarioTramos tramos={t.tramos}/></td>
                <td data-label="H/sem">{t.horas_semana?<span className="badge-hours">{t.horas_semana}h{t.tipo_tarea==='jardin'?<span style={{fontSize:10,marginLeft:4,opacity:0.7}}>({formatH(calcHMesProrr(t))}/mes)</span>:hP&&t.frecuencia!=='semanal'?<span style={{fontSize:10,marginLeft:4,opacity:0.7}}>({hP}h)</span>:null}</span>:<span style={{color:'var(--text-3)'}}>—</span>}</td>
                <td data-label="Acciones"><div style={{display:'flex',gap:6}}>
                  <button className="btn-edit" onClick={()=>editar(t)}>Editar</button>
                  <button className="btn-delete" onClick={()=>eliminar(t._id)}>Eliminar</button>
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>}
  </>);
}