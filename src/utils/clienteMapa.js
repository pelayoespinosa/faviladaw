const { normalizarDireccion, ciudadDesdeCp } = require('./geocoding');

function clienteValidoParaMapa(c) {
  const enAsturias = /asturias/i.test(c.provincia || '')
    || /asturias/i.test(c.direccion_facturacion || '')
    || /asturias/i.test(c.direccion_real || '');
  return enAsturias || !!(c.direccion_real && c.direccion_real.trim());
}

function direccionParaGeocodificar(c) {
  const base = c.direccion_real || c.direccion_facturacion;
  if (!base) return null;
  return [base, c.cp, c.zona, 'Asturias', 'España'].filter(Boolean).join(', ');
}

function candidatoPoligono(base) {
  const m = base.match(/^\s*((?:P\.?I\.?|Pol[ií]gono(?:\s+Industrial)?|Parque(?:\s+Tecnológico)?)\s*(?:de\s+|d')?\s*[^.,;]+)/i);
  if (!m) return null;
  return m[1].replace(/\bP\.?I\.?\b/i, 'Polígono Industrial').replace(/\.(?!\d)/g, '').trim();
}

function nombrePoligonoEnTexto(texto) {
  if (!texto) return null;
  const m = texto.match(/(?:P\.?\s*I\.?|Pol(?:[ií]gono)?\.?\s*(?:Ind(?:ustrial)?\.?)?|Parque(?:\s+Tecnológico)?)\s*(?:de\s+|d')?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]+)(?:\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+))?/i);
  if (!m) return null;
  const ARTICULOS = new Set(['la', 'las', 'el', 'los']);
  return ARTICULOS.has(m[1].toLowerCase()) && m[2] ? `${m[1]} ${m[2]}` : m[1];
}

function municipioDesdeZona(zona) {
  if (!zona) return null;
  if (/^\s*(p\.?i\.?|pol[ií]gono)\b/i.test(zona)) return null;
  const fuera = zona.replace(/\([^)]*\)/g, '').trim();
  const dentro = (zona.match(/\(([^)]*)\)/) || [])[1];
  return dentro && !/pol[ií]gono|industrial|parque/i.test(dentro) ? dentro : (fuera || zona);
}

const FORMAS_JURIDICAS = /,?\s*(S\.?L\.?U?\.?|S\.?A\.?U?\.?|S\.?COOP\.?|C\.?B\.?|S\.?M\.?E\.?|M\.?P\.?)\s*$/i;
function nombreSinFormaJuridica(nombre) {
  return (nombre || '').replace(FORMAS_JURIDICAS, '').trim();
}

function sinPrefijoDeEmpresa(direccion, nombre) {
  const core = nombreSinFormaJuridica(nombre);
  if (!core || !direccion) return direccion;
  const re = new RegExp('^\\s*' + core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i');
  return re.test(direccion) ? direccion.replace(re, '').trim() : direccion;
}

function candidatoDesdeNombre(nombre) {
  if (!nombre) return null;
  const partes = nombre.split(/\s-\s/);
  const candidata = (partes.length > 1 ? partes[partes.length - 1] : nombre)
    .replace(/\([^)]*\)/g, '')
    .trim();
  return /\d/.test(candidata) ? candidata : null;
}

async function candidatosGeocodificacion(c) {
  const bases = [];
  const baseRaw = c.direccion_real || c.direccion_facturacion;
  if (baseRaw) {
    bases.push(baseRaw);
    const sinPrefijo = sinPrefijoDeEmpresa(baseRaw, c.nombre);
    if (sinPrefijo !== baseRaw) bases.push(sinPrefijo);
    bases.push(normalizarDireccion(sinPrefijo));
    bases.push(candidatoPoligono(sinPrefijo));
  }
  bases.push(candidatoDesdeNombre(c.nombre));

  const unicas = [...new Set(bases.filter(Boolean))];
  if (!unicas.length) return [];
  const sufijoSoloCp = [c.cp, 'Asturias', 'España'].filter(Boolean).join(', ');
  const sufijoConAmbos = [c.cp, c.zona, 'Asturias', 'España'].filter(Boolean).join(', ');
  const sufijoSinCp = [c.zona, 'Asturias', 'España'].filter(Boolean).join(', ');
  const candidatos = [];
  if (c.cp) for (const v of unicas) candidatos.push([v, sufijoSoloCp].filter(Boolean).join(', '));
  if (c.cp) for (const v of unicas) candidatos.push([v, sufijoConAmbos].filter(Boolean).join(', '));
  for (const v of unicas) candidatos.push([v, sufijoSinCp].filter(Boolean).join(', '));
  if (baseRaw && baseRaw.includes(',')) candidatos.push([baseRaw, 'Asturias', 'España'].filter(Boolean).join(', '));

  if (c.cp && c.cp.startsWith('33')) {
    const ciudadCp = await ciudadDesdeCp(c.cp);
    if (ciudadCp && localidadDifiereDeZona(ciudadCp, c.zona)) {
      const sufijoCiudadCp = [ciudadCp, 'Asturias', 'España'].filter(Boolean).join(', ');
      for (const v of unicas) candidatos.push([v, sufijoCiudadCp].filter(Boolean).join(', '));
    }
  }

  return [...new Set(candidatos)];
}

function localidadDifiereDeZona(localidad, zona) {
  if (!localidad) return false;
  const limpia = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const a = limpia(localidad), b = limpia(zona);
  if (!a || !b) return false;
  return !a.includes(b) && !b.includes(a);
}

function candidatosZonaIndustrial(c) {
  const base = c.direccion_real || c.direccion_facturacion || '';
  const nombrePoligono = nombrePoligonoEnTexto(base) || nombrePoligonoEnTexto(c.zona || '');
  if (!nombrePoligono) return [];
  const municipio = municipioDesdeZona(c.zona);
  return [...new Set([
    [nombrePoligono, municipio, 'Asturias', 'España'].filter(Boolean).join(', '),
    [`Polígono ${nombrePoligono}`, municipio, 'Asturias', 'España'].filter(Boolean).join(', '),
    [`Polígono Industrial ${nombrePoligono}`, municipio, 'Asturias', 'España'].filter(Boolean).join(', '),
  ])];
}

module.exports = {
  clienteValidoParaMapa, direccionParaGeocodificar, candidatosGeocodificacion, candidatosZonaIndustrial,
  localidadDifiereDeZona,
};
