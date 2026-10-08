const router            = require('express').Router();
const ServicioAdicional = require('../models/ServicioAdicional');

router.use((req, res, next) => {
  if (req.method === 'GET') return next();
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  next();
});

router.get('/', async (req, res) => {
  res.json(await ServicioAdicional.find().sort({ nombre: 1 }));
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await ServicioAdicional.create(req.body));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await ServicioAdicional.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  await ServicioAdicional.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
