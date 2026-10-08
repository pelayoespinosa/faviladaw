const pad = n => String(n).padStart(2, '0');

export function hoyClave() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function mapaEstadoHoy(ausencias) {
  const k = hoyClave();
  const map = {};
  (ausencias || []).forEach(a => {
    const id = a.empleado?._id || a.empleado;
    if (!id) return;
    if (k < a.fecha_inicio.slice(0, 10) || (a.fecha_fin && k > a.fecha_fin.slice(0, 10))) return;
    if (a.tipo === 'baja') { map[id] = 'baja'; return; }
    if (a.tipo === 'vacaciones' && map[id] !== 'baja') map[id] = 'vacaciones';
  });
  return map;
}

export const ESTADO_COLOR = {
  vacaciones: 'var(--amber)',
  baja:       'var(--coral)',
};
export const ESTADO_LABEL = { vacaciones: 'Vacaciones', baja: 'Baja' };
