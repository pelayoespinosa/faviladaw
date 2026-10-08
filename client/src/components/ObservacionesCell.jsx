import { useState } from 'react';

export default function ObservacionesCell({ texto }) {
  const [open, setOpen] = useState(false);
  if (!texto) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  return (<>
    <span className="obs-cell" onClick={e => { e.stopPropagation(); setOpen(true); }} title="Ver observación completa">
      {texto}
    </span>
    {open && (
      <div className="modal-overlay" onClick={e => { e.stopPropagation(); setOpen(false); }}>
        <div className="modal-obs" onClick={e => e.stopPropagation()}>
          <div className="modal-obs-header">
            <span>Observación</span>
            <button className="modal-close" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="modal-obs-body">{texto}</div>
        </div>
      </div>
    )}
  </>);
}
