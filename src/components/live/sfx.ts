"use client";

/**
 * Tiny synthesized sound kit (no audio files to load). Browsers only allow
 * audio after a user gesture, so the context is created lazily on the first
 * tap anywhere in the room.
 */
let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = typeof window !== "undefined" && window.localStorage.getItem("room-muted") === "1";
} catch {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem("room-muted", value ? "1" : "0");
  } catch {
    // private mode - fine, just not remembered
  }
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18, endFreq?: number) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.3) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t0);
}

function play(fn: () => void) {
  if (muted || !ctx) return;
  try {
    fn();
  } catch {
    // audio is a nicety; never let it break the room
  }
}

export const sfx = {
  bid: () => play(() => { tone(660, 0, 0.09, "triangle"); tone(990, 0.08, 0.14, "triangle"); }),
  myBid: () => play(() => { tone(523, 0, 0.08, "square", 0.08); tone(784, 0.07, 0.08, "square", 0.08); tone(1046, 0.14, 0.2, "triangle", 0.16); }),
  outbid: () => play(() => { tone(440, 0, 0.18, "sawtooth", 0.1, 220); tone(330, 0.16, 0.25, "sawtooth", 0.08, 160); }),
  tick: () => play(() => tone(1400, 0, 0.04, "square", 0.05)),
  count: () => play(() => tone(880, 0, 0.16, "triangle", 0.14)),
  go: () => play(() => { tone(1320, 0, 0.3, "triangle", 0.18); tone(1760, 0.02, 0.3, "sine", 0.08); }),
  sold: () => play(() => { noise(0, 0.25, 0.5); tone(110, 0, 0.35, "sine", 0.35, 60); tone(784, 0.3, 0.2, "triangle", 0.12); tone(1046, 0.42, 0.35, "triangle", 0.12); }),
  win: () => play(() => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.09, 0.3, "triangle", 0.14)); }),
  pop: () => play(() => tone(1200, 0, 0.05, "sine", 0.06, 1800)),
};

export function buzz(pattern: number | number[]) {
  try {
    if (!muted) navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}
