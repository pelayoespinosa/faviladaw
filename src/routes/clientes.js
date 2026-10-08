const router  = require('express').Router();
const Cliente = require('../models/Cliente');
const { escapeRegex } = require('../utils/seguridad');
const { geocodificarPrimero } = require('../utils/geocoding');
const { facturacionPorCliente } = require('../utils/facturacion');
const { clienteValidoParaMapa, candidatosGeocodificacion, localidadDifiereDeZona } = require('../utils/clienteMapa');

const CAMPOS_PERMITIDOS = [
  'nif', 'nombre', 'alias', 'sucursal', 'direccion_facturacion', 'direccion_real', 'zona',
  'cp', 'provincia', 'tlf', 'email', 'tipo_cliente',
  'persona_contacto',
];
const CAMPOS_ARRAY = ['horas_contratadas'];

const PROYECCION_EMPLEADO = 'nombre alias sucursal direccion_real zona cp';
const proyeccion = req => (req.user.rol === 'empleado' ? PROYECCION_EMPLEADO : undefined);

async function conFacturacion(req, docs) {
  if (req.user.rol === 'empleado') return docs;
  const fact = await facturacionPorCliente();
  return docs.map(c => {
    const f = fact.get(String(c._id));
    return { ...c.toJSON(), facturacion_mensual: f ? f.total : 0, facturacion_desglose: f ? f.lineas : [] };
  });
}

router.use((req, res, next) => {
  const { rol } = req.user;
  if (req.method === 'GET') {
    if (!['admin','encargado','empleado'].includes(rol)) return res.status(403).json({ error: 'Sin permiso' });
    return next();
  }
  if (rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  next();
});

router.get('/', async (req, res) => {
  const query = {};
  if (req.query.q) {
    const re = new RegExp(escapeRegex(req.query.q), 'i');
    query.$or = [{ nombre: re }, { alias: re }, { nif: re }, { direccion_facturacion: re }, { direccion_real: re }];
  }
  if (req.query.nombre) query.nombre       = new RegExp(escapeRegex(req.query.nombre), 'i');
  if (req.query.nif)    query.nif          = new RegExp(escapeRegex(req.query.nif), 'i');
  if (req.query.zona)   query.zona         = new RegExp(escapeRegex(req.query.zona), 'i');
  if (req.query.tipo)   query.tipo_cliente = req.query.tipo;
  res.json(await conFacturacion(req, await Cliente.find(query, proyeccion(req)).sort({ nombre: 1 })));
});

router.get('/mapa', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  const clientes = await Cliente.find(
    {}, 'nombre alias sucursal zona direccion_real direccion_facturacion provincia cp lat lng geocode_error geocode_manual'
  );
  const validos = clientes.filter(clienteValidoParaMapa);
  res.json(validos.map(c => ({
    _id: c._id,
    nombre: c.nombre,
    sucursal: c.sucursal,
    zona: c.zona,
    cp: c.cp,
    provincia: c.provincia,
    direccion_real: c.direccion_real,
    direccion_facturacion: c.direccion_facturacion,
    lat: c.lat,
    lng: c.lng,
    sin_geolocalizar: c.lat == null,
    geocode_error: c.geocode_error,
    geocode_manual: c.geocode_manual,
  })));
});

router.get('/:id', async (req, res) => {
  const c = await Cliente.findById(req.params.id, proyeccion(req));
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  res.json((await conFacturacion(req, [c]))[0]);
});

router.post('/:id/geocodificar', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  const c = await Cliente.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  if (!clienteValidoParaMapa(c)) {
    return res.status(400).json({ error: 'Este cliente no cumple los requisitos para el mapa (Asturias o dirección comercial)' });
  }
  const candidatos = await candidatosGeocodificacion(c);
  if (!candidatos.length) return res.status(400).json({ error: 'El cliente no tiene datos de dirección suficientes' });

  const resultado = await geocodificarPrimero(candidatos);
  c.geocoded_at = new Date();
  if (!resultado) {
    c.geocode_error = 'No se pudo geolocalizar la dirección';
    await c.save();
    return res.status(422).json({ error: c.geocode_error });
  }
  c.lat = resultado.lat; c.lng = resultado.lng; c.geocode_error = null; c.geocode_manual = false;
  let zonaCorregida = null;
  if (localidadDifiereDeZona(resultado.localidad, c.zona)) {
    zonaCorregida = { de: c.zona, a: resultado.localidad };
    c.zona = resultado.localidad;
  }
  await c.save();
  res.json({ lat: c.lat, lng: c.lng, zona_corregida: zonaCorregida });
});

router.put('/:id/ubicacion', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat/lng inválidos' });
  }
  const c = await Cliente.findByIdAndUpdate(
    req.params.id,
    { lat, lng, geocode_manual: true, geocode_error: null, geocoded_at: new Date() },
    { new: true }
  );
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  res.json({ lat: c.lat, lng: c.lng });
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await Cliente.create(req.body));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const update = {};
    for (const campo of CAMPOS_PERMITIDOS) {
      if (campo in req.body) {
        const val = req.body[campo];
        update[campo] = (val === '' || val === undefined) ? null : val;
      }
    }
    for (const campo of CAMPOS_ARRAY) {
      if (campo in req.body) update[campo] = req.body[campo] ?? [];
    }

    const doc = await Cliente.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  await Cliente.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;