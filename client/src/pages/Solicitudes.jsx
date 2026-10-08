import { useEffect, useState } from 'react';
import api from '../api/axios';
import SearchSelect from '../components/SearchSelect';
import { useAuth } from '../context/AuthContext';
import { normalizar } from '../utils/texto';

const fmt = (iso) => new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });

const ESTADO_LABEL = { pendiente: 'Pendiente', asignado: 'Asignado', entregado: 'Entregado', cancelado: 'Cancelado' };

const ESTADO_CHIP = { pendiente: 'warn', asignado: 'info', entregado: 'ok', cancelado: '' };
function EstadoBadge({ estado }) {
  return <span className={`chip ${ESTADO_CHIP[estado] ?? ''}`}>{ESTADO_LABEL[estado] || estado}</span>;
}

function SolicitudCard({ s, compacta, esAdmin, onAsignar, onEntregar, onCancelar, onEliminar }) {
  const total = s.productos.reduce((acc, p) => acc + (p.precio != null ? p.precio * p.cantidad : 0), 0);
  return (
    <div className="doc-admin-row" style={compacta ? { flexDirection: 'column', gap: 8, marginBottom: 0, padding: 12 } : undefined}>
      {!compacta && <div className="doc-admin-icon">📦</div>}
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{s.cliente?.alias || s.cliente?.nombre || '—'}</div>
          {s.cliente?.sucursal && <span style={{ fontSize: 11.5, color: 'var(--accent-ink)' }}>📍 {s.cliente.sucursal}</span>}
          {!compacta && <EstadoBadge estado={s.estado} />}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
          Pedido por <strong>{s.solicitante?.nombre_display || '—'}</strong> · {fmt(s.createdAt)}
          {s.asignado_a && <> · Reparto: <strong>{s.asignado_a.nombre_display}</strong></>}
        </div>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {s.productos.map((p, i) => (
            <span key={i} className="badge-hours">
              {p.cantidad} × {p.producto}{p.precio != null ? ` — ${(p.precio * p.cantidad).toFixed(2)}€` : ' (otro)'}
            </span>
          ))}
        </div>
        {s.productos.some(p => p.precio != null) && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
            Total: <strong className="num" style={{ color: 'var(--text)' }}>{total.toFixed(2)}€</strong>
            {s.productos.some(p => p.es_otro) && <span style={{ color: 'var(--text-3)' }}> (sin contar los "otros")</span>}
          </div>
        )}
        {s.observaciones && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{s.observaciones}</div>}
      </div>
      <div style={compacta ? { display: 'flex', gap: 6, flexWrap: 'wrap' } : { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        {(s.estado === 'pendiente' || s.estado === 'asignado') && (
          <button className="btn-edit" onClick={() => onAsignar(s)}>{s.estado === 'asignado' ? 'Reasignar' : 'Asignar reparto'}</button>
        )}
        {s.estado === 'asignado' && (
          <button className="btn-save" onClick={() => onEntregar(s._id)}>Marcar entregado</button>
        )}
        {(s.estado === 'pendiente' || s.estado === 'asignado') && (
          <button className="btn-cancel" onClick={() => onCancelar(s._id)}>Cancelar</button>
        )}
        {esAdmin && <button className="btn-delete" onClick={() => onEliminar(s._id)}>Eliminar</button>}
      </div>
    </div>
  );
}

export default function Solicitudes() {
  const { esAdmin } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [empleados,   setEmpleados]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filtroEstado,setFiltroEstado]= useState('todos');
  const [busqueda,    setBusqueda]    = useState('');
  const [vista,       setVista]       = useState(() => { try { return localStorage.getItem('solicitudesVista') || 'lista'; } catch { return 'lista'; } });
  const cambiarVista = v => { setVista(v); try { localStorage.setItem('solicitudesVista', v); } catch {  } };
  const [asignarModal,setAsignarModal]= useState(null);
  const [empleadoSel, setEmpleadoSel] = useState('');
  const [asignando,   setAsignando]   = useState(false);
  const [asignarMsg,  setAsignarMsg]  = useState('');

  const cargar = () => api.get('/solicitudes').then(r => setSolicitudes(r.data));

  useEffect(() => {
    Promise.all([cargar(), api.get('/empleados').then(r => setEmpleados(r.data))])
      .finally(() => setLoading(false));
  }, []);

  const filtradas = solicitudes.filter(s => {
    if (vista === 'lista' && filtroEstado !== 'todos' && s.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = normalizar(busqueda);
      const enCliente     = normalizar(s.cliente?.alias || s.cliente?.nombre).includes(q);
      const enSolicitante = normalizar(s.solicitante?.nombre_display||s.solicitante?.nombre).includes(q);
      const enAsignado    = normalizar(s.asignado_a?.nombre_display||s.asignado_a?.nombre).includes(q);
      const enProducto    = s.productos.some(p => normalizar(p.producto).includes(q));
      if (!enCliente && !enSolicitante && !enAsignado && !enProducto) return false;
    }
    return true;
  });

  const abrirAsignar = (s) => { setAsignarModal(s); setEmpleadoSel(s.asignado_a?._id || ''); setAsignarMsg(''); };

  const confirmarAsignar = async () => {
    if (!empleadoSel) { setAsignarMsg('Selecciona un empleado.'); return; }
    setAsignando(true); setAsignarMsg('');
    try {
      await api.put(`/solicitudes/${asignarModal._id}/asignar`, { empleadoId: empleadoSel });
      setAsignarModal(null);
      cargar();
    } catch (e) {
      setAsignarMsg(e.response?.data?.error || 'Error al asignar');
    } finally {
      setAsignando(false);
    }
  };

  const marcarEntregado = async (id) => { await api.put(`/solicitudes/${id}/entregar`); cargar(); };
  const cancelar = async (id) => { if (window.confirm('¿Cancelar esta solicitud?')) { await api.put(`/solicitudes/${id}/cancelar`); cargar(); } };
  const eliminar = async (id) => { if (window.confirm('¿Eliminar definitivamente esta solicitud?')) { await api.delete(`/solicitudes/${id}`); cargar(); } };

  return (
    <>
      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="filter-group">
          <span className="filter-label">Estado</span>
          <select className="filter-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="asignado">Asignado</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div className="filter-group" style={{ flex: 1 }}>
          <span className="filter-label">Buscar</span>
          <input className="filter-input" style={{ width: '100%' }} value={busqueda}
            onChange={e => setBusqueda(e.target.value)} placeholder="Cliente, empleado o producto…" />
        </div>
        <div className="filter-group" style={{ minWidth: 0 }}>
          <span className="filter-label">Vista</span>
          <div className="seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={vista === 'lista'} onClick={() => cambiarVista('lista')}>Lista</button>
            <button type="button" aria-pressed={vista === 'tablero'} onClick={() => cambiarVista('tablero')}>Tablero</button>
          </div>
        </div>
        <div className="filters-count">{filtradas.length} solicitudes</div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}><div className="spinner" /></div>}
      {!loading && filtradas.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-text">No hay solicitudes</div></div>
      )}

      {!loading && vista === 'lista' && filtradas.map(sol => (
        <SolicitudCard key={sol._id} s={sol} esAdmin={esAdmin} onAsignar={abrirAsignar} onEntregar={marcarEntregado} onCancelar={cancelar} onEliminar={eliminar} />
      ))}

      {!loading && vista === 'tablero' && (
        <div className="kanban">
          {['pendiente', 'asignado', 'entregado', 'cancelado'].map(est => {
            const col = filtradas.filter(x => x.estado === est);
            return (
              <div className="col" key={est}>
                <h4><EstadoBadge estado={est} /><span className="n">{col.length}</span></h4>
                {col.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '4px 6px' }}>Ninguna</div>}
                {col.map(sol => (
                  <SolicitudCard key={sol._id} s={sol} compacta esAdmin={esAdmin} onAsignar={abrirAsignar} onEntregar={marcarEntregado} onCancelar={cancelar} onEliminar={eliminar} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {asignarModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAsignarModal(null); }}>
          <div className="modal-upload" style={{ maxWidth: 400 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>Asignar reparto</div>
              <button className="modal-close" onClick={() => setAsignarModal(null)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SearchSelect label="Empleado" items={empleados} value={empleadoSel}
                onChange={setEmpleadoSel} placeholder="Buscar empleado…" required />
              {asignarMsg && <div className="error-msg">{asignarMsg}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-cancel" style={{ flex: 1 }} onClick={() => setAsignarModal(null)}>Cancelar</button>
                <button className="btn-save" style={{ flex: 2 }} disabled={asignando} onClick={confirmarAsignar}>
                  {asignando ? 'Asignando…' : 'Asignar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
