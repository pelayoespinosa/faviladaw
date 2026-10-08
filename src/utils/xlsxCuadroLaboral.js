const ExcelJS = require('exceljs');
const { logoEnTitulo } = require('./xlsxLogo');
const { PLUS_TRANSPORTE_DIA, PLUS_FESTIVO_HORA, PLUS_PENOSIDAD_HORA, PLUS_NOCTURNIDAD_HORA } = require('./tarifasPluses');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const fmtFecha = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const dinero = (cantidad, tarifa) => cantidad != null ? +(cantidad * tarifa).toFixed(2) : null;

const COLS = [
  { header: 'Nombre del Trabajador', key: 'nombre',       width: 32 },
  { header: 'NIF',                   key: 'nif',          width: 14 },
  { header: 'NAF',                   key: 'naf',          width: 18 },
  { header: 'Fecha de Alta',         key: 'fecha_alta',   width: 14 },
  { header: 'Ctto',                  key: 'ctto',         width: 8 },
  { header: 'Categoría',             key: 'categoria',    width: 16 },
  { header: 'HORARIO BASE',          key: 'horario_base', width: 13 },
  { header: 'DÍAS SEMANA',           key: 'dias_semana',  width: 12 },
  { header: 'PLUS TRANSPORTE (DÍAS)',    key: 'plus_transporte',     width: 17 },
  { header: 'PLUS TRANSPORTE (€)',       key: 'plus_transporte_eur', width: 15 },
  { header: 'PLUS FESTIVO (HORAS)',      key: 'plus_festivo',        width: 16 },
  { header: 'PLUS FESTIVO (€)',          key: 'plus_festivo_eur',    width: 13 },
  { header: 'PLUS PENOSIDAD (HORAS)',    key: 'plus_penosidad',      width: 17 },
  { header: 'PLUS PENOSIDAD (€)',        key: 'plus_penosidad_eur',  width: 14 },
  { header: 'PLUS NOCTURNIDAD (HORAS)',  key: 'plus_nocturnidad',      width: 18 },
  { header: 'PLUS NOCTURNIDAD (€)',      key: 'plus_nocturnidad_eur',  width: 15 },
  { header: '1ª SEMANA', key: 'semana1', width: 11 },
  { header: '2ª SEMANA', key: 'semana2', width: 11 },
  { header: '3ª SEMANA', key: 'semana3', width: 11 },
  { header: '4ª SEMANA', key: 'semana4', width: 11 },
  { header: '5ª SEMANA', key: 'semana5', width: 11 },
  { header: 'Observaciones', key: 'observaciones', width: 40 },
];
const COL_SEMANA1_IDX = COLS.findIndex(c => c.key === 'semana1') + 1;
const COL_SEMANA5_IDX = COLS.findIndex(c => c.key === 'semana5') + 1;

async function generarXLSXCuadroLaboral(res, { anio, mes, secciones, sufijo = '' }) {
  const workbook = new ExcelJS.Workbook();

  for (const { cuadro, titulo } of secciones) {
    const sheet = workbook.addWorksheet(titulo || 'Cuadro laboral');

    sheet.mergeCells(1, 1, 1, COLS.length);
    const tituloCell = sheet.getCell(1, 1);
    tituloCell.value = `CUADRO LABORAL ${MESES[mes - 1]} ${anio} FAVILA${titulo ? ` — ${titulo.toUpperCase()}` : ''}`;
    tituloCell.font = { bold: true, size: 13 };
    tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
    logoEnTitulo(workbook, sheet);

    sheet.mergeCells(2, COL_SEMANA1_IDX, 2, COL_SEMANA5_IDX);
    const horarioCell = sheet.getCell(2, COL_SEMANA1_IDX);
    horarioCell.value = 'HORARIO';
    horarioCell.font = { bold: true };
    horarioCell.alignment = { horizontal: 'center' };

    sheet.getRow(3).values = COLS.map(c => c.header);
    sheet.getRow(3).font = { bold: true };
    sheet.getRow(3).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    sheet.getRow(3).height = 36;
    sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];
    sheet.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    for (const f of cuadro.filas) {
      const row = sheet.addRow({
        ...f,
        fecha_alta: fmtFecha(f.fecha_alta),
        plus_transporte_eur:  dinero(f.plus_transporte,  PLUS_TRANSPORTE_DIA),
        plus_festivo_eur:     dinero(f.plus_festivo,     PLUS_FESTIVO_HORA),
        plus_penosidad_eur:   dinero(f.plus_penosidad,   PLUS_PENOSIDAD_HORA),
        plus_nocturnidad_eur: dinero(f.plus_nocturnidad, PLUS_NOCTURNIDAD_HORA),
      });
      row.getCell('observaciones').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('nombre').alignment = { wrapText: true, vertical: 'top' };
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="cuadro-laboral-${anio}-${String(mes).padStart(2, '0')}${sufijo}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { generarXLSXCuadroLaboral };
