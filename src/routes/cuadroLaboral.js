const router        = require('express').Router();
const CuadroLaboral = require('../models/CuadroLaboral');
const Empleado      = require('../models/Empleado');
const Turno         = require('../models/Turno');
const Cobertura     = require('../models/Cobertura');
const { generarXLSXCuadroLaboral } = require('../utils/xlsxCuadroLaboral');
const { generarPDFCuadroLaboral }  = require('../utils/pdfCuadroLaboral');
const { semanasProrrateadas, semanasSegunDiasTrabajo, diasTransportePorDefecto, diasTransporteSegunDiasSemana, diasTransporteSegunDiasTrabajo, horasCoberturaPorSemana } = require('../utils/semanasCuadroLaboral');

const EDITABLES = ['horario_base', 'dias_semana', 'festivos_locales',
  'plus_transporte', 'plus_festivo', 'plus_penosidad', 'plus_nocturnidad',
  'semana1', 'semana2', 'semana3', 'semana4', 'semana5', 'observaciones'];
const CAMPOS_IDENTIDAD = ['nombre', 'nif', 'naf', 'fecha_alta', 'ctto', 'categoria'];

router.use((req, res, next) => {
  if (!['admin', 'gestoria'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos' });
  next();
});

const CATEGORIA_DESDE_ROL = {
  director: 'DIRECTOR', administrativo: 'ADMINISTRATIVO/A', encargado: 'ENCARGADO/A',
  conductor: 'CONDUCTOR/A', peon: 'PEÓN', limpiador: 'LIMPIADOR/A',
};

const snapshotDeEmpleado = e => ({
  empleado:     e._id,
  nombre:       e.nombre_display || `${e.apellidos}, ${e.nombre}`,
  nif:          e.dni || '',
  naf:          e.nass || '',
  fecha_alta:   e.fecha_alta_empresa || null,
  ctto:         e.ctto || '',
  categoria:    CATEGORIA_DESDE_ROL[e.rol] || '',
  horario_base: e.horas_semanales_contrato,
  festivos_locales: e.festivos_locales || [],
  dias_trabajo: e.dias_trabajo || [],
  ...(e.dias_trabajo?.length ? { dias_semana: e.dias_trabajo.length } : {}),
});

async function diasTrabajadosPorEmpleado(empleadoIds) {
  const turnos = await Turno.find({ empleado: { $in: empleadoIds.filter(Boolean) } })
    .select('empleado dias_semana').lean();
  const mapa = new Map();
  for (const t of turnos) {
    const id = String(t.empleado);
    const set = mapa.get(id) || new Set();
    for (const d of (t.dias_semana || [])) set.add(d);
    mapa.set(id, set);
  }
  return mapa;
}

async function coberturasPorEmpleadoDelMes(anio, mes, empleadoIds) {
  const ids = [...new Set(empleadoIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1));
  const finMes = new Date(Date.UTC(anio, mes, 0, 23, 59, 59, 999));
  const coberturas = await Cobertura.find({
    empleado_cubre: { $in: ids }, fecha: { $gte: inicioMes, $lte: finMes },
  }).populate('turno').lean();
  const mapa = new Map();
  for (const c of coberturas) {
    const id = String(c.empleado_cubre);
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(c);
  }
  return mapa;
}

const sumarHoras = (base, extra) => (!extra ? base : +((base || 0) + extra).toFixed(2));

const usaDiasConcretos = fila => (fila.dias_trabajo || []).length > 0
  && (fila.dias_semana == null || fila.dias_semana === fila.dias_trabajo.length);

const plusTransporteDeFila = (fila, anio, mes, diasTrabajados) => {
  if (usaDiasConcretos(fila))
    return diasTransporteSegunDiasTrabajo(anio, mes, fila.dias_trabajo, fila.festivos_locales, fila.fecha_alta);
  if (fila.dias_semana != null)
    return diasTransporteSegunDiasSemana(anio, mes, fila.dias_semana, fila.festivos_locales, fila.fecha_alta);
  return diasTransportePorDefecto(anio, mes, fila.festivos_locales, diasTrabajados);
};

const conSemanasDesdeBase = (fila, { anio, mes, diasTrabajados, coberturaPorEmpleado }) => {
  const dias = fila.empleado ? diasTrabajados.get(String(fila.empleado)) : null;
  const esFinDeSemana = !!dias && (dias.has('sabado') || dias.has('domingo'));
  const base = usaDiasConcretos(fila)
    ? semanasSegunDiasTrabajo(anio, mes, fila.horario_base, fila.dias_trabajo)
    : esFinDeSemana
    ? { semana1: fila.horario_base, semana2: fila.horario_base, semana3: fila.horario_base,
        semana4: fila.horario_base, semana5: fila.horario_base }
    : semanasProrrateadas(anio, mes, fila.horario_base);

  const coberturas = fila.empleado && coberturaPorEmpleado ? coberturaPorEmpleado.get(String(fila.empleado)) : null;
  const extra = coberturas?.length ? horasCoberturaPorSemana(anio, mes, coberturas) : null;
  const semanas = extra ? {
    semana1: sumarHoras(base.semana1, extra[0]), semana2: sumarHoras(base.semana2, extra[1]),
    semana3: sumarHoras(base.semana3, extra[2]), semana4: sumarHoras(base.semana4, extra[3]),
    semana5: sumarHoras(base.semana5, extra[4]),
  } : base;

  return {
    ...fila,
    plus_transporte: plusTransporteDeFila(fila, anio, mes, dias),
    ...semanas,
  };
};

router.get('/meses', async (req, res) => {
  const docs = await CuadroLaboral.find({}, 'anio mes createdAt').sort({ anio: -1, mes: -1 }).lean();
  const vistos = new Set();
  res.json(docs.filter(d => { const k = `${d.anio}-${d.mes}`; if (vistos.has(k)) return false; vistos.add(k); return true; })
    .map(({ anio, mes, createdAt }) => ({ anio, mes, createdAt })));
});

router.get('/:anio/:mes', async (req, res) => {
  const anio = +req.params.anio, mes = +req.params.mes;
  const docs = await CuadroLaboral.find({ anio, mes });
  if (!docs.length) return res.status(404).json({ error: 'No existe el cuadro de ese mes' });
  res.json(cuadrosDelMes(anio, mes, docs));
});

const FILTRO_EN_CUADRO = { activo: { $ne: false }, excluir_cuadro_laboral: { $ne: true } };
const GRUPOS = ['sin_variaciones', 'con_variaciones'];
const TITULO_GRUPO = { sin_variaciones: 'Sin variaciones', con_variaciones: 'Con variaciones' };
const grupoDe = e => (e?.tiene_variaciones === false ? 'sin_variaciones' : 'con_variaciones');

function cuadrosDelMes(anio, mes, docs) {
  const cuadros = {};
  for (const g of GRUPOS) cuadros[g] = docs.find(d => (d.grupo || 'sin_variaciones') === g) || null;
  return { anio, mes, cuadros };
}

router.post('/generar', async (req, res) => {
  const anio = +req.body.anio, mes = +req.body.mes;
  if (!anio || !mes || mes < 1 || mes > 12) return res.status(400).json({ error: 'Año y mes requeridos' });

  const existente = await CuadroLaboral.findOne({ anio, mes });
  if (existente) return res.status(409).json({ error: 'Ya existe el cuadro de ese mes', id: existente._id });

  const ultimo = await CuadroLaboral.findOne({
    $or: [{ anio, mes: { $lt: mes } }, { anio: { $lt: anio } }],
  }).sort({ anio: -1, mes: -1 });
  const anteriores = ultimo ? await CuadroLaboral.find({ anio: ultimo.anio, mes: ultimo.mes }) : [];

  const empleadosActivos = await Empleado.find(FILTRO_EN_CUADRO);
  const porId = new Map(empleadosActivos.map(e => [String(e._id), e]));
  const excluidos = new Set((await Empleado.find({ excluir_cuadro_laboral: true }, '_id')).map(e => String(e._id)));
  const filasPlantilla = anteriores.flatMap(c => c.filas
    .filter(f => !(f.empleado && excluidos.has(String(f.empleado))))
    .map(f => ({ f, grupoAnterior: c.grupo || 'sin_variaciones' })));
  const idsFilas = [
    ...empleadosActivos.map(e => e._id),
    ...filasPlantilla.map(x => x.f.empleado),
  ];
  const [diasTrabajados, coberturaPorEmpleado] = await Promise.all([
    diasTrabajadosPorEmpleado(idsFilas),
    coberturasPorEmpleadoDelMes(anio, mes, idsFilas),
  ]);
  const opts = { anio, mes, diasTrabajados, coberturaPorEmpleado };

  const filas = { sin_variaciones: [], con_variaciones: [] };
  for (const { f, grupoAnterior } of filasPlantilla) {
    const emp = f.empleado ? porId.get(String(f.empleado)) : null;
    const base = emp ? { dias_semana: f.dias_semana ?? null, ...snapshotDeEmpleado(emp) } : {
      empleado: f.empleado, nombre: f.nombre, nif: f.nif, naf: f.naf, fecha_alta: f.fecha_alta,
      ctto: f.ctto, categoria: f.categoria, horario_base: f.horario_base, dias_semana: f.dias_semana ?? null,
      dias_trabajo: f.dias_trabajo || [],
      festivos_locales: f.festivos_locales,
    };
    filas[emp ? grupoDe(emp) : grupoAnterior].push({ ...conSemanasDesdeBase(base, opts), observaciones: '' });
  }
  const yaIncluidos = new Set(filasPlantilla.map(x => x.f.empleado && String(x.f.empleado)).filter(Boolean));
  for (const e of empleadosActivos) {
    if (!yaIncluidos.has(String(e._id))) filas[grupoDe(e)].push(conSemanasDesdeBase(snapshotDeEmpleado(e), opts));
  }

  const docs = [];
  for (const g of GRUPOS) {
    filas[g].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    docs.push(await CuadroLaboral.create({ anio, mes, grupo: g, filas: filas[g] }));
  }
  res.status(201).json({ ...cuadrosDelMes(anio, mes, docs), total_activos: empleadosActivos.length });
});

router.put('/:id/filas/:filaId', async (req, res) => {
  const cuadro = await CuadroLaboral.findById(req.params.id);
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });
  const fila = cuadro.filas.id(req.params.filaId);
  if (!fila) return res.status(404).json({ error: 'Fila no encontrada' });

  const campos = fila.empleado ? EDITABLES : EDITABLES.concat(CAMPOS_IDENTIDAD);
  const diasAntes = fila.dias_semana;
  for (const campo of campos) if (campo in req.body) fila[campo] = req.body[campo];
  if (fila.dias_semana != null && fila.dias_semana !== diasAntes) {
    fila.plus_transporte = plusTransporteDeFila(fila, cuadro.anio, cuadro.mes, null);
  }
  await cuadro.save();
  res.json(cuadro);
});

router.post('/:id/filas/:filaId/resincronizar', async (req, res) => {
  const cuadro = await CuadroLaboral.findById(req.params.id);
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });
  const fila = cuadro.filas.id(req.params.filaId);
  if (!fila) return res.status(404).json({ error: 'Fila no encontrada' });
  if (!fila.empleado) return res.status(400).json({ error: 'Esta fila no está vinculada a un empleado' });

  const e = await Empleado.findById(fila.empleado);
  if (!e) return res.status(404).json({ error: 'El empleado ya no existe' });
  const diasAntes = (fila.dias_trabajo || []).join(',');
  Object.assign(fila, snapshotDeEmpleado(e));
  if (fila.dias_trabajo.length && fila.dias_trabajo.join(',') !== diasAntes) {
    const coberturaPorEmpleado = await coberturasPorEmpleadoDelMes(cuadro.anio, cuadro.mes, [fila.empleado]);
    const { semana1, semana2, semana3, semana4, semana5, plus_transporte } = conSemanasDesdeBase(
      { empleado: fila.empleado, horario_base: fila.horario_base, festivos_locales: fila.festivos_locales,
        dias_trabajo: fila.dias_trabajo, dias_semana: fila.dias_semana, fecha_alta: fila.fecha_alta },
      { anio: cuadro.anio, mes: cuadro.mes, diasTrabajados: new Map(), coberturaPorEmpleado },
    );
    Object.assign(fila, { semana1, semana2, semana3, semana4, semana5, plus_transporte });
  }
  await cuadro.save();
  res.json(cuadro);
});

router.post('/:id/recalcular-semanas', async (req, res) => {
  const cuadro = await CuadroLaboral.findById(req.params.id);
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });

  const [diasTrabajados, coberturaPorEmpleado] = await Promise.all([
    diasTrabajadosPorEmpleado(cuadro.filas.map(f => f.empleado)),
    coberturasPorEmpleadoDelMes(cuadro.anio, cuadro.mes, cuadro.filas.map(f => f.empleado)),
  ]);
  const opts = { anio: cuadro.anio, mes: cuadro.mes, diasTrabajados, coberturaPorEmpleado };

  for (const fila of cuadro.filas) {
    const { semana1, semana2, semana3, semana4, semana5 } = conSemanasDesdeBase(
      { empleado: fila.empleado, horario_base: fila.horario_base, festivos_locales: fila.festivos_locales,
        dias_trabajo: fila.dias_trabajo, dias_semana: fila.dias_semana }, opts,
    );
    Object.assign(fila, { semana1, semana2, semana3, semana4, semana5 });
  }
  await cuadro.save();
  res.json(cuadro);
});

async function sincronizarMes(anio, mes) {
  const docs = await CuadroLaboral.find({ anio, mes });
  if (!docs.length) return null;
  const cuadros = {};
  for (const g of GRUPOS) cuadros[g] = docs.find(d => (d.grupo || 'sin_variaciones') === g)
    || new CuadroLaboral({ anio, mes, grupo: g, filas: [] });

  const empleadosActivos = await Empleado.find(FILTRO_EN_CUADRO);
  const vinculados = [...new Set(GRUPOS.flatMap(g => cuadros[g].filas.map(f => f.empleado && String(f.empleado)).filter(Boolean)))];
  const fichas = new Map((await Empleado.find({ _id: { $in: vinculados } }, 'tiene_variaciones')).map(e => [String(e._id), e]));

  let movidos = 0;
  for (const g of GRUPOS) {
    const otro = GRUPOS.find(x => x !== g);
    for (const fila of [...cuadros[g].filas]) {
      const ficha = fila.empleado ? fichas.get(String(fila.empleado)) : null;
      if (ficha && grupoDe(ficha) !== g) {
        const datos = fila.toObject(); delete datos._id;
        cuadros[otro].filas.push(datos);
        cuadros[g].filas.id(fila._id).deleteOne();
        movidos++;
      }
    }
  }

  const yaIncluidos = new Set(GRUPOS.flatMap(g => cuadros[g].filas.map(f => f.empleado && String(f.empleado)).filter(Boolean)));
  const nuevos = empleadosActivos.filter(e => !yaIncluidos.has(String(e._id)));
  const [diasTrabajados, coberturaPorEmpleado] = await Promise.all([
    diasTrabajadosPorEmpleado(nuevos.map(e => e._id)),
    coberturasPorEmpleadoDelMes(anio, mes, nuevos.map(e => e._id)),
  ]);
  const opts = { anio, mes, diasTrabajados, coberturaPorEmpleado };
  for (const e of nuevos) cuadros[grupoDe(e)].filas.push(conSemanasDesdeBase(snapshotDeEmpleado(e), opts));

  for (const g of GRUPOS) {
    if (movidos) cuadros[g].filas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    await cuadros[g].save();
  }
  return { ...cuadrosDelMes(anio, mes, GRUPOS.map(g => cuadros[g])), anadidos: nuevos.length, movidos, total_activos: empleadosActivos.length };
}

router.post('/mes/:anio/:mes/sincronizar', async (req, res) => {
  const r = await sincronizarMes(+req.params.anio, +req.params.mes);
  if (!r) return res.status(404).json({ error: 'No existe el cuadro de ese mes' });
  res.json(r);
});

router.post('/:id/sincronizar', async (req, res) => {
  const cuadro = await CuadroLaboral.findById(req.params.id);
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });
  const r = await sincronizarMes(cuadro.anio, cuadro.mes);
  res.json({ ...r, cuadro: r.cuadros[cuadro.grupo || 'sin_variaciones'] });
});

router.delete('/:id/filas/:filaId', async (req, res) => {
  const cuadro = await CuadroLaboral.findById(req.params.id);
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });
  cuadro.filas.id(req.params.filaId)?.deleteOne();
  await cuadro.save();
  res.json(cuadro);
});

router.delete('/:id', async (req, res) => {
  const cuadro = await CuadroLaboral.findByIdAndDelete(req.params.id);
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

router.delete('/mes/:anio/:mes', async (req, res) => {
  const r = await CuadroLaboral.deleteMany({ anio: +req.params.anio, mes: +req.params.mes });
  if (!r.deletedCount) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true, eliminados: r.deletedCount });
});

const seccion = c => ({ cuadro: c, titulo: TITULO_GRUPO[c.grupo || 'sin_variaciones'] });
const sufijo = g => (g === 'con_variaciones' ? '-con-variaciones' : '-sin-variaciones');

router.get('/:id/export/xlsx', async (req, res) => {
  const cuadro = await CuadroLaboral.findById(req.params.id).lean();
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });
  await generarXLSXCuadroLaboral(res, { anio: cuadro.anio, mes: cuadro.mes, secciones: [seccion(cuadro)], sufijo: sufijo(cuadro.grupo) });
});

router.get('/:id/export/pdf', async (req, res) => {
  const cuadro = await CuadroLaboral.findById(req.params.id).lean();
  if (!cuadro) return res.status(404).json({ error: 'No encontrado' });
  await generarPDFCuadroLaboral(res, { anio: cuadro.anio, mes: cuadro.mes, secciones: [seccion(cuadro)], sufijo: sufijo(cuadro.grupo) });
});

async function seccionesDelMes(req, res) {
  const anio = +req.params.anio, mes = +req.params.mes;
  const docs = await CuadroLaboral.find({ anio, mes }).lean();
  if (!docs.length) { res.status(404).json({ error: 'No encontrado' }); return null; }
  return { anio, mes, secciones: GRUPOS.map(g => docs.find(d => (d.grupo || 'sin_variaciones') === g)).filter(Boolean).map(seccion), sufijo: '' };
}
router.get('/mes/:anio/:mes/export/xlsx', async (req, res) => {
  const datos = await seccionesDelMes(req, res); if (datos) await generarXLSXCuadroLaboral(res, datos);
});
router.get('/mes/:anio/:mes/export/pdf', async (req, res) => {
  const datos = await seccionesDelMes(req, res); if (datos) await generarPDFCuadroLaboral(res, datos);
});

module.exports = router;
