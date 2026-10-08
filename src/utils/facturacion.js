const Turno = require('../models/Turno');
const PrecioServicio = require('../models/PrecioServicio');
const { calcHMesProrr } = require('./prorrateo');

const redondea = n => Math.round(n * 100) / 100;

async function facturacionPorCliente() {
  const [turnos, precios] = await Promise.all([
    Turno.find({ cliente: { $ne: null } }).select('cliente tipo_tarea frecuencia horas_semana').lean(),
    PrecioServicio.find().lean(),
  ]);
  const precioDe = Object.fromEntries(precios.map(p => [p.tipo_tarea, p.precio_hora]));

  const porCliente = new Map();
  for (const t of turnos) {
    const horas = calcHMesProrr(t);
    if (!horas) continue;
    const id = String(t.cliente);
    const tipo = t.tipo_tarea || 'limpieza';
    const ficha = porCliente.get(id) || { total: 0, lineas: {} };
    const linea = ficha.lineas[tipo] || { tipo_tarea: tipo, horas_mes: 0, precio_hora: precioDe[tipo] || 0, importe: 0 };
    linea.horas_mes += horas;
    ficha.lineas[tipo] = linea;
    porCliente.set(id, ficha);
  }
  for (const ficha of porCliente.values()) {
    ficha.lineas = Object.values(ficha.lineas).map(l => ({
      ...l, horas_mes: redondea(l.horas_mes), importe: redondea(l.horas_mes * l.precio_hora),
    }));
    ficha.total = redondea(ficha.lineas.reduce((acc, l) => acc + l.importe, 0));
  }
  return porCliente;
}

module.exports = { facturacionPorCliente };
