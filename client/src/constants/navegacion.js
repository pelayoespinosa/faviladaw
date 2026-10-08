
export const DESACTIVADOS = new Set(['/contrataciones']);
const activa = r => !DESACTIVADOS.has(r);

export const PAGINAS = {
  '/':                      { titulo: 'Panel',                 icon: 'home' },
  '/fichar':                { titulo: 'Fichar',                icon: 'clock',    grupo: 'Mi jornada' },
  '/mis-turnos':            { titulo: 'Mis turnos',            icon: 'calendar', grupo: 'Mi jornada' },
  '/mis-fichajes':          { titulo: 'Mis fichajes',          icon: 'list',     grupo: 'Mi jornada' },
  '/mi-calendario':         { titulo: 'Mi calendario',         icon: 'calendar', grupo: 'Mi jornada' },
  '/mis-solicitudes':       { titulo: 'Mis solicitudes',       icon: 'box',      grupo: 'Mi jornada' },
  '/mis-documentos':        { titulo: 'Mis documentos',        icon: 'folder',   grupo: 'Mi jornada' },
  '/fichajes':              { titulo: 'Fichajes',              icon: 'pin',      grupo: 'Día a día' },
  '/turnos':                { titulo: 'Turnos',                icon: 'calendar', grupo: 'Día a día' },
  '/vacaciones-bajas':      { titulo: 'Vacaciones y bajas',    icon: 'calendar', grupo: 'Día a día' },
  '/mapa':                  { titulo: 'Mapa',                  icon: 'pin',      grupo: 'Día a día' },
  '/empleados':             { titulo: 'Empleados',             icon: 'users',    grupo: 'Personas' },
  '/gestion-empleados':     { titulo: 'Gestión de empleados',  icon: 'edit',     grupo: 'Personas' },
  '/gestion-usuarios':      { titulo: 'Accesos',               icon: 'user',     grupo: 'Personas' },
  '/clientes':              { titulo: 'Clientes',              icon: 'building', grupo: 'Clientes' },
  '/gestion-clientes':      { titulo: 'Gestión de clientes',   icon: 'edit',     grupo: 'Clientes' },
  '/contrataciones':        { titulo: 'Contrataciones',        icon: 'filetext', grupo: 'Clientes' },
  '/solicitudes':           { titulo: 'Solicitudes',           icon: 'box',      grupo: 'Material y flota' },
  '/gestion-productos':     { titulo: 'Productos',             icon: 'tag',      grupo: 'Material y flota' },
  '/servicios':             { titulo: 'Servicios', icon: 'tag',      grupo: 'Material y flota' },
  '/flota':                 { titulo: 'Flota',                 icon: 'van',      grupo: 'Material y flota' },
  '/documentos':            { titulo: 'Documentos',            icon: 'folder',   grupo: 'Documentación' },
  '/cuadro-laboral':        { titulo: 'Cuadro laboral',        icon: 'filetext', grupo: 'Documentación' },
  '/perfil':                { titulo: 'Mi cuenta',             icon: 'user' },
};

const MENU = {
  admin: [
    [null, ['/']],
    ['Día a día', ['/fichajes', '/turnos', '/vacaciones-bajas', '/mapa']],
    ['Personas', ['/empleados', '/gestion-usuarios']],
    ['Clientes', ['/clientes', '/contrataciones']],
    ['Material y flota', ['/solicitudes', '/servicios', '/gestion-productos', '/flota']],
    ['Documentación', ['/documentos', '/cuadro-laboral', '/mis-documentos']],
  ],
  encargado: [
    [null, ['/', '/fichar']],
    ['Mi jornada', ['/mis-turnos', '/mis-fichajes', '/mi-calendario', '/mis-solicitudes', '/mis-documentos']],
    ['Mi equipo', ['/fichajes', '/vacaciones-bajas', '/empleados', '/clientes', '/solicitudes']],
    ['Documentación', ['/documentos']],
  ],
  empleado: [
    [null, ['/', '/fichar']],
    ['Mi jornada', ['/mis-turnos', '/mis-fichajes', '/mi-calendario', '/mis-solicitudes', '/mis-documentos']],
  ],
  gestoria: [
    [null, ['/']],
    ['Consulta', ['/empleados', '/fichajes', '/documentos', '/cuadro-laboral', '/mis-documentos']],
  ],
};

export function menuPara(rol) { return (MENU[rol] || MENU.empleado).map(([g, rutas]) => [g, rutas.filter(activa)]); }

const BARRA = {
  admin:     ['/', '/fichajes', '/empleados', '/clientes', 'mas'],
  encargado: ['/', '/mis-turnos', '/fichar', '/solicitudes', 'mas'],
  empleado:  ['/mis-turnos', '/mi-calendario', '/fichar', '/mis-solicitudes', 'mas'],
  gestoria:  ['/', '/empleados', '/fichajes', '/cuadro-laboral', 'mas'],
};
export function barraPara(rol) { return BARRA[rol] || BARRA.empleado; }
export const ETIQUETA_CORTA = {
  '/': 'Panel', '/fichajes': 'Fichajes', '/empleados': 'Personas', '/clientes': 'Clientes',
  '/mis-turnos': 'Turnos', '/mi-calendario': 'Calendario', '/fichar': 'Fichar',
  '/mis-solicitudes': 'Pedidos', '/solicitudes': 'Pedidos', '/cuadro-laboral': 'Cuadro',
};

export const SECCIONES = [
  { rutas: ['/empleados', '/gestion-empleados', '/gestion-usuarios'], etiquetas: ['Consulta', 'Altas y edición', 'Accesos'],
    roles: { '/empleados': ['admin','encargado','gestoria'], '/gestion-empleados': ['admin'], '/gestion-usuarios': ['admin'] } },
  { rutas: ['/clientes', '/gestion-clientes', '/contrataciones'], etiquetas: ['Consulta', 'Altas y edición', 'Contrataciones'],
    roles: { '/clientes': ['admin','encargado'], '/gestion-clientes': ['admin'], '/contrataciones': ['admin'] } },
  { rutas: ['/servicios', '/gestion-productos'], etiquetas: ['Servicios', 'Productos'],
    roles: { '/servicios': ['admin'], '/gestion-productos': ['admin'] } },
  { rutas: ['/documentos', '/mis-documentos'], etiquetas: ['Todos los documentos', 'Mis documentos'],
    roles: { '/documentos': ['admin','encargado','gestoria'], '/mis-documentos': ['admin','encargado','gestoria','empleado'] } },
  { rutas: ['/fichajes', '/mis-fichajes'], etiquetas: ['Fichajes de la plantilla', 'Mis fichajes'],
    roles: { '/fichajes': ['admin','encargado','gestoria'], '/mis-fichajes': ['encargado','empleado'] } },
  { rutas: ['/vacaciones-bajas', '/mi-calendario'], etiquetas: ['Vacaciones y bajas', 'Mi calendario'],
    roles: { '/vacaciones-bajas': ['admin','encargado'], '/mi-calendario': ['encargado','empleado'] } },
  { rutas: ['/solicitudes', '/mis-solicitudes'], etiquetas: ['Todas las solicitudes', 'Mis solicitudes'],
    roles: { '/solicitudes': ['admin','encargado'], '/mis-solicitudes': ['encargado','empleado'] } },
];

export function seccionDe(ruta, rol) {
  const s = SECCIONES.find(x => x.rutas.includes(ruta));
  if (!s) return null;
  const tabs = s.rutas.map((r, i) => ({ to: r, label: s.etiquetas[i] })).filter(t => activa(t.to) && s.roles[t.to].includes(rol));
  return tabs.length > 1 ? tabs : null;
}

const PERMISOS = {
  '/': ['admin','encargado','empleado','gestoria'],
  '/empleados': ['admin','encargado','gestoria'], '/clientes': ['admin','encargado'], '/contrataciones': ['admin'],
  '/turnos': ['admin'], '/mapa': ['admin'], '/flota': ['admin'],
  '/mis-turnos': ['encargado','empleado'], '/gestion-empleados': ['admin'], '/gestion-usuarios': ['admin'],
  '/gestion-productos': ['admin'], '/gestion-clientes': ['admin'], '/documentos': ['admin','encargado','gestoria'],
  '/mis-documentos': ['admin','encargado','gestoria','empleado'],
  '/fichar': ['encargado','empleado'], '/mis-fichajes': ['encargado','empleado'],
  '/fichajes': ['admin','encargado','gestoria'], '/vacaciones-bajas': ['admin','encargado'],
  '/mi-calendario': ['encargado','empleado'], '/solicitudes': ['admin','encargado'],
  '/mis-solicitudes': ['encargado','empleado'], '/servicios': ['admin'],
  '/cuadro-laboral': ['admin','gestoria'], '/perfil': ['admin','encargado','empleado','gestoria'],
};
export function rutasPara(rol) { return Object.keys(PERMISOS).filter(r => activa(r) && PERMISOS[r].includes(rol)); }

export const ROL_LABEL = { admin: 'Administración', encargado: 'Encargado/a', empleado: 'Empleado/a', gestoria: 'Gestoría' };
