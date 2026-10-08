const router   = require('express').Router();
const Usuario  = require('../models/Usuario');
const Empleado = require('../models/Empleado');
const { generarPasswordTemporal, generarUsernameBase, escapeRegex } = require('../utils/seguridad');

const ROLES_ACCESO = ['empleado', 'encargado', 'gestoria', 'admin'];

router.use((req, res, next) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  next();
});

async function esUltimoAdminActivo(usuario) {
  if (usuario.rol !== 'admin' || usuario.activo === false) return false;
  const otros = await Usuario.countDocuments({ _id: { $ne: usuario._id }, rol: 'admin', activo: true });
  return otros === 0;
}

router.get('/', async (req, res) => {
  const query = {};
  if (req.query.rol && ROLES_ACCESO.includes(req.query.rol)) query.rol = req.query.rol;
  if (req.query.busqueda) query.email = new RegExp(escapeRegex(req.query.busqueda), 'i');

  const usuarios = await Usuario.find(query, '-password')
    .populate('empleado', 'nombre apellidos dni activo')
    .sort({ createdAt: -1 }).lean();

  res.json(usuarios.map(u => ({
    ...u,
    bloqueado: !!(u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()),
    empleado: u.empleado
      ? { ...u.empleado, nombre_display: `${u.empleado.apellidos}, ${u.empleado.nombre}` }
      : null,
  })));
});

router.get('/empleados-sin-cuenta', async (req, res) => {
  const conCuenta = await Usuario.distinct('empleado', { empleado: { $ne: null } });
  const empleados = await Empleado.find(
    { _id: { $nin: conCuenta }, activo: { $ne: false } },
    'nombre apellidos dni'
  ).sort({ apellidos: 1, nombre: 1 }).lean();
  res.json(empleados.map(e => ({ ...e, nombre_display: `${e.apellidos}, ${e.nombre}` })));
});

router.post('/', async (req, res) => {
  const { empleado: empleadoId, username, rol } = req.body;
  if (!ROLES_ACCESO.includes(rol)) return res.status(400).json({ error: 'Rol de acceso no válido' });

  let emp = null;
  let usernameFinal;

  if (empleadoId) {
    emp = await Empleado.findById(empleadoId);
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
    const ya = await Usuario.findOne({ empleado: emp._id });
    if (ya) return res.status(400).json({ error: `Ese empleado ya tiene cuenta: ${ya.email}` });
    const base = generarUsernameBase(emp.nombre, emp.apellidos);
    usernameFinal = base;
    let n = 1;
    while (await Usuario.exists({ email: usernameFinal })) usernameFinal = `${base}${++n}`;
  } else {
    usernameFinal = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(usernameFinal))
      return res.status(400).json({ error: 'Nombre de usuario no válido: 3-40 caracteres, minúsculas, números y . _ - (sin espacios ni tildes)' });
    if (await Usuario.exists({ email: usernameFinal }))
      return res.status(400).json({ error: `Ya existe una cuenta con el usuario "${usernameFinal}"` });
  }

  const passwordTemporal = generarPasswordTemporal();
  const usuario = await Usuario.create({
    email: usernameFinal,
    password: passwordTemporal,
    rol,
    empleado: emp ? emp._id : null,
    debe_cambiar_password: true,
  });

  res.status(201).json({
    usuario: usuario.email,
    rol: usuario.rol,
    password_temporal: passwordTemporal,
    empleado: emp ? { _id: emp._id, nombre_display: emp.nombre_display } : null,
  });
});

router.put('/:id', async (req, res) => {
  const cuenta = await Usuario.findById(req.params.id);
  if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

  const { accion, rol } = req.body;

  if (accion === 'reset_password') {
    const passwordTemporal = generarPasswordTemporal();
    cuenta.password = passwordTemporal;
    cuenta.debe_cambiar_password = true;
    await cuenta.resetIntentos();
    await cuenta.save();
    return res.json({ ok: true, usuario: cuenta.email, password_temporal: passwordTemporal });
  }

  if (accion === 'rol') {
    if (!ROLES_ACCESO.includes(rol)) return res.status(400).json({ error: 'Rol no válido' });
    if (rol !== 'admin' && await esUltimoAdminActivo(cuenta))
      return res.status(400).json({ error: 'No se puede quitar el rol al único administrador activo' });
    cuenta.rol = rol;
    await cuenta.save();
    return res.json({ ok: true, usuario: cuenta.email, rol: cuenta.rol });
  }

  if (accion === 'activar' || accion === 'desactivar') {
    if (accion === 'desactivar' && await esUltimoAdminActivo(cuenta))
      return res.status(400).json({ error: 'No se puede desactivar al único administrador activo' });
    cuenta.activo = accion === 'activar';
    if (cuenta.activo) await cuenta.resetIntentos();
    await cuenta.save();
    return res.json({ ok: true, usuario: cuenta.email, activo: cuenta.activo });
  }

  if (accion === 'desbloquear') {
    await cuenta.resetIntentos();
    return res.json({ ok: true, usuario: cuenta.email });
  }

  res.status(400).json({ error: 'Acción no válida' });
});

router.delete('/:id', (req, res) => {
  res.status(405).json({ error: 'Las cuentas no se borran: desactívala con PUT {accion:"desactivar"}' });
});

module.exports = router;
