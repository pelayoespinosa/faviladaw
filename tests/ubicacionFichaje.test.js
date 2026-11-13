const test = require('node:test');
const assert = require('node:assert/strict');

const cargar = () => import('../client/src/utils/ubicacionFichaje.js');
const punto = (estado, sospecha) => ({ lat: 43.36, lng: -5.85, validacion: { estado, ...(sospecha ? { sospecha } : {}) } });
const fichaje = (entrada, salida, extra = {}) => ({ estado: salida ? 'cerrado' : 'abierto', entrada, salida, ...extra });

test('un fichaje sin validación (antiguo o manual) no tiene incidencia', async () => {
  const { incidenciaDe } = await cargar();
  assert.deepEqual(incidenciaDe(fichaje({ lat: 1, lng: 1 })), { zona: null, sospecha: 'ninguna', motivos: [], hay: false });
});

test('dentro y sin sospecha no es incidencia', async () => {
  const { incidenciaDe } = await cargar();
  const r = incidenciaDe(fichaje(punto('dentro', { nivel: 'ninguna', motivos: [] })));
  assert.equal(r.hay, false);
  assert.equal(r.zona, 'dentro');
});

test('sin_referencia no es incidencia: no hay con qué comparar', async () => {
  const { incidenciaDe } = await cargar();
  assert.equal(incidenciaDe(fichaje(punto('sin_referencia'))).hay, false);
});

test('fuera y dudoso son incidencia', async () => {
  const { incidenciaDe } = await cargar();
  assert.equal(incidenciaDe(fichaje(punto('fuera'))).hay, true);
  assert.equal(incidenciaDe(fichaje(punto('dudoso'))).hay, true);
});

test('la zona del fichaje es la peor entre entrada y salida', async () => {
  const { incidenciaDe } = await cargar();
  assert.equal(incidenciaDe(fichaje(punto('dentro'), punto('fuera'))).zona, 'fuera');
  assert.equal(incidenciaDe(fichaje(punto('dudoso'), punto('dentro'))).zona, 'dudoso');
  assert.equal(incidenciaDe(fichaje(punto('fuera'), punto('dudoso'))).zona, 'fuera');
});

test('la sospecha es la peor de las dos y junta los motivos sin repetirlos', async () => {
  const { incidenciaDe } = await cargar();
  const r = incidenciaDe(fichaje(
    punto('dentro', { nivel: 'baja', motivos: ['posicion_antigua'] }),
    punto('dentro', { nivel: 'alta', motivos: ['viaje_imposible', 'posicion_antigua'] }),
  ));
  assert.equal(r.sospecha, 'alta');
  assert.deepEqual(r.motivos, ['posicion_antigua', 'viaje_imposible']);
  assert.equal(r.hay, true);
});

test('una sospecha baja con la zona en orden sigue siendo incidencia', async () => {
  const { incidenciaDe } = await cargar();
  assert.equal(incidenciaDe(fichaje(punto('dentro', { nivel: 'baja', motivos: ['precision_artificial'] }))).hay, true);
});

test('un fichaje anulado nunca cuenta como incidencia', async () => {
  const { incidenciaDe } = await cargar();
  assert.equal(incidenciaDe(fichaje(punto('fuera'), undefined, { estado: 'anulado' })).hay, false);
});

test('el filtro: todos, incidencias, fuera de zona y sospechosos', async () => {
  const { coincideConFiltro } = await cargar();
  const fuera = fichaje(punto('fuera'));
  const dudoso = fichaje(punto('dudoso'));
  const sospechoso = fichaje(punto('dentro', { nivel: 'baja', motivos: ['precision_artificial'] }));
  const limpio = fichaje(punto('dentro', { nivel: 'ninguna', motivos: [] }));
  const lista = [fuera, dudoso, sospechoso, limpio];
  assert.equal(lista.filter(f => coincideConFiltro(f, 'todos')).length, 4);
  assert.deepEqual(lista.filter(f => coincideConFiltro(f, 'incidencias')), [fuera, dudoso, sospechoso]);
  assert.deepEqual(lista.filter(f => coincideConFiltro(f, 'fuera')), [fuera]);
  assert.deepEqual(lista.filter(f => coincideConFiltro(f, 'sospechosos')), [sospechoso]);
});

test('los motivos tienen una descripción legible', async () => {
  const { MOTIVOS_SOSPECHA } = await cargar();
  for (const m of ['viaje_imposible', 'posicion_antigua', 'coordenadas_identicas', 'precision_artificial']) {
    assert.ok(MOTIVOS_SOSPECHA[m], m);
  }
});

test('resumen del mes: cuenta cada fichaje una vez según su peor zona', async () => {
  const { resumenUbicacion } = await cargar();
  const lista = [
    fichaje(punto('dentro'), punto('dentro')),
    fichaje(punto('dentro'), punto('fuera')),
    fichaje(punto('dudoso')),
    fichaje(punto('sin_referencia')),
    fichaje({ lat: 1, lng: 1 }),
  ];
  assert.deepEqual(resumenUbicacion(lista), { total: 5, dentro: 1, dudoso: 1, fuera: 1, sin_referencia: 1, sin_validar: 1, sospechosos: 0, justificados: 0 });
});

test('resumen del mes: cuenta sospechosos y justificados, e ignora los anulados', async () => {
  const { resumenUbicacion } = await cargar();
  const lista = [
    fichaje(punto('dentro', { nivel: 'alta', motivos: ['viaje_imposible'] })),
    fichaje(punto('fuera'), undefined, { justificacion: { motivo: 'cubría' } }),
    fichaje(punto('fuera'), undefined, { estado: 'anulado' }),
  ];
  const r = resumenUbicacion(lista);
  assert.equal(r.total, 2);
  assert.equal(r.sospechosos, 1);
  assert.equal(r.justificados, 1);
  assert.equal(r.fuera, 1);
});

test('resumen del mes: sin fichajes todo es cero', async () => {
  const { resumenUbicacion } = await cargar();
  assert.deepEqual(resumenUbicacion([]), { total: 0, dentro: 0, dudoso: 0, fuera: 0, sin_referencia: 0, sin_validar: 0, sospechosos: 0, justificados: 0 });
});
