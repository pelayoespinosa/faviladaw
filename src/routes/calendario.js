const router     = require('express').Router();
const Ausencia   = require('../models/Ausencia');
const Cobertura  = require('../models/Cobertura');
const Turno      = require('../models/Turno');
const Fichaje    = require('../models/Fichaje');
const { calcHMesProrr }  = require('../utils/prorrateo');
const { resumenMensual, estadoCoberturaAusencia } = require('../utils/calendarioHoras');

const populateAusencia  = q => q.populate('empleado', 'nombre apellidos dni');
const populateCobertura = q => q.populate('empleado_ausente', 'nombre apellidos dni')
  .populate('empleado_cubre', 'nombre apellidos dni')
  .populate({ path: 'turno', populate: { path: 'cliente', select: 'nombre alias sucursal' } });

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function empleadoVisible(req) {
  if (['admin', 'gestoria'].includes(req.user.rol)) {
    return req.query.empleado && req.query.empleado !== 'todos' ? req.query.empleado : undefined;
  }
  if (req.user.rol === 'encargado' && req.query.empleado) {
    return req.query.empleado !== 'todos' ? req.query.empleado : undefined;
  }
  return req.user.empleadoId || null;
}

function querySolape({ excluirId, empleado, fecha_inicio, fecha_fin }) {
  const query = { empleado, $or: [{ fecha_fin: null }, { fecha_fin: { $gte: new Date(`${fecha_inicio}T00:00:00.000Z`) } }] };
  if (excluirId) query._id = { $ne: excluirId };
  if (fecha_fin) query.fecha_inicio = { $lte: new Date(`${fecha_fin}T23:59:59.999Z`) };
  return query;
}

router.get('/ausencias', async (req, res) => {
  const empleado = empleadoVisible(req);
  if (empleado === null) return res.json([]);
  const query = {};
  if (req.query.hasta) query.fecha_inicio = { $lte: new Date(`${req.query.hasta}T23:59:59.999Z`) };
  if (req.query.desde) query.$or = [{ fecha_fin: null }, { fecha_fin: { $gte: new Date(`${req.query.desde}T00:00:00.000Z`) } }];
  if (empleado) query.empleado = empleado;
  const ausencias = await populateAusencia(Ausencia.find(query)).sort({ fecha_inicio: -1 });
  if (req.query.cobertura !== '1' || !['admin', 'encargado'].includes(req.user.rol) || !ausencias.length) {
    return res.json(ausencias);
  }
  const empleadoIds = [...new Set(ausencias.map(a => String(a.empleado?._id || a.empleado)))];
  const minInicio = ausencias.reduce((m, a) => (a.fecha_inicio < m ? a.fecha_inicio : m), ausencias[0].fecha_inicio);
  const [turnos, coberturas] = await Promise.all([
    Turno.find({ empleado: { $in: empleadoIds }, frecuencia: 'semanal' }, 'empleado frecuencia dias_semana tramos').lean(),
    Cobertura.find({ empleado_ausente: { $in: empleadoIds }, fecha: { $gte: minInicio } }, 'turno fecha empleado_ausente').lean(),
  ]);
  const hoy = new Date().toISOString().slice(0, 10);
  res.json(ausencias.map(a => {
    const id = String(a.empleado?._id || a.empleado);
    return {
      ...a.toJSON(),
      cobertura: estadoCoberturaAusencia({
        ausencia: a,
        turnos: turnos.filter(t => String(t.empleado) === id),
        coberturas: coberturas.filter(c => String(c.empleado_ausente) === id),
        hoy,
      }),
    };
  }));
});

router.post('/ausencias', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const { empleado, tipo, fecha_inicio, fecha_fin, observaciones } = req.body;
  if (!empleado) return res.status(400).json({ error: 'Selecciona un empleado' });
  if (!['vacaciones', 'baja'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  if (!fecha_inicio) return res.status(400).json({ error: 'Indica la fecha de inicio' });
  if (tipo === 'vacaciones' && !fecha_fin) return res.status(400).json({ error: 'Indica la fecha de fin' });
  if (fecha_fin && fecha_fin < fecha_inicio) return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio' });
  try {
    const solape = await Ausencia.findOne(querySolape({ empleado, fecha_inicio, fecha_fin }));
    if (solape) return res.status(400).json({ error: 'Ya existe una ausencia que se solapa en esas fechas para ese empleado' });
    const a = await Ausencia.create({ empleado, tipo, fecha_inicio, fecha_fin: fecha_fin || null, observaciones });
    res.status(201).json(await populateAusencia(Ausencia.findById(a._id)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/ausencias/:id', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const { empleado, tipo, fecha_inicio, fecha_fin, observaciones } = req.body;
  if (tipo && !['vacaciones', 'baja'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  if (tipo === 'vacaciones' && fecha_inicio && !fecha_fin) return res.status(400).json({ error: 'Indica la fecha de fin' });
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio' });
  try {
    if (empleado && fecha_inicio) {
      const solape = await Ausencia.findOne(querySolape({ excluirId: req.params.id, empleado, fecha_inicio, fecha_fin }));
      if (solape) return res.status(400).json({ error: 'Ya existe una ausencia que se solapa en esas fechas para ese empleado' });
    }
    const a = await populateAusencia(Ausencia.findByIdAndUpdate(req.params.id, { empleado, tipo, fecha_inicio, fecha_fin: fecha_fin || null, observaciones }, { new: true, runValidators: true }));
    if (!a) return res.status(404).json({ error: 'No encontrada' });
    res.json(a);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/ausencias/:id', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  await Ausencia.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

router.get('/coberturas', async (req, res) => {
  const empleado = empleadoVisible(req);
  if (empleado === null) return res.json([]);
  const query = {};
  if (req.query.desde || req.query.hasta) {
    query.fecha = {};
    if (req.query.desde) query.fecha.$gte = new Date(`${req.query.desde}T00:00:00.000Z`);
    if (req.query.hasta) query.fecha.$lte = new Date(`${req.query.hasta}T23:59:59.999Z`);
  }
  if (empleado) query.$or = [{ empleado_ausente: empleado }, { empleado_cubre: empleado }];
  res.json(await populateCobertura(Cobertura.find(query)).sort({ fecha: -1 }));
});

router.post('/coberturas', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const { fecha, empleado_ausente, empleado_cubre, observaciones } = req.body;
  if (!fecha) return res.status(400).json({ error: 'Indica la fecha' });
  if (!empleado_ausente || !empleado_cubre) return res.status(400).json({ error: 'Selecciona el empleado ausente y quién le cubre' });
  if (String(empleado_ausente) === String(empleado_cubre)) return res.status(400).json({ error: 'El empleado no puede cubrirse a sí mismo' });
  try {
    const c = await Cobertura.create({ fecha, empleado_ausente, empleado_cubre, observaciones });
    res.status(201).json(await populateCobertura(Cobertura.findById(c._id)));
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Ya existe una cobertura para ese empleado ese día' });
    res.status(400).json({ error: e.message });
  }
});

router.put('/coberturas/:id', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const { fecha, empleado_ausente, empleado_cubre, observaciones } = req.body;
  if (empleado_ausente && empleado_cubre && String(empleado_ausente) === String(empleado_cubre)) {
    return res.status(400).json({ error: 'El empleado no puede cubrirse a sí mismo' });
  }
  try {
    const c = await populateCobertura(Cobertura.findByIdAndUpdate(req.params.id, { fecha, empleado_ausente, empleado_cubre, observaciones }, { new: true, runValidators: true }));
    if (!c) return res.status(404).json({ error: 'No encontrada' });
    res.json(c);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Ya existe una cobertura para ese empleado ese día' });
    res.status(400).json({ error: e.message });
  }
});

router.delete('/coberturas/:id', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  await Cobertura.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

async function prepararAsignacion({ turno: turnoId, empleado_cubre, desde, hasta, dias_semana, observaciones }) {
  if (!turnoId || !empleado_cubre) return { error: 'Selecciona el turno y quién lo cubre' };
  if (!desde || !hasta) return { error: 'Indica el rango de fechas a cubrir' };
  if (hasta < desde) return { error: 'La fecha de fin no puede ser anterior a la de inicio' };
  const dias = [...new Set(Array.isArray(dias_semana) ? dias_semana : [])];
  if (!dias.length) return { error: 'Indica los días de la semana en los que va la persona que cubre' };
  if (dias.some(d => !DIAS_SEMANA.includes(d))) return { error: 'Día de la semana no válido' };
  const turno = await Turno.findById(turnoId);
  if (!turno) return { error: 'Turno no encontrado', status: 404 };
  if (turno.frecuencia !== 'semanal') return { error: 'Solo se pueden cubrir turnos semanales (únicos que se anclan a un día concreto)' };
  if (String(turno.empleado) === String(empleado_cubre)) return { error: 'El empleado no puede cubrirse a sí mismo' };

  const docs = [];
  const cursor = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (cursor <= fin) {
    if (dias.includes(DIAS_SEMANA[cursor.getUTCDay()])) {
      docs.push({ fecha: new Date(cursor), empleado_ausente: turno.empleado, empleado_cubre, turno: turnoId, dias_semana: dias, observaciones });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!docs.length) return { error: 'Ningún día del rango coincide con los días elegidos' };
  const rango = { turno: turnoId, fecha: { $gte: new Date(`${desde}T00:00:00.000Z`), $lte: new Date(`${hasta}T23:59:59.999Z`) } };
  return { docs, rango, turno };
}

async function aplicarAsignaciones(preparadas) {
  for (const p of preparadas) await Cobertura.deleteMany(p.rango);
  await Cobertura.insertMany(preparadas.flatMap(p => p.docs));
}

router.post('/coberturas/asignar-turno', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const p = await prepararAsignacion(req.body);
  if (p.error) return res.status(p.status || 400).json({ error: p.error });
  try {
    await aplicarAsignaciones([p]);
    res.json({ ok: true, dias: p.docs.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/coberturas/asignar-turnos', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const lista = Array.isArray(req.body.asignaciones) ? req.body.asignaciones : [];
  if (!lista.length) return res.status(400).json({ error: 'No hay turnos que asignar' });
  const preparadas = [];
  for (const a of lista) {
    const p = await prepararAsignacion(a);
    if (p.error) {
      const t = p.turno || await Turno.findById(a.turno).populate('cliente', 'nombre alias').populate('furgoneta', 'numero').catch(() => null);
      const nombre = t?.cliente ? (t.cliente.alias || t.cliente.nombre) : t?.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : 'un turno';
      return res.status(p.status || 400).json({ error: `${nombre}: ${p.error}` });
    }
    preparadas.push(p);
  }
  try {
    await aplicarAsignaciones(preparadas);
    res.json({ ok: true, dias: preparadas.reduce((n, p) => n + p.docs.length, 0) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/coberturas/turno/:turnoId', async (req, res) => {
  if (!['admin', 'encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const { desde, hasta } = req.query;
  const query = { turno: req.params.turnoId };
  if (desde || hasta) {
    query.fecha = {};
    if (desde) query.fecha.$gte = new Date(`${desde}T00:00:00.000Z`);
    if (hasta) query.fecha.$lte = new Date(`${hasta}T23:59:59.999Z`);
  }
  const r = await Cobertura.deleteMany(query);
  res.json({ ok: true, eliminados: r.deletedCount });
});

router.get('/resumen-mensual', async (req, res) => {
  const { rol, empleadoId } = req.user;
  let empleado = req.query.empleado;
  if (!['admin', 'encargado'].includes(rol)) {
    if (!empleadoId) return res.json(null);
    empleado = empleadoId;
  }
  if (!empleado) return res.status(400).json({ error: 'Falta el parámetro empleado' });

  const year  = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (Number.isNaN(year) || Number.isNaN(month)) return res.status(400).json({ error: 'Faltan year/month' });

  const inicioMes = new Date(Date.UTC(year, month, 1));
  const finMes    = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const [turnos, fichajes, ausencias, coberturasAusente, coberturasCubre] = await Promise.all([
    Turno.find({ empleado }),
    Fichaje.find({ empleado, estado: { $ne: 'anulado' }, 'entrada.fecha_hora': { $gte: inicioMes, $lte: finMes } }),
    Ausencia.find({ empleado, fecha_inicio: { $lte: finMes }, $or: [{ fecha_fin: null }, { fecha_fin: { $gte: inicioMes } }] }),
    Cobertura.find({ empleado_ausente: empleado, fecha: { $gte: inicioMes, $lte: finMes } }).populate('turno'),
    Cobertura.find({ empleado_cubre: empleado, fecha: { $gte: inicioMes, $lte: finMes } }).populate('turno'),
  ]);

  const coberturas = [...coberturasAusente, ...coberturasCubre];
  const ausenteIds = [...new Set(coberturasCubre.map(c => String(c.empleado_ausente)))];
  const turnosOtros = ausenteIds.length ? await Turno.find({ empleado: { $in: ausenteIds } }) : [];
  const turnosPorEmpleado = { [String(empleado)]: turnos };
  ausenteIds.forEach(id => { turnosPorEmpleado[id] = turnosOtros.filter(t => String(t.empleado) === id); });

  const hContratadasMes = +turnos.reduce((acc, t) => acc + calcHMesProrr(t), 0).toFixed(2);
  const hFichadasMes    = +fichajes.reduce((acc, f) => acc + (f.duracion_horas || 0), 0).toFixed(2);

  const { horasCalendario, incluyeNoSemanal, rejilla } = resumenMensual({
    empleadoId: empleado, year, month, turnos, turnosPorEmpleado, ausencias, coberturas,
  });

  res.json({
    empleadoId: empleado, year, month,
    hContratadasMes, hFichadasMes, hCalendarioMes: horasCalendario,
    incluyeNoSemanal, rejilla,
  });
});

module.exports = router;
