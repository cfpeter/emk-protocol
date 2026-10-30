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

// Browsers only start audio after a real gesture (tap, click, key), and every new page starts locked.
// Keep trying on every kind of gesture until the context runs, and again whenever it gets paused
// (tab switch, phone lock, iOS "interrupted"). Hover is not a gesture, so it cannot unlock sound.
const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
const running = () => ctx?.state === "running";
let starting = false; // a gesture asked to start: the sound that gesture triggers may play
function unlock() {
  if (!on || !ensure() || running() || starting) return;
  starting = true;
  ctx.resume().catch(() => {}).finally(() => { starting = false; });
}
// outside a gesture: ask the browser to start audio; it says yes when this site already has the visitor's trust
let asked = false;
function unlockQuiet() {
  if (asked || running()) return;
  asked = true; // a blocked resume never settles until a gesture, so this flag never lets sounds queue
  ctx.resume().catch(() => {});
}
const listen = () => GESTURES.forEach((e) => addEventListener(e, unlock, { capture: true, passive: true }));
listen();
document.addEventListener("visibilitychange", () => { if (!document.hidden && ctx && !running()) ctx.resume().catch(() => {}); });
addEventListener("pageshow", () => { if (ctx && !running()) ctx.resume().catch(() => {}); });

export function setSound(v) {
  on = v;
  try { localStorage.setItem("emk-sound", v ? "1" : "0"); } catch {}
  if (v) { unlock(); startDrone(); } else stopDrone();
  document.querySelectorAll("[data-sound]").forEach((b) => b.setAttribute("aria-pressed", String(v)));
}

function startDrone() {
  return; // no background drone: the owner heard it as a vacuum hum. Only short UI sounds play.
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
  // while audio is still locked, skip the sound: queued sounds would all fire at once on the first tap
  if (!on || !ensure()) return;
  // still locked: ask once (browsers allow it on a refresh or return visit after earlier clicks), skip this sound
  if (!running() && !starting) { unlockQuiet(); return; }
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export const tick = () => blip(2400, 0.03, "square", 0.025);
export const click = () => { blip(1400, 0.025, "square", 0.022); blip(2100, 0.02, "square", 0.016, 0.03); }; // a short system click, same family as the tick
// one note per word; together they make a chord (A, C#, E)
const NOTES = [440, 554.37, 659.25];
export const chime = (i = 0) => { blip(NOTES[i % 3], 1.8, "sine", 0.12); blip(NOTES[i % 3] * 2, 1.2, "sine", 0.03); };
export const chord = () => NOTES.forEach((n, i) => blip(n, 2.6, "sine", 0.08, i * 0.06));
// system sounds: built from the same short square pulse as the typing tick
const pulse = (freq, when = 0, dur = 0.035, gain = 0.03) => blip(freq, dur, "square", gain, when);
// Begin: a two-step acknowledge, like a terminal accepting a command
export const ack = () => { pulse(1600, 0); pulse(2400, 0.07); };
// a mechanism moving: a quick run of ticks that speeds up and climbs
export const servo = (up = true) => {
  const steps = [0, 0.05, 0.09, 0.12, 0.145, 0.165];
  steps.forEach((t, i) => pulse(up ? 1800 + i * 160 : 2600 - i * 160, t, 0.02, 0.022));
};
// a latch releasing: high then low
export const latch = () => { pulse(3200, 0, 0.02, 0.025); pulse(2000, 0.035, 0.03, 0.025); };
// access granted: a three-step readout with a longer last pulse
export const granted = () => { pulse(1200, 0); pulse(1600, 0.09); pulse(2400, 0.18, 0.14, 0.03); };
export const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
