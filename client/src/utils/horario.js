export function formatTramosTexto(tramos) {
  if (!tramos?.length) return '—';
  return tramos
    .filter(t => t.hora_llegada)
    .map(t => `${t.hora_llegada} - ${t.hora_salida || '?'}`)
    .join(', ') || '—';
}
