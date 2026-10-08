const mongoose = require('mongoose');

const TIPOS_TAREA = [
  'limpieza','limpieza_general','cristales','cubos','basuras','jardin',
  'patio_general','garaje_general','abrillantado','limpieza_mecanizada',
  'garaje','patio','portal','soportal','otros',
];

const schema = new mongoose.Schema({
  tipo_tarea:  { type: String, enum: TIPOS_TAREA, required: true, unique: true },
  precio_hora: { type: Number, required: true, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('PrecioServicio', schema);
module.exports.TIPOS_TAREA = TIPOS_TAREA;
