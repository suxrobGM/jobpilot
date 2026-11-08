// Renders the teaser's music bed and SFX to WAV from oscillators and noise, so it is license-free.
//   node synth.mjs [outDir]   -> outDir/music.wav + outDir/sfx-*.wav (default ".")
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] ?? ".";
fs.mkdirSync(OUT, { recursive: true });

const SR = 48000;
// Shared with src/theme.ts, so the arrangement follows the edit's sections.
const storyboard = JSON.parse(
  fs.readFileSync(new URL("../storyboard.json", import.meta.url), "utf8"),
);
const BEAT = 60 / storyboard.bpm;
const BAR = BEAT * 4;

const TAU = Math.PI * 2;
let seed = 1337;
// Seeded LCG so every render of the track is identical.
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function buf(sec) {
  return [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
}
/** Centered one-shot: `sample(t)` gives the value at t seconds, same in both channels. */
function mono(sec, sample) {
  const s = buf(sec);
  for (let i = 0; i < s[0].length; i++) {
    const v = sample(i / SR);
    s[0][i] = v;
    s[1][i] = v;
  }
  return s;
}
function writeWav(file, [L, R], gain = 1) {
  const n = L.length;
  const out = Buffer.alloc(44 + n * 4);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + n * 4, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    out.writeInt16LE(Math.round(Math.tanh(L[i] * gain) * 32000), 44 + i * 4);
    out.writeInt16LE(Math.round(Math.tanh(R[i] * gain) * 32000), 46 + i * 4);
  }
  fs.writeFileSync(path.join(OUT, file), out);
}
function peakNormalize([L, R], target = 0.9) {
  let p = 0;
  for (let i = 0; i < L.length; i++) {
    p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = p > 0 ? target / p : 1;
  for (let i = 0; i < L.length; i++) {
    L[i] *= g;
    R[i] *= g;
  }
}
// State-variable filter, per-sample cutoff.
function svf() {
  let lp = 0;
  let bp = 0;
  return (x, fc, q = 0.7, mode = "lp") => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    const hp = x - lp - bp / q;
    bp += f * hp;
    lp += f * bp;
    return { lp, bp, hp }[mode];
  };
}
function add(dst, src, at, gain = 1, pan = 0) {
  const o = Math.round(at * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < src[0].length && o + i < dst[0].length; i++) {
    if (o + i < 0) {
      continue;
    }
    dst[0][o + i] += src[0][i] * gl * Math.SQRT2;
    dst[1][o + i] += src[1][i] * gr * Math.SQRT2;
  }
}
// Cheap stereo reverb: a few comb + allpass stages (Freeverb-ish).
function reverb([L, R], mix = 0.25, size = 0.84, damp = 0.35) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
  const aps = [225, 556, 441, 341];
  const run = (input, spread) => {
    const out = new Float32Array(input.length);
    for (const c of combs) {
      const len = c + spread;
      const line = new Float32Array(len);
      let idx = 0;
      let store = 0;
      for (let i = 0; i < input.length; i++) {
        const y = line[idx];
        store = y * (1 - damp) + store * damp;
        line[idx] = input[i] * 0.015 + store * size;
        out[i] += y;
        idx = (idx + 1) % len;
      }
    }
    for (const a of aps) {
      const len = a + spread;
      const line = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < out.length; i++) {
        const b = line[idx];
        const x = out[i];
        line[idx] = x + b * 0.5;
        out[i] = b - x;
        idx = (idx + 1) % len;
      }
    }
    return out;
  };
  const wl = run(L, 0);
  const wr = run(R, 23);
  for (let i = 0; i < L.length; i++) {
    L[i] = L[i] * (1 - mix) + wl[i] * mix * 3;
    R[i] = R[i] * (1 - mix) + wr[i] * mix * 3;
  }
}
function delay([L, R], time, fb = 0.35, mix = 0.25) {
  const d = Math.round(time * SR);
  for (let i = d; i < L.length; i++) {
    // ping-pong
    const l = L[i - d];
    const r = R[i - d];
    L[i] += r * fb * mix * 2;
    R[i] += l * fb * mix * 2;
  }
}

function kick(gain = 1) {
  let ph = 0;
  return mono(0.5, (t) => {
    const f = 45 + 110 * Math.exp(-t * 38);
    ph += (TAU * f) / SR;
    const env = Math.exp(-t * 7.5);
    const click = Math.exp(-t * 400) * rnd() * 0.25;
    return (Math.sin(ph) * env + click) * gain;
  });
}
function hat(open = false, gain = 0.25) {
  const f = svf();
  return mono(
    open ? 0.35 : 0.08,
    (t) => f(rnd(), 9000, 0.9, "hp") * Math.exp(-t * (open ? 14 : 70)) * gain,
  );
}
function clap(gain = 0.5) {
  const s = buf(0.4);
  const f = svf();
  for (let i = 0; i < s[0].length; i++) {
    const t = i / SR;
    let env = Math.exp(-t * 18);
    for (const o of [0, 0.011, 0.022]) {
      if (t >= o && t < o + 0.008) {
        env += 0.8 * Math.exp(-(t - o) * 300);
      }
    }
    const v = f(rnd(), 1500, 1.4, "bp") * env * gain * 2;
    s[0][i] = v + rnd() * 0.002;
    s[1][i] = v;
  }
  return s;
}
// Detuned saw voice with filter envelope.
function saw(
  note,
  dur,
  {
    gain = 0.2,
    cutoff = 1200,
    envAmt = 2500,
    decay = 6,
    detune = 0.12,
    attack = 0.005,
    release = 0.08,
    voices = 3,
    q = 0.9,
  } = {},
) {
  const s = buf(dur + release);
  const fL = svf();
  const fR = svf();
  const base = mtof(note);
  const phs = Array.from({ length: voices }, () => rnd() * 0.5 + 0.5);
  for (let i = 0; i < s[0].length; i++) {
    const t = i / SR;
    let l = 0;
    let r = 0;
    for (let v = 0; v < voices; v++) {
      const det = voices > 1 ? (v / (voices - 1) - 0.5) * detune : 0;
      phs[v] = (phs[v] + (base * 2 ** (det / 12)) / SR) % 1;
      const x = phs[v] * 2 - 1;
      const pan = voices > 1 ? v / (voices - 1) : 0.5;
      l += x * (1 - pan);
      r += x * pan;
    }
    const amp =
      (t < attack ? t / attack : 1) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
    const fc = cutoff + envAmt * Math.exp(-t * decay);
    s[0][i] = fL(l / voices, fc, q) * amp * gain;
    s[1][i] = fR(r / voices, fc, q) * amp * gain;
  }
  return s;
}
function pad(notes, dur, { gain = 0.08, cutoff = 900, attack = 1.2, release = 1.5 } = {}) {
  const s = buf(dur + release);
  for (const n of notes) {
    const v = saw(n, dur, { gain, cutoff, envAmt: 0, voices: 5, detune: 0.25, attack, release });
    add(s, v, 0);
  }
  return s;
}
function sine(note, dur, { gain = 0.3, attack = 0.002, decay = 3, partials = [[1, 1]] } = {}) {
  const s = buf(dur);
  const f = mtof(note);
  for (let i = 0; i < s[0].length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [m, a] of partials) {
      v += Math.sin(TAU * f * m * t) * a * Math.exp(-t * decay * m ** 0.5);
    }
    v *= (t < attack ? t / attack : 1) * gain;
    s[0][i] = v;
    s[1][i] = v;
  }
  return s;
}
function riser(dur, gain = 0.3, { from = 300, to = 9000 } = {}) {
  const s = buf(dur);
  const fL = svf();
  const fR = svf();
  for (let i = 0; i < s[0].length; i++) {
    const p = i / s[0].length;
    const fc = from * (to / from) ** (p ** 1.6);
    const env = p ** 2.2;
    s[0][i] = fL(rnd(), fc, 2.5, "bp") * env * gain;
    s[1][i] = fR(rnd(), fc * 1.03, 2.5, "bp") * env * gain;
  }
  return s;
}
function impact(gain = 1) {
  const s = buf(3);
  let ph = 0;
  const f = svf();
  for (let i = 0; i < s[0].length; i++) {
    const t = i / SR;
    ph += (TAU * (38 + 70 * Math.exp(-t * 9))) / SR;
    const sub = Math.sin(ph) * Math.exp(-t * 1.6);
    const noise = f(rnd(), 400 + 4000 * Math.exp(-t * 6), 0.8) * Math.exp(-t * 3) * 0.6;
    const v = (sub + noise) * gain;
    s[0][i] = v;
    s[1][i] = v;
  }
  reverb(s, 0.3, 0.88);
  return s;
}
function whoosh(dur = 0.5, gain = 0.35, up = true) {
  const s = buf(dur + 0.2);
  const fL = svf();
  const fR = svf();
  for (let i = 0; i < s[0].length; i++) {
    const t = i / SR;
    const p = Math.min(1, t / dur);
    const fc = up ? 400 * 20 ** p : 8000 / 20 ** p;
    const env = Math.sin(Math.PI * p) ** 1.5 * (t > dur ? Math.exp(-(t - dur) * 30) : 1);
    s[0][i] = fL(rnd(), fc, 1.8, "bp") * env * gain * (1 - p * 0.6);
    s[1][i] = fR(rnd(), fc, 1.8, "bp") * env * gain * (0.4 + p * 0.6);
  }
  return s;
}
function click(gain = 0.5) {
  const f = svf();
  return mono(
    0.06,
    (t) =>
      (Math.sin(TAU * 2400 * t) * Math.exp(-t * 180) * 0.5 +
        f(rnd(), 5000, 1, "bp") * Math.exp(-t * 300)) *
      gain,
  );
}
function tick(gain = 0.25, f0 = 3200) {
  const f = svf();
  return mono(0.03, (t) => f(rnd(), f0, 2, "bp") * Math.exp(-t * 400) * gain);
}
function chime(gain = 0.35) {
  // Two-note "success" bell: E6 then B6, inharmonic partials for a bell colour.
  const s = buf(2.2);
  const bell = [
    [1, 1],
    [2.76, 0.35],
    [5.4, 0.12],
    [8.93, 0.05],
  ];
  add(s, sine(88, 2.0, { gain, decay: 2.2, partials: bell }), 0, 1, -0.2);
  add(s, sine(95, 2.0, { gain, decay: 2.2, partials: bell }), 0.09, 1, 0.2);
  delay(s, 0.18, 0.3, 0.3);
  reverb(s, 0.25);
  return s;
}

// Sections (bars from storyboard.json): hook = drone + ticks, riser in its last bar; reveal =
// impact + pad, no drums; start/hero = groove A (kick, hats, bass, chords); payoff = groove B
// (+ arp, claps); trust = breakdown (pad + arp, no kick), riser in its last bar; close = final hit.
const S = {};
let BARS = 0;
for (const { name, bars } of storyboard.sections) {
  S[name] = BARS;
  BARS += bars;
}
const LENGTH = BARS * BAR + 3;
// Optional storyboard keys: where groove B (arp, claps) starts, and sections that open on a hit.
const GROOVE_B = S[storyboard.grooveB ?? "payoff"];
const HITS = storyboard.hits ?? [];
const music = buf(LENGTH);
const drums = buf(LENGTH);
const kicks = [];
const at = (bar, beat = 0) => bar * BAR + beat * BEAT;

// A minor: Am - F - C - G (i - VI - III - VII)
const chords = [
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [55, 60, 64, 67],
  [55, 59, 62, 67],
];
const roots = [45, 41, 48, 43];

add(
  music,
  pad([45, 52, 57], S.reveal * BAR, { gain: 0.12, cutoff: 500, attack: 1.5, release: 1 }),
  0,
);
for (let b = 0; b < S.reveal * 8; b++) {
  add(
    music,
    tick(b % 4 === 0 ? 0.3 : 0.16, b % 4 === 0 ? 2600 : 3400),
    b * BEAT * 0.5,
    1,
    b % 2 ? 0.3 : -0.3,
  );
}
add(music, riser(BAR, 0.35), at(S.reveal - 1));
add(drums, impact(0.9), at(S.reveal));

add(
  music,
  pad(chords[0], (S.start - S.reveal) * BAR, {
    gain: 0.12,
    cutoff: 1400,
    attack: 0.05,
    release: 1.2,
  }),
  at(S.reveal),
);

for (let bar = S.start; bar < S.close; bar++) {
  const c = (bar - S.start) % 4;
  const inBreak = bar >= S.trust;
  const grooveB = bar >= GROOVE_B && !inBreak;
  add(
    music,
    pad(chords[c], BAR, {
      gain: inBreak ? 0.11 : 0.08,
      cutoff: grooveB ? 2200 : 1500,
      attack: 0.08,
      release: 0.6,
    }),
    at(bar),
  );
  if (!inBreak) {
    for (let beat = 0; beat < 4; beat++) {
      add(drums, kick(0.8), at(bar, beat));
      kicks.push(at(bar, beat));
      add(drums, hat(false, 0.22), at(bar, beat + 0.5), 1, 0.25);
      if (grooveB) {
        add(drums, hat(false, 0.1), at(bar, beat + 0.25), 1, -0.3);
      }
      if (grooveB && beat === 3) {
        add(drums, hat(true, 0.12), at(bar, beat + 0.5), 1, 0.1);
      }
    }
    if (grooveB) {
      add(drums, clap(0.4), at(bar, 1));
      add(drums, clap(0.4), at(bar, 3));
    }
    // Octave bass on 8ths, nudged just after each kick so the two don't stack.
    for (let e = 0; e < 8; e++) {
      const n = roots[c] - 12 + (e % 2 ? 12 : 0);
      add(
        music,
        saw(n, BEAT * 0.42, {
          gain: 0.34,
          cutoff: 260,
          envAmt: 1100,
          decay: 18,
          voices: 2,
          detune: 0.05,
        }),
        at(bar, e * 0.5 + 0.02),
      );
    }
  }
  if (bar >= GROOVE_B) {
    const arp = [0, 2, 3, 1, 2, 3, 1, 2];
    for (let s = 0; s < 8; s++) {
      const n = chords[c][arp[s]] + 12;
      add(
        music,
        saw(n, BEAT * 0.3, {
          gain: inBreak ? 0.12 : 0.11,
          cutoff: 1000,
          envAmt: 3500,
          decay: 14,
          voices: 2,
          detune: 0.08,
        }),
        at(bar, s * 0.5),
        1,
        s % 2 ? 0.35 : -0.35,
      );
    }
  }
}
for (const name of HITS) {
  add(drums, impact(0.85), at(S[name]));
}
add(music, riser(BAR, 0.4, { from: 200, to: 11000 }), at(S.close - 1));
add(drums, impact(1), at(S.close));
add(
  music,
  pad([45, 52, 57, 64, 69], (BARS - S.close) * BAR, {
    gain: 0.1,
    cutoff: 1800,
    attack: 0.02,
    release: 2.5,
  }),
  at(S.close),
);
add(music, chime(0.25), at(S.close, 0.02));

delay(music, BEAT * 0.75, 0.25, 0.12);
reverb(music, 0.2, 0.82);
reverb(drums, 0.06, 0.6);
// Sidechain: duck the tonal stem under each kick for the pumping feel.
const duck = new Float32Array(music[0].length).fill(1);
for (const k of kicks) {
  const o = Math.round(k * SR);
  for (let i = 0; i < BEAT * SR && o + i < duck.length; i++) {
    const t = i / SR;
    duck[o + i] = Math.min(duck[o + i], 1 - 0.55 * Math.exp(-t * 9));
  }
}
const mix = buf(LENGTH);
for (let i = 0; i < mix[0].length; i++) {
  mix[0][i] = music[0][i] * duck[i] + drums[0][i];
  mix[1][i] = music[1][i] * duck[i] + drums[1][i];
}
// Look-ahead-free limiter: smoothed gain riding the peak envelope.
let env = 0;
for (let i = 0; i < mix[0].length; i++) {
  const p = Math.max(Math.abs(mix[0][i]), Math.abs(mix[1][i]));
  env = p > env ? env + (p - env) * 0.2 : env * 0.99995;
  const g = env > 0.35 ? 0.35 / env : 1;
  mix[0][i] *= g;
  mix[1][i] *= g;
}
peakNormalize(mix, 0.95);
writeWav("music.wav", mix, 1.25);

const fx = {
  click: click(0.6),
  whoosh: whoosh(0.45, 0.5),
  whooshDown: whoosh(0.4, 0.45, false),
  chime: chime(0.45),
  impact: impact(1),
  riser: riser(1.5, 0.5),
  tick: tick(0.5),
};
for (const [n, s] of Object.entries(fx)) {
  peakNormalize(s, 0.9);
  writeWav(`sfx-${n}.wav`, s);
}
// Typing bed: irregular soft ticks, 4s, for terminal shots.
const typing = buf(4);
for (let t = 0; t < 3.9; t += 0.045 + Math.abs(rnd()) * 0.11) {
  add(typing, tick(0.18 + Math.abs(rnd()) * 0.1, 1800 + Math.abs(rnd()) * 2400), t, 1, rnd() * 0.4);
}
peakNormalize(typing, 0.6);
writeWav("sfx-typing.wav", typing);
console.log(`rendered music.wav and sfx-*.wav into ${OUT}`);
