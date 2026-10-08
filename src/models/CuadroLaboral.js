const mongoose = require('mongoose');

const filaSchema = new mongoose.Schema({
  empleado: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null },
  nombre:       { type: String, trim: true, default: '' },
  nif:          { type: String, trim: true, default: '' },
  naf:          { type: String, trim: true, default: '' },
  fecha_alta:   { type: Date, default: null },
  ctto:         { type: String, trim: true, default: '' },
  categoria:    { type: String, trim: true, default: '' },
  horario_base: { type: Number, default: null },
  dias_semana:  { type: Number, min: 0, max: 7, default: null },
  dias_trabajo: { type: [String], default: [] },
  festivos_locales: { type: [Date], default: [] },
  plus_transporte:  { type: Number, default: null },
  plus_festivo:     { type: Number, default: null },
  plus_penosidad:   { type: Number, default: null },
  plus_nocturnidad: { type: Number, default: null },
  semana1: { type: Number, default: null },
  semana2: { type: Number, default: null },
  semana3: { type: Number, default: null },
  semana4: { type: Number, default: null },
  semana5: { type: Number, default: null },
  observaciones: { type: String, trim: true, default: '' },
});

const schema = new mongoose.Schema({
  anio:  { type: Number, required: true },
  mes:   { type: Number, required: true, min: 1, max: 12 },
  grupo: { type: String, enum: ['sin_variaciones', 'con_variaciones'], default: 'sin_variaciones', required: true },
  filas: [filaSchema],
}, { timestamps: true });

schema.index({ anio: 1, mes: 1, grupo: 1 }, { unique: true });

module.exports = mongoose.model('CuadroLaboral', schema);
