const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Cliente = require('../src/models/Cliente');
const { validarUbicacion } = require('../src/utils/validacionUbicacion');

const base = { nif: 'B33000000', nombre: 'Comunidad Uría 5' };
const errorRadio = c => new Cliente({ ...base, ...c }).validateSync()?.errors.radio_validacion_m;

test('un cliente sin radio propio lo deja vacío para usar el de por defecto', () => {
  const c = new Cliente(base);
  assert.equal(c.radio_validacion_m, null);
  assert.equal(c.validateSync(), undefined);
});

test('acepta radios entre 20 y 1000 m', () => {
  for (const radio of [20, 150, 300, 1000]) assert.equal(errorRadio({ radio_validacion_m: radio }), undefined);
});

test('rechaza radios demasiado pequeños o demasiado grandes', () => {
  assert.ok(errorRadio({ radio_validacion_m: 19 }));
  assert.ok(errorRadio({ radio_validacion_m: 1001 }));
  assert.ok(errorRadio({ radio_validacion_m: -50 }));
});

test('convierte un radio escrito como texto en número', () => {
  assert.equal(new Cliente({ ...base, radio_validacion_m: '250' }).radio_validacion_m, 250);
});

test('el radio vacío (null) cae en el de por defecto al validar la ubicación', () => {
  const posicion = { lat: 43.36 + 200 / 111194.93, lng: -5.85, precision: 5 };
  const sinRadio = { lat: 43.36, lng: -5.85, radio_validacion_m: null };
  const conRadio = { lat: 43.36, lng: -5.85, radio_validacion_m: 300 };
  assert.equal(validarUbicacion({ posicion, referencias: [sinRadio] }).radio_m, 150);
  assert.equal(validarUbicacion({ posicion, referencias: [sinRadio] }).estado, 'fuera');
  assert.equal(validarUbicacion({ posicion, referencias: [conRadio] }).radio_m, 300);
  assert.equal(validarUbicacion({ posicion, referencias: [conRadio] }).estado, 'dentro');
});

async function put(t, cuerpo, rol = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { rol }; next(); });
  app.use('/', require('../src/routes/clientes'));
  const srv = app.listen(0);
  t.after(() => srv.close());
  const guardado = [];
  t.mock.method(Cliente, 'findByIdAndUpdate', async (id, update) => { guardado.push(update); return { _id: id }; });
  const r = await fetch(`http://127.0.0.1:${srv.address().port}/abc123`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return { status: r.status, update: guardado[0] };
}

test('la ruta PUT guarda el radio de validación', async t => {
  const { status, update } = await put(t, { nombre: 'Comunidad Uría 5', radio_validacion_m: 300 });
  assert.equal(status, 200);
  assert.equal(update.$set.radio_validacion_m, 300);
});

test('la ruta PUT guarda un radio vacío como null', async t => {
  const { update } = await put(t, { radio_validacion_m: '' });
  assert.equal(update.$set.radio_validacion_m, null);
});

test('solo el administrador puede cambiar el radio de un cliente', async t => {
  for (const rol of ['encargado', 'empleado', 'gestoria']) {
    const { status, update } = await put(t, { radio_validacion_m: 1000 }, rol);
    assert.equal(status, 403);
    assert.equal(update, undefined);
  }
});
