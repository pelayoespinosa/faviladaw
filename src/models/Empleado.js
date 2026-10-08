const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  nombre:    { type: String, required: true, trim: true },
  apellidos: { type: String, required: true, trim: true },
  dni:    { type: String, required: true, unique: true },
  tlf:    { type: String },
  email:  { type: String },
  rol:    { type: String, enum: ['director','administrativo','encargado','conductor','peon','limpiador'], default: 'limpiador' },
  nass:               { type: String, trim: true, default: null },
  cp_residencia:      { type: String, trim: true, default: null },
  fecha_alta_empresa: { type: Date, default: null },
  fecha_nacimiento:   { type: Date, default: null },
  activo:     { type: Boolean, default: true },
  fecha_baja: { type: Date, default: null },
  excluir_cuadro_laboral: { type: Boolean, default: false },
  tiene_variaciones: { type: Boolean, default: true },
  especialidades: [{ type: String, enum: ['limpieza','limpieza_general','cristales','cubos','basuras','jardin','patio_general','garaje_general','abrillantado','limpieza_mecanizada','garaje','patio','portal','soportal','otros'] }],
  horas_semanales_contrato: { type: Number, min: 0, default: null },
  ctto:                 { type: String, trim: true, default: '' },
  dias_semana_contrato: { type: Number, min: 0, max: 7, default: null },
  dias_trabajo: [{ type: String, enum: ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'] }],
  festivos_locales: {
    type: [Date], default: [],
    validate: { validator: v => v.length <= 2, message: 'Máximo 2 festivos locales' },
  },
  ubicaciones: [{
    etiqueta: { type: String, trim: true, default: null },
    lat:      { type: Number, required: true },
    lng:      { type: Number, required: true },
  }],
}, { timestamps: true });

schema.virtual('nombre_display').get(function () {
  return `${this.apellidos}, ${this.nombre}`;
});

schema.virtual('nombre_completo').get(function () {
  return `${this.nombre} ${this.apellidos}`;
});

schema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Empleado', schema);
