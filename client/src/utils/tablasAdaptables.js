
function etiquetar(table) {
  const head = table.tHead?.rows?.[table.tHead.rows.length - 1];
  if (!head) return;
  const labels = [...head.cells].map(th => (th.textContent || '').trim());
  if (!labels.length) return;
  for (const body of table.tBodies) {
    for (const tr of body.rows) {
      const cells = tr.cells;
      if (cells.length !== labels.length) continue;
      for (let i = 0; i < cells.length; i++) {
        const td = cells[i];
        if (td.colSpan > 1 || td.hasAttribute('data-label') || !labels[i]) continue;
        td.setAttribute('data-label', labels[i]);
      }
    }
  }
}

function sombras(wrap) {
  const max = wrap.scrollWidth - wrap.clientWidth;
  wrap.classList.toggle('sh-r', max > 2 && wrap.scrollLeft < max - 2);
  wrap.classList.toggle('sh-l', wrap.scrollLeft > 2);
}

export function attachTablasAdaptables(root) {
  if (!root) return () => {};
  const vistos = new WeakSet();
  let raf = 0;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(entries => entries.forEach(e => sombras(e.target))) : null;

  const pasar = () => {
    raf = 0;
    root.querySelectorAll('table.data-table').forEach(etiquetar);
    root.querySelectorAll('.table-wrap').forEach(w => {
      if (!vistos.has(w)) {
        vistos.add(w);
        w.addEventListener('scroll', () => sombras(w), { passive: true });
        ro?.observe(w);
      }
      sombras(w);
    });
  };
  const programar = () => { if (!raf) raf = requestAnimationFrame(pasar); };

  const mo = new MutationObserver(programar);
  mo.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', programar);
  programar();
  return () => {
    mo.disconnect(); ro?.disconnect();
    window.removeEventListener('resize', programar);
    if (raf) cancelAnimationFrame(raf);
  };
}
