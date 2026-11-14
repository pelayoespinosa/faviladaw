const ExcelJS = require('exceljs');
const { ponerLogo } = require('./xlsxLogo');
const { filasConfirmaciones } = require('./registroConfirmaciones');

async function generarXLSXConfirmaciones(res, documento) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Confirmaciones');
  sheet.columns = [
    { header: 'Empleado', key: 'empleado', width: 36 },
    { header: 'DNI', key: 'dni', width: 14 },
    { header: 'Estado', key: 'estado', width: 26 },
    { header: 'Recibido el', key: 'fecha_recibido', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Conforme el', key: 'fecha_conforme', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Huella SHA-256', key: 'huella', width: 68 },
  ];
  filasConfirmaciones(documento).forEach(f => sheet.addRow(f));
  ponerLogo(workbook, sheet, `Favila · Confirmaciones de lectura: ${documento.titulo}`);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="confirmaciones.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { generarXLSXConfirmaciones };
