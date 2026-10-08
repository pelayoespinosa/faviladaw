const router  = require('express').Router();
const Turno   = require('../models/Turno');
const Cliente = require('../models/Cliente');
const { candidatosParaServicio } = require('../utils/recomendacionEmpleados');

const populate = q => q
  .populate('empleado', 'nombre apellidos dni tlf email')
  .populate('cliente',  'nombre nif zona tipo_cliente sucursal direccion_facturacion direccion_real cp provincia')
  .populate('furgoneta', 'numero matricula')
  .populate('servicios_adicionales', 'nombre precio');

router.get('/', async (req, res) => {
  const query = {};
  if (req.query.empleado)  query.empleado  = req.query.empleado;
  if (req.query.cliente)   query.cliente   = req.query.cliente;
  if (req.query.furgoneta) query.furgoneta = req.query.furgoneta;
  if (req.query.dia)       query.dias_semana = req.query.dia;
  if (!['admin','encargado'].includes(req.user.rol)) {
    if (req.user.rol !== 'empleado' || !req.user.empleadoId) return res.json([]);
    query.empleado = req.user.empleadoId;
  }
  res.json(await populate(Turno.find(query)).sort({ createdAt: -1 }));
});

router.get('/recomendaciones', async (req, res) => {
  if (!['admin','encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const { cliente: clienteId, tipo_tarea } = req.query;
  if (!clienteId) return res.status(400).json({ error: 'Falta el cliente' });
  const cliente = await Cliente.findById(clienteId, 'lat lng');
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const candidatos = await candidatosParaServicio({ cliente, tipo_tarea });
  res.json(candidatos.slice(0, 8));
});

router.get('/:id', async (req, res) => {
  const t = await populate(Turno.findById(req.params.id));
  if (!t) return res.status(404).json({ error: 'No encontrado' });
  const esPropio = req.user.empleadoId && String(t.empleado?._id) === String(req.user.empleadoId);
  if (!['admin','encargado'].includes(req.user.rol) && !esPropio)
    return res.status(403).json({ error: 'Sin permisos' });
  res.json(t);
});

router.post('/', async (req, res) => {
  if (!['admin','encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  try {
    const t = await Turno.create(req.body);
    res.status(201).json(await populate(Turno.findById(t._id)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  if (!['admin','encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  try {
    res.json(await populate(Turno.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  await Turno.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
