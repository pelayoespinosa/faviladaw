import { useEffect, useState } from 'react';
import api from '../api/axios';
import { normalizar } from '../utils/texto';
import { TAREAS_LABEL } from '../constants/tareas';
import SearchSelect from '../components/SearchSelect';

const TIPOS=['piso','comunidad','nave','oficinas'];
const TIPOS_ITEMS=TIPOS.map(t=>({_id:t,nombre:t}));
const empty={nif:'',nombre:'',alias:'',sucursal:'',direccion_facturacion:'',direccion_real:'',zona:'',cp:'',provincia:'',tlf:'',email:'',tipo_cliente:'',persona_contacto:''};

export default function GestionClientes(){
  const[clientes,setClientes]=useState([]);
  const[form,setForm]=useState(empty);
  const[editId,setEditId]=useState(null);
  const[sucursalDe,setSucursalDe]=useState('');
  const[error,setError]=useState('');
  const[busqueda,setBusqueda]=useState('');
  const[filtroTipo,setFiltroTipo]=useState('');
  const[loading,setLoading]=useState(true);

  const cargar=()=>api.get('/clientes').then(r=>{setClientes(r.data);setLoading(false)});
  useEffect(()=>{cargar()},[]);

  const guardar=async()=>{
    if(!form.nif)   return setError('El NIF es obligatorio');
    if(!form.nombre)return setError('El nombre es obligatorio');
    if(sucursalDe&&!form.sucursal.trim())return setError('Indica el nombre de la sucursal');
    try{
      const payload={...form,tipo_cliente:form.tipo_cliente||null};
      if(editId)await api.put(`/clientes/${editId}`,payload);
      else      await api.post('/clientes',payload);
      setForm(empty);setEditId(null);setSucursalDe('');setError('');cargar();
    }catch(e){setError(e.response?.data?.error||'Error al guardar')}
  };

  const editar=c=>{
    setForm({nif:c.nif||'',nombre:c.nombre||'',alias:c.alias||'',sucursal:c.sucursal||'',direccion_facturacion:c.direccion_facturacion||'',direccion_real:c.direccion_real||'',zona:c.zona||'',cp:c.cp||'',provincia:c.provincia||'',tlf:c.tlf||'',email:c.email||'',tipo_cliente:c.tipo_cliente||'',persona_contacto:c.persona_contacto||''});
    setEditId(c._id);setSucursalDe('');window.scrollTo(0,0);
  };

  const nuevaSucursal=c=>{
    setForm({nif:c.nif||'',nombre:c.nombre||'',alias:c.alias||'',sucursal:'',direccion_facturacion:c.direccion_facturacion||'',direccion_real:'',zona:c.zona||'',cp:c.cp||'',provincia:c.provincia||'',tlf:c.tlf||'',email:c.email||'',tipo_cliente:c.tipo_cliente||'',persona_contacto:c.persona_contacto||''});
    setEditId(null);setSucursalDe(c.alias||c.nombre);setError('');window.scrollTo(0,0);
  };

  const eliminar=async id=>{if(confirm('¿Eliminar cliente?')){await api.delete(`/clientes/${id}`);cargar()}};
  const cancelar=()=>{setForm(empty);setEditId(null);setSucursalDe('');setError('')};

  const f=(key,label,opts={})=>(
    <div className="filter-group" style={{flex:opts.flex||1,minWidth:opts.min||160}}>
      <span className="filter-label">{label}{opts.req&&<span style={{color:'var(--coral)',marginLeft:3}}>*</span>}</span>
      <input className="form-input" value={form[key]} type={opts.type||'text'}
        onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={opts.ph||''}/>
    </div>
  );

  const cliF=clientes.filter(c=>{
    if(busqueda){const q=normalizar(busqueda);if(!normalizar(c.nombre).includes(q)&&!normalizar(c.alias).includes(q)&&!normalizar(c.nif).includes(q)&&!normalizar(c.sucursal).includes(q)&&!normalizar(c.direccion_facturacion).includes(q)&&!normalizar(c.direccion_real).includes(q))return false}
    if(filtroTipo&&c.tipo_cliente!==filtroTipo)return false;
    return true;
  });

  return(<>
    <div className="panel">
      <div className="panel-title">{editId?'Editar cliente':sucursalDe?`Nueva sucursal de ${sucursalDe}`:'Nuevo cliente'}</div>
      {sucursalDe&&<div style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>Datos copiados del cliente original. Rellena la sucursal y la dirección comercial; ajusta el resto si hace falta.</div>}

      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
        {f('nif','NIF / CIF',{req:true,ph:'B12345678'})}
        {f('nombre','Nombre fiscal',{req:true,flex:2,min:200,ph:'Razón social'})}
        {f('alias','Alias',{flex:2,min:200,ph:'Nombre corto o coloquial'})}
        {f('sucursal','Sucursal / Local',{flex:2,min:200,ph:'Ej: Polígono Silvota Nave 2'})}
      </div>
      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
        {f('direccion_facturacion','Dirección facturación',{flex:2,min:200})}
        {f('direccion_real','Dirección comercial',{flex:2,min:200})}
        {f('zona','Población / Zona',{ph:'Oviedo'})}
        {f('cp','CP',{min:100,ph:'33001'})}
        {f('provincia','Provincia',{ph:'Asturias'})}
      </div>
      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
        {f('tlf','Teléfono',{ph:'985000000'})}
        {f('email','Email',{type:'email',flex:2,min:200})}
        {f('persona_contacto','Persona de contacto',{flex:2,min:200})}
      </div>
      <div className="form-row-fields" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
        <SearchSelect label="Tipo de cliente" items={TIPOS_ITEMS} value={form.tipo_cliente}
          onChange={v=>setForm(p=>({...p,tipo_cliente:v}))} placeholder="Buscar tipo…" />
      </div>

      {error&&<div className="error-msg" style={{marginBottom:10}}>{error}</div>}
      <div style={{display:'flex',gap:8}}>
        <button className="btn-save" onClick={guardar}>{editId?'Guardar cambios':sucursalDe?'Añadir sucursal':'Añadir cliente'}</button>
        {(editId||sucursalDe)&&<button className="btn-cancel" onClick={cancelar}>Cancelar</button>}
      </div>
    </div>

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar</span>
        <input className="filter-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="NIF, nombre, alias o dirección…" style={{width:280}}/>
      </div>
      <div className="filter-group">
        <span className="filter-label">Tipo</span>
        <select className="filter-select" value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
          <option value="">Todos</option>
          {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="filters-count">{cliF.length} clientes</div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Nombre','Sucursal','NIF','Zona','Tipo','Teléfono','Facturación','Acciones'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading&&<tr className="loading-row"><td colSpan={8}><div className="spinner"/><div>Cargando…</div></td></tr>}
          {!loading&&cliF.length===0&&<tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">🏢</div><div className="empty-state-text">No se encontraron clientes</div></div></td></tr>}
          {!loading&&cliF.map(c=>(
            <tr key={c._id} className="row-parent" style={{cursor:'default'}}>
              <td data-label="Nombre" style={{fontWeight:500,color:'var(--text)'}}>
                {c.alias||c.nombre}
                {c.alias&&<div style={{fontSize:11,color:'var(--text-3)',fontWeight:400}}>{c.nombre}</div>}
              </td>
              <td data-label="Sucursal" className="cell-muted" style={{fontSize:12}}>{c.sucursal||'—'}</td>
              <td data-label="NIF"><span className="cell-mono">{c.nif||'—'}</span></td>
              <td data-label="Zona" className="cell-muted">{c.zona||'—'}</td>
              <td data-label="Tipo">{c.tipo_cliente?<span className={`tipo-badge tipo-${c.tipo_cliente}`}>{c.tipo_cliente}</span>:null}</td>
              <td data-label="Teléfono" className="cell-muted">{c.tlf||'—'}</td>
              <td data-label="Facturación">{c.facturacion_mensual>0?<span className="badge-hours" title={(c.facturacion_desglose||[]).map(l=>`${TAREAS_LABEL[l.tipo_tarea]||l.tipo_tarea}: ${l.horas_mes} h/mes × ${l.precio_hora} €/h = ${l.importe} €`).join('\n')}>{Math.round(c.facturacion_mensual).toLocaleString('es-ES')}€</span>:<span className="cell-muted">—</span>}</td>
              <td data-label="Acciones"><div style={{display:'flex',gap:6}}>
                <button className="btn-edit" onClick={()=>editar(c)}>Editar</button>
                <button className="btn-edit" onClick={()=>nuevaSucursal(c)}>+ Sucursal</button>
                <button className="btn-delete" onClick={()=>eliminar(c._id)}>Eliminar</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>);
}
