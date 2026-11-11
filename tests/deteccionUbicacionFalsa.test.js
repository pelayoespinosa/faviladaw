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

const M_POR_KM_LAT = 111.19493;
const alNorte = km => 43.36 + km / M_POR_KM_LAT;
const hace = (minutos, extra = {}) => anterior({ lat: 43.36, lng: -5.85, fecha_hora: new Date(AHORA.getTime() - minutos * 60e3), ...extra });
const enKm = (km, extra = {}) => punto({ lat: alNorte(km), ...extra });

test('viaje imposible: 100 km en 10 minutos da sospecha alta aunque sea la única señal', () => {
  const r = detectar(enKm(100), [hace(10)]);
  assert.deepEqual(r, { nivel: 'alta', motivos: ['viaje_imposible'] });
});

test('viaje imposible: 25 km en 30 minutos (50 km/h) es un desplazamiento normal', () => {
  assert.equal(detectar(enKm(25), [hace(30)]).nivel, 'ninguna');
});

test('viaje imposible: el límite está en 150 km/h', () => {
  assert.equal(detectar(enKm(70), [hace(30)]).nivel, 'ninguna');
  assert.equal(detectar(enKm(80), [hace(30)]).nivel, 'alta');
});

test('viaje imposible: por debajo de 1 km no se evalúa, por rápido que parezca', () => {
  const casi = hace(0, { fecha_hora: new Date(AHORA.getTime() - 1000) });
  assert.equal(detectar(enKm(0.5), [casi]).nivel, 'ninguna');
});

test('viaje imposible: a la distancia se le restan las precisiones de los dos puntos', () => {
  const previo = hace(0, { fecha_hora: new Date(AHORA.getTime() - 10000), precision: 100 });
  assert.equal(detectar(enKm(1.2, { precision: 150 }), [previo]).nivel, 'ninguna');
  assert.equal(detectar(enKm(1.2, { precision: 8 }), [previo]).nivel, 'alta');
});

test('viaje imposible: dos fichajes lejanos con la misma hora cuentan como imposibles', () => {
  const mismaHora = hace(0, { fecha_hora: AHORA });
  assert.deepEqual(detectar(enKm(100), [mismaHora]).motivos, ['viaje_imposible']);
});

test('viaje imposible: solo se compara con el fichaje inmediatamente anterior', () => {
  const lejos = hace(120, { lat: alNorte(300) });
  assert.equal(detectar(enKm(0.1), [hace(10), lejos]).nivel, 'ninguna');
});

test('viaje imposible: sin fichaje anterior o sin su ubicación no se puede evaluar', () => {
  assert.equal(detectar(enKm(100), []).nivel, 'ninguna');
  assert.equal(detectar(enKm(100), [hace(10, { lat: undefined })]).nivel, 'ninguna');
  assert.equal(detectar(enKm(100), [hace(10, { fecha_hora: undefined })]).nivel, 'ninguna');
});

test('viaje imposible: se combina con otras señales y sale el primero en los motivos', () => {
  const r = detectar(enKm(100, { timestamp_posicion: segundos(-300) }), [hace(10)]);
  assert.equal(r.nivel, 'alta');
  assert.deepEqual(r.motivos, ['viaje_imposible', 'posicion_antigua']);
});

test('viaje imposible: un fichaje anterior con hora posterior se trata como simultáneo, no como viaje al pasado', () => {
  const desordenado = hace(0, { fecha_hora: new Date(AHORA.getTime() + 5 * 60e3) });
  assert.deepEqual(detectar(enKm(100), [desordenado]).motivos, ['viaje_imposible']);
});
