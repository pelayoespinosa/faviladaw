import { useEffect, useState } from 'react';
import api from '../api/axios';
import { generarPDFEmpleado } from '../utils/pdfEmpleado';
import { TAREAS_LABEL, TAREAS_MEC, calcHSemProrr, calcHMesProrr, formatH } from '../constants/tareas';
import ObservacionesCell from '../components/ObservacionesCell';
import HorarioTramos from '../components/HorarioTramos';
import { useAuth } from '../context/AuthContext';

const DIAS_LABEL={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'};
const DIAS_ORDEN=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

export default function MisTurnos(){
  const{empleadoId}=useAuth();
  const[turnos,setTurnos]=useState([]);
  const[empleado,setEmpleado]=useState(null);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    api.get('/turnos',{params:{empleado:empleadoId}}).then(r=>{
      setTurnos(r.data);
      if(r.data.length>0) setEmpleado(r.data[0].empleado);
      setLoading(false);
    });
  },[]);

  const totalHSem=turnos.reduce((acc,t)=>acc+calcHSemProrr(t),0);

  return(<>
    {empleado&&(
      <div className="panel" style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontFamily: 'var(--f-display)',fontWeight:700,fontSize:18,marginBottom:4}}>{empleado.nombre_display||empleado.nombre}</div>
            <div style={{fontSize:13,color:'var(--text-2)',display:'flex',gap:20}}>
              <span>DNI: <strong>{empleado.dni||'—'}</strong></span>
              <span>Teléfono: <strong>{empleado.tlf||'—'}</strong></span>
              <span>Email: <strong>{empleado.email||'—'}</strong></span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{textAlign:'center'}}>
              <div className="badge-hours" style={{fontSize:16,padding:'6px 16px'}}>{formatH(totalHSem)}/sem</div>
              <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>Total semanal</div>
            </div>
            <button onClick={async ()=>await generarPDFEmpleado(empleado,turnos)} style={{
              padding:'8px 16px',background:'var(--accent)',color:'var(--on-accent)',
              border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,
              fontFamily: 'var(--f-ui)',
            }}>⬇ Descargar PDF</button>
          </div>
        </div>
      </div>
    )}

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Cliente','Zona','Tipo servicio','Días','Horario','Horas/sem','Observaciones'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading&&<tr className="loading-row"><td colSpan={7}><div className="spinner"/><div>Cargando…</div></td></tr>}
          {!loading&&turnos.length===0&&<tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">No tienes turnos asignados</div></div></td></tr>}
          {!loading&&turnos.map(t=>{
            const dias=[...(t.dias_semana||[])].sort((a,b)=>DIAS_ORDEN.indexOf(a)-DIAS_ORDEN.indexOf(b));
            const hP=calcHSemProrr(t);
            return(
              <tr key={t._id} className="row-parent" style={{cursor:'default'}}>
                <td data-label="Cliente">
                  <div style={{fontWeight:500,...(t.furgoneta?{color:'var(--blue)'}:null)}}>{t.furgoneta?`Furgoneta ${t.furgoneta.numero}`:(t.cliente?.nombre||'—')}</div>
                  {t.cliente?.sucursal&&<div style={{fontSize:11,color:'var(--accent)',marginTop:1}}>📍 {t.cliente.sucursal}</div>}
                  {t.furgoneta&&<div style={{fontSize:11,color:'var(--blue)',marginTop:1,fontFamily: 'var(--f-mono)'}}>{t.furgoneta.matricula}</div>}
                </td>
                <td data-label="Zona" className="cell-muted">{t.furgoneta?'—':(t.cliente?.zona||'—')}</td>
                <td data-label="Tipo servicio"><span style={{display:'inline-flex',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:500,background:TAREAS_MEC.has(t.tipo_tarea)?'var(--amber-lt)':'var(--accent-lt)',color:TAREAS_MEC.has(t.tipo_tarea)?'var(--amber)':'var(--accent)'}}>{TAREAS_LABEL[t.tipo_tarea]||t.tipo_tarea||'—'}</span></td>
                <td data-label="Días"><div className="days-wrap">{dias.map(d=><span key={d} className="day-pill">{DIAS_LABEL[d]||d}</span>)}{!dias.length&&<span style={{color:'var(--text-3)',fontSize:12}}>—</span>}</div></td>
                <td data-label="Horario"><HorarioTramos tramos={t.tramos}/></td>
                <td data-label="Horas/sem">{t.horas_semana?<span className="badge-hours">{t.horas_semana}h{t.tipo_tarea==='jardin'?<span style={{color:'var(--amber)',fontSize:10,marginLeft:4}}>({formatH(calcHMesProrr(t))}/mes)</span>:t.frecuencia!=='semanal'&&<span style={{color:'var(--amber)',fontSize:10,marginLeft:4}}>({formatH(hP)}/sem)</span>}</span>:<span style={{color:'var(--text-3)'}}>—</span>}</td>
                <td data-label="Observaciones" className="cell-muted" style={{fontSize:12}}><ObservacionesCell texto={t.observaciones}/></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </>);
}
