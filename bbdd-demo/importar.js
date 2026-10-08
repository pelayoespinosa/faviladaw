require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;
const { COLECCIONES } = require('./colecciones');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  for (const [archivo, coleccion] of Object.entries(COLECCIONES)) {
    const ruta = path.join(__dirname, archivo + '.json');
    if (!fs.existsSync(ruta)) continue;
    const docs = EJSON.parse(fs.readFileSync(ruta, 'utf8'));
    await db.collection(coleccion).deleteMany({});
    if (docs.length) await db.collection(coleccion).insertMany(docs);
    console.log(`${coleccion}: ${docs.length} documentos`);
  }
  const origen = path.join(__dirname, 'documentos');
  if (fs.existsSync(origen)) {
    const destino = path.join(__dirname, '..', 'uploads', 'documentos');
    fs.mkdirSync(destino, { recursive: true });
    fs.cpSync(origen, destino, { recursive: true });
    console.log(`PDF de documentos copiados a uploads/documentos (${fs.readdirSync(origen).length})`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
