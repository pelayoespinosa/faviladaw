export const ZONAS_TRABAJO = [
  { value: 'oviedo_centro', label: 'Oviedo y Centro' },
  { value: 'gijon',         label: 'Gijón' },
  { value: 'aviles',        label: 'Avilés' },
  { value: 'occidente',     label: 'Occidente' },
  { value: 'oriente',       label: 'Oriente' },
];

export const ZONA_LABEL = Object.fromEntries(ZONAS_TRABAJO.map(z => [z.value, z.label]));
export const ZONAS_TRABAJO_ITEMS = ZONAS_TRABAJO.map(z => ({ _id: z.value, nombre: z.label }));
