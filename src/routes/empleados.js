const router   = require('express').Router();
const Empleado = require('../models/Empleado');
const Usuario  = require('../models/Usuario');
const { escapeRegex, generarPasswordTemporal, generarUsernameBase } = require('../utils/seguridad');

const ROLES_ACCESO = ['empleado', 'encargado', 'gestoria', 'admin'];
const CAMPOS_EMPLEADO = ['nombre', 'apellidos', 'dni', 'tlf', 'email', 'rol', 'horas_semanales_contrato',
  'ctto', 'dias_semana_contrato', 'nass', 'cp_residencia', 'fecha_alta_empresa', 'fecha_nacimiento'];
const CAMPOS_ARRAY = ['especialidades', 'ubicaciones', 'festivos_locales', 'dias_trabajo'];
const CAMPOS_BOOLEANOS = ['excluir_cuadro_laboral', 'tiene_variaciones'];
const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const CAMPOS_SENSIBLES = ['nass', 'cp_residencia', 'fecha_alta_empresa', 'fecha_nacimiento'];
const proyeccionEmpleado = rol => (rol === 'admin' ? undefined : CAMPOS_SENSIBLES.map(c => `-${c}`).join(' '));

router.use((req, res, next) => {
  if (req.method === 'GET' && !['admin','encargado','gestoria'].includes(req.user.rol))
    return res.status(403).json({ error: 'Sin permiso' });
  next();
});

function soloCamposEmpleado(body) {
  const out = {};
  for (const c of CAMPOS_EMPLEADO) if (c in body) out[c] = body[c];
  for (const c of CAMPOS_ARRAY) if (c in body) out[c] = body[c] ?? [];
  for (const c of CAMPOS_BOOLEANOS) if (c in body) out[c] = body[c] === true || body[c] === 'true';
  if (out.dni) out.dni = String(out.dni).trim().toUpperCase();
  if ('horas_semanales_contrato' in out) {
    out.horas_semanales_contrato = out.horas_semanales_contrato === '' || out.horas_semanales_contrato == null
      ? null : parseFloat(out.horas_semanales_contrato);
  }
  for (const c of ['nass', 'cp_residencia']) {
    if (c in out) out[c] = (out[c] === '' || out[c] == null) ? null : String(out[c]).trim();
  }
  for (const c of ['fecha_alta_empresa', 'fecha_nacimiento']) {
    if (c in out) out[c] = (out[c] === '' || out[c] == null) ? null : out[c];
  }
  if ('festivos_locales' in out) out.festivos_locales = out.festivos_locales.filter(Boolean).slice(0, 2);
  if ('dias_trabajo' in out) out.dias_trabajo = DIAS_SEMANA.filter(d => out.dias_trabajo.includes(d));
  return out;
}

async function generarUsernameLibre(nombre, apellidos) {
  const base = generarUsernameBase(nombre, apellidos);
  let candidato = base, n = 1;
  while (await Usuario.exists({ email: candidato })) candidato = `${base}${++n}`;
  return candidato;
}

async function crearCuentaParaEmpleado(empleado, rolAcceso) {
  const rol = ROLES_ACCESO.includes(rolAcceso) ? rolAcceso : 'empleado';
  const username = await generarUsernameLibre(empleado.nombre, empleado.apellidos);
  const passwordTemporal = generarPasswordTemporal();
  const usuario = await Usuario.create({
    email: username,
    password: passwordTemporal,
    rol,
    empleado: empleado._id,
    debe_cambiar_password: true,
  });
  return { usuario, passwordTemporal };
}

router.get('/', async (req, res) => {
  const query = {};
  if (req.query.nombre) {
    const re = new RegExp(escapeRegex(req.query.nombre), 'i');
    query.$or = [{ nombre: re }, { apellidos: re }];
  }
  if (req.query.dni)    query.dni    = new RegExp(escapeRegex(req.query.dni), 'i');
  if (req.query.inactivos !== '1') query.activo = { $ne: false };

  const empleados = await Empleado.find(query, proyeccionEmpleado(req.user.rol)).sort({ apellidos: 1, nombre: 1 }).lean();
  empleados.forEach(e => {
    e.nombre_display = `${e.apellidos}, ${e.nombre}`;
    e.nombre_completo = `${e.nombre} ${e.apellidos}`;
  });

  const cuentas = await Usuario.find(
    { empleado: { $in: empleados.map(e => e._id) } },
    'email rol activo empleado debe_cambiar_password'
  ).lean();
  const porEmpleado = Object.fromEntries(cuentas.map(u => [String(u.empleado), u]));
  res.json(empleados.map(e => ({ ...e, cuenta: porEmpleado[String(e._id)] || null })));
});

router.get('/:id', async (req, res) => {
  const e = await Empleado.findById(req.params.id, proyeccionEmpleado(req.user.rol));
  if (!e) return res.status(404).json({ error: 'No encontrado' });
  res.json(e);
});

router.post('/', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const datos = soloCamposEmpleado(req.body);
    const crearUsuario = req.body.crear_usuario !== false && req.body.crear_usuario !== 'false';
    const rolAcceso = req.body.rol_acceso;

    if (datos.dni) {
      const existente = await Empleado.findOne({ dni: datos.dni });
      if (existente && existente.activo !== false) {
        return res.status(400).json({ error: `Ya existe un empleado activo con ese DNI: ${existente.nombre_display}` });
      }
      if (existente) {
        Object.assign(existente, datos, { activo: true, fecha_baja: null });
        await existente.save();
        const cuenta = await Usuario.findOne({ empleado: existente._id });
        let credenciales = null;
        if (cuenta) {
          cuenta.activo = true;
          await cuenta.resetIntentos();
          await cuenta.save();
        } else if (crearUsuario) {
          const { usuario, passwordTemporal } = await crearCuentaParaEmpleado(existente, rolAcceso);
          credenciales = { usuario: usuario.email, password_temporal: passwordTemporal, rol: usuario.rol };
        }
        return res.status(200).json({
          empleado: existente,
          reactivado: true,
          cuenta_reactivada: !!cuenta,
          cuenta: cuenta ? { email: cuenta.email, rol: cuenta.rol } : null,
          credenciales,
        });
      }
    }

    const empleado = await Empleado.create(datos);
    let credenciales = null;
    if (crearUsuario) {
      const { usuario, passwordTemporal } = await crearCuentaParaEmpleado(empleado, rolAcceso);
      credenciales = { usuario: usuario.email, password_temporal: passwordTemporal, rol: usuario.rol };
    }
    res.status(201).json({ empleado, credenciales });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const emp = await Empleado.findByIdAndUpdate(req.params.id, soloCamposEmpleado(req.body), { new: true, runValidators: true });
    if (!emp) return res.status(404).json({ error: 'No encontrado' });
    res.json(emp);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const emp = await Empleado.findById(req.params.id);
  if (!emp) return res.status(404).json({ error: 'No encontrado' });
  emp.activo = false;
  emp.fecha_baja = new Date();
  await emp.save();
  await Usuario.updateMany({ empleado: emp._id }, { activo: false });
  res.json({ ok: true, baja: true });
});

router.post('/:id/reactivar', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const emp = await Empleado.findById(req.params.id);
  if (!emp) return res.status(404).json({ error: 'No encontrado' });
  emp.activo = true;
  emp.fecha_baja = null;
  await emp.save();
  await Usuario.updateMany({ empleado: emp._id }, { activo: true });
  res.json({ ok: true, empleado: emp });
});

router.post('/:id/usuario', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const emp = await Empleado.findById(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
  const existente = await Usuario.findOne({ empleado: emp._id });
  if (existente) return res.status(400).json({ error: `Ya tiene cuenta: ${existente.email}` });
  const { usuario, passwordTemporal } = await crearCuentaParaEmpleado(emp, req.body.rol_acceso);
  res.status(201).json({ usuario: usuario.email, rol: usuario.rol, password_temporal: passwordTemporal });
});

router.put('/:id/usuario', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const cuenta = await Usuario.findOne({ empleado: req.params.id });
  if (!cuenta) return res.status(404).json({ error: 'Este empleado no tiene cuenta de acceso' });

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
    cuenta.rol = rol;
    await cuenta.save();
    return res.json({ ok: true, usuario: cuenta.email, rol: cuenta.rol });
  }
  if (accion === 'activar' || accion === 'desactivar') {
    cuenta.activo = accion === 'activar';
    if (cuenta.activo) await cuenta.resetIntentos();
    await cuenta.save();
    return res.json({ ok: true, usuario: cuenta.email, activo: cuenta.activo });
  }
  res.status(400).json({ error: 'Acción no válida' });
});

module.exports = router;
