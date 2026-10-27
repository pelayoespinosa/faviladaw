const { haversineKm } = require('./geo');

const RADIO_POR_DEFECTO_M = 150;
const PRECISION_MAXIMA_M = 100;
const ORDEN_ESTADO = { dentro: 0, dudoso: 1, fuera: 2 };

function evaluar(posicion, referencia, radioPorDefectoM) {
  const km = haversineKm(posicion, referencia);
  if (km == null) return null;
  const distancia_m = km * 1000;
  const radio_m = referencia.radio_validacion_m ?? radioPorDefectoM;
  const { precision } = posicion;

  if (!Number.isFinite(precision) || precision > PRECISION_MAXIMA_M) {
    return { estado: 'dudoso', distancia_m, radio_m, motivo: 'precision_baja' };
  }
  if (distancia_m <= radio_m) return { estado: 'dentro', distancia_m, radio_m, motivo: null };
  if (distancia_m <= radio_m + precision) return { estado: 'dudoso', distancia_m, radio_m, motivo: 'margen_precision' };
  return { estado: 'fuera', distancia_m, radio_m, motivo: null };
}

function mejor(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (ORDEN_ESTADO[a.estado] !== ORDEN_ESTADO[b.estado]) return ORDEN_ESTADO[a.estado] < ORDEN_ESTADO[b.estado] ? a : b;
  return a.distancia_m <= b.distancia_m ? a : b;
}

function validarUbicacion({ posicion, referencias = [], radioPorDefectoM = RADIO_POR_DEFECTO_M }) {
  const resultado = referencias
    .map(ref => evaluar(posicion, ref, radioPorDefectoM))
    .reduce(mejor, null);
  return resultado || { estado: 'sin_referencia', distancia_m: null, radio_m: null, motivo: 'sin_referencia' };
}

module.exports = { validarUbicacion, RADIO_POR_DEFECTO_M, PRECISION_MAXIMA_M };
