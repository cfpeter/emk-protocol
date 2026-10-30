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
const N = 5200;           // enough points that thin Armenian and Arabic strokes read solid
const HOLD_SETTLE = 2.2; // seconds of stillness to settle the photo
const HOLD_WORD = 1.7;   // seconds per word
const JITTER = 14;       // px of movement that counts as "not still"

// liquid gold: restless when you move, smooth and glowing when you are still
const bgFrag = /* glsl */ `
  uniform vec2 uRes; uniform float uCalm; uniform float uTime; uniform float uDim; uniform float uSoft; varying vec2 vUv;
  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
    float c = smoothstep(0.0, 1.0, uCalm);
    float t = uTime * mix(0.32, 0.07, c);             // fast and choppy -> slow and calm
    float amp = mix(0.55, 0.32, c);
    vec2 w = uv;
    w.x += sin(uv.y * 2.5 + t * 0.9) * amp;
    w.y += cos(uv.x * 2.5 - t * 0.7) * amp;
    w.x += sin(uv.y * 1.2 - t * 0.5) * 0.25;
    w.y += cos(uv.x * 1.2 + t * 0.8) * 0.25;
    w += (1.0 - c) * 0.05 * vec2(sin(uv.y * 23.0 + uTime * 3.1), cos(uv.x * 19.0 - uTime * 2.7)); // the chop
    float w1 = sin(dot(w, vec2(0.825, 0.565)) * 2.4 + t);
    float w2 = cos(dot(w, vec2(0.765, -0.644)) * 3.2 - t * 1.4 + w1 * 0.4);
    float w3 = sin(dot(w, vec2(0.362, 0.932)) * 4.0 + t * 1.8 + w2 * 0.5);
    float f = w1 * 0.5 + w2 * 0.35 + w3 * 0.15;
    float sharp = mix(3.0, 9.0, c);
    float crest = pow(max(0.0, 1.0 - abs(f - 0.1)), 2.5) * 0.5 + pow(max(0.0, 1.0 - abs(f - 0.15)), sharp) * 0.9;
    vec3 shadow = vec3(0.004, 0.003, 0.002);
    vec3 body = vec3(0.045, 0.028, 0.011);
    vec3 gold = vec3(0.52, 0.39, 0.22);
    vec3 col = mix(shadow, body, smoothstep(-0.6, 0.6, f));
    col += gold * crest * mix(0.55, 1.15, c);
    // behind the words the gold settles down so the type always reads
    col *= mix(0.32, 1.0, smoothstep(0.02, 0.8, uDim)) * (1.0 - uSoft * 0.12);
    col *= 1.0 - dot(vUv - 0.5, vUv - 0.5) * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;
// gold sparks drifting up; brighter as you calm down
const sparkVert = /* glsl */ `
  attribute vec3 aSeed; uniform float uTime; uniform float uCalm; uniform vec2 uView; uniform float uPx;
  varying float vA;
  void main() {
    float speed = 18.0 + aSeed.y * 42.0;
    float y = mod(aSeed.x * uView.y + uTime * speed, uView.y * 1.1) - uView.y * 0.55;
    float x = (aSeed.z - 0.5) * uView.x + sin(uTime * 0.6 + aSeed.x * 20.0) * 18.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, 0.0, 1.0);
    gl_PointSize = (1.4 + aSeed.y * 2.4) * uPx;
    vA = (0.25 + 0.75 * uCalm) * (0.4 + 0.6 * sin(uTime * (1.0 + aSeed.y * 3.0) + aSeed.z * 30.0) * 0.5 + 0.5) * smoothstep(-0.55, -0.3, y / uView.y) * (1.0 - smoothstep(0.3, 0.55, y / uView.y));
  }`;
const sparkFrag = /* glsl */ `
  varying float vA;
  void main() { float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(1.0, 0.78, 0.45, a * a * vA * 0.7);
    #include <colorspace_fragment>
  }`;
const ptsVert = /* glsl */ `
  attribute vec3 aFrom; attribute vec3 aTo; attribute float aSeed;
  uniform float uMix; uniform float uTime; uniform float uSize; uniform float uPx; uniform float uFromA;
  varying float vA;
  void main() {
    float m = smoothstep(0.0, 1.0, clamp(uMix * 1.25 - aSeed * 0.25, 0.0, 1.0));
    vec3 p = mix(aFrom, aTo, m);
    float swirl = sin(m * 3.14159);
    p.x += sin(aSeed * 40.0 + uTime * 1.3) * 26.0 * swirl;
    p.y += cos(aSeed * 31.0 + uTime * 1.1) * 26.0 * swirl;
    p.x += sin(uTime * 0.8 + aSeed * 12.0) * 0.6 * (1.0 - m); p.y += cos(uTime * 0.7 + aSeed * 9.0) * 0.6 * (1.0 - m);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPx * (0.8 + aSeed * 0.5);
    // faint while unformed (a soft glow, not speckle), solid once the word has formed
    vA = mix(uFromA, 1.0, m * m) * (1.0 - 0.35 * swirl);
  }`;
const ptsFrag = /* glsl */ `
  varying float vA; uniform float uAlpha;
  void main() { float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vec3(0.91, 0.88, 0.80), a * vA * uAlpha);
    #include <colorspace_fragment>
  }`;

const smooth = (x) => x * x * (3 - 2 * x);

// sample a word's filled pixels into N points (the browser shapes Arabic correctly)
function sampleWord(w, width) {
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
    out[i * 3 + 1] = -(filled[k + 1] - c.height / 2 + Math.random() * 2) * scale;
    out[i * 3 + 2] = 0;
  }
  return out;
}
// a soft, tight cluster where the word will form (gaussian, wider than tall), not full-screen speckle
function cluster(width) {
  const out = new Float32Array(N * 3);
  const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  for (let i = 0; i < N; i++) { out[i * 3] = g() * width * 0.22; out[i * 3 + 1] = g() * width * 0.05; }
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
        root.dispatchEvent(new CustomEvent("protocol:complete"));
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

  const bgU = { uRes: { value: new THREE.Vector2(1, 1) }, uCalm: { value: 0 }, uTime: { value: 0 }, uDim: { value: 0.8 }, uSoft: { value: 0 } };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgU, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: bgFrag, depthTest: false,
  }));
  bg.frustumCulled = false; scene.add(bg);

  const SPARKS = matchMedia("(pointer: coarse)").matches ? 90 : 160;
  const sGeo = new THREE.BufferGeometry();
  const sSeed = new Float32Array(SPARKS * 3); for (let i = 0; i < sSeed.length; i++) sSeed[i] = Math.random();
  sGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  sGeo.setAttribute("aSeed", new THREE.BufferAttribute(sSeed, 3));
  const sparkU = { uTime: { value: 0 }, uCalm: { value: 0 }, uView: { value: new THREE.Vector2(1, 1) }, uPx: { value: renderer.getPixelRatio() } };
  const sparks = new THREE.Points(sGeo, new THREE.ShaderMaterial({ uniforms: sparkU, vertexShader: sparkVert, fragmentShader: sparkFrag, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);

  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(N); for (let i = 0; i < N; i++) seeds[i] = Math.random();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const ptsU = { uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: 2.2 }, uPx: { value: renderer.getPixelRatio() }, uAlpha: { value: 0 }, uFromA: { value: 0.12 } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: ptsU, vertexShader: ptsVert, fragmentShader: ptsFrag, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; scene.add(points);

  let W = 0, H = 0, shapes = [], scat = null, sampledFor = 0;
  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    renderer.setSize(W, H, false);
    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2; camera.updateProjectionMatrix();
    bgU.uRes.value.set(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    sparkU.uView.value.set(W, H);
    points.position.y = -H * 0.17;
    // resampling reads 3 canvases back: only when the width changes, never for a phone's toolbar
    const width = Math.min(W * (W < 760 ? 0.9 : 0.5), 900);
    if (width !== sampledFor) {
      sampledFor = width;
      shapes = WORDS.map((wd) => sampleWord(wd, width));
      scat = cluster(width);
      applyPair();
    }
    dirty = true;
  }
  // which shapes the particles travel between
  let wordIdx = Math.min(wordCount(), 3);
  function applyPair() {
    const from = wordIdx === 0 ? scat : shapes[Math.min(wordIdx - 1, 2)];
    const to = wordIdx >= 3 ? shapes[2] : shapes[wordIdx];
    geo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    geo.setAttribute("aTo", new THREE.BufferAttribute(to, 3));
    ptsU.uFromA.value = wordIdx === 0 ? 0.12 : 1; // a finished word stays solid until the next one pulls it apart
  }
  let dirty = true, rafResize = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rafResize); rafResize = requestAnimationFrame(resize); }).observe(root); resize();

  // ---------- the stillness engine ----------
  let phase = "boot"; // boot -> settle -> words -> done
  let holding = false, origin = null, held = 0, stillTime = 0;
  let calm = 0, mix = 0, hold = 0; // hold: seconds a just-finished word stays put before the next can start
  const startHold = (x, y) => { if (phase === "boot" || phase === "done") return; holding = true; origin = { x, y }; held = Math.min(held, 0.2); sound.buzz(6); };
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
    root.dataset.cursor = "Hold"; document.dispatchEvent(new CustomEvent("cursor:refresh")); // only now is there something to hold
    sound.click();
    gsap.to([ui.begin, ui.boot], { autoAlpha: 0, duration: 0.3, onComplete: () => { ui.begin.hidden = true; } });
    gsap.to(ui.ringWrap, { autoAlpha: 1, duration: 0.5 });
    // returning visitors who finished keep their photo and skip ahead
    if (wordCount() >= 3) { calm = 1; mix = 1; wordIdx = 3; applyPair(); ptsU.uAlpha.value = 0; finish(); return; }
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
    held = 0; mix = 0; hold = 0.9;
    // the finished word is now the "from" shape at full strength, so nothing jumps at the swap
    if (wordIdx < 3) { applyPair(); nextWord(); } else { mix = 1; wordIdx = 3; applyPair(); hold = 99; setTimeout(finish, 1800); }
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
    gsap.to(bgU.uDim, { value: 0.025, duration: 1.4, ease: "power2.inOut" });
    gsap.to(bgU.uSoft, { value: 3, duration: 1.4, ease: "power2.inOut" });
    gsap.to(ptsU.uAlpha, { value: 0, duration: 1.2, ease: "power2.in" });
    delete root.dataset.cursor; // nothing left to hold
    document.dispatchEvent(new CustomEvent("cursor:refresh"));
    root.dispatchEvent(new CustomEvent("protocol:complete")); // home opens the box next
  }

  // ---------- loop ----------
  // frame-rate independent: every chase is damp(dt), so 60 Hz, 120 Hz and a busy phone feel the same
  const { damp } = THREE.MathUtils;
  let visible = true, lastRing = -1;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(root);
  const setRing = (v) => { if (Math.abs(v - lastRing) > 0.002) { lastRing = v; ring(v); } };
  gsap.ticker.add((t, dms) => {
    if (!visible || document.hidden || root.dataset.paused) return; // paused once the box covers it
    const dt = Math.min(dms / 1000, 0.05);
    if (holding) { held += dt; stillTime += dt; }
    if (phase === "settle") {
      // the focus pull: eases in while you hold, drifts back out gently when you let go
      const target = holding ? smooth(Math.min(1, held / HOLD_SETTLE)) : 0;
      calm = damp(calm, target, holding ? 3.2 : 1.4, dt);
      if (!holding) held = Math.max(0, held - dt * 2);
      setRing(calm);
      sound.setCalm(calm);
      if (calm > 0.985) {
        calm = 1; phase = "words"; held = 0;
        // dim and soften the photo so the shirt's own print never sits under the words
        // (uDim is a linear-light multiplier: 0.045 reads as ~24% brightness on screen)
        gsap.to(bgU.uDim, { value: 0.045, duration: 1.4, ease: "power2.inOut" });
        gsap.to(bgU.uSoft, { value: 2.6, duration: 1.4, ease: "power2.inOut" });
        sound.chime(2); setPrompt("Still. Now hold to write PEACE."); if (wordIdx > 0) nextWord();
        gsap.to(ptsU.uAlpha, { value: 1, duration: 1 });
      }
    } else if (phase === "words") {
      if (hold > 0) { hold -= dt; held = 0; }
      const target = holding && hold <= 0 ? Math.min(1, held / HOLD_WORD) : 0;
      mix = damp(mix, target, holding ? 3.6 : 1.8, dt);
      if (!holding) held = Math.max(0, held - dt * 1.5);
      setRing(mix);
      if (mix > 0.97) lockWord();
    }
    dirty = false;
    sparkU.uTime.value = t; sparkU.uCalm.value = calm;
    bgU.uCalm.value = calm;
    bgU.uTime.value = t;
    ptsU.uTime.value = t;
    ptsU.uMix.value = mix;
    renderer.render(scene, camera);
  });
  root.classList.add("has-webgl");
}
