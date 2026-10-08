import { useEffect, useState } from 'react';
import api from '../api/axios';
import { TAREAS_LABEL, TAREAS_MEC, calcHSemProrr, calcHMesProrr, formatH } from '../constants/tareas';
import ObservacionesCell from '../components/ObservacionesCell';
import HorarioTramos from '../components/HorarioTramos';
import { normalizar } from '../utils/texto';
import { mapaEstadoHoy, ESTADO_COLOR, ESTADO_LABEL } from '../utils/ausenciasEstado';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import SearchSelect from '../components/SearchSelect';

function EstadoAusenciaBadge({ estado }) {
  if (!estado) return null;
  return (
    <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 600, marginLeft: 6, background: estado === 'baja' ? 'color-mix(in srgb,var(--coral) 12%,transparent)' : 'var(--amber-lt)', color: ESTADO_COLOR[estado] }}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

const DIAS_LABEL={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'};
const DIAS_ORDEN=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const TIPOS=['piso','comunidad','nave','oficinas'];
const TIPOS_ITEMS=TIPOS.map(t=>({_id:t,nombre:t}));

function TipoBadge({tipo}){
  if(!tipo)return null;
  return<span className={`tipo-badge tipo-${tipo}`}>{tipo}</span>;
}

function TurnoRow({turno,estadoAusencias}){
  const[open,setOpen]=useState(false);
  const dias=[...(turno.dias_semana||[])].sort((a,b)=>DIAS_ORDEN.indexOf(a)-DIAS_ORDEN.indexOf(b));
  const esMec=TAREAS_MEC.has(turno.tipo_tarea);
  const hProrr=calcHSemProrr(turno);
  const hasSvcs=turno.servicios_adicionales?.length>0;
  const estado=estadoAusencias?.[turno.empleado?._id];
  return(<>
    <tr className="row-child">
      <td data-label="Empleado"><div className="cell-client">
        {hasSvcs&&<button className={`expand-btn${open?' open':''}`} onClick={()=>setOpen(o=>!o)}>▶</button>}
        {!hasSvcs&&<span style={{width:16,display:'inline-block'}}/>}
        <span style={estado?{color:ESTADO_COLOR[estado],fontWeight:600}:undefined}>{turno.empleado?.nombre_display||'—'}</span>
        <EstadoAusenciaBadge estado={estado} />
      </div></td>
      <td data-label="DNI"><span className="cell-mono">{turno.empleado?.dni||'—'}</span></td>
      <td data-label="Tipo servicio"><span style={{display:'inline-flex',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:500,background:esMec?'var(--amber-lt)':'var(--accent-lt)',color:esMec?'var(--amber)':'var(--accent)'}}>{TAREAS_LABEL[turno.tipo_tarea]||turno.tipo_tarea||'—'}</span></td>
      <td data-label="Días"><div className="days-wrap">{dias.map(d=><span key={d} className="day-pill">{DIAS_LABEL[d]||d}</span>)}{!dias.length&&<span style={{color:'var(--text-3)',fontSize:12}}>—</span>}</div></td>
      <td data-label="Horario"><HorarioTramos tramos={turno.tramos}/></td>
      <td data-label="Horas/sem">{turno.horas_semana?<span className="badge-hours">{turno.horas_semana}h{turno.tipo_tarea==='jardin'?<span style={{color:'var(--amber)',fontSize:10,marginLeft:4}}>({formatH(calcHMesProrr(turno))}/mes)</span>:turno.frecuencia!=='semanal'&&<span style={{color:'var(--amber)',fontSize:10,marginLeft:4}}>({formatH(hProrr)}/sem)</span>}</span>:<span style={{color:'var(--text-3)'}}>—</span>}</td>
      <td data-label="Observaciones" className="cell-muted" style={{fontSize:12}}><ObservacionesCell texto={turno.observaciones}/></td>
    </tr>
    {hasSvcs&&open&&<tr className="row-services"><td colSpan={7}><div className="services-wrap"><span className="services-label">Servicios</span>{turno.servicios_adicionales.map(s=><span key={s._id} className="service-chip">{s.nombre} — {s.precio}€</span>)}</div></td></tr>}
  </>);
}

function ClienteRow({cliente,turnos,onEdit,estadoAusencias,esAdmin}){
  const[open,setOpen]=useState(false);
  const totalHSem=turnos.reduce((acc,t)=>acc+calcHSemProrr(t),0);
  return(<>
    <tr className={`row-parent${open?' open':''}`} onClick={()=>setOpen(o=>!o)}>
      <td data-label="Cliente"><div className="cell-name">
        <div className="chevron">▶</div>
        <div>
          <div>{cliente.alias||cliente.nombre}</div>
          {cliente.alias&&<div style={{fontSize:11,color:'var(--text-3)',fontWeight:400,marginTop:1}}>{cliente.nombre}</div>}
          {cliente.sucursal&&<div style={{fontSize:11,color:'var(--accent)',fontWeight:400,marginTop:1}}>📍 {cliente.sucursal}</div>}
        </div>
      </div></td>
      <td data-label="NIF"><span className="cell-mono">{cliente.nif||'—'}</span></td>
      <td data-label="Zona" className="cell-muted">{cliente.zona||'—'}</td>
      <td data-label="Tipo"><TipoBadge tipo={cliente.tipo_cliente}/></td>
      <td data-label="Teléfono" className="cell-muted">{cliente.tlf||'—'}</td>
      <td data-label="Email" className="cell-muted" style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cliente.email||'—'}</td>
      <td data-label="Facturación">{cliente.facturacion_mensual>0?<span className="badge-hours" title={(cliente.facturacion_desglose||[]).map(l=>`${TAREAS_LABEL[l.tipo_tarea]||l.tipo_tarea}: ${l.horas_mes} h/mes × ${l.precio_hora} €/h = ${l.importe} €`).join('\n')}>{Math.round(cliente.facturacion_mensual).toLocaleString('es-ES')}€</span>:<span className="cell-muted">—</span>}</td>
      <td data-label="Horas/sem">{totalHSem>0?<span className="badge-count">{formatH(totalHSem)}/sem</span>:<span className="cell-muted">—</span>}</td>
      <td data-label="Acciones" onClick={e=>e.stopPropagation()}>
        {esAdmin?<button className="btn-edit" onClick={()=>onEdit(cliente)}>Editar</button>:<span style={{color:'var(--text-3)'}}>—</span>}
      </td>
    </tr>
    {open&&turnos.length>0&&<tr className="row-subhead">
      <td style={{paddingLeft:44}}>Empleado</td><td>DNI</td><td>Tipo servicio</td>
      <td>Días</td><td>Horario</td><td>Horas/sem</td><td colSpan={3}>Observaciones</td>
    </tr>}
    {open&&turnos.length===0&&<tr className="row-child"><td colSpan={9} style={{padding:'16px 16px 16px 44px',color:'var(--text-3)',fontSize:13}}>Sin turnos asignados</td></tr>}
    {open&&turnos.map(t=><TurnoRow key={t._id} turno={t} estadoAusencias={estadoAusencias}/>)}
  </>);
}

function EditModal({cliente,onClose,onSave}){
  const[form,setForm]=useState({
    nif:               cliente.nif||'',
    nombre:            cliente.nombre||'',
    alias:             cliente.alias||'',
    sucursal:          cliente.sucursal||'',
    direccion_facturacion: cliente.direccion_facturacion||'',
    direccion_real:    cliente.direccion_real||'',
    zona:              cliente.zona||'',
    cp:                cliente.cp||'',
    provincia:         cliente.provincia||'',
    tlf:               cliente.tlf||'',
    email:             cliente.email||'',
    tipo_cliente:      cliente.tipo_cliente||'',
    persona_contacto:  cliente.persona_contacto||'',
  });
  const[error,setError]=useState('');
  const[saving,setSaving]=useState(false);

  const guardar=async()=>{
    if(!form.nif)    return setError('El NIF es obligatorio');
    if(!form.nombre) return setError('El nombre es obligatorio');
    setSaving(true);
    try{
      await api.put(`/clientes/${cliente._id}`,{
        ...form,
        tipo_cliente: form.tipo_cliente||null,
      });
      onSave();
    }catch(e){
      setError(e.response?.data?.error||'Error al guardar');
      setSaving(false);
    }
  };

  const f=(key,label,opts={})=>(
    <div className="filter-group" style={{flex:1,minWidth:opts.wide?'100%':180}}>
      <span className="filter-label">{label}</span>
      <input className="form-input" value={form[key]}
        onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
        placeholder={opts.placeholder||''}
        type={opts.type||'text'}/>
    </div>
  );

  return(
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:32,width:'100%',maxWidth:680,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div>
            <div style={{fontFamily: 'var(--f-display)',fontWeight:700,fontSize:17}}>{form.nombre||'Editar cliente'}</div>
            {form.sucursal&&<div style={{fontSize:12,color:'var(--accent)',marginTop:2}}>📍 {form.sucursal}</div>}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:22,lineHeight:1}}>×</button>
        </div>

        <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
          {f('nif','NIF / CIF')}
          {f('nombre','Nombre fiscal')}
          {f('alias','Alias',{placeholder:'Nombre corto o coloquial'})}
          {f('sucursal','Sucursal / Local',{placeholder:'Ej: Polígono Silvota Nave 2'})}
        </div>
        <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
          {f('direccion_facturacion','Dirección facturación',{wide:false})}
          {f('direccion_real','Dirección comercial',{wide:false})}
          {f('zona','Población / Zona')}
          {f('cp','Código postal')}
          {f('provincia','Provincia')}
        </div>
        <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
          {f('tlf','Teléfono')}
          {f('email','Email')}
          {f('persona_contacto','Persona de contacto')}
        </div>
        <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
          <SearchSelect label="Tipo de cliente" items={TIPOS_ITEMS} value={form.tipo_cliente}
            onChange={v=>setForm(p=>({...p,tipo_cliente:v}))} placeholder="Buscar tipo…" />
        </div>

        {error&&<div className="error-msg" style={{marginBottom:12}}>{error}</div>}
        <div style={{display:'flex',gap:8}}>
          <button className="btn-save" onClick={guardar} disabled={saving}>{saving?'Guardando…':'Guardar cambios'}</button>
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function Clientes(){
  const{esAdmin}=useAuth();
  const[clientes,setClientes]=useState([]);
  const[turnosPor,setTurnosPor]=useState({});
  const[estadoAusencias,setEstadoAusencias]=useState({});
  const[params]=useSearchParams();
  const[busqueda,setBusqueda]=useState(()=>params.get('q')||'');
  const[filtroTipo,setFiltroTipo]=useState('');
  const[filtroZona,setFiltroZona]=useState('');
  const[zonas,setZonas]=useState([]);
  const[loading,setLoading]=useState(true);
  const[editando,setEditando]=useState(null);

  const cargar=()=>{
    const hoy=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const hoyStr=`${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-${pad(hoy.getDate())}`;
    return Promise.all([
      api.get('/clientes'),
      api.get('/turnos'),
      api.get('/calendario/ausencias',{params:{desde:hoyStr,hasta:hoyStr,empleado:'todos'}}),
    ]).then(([cR,tR,aR])=>{
      setClientes(cR.data);
      setZonas([...new Set(cR.data.map(c=>c.zona).filter(Boolean))].sort());
      const map={};
      tR.data.forEach(t=>{const id=t.cliente?._id;if(!id)return;if(!map[id])map[id]=[];map[id].push(t)});
      setTurnosPor(map);
      setEstadoAusencias(mapaEstadoHoy(aR.data));
      setLoading(false);
    });
  };

  useEffect(()=>{cargar()},[]);

  const cliF=clientes.filter(c=>{
    if(busqueda){const q=normalizar(busqueda);if(!normalizar(c.nombre).includes(q)&&!normalizar(c.alias).includes(q)&&!normalizar(c.nif).includes(q)&&!normalizar(c.sucursal).includes(q)&&!normalizar(c.direccion_facturacion).includes(q)&&!normalizar(c.direccion_real).includes(q))return false}
    if(filtroTipo&&c.tipo_cliente!==filtroTipo)return false;
    if(filtroZona&&c.zona!==filtroZona)return false;
    return true;
  });

  return(<>
    {esAdmin&&editando&&<EditModal cliente={editando} onClose={()=>setEditando(null)} onSave={()=>{setEditando(null);cargar()}}/>}

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar cliente</span>
        <input className="filter-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="NIF, nombre, alias o dirección…" style={{width:260}}/>
      </div>
      <div className="filter-group">
        <span className="filter-label">Tipo</span>
        <select className="filter-select" value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="filter-group">
        <span className="filter-label">Zona</span>
        <select className="filter-select" value={filtroZona} onChange={e=>setFiltroZona(e.target.value)}>
          <option value="">Todas las zonas</option>
          {zonas.map(z=><option key={z} value={z}>{z}</option>)}
        </select>
      </div>
      <div className="filters-count">{cliF.length} clientes</div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Cliente','NIF','Zona','Tipo','Teléfono','Email','Facturación','Horas/sem',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading&&<tr className="loading-row"><td colSpan={9}><div className="spinner"/><div>Cargando…</div></td></tr>}
          {!loading&&cliF.length===0&&<tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-text">No se encontraron clientes</div></div></td></tr>}
          {!loading&&cliF.map(c=><ClienteRow key={c._id} cliente={c} turnos={turnosPor[c._id]||[]} onEdit={setEditando} estadoAusencias={estadoAusencias} esAdmin={esAdmin}/>)}
        </tbody>
      </table>
    </div>
  </>);
}
