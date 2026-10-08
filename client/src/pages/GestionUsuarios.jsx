import { useEffect, useState } from 'react';
import api from '../api/axios';
import { ROLES_ACCESO_ITEMS, ROL_ACCESO_BADGE } from '../constants/roles';
import { normalizar } from '../utils/texto';
import ModalCredenciales from '../components/ModalCredenciales';
import SearchSelect from '../components/SearchSelect';

const ROL_DESCRIPCION = {
  empleado:  'Sus turnos, fichar, sus fichajes, su calendario, sus documentos y solicitudes.',
  encargado: 'Lo anterior + ver plantilla, fichajes de todos, documentos y solicitudes.',
  gestoria:  'Solo lectura: plantilla, fichajes y documentos (para la gestoría laboral).',
  admin:     'Acceso total: gestión de empleados, clientes, turnos, cuentas y configuración.',
};

function EstadoBadge({ u }) {
  if (u.activo === false)
    return <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: 'var(--coral-lt)', color: 'var(--coral)' }}>DESACTIVADA</span>;
  if (u.bloqueado)
    return <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: 'var(--amber-lt)', color: 'var(--amber)' }} title={`Bloqueada hasta ${new Date(u.bloqueado_hasta).toLocaleDateString('es-ES')} por intentos fallidos`}>BLOQUEADA</span>;
  return <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: 'var(--accent-lt)', color: 'var(--accent)' }}>ACTIVA</span>;
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [sinCuenta, setSinCuenta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [credenciales, setCredenciales] = useState(null);

  const [tipoAlta, setTipoAlta] = useState('empleado');
  const [empleadoSel, setEmpleadoSel] = useState('');
  const [username, setUsername] = useState('');
  const [rolNuevo, setRolNuevo] = useState('empleado');

  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [verDesactivadas, setVerDesactivadas] = useState(false);

  const cargar = () => Promise.all([
    api.get('/usuarios'),
    api.get('/usuarios/empleados-sin-cuenta'),
  ]).then(([uR, eR]) => { setUsuarios(uR.data); setSinCuenta(eR.data); setLoading(false); });

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const crear = async () => {
    setError('');
    if (tipoAlta === 'empleado' && !empleadoSel) return setError('Elige el empleado para la nueva cuenta');
    if (tipoAlta === 'independiente' && !username.trim()) return setError('Escribe el nombre de usuario');
    try {
      const body = tipoAlta === 'empleado'
        ? { empleado: empleadoSel, rol: rolNuevo }
        : { username: username.trim(), rol: rolNuevo };
      const { data } = await api.post('/usuarios', body);
      setCredenciales(data);
      setEmpleadoSel(''); setUsername('');
      cargar();
    } catch (e) { setError(e.response?.data?.error || 'Error al crear la cuenta'); }
  };

  const accion = async (u, body, confirmar) => {
    if (confirmar && !confirm(confirmar)) return;
    setError('');
    try {
      const { data } = await api.put(`/usuarios/${u._id}`, body);
      if (data.password_temporal) setCredenciales(data);
      cargar();
    } catch (e) { setError(e.response?.data?.error || 'Error al aplicar el cambio'); }
  };

  const uF = usuarios.filter(u => {
    if (!verDesactivadas && u.activo === false) return false;
    if (filtroRol && u.rol !== filtroRol) return false;
    if (busqueda) {
      const q = normalizar(busqueda);
      if (!normalizar(u.email).includes(q) && !normalizar(u.empleado?.nombre_display || '').includes(q)) return false;
    }
    return true;
  });

  return (<>
    <div className="panel">
      <div className="panel-title">Nueva cuenta de acceso</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="pill-toggle" onClick={() => setTipoAlta('empleado')}
          style={tipoAlta === 'empleado' ? { background: 'var(--accent-lt)', borderColor: 'var(--accent)', color: 'var(--accent)' } : { background: 'transparent', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}>
          Para un empleado
        </button>
        <button className="pill-toggle" onClick={() => setTipoAlta('independiente')}
          style={tipoAlta === 'independiente' ? { background: 'var(--accent-lt)', borderColor: 'var(--accent)', color: 'var(--accent)' } : { background: 'transparent', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}>
          Independiente (gestoría, externos…)
        </button>
      </div>
      <div className="form-row-fields" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {tipoAlta === 'empleado' ? (
          <SearchSelect label="Empleado sin cuenta" items={sinCuenta} value={empleadoSel}
            onChange={setEmpleadoSel} placeholder="Buscar empleado…" />
        ) : (
          <div className="filter-group" style={{ flex: 2, minWidth: 220 }}>
            <span className="filter-label">Nombre de usuario</span>
            <input className="form-input" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="p. ej. gestorialopez" autoCapitalize="none" autoCorrect="off" />
          </div>
        )}
        <SearchSelect label="Rol de acceso" items={ROLES_ACCESO_ITEMS} value={rolNuevo}
          onChange={setRolNuevo} placeholder="Buscar rol…" />
        <button className="btn-save" onClick={crear} style={{ height: 42 }}>Crear cuenta</button>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px' }}>
        <strong style={{ color: ROL_ACCESO_BADGE[rolNuevo]?.color }}>{ROL_ACCESO_BADGE[rolNuevo]?.label}:</strong> {ROL_DESCRIPCION[rolNuevo]}
        {tipoAlta === 'empleado' && <span style={{ display: 'block', marginTop: 4, color: 'var(--text-3)' }}>El usuario se genera con el patrón habitual (nombre + iniciales de apellidos) y la contraseña temporal se muestra al crear.</span>}
      </div>
      {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}
    </div>

    <div className="filters-bar">
      <div className="filter-group">
        <span className="filter-label">Buscar</span>
        <input className="filter-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Usuario o empleado…" />
      </div>
      <div className="filter-group">
        <span className="filter-label">Rol</span>
        <select className="filter-select" value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
          <option value="">Todos</option>
          {ROLES_ACCESO_ITEMS.map(r => <option key={r._id} value={r._id}>{r.nombre}</option>)}
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', paddingBottom: 8 }}>
        <input type="checkbox" checked={verDesactivadas} onChange={e => setVerDesactivadas(e.target.checked)} /> Mostrar desactivadas
      </label>
      <div className="filters-count">{uF.length} cuentas</div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{['Usuario', 'Vinculada a', 'Rol de acceso', 'Estado', 'Creada', 'Acciones'].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading && <tr className="loading-row"><td colSpan={6}><div className="spinner" /><div>Cargando…</div></td></tr>}
          {!loading && uF.length === 0 && <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">👤</div><div className="empty-state-text">No se encontraron cuentas</div></div></td></tr>}
          {!loading && uF.map(u => {
            const desactivada = u.activo === false;
            return (
              <tr key={u._id} className="row-parent" style={{ cursor: 'default', opacity: desactivada ? 0.55 : 1 }}>
                <td data-label="Usuario">
                  <span className="cell-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{u.email}</span>
                  {u.debe_cambiar_password && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 2 }}>Contraseña temporal sin cambiar</div>}
                </td>
                <td data-label="Vinculada a">
                  {u.empleado
                    ? <span style={{ fontSize: 13 }}>{u.empleado.nombre_display}{u.empleado.activo === false && <span style={{ color: 'var(--coral)', fontSize: 10.5, marginLeft: 6 }}>(de baja)</span>}</span>
                    : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>— cuenta independiente —</span>}
                </td>
                <td data-label="Rol de acceso">
                  <select className="form-select" style={{ fontSize: 12, padding: '4px 8px', width: 'fit-content' }} value={u.rol}
                    onChange={ev => accion(u, { accion: 'rol', rol: ev.target.value })} disabled={desactivada}>
                    {ROLES_ACCESO_ITEMS.map(r => <option key={r._id} value={r._id}>{r.nombre}</option>)}
                  </select>
                </td>
                <td data-label="Estado"><EstadoBadge u={u} /></td>
                <td data-label="Creada" className="cell-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-ES') : '—'}</td>
                <td data-label="Acciones"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {desactivada ? (
                    <button className="btn-save" onClick={() => accion(u, { accion: 'activar' })}>Reactivar</button>
                  ) : (<>
                    <button className="btn-edit" onClick={() => accion(u, { accion: 'reset_password' }, `¿Generar una nueva contraseña temporal para ${u.email}? La actual dejará de funcionar.`)}>🔑 Reset</button>
                    {u.bloqueado && <button className="btn-edit" onClick={() => accion(u, { accion: 'desbloquear' })}>Desbloquear</button>}
                    <button className="btn-delete" onClick={() => accion(u, { accion: 'desactivar' }, `¿Desactivar la cuenta ${u.email}? No podrá iniciar sesión hasta que la reactives (no se borra nada).`)}>Desactivar</button>
                  </>)}
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {credenciales && <ModalCredenciales cred={credenciales} onClose={() => setCredenciales(null)} />}
  </>);
}
