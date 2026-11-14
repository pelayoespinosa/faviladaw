const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('fs');
const path = require('path');
const Documento = require('../src/models/Documento');
const Empleado = require('../src/models/Empleado');
const { huellaSha256 } = require('../src/utils/huella');

const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const SHA_VACIO = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const EMPLEADO = '64b7f0f0f0f0f0f0f0f0f0f0';
const carpeta = path.join(__dirname, '../uploads/documentos');
const pdf = contenido => Buffer.from(`%PDF-1.4\n${contenido}`);

function archivoDeTest(t, contenido) {
  const nombre = `test-huella-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  const ruta = path.join(carpeta, nombre);
  fs.writeFileSync(ruta, contenido);
  t.after(() => fs.rmSync(ruta, { force: true }));
  return { nombre, ruta };
}

function servidor(t, rol = 'empleado') {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'u1', empleadoId: EMPLEADO, rol }; next(); });
  app.use('/', require('../src/routes/documentos'));
  const srv = app.listen(0);
  t.after(() => srv.close());
  return srv.address().port;
}

function documento(nombre, extra = {}) {
  const d = new Documento({
    titulo: 'Protocolo', nombre_archivo_original: 'protocolo.pdf', nombre_archivo_storage: nombre,
    requiere_confirmacion: true, confirmaciones: [{ empleado: EMPLEADO }], ...extra,
  });
  d.save = async function () { return this; };
  return d;
}

const confirmar = async port => {
  const r = await fetch(`http://127.0.0.1:${port}/x/confirmar`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recibido: true, conforme: true }),
  });
  return { status: r.status, cuerpo: await r.json() };
};

test('huellaSha256 da el SHA-256 conocido de un archivo', async t => {
  const { ruta } = archivoDeTest(t, 'abc');
  assert.equal(await huellaSha256(ruta), SHA_ABC);
});

test('huellaSha256 de un archivo vacío es la huella del vacío', async t => {
  const { ruta } = archivoDeTest(t, '');
  assert.equal(await huellaSha256(ruta), SHA_VACIO);
});

test('huellaSha256 falla si el archivo no existe', async () => {
  await assert.rejects(huellaSha256(path.join(carpeta, 'no-existe.pdf')), { code: 'ENOENT' });
});

test('al confirmar se guarda la huella del archivo en la confirmación', async t => {
  const { nombre, ruta } = archivoDeTest(t, pdf('contenido'));
  const doc = documento(nombre);
  t.mock.method(Documento, 'findById', async () => doc);
  const { status } = await confirmar(servidor(t));
  assert.equal(status, 200);
  assert.equal(doc.confirmaciones[0].huella_sha256, await huellaSha256(ruta));
  assert.match(doc.confirmaciones[0].huella_sha256, /^[0-9a-f]{64}$/);
  assert.equal(doc.confirmaciones[0].conforme, true);
});

test('un documento anterior sin huella guardada también se puede confirmar', async t => {
  const { nombre } = archivoDeTest(t, pdf('antiguo'));
  const doc = documento(nombre);
  assert.equal(doc.huella_sha256, undefined);
  t.mock.method(Documento, 'findById', async () => doc);
  assert.equal((await confirmar(servidor(t))).status, 200);
  assert.ok(doc.confirmaciones[0].huella_sha256);
});

test('si el archivo ya no coincide con la huella del documento, no se confirma', async t => {
  const { nombre } = archivoDeTest(t, pdf('modificado'));
  const doc = documento(nombre, { huella_sha256: SHA_ABC });
  t.mock.method(Documento, 'findById', async () => doc);
  const { status, cuerpo } = await confirmar(servidor(t));
  assert.equal(status, 409);
  assert.match(cuerpo.error, /ha cambiado/);
  assert.equal(doc.confirmaciones[0].conforme, false);
  assert.equal(doc.confirmaciones[0].huella_sha256, undefined);
});

test('si la huella del documento coincide con el archivo, se confirma', async t => {
  const { nombre, ruta } = archivoDeTest(t, pdf('intacto'));
  const doc = documento(nombre, { huella_sha256: await huellaSha256(ruta) });
  t.mock.method(Documento, 'findById', async () => doc);
  assert.equal((await confirmar(servidor(t))).status, 200);
});

test('si el archivo no existe en el servidor, no se confirma', async t => {
  const doc = documento('no-existe-nunca.pdf');
  t.mock.method(Documento, 'findById', async () => doc);
  const { status } = await confirmar(servidor(t));
  assert.equal(status, 404);
  assert.equal(doc.confirmaciones[0].conforme, false);
});

test('una segunda confirmación no cambia la huella ya registrada', async t => {
  const { nombre } = archivoDeTest(t, pdf('doble'));
  const doc = documento(nombre);
  t.mock.method(Documento, 'findById', async () => doc);
  const port = servidor(t);
  await confirmar(port);
  const primera = doc.confirmaciones[0].huella_sha256;
  assert.equal((await confirmar(port)).status, 400);
  assert.equal(doc.confirmaciones[0].huella_sha256, primera);
});

test('al subir un documento se calcula y guarda su huella', async t => {
  let creado;
  t.mock.method(Empleado, 'find', async () => [{ _id: EMPLEADO }]);
  t.mock.method(Documento, 'create', async d => { creado = d; return d; });
  const contenido = pdf('subida');
  const form = new FormData();
  form.append('archivo', new Blob([contenido], { type: 'application/pdf' }), 'norma.pdf');
  form.append('titulo', 'Norma');
  form.append('tipo_destinatario', 'todos');
  form.append('requiere_confirmacion', 'true');
  const r = await fetch(`http://127.0.0.1:${servidor(t, 'admin')}/`, { method: 'POST', body: form });
  t.after(() => creado && fs.rmSync(path.join(carpeta, creado.nombre_archivo_storage), { force: true }));
  assert.equal(r.status, 200);
  assert.equal(creado.huella_sha256, require('crypto').createHash('sha256').update(contenido).digest('hex'));
});
