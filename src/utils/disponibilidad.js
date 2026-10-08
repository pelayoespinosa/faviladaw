const Turno = require('../models/Turno');

async function horasLibres(empleadoId, horasContrato) {
  if (horasContrato == null) return null;
  const turnos = await Turno.find({ empleado: empleadoId });
  const asignadas = turnos.reduce((acc, t) => acc + (t.horas_semanales_prorrateadas || 0), 0);
  return +(horasContrato - asignadas).toFixed(2);
}

module.exports = { horasLibres };
