const GeoCp = require('../models/GeoCp');
const { geolocalizarCp } = require('./geocoding');

const soloCp = s => (s || '').replace(/\D/g, '');
const esCpValido = cp => /^\d{5}$/.test(cp);

async function coordsDeCp(cpRaw) {
  const cp = soloCp(cpRaw);
  if (!esCpValido(cp)) return null;

  const cache = await GeoCp.findOne({ cp });
  if (cache) return cache.lat != null ? { lat: cache.lat, lng: cache.lng } : null;

  const r = await geolocalizarCp(cp);
  try {
    await GeoCp.create({
      cp,
      lat: r?.lat ?? null,
      lng: r?.lng ?? null,
      localidad: r?.localidad ?? null,
      geocoded_at: new Date(),
      error: r ? null : 'no resuelto por Nominatim',
    });
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  return r ? { lat: r.lat, lng: r.lng } : null;
}

async function mapaCoordsResidencia(cpsRaw) {
  const cps = [...new Set(cpsRaw.map(soloCp).filter(esCpValido))];
  const salida = new Map();
  if (!cps.length) return salida;

  const cacheados = await GeoCp.find({ cp: { $in: cps } });
  const yaEsta = new Set();
  for (const g of cacheados) {
    yaEsta.add(g.cp);
    if (g.lat != null) salida.set(g.cp, { lat: g.lat, lng: g.lng });
  }
  for (const cp of cps) {
    if (yaEsta.has(cp)) continue;
    const c = await coordsDeCp(cp);
    if (c) salida.set(cp, c);
  }
  return salida;
}

module.exports = { coordsDeCp, mapaCoordsResidencia, soloCp, esCpValido };
