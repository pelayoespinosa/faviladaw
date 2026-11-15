const test = require('node:test');
const assert = require('node:assert/strict');
const Turno = require('../src/models/Turno');
const PrecioServicio = require('../src/models/PrecioServicio');
const { facturacionPorCliente } = require('../src/utils/facturacion');

function simular(t, turnos, precios = []) {
  const consultas = [];
  t.mock.method(Turno, 'find', q => { consultas.push(q); return { select() { return this; }, lean: async () => turnos }; });
  t.mock.method(PrecioServicio, 'find', () => ({ lean: async () => precios }));
  return consultas;
}

const turno = (cliente, extra = {}) => ({ cliente, tipo_tarea: 'limpieza', frecuencia: 'semanal', horas_semana: 10, ...extra });
const precios = (...pares) => pares.map(([tipo_tarea, precio_hora]) => ({ tipo_tarea, precio_hora }));

test('un turno semanal de 10 h a 12 €/h: 43,33 h al mes y 519,96 €', async t => {
  simular(t, [turno('c1')], precios(['limpieza', 12]));
  const f = (await facturacionPorCliente()).get('c1');
  assert.deepEqual(f.lineas, [{ tipo_tarea: 'limpieza', horas_mes: 43.33, precio_hora: 12, importe: 519.96 }]);
  assert.equal(f.total, 519.96);
});

test('solo se piden turnos con cliente (los de furgoneta no se facturan)', async t => {
  const consultas = simular(t, []);
  await facturacionPorCliente();
  assert.deepEqual(consultas[0], { cliente: { $ne: null } });
});

test('varios turnos del mismo cliente y tipo se suman en una sola línea', async t => {
  simular(t, [turno('c1', { horas_semana: 10 }), turno('c1', { horas_semana: 5 })], precios(['limpieza', 10]));
  const { lineas, total } = (await facturacionPorCliente()).get('c1');
  assert.equal(lineas.length, 1);
  assert.equal(lineas[0].horas_mes, 65);
  assert.equal(total, 650);
});

test('tipos de tarea distintos del mismo cliente van en líneas separadas y el total las suma', async t => {
  simular(t, [turno('c1'), turno('c1', { tipo_tarea: 'cristales', horas_semana: 4, frecuencia: 'mensual' })], precios(['limpieza', 10], ['cristales', 25]));
  const { lineas, total } = (await facturacionPorCliente()).get('c1');
  assert.equal(lineas.length, 2);
  assert.equal(lineas.find(l => l.tipo_tarea === 'cristales').importe, 100);
  assert.equal(total, 433.3 + 100);
});

test('cada cliente tiene su propia facturación', async t => {
  simular(t, [turno('c1'), turno('c2', { horas_semana: 4, frecuencia: 'mensual' })], precios(['limpieza', 10]));
  const r = await facturacionPorCliente();
  assert.equal(r.size, 2);
  assert.equal(r.get('c1').total, 433.3);
  assert.equal(r.get('c2').total, 40);
});

test('el cliente puede venir como ObjectId y se agrupa por su texto', async t => {
  const id = { toString: () => 'abc', valueOf: () => 'abc' };
  simular(t, [turno(id), turno(id)], precios(['limpieza', 10]));
  const r = await facturacionPorCliente();
  assert.equal(r.size, 1);
  assert.ok(r.has('abc'));
});

test('un tipo de tarea sin precio definido factura 0 €, pero conserva las horas', async t => {
  simular(t, [turno('c1', { tipo_tarea: 'jardin', horas_semana: 10 })]);
  const { lineas, total } = (await facturacionPorCliente()).get('c1');
  assert.deepEqual(lineas, [{ tipo_tarea: 'jardin', horas_mes: 22.5, precio_hora: 0, importe: 0 }]);
  assert.equal(total, 0);
});

test('un turno sin tipo de tarea se factura como limpieza', async t => {
  simular(t, [turno('c1', { tipo_tarea: undefined, horas_semana: 4, frecuencia: 'mensual' })], precios(['limpieza', 10]));
  assert.equal((await facturacionPorCliente()).get('c1').lineas[0].tipo_tarea, 'limpieza');
});

test('los turnos sin horas no generan línea y un cliente sin horas no aparece', async t => {
  simular(t, [turno('c1', { horas_semana: 0 }), turno('c2', { horas_semana: undefined }), turno('c3', { horas_semana: null })], precios(['limpieza', 10]));
  assert.equal((await facturacionPorCliente()).size, 0);
});

test('un cliente con un turno con horas y otro sin ellas solo factura el primero', async t => {
  simular(t, [turno('c1', { horas_semana: 0 }), turno('c1', { horas_semana: 4, frecuencia: 'mensual' })], precios(['limpieza', 10]));
  const { lineas } = (await facturacionPorCliente()).get('c1');
  assert.equal(lineas.length, 1);
  assert.equal(lineas[0].horas_mes, 4);
});

test('las frecuencias no semanales se prorratean sobre 52 semanas', async t => {
  simular(t, [turno('c1', { frecuencia: 'trimestral', horas_semana: 12 })], precios(['limpieza', 10]));
  const { lineas } = (await facturacionPorCliente()).get('c1');
  assert.equal(lineas[0].horas_mes, 4);
  assert.equal(lineas[0].importe, 40);
});

test('las horas se suman antes de redondear el importe', async t => {
  simular(t, [turno('c1', { frecuencia: 'trimestral' }), turno('c1', { frecuencia: 'trimestral' }), turno('c1', { frecuencia: 'trimestral' })], precios(['limpieza', 7]));
  const { lineas } = (await facturacionPorCliente()).get('c1');
  assert.equal(lineas[0].horas_mes, 9.99);
  assert.equal(lineas[0].importe, 69.93);
});

test('sin turnos no hay facturación', async t => {
  simular(t, []);
  assert.equal((await facturacionPorCliente()).size, 0);
});

test('el importe se redondea una sola vez, al final, con las horas ya sumadas', async t => {
  const mensual = () => turno('c1', { frecuencia: 'mensual', horas_semana: 2.31 });
  simular(t, [mensual(), mensual(), mensual()], precios(['limpieza', 7.5]));
  const { lineas, total } = (await facturacionPorCliente()).get('c1');
  assert.equal(lineas[0].horas_mes, 6.93);
  assert.equal(lineas[0].importe, 51.97);
  assert.equal(total, 51.97);
});
