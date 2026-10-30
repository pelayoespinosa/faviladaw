const test = require('node:test');
const assert = require('node:assert/strict');
const { hoyEnMadrid, clientesDeHoy } = require('../src/utils/turnosDeHoy');

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
