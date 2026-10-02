// Pachelbel — Canon in D (public domain), a short romantic piano arrangement.
// Each event: { b: start beat, d: duration in beats, m: MIDI note, v: velocity 0..1 }
// One cycle = 8 chords × 2 beats over the famous ground bass.

const ROOTS = [50, 45, 47, 42, 43, 38, 43, 45]; // D3 A2 B2 F#2 G2 D2 G2 A2
const MINOR = [false, false, true, true, false, false, false, false];

function chordArp(events, start, i, vel, low) {
  const r = ROOTS[i], third = MINOR[i] ? 15 : 16;
  const notes = [r, r + 7, r + 12, r + third];
  notes.forEach((m, k) => {
    // pedal: every note rings to the end of the chord
    events.push({ b: start + k * 0.5, d: 2.15 - k * 0.5, m, v: vel * (k === 0 ? 1.15 : 0.9) });
  });
  if (low) events.push({ b: start, d: 2.15, m: r - 12, v: vel * 0.75 });
}

function melody(events, start, notes, step, vel, below) {
  notes.forEach((m, k) => {
    if (m == null) return;
    const b = start + k * step;
    const chordEnd = Math.floor(b / 2) * 2 + 2;
    const d = Math.min(2.2, Math.max(step, chordEnd - b) + 0.1);
    // a gentle swell inside each phrase
    const shape = 0.92 + 0.08 * Math.sin((k / notes.length) * Math.PI);
    events.push({ b, d, m, v: vel * shape });
    if (below) events.push({ b: b + 0.02, d, m: m - below[k], v: vel * shape * 0.7 });
  });
}

export function score() {
  const ev = [];
  let c = 0; // current cycle start (beats)
  const cycle = (fn) => { fn(c); c += 16; };

  // 1 — intro: left hand alone, soft
  cycle((s) => { for (let i = 0; i < 8; i++) chordArp(ev, s + i * 2, i, 0.3, i === 0); });
  // 2 — the famous half-note theme
  cycle((s) => {
    for (let i = 0; i < 8; i++) chordArp(ev, s + i * 2, i, 0.32, false);
    melody(ev, s, [78, 76, 74, 73, 71, 69, 71, 73], 2, 0.62);
  });
  // 3 — second voice
  cycle((s) => {
    for (let i = 0; i < 8; i++) chordArp(ev, s + i * 2, i, 0.33, false);
    melody(ev, s, [74, 73, 71, 69, 67, 66, 67, 64], 2, 0.62);
  });
  // 4–5 — quarter-note variation
  const q = [74, 78, 81, 79, 78, 74, 78, 76, 74, 71, 74, 81, 79, 83, 81, 79,
    78, 74, 76, 73, 74, 78, 81, 69, 71, 67, 69, 66, 62, 74, 74, 73];
  cycle((s) => {
    for (let i = 0; i < 8; i++) chordArp(ev, s + i * 2, i, 0.35, i === 0);
    melody(ev, s, q.slice(0, 16), 1, 0.66);
  });
  cycle((s) => {
    for (let i = 0; i < 8; i++) chordArp(ev, s + i * 2, i, 0.37, false);
    melody(ev, s, q.slice(16), 1, 0.68);
  });
  // 6 — flowing eighths, rising and falling over each chord
  cycle((s) => {
    for (let i = 0; i < 8; i++) chordArp(ev, s + i * 2, i, 0.36, i === 0);
    melody(ev, s, [
      74, 78, 81, 78, 76, 81, 85, 81, 78, 83, 86, 83, 73, 78, 81, 78,
      71, 74, 79, 74, 69, 74, 78, 74, 71, 74, 79, 83, 81, 79, 78, 76
    ], 0.5, 0.6);
  });
  // 7 — the theme returns in warm thirds, then a slow ending
  cycle((s) => {
    for (let i = 0; i < 8; i++) chordArp(ev, s + i * 2, i, 0.33, i === 0 || i === 4);
    melody(ev, s, [78, 76, 74, 73, 71, 69, 71, 73], 2, 0.6, [4, 3, 3, 4, 4, 3, 4, 4]);
  });
  // final D major chord, rolled
  [38, 45, 50, 54, 57, 62, 66, 69, 74].forEach((m, k) => {
    ev.push({ b: c + k * 0.09, d: 7, m, v: k < 4 ? 0.36 : 0.5 });
  });
  return { events: ev, beats: c + 8 };
}

// tempo map: 60 bpm, slowing to ~42 over the last 10 beats
export function beatToSec(b, total) {
  const base = 60 / 60;
  const ritStart = total - 18;
  if (b <= ritStart) return b * base;
  let t = ritStart * base;
  const steps = Math.ceil((b - ritStart) / 0.05);
  const h = (b - ritStart) / steps;
  for (let i = 0; i < steps; i++) {
    const x = (ritStart + (i + 0.5) * h - ritStart) / 18;
    t += h * base * (1 + 0.45 * x * x);
  }
  return t;
}
