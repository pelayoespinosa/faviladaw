const mongoose = require('mongoose');
const { calcHSemProrr } = require('../utils/prorrateo');

const tramoSchema = new mongoose.Schema({
  hora_llegada: { type: String },
  hora_salida:  { type: String },
}, { _id: false });

const schema = new mongoose.Schema({
  empleado:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' , required: true },
  cliente:   { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente'   },
  furgoneta: { type: mongoose.Schema.Types.ObjectId, ref: 'Furgoneta' },
  dias_semana: [{
    type: String,
    enum: ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
  }],
  tramos:        [tramoSchema],
  horas_semana:  { type: Number },
  frecuencia:    { type: String, enum: ['semanal','quincenal','mensual','bimestral','trimestral','cuatrimestral','semestral','anual'], default: 'semanal' },
  tipo_tarea:    { type: String, enum: ['limpieza','limpieza_general','cristales','cubos','basuras','jardin','patio_general','garaje_general','abrillantado','limpieza_mecanizada','garaje','patio','portal','soportal','otros'], default: 'limpieza' },
  proxima_fecha: { type: Date },
  observaciones: { type: String },
  servicios_adicionales: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServicioAdicional' }],
}, { timestamps: true });

schema.pre('validate', function (next) {
  if (!this.cliente && !this.furgoneta) return next(new Error('Indica un cliente o una furgoneta'));
  if (this.cliente && this.furgoneta) return next(new Error('Un turno no puede tener cliente y furgoneta a la vez'));
  next();
});

schema.virtual('horas_semanales_prorrateadas').get(function () {
  return calcHSemProrr(this);
});

schema.set('toJSON', { virtuals: true });
module.exports = mongoose.model('Turno', schema);
