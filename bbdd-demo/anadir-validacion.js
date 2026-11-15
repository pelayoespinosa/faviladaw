// Añade a fichajes.json la validación de ubicación y la sospecha, calculadas con las
// mismas funciones que usa la aplicación, y reparte unos pocos casos de ejemplo
// (sin confirmar, fuera de zona, sospechosos y uno justificado). No necesita MongoDB.
// Los fichajes normales se evalúan sin historial: el generador encadena turnos en pueblos lejanos
// con huecos de pocos minutos, y la detección los marcaría como viaje imposible sin serlo.
// Solo los casos de ejemplo se evalúan con el historial real del empleado.
// Es seguro ejecutarlo varias veces: si los fichajes ya tienen validación, no hace nada.
const fs = require('fs');
const path = require('path');
const { validarUbicacion } = require('../src/utils/validacionUbicacion');
const { deteccionUbicacionFalsa } = require('../src/utils/deteccionUbicacionFalsa');
const { haversineKm } = require('../src/utils/geo');

const DIR = __dirname;
const leer = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
const fichajes = leer('fichajes.json');
const clientes = leer('clientes.json').filter((c) => c.lat != null && c.lng != null);
const admin = leer('usuarios.json').find((u) => u.rol === 'admin');

if (fichajes.some((f) => f.entrada?.validacion)) {
  console.log('fichajes.json ya tiene validación: no se cambia nada');
  process.exit(0);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(424242);

const M_POR_GRADO = 111000;
const fecha = (p) => new Date(p.fecha_hora.$date);
const conCoordenadas = (p) => p && p.lat != null && p.lng != null;
const idDe = (x) => (x && x.$oid) || x;

function clienteMasCercano(p) {
  let mejor = null;
  for (const c of clientes) {
    const d = haversineKm(p, c) * 1000;
    if (!mejor || d < mejor.d) mejor = { c, d };
  }
  return mejor && mejor.d <= 300 ? mejor.c : null;
}

const usables = fichajes.filter((f) => f.estado !== 'anulado' && !f.creado_manualmente && conCoordenadas(f.entrada));
for (const f of usables) {
  f.referencia = clienteMasCercano(f.entrada);
  for (const p of [f.entrada, f.salida]) {
    if (conCoordenadas(p)) p.timestamp_posicion = { $date: new Date(fecha(p).getTime() - (1000 + Math.floor(rnd() * 3000))).toISOString() };
  }
}

const ultimaFecha = Math.max(...usables.map((f) => fecha(f.entrada).getTime()));
const recientes = usables
  .filter((f) => f.referencia && f.estado === 'cerrado' && f.salida)
  .sort((a, b) => fecha(b.entrada) - fecha(a.entrada))
  .slice(0, 600);
const elegir = (k, de) => recientes[Math.floor((recientes.length * (k + 0.5)) / de)];
const desplazar = (p, metros) => { p.lat = +(p.lat + metros / M_POR_GRADO).toFixed(6); };

const casos = [];
[160, 210, 130].forEach((precision, i) => { const f = elegir(i, 12); f.entrada.precision = precision; casos.push(['sin confirmar (GPS poco preciso)', f]); });
[650, 900, 1400].forEach((m, i) => { const f = elegir(3 + i, 12); desplazar(f.entrada, m); casos.push(['fuera de zona', f]); });
{ const f = elegir(6, 12); desplazar(f.salida, 500); casos.push(['fuera de zona (solo la salida)', f]); }
{
  const f = elegir(7, 12);
  f.entrada.precision = 0;
  f.entrada.timestamp_posicion = { $date: new Date(fecha(f.entrada).getTime() - 6 * 60e3).toISOString() };
  casos.push(['sospecha alta (precisión artificial y posición antigua)', f]);
}
{
  const usados = new Set(casos.map(([, f]) => idDe(f._id)));
  const ultimo = {};
  let elegido = null;
  const cronologica = [...usables].sort((a, b) => fecha(a.entrada) - fecha(b.entrada));
  for (const f of cronologica) {
    const e = idDe(f.empleado);
    const previo = ultimo[e];
    if (previo?.salida && !usados.has(idDe(f._id)) && f.referencia && previo.referencia
      && fecha(f.entrada) - fecha(previo.salida) > 20 * 60e3 && fecha(f.entrada) - fecha(previo.salida) < 3 * 3600e3
      && fecha(f.entrada) > ultimaFecha - 20 * 86400e3) elegido = f;
    ultimo[e] = f;
  }
  elegido.entrada.lat = 40.4168; elegido.entrada.lng = -3.7038;
  casos.push(['sospecha alta (viaje imposible) y fuera de zona', elegido]);
}
{
  const usados = new Set(casos.map(([, f]) => idDe(f._id)));
  const porEmpleado = {};
  [...usables].sort((a, b) => fecha(a.entrada) - fecha(b.entrada)).forEach((f) => { (porEmpleado[idDe(f.empleado)] ||= []).push(f); });
  outer: for (const lista of Object.values(porEmpleado).reverse()) {
    for (let i = 1; i < lista.length; i++) {
      const [antes, ahora] = [lista[i - 1], lista[i]];
      if (antes.referencia && ahora.referencia && idDe(antes.referencia._id) === idDe(ahora.referencia._id) && !usados.has(idDe(ahora._id))
        && antes.salida && fecha(ahora.entrada) > fecha(antes.salida)) {
        ahora.entrada.lat = antes.salida.lat; ahora.entrada.lng = antes.salida.lng;
        casos.push(['sospecha baja (coordenadas idénticas al punto anterior)', ahora]);
        break outer;
      }
    }
  }
}

const porEmpleado = {};
[...usables].sort((a, b) => fecha(a.entrada) - fecha(b.entrada)).forEach((f) => { (porEmpleado[idDe(f.empleado)] ||= []).push(f); });

const conHistorial = new Set(casos.map(([, f]) => idDe(f._id)));
const cuentas = {};
for (const lista of Object.values(porEmpleado)) {
  const previos = [];
  for (const f of lista) {
    for (const nombre of ['entrada', 'salida']) {
      const p = f[nombre];
      if (!conCoordenadas(p)) continue;
      const punto = { lat: p.lat, lng: p.lng, precision: p.precision, fecha_hora: fecha(p), timestamp_posicion: p.timestamp_posicion && new Date(p.timestamp_posicion.$date) };
      const validacion = validarUbicacion({ posicion: punto, referencias: f.referencia ? [f.referencia] : [] });
      if (validacion.estado === 'sin_referencia') validacion.motivo = 'sin_turno';
      validacion.sospecha = deteccionUbicacionFalsa({ punto, anteriores: conHistorial.has(idDe(f._id)) ? [...previos].reverse().slice(0, 3) : [] });
      p.validacion = validacion;
      previos.push(punto);
      const clave = validacion.estado + (validacion.sospecha.nivel !== 'ninguna' ? ` + sospecha ${validacion.sospecha.nivel}` : '');
      cuentas[clave] = (cuentas[clave] || 0) + 1;
    }
  }
}

const fuera = casos.find(([t]) => t === 'fuera de zona')[1];
fuera.justificacion = {
  fecha: { $date: new Date(fecha(fuera.entrada).getTime() + 26 * 3600e3).toISOString() },
  usuario: admin._id,
  motivo: 'Aparcó lejos del portal por obras en la calle; confirmado por la encargada',
};

usables.forEach((f) => { delete f.referencia; });
fs.writeFileSync(path.join(DIR, 'fichajes.json'), JSON.stringify(fichajes, null, 2) + '\n');

console.log('casos de ejemplo añadidos:');
casos.forEach(([t, f]) => console.log(' -', t, '·', idDe(f._id)));
console.log('puntos validados por resultado:', cuentas);
