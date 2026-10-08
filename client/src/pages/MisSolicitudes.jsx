import { useEffect, useState } from 'react';
import api from '../api/axios';
import SearchSelect from '../components/SearchSelect';
import { useAuth } from '../context/AuthContext';

const fmt = (iso) => new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });

const ESTADO_COLOR = {
  pendiente: 'var(--amber)',
  asignado:  'var(--accent)',
  entregado: 'var(--text-2)',
  cancelado: 'var(--coral)',
};
const ESTADO_LABEL = { pendiente: 'Pendiente', asignado: 'Asignado', entregado: 'Entregado', cancelado: 'Cancelado' };

const OTRO = '__otro__';
const emptyItem = { producto_id: '', nombre_otro: '', cantidad: 1 };
const emptyForm = { cliente: '', productos: [{ ...emptyItem }], observaciones: '' };

function EstadoBadge({ estado }) {
  const color = ESTADO_COLOR[estado] || 'var(--text-2)';
  return (
    <span style={{ padding: '2px 9px', borderRadius: 20, background: color + '22', color, border: `1px solid ${color}44`, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {ESTADO_LABEL[estado] || estado}
    </span>
  );
}

function SolicitudCard({ s, children }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{s.cliente?.alias || s.cliente?.nombre || '—'}</div>
          {s.cliente?.sucursal && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1 }}>📍 {s.cliente.sucursal}</div>}
        </div>
        <EstadoBadge estado={s.estado} />
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {s.productos.map((p, i) => (
          <span key={i} className="badge-hours">
            {p.cantidad} × {p.producto}{p.precio != null && ` — ${(p.precio * p.cantidad).toFixed(2)}€`}
          </span>
        ))}
      </div>
      {s.productos.some(p => p.precio != null) && (
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
          Total: <strong style={{ color: 'var(--text)' }}>{s.productos.reduce((acc, p) => acc + (p.precio != null ? p.precio * p.cantidad : 0), 0).toFixed(2)}€</strong>
          {s.productos.some(p => p.es_otro) && <span style={{ color: 'var(--text-3)' }}> (sin contar los productos "otros")</span>}
        </div>
      )}
      {s.observaciones && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{s.observaciones}</div>}
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
        {fmt(s.createdAt)}
        {s.asignado_a && <> · Reparto: <strong>{s.asignado_a.nombre_display}</strong></>}
      </div>
      {children}
    </div>
  );
}

export default function MisSolicitudes() {
  const { empleadoId } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [clientes,    setClientes]    = useState([]);
  const [productos,   setProductos]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [form,        setForm]        = useState(emptyForm);
  const [enviando,    setEnviando]    = useState(false);
  const [msg,         setMsg]         = useState('');

  const productosConOtro = [...productos, { _id: OTRO, nombre: 'OTROS…' }];

  const cargar = () => api.get('/solicitudes', { params: { propio: 1 } }).then(r => setSolicitudes(r.data));

  useEffect(() => {
    Promise.all([
      cargar(),
      api.get('/clientes').then(r => setClientes(r.data)),
      api.get('/productos').then(r => setProductos(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const setItem = (i, campo, valor) => setForm(f => ({
    ...f, productos: f.productos.map((p, idx) => idx === i ? { ...p, [campo]: valor } : p),
  }));
  const addItem    = () => setForm(f => ({ ...f, productos: [...f.productos, { ...emptyItem }] }));
  const removeItem = i  => setForm(f => ({ ...f, productos: f.productos.filter((_, idx) => idx !== i) }));

  const enviar = async () => {
    setMsg('');
    if (!form.cliente) { setMsg('Selecciona un cliente.'); return; }
    const items = form.productos
      .map(p => {
        const cantidad = parseFloat(p.cantidad) || 0;
        if (cantidad <= 0) return null;
        if (p.producto_id === OTRO) return p.nombre_otro.trim() ? { nombre: p.nombre_otro.trim(), cantidad } : null;
        if (p.producto_id) return { producto_id: p.producto_id, cantidad };
        return null;
      })
      .filter(Boolean);
    if (!items.length) { setMsg('Añade al menos un producto (con su nombre si es "Otros") y cantidad.'); return; }

    setEnviando(true);
    try {
      await api.post('/solicitudes', { cliente: form.cliente, productos: items, observaciones: form.observaciones || undefined });
      setForm(emptyForm);
      cargar();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setEnviando(false);
    }
  };

  const marcarEntregado = async (id) => {
    await api.put(`/solicitudes/${id}/entregar`);
    cargar();
  };

  const cancelar = async (id) => {
    if (!window.confirm('¿Cancelar esta solicitud?')) return;
    await api.put(`/solicitudes/${id}/cancelar`);
    cargar();
  };

  const pedidas   = solicitudes.filter(s => String(s.solicitante?._id) === String(empleadoId));
  const asignadas = solicitudes.filter(s => s.asignado_a && String(s.asignado_a._id) === String(empleadoId) && s.estado === 'asignado');

  return (
    <>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Nueva solicitud de productos</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <SearchSelect label="Cliente / sitio de entrega" items={clientes} value={form.cliente}
            onChange={v => setForm(f => ({ ...f, cliente: v }))} placeholder="Buscar cliente o sucursal…" required />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="filter-label" style={{ marginBottom: 8 }}>Productos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.productos.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <SearchSelect items={productosConOtro} value={p.producto_id}
                  onChange={v => setItem(i, 'producto_id', v)} placeholder="Buscar producto…" />
                {p.producto_id === OTRO && (
                  <input className="form-input" style={{ flex: 2, minWidth: 160 }} value={p.nombre_otro}
                    onChange={e => setItem(i, 'nombre_otro', e.target.value)} placeholder="¿Qué producto?" autoFocus />
                )}
                <input type="number" min="1" step="1" className="form-input" style={{ maxWidth: 100 }} value={p.cantidad}
                  onChange={e => setItem(i, 'cantidad', e.target.value)} placeholder="Cant." />
                {form.productos.length > 1 && (
                  <button type="button" className="btn-delete" onClick={() => removeItem(i)}>Quitar</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-edit" style={{ alignSelf: 'flex-start' }} onClick={addItem}>+ Añadir producto</button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Observaciones</div>
          <input className="form-input" style={{ width: '100%' }} value={form.observaciones}
            onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Notas adicionales…" />
        </div>

        {msg && <div className="error-msg">{msg}</div>}
        <button className="btn-save" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>
      </div>

      {asignadas.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--f-display)', fontWeight: 600, fontSize: 13, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Repartos asignados a mí
          </div>
          {asignadas.map(s => (
            <SolicitudCard key={s._id} s={s}>
              <button className="btn-save" style={{ marginTop: 10 }} onClick={() => marcarEntregado(s._id)}>Marcar como entregado</button>
            </SolicitudCard>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontFamily: 'var(--f-display)', fontWeight: 600, fontSize: 13, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Mis solicitudes
        </div>
        {loading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}><div className="spinner" /></div>}
        {!loading && pedidas.length === 0 && (
          <div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-text">No has hecho ninguna solicitud todavía</div></div>
        )}
        {!loading && pedidas.map(s => (
          <SolicitudCard key={s._id} s={s}>
            {s.estado === 'pendiente' && (
              <button className="btn-cancel" style={{ marginTop: 10 }} onClick={() => cancelar(s._id)}>Cancelar</button>
            )}
          </SolicitudCard>
        ))}
      </div>
    </>
  );
}
