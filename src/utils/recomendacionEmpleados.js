const Empleado = require('../models/Empleado');
const Turno = require('../models/Turno');
const { haversineKm } = require('./geo');
const { calcHSemProrr } = require('./prorrateo');
const { mapaCoordsResidencia, soloCp } = require('./geoResidencia');

const agrupar = (arr, fn) => arr.reduce((m, x) => { (m[fn(x)] ||= []).push(x); return m; }, {});

function puntuar(c) {
  let s = c.distancia_km == null ? 45 : c.distancia_km;
  if (!c.especialista) s += 50;
  if (c.hace_servicio) s -= 8;
  switch (c.encaje) {
    case 'perfecto':   break;
    case 'sobra':      s += Math.min(2 + c.sobra * 1.5, 14); break;
    case 'parcial':    s += 12 + Math.abs(c.sobra) * 2;    break;
    case 'sin_limite': s += 5;                             break;
    default:           s += 3;
  }
  return +s.toFixed(2);
}

async function candidatosParaServicio({ cliente, tipo_tarea, horas_gap = null }) {
  const empleados = await Empleado.find({ activo: { $ne: false } });

  const coordsCp = await mapaCoordsResidencia(empleados.map(e => e.cp_residencia).filter(Boolean));
  const turnos = await Turno.find({}, 'empleado tipo_tarea horas_semana frecuencia');
  const turnosPorEmpleado = agrupar(turnos, t => String(t.empleado));

  const puntoCliente = (cliente?.lat != null && cliente?.lng != null)
    ? { lat: cliente.lat, lng: cliente.lng } : null;

  const candidatos = empleados.map(e => {
    const misTurnos = turnosPorEmpleado[String(e._id)] || [];

    const asignadas = misTurnos.reduce((a, t) => a + calcHSemProrr(t), 0);
    const libres = e.horas_semanales_contrato == null
      ? null : +(e.horas_semanales_contrato - asignadas).toFixed(2);

    let distanciaKm = null, origenDistancia = null;
    if (puntoCliente) {
      const puntos = [];
      const cpCoord = e.cp_residencia && coordsCp.get(soloCp(e.cp_residencia));
      if (cpCoord) puntos.push(['cp', haversineKm(puntoCliente, cpCoord)]);
      for (const u of (e.ubicaciones || [])) {
        const d = haversineKm(puntoCliente, u);
        if (d != null) puntos.push(['ubicacion', d]);
      }
      const validos = puntos.filter(([, d]) => d != null);
      if (validos.length) {
        const min = validos.reduce((m, x) => (x[1] < m[1] ? x : m));
        distanciaKm = +min[1].toFixed(2);
        origenDistancia = min[0];
      }
    }

    const haceServicio = !!tipo_tarea && misTurnos.some(t => t.tipo_tarea === tipo_tarea);
    const especialista = !tipo_tarea || !e.especialidades?.length || e.especialidades.includes(tipo_tarea);

    let encaje = null, sobra = null, horasCubre = null;
    if (horas_gap != null) {
      if (libres == null) {
        encaje = 'sin_limite';
        horasCubre = +horas_gap.toFixed(2);
      } else {
        sobra = +(libres - horas_gap).toFixed(2);
        horasCubre = +Math.max(0, Math.min(libres, horas_gap)).toFixed(2);
        if (Math.abs(sobra) <= 0.25) encaje = 'perfecto';
        else if (sobra > 0.25) encaje = 'sobra';
        else encaje = 'parcial';
      }
    }

    const c = {
      _id: e._id,
      nombre_display: e.nombre_display,
      especialista,
      hace_servicio: haceServicio,
      distancia_km: distanciaKm,
      origen_distancia: origenDistancia,
      horas_libres: libres,
      encaje,
      sobra,
      horas_cubre: horasCubre,
    };
    c.score = puntuar(c);
    return c;
  });

  return candidatos
    .filter(c => c.horas_libres == null || c.horas_libres > 0.01)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.distancia_km == null) return 1;
      if (b.distancia_km == null) return -1;
      return a.distancia_km - b.distancia_km;
    });
}

module.exports = { candidatosParaServicio };
