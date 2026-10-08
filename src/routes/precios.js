const router = require('express').Router();
const PrecioServicio = require('../models/PrecioServicio');

router.get('/', async (req, res) => {
  res.json(await PrecioServicio.find().sort({ tipo_tarea: 1 }));
});

router.put('/:tipo_tarea', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  try {
    const { precio_hora } = req.body;
    const actualizado = await PrecioServicio.findOneAndUpdate(
      { tipo_tarea: req.params.tipo_tarea },
      { precio_hora },
      { new: true, runValidators: true, upsert: true }
    );
    res.json(actualizado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
