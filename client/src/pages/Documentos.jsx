import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { normalizar } from '../utils/texto';
import SearchSelect from '../components/SearchSelect';

const ROLES_EMPLEADO = ['director','administrativo','encargado','conductor','peon','limpiador'];
const ROLES_EMPLEADO_ITEMS = ROLES_EMPLEADO.map(r => ({ _id: r, nombre: r.charAt(0).toUpperCase() + r.slice(1) }));
const TIPO_DESTINATARIO_ITEMS = [
  { _id: 'todos', nombre: 'Todos los empleados' },
  { _id: 'grupo', nombre: 'Grupo (por categoría)' },
  { _id: 'especifico', nombre: 'Empleados específicos' },
];
const fmt = (iso) => new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });

const TIPO_LABEL = { todos: 'Todos', grupo: 'Grupo', especifico: 'Específico' };

export default function Documentos() {
  const { esAdmin, esEncargado } = useAuth();
  const puedeGestionar = esAdmin || esEncargado;
  const [docs,       setDocs]       = useState([]);
  const [carpetas,   setCarpetas]   = useState([]);
  const [empleados,  setEmpleados]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [carpetaSel, setCarpetaSel] = useState('todas');
  const [busqueda,   setBusqueda]   = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showNuevaCarpeta, setShowNuevaCarpeta] = useState(false);
  const [nuevaCarpeta, setNuevaCarpeta] = useState('');
  const [carpetaMsg,  setCarpetaMsg]  = useState('');
  const [creandoCarpeta, setCreandoCarpeta] = useState(false);
  const [detalle,    setDetalle]    = useState(null);
  const [pdfModal,   setPdfModal]   = useState(null);
  const [pdfCargando,setPdfCargando]= useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState('');

  const [form, setForm] = useState({
    titulo: '', descripcion: '', carpeta: 'General',
    tipo_destinatario: 'todos', grupo: '', requiere_confirmacion: true,
  });
  const [selectedEmpleados, setSelectedEmpleados] = useState([]);
  const [fileObj,           setFileObj]           = useState(null);
  const [busqEmpleado,      setBusqEmpleado]      = useState('');
  const [busqConfirmacion,  setBusqConfirmacion]  = useState('');
  const [filtroConfirmacion,setFiltroConfirmacion]= useState('todos');

  const cargar = async () => {
    setLoading(true);
    try {
      const [dr, cr] = await Promise.all([
        api.get('/documentos'),
        api.get('/documentos/carpetas'),
      ]);
      setDocs(Array.isArray(dr.data) ? dr.data : []);
      setCarpetas(Array.isArray(cr.data) ? cr.data : []);
    } catch {
      setDocs([]);
      setCarpetas([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    api.get('/empleados').then(r => setEmpleados(r.data));
  }, []);

  const docsFiltrados = docs.filter(d => {
    const enCarpeta = carpetaSel === 'todas' || d.carpeta === carpetaSel;
    const enBusqueda = !busqueda || normalizar(d.titulo).includes(normalizar(busqueda));
    return enCarpeta && enBusqueda;
  });

  const fmtDestinatario = (doc) => {
    if (doc.tipo_destinatario === 'todos') return 'Todos los empleados';
    if (doc.tipo_destinatario === 'grupo') return `Grupo: ${doc.grupo}`;
    return `${doc.confirmaciones.length} empleado(s)`;
  };

  const progreso = (doc) => {
    if (!doc.requiere_confirmacion) return null;
    const total       = doc.confirmaciones.length;
    const confirmados = doc.confirmaciones.filter(f => f.recibido && f.conforme).length;
    return { confirmados, total, pct: total ? Math.round(confirmados / total * 100) : 0 };
  };

  const subir = async (e) => {
    e.preventDefault();
    if (!fileObj) { setUploadMsg('Selecciona un archivo PDF.'); return; }
    if (!form.titulo.trim()) { setUploadMsg('El título es obligatorio.'); return; }

    const fd = new FormData();
    fd.append('archivo',    fileObj);
    fd.append('titulo',     form.titulo);
    fd.append('descripcion',form.descripcion);
    fd.append('carpeta',    form.carpeta || 'General');
    fd.append('tipo_destinatario', form.tipo_destinatario);
    fd.append('grupo',      form.grupo);
    fd.append('requiere_confirmacion', String(form.requiere_confirmacion));
    if (form.tipo_destinatario === 'especifico') {
      fd.append('empleados', JSON.stringify(selectedEmpleados));
    }

    setUploading(true);
    setUploadMsg('');
    try {
      await api.post('/documentos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      setForm({ titulo: '', descripcion: '', carpeta: 'General', tipo_destinatario: 'todos', grupo: '', requiere_confirmacion: true });
      setFileObj(null);
      setSelectedEmpleados([]);
      setBusqEmpleado('');
      cargar();
    } catch (err) {
      setUploadMsg(err.response?.data?.error || 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    await api.delete(`/documentos/${id}`);
    cargar();
  };

  const abrirPdf = async (doc) => {
    setPdfCargando(true);
    setPdfModal({ doc, pdfUrl: null });
    const r = await api.get(`/documentos/${doc._id}/archivo`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    setPdfModal({ doc, pdfUrl: url });
    setPdfCargando(false);
  };

  const cerrarPdf = () => {
    if (pdfModal?.pdfUrl) URL.revokeObjectURL(pdfModal.pdfUrl);
    setPdfModal(null);
  };

  const toggleEmpleado = (id) => {
    setSelectedEmpleados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const crearCarpeta = async (e) => {
    e.preventDefault();
    if (!nuevaCarpeta.trim()) return;
    setCreandoCarpeta(true);
    setCarpetaMsg('');
    try {
      await api.post('/documentos/carpetas', { nombre: nuevaCarpeta.trim() });
      const nombreCreado = nuevaCarpeta.trim();
      setShowNuevaCarpeta(false);
      setNuevaCarpeta('');
      await cargar();
      setCarpetaSel(nombreCreado);
    } catch (err) {
      setCarpetaMsg(err.response?.data?.error || 'Error al crear la carpeta');
    } finally {
      setCreandoCarpeta(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{docs.length} documento(s) en total</div>
        {puedeGestionar && (
          <button className="btn-save" onClick={() => { setShowUpload(true); setUploadMsg(''); }}>
            + Subir documento
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="nav-label">Carpetas</div>
          {puedeGestionar && <button className="btn-edit" onClick={() => { setShowNuevaCarpeta(true); setCarpetaMsg(''); }}>+ Nueva carpeta</button>}
        </div>
        <div className="carpeta-grid">
          <button
            onClick={() => setCarpetaSel('todas')}
            className={`carpeta-card${carpetaSel === 'todas' ? ' active' : ''}`}
          >
            <span className="carpeta-card-icon">🗂️</span>
            <span className="carpeta-card-label">Todas</span>
            <span className="badge-count">{docs.length}</span>
          </button>
          {carpetas.map(c => (
            <button key={c}
              onClick={() => setCarpetaSel(c)}
              className={`carpeta-card${carpetaSel === c ? ' active' : ''}`}
            >
              <span className="carpeta-card-icon">📁</span>
              <span className="carpeta-card-label">{c}</span>
              <span className="badge-count">{docs.filter(d => d.carpeta === c).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
          <div className="filters-bar" style={{ marginBottom: 16 }}>
            <div className="filter-group" style={{ flex: 1 }}>
              <input
                className="filter-input"
                placeholder="Buscar documento…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}><div className="spinner"/></div>}
          {!loading && docsFiltrados.length === 0 && (
            <div className="empty-state"><div className="empty-state-icon">📂</div><div className="empty-state-text">Sin documentos en esta carpeta</div></div>
          )}
          {!loading && docsFiltrados.map(doc => {
            const p = progreso(doc);
            return (
              <div key={doc._id} className="doc-admin-row">
                <div className="doc-admin-icon">📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.titulo}</div>
                  {doc.descripcion && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{doc.descripcion}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="badge-carpeta">{doc.carpeta}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{TIPO_LABEL[doc.tipo_destinatario]} · {fmt(doc.createdAt)}</span>
                    {doc.tipo_destinatario === 'grupo' && <span className="badge-carpeta" style={{ background: 'var(--teal-lt)', color: 'var(--teal)', borderColor: 'rgba(78,205,196,0.2)' }}>{doc.grupo}</span>}
                  </div>
                  {p && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="firma-bar-wrap">
                        <div className="firma-bar-fill" style={{ width: `${p.pct}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: p.pct === 100 ? 'var(--accent)' : 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {p.confirmados}/{p.total} confirmados
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  <button className="btn-edit" onClick={() => abrirPdf(doc)}>Ver PDF</button>
                  <button className="btn-edit" style={{ background: 'var(--teal-lt)', color: 'var(--teal)' }} onClick={() => setDetalle(doc)}>Confirmaciones</button>
                  {esAdmin && <button className="btn-delete" onClick={() => eliminar(doc._id)}>Eliminar</button>}
                </div>
              </div>
            );
          })}
        </div>

      {showNuevaCarpeta && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowNuevaCarpeta(false); }}>
          <div className="modal-upload" style={{ maxWidth: 360 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16 }}>Nueva carpeta</div>
              <button className="modal-close" onClick={() => setShowNuevaCarpeta(false)}>✕</button>
            </div>
            <form onSubmit={crearCarpeta} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nombre de la carpeta</label>
                <input className="form-input" autoFocus value={nuevaCarpeta} onChange={e => setNuevaCarpeta(e.target.value)} placeholder="Ej. Nóminas" />
              </div>
              {carpetaMsg && <div className="error-msg">{carpetaMsg}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-cancel" onClick={() => setShowNuevaCarpeta(false)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-save" style={{ flex: 2 }} disabled={creandoCarpeta}>
                  {creandoCarpeta ? 'Creando…' : 'Crear carpeta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div className="modal-upload">
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16 }}>Subir documento</div>
              <button className="modal-close" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={subir} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Título *</label>
                <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Nombre del documento" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Descripción</label>
                <input className="form-input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción breve (opcional)" />
              </div>
              <div className="form-row" style={{ margin: 0 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Carpeta</label>
                  <input className="form-input" list="carpetas-list" value={form.carpeta} onChange={e => setForm(f => ({ ...f, carpeta: e.target.value }))} placeholder="General" />
                  <datalist id="carpetas-list">{carpetas.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <SearchSelect label="Destinatarios" items={TIPO_DESTINATARIO_ITEMS} value={form.tipo_destinatario}
                    onChange={v => setForm(f => ({ ...f, tipo_destinatario: v }))} placeholder="Buscar…" />
                </div>
              </div>

              {form.tipo_destinatario === 'grupo' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <SearchSelect label="Categoría del grupo" items={ROLES_EMPLEADO_ITEMS} value={form.grupo}
                    onChange={v => setForm(f => ({ ...f, grupo: v }))} placeholder="Buscar categoría…" />
                </div>
              )}

              {form.tipo_destinatario === 'especifico' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Seleccionar empleados
                    {selectedEmpleados.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>({selectedEmpleados.length} seleccionados)</span>}
                  </label>
                  <input
                    className="filter-input"
                    placeholder="Buscar empleado por nombre…"
                    value={busqEmpleado}
                    onChange={e => setBusqEmpleado(e.target.value)}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <div className="empleado-check-list">
                    {empleados
                      .filter(e => normalizar(e.nombre_display||e.nombre).includes(normalizar(busqEmpleado)))
                      .map(emp => (
                        <label key={emp._id} className="empleado-check-item">
                          <input type="checkbox" checked={selectedEmpleados.includes(emp._id)} onChange={() => toggleEmpleado(emp._id)} />
                          <span>{emp.nombre_display||emp.nombre}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{emp.rol}</span>
                        </label>
                      ))
                    }
                    {empleados.filter(e => normalizar(e.nombre_display||e.nombre).includes(normalizar(busqEmpleado))).length === 0 && (
                      <div style={{ padding: '12px 14px', color: 'var(--text-3)', fontSize: 12 }}>Sin resultados</div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Archivo PDF *</label>
                <label className="file-drop">
                  <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setFileObj(e.target.files[0] || null)} />
                  {fileObj
                    ? <span style={{ color: 'var(--accent)' }}>📄 {fileObj.name}</span>
                    : <span style={{ color: 'var(--text-3)' }}>Haz clic para seleccionar un PDF (máx. 50 MB)</span>
                  }
                </label>
              </div>

              <label className="empleado-check-item" style={{ padding: '10px 0', borderBottom: 'none' }}>
                <input type="checkbox" checked={form.requiere_confirmacion} onChange={e => setForm(f => ({ ...f, requiere_confirmacion: e.target.checked }))} />
                <span style={{ fontWeight: 500 }}>Requiere confirmación de los empleados</span>
              </label>

              {uploadMsg && <div className="error-msg">{uploadMsg}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-cancel" onClick={() => setShowUpload(false)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-save" style={{ flex: 2 }} disabled={uploading}>
                  {uploading ? 'Subiendo…' : 'Subir documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalle && (() => {
        const confirmacionesFiltradas = detalle.confirmaciones.filter(f => {
          const confirmado = f.recibido && f.conforme;
          const nombre = normalizar(f.empleado?.nombre_display||f.empleado?.nombre);
          const coincideNombre = !busqConfirmacion || nombre.includes(normalizar(busqConfirmacion));
          const coincideEstado = filtroConfirmacion === 'todos'
            || (filtroConfirmacion === 'confirmado' &&  confirmado)
            || (filtroConfirmacion === 'pendiente'   && !confirmado);
          return coincideNombre && coincideEstado;
        });
        const totalConfirmados = detalle.confirmaciones.filter(f => f.recibido && f.conforme).length;
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setDetalle(null); setBusqConfirmacion(''); setFiltroConfirmacion('todos'); } }}>
            <div className="modal-upload" style={{ maxWidth: 500 }}>
              <div className="modal-doc-header">
                <div>
                  <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>{detalle.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {detalle.requiere_confirmacion
                      ? <>{totalConfirmados}/{detalle.confirmaciones.length} confirmados</>
                      : 'Sin confirmación requerida'}
                  </div>
                </div>
                <button className="modal-close" onClick={() => { setDetalle(null); setBusqConfirmacion(''); setFiltroConfirmacion('todos'); }}>✕</button>
              </div>

              {detalle.requiere_confirmacion && (
                <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                  <input
                    className="filter-input"
                    placeholder="Buscar empleado…"
                    value={busqConfirmacion}
                    onChange={e => setBusqConfirmacion(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select
                    className="filter-select"
                    value={filtroConfirmacion}
                    onChange={e => setFiltroConfirmacion(e.target.value)}
                    style={{ width: 130 }}
                  >
                    <option value="todos">Todos</option>
                    <option value="confirmado">Confirmados</option>
                    <option value="pendiente">Pendientes</option>
                  </select>
                </div>
              )}

              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {!detalle.requiere_confirmacion && (
                  <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 32 }}>Este documento no requiere confirmación</div>
                )}
                {detalle.requiere_confirmacion && confirmacionesFiltradas.length === 0 && (
                  <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 32 }}>Sin resultados</div>
                )}
                {detalle.requiere_confirmacion && confirmacionesFiltradas.map((f, i) => {
                  const confirmado = f.recibido && f.conforme;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: confirmado ? 'var(--accent-lt)' : 'var(--surface-2)', border: `1px solid ${confirmado ? 'color-mix(in srgb,var(--accent) 30%,transparent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        {confirmado ? '✓' : '·'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{f.empleado?.nombre_display || 'Empleado'}</div>
                        <div style={{ fontSize: 11, color: f.recibido ? 'var(--accent)' : 'var(--text-3)' }}>
                          {f.recibido ? `Recibido el ${fmt(f.fecha_recibido)}` : 'Recibido: pendiente'}
                        </div>
                        <div style={{ fontSize: 11, color: f.conforme ? 'var(--accent)' : 'var(--text-3)' }}>
                          {f.conforme ? `Conforme el ${fmt(f.fecha_conforme)}` : 'Conforme: pendiente'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {pdfModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) cerrarPdf(); }}>
          <div className="modal-doc">
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>{pdfModal.doc.titulo}</div>
              <button className="modal-close" onClick={cerrarPdf}>✕</button>
            </div>
            <div className="modal-pdf-wrap">
              {pdfCargando
                ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}><div className="spinner"/></div>
                : <iframe src={pdfModal.pdfUrl} title="PDF" />
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
}
