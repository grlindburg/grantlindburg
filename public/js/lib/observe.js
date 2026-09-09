export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Run cb once, the first time el enters the viewport (expanded by rootMargin).
export function onceVisible(el, cb, { rootMargin = '200px' } = {}) {
  if (!('IntersectionObserver' in window)) { cb(); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((en) => en.isIntersecting)) { io.disconnect(); cb(); }
  }, { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

// Call onEnter/onLeave as el crosses the viewport edge; returns a stop fn.
export function whileVisible(el, onEnter, onLeave, { threshold = 0.05 } = {}) {
  if (!('IntersectionObserver' in window)) { onEnter(); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) (en.isIntersecting ? onEnter : onLeave)();
  }, { threshold });
  io.observe(el);
  return () => io.disconnect();
}
