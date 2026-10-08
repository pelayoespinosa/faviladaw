import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

const SECTIONS = {
  admin: [
    { title: 'Personal', items: [
      { to: '/empleados', label: 'Empleados', icon: 'users' },
      { to: '/gestion-empleados', label: 'Gestión empleados', icon: 'edit' },
      { to: '/gestion-usuarios', label: 'Gestión usuarios', icon: 'user' },
      { to: '/gestion-productos', label: 'Gestión productos', icon: 'tag' },
      { to: '/fichajes', label: 'Fichajes', icon: 'pin' },
      { to: '/turnos', label: 'Gestión turnos', icon: 'calendar' },
      { to: '/flota', label: 'Flota', icon: 'van' },
    ] },
    { title: 'Clientes y servicios', items: [
      { to: '/clientes', label: 'Clientes', icon: 'building' },
      { to: '/gestion-clientes', label: 'Gestión clientes', icon: 'edit' },
      { to: '/mapa', label: 'Mapa', icon: 'pin' },
    ] },
    { title: 'Documentación', items: [
      { to: '/documentos', label: 'Documentos', icon: 'folder' },
      { to: '/solicitudes', label: 'Solicitudes', icon: 'box' },
      { to: '/cuadro-laboral', label: 'Cuadro laboral', icon: 'filetext' },
    ] },
    { title: 'Cuenta', items: [
      { to: '/perfil', label: 'Perfil', icon: 'user' },
    ] },
  ],
  encargado: [
    { title: 'Mi turno', items: [
      { to: '/mis-fichajes', label: 'Mis fichajes', icon: 'list' },
      { to: '/mis-solicitudes', label: 'Mis solicitudes', icon: 'box' },
      { to: '/mis-documentos', label: 'Mis documentos', icon: 'folder' },
    ] },
    { title: 'Equipo', items: [
      { to: '/empleados', label: 'Empleados', icon: 'users' },
      { to: '/fichajes', label: 'Fichajes', icon: 'pin' },
      { to: '/documentos', label: 'Documentos', icon: 'folder' },
      { to: '/solicitudes', label: 'Solicitudes', icon: 'box' },
    ] },
    { title: 'Cuenta', items: [
      { to: '/perfil', label: 'Perfil', icon: 'user' },
    ] },
  ],
  empleado: [
    { title: 'Mi turno', items: [
      { to: '/mis-turnos', label: 'Mis turnos', icon: 'calendar' },
      { to: '/mis-fichajes', label: 'Mis fichajes', icon: 'list' },
    ] },
    { title: 'Mis gestiones', items: [
      { to: '/mis-solicitudes', label: 'Mis solicitudes', icon: 'box' },
      { to: '/mis-documentos', label: 'Mis documentos', icon: 'folder' },
    ] },
    { title: 'Cuenta', items: [
      { to: '/perfil', label: 'Perfil', icon: 'user' },
    ] },
  ],
  gestoria: [
    { title: 'Consulta', items: [
      { to: '/empleados', label: 'Empleados', icon: 'users' },
      { to: '/documentos', label: 'Documentos', icon: 'folder' },
      { to: '/fichajes', label: 'Fichajes', icon: 'pin' },
      { to: '/cuadro-laboral', label: 'Cuadro laboral', icon: 'filetext' },
    ] },
    { title: 'Cuenta', items: [
      { to: '/perfil', label: 'Perfil', icon: 'user' },
    ] },
  ],
};

const SALUDO_ROL = { admin: 'Administrador', encargado: 'Encargado/a', empleado: 'Empleado', gestoria: 'Gestoría' };

export default function Inicio() {
  const { rol, esEmpleado, esEncargado } = useAuth();
  const sections = SECTIONS[rol] || SECTIONS.empleado;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 22 }}>¡Bienvenido/a!</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{SALUDO_ROL[rol] || ''} · elige a dónde quieres ir</div>
      </div>

      {(esEmpleado || esEncargado) && (
        <Link to="/fichar" style={{
          display: 'flex', alignItems: 'center', gap: 18,
          background: 'linear-gradient(135deg, var(--accent-lt), var(--surface))',
          border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-lg)',
          padding: '22px 26px', marginBottom: 24, textDecoration: 'none', color: 'var(--text)',
          boxShadow: '0 0 0 4px var(--accent-glow)', transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px var(--accent-glow)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 0 4px var(--accent-glow)'; }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: 'var(--accent)', color: 'var(--on-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><Icon name="clock" size={30} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 19 }}>Fichar</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>Registra tu entrada o salida ahora</div>
          </div>
          <div style={{ color: 'var(--accent)' }}><Icon name="arrow" size={22} /></div>
        </Link>
      )}

      {sections.map(section => (
        <div key={section.title} style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 4, height: 16, borderRadius: 2, background: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--f-display)', fontSize: 14, fontWeight: 600 }}>{section.title}</span>
            <span className="badge-count">{section.items.length}</span>
          </div>
          <div className="inicio-grid">
            {section.items.map(t => (
              <Link key={t.to} to={t.to} className="inicio-tile">
                <div style={{ color: 'var(--accent)' }}><Icon name={t.icon} /></div>
                <span>{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
