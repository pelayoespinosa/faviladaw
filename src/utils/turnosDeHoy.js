const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function hoyEnMadrid(ahora = new Date()) {
  const fecha = ahora.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
  return { fecha, dia: DIAS[new Date(`${fecha}T00:00:00Z`).getUTCDay()] };
}

function turnosDeHoy(turnos, ahora = new Date()) {
  const { fecha, dia } = hoyEnMadrid(ahora);
  return turnos
    .filter(t => (t.dias_semana || []).includes(dia))
    .filter(t => (t.frecuencia || 'semanal') === 'semanal'
      || (t.proxima_fecha && new Date(t.proxima_fecha).toISOString().slice(0, 10) === fecha));
}

function clientesDeHoy(turnos, ahora = new Date()) {
  return turnosDeHoy(turnos, ahora).filter(t => t.cliente).map(t => t.cliente);
}

function motivoSinReferencia(turnos, ahora = new Date()) {
  const deHoy = turnosDeHoy(turnos, ahora);
  if (!deHoy.length) return 'sin_turno';
  if (deHoy.every(t => !t.cliente)) return 'turno_furgoneta';
  return 'cliente_sin_coordenadas';
}

module.exports = { hoyEnMadrid, turnosDeHoy, clientesDeHoy, motivoSinReferencia };
