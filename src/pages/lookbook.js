import * as THREE from "three";
import { gsap, reduce } from "../lib/ui.js";
import * as sound from "../lib/sound.js";

const PHOTOS = [
  { src: "img/back.webp", alt: "The Peace tee from behind on an LA rooftop" },
  { src: "img/front.webp", alt: "The Peace tee from the front, leaning on a concrete wall" },
  { src: "img/print-close.webp", alt: "The back print up close" },
  { src: "img/label-close.webp", alt: "The woven chest label and barcode" },
  { src: "img/rooftop.webp", alt: "The rooftop, the back print and the city" },
  { src: "img/armenian-close.webp", alt: "Խաղաղություն, the Armenian word, up close" },
  { src: "img/front-portrait.webp", alt: "Portrait in the Peace tee" },
];

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
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x0a0a0a, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0a, 6, 16);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0, 0, 7);
  const loader = new THREE.TextureLoader();
  const group = new THREE.Group(); scene.add(group);
  const layout = [[-2.6, 0.7, -0.8], [2.2, 1.0, -2.6], [0.1, -1.6, 0.2], [-4.2, -1.9, -3.4], [3.9, -1.5, -1.2], [-1.2, 2.5, -4.6], [5.2, 2.2, -5.4]];
  const meshes = await Promise.all(PHOTOS.map(async (p, i) => {
    const t = await loader.loadAsync(p.src); t.colorSpace = THREE.SRGBColorSpace;
    const h = 2.5, w = h * (t.image.width / t.image.height);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, fog: true }));
    m.position.set(...layout[i]); m.userData = { i, base: m.position.clone(), phase: Math.random() * 6 };
    group.add(m); return m;
  }));
  root.classList.add("has-webgl");
  document.body.classList.add("has-webgl");

  const resize = () => { const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.z = w < 760 ? 10 : 7; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(root); resize();

  // drag to drift, with inertia; tap a photo to open it
  const pan = new THREE.Vector2(), vel = new THREE.Vector2(); let down = null, moved = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  root.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; moved = 0; root.setPointerCapture(e.pointerId); });
  root.addEventListener("pointermove", (e) => {
    const r = root.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!down) { ray.setFromCamera(ndc, camera); root.dataset.cursor = ray.intersectObjects(meshes)[0] ? "View" : "Drag"; return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y; moved += Math.abs(dx) + Math.abs(dy);
    vel.set(-dx * 0.012, dy * 0.012); pan.add(vel); down = { x: e.clientX, y: e.clientY };
  });
  root.addEventListener("pointerup", (e) => {
    if (moved < 8) { ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(meshes)[0]; if (hit) open(hit.object.userData.i); }
    down = null;
  });
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(root);
  gsap.ticker.add((t) => {
    if (!visible || document.hidden) return;
    if (!down) { pan.add(vel); vel.multiplyScalar(0.92); }
    pan.clampScalar(-4, 4);
    group.position.x += (-pan.x - group.position.x) * 0.1;
    group.position.y += (-pan.y - group.position.y) * 0.1;
    meshes.forEach((m) => {
      const k = m.userData; if (reduce) return;
      m.position.y = k.base.y + Math.sin(t * 0.4 + k.phase) * 0.12;
      m.rotation.y = Math.sin(t * 0.25 + k.phase) * 0.12 - group.position.x * 0.03;
    });
    renderer.render(scene, camera);
  });
}
