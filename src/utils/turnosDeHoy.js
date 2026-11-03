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

function turnosEfectivosHoy({ empleadoId, turnos, coberturas = [] }, ahora = new Date()) {
  const { fecha } = hoyEnMadrid(ahora);
  const deEmpleado = id => turnos.filter(t => String(t.empleado) === String(id));
  const propios = turnosDeHoy(deEmpleado(empleadoId), ahora);
  const cubiertos = coberturas
    .filter(c => String(c.empleado_cubre) === String(empleadoId)
      && new Date(c.fecha).toISOString().slice(0, 10) === fecha)
    .flatMap(c => c.turno ? [c.turno] : turnosDeHoy(deEmpleado(c.empleado_ausente), ahora));
  return [...propios, ...cubiertos];
}

function clientesDeTurnos(turnos) {
  return turnos.filter(t => t.cliente).map(t => t.cliente);
}

function clientesDeHoy(turnos, ahora = new Date()) {
  return clientesDeTurnos(turnosDeHoy(turnos, ahora));
}

function motivoSinReferencia(turnosDeHoyEfectivos) {
  if (!turnosDeHoyEfectivos.length) return 'sin_turno';
  if (turnosDeHoyEfectivos.every(t => !t.cliente)) return 'turno_furgoneta';
  return 'cliente_sin_coordenadas';
}

module.exports = { hoyEnMadrid, turnosDeHoy, turnosEfectivosHoy, clientesDeTurnos, clientesDeHoy, motivoSinReferencia };
