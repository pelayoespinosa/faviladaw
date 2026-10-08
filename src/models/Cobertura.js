const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  fecha:            { type: Date, required: true },
  empleado_ausente: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true },
  empleado_cubre:   { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true },
  turno:            { type: mongoose.Schema.Types.ObjectId, ref: 'Turno' },
  dias_semana:      [{ type: String, enum: ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'] }],
  observaciones:    { type: String },
}, { timestamps: true });

schema.index({ turno: 1, fecha: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Cobertura', schema);
