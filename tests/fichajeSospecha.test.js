const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Fichaje = require('../src/models/Fichaje');
const Turno = require('../src/models/Turno');
const Cobertura = require('../src/models/Cobertura');

const M_POR_KM_LAT = 111.19493;
const base = { lat: 43.36, lng: -5.85, precision: 8 };
const lejos = { ...base, lat: 43.36 + 100 / M_POR_KM_LAT };
const hace = (minutos, extra = {}) => ({ lat: 43.36, lng: -5.85, precision: 12, fecha_hora: new Date(Date.now() - minutos * 60e3), ...extra });

function servidor(t, { historial = [], abierto = null, historialFalla = false } = {}) {
  const vacia = () => ({ populate() { return this; }, lean: async () => [] });
  const consultas = [];
  const guardados = [];
  t.mock.method(Fichaje, 'findOne', async () => abierto);
  t.mock.method(Fichaje, 'create', async d => { guardados.push(d); return d; });
  t.mock.method(Fichaje, 'find', q => {
    consultas.push(q);
    return { sort() { return this; }, limit() { return this; }, lean: async () => { if (historialFalla) throw new Error('mongo caído'); return historial; } };
  });
  t.mock.method(Turno, 'find', vacia);
  t.mock.method(Cobertura, 'find', vacia);
  t.mock.method(console, 'error', () => {});
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { empleadoId: 'e1', rol: 'empleado' }; next(); });
  app.use('/', require('../src/routes/fichajes'));
  const srv = app.listen(0);
  t.after(() => srv.close());
  return { port: srv.address().port, guardados, consultas };
}

async function post(port, ruta, cuerpo) {
  const r = await fetch(`http://127.0.0.1:${port}/${ruta}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: await r.json() };
}

const fichajeCon = (entrada, salida) => ({ entrada, salida });

test('un fichaje normal guarda sospecha ninguna', async t => {
  const { port, guardados } = servidor(t, { historial: [fichajeCon(hace(600, { lat: 43.361 }), hace(540, { lat: 43.3601 }))] });
  const { status } = await post(port, 'entrada', { ...base, timestamp: Date.now() });
  assert.equal(status, 201);
  assert.deepEqual(guardados[0].entrada.validacion.sospecha, { nivel: 'ninguna', motivos: [] });
});

test('un viaje imposible desde la última salida guarda sospecha alta', async t => {
  const { port, guardados } = servidor(t, { historial: [fichajeCon(hace(600), hace(10))] });
  await post(port, 'entrada', { ...lejos, timestamp: Date.now() });
  assert.deepEqual(guardados[0].entrada.validacion.sospecha, { nivel: 'alta', motivos: ['viaje_imposible'] });
});

test('se compara con el punto más reciente aunque sea la entrada de otro fichaje y la salida de otro más antiguo', async t => {
  const historial = [fichajeCon(hace(10, { lat: 44.5 }), undefined), fichajeCon(hace(900), hace(800, { lat: 44.5 }))];
  const { port, guardados } = servidor(t, { historial });
  await post(port, 'entrada', { ...base, timestamp: Date.now() });
  assert.equal(guardados[0].entrada.validacion.sospecha.nivel, 'alta');
});

test('una posición con marca de tiempo antigua guarda sospecha baja', async t => {
  const { port, guardados } = servidor(t);
  await post(port, 'entrada', { ...base, timestamp: Date.now() - 5 * 60e3 });
  assert.deepEqual(guardados[0].entrada.validacion.sospecha, { nivel: 'baja', motivos: ['posicion_antigua'] });
});

test('la salida también guarda la sospecha y compara con la entrada del mismo fichaje', async t => {
  const abierto = new Fichaje({ empleado: '64b7f0f0f0f0f0f0f0f0f0f0', entrada: hace(10) });
  abierto.save = async function () { return this; };
  const { port } = servidor(t, { abierto, historial: [{ entrada: abierto.entrada.toObject() }] });
  const { status } = await post(port, 'salida', { ...lejos, timestamp: Date.now() });
  assert.equal(status, 200);
  assert.deepEqual(abierto.salida.validacion.sospecha.toObject(), { nivel: 'alta', motivos: ['viaje_imposible'] });
});

test('el historial excluye los fichajes anulados y los creados a mano', async t => {
  const { port, consultas } = servidor(t);
  await post(port, 'entrada', base);
  const q = consultas[0];
  assert.equal(String(q.empleado), 'e1');
  assert.deepEqual(q.estado, { $ne: 'anulado' });
  assert.deepEqual(q['creado_manualmente.fecha'], { $exists: false });
});

test('los puntos sin ubicación o sin hora del historial se ignoran', async t => {
  const historial = [fichajeCon({ fecha_hora: hace(5) }, { lat: 43.36, lng: -5.85 })];
  const { port, guardados } = servidor(t, { historial });
  await post(port, 'entrada', { ...lejos, timestamp: Date.now() });
  assert.equal(guardados[0].entrada.validacion.sospecha.nivel, 'ninguna');
});

test('si falla la consulta del historial el fichaje se guarda igual, con su validación y sin sospecha', async t => {
  const { port, guardados } = servidor(t, { historialFalla: true });
  const { status } = await post(port, 'entrada', { ...base, timestamp: Date.now() });
  assert.equal(status, 201);
  assert.equal(guardados[0].entrada.validacion.estado, 'sin_referencia');
  assert.equal(guardados[0].entrada.validacion.sospecha, undefined);
});

test('la sospecha nunca bloquea: un viaje imposible se registra y el fichaje se crea', async t => {
  const { port, guardados } = servidor(t, { historial: [fichajeCon(hace(600), hace(10))] });
  const { status } = await post(port, 'entrada', { ...lejos, timestamp: Date.now() });
  assert.equal(status, 201);
  assert.equal(guardados.length, 1);
});

test('el modelo acepta la sospecha y rechaza un nivel desconocido', () => {
  const ok = new Fichaje({ empleado: '64b7f0f0f0f0f0f0f0f0f0f0', entrada: { ...base, validacion: { estado: 'dentro', sospecha: { nivel: 'baja', motivos: ['posicion_antigua'] } } } });
  const mal = new Fichaje({ empleado: '64b7f0f0f0f0f0f0f0f0f0f0', entrada: { ...base, validacion: { estado: 'dentro', sospecha: { nivel: 'enorme' } } } });
  assert.equal(ok.validateSync(), undefined);
  assert.ok(mal.validateSync());
});

test('los puntos del historial se ordenan por hora aunque el fichaje traiga la salida antes que la entrada', async t => {
  const historial = [fichajeCon(hace(10, { lat: 43.36 + 100 / M_POR_KM_LAT, lng: -5.85 }), hace(30, { lat: 43.36, lng: -5.85 }))];
  const { port, guardados } = servidor(t, { historial });
  await post(port, 'entrada', { ...lejos, lat: 43.36 + 100 / M_POR_KM_LAT + 0.0003, timestamp: Date.now() });
  assert.equal(guardados[0].entrada.validacion.sospecha.nivel, 'ninguna');
});
