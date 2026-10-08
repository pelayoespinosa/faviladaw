
function ease(t) { return 1 - Math.pow(1 - t, 3); }

function animar(getTop, setTop, target, duration = 130) {
  const start = getTop();
  const delta = target - start;
  if (Math.abs(delta) < 1) return;
  const t0 = performance.now();
  function paso(now) {
    const t = Math.min(1, (now - t0) / duration);
    setTop(start + delta * ease(t));
    if (t < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

export function attachFastScrollbarJump(el) {
  function onMouseDown(e) {
    if (e.button !== 0) return;
    const scrollbarW = el.offsetWidth - el.clientWidth;
    if (scrollbarW <= 0 || el.scrollHeight <= el.clientHeight) return;
    const rect = el.getBoundingClientRect();
    if (e.clientX < rect.right - scrollbarW || e.clientX > rect.right) return;

    const trackH = el.clientHeight;
    const thumbH = Math.max(24, (el.clientHeight / el.scrollHeight) * trackH);
    const maxScroll = el.scrollHeight - el.clientHeight;
    const thumbTop = (el.scrollTop / maxScroll) * (trackH - thumbH);
    const clickY = e.clientY - rect.top;
    if (clickY >= thumbTop && clickY <= thumbTop + thumbH) return;

    e.preventDefault();
    const target = Math.max(0, Math.min(maxScroll, ((clickY - thumbH / 2) / (trackH - thumbH)) * maxScroll));
    animar(() => el.scrollTop, (v) => { el.scrollTop = v; }, target);
  }
  el.addEventListener('mousedown', onMouseDown);
  return () => el.removeEventListener('mousedown', onMouseDown);
}

export function attachFastScrollbarJumpWindow() {
  function onMouseDown(e) {
    if (e.button !== 0) return;
    const doc = document.documentElement;
    const scrollbarW = window.innerWidth - doc.clientWidth;
    if (scrollbarW <= 0 || doc.scrollHeight <= window.innerHeight) return;
    if (e.clientX < window.innerWidth - scrollbarW) return;

    const trackH = window.innerHeight;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    const thumbH = Math.max(24, (window.innerHeight / doc.scrollHeight) * trackH);
    const thumbTop = (window.scrollY / maxScroll) * (trackH - thumbH);
    const clickY = e.clientY;
    if (clickY >= thumbTop && clickY <= thumbTop + thumbH) return;

    e.preventDefault();
    const target = Math.max(0, Math.min(maxScroll, ((clickY - thumbH / 2) / (trackH - thumbH)) * maxScroll));
    animar(() => window.scrollY, (v) => window.scrollTo(0, v), target);
  }
  document.addEventListener('mousedown', onMouseDown);
  return () => document.removeEventListener('mousedown', onMouseDown);
}
