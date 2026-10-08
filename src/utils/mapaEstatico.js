const TILE_SIZE = 256;
const USER_AGENT = 'FavilaApp/1.0 (+https://pelayoespinosa.com/faviladaw)';
const VERDE = '#125A37', CORAL = '#FF6B6B', GRIS_DK = '#B4BEB9';

const worldX = (lng, zoom) => (lng + 180) / 360 * TILE_SIZE * 2 ** zoom;
const worldY = (lat, zoom) => {
  const rad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * TILE_SIZE * 2 ** zoom;
};

function elegirZoom(entrada, salida, w, h, padding = 30) {
  if (!salida) return 17;
  for (let z = 18; z >= 12; z--) {
    const dx = Math.abs(worldX(salida.lng, z) - worldX(entrada.lng, z));
    const dy = Math.abs(worldY(salida.lat, z) - worldY(entrada.lat, z));
    if (dx <= w - padding * 2 && dy <= h - padding * 2) return z;
  }
  return 12;
}

async function descargarTile(z, x, y) {
  const n = 2 ** z;
  if (x < 0 || y < 0 || x >= n || y >= n) return null;
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function marcador(doc, x, y, color, etiqueta) {
  doc.circle(x, y, 6).fill(color);
  doc.circle(x, y, 6).lineWidth(1.5).strokeColor('#FFFFFF').stroke();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(color).text(etiqueta, x - 20, y - 20, { width: 40, align: 'center' });
}

async function dibujarMapaFichaje(doc, { x, y, w, h, entrada, salida }) {
  doc.roundedRect(x, y, w, h, 4).lineWidth(1).strokeColor(GRIS_DK).stroke();

  if (!entrada?.lat || entrada?.lng == null) {
    doc.font('Helvetica').fontSize(9).fillColor(GRIS_DK)
      .text('No hay ubicación guardada para este fichaje.', x, y + h / 2 - 5, { width: w, align: 'center' });
    return;
  }

  const tieneSalida = salida?.lat != null && salida?.lng != null;
  const zoom = elegirZoom(entrada, tieneSalida ? salida : null, w, h);

  const cx = tieneSalida ? (worldX(entrada.lng, zoom) + worldX(salida.lng, zoom)) / 2 : worldX(entrada.lng, zoom);
  const cy = tieneSalida ? (worldY(entrada.lat, zoom) + worldY(salida.lat, zoom)) / 2 : worldY(entrada.lat, zoom);
  const left = cx - w / 2, top = cy - h / 2;

  const tileXmin = Math.floor(left / TILE_SIZE), tileXmax = Math.floor((left + w) / TILE_SIZE);
  const tileYmin = Math.floor(top / TILE_SIZE), tileYmax = Math.floor((top + h) / TILE_SIZE);

  const tiles = [];
  for (let tx = tileXmin; tx <= tileXmax; tx++) {
    for (let ty = tileYmin; ty <= tileYmax; ty++) {
      tiles.push({ tx, ty });
    }
  }

  const buffers = await Promise.all(tiles.map(t => descargarTile(zoom, t.tx, t.ty)));
  const huboAlgunTile = buffers.some(b => b);

  if (!huboAlgunTile) {
    doc.font('Helvetica').fontSize(9).fillColor(GRIS_DK)
      .text('No se pudo cargar el mapa.', x, y + h / 2 - 5, { width: w, align: 'center' });
    return;
  }

  doc.save();
  doc.roundedRect(x, y, w, h, 4).clip();
  tiles.forEach((t, i) => {
    const buf = buffers[i];
    if (!buf) return;
    const destX = x + (t.tx * TILE_SIZE - left);
    const destY = y + (t.ty * TILE_SIZE - top);
    try { doc.image(buf, destX, destY, { width: TILE_SIZE, height: TILE_SIZE }); } catch {  }
  });

  const entX = x + (worldX(entrada.lng, zoom) - left), entY = y + (worldY(entrada.lat, zoom) - top);
  if (tieneSalida) {
    const salX = x + (worldX(salida.lng, zoom) - left), salY = y + (worldY(salida.lat, zoom) - top);
    doc.moveTo(entX, entY).lineTo(salX, salY).lineWidth(2).strokeColor('#3ddc84').stroke();
    marcador(doc, salX, salY, CORAL, 'Salida');
  }
  marcador(doc, entX, entY, VERDE, 'Entrada');

  doc.restore();
  doc.roundedRect(x, y, w, h, 4).lineWidth(1).strokeColor(GRIS_DK).stroke();

  doc.font('Helvetica').fontSize(6).fillColor(GRIS_DK)
    .text('© OpenStreetMap contributors', x + 4, y + h - 10, { width: w - 8 });
}

module.exports = { dibujarMapaFichaje };
