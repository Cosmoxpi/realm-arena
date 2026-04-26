// Sound effects using Web Audio API (no external files needed)
let ctx: AudioContext | null = null;
let muted = localStorage.getItem("playhub:muted") === "1";

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* noop */ }
  }
  return ctx;
}

function tone(frequency: number, duration: number, type: OscillatorType = "sine", gain = 0.15) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export const sfx = {
  click: () => tone(880, 0.05, "triangle", 0.08),
  dice: () => {
    tone(180, 0.08, "square", 0.1);
    setTimeout(() => tone(220, 0.06, "square", 0.08), 60);
    setTimeout(() => tone(280, 0.05, "square", 0.07), 120);
  },
  move: () => tone(520, 0.08, "sine", 0.1),
  capture: () => {
    tone(440, 0.08, "sawtooth", 0.12);
    setTimeout(() => tone(220, 0.15, "sawtooth", 0.1), 80);
  },
  hit: () => {
    tone(160, 0.05, "square", 0.15);
    setTimeout(() => tone(80, 0.1, "square", 0.1), 40);
  },
  six: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.12, "triangle", 0.12), i * 60));
  },
  four: () => {
    [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.1, "triangle", 0.1), i * 50));
  },
  wicket: () => {
    tone(180, 0.2, "sawtooth", 0.18);
    setTimeout(() => tone(120, 0.3, "sawtooth", 0.14), 100);
  },
  win: () => {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.15, "triangle", 0.13), i * 80));
  },
  lose: () => {
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, "sine", 0.12), i * 120));
  },
  toggleMute() {
    muted = !muted;
    localStorage.setItem("playhub:muted", muted ? "1" : "0");
    return muted;
  },
  isMuted() { return muted; },
};
