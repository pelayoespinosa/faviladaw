const mongoose = require('mongoose');
const { Schema } = mongoose;

const confirmacionSchema = new Schema({
  empleado:       { type: Schema.Types.ObjectId, ref: 'Empleado', required: true },
  recibido:       { type: Boolean, default: false },
  fecha_recibido: { type: Date },
  conforme:       { type: Boolean, default: false },
  fecha_conforme: { type: Date },
}, { _id: false });

const documentoSchema = new Schema({
  titulo:                  { type: String, required: true },
  descripcion:             { type: String },
  carpeta:                 { type: String, default: 'General' },
  nombre_archivo_original: { type: String, required: true },
  nombre_archivo_storage:  { type: String, required: true },
  tipo_destinatario:       { type: String, enum: ['todos', 'grupo', 'especifico'], default: 'todos' },
  grupo:                   { type: String },
  requiere_confirmacion:   { type: Boolean, default: true },
  subido_por:              { type: Schema.Types.ObjectId, ref: 'Usuario' },
  confirmaciones:          [confirmacionSchema],
}, { timestamps: true });

module.exports = mongoose.model('Documento', documentoSchema);
