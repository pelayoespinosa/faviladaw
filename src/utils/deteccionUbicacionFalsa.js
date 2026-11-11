const { haversineKm } = require('./geo');

const VELOCIDAD_MAX_KMH = 150;
const DISTANCIA_MIN_VIAJE_M = 1000;
const TIEMPO_MIN_VIAJE_MS = 1000;
const MAX_DIFERENCIA_RELOJ_MS = 60 * 1000;
const HISTORIAL = 3;
const PRECISION_MAX_COORDENADAS_M = 100;
const PRECISION_MAX_CONSTANTE_M = 10;
const PRECISIONES_IMPOSIBLES_M = [0, 1];
const DECIMALES = 6;

const esNumero = v => typeof v === 'number' && Number.isFinite(v);
const clave = p => `${p.lat.toFixed(DECIMALES)},${p.lng.toFixed(DECIMALES)}`;

function viajeImposible(punto, anterior) {
  if (!anterior || !esNumero(anterior.lat) || !esNumero(anterior.lng) || !anterior.fecha_hora || !punto.fecha_hora) return false;
  const margen = (esNumero(punto.precision) ? punto.precision : 0) + (esNumero(anterior.precision) ? anterior.precision : 0);
  const metros = haversineKm(anterior, punto) * 1000 - margen;
  if (metros <= DISTANCIA_MIN_VIAJE_M) return false;
  const ms = Math.max(new Date(punto.fecha_hora) - new Date(anterior.fecha_hora), TIEMPO_MIN_VIAJE_MS);
  return (metros / 1000) / (ms / 3600e3) > VELOCIDAD_MAX_KMH;
}

function posicionAntigua(punto) {
  if (!punto.timestamp_posicion || !punto.fecha_hora) return false;
  const diferencia = Math.abs(new Date(punto.fecha_hora) - new Date(punto.timestamp_posicion));
  return diferencia > MAX_DIFERENCIA_RELOJ_MS;
}

function coordenadasIdenticas(punto, recientes) {
  if (!esNumero(punto.precision) || punto.precision >= PRECISION_MAX_COORDENADAS_M) return false;
  return recientes.some(p => esNumero(p.lat) && esNumero(p.lng) && clave(p) === clave(punto));
}

function precisionArtificial(punto, recientes) {
  if (!esNumero(punto.precision)) return false;
  if (PRECISIONES_IMPOSIBLES_M.includes(punto.precision)) return true;
  if (punto.precision >= PRECISION_MAX_CONSTANTE_M || recientes.length < HISTORIAL) return false;
  return recientes.every(p => p.precision === punto.precision);
}

function nivelDe(motivos) {
  if (motivos.includes('viaje_imposible') || motivos.length >= 2) return 'alta';
  return motivos.length === 1 ? 'baja' : 'ninguna';
}

function deteccionUbicacionFalsa({ punto, anteriores = [] }) {
  const recientes = anteriores.slice(0, HISTORIAL);
  const motivos = [
    viajeImposible(punto, anteriores[0]) && 'viaje_imposible',
    posicionAntigua(punto) && 'posicion_antigua',
    coordenadasIdenticas(punto, recientes) && 'coordenadas_identicas',
    precisionArtificial(punto, recientes) && 'precision_artificial',
  ].filter(Boolean);
  return { nivel: nivelDe(motivos), motivos };
}

module.exports = { deteccionUbicacionFalsa };
