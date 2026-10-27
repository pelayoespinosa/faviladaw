const test = require('node:test');
const assert = require('node:assert/strict');
const { validarUbicacion } = require('../src/utils/validacionUbicacion');

const M_POR_GRADO = 111194.93;
const cliente = { lat: 43.36, lng: -5.85 };

function aMetros(metros, extra = {}) {
  return { lat: cliente.lat + metros / M_POR_GRADO, lng: cliente.lng, ...extra };
}

function validar(metros, precision, referencias = [cliente], opciones = {}) {
  return validarUbicacion({ posicion: aMetros(metros, { precision }), referencias, ...opciones });
}

test('en el mismo punto con buena precisión es dentro', () => {
  const r = validar(0, 5);
  assert.equal(r.estado, 'dentro');
  assert.equal(r.radio_m, 150);
});

test('justo dentro del radio (149 m, precisión 5 m) es dentro', () => {
  assert.equal(validar(149, 5).estado, 'dentro');
});

test('justo fuera del radio pero cubierto por la precisión (151 m, 5 m) es dudoso', () => {
  assert.equal(validar(151, 5).estado, 'dudoso');
});

test('más allá del radio más la precisión (160 m, 5 m) es fuera', () => {
  assert.equal(validar(160, 5).estado, 'fuera');
});

test('con precisión de 30 m, 160 m es dudoso', () => {
  assert.equal(validar(160, 30).estado, 'dudoso');
});

test('lejos del cliente con buena precisión es fuera', () => {
  const r = validar(5000, 10);
  assert.equal(r.estado, 'fuera');
  assert.ok(Math.abs(r.distancia_m - 5000) < 5);
});

test('precisión de exactamente 100 m todavía permite dentro', () => {
  assert.equal(validar(10, 100).estado, 'dentro');
});

test('precisión peor de 100 m nunca es dentro: 10 m con 300 m de precisión es dudoso', () => {
  const r = validar(10, 300);
  assert.equal(r.estado, 'dudoso');
  assert.equal(r.motivo, 'precision_baja');
});

test('precisión de 101 m ya es dudoso aunque esté en el punto', () => {
  assert.equal(validar(0, 101).estado, 'dudoso');
});

test('sin dato de precisión no se da por dentro: dudoso', () => {
  const r = validar(0, undefined);
  assert.equal(r.estado, 'dudoso');
  assert.equal(r.motivo, 'precision_baja');
});

test('usa el radio propio del cliente en lugar del de por defecto', () => {
  const grande = [{ ...cliente, radio_validacion_m: 300 }];
  const pequeno = [{ ...cliente, radio_validacion_m: 50 }];
  assert.equal(validar(250, 5, grande).estado, 'dentro');
  assert.equal(validar(250, 5, grande).radio_m, 300);
  assert.equal(validar(100, 5, pequeno).estado, 'fuera');
});

test('el radio por defecto se puede cambiar', () => {
  const r = validar(250, 5, [cliente], { radioPorDefectoM: 400 });
  assert.equal(r.estado, 'dentro');
  assert.equal(r.radio_m, 400);
});

test('sin referencias es sin_referencia', () => {
  const r = validar(0, 5, []);
  assert.equal(r.estado, 'sin_referencia');
  assert.equal(r.distancia_m, null);
});

test('un cliente sin coordenadas es sin_referencia', () => {
  const r = validar(0, 5, [{ lat: null, lng: null }]);
  assert.equal(r.estado, 'sin_referencia');
});

test('un cliente sin coordenadas se ignora si hay otro con coordenadas', () => {
  const r = validar(0, 5, [{ lat: null, lng: null }, cliente]);
  assert.equal(r.estado, 'dentro');
});

test('con varios clientes en el día gana el que da mejor resultado', () => {
  const lejos = { lat: cliente.lat + 0.5, lng: cliente.lng };
  assert.equal(validar(0, 5, [lejos, cliente]).estado, 'dentro');
  assert.equal(validar(0, 5, [cliente, lejos]).estado, 'dentro');
});

test('con varios clientes, dudoso gana a fuera', () => {
  const lejos = { lat: cliente.lat + 0.5, lng: cliente.lng };
  const cerca = { lat: cliente.lat - 155 / M_POR_GRADO, lng: cliente.lng };
  const r = validarUbicacion({ posicion: { ...cliente, precision: 20 }, referencias: [lejos, cerca] });
  assert.equal(r.estado, 'dudoso');
});

test('devuelve la distancia al cliente más cercano en metros', () => {
  const r = validar(80, 5);
  assert.ok(Math.abs(r.distancia_m - 80) < 1);
});
