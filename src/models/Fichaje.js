const mongoose = require('mongoose');

const confirmacionSchema = new mongoose.Schema({
  dispositivo:   { type: String },
  ip:            { type: String },
}, { _id: false });

const puntoSchema = new mongoose.Schema({
  fecha_hora:   { type: Date },
  lat:          { type: Number },
  lng:          { type: Number },
  precision:    { type: Number },
  confirmacion: { type: confirmacionSchema },
}, { _id: false });

const modificacionSchema = new mongoose.Schema({
  fecha:            { type: Date, default: Date.now },
  usuario:          { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  motivo:           { type: String, required: true },
  entrada_anterior: { type: puntoSchema },
  salida_anterior:  { type: puntoSchema },
  estado_anterior:  { type: String },
}, { _id: false });

const schema = new mongoose.Schema({
  empleado: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true },
  entrada:  { type: puntoSchema, required: true },
  salida:   { type: puntoSchema },
  estado:   { type: String, enum: ['abierto', 'cerrado', 'anulado'], default: 'abierto' },
  anulacion: {
    fecha:   { type: Date },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    motivo:  { type: String },
  },
  creado_manualmente: {
    fecha:   { type: Date },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    motivo:  { type: String },
  },
  modificaciones: { type: [modificacionSchema], default: [] },
}, { timestamps: true });

schema.index({ empleado: 1, 'entrada.fecha_hora': -1 });

schema.virtual('duracion_horas').get(function () {
  if (!this.salida?.fecha_hora) return null;
  return +((this.salida.fecha_hora - this.entrada.fecha_hora) / 36e5).toFixed(4);
});

schema.set('toJSON', { virtuals: true });
module.exports = mongoose.model('Fichaje', schema);
