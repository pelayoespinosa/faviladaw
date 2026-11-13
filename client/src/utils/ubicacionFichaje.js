const GRAVEDAD_ZONA = { sin_referencia: 0, dentro: 1, dudoso: 2, fuera: 3 };
const GRAVEDAD_SOSPECHA = { ninguna: 0, baja: 1, alta: 2 };

export const MOTIVOS_SOSPECHA = {
  viaje_imposible: 'Viaje imposible desde el fichaje anterior',
  posicion_antigua: 'Posición GPS antigua',
  coordenadas_identicas: 'Coordenadas idénticas a fichajes anteriores',
  precision_artificial: 'Precisión GPS artificial',
};

const peor = (valores, gravedad) => valores.reduce((a, b) => ((gravedad[b] ?? 0) > (gravedad[a] ?? 0) ? b : a));

export function incidenciaDe(fichaje) {
  const validaciones = [fichaje.entrada?.validacion, fichaje.salida?.validacion].filter(Boolean);
  const zona = validaciones.length ? peor(validaciones.map(v => v.estado), GRAVEDAD_ZONA) : null;
  const sospechas = validaciones.map(v => v.sospecha).filter(Boolean);
  const sospecha = sospechas.length ? peor(sospechas.map(s => s.nivel), GRAVEDAD_SOSPECHA) : 'ninguna';
  const motivos = [...new Set(sospechas.flatMap(s => s.motivos || []))];
  const anulado = fichaje.estado === 'anulado';
  const hay = !anulado && (zona === 'fuera' || zona === 'dudoso' || sospecha !== 'ninguna');
  return { zona, sospecha, motivos, hay };
}

export function coincideConFiltro(fichaje, filtro) {
  if (!filtro || filtro === 'todos') return true;
  const i = incidenciaDe(fichaje);
  if (filtro === 'incidencias') return i.hay;
  if (filtro === 'fuera') return fichaje.estado !== 'anulado' && i.zona === 'fuera';
  if (filtro === 'sospechosos') return fichaje.estado !== 'anulado' && i.sospecha !== 'ninguna';
  return true;
}

export function resumenUbicacion(fichajes) {
  const r = { total: 0, dentro: 0, dudoso: 0, fuera: 0, sin_referencia: 0, sin_validar: 0, sospechosos: 0, justificados: 0 };
  for (const f of fichajes.filter(x => x.estado !== 'anulado')) {
    const i = incidenciaDe(f);
    r.total++;
    r[i.zona || 'sin_validar']++;
    if (i.sospecha !== 'ninguna') r.sospechosos++;
    if (f.justificacion) r.justificados++;
  }
  return r;
}
