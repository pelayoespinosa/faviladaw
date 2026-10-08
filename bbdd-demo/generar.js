const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { generarUsernameBase } = require('../src/utils/seguridad');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261007);
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elige = (arr) => arr[Math.floor(rnd() * arr.length)];
const pondera = (pares) => {
  const total = pares.reduce((s, p) => s + p[1], 0);
  let r = rnd() * total;
  for (const [v, p] of pares) { if ((r -= p) < 0) return v; }
  return pares[0][0];
};

let contadorId = 0;
const oid = (prefijo) => ({ $oid: prefijo + (++contadorId).toString(16).padStart(24 - prefijo.length, '0') });
const fecha = (iso) => ({ $date: new Date(iso).toISOString() });
const quitaTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniDe = (n) => String(n).padStart(8, '0') + LETRAS_DNI[n % 23];

const NOMBRES = ['María','Carmen','Ana','Laura','Marta','Lucía','Paula','Sara','Elena','Cristina','Raquel','Noelia','Patricia','Rosa','Isabel','Beatriz','Silvia','Sonia','Alba','Nuria','Irene','Natalia','Eva','Yolanda','Lorena','Montserrat','Covadonga','Begoña','Rocío','Pilar','José','Antonio','Manuel','Francisco','David','Javier','Daniel','Carlos','Miguel','Alejandro','Iván','Rubén','Sergio','Álvaro','Adrián','Diego','Hugo','Pablo','Jorge','Marcos','Óscar','Fernando','Roberto','Guillermo','Borja','Iñaki'];
const NOMBRES_2 = ['', '', '', 'Jesús', 'del Carmen', 'Isabel', 'José', 'Luis', 'Ángel', 'María'];
const APELLIDOS = ['García','Fernández','González','Rodríguez','López','Martínez','Sánchez','Pérez','Álvarez','Menéndez','Suárez','Díaz','Gómez','Ruiz','Alonso','Rubio','Blanco','Cano','Valle','Pando','Fidalgo','Iglesias','Llano','Cuesta','Arias','Argüelles','Bernardo','Cabrera','Castaño','Corte','Villa','Zapico','Tuñón','Prieto','Ardura','Collado','Faes','Junquera','Lorenzo','Miranda','Nava','Quirós','Rionda','Sierra','Trabanco','Vigil','Viña','Folgueras','Cuervo','Bobes'];

const CPS_RESIDENCIA = ['33001','33003','33005','33006','33011','33201','33203','33205','33207','33209','33400','33402','33405','33900','33600','33510','33430','33450','33980','33300','33424'];

const cargos = ['director', 'administrativo', 'encargado', 'encargado', 'encargado', 'conductor', 'conductor', 'conductor', 'peon', 'peon', 'peon', 'peon'];
while (cargos.length < 50) cargos.push('limpiador');

const JORNADAS = [[38.5, 12], [20, 14], [30, 6], [25, 4], [15, 3], [12.5, 2], [35, 3], [40, 1], [10, 1]];

const empleados = [];
const dnisUsados = new Set();
const nombresUsados = new Set();

for (let i = 0; i < 50; i++) {
  const cargo = cargos[i];
  let nombre, apellidos, dni;
  if (i === 0) {
    nombre = 'Pelayo'; apellidos = 'Espinosa Tavira'; dni = dniDe(71000001);
  } else {
    do {
      nombre = elige(NOMBRES); const n2 = elige(NOMBRES_2);
      if (n2 && /^(María|Carmen|Ana|Laura|Marta|Lucía|Paula|Sara|Elena|Cristina|Raquel|Noelia|Patricia|Rosa|Isabel|Beatriz|Silvia|Sonia|Alba|Nuria|Irene|Natalia|Eva|Yolanda|Lorena|Montserrat|Covadonga|Begoña|Rocío|Pilar)$/.test(nombre) && ['del Carmen', 'Isabel', 'María', 'Jesús'].includes(n2)) nombre += ' ' + n2;
      else if (n2 && !/^(María|Carmen|Ana|Laura|Marta|Lucía|Paula|Sara|Elena|Cristina|Raquel|Noelia|Patricia|Rosa|Isabel|Beatriz|Silvia|Sonia|Alba|Nuria|Irene|Natalia|Eva|Yolanda|Lorena|Montserrat|Covadonga|Begoña|Rocío|Pilar)$/.test(nombre) && ['José', 'Luis', 'Ángel', 'Jesús'].includes(n2)) nombre += ' ' + n2;
      apellidos = elige(APELLIDOS) + ' ' + elige(APELLIDOS);
    } while (nombresUsados.has(nombre + apellidos));
    nombresUsados.add(nombre + apellidos);
    do { dni = dniDe(entre(9000000, 79999999)); } while (dnisUsados.has(dni));
  }
  dnisUsados.add(dni);

  let horas;
  if (cargo === 'director') horas = 40;
  else if (cargo === 'administrativo') horas = 38.5;
  else if (cargo === 'encargado') horas = pondera([[38.5, 4], [40, 1]]);
  else if (cargo === 'conductor') horas = pondera([[38.5, 3], [40, 1]]);
  else horas = pondera(JORNADAS);

  const especialidades = cargo === 'limpiador' || cargo === 'peon'
    ? pondera([
        [[], 6], [['limpieza'], 4], [['limpieza', 'cristales'], 2], [['limpieza', 'portal', 'soportal'], 2],
        [['limpieza_general', 'abrillantado'], 1], [['jardin', 'patio'], 1], [['limpieza_mecanizada', 'garaje'], 1],
      ])
    : [];

  const fechaAlta = new Date(Date.UTC(entre(2012, 2026), entre(0, 11), entre(1, 28)));
  if (fechaAlta > new Date('2026-09-01')) fechaAlta.setUTCFullYear(2025);
  const nacimiento = new Date(Date.UTC(entre(1963, 2003), entre(0, 11), entre(1, 28)));
  const base = quitaTildes(nombre.split(' ')[0] + '.' + apellidos.split(' ')[0]).toLowerCase().replace(/[^a-z.]/g, '');

  empleados.push({
    _id: oid('e1'),
    nombre, apellidos, dni,
    tlf: '6' + String(entre(10000000, 99999999)),
    email: `${base}@ejemplo.test`,
    rol: cargo,
    nass: '33' + String(entre(10000000, 99999999)) + String(entre(10, 99)),
    cp_residencia: elige(CPS_RESIDENCIA),
    fecha_alta_empresa: fecha(fechaAlta),
    fecha_nacimiento: fecha(nacimiento),
    activo: true,
    fecha_baja: null,
    revisado: true,
    a_revisar: false,
    excluir_cuadro_laboral: i === 0,
    tiene_variaciones: rnd() > 2 || !['encargado', 'administrativo'].includes(cargo),
    especialidades,
    horas_semanales_contrato: horas,
    ctto: '',
    dias_semana_contrato: horas >= 35 ? 5 : horas >= 20 ? entre(4, 5) : entre(2, 4),
    dias_trabajo: horas >= 35 ? ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] : pondera([
      [['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], 3], [['lunes', 'miercoles', 'viernes'], 3],
      [['martes', 'jueves', 'sabado'], 1], [['lunes', 'martes', 'jueves', 'viernes'], 3],
    ]),
    festivos_locales: [],
    ubicaciones: [],
    createdAt: fecha('2026-09-30T08:00:00Z'),
    updatedAt: fecha('2026-09-30T08:00:00Z'),
    __v: 0,
  });
}

const PASSWORD = 'Baliza2026';
const hash = bcrypt.hashSync(PASSWORD, 10);
const PASSWORD_ADMIN = 'pruebafavila';
const hashAdmin = bcrypt.hashSync(PASSWORD_ADMIN, 10);
const usuarios = [];
const nombresUsuario = new Set();
for (const e of empleados) {
  let base = generarUsernameBase(e.nombre, e.apellidos);
  let nombreUsuario = base, n = 1;
  while (nombresUsuario.has(nombreUsuario)) nombreUsuario = base + (++n);
  nombresUsuario.add(nombreUsuario);
  const rol = e.rol === 'director' ? 'admin' : (e.rol === 'administrativo' || e.rol === 'encargado') ? 'encargado' : 'empleado';
  usuarios.push({
    _id: oid('a1'), email: nombreUsuario, password: rol === 'admin' ? hashAdmin : hash, rol, empleado: e._id,
    activo: true, debe_cambiar_password: false, intentos_fallidos: 0, bloqueado_hasta: null,
    createdAt: fecha('2026-09-30T08:00:00Z'), updatedAt: fecha('2026-09-30T08:00:00Z'), __v: 0,
  });
}
usuarios.push({
  _id: oid('a1'), email: 'gestoria', password: hash, rol: 'gestoria', empleado: null,
  activo: true, debe_cambiar_password: false, intentos_fallidos: 0, bloqueado_hasta: null,
  createdAt: fecha('2026-09-30T08:00:00Z'), updatedAt: fecha('2026-09-30T08:00:00Z'), __v: 0,
});

const CONCEJOS = [
  ['Oviedo', 43.3614, -5.8494, ['33001','33002','33003','33004','33005','33006','33007','33008','33009','33010','33011','33012','33013'], 28],
  ['Gijón', 43.5322, -5.6611, ['33201','33202','33203','33204','33205','33206','33207','33208','33209','33210','33211','33212','33213'], 30],
  ['Avilés', 43.5547, -5.9248, ['33400','33401','33402','33403','33404','33405','33410'], 14],
  ['Langreo', 43.3036, -5.6929, ['33900','33905','33920'], 8],
  ['Mieres', 43.2508, -5.7686, ['33600','33610','33615'], 6],
  ['Siero', 43.3920, -5.6600, ['33510','33518','33519'], 8],
  ['Llanera', 43.4300, -5.8700, ['33424','33429'], 3],
  ['Castrillón', 43.5500, -5.9800, ['33450','33458'], 4],
  ['Corvera', 43.5540, -5.8820, ['33404','33416'], 2],
  ['Carreño', 43.5870, -5.7630, ['33430','33438'], 3],
  ['Villaviciosa', 43.4810, -5.4350, ['33300'], 3],
  ['Llanes', 43.4200, -4.7550, ['33500','33509'], 3],
  ['Ribadesella', 43.4620, -5.0590, ['33560'], 2],
  ['Cangas de Onís', 43.3510, -5.1290, ['33550'], 2],
  ['Pravia', 43.4900, -6.1150, ['33120'], 2],
  ['Grado', 43.3880, -6.0720, ['33820'], 2],
  ['Valdés', 43.5380, -6.5320, ['33700'], 2],
  ['Navia', 43.5390, -6.7240, ['33710'], 2],
  ['Laviana', 43.2470, -5.5600, ['33980'], 2],
  ['Tineo', 43.3340, -6.4170, ['33870'], 1],
  ['Cangas del Narcea', 43.1760, -6.5530, ['33800'], 1],
];
const VIAS = ['C/ Uría','C/ Mayor','C/ Real','Av. de la Constitución','Av. de Galicia','C/ del Sol','C/ Covadonga','C/ Pelayo','C/ Jovellanos','C/ San Francisco','C/ Los Tilos','C/ La Vega','C/ El Molino','Av. del Mar','C/ Santa Olaya','C/ Fruela','C/ Río Nalón','Av. de Europa','C/ La Fuente','C/ Peñalba','C/ Nueva','C/ del Pozo','C/ Magnus Blikstad','C/ Los Pinos','C/ Las Flores','Paseo de los Álamos','C/ La Iglesia','C/ Menéndez Valdés','C/ Del Carmen','C/ Los Prados'];
const POLIGONOS = ['Pol. Ind. de Silvota','Pol. Ind. Principado','Pol. Ind. de Asipo','Pol. Ind. de Roces','Pol. Ind. Bobes','Pol. Ind. de Maqua','Pol. Ind. La Curtidora','Pol. Ind. de Argame'];
const EDIF = ['Los Álamos','Santa Clara','El Parque','La Pradera','Torre Mar','Los Robles','Covadonga','El Nogal','San Lorenzo','Las Palmeras','Mirador','Residencial Norte','El Pinar','La Rosaleda','Albéniz','Cantábrico','Valdés Salas','Los Tejos','Santa Eulalia','Rey Pelayo'];
const NEGOCIOS = [
  ['Asesoría','oficinas'],['Clínica dental','oficinas'],['Gestoría','oficinas'],['Despacho de abogados','oficinas'],['Academia','oficinas'],
  ['Centro de estética','oficinas'],['Gimnasio','nave'],['Taller','nave'],['Almacén','nave'],['Logística','nave'],['Carpintería','nave'],
  ['Estudio de arquitectura','oficinas'],['Inmobiliaria','oficinas'],['Consultorio médico','oficinas'],['Centro de fisioterapia','oficinas'],
  ['Ludoteca','oficinas'],['Escuela infantil','oficinas'],['Cooperativa','nave'],['Imprenta','nave'],['Peluquería','oficinas'],
];
const APELL_NEG = ['Cantábrico','del Norte','Asturiana','Nalón','Peñasanta','Principado','Cudillero','Tenada','Cimadevilla','Begoña','Fontán','Pelayo','Auseva','Llamoso','Riosa','Tarna'];
const APELL_PISO = APELLIDOS;

const clientes = [];
const nifsUsados = new Set();
const LETRAS_CIF = 'ABCDEFGHJ';
for (let i = 0; i < 200; i++) {
  const [concejo, lat0, lng0, cps, ] = pondera(CONCEJOS.map((c) => [c, c[4]]));
  const tipo = pondera([['comunidad', 9], ['oficinas', 6], ['piso', 3], ['nave', 3]]);
  const cp = elige(cps);
  const via = elige(VIAS);
  const num = entre(1, 78);
  let nombre, direccion;
  if (tipo === 'nave') {
    const neg = elige(NEGOCIOS.filter((n) => n[1] === 'nave'));
    nombre = `${neg[0]} ${elige(APELL_NEG)}`;
    direccion = `${elige(POLIGONOS)}, nave ${entre(1, 60)}, ${concejo}`;
  } else if (tipo === 'oficinas') {
    const neg = elige(NEGOCIOS.filter((n) => n[1] === 'oficinas'));
    nombre = `${neg[0]} ${elige(APELL_NEG)}`;
    direccion = `${via} ${num}, ${entre(0, 4)}º ${elige(['A','B','C','Izq.','Dcha.'])}, ${concejo}`;
  } else if (tipo === 'comunidad') {
    nombre = `Comunidad de Propietarios ${elige(EDIF)}`;
    direccion = `${via} ${num}, ${concejo}`;
  } else {
    nombre = `${elige(APELL_PISO)} ${elige(APELL_PISO)}`;
    direccion = `${via} ${num}, ${entre(1, 6)}º ${elige(['A','B','C','D'])}, ${concejo}`;
  }
  const alias = tipo === 'comunidad' ? `${nombre.replace('Comunidad de Propietarios ', 'Com. ')} (${via.replace(/^(C\/|Av\.|Paseo de) ?/, '').trim()} ${num})` : null;

  let nif;
  do {
    nif = tipo === 'piso'
      ? dniDe(entre(9000000, 79999999))
      : elige(LETRAS_CIF.split('')) + String(entre(3000000, 3999999)) + String(entre(0, 9));
  } while (nifsUsados.has(nif));
  nifsUsados.add(nif);

  const radio = tipo === 'nave' ? 0.03 : 0.018;
  const lat = +(lat0 + (rnd() - 0.5) * 2 * radio).toFixed(6);
  const lng = +(lng0 + (rnd() - 0.5) * 2 * radio * 1.35).toFixed(6);

  const horas = tipo === 'piso' ? pondera([[2, 4], [3, 3], [4, 2]]) :
                tipo === 'comunidad' ? pondera([[3, 3], [4, 3], [6, 2], [8, 1]]) :
                tipo === 'oficinas' ? pondera([[5, 3], [8, 3], [10, 2], [15, 1]]) :
                pondera([[10, 2], [15, 2], [20, 1]]);
  const horasContratadas = [{ tipo_tarea: 'limpieza', horas, frecuencia: 'semanal' }];
  if (tipo === 'comunidad' && rnd() < 0.3) horasContratadas.push({ tipo_tarea: 'cristales', horas: 2, frecuencia: elige(['mensual', 'trimestral']) });
  if (tipo === 'nave' && rnd() < 0.4) horasContratadas.push({ tipo_tarea: 'limpieza_mecanizada', horas: 3, frecuencia: 'mensual' });
  if (tipo === 'oficinas' && rnd() < 0.3) horasContratadas.push({ tipo_tarea: 'abrillantado', horas: 4, frecuencia: 'semestral' });

  const nombreContacto = `${elige(NOMBRES)} ${elige(APELLIDOS)}`;
  clientes.push({
    _id: oid('c1'),
    nif, nombre,
    alias,
    sucursal: null,
    direccion_facturacion: direccion,
    direccion_real: direccion,
    zona: concejo,
    cp,
    provincia: 'Asturias',
    tlf: elige(['985', '984', '98']).padEnd(3, '5') + String(entre(100000, 999999)),
    email: `contacto${i + 1}@ejemplo.test`,
    tipo_cliente: tipo,
    persona_contacto: nombreContacto,
    facturacion_mensual: Math.round(horas * 4.33 * (tipo === 'nave' ? 17 : 15.5)),
    horas_contratadas: horasContratadas,
    lat, lng,
    geocoded_at: fecha('2026-09-30T08:00:00Z'),
    geocode_error: null,
    geocode_manual: true,
    createdAt: fecha('2026-09-30T08:00:00Z'),
    updatedAt: fecha('2026-09-30T08:00:00Z'),
    __v: 0,
  });
}

const dir = __dirname;
const escribe = (nombre, datos) => fs.writeFileSync(path.join(dir, nombre), JSON.stringify(datos, null, 2) + '\n');
escribe('empleados.json', empleados);
escribe('usuarios.json', usuarios);
escribe('clientes.json', clientes);

const resumen = {};
empleados.forEach((e) => { resumen[e.horas_semanales_contrato] = (resumen[e.horas_semanales_contrato] || 0) + 1; });
console.log(`empleados: ${empleados.length}  usuarios: ${usuarios.length}  clientes: ${clientes.length}`);
console.log('jornadas (h/semana → nº):', resumen);
console.log('usuarios:', usuarios.map((u) => `${u.email}(${u.rol})`).slice(0, 8).join(', '), '…');
