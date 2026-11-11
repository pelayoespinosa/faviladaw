const MAX_DIFERENCIA_RELOJ_MS = 60 * 1000;
const HISTORIAL = 3;
const PRECISION_MAX_COORDENADAS_M = 100;
const PRECISION_MAX_CONSTANTE_M = 10;
const PRECISIONES_IMPOSIBLES_M = [0, 1];
const DECIMALES = 6;

const esNumero = v => typeof v === 'number' && Number.isFinite(v);
const clave = p => `${p.lat.toFixed(DECIMALES)},${p.lng.toFixed(DECIMALES)}`;

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
  if (motivos.length >= 2) return 'alta';
  return motivos.length === 1 ? 'baja' : 'ninguna';
}

function deteccionUbicacionFalsa({ punto, anteriores = [] }) {
  const recientes = anteriores.slice(0, HISTORIAL);
  const motivos = [
    posicionAntigua(punto) && 'posicion_antigua',
    coordenadasIdenticas(punto, recientes) && 'coordenadas_identicas',
    precisionArtificial(punto, recientes) && 'precision_artificial',
  ].filter(Boolean);
  return { nivel: nivelDe(motivos), motivos };
}

module.exports = { deteccionUbicacionFalsa };
