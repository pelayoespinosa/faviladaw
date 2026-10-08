process.env.TZ = 'Europe/Madrid';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

const DIR = __dirname;
const leer = (n) => EJSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
const crudo = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
const { COLECCIONES } = require('./colecciones');

const URI_TMP = process.env.MONGO_URI.replace(/\/[^/?]*(\?|$)/, '/baliza_cuadros_tmp$1');
const PUERTO = 3999;
const API = `http://127.0.0.1:${PUERTO}/api`;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const idDe = (x) => (x && x.$oid) || x;

async function http(metodo, ruta, token, cuerpo) {
  const res = await fetch(API + ruta, {
    method: metodo, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${metodo} ${ruta} → ${res.status} ${json.error || ''}`);
  return json;
}

(async () => {
  await mongoose.connect(URI_TMP);
  await mongoose.connection.dropDatabase();
  for (const [archivo, coleccion] of Object.entries(COLECCIONES)) {
    if (archivo === 'cuadros_laborales') continue;
    const docs = leer(archivo + '.json');
    if (docs.length) await mongoose.connection.db.collection(coleccion).insertMany(docs);
  }

  const srv = spawn(process.execPath, [path.join(DIR, '..', 'src', 'app.js')], {
    env: { ...process.env, MONGO_URI: URI_TMP, PORT: String(PUERTO) }, stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(API + '/auth/login', { method: 'POST' }); break; } catch { await pausa(250); } }
    const { token } = await http('POST', '/auth/login', null, { email: 'pelayoet', password: 'pruebafavila' });

    const ausencias = crudo('ausencias.json');
    const turnos = crudo('turnos.json').filter((t) => t.frecuencia === 'semanal' && t.cliente);
    const empleados = crudo('empleados.json');
    const FESTIVOS = ['2026-01-01', '2026-01-06', '2026-04-02', '2026-04-03', '2026-05-01', '2026-08-15', '2026-09-08'];
    const d = (iso) => new Date(iso);
    const fmt = (f) => `${f.getUTCDate()}/${f.getUTCMonth() + 1}`;
    const MESES_CUADRO = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    for (const mes of MESES_CUADRO) {
      await http('POST', '/cuadro-laboral/generar', token, { anio: 2026, mes });
      const { cuadros } = await http('GET', `/cuadro-laboral/2026/${mes}`, token);
      const ini = new Date(Date.UTC(2026, mes - 1, 1)), fin = new Date(Date.UTC(2026, mes, 0));

      for (const cuadro of Object.values(cuadros)) {
        if (!cuadro) continue;
        for (const fila of cuadro.filas) {
          const id = fila.empleado;
          const emp = empleados.find((e) => idDe(e._id) === String(id));
          const cambios = {};
          const notas = [];
          ausencias.filter((a) => idDe(a.empleado) === String(id)).forEach((a) => {
            const ai = d(a.fecha_inicio.$date), af = a.fecha_fin ? d(a.fecha_fin.$date) : null;
            if (ai > fin || (af && af < ini)) return;
            if (a.tipo === 'vacaciones') notas.push(`Vacaciones del ${fmt(ai < ini ? ini : ai)} al ${fmt(af > fin ? fin : af)}`);
            else notas.push(af ? `Baja del ${fmt(ai)} al ${fmt(af)}` : `Baja desde el ${fmt(ai)}`);
          });
          if (notas.length) cambios.observaciones = notas.join('. ');
          let festivo = 0;
          FESTIVOS.filter((f) => f.startsWith(`2026-${String(mes).padStart(2, '0')}`)).forEach((f) => {
            const dia = DIAS[d(f + 'T12:00:00Z').getUTCDay()];
            turnos.filter((t) => idDe(t.empleado) === String(id) && t.dias_semana.includes(dia)).forEach((t, i) => {
              const [h1, m1] = t.tramos[0].hora_llegada.split(':').map(Number), [h2, m2] = t.tramos[0].hora_salida.split(':').map(Number);
              const seTrabaja = (parseInt(String(id).slice(-3), 16) + i + mes) % 3 === 0;
              if (seTrabaja) festivo += (h2 * 60 + m2 - h1 * 60 - m1) / 60;
            });
          });
          if (festivo > 0) cambios.plus_festivo = Math.round(festivo * 2) / 2;
          if (emp && emp.especialidades.some((e) => ['limpieza_mecanizada', 'garaje', 'portal'].includes(e))) cambios.plus_penosidad = 8 + (parseInt(String(id).slice(-2), 16) % 4) * 4;
          if (Object.keys(cambios).length) await http('PUT', `/cuadro-laboral/${cuadro._id}/filas/${fila._id}`, token, cambios);
        }
      }
      process.stdout.write(`mes ${mes} ok  `);
    }
    console.log();

    const docs = await mongoose.connection.db.collection('cuadrolaborals').find({}).sort({ anio: 1, mes: 1, grupo: 1 }).toArray();
    fs.writeFileSync(path.join(DIR, 'cuadros_laborales.json'), JSON.stringify(JSON.parse(EJSON.stringify(docs)), null, 2) + '\n');
    console.log(`cuadros_laborales.json: ${docs.length} cuadros (${docs.reduce((s, c) => s + c.filas.length, 0)} filas)`);
  } finally {
    srv.kill();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
