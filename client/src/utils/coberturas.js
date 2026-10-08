export function agruparCoberturasPorTurno(coberturas) {
  const porTurno = {};
  (coberturas || []).forEach(c => {
    if (!c.turno) return;
    const id = c.turno._id;
    if (!porTurno[id]) porTurno[id] = [];
    porTurno[id].push(c);
  });

  const resultado = {};
  Object.entries(porTurno).forEach(([turnoId, regs]) => {
    const ordenados = regs.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    const segmentos = [];
    ordenados.forEach(c => {
      const idCubre = c.empleado_cubre?._id || c.empleado_cubre;
      const fecha = c.fecha.slice(0, 10);
      const ultimo = segmentos[segmentos.length - 1];
      if (ultimo && ultimo.idCubre === idCubre) ultimo.hasta = fecha;
      else segmentos.push({ idCubre, empleado_cubre: c.empleado_cubre, empleado_ausente: c.empleado_ausente, turno: c.turno, desde: fecha, hasta: fecha });
    });
    resultado[turnoId] = segmentos[0];
  });
  return resultado;
}
