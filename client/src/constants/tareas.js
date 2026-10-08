
export const TAREAS = [
  { value: 'limpieza',            label: 'Limpieza',                            mecanizada: false },
  { value: 'limpieza_general',    label: 'Limpieza general',                    mecanizada: false },
  { value: 'cristales',           label: 'Cristales',                           mecanizada: false },
  { value: 'cubos',               label: 'Servicio de cubos',                   mecanizada: false },
  { value: 'basuras',             label: 'Servicio de recogida de basuras',      mecanizada: false },
  { value: 'jardin',              label: 'Jardín',                               mecanizada: false },
  { value: 'patio_general',       label: 'Patio',                                mecanizada: false },
  { value: 'garaje_general',      label: 'Garaje',                                mecanizada: false },
  { value: 'abrillantado',        label: 'Abrillantado',                         mecanizada: true  },
  { value: 'limpieza_mecanizada', label: 'Limpieza mecanizada',                  mecanizada: true  },
  { value: 'garaje',              label: 'Limpieza mecanizada de garaje',        mecanizada: true  },
  { value: 'patio',               label: 'Limpieza mecanizada de patio/terraza', mecanizada: true  },
  { value: 'portal',              label: 'Limpieza mecanizada de portal',        mecanizada: true  },
  { value: 'soportal',            label: 'Limpieza mecanizada de soportal',      mecanizada: true  },
  { value: 'otros',               label: 'Otros',                                mecanizada: false },
];

export const TAREAS_LABEL = Object.fromEntries(TAREAS.map(t => [t.value, t.label]));
export const TAREAS_MEC   = new Set(TAREAS.filter(t => t.mecanizada).map(t => t.value));
export const TAREAS_ITEMS = TAREAS.map(t => ({ _id: t.value, nombre: t.label, zona: t.mecanizada ? 'Mecanizado' : null }));

export const FRECUENCIAS = [
  { value: 'semanal',       label: 'Semanal'       },
  { value: 'quincenal',     label: 'Quincenal'     },
  { value: 'mensual',       label: 'Mensual'       },
  { value: 'bimestral',     label: 'Bimestral'     },
  { value: 'trimestral',    label: 'Trimestral'    },
  { value: 'cuatrimestral', label: 'Cuatrimestral' },
  { value: 'semestral',     label: 'Semestral'     },
  { value: 'anual',         label: 'Anual'         },
];

export const FREC_LABEL       = Object.fromEntries(FRECUENCIAS.map(f => [f.value, f.label]));
export const FREC_LABEL_SHORT = { semanal:'sem', quincenal:'quinc', mensual:'mes', bimestral:'bim', trimestral:'trim', cuatrimestral:'cuatrim', semestral:'sem', anual:'año' };
export const FRECUENCIAS_ITEMS = FRECUENCIAS.map(f => ({ _id: f.value, nombre: f.label }));

export const SEMANAS_AÑO = 52;
const VISITAS_JARDIN_AÑO = 27;
const VISITAS_AÑO = {
  semanal: 52, quincenal: 26, mensual: 12, bimestral: 6,
  trimestral: 4, cuatrimestral: 3, semestral: 2, anual: 1,
};
const visitasAño = t => (t.tipo_tarea === 'jardin' ? VISITAS_JARDIN_AÑO : (VISITAS_AÑO[t.frecuencia] ?? SEMANAS_AÑO));

export function calcHSemProrr(t) {
  const h = t.horas_semana || 0;
  if (!h) return 0;
  return +(h*visitasAño(t)/SEMANAS_AÑO).toFixed(2);
}

export function calcHMesProrr(t) {
  const h = t.horas_semana || 0;
  if (!h) return 0;
  return +(h*visitasAño(t)/12).toFixed(2);
}

export function formatH(h) {
  if (!h || h <= 0) return '—';
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  return mins ? `${hrs}h ${mins}min` : `${hrs}h`;
}
