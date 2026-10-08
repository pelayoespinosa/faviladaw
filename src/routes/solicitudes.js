const router     = require('express').Router();
const Solicitud  = require('../models/Solicitud');
const Producto   = require('../models/Producto');

const populate = q => q
  .populate('solicitante', 'nombre apellidos dni')
  .populate('cliente', 'nombre alias sucursal direccion_real zona')
  .populate('asignado_a', 'nombre apellidos dni');

router.get('/', async (req, res) => {
  const { rol, empleadoId } = req.user;
  let query = {};
  if (!['admin','encargado'].includes(rol) || req.query.propio === '1') {
    if (!empleadoId) return res.json([]);
    query = { $or: [{ solicitante: empleadoId }, { asignado_a: empleadoId }] };
  }
  res.json(await populate(Solicitud.find(query)).sort({ createdAt: -1 }));
});

router.post('/', async (req, res) => {
  if (!req.user.empleadoId) return res.status(403).json({ error: 'Tu usuario no está vinculado a un empleado' });
  const { cliente, productos, observaciones } = req.body;
  if (!cliente) return res.status(400).json({ error: 'Selecciona un cliente' });
  if (!Array.isArray(productos) || !productos.length) return res.status(400).json({ error: 'Añade al menos un producto' });
  try {
    const items = [];
    for (const it of productos) {
      const cantidad = Number(it.cantidad);
      if (!cantidad || cantidad <= 0) return res.status(400).json({ error: 'Cantidad no válida' });
      if (it.producto_id) {
        const prod = await Producto.findById(it.producto_id);
        if (!prod || prod.activo === false) return res.status(400).json({ error: 'Uno de los productos elegidos ya no está disponible' });
        items.push({ producto: prod.nombre, precio: prod.precio, cantidad, es_otro: false });
      } else {
        const nombre = String(it.nombre || '').trim();
        if (!nombre) return res.status(400).json({ error: 'Indica el nombre del producto' });
        items.push({ producto: nombre, precio: null, cantidad, es_otro: true });
      }
    }
    const s = await Solicitud.create({
      solicitante: req.user.empleadoId,
      cliente,
      productos: items,
      observaciones,
    });
    res.status(201).json(await populate(Solicitud.findById(s._id)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id/asignar', async (req, res) => {
  if (!['admin','encargado'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  const { empleadoId } = req.body;
  if (!empleadoId) return res.status(400).json({ error: 'Selecciona un empleado' });
  try {
    const s = await Solicitud.findByIdAndUpdate(req.params.id, {
      asignado_a: empleadoId, estado: 'asignado', fecha_asignacion: new Date(),
    }, { new: true });
    if (!s) return res.status(404).json({ error: 'No encontrada' });
    res.json(await populate(Solicitud.findById(s._id)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id/entregar', async (req, res) => {
  const s = await Solicitud.findById(req.params.id);
  if (!s) return res.status(404).json({ error: 'No encontrada' });
  const puede = ['admin','encargado'].includes(req.user.rol) || String(s.asignado_a) === String(req.user.empleadoId);
  if (!puede) return res.status(403).json({ error: 'Sin permisos' });
  s.estado = 'entregado';
  s.fecha_entrega = new Date();
  await s.save();
  res.json(await populate(Solicitud.findById(s._id)));
});

router.put('/:id/cancelar', async (req, res) => {
  const s = await Solicitud.findById(req.params.id);
  if (!s) return res.status(404).json({ error: 'No encontrada' });
  const puede = ['admin','encargado'].includes(req.user.rol)
    || (String(s.solicitante) === String(req.user.empleadoId) && s.estado === 'pendiente');
  if (!puede) return res.status(403).json({ error: 'Sin permisos' });
  s.estado = 'cancelado';
  await s.save();
  res.json(await populate(Solicitud.findById(s._id)));
});

router.delete('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  await Solicitud.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
