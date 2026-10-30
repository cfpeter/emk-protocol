import * as THREE from "three";
import { gsap, reduce } from "../lib/ui.js";
import * as sound from "../lib/sound.js";

const PHOTOS = [
  { src: "img/lb-back-sky.webp", alt: "The back print on a rooftop with the downtown LA skyline" },
  { src: "img/lb-front-sky.webp", alt: "The front on the rooftop with the skyline" },
  { src: "img/lb-flatlay.webp", alt: "The back print laid flat on black tissue next to the box" },
  { src: "img/lb-label.webp", alt: "The woven chest label and hang tag up close" },
  { src: "img/lb-back-tower.webp", alt: "The back print with a glass tower behind" },
  { src: "img/lb-front-bench.webp", alt: "The front, chest label, leaning on a bench" },
  { src: "img/lb-walk.webp", alt: "Walking away across the rooftop" },
  { src: "img/lb-back-close.webp", alt: "The back print up close" },
  { src: "img/lb-hem.webp", alt: "The hem barcode, EMK-001 / PEACE COLLECTION" },
  { src: "img/lb-back-34.webp", alt: "The back print from a three-quarter angle on the skyline" },
  { src: "img/lb-box.webp", alt: "The box lid and the tee with its label" },
  { src: "img/lb-folded.webp", alt: "The tee folded in its box with the hang tag" },
];
// a loose constellation: near photos in the middle, far ones around the edge (x, y, z)
const LAYOUT = [
  [-2.5, 0.6, -0.6], [2.3, 1.1, -2.4], [0.1, -1.7, 0.2], [-4.4, -1.9, -3.2],
  [4.0, -1.5, -1.0], [-1.3, 2.7, -4.4], [5.6, 2.3, -5.2], [-6.2, 1.6, -5.6],
  [1.6, -3.9, -3.6], [-3.1, -4.4, -2.0], [6.8, -3.6, -4.6], [0.4, 4.6, -6.2],
];

// photos are 1200x1600; on screen a plane is never more than ~350 css px tall, so a
// downscaled copy keeps the GPU at a fraction of the memory (12 full photos is ~120 MB with mips)
async function loadScaled(src, maxH) {
  const img = new Image();
  img.decoding = "async"; img.src = src;
  await img.decode();
  const k = Math.min(1, maxH / img.naturalHeight);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: img.naturalWidth / img.naturalHeight };
}

export default async function lookbook() {
  const root = document.querySelector(".look");
  const canvas = root.querySelector("canvas");
  const box = document.querySelector("[data-lightbox]");
  let index = 0;
  const open = (i) => {
    index = (i + PHOTOS.length) % PHOTOS.length;
    const img = box.querySelector("img");
    img.src = PHOTOS[index].src; img.alt = PHOTOS[index].alt;
    box.querySelector("[data-cap]").textContent = PHOTOS[index].alt;
    box.hidden = false; requestAnimationFrame(() => box.classList.add("on")); box.focus();
    gsap.fromTo(img, { scale: 0.92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: reduce ? 0 : 0.6, ease: "expo.out" });
    sound.click();
  };
  const close = () => { box.classList.remove("on"); setTimeout(() => { if (!box.classList.contains("on")) box.hidden = true; }, 350); };
  box.querySelector("[data-close]").addEventListener("click", close);
  box.querySelector("[data-prev]").addEventListener("click", () => open(index - 1));
  box.querySelector("[data-next]").addEventListener("click", () => open(index + 1));
  addEventListener("keydown", (e) => { if (!box.classList.contains("on")) return; if (e.key === "Escape") close(); if (e.key === "ArrowRight") open(index + 1); if (e.key === "ArrowLeft") open(index - 1); });
  let sx = null, sy = null;
  box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  box.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dy) > 90 && dy > 0) close(); else if (Math.abs(dx) > 50) open(index + (dx < 0 ? 1 : -1));
  });
  document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => open(Number(b.dataset.open))));

  // ---------- the floating gallery ----------
  const coarse = matchMedia("(pointer: coarse)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse }); } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x0a0a0a, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0a, 6, 17);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0, 0, 7);
  const group = new THREE.Group(); scene.add(group);
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const maxH = coarse || innerWidth < 760 ? 768 : 1024;
  // photos join the gallery as each arrives (fading in), instead of all waiting on the slowest
  const meshes = [];
  const add = async (p, i) => {
    const { t, aspect } = await loadScaled(p.src, maxH);
    t.anisotropy = aniso;
    renderer.initTexture(t); // upload now, not on its first visible frame
    const h = 2.5, w = h * aspect;
    const mat = new THREE.MeshBasicMaterial({ map: t, fog: true, transparent: true, opacity: 0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...LAYOUT[i % LAYOUT.length]); m.userData = { i, baseY: m.position.y, phase: Math.random() * 6 };
    group.add(m); meshes.push(m);
    gsap.to(mat, { opacity: 1, duration: reduce ? 0 : 0.8, ease: "power2.out", onComplete: () => { mat.transparent = false; mat.needsUpdate = true; } });
  };
  // the four nearest first, then the rest, so the first screen isn't waiting behind eight others
  const first = Promise.allSettled(PHOTOS.slice(0, 4).map((p, i) => add(p, i)));
  first.then(() => PHOTOS.slice(4).forEach((p, i) => add(p, i + 4).catch(() => {})));
  await Promise.race([first, new Promise((r) => setTimeout(r, 1500))]);
  root.classList.add("has-webgl");
  document.body.classList.add("has-webgl");

  // layout reads happen here only (resize/scroll), never inside pointer moves or the tick
  let rect = root.getBoundingClientRect();
  const resize = () => {
    rect = root.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.z = w < 760 ? 10 : 7; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(root); resize();
  addEventListener("scroll", () => { rect = root.getBoundingClientRect(); }, { passive: true });

  // drag to drift: the gallery trails the finger (weight), keeps the flick's speed and glides to rest
  const { damp, clamp } = THREE.MathUtils;
  const pan = new THREE.Vector2(), vel = new THREE.Vector2(); // vel in units per second
  let down = null, moved = 0, lastT = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const LIMIT = 5.5, GAIN = 0.012;
  root.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; moved = 0; lastT = e.timeStamp; vel.set(0, 0); root.setPointerCapture(e.pointerId); });
  let hoverQueued = false;
  root.addEventListener("pointermove", (e) => {
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (!down) {
      if (e.pointerType === "mouse" && !hoverQueued) { // hover label: at most one raycast per frame
        hoverQueued = true;
        requestAnimationFrame(() => { hoverQueued = false; ray.setFromCamera(ndc, camera); root.dataset.cursor = ray.intersectObjects(meshes)[0] ? "View" : "Drag"; });
      }
      return;
    }
    const dx = e.clientX - down.x, dy = e.clientY - down.y, ms = Math.max(4, e.timeStamp - lastT);
    moved += Math.abs(dx) + Math.abs(dy);
    pan.x = clamp(pan.x - dx * GAIN, -LIMIT, LIMIT);
    pan.y = clamp(pan.y + dy * GAIN, -LIMIT, LIMIT);
    vel.x = vel.x * 0.5 + (-dx * GAIN / ms) * 1000 * 0.5;
    vel.y = vel.y * 0.5 + (dy * GAIN / ms) * 1000 * 0.5;
    down = { x: e.clientX, y: e.clientY }; lastT = e.timeStamp;
  });
  const release = (e) => {
    if (!down) return;
    if (e.type === "pointerup" && moved < 8) { ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(meshes)[0]; if (hit) open(hit.object.userData.i); }
    if (e.timeStamp - lastT > 90 || reduce) vel.set(0, 0); // held still before letting go: no flick
    vel.clampScalar(-14, 14);
    down = null;
  };
  root.addEventListener("pointerup", release); root.addEventListener("pointercancel", release);

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(root);
  gsap.ticker.add((t, dms) => {
    if (!visible || document.hidden) return;
    const dt = Math.min(dms / 1000, 0.05);
    if (!down && (vel.x || vel.y)) {
      pan.x += vel.x * dt; pan.y += vel.y * dt;
      vel.x = damp(vel.x, 0, 3.5, dt); vel.y = damp(vel.y, 0, 3.5, dt);
      if (Math.abs(pan.x) > LIMIT) { pan.x = Math.sign(pan.x) * LIMIT; vel.x = 0; }
      if (Math.abs(pan.y) > LIMIT) { pan.y = Math.sign(pan.y) * LIMIT; vel.y = 0; }
      if (vel.lengthSq() < 1e-5) vel.set(0, 0);
    }
    group.position.x = damp(group.position.x, -pan.x, 6, dt);
    group.position.y = damp(group.position.y, -pan.y, 6, dt);
    if (!reduce) {
      for (const m of meshes) {
        const k = m.userData;
        m.position.y = k.baseY + Math.sin(t * 0.4 + k.phase) * 0.12;
        m.rotation.y = Math.sin(t * 0.25 + k.phase) * 0.12 - group.position.x * 0.03;
      }
    }
    renderer.render(scene, camera);
  });
}
