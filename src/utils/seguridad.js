const crypto = require('crypto');

function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generarPasswordTemporal() {
  const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const grupo = () => Array.from(crypto.randomBytes(4))
    .map(b => ALFABETO[b % ALFABETO.length]).join('');
  return `${grupo()}-${grupo()}-${grupo()}`;
}

const limpiarPalabras = texto => String(texto)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/ñ/g, 'n').replace(/[^a-z\s]/g, '')
  .trim().split(/\s+/).filter(Boolean);

function generarUsernameBase(nombre = '', apellidos = '') {
  const palabrasNombre = limpiarPalabras(nombre);
  const inicialesApellidos = limpiarPalabras(apellidos).map(a => a[0]).join('');
  if (!palabrasNombre.length && !inicialesApellidos) return 'usuario';
  return palabrasNombre.join('') + inicialesApellidos;
}

const CONECTORES = new Set(['de', 'del', 'la', 'los', 'las']);

function agruparConectores(palabras) {
  const grupos = [];
  let i = 0;
  while (i < palabras.length) {
    let j = i;
    while (j < palabras.length && CONECTORES.has(palabras[j].toLowerCase())) j++;
    if (j < palabras.length) j++;
    const fin = j > i ? j : i + 1;
    grupos.push(palabras.slice(i, fin).join(' '));
    i = fin;
  }
  return grupos;
}

function partirNombre(nombreCompleto = '') {
  const palabras = agruparConectores(String(nombreCompleto).trim().split(/\s+/).filter(Boolean));
  if (palabras.length <= 1) return { nombre: palabras[0] || '', apellidos: '' };
  if (palabras.length === 2) return { nombre: palabras[0], apellidos: palabras[1] };
  if (palabras.length === 3) return { nombre: palabras[0], apellidos: palabras.slice(1).join(' ') };
  return { nombre: palabras.slice(0, 2).join(' '), apellidos: palabras.slice(2).join(' ') };
}

module.exports = { escapeRegex, generarPasswordTemporal, generarUsernameBase, partirNombre };
