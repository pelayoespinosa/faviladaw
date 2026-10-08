const router     = require('express').Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const Furgoneta  = require('../models/Furgoneta');

router.use((req, res, next) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  next();
});

const populate = q => q.populate('conductores', 'nombre apellidos dni tlf');

const uploadDir = path.join(__dirname, '../../uploads/flota');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const EXT_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (EXT_PERMITIDAS.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF o imágenes (jpg, png, webp)'));
  },
});

router.get('/', async (req, res) => {
  res.json(await populate(Furgoneta.find()).sort({ numero: 1 }));
});

router.get('/:id', async (req, res) => {
  const f = await populate(Furgoneta.findById(req.params.id));
  if (!f) return res.status(404).json({ error: 'No encontrada' });
  res.json(f);
});

router.post('/', async (req, res) => {
  try {
    const f = await Furgoneta.create(req.body);
    res.status(201).json(await populate(Furgoneta.findById(f._id)));
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Ya existe una furgoneta con esa matrícula' });
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const f = await populate(Furgoneta.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }));
    if (!f) return res.status(404).json({ error: 'No encontrada' });
    res.json(f);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Ya existe una furgoneta con esa matrícula' });
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  await Furgoneta.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/notas', async (req, res) => {
  const { texto, fecha } = req.body;
  if (!texto || !texto.trim()) return res.status(400).json({ error: 'El texto de la nota es obligatorio' });
  try {
    const f = await Furgoneta.findByIdAndUpdate(
      req.params.id,
      { $push: { notas: { texto: texto.trim(), fecha: fecha || null } } },
      { new: true, runValidators: true },
    );
    if (!f) return res.status(404).json({ error: 'No encontrada' });
    res.status(201).json(await populate(Furgoneta.findById(f._id)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id/notas/:notaId', async (req, res) => {
  const f = await populate(Furgoneta.findByIdAndUpdate(
    req.params.id,
    { $pull: { notas: { _id: req.params.notaId } } },
    { new: true },
  ));
  if (!f) return res.status(404).json({ error: 'No encontrada' });
  res.json(f);
});

router.post('/:id/archivos', (req, res, next) => {
  upload.single('archivo')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  try {
    const f = await Furgoneta.findByIdAndUpdate(
      req.params.id,
      { $push: { archivos: {
        nombre: (req.body.nombre || req.file.originalname).trim(),
        nombre_archivo_original: req.file.originalname,
        nombre_archivo_storage:  req.file.filename,
        mimetype: req.file.mimetype,
      } } },
      { new: true, runValidators: true },
    );
    if (!f) { fs.unlink(path.join(uploadDir, req.file.filename), () => {}); return res.status(404).json({ error: 'No encontrada' }); }
    res.status(201).json(await populate(Furgoneta.findById(f._id)));
  } catch (e) {
    fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/archivos/:archivoId', async (req, res) => {
  const f = await Furgoneta.findById(req.params.id);
  if (!f) return res.status(404).json({ error: 'No encontrada' });
  const a = f.archivos.id(req.params.archivoId);
  if (!a) return res.status(404).json({ error: 'Archivo no encontrado' });
  const filePath = path.join(uploadDir, a.nombre_archivo_storage);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en disco' });
  res.setHeader('Content-Type', a.mimetype || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.nombre_archivo_original)}"`);
  res.sendFile(filePath);
});

router.delete('/:id/archivos/:archivoId', async (req, res) => {
  const existente = await Furgoneta.findById(req.params.id);
  if (!existente) return res.status(404).json({ error: 'No encontrada' });
  const a = existente.archivos.id(req.params.archivoId);
  if (!a) return res.status(404).json({ error: 'Archivo no encontrado' });
  const storageName = a.nombre_archivo_storage;

  const f = await populate(Furgoneta.findByIdAndUpdate(
    req.params.id,
    { $pull: { archivos: { _id: req.params.archivoId } } },
    { new: true },
  ));
  const filePath = path.join(uploadDir, storageName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json(f);
});

module.exports = router;
