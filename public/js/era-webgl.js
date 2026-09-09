// WebGL era stage: a ring of project cards seen from the air, orbiting a wireframe
// "lawn" globe over a pink path ring. Three is imported lazily so the CDN request only
// happens once the section is near; main.js catches any failure and leaves the CSS backdrop.
import { whileVisible } from './lib/observe.js';

const GREEN = 0x2fa44f;
const PINK = 0xe8b7b0;
const RADIUS = 3;

export async function mountScene(stage, era, { reducedMotion = false } = {}) {
  const THREE = await import('three');
  const projects = era?.projects ?? [];
  const domCards = [...(stage.closest('.era')?.querySelectorAll('.cards > .card') ?? [])];

  // ---- renderer / camera ----
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.append(canvas);
  stage.setAttribute('data-mounted', '');   // css drops the fallback backdrop
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const camBase = new THREE.Vector3(0, 4.1, 8.1);   // above and back: the aerial nod
  const camHome = camBase.clone();                    // camBase pulled back further on narrow stages
  const camTarget = new THREE.Vector3(0, -0.3, 0);   // look a touch below the ring so it sits centred in frame
  camera.position.copy(camHome);

  // ---- centre: green wireframe globe ----
  const globe = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.3, 1),
    new THREE.MeshBasicMaterial({ color: GREEN, wireframe: true, transparent: true, opacity: 0.28 }),
  );
  scene.add(globe);

  // ---- pink path ring, flat under the cards ----
  const path = new THREE.Mesh(
    new THREE.TorusGeometry(RADIUS, 0.014, 6, 128),
    new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.55 }),
  );
  path.rotation.x = Math.PI / 2;
  path.position.y = -0.62;
  scene.add(path);

  // ---- orbiting project cards ----
  const ring = new THREE.Group();
  const cardGeo = new THREE.PlaneGeometry(1.5, 0.94);
  const cards = projects.map((p, i) => {
    const tex = makeCardTexture(THREE, p.title, p.role, i % 2 ? GREEN : PINK);
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const mesh = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    const a = (i / projects.length) * Math.PI * 2;
    mesh.position.set(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS);
    mesh.userData = { index: i, href: p.href, scale: 1 };
    ring.add(mesh);
    return mesh;
  });
  scene.add(ring);

  // ---- interaction ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);   // NDC of last pointer position
  const drift = new THREE.Vector2(0, 0);     // target camera offset, eased
  let hovered = null;

  const setHovered = (mesh) => {
    if (mesh === hovered) return;
    hovered = mesh;
    canvas.style.cursor = mesh ? 'pointer' : '';
    domCards.forEach((li, i) => {
      if (mesh && i === mesh.userData.index) li.setAttribute('data-active', '');
      else li.removeAttribute('data-active');
    });
  };

  const onMove = (ev) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    drift.set(pointer.x * 0.3, pointer.y * 0.3);
    raycaster.setFromCamera(pointer, camera);
    setHovered(raycaster.intersectObjects(cards, false)[0]?.object ?? null);
    if (reducedMotion) settle(1), render();
  };
  const onLeave = () => { drift.set(0, 0); setHovered(null); if (reducedMotion) settle(1), render(); };
  const onClick = () => {
    const href = hovered?.userData.href;
    if (!href) return;
    if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
    else location.assign(href);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);

  // ---- per-frame state ----
  // advance(dt): time-based motion. settle(k): ease camera/scales toward targets (k=1 snaps).
  const advance = (dt) => {
    ring.rotation.y += dt * 0.11;
    globe.rotation.y -= dt * 0.16;
    globe.rotation.x += dt * 0.03;
  };
  const settle = (k) => {
    camera.position.x += (camHome.x + drift.x - camera.position.x) * k;
    camera.position.y += (camHome.y + drift.y - camera.position.y) * k;
    camera.position.z += (camHome.z - camera.position.z) * k;
    camera.lookAt(camTarget);
    for (const c of cards) {
      const target = c === hovered ? 1.12 : 1;
      c.userData.scale += (target - c.userData.scale) * k;
      c.scale.setScalar(c.userData.scale);
      c.quaternion.copy(camera.quaternion);   // billboard: every card faces the aerial camera
    }
  };
  const render = () => renderer.render(scene, camera);

  // ---- sizing ----
  const resize = () => {
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camHome.copy(camBase).multiplyScalar(Math.max(1, 1.6 / camera.aspect));   // keep the ring in frame
    if (reducedMotion) settle(1), render();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  // ---- loop: only while the stage is on screen and the tab is visible ----
  let raf = 0, last = 0, onScreen = false;
  const tick = (now) => {
    raf = 0;
    if (!stage.isConnected) return dispose();
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    advance(dt);
    settle(1 - Math.exp(-dt * 6));
    render();
    if (onScreen && !document.hidden) raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && !reducedMotion && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else start(); };
  document.addEventListener('visibilitychange', onVisibility);
  const stopWatching = whileVisible(stage, () => { onScreen = true; start(); }, () => { onScreen = false; });

  // Reduced motion: one settled frame, then only re-render on pointer events.
  settle(1);
  render();

  function dispose() {
    cancelAnimationFrame(raf);
    stopWatching();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
    renderer.dispose();
    canvas.remove();
    stage.removeAttribute('data-mounted');
  }
  return dispose;
}

// A dark card with the project title, role, and a coloured underline, drawn at runtime.
function makeCardTexture(THREE, title, role, accent) {
  const W = 512, H = 320, pad = 40;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0d14';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2a2e3a';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Title, wrapped by hand: canvas has no text layout.
  ctx.fillStyle = '#e6e8ee';
  ctx.font = '500 46px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'top';
  const lines = [];
  let line = '';
  for (const word of String(title).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > W - pad * 2 && line) { lines.push(line); line = word; }
    else line = next;
  }
  lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, pad, pad + i * 50));
  const under = pad + Math.min(lines.length, 3) * 50 + 8;

  ctx.fillStyle = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.fillRect(pad, under, 72, 3);

  if (role) {
    ctx.fillStyle = '#8b90a0';
    ctx.font = '24px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillText(role, pad, H - pad - 24);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
