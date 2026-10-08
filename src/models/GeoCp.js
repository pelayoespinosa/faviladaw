const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  cp:          { type: String, required: true, unique: true, trim: true },
  lat:         { type: Number, default: null },
  lng:         { type: Number, default: null },
  localidad:   { type: String, trim: true, default: null },
  geocoded_at: { type: Date, default: null },
  error:       { type: String, trim: true, default: null },
}, { timestamps: true });

module.exports = mongoose.model('GeoCp', schema);
