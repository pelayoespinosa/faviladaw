const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { PLUS_TRANSPORTE_DIA, PLUS_FESTIVO_HORA, PLUS_PENOSIDAD_HORA, PLUS_NOCTURNIDAD_HORA } = require('./tarifasPluses');

const VERDE_DK = '#125A37', NEGRO = '#1E2320', GRIS_DK = '#B4BEB9';
const LOGO_PATH = path.join(__dirname, '../../client/public/logo.png');
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const fmtFecha = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtNum   = n => n != null ? String(n) : '';
const fmtEur   = n => n != null ? `${n.toFixed(2)} €` : '';
const dinero = (cantidad, tarifa) => cantidad != null ? +(cantidad * tarifa).toFixed(2) : null;

const COLS = [
  { key: 'nombre',       label: 'Trabajador',  width: 128, get: f => f.nombre || '—' },
  { key: 'nif',          label: 'NIF',          width: 60,  get: f => f.nif || '—' },
  { key: 'naf',          label: 'NAF',          width: 82,  get: f => f.naf || '—' },
  { key: 'fecha_alta',   label: 'F. Alta',      width: 56,  get: f => fmtFecha(f.fecha_alta) },
  { key: 'ctto',         label: 'Ctto',         width: 32,  get: f => f.ctto || '—' },
  { key: 'categoria',    label: 'Categoría',    width: 74,  get: f => f.categoria || '—' },
  { key: 'horario_base', label: 'H. Base',      width: 42,  get: f => fmtNum(f.horario_base) },
  { key: 'dias_semana',  label: 'Días',         width: 30,  get: f => fmtNum(f.dias_semana) },
  { key: 'plus_transporte',     label: 'P.Transp.(d)', width: 42, get: f => fmtNum(f.plus_transporte) },
  { key: 'plus_transporte_eur', label: 'P.Transp.€',   width: 42, get: f => fmtEur(dinero(f.plus_transporte, PLUS_TRANSPORTE_DIA)) },
  { key: 'plus_festivo',        label: 'P.Fest.(h)',   width: 38, get: f => fmtNum(f.plus_festivo) },
  { key: 'plus_festivo_eur',    label: 'P.Fest.€',     width: 38, get: f => fmtEur(dinero(f.plus_festivo, PLUS_FESTIVO_HORA)) },
  { key: 'plus_penosidad',      label: 'P.Penos.(h)',  width: 40, get: f => fmtNum(f.plus_penosidad) },
  { key: 'plus_penosidad_eur',  label: 'P.Penos.€',    width: 38, get: f => fmtEur(dinero(f.plus_penosidad, PLUS_PENOSIDAD_HORA)) },
  { key: 'plus_nocturnidad',     label: 'P.Noct.(h)',  width: 40, get: f => fmtNum(f.plus_nocturnidad) },
  { key: 'plus_nocturnidad_eur', label: 'P.Noct.€',    width: 38, get: f => fmtEur(dinero(f.plus_nocturnidad, PLUS_NOCTURNIDAD_HORA)) },
  { key: 'semana1', label: '1ªSem', width: 36, get: f => fmtNum(f.semana1) },
  { key: 'semana2', label: '2ªSem', width: 36, get: f => fmtNum(f.semana2) },
  { key: 'semana3', label: '3ªSem', width: 36, get: f => fmtNum(f.semana3) },
  { key: 'semana4', label: '4ªSem', width: 36, get: f => fmtNum(f.semana4) },
  { key: 'semana5', label: '5ªSem', width: 36, get: f => fmtNum(f.semana5) },
  { key: 'observaciones', label: 'Observaciones', width: 130, get: f => f.observaciones || '' },
];
const COLS_ENVOLVENTES = ['nombre', 'naf', 'categoria', 'observaciones'];

async function generarPDFCuadroLaboral(res, { anio, mes, secciones, sufijo = '' }) {
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 0 });
  const nombreMes = MESES[mes - 1];
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="cuadro-laboral-${anio}-${String(mes).padStart(2, '0')}${sufijo}.pdf"`);
  doc.pipe(res);

  const W = doc.page.width, M = 30;
  const contentW = COLS.reduce((s, c) => s + c.width, 0);

  const colX = {};
  let cx = M;
  for (const c of COLS) { colX[c.key] = cx; cx += c.width; }
  const colByKey = Object.fromEntries(COLS.map(c => [c.key, c]));

  function cabecera(cuadro, titulo) {
    doc.rect(0, 0, W, 70).fill(VERDE_DK);
    if (fs.existsSync(LOGO_PATH)) {
      try { doc.image(LOGO_PATH, W - M - 40, 12, { height: 40 }); } catch {  }
    }
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text('Favila', M, 16);
    doc.font('Helvetica').fontSize(9.5).fillColor('#C8EBD7')
      .text(`Cuadro laboral${titulo ? ` · ${titulo}` : ''} — ${nombreMes} ${anio} — ${cuadro.filas.length} trabajador(es)`, M, 38);
    return 88;
  }

  function cabeceraTabla(y) {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(NEGRO);
    for (const c of COLS) doc.text(c.label, colX[c.key], y, { width: c.width - 2 });
    y += 12;
    doc.moveTo(M, y).lineTo(M + contentW, y).lineWidth(1).strokeColor(NEGRO).stroke();
    return y + 5;
  }

  let y = 0;

  const FONT_SIZE = 6.8;

  function alturaFila(f) {
    doc.font('Helvetica').fontSize(FONT_SIZE);
    let alto = 20;
    for (const key of COLS_ENVOLVENTES) {
      const texto = key === 'observaciones' ? (f.observaciones || '') : (f[key] || '—');
      const h = doc.heightOfString(texto, { width: colByKey[key].width - 4 }) + 8;
      if (h > alto) alto = h;
    }
    return alto;
  }

  function asegurarEspacio(alto) {
    if (y + alto > doc.page.height - 40) {
      doc.addPage();
      y = 30;
      y = cabeceraTabla(y);
    }
  }

  secciones.forEach(({ cuadro, titulo }, idx) => {
    if (idx > 0) doc.addPage();
    y = cabecera(cuadro, titulo);
    y = cabeceraTabla(y);
    for (const f of cuadro.filas) {
      const alto = alturaFila(f);
      asegurarEspacio(alto);
      doc.font('Helvetica').fontSize(FONT_SIZE).fillColor(NEGRO);
      for (const c of COLS) {
        doc.text(c.get(f), colX[c.key], y, { width: c.width - (c.key === 'observaciones' ? 4 : 2) });
      }
      y += alto;
      doc.moveTo(M, y - 4).lineTo(M + contentW, y - 4).lineWidth(0.4).strokeColor(GRIS_DK).stroke();
    }

    if (!cuadro.filas.length) {
      doc.font('Helvetica').fontSize(10).fillColor(GRIS_DK).text('No hay filas en este cuadro.', M, y);
    }
  });

  doc.end();
}

module.exports = { generarPDFCuadroLaboral };
