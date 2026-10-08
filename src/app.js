require('dotenv').config();
require('express-async-errors');
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const connectDB = require('./config/db');
const protect   = require('./middlewares/auth');

const ALLOWED_ORIGINS = [
  'https://pelayoespinosa.com',
  'https://www.pelayoespinosa.com',
  'http://localhost:5173',
  'http://localhost:5174',
];

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('No permitido por CORS'));
  },
}));
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/empleados',   protect, require('./routes/empleados'));
app.use('/api/usuarios',    protect, require('./routes/usuarios'));
app.use('/api/clientes',    protect, require('./routes/clientes'));
app.use('/api/servicios',   protect, require('./routes/servicios'));
app.use('/api/turnos',      protect, require('./routes/turnos'));
app.use('/api/flota',       protect, require('./routes/flota'));
app.use('/api/fichajes',    protect, require('./routes/fichajes'));
app.use('/api/calendario',  protect, require('./routes/calendario'));
app.use('/api/documentos',  protect, require('./routes/documentos'));
app.use('/api/solicitudes', protect, require('./routes/solicitudes'));
app.use('/api/productos',   protect, require('./routes/productos'));
app.use('/api/precios-servicio', protect, require('./routes/precios'));
app.use('/api/geocoding',        protect, require('./routes/geocoding'));
app.use('/api/cuadro-laboral',   protect, require('./routes/cuadroLaboral'));

app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));

app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));
app.get(/\.[a-z0-9]+$/i, (req, res) => res.status(404).end());
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, _next) => {
  if (err.name === 'CastError' || err.name === 'ValidationError')
    return res.status(400).json({ error: 'Petición no válida' });
  if (err.message === 'No permitido por CORS')
    return res.status(403).json({ error: 'Origen no permitido' });
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

connectDB().then(() => {
  app.listen(process.env.PORT, process.env.HOST || '127.0.0.1', () =>
    console.log(`Servidor en puerto ${process.env.PORT}`)
  );
});
