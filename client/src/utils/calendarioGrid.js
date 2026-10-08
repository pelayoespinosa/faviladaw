const pad = n => String(n).padStart(2, '0');

export const claveDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function generarCeldas(year, month) {
  const primero = new Date(year, month, 1);
  const offset = (primero.getDay() + 6) % 7;
  const inicio = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}
