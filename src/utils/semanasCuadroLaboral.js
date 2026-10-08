const { esFestivoAsturias } = require('./festivosAsturias');
const { horasTramos } = require('./calendarioHoras');

const LABORABLES = new Set([1, 2, 3, 4, 5]);

function pad2(n) { return String(n).padStart(2, '0'); }

function bloquesSemanalesDelMes(anio, mes) {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const bloques = [];
  let actual = null;
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    if (diaSemana === 1 || actual === null) {
      actual = { ini: dia, fin: dia, tieneLaborable: false };
      bloques.push(actual);
    } else {
      actual.fin = dia;
    }
    if (LABORABLES.has(diaSemana)) actual.tieneLaborable = true;
  }
  return bloques.filter(b => b.tieneLaborable);
}

function diasLaborablesEnBloque(anio, mes, ini, fin) {
  let n = 0;
  for (let dia = ini; dia <= fin; dia++) {
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    if (LABORABLES.has(diaSemana)) n++;
  }
  return n;
}

function festivosLocalesComoSet(festivosLocales) {
  return new Set((festivosLocales || []).map(d => {
    const dt = new Date(d);
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }));
}

function semanasProrrateadas(anio, mes, horarioBase) {
  if (horarioBase == null) return { semana1: null, semana2: null, semana3: null, semana4: null, semana5: null };
  const horaDia = horarioBase / 5;
  const bloques = bloquesSemanalesDelMes(anio, mes);
  const horas = [0, 1, 2, 3, 4].map(i => {
    const b = bloques[i];
    if (!b) return 0;
    const dias = diasLaborablesEnBloque(anio, mes, b.ini, b.fin);
    return dias ? +(horaDia * dias).toFixed(2) : 0;
  });
  const [semana1, semana2, semana3, semana4, semana5] = horas;
  return { semana1, semana2, semana3, semana4, semana5 };
}

function semanasSegunDiasTrabajo(anio, mes, horarioBase, diasTrabajo) {
  const vacias = { semana1: null, semana2: null, semana3: null, semana4: null, semana5: null };
  const patron = new Set((diasTrabajo || []).map(d => NOMBRE_DIA.indexOf(d)).filter(i => i >= 0));
  if (horarioBase == null || !patron.size) return vacias;
  const horaDia = horarioBase / patron.size;
  const bloques = bloquesSemanalesDelMes(anio, mes);
  const contar = (ini, fin) => {
    let n = 0;
    for (let dia = ini; dia <= fin; dia++) {
      if (patron.has(new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay())) n++;
    }
    return n;
  };
  const horas = [0, 1, 2, 3, 4].map(i => {
    const b = bloques[i];
    if (!b) return 0;
    const ini = i === 0 ? 1 : b.ini;
    return +(horaDia * contar(ini, b.fin)).toFixed(2);
  });
  const [semana1, semana2, semana3, semana4, semana5] = horas;
  return { semana1, semana2, semana3, semana4, semana5 };
}

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function diasTransportePorDefecto(anio, mes, festivosLocales = [], diasTrabajados = null) {
  const festivosSet = festivosLocalesComoSet(festivosLocales);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  let dias = 0;
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    const seTrabaja = diasTrabajados && diasTrabajados.size
      ? diasTrabajados.has(NOMBRE_DIA[diaSemana])
      : LABORABLES.has(diaSemana);
    if (!seTrabaja) continue;
    if (esFestivoAsturias(anio, mes, dia)) continue;
    if (festivosSet.has(`${anio}-${pad2(mes)}-${pad2(dia)}`)) continue;
    dias++;
  }
  return dias;
}

const PATRON_DIAS_SEMANA = {
  5: LABORABLES,
  6: new Set([1, 2, 3, 4, 5, 6]),
  7: new Set([0, 1, 2, 3, 4, 5, 6]),
};

function diasTransporteSegunDiasSemana(anio, mes, diasSemana, festivosLocales = [], fechaAlta = null) {
  const n = Math.min(Math.max(Math.round(Number(diasSemana)), 0), 7);
  const dias = contarDiasTransporte(anio, mes, PATRON_DIAS_SEMANA[n] || LABORABLES, festivosLocales, fechaAlta);
  return n < 5 ? Math.round(dias * n / 5) : dias;
}

function diasTransporteSegunDiasTrabajo(anio, mes, diasTrabajo, festivosLocales = [], fechaAlta = null) {
  const patron = new Set((diasTrabajo || []).map(d => NOMBRE_DIA.indexOf(d)).filter(i => i >= 0));
  return contarDiasTransporte(anio, mes, patron, festivosLocales, fechaAlta);
}

function contarDiasTransporte(anio, mes, patron, festivosLocales, fechaAlta) {
  const festivosSet = festivosLocalesComoSet(festivosLocales);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  let primerDia = 1;
  if (fechaAlta) {
    const alta = new Date(fechaAlta);
    if (alta > new Date(Date.UTC(anio, mes - 1, ultimoDia))) return 0;
    if (alta.getUTCFullYear() === anio && alta.getUTCMonth() + 1 === mes) primerDia = alta.getUTCDate();
  }
  let dias = 0;
  for (let dia = primerDia; dia <= ultimoDia; dia++) {
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    if (!patron.has(diaSemana)) continue;
    if (esFestivoAsturias(anio, mes, dia)) continue;
    if (festivosSet.has(`${anio}-${pad2(mes)}-${pad2(dia)}`)) continue;
    dias++;
  }
  return dias;
}

function horasCoberturaPorSemana(anio, mes, coberturas) {
  const bloques = bloquesSemanalesDelMes(anio, mes);
  const horas = [0, 0, 0, 0, 0];
  (coberturas || []).forEach(c => {
    if (!c.turno || !c.fecha) return;
    const fecha = c.fecha instanceof Date ? c.fecha : new Date(c.fecha);
    const dia = fecha.getUTCDate();
    const idx = bloques.findIndex(b => dia >= b.ini && dia <= b.fin);
    if (idx === -1) return;
    horas[idx] += horasTramos(c.turno);
  });
  return horas.map(h => +h.toFixed(2));
}

module.exports = { semanasProrrateadas, semanasSegunDiasTrabajo, diasTransportePorDefecto, diasTransporteSegunDiasSemana, diasTransporteSegunDiasTrabajo, NOMBRE_DIA, horasCoberturaPorSemana };
