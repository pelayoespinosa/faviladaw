const test = require('node:test');
const assert = require('node:assert/strict');
const { hoyEnMadrid, clientesDeHoy, motivoSinReferencia } = require('../src/utils/turnosDeHoy');
const { validarUbicacion } = require('../src/utils/validacionUbicacion');

const martes = new Date('2026-11-03T10:00:00Z');
const cliente = nombre => ({ nombre, lat: 43.36, lng: -5.85 });

test('el día se calcula en hora de Madrid, no en UTC', () => {
  assert.deepEqual(hoyEnMadrid(new Date('2026-11-03T10:00:00Z')), { fecha: '2026-11-03', dia: 'martes' });
  assert.deepEqual(hoyEnMadrid(new Date('2026-11-03T23:30:00Z')), { fecha: '2026-11-04', dia: 'miercoles' });
  assert.deepEqual(hoyEnMadrid(new Date('2026-07-14T22:30:00Z')), { fecha: '2026-07-15', dia: 'miercoles' });
});

test('un turno semanal de hoy aporta su cliente', () => {
  const turnos = [{ cliente: cliente('A'), dias_semana: ['martes'], frecuencia: 'semanal' }];
  assert.deepEqual(clientesDeHoy(turnos, martes).map(c => c.nombre), ['A']);
});

test('un turno sin frecuencia se trata como semanal', () => {
  const turnos = [{ cliente: cliente('A'), dias_semana: ['martes'] }];
  assert.equal(clientesDeHoy(turnos, martes).length, 1);
});

test('un turno de otro día de la semana no aporta cliente', () => {
  const turnos = [{ cliente: cliente('A'), dias_semana: ['lunes', 'jueves'], frecuencia: 'semanal' }];
  assert.equal(clientesDeHoy(turnos, martes).length, 0);
});

test('un turno de furgoneta, sin cliente, se ignora', () => {
  const turnos = [{ furgoneta: 'f1', dias_semana: ['martes'], frecuencia: 'semanal' }];
  assert.equal(clientesDeHoy(turnos, martes).length, 0);
});

test('un turno no semanal solo cuenta el día de su proxima_fecha', () => {
  const quincenal = f => ({ cliente: cliente('B'), dias_semana: ['martes'], frecuencia: 'quincenal', proxima_fecha: f });
  assert.equal(clientesDeHoy([quincenal(new Date('2026-11-03T00:00:00Z'))], martes).length, 1);
  assert.equal(clientesDeHoy([quincenal(new Date('2026-11-10T00:00:00Z'))], martes).length, 0);
  assert.equal(clientesDeHoy([quincenal(undefined)], martes).length, 0);
});

test('con varios turnos devuelve todos los clientes de hoy', () => {
  const turnos = [
    { cliente: cliente('A'), dias_semana: ['martes'], frecuencia: 'semanal' },
    { cliente: cliente('B'), dias_semana: ['martes', 'viernes'], frecuencia: 'semanal' },
    { cliente: cliente('C'), dias_semana: ['viernes'], frecuencia: 'semanal' },
  ];
  assert.deepEqual(clientesDeHoy(turnos, martes).map(c => c.nombre), ['A', 'B']);
});

const posicion = { lat: 43.36, lng: -5.85, precision: 8 };

function validarDeHoy(turnos) {
  const resultado = validarUbicacion({ posicion, referencias: clientesDeHoy(turnos, martes) });
  if (resultado.estado === 'sin_referencia') resultado.motivo = motivoSinReferencia(turnos, martes);
  return resultado;
}

test('sin turnos es sin_referencia con motivo sin_turno', () => {
  const r = validarDeHoy([]);
  assert.equal(r.estado, 'sin_referencia');
  assert.equal(r.motivo, 'sin_turno');
});

test('con turnos solo de otros días es sin_referencia con motivo sin_turno', () => {
  const r = validarDeHoy([{ cliente: cliente('A'), dias_semana: ['jueves'], frecuencia: 'semanal' }]);
  assert.equal(r.estado, 'sin_referencia');
  assert.equal(r.motivo, 'sin_turno');
});

test('un turno de furgoneta hoy es sin_referencia con motivo turno_furgoneta', () => {
  const r = validarDeHoy([{ furgoneta: 'f1', dias_semana: ['martes'], frecuencia: 'semanal' }]);
  assert.equal(r.estado, 'sin_referencia');
  assert.equal(r.motivo, 'turno_furgoneta');
});

test('un cliente sin coordenadas es sin_referencia con motivo cliente_sin_coordenadas', () => {
  const r = validarDeHoy([{ cliente: { nombre: 'A', lat: null, lng: null }, dias_semana: ['martes'], frecuencia: 'semanal' }]);
  assert.equal(r.estado, 'sin_referencia');
  assert.equal(r.motivo, 'cliente_sin_coordenadas');
});

test('furgoneta y cliente sin coordenadas el mismo día dan cliente_sin_coordenadas', () => {
  const r = validarDeHoy([
    { furgoneta: 'f1', dias_semana: ['martes'], frecuencia: 'semanal' },
    { cliente: { nombre: 'A', lat: null, lng: null }, dias_semana: ['martes'], frecuencia: 'semanal' },
  ]);
  assert.equal(r.motivo, 'cliente_sin_coordenadas');
});

test('un cliente con coordenadas junto a una furgoneta sí se valida', () => {
  const r = validarDeHoy([
    { furgoneta: 'f1', dias_semana: ['martes'], frecuencia: 'semanal' },
    { cliente: cliente('A'), dias_semana: ['martes'], frecuencia: 'semanal' },
  ]);
  assert.equal(r.estado, 'dentro');
});

test('un cliente sin coordenadas junto a otro con coordenadas usa el segundo', () => {
  const r = validarDeHoy([
    { cliente: { nombre: 'A', lat: null, lng: null }, dias_semana: ['martes'], frecuencia: 'semanal' },
    { cliente: cliente('B'), dias_semana: ['martes'], frecuencia: 'semanal' },
  ]);
  assert.equal(r.estado, 'dentro');
});
