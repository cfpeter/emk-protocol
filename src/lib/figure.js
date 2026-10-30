// The Peace tee as a lit 3D figure: background-removed photo + baked relief map, gold rim,
// GPU sparks. Used by Home (turns with scroll) and Series 001 (drag, flip, hotspots).
import * as THREE from "three";
import { gsap } from "gsap";

const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
const { damp, clamp, smoothstep } = THREE.MathUtils;
const TIERS = [
  { dpr: 1, aa: false, seg: [56, 76], sparks: 100, low: true },
  { dpr: 1.5, aa: false, seg: [80, 108], sparks: 200, low: false },
  { dpr: 2, aa: true, seg: [120, 160], sparks: 380, low: false },
];
const pickTier = () => {
  const n = navigator;
  if (n.connection?.saveData || (n.deviceMemory ?? 8) <= 2) return 0;
  return matchMedia("(pointer: coarse)").matches || /Instagram/i.test(n.userAgent) ? 1 : 2;
};
const FIG_H = 3.4;
const GOLD = "vec3(0.651, 0.545, 0.366)";

const vert = /* glsl */ `
  uniform sampler2D uRelief; varying vec2 vUv;
  void main() { vUv = uv; vec3 p = position; p.z += 0.03 + texture2D(uRelief, uv).r * 0.42;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const frag = /* glsl */ `
  uniform sampler2D uMap; uniform sampler2D uRelief; uniform vec2 uMapTexel; uniform vec2 uReliefTexel;
  uniform vec2 uLight; uniform float uReveal; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    float a = smoothstep(0.08, 0.45, c.a) * smoothstep(0.0, 0.16, vUv.y) * uReveal;
    if (a < 0.02) discard;
    vec3 col = c.rgb; vec3 gold = ${GOLD};
  #ifndef LOW
    float dl = texture2D(uRelief, vUv - vec2(uReliefTexel.x * 2.0, 0.0)).r;
    float dr = texture2D(uRelief, vUv + vec2(uReliefTexel.x * 2.0, 0.0)).r;
    float dd = texture2D(uRelief, vUv - vec2(0.0, uReliefTexel.y * 2.0)).r;
    float du = texture2D(uRelief, vUv + vec2(0.0, uReliefTexel.y * 2.0)).r;
    vec3 n = normalize(vec3((dl - dr) * 7.0, (dd - du) * 7.0, 1.0));
    float shade = 0.84 + 0.28 * max(dot(n, normalize(vec3(uLight, 0.9))), 0.0);
    float e = texture2D(uMap, vUv + vec2(uMapTexel.x * 6.0, 0.0)).a + texture2D(uMap, vUv - vec2(uMapTexel.x * 6.0, 0.0)).a
            + texture2D(uMap, vUv + vec2(0.0, uMapTexel.y * 6.0)).a + texture2D(uMap, vUv - vec2(0.0, uMapTexel.y * 6.0)).a;
    float rim = (1.0 - smoothstep(0.08, 0.45, e * 0.25)) * smoothstep(0.08, 0.45, c.a);
    col = col * shade + gold * rim * 0.7;
  #endif
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const sparkVert = /* glsl */ `
  uniform float uTime, uTravel, uTurb, uScale, uSize; attribute vec4 aMotion; attribute float aWarm;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec3 p = position; p.y = mod(p.y + 2.5 + uTravel * aMotion.x, 5.5) - 2.5;
    float s = uTime * aMotion.y + aMotion.w; p.xz += vec2(sin(s), cos(s)) * aMotion.z * (1.0 + uTurb);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z;
    vAlpha = smoothstep(-2.5, -1.9, p.y) * (1.0 - smoothstep(2.3, 3.0, p.y)) * (0.55 + 0.45 * sin(s * 3.0));
    vColor = mix(vec3(1.0, 0.9, 0.72), vec3(1.0, 0.55, 0.18), aWarm);
  }`;
const sparkFrag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() { float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vColor, a * a * vAlpha * 0.75);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export async function initFigure(stage, canvas, { drag = false, scrollTurn = true, frame = "center" } = {}) {
  let level = pickTier(), tier = TIERS[level], renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.aa, powerPreference: "high-performance" }); }
  catch { return null; }
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x0a0a0a, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const pivot = new THREE.Group(); scene.add(pivot);

  const loader = new THREE.TextureLoader();
  const [bm, fm, br, fr] = await Promise.all(["img/back-cut.webp", "img/front-cut.webp", "img/back-relief.png", "img/front-relief.png"].map((s) => loader.loadAsync(s)));
  for (const t of [bm, fm]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); }
  for (const t of [br, fr]) { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }

  const light = new THREE.Vector2(0.6, 0.7);
  const shared = { uLight: { value: light }, uReveal: { value: 0 } };
  const sides = {};
  function side(map, relief, name, turned) {
    const aspect = map.image.width / map.image.height;
    const w = FIG_H * aspect;
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uMap: { value: map }, uRelief: { value: relief },
        uMapTexel: { value: new THREE.Vector2(1 / map.image.width, 1 / map.image.height) },
        uReliefTexel: { value: new THREE.Vector2(1 / relief.image.width, 1 / relief.image.height) } },
      defines: tier.low ? { LOW: "" } : {}, vertexShader: vert, fragmentShader: frag, transparent: true,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, FIG_H, ...tier.seg), mat);
    if (turned) mesh.rotation.y = Math.PI;
    pivot.add(mesh);
    sides[name] = { mesh, w, relief: relief.image };
  }
  side(bm, br, "back", false);
  side(fm, fr, "front", true);

  // GPU sparks
  const sparkU = { uTime: { value: 0 }, uTravel: { value: 0 }, uTurb: { value: 0 }, uScale: { value: 1 }, uSize: { value: 0.035 } };
  const N = TIERS[2].sparks, pos = new Float32Array(N * 3), mot = new Float32Array(N * 4), warm = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - 0.5) * 6.4, Math.random() * 5.5 - 2.5, (Math.random() - 0.5) * 5 - 0.5], i * 3);
    mot.set([0.15 + Math.random() * 0.3, 0.5 + Math.random() * 1.5, 0.05 + Math.random() * 0.15, Math.random() * 6.28], i * 4);
    warm[i] = Math.random() < 0.7 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.2;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sg.setAttribute("aMotion", new THREE.BufferAttribute(mot, 4));
  sg.setAttribute("aWarm", new THREE.BufferAttribute(warm, 1));
  sg.setDrawRange(0, tier.sparks);
  const sparks = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: sparkU, vertexShader: sparkVert, fragmentShader: sparkFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);

  // layout (read on resize only)
  const buf = new THREE.Vector2(), view = { d: 7, ty: 0, w: 1, h: 1, phone: false };
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    view.w = w; view.h = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.dpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(buf); sparkU.uScale.value = buf.y * 0.5;
    view.phone = w < 760;
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const V = view.phone ? Math.max(FIG_H / 0.66, 2.7 / camera.aspect) : FIG_H / 0.82;
    view.d = V / k;
    view.ty = view.phone ? 0.12 * V : 0.06 * V;
  }
  new ResizeObserver(resize).observe(stage); resize();

  // input
  let mx = 0, my = 0, tx = 0, ty = 0, spin = 0, spinTarget = 0, dragging = false, lastX = 0, face = 0, faceTarget = 0;
  addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  const dragEl = drag ? canvas : stage;
  dragEl.addEventListener("pointerdown", (e) => { if (e.target.closest("a, button")) return; dragging = true; lastX = e.clientX; });
  addEventListener("pointermove", (e) => { if (!dragging) return; spinTarget += (e.clientX - lastX) * (drag ? 0.012 : 0.008); if (!drag) spinTarget = clamp(spinTarget, -1.2, 1.2); lastX = e.clientX; }, { passive: true });
  const up = () => { dragging = false; };
  addEventListener("pointerup", up); addEventListener("pointercancel", up);

  let progress = 0, eased = 0, reveal = 0, travel = 0, time = 0, visible = true, zoom = 0, zoomTarget = 0;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: "120px" }).observe(stage);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stage.classList.remove("has-webgl"); visible = false; });
  if (drag) canvas.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoomTarget = clamp(zoomTarget - e.deltaY * 0.004, 0, 1); }, { passive: false });

  let slow = 0, frames = 0, warmup = 60;
  const tmp = new THREE.Vector3();
  const listeners = new Set();

  function tick(_t, deltaMs) {
    if (!visible || document.hidden) return;
    const dt = Math.min(deltaMs / 1000, 0.05), still = reduceMQ.matches;
    time += still ? 0 : dt;
    if (warmup-- <= 0) { frames++; if (dt > 0.025) slow++; if (frames === 90) { if (slow > 18 && level > 0) { level--; tier = { ...tier, dpr: TIERS[level].dpr }; sg.setDrawRange(0, TIERS[level].sparks); resize(); } slow = frames = 0; } }

    eased = damp(eased, progress, still ? 20 : 5, dt);
    mx = damp(mx, tx, 3, dt); my = damp(my, ty, 3, dt);
    if (!dragging && !drag) spinTarget = damp(spinTarget, 0, 1.5, dt);
    spin = damp(spin, spinTarget, 8, dt);
    face = damp(face, faceTarget, 6, dt);
    zoom = damp(zoom, zoomTarget, 6, dt);
    reveal = Math.min(1, reveal + dt * 0.9);

    const turn = scrollTurn ? smoothstep(eased, 0.1, 0.85) * Math.PI : 0;
    const yaw = turn + face + spin + mx * 0.25;
    pivot.rotation.y = yaw;
    pivot.rotation.x = my * 0.06;
    pivot.position.y = still ? 0 : Math.sin(time * 0.9) * 0.04;
    const c = Math.cos(yaw);
    sides.back.mesh.visible = c > -0.25;
    sides.front.mesh.visible = c < 0.25;
    shared.uReveal.value = reveal;
    light.set(0.6 - mx * 0.5, 0.7 + my * 0.3);

    const d = view.d * (1 - 0.1 * eased) * (1 - 0.45 * zoom);
    camera.position.set(Math.sin(mx * 0.12) * d * 0.15, view.ty + 0.2 + eased * 0.25 + zoom * 0.6, d);
    camera.lookAt(0, view.ty + zoom * 0.6, 0);

    const v = Math.abs(progress - eased);
    travel += still ? 0 : dt * (1 + v * 9);
    sparkU.uTravel.value = travel; sparkU.uTurb.value = v * 3.2; sparkU.uTime.value = time;
    renderer.render(scene, camera);
    listeners.forEach((f) => f(yaw));
  }

  await renderer.compileAsync(scene, camera);
  stage.classList.add("has-webgl");
  gsap.ticker.add(tick);

  return {
    setProgress(p) { progress = p; },
    setFace(name) { // turn the short way to the chosen side
      const goal = name === "front" ? Math.PI : 0;
      const current = face + spinTarget;
      const k = Math.round((current - goal) / (Math.PI * 2));
      faceTarget = goal + k * Math.PI * 2 - spinTarget;
    },
    zoomBy(v) { zoomTarget = clamp(zoomTarget + v, 0, 1); },
    onFrame(f) { listeners.add(f); },
    // screen position of a point on a side, u/v in 0..1 of that photo (v from the top)
    project(sideName, u, v) {
      const s = sides[sideName];
      const relief = 0.03 + 0.42 * 0.9;
      tmp.set((u - 0.5) * s.w, (0.5 - v) * FIG_H, relief);
      s.mesh.localToWorld(tmp);
      tmp.project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * view.w, y: (-tmp.y * 0.5 + 0.5) * view.h, facing: sideName === "back" ? Math.cos(pivot.rotation.y) > 0.35 : Math.cos(pivot.rotation.y) < -0.35 };
    },
  };
}
