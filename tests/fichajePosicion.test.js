const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Fichaje = require('../src/models/Fichaje');
const Turno = require('../src/models/Turno');
const Cobertura = require('../src/models/Cobertura');

const base = { lat: 43.36, lng: -5.85, precision: 8 };
const completa = { ...base, altitud: 120.5, velocidad: 0, timestamp: Date.UTC(2026, 10, 9, 8, 0, 0) };

function servidor(t, abierto = null) {
  const cadena = () => ({ populate() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] });
  const guardados = [];
  t.mock.method(Fichaje, 'findOne', async () => abierto);
  t.mock.method(Fichaje, 'find', cadena);
  t.mock.method(Fichaje, 'create', async d => { guardados.push(d); return d; });
  t.mock.method(Turno, 'find', cadena);
  t.mock.method(Cobertura, 'find', cadena);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { empleadoId: 'e1', rol: 'empleado' }; next(); });
  app.use('/', require('../src/routes/fichajes'));
  const srv = app.listen(0);
  t.after(() => srv.close());
  return { port: srv.address().port, guardados };
}

async function post(port, ruta, cuerpo) {
  const r = await fetch(`http://127.0.0.1:${port}/${ruta}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: await r.json() };
}

test('la entrada guarda altitud, velocidad y marca de tiempo de la posición', async t => {
  const { port, guardados } = servidor(t);
  const { status } = await post(port, 'entrada', completa);
  assert.equal(status, 201);
  const punto = guardados[0].entrada;
  assert.equal(punto.altitud, 120.5);
  assert.equal(punto.velocidad, 0);
  assert.equal(punto.timestamp_posicion.toISOString(), '2026-11-09T08:00:00.000Z');
});

test('los datos que el móvil no da (null) se guardan como ausentes', async t => {
  const { port, guardados } = servidor(t);
  await post(port, 'entrada', { ...base, altitud: null, velocidad: null, timestamp: null });
  const punto = guardados[0].entrada;
  assert.equal(punto.altitud, undefined);
  assert.equal(punto.velocidad, undefined);
  assert.equal(punto.timestamp_posicion, undefined);
});

test('un cliente antiguo que no envía los campos nuevos sigue pudiendo fichar', async t => {
  const { port, guardados } = servidor(t);
  const { status } = await post(port, 'entrada', base);
  assert.equal(status, 201);
  assert.equal(guardados[0].entrada.altitud, undefined);
  assert.equal(guardados[0].entrada.precision, 8);
});

test('valores con tipo incorrecto se descartan en lugar de romper el fichaje', async t => {
  const { port, guardados } = servidor(t);
  const { status } = await post(port, 'entrada', { ...base, altitud: '120', velocidad: {}, timestamp: 1e20 });
  assert.equal(status, 201);
  const punto = guardados[0].entrada;
  assert.equal(punto.altitud, undefined);
  assert.equal(punto.velocidad, undefined);
  assert.equal(punto.timestamp_posicion, undefined);
});

test('sin latitud y longitud sigue respondiendo 400 UBICACION_REQUERIDA', async t => {
  const { port } = servidor(t);
  const { status, cuerpo } = await post(port, 'entrada', { altitud: 100, timestamp: Date.now() });
  assert.equal(status, 400);
  assert.equal(cuerpo.error_code, 'UBICACION_REQUERIDA');
});

test('la salida también guarda los datos de la posición', async t => {
  const abierto = new Fichaje({ empleado: '64b7f0f0f0f0f0f0f0f0f0f0', entrada: { ...base } });
  abierto.save = async function () { return this; };
  const { port } = servidor(t, abierto);
  const { status } = await post(port, 'salida', completa);
  assert.equal(status, 200);
  assert.equal(abierto.salida.altitud, 120.5);
  assert.equal(abierto.salida.velocidad, 0);
  assert.equal(abierto.salida.timestamp_posicion.toISOString(), '2026-11-09T08:00:00.000Z');
});

test('el modelo acepta los campos nuevos y los fichajes antiguos siguen siendo válidos', () => {
  const nuevo = new Fichaje({ empleado: '64b7f0f0f0f0f0f0f0f0f0f0', entrada: { ...base, altitud: 10, velocidad: 1.2, timestamp_posicion: new Date() } });
  const antiguo = new Fichaje({ empleado: '64b7f0f0f0f0f0f0f0f0f0f0', entrada: { ...base } });
  assert.equal(nuevo.validateSync(), undefined);
  assert.equal(antiguo.validateSync(), undefined);
});
