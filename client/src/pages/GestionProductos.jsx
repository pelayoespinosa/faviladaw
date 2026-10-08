import { useEffect, useState } from 'react';
import api from '../api/axios';
import { normalizar } from '../utils/texto';

const empty = { nombre: '', precio: '' };

export default function GestionProductos() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [verRetirados, setVerRetirados] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargar = (incluirRetirados = verRetirados) =>
    api.get('/productos', { params: incluirRetirados ? { inactivos: '1' } : {} }).then(r => { setProductos(r.data); setLoading(false); });

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRetirados = () => { const v = !verRetirados; setVerRetirados(v); setLoading(true); cargar(v); };

  const guardar = async () => {
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');
    if (form.precio === '' || Number(form.precio) < 0) return setError('Indica un precio válido');
    try {
      const payload = { nombre: form.nombre.trim(), precio: Number(form.precio) };
      if (editId) await api.put(`/productos/${editId}`, payload);
      else await api.post('/productos', payload);
      setForm(empty); setEditId(null); setError(''); cargar();
    } catch (e) { setError(e.response?.data?.error || 'Error al guardar'); }
  };

  const editar = p => { setForm({ nombre: p.nombre, precio: String(p.precio) }); setEditId(p._id); window.scrollTo(0, 0); };
  const cancelar = () => { setForm(empty); setEditId(null); setError(''); };

  const darBaja = async p => {
    if (confirm(`¿Retirar "${p.nombre}" del catálogo?\n\nLos pedidos ya hechos con este producto no cambian; solo deja de estar disponible para pedidos nuevos.`)) {
      await api.delete(`/productos/${p._id}`); cargar();
    }
  };
  const reactivar = async p => { await api.post(`/productos/${p._id}/reactivar`); cargar(); };

  const pF = productos.filter(p => !busqueda || normalizar(p.nombre).includes(normalizar(busqueda)));

  return (<>
    <div className="panel">
      <div className="panel-title">{editId ? 'Editar producto' : 'Nuevo producto'}</div>
      <div className="form-row-fields" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="filter-group" style={{ flex: 2, minWidth: 200 }}>
          <span className="filter-label">Nombre <span style={{ color: 'var(--coral)' }}>*</span></span>
          <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Guantes de nitrilo (caja)" />
        </div>
        <div className="filter-group" style={{ minWidth: 140 }}>
          <span className="filter-label">Precio (€) <span style={{ color: 'var(--coral)' }}>*</span></span>
          <input type="number" step="0.01" min="0" className="form-input" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} placeholder="0.00" />
        </div>
      </div>
      {error && <div className="error-msg" style={{ marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" onClick={guardar}>{editId ? 'Guardar cambios' : 'Añadir producto'}</button>
        {editId && <button className="btn-cancel" onClick={cancelar}>Cancelar</button>}
      </div>
    </div>

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar</span>
        <input className="filter-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre del producto…" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', paddingBottom: 8 }}>
        <input type="checkbox" checked={verRetirados} onChange={toggleRetirados} /> Mostrar retirados
      </label>
      <div className="filters-count">{pF.length} productos</div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Nombre', 'Precio', 'Estado', 'Acciones'].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading && <tr className="loading-row"><td colSpan={4}><div className="spinner" /><div>Cargando…</div></td></tr>}
          {!loading && pF.length === 0 && <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-text">No hay productos</div></div></td></tr>}
          {!loading && pF.map(p => {
            const retirado = p.activo === false;
            return (
              <tr key={p._id} className="row-parent" style={{ cursor: 'default', opacity: retirado ? 0.55 : 1 }}>
                <td data-label="Nombre" style={{ fontWeight: 500, color: 'var(--text)' }}>{p.nombre}</td>
                <td data-label="Precio"><span className="badge-hours">{p.precio.toFixed(2)}€</span></td>
                <td data-label="Estado">
                  {retirado
                    ? <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: 'color-mix(in srgb,var(--coral) 12%,transparent)', color: 'var(--coral)' }}>RETIRADO</span>
                    : <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: 'var(--accent-lt)', color: 'var(--accent)' }}>DISPONIBLE</span>}
                </td>
                <td data-label="Acciones"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {retirado ? (
                    <button className="btn-save" onClick={() => reactivar(p)}>Reactivar</button>
                  ) : (<>
                    <button className="btn-edit" onClick={() => editar(p)}>Editar</button>
                    <button className="btn-delete" onClick={() => darBaja(p)}>Retirar</button>
                  </>)}
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </>);
}
