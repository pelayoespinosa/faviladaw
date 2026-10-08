const router    = require('express').Router();
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const Usuario   = require('../models/Usuario');
const Sesion    = require('../models/Sesion');
const protect   = require('../middlewares/auth');

const SESION_DIAS = 30;
const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');

function firmarAcceso(usuario) {
  return jwt.sign(
    { id: usuario._id, rol: usuario.rol, empleadoId: usuario.empleado?._id || usuario.empleado || null },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function nombreDispositivo(ua = '') {
  const so = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iPhone/iPad'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux' : 'Dispositivo';
  const nav = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox' : 'navegador';
  return `${so} · ${nav}`;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Prueba de nuevo en unos minutos.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string')
      return res.status(400).json({ error: 'Credenciales incorrectas' });
    const usuario = await Usuario.findOne({ email: email.trim().toLowerCase() }).populate('empleado','_id nombre apellidos');
    if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (usuario.activo === false)
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta con administración.' });

    if (usuario.estaBloqueado()) {
      return res.status(403).json({
        error: `Cuenta bloqueada por demasiados intentos fallidos. Podrás volver a intentarlo el ${usuario.bloqueado_hasta.toLocaleDateString('es-ES')}.`,
      });
    }

    if (!(await usuario.verificarPassword(password))) {
      const bloqueadaAhora = await usuario.registrarIntentoFallido();
      if (bloqueadaAhora) {
        return res.status(403).json({
          error: `Demasiados intentos fallidos. La cuenta ha quedado bloqueada 7 días, hasta el ${usuario.bloqueado_hasta.toLocaleDateString('es-ES')}.`,
        });
      }
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    await usuario.resetIntentos();

    const token = firmarAcceso(usuario);

    let refreshToken = null;
    if (req.body.recordar === true) {
      refreshToken = crypto.randomBytes(32).toString('base64url');
      await Sesion.create({
        usuario: usuario._id,
        token_hash: hashToken(refreshToken),
        nombre_dispositivo: nombreDispositivo(req.get('user-agent') || ''),
        ip_creacion: req.ip,
        expira: new Date(Date.now() + SESION_DIAS * 24 * 60 * 60 * 1000),
      });
    }

    res.json({
      token, refreshToken, email: usuario.email, rol: usuario.rol,
      empleadoId: usuario.empleado?._id || null,
      debe_cambiar_password: !!usuario.debe_cambiar_password,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Prueba de nuevo en unos minutos.' },
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  const { refreshToken } = req.body;
  const invalido = () => res.status(401).json({ error: 'Sesión caducada', error_code: 'REFRESH_INVALIDO' });
  if (typeof refreshToken !== 'string' || !refreshToken) return invalido();

  const hash = hashToken(refreshToken);
  const sesion = await Sesion.findOne({
    $or: [
      { token_hash: hash },
      { token_hash_anterior: hash, rotado_en: { $gt: new Date(Date.now() - 60000) } },
    ],
  });
  if (!sesion || sesion.revocada?.fecha || sesion.expira <= new Date()) return invalido();

  const usuario = await Usuario.findById(sesion.usuario);
  if (!usuario || usuario.activo === false || usuario.estaBloqueado()) return invalido();

  const nuevo = crypto.randomBytes(32).toString('base64url');
  sesion.token_hash_anterior = sesion.token_hash;
  sesion.token_hash = hashToken(nuevo);
  sesion.rotado_en = new Date();
  sesion.ultimo_uso = new Date();
  await sesion.save();

  res.json({
    token: firmarAcceso(usuario), refreshToken: nuevo,
    rol: usuario.rol, empleadoId: usuario.empleado || null,
    debe_cambiar_password: !!usuario.debe_cambiar_password,
  });
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (typeof refreshToken === 'string' && refreshToken) {
    await Sesion.updateOne(
      { token_hash: hashToken(refreshToken), 'revocada.fecha': { $exists: false } },
      { $set: { revocada: { fecha: new Date(), motivo: 'logout' } } }
    );
  }
  res.json({ ok: true });
});

router.get('/sesiones', protect, async (req, res) => {
  const sesiones = await Sesion.find(
    { usuario: req.user.id, 'revocada.fecha': { $exists: false }, expira: { $gt: new Date() } },
    'nombre_dispositivo ultimo_uso expira createdAt'
  ).sort({ ultimo_uso: -1 });
  res.json(sesiones);
});

router.delete('/sesiones/:id', protect, async (req, res) => {
  const r = await Sesion.updateOne(
    { _id: req.params.id, usuario: req.user.id, 'revocada.fecha': { $exists: false } },
    { $set: { revocada: { fecha: new Date(), motivo: 'cerrada por el usuario' } } }
  );
  if (!r.matchedCount) return res.status(404).json({ error: 'No encontrada' });
  res.json({ ok: true });
});

router.get('/me', protect, async (req, res) => {
  const usuario = await Usuario.findById(req.user.id, 'email rol debe_cambiar_password');
  if (!usuario) return res.status(404).json({ error: 'No encontrado' });
  res.json({ email: usuario.email, rol: usuario.rol, debe_cambiar_password: !!usuario.debe_cambiar_password });
});

router.put('/password', loginLimiter, protect, async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body;
  if (typeof passwordActual !== 'string' || typeof passwordNuevo !== 'string')
    return res.status(400).json({ error: 'Datos no válidos' });
  if (passwordNuevo.length < 8)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });

  const usuario = await Usuario.findById(req.user.id);
  if (!usuario) return res.status(404).json({ error: 'No encontrado' });
  if (!(await usuario.verificarPassword(passwordActual)))
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

  usuario.password = passwordNuevo;
  usuario.debe_cambiar_password = false;
  await usuario.save();
  res.json({ ok: true });
});

module.exports = router;
