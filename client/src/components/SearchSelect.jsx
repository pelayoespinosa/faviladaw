import { useEffect, useState, useRef } from 'react';
import { normalizar } from '../utils/texto';

export default function SearchSelect({ label, items, value, onChange, placeholder, required, inputStyle }) {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState(null);
  const ref = useRef();

  useEffect(() => {
    if (!value) { setSelected(null); setQuery(''); return; }
    const found = items.find(i => i._id === value);
    if (found) { setSelected(found); setQuery(found.alias || found.nombre_display || found.nombre); }
  }, [value, items]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtrados = items.filter(i => {
    const q = normalizar(query);
    return normalizar(i.alias).includes(q)
      || normalizar(i.nombre_display||i.nombre).includes(q)
      || normalizar(i.nif).includes(q)
      || normalizar(i.sucursal).includes(q)
      || normalizar(i.zona).includes(q)
      || normalizar(i.direccion_facturacion).includes(q)
      || normalizar(i.direccion_real).includes(q)
      || normalizar(i.dni).includes(q)
      || normalizar(i.matricula).includes(q);
  }).slice(0, 60);

  const seleccionar = item => {
    setSelected(item); setQuery(item.alias||item.nombre_display||item.nombre); setOpen(false); onChange(item._id);
  };
  const limpiar = () => { setSelected(null); setQuery(''); onChange(''); };

  return (
    <div className="filter-group search-select-group" style={{ position:'relative', flex:1, minWidth:220 }} ref={ref}>
      {label && <span className="filter-label">{label}{required&&<span style={{color:'var(--coral)',marginLeft:3}}>*</span>}</span>}
      <div style={{ position:'relative' }}>
        <input className="form-input" value={query}
          onChange={e=>{ setQuery(e.target.value); setOpen(true); if(!e.target.value) limpiar(); }}
          onFocus={()=>setOpen(true)} placeholder={placeholder}
          style={{ paddingRight:28, borderColor: required&&!value?'color-mix(in srgb,var(--coral) 40%,transparent)':undefined, ...inputStyle }}
        />
        {selected&&<button type="button" onClick={limpiar} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:16,lineHeight:1}}>×</button>}
      </div>
      {open&&filtrados.length>0&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:300,background:'var(--surface-2)',border:'1px solid var(--border-2)',borderRadius:8,maxHeight:260,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.5)',marginTop:2}}>
          {filtrados.map(item=>{
            const color = item.esFlota ? 'var(--blue)' : (selected?._id===item._id ? 'var(--accent)' : 'var(--text)');
            return (
              <div key={item._id} onClick={()=>seleccionar(item)}
                style={{padding:'9px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)',color,fontWeight:item.esFlota?600:400}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                {item.alias||item.nombre_display||item.nombre}
                {item.alias&&<span style={{color:'var(--text-3)',fontSize:11,marginLeft:6}}>({item.nombre})</span>}
                {item.sucursal&&<span style={{color:'var(--accent)',fontSize:11,marginLeft:6}}>· {item.sucursal}</span>}
                {item.zona&&!item.esFlota&&<span style={{color:'var(--text-3)',fontSize:11,marginLeft:6}}>{item.zona}</span>}
                {item.dni&&<span style={{color:'var(--text-3)',fontSize:11,marginLeft:6,fontFamily: 'var(--f-mono)'}}>{item.dni}</span>}
                {item.matricula&&<span style={{color:'var(--blue)',fontSize:11,marginLeft:6,fontFamily: 'var(--f-mono)',opacity:0.8}}>{item.matricula}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
