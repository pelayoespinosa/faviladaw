const mongoose = require('mongoose');

const notaSchema = new mongoose.Schema({
  texto: { type: String, required: true, trim: true },
  fecha: { type: Date, default: null },
}, { timestamps: true });

const archivoSchema = new mongoose.Schema({
  nombre:                  { type: String, required: true, trim: true },
  nombre_archivo_original: { type: String, required: true },
  nombre_archivo_storage:  { type: String, required: true },
  mimetype:                { type: String },
}, { timestamps: true });

const schema = new mongoose.Schema({
  numero:              { type: String, required: true, trim: true },
  matricula:           { type: String, required: true, trim: true, uppercase: true },
  modelo:              { type: String, trim: true, default: null },
  tarjeta_combustible: { type: String, trim: true, default: null },
  contacto_aseguradora:{ type: String, trim: true, default: null },
  conductores:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' }],
  observaciones:       { type: String, trim: true, default: null },
  notas:               [notaSchema],
  archivos:            [archivoSchema],
}, { timestamps: true });

schema.index({ matricula: 1 }, { unique: true });

module.exports = mongoose.model('Furgoneta', schema);
