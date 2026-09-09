import { onceVisible, whileVisible, prefersReducedMotion } from './lib/observe.js';

const site = (() => {
  try { return JSON.parse(document.getElementById('site-data')?.textContent ?? 'null'); }
  catch { return null; }
})();

const eras = [...document.querySelectorAll('.era')];
const indexLinks = new Map(
  [...document.querySelectorAll('.index__list a')].map((a) => [a.getAttribute('href').slice(1), a]),
);

// Rail: mark the era that currently owns most of the viewport.
if ('IntersectionObserver' in window) {
  const ratios = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) ratios.set(en.target.id, en.intersectionRatio);
    let best = null, bestRatio = 0;
    for (const [id, r] of ratios) if (r > bestRatio) { best = id; bestRatio = r; }
    for (const [id, a] of indexLinks) {
      if (id === best && bestRatio > 0) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  eras.forEach((el) => io.observe(el));
}

// Per-era "live" flag: dialect sheets only run their animations while on screen.
for (const el of eras) {
  whileVisible(el, () => el.classList.add('is-live'), () => el.classList.remove('is-live'));
}

// Editorial reveal: one-time, immediate under reduced motion.
for (const el of document.querySelectorAll('[data-dialect="editorial"]')) {
  if (prefersReducedMotion()) el.classList.add('is-visible');
  else onceVisible(el, () => el.classList.add('is-visible'), { rootMargin: '-10% 0px' });
}

// WebGL stage: load Three and the scene only when the section is near.
const stage = document.querySelector('[data-stage]');
if (stage && site) {
  const era = site.eras.find((e) => e.id === stage.dataset.era);
  onceVisible(stage, async () => {
    try {
      const { mountScene } = await import('./era-webgl.js');
      await mountScene(stage, era, { reducedMotion: prefersReducedMotion() });
    } catch (err) {
      // CDN blocked or WebGL unavailable: the DOM cards and gradient stage still work.
      console.warn('3D stage unavailable:', err);
    }
  });
}
