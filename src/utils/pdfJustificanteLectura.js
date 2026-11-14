const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const VERDE_DK = '#125A37', GRIS = '#F5F7F6', NEGRO = '#1E2320';
const LOGO_PATH = path.join(__dirname, '../../client/public/logo.png');

const fmtFechaHora = d => d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '—';

function fila(doc, y, label, valor, opciones = {}) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NEGRO).text(label, 40, y, { width: 150 });
  doc.font(opciones.mono ? 'Courier' : 'Helvetica').fontSize(opciones.mono ? 9 : 10).fillColor(NEGRO).text(valor, 200, y, { width: 350 });
  return doc.y + 8;
}

function generarPDFJustificante(res, datos) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="justificante-lectura.pdf"');
  doc.pipe(res);

  const W = doc.page.width, M = 40;
  doc.rect(0, 0, W, 90).fill(VERDE_DK);
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, W - M - 50, 18, { height: 50 }); } catch {  }
  }
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Favila', M, 24);
  doc.font('Helvetica').fontSize(10).fillColor('#C8EBD7').text('Justificante de lectura de documento', M, 50);

  doc.roundedRect(M, 120, W - M * 2, 250, 6).fill(GRIS);
  let y = 138;
  y = fila(doc, y, 'Empleado:', datos.empleado);
  y = fila(doc, y, 'DNI:', datos.dni);
  y = fila(doc, y, 'Documento:', datos.documento);
  y = fila(doc, y, 'Archivo:', datos.archivo);
  y = fila(doc, y, 'Recibido el:', fmtFechaHora(datos.fecha_recibido));
  y = fila(doc, y, 'Conforme el:', fmtFechaHora(datos.fecha_conforme));
  fila(doc, y, 'Huella SHA-256:', datos.huella, { mono: datos.tiene_huella });

  doc.font('Helvetica').fontSize(9.5).fillColor(NEGRO).text(
    'El empleado indicado confirmó, desde su cuenta personal, haber recibido el documento y estar conforme con su contenido. '
    + 'La huella SHA-256 identifica de forma única el contenido exacto del archivo en el momento de la confirmación: '
    + 'si el archivo se modificase, su huella sería distinta.',
    M, 400, { width: W - M * 2, align: 'justify' },
  );

  doc.end();
}

module.exports = { generarPDFJustificante };
