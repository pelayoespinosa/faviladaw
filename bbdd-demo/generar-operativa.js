process.env.TZ = 'Europe/Madrid';
const fs = require('fs');
const path = require('path');
const { calcHSemProrr } = require('../src/utils/prorrateo');

const DIR = __dirname;
const leer = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
const escribir = (n, d) => fs.writeFileSync(path.join(DIR, n), JSON.stringify(d, null, 2) + '\n');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(777001);
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elige = (arr) => arr[Math.floor(rnd() * arr.length)];
const pondera = (pares) => {
  const total = pares.reduce((s, p) => s + p[1], 0);
  let r = rnd() * total;
  for (const [v, p] of pares) { if ((r -= p) < 0) return v; }
  return pares[0][0];
};
const medio = (a, b) => Math.round((a + rnd() * (b - a)) * 2) / 2;
const r2 = (n) => Math.round(n * 100) / 100;

let contador = 0;
const oid = (pre) => ({ $oid: pre + (++contador).toString(16).padStart(24 - pre.length, '0') });
const idDe = (x) => (x && x.$oid) || x;
const F = (d) => ({ $date: new Date(d).toISOString() });

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const aHHMM = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
const pad = (n) => String(n).padStart(2, '0');
const claveFecha = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const sumaDias = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

const HOY = new Date();
const HOY_UTC = utc(HOY.getFullYear(), HOY.getMonth() + 1, HOY.getDate());

const empleados = leer('empleados.json');
const usuarios = leer('usuarios.json');
const clientes = leer('clientes.json');
const emp = (id) => empleados.find((e) => idDe(e._id) === id);

const ZONA_A_REGION = {
  Oviedo: 'OVI', Siero: 'OVI', Llanera: 'OVI',
  'Gijón': 'GIJ', 'Carreño': 'GIJ',
  'Avilés': 'AVI', 'Castrillón': 'AVI', Corvera: 'AVI',
  Langreo: 'CUE', Mieres: 'CUE', Laviana: 'CUE',
  Villaviciosa: 'ORI', Llanes: 'ORI', Ribadesella: 'ORI', 'Cangas de Onís': 'ORI',
  Pravia: 'OES', Grado: 'OES', 'Valdés': 'OES', Navia: 'OES', Tineo: 'OES', 'Cangas del Narcea': 'OES',
};
const REGIONES = ['OVI', 'GIJ', 'AVI', 'CUE', 'ORI', 'OES'];
const CPS_REGION = {
  OVI: ['33001', '33003', '33005', '33006', '33011', '33510', '33424'],
  GIJ: ['33201', '33203', '33205', '33207', '33209', '33430'],
  AVI: ['33400', '33402', '33405', '33450', '33404'],
  CUE: ['33900', '33600', '33980'],
  ORI: ['33300', '33500', '33550', '33560'],
  OES: ['33120', '33820', '33710', '33870', '33800'],
};
const VECINAS = { OVI: ['AVI', 'CUE', 'GIJ'], GIJ: ['OVI', 'AVI', 'ORI'], AVI: ['OVI', 'GIJ', 'OES'], CUE: ['OVI'], ORI: ['GIJ', 'OVI'], OES: ['AVI'] };

const personal = empleados.filter((e) => ['peon', 'limpiador', 'conductor'].includes(e.rol));
const encargados = empleados.filter((e) => e.rol === 'encargado');
const oficina = empleados.filter((e) => ['encargado', 'administrativo'].includes(e.rol));
const conductores = empleados.filter((e) => e.rol === 'conductor');
conductores.forEach((e) => { e._conduccion = pondera([[5, 3], [7.5, 3], [6, 1]]); });

clientes.forEach((c) => { c._region = ZONA_A_REGION[c.zona]; });
const demandaProv = {};
REGIONES.forEach((r) => { demandaProv[r] = 0; });
clientes.forEach((c) => { demandaProv[c._region] += c.horas_contratadas[0].horas; });
const capTotal = personal.reduce((s, e) => s + e.horas_semanales_contrato, 0);
const demTotal = REGIONES.reduce((s, r) => s + demandaProv[r], 0);
const objetivo = {};
REGIONES.forEach((r) => { objetivo[r] = (demandaProv[r] / demTotal) * capTotal; });

const asignado = {};
REGIONES.forEach((r) => { asignado[r] = 0; });
const regionDe = {};
[...personal].sort((a, b) => b.horas_semanales_contrato - a.horas_semanales_contrato).forEach((e) => {
  let mejor = REGIONES[0], mejorDef = -Infinity;
  REGIONES.forEach((r) => {
    const def = objetivo[r] - asignado[r];
    if (def > mejorDef) { mejorDef = def; mejor = r; }
  });
  regionDe[idDe(e._id)] = mejor;
  asignado[mejor] += e.horas_semanales_contrato;
});
empleados.filter((e) => ['administrativo', 'director'].includes(e.rol)).forEach((e) => { regionDe[idDe(e._id)] = 'OVI'; });
encargados.forEach((e, i) => { regionDe[idDe(e._id)] = ['OVI', 'GIJ', 'AVI'][i % 3]; });

const ESPECIALIDADES_MEC = ['limpieza', 'abrillantado', 'limpieza_mecanizada', 'garaje', 'portal'];
REGIONES.forEach((r) => {
  const deZona = personal.filter((e) => regionDe[idDe(e._id)] === r).sort((a, b) => b.horas_semanales_contrato - a.horas_semanales_contrato);
  if (deZona[0]) deZona[0].especialidades = ESPECIALIDADES_MEC;
  if (deZona[1] && (r === 'GIJ' || r === 'OVI')) deZona[1].especialidades = ['limpieza', 'abrillantado', 'limpieza_mecanizada'];
  const crist = deZona.find((e) => !e.especialidades.includes('limpieza_mecanizada'));
  if (crist) crist.especialidades = ['limpieza', 'cristales'];
});
const cttoDe = (e) => {
  if (['director', 'administrativo'].includes(e.rol)) return '100';
  return e.horas_semanales_contrato >= 35
    ? pondera([['100', 14], ['189', 3], ['501', 1], ['410', 1]])
    : pondera([['200', 10], ['289', 5], ['510', 3], ['502', 2], ['402', 1]]);
};
empleados.forEach((e) => {
  e.ctto = cttoDe(e);
  const reg = regionDe[idDe(e._id)];
  if (reg) e.cp_residencia = elige(CPS_REGION[reg]);
  e.dias_semana_contrato = e.dias_trabajo.length;
  if (new Date(e.fecha_alta_empresa.$date) > new Date('2025-12-31')) e.fecha_alta_empresa = F(utc(2025, entre(1, 12), entre(1, 28)));
});

const FREC_DIAS = { mensual: 30, bimestral: 60, trimestral: 90, cuatrimestral: 120, semestral: 180, anual: 300 };
clientes.forEach((c) => {
  c._extras = [];
  const t = c.tipo_cliente;
  const prob = (tipo) => ({
    cristales: { piso: 0.04, comunidad: 0.35, oficinas: 0.45, nave: 0.12 }[t],
    abrillantado: { piso: 0, comunidad: 0.12, oficinas: 0.12, nave: 0.08 }[t],
    limpieza_mecanizada: { piso: 0, comunidad: 0, oficinas: 0.08, nave: 0.45 }[t],
    garaje: { piso: 0, comunidad: 0.10, oficinas: 0, nave: 0 }[t],
    portal: { piso: 0, comunidad: 0.06, oficinas: 0, nave: 0 }[t],
  }[tipo]);
  if (rnd() < prob('cristales')) {
    c._extras.push({ tipo_tarea: 'cristales', horas: t === 'nave' ? medio(4, 8) : t === 'piso' ? medio(2, 3) : medio(2.5, 6), frecuencia: pondera([['mensual', 3], ['bimestral', 3], ['trimestral', 3]]) });
  }
  if (rnd() < prob('abrillantado')) {
    c._extras.push({ tipo_tarea: 'abrillantado', horas: medio(4, 8), frecuencia: pondera([['trimestral', 2], ['cuatrimestral', 1], ['semestral', 4], ['anual', 3]]) });
  }
  if (rnd() < prob('limpieza_mecanizada')) {
    c._extras.push({ tipo_tarea: 'limpieza_mecanizada', horas: medio(3, 8), frecuencia: pondera([['mensual', 2], ['bimestral', 2], ['trimestral', 3], ['cuatrimestral', 1], ['semestral', 2]]) });
  }
  if (rnd() < prob('garaje')) {
    c._extras.push({ tipo_tarea: 'garaje', horas: medio(3, 6), frecuencia: pondera([['trimestral', 1], ['semestral', 3], ['anual', 2]]) });
  }
  if (rnd() < prob('portal')) {
    c._extras.push({ tipo_tarea: 'portal', horas: medio(2, 4), frecuencia: pondera([['trimestral', 2], ['semestral', 3]]) });
  }
  c._extras.forEach((x) => { x._prorr = calcHSemProrr({ horas_semana: x.horas, frecuencia: x.frecuencia, tipo_tarea: x.tipo_tarea }); });
});

const INICIO_VENTANA = 12, FIN_VENTANA = 45;
const estado = {};
personal.forEach((e) => {
  const W = e.dias_trabajo.slice();
  const c = e.horas_semanales_contrato;
  const dayCap = Math.min(9, Math.ceil((c / W.length) * 2) / 2 + 1);
  const full = c >= 30;
  estado[idDe(e._id)] = {
    e, id: idDe(e._id), region: regionDe[idDe(e._id)], cap: c, rem: r2(c - (e._conduccion || 0)), W, dayCap,
    inicio: full ? 14 : pondera([[14, 3], [16, 3], [32, 3], [34, 1]]),
    occ: {}, load: {}, bloques: [], clientes: new Set(),
  };
  W.forEach((d) => { estado[idDe(e._id)].occ[d] = new Set(); estado[idDe(e._id)].load[d] = 0; });
});
const porRegion = (r) => Object.values(estado).filter((s) => s.region === r);

function buscarInicio(s, dias, durHuecos) {
  for (const desde of [s.inicio, INICIO_VENTANA]) {
    for (let ini = desde; ini + durHuecos <= FIN_VENTANA; ini++) {
      let libre = true;
      for (const d of dias) {
        for (let k = ini; k <= ini + durHuecos; k++) if ((s.occ[d] || new Set()).has(k)) { libre = false; break; }
        if (!libre) break;
      }
      if (libre) return ini;
    }
  }
  return -1;
}
function ocupar(s, dias, ini, durHuecos) {
  dias.forEach((d) => { for (let k = ini; k <= ini + durHuecos; k++) s.occ[d].add(k); });
}

const turnos = [];
function nuevoTurno(s, cliente, dias, d, ini, tipo) {
  const h1 = ini * 30;
  const t = {
    _id: oid('f2'), empleado: { $oid: s.id }, cliente: cliente ? { $oid: idDe(cliente._id) } : undefined,
    dias_semana: dias.slice(), tramos: [{ hora_llegada: aHHMM(h1), hora_salida: aHHMM(h1 + d * 60) }],
    horas_semana: r2(dias.length * d), frecuencia: 'semanal', tipo_tarea: tipo || 'limpieza',
    observaciones: '', servicios_adicionales: [],
    createdAt: F('2026-01-02T09:00:00Z'), updatedAt: F('2026-01-02T09:00:00Z'), __v: 0,
  };
  turnos.push(t);
  return t;
}

function patrones(N, tipo, maxN) {
  const dPref = { piso: 3, comunidad: 2.5, oficinas: 3, nave: 5 }[tipo] || 3;
  const prefN = Math.min(5, Math.max(1, Math.round(N / dPref)));
  const lista = [];
  for (let n = 1; n <= Math.min(6, maxN); n++) {
    const d = N / n;
    if (Math.abs(d * 2 - Math.round(d * 2)) > 1e-9) continue;
    if (d < 1 || d > 8) continue;
    lista.push([n, d]);
  }
  return lista.sort((a, b) => Math.abs(a[0] - prefN) - Math.abs(b[0] - prefN));
}

const factible = (N) => patrones(N, 'piso', 6).length > 0;
const factibleCercano = (N) => { let x = N; while (!factible(x)) x = r2(x - 0.5); return x; };

function colocar(s, cliente, N) {
  for (const [n, d] of patrones(N, cliente.tipo_cliente, s.W.length)) {
    if (s.rem + 1e-9 < n * d) continue;
    const dias = s.W.filter((x) => s.load[x] + d <= s.dayCap).sort((a, b) => s.load[a] - s.load[b]).slice(0, n);
    if (dias.length < n) continue;
    const durH = Math.round(d * 2);
    const ini = buscarInicio(s, dias, durH);
    if (ini < 0) continue;
    ocupar(s, dias, ini, durH);
    dias.forEach((x) => { s.load[x] += d; });
    const orden = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    dias.sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
    nuevoTurno(s, cliente, dias, d, ini, 'limpieza');
    s.rem = r2(s.rem - n * d);
    s.clientes.add(idDe(cliente._id));
    cliente._horas = r2((cliente._horas || 0) + n * d);
    return n * d;
  }
  return 0;
}

REGIONES.forEach((r) => {
  const staff = porRegion(r);
  const cls = clientes.filter((c) => c._region === r);
  cls.forEach((c) => { c._horas = 0; });

  const reservas = [];
  cls.forEach((c) => c._extras.forEach((x) => {
    const preferidos = staff.filter((s) => s.e.especialidades.includes(x.tipo_tarea));
    const pool = preferidos.length ? preferidos : staff.filter((s) => s.cap >= 30);
    const candidatos = (pool.length ? pool : staff).sort((a, b) => b.rem - a.rem);
    const s = candidatos[0];
    s.rem = r2(s.rem - x._prorr);
    reservas.push({ s, cliente: c, x });
  }));

  const libre = staff.reduce((t, s) => t + s.rem, 0);
  const prov = cls.reduce((t, c) => t + c.horas_contratadas[0].horas, 0);
  const factor = (libre * 0.96) / prov;
  cls.forEach((c) => {
    const base = c.horas_contratadas[0].horas * factor;
    c._need = factibleCercano(Math.max(c.tipo_cliente === 'piso' ? 1.5 : 2, Math.round(base * 2) / 2));
  });

  cls.sort((a, b) => b._need - a._need).forEach((c) => {
    let pendiente = c._need;
    let intentos = 0;
    while (pendiente >= 1 && intentos++ < 6) {
      const orden = staff.slice().sort((a, b) => b.rem - a.rem);
      let puesto = 0;
      for (const s of orden) {
        puesto = colocar(s, c, pendiente);
        if (!puesto) {
          for (let cabe = Math.floor(Math.min(s.rem, pendiente) * 2) / 2; cabe >= 1 && !puesto; cabe = r2(cabe - 0.5)) {
            if (factible(cabe)) puesto = colocar(s, c, cabe);
          }
        }
        if (puesto) break;
      }
      if (!puesto) break;
      pendiente = r2(pendiente - puesto);
    }
  });

  if (process.env.DEBUG_DIST) console.log(r, 'sin colocar:', cls.filter((c) => !c._horas).map((c) => c._need + 'h ' + c.tipo_cliente).join(', '), '| rem:', staff.map((s) => s.rem + '/' + s.cap + '(' + s.W.length + 'd)').join(' '));

  staff.forEach((s) => {
    let guardia = 0;
    while (s.rem >= 0.5 && guardia++ < 40) {
      const dia = s.W.slice().sort((a, b) => s.load[a] - s.load[b])[0];
      let h = Math.min(s.rem, 4, s.dayCap + 1.5 - s.load[dia]);
      h = Math.floor(h * 2) / 2;
      if (h < 0.5) break;
      const propios = cls.filter((c) => s.clientes.has(idDe(c._id)));
      const cliente = (propios.length ? propios : cls).slice().sort((a, b) => (a._horas || 0) - (b._horas || 0))[0];
      const durH = Math.round(h * 2);
      const ini = buscarInicio(s, [dia], durH);
      if (ini < 0) break;
      ocupar(s, [dia], ini, durH);
      s.load[dia] += h;
      nuevoTurno(s, cliente, [dia], h, ini, 'limpieza');
      s.rem = r2(s.rem - h);
      s.clientes.add(idDe(cliente._id));
      cliente._horas = r2((cliente._horas || 0) + h);
    }
  });

  if (r === 'GIJ' || r === 'OVI') {
    const victima = staff.filter((s) => s.cap <= 25 && s.cap >= 12.5 && s.W.length >= 3).sort((a, b) => a.rem - b.rem)[0] || staff.filter((s) => s.cap <= 30)[0];
    if (victima) {
      const extra = r === 'GIJ' ? 3 : 2.5;
      const dia = victima.W.slice().sort((a, b) => victima.load[a] - victima.load[b])[0];
      const durH = Math.round(extra * 2);
      const ini = buscarInicio(victima, [dia], durH);
      const cliente = cls.filter((c) => victima.clientes.has(idDe(c._id)))[0] || cls[0];
      if (ini >= 0) {
        ocupar(victima, [dia], ini, durH);
        victima.load[dia] += extra;
        nuevoTurno(victima, cliente, [dia], extra, ini, 'limpieza');
        cliente._horas = r2((cliente._horas || 0) + extra);
        victima.e._sobreContrato = extra;
      }
    }
  }

  reservas.forEach(({ s, cliente, x }) => {
    const dia = s.W.slice().sort((p, q) => s.load[p] - s.load[q])[0];
    const ini = x.tipo_tarea === 'cristales' ? 16 : 14;
    let f = sumaDias(HOY_UTC, entre(3, FREC_DIAS[x.frecuencia]));
    while (DIAS[f.getUTCDay()] !== dia) f = sumaDias(f, 1);
    const h1 = ini * 30;
    turnos.push({
      _id: oid('f2'), empleado: { $oid: s.id }, cliente: { $oid: idDe(cliente._id) },
      dias_semana: [dia], tramos: [{ hora_llegada: aHHMM(h1), hora_salida: aHHMM(h1 + x.horas * 60) }],
      horas_semana: x.horas, frecuencia: x.frecuencia, tipo_tarea: x.tipo_tarea,
      proxima_fecha: F(f), observaciones: '', servicios_adicionales: [],
      createdAt: F('2026-01-02T09:00:00Z'), updatedAt: F('2026-01-02T09:00:00Z'), __v: 0,
    });
    s.clientes.add(idDe(cliente._id));
    const colocado = true;
    if (!colocado) console.log('aviso: servicio periódico sin hueco', x.tipo_tarea, cliente.nombre);
  });
});

const furgonetas = [];
const DATOS_FURGO = [
  ['F-1', '5312 KBV', 'Citroën Berlingo Van', '985 260 411'],
  ['F-2', '7740 LDC', 'Renault Kangoo Express', '985 260 412'],
  ['F-3', '2905 MPF', 'Peugeot Partner', '985 260 413'],
];
conductores.forEach((e, i) => {
  const idF = oid('f3');
  furgonetas.push({
    _id: idF, numero: DATOS_FURGO[i][0], matricula: DATOS_FURGO[i][1], modelo: DATOS_FURGO[i][2],
    tarjeta_combustible: '7001 ' + entre(1000, 9999) + ' ' + entre(1000, 9999), contacto_aseguradora: DATOS_FURGO[i][3],
    conductores: [{ $oid: idDe(e._id) }], observaciones: 'Reparto de material y apoyo a servicios mecanizados.',
    notas: i === 0 ? [{ texto: 'ITV pasada, próxima en 2027', fecha: F('2026-03-18T10:00:00Z'), createdAt: F('2026-03-18T10:00:00Z'), updatedAt: F('2026-03-18T10:00:00Z') }] : [],
    archivos: [], createdAt: F('2025-11-10T10:00:00Z'), updatedAt: F('2026-03-18T10:00:00Z'), __v: 0,
  });
  turnos.push({
    _id: oid('f2'), empleado: { $oid: idDe(e._id) }, furgoneta: idF,
    dias_semana: [], tramos: [],
    horas_semana: e._conduccion, frecuencia: 'semanal', tipo_tarea: 'otros',
    observaciones: 'Reparto de material y apoyo a servicios mecanizados', servicios_adicionales: [],
    createdAt: F('2026-01-02T09:00:00Z'), updatedAt: F('2026-01-02T09:00:00Z'), __v: 0,
  });
});

const PRECIOS = {
  limpieza: 19, limpieza_general: 25, cristales: 23, cubos: 18.5, basuras: 17, jardin: 24,
  patio_general: 18, garaje_general: 18.5, abrillantado: 90, limpieza_mecanizada: 45,
  garaje: 45, patio: 50, portal: 45, soportal: 45, otros: 20,
};
const preciosServicio = Object.entries(PRECIOS).map(([tipo, precio]) => ({
  _id: oid('fa'), tipo_tarea: tipo, precio_hora: precio,
  createdAt: F('2025-11-03T09:00:00Z'), updatedAt: F('2025-11-03T09:00:00Z'), __v: 0,
}));
let horasTotal = 0;
clientes.forEach((c) => {
  const horas = c._horas || 0;
  c.horas_contratadas = [];
  if (horas > 0) { c.horas_contratadas.push({ tipo_tarea: 'limpieza', horas, frecuencia: 'semanal' }); horasTotal += horas; }
  c._extras.forEach((x) => { c.horas_contratadas.push({ tipo_tarea: x.tipo_tarea, horas: x.horas, frecuencia: x.frecuencia }); horasTotal += x._prorr; });
  delete c.facturacion_mensual;
  delete c._region; delete c._extras; delete c._horas; delete c._need;
  c.horas_contratadas.forEach((h) => { h._id = oid('f4'); });
});

const ausencias = [];
const coberturas = [];
const trabajadores = personal;
const propias = {};
const cubreFechas = {};
const ocupadoCubridor = {};
const turnosDe = {};
turnos.forEach((t) => { if (t.frecuencia === 'semanal' && t.cliente) (turnosDe[idDe(t.empleado)] = turnosDe[idDe(t.empleado)] || []).push(t); });
const ausente = (id, fecha) => (propias[id] || []).some((a) => fecha >= a.ini && fecha <= a.fin);
const minutos = (hhmm) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3), 10);
const tramoTurno = (t) => [minutos(t.tramos[0].hora_llegada), minutos(t.tramos[0].hora_salida)];
function libreCubridor(id, fecha, t) {
  const dia = DIAS[fecha.getUTCDay()];
  const [a, b] = tramoTurno(t);
  const intervalos = [];
  (turnosDe[id] || []).forEach((x) => { if (x.dias_semana.includes(dia)) intervalos.push(tramoTurno(x)); });
  (ocupadoCubridor[id + '|' + claveFecha(fecha)] || []).forEach((x) => intervalos.push(x));
  return !intervalos.some(([c, d]) => a < d + 15 && b + 15 > c);
}
const LIMITE_BAJA_ABIERTA = sumaDias(HOY_UTC, 90);
const sinCubrir = [];
const lunesDe = (d) => { let x = new Date(d); while (x.getUTCDay() !== 1) x = sumaDias(x, 1); return x; };
const solapa = (lista, ini, fin) => lista.some((a) => ini <= a.fin && fin >= a.ini);

function ausenciaCubierta(e, tipo, ini, fin, obs, forzar) {
  const idAus = idDe(e._id);
  const finEf = fin || LIMITE_BAJA_ABIERTA;
  propias[idAus] = propias[idAus] || [];
  if (solapa(propias[idAus], ini, fin || utc(2027, 12, 31))) return false;
  for (let f = new Date(ini); f <= finEf; f = sumaDias(f, 1)) if ((cubreFechas[idAus] || new Set()).has(claveFecha(f))) return false;

  const nuevas = [];
  const anotadas = [];
  propias[idAus].push({ ini, fin: fin || utc(2027, 12, 31) });
  const zonas = [regionDe[idDe(e._id)], ...(VECINAS[regionDe[idDe(e._id)]] || [])];
  const todos = personal.map((p) => idDe(p._id)).filter((id) => id !== idAus);
  const comodines = encargados.map((p) => idDe(p._id)).filter((id) => id !== idAus);
  const candidatos = () => [
    ...comodines.slice().sort(() => rnd() - 0.5),
    ...zonas.flatMap((z) => todos.filter((id) => regionDe[id] === z).sort(() => rnd() - 0.5)),
    ...todos.filter((id) => !zonas.includes(regionDe[id])).sort(() => rnd() - 0.5),
  ];
  const anotar = (t, f, quien) => {
    const k = quien + '|' + claveFecha(f);
    (ocupadoCubridor[k] = ocupadoCubridor[k] || []).push(tramoTurno(t));
    (cubreFechas[quien] = cubreFechas[quien] || new Set()).add(claveFecha(f));
    anotadas.push({ k, quien, dia: claveFecha(f) });
    nuevas.push({
      _id: oid('f6'), fecha: F(f), empleado_ausente: { $oid: idAus }, empleado_cubre: { $oid: quien },
      turno: t._id, dias_semana: t.dias_semana.slice(),
      observaciones: tipo === 'baja' ? 'Cubre la baja' : 'Cubre vacaciones',
      createdAt: F(sumaDias(ini, -7)), updatedAt: F(sumaDias(ini, -7)), __v: 0,
    });
  };
  let fallo = false;
  for (const t of (turnosDe[idAus] || [])) {
    const fechas = [];
    for (let f = new Date(ini); f <= finEf; f = sumaDias(f, 1)) if (t.dias_semana.includes(DIAS[f.getUTCDay()])) fechas.push(new Date(f));
    if (!fechas.length) continue;
    const unico = candidatos().find((id) => fechas.every((f) => !ausente(id, f) && libreCubridor(id, f, t)));
    if (unico) { fechas.forEach((f) => anotar(t, f, unico)); continue; }
    for (const f of fechas) {
      const quien = candidatos().find((id) => !ausente(id, f) && libreCubridor(id, f, t));
      if (quien) anotar(t, f, quien); else { fallo = true; sinCubrir.push(`${claveFecha(f)} ${idAus}`); }
    }
  }
  if (fallo && !forzar) {
    anotadas.forEach(({ k, quien, dia }) => { ocupadoCubridor[k].pop(); cubreFechas[quien].delete(dia); });
    propias[idAus].pop();
    sinCubrir.length = sinCubrir.length - sinCubrir.filter((x) => x.endsWith(idAus)).length;
    return false;
  }
  ausencias.push({
    _id: oid('f5'), empleado: { $oid: idAus }, tipo, fecha_inicio: F(ini), ...(fin ? { fecha_fin: F(fin) } : {}),
    observaciones: obs || '', createdAt: F(sumaDias(ini, -30)), updatedAt: F(sumaDias(ini, -30)), __v: 0,
  });
  coberturas.push(...nuevas);
  return true;
}

const candidatosBaja = trabajadores.filter((e) => e.horas_semanales_contrato >= 20).sort(() => rnd() - 0.5);
const BAJAS = [
  [utc(2026, 2, 9), utc(2026, 3, 6), 'Baja por enfermedad común'],
  [utc(2026, 4, 13), utc(2026, 5, 15), 'Baja por accidente no laboral'],
  [utc(2026, 6, 22), utc(2026, 7, 3), 'Baja por enfermedad común'],
  [utc(2026, 1, 12), utc(2026, 4, 30), 'Baja médica de larga duración'],
  [utc(2026, 9, 21), null, 'Baja por enfermedad común'],
  [utc(2026, 8, 31), null, 'Baja por accidente laboral'],
];
BAJAS.forEach((b) => {
  const e = candidatosBaja.find((x) => !(propias[idDe(x._id)] || []).length && ausenciaCubierta(x, 'baja', b[0], b[1], b[2], false));
  if (!e) console.log('aviso: no se encontró quien cubra la baja', b[2], b[0].toISOString().slice(0, 10));
});

const SEMANAS_VERANO = [];
for (let l = lunesDe(utc(2026, 6, 22)); l <= utc(2026, 9, 7); l = sumaDias(l, 7)) SEMANAS_VERANO.push(l);
const orden = [...trabajadores, ...oficina].sort(() => rnd() - 0.5);
orden.forEach((e, i) => {
  if (rnd() < 0.9) {
    const semanas = rnd() < 0.7 ? 2 : rnd() < 0.5 ? 1 : 3;
    for (let k = 0; k < SEMANAS_VERANO.length; k++) {
      const ini = SEMANAS_VERANO[(i * 2 + k) % SEMANAS_VERANO.length];
      if (ausenciaCubierta(e, 'vacaciones', ini, sumaDias(ini, 7 * (semanas - 1) + 4), 'Vacaciones de verano', false)) break;
    }
  }
  if (rnd() < 0.65) {
    const mes = pondera([[1, 1], [3, 2], [4, 3], [5, 2], [6, 1], [10, 3], [11, 2], [12, 3]]);
    for (let k = 0; k < 6; k++) {
      const ini = lunesDe(utc(2026, mes, entre(2, 20)));
      if (ausenciaCubierta(e, 'vacaciones', ini, sumaDias(ini, 4), mes === 4 ? 'Semana Santa' : mes === 12 ? 'Navidad' : '', false)) break;
    }
  }
  if (rnd() < 0.2) {
    const ini = utc(2026, entre(2, 11), entre(1, 24));
    if (ini.getUTCDay() >= 1 && ini.getUTCDay() <= 3) ausenciaCubierta(e, 'vacaciones', ini, sumaDias(ini, 2), 'Puente', false);
  }
});
ausencias.sort((a, b) => a.fecha_inicio.$date.localeCompare(b.fecha_inicio.$date));

const fichajes = [];
const adminUsuario = usuarios.find((u) => u.rol === 'admin');
const UA = [
  'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 12; moto g31) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
];
const clienteDe = Object.fromEntries(clientes.map((c) => [idDe(c._id), c]));
const dispositivoDe = {};
const ipDe = {};
const COCHERA = { lat: 43.3995, lng: -5.8285 };
const m2deg = 1 / 111000;
const punto = (lat, lng, fecha, maxM) => {
  const ang = rnd() * Math.PI * 2, dist = 8 + rnd() * maxM;
  return {
    fecha_hora: F(fecha), lat: +(lat + Math.sin(ang) * dist * m2deg).toFixed(6), lng: +(lng + Math.cos(ang) * dist * m2deg * 1.35).toFixed(6),
    precision: Math.round(6 + rnd() * 28),
  };
};
function aFecha(f, minutosDelDia) { return new Date(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), Math.floor(minutosDelDia / 60), Math.round(minutosDelDia % 60)); }

const VENTANA = 49;
const trabajos = [];
for (let k = VENTANA; k >= 0; k--) {
  const f = sumaDias(HOY_UTC, -k);
  const dia = DIAS[f.getUTCDay()];
  turnos.forEach((t) => {
    if (t.frecuencia !== 'semanal' || !t.dias_semana.includes(dia)) return;
    const titular = idDe(t.empleado);
    let quien = titular;
    if (ausente(titular, f)) {
      const cob = coberturas.find((c) => idDe(c.turno) === idDe(t._id) && c.fecha.$date === F(f).$date);
      if (!cob) return;
      quien = idDe(cob.empleado_cubre);
    }
    trabajos.push({ f, t, quien });
  });
}
for (let k = VENTANA; k >= 0; k--) {
  const f = sumaDias(HOY_UTC, -k);
  if (f.getUTCDay() === 0 || f.getUTCDay() === 6) continue;
  oficina.forEach((e) => {
    const id = idDe(e._id);
    if (ausente(id, f) || (cubreFechas[id] || new Set()).has(claveFecha(f))) return;
    trabajos.push({ f, t: { _id: { $oid: 'oficina' }, cliente: null, tramos: [{ hora_llegada: '08:00', hora_salida: '16:12' }] }, quien: id });
  });
}
const AHORA_MIN = HOY.getHours() * 60 + HOY.getMinutes();
let manuales = 0, anulados = 0, corregidos = 0;
trabajos.forEach(({ f, t, quien }) => {
  const [ini, fin] = tramoTurno(t);
  const esHoy = claveFecha(f) === claveFecha(HOY_UTC);
  if (esHoy && ini > AHORA_MIN) return;
  if (!dispositivoDe[quien]) { dispositivoDe[quien] = elige(UA); ipDe[quien] = '203.0.113.' + entre(2, 250); }
  const conf = { dispositivo: dispositivoDe[quien], ip: ipDe[quien] };
  const cliente = t.cliente ? clienteDe[idDe(t.cliente)] : null;
  const base = cliente ? { lat: cliente.lat, lng: cliente.lng } : COCHERA;
  const entradaMin = ini + entre(-7, 9);
  const salidaMin = fin + entre(-6, 14);
  const abierta = esHoy && fin > AHORA_MIN;
  const doc = {
    _id: oid('f7'), empleado: { $oid: quien },
    entrada: { ...punto(base.lat, base.lng, aFecha(f, entradaMin), 55), confirmacion: conf },
    estado: abierta ? 'abierto' : 'cerrado', modificaciones: [],
    createdAt: F(aFecha(f, entradaMin)), updatedAt: F(aFecha(f, abierta ? entradaMin : salidaMin)), __v: 0,
  };
  if (!abierta) doc.salida = { ...punto(base.lat, base.lng, aFecha(f, salidaMin), 55), confirmacion: conf };

  const antigua = !esHoy && f < sumaDias(HOY_UTC, -2);
  const r = rnd();
  if (antigua && r < 0.012) {
    delete doc.entrada.lat; delete doc.entrada.lng; delete doc.entrada.precision; delete doc.entrada.confirmacion;
    if (doc.salida) { delete doc.salida.lat; delete doc.salida.lng; delete doc.salida.precision; delete doc.salida.confirmacion; }
    doc.creado_manualmente = { fecha: F(sumaDias(f, 1)), usuario: adminUsuario._id, motivo: elige(['Sin batería en el móvil', 'No tenía cobertura en el sótano', 'Olvidó fichar, confirmado por la encargada']) };
    manuales++;
  } else if (antigua && r < 0.02 && doc.salida) {
    const salidaOriginal = doc.salida;
    doc.modificaciones.push({
      fecha: F(sumaDias(f, 1)), usuario: adminUsuario._id,
      motivo: 'Olvidó fichar la salida; hora confirmada por el cliente',
      entrada_anterior: doc.entrada, estado_anterior: 'abierto',
    });
    doc.salida = salidaOriginal;
    corregidos++;
  } else if (antigua && r < 0.027) {
    doc.estado = 'anulado';
    doc.anulacion = { fecha: F(sumaDias(f, 1)), usuario: adminUsuario._id, motivo: elige(['Fichaje duplicado', 'Fichó en el turno equivocado', 'Fichaje de prueba']) };
    anulados++;
  }
  fichajes.push(doc);
});
fichajes.sort((a, b) => a.entrada.fecha_hora.$date.localeCompare(b.entrada.fecha_hora.$date));

const CATALOGO = [
  ['Fregona de microfibra 40 cm', 6.9], ['Cubo escurridor 15 L', 18.5], ['Mopa plana de microfibra 40 cm', 9.8], ['Mango telescópico aluminio', 12.4],
  ['Palo de escoba de madera', 2.6], ['Cabezal de escoba de interior', 4.2], ['Cepillo de barrer exterior', 6.9], ['Recogedor con cepillo', 5.5],
  ['Bayeta de microfibra amarilla (pack 5)', 4.8], ['Bayeta de microfibra azul (pack 5)', 4.8], ['Bayeta de microfibra roja (pack 5)', 4.8], ['Bayeta de microfibra verde (pack 5)', 4.8],
  ['Estropajo fibra verde (pack 10)', 3.9], ['Esponja doble cara (pack 10)', 4.5], ['Rasqueta de cristales 35 cm', 7.9], ['Gamuza de cristales',  3.2],
  ['Limpiacristales 5 L', 8.6], ['Desengrasante multiusos 5 L', 7.4], ['Fregasuelos pino 5 L', 6.2], ['Fregasuelos floral 5 L', 6.2],
  ['Lejía 5 L', 3.9], ['Amoniaco 5 L', 4.6], ['Salfumán 5 L', 4.9], ['Desincrustante WC 1 L', 3.4],
  ['Abrillantador de suelos 5 L', 14.9], ['Decapante de suelos 5 L', 17.5], ['Cera para suelos 5 L', 15.8], ['Limpiador de acero inoxidable 750 ml', 5.9],
  ['Ambientador aerosol 750 ml', 3.7], ['Jabón de manos 5 L', 9.6], ['Papel higiénico industrial (pack 12)', 14.8], ['Papel secamanos en rollo (pack 6)', 21.5],
  ['Bolsas de basura 30 L (rollo 25)', 1.9], ['Bolsas de basura 100 L (rollo 25)', 4.6], ['Guantes de nitrilo talla M (caja 100)', 8.9], ['Guantes de nitrilo talla L (caja 100)', 8.9],
  ['Guantes de goma talla 8', 1.6], ['Cepillo de WC con soporte', 3.8], ['Carro de limpieza con prensa', 189], ['Señal de suelo mojado', 14.5],
];
const productos = CATALOGO.map((p, i) => ({
  _id: oid('f8'), nombre: p[0], precio: p[1], activo: i !== 27,
  createdAt: F('2025-11-03T09:00:00Z'), updatedAt: F('2025-11-03T09:00:00Z'), __v: 0,
}));
const solicitudes = [];
const ESTADOS = ['pendiente', 'pendiente', 'pendiente', 'asignado', 'asignado', 'entregado', 'entregado', 'entregado', 'entregado', 'cancelado'];
const conCliente = Object.values(estado).filter((s) => s.clientes.size > 0);
for (let i = 0; i < 20; i++) {
  const s = elige(conCliente);
  const cliente = [...s.clientes][entre(0, s.clientes.size - 1)];
  const items = [];
  const n = entre(2, 5);
  const usados = new Set();
  while (items.length < n) {
    const p = elige(productos);
    if (usados.has(p.nombre) || !p.activo) continue;
    usados.add(p.nombre);
    items.push({ producto: p.nombre, cantidad: entre(1, 6), precio: p.precio, es_otro: false });
  }
  if (rnd() < 0.2) items.push({ producto: 'Pastillas de lavavajillas industrial', cantidad: 2, precio: null, es_otro: true });
  const estadoS = ESTADOS[i % ESTADOS.length];
  const creada = sumaDias(HOY_UTC, -entre(1, 40));
  const doc = {
    _id: oid('f9'), solicitante: { $oid: s.id }, cliente: { $oid: cliente }, productos: items,
    observaciones: elige(['', '', 'Urgente, se ha acabado', 'Para esta semana', 'Dejar en el cuarto de limpieza']),
    estado: estadoS, asignado_a: null, createdAt: F(creada), updatedAt: F(creada), __v: 0,
  };
  if (estadoS !== 'pendiente' && estadoS !== 'cancelado') {
    const quien = elige(conductores.length ? conductores : encargados);
    doc.asignado_a = { $oid: idDe(quien._id) };
    doc.fecha_asignacion = F(sumaDias(creada, 1));
    doc.updatedAt = F(sumaDias(creada, 1));
    if (estadoS === 'entregado') { doc.fecha_entrega = F(sumaDias(creada, entre(2, 4))); doc.updatedAt = doc.fecha_entrega; }
  }
  solicitudes.push(doc);
}
solicitudes.sort((a, b) => a.createdAt.$date.localeCompare(b.createdAt.$date));

const vencido = turnos.find((t) => t.tipo_tarea === 'abrillantado' && t.cliente && t.proxima_fecha);
if (vencido) {
  let f = sumaDias(HOY_UTC, -6);
  while (DIAS[f.getUTCDay()] !== vencido.dias_semana[0]) f = sumaDias(f, -1);
  vencido.proxima_fecha = F(f);
}

escribir('empleados.json', empleados);
escribir('clientes.json', clientes);
escribir('turnos.json', turnos);
escribir('ausencias.json', ausencias);
escribir('coberturas.json', coberturas);
escribir('fichajes.json', fichajes);
escribir('furgonetas.json', furgonetas);
escribir('productos.json', productos);
escribir('precios_servicio.json', preciosServicio);
escribir('solicitudes.json', solicitudes);

const hEmp = {};
turnos.forEach((t) => { hEmp[idDe(t.empleado)] = (hEmp[idDe(t.empleado)] || 0) + calcHSemProrr(t); });
let maxDesvio = 0, malos = 0;
personal.forEach((e) => {
  const d = Math.abs((hEmp[idDe(e._id)] || 0) - e.horas_semanales_contrato);
  if (d > 0.9) malos++;
  maxDesvio = Math.max(maxDesvio, d);
});
const sinHoras = clientes.filter((c) => !c.horas_contratadas.some((h) => h.tipo_tarea === 'limpieza')).length;
const porTipo = {};
turnos.forEach((t) => { if (t.cliente) { const k = t.tipo_tarea + (t.frecuencia !== 'semanal' ? ':' + t.frecuencia : ''); porTipo[k] = (porTipo[k] || 0) + 1; } });
console.log('turnos:', turnos.length, '| ausencias:', ausencias.length, '| coberturas:', coberturas.length, '| fichajes:', fichajes.length);
console.log('desvío máx. entre contrato y turnos (h/sem):', maxDesvio.toFixed(2), '| empleados con desvío >0,9 h:', malos);
console.log('se pasan de jornada a propósito (aviso de ejemplo):', personal.filter((e) => e._sobreContrato).map((e) => `${e.apellidos}, ${e.nombre} (+${e._sobreContrato} h)`).join(' | ') || 'ninguno');
console.log('coberturas sin resolver:', sinCubrir.length);
if (process.env.DEBUG_COB) console.log(sinCubrir.slice(0, 80).join('\n'));
const { calcHMesProrr } = require('../src/utils/prorrateo');
const facturacionTotal = Math.round(turnos.filter((t) => t.cliente).reduce((a, t) => a + calcHMesProrr(t) * PRECIOS[t.tipo_tarea], 0));
console.log('clientes sin limpieza semanal:', sinHoras, '| horas semanales prorrateadas totales en clientes:', r2(horasTotal), '| facturación mensual calculada total:', facturacionTotal.toLocaleString('es-ES'), '€');
console.log('servicios por tipo/frecuencia:', porTipo);
console.log('fichajes manuales:', manuales, 'corregidos:', corregidos, 'anulados:', anulados, '| solicitudes:', solicitudes.length, '| productos:', productos.length);
