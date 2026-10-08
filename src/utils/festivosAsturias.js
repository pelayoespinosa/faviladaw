const FESTIVOS_POR_ANIO = {
  2025: [
    '2025-01-01',
    '2025-01-06',
    '2025-04-17',
    '2025-04-18',
    '2025-05-01',
    '2025-08-15',
    '2025-09-08',
    '2025-10-13',
    '2025-11-01',
    '2025-12-06',
    '2025-12-08',
    '2025-12-25',
  ],
  2026: [
    '2026-01-01',
    '2026-01-06',
    '2026-04-02',
    '2026-04-03',
    '2026-05-01',
    '2026-08-15',
    '2026-09-08',
    '2026-10-12',
    '2026-11-02',
    '2026-12-07',
    '2026-12-08',
    '2026-12-25',
  ],
};

const FESTIVOS_SET_POR_ANIO = Object.fromEntries(
  Object.entries(FESTIVOS_POR_ANIO).map(([anio, fechas]) => [anio, new Set(fechas)])
);

function pad2(n) { return String(n).padStart(2, '0'); }

function esFestivoAsturias(anio, mes, dia) {
  const set = FESTIVOS_SET_POR_ANIO[anio];
  if (!set) return false;
  return set.has(`${anio}-${pad2(mes)}-${pad2(dia)}`);
}

module.exports = { esFestivoAsturias };
