const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Fichaje = require('../src/models/Fichaje');
const Turno = require('../src/models/Turno');
const Cobertura = require('../src/models/Cobertura');
const { hoyEnMadrid, turnosEfectivosHoy, clientesDeTurnos } = require('../src/utils/turnosDeHoy');

const martes = new Date('2026-11-03T10:00:00Z');
const clienteA = { nombre: 'A', lat: 43.36, lng: -5.85 };
const clienteB = { nombre: 'B', lat: 43.5, lng: -5.7 };
const turno = (empleado, cliente, extra = {}) => ({ _id: `t-${empleado}`, empleado, cliente, dias_semana: ['martes'], frecuencia: 'semanal', ...extra });
const cobertura = (extra = {}) => ({ fecha: new Date('2026-11-03T00:00:00Z'), empleado_ausente: 'ausente', empleado_cubre: 'sustituto', ...extra });
const efectivos = (coberturas, turnos = []) => turnosEfectivosHoy({ empleadoId: 'sustituto', turnos, coberturas }, martes);

test('una cobertura de hoy con turno aporta el cliente de ese turno', () => {
  const r = efectivos([cobertura({ turno: turno('ausente', clienteA) })]);
  assert.deepEqual(clientesDeTurnos(r).map(c => c.nombre), ['A']);
});

test('una cobertura de otro día no aporta nada', () => {
  const r = efectivos([cobertura({ fecha: new Date('2026-11-02T00:00:00Z'), turno: turno('ausente', clienteA) })]);
  assert.equal(r.length, 0);
});

test('una cobertura que cubre a otra persona no aporta nada', () => {
  const r = efectivos([cobertura({ empleado_cubre: 'otro', turno: turno('ausente', clienteA) })]);
  assert.equal(r.length, 0);
});

test('si el empleado es el ausente, la cobertura no le aporta turnos', () => {
  const r = turnosEfectivosHoy({ empleadoId: 'ausente', turnos: [], coberturas: [cobertura({ turno: turno('ausente', clienteA) })] }, martes);
  assert.equal(r.length, 0);
});

test('una cobertura manual sin turno usa los turnos de hoy del ausente', () => {
  const turnos = [turno('ausente', clienteB), turno('ausente', clienteA, { dias_semana: ['jueves'] })];
  const r = efectivos([cobertura()], turnos);
  assert.deepEqual(clientesDeTurnos(r).map(c => c.nombre), ['B']);
});

test('el turno propio y el cubierto valen a la vez', () => {
  const r = efectivos([cobertura({ turno: turno('ausente', clienteA) })], [turno('sustituto', clienteB)]);
  assert.deepEqual(clientesDeTurnos(r).map(c => c.nombre).sort(), ['A', 'B']);
});

test('el día de la cobertura se interpreta en hora de Madrid', () => {
  const c = [cobertura({ turno: turno('ausente', clienteA) })];
  const tardeUTC = new Date('2026-11-03T23:30:00Z');
  assert.equal(turnosEfectivosHoy({ empleadoId: 'sustituto', turnos: [], coberturas: c }, tardeUTC).length, 0);
});

const M = 111194.93;
const { fecha, dia } = hoyEnMadrid();
const hoyUTC = new Date(`${fecha}T00:00:00.000Z`);

function servidor(t) {
  const router = require('../src/routes/fichajes');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { empleadoId: 'sustituto', rol: 'empleado' }; next(); });
  app.use('/', router);
  const srv = app.listen(0);
  t.after(() => srv.close());
  return srv.address().port;
}

function simular(t, { turnos = [], coberturas = [], coberturasFallan = false }) {
  const cadena = datos => ({ populate() { return this; }, lean: async () => datos() });
  t.mock.method(Fichaje, 'findOne', async () => null);
  t.mock.method(Fichaje, 'create', async d => d);
  t.mock.method(Cobertura, 'find', () => cadena(() => {
    if (coberturasFallan) throw new Error('mongo caído');
    return coberturas;
  }));
  t.mock.method(Turno, 'find', q => cadena(() => turnos.filter(x => q.empleado.$in.map(String).includes(String(x.empleado)))));
  t.mock.method(console, 'error', () => {});
}

async function ficharEntrada(port, lat, lng) {
  const r = await fetch(`http://127.0.0.1:${port}/entrada`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat, lng, precision: 8 }),
  });
  return { status: r.status, cuerpo: await r.json() };
}

const turnoHoy = (empleado, cliente, extra = {}) => ({ _id: `t-${empleado}`, empleado, cliente, dias_semana: [dia], frecuencia: 'semanal', ...extra });

test('un sustituto que ficha en el cliente que cubre sale dentro', async t => {
  simular(t, { coberturas: [{ fecha: hoyUTC, empleado_ausente: 'ausente', empleado_cubre: 'sustituto', turno: turnoHoy('ausente', clienteA) }] });
  const { status, cuerpo } = await ficharEntrada(servidor(t), clienteA.lat, clienteA.lng);
  assert.equal(status, 201);
  assert.equal(cuerpo.entrada.validacion.estado, 'dentro');
});

test('un sustituto que ficha lejos del cliente que cubre sale fuera', async t => {
  simular(t, { coberturas: [{ fecha: hoyUTC, empleado_ausente: 'ausente', empleado_cubre: 'sustituto', turno: turnoHoy('ausente', clienteA) }] });
  const { cuerpo } = await ficharEntrada(servidor(t), clienteA.lat + 5000 / M, clienteA.lng);
  assert.equal(cuerpo.entrada.validacion.estado, 'fuera');
});

test('con una cobertura manual se valida contra el cliente del ausente', async t => {
  simular(t, {
    coberturas: [{ fecha: hoyUTC, empleado_ausente: 'ausente', empleado_cubre: 'sustituto' }],
    turnos: [turnoHoy('ausente', clienteB)],
  });
  const { cuerpo } = await ficharEntrada(servidor(t), clienteB.lat, clienteB.lng);
  assert.equal(cuerpo.entrada.validacion.estado, 'dentro');
});

test('sin cobertura ni turno propio el sustituto sale sin_referencia con motivo sin_turno', async t => {
  simular(t, {});
  const { status, cuerpo } = await ficharEntrada(servidor(t), clienteA.lat, clienteA.lng);
  assert.equal(status, 201);
  assert.equal(cuerpo.entrada.validacion.estado, 'sin_referencia');
  assert.equal(cuerpo.entrada.validacion.motivo, 'sin_turno');
});

test('si cubre un turno de furgoneta sale sin_referencia con motivo turno_furgoneta', async t => {
  simular(t, { coberturas: [{ fecha: hoyUTC, empleado_ausente: 'ausente', empleado_cubre: 'sustituto', turno: turnoHoy('ausente', undefined, { furgoneta: 'f1' }) }] });
  const { cuerpo } = await ficharEntrada(servidor(t), clienteA.lat, clienteA.lng);
  assert.equal(cuerpo.entrada.validacion.motivo, 'turno_furgoneta');
});

test('si falla la consulta de coberturas el fichaje se guarda sin validación', async t => {
  simular(t, { coberturasFallan: true });
  const { status, cuerpo } = await ficharEntrada(servidor(t), clienteA.lat, clienteA.lng);
  assert.equal(status, 201);
  assert.equal(cuerpo.entrada.validacion, undefined);
});
