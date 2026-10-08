const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  empleado:      { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true },
  tipo:          { type: String, enum: ['vacaciones', 'baja'], required: true },
  fecha_inicio:  { type: Date, required: true },
  fecha_fin:     { type: Date },
  observaciones: { type: String },
}, { timestamps: true });

schema.index({ empleado: 1, fecha_inicio: 1 });

module.exports = mongoose.model('Ausencia', schema);
