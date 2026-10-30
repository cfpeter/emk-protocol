// Series 001: the real EMK SYSTEM box, opened in 3D.
// Matches the unboxing reel: a matte black two-piece rigid box, gold foil "EMK SYSTEM™ /
// COLLECTION / LOS ANGELES" on the lid, "MADE WITH INTENTION / PEACE · UNITY · CULTURE" under
// it, black tissue with a card, a round seal and a PEACE sticker on top, the folded tee below.
// One progress value (drag, wheel, keyboard or the button) drives the whole sequence.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { gsap } from "gsap";
import * as sound from "./sound.js";

const { smoothstep, damp, clamp, lerp } = THREE.MathUtils;
const GOLD = "#cdb17a";
const W = 3.0, D = 2.1, H = 0.62, T = 0.05; // base box (outer), wall thickness
const LH = 0.5, LG = 0.035;                  // lid wall height, lid gap

// ---------- printed surfaces, drawn once ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// lid top: matte black with gold foil text; a second map marks the foil as metal
function lidTop() {
  const paint = (ctx, w, h, foil) => {
    ctx.fillStyle = foil ? "#000" : "#0d0d0d"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = foil ? "#fff" : GOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.letterSpacing = "6px"; ctx.font = "600 104px Archivo"; ctx.fillText("EMK SYSTEM™", w / 2, h * 0.44);
    ctx.letterSpacing = "10px"; ctx.font = "500 50px Archivo"; ctx.fillText("COLLECTION", w / 2, h * 0.545);
    ctx.letterSpacing = "8px"; ctx.font = "500 32px Archivo"; ctx.fillText("LOS ANGELES", w / 2, h * 0.615);
  };
  const map = canvasTex(2048, 1434, (c, w, h) => paint(c, w, h, false));
  const foil = canvasTex(2048, 1434, (c, w, h) => paint(c, w, h, true), false);
  return { map, foil };
}
function lidUnder() {
  const paint = (ctx, w, h, foil) => {
    ctx.fillStyle = foil ? "#000" : "#141414"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = foil ? "#fff" : GOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "500 92px Archivo"; ctx.fillText("MADE WITH INTENTION", w / 2, h * 0.44);
    ctx.font = "500 92px Archivo"; ctx.fillText("PEACE · UNITY · CULTURE", w / 2, h * 0.58);
  };
  return { map: canvasTex(2048, 1434, (c, w, h) => paint(c, w, h, false)), foil: canvasTex(2048, 1434, (c, w, h) => paint(c, w, h, true), false) };
}
function card() {
  return canvasTex(600, 840, (c, w, h) => {
    c.fillStyle = "#101010"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#e8e0cc"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "600 64px Archivo"; c.fillText("EMK SYSTEM™", w / 2, h * 0.3);
    c.fillStyle = "#a9a294"; c.fillRect(w * 0.42, h * 0.37, w * 0.16, 2);
    c.fillStyle = "#e8e0cc"; c.font = "500 34px Archivo"; c.fillText("P E A C E", w / 2, h * 0.45);
    c.font = "700 54px 'Noto Naskh Arabic'"; c.direction = "rtl"; c.fillText("سلام", w / 2, h * 0.56); c.direction = "ltr";
    c.font = "700 34px 'Noto Serif Armenian'"; c.fillText("Խաղաղություն", w / 2, h * 0.66);
  });
}
function seal() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = "#0c0c0c"; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#2a2a2a"; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "#e8e0cc"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "600 70px Archivo"; c.fillText("EMK SYSTEM™", w / 2, h / 2);
  });
}
function sticker() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = "#0b0b0b"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#e8e0cc"; c.lineWidth = 12; c.strokeRect(70, 90, w - 140, h - 170);
    c.fillStyle = "#e8e0cc"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "700 92px Archivo"; c.fillText("PEACE", w / 2, 175);
    c.font = "700 120px 'Noto Naskh Arabic'"; c.direction = "rtl"; c.fillText("سلام", w / 2, 290); c.direction = "ltr";
    c.font = "700 40px 'Noto Serif Armenian'"; c.fillText("Խաղաղություն", w / 2, 380);
    c.font = "600 24px Archivo"; c.fillText("EMK SYSTEM™ · PEACE PROTOCOL", w / 2, 50);
  });
}
// black tissue with a faint repeated wordmark, like the reel
function tissue() {
  return canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = "#1b1b1b"; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h / 2); c.rotate(-0.5);
    c.fillStyle = "rgba(255,255,255,.028)"; c.font = "600 34px Archivo"; c.textAlign = "center";
    for (let y = -900; y < 900; y += 110) for (let x = -900; x < 900; x += 360) c.fillText("EMK SYSTEM", x + ((y / 110) % 2) * 180, y);
    c.restore();
  });
}
function shadowTex() {
  return canvasTex(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 20, 128, 128, 128);
    g.addColorStop(0, "rgba(0,0,0,.85)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  }, false);
}

// crumpled sheet: a subdivided plane with soft random folds
function crumple(w, d, seed) {
  const g = new THREE.PlaneGeometry(w, d, 40, 30);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const f = Math.sin(x * 5.1 + seed) * Math.cos(z * 4.3 - seed) * 0.022 + Math.sin(x * 13 + z * 9 + seed * 2) * 0.008;
    p.setY(i, f + 0.02 * (1 - Math.abs(x) / (w / 2)));
  }
  g.computeVertexNormals();
  return g;
}

export async function initUnbox(stage) {
  const canvas = stage.querySelector("canvas");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); } catch { return null; }
  const phone = () => stage.clientWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x0a0a0a, 1);

  await Promise.all([
    document.fonts.load("600 64px Archivo"), document.fonts.load("700 54px 'Noto Naskh Arabic'", "سلام"),
    document.fonts.load("700 34px 'Noto Serif Armenian'", "Խաղաղություն"),
  ]).catch(() => {});

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const key = new THREE.DirectionalLight(0xfff1dc, 2.2); key.position.set(-4, 6, 2); scene.add(key);
  const side = new THREE.DirectionalLight(0xfff1dc, 1.1); side.position.set(-5, 1.2, 4); scene.add(side);
  const rim = new THREE.DirectionalLight(0xcfd8ff, 0.8); rim.position.set(4, 3, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));

  const black = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.82, metalness: 0 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 0.95 });

  // ---------- base tray ----------
  const set = new THREE.Group(); set.rotation.y = -0.22; scene.add(set);
  const base = new THREE.Group(); set.add(base);
  const slab = (w, h, d, x, y, z, m = black) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); s.position.set(x, y, z); base.add(s); return s; };
  slab(W, T, D, 0, T / 2, 0);
  slab(W, H, T, 0, H / 2, D / 2 - T / 2); slab(W, H, T, 0, H / 2, -D / 2 + T / 2);
  slab(T, H, D - 2 * T, W / 2 - T / 2, H / 2, 0); slab(T, H, D - 2 * T, -W / 2 + T / 2, H / 2, 0);
  slab(W - 2 * T, 0.01, D - 2 * T, 0, T + 0.005, 0, inner);

  // the folded tee, back print up
  const loader = new THREE.TextureLoader();
  const printTex = await loader.loadAsync("img/print-art.webp");
  printTex.colorSpace = THREE.SRGBColorSpace;
  const fabric = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  const tee = new THREE.Group();
  const fold = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.2, 1.55, 4, 0.08), fabric);
  tee.add(fold);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.22), new THREE.MeshStandardMaterial({ map: printTex, roughness: 0.9 }));
  print.rotation.x = -Math.PI / 2; print.position.y = 0.101; tee.add(print);
  tee.position.set(0, T + 0.12, 0.02); base.add(tee);

  // tissue: two flaps hinged at the long walls
  const tissueMat = new THREE.MeshStandardMaterial({ map: tissue(), roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.97 });
  const flapW = (W - 2 * T) / 2 + 0.12, flapD = D - 2 * T;
  const flap = (side, seed) => {
    const hinge = new THREE.Group(); hinge.position.set(side * (W / 2 - T), H - 0.06, 0);
    const m = new THREE.Mesh(crumple(flapW, flapD, seed), tissueMat); m.position.x = -side * flapW / 2; hinge.add(m);
    base.add(hinge); return hinge;
  };
  const flapL = flap(-1, 1.3), flapR = flap(1, 4.1);
  flapR.position.y += 0.012; // right flap overlaps the left, like hand-folded tissue

  // card, seal and sticker resting on the tissue
  const thin = (w, d, tex, h = 0.012) => {
    const mats = [black, black, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), black, black, black];
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  };
  const cardM = thin(0.72, 1.0, card(), 0.015); cardM.position.set(-0.78, H - 0.02, -0.1); cardM.rotation.y = 0.06; base.add(cardM);
  const sealM = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.006, 48), [black, new THREE.MeshStandardMaterial({ map: seal(), roughness: 0.5 }), black]);
  sealM.position.set(-0.05, H - 0.022, 0.22); base.add(sealM);
  const stickerM = thin(0.62, 0.62, sticker(), 0.004); stickerM.position.set(0.82, H - 0.02, 0.1); stickerM.rotation.y = -0.08; base.add(stickerM);

  // ---------- lid ----------
  const lid = new THREE.Group(); set.add(lid);
  const LW = W + 2 * LG + 2 * T, LD = D + 2 * LG + 2 * T;
  const top = lidTop(), under = lidUnder();
  const topMat = new THREE.MeshStandardMaterial({ map: top.map, roughness: 0.78, metalness: 0, metalnessMap: top.foil });
  topMat.onBeforeCompile = (s) => { // foil: metal and glossy where the print is
    s.fragmentShader = s.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(0.78, 0.28, texture2D(metalnessMap, vMetalnessMapUv).g);");
  };
  topMat.metalness = 1;
  const underMat = new THREE.MeshStandardMaterial({ map: under.map, roughness: 0.85, metalness: 1, metalnessMap: under.foil });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(LW, T, LD), [black, black, topMat, underMat, black, black]);
  plate.position.y = LH - T / 2; lid.add(plate);
  const lslab = (w, h, d, x, z) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), black); s.position.set(x, h / 2, z); lid.add(s); };
  lslab(LW, LH, T, 0, LD / 2 - T / 2); lslab(LW, LH, T, 0, -LD / 2 + T / 2);
  lslab(T, LH, LD - 2 * T, LW / 2 - T / 2, 0); lslab(T, LH, LD - 2 * T, -LW / 2 + T / 2, 0);
  const LID_REST = H + 0.012 - LH; // lid sits over the top of the base

  // soft contact shadows (cheap on every device)
  const shTex = shadowTex();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.7, D * 1.8), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001; set.add(shadow);
  const lidShadow = shadow.clone(); lidShadow.material = shadow.material.clone(); set.add(lidShadow);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // ---------- camera ----------
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const look = new THREE.Vector3(0, 0.35, 0);
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  // ---------- the sequence ----------
  let target = 0, p = 0, mx = 0, my = 0, tx = 0, ty = 0;
  const beats = { lift: false, off: false, tissue: false, tee: false };
  function beat(name, fn) { if (!beats[name]) { beats[name] = true; fn(); } }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pose(dt) {
    p = reduce ? target : damp(p, target, 4.5, dt);
    // 1. lid: slides up slowly (air resistance), then leans against the back, inside print facing you
    const lift = smoothstep(p, 0.02, 0.24), tip = smoothstep(p, 0.22, 0.44);
    const arc = Math.sin(tip * Math.PI) * 0.5;
    lid.position.set(0, LID_REST + lift * 0.62 * (1 - tip) + tip * (LD / 2 - 0.05) + arc, -tip * (D / 2 + 0.35));
    lid.rotation.x = -tip * 1.32;
    lidShadow.position.set(0, 0.002, -tip * (D / 2 + 0.5));
    lidShadow.material.opacity = 0.45 * (1 - lift) + tip * 0.55;
    // 2. card, seal and sticker are set down on the table beside the box
    const it = (a, b) => smoothstep(p, a, b);
    const place = (m, from, to, k, rotTo) => {
      const hop = Math.sin(k * Math.PI) * 0.45;
      m.position.set(lerp(from[0], to[0], k), lerp(from[1], to[1], k) + hop, lerp(from[2], to[2], k));
      m.rotation.y = lerp(from[3], rotTo, k);
    };
    place(cardM, [-0.78, H - 0.02, -0.1, 0.06], [-W / 2 - 0.75, 0.01, 0.35], it(0.44, 0.56), 0.32);
    place(stickerM, [0.82, H - 0.02, 0.1, -0.08], [W / 2 + 0.6, 0.004, 0.55], it(0.48, 0.6), -0.4);
    place(sealM, [-0.05, H - 0.022, 0.22, 0], [W / 2 + 0.45, 0.004, -0.35], it(0.52, 0.62), 0);
    // 3. tissue folds open over the walls
    const open = smoothstep(p, 0.62, 0.8);
    flapL.rotation.z = open * 2.25; flapR.rotation.z = -open * 2.25;
    // 4. the tee lifts a little, print up
    const rise = smoothstep(p, 0.8, 1);
    tee.position.set(0, T + 0.12 + rise * 0.32, 0.02 + rise * 0.12); tee.rotation.x = -rise * 0.28;
    // camera eases closer as the box opens
    const r = (phone() ? 11 : 8.4) - p * (phone() ? 1.4 : 1.6);
    camera.position.set(Math.sin(mx * 0.15) * r * 0.25 + r * 0.08, r * 0.62 + my * 0.2, r * 0.78);
    look.set(0, 0.25 + p * 0.15, -0.15);
    camera.lookAt(look);
    // sound beats
    if (lift > 0.05) beat("lift", () => sound.friction());
    if (tip > 0.6) beat("off", () => sound.click());
    if (open > 0.2) beat("tissue", () => sound.friction());
    if (rise > 0.6) beat("tee", () => { sound.chord(); stage.dispatchEvent(new CustomEvent("unboxed")); });
  }

  // drag up (or wheel/keys) to open; release keeps it where it is, past 90% it finishes
  let y0 = null, startT = 0;
  canvas.addEventListener("pointerdown", (e) => { y0 = e.clientY; startT = target; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1;
    if (y0 == null) return;
    target = clamp(startT + (y0 - e.clientY) / (stage.clientHeight * 0.75), 0, 1);
  });
  const release = () => { if (y0 == null) return; y0 = null; if (target > 0.9) target = 1; };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); target = clamp(target + 0.1, 0, 1); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); target = clamp(target - 0.1, 0, 1); }
  });

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: "100px" }).observe(stage);
  await renderer.compileAsync(scene, camera);
  stage.classList.add("has-webgl");
  gsap.ticker.add((_t, dms) => {
    if (!visible || document.hidden) return;
    const dt = Math.min(dms / 1000, 0.05);
    mx = damp(mx, tx, 3, dt); my = damp(my, ty, 3, dt);
    pose(dt);
    renderer.render(scene, camera);
  });

  return {
    openAll() { gsap.to({ v: target }, { v: 1, duration: reduce ? 0 : 3.4, ease: "power1.inOut", onUpdate() { target = this.targets()[0].v; } }); },
    close() { target = 0; Object.keys(beats).forEach((k) => (beats[k] = false)); },
    get progress() { return p; },
  };
}
