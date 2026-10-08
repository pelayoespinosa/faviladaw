const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const Documento  = require('../models/Documento');
const Empleado   = require('../models/Empleado');
const Carpeta    = require('../models/Carpeta');
const Turno      = require('../models/Turno');
const Fichaje    = require('../models/Fichaje');
const { calcHMesProrr } = require('../utils/prorrateo');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/documentos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const esPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';
    const ok = file.mimetype === 'application/pdf'
      || (file.mimetype === 'application/octet-stream' && esPdfExt)
      || esPdfExt;
    if (ok) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'));
  },
});

router.get('/carpetas', async (req, res) => {
  if (!['admin','encargado','gestoria'].includes(req.user.rol))
    return res.status(403).json({ error: 'Sin permiso' });
  const [deDocumentos, deCarpetas] = await Promise.all([
    Documento.distinct('carpeta'),
    Carpeta.distinct('nombre'),
  ]);
  const todas = [...new Set([...deDocumentos, ...deCarpetas])];
  res.json(todas.sort((a, b) => a.localeCompare(b)));
});

router.post('/carpetas', async (req, res) => {
  if (!['admin','encargado'].includes(req.user.rol))
    return res.status(403).json({ error: 'Sin permiso' });
  const nombre = (req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre de la carpeta es obligatorio' });
  const [carpetaExistente, carpetasDeDocumentos] = await Promise.all([
    Carpeta.findOne({ nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }),
    Documento.distinct('carpeta'),
  ]);
  const existe = carpetaExistente || carpetasDeDocumentos.some(c => c.toLowerCase() === nombre.toLowerCase());
  if (existe) return res.status(400).json({ error: 'Ya existe una carpeta con ese nombre' });
  const carpeta = await Carpeta.create({ nombre });
  res.status(201).json(carpeta);
});

router.get('/pendientes', async (req, res) => {
  const { empleadoId } = req.user;
  if (!empleadoId) return res.json({ count: 0 });
  const count = await Documento.countDocuments({
    requiere_confirmacion: true,
    'confirmaciones': { $elemMatch: { empleado: empleadoId, $or: [{ recibido: false }, { conforme: false }] } },
  });
  res.json({ count });
});

router.get('/', async (req, res) => {
  const { rol, empleadoId } = req.user;
  try {
    if (['admin','encargado','gestoria'].includes(rol)) {
      const docs = await Documento.find()
        .populate('confirmaciones.empleado', 'nombre apellidos')
        .sort({ createdAt: -1 });
      const result = docs.map(d => {
        const obj = d.toObject();
        if (empleadoId) {
          obj.mi_confirmacion = d.confirmaciones.find(f => String(f.empleado?._id || f.empleado) === String(empleadoId));
        }
        return obj;
      });
      return res.json(result);
    }
    if (!empleadoId) return res.json([]);
    const docs = await Documento.find({ 'confirmaciones.empleado': empleadoId })
      .sort({ createdAt: -1 });
    const result = docs.map(d => {
      const obj = d.toObject();
      obj.mi_confirmacion = d.confirmaciones.find(f => String(f.empleado) === String(empleadoId));
      obj.confirmaciones = undefined;
      return obj;
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!['admin','encargado'].includes(req.user.rol))
    return res.status(403).json({ error: 'Sin permiso' });
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

  const { titulo, descripcion, carpeta, tipo_destinatario, grupo, requiere_confirmacion, empleados } = req.body;
  try {
    let empleadosIds = [];
    if (tipo_destinatario === 'todos') {
      const todos = await Empleado.find({ activo: { $ne: false } }, '_id');
      empleadosIds = todos.map(e => e._id);
    } else if (tipo_destinatario === 'grupo') {
      const grupoDocs = await Empleado.find({ rol: grupo, activo: { $ne: false } }, '_id');
      empleadosIds = grupoDocs.map(e => e._id);
    } else {
      empleadosIds = JSON.parse(empleados || '[]');
    }

    const confirmacionesInit = empleadosIds.map(eid => ({ empleado: eid }));

    const doc = await Documento.create({
      titulo,
      descripcion,
      carpeta: carpeta || 'General',
      nombre_archivo_original: req.file.originalname,
      nombre_archivo_storage:  req.file.filename,
      tipo_destinatario,
      grupo: grupo || undefined,
      requiere_confirmacion: requiere_confirmacion === 'true' || requiere_confirmacion === true,
      subido_por: req.user.id,
      confirmaciones: confirmacionesInit,
    });

    res.json(doc);
  } catch (e) {
    fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Documento.findById(req.params.id)
      .populate('confirmaciones.empleado', 'nombre apellidos');
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const { rol, empleadoId } = req.user;
    if (!['admin','encargado','gestoria'].includes(rol)) {
      const tieneAcceso = doc.confirmaciones.some(f => String(f.empleado?._id || f.empleado) === String(empleadoId));
      if (!tieneAcceso) return res.status(403).json({ error: 'Sin acceso' });
    }
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/archivo', async (req, res) => {
  try {
    const doc = await Documento.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const { rol, empleadoId } = req.user;
    if (!['admin','encargado','gestoria'].includes(rol)) {
      const tieneAcceso = doc.confirmaciones.some(f => String(f.empleado) === String(empleadoId));
      if (!tieneAcceso) return res.status(403).json({ error: 'Sin acceso' });
    }

    const filePath = path.join(uploadDir, doc.nombre_archivo_storage);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nombre_archivo_original)}"`);
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/confirmar', async (req, res) => {
  const { empleadoId } = req.user;
  if (!empleadoId) return res.status(403).json({ error: 'Usuario sin empleado vinculado' });

  const { recibido, conforme } = req.body;
  if (!recibido || !conforme) return res.status(400).json({ error: 'Debes marcar ambas casillas' });

  try {
    const doc = await Documento.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    if (!doc.requiere_confirmacion) return res.status(400).json({ error: 'Este documento no requiere confirmación' });

    const idx = doc.confirmaciones.findIndex(f => String(f.empleado) === String(empleadoId));
    if (idx === -1) return res.status(403).json({ error: 'No tienes acceso a este documento' });
    if (doc.confirmaciones[idx].recibido && doc.confirmaciones[idx].conforme) {
      return res.status(400).json({ error: 'Ya confirmaste este documento' });
    }

    doc.confirmaciones[idx].recibido      = true;
    doc.confirmaciones[idx].fecha_recibido = new Date();
    doc.confirmaciones[idx].conforme      = true;
    doc.confirmaciones[idx].fecha_conforme = new Date();
    await doc.save();

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  try {
    const doc = await Documento.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    const filePath = path.join(uploadDir, doc.nombre_archivo_storage);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
