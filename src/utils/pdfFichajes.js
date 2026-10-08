const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const VERDE_DK = '#125A37', NEGRO = '#1E2320', GRIS_DK = '#B4BEB9';
const LOGO_PATH = path.join(__dirname, '../../client/public/logo.png');

const fmtFecha = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtHora  = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtH = h => `${(+h).toFixed(2).replace('.', ',')} h`;
const celda = (doc, txt, x, y, w) => doc.text(String(txt), x, y, { width: w, height: 11, ellipsis: true, lineBreak: false });

function construirColumnas(verNass) {
  return verNass ? [
    { key: 'empleado', label: 'Empleado', width: 150 },
    { key: 'nass',     label: 'N.A.S.S.', width: 85 },
    { key: 'fecha',    label: 'Fecha',    width: 62 },
    { key: 'entrada',  label: 'Entrada',  width: 48 },
    { key: 'salida',   label: 'Salida',   width: 55 },
    { key: 'horas',    label: 'Horas',    width: 55 },
    { key: 'verif',    label: 'Origen',   width: 60 },
  ] : [
    { key: 'empleado', label: 'Empleado', width: 190 },
    { key: 'fecha',    label: 'Fecha',    width: 80 },
    { key: 'entrada',  label: 'Entrada',  width: 60 },
    { key: 'salida',   label: 'Salida',   width: 65 },
    { key: 'horas',    label: 'Horas',    width: 60 },
    { key: 'verif',    label: 'Origen',   width: 60 },
  ];
}

async function generarPDFFichajes(res, { fichajes, desde, hasta, empleadoLabel, verNass = false }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="fichajes.pdf"');
  doc.pipe(res);

  const W_PAGE = doc.page.width, M = 40;
  const COLS = construirColumnas(verNass);
  const contentW = COLS.reduce((s, c) => s + c.width, 0);

  const colX = {}, W = {};
  let cx = M;
  for (const c of COLS) { colX[c.key] = cx; W[c.key] = c.width; cx += c.width; }

  function cabecera() {
    doc.rect(0, 0, W_PAGE, 90).fill(VERDE_DK);
    if (fs.existsSync(LOGO_PATH)) {
      try { doc.image(LOGO_PATH, W_PAGE - M - 50, 18, { height: 50 }); } catch {  }
    }
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Favila', M, 24);
    doc.font('Helvetica').fontSize(10).fillColor('#C8EBD7')
      .text(`Informe de fichajes — ${empleadoLabel} — ${fmtFecha(desde)} a ${fmtFecha(hasta)}`, M, 50);
    doc.font('Helvetica').fontSize(9).fillColor('#C8EBD7')
      .text(`${fichajes.length} fichaje(s)`, M, 66);
    return 116;
  }

  function cabeceraTabla(y) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO);
    for (const c of COLS) doc.text(c.label, colX[c.key], y, { width: c.width });
    y += 14;
    doc.moveTo(M, y).lineTo(M + contentW, y).lineWidth(1).strokeColor(NEGRO).stroke();
    return y + 6;
  }

  let y = cabecera();
  y = cabeceraTabla(y);
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(GRIS_DK)
    .text('Origen "Manual" = añadido por un administrador, no fichado por el empleado.', M, y);
  y += 12;

  function asegurarEspacio(alto) {
    if (y + alto > doc.page.height - 50) {
      doc.addPage();
      y = 40;
      y = cabeceraTabla(y);
    }
  }

  function filaDatos(f) {
    asegurarEspacio(18);
    doc.font('Helvetica').fontSize(9).fillColor(NEGRO);
    celda(doc, f.empleado?.nombre_display || 'Empleado', colX.empleado, y, W.empleado - 6);
    if (verNass) celda(doc, f.empleado?.nass || '—', colX.nass, y, W.nass - 6);
    celda(doc, fmtFecha(f.entrada?.fecha_hora), colX.fecha, y, W.fecha - 4);
    celda(doc, fmtHora(f.entrada?.fecha_hora), colX.entrada, y, W.entrada - 4);
    celda(doc, f.salida?.fecha_hora ? fmtHora(f.salida.fecha_hora) : 'Sin cerrar', colX.salida, y, W.salida - 4);
    celda(doc, f.duracion_horas != null ? fmtH(f.duracion_horas) : '—', colX.horas, y, W.horas - 4);
    celda(doc, f.creado_manualmente?.fecha ? 'Manual' : 'Empleado', colX.verif, y, W.verif);
    y += 16;
    doc.moveTo(M, y - 4).lineTo(M + contentW, y - 4).lineWidth(0.5).strokeColor(GRIS_DK).stroke();
  }

  function filaSubtotal(nombre, horas, n) {
    asegurarEspacio(22);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO);
    celda(doc, `Subtotal ${nombre} (${n} fichaje/s)`, colX.empleado, y, colX.horas - colX.empleado - 8);
    celda(doc, fmtH(horas), colX.horas, y, W.horas);
    y += 24;
  }

  function tituloEmpleado(nombre) {
    asegurarEspacio(18);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(VERDE_DK);
    celda(doc, nombre, colX.empleado, y, contentW);
    y += 17;
  }

  if (!fichajes.length) {
    doc.font('Helvetica').fontSize(10).fillColor(GRIS_DK).text('No hay fichajes en el rango seleccionado.', M, y);
    doc.end();
    return;
  }

  const distintosEmpleados = new Set(fichajes.map(f => String(f.empleado?._id))).size;
  const agrupar = distintosEmpleados > 1;

  let empleadoActual = null;
  let subHoras = 0, subN = 0;
  let totalHoras = 0, totalN = 0;

  for (const f of fichajes) {
    const nombreEmp = f.empleado?.nombre_display || 'Empleado';
    if (agrupar && nombreEmp !== empleadoActual) {
      if (empleadoActual !== null) filaSubtotal(empleadoActual, subHoras, subN);
      tituloEmpleado(nombreEmp);
      empleadoActual = nombreEmp;
      subHoras = 0; subN = 0;
    }

    filaDatos(f);

    if (f.duracion_horas != null) { subHoras += f.duracion_horas; totalHoras += f.duracion_horas; }
    subN++; totalN++;
  }

  if (agrupar && empleadoActual !== null) filaSubtotal(empleadoActual, subHoras, subN);

  asegurarEspacio(24);
  doc.moveTo(M, y).lineTo(M + contentW, y).lineWidth(1).strokeColor(NEGRO).stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NEGRO)
    .text(`TOTAL (${totalN} fichaje/s)`, colX.empleado, y, { width: colX.horas - colX.empleado - 8, lineBreak: false });
  doc.text(fmtH(totalHoras), colX.horas, y, { width: W.horas + W.verif, lineBreak: false });

  doc.end();
}

module.exports = { generarPDFFichajes };
