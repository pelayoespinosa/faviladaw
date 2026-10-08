import { calcHMesProrr } from '../constants/tareas';

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const pad = n => String(n).padStart(2, '0');

function claveUTC(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diaSemanaDe(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`);
  return DIAS[d.getUTCDay()];
}

export function horasTramos(turno) {
  return (turno.tramos || []).reduce((acc, tr) => {
    if (!tr.hora_llegada || !tr.hora_salida) return acc;
    const [h1, m1] = tr.hora_llegada.split(':').map(Number);
    const [h2, m2] = tr.hora_salida.split(':').map(Number);
    const dur = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
    return acc + (dur > 0 ? dur : 0);
  }, 0);
}

export function horasBaseDia(turnos, fecha) {
  const dia = diaSemanaDe(fecha);
  return (turnos || [])
    .filter(t => t.frecuencia === 'semanal' && (t.dias_semana || []).includes(dia))
    .reduce((acc, t) => acc + horasTramos(t), 0);
}

function fechaAusenciaCubre(ausencia, fecha) {
  const ini = claveUTC(new Date(ausencia.fecha_inicio));
  if (!ausencia.fecha_fin) return fecha >= ini;
  const fin = claveUTC(new Date(ausencia.fecha_fin));
  return fecha >= ini && fecha <= fin;
}

function fechaCobertura(cobertura) {
  return claveUTC(new Date(cobertura.fecha));
}

export function construirRejilla({ empleadoId, desde, hasta, turnos, turnosPorEmpleado, ausencias, coberturas }) {
  const rejilla = [];
  const cursor = new Date(`${desde}T00:00:00Z`);

  while (claveUTC(cursor) <= hasta) {
    const fecha = claveUTC(cursor);
    const horasBase = horasBaseDia(turnos, fecha);

    const ausencia = (ausencias || []).find(a => String(a.empleado?._id || a.empleado) === String(empleadoId) && fechaAusenciaCubre(a, fecha));
    const cubreOtroDia = (coberturas || []).find(c => String(c.empleado_ausente?._id || c.empleado_ausente) === String(empleadoId) && fechaCobertura(c) === fecha);
    const recibeCobertura = (coberturas || []).filter(c => String(c.empleado_cubre?._id || c.empleado_cubre) === String(empleadoId) && fechaCobertura(c) === fecha);

    let horasFinal = horasBase;
    let motivo = null;
    let detalle = {};

    if (ausencia) {
      horasFinal = 0;
      motivo = ausencia.tipo;
      detalle = { ausenciaId: ausencia._id };
    } else if (cubreOtroDia) {
      horasFinal = 0;
      motivo = 'cobertura_cedida';
      detalle = { coberturaId: cubreOtroDia._id, empleadoOtro: cubreOtroDia.empleado_cubre };
    }

    if (recibeCobertura.length) {
      const horasRecibidas = recibeCobertura.reduce((acc, c) => {
        if (c.turno && c.turno.tramos) return acc + horasTramos(c.turno);
        const idAusente = c.empleado_ausente?._id || c.empleado_ausente;
        const turnosAusente = turnosPorEmpleado?.[String(idAusente)] || [];
        return acc + horasBaseDia(turnosAusente, fecha);
      }, 0);
      horasFinal += horasRecibidas;
      motivo = motivo || 'cobertura_recibida';
      detalle = { ...detalle, coberturas: recibeCobertura.map(c => ({ coberturaId: c._id, empleadoOtro: c.empleado_ausente })) };
    }

    rejilla.push({ fecha, horasBase, horasFinal: +horasFinal.toFixed(2), motivo, detalle });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return rejilla;
}

export function resumenMensual({ empleadoId, year, month, turnos, turnosPorEmpleado, ausencias, coberturas }) {
  const desde = `${year}-${pad(month + 1)}-01`;
  const ultimoDia = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const hasta = `${year}-${pad(month + 1)}-${pad(ultimoDia)}`;

  const rejilla = construirRejilla({ empleadoId, desde, hasta, turnos, turnosPorEmpleado, ausencias, coberturas });
  const horasCalendarioSoloSemanal = +rejilla.reduce((acc, d) => acc + d.horasFinal, 0).toFixed(2);

  const turnosNoSemanales = (turnos || []).filter(t => t.frecuencia !== 'semanal');
  const horasNoSemanalProrrateada = +turnosNoSemanales.reduce((acc, t) => acc + calcHMesProrr(t), 0).toFixed(2);

  return {
    horasCalendario: +(horasCalendarioSoloSemanal + horasNoSemanalProrrateada).toFixed(2),
    horasCalendarioSoloSemanal,
    horasNoSemanalProrrateada,
    incluyeNoSemanal: turnosNoSemanales.length > 0,
    rejilla,
  };
}
