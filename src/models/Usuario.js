const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const INTENTOS_MAXIMOS = 3;
const BLOQUEO_DIAS     = 7;

const schema = new mongoose.Schema({
  email:             { type: String, required: true, unique: true, trim: true, lowercase: true },
  password:          { type: String, required: true },
  rol:               { type: String, enum: ['admin','encargado','empleado','gestoria'], default: 'empleado' },
  empleado:          { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null },
  activo:            { type: Boolean, default: true },
  debe_cambiar_password: { type: Boolean, default: false },
  intentos_fallidos: { type: Number, default: 0 },
  bloqueado_hasta:   { type: Date, default: null },
}, { timestamps: true });

schema.pre('save', async function () {
  if (this.isModified('password'))
    this.password = await bcrypt.hash(this.password, 10);
});

schema.methods.verificarPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

schema.methods.estaBloqueado = function () {
  return !!(this.bloqueado_hasta && this.bloqueado_hasta > new Date());
};

schema.methods.registrarIntentoFallido = async function () {
  this.intentos_fallidos += 1;
  let bloqueadaAhora = false;
  if (this.intentos_fallidos >= INTENTOS_MAXIMOS) {
    this.bloqueado_hasta = new Date(Date.now() + BLOQUEO_DIAS * 24 * 60 * 60 * 1000);
    this.intentos_fallidos = 0;
    bloqueadaAhora = true;
  }
  await this.save();
  return bloqueadaAhora;
};

schema.methods.resetIntentos = async function () {
  if (this.intentos_fallidos > 0 || this.bloqueado_hasta) {
    this.intentos_fallidos = 0;
    this.bloqueado_hasta = null;
    await this.save();
  }
};

module.exports = mongoose.model('Usuario', schema);
