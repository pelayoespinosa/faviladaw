import { useEffect, useState } from 'react';
import api from '../api/axios';

const fmt = (iso) => new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });

export default function MisDocumentos() {
  const [docs,       setDocs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [confirmando,setConfirmando]= useState(false);
  const [pdfCargando, setPdfCargando] = useState(false);
  const [msg,        setMsg]        = useState('');
  const [heRecibido, setHeRecibido] = useState(false);
  const [estoyConforme, setEstoyConforme] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/documentos');
      setDocs(Array.isArray(r.data) ? r.data : []);
    } catch {
      setDocs([]);
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const pendientes = docs.filter(d => d.requiere_confirmacion && d.mi_confirmacion && !(d.mi_confirmacion.recibido && d.mi_confirmacion.conforme));
  const confirmados = docs.filter(d => d.requiere_confirmacion && d.mi_confirmacion?.recibido && d.mi_confirmacion?.conforme);
  const sinConfirmacion = docs.filter(d => !d.requiere_confirmacion);

  const abrirDoc = async (doc) => {
    setHeRecibido(false);
    setEstoyConforme(false);
    setMsg('');
    setPdfCargando(true);
    setModal({ doc, pdfUrl: null });
    const r = await api.get(`/documentos/${doc._id}/archivo`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    setModal({ doc, pdfUrl: url });
    setPdfCargando(false);
  };

  const cerrarModal = () => {
    if (modal?.pdfUrl) URL.revokeObjectURL(modal.pdfUrl);
    setModal(null);
  };

  const confirmar = async () => {
    if (!heRecibido || !estoyConforme) { setMsg('Marca las dos casillas antes de confirmar.'); return; }
    setConfirmando(true);
    setMsg('');
    try {
      await api.post(`/documentos/${modal.doc._id}/confirmar`, { recibido: true, conforme: true });
      cerrarModal();
      cargar();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Error al confirmar');
    } finally {
      setConfirmando(false);
    }
  };

  const DocCard = ({ doc }) => {
    const f = doc.mi_confirmacion;
    const pendiente = doc.requiere_confirmacion && f && !(f.recibido && f.conforme);
    return (
      <div className="doc-card">
        <div className="doc-card-icon">📄</div>
        <div className="doc-card-body">
          <div className="doc-card-title">{doc.titulo}</div>
          <div className="doc-card-meta">
            <span className="badge-carpeta">{doc.carpeta}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{fmt(doc.createdAt)}</span>
          </div>
          {doc.descripcion && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{doc.descripcion}</div>}
        </div>
        <div className="doc-card-actions">
          {doc.requiere_confirmacion && (
            <span className={`badge-firma-estado ${pendiente ? 'pendiente' : 'firmado'}`}>
              {pendiente ? '⏳ Pendiente' : `✓ Confirmado ${fmt(f.fecha_conforme)}`}
            </span>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn-edit" onClick={() => abrirDoc(doc)}>
              {pendiente ? 'Ver y confirmar' : 'Ver documento'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ titulo, items, color }) => {
    if (!items.length) return null;
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--f-display)', fontWeight: 600, fontSize: 13, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{titulo}</div>
          <span style={{ padding: '1px 8px', borderRadius: 20, background: color + '22', color, border: `1px solid ${color}44`, fontSize: 11, fontWeight: 600 }}>{items.length}</span>
        </div>
        <div className="docs-list">{items.map(d => <DocCard key={d._id} doc={d} />)}</div>
      </div>
    );
  };

  return (
    <>
      {pendientes.length > 0 && (
        <div className="pending-alert">
          <span>⚠️</span>
          <span>Tienes <strong>{pendientes.length}</strong> {pendientes.length === 1 ? 'documento pendiente' : 'documentos pendientes'} de confirmar</span>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
          <div className="spinner" /><div style={{ marginTop: 8 }}>Cargando documentos…</div>
        </div>
      )}

      {!loading && docs.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon">📂</div><div className="empty-state-text">No tienes documentos asignados</div></div>
      )}

      {!loading && (
        <>
          <Section titulo="Pendientes de confirmar" items={pendientes}      color="var(--coral)" />
          <Section titulo="Confirmados"             items={confirmados}    color="var(--accent)" />
          <Section titulo="Sin confirmación requerida" items={sinConfirmacion} color="var(--text-2)" />
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="modal-doc">
            <div className="modal-doc-header">
              <div>
                <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16 }}>{modal.doc.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{modal.doc.carpeta} · {fmt(modal.doc.createdAt)}</div>
              </div>
              <button className="modal-close" onClick={cerrarModal}>✕</button>
            </div>

            <div className="modal-pdf-wrap">
              {pdfCargando
                ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}><div className="spinner"/></div>
                : <iframe src={modal.pdfUrl} title="PDF" />
              }
            </div>

            {modal.doc.requiere_confirmacion && modal.doc.mi_confirmacion && !(modal.doc.mi_confirmacion.recibido && modal.doc.mi_confirmacion.conforme) && (
              <div className="modal-firma-section">
                <label className="empleado-check-item" style={{ padding: '8px 0', borderBottom: 'none' }}>
                  <input type="checkbox" checked={heRecibido} onChange={e => setHeRecibido(e.target.checked)} />
                  <span>He recibido la notificación</span>
                </label>
                <label className="empleado-check-item" style={{ padding: '8px 0', borderBottom: 'none' }}>
                  <input type="checkbox" checked={estoyConforme} onChange={e => setEstoyConforme(e.target.checked)} />
                  <span>Estoy conforme con lo expuesto en el documento</span>
                </label>
                {msg && <div className="error-msg" style={{ marginTop: 8 }}>{msg}</div>}
                <button
                  className="btn-primary"
                  style={{ marginTop: 12, padding: '11px', fontSize: 14 }}
                  onClick={confirmar}
                  disabled={confirmando || !heRecibido || !estoyConforme}
                >
                  {confirmando ? 'Guardando…' : 'Confirmar lectura'}
                </button>
              </div>
            )}

            {modal.doc.mi_confirmacion?.recibido && modal.doc.mi_confirmacion?.conforme && (
              <div className="modal-firma-section" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 15 }}>
                  ✓ Recibido y conforme el {fmt(modal.doc.mi_confirmacion.fecha_conforme)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
