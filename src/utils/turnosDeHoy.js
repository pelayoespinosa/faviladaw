const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function hoyEnMadrid(ahora = new Date()) {
  const fecha = ahora.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
  return { fecha, dia: DIAS[new Date(`${fecha}T00:00:00Z`).getUTCDay()] };
}

function clientesDeHoy(turnos, ahora = new Date()) {
  const { fecha, dia } = hoyEnMadrid(ahora);
  return turnos
    .filter(t => t.cliente && (t.dias_semana || []).includes(dia))
    .filter(t => (t.frecuencia || 'semanal') === 'semanal'
      || (t.proxima_fecha && new Date(t.proxima_fecha).toISOString().slice(0, 10) === fecha))
    .map(t => t.cliente);
}

module.exports = { hoyEnMadrid, clientesDeHoy };
