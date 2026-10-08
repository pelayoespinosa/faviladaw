import { useEffect, useState } from 'react';
import api from '../api/axios';
import { generarPDFEmpleado } from '../utils/pdfEmpleado';
import { generarXLSXEmpleados } from '../utils/xlsxEmpleados';
import { TAREAS_LABEL, TAREAS_MEC, calcHSemProrr, calcHMesProrr, formatH } from '../constants/tareas';
import { ROL_EMPLEADO_BADGE } from '../constants/roles';
import ObservacionesCell from '../components/ObservacionesCell';
import HorarioTramos from '../components/HorarioTramos';
import { normalizar } from '../utils/texto';
import { mapaEstadoHoy, ESTADO_COLOR, ESTADO_LABEL } from '../utils/ausenciasEstado';
import { agruparCoberturasPorTurno } from '../utils/coberturas';
import { useSearchParams } from 'react-router-dom';

function EstadoAusenciaBadge({ estado }) {
  if (!estado) return null;
  return (
    <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, marginLeft: 7, background: estado === 'baja' ? 'color-mix(in srgb,var(--coral) 12%,transparent)' : 'var(--amber-lt)', color: ESTADO_COLOR[estado] }}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

const DIAS_LABEL={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'};
const DIAS_ORDEN=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

function ProximaFechaBadge({fecha}){
  if(!fecha)return<span style={{color:'var(--text-3)'}}>—</span>;
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const f=new Date(fecha); f.setHours(0,0,0,0);
  const diff=Math.round((f-hoy)/(1000*60*60*24));
  let bg,color;
  if(diff<0){bg='var(--coral-lt)';color='var(--coral)';}
  else if(diff<=14){bg='var(--amber-lt)';color='var(--amber)';}
  else{bg='var(--accent-lt)';color='var(--accent)';}
  return(
    <span style={{display:'inline-flex',flexDirection:'column',padding:'3px 8px',background:bg,borderRadius:6,fontSize:11,gap:1}}>
      <span style={{fontWeight:600,color}}>{new Date(fecha).toLocaleDateString('es-ES')}</span>
      <span style={{color,opacity:0.8,fontSize:10}}>{diff<0?`Hace ${Math.abs(diff)}d`:diff===0?'Hoy':`En ${diff}d`}</span>
    </span>
  );
}

function TurnoRow({turno, coberturaHoy, coberturaDe}){
  const dias=[...(turno.dias_semana||[])].sort((a,b)=>DIAS_ORDEN.indexOf(a)-DIAS_ORDEN.indexOf(b));
  const esMec=TAREAS_MEC.has(turno.tipo_tarea);
  const hProrr=calcHSemProrr(turno);
  return(
    <tr className="row-child" style={coberturaDe?{background:'color-mix(in srgb,var(--amber) 7%,transparent)'}:undefined}>
      <td data-label="Cliente"><div className="cell-client">
        <span style={{width:16,display:'inline-block'}}/>
        <div>
          <div style={turno.furgoneta?{color:'var(--blue)',fontWeight:600}:undefined}>{turno.furgoneta?`Furgoneta ${turno.furgoneta.numero}`:(turno.cliente?.nombre||'—')}</div>
          {turno.cliente?.sucursal&&<div style={{fontSize:11,color:'var(--accent)',marginTop:1}}>📍 {turno.cliente.sucursal}</div>}
          {turno.furgoneta&&<div style={{fontSize:11,color:'var(--blue)',marginTop:1,fontFamily: 'var(--f-mono)'}}>{turno.furgoneta.matricula}</div>}
          {coberturaHoy&&<div style={{fontSize:11,color:'var(--amber)',fontWeight:600,marginTop:2}}>🔶 Cubre: {coberturaHoy.empleado_cubre?.nombre_display||'—'} ({coberturaHoy.desde}{coberturaHoy.desde!==coberturaHoy.hasta?` – ${coberturaHoy.hasta}`:''})</div>}
          {coberturaDe&&<div style={{fontSize:11,color:'var(--amber)',fontWeight:600,marginTop:2}}>🔶 Cubres a {coberturaDe.empleado_ausente?.nombre_display||'—'} ({coberturaDe.desde}{coberturaDe.desde!==coberturaDe.hasta?` – ${coberturaDe.hasta}`:''})</div>}
        </div>
      </div></td>
      <td data-label="Zona" className="cell-muted">{turno.furgoneta?'—':(turno.cliente?.zona||'—')}</td>
      <td data-label="Tipo servicio"><span style={{display:'inline-flex',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:500,background:esMec?'var(--amber-lt)':'var(--accent-lt)',color:esMec?'var(--amber)':'var(--accent)'}}>{TAREAS_LABEL[turno.tipo_tarea]||turno.tipo_tarea||'—'}</span></td>
      <td data-label="Días"><div className="days-wrap">{dias.map(d=><span key={d} className="day-pill">{DIAS_LABEL[d]||d}</span>)}{!dias.length&&<span style={{color:'var(--text-3)',fontSize:12}}>—</span>}</div></td>
      <td data-label="Horario"><HorarioTramos tramos={turno.tramos}/></td>
      <td data-label="Horas/sem">{turno.horas_semana?<span className="badge-hours">{turno.horas_semana}h{turno.tipo_tarea==='jardin'?<span style={{color:'var(--amber)',fontSize:10,marginLeft:4}}>({formatH(calcHMesProrr(turno))}/mes)</span>:turno.frecuencia!=='semanal'&&<span style={{color:'var(--amber)',fontSize:10,marginLeft:4}}>({formatH(hProrr)}/sem)</span>}</span>:<span style={{color:'var(--text-3)'}}>—</span>}</td>
      <td data-label="Próxima fecha"><ProximaFechaBadge fecha={turno.proxima_fecha}/></td>
      <td data-label="Observaciones" className="cell-muted" style={{fontSize:12}}><ObservacionesCell texto={turno.observaciones}/></td>
      <td></td>
      <td></td>
    </tr>
  );
}

function EmpleadoRow({empleado,turnos,estado,coberturasHoyPorTurno,coberturasQueCubroHoy}){
  const[open,setOpen]=useState(false);
  const totalHSem=turnos.reduce((acc,t)=>acc+calcHSemProrr(t),0);
  const contrato=empleado.horas_semanales_contrato;
  const excedido=contrato!=null&&totalHSem>contrato+0.01;
  const rol=ROL_EMPLEADO_BADGE[empleado.rol]||{bg:'var(--surface-2)',color:'var(--text-2)',label:empleado.rol||'—'};
  const descargarPDF=async e=>{e.stopPropagation();await generarPDFEmpleado(empleado,turnos)};

  return(<>
    <tr className={`row-parent${open?' open':''}`} onClick={()=>setOpen(o=>!o)}>
      <td data-label="Empleado"><div className="cell-name"><div className="chevron">▶</div><span style={estado?{color:ESTADO_COLOR[estado],fontWeight:600}:undefined}>{empleado.nombre_display||empleado.nombre}</span><EstadoAusenciaBadge estado={estado} /></div></td>
      <td data-label="DNI"><span className="cell-mono">{empleado.dni}</span></td>
      <td data-label="Rol"><span style={{display:'inline-flex',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:500,background:rol.bg,color:rol.color}}>{rol.label}</span></td>
      <td data-label="Teléfono" className="cell-muted">{empleado.tlf||'—'}</td>
      <td data-label="Email" className="cell-muted" style={{fontSize:12}}>{empleado.email||'—'}</td>
      <td data-label="Horas/sem">
        {totalHSem>0||contrato!=null?(<>
          <span className="badge-hours" style={excedido?{background:'var(--amber-lt)',borderColor:'color-mix(in srgb,var(--amber) 30%,transparent)',color:'var(--amber)'}:undefined}>
            {excedido?'⚠ ':''}{formatH(totalHSem)}{contrato!=null?` de ${formatH(contrato)}`:''}/sem
          </span>
          {contrato>0&&<div className={`bar${excedido?' crit':totalHSem<contrato-0.01?' warn':''}`} style={{marginTop:5,maxWidth:130}} title="Horas asignadas en turnos frente al contrato"><i style={{width:`${Math.min(100,(totalHSem/contrato)*100)}%`}}/></div>}
        </>):<span className="cell-muted">—</span>}
      </td>
      <td data-label="Turnos"><span className="badge-count">{turnos.length} turno{turnos.length!==1?'s':''}</span></td>
      <td data-label="PDF" onClick={e=>e.stopPropagation()}>
        <button onClick={descargarPDF} style={{padding:'5px 10px',background:'var(--coral-lt)',color:'var(--coral)',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily: 'var(--f-ui)',whiteSpace:'nowrap'}}>⬇ PDF</button>
      </td>
    </tr>
    {open&&<tr className="row-subhead">
      <td style={{paddingLeft:44}}>Cliente</td>
      <td>Zona</td>
      <td>Tipo servicio</td>
      <td>Días</td>
      <td>Horario</td>
      <td>Horas/sem</td>
      <td>Próxima fecha</td>
      <td>Observaciones</td>
      <td></td>
      <td></td>
    </tr>}
    {open&&turnos.length===0&&coberturasQueCubroHoy.length===0&&<tr className="row-child"><td colSpan={8} style={{padding:'16px 16px 16px 44px',color:'var(--text-3)',fontSize:13}}>Sin turnos asignados</td></tr>}
    {open&&turnos.map(t=><TurnoRow key={t._id} turno={t} coberturaHoy={coberturasHoyPorTurno[t._id]}/>)}
    {open&&coberturasQueCubroHoy.map(c=>c.turno&&<TurnoRow key={`cob-${c.turno._id}`} turno={c.turno} coberturaDe={c}/>)}
  </>);
}

export default function Empleados(){
  const[empleados,setEmpleados]=useState([]);
  const[turnosPor,setTurnosPor]=useState({});
  const[estadoAusencias,setEstadoAusencias]=useState({});
  const[coberturasHoy,setCoberturasHoy]=useState([]);
  const[params]=useSearchParams();
  const[busqueda,setBusqueda]=useState(()=>params.get('q')||'');
  const[filtroDia,setFiltroDia]=useState('');
  const[filtroRol,setFiltroRol]=useState('');
  const[filtroTarea,setFiltroTarea]=useState('');
  const[filtroFechaDesde,setFiltroFechaDesde]=useState('');
  const[filtroFechaHasta,setFiltroFechaHasta]=useState('');
  const[loading,setLoading]=useState(true);
  const[exportando,setExportando]=useState(false);

  useEffect(()=>{
    const hoy=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const hoyStr=`${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-${pad(hoy.getDate())}`;
    Promise.all([
      api.get('/empleados'),
      api.get('/turnos'),
      api.get('/calendario/ausencias',{params:{desde:hoyStr,hasta:hoyStr,empleado:'todos'}}),
      api.get('/calendario/coberturas',{params:{desde:hoyStr,empleado:'todos'}}),
    ]).then(([eR,tR,aR,cR])=>{
      setEmpleados(eR.data);
      const map={};
      tR.data.forEach(t=>{const id=t.empleado?._id;if(!id)return;if(!map[id])map[id]=[];map[id].push(t)});
      setTurnosPor(map);
      setEstadoAusencias(mapaEstadoHoy(aR.data));
      setCoberturasHoy(cR.data);
      setLoading(false);
    });
  },[]);

  const coberturasHoyPorTurno=agruparCoberturasPorTurno(coberturasHoy);
  const coberturasQueCubroHoyPor={};
  Object.values(coberturasHoyPorTurno).forEach(seg=>{
    if(!seg?.idCubre)return;
    if(!coberturasQueCubroHoyPor[seg.idCubre])coberturasQueCubroHoyPor[seg.idCubre]=[];
    coberturasQueCubroHoyPor[seg.idCubre].push(seg);
  });

  const empF=empleados.filter(e=>{
    if(busqueda){const q=normalizar(busqueda);if(!normalizar(e.nombre_display||e.nombre).includes(q)&&!normalizar(e.dni).includes(q))return false}
    if(filtroDia){const ts=turnosPor[e._id]||[];if(!ts.some(t=>t.dias_semana?.includes(filtroDia)))return false}
    if(filtroRol&&e.rol!==filtroRol)return false;
    if(filtroTarea){const ts=turnosPor[e._id]||[];if(!ts.some(t=>t.tipo_tarea===filtroTarea))return false}
    if(filtroFechaDesde||filtroFechaHasta){
      const ts=turnosPor[e._id]||[];
      const desde=filtroFechaDesde?new Date(filtroFechaDesde):null;
      const hasta=filtroFechaHasta?new Date(filtroFechaHasta):null;
      const tiene=ts.some(t=>{
        if(!t.proxima_fecha)return false;
        const f=new Date(t.proxima_fecha);
        if(desde&&f<desde)return false;
        if(hasta&&f>hasta)return false;
        return true;
      });
      if(!tiene)return false;
    }
    return true;
  });

  const tF=id=>{
    let t=turnosPor[id]||[];
    if(filtroDia)   t=t.filter(t=>t.dias_semana?.includes(filtroDia));
    if(filtroTarea) t=t.filter(t=>t.tipo_tarea===filtroTarea);
    if(filtroFechaDesde||filtroFechaHasta){
      const desde=filtroFechaDesde?new Date(filtroFechaDesde):null;
      const hasta=filtroFechaHasta?new Date(filtroFechaHasta):null;
      t=t.filter(t=>{
        if(!t.proxima_fecha)return true;
        const f=new Date(t.proxima_fecha);
        if(desde&&f<desde)return false;
        if(hasta&&f>hasta)return false;
        return true;
      });
    }
    return t;
  };

  const descargarXLSX=async()=>{
    setExportando(true);
    try{
      await generarXLSXEmpleados(
        empF.map(e=>({empleado:e,turnos:tF(e._id),estado:estadoAusencias[e._id],coberturasQueCubro:coberturasQueCubroHoyPor[e._id]||[]})),
        coberturasHoyPorTurno,
      );
    }catch(err){console.error(err);alert('No se pudo generar el Excel')}
    finally{setExportando(false)}
  };

  return(<>
    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar empleado</span>
        <input className="filter-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Nombre o DNI…" style={{width:180}}/>
      </div>
      <div className="filter-group">
        <span className="filter-label">Día</span>
        <select className="filter-select" value={filtroDia} onChange={e=>setFiltroDia(e.target.value)}>
          <option value="">Todos los días</option>
          {Object.entries(DIAS_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="filter-group">
        <span className="filter-label">Tipo de tarea</span>
        <select className="filter-select" value={filtroTarea} onChange={e=>setFiltroTarea(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TAREAS_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="filter-group">
        <span className="filter-label">Rol</span>
        <select className="filter-select" value={filtroRol} onChange={e=>setFiltroRol(e.target.value)}>
          <option value="">Todos</option>
          <option value="director">Director/a</option>
          <option value="administrativo">Administrativo/a</option>
          <option value="encargado">Encargado/a</option>
          <option value="conductor">Conductor/a</option>
          <option value="peon">Peón</option>
          <option value="limpiador">Limpiador/a</option>
        </select>
      </div>
      <div className="filter-group">
        <span className="filter-label">Próxima fecha desde</span>
        <input type="date" className="filter-input" value={filtroFechaDesde} onChange={e=>setFiltroFechaDesde(e.target.value)}/>
      </div>
      <div className="filter-group">
        <span className="filter-label">Hasta</span>
        <input type="date" className="filter-input" value={filtroFechaHasta} onChange={e=>setFiltroFechaHasta(e.target.value)}/>
      </div>
      {(filtroFechaDesde||filtroFechaHasta)&&(
        <button onClick={()=>{setFiltroFechaDesde('');setFiltroFechaHasta('')}} style={{alignSelf:'flex-end',padding:'8px 12px',background:'var(--coral-lt)',color:'var(--coral)',border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontFamily: 'var(--f-ui)'}}>
          ✕ Limpiar fechas
        </button>
      )}
      <button className="btn-save" onClick={descargarXLSX} disabled={loading||exportando||!empF.length} style={{alignSelf:'flex-end'}}>{exportando?'Generando…':'⬇ XLSX'}</button>
      <div className="filters-count">{empF.length} empleados</div>
    </div>
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Empleado','DNI','Rol','Teléfono','Email','Horas/sem','Turnos','PDF'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading&&<tr className="loading-row"><td colSpan={8}><div className="spinner"/><div>Cargando…</div></td></tr>}
          {!loading&&empF.length===0&&<tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-text">No se encontraron empleados</div></div></td></tr>}
          {!loading&&empF.map(e=><EmpleadoRow key={e._id} empleado={e} turnos={tF(e._id)} estado={estadoAusencias[e._id]}
            coberturasHoyPorTurno={coberturasHoyPorTurno} coberturasQueCubroHoy={coberturasQueCubroHoyPor[e._id]||[]}/>)}
        </tbody>
      </table>
    </div>
  </>);
}
