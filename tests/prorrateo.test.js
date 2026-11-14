const test = require('node:test');
const assert = require('node:assert/strict');
const { calcHSemProrr, calcHMesProrr, SEMANAS_AÑO } = require('../src/utils/prorrateo');

const turno = (frecuencia, horas_semana = 10, extra = {}) => ({ frecuencia, horas_semana, ...extra });

const TABLA = [
  ['semanal', 52, 10, 43.33],
  ['quincenal', 26, 5, 21.67],
  ['mensual', 12, 2.31, 10],
  ['bimestral', 6, 1.15, 5],
  ['trimestral', 4, 0.77, 3.33],
  ['cuatrimestral', 3, 0.58, 2.5],
  ['semestral', 2, 0.38, 1.67],
  ['anual', 1, 0.19, 0.83],
];

test('el año se prorratea sobre 52 semanas', () => {
  assert.equal(SEMANAS_AÑO, 52);
});

for (const [frecuencia, visitas, porSemana, porMes] of TABLA) {
  test(`${frecuencia}: ${visitas} visitas al año dan ${porSemana} h/sem y ${porMes} h/mes con 10 h por visita`, () => {
    assert.equal(calcHSemProrr(turno(frecuencia)), porSemana);
    assert.equal(calcHMesProrr(turno(frecuencia)), porMes);
  });
}

test('las horas anuales salen iguales por semana (×52) y por mes (×12), salvo el redondeo', () => {
  for (const [frecuencia, visitas] of TABLA) {
    const anuales = 10 * visitas;
    assert.ok(Math.abs(calcHSemProrr(turno(frecuencia)) * 52 - anuales) < 0.26 * 1, `${frecuencia} semanal`);
    assert.ok(Math.abs(calcHMesProrr(turno(frecuencia)) * 12 - anuales) < 0.06 * 1, `${frecuencia} mensual`);
  }
});

test('jardín cuenta 27 visitas al año, sea cual sea su frecuencia', () => {
  for (const frecuencia of ['semanal', 'mensual', 'anual', undefined]) {
    const t = turno(frecuencia, 10, { tipo_tarea: 'jardin' });
    assert.equal(calcHSemProrr(t), 5.19);
    assert.equal(calcHMesProrr(t), 22.5);
  }
});

test('sin horas por semana (0, vacío, null o ausente) el resultado es 0', () => {
  for (const horas_semana of [0, null, undefined]) {
    const t = { frecuencia: 'mensual', horas_semana };
    assert.equal(calcHSemProrr(t), 0);
    assert.equal(calcHMesProrr(t), 0);
  }
  assert.equal(calcHSemProrr({ frecuencia: 'mensual' }), 0);
});

test('una frecuencia ausente o desconocida se trata como semanal', () => {
  for (const frecuencia of [undefined, null, 'diaria', '']) {
    assert.equal(calcHSemProrr(turno(frecuencia)), 10);
    assert.equal(calcHMesProrr(turno(frecuencia)), 43.33);
  }
});

test('el resultado se redondea a dos decimales', () => {
  assert.equal(calcHSemProrr(turno('mensual', 7)), 1.62);
  assert.equal(calcHMesProrr(turno('semanal', 7)), 30.33);
});

test('admite horas con decimales', () => {
  assert.equal(calcHSemProrr(turno('quincenal', 2.5)), 1.25);
  assert.equal(calcHMesProrr(turno('mensual', 2.5)), 2.5);
});

test('una visita al mes aporta siempre las mismas horas al mes, y semanal las de 52 semanas entre 12', () => {
  assert.equal(calcHMesProrr(turno('mensual', 4)), 4);
  assert.equal(calcHMesProrr(turno('semanal', 12)), 52);
});

test('la versión del cliente (constants/tareas.js) da los mismos resultados que la del servidor', async () => {
  const cliente = await import('../client/src/constants/tareas.js');
  assert.equal(cliente.SEMANAS_AÑO, SEMANAS_AÑO);
  const casos = [
    ...TABLA.map(([f]) => turno(f)),
    turno('mensual', 7), turno('semanal', 2.5), turno('anual', 0), turno(undefined),
    turno('semanal', 10, { tipo_tarea: 'jardin' }), turno('anual', 3, { tipo_tarea: 'jardin' }),
  ];
  for (const t of casos) {
    assert.equal(cliente.calcHSemProrr(t), calcHSemProrr(t), JSON.stringify(t));
    assert.equal(cliente.calcHMesProrr(t), calcHMesProrr(t), JSON.stringify(t));
  }
});
