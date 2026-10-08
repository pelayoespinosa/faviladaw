import { useState } from 'react';
import { ROL_ACCESO_LABEL } from '../constants/roles';

export default function ModalCredenciales({ cred, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Usuario: ${cred.usuario}\nContraseña temporal: ${cred.password_temporal}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch {  } };
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-upload" style={{ maxWidth: 420 }}>
        <div className="modal-doc-header">
          <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16 }}>Cuenta de acceso creada</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
            Apunta o comparte estas credenciales ahora: la contraseña temporal <strong>no se volverá a mostrar</strong>.
            Al entrar por primera vez se le pedirá cambiarla.
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Usuario</div>
            <div className="cell-mono" style={{ fontSize: 15, fontWeight: 600 }}>{cred.usuario}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Contraseña temporal</div>
            <div className="cell-mono" style={{ fontSize: 15, fontWeight: 600 }}>{cred.password_temporal}</div>
            {cred.rol && <><div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Rol de acceso</div>
            <div style={{ fontSize: 13 }}>{ROL_ACCESO_LABEL[cred.rol] || cred.rol}</div></>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-save" style={{ flex: 1 }} onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar credenciales'}</button>
            <button className="btn-cancel" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
