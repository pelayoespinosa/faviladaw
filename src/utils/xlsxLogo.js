const path = require('path');

const LOGO = path.join(__dirname, '../../client/public/logo.png');

function ponerLogo(workbook, sheet, titulo, filaCabecera = 1) {
  sheet.spliceRows(1, 0, [titulo], []);
  const fila = sheet.getRow(1);
  fila.height = 46;
  fila.getCell(1).font = { bold: true, size: 15, color: { argb: 'FF125A37' } };
  fila.getCell(1).alignment = { vertical: 'middle', indent: 5 };
  sheet.getRow(filaCabecera + 2).font = { bold: true };
  const id = workbook.addImage({ filename: LOGO, extension: 'png' });
  sheet.addImage(id, { tl: { col: 0.15, row: 0.1 }, ext: { width: 34, height: 44 } });
}

function logoEnTitulo(workbook, sheet) {
  sheet.getRow(1).height = 46;
  const id = workbook.addImage({ filename: LOGO, extension: 'png' });
  sheet.addImage(id, { tl: { col: 0.15, row: 0.1 }, ext: { width: 34, height: 44 } });
}

module.exports = { ponerLogo, logoEnTitulo };
