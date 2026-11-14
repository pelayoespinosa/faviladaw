const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const ExcelJS = require('exceljs');
const Documento = require('../src/models/Documento');
const { filasConfirmaciones, datosJustificante, estadoDe } = require('../src/utils/registroConfirmaciones');

const HUELLA = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const YO = '64b7f0f0f0f0f0f0f0f0f0f0';
const OTRO = '64b7f0f0f0f0f0f0f0f0f0f1';
const persona = (id, nombre, dni) => ({ _id: id, nombre, apellidos: 'Pérez', dni });

function documento() {
  return {
    titulo: 'Protocolo de seguridad', nombre_archivo_original: 'protocolo.pdf', nombre_archivo_storage: 'x.pdf',
    confirmaciones: [
      { empleado: persona(YO, 'Ana', '11111111A'), recibido: true, conforme: true, fecha_recibido: new Date('2026-11-10T09:00:00Z'), fecha_conforme: new Date('2026-11-10T09:01:00Z'), huella_sha256: HUELLA },
      { empleado: persona(OTRO, 'Luis', '22222222B'), recibido: true, conforme: false, fecha_recibido: new Date('2026-11-10T10:00:00Z') },
    ],
  };
}

function servidor(t, doc, rol = 'empleado') {
  t.mock.method(Documento, 'findById', () => ({ populate: async () => doc }));
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'u1', empleadoId: YO, rol }; next(); });
  app.use('/', require('../src/routes/documentos'));
  const srv = app.listen(0);
  t.after(() => srv.close());
  return srv.address().port;
}

const pedir = (port, ruta) => fetch(`http://127.0.0.1:${port}/${ruta}`);

test('estadoDe distingue confirmado, recibido sin conformidad y pendiente', () => {
  assert.equal(estadoDe({ recibido: true, conforme: true }), 'Confirmado');
  assert.equal(estadoDe({ recibido: true, conforme: false }), 'Recibido, sin conformidad');
  assert.equal(estadoDe({ recibido: false, conforme: false }), 'Pendiente');
});

test('las filas del registro incluyen empleado, DNI, estado, fechas y huella', () => {
  const filas = filasConfirmaciones(documento());
  assert.equal(filas.length, 2);
  assert.deepEqual({ ...filas[0], fecha_recibido: undefined, fecha_conforme: undefined }, {
    empleado: 'Ana Pérez', dni: '11111111A', estado: 'Confirmado', fecha_recibido: undefined, fecha_conforme: undefined, huella: HUELLA,
  });
  assert.equal(filas[1].estado, 'Recibido, sin conformidad');
  assert.equal(filas[1].huella, '');
});

test('los datos del justificante recogen documento, archivo, fechas y huella', () => {
  const d = documento();
  const datos = datosJustificante(d, d.confirmaciones[0]);
  assert.equal(datos.empleado, 'Ana Pérez');
  assert.equal(datos.documento, 'Protocolo de seguridad');
  assert.equal(datos.archivo, 'protocolo.pdf');
  assert.equal(datos.huella, HUELLA);
  assert.equal(datos.tiene_huella, true);
});

test('un justificante de una confirmación sin huella lo dice claramente', () => {
  const d = documento();
  const c = { ...d.confirmaciones[0], huella_sha256: undefined };
  const datos = datosJustificante(d, c);
  assert.equal(datos.tiene_huella, false);
  assert.match(datos.huella, /No registrada/);
});

test('un empleado descarga su propio justificante en PDF', async t => {
  const r = await pedir(servidor(t, documento()), 'x/justificante');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
});

test('un empleado no puede pedir el justificante de otro compañero', async t => {
  const r = await pedir(servidor(t, documento()), `x/justificante?empleado=${OTRO}`);
  assert.equal(r.status, 403);
});

test('admin, encargado y gestoría pueden pedir el justificante de cualquiera que haya confirmado', async t => {
  for (const rol of ['admin', 'encargado', 'gestoria']) {
    const r = await pedir(servidor(t, documento(), rol), `x/justificante?empleado=${YO}`);
    assert.equal(r.status, 200, rol);
  }
});

test('no hay justificante si el empleado no ha confirmado del todo', async t => {
  const r = await pedir(servidor(t, documento(), 'admin'), `x/justificante?empleado=${OTRO}`);
  assert.equal(r.status, 400);
});

test('justificante de alguien que no es destinatario o de un documento inexistente: 404', async t => {
  const ajeno = await pedir(servidor(t, documento(), 'admin'), 'x/justificante?empleado=64b7f0f0f0f0f0f0f0f0f0f9');
  assert.equal(ajeno.status, 404);
  const inexistente = await pedir(servidor(t, null, 'admin'), 'x/justificante');
  assert.equal(inexistente.status, 404);
});

test('el registro de confirmaciones se exporta a Excel con una fila por empleado', async t => {
  const r = await pedir(servidor(t, documento(), 'gestoria'), 'x/confirmaciones/export');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /spreadsheetml/);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const hoja = libro.getWorksheet('Confirmaciones');
  const textos = [];
  hoja.eachRow(fila => textos.push(fila.values.filter(v => typeof v === 'string').join('|')));
  assert.ok(textos.some(x => x.includes('Ana Pérez') && x.includes('Confirmado') && x.includes(HUELLA)));
  assert.ok(textos.some(x => x.includes('Luis Pérez') && x.includes('Recibido, sin conformidad')));
  assert.ok(textos.some(x => x.includes('Protocolo de seguridad')));
});

test('el empleado no puede exportar el registro de confirmaciones', async t => {
  const r = await pedir(servidor(t, documento(), 'empleado'), 'x/confirmaciones/export');
  assert.equal(r.status, 403);
});
