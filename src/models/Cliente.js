const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  nif:                 { type: String, required: true, trim: true },
  nombre:              { type: String, required: true, trim: true },
  alias:               { type: String, trim: true, default: null },
  sucursal:            { type: String, trim: true, default: null },
  direccion_facturacion: { type: String, trim: true, default: null },
  direccion_real:      { type: String, trim: true, default: null },
  zona:                { type: String, trim: true, default: null },
  cp:                  { type: String, trim: true, default: null },
  provincia:           { type: String, trim: true, default: null },
  tlf:                 { type: String, trim: true, default: null },
  email:               { type: String, trim: true, default: null },
  tipo_cliente:        { type: String, enum: ['piso','comunidad','nave','oficinas', null], default: null },
  persona_contacto:    { type: String, trim: true, default: null },
  horas_contratadas: [{
    tipo_tarea: { type: String, enum: ['limpieza','limpieza_general','cristales','cubos','basuras','jardin','patio_general','garaje_general','abrillantado','limpieza_mecanizada','garaje','patio','portal','soportal','otros'], default: 'limpieza' },
    horas:      { type: Number, min: 0, default: 0 },
    frecuencia: { type: String, enum: ['semanal','quincenal','mensual','bimestral','trimestral','cuatrimestral','semestral','anual'], default: 'semanal' },
  }],
  lat:            { type: Number, default: null },
  lng:            { type: Number, default: null },
  geocoded_at:    { type: Date, default: null },
  geocode_error:  { type: String, trim: true, default: null },
  geocode_manual: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ nif: 1, sucursal: 1 }, { unique: true, sparse: true });

schema.virtual('nombre_display').get(function () {
  const base = this.alias || this.nombre;
  return this.sucursal ? `${base} — ${this.sucursal}` : base;
});

schema.set('toJSON', { virtuals: true });
module.exports = mongoose.model('Cliente', schema);