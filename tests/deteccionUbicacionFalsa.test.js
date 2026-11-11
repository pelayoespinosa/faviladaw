const test = require('node:test');
const assert = require('node:assert/strict');
const { deteccionUbicacionFalsa } = require('../src/utils/deteccionUbicacionFalsa');

const AHORA = new Date('2026-11-11T09:00:00Z');
const segundos = s => new Date(AHORA.getTime() + s * 1000);

const punto = (extra = {}) => ({ lat: 43.36, lng: -5.85, precision: 8, fecha_hora: AHORA, timestamp_posicion: AHORA, ...extra });
const anterior = (extra = {}) => ({ lat: 43.37, lng: -5.84, precision: 12, fecha_hora: new Date(AHORA.getTime() - 3600e3), ...extra });
const detectar = (p, anteriores = []) => deteccionUbicacionFalsa({ punto: p, anteriores });

test('un fichaje normal no tiene ninguna señal', () => {
  assert.deepEqual(detectar(punto(), [anterior(), anterior(), anterior()]), { nivel: 'ninguna', motivos: [] });
});

test('posición antigua: hasta 60 s de diferencia es normal', () => {
  assert.equal(detectar(punto({ timestamp_posicion: segundos(-5) })).nivel, 'ninguna');
  assert.equal(detectar(punto({ timestamp_posicion: segundos(-60) })).nivel, 'ninguna');
});

test('posición antigua: más de 60 s de diferencia es una señal', () => {
  const r = detectar(punto({ timestamp_posicion: segundos(-61) }));
  assert.deepEqual(r, { nivel: 'baja', motivos: ['posicion_antigua'] });
});

test('posición antigua: una marca de tiempo adelantada más de 60 s también lo es', () => {
  assert.deepEqual(detectar(punto({ timestamp_posicion: segundos(120) })).motivos, ['posicion_antigua']);
});

test('posición antigua: sin marca de tiempo no se puede evaluar y no cuenta', () => {
  assert.equal(detectar(punto({ timestamp_posicion: undefined })).nivel, 'ninguna');
});

test('coordenadas idénticas: las mismas a seis decimales que el fichaje anterior', () => {
  const r = detectar(punto(), [anterior({ lat: 43.36, lng: -5.85 })]);
  assert.deepEqual(r, { nivel: 'baja', motivos: ['coordenadas_identicas'] });
});

test('coordenadas idénticas: dos puntos que redondean igual a seis decimales cuentan', () => {
  const r = detectar(punto({ lat: 43.3600001 }), [anterior({ lat: 43.3600004, lng: -5.85 })]);
  assert.deepEqual(r.motivos, ['coordenadas_identicas']);
});

test('coordenadas idénticas: una diferencia en el quinto decimal es un GPS normal', () => {
  const r = detectar(punto(), [anterior({ lat: 43.36001, lng: -5.85 })]);
  assert.equal(r.nivel, 'ninguna');
});

test('coordenadas idénticas: se comparan con los 3 últimos puntos, no con más', () => {
  const igual = anterior({ lat: 43.36, lng: -5.85 });
  assert.deepEqual(detectar(punto(), [anterior(), anterior(), igual]).motivos, ['coordenadas_identicas']);
  assert.equal(detectar(punto(), [anterior(), anterior(), anterior(), igual]).nivel, 'ninguna');
});

test('coordenadas idénticas: con precisión de 100 m o peor no se considera una señal', () => {
  const r = detectar(punto({ precision: 100 }), [anterior({ lat: 43.36, lng: -5.85 })]);
  assert.equal(r.nivel, 'ninguna');
});

test('coordenadas idénticas: sin fichajes anteriores no se puede evaluar', () => {
  assert.equal(detectar(punto(), []).nivel, 'ninguna');
});

test('precisión artificial: 0 y 1 m son una señal', () => {
  assert.deepEqual(detectar(punto({ precision: 0 })), { nivel: 'baja', motivos: ['precision_artificial'] });
  assert.deepEqual(detectar(punto({ precision: 1 })).motivos, ['precision_artificial']);
});

test('precisión artificial: 2 m es un valor posible de un GPS real', () => {
  assert.equal(detectar(punto({ precision: 2 })).nivel, 'ninguna');
});

test('precisión artificial: sin dato de precisión no cuenta', () => {
  assert.equal(detectar(punto({ precision: undefined })).nivel, 'ninguna');
});

test('precisión artificial: el mismo valor exacto en los 3 últimos puntos y en este, con menos de 10 m', () => {
  const previos = [5, 5, 5].map(precision => anterior({ precision }));
  assert.deepEqual(detectar(punto({ precision: 5 }), previos).motivos, ['precision_artificial']);
});

test('precisión artificial: si uno de los 3 anteriores difiere, no es constante', () => {
  const previos = [5, 6, 5].map(precision => anterior({ precision }));
  assert.equal(detectar(punto({ precision: 5 }), previos).nivel, 'ninguna');
});

test('precisión artificial: un valor repetido de 10 m o más es normal (ubicación por Wi-Fi)', () => {
  const previos = [15, 15, 15].map(precision => anterior({ precision }));
  assert.equal(detectar(punto({ precision: 15 }), previos).nivel, 'ninguna');
});

test('precisión artificial: con menos de 3 fichajes anteriores no se puede evaluar la constancia', () => {
  const previos = [5, 5].map(precision => anterior({ precision }));
  assert.equal(detectar(punto({ precision: 5 }), previos).nivel, 'ninguna');
});

test('dos señales a la vez dan sospecha alta, con los motivos en orden fijo', () => {
  const r = detectar(
    punto({ precision: 0, timestamp_posicion: segundos(-300) }),
    [anterior({ lat: 43.36, lng: -5.85 })],
  );
  assert.equal(r.nivel, 'alta');
  assert.deepEqual(r.motivos, ['posicion_antigua', 'coordenadas_identicas', 'precision_artificial']);
});

test('una sola señal da sospecha baja', () => {
  assert.equal(detectar(punto({ precision: 0 })).nivel, 'baja');
});
