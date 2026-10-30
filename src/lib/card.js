// The Protocol Card: a 1080x1920 story image drawn from the visitor's protocol state
import { getState, ensureId, wordCount, onChange, toast } from "./state.js";

// draws into a canvas, keeps it current, and wires a save/share button
export function mountCard(cv, saveBtn) {
  if (!cv) return;
  const draw = () => drawCard(cv);
  document.fonts.ready.then(draw);
  onChange(draw);
  saveBtn?.addEventListener("click", async () => {
    ensureId(); draw();
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    const file = new File([blob], `${getState().id}-emk-protocol.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "EMK SYSTEM · Peace Protocol" }); return; } catch {} }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    toast("Card saved. Post it and tag @emk_system.");
  });
  return draw;
}

function drawCard(cv) {
  const s = getState();
  const W = 1080, H = 1920, c = cv.getContext("2d");
  cv.width = W; cv.height = H;
  c.fillStyle = "#0a0a0a"; c.fillRect(0, 0, W, H);
  const cream = "#e8e0cc", gold = "#d4c3a3", dim = "#3a3732";
  c.strokeStyle = cream; c.lineWidth = 10; c.strokeRect(120, 520, W - 240, 820);
  c.fillStyle = cream; c.textAlign = "left";
  c.font = "600 44px Archivo"; c.fillText("EMK SYSTEM™", 120, 300);
  c.font = "500 34px Archivo"; c.fillStyle = "#a9a294"; c.fillText("PEACE PROTOCOL · SERIES-001", 120, 360);
  const words = [["peace", "PEACE", "600 150px Archivo", "ltr"], ["salam", "سلام", "700 170px 'Noto Naskh Arabic'", "rtl"], ["khaghaghutyun", "Խաղաղություն", "700 92px 'Noto Serif Armenian'", "ltr"]];
  c.textAlign = "center";
  words.forEach(([k, t, f, dir], i) => {
    c.font = f; c.direction = dir; c.fillStyle = (s.words || []).includes(k) ? cream : dim;
    c.fillText(t, W / 2, 700 + i * 250); c.direction = "ltr";
  });
  c.textAlign = "left"; c.fillStyle = gold; c.font = "600 120px Archivo"; c.fillText(s.id || "PCE-····", 120, 1560);
  c.fillStyle = cream; c.font = "500 40px Archivo";
  c.fillText(`${wordCount()}/3 words${s.size ? ` · Size ${s.size}` : ""}${s.flags?.barcode ? " · Barcode read" : ""}${s.since ? ` · ${s.since}` : ""}`, 120, 1640);
  c.fillStyle = "#a9a294"; c.font = "500 36px Archivo"; c.fillText("Move with intention. Peace is power.", 120, 1760); c.fillText("@emk_system", 120, 1820);
}
