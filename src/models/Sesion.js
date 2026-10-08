const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  usuario:             { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  token_hash:          { type: String, required: true, unique: true },
  token_hash_anterior: { type: String, default: null },
  rotado_en:           { type: Date },
  nombre_dispositivo:  { type: String },
  ip_creacion:         { type: String },
  ultimo_uso:          { type: Date, default: Date.now },
  expira:              { type: Date, required: true },
  revocada: {
    fecha:  { type: Date },
    motivo: { type: String },
  },
}, { timestamps: true });

schema.index({ expira: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 45 });

module.exports = mongoose.model('Sesion', schema);
