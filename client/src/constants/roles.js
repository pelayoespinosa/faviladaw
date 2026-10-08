
export const ROL_EMPLEADO = [
  { value: 'director',       label: 'Director/a',       bg: 'rgba(99,102,241,0.12)', color: '#818cf8'       },
  { value: 'administrativo', label: 'Administrativo/a', bg: 'rgba(240,180,41,0.12)', color: 'var(--amber)'  },
  { value: 'encargado',      label: 'Encargado/a',      bg: 'var(--accent-lt)',      color: 'var(--accent)' },
  { value: 'conductor',      label: 'Conductor/a',      bg: 'rgba(78,205,196,0.12)', color: 'var(--teal)'   },
  { value: 'peon',           label: 'Peón',             bg: 'var(--surface-2)',     color: 'var(--text-2)' },
  { value: 'limpiador',      label: 'Limpiador/a',      bg: 'rgba(61,220,132,0.06)',color: 'var(--text-2)' },
];

export const ROL_EMPLEADO_BADGE = Object.fromEntries(ROL_EMPLEADO.map(r => [r.value, r]));
export const ROL_EMPLEADO_LABEL = Object.fromEntries(ROL_EMPLEADO.map(r => [r.value, r.label]));
export const ROL_EMPLEADO_ITEMS = ROL_EMPLEADO.map(r => ({ _id: r.value, nombre: r.label }));

export const ROLES_ACCESO = [
  { value: 'empleado',  label: 'Empleado',      bg: 'var(--surface-2)',      color: 'var(--text-2)' },
  { value: 'encargado', label: 'Encargado/a',   bg: 'var(--accent-lt)',      color: 'var(--accent)' },
  { value: 'gestoria',  label: 'Gestoría',      bg: 'var(--teal-lt)',        color: 'var(--teal)'   },
  { value: 'admin',     label: 'Administrador', bg: 'rgba(99,102,241,0.12)', color: '#818cf8'       },
];
export const ROL_ACCESO_LABEL = Object.fromEntries(ROLES_ACCESO.map(r => [r.value, r.label]));
export const ROL_ACCESO_BADGE = Object.fromEntries(ROLES_ACCESO.map(r => [r.value, r]));
export const ROLES_ACCESO_ITEMS = ROLES_ACCESO.map(r => ({ _id: r.value, nombre: r.label }));
