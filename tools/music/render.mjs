// Renders tools/music/canon.mjs on Salamander Grand Piano samples into assets/music.mp3.
//
//   npm i --no-save playwright @audio-samples/piano-mp3-velocity5 \
//     @audio-samples/piano-mp3-velocity8 @audio-samples/piano-mp3-velocity12 lamejs
//   node tools/music/render.mjs
//
// Samples: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0.
// The whole render (sampler, pedal, reverb, mp3 encoding) runs in headless
// Chromium's OfflineAudioContext — no audio tools needed on the machine.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { score, beatToSec } from './canon.mjs';

const require = createRequire(import.meta.url);
const sampleDir = (layer) => process.env.SAMPLES_ROOT
  ? path.join(process.env.SAMPLES_ROOT, 'v' + layer)
  : path.join(path.dirname(require.resolve('@audio-samples/piano-mp3-velocity' + layer + '/package.json')), 'audio');
const lame = process.env.LAME_JS || require.resolve('lamejs/lame.min.js');

const { events, beats } = score();
const total = beatToSec(beats, beats);
const timed = events.map((e) => {
  const t = beatToSec(e.b, beats) + (Math.random() - 0.5) * 0.018;
  return { t: Math.max(0, t), d: beatToSec(e.b + e.d, beats) - beatToSec(e.b, beats), m: e.m, v: Math.min(1, e.v * (0.94 + Math.random() * 0.12)) };
});

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('http://render.local/**', (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>render</title>' });
  if (url.pathname === '/lame.js') return route.fulfill({ contentType: 'text/javascript', body: readFileSync(lame) });
  const m = url.pathname.match(/^\/s\/(\d+)\/(.+)$/);
  if (m) return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync(path.join(sampleDir(m[1]), decodeURIComponent(m[2]))) });
  return route.fulfill({ status: 404, body: '' });
});
await page.goto('http://render.local/');
await page.addScriptTag({ url: 'http://render.local/lame.js' });

const b64 = await page.evaluate(async ({ timed, total }) => {
  const SR = 44100;
  const LEN = Math.ceil((total + 3) * SR);
  const ctx = new OfflineAudioContext(2, LEN, SR);
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const LAYERS = [5, 8, 12];
  // samples exist for A, C, D# and F# in every octave
  const sampleNotes = [];
  for (let m = 21; m <= 108; m++) if ([0, 3, 6, 9].includes(m % 12)) sampleNotes.push(m);
  const needed = new Set();
  const nearest = (m) => sampleNotes.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
  const layerOf = (v) => (v < 0.4 ? 5 : v < 0.62 ? 8 : 12);
  timed.forEach((e) => needed.add(layerOf(e.v) + ':' + nearest(e.m)));
  const buffers = {};
  await Promise.all([...needed].map(async (key) => {
    const [layer, m] = key.split(':').map(Number);
    const name = NAMES[m % 12] + (Math.floor(m / 12) - 1) + 'v' + layer + '.mp3';
    const res = await fetch('/s/' + layer + '/' + encodeURIComponent(name));
    buffers[key] = await ctx.decodeAudioData(await res.arrayBuffer());
  }));

  // room reverb: decaying stereo noise
  const irLen = Math.floor(SR * 2.8);
  const ir = ctx.createBuffer(2, irLen, SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6) * Math.exp(-i / SR * 1.2);
  }
  const verb = ctx.createConvolver(); verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  const dry = ctx.createGain(); dry.gain.value = 0.9;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowshelf'; tone.frequency.value = 220; tone.gain.value = 2;
  const bus = ctx.createGain();
  bus.connect(tone); tone.connect(dry); tone.connect(verb); verb.connect(wet);
  dry.connect(ctx.destination); wet.connect(ctx.destination);

  timed.forEach((e) => {
    const key = layerOf(e.v) + ':' + nearest(e.m);
    const src = ctx.createBufferSource();
    src.buffer = buffers[key];
    src.playbackRate.value = Math.pow(2, (e.m - nearest(e.m)) / 12);
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.6, Math.min(0.6, (e.m - 64) / 40)); // low notes left, high right, like sitting at the piano
    const amp = 0.18 + e.v * 0.55;
    g.gain.setValueAtTime(amp, e.t);
    g.gain.setValueAtTime(amp, e.t + e.d);
    g.gain.exponentialRampToValueAtTime(0.0008, e.t + e.d + 0.45); // damper
    src.connect(g); g.connect(pan); pan.connect(bus);
    src.start(e.t);
    src.stop(e.t + e.d + 0.5);
  });

  const out = await ctx.startRendering();
  const L = out.getChannelData(0), R = out.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const norm = 0.89 / peak; // ≈ −1 dB
  const fadeIn = SR * 0.02, fadeOut = SR * 2.5;
  const toI16 = (x, i) => {
    let f = x * norm;
    if (i < fadeIn) f *= i / fadeIn;
    if (i > L.length - fadeOut) f *= (L.length - i) / fadeOut;
    return Math.max(-32768, Math.min(32767, Math.round(f * 32767)));
  };
  const enc = new lamejs.Mp3Encoder(2, SR, 112);
  const chunks = [];
  const BLOCK = 1152;
  const l16 = new Int16Array(BLOCK), r16 = new Int16Array(BLOCK);
  for (let i = 0; i < L.length; i += BLOCK) {
    const n = Math.min(BLOCK, L.length - i);
    for (let k = 0; k < n; k++) { l16[k] = toI16(L[i + k], i + k); r16[k] = toI16(R[i + k], i + k); }
    const buf = enc.encodeBuffer(l16.subarray(0, n), r16.subarray(0, n));
    if (buf.length) chunks.push(new Uint8Array(buf));
  }
  const end = enc.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  let size = 0; chunks.forEach((c) => (size += c.length));
  const all = new Uint8Array(size);
  let o = 0; chunks.forEach((c) => { all.set(c, o); o += c.length; });
  let s = '';
  for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
  return btoa(s);
}, { timed, total });

await browser.close();
const mp3 = Buffer.from(b64, 'base64');
writeFileSync('assets/music.mp3', mp3);
console.log('assets/music.mp3', (mp3.length / 1024).toFixed(0) + ' KB', total.toFixed(1) + ' s');
