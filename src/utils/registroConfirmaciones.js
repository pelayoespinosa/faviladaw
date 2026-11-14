const nombreDe = e => e?.nombre_display || [e?.nombre, e?.apellidos].filter(Boolean).join(' ') || '—';

function estadoDe(c) {
  if (c.recibido && c.conforme) return 'Confirmado';
  if (c.recibido) return 'Recibido, sin conformidad';
  return 'Pendiente';
}

function filasConfirmaciones(documento) {
  return (documento.confirmaciones || []).map(c => ({
    empleado: nombreDe(c.empleado),
    dni: c.empleado?.dni || '',
    estado: estadoDe(c),
    fecha_recibido: c.fecha_recibido || null,
    fecha_conforme: c.fecha_conforme || null,
    huella: c.huella_sha256 || '',
  }));
}

function datosJustificante(documento, confirmacion) {
  return {
    empleado: nombreDe(confirmacion.empleado),
    dni: confirmacion.empleado?.dni || '—',
    documento: documento.titulo,
    archivo: documento.nombre_archivo_original,
    fecha_recibido: confirmacion.fecha_recibido,
    fecha_conforme: confirmacion.fecha_conforme,
    huella: confirmacion.huella_sha256 || 'No registrada (documento confirmado antes de registrar la huella)',
    tiene_huella: Boolean(confirmacion.huella_sha256),
  };
}

const confirmado = c => Boolean(c?.recibido && c?.conforme);

module.exports = { filasConfirmaciones, datosJustificante, estadoDe, confirmado };
