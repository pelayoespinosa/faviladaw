const router = require('express').Router();
const { buscarDirecciones } = require('../utils/geocoding');

router.get('/buscar', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  const resultados = await buscarDirecciones(req.query.q, 5);
  res.json(resultados);
});

module.exports = router;
