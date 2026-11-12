const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Fichaje = require('../src/models/Fichaje');

const EMPLEADO = '64b7f0f0f0f0f0f0f0f0f0f0';
const USUARIO = '64b7f0f0f0f0f0f0f0f0f0f1';
const base = { lat: 43.36, lng: -5.85 };

function fichaje(validacion, extra = {}) {
  const f = new Fichaje({ empleado: EMPLEADO, entrada: { ...base, validacion }, ...extra });
  f.guardado = 0;
  f.save = async function () { this.guardado++; return this; };
  return f;
}

function servidor(t, doc, rol = 'admin') {
  t.mock.method(Fichaje, 'findById', async () => doc);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: USUARIO, empleadoId: 'e9', rol }; next(); });
  app.use('/', require('../src/routes/fichajes'));
  const srv = app.listen(0);
  t.after(() => srv.close());
  return srv.address().port;
}

async function justificar(port, cuerpo = { motivo: 'Cubría a una compañera en otra sede' }) {
  const r = await fetch(`http://127.0.0.1:${port}/x/justificar`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: await r.json() };
}

test('un admin justifica un fichaje fuera de zona con motivo', async t => {
  const f = fichaje({ estado: 'fuera' });
  const { status } = await justificar(servidor(t, f));
  assert.equal(status, 200);
  assert.equal(f.guardado, 1);
  assert.equal(f.justificacion.motivo, 'Cubría a una compañera en otra sede');
  assert.equal(String(f.justificacion.usuario), USUARIO);
  assert.ok(f.justificacion.fecha instanceof Date);
});

test('un encargado también puede justificar', async t => {
  const f = fichaje({ estado: 'dudoso' });
  assert.equal((await justificar(servidor(t, f, 'encargado'))).status, 200);
});

test('empleado y gestoría no pueden justificar (403)', async t => {
  for (const rol of ['empleado', 'gestoria']) {
    const f = fichaje({ estado: 'fuera' });
    assert.equal((await justificar(servidor(t, f, rol))).status, 403);
    assert.equal(f.guardado, 0);
  }
});

test('sin motivo o con solo espacios se rechaza', async t => {
  const f = fichaje({ estado: 'fuera' });
  const port = servidor(t, f);
  assert.equal((await justificar(port, {})).status, 400);
  assert.equal((await justificar(port, { motivo: '   ' })).status, 400);
  assert.equal(f.guardado, 0);
});

test('se puede justificar también una sospecha aunque la zona sea correcta', async t => {
  const f = fichaje({ estado: 'dentro', sospecha: { nivel: 'alta', motivos: ['viaje_imposible'] } });
  assert.equal((await justificar(servidor(t, f))).status, 200);
});

test('un fichaje sin incidencias no se puede justificar', async t => {
  for (const validacion of [{ estado: 'dentro', sospecha: { nivel: 'ninguna', motivos: [] } }, { estado: 'sin_referencia' }, undefined]) {
    const f = fichaje(validacion);
    const { status } = await justificar(servidor(t, f));
    assert.equal(status, 400);
    assert.equal(f.guardado, 0);
  }
});

test('la incidencia puede estar en la salida', async t => {
  const f = fichaje({ estado: 'dentro' }, { salida: { ...base, validacion: { estado: 'fuera' } } });
  assert.equal((await justificar(servidor(t, f))).status, 200);
});

test('no se justifica dos veces: la primera justificación se conserva', async t => {
  const f = fichaje({ estado: 'fuera' });
  const port = servidor(t, f);
  assert.equal((await justificar(port, { motivo: 'primera' })).status, 200);
  const segunda = await justificar(port, { motivo: 'segunda' });
  assert.equal(segunda.status, 400);
  assert.equal(f.justificacion.motivo, 'primera');
  assert.equal(f.guardado, 1);
});

test('un fichaje anulado no se justifica y uno inexistente da 404', async t => {
  const anulado = fichaje({ estado: 'fuera' }, { estado: 'anulado' });
  assert.equal((await justificar(servidor(t, anulado))).status, 400);
  const inexistente = servidor(t, null);
  assert.equal((await justificar(inexistente)).status, 404);
});

test('justificar no modifica la validación original', async t => {
  const f = fichaje({ estado: 'fuera', distancia_m: 400, radio_m: 150 });
  await justificar(servidor(t, f));
  assert.equal(f.entrada.validacion.estado, 'fuera');
  assert.equal(f.entrada.validacion.distancia_m, 400);
});
