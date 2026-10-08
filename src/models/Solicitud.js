const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  producto: { type: String, required: true },
  cantidad: { type: Number, required: true, min: 1 },
  precio:   { type: Number, default: null },
  es_otro:  { type: Boolean, default: false },
}, { _id: false });

const schema = new mongoose.Schema({
  solicitante:      { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true },
  cliente:          { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  productos:        { type: [itemSchema], validate: v => v.length > 0 },
  observaciones:    { type: String },
  estado:           { type: String, enum: ['pendiente','asignado','entregado','cancelado'], default: 'pendiente' },
  asignado_a:       { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null },
  fecha_asignacion: { type: Date },
  fecha_entrega:    { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Solicitud', schema);
