import { useEffect, useState } from 'react';
import api from '../api/axios';
import { ROL_EMPLEADO_BADGE, ROL_EMPLEADO_ITEMS, ROLES_ACCESO_ITEMS } from '../constants/roles';
import { TAREAS, formatH } from '../constants/tareas';
import { normalizar } from '../utils/texto';
import ModalCredenciales from '../components/ModalCredenciales';
import SearchSelect from '../components/SearchSelect';

const DIAS_TRABAJO=[{value:'lunes',corto:'L',nombre:'Lunes'},{value:'martes',corto:'M',nombre:'Martes'},{value:'miercoles',corto:'X',nombre:'Miércoles'},{value:'jueves',corto:'J',nombre:'Jueves'},{value:'viernes',corto:'V',nombre:'Viernes'},{value:'sabado',corto:'S',nombre:'Sábado'},{value:'domingo',corto:'D',nombre:'Domingo'}];
const empty={nombre:'',apellidos:'',dni:'',tlf:'',email:'',rol:'limpiador',especialidades:[],horas_semanales_contrato:'',ctto:'',dias_semana_contrato:'',dias_trabajo:[],nass:'',cp_residencia:'',fecha_alta_empresa:'',fecha_nacimiento:'',festivo_local_1:'',festivo_local_2:'',excluir_cuadro_laboral:false,tiene_variaciones:true};

const fInput=d=>d?new Date(d).toISOString().slice(0,10):'';
const fFecha=d=>d?new Date(d).toLocaleDateString('es-ES'):'—';

export default function GestionEmpleados(){
  const[empleados,setEmpleados]=useState([]);
  const[form,setForm]=useState(empty);
  const[crearAcceso,setCrearAcceso]=useState(true);
  const[rolAcceso,setRolAcceso]=useState('empleado');
  const[editId,setEditId]=useState(null);
  const[error,setError]=useState('');
  const[busqueda,setBusqueda]=useState('');
  const[loading,setLoading]=useState(true);
  const[verBajas,setVerBajas]=useState(false);
  const[credenciales,setCredenciales]=useState(null);
  const[aviso,setAviso]=useState('');

  const cargar=(incluirBajas=verBajas)=>api.get('/empleados',{params:incluirBajas?{inactivos:'1'}:{}}).then(r=>{setEmpleados(r.data);setLoading(false)});
  useEffect(()=>{
    cargar();
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBajas=()=>{const v=!verBajas;setVerBajas(v);setLoading(true);cargar(v)};

  const guardar=async()=>{
    if(!form.nombre)return setError('El nombre es obligatorio');
    if(!form.apellidos)return setError('Los apellidos son obligatorios');
    if(!form.dni)   return setError('El DNI es obligatorio');
    try{
      const{festivo_local_1,festivo_local_2,...formSinFestivos}=form;
      const payload={...formSinFestivos,horas_semanales_contrato:form.horas_semanales_contrato===''?null:parseFloat(form.horas_semanales_contrato),dias_semana_contrato:form.dias_semana_contrato===''?null:parseFloat(form.dias_semana_contrato),festivos_locales:[festivo_local_1,festivo_local_2].filter(Boolean)};
      if(editId){
        await api.put(`/empleados/${editId}`,payload);
      }else{
        const {data}=await api.post('/empleados',{...payload,crear_usuario:crearAcceso,rol_acceso:rolAcceso});
        if(data.reactivado){
          setAviso(data.cuenta_reactivada
            ?`${data.empleado.nombre_display} estaba dado de baja: se ha readmitido con todo su historial y su cuenta "${data.cuenta?.email}" vuelve a estar activa.`
            :`${data.empleado.nombre_display} estaba dado de baja: se ha readmitido con todo su historial.`);
        }
        if(data.credenciales)setCredenciales(data.credenciales);
      }
      setForm(empty);setEditId(null);setError('');cargar();
    }catch(e){setError(e.response?.data?.error||'Error al guardar')}
  };

  const editar=e=>{setForm({nombre:e.nombre||'',apellidos:e.apellidos||'',dni:e.dni||'',tlf:e.tlf||'',email:e.email||'',rol:e.rol||'limpiador',especialidades:e.especialidades||[],horas_semanales_contrato:e.horas_semanales_contrato??'',ctto:e.ctto||'',dias_semana_contrato:e.dias_semana_contrato??'',dias_trabajo:e.dias_trabajo||[],nass:e.nass||'',cp_residencia:e.cp_residencia||'',fecha_alta_empresa:fInput(e.fecha_alta_empresa),fecha_nacimiento:fInput(e.fecha_nacimiento),festivo_local_1:fInput((e.festivos_locales||[])[0]),festivo_local_2:fInput((e.festivos_locales||[])[1]),excluir_cuadro_laboral:!!e.excluir_cuadro_laboral,tiene_variaciones:e.tiene_variaciones!==false});setEditId(e._id);window.scrollTo(0,0)};
  const toggleDiaTrabajo=d=>setForm(f=>{const dias=f.dias_trabajo.includes(d)?f.dias_trabajo.filter(x=>x!==d):[...f.dias_trabajo,d];return{...f,dias_trabajo:DIAS_TRABAJO.map(x=>x.value).filter(x=>dias.includes(x)),dias_semana_contrato:dias.length||''}});
  const toggleEspecialidad=t=>setForm(f=>({...f,especialidades:f.especialidades.includes(t)?f.especialidades.filter(x=>x!==t):[...f.especialidades,t]}));
  const darBaja=async e=>{
    if(confirm(`¿Dar de baja a ${e.nombre_display}?\n\nNo se borra nada: se conservan sus fichajes, turnos y documentos (obligatorio legalmente) y su cuenta de acceso queda desactivada. Podrás readmitirle más adelante.`)){
      await api.delete(`/empleados/${e._id}`);cargar();
    }
  };
  const reactivar=async e=>{
    if(confirm(`¿Readmitir a ${e.nombre_display}? Recupera su historial y reactiva su cuenta de acceso.`)){
      await api.post(`/empleados/${e._id}/reactivar`);cargar();
    }
  };
  const crearCuenta=async e=>{
    try{
      const {data}=await api.post(`/empleados/${e._id}/usuario`,{rol_acceso:'empleado'});
      setCredenciales(data);cargar();
    }catch(err){setError(err.response?.data?.error||'Error al crear la cuenta')}
  };
  const resetPassword=async e=>{
    if(!confirm(`¿Generar una nueva contraseña temporal para ${e.cuenta.email}? La actual dejará de funcionar.`))return;
    try{
      const {data}=await api.put(`/empleados/${e._id}/usuario`,{accion:'reset_password'});
      setCredenciales(data);
    }catch(err){setError(err.response?.data?.error||'Error al restablecer la contraseña')}
  };
  const cambiarRolAcceso=async(e,rol)=>{
    try{await api.put(`/empleados/${e._id}/usuario`,{accion:'rol',rol});cargar()}
    catch(err){setError(err.response?.data?.error||'Error al cambiar el rol')}
  };
  const cancelar=()=>{setForm(empty);setEditId(null);setError('')};

  const empF=empleados.filter(e=>{
    if(!busqueda)return true;
    const q=normalizar(busqueda);
    return normalizar(e.nombre_display||e.nombre).includes(q)||normalizar(e.dni).includes(q)||normalizar(e.email||'').includes(q)||normalizar(e.cuenta?.email||'').includes(q);
  });

  return(<>
    <div className="panel">
      <div className="panel-title">{editId?'Editar empleado':'Nuevo empleado'}</div>
      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
        <div className="filter-group" style={{flex:1,minWidth:160}}>
          <span className="filter-label">Nombre <span style={{color:'var(--coral)'}}>*</span></span>
          <input className="form-input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ana"/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:160}}>
          <span className="filter-label">Apellidos <span style={{color:'var(--coral)'}}>*</span></span>
          <input className="form-input" value={form.apellidos} onChange={e=>setForm(f=>({...f,apellidos:e.target.value}))} placeholder="García Pérez"/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:140}}>
          <span className="filter-label">DNI <span style={{color:'var(--coral)'}}>*</span></span>
          <input className="form-input" value={form.dni} onChange={e=>setForm(f=>({...f,dni:e.target.value}))} placeholder="12345678A"/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:140}}>
          <span className="filter-label">Teléfono</span>
          <input className="form-input" value={form.tlf} onChange={e=>setForm(f=>({...f,tlf:e.target.value}))} placeholder="600000000"/>
        </div>
        <div className="filter-group" style={{flex:2,minWidth:200}}>
          <span className="filter-label">Email</span>
          <input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="correo@ejemplo.com"/>
        </div>
        <SearchSelect label="Rol" items={ROL_EMPLEADO_ITEMS} value={form.rol}
          onChange={v=>setForm(f=>({...f,rol:v}))} placeholder="Buscar rol…" />
        <div className="filter-group" style={{flex:'0 0 auto'}}>
          <span className="filter-label" title="Decide en cuál de los dos cuadros laborales del mes sale">¿Tiene variaciones?</span>
          <select className="form-select" value={form.tiene_variaciones?'si':'no'} onChange={e=>setForm(f=>({...f,tiene_variaciones:e.target.value==='si'}))}>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:160}}>
          <span className="filter-label">Horas/semana contrato</span>
          <input type="number" min="0" step="0.5" className="form-input" value={form.horas_semanales_contrato}
            onChange={e=>setForm(f=>({...f,horas_semanales_contrato:e.target.value}))} placeholder="Sin límite" />
        </div>
        <div className="filter-group" style={{flex:'0 0 auto'}}>
          <span className="filter-label" title="Días que trabaja: con ellos se calcula el plus de transporte exacto del Cuadro laboral">Días/semana</span>
          <div style={{display:'flex',gap:4}}>
            {DIAS_TRABAJO.map(d=>(
              <button type="button" key={d.value} title={d.nombre} onClick={()=>toggleDiaTrabajo(d.value)} className="pill-toggle" style={{
                minWidth:32,padding:'6px 0',justifyContent:'center',
                background: form.dias_trabajo.includes(d.value)?'var(--accent)':'transparent',
                color:      form.dias_trabajo.includes(d.value)?'var(--on-accent)':'var(--text-2)',
                borderColor:form.dias_trabajo.includes(d.value)?'var(--accent)':'var(--border-2)',
              }}>{d.corto}</button>
            ))}
          </div>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:140}}>
          <span className="filter-label">Ctto <span style={{color:'var(--text-3)',fontWeight:400,fontSize:10}}>(código de contrato)</span></span>
          <input className="form-input" value={form.ctto} onChange={e=>setForm(f=>({...f,ctto:e.target.value}))} placeholder="100"/>
        </div>
      </div>
      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
        <div className="filter-group" style={{flex:1,minWidth:180}}>
          <span className="filter-label">N.A.S.S. <span style={{color:'var(--text-3)',fontWeight:400,fontSize:10}}>(Seguridad Social)</span></span>
          <input className="form-input" value={form.nass} onChange={e=>setForm(f=>({...f,nass:e.target.value}))} placeholder="331234567890"/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:120}}>
          <span className="filter-label">CP residencia</span>
          <input className="form-input" value={form.cp_residencia} onChange={e=>setForm(f=>({...f,cp_residencia:e.target.value}))} placeholder="33011"/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:170}}>
          <span className="filter-label">Fecha alta empresa</span>
          <input type="date" className="form-input" value={form.fecha_alta_empresa} onChange={e=>setForm(f=>({...f,fecha_alta_empresa:e.target.value}))}/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:170}}>
          <span className="filter-label">Fecha nacimiento</span>
          <input type="date" className="form-input" value={form.fecha_nacimiento} onChange={e=>setForm(f=>({...f,fecha_nacimiento:e.target.value}))}/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:170}}>
          <span className="filter-label">Festivo local 1</span>
          <input type="date" className="form-input" value={form.festivo_local_1} onChange={e=>setForm(f=>({...f,festivo_local_1:e.target.value}))}/>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:170}}>
          <span className="filter-label">Festivo local 2</span>
          <input type="date" className="form-input" value={form.festivo_local_2} onChange={e=>setForm(f=>({...f,festivo_local_2:e.target.value}))}/>
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <div className="filter-label" style={{marginBottom:8}}>
          Especialidades <span style={{color:'var(--text-3)',fontWeight:400,fontSize:10}}>(opcional · vacío = puede cubrir cualquier servicio)</span>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {TAREAS.map(t=>(
            <button type="button" key={t.value} onClick={()=>toggleEspecialidad(t.value)} className="pill-toggle" style={{
              background: form.especialidades.includes(t.value)?'var(--accent)':'transparent',
              color:      form.especialidades.includes(t.value)?'var(--on-accent)':'var(--text-2)',
              borderColor:form.especialidades.includes(t.value)?'var(--accent)':'var(--border-2)',
            }}>{t.label}</button>
          ))}
        </div>
      </div>
      {!editId&&(
        <div className="form-row-fields" style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center',marginBottom:12,padding:'10px 14px',border:'1px solid var(--border)',borderRadius:8}}>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
            <input type="checkbox" checked={crearAcceso} onChange={e=>setCrearAcceso(e.target.checked)}/>
            Crear cuenta de acceso a la app automáticamente
          </label>
          {crearAcceso&&(
            <SearchSelect label="Rol de acceso" items={ROLES_ACCESO_ITEMS} value={rolAcceso}
              onChange={setRolAcceso} placeholder="Buscar rol…" />
          )}
          {crearAcceso&&<div style={{fontSize:11.5,color:'var(--text-3)'}}>Se generará usuario y contraseña temporal (se muestran al guardar).</div>}
        </div>
      )}
      <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-2)',margin:'4px 0 14px',cursor:'pointer'}}>
        <input type="checkbox" checked={!!form.excluir_cuadro_laboral} onChange={e=>setForm(f=>({...f,excluir_cuadro_laboral:e.target.checked}))} style={{accentColor:'var(--accent)',width:16,height:16}}/>
        No incluir en el cuadro laboral <span style={{color:'var(--text-3)',fontSize:12}}>(por ejemplo, el dueño de la empresa)</span>
      </label>
      {error&&<div className="error-msg" style={{marginBottom:10}}>{error}</div>}
      {aviso&&<div className="error-msg" style={{marginBottom:10,color:'var(--accent)'}}>{aviso} <button className="btn-cancel" style={{marginLeft:8}} onClick={()=>setAviso('')}>✕</button></div>}
      <div style={{display:'flex',gap:8}}>
        <button className="btn-save" onClick={guardar}>{editId?'Guardar cambios':'Añadir empleado'}</button>
        {editId&&<button className="btn-cancel" onClick={cancelar}>Cancelar</button>}
      </div>
    </div>

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar</span>
        <input className="filter-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Nombre, DNI, email o usuario…" style={{width:260}}/>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,cursor:'pointer'}}>
        <input type="checkbox" checked={verBajas} onChange={toggleBajas}/> Mostrar bajas
      </label>
      <div className="filters-count">{empF.length} empleados</div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Nombre','DNI','Rol','Teléfono','N.A.S.S.','CP','F. alta','F. nac.','Horas contrato','Días/sem','Ctto','Festivos locales','Variaciones','Acceso','Acciones'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading&&<tr className="loading-row"><td colSpan={15}><div className="spinner"/><div>Cargando…</div></td></tr>}
          {!loading&&empF.length===0&&<tr><td colSpan={15}><div className="empty-state"><div className="empty-state-icon">👷</div><div className="empty-state-text">No se encontraron empleados</div></div></td></tr>}
          {!loading&&empF.map(e=>{
            const rol=ROL_EMPLEADO_BADGE[e.rol]||{bg:'var(--surface-2)',color:'var(--text-2)',label:e.rol||'—'};
            const deBaja=e.activo===false;
            return(
              <tr key={e._id} className="row-parent" style={{cursor:'default',opacity:deBaja?0.55:1}}>
                <td data-label="Nombre" style={{fontWeight:500,color:'var(--text)'}}>
                  {e.nombre_display||e.nombre}

                  {deBaja&&<span style={{marginLeft:8,padding:'2px 8px',borderRadius:5,fontSize:10.5,fontWeight:600,background:'color-mix(in srgb,var(--coral) 12%,transparent)',color:'var(--coral)'}}>BAJA</span>}
                </td>
                <td data-label="DNI"><span className="cell-mono">{e.dni}</span></td>
                <td data-label="Rol"><span style={{display:'inline-flex',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:500,background:rol.bg,color:rol.color}}>{rol.label}</span></td>
                <td data-label="Teléfono" className="cell-muted">{e.tlf||'—'}</td>
                <td data-label="N.A.S.S."><span className="cell-mono" style={{fontSize:12}}>{e.nass||'—'}</span></td>
                <td data-label="CP" className="cell-muted">{e.cp_residencia||'—'}</td>
                <td data-label="F. alta" className="cell-muted">{fFecha(e.fecha_alta_empresa)}</td>
                <td data-label="F. nac." className="cell-muted">{fFecha(e.fecha_nacimiento)}</td>
                <td data-label="Horas contrato">{e.horas_semanales_contrato!=null?<span className="badge-hours">{formatH(e.horas_semanales_contrato)}/sem</span>:<span style={{color:'var(--text-3)',fontSize:12}}>Sin límite</span>}</td>
                <td data-label="Días/sem" className="cell-muted">{(e.dias_trabajo||[]).length
                  ?<span title={e.dias_trabajo.map(d=>DIAS_TRABAJO.find(x=>x.value===d)?.nombre).join(', ')}>{DIAS_TRABAJO.filter(x=>e.dias_trabajo.includes(x.value)).map(x=>x.corto).join(' ')}</span>
                  :'—'}</td>
                <td data-label="Ctto" className="cell-muted">{e.ctto||'—'}</td>
                <td data-label="Festivos locales" className="cell-muted">{(e.festivos_locales||[]).length?e.festivos_locales.map(fFecha).join(', '):'—'}</td>
                <td data-label="Variaciones">{e.tiene_variaciones!==false?<span className="chip warn">Sí</span>:<span className="chip">No</span>}</td>
                <td data-label="Acceso">
                  {e.cuenta?(
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span className="cell-mono" style={{fontSize:12}}>{e.cuenta.email}{e.cuenta.activo===false&&<span style={{color:'var(--coral)',marginLeft:6,fontSize:10.5}}>(desactivada)</span>}</span>
                      <select className="form-select" style={{fontSize:11,padding:'2px 6px',width:'fit-content'}} value={e.cuenta.rol}
                        onChange={ev=>cambiarRolAcceso(e,ev.target.value)} disabled={deBaja}>
                        {ROLES_ACCESO_ITEMS.map(r=><option key={r._id} value={r._id}>{r.nombre}</option>)}
                      </select>
                    </div>
                  ):(
                    <span style={{color:'var(--text-3)',fontSize:12}}>Sin cuenta</span>
                  )}
                </td>
                <td data-label="Acciones"><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {deBaja?(
                    <button className="btn-save" onClick={()=>reactivar(e)}>Readmitir</button>
                  ):(<>
                    <button className="btn-edit" onClick={()=>editar(e)}>Editar</button>
                    {e.cuenta
                      ?<button className="btn-edit" onClick={()=>resetPassword(e)} title="Genera una nueva contraseña temporal">🔑 Reset</button>
                      :<button className="btn-edit" onClick={()=>crearCuenta(e)}>+ Acceso</button>}
                    <button className="btn-delete" onClick={()=>darBaja(e)}>Dar de baja</button>
                  </>)}
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {credenciales&&<ModalCredenciales cred={credenciales} onClose={()=>setCredenciales(null)}/>}
  </>);
}
