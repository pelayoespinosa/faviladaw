const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, unique: true },
  precio: { type: Number, required: true, min: 0 },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Producto', schema);
