const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { dibujarMapaFichaje } = require('./mapaEstatico');

const VERDE_DK = '#125A37', GRIS = '#F5F7F6', GRIS_DK = '#B4BEB9', NEGRO = '#1E2320', AMBER = '#F0B429', CORAL = '#FF6B6B';
const LOGO_PATH = path.join(__dirname, '../../client/public/logo.png');

const fmtFecha = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtHora  = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtCoord = p => (p?.lat != null && p?.lng != null) ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : '—';

function fila(doc, y, label, valor, color = NEGRO) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NEGRO).text(label, 40, y, { width: 180 });
  doc.font('Helvetica').fontSize(10).fillColor(color).text(valor, 230, y, { width: 320 });
}

function bloqueVerificacion(doc, y, titulo, punto) {
  const c = punto?.confirmacion;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NEGRO).text(titulo, 40, y); y += 15;
  fila(doc, y, 'Dispositivo:', (c?.dispositivo || '—').slice(0, 60)); y += 16;
  fila(doc, y, 'IP:', c?.ip || '—'); y += 16;
  return y + 8;
}

async function generarPDFFichaje(res, fichaje, { verNass = false } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="fichaje.pdf"');
  doc.pipe(res);

  const W = doc.page.width, M = 40;

  doc.rect(0, 0, W, 90).fill(VERDE_DK);
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, W - M - 50, 18, { height: 50 }); } catch {  }
  }
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Favila', M, 24);
  doc.font('Helvetica').fontSize(10).fillColor('#C8EBD7').text('Detalle de fichaje', M, 50);

  let y = 120;
  const alto = (fichaje.salida?.fecha_hora ? 188 : 168) + (verNass ? 20 : 0);
  doc.roundedRect(M, y, W - M * 2, alto, 6).fill(GRIS);
  y += 16;

  fila(doc, y, 'Empleado:', fichaje.empleado?.nombre_display || '—'); y += 20;
  fila(doc, y, 'DNI:', fichaje.empleado?.dni || '—'); y += 20;
  if (verNass) { fila(doc, y, 'N.A.S.S.:', fichaje.empleado?.nass || '—'); y += 20; }
  fila(doc, y, 'Fecha:', fmtFecha(fichaje.entrada?.fecha_hora)); y += 20;
  fila(doc, y, 'Entrada:', fmtHora(fichaje.entrada?.fecha_hora)); y += 20;
  fila(doc, y, 'Ubicación entrada:', fmtCoord(fichaje.entrada)); y += 20;

  if (fichaje.salida?.fecha_hora) {
    fila(doc, y, 'Salida:', fmtHora(fichaje.salida.fecha_hora)); y += 20;
    fila(doc, y, 'Ubicación salida:', fmtCoord(fichaje.salida)); y += 20;
  } else {
    fila(doc, y, 'Salida:', 'Sin cerrar', AMBER); y += 20;
  }

  fila(doc, y, 'Horas trabajadas:', fichaje.duracion_horas != null ? `${(+fichaje.duracion_horas).toFixed(2).replace('.', ',')} h` : '—',
    fichaje.duracion_horas != null ? VERDE_DK : CORAL);

  y = 120 + alto + 24;

  if (fichaje.creado_manualmente?.fecha) {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(AMBER).text('Fichaje añadido manualmente por un administrador', M, y);
    y += 14;
    doc.font('Helvetica').fontSize(9).fillColor(NEGRO).text(`Motivo: ${fichaje.creado_manualmente.motivo}`, M, y, { width: W - M * 2 });
    y += 22;
  }

  doc.font('Helvetica-Bold').fontSize(11).fillColor(NEGRO).text('Origen del fichaje', M, y);
  y += 18;
  y = bloqueVerificacion(doc, y, 'Entrada', fichaje.entrada);
  if (fichaje.salida?.fecha_hora) y = bloqueVerificacion(doc, y, 'Salida', fichaje.salida);
  y += 8;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(NEGRO).text('Ubicación', M, y);
  y += 18;
  await dibujarMapaFichaje(doc, { x: M, y, w: W - M * 2, h: 260, entrada: fichaje.entrada, salida: fichaje.salida });

  doc.end();
}

module.exports = { generarPDFFichaje };
