const SEMANAS_AÑO = 52;
const VISITAS_JARDIN_AÑO = 27;
const VISITAS_AÑO = {
  semanal: 52, quincenal: 26, mensual: 12, bimestral: 6,
  trimestral: 4, cuatrimestral: 3, semestral: 2, anual: 1,
};

const visitasAño = t => (t.tipo_tarea === 'jardin' ? VISITAS_JARDIN_AÑO : (VISITAS_AÑO[t.frecuencia] ?? SEMANAS_AÑO));

function calcHSemProrr(t) {
  const h = t.horas_semana || 0;
  if (!h) return 0;
  return +(h * visitasAño(t) / SEMANAS_AÑO).toFixed(2);
}

function calcHMesProrr(t) {
  const h = t.horas_semana || 0;
  if (!h) return 0;
  return +(h * visitasAño(t) / 12).toFixed(2);
}

module.exports = { calcHSemProrr, calcHMesProrr, SEMANAS_AÑO };
