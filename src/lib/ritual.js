// Home: the hold-still ritual. Calm is the input (press and hold, a still mouse button, or Space).
// Stage 1: the rooftop photo pulls into focus. Stages 2-4: each word forms out of
// particles while you hold still; move or let go and it drifts apart.
import * as THREE from "three";
import { gsap } from "gsap";
import { ensureId, unlockWord, hasWord, wordCount, setStill, getState } from "./state.js";
import * as sound from "./sound.js";

const WORDS = [
  { key: "peace", text: "PEACE", font: "600 220px Archivo", dir: "ltr", say: "Peace, in English." },
  { key: "salam", text: "سلام", font: "700 230px 'Noto Naskh Arabic'", dir: "rtl", say: "Salam, in Arabic." },
  { key: "khaghaghutyun", text: "Խաղաղություն", font: "700 150px 'Noto Serif Armenian'", dir: "ltr", say: "Khaghaghutyun, in Armenian." },
];
const N = 3600;
const HOLD_SETTLE = 2.2; // seconds of stillness to settle the photo
const HOLD_WORD = 1.7;   // seconds per word
const JITTER = 14;       // px of movement that counts as "not still"

const bgFrag = /* glsl */ `
  uniform sampler2D uPhoto; uniform sampler2D uDepth; uniform vec2 uRes; uniform float uAspect;
  uniform float uCalm; uniform float uTime; uniform float uDim; varying vec2 vUv;
  vec2 cover(vec2 uv) { float ca = uRes.x / uRes.y; vec2 s = ca > uAspect ? vec2(1.0, uAspect / ca) : vec2(ca / uAspect, 1.0); return uv * s + (1.0 - s) * vec2(0.5, 0.42); }
  void main() {
    vec2 uv = cover(vUv);
    float d = texture2D(uDepth, uv).r;
    uv += vec2(sin(uTime * 0.6), cos(uTime * 0.5)) * (d - 0.6) * 0.004 * uCalm; // the photo breathes
    // out of focus and dark until you are still, then it pulls into focus
    float c = smoothstep(0.0, 1.0, uCalm);
    vec3 soft = texture2D(uPhoto, uv, 7.0 * (1.0 - c)).rgb;
    vec3 col = soft * mix(0.16, uDim, c);
    col *= 1.0 - dot(vUv - 0.5, vUv - 0.5) * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;
const ptsVert = /* glsl */ `
  attribute vec3 aFrom; attribute vec3 aTo; attribute float aSeed;
  uniform float uMix; uniform float uTime; uniform float uSize; uniform float uPx;
  varying float vA;
  void main() {
    float m = smoothstep(0.0, 1.0, clamp(uMix * 1.25 - aSeed * 0.25, 0.0, 1.0));
    vec3 p = mix(aFrom, aTo, m);
    float swirl = sin(m * 3.14159);
    p.x += sin(aSeed * 40.0 + uTime * 1.3) * 60.0 * swirl;
    p.y += cos(aSeed * 31.0 + uTime * 1.1) * 60.0 * swirl;
    p.x += sin(uTime * 0.8 + aSeed * 12.0) * 1.2; p.y += cos(uTime * 0.7 + aSeed * 9.0) * 1.2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPx * (0.7 + aSeed * 0.6);
    vA = 0.55 + 0.45 * m;
  }`;
const ptsFrag = /* glsl */ `
  varying float vA; uniform float uAlpha;
  void main() { float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vec3(0.91, 0.88, 0.80), a * vA * uAlpha);
    #include <colorspace_fragment>
  }`;

// sample a word's filled pixels into N points (the browser shapes Arabic correctly)
function sampleWord(w, width, yOffset = 0) {
  const c = document.createElement("canvas");
  c.width = 1400; c.height = 420;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.direction = w.dir; ctx.font = w.font;
  let size = parseInt(w.font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(w.text).width > c.width * 0.94 && size > 40) { size -= 10; ctx.font = w.font.replace(/\d+px/, `${size}px`); }
  ctx.fillText(w.text, c.width / 2, c.height / 2);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const filled = [];
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (data[(y * c.width + x) * 4 + 3] > 128) filled.push(x, y);
  const scale = width / c.width;
  const out = new Float32Array(N * 3);
  const count = filled.length / 2;
  for (let i = 0; i < N; i++) {
    const k = Math.floor(Math.random() * count) * 2;
    out[i * 3] = (filled[k] - c.width / 2 + Math.random() * 2) * scale;
    out[i * 3 + 1] = -(filled[k + 1] - c.height / 2 + Math.random() * 2) * scale - yOffset;
    out[i * 3 + 2] = 0;
  }
  return out;
}
function scatter(w, h) {
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { out[i * 3] = (Math.random() - 0.5) * w * 1.2; out[i * 3 + 1] = (Math.random() - 0.5) * h * 1.2; }
  return out;
}

export async function initRitual(root) {
  const canvas = root.querySelector("canvas");
  const ui = {
    boot: root.querySelector("[data-boot]"), prompt: root.querySelector("[data-prompt]"),
    ring: root.querySelector(".ritual-ring .fill"), ringWrap: root.querySelector(".ritual-ring"),
    begin: root.querySelector("[data-begin]"), say: root.querySelector("[data-say]"),
    done: root.querySelector("[data-done]"), doneId: root.querySelector("[data-done-id]"),
    live: root.querySelector("[data-live]"), title: root.querySelector(".ritual-title"),
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setPrompt = (t) => { ui.prompt.textContent = t; ui.live.textContent = t; };
  const ring = (p) => { ui.ring.style.strokeDashoffset = String(289 * (1 - p)); };

  // ---------- boot line types itself ----------
  const bootText = "PEACE PROTOCOL › SERIES-001 › READY";
  const typed = { n: 0 };
  gsap.to(typed, { n: bootText.length, duration: reduce ? 0 : 1.4, ease: "none", delay: 0.2, onUpdate: () => { ui.boot.textContent = bootText.slice(0, Math.round(typed.n)); if (Math.round(typed.n) % 3 === 0) sound.tick(); } });

  // ---------- no-WebGL / reduced motion: tap to unlock each word ----------
  let renderer = null;
  if (!reduce) { try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }); } catch {} }
  if (!renderer) {
    root.classList.add("is-static");
    let i = wordCount();
    ui.begin.textContent = i >= 3 ? "See your protocol" : "Next word";
    ui.begin.addEventListener("click", () => {
      if (i < 3) { unlockWord(WORDS[i].key); ui.say.textContent = `${WORDS[i].text} · ${WORDS[i].say}`; sound.chime(i); i++; }
      if (i >= 3) {
        ui.doneId.textContent = getState().id || ensureId();
        ui.begin.hidden = true; ui.done.hidden = false; sound.chord();
      } else ui.begin.textContent = "Next word";
    });
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  await document.fonts.ready.catch(() => {});
  await Promise.all([
    document.fonts.load("700 100px 'Noto Naskh Arabic'", "سلام"),
    document.fonts.load("700 100px 'Noto Serif Armenian'", "Խաղաղություն"),
    document.fonts.load("600 100px Archivo", "PEACE"),
  ]).catch(() => {});

  const loader = new THREE.TextureLoader();
  const [photo, depth] = await Promise.all([loader.loadAsync("img/back.webp"), loader.loadAsync("img/back-depth.png")]);
  photo.colorSpace = THREE.SRGBColorSpace;
  const bgU = { uPhoto: { value: photo }, uDepth: { value: depth }, uRes: { value: new THREE.Vector2(1, 1) }, uAspect: { value: photo.image.width / photo.image.height }, uCalm: { value: 0 }, uTime: { value: 0 }, uDim: { value: 0.8 } };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgU, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: bgFrag, depthTest: false,
  }));
  bg.frustumCulled = false; scene.add(bg);

  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(N); for (let i = 0; i < N; i++) seeds[i] = Math.random();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const ptsU = { uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: 2.2 }, uPx: { value: renderer.getPixelRatio() }, uAlpha: { value: 0 } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: ptsU, vertexShader: ptsVert, fragmentShader: ptsFrag, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; scene.add(points);

  let W = 1, H = 1, shapes = [], scat = null;
  function resize() {
    W = root.clientWidth; H = root.clientHeight;
    renderer.setSize(W, H, false);
    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2; camera.updateProjectionMatrix();
    bgU.uRes.value.set(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    const width = Math.min(W * (W < 760 ? 0.9 : 0.5), 900);
    shapes = WORDS.map((w) => sampleWord(w, width, H * 0.17));
    scat = scatter(W, H);
    applyPair();
  }
  // which shapes the particles travel between
  let wordIdx = Math.min(wordCount(), 3);
  function applyPair() {
    const from = wordIdx === 0 ? scat : shapes[Math.min(wordIdx - 1, 2)];
    const to = wordIdx >= 3 ? shapes[2] : shapes[wordIdx];
    geo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    geo.setAttribute("aTo", new THREE.BufferAttribute(to, 3));
  }
  new ResizeObserver(resize).observe(root); resize();

  // ---------- the stillness engine ----------
  let phase = "boot"; // boot -> settle -> words -> done
  let holding = false, origin = null, held = 0, stillTime = 0;
  let calm = 0, mix = 0;
  const startHold = (x, y) => { if (phase === "boot" || phase === "done") return; holding = true; origin = { x, y }; sound.buzz(6); };
  const endHold = () => { holding = false; origin = null; };
  root.addEventListener("pointerdown", (e) => { if (e.target.closest("a, button")) return; startHold(e.clientX, e.clientY); });
  addEventListener("pointermove", (e) => {
    if (!holding || !origin) return;
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > JITTER) { held *= 0.4; origin = { x: e.clientX, y: e.clientY }; setPrompt("Hold still."); sound.buzz(20); }
  }, { passive: true });
  addEventListener("pointerup", endHold); addEventListener("pointercancel", endHold);
  addEventListener("keydown", (e) => { if (e.code === "Space" && !e.repeat && document.activeElement?.closest?.(".ritual") ) { e.preventDefault(); startHold(0, 0); } });
  addEventListener("keyup", (e) => { if (e.code === "Space") endHold(); });
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  ui.begin.addEventListener("click", () => {
    ensureId();
    sound.click();
    gsap.to([ui.begin, ui.boot], { autoAlpha: 0, duration: 0.3, onComplete: () => { ui.begin.hidden = true; } });
    gsap.to(ui.ringWrap, { autoAlpha: 1, duration: 0.5 });
    // returning visitors who finished keep their photo and skip ahead
    if (wordCount() >= 3) { calm = 1; mix = 1; wordIdx = 3; applyPair(); finish(); return; }
    phase = "settle";
    setPrompt(matchMedia("(pointer: coarse)").matches ? "Press and hold. Stay still." : "Press and hold. Keep the mouse still.");
    ui.begin.blur(); root.focus({ preventScroll: true });
  });

  function nextWord() {
    if (wordIdx >= 3) return finish();
    const w = WORDS[wordIdx];
    setPrompt(`Hold to write ${w.text}.`);
  }
  function lockWord() {
    const w = WORDS[wordIdx];
    unlockWord(w.key); sound.chime(wordIdx); sound.buzz(30);
    ui.say.textContent = w.say;
    gsap.fromTo(ui.say, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6 });
    wordIdx++;
    held = 0; mix = 0;
    if (wordIdx < 3) { applyPair(); nextWord(); } else { mix = 1; wordIdx = 3; applyPair(); setTimeout(finish, 900); }
  }
  function finish() {
    if (phase === "done") return;
    phase = "done";
    sound.chord();
    setStill(Math.round(stillTime));
    ui.doneId.textContent = getState().id;
    gsap.to([ui.title, ui.prompt, ui.ringWrap, ui.say, ui.boot], { autoAlpha: 0, duration: 0.4 });
    ui.done.hidden = false;
    gsap.fromTo(ui.done.children, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.9, ease: "expo.out", delay: 0.3 });
    gsap.to(bgU.uDim, { value: 0.38, duration: 1.2 });
    gsap.to(ptsU.uAlpha, { value: 0, duration: 0.6 });
  }

  // ---------- loop ----------
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(root);
  gsap.ticker.add((t, dms) => {
    if (!visible || document.hidden) return;
    const dt = Math.min(dms / 1000, 0.05);
    if (holding) { held += dt; stillTime += dt; }
    if (phase === "settle") {
      const target = holding ? Math.min(1, held / HOLD_SETTLE) : 0;
      calm += (target - calm) * Math.min(1, dt * (holding ? 3 : 1.6));
      if (!holding) held = Math.max(0, held - dt * 2);
      ring(calm);
      sound.setCalm(calm);
      if (calm > 0.985) { calm = 1; phase = "words"; gsap.to(bgU.uDim, { value: 0.42, duration: 1 }); held = 0; sound.chime(2); setPrompt("Still. Now hold to write PEACE."); if (wordIdx > 0) nextWord(); gsap.to(ptsU.uAlpha, { value: 1, duration: 0.8 }); }
    } else if (phase === "words") {
      const target = holding ? Math.min(1, held / HOLD_WORD) : 0;
      mix += (target - mix) * Math.min(1, dt * (holding ? 4 : 2));
      if (!holding) held = Math.max(0, held - dt * 1.5);
      ring(mix);
      if (mix > 0.97) lockWord();
    }
    bgU.uCalm.value = calm;
    bgU.uTime.value = t;
    ptsU.uTime.value = t;
    ptsU.uMix.value = mix;
    renderer.render(scene, camera);
  });
  root.classList.add("has-webgl");
}
