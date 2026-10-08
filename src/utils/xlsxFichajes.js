const ExcelJS = require('exceljs');
const { ponerLogo } = require('./xlsxLogo');

const fmtFecha = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtHora  = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

async function generarXLSXFichajes(res, { fichajes, verNass = false }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Fichajes');

  sheet.columns = [
    { header: 'Empleado',     key: 'empleado',   width: 44 },
    ...(verNass ? [{ header: 'N.A.S.S.', key: 'nass', width: 18 }] : []),
    { header: 'Fecha',        key: 'fecha',      width: 14 },
    { header: 'Entrada',      key: 'entrada',    width: 12 },
    { header: 'Salida',       key: 'salida',     width: 12 },
    { header: 'Horas',        key: 'horas',      width: 10, style: { numFmt: '0.00' } },
    { header: 'Origen',       key: 'origen',     width: 48 },
  ];
  sheet.getRow(1).font = { bold: true };

  const distintosEmpleados = new Set(fichajes.map(f => String(f.empleado?._id))).size;
  const agrupar = distintosEmpleados > 1;

  const subtotalRow = (nombre, horas, n) => {
    const row = sheet.addRow({ empleado: `Subtotal ${nombre} (${n})`, horas });
    row.font = { bold: true };
  };

  let empleadoActual = null;
  let subHoras = 0, subN = 0;
  let totalHoras = 0, totalN = 0;

  fichajes.forEach(f => {
    const nombreEmp = f.empleado?.nombre_display || 'Empleado';
    if (agrupar && nombreEmp !== empleadoActual) {
      if (empleadoActual !== null) subtotalRow(empleadoActual, subHoras, subN);
      empleadoActual = nombreEmp;
      subHoras = 0; subN = 0;
    }

    sheet.addRow({
      empleado:   nombreEmp,
      ...(verNass ? { nass: f.empleado?.nass || '' } : {}),
      fecha:      fmtFecha(f.entrada?.fecha_hora),
      entrada:    fmtHora(f.entrada?.fecha_hora),
      salida:     fmtHora(f.salida?.fecha_hora),
      horas:      f.duracion_horas != null ? f.duracion_horas : '',
      origen:     f.creado_manualmente?.fecha ? `Manual (${f.creado_manualmente.motivo})` : 'Empleado',
    });

    if (f.duracion_horas != null) { subHoras += f.duracion_horas; totalHoras += f.duracion_horas; }
    subN++; totalN++;
  });

  if (agrupar && empleadoActual !== null) subtotalRow(empleadoActual, subHoras, subN);

  const totalRowObj = sheet.addRow({ empleado: `TOTAL (${totalN} fichaje/s)`, horas: totalHoras });
  totalRowObj.font = { bold: true };

  ponerLogo(workbook, sheet, 'Favila · Informe de fichajes');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="fichajes.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { generarXLSXFichajes };
