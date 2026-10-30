// All sound is synthesized with Web Audio: no files. Off until the visitor turns it on.
let ctx = null, master = null, drone = null, on = true;
try { on = localStorage.getItem("emk-sound") !== "0"; } catch {}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  return ctx;
}
export const soundOn = () => on;

export function setSound(v) {
  on = v;
  try { localStorage.setItem("emk-sound", v ? "1" : "0"); } catch {}
  if (v) { ensure()?.resume(); startDrone(); } else stopDrone();
  document.querySelectorAll("[data-sound]").forEach((b) => b.setAttribute("aria-pressed", String(v)));
}

function startDrone() {
  if (!ensure() || drone) return;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass"; filter.frequency.value = 420; filter.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0;
  const oscs = [55, 82.4, 110.2].map((f, i) => {
    const o = ctx.createOscillator(); o.type = i ? "sine" : "triangle"; o.frequency.value = f; o.detune.value = (i - 1) * 6;
    o.connect(filter); o.start(); return o;
  });
  filter.connect(g); g.connect(master);
  g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2);
  drone = { oscs, g, filter };
}
function stopDrone() {
  if (!drone) return;
  const d = drone; drone = null;
  d.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => d.oscs.forEach((o) => o.stop()), 700);
}
// calm 0..1 opens the drone's filter: hiss turns into a warm tone
export function setCalm(c) {
  if (!drone) return;
  drone.filter.frequency.setTargetAtTime(300 + c * 1400, ctx.currentTime, 0.2);
}

function blip(freq, dur, type = "sine", gain = 0.12, when = 0) {
  if (!on || !ensure()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export const tick = () => blip(2400, 0.03, "square", 0.025);
export const click = () => blip(520, 0.07, "triangle", 0.08);
// one note per word; together they make a chord (A, C#, E)
const NOTES = [440, 554.37, 659.25];
export const chime = (i = 0) => { blip(NOTES[i % 3], 1.8, "sine", 0.12); blip(NOTES[i % 3] * 2, 1.2, "sine", 0.03); };
export const chord = () => NOTES.forEach((n, i) => blip(n, 2.6, "sine", 0.08, i * 0.06));
export function friction() {
  if (!on || !ensure()) return;
  const len = ctx.sampleRate * 0.25, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.4;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = "bandpass"; f.frequency.value = 900; g.gain.value = 0.25;
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start();
}
export const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
