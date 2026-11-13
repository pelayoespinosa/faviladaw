const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Fichaje = require('../src/models/Fichaje');
const Turno = require('../src/models/Turno');
const Cobertura = require('../src/models/Cobertura');

const base = { lat: 43.36, lng: -5.85, precision: 8 };
const sospecha = { nivel: 'alta', motivos: ['viaje_imposible'] };
const conSospecha = () => ({ ...base, fecha_hora: new Date('2026-11-09T08:00:00Z'), validacion: { estado: 'fuera', distancia_m: 400, radio_m: 150, sospecha } });

const nuevoFichaje = () => new Fichaje({
  empleado: '64b7f0f0f0f0f0f0f0f0f0f0',
  entrada: conSospecha(),
  salida: conSospecha(),
  estado: 'cerrado',
  modificaciones: [{ motivo: 'corrección', entrada_anterior: conSospecha() }],
});

function servidor(t, rol, { abierto = null, lista = [] } = {}) {
  const vacia = () => ({ populate() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] });
  t.mock.method(Fichaje, 'findOne', async () => abierto);
  t.mock.method(Fichaje, 'create', async d => new Fichaje(d));
  t.mock.method(Fichaje, 'find', q => (q.estado && q['creado_manualmente.fecha'] ? vacia() : { populate() { return this; }, sort: async () => lista }));
  t.mock.method(Turno, 'find', vacia);
  t.mock.method(Cobertura, 'find', vacia);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'u1', empleadoId: '64b7f0f0f0f0f0f0f0f0f0f0', rol }; next(); });
  app.use('/', require('../src/routes/fichajes'));
  const srv = app.listen(0);
  t.after(() => srv.close());
  return srv.address().port;
}

const get = async (port, ruta) => (await fetch(`http://127.0.0.1:${port}/${ruta}`)).json();
const post = async (port, ruta, cuerpo) => (await fetch(`http://127.0.0.1:${port}/${ruta}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
})).json();

const sospechas = f => [f.entrada, f.salida, ...(f.modificaciones || []).flatMap(m => [m.entrada_anterior, m.salida_anterior])]
  .filter(p => p?.validacion).map(p => p.validacion.sospecha);

test('el empleado no recibe la sospecha en el listado, pero sí el resto de la validación', async t => {
  const [f] = await get(servidor(t, 'empleado', { lista: [nuevoFichaje()] }), '');
  assert.deepEqual(sospechas(f), [undefined, undefined, undefined]);
  assert.equal(f.entrada.validacion.estado, 'fuera');
  assert.equal(f.entrada.validacion.distancia_m, 400);
});

test('admin, encargado y gestoría sí reciben la sospecha', async t => {
  for (const rol of ['admin', 'encargado', 'gestoria']) {
    const [f] = await get(servidor(t, rol, { lista: [nuevoFichaje()] }), '');
    assert.deepEqual(f.entrada.validacion.sospecha, sospecha, rol);
    assert.equal(sospechas(f).length, 3, rol);
  }
});

test('el empleado no recibe la sospecha al consultar su fichaje abierto', async t => {
  const f = await get(servidor(t, 'empleado', { abierto: nuevoFichaje() }), 'estado');
  assert.equal(f.entrada.validacion.sospecha, undefined);
});

test('el empleado no recibe la sospecha en la respuesta de entrada', async t => {
  const f = await post(servidor(t, 'empleado'), 'entrada', { ...base, timestamp: Date.now() - 5 * 60e3 });
  assert.equal(f.entrada.validacion.estado, 'sin_referencia');
  assert.equal(f.entrada.validacion.sospecha, undefined);
});

test('el encargado sí recibe la sospecha en la respuesta de entrada', async t => {
  const f = await post(servidor(t, 'encargado'), 'entrada', { ...base, timestamp: Date.now() - 5 * 60e3 });
  assert.deepEqual(f.entrada.validacion.sospecha, { nivel: 'baja', motivos: ['posicion_antigua'] });
});

test('el empleado no recibe la sospecha en la respuesta de salida', async t => {
  const abierto = new Fichaje({ empleado: '64b7f0f0f0f0f0f0f0f0f0f0', entrada: { ...base } });
  abierto.save = async function () { return this; };
  const f = await post(servidor(t, 'empleado', { abierto }), 'salida', { ...base, timestamp: Date.now() - 5 * 60e3 });
  assert.equal(f.salida.validacion.sospecha, undefined);
  assert.equal(f.estado, 'cerrado');
});

test('ocultar la sospecha no la borra del fichaje guardado', async t => {
  const original = nuevoFichaje();
  await get(servidor(t, 'empleado', { lista: [original] }), '');
  assert.deepEqual(original.entrada.validacion.sospecha.toObject(), sospecha);
});
