const router    = require('express').Router();
const Fichaje = require('../models/Fichaje');
const { generarPDFFichajes } = require('../utils/pdfFichajes');
const { generarXLSXFichajes } = require('../utils/xlsxFichajes');
const { generarPDFFichaje } = require('../utils/pdfFichaje');

const dispositivoDe = req => (req.get('user-agent') || '').slice(0, 200);

function ubicacionDelBody(req) {
  const { lat, lng, precision } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng, precision: typeof precision === 'number' && Number.isFinite(precision) ? precision : undefined };
}

const confirmacionDe = req => ({ dispositivo: dispositivoDe(req), ip: req.ip });

const populate = q => q.populate('empleado', 'nombre apellidos dni nass');

function rangoQuery(req) {
  const query = {};
  if (['admin','gestoria'].includes(req.user.rol)) {
    if (req.query.empleado && req.query.empleado !== 'todos') query.empleado = req.query.empleado;
  } else if (req.user.rol === 'encargado' && req.query.empleado) {
    if (req.query.empleado !== 'todos') query.empleado = req.query.empleado;
  } else {
    if (!req.user.empleadoId) return null;
    query.empleado = req.user.empleadoId;
  }
  if (req.query.desde || req.query.hasta) {
    query['entrada.fecha_hora'] = {};
    if (req.query.desde) query['entrada.fecha_hora'].$gte = new Date(req.query.desde);
    if (req.query.hasta) query['entrada.fecha_hora'].$lte = new Date(`${req.query.hasta}T23:59:59.999`);
  }
  if (req.query.incluirAnulados !== '1') query.estado = { $ne: 'anulado' };
  return query;
}

router.get('/estado', async (req, res) => {
  if (!req.user.empleadoId) return res.json(null);
  const abierto = await Fichaje.findOne({ empleado: req.user.empleadoId, estado: 'abierto' });
  res.json(abierto);
});

router.post('/entrada', async (req, res) => {
  if (!req.user.empleadoId) return res.status(403).json({ error: 'Tu usuario no está vinculado a un empleado' });
  const yaAbierto = await Fichaje.findOne({ empleado: req.user.empleadoId, estado: 'abierto' });
  if (yaAbierto) return res.status(400).json({ error: 'Ya tienes un fichaje abierto' });

  const ubicacion = ubicacionDelBody(req);
  if (!ubicacion) return res.status(400).json({ error: 'Se necesita tu ubicación para fichar. Activa el permiso de ubicación e inténtalo de nuevo.', error_code: 'UBICACION_REQUERIDA' });

  try {
    const f = await Fichaje.create({
      empleado: req.user.empleadoId,
      entrada: { fecha_hora: new Date(), ...ubicacion, confirmacion: confirmacionDe(req) },
    });
    res.status(201).json(f);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/salida', async (req, res) => {
  if (!req.user.empleadoId) return res.status(403).json({ error: 'Tu usuario no está vinculado a un empleado' });
  const abierto = await Fichaje.findOne({ empleado: req.user.empleadoId, estado: 'abierto' });
  if (!abierto) return res.status(400).json({ error: 'No tienes ningún fichaje abierto' });

  const ubicacion = ubicacionDelBody(req);
  if (!ubicacion) return res.status(400).json({ error: 'Se necesita tu ubicación para fichar. Activa el permiso de ubicación e inténtalo de nuevo.', error_code: 'UBICACION_REQUERIDA' });

  abierto.salida = { fecha_hora: new Date(), ...ubicacion, confirmacion: confirmacionDe(req) };
  abierto.estado = 'cerrado';
  await abierto.save();
  res.json(abierto);
});

router.get('/', async (req, res) => {
  const query = rangoQuery(req);
  if (query === null) return res.json([]);
  res.json(await populate(Fichaje.find(query)).sort({ 'entrada.fecha_hora': -1 }));
});

router.post('/manual', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const { empleadoId, entrada, salida } = req.body;
  const motivo = String(req.body.motivo || '').trim();
  if (!empleadoId) return res.status(400).json({ error: 'Selecciona un empleado' });
  if (!motivo) return res.status(400).json({ error: 'Indica el motivo (queda registrado y lo verá el empleado)' });
  if (!entrada?.fecha_hora) return res.status(400).json({ error: 'Indica la fecha y hora de entrada' });
  if (salida?.fecha_hora && new Date(salida.fecha_hora) <= new Date(entrada.fecha_hora))
    return res.status(400).json({ error: 'La salida debe ser posterior a la entrada' });

  try {
    if (!salida?.fecha_hora) {
      const yaAbierto = await Fichaje.findOne({ empleado: empleadoId, estado: 'abierto' });
      if (yaAbierto) return res.status(400).json({ error: 'Ese empleado ya tiene un fichaje abierto' });
    }

    const f = await Fichaje.create({
      empleado: empleadoId,
      entrada: { fecha_hora: new Date(entrada.fecha_hora), lat: entrada.lat, lng: entrada.lng },
      salida: salida?.fecha_hora ? { fecha_hora: new Date(salida.fecha_hora), lat: salida.lat, lng: salida.lng } : undefined,
      estado: salida?.fecha_hora ? 'cerrado' : 'abierto',
      creado_manualmente: { fecha: new Date(), usuario: req.user.id, motivo },
    });
    res.status(201).json(await populate(Fichaje.findById(f._id)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const { entrada, salida, estado, motivo } = req.body;
    if (!motivo || !String(motivo).trim())
      return res.status(400).json({ error: 'Indica el motivo de la corrección (queda registrado)' });

    const f = await Fichaje.findById(req.params.id);
    if (!f) return res.status(404).json({ error: 'No encontrado' });
    if (f.estado === 'anulado') return res.status(400).json({ error: 'No se puede editar un fichaje anulado' });

    f.modificaciones.push({
      usuario: req.user.id,
      motivo: String(motivo).trim(),
      entrada_anterior: f.entrada,
      salida_anterior:  f.salida,
      estado_anterior:  f.estado,
    });
    if (entrada) f.entrada = entrada;
    if (salida)  f.salida  = salida;
    if (estado && ['abierto','cerrado'].includes(estado)) f.estado = estado;
    await f.save();
    res.json(await populate(Fichaje.findById(f._id)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id/anular', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const motivo = String(req.body.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Indica el motivo de la anulación (queda registrado)' });
  const f = await Fichaje.findById(req.params.id);
  if (!f) return res.status(404).json({ error: 'No encontrado' });
  if (f.estado === 'anulado') return res.status(400).json({ error: 'Ya está anulado' });
  f.modificaciones.push({
    usuario: req.user.id, motivo,
    entrada_anterior: f.entrada, salida_anterior: f.salida, estado_anterior: f.estado,
  });
  f.estado = 'anulado';
  f.anulacion = { fecha: new Date(), usuario: req.user.id, motivo };
  await f.save();
  res.json(await populate(Fichaje.findById(f._id)));
});

router.delete('/:id', (_req, res) => {
  res.status(405).json({ error: 'Los fichajes no se pueden borrar (deben conservarse 4 años). Usa "Anular" indicando el motivo.' });
});

router.get('/export/pdf', async (req, res) => {
  const query = rangoQuery(req);
  if (query === null) return res.status(403).json({ error: 'Tu usuario no está vinculado a un empleado' });
  const fichajes = await populate(Fichaje.find(query)).sort({ empleado: 1, 'entrada.fecha_hora': 1 });
  const propio = !['admin','gestoria'].includes(req.user.rol);
  const empleadoLabel = (propio || (req.query.empleado && req.query.empleado !== 'todos'))
    ? (fichajes[0]?.empleado?.nombre_display || 'Empleado')
    : 'Todos los empleados';
  await generarPDFFichajes(res, { fichajes, desde: req.query.desde, hasta: req.query.hasta, empleadoLabel, verNass: req.user.rol === 'admin' });
});

router.get('/export/xlsx', async (req, res) => {
  if (!['admin','gestoria'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const query = rangoQuery(req);
  const fichajes = await populate(Fichaje.find(query)).sort({ empleado: 1, 'entrada.fecha_hora': 1 });
  await generarXLSXFichajes(res, { fichajes, verNass: req.user.rol === 'admin' });
});

router.get('/:id/pdf', async (req, res) => {
  if (!['admin','encargado','gestoria'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const fichaje = await populate(Fichaje.findById(req.params.id));
  if (!fichaje) return res.status(404).json({ error: 'No encontrado' });
  await generarPDFFichaje(res, fichaje, { verNass: req.user.rol === 'admin' });
});

module.exports = router;
