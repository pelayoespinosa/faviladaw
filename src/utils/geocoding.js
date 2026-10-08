const USER_AGENT = 'FavilaApp/1.0 (+https://pelayoespinosa.com/faviladaw)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const ESPACIADO_MS = 1100;
const ASTURIAS_VIEWBOX = '-7.3,43.9,-4.3,42.7';

let colaLibreEn = Promise.resolve();
function encolar(fn) {
  const resultado = colaLibreEn.then(fn);
  colaLibreEn = resultado.catch(() => {}).then(() => new Promise(r => setTimeout(r, ESPACIADO_MS)));
  return resultado;
}

function localidadDe(address) {
  const c = address?.city || address?.town || address?.village || address?.city_district;
  return c ? c.split('/')[0].trim() : null;
}

async function buscarDirecciones(q, limit = 5) {
  if (!q || !q.trim()) return [];
  return encolar(async () => {
    const url = `${NOMINATIM_URL}/search?format=json&addressdetails=1&limit=${limit}&countrycodes=es&viewbox=${ASTURIAS_VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
      if (!resp.ok) return [];
      const datos = await resp.json();
      return datos.map(d => ({
        display_name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon),
        class: d.class, type: d.type, localidad: localidadDe(d.address),
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  });
}

function normalizarDireccion(direccion) {
  let d = direccion
    .replace(/\bAv(?:da)?\.?\b/gi, 'Avenida')
    .replace(/\bC\/\s*/gi, 'Calle ')
    .replace(/\bPza?\.?\b/gi, 'Plaza')
    .replace(/\bCtra\.?\b/gi, 'Carretera')
    .replace(/\bP\.?I\.?\b/g, 'Polígono Industrial');

  d = d.split(/[,;]/)[0];
  d = d.replace(/(\d+)\s*-\s*\d+/g, '$1');
  d = d.replace(/(\d+)\s+y\s+\d+(?:\s+y\s+\d+)*/gi, '$1');
  d = d.replace(/(\d+)[A-Za-z]\b/g, '$1');
  d = d.replace(/\.(?!\d)/g, '');

  return d.replace(/\s{2,}/g, ' ').trim();
}

const TIPOS_DEMASIADO_GENERICOS = new Set([
  'hamlet', 'isolated_dwelling', 'village', 'town', 'city', 'suburb',
  'municipality', 'city_district', 'borough', 'county', 'state', 'island', 'region',
]);

async function geocodificarPrimero(candidatos) {
  for (const intento of candidatos) {
    if (!intento) continue;
    const resultados = await buscarDirecciones(intento, 3);
    const bueno = resultados.find(r =>
      !Number.isNaN(r.lat) && !Number.isNaN(r.lng) && !TIPOS_DEMASIADO_GENERICOS.has(r.type)
    );
    if (bueno) return { lat: bueno.lat, lng: bueno.lng, localidad: bueno.localidad };
  }
  return null;
}

const TIPOS_DEMASIADO_GRANDES = new Set([
  'city', 'town', 'municipality', 'city_district', 'borough', 'county', 'state', 'region',
]);
async function geocodificarZona(candidatos) {
  for (const intento of candidatos) {
    if (!intento) continue;
    const resultados = await buscarDirecciones(intento, 3);
    const bueno = resultados.find(r =>
      !Number.isNaN(r.lat) && !Number.isNaN(r.lng) && !TIPOS_DEMASIADO_GRANDES.has(r.type)
    );
    if (bueno) return { lat: bueno.lat, lng: bueno.lng, localidad: bueno.localidad };
  }
  return null;
}

const cachePorCp = new Map();
async function geolocalizarCp(cp) {
  if (!cp || !/^\d{5}$/.test(cp)) return null;
  if (cachePorCp.has(cp)) return cachePorCp.get(cp);
  const pedir = async url => encolar(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
      if (!resp.ok) return null;
      const datos = await resp.json();
      const d = datos[0];
      if (!d || Number.isNaN(parseFloat(d.lat)) || Number.isNaN(parseFloat(d.lon))) return null;
      return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), localidad: localidadDe(d.address) };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  });
  let resultado = await pedir(`${NOMINATIM_URL}/search?format=json&addressdetails=1&limit=1&postalcode=${encodeURIComponent(cp)}&country=España`);
  if (!resultado && /^33\d{3}$/.test(cp)) {
    resultado = await pedir(`${NOMINATIM_URL}/search?format=json&addressdetails=1&limit=1&countrycodes=es&viewbox=${ASTURIAS_VIEWBOX}&bounded=1&q=${encodeURIComponent(cp)}`);
  }
  cachePorCp.set(cp, resultado);
  return resultado;
}

async function ciudadDesdeCp(cp) {
  const r = await geolocalizarCp(cp);
  return r ? r.localidad : null;
}

module.exports = { buscarDirecciones, geocodificarPrimero, geocodificarZona, normalizarDireccion, ciudadDesdeCp, geolocalizarCp };
