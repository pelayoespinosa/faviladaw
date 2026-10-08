const router   = require('express').Router();
const Producto = require('../models/Producto');

router.get('/', async (req, res) => {
  const query = {};
  if (!(req.user.rol === 'admin' && req.query.inactivos === '1')) query.activo = { $ne: false };
  const productos = await Producto.find(query).sort({ nombre: 1 });
  res.json(productos);
});

router.post('/', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const { nombre, precio } = req.body;
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (precio == null || Number(precio) < 0) return res.status(400).json({ error: 'Indica un precio válido' });
  try {
    const producto = await Producto.create({ nombre: String(nombre).trim(), precio: Number(precio) });
    res.status(201).json(producto);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Ya existe un producto con ese nombre' });
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const { nombre, precio } = req.body;
  const datos = {};
  if (nombre != null) datos.nombre = String(nombre).trim();
  if (precio != null) datos.precio = Number(precio);
  try {
    const producto = await Producto.findByIdAndUpdate(req.params.id, datos, { new: true, runValidators: true });
    if (!producto) return res.status(404).json({ error: 'No encontrado' });
    res.json(producto);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Ya existe un producto con ese nombre' });
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const producto = await Producto.findByIdAndUpdate(req.params.id, { activo: false }, { new: true });
  if (!producto) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

router.post('/:id/reactivar', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const producto = await Producto.findByIdAndUpdate(req.params.id, { activo: true }, { new: true });
  if (!producto) return res.status(404).json({ error: 'No encontrado' });
  res.json(producto);
});

module.exports = router;
