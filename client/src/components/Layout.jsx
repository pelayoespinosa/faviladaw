import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api/axios';
import ThemeToggle from './ThemeToggle';
import AvisosBell from './AvisosBell';
import Icon from './Icon';
import ErrorPagina from './ErrorPagina';
import { attachFastScrollbarJump, attachFastScrollbarJumpWindow } from '../utils/fastScrollbarJump';
import { attachTablasAdaptables } from '../utils/tablasAdaptables';
import { PAGINAS, menuPara, barraPara, ETIQUETA_CORTA, seccionDe, rutasPara, ROL_LABEL } from '../constants/navegacion';
import { normalizar } from '../utils/texto';

const NOMBRE_MENU = { '/mis-documentos': 'Mis documentos' };

function Buscador({ rol, onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [personas, setPersonas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (['admin', 'encargado', 'gestoria'].includes(rol)) api.get('/empleados').then(r => setPersonas(r.data || [])).catch(() => {});
    if (['admin', 'encargado'].includes(rol)) api.get('/clientes').then(r => setClientes(r.data || [])).catch(() => {});
  }, [rol]);

  const resultados = useMemo(() => {
    const n = normalizar(q.trim());
    const pags = rutasPara(rol).map(r => ({ tipo: 'Páginas', label: NOMBRE_MENU[r] || PAGINAS[r]?.titulo || r, sub: PAGINAS[r]?.grupo || '', to: r, icon: PAGINAS[r]?.icon || 'arrow' }))
      .filter(p => !n || normalizar(p.label).includes(n) || normalizar(p.sub).includes(n));
    if (!n) return pags;
    const per = personas.filter(e => normalizar(`${e.nombre_display} ${e.dni || ''}`).includes(n)).slice(0, 6)
      .map(e => ({ tipo: 'Empleados', label: e.nombre_display, sub: e.activo === false ? 'de baja' : (e.dni || ''), to: `/empleados?q=${encodeURIComponent(e.nombre_display)}`, icon: 'user' }));
    const cli = clientes.filter(c => normalizar(`${c.nombre} ${c.alias || ''} ${c.sucursal || ''} ${c.nif || ''}`).includes(n)).slice(0, 6)
      .map(c => ({ tipo: 'Clientes', label: c.alias || c.nombre, sub: c.sucursal || c.zona || '', to: `/clientes?q=${encodeURIComponent(c.alias || c.nombre)}`, icon: 'building' }));
    return [...pags, ...per, ...cli];
  }, [q, rol, personas, clientes]);

  const ir = (r) => { if (!r) return; navigate(r.to); onClose(); };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') ir(resultados[sel]);
  };

  const inicioGrupo = new Set(resultados.map((r, i) => (i === 0 || resultados[i - 1].tipo !== r.tipo ? i : -1)).filter(i => i >= 0));
  return (
    <div className="cmdk-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-label="Buscar">
        <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}
          placeholder="Buscar página, empleado o cliente…" aria-label="Buscar" />
        <ul>
          {resultados.length === 0 && <li className="empty">Nada coincide con «{q}». Prueba con otra palabra.</li>}
          {resultados.map((r, i) => {
            const cab = inicioGrupo.has(i) ? <li key={`g-${r.tipo}`} className="grp">{r.tipo}</li> : null;
            return [cab, (
              <li key={`${r.tipo}-${r.to}-${i}`} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => ir(r)}>
                <Icon name={r.icon} size={16} />{r.label}{r.sub && <small>{r.sub}</small>}
              </li>
            )];
          })}
        </ul>
      </div>
    </div>
  );
}

export default function Layout() {
  const { logout, rol } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const navRef = useRef(null);
  const pageRef = useRef(null);
  const ruta = location.pathname.replace(/\/+$/, '') || '/';
  const pagina = PAGINAS[ruta];
  const tabs = seccionDe(ruta, rol);

  useEffect(() => {
    const cargar = () => api.get('/documentos/pendientes').then(r => setPendientes(r.data.count)).catch(() => {});
    cargar();
    const id = setInterval(cargar, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const detachWindow = attachFastScrollbarJumpWindow();
    const detachNav = navRef.current ? attachFastScrollbarJump(navRef.current) : () => {};
    return () => { detachWindow(); detachNav(); };
  }, []);

  useEffect(() => attachTablasAdaptables(pageRef.current), []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBuscando(b => !b); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cerrar = () => setSidebarOpen(false);
  const badge = (to) => (to === '/mis-documentos' && pendientes > 0 ? pendientes : null);
  const activaEnSeccion = (to) => {
    const s = seccionDe(to, rol);
    return s ? s.some(t => t.to === ruta) && (to === ruta || !menuPara(rol).some(([, rs]) => rs.includes(ruta))) : false;
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={cerrar} />}
      {buscando && <Buscador rol={rol} onClose={() => setBuscando(false)} />}

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Menú">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="sidebar-logo-img-wrap"><img src={import.meta.env.BASE_URL + 'emblema.png'} alt="" /></div>
            <div>
              <div className="logo-name">Favila</div>
            </div>
          </div>
        </div>
        <button type="button" className="sidebar-search" onClick={() => { setBuscando(true); cerrar(); }}>
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" /></svg>
          Buscar<kbd>Ctrl K</kbd>
        </button>
        <nav className="sidebar-nav" ref={navRef}>
          {menuPara(rol).map(([grupo, rutas]) => (
            <div className="nav-section" key={grupo || 'inicio'}>
              {grupo && <div className="nav-label">{grupo}</div>}
              {rutas.map(to => (
                <NavLink key={to} to={to} end={to === '/'} onClick={cerrar}
                  className={({ isActive }) => `nav-item${to === '/fichar' ? ' nav-item-highlight' : ''}${isActive || activaEnSeccion(to) ? ' active' : ''}`}>
                  <Icon name={PAGINAS[to]?.icon || 'arrow'} size={16} />{NOMBRE_MENU[to] || PAGINAS[to]?.titulo}
                  {badge(to) && <span className="nav-badge">{badge(to)}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/perfil" onClick={cerrar} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon name="user" size={16} />Mi cuenta<span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--pino-ink-2)' }}>{ROL_LABEL[rol] || 'Empleado/a'}</span>
          </NavLink>
          <button className="btn-logout" onClick={logout}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 16, height: 16 }}>
              <path d="M13 3h4v14h-4M9 14l4-4-4-4M3 10h10" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Abrir menú">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
            <div style={{ minWidth: 0 }}>
              {pagina?.grupo && <div className="topbar-crumb">{pagina.grupo}</div>}
              <h1 className="topbar-title">{pagina?.titulo || 'Favila'}</h1>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="theme-toggle" onClick={() => setBuscando(true)} aria-label="Buscar" title="Buscar (Ctrl K)">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" /></svg>
            </button>
            <AvisosBell />
            <ThemeToggle />
          </div>
        </header>
        <main className="page" ref={pageRef}>
          {tabs && (
            <nav className="seccion-tabs" aria-label="Secciones relacionadas">
              {tabs.map(t => <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'active' : '')}>{t.label}</NavLink>)}
            </nav>
          )}
          <ErrorPagina key={ruta}>
            <Outlet key={location.search.startsWith('?q=') ? location.search : 'pagina'} />
          </ErrorPagina>
        </main>
      </div>

      <nav className="bottombar" aria-label="Accesos rápidos">
        {barraPara(rol).map(to => to === 'mas' ? (
          <button key="mas" type="button" onClick={() => setSidebarOpen(true)}>
            <svg viewBox="0 0 20 20" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
            Más{pendientes > 0 && <span className="bb-badge">{pendientes}</span>}
          </button>
        ) : (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `${to === '/fichar' ? 'fab' : ''}${isActive ? ' active' : ''}`}>
            {to === '/fichar' ? <span className="circ"><Icon name="clock" size={24} /></span> : <Icon name={PAGINAS[to]?.icon || 'arrow'} size={22} />}
            {ETIQUETA_CORTA[to] || PAGINAS[to]?.titulo}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
