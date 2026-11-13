(function () {
'use strict';
const API = 'https://script.google.com/macros/s/AKfycbw5doexlj-huQ_CXWStLB-amo5l-KzKqo_fQj7I7QKIV1M9WFpFeLQrxp1XnzvazZpZ4g/exec';
const W = 960, H = 540, ZONE_H = 1000;   // 100m 올라갈 때마다 새로운 하늘 나라
const PHYS = { g: 1300, speed: 250, jump: 640, djump: 580, spring: 1080 };
const GAME = { quizEvery: 30, drain: 1.5, energyPer: 30, pointsPer: 30, giftRespawn: 20000 };
const COIN = { gift: 3, answer: 3, gate: 5 };
const ZFX = { 1: { dark: 1 }, 3: { wind: 55 }, 6: { slip: 1 }, 8: { low: 1 }, 9: { slip: 1 } };   // 구간 이벤트(풍경별)
const ZFX_MSG = { 1: '🌑 어두운 밤 — 내 주변만 보여요', 3: '🌬 노을 바람 — 옆으로 밀려요', 6: '🧊 미끄러운 오로라', 8: '🪐 우주 — 몸이 가벼워요!', 9: '🧊 미끄러운 얼음 나라' };
const HZ_KIND = ['bird', 'rock', 'bird', 'bird', 'bird', 'bird', 'rock', 'bird', 'rock', 'snow'];
const EMOTES = ['', '😆', '👍', '😭', '🔥'];
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const stageEl = $('stage');
const QS = window.QUESTIONS || [];

/* ---------- 화면 크기 ---------- */
let RES = 1;
function fit() {
  stageEl.style.setProperty('--u', (stageEl.clientWidth / 960).toFixed(3));
  const r = Math.min(2, Math.max(1, Math.round((stageEl.clientWidth * (window.devicePixelRatio || 1) / 960) * 4) / 4));   // 선명하게: 화면 크기에 맞춰 해상도 올림
  if (r !== RES || cv.width !== Math.round(960 * r)) { RES = r; cv.width = Math.round(960 * RES); cv.height = Math.round(540 * RES); for (const k in SPR) delete SPR[k]; skyCache.length = 0; }
}
window.addEventListener('resize', fit);

/* ---------- 소리 ---------- */
let ac = null, muted = false;
function unlock() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function tone(f, d, type, vol, slide, delay) {
  if (!ac || muted) return;
  const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
}
const SFX = {
  jump: () => tone(380, 0.14, 'square', 0.07, 320), djump: () => tone(560, 0.16, 'square', 0.07, 400),
  boing: () => tone(240, 0.3, 'sine', 0.2, 600), gift: () => { tone(660, 0.1, 'triangle', 0.15); tone(880, 0.14, 'triangle', 0.15, 0, 0.09); },
  correct: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, 0, i * 0.08)); },
  wrong: () => tone(200, 0.35, 'sawtooth', 0.1, -80),
  beep: () => tone(660, 0.12, 'square', 0.1), go: () => tone(990, 0.35, 'square', 0.12),
  whoosh: () => tone(900, 0.6, 'sawtooth', 0.06, -700),
  bonk: () => tone(150, 0.25, 'square', 0.12, -90), pop: () => tone(700, 0.1, 'sine', 0.12, 300),
  ice: () => { tone(1200, 0.25, 'triangle', 0.12, -700); tone(1500, 0.15, 'sine', 0.08, -500, 0.05); },
  coin: () => { tone(1320, 0.08, 'triangle', 0.09); tone(1760, 0.12, 'triangle', 0.09, 0, 0.06); }, win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, 0, i * 0.11)); },
};
const sfx = (n) => { try { SFX[n](); } catch (e) {} };

/* ---------- 배경음악: 저작권 없는 크리스마스 캐롤(전통 곡) — 브라우저에서 직접 연주해서 번갈아 재생 ---------- */
const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freqOf(n) { const m = /^([A-G])(#|b)?(\d)$/.exec(n); let k = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; return 440 * Math.pow(2, (k - 69) / 12); }
const SONGS = [
  { name: '징글벨', bpm: 132, bass: ['C3', 'G2'], notes: 'E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:.5 E4:4 F4:1 F4:1 F4:1.5 F4:.5 F4:1 E4:1 E4:1 E4:.5 E4:.5 G4:1 G4:1 F4:1 D4:1 C4:4' },
  { name: 'We Wish You a Merry Christmas', bpm: 126, bass: ['G2', 'D3'], notes: 'D4:1 G4:1 G4:.5 A4:.5 G4:.5 F#4:.5 E4:1 E4:1 E4:1 A4:1 A4:.5 B4:.5 A4:.5 G4:.5 F#4:1 D4:1 D4:1 B4:1 B4:.5 C5:.5 B4:.5 A4:.5 G4:1 E4:1 D4:.5 D4:.5 E4:1 A4:1 F#4:1 G4:3' },
  { name: '고요한 밤', bpm: 84, bass: ['C3', 'G2'], notes: 'G4:1.5 A4:.5 G4:1 E4:3 G4:1.5 A4:.5 G4:1 E4:3 D5:2 D5:1 B4:3 C5:2 C5:1 G4:3 A4:2 A4:1 C5:1.5 B4:.5 A4:1 G4:1.5 A4:.5 G4:1 E4:3 A4:2 A4:1 C5:1.5 B4:.5 A4:1 G4:1.5 A4:.5 G4:1 E4:3 D5:2 D5:1 F5:1.5 D5:.5 B4:1 C5:3 E5:3 C5:1 G4:1 E4:1 G4:1.5 F4:.5 D4:1 C4:3' },
  { name: '창밖을 보라 (Deck the Halls)', bpm: 120, bass: ['C3', 'G2'], notes: 'G5:1.5 F5:.5 E5:1 D5:1 C5:1 D5:1 E5:1 C5:1 D5:.5 E5:.5 F5:.5 D5:.5 E5:1.5 D5:.5 C5:1 B4:1 C5:2' },
  { name: '기쁘다 구주 오셨네', bpm: 108, bass: ['C3', 'F3'], notes: 'C6:1 B5:1 A5:1.5 G5:.5 F5:1 E5:1 D5:1 C5:2' },
];
const Music = {
  gain: null, on: true, idx: Math.floor(Math.random() * SONGS.length), timer: null, started: false, nodes: [],
  start() {
    if (this.started || !ac) return; this.started = true;
    this.gain = ac.createGain(); this.gain.gain.value = this.on ? 1 : 0; this.gain.connect(ac.destination);
    this.next(0.4);
  },
  note(f, t, d, vol, type) {
    const o = ac.createOscillator(), g = ac.createGain(), o2 = ac.createOscillator(), g2 = ac.createGain();
    o.type = type || 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = vol * 0.25;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, d));
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.gain); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1);
  },
  next(delay) {
    const song = SONGS[this.idx % SONGS.length]; this.idx++;
    const spb = 60 / song.bpm, t0 = ac.currentTime + delay; let beat = 0;
    for (const tok of song.notes.split(' ')) { const [n, d] = tok.split(':'), len = parseFloat(d); this.note(freqOf(n), t0 + beat * spb, len * spb * 0.95, 0.075, 'triangle'); beat += len; }
    for (let b = 0, k = 0; b < beat; b += 4, k++) this.note(freqOf(song.bass[k % 2]), t0 + b * spb, spb * 3.6, 0.05, 'sine');
    setTimeout(() => { try { if (typeof toastMusic === 'function') toastMusic(song.name); } catch (e) {} }, delay * 1000);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.next(1.5), (delay + beat * spb + 1.5) * 1000 - 1400);
  },
  toggle() { this.on = !this.on; if (this.gain) this.gain.gain.value = this.on ? 1 : 0; return this.on; },
};
function toastMusic(name) { if (scene && !$('game').classList.contains('hidden')) scene.toast('🎵 ' + name, 2600); }
$('retryBtn').onclick = () => { if (scene) scene.useRetry(); };
$('muteBtn').onclick = () => { muted = !muted; Music.toggle(); $('muteBtn').textContent = muted ? '🔇' : '🔊'; };

/* ---------- 맵 생성(서버 없이 seed 만으로 모두 같은 맵) ---------- */
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (seed, z, salt) => (Math.imul(seed ^ salt, 0x9e3779b1) ^ Math.imul(z + 1, 0x85ebca6b)) >>> 0;
const zoneOf = (y) => Math.max(0, Math.floor(-y / ZONE_H));
const heightOf = (y) => Math.max(0, Math.round(-y / 10));
const NMAP = 10;
const orderCache = new Map();
function mapOf(seed, z) {   // 10개 배경을 섞어서 돌려가며 끝없이
  const c = Math.floor(z / NMAP), key = seed + ':' + c;
  let ids = orderCache.get(key);
  if (!ids) {
    const rnd = mulberry32(hash(seed, c, 0x51ed270b)); ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 9; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    if (orderCache.size > 30) orderCache.clear(); orderCache.set(key, ids);
  }
  return ids[z % NMAP];
}
const WIDTHS = [[128, 128, 112], [128, 112, 96], [112, 96, 128, 112], [112, 96, 96], [96, 96, 80]];
const diffOf = (z) => Math.min(1, z / 24);
const CP_W = 288;
function cpX(seed, z) { if (z === 0) return W / 2; const r = mulberry32(hash(seed, z, 0x2545f491)); return Math.round(CP_W / 2 + 16 + r() * (W - CP_W - 32)); }
const cpY = (z) => (z === 0 ? 0 : -z * ZONE_H - 40);
const zoneCache = new Map();
function buildZone(seed, z) {
  const key = seed + ':' + z; if (zoneCache.has(key)) return zoneCache.get(key);
  const rnd = mulberry32(hash(seed, z, 0x1b873593)), rnd2 = mulberry32(hash(seed, z, 0x9e3779b9));
  const r = (a, b) => a + rnd() * (b - a), pick = (a) => a[Math.floor(rnd() * a.length)];
  const plats = [], gifts = [], springs = [];
  const cx0 = cpX(seed, z), cy0 = cpY(z);
  if (z === 0) plats.push({ x: 0, y: 0, w: W, kind: 'floor' });
  else plats.push({ x: Math.round(cx0 - CP_W / 2), y: cy0, w: CP_W, kind: 'cp' });
  const target = cpY(z + 1), nextCx = cpX(seed, z + 1);
  const gmin = 86 + diffOf(z) * 20, gmax = 108 + diffOf(z) * 20;
  let y = cy0, prevCx = cx0, row = 0;
  const WS = WIDTHS[Math.min(4, Math.floor(diffOf(z) * 5))];
  while (y - target > gmax) {
    let gap = r(gmin, gmax); if (y - gap - target < 70) gap = (y - target) / 2;
    y -= gap; row++;
    const w = pick(WS);
    let cx = clamp(prevCx + r(-190, 190), w / 2 + 8, W - w / 2 - 8);
    const left = y - target;
    if (left <= gmax) cx = clamp(nextCx + r(-110, 110), w / 2 + 8, W - w / 2 - 8);
    else if (left < 420) cx = clamp(cx + (nextCx - cx) * (left < 200 ? 0.8 : 0.45), w / 2 + 8, W - w / 2 - 8);
    cx = clamp(cx, prevCx - 190, prevCx + 190);
    const main = { x: Math.round(cx - w / 2), y: Math.round(y), w, kind: 'main' };
    plats.push(main);
    if (row % 6 === 0) gifts.push({ id: z * 100 + row, x: Math.round(cx), y: Math.round(y) - 18 });
    if (row % 7 === 3 && w >= 96) springs.push({ x: Math.round(rnd2() < 0.5 ? main.x + 18 : main.x + w - 18), y: main.y });
    if (rnd() < 0.4) {
      const w2 = pick([96, 112]); let cx2 = r(w2 / 2 + 8, W - w2 / 2 - 8);
      if (Math.abs(cx2 - cx) < 220) cx2 = cx2 < cx ? Math.max(w2 / 2 + 8, cx - 260) : Math.min(W - w2 / 2 - 8, cx + 260);
      if (Math.abs(cx2 - cx) > w / 2 + w2 / 2 + 20) {
        const side = { x: Math.round(cx2 - w2 / 2), y: Math.round(y + r(-20, 20)), w: w2, kind: 'side' };
        plats.push(side); if (rnd2() < 0.22) springs.push({ x: side.x + Math.round(w2 / 2), y: side.y });
      }
    }
    prevCx = cx;
  }
  plats.forEach((q, i) => { q.id = z * 1000 + i; });
  const rI = mulberry32(hash(seed, z, 0x7f4a7c15)), items = [], mains = plats.filter((q) => q.kind === 'main');
  if (mains.length > 7) {
    const rb = rI(), re = rI(), pb = mains[2 + Math.floor(rI() * 3)];
    if (rb < 0.4) items.push({ id: z + 'b', k: 'b', x: pb.x + pb.w / 2, y: pb.y - 64 });   // 🎈 풍선: 구역 10개 중 4개쯤
    if (re < 0.3) { const pe = mains[6 + Math.floor(rI() * (mains.length - 6))]; items.push({ id: z + 'e', k: 'e', x: pe.x + pe.w / 2, y: pe.y - 64 }); }   // 🥚 새 알
  }
  const rM = mulberry32(hash(seed, z, 0x3c6ef372));
  mains.forEach((pl, i) => {   // 좌우로 움직이는 판 (선물·스프링·아이템이 없는 판 중 일부)
    const a = rM(), b = rM(), c = rM();
    if (i < 2 || a > 0.5 || gifts.some((q) => q.y + 18 === pl.y) || springs.some((q) => q.y === pl.y) || items.some((q) => q.y + 64 === pl.y)) return;
    const r = Math.min(40 + b * 40, pl.x - 8, W - 8 - (pl.x + pl.w)); if (r < 28) return;
    pl.mv = { r, sp: 0.8 + c * 0.7, ph: (i * 1.7 + z) % 6.283, x0: pl.x };
  });
  const rC = mulberry32(hash(seed, z, 0x6a09e667)), coins = [];
  mains.forEach((pl, i) => {   // 사라지는 구름 판 + 코인
    const a = rC(), b = rC();
    const busy = gifts.some((q) => q.y + 18 === pl.y) || springs.some((q) => q.y === pl.y) || items.some((q) => q.y + 64 === pl.y);
    if (i >= 3 && a < 0.12 && !pl.mv && !busy) pl.cr = true;
    if (i >= 1 && b < 0.4 && !pl.mv && !busy) coins.push({ id: z * 1000 + i, x: Math.round(pl.x + pl.w / 2), y: pl.y - 36 });
  });
  const hz = [];
  if (z > 0) {   // 날아다니는 방해물(부딪히면 밀려날 뿐, 생명은 안 깎임)
    const rH = mulberry32(hash(seed, z, 0x510e527f)), kind = HZ_KIND[mapOf(seed, z)];
    for (let k = 0; k < 2; k++) hz.push({ k: kind, y: Math.round(cpY(z) - 180 - rH() * 640), x0: rH() * (W + 160), d: rH() < 0.5 ? -1 : 1, sp: 55 + rH() * 55 });
  }
  const out = { z, plats, gifts, springs, items, coins, hz, cp: { x: cx0, y: cy0 } };
  if (zoneCache.size > 200) zoneCache.clear(); zoneCache.set(key, out); return out;
}

/* ---------- 캐릭터: 말랑말랑 동글동글 30종 (동물 10종 × 색 3가지) ---------- */
const SPECIES = [   // 동글동글 말랑 친구들: 색 3가지 × (무늬 없음 / 머리 얼룩 / 점 무늬)
  { n: 'cat', cols: ['#ffd8b0', '#e3e6ee', '#ffc27d', '#d9c8ff', '#b7e3ff'], patch: ['#f08a4a', '#8d93a6', '#fff3e0', '#9a7be0', '#6fb0e8'] },
  { n: 'bear', cols: ['#e8b98a', '#f6dcc0', '#c99a72', '#f0c9d6', '#cfe0b8'], patch: ['#b9784a', '#e0a77a', '#f0d2b0', '#d98aa4', '#8fb06a'] },
  { n: 'hamster', cols: ['#fff0d6', '#ffe0b8', '#f4ead8', '#ffe0ef', '#e0f0ff'], patch: ['#e8a05a', '#d08a4a', '#c9b08a', '#f09ac0', '#8cb8e8'] },
  { n: 'dog', cols: ['#fff6e4', '#f2d6aa', '#d9b78a', '#ffe8cc', '#dcdcdc'], patch: ['#a86a44', '#8a5a40', '#fff6e4', '#e0884a', '#8a8a96'] },
  { n: 'chick', cols: ['#ffeb7a', '#ffd98a', '#fff7b8', '#d9f0a0', '#ffd0d8'], patch: ['#ffc23a', '#ffb066', '#ffe98a', '#9ad050', '#ff9aa8'] },
  { n: 'frog', cols: ['#a6ec9e', '#92e2ee', '#d4f59a', '#ffd9a0', '#c9b6f2'], patch: ['#6fcf7a', '#58bfd4', '#a8d85a', '#f0a850', '#9a7fe0'] },
  { n: 'penguin', cols: ['#8aa2ea', '#6a7399', '#ffa8c4', '#9ae0d0', '#c8b0ff'], patch: ['#5a74c8', '#454c70', '#f07a9e', '#4ab8a4', '#8a62e0'] },
  { n: 'panda', cols: ['#ffffff', '#d4f7ea', '#ffe0ec', '#fff2b8', '#cfe9ff'], patch: ['#4a4a5a', '#4a5a5a', '#5a4a52', '#4a4a5a', '#4a4a5a'] },
  { n: 'pig', cols: ['#ffc2d2', '#ffdce8', '#f8b4e0', '#ffe2a8', '#d4c4ff'], patch: ['#ff90ae', '#f4a8c4', '#e88ac8', '#f0b050', '#a58ae0'] },
  { n: 'mouse', cols: ['#e6e6f2', '#fbe0d0', '#d6e8ff', '#ffd4e8', '#d4f5d0'], patch: ['#b4b4cc', '#eab8a0', '#a8c8f0', '#f09ac4', '#8fcf88'] },
];
const NSKIN = 86, JELLY0 = 50;   // 50~85 = 젤리 친구들(이미지)
const SHEET = new Image(); let sheetOk = false; SHEET.onload = () => { sheetOk = true; if (typeof refreshPreviews === 'function') refreshPreviews(); }; SHEET.src = 'chars.png?v=1';
const OUT = '#8a5646';
const hasJong = (n) => { const c = String(n).charCodeAt(String(n).length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const iga = (n) => n + (hasJong(n) ? '이' : '가'), eulreul = (n) => n + (hasJong(n) ? '을' : '를');
const SH = {}, GRD = {};
function shade(hex, a) {   // 색을 밝게(+)/어둡게(-)
  const k = hex + a; if (SH[k]) return SH[k];
  const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(a >= 0 ? c + (255 - c) * a : c * (1 + a))));
  return (SH[k] = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`);
}
function drawJelly(g, skin, x, y, o) {
  if (!sheetOk) return;
  const k = skin - JELLY0, s = o.scale || 1.35, t = o.t, run = o.anim === 1;
  let sx = 1 + Math.sin(t * 2.2) * 0.02, sy = 1 - Math.sin(t * 2.2) * 0.03;
  if (run) { sx = 1 + Math.sin(t * 16) * 0.05; sy = 1 - Math.sin(t * 16) * 0.07; }
  const bs = o.bs || 0, bv = o.bv || 0; sy *= 1 + bs; sx *= 1 - bs * 0.8;
  const hop = run ? Math.abs(Math.sin(t * 8)) * 3 : 0, D = 46;
  g.save(); g.translate(x, y - hop); g.scale((o.flip ? -1 : 1) * s, s);
  g.transform(1, 0, Math.max(-0.35, Math.min(0.35, bv * 0.02)), 1, 0, 0); g.scale(sx, sy);
  if (o.anim === 2) g.rotate(Math.sin(t * 14) * 0.08);
  g.drawImage(SHEET, (k % 6) * 128, ((k / 6) | 0) * 128, 128, 128, -D / 2, -D + 2, D, D);
  g.restore();
}
function drawChar(g, skin, x, y, o) {   // (x,y)=발 바닥 가운데. o: {t, flip, scale, anim, bs, bv}
  if (skin >= JELLY0) return drawJelly(g, skin, x, y, o);
  const sp = SPECIES[skin % 10], v = Math.floor(skin / 10) % 5, col = sp.cols[v], pc = sp.patch[v], n = sp.n, pv = v === 3 ? 1 : v === 4 ? 2 : v;
  const s = o.scale || 1.35, t = o.t, run = o.anim === 1;
  let sx = 1 + Math.sin(t * 2.2) * 0.02, sy = 1 - Math.sin(t * 2.2) * 0.03;
  if (run) { sx = 1 + Math.sin(t * 16) * 0.05; sy = 1 - Math.sin(t * 16) * 0.07; }
  const bs = o.bs || 0, bv = o.bv || 0;
  sy *= 1 + bs; sx *= 1 - bs * 0.8;
  const hop = run ? Math.abs(Math.sin(t * 8)) * 3 : 0;
  g.save(); g.translate(x, y - hop); g.scale((o.flip ? -1 : 1) * s, s);
  g.transform(1, 0, Math.max(-0.35, Math.min(0.35, bv * 0.02)), 1, 0, 0);   // 젤리처럼 윗부분이 출렁
  g.scale(sx, sy);
  g.lineJoin = 'round'; g.lineWidth = 2.2; g.strokeStyle = OUT;
  const ell = (cx, cy, rx, ry, fill, rot, noStroke) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, rot || 0, 0, 7); g.fillStyle = fill; g.fill(); if (!noStroke) g.stroke(); };
  const BY = -17.5, RX = 20, RY = 17.5;
  // 뒤쪽 귀·꼬리
  if (n === 'cat') [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(d * 17, BY - 6); g.quadraticCurveTo(d * 20, BY - 24, d * 8, BY - 16); g.closePath(); g.fillStyle = col; g.fill(); g.stroke(); });
  if (n === 'bear' || n === 'hamster') [[-1], [1]].forEach(([d]) => ell(d * 14, BY - 13, n === 'bear' ? 6.5 : 5, n === 'bear' ? 6.5 : 5, v === 1 && n === 'bear' ? pc : col));
  if (n === 'panda') [[-1], [1]].forEach(([d]) => ell(d * 14, BY - 13, 6.5, 6.5, '#4a4a5a'));
  if (n === 'mouse') [[-1], [1]].forEach(([d]) => { ell(d * 15, BY - 12, 8, 8, col); ell(d * 15, BY - 12, 4.5, 4.5, '#ffc6d6', 0, true); });
  if (n === 'pig') [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(d * 9, BY - 15); g.lineTo(d * 18, BY - 22); g.lineTo(d * 18, BY - 9); g.closePath(); g.fillStyle = pc; g.fill(); g.stroke(); });
  if (n === 'dog') [[-1], [1]].forEach(([d]) => ell(d * 19, BY - 3, 6, 11, v === 0 ? pc : sp.patch[v], d * 0.2));
  if (n === 'frog') [[-1], [1]].forEach(([d]) => ell(d * 10, BY - 15, 7, 7, col));
  if (n === 'chick') { ell(0, BY - 19, 2.4, 5, pc, 0); ell(-4, BY - 18, 2.2, 4.4, pc, -0.5); ell(4, BY - 18, 2.2, 4.4, pc, 0.5); }
  // 몸 (동글동글 공)
  const wob = Math.min(3, 0.6 + Math.abs(bv) * 0.12 + Math.abs(bs) * 7);   // 젤리처럼 출렁이는 가장자리
  const body = () => { g.beginPath(); for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2, r = 1 + Math.sin(a * 3 + t * 9) * wob * 0.012 + Math.sin(a * 2 - t * 6) * wob * 0.01, px = Math.cos(a) * RX * r, py = BY + Math.sin(a) * RY * r; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); };
  body(); { let gr = GRD[col]; if (!gr) { gr = GRD[col] = ctx.createRadialGradient(-6, BY - 8, 3, 0, BY, 26); gr.addColorStop(0, shade(col, 0.5)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.18)); } g.fillStyle = gr; g.fill(); }
  g.save(); g.clip();   // 얼룩 무늬는 몸 안에서만
  g.fillStyle = pc;
  if (n !== 'panda' && n !== 'penguin') {
    if (pv === 1) { g.beginPath(); g.ellipse(9, BY - 13, 13, 9, 0.4, 0, 7); g.fill(); }
    if (pv === 2) { g.beginPath(); g.ellipse(-14, BY + 4, 7, 9, 0, 0, 7); g.ellipse(13, BY + 8, 8, 7, 0, 0, 7); g.fill(); }
  }
  if (n === 'penguin') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, BY + 4, 13, 13, 0, 0, 7); g.fill(); g.fillStyle = pc; g.beginPath(); g.ellipse(-19, BY, 6, 14, 0, 0, 7); g.ellipse(19, BY, 6, 14, 0, 0, 7); g.fill(); }
  else if (n === 'panda') { g.fillStyle = '#4a4a5a'; g.beginPath(); g.ellipse(-19, BY + 2, 7, 12, 0, 0, 7); g.ellipse(19, BY + 2, 7, 12, 0, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(0, BY + 6, 14, 12, 0, 0, 7); g.fill(); }
  else { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(0, BY + 7, 11, 9, 0, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-9, BY - 10, 7.5, 4.2, -0.6, 0, 7); g.fill();   // 말랑한 하이라이트
  g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(-14.5, BY - 3, 1.7, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3; g.beginPath(); g.arc(0, BY, RX - 3, 0.35, Math.PI - 0.35); g.stroke();   // 아래쪽 투과광(젤리)
  g.restore();
  g.lineWidth = 2.2; g.strokeStyle = OUT; body(); g.stroke();
  // 작은 손발
  const fo = run ? Math.sin(t * 16) * 2.5 : 0, footCol = n === 'penguin' || n === 'chick' ? '#ffb347' : (n === 'panda' ? '#4a4a5a' : col);
  ell(-8 + fo, -1.5, 5.2, 3.4, footCol); ell(8 - fo, -1.5, 5.2, 3.4, footCol);
  const aw = run ? Math.sin(t * 16 + 1) * 0.5 : o.anim === 2 ? -1.1 : 0.15;
  g.save(); g.translate(-19, BY + 2); g.rotate(0.6 + aw); ell(0, 0, 3.4, 4.6, n === 'panda' ? '#4a4a5a' : n === 'penguin' ? pc : col); g.restore();
  g.save(); g.translate(19, BY + 2); g.rotate(-0.6 - aw); ell(0, 0, 3.4, 4.6, n === 'panda' ? '#4a4a5a' : n === 'penguin' ? pc : col); g.restore();
  // 얼굴: 아주 작은 점 눈 / 웃는 눈, 볼터치, 콩알 코와 입
  const ey = BY - 2, tt = t * 1.3 + skin, blink = Math.floor(tt) % 4 === 0 && tt % 1 < 0.12, happy = (skin % 3 === 0) || o.anim === 2;
  g.lineCap = 'round'; g.strokeStyle = '#5a3a40'; g.lineWidth = 1.7; g.fillStyle = '#4a2f36';
  if (blink || happy) { [[-8], [8]].forEach(([dx]) => { g.beginPath(); g.arc(dx, ey + 1, 2.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }); }
  else { [[-8], [8]].forEach(([dx]) => { g.beginPath(); g.arc(dx, ey, 1.9, 0, 7); g.fill(); }); }
  g.fillStyle = 'rgba(255,120,150,.5)'; g.beginPath(); g.ellipse(-14, ey + 5, 3.4, 2.2, 0, 0, 7); g.ellipse(14, ey + 5, 3.4, 2.2, 0, 0, 7); g.fill();
  g.strokeStyle = '#5a3a40'; g.lineWidth = 1.3;
  if (n === 'chick' || n === 'penguin') { g.beginPath(); g.moveTo(-3.5, ey + 3); g.lineTo(3.5, ey + 3); g.lineTo(0, ey + 8); g.closePath(); g.fillStyle = '#ffa32e'; g.fill(); }
  else if (n === 'pig') { g.beginPath(); g.ellipse(0, ey + 5, 6, 4, 0, 0, 7); g.fillStyle = '#ff9fb8'; g.fill(); g.stroke(); g.fillStyle = '#b94a6a'; g.beginPath(); g.arc(-2, ey + 5, 0.9, 0, 7); g.arc(2, ey + 5, 0.9, 0, 7); g.fill(); }
  else { g.fillStyle = '#5a3a40'; g.beginPath(); g.arc(0, ey + 3.5, 1.4, 0, 7); g.fill(); g.beginPath(); g.arc(-1.7, ey + 5.2, 1.7, 0.1, Math.PI - 0.3); g.arc(1.7, ey + 5.2, 1.7, 0.3, Math.PI - 0.1); g.stroke(); }
  if (v === 3) { g.fillStyle = '#ff7aa8'; [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(10, BY - RY + 1); g.quadraticCurveTo(10 + d * 9, BY - RY - 10, 10 + d * 12, BY - RY + 2); g.quadraticCurveTo(10 + d * 7, BY - RY + 4, 10, BY - RY + 1); g.fill(); g.stroke(); }); g.beginPath(); g.arc(10, BY - RY + 1, 2.6, 0, 7); g.fillStyle = '#ffd23f'; g.fill(); g.stroke(); }   // 리본
  if (v === 4) { for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; ell(-10 + Math.cos(a) * 4.2, BY - RY + 1 + Math.sin(a) * 4.2, 3.2, 3.2, '#ffffff'); } ell(-10, BY - RY + 1, 2.4, 2.4, '#ffd23f'); }   // 꽃
  g.restore();
}
function previewSkin(canvas, skin) { canvas.width = 64; canvas.height = 64; const g = canvas.getContext('2d'); g.clearRect(0, 0, 64, 64); drawChar(g, skin, 32, 56, { t: 0, anim: 0, scale: 1.2 }); }

/* ---------- 배경: 직접 그린 10가지 하늘 나라 ---------- */
const THEMES = [
  { sky: ['#ffc9dd', '#ffe3cf', '#fff6e2'], plat: ['#ffd6e0', '#e8a0b8'], deco: ['cloud', 'heart', 'sun'] },
  { sky: ['#15133f', '#2f2a78', '#6a4aa6'], plat: ['#c9c2f0', '#7a6fc0'], deco: ['cloud', 'star', 'moon'] },
  { sky: ['#bff3e3', '#e2f9d6', '#fdfbe0'], plat: ['#d8f2cf', '#7fbf86'], deco: ['island', 'cloud'] },
  { sky: ['#ff8fa3', '#ffbf9b', '#ffe8b0'], plat: ['#ffe0c0', '#e8987a'], deco: ['cloud', 'sun2', 'bird'] },
  { sky: ['#ffbfe0', '#ffd9ec', '#fff0f8'], plat: ['#ffcfe6', '#e47fb0'], deco: ['lolly', 'cloud', 'sprinkle'] },
  { sky: ['#7ccaff', '#b8e6ff', '#e4f6ff'], plat: ['#d8efff', '#78b4e0'], deco: ['rainbow', 'cloud', 'bubble'] },
  { sky: ['#06182c', '#0d3a4c', '#1c6a68'], plat: ['#c2f0e6', '#5cb8a8'], deco: ['aurora', 'star'] },
  { sky: ['#fff2a0', '#ffe4b8', '#ffd6d0'], plat: ['#fff0b8', '#e8b648'], deco: ['balloon', 'cloud'] },
  { sky: ['#120f38', '#32196a', '#6a2f9a'], plat: ['#e0c8ff', '#9a6ad8'], deco: ['planet', 'star', 'comet'] },
  { sky: ['#cdeeff', '#e6f7ff', '#f8fdff'], plat: ['#eaf7ff', '#8cc4e8'], deco: ['crystal', 'flake', 'cloud'] },
];
const THEME_NAMES = ['새벽 구름 나라', '별빛 밤하늘', '민트 하늘섬', '노을 언덕', '사탕 나라', '무지개 하늘', '오로라 나라', '풍선 나라', '보라빛 우주', '얼음 나라'];
const rnd = mulberry32(777);
function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = Math.round(w * RES); c.height = Math.round(h * RES); const g = c.getContext('2d'); g.scale(RES, RES); fn(g, w, h); c.lw = w; c.lh = h; return c; }
function cloudShape(g, x, y, s, fill) { g.fillStyle = fill; g.beginPath(); [[0, 0, 34], [32, -10, 28], [62, 2, 26], [-30, 6, 22], [90, 10, 18], [30, 14, 30]].forEach(([dx, dy, r]) => { g.moveTo(x + dx * s + r * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); }); g.fill(); }
const SPR = {};
function sprite(kind) {
  if (SPR[kind]) return SPR[kind];
  let c;
  switch (kind) {
    case 'cloud': c = mk(220, 110, (g) => { cloudShape(g, 80, 60, 1, 'rgba(255,255,255,.85)'); cloudShape(g, 80, 66, 1, 'rgba(255,255,255,.5)'); }); break;
    case 'heart': c = mk(40, 40, (g) => { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(20, 34); g.bezierCurveTo(-6, 16, 8, 0, 20, 12); g.bezierCurveTo(32, 0, 46, 16, 20, 34); g.fill(); }); break;
    case 'star': c = mk(30, 30, (g) => { g.fillStyle = '#fff6b8'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(15 + Math.cos(a) * r, 15 + Math.sin(a) * r); } g.fill(); }); break;
    case 'island': c = mk(240, 210, (g) => {
      g.fillStyle = '#b98a62'; g.beginPath(); g.moveTo(20, 120); g.quadraticCurveTo(120, 230, 220, 120); g.closePath(); g.fill();
      g.fillStyle = '#9ad87a'; g.beginPath(); g.ellipse(120, 120, 100, 22, 0, 0, 7); g.fill(); g.fillStyle = '#b6ee92'; g.beginPath(); g.ellipse(120, 114, 96, 16, 0, 0, 7); g.fill();
      g.fillStyle = '#8a5a3a'; g.fillRect(114, 62, 10, 52); g.fillStyle = '#5fc27a'; [[119, 46, 30], [96, 62, 20], [142, 62, 20]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
      g.fillStyle = '#ff9fb8'; [[108, 40], [128, 52], [100, 66]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }); }); break;
    case 'lolly': c = mk(90, 170, (g) => { g.fillStyle = '#fff'; g.fillRect(42, 80, 8, 90); const cols = ['#ff6fa8', '#fff', '#ffd23f', '#fff']; for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); g.moveTo(46, 44); g.arc(46, 44, 40, i * Math.PI / 4, (i + 1) * Math.PI / 4); g.fill(); } g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(46, 44, 38, 0, 7); g.stroke(); }); break;
    case 'balloon': c = mk(70, 130, (g) => { const col = ['#ff7a9a', '#7ac8ff', '#9be58a', '#ffa94d'][Math.floor(rnd() * 4)]; g.strokeStyle = 'rgba(120,100,100,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(35, 84); g.quadraticCurveTo(28, 110, 36, 128); g.stroke(); g.fillStyle = col; g.beginPath(); g.ellipse(35, 40, 28, 36, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(35, 76); g.lineTo(28, 88); g.lineTo(42, 88); g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(25, 28, 7, 12, -0.4, 0, 7); g.fill(); }); break;
    case 'planet': c = mk(200, 140, (g) => { const gr = g.createRadialGradient(80, 50, 10, 100, 70, 60); gr.addColorStop(0, '#ffd0f0'); gr.addColorStop(1, '#9a5ad8'); g.fillStyle = gr; g.beginPath(); g.arc(100, 70, 48, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,230,180,.85)'; g.lineWidth = 8; g.beginPath(); g.ellipse(100, 74, 90, 18, -0.3, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(84, 52, 14, 8, -0.5, 0, 7); g.fill(); }); break;
    case 'crystal': c = mk(120, 170, (g) => { [[60, 20, 36, 150, '#bfe6ff'], [26, 70, 28, 100, '#a8d8f5'], [96, 60, 26, 110, '#d6f0ff']].forEach(([x, y, w, h, col]) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w / 2, y + h * 0.25); g.lineTo(x + w / 2, y + h); g.lineTo(x - w / 2, y + h); g.lineTo(x - w / 2, y + h * 0.25); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - w / 2, y + h * 0.25); g.lineTo(x - w / 2 + 6, y + h); g.lineTo(x - 2, y + h * 0.3); g.closePath(); g.fill(); }); }); break;
    case 'flake': c = mk(40, 40, (g) => { g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.4; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(20 + Math.cos(a) * 16, 20 + Math.sin(a) * 16); g.lineTo(20 - Math.cos(a) * 16, 20 - Math.sin(a) * 16); g.stroke(); } }); break;
    case 'bubble': c = mk(40, 40, (g) => { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(20, 20, 14, 0, 7); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(15, 14, 3, 0, 7); g.fill(); }); break;
    case 'bird': c = mk(60, 30, (g) => { g.strokeStyle = 'rgba(120,60,90,.7)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(6, 18); g.quadraticCurveTo(18, 2, 30, 18); g.quadraticCurveTo(42, 2, 54, 18); g.stroke(); }); break;
    case 'sprinkle': c = mk(30, 12, (g) => { g.fillStyle = ['#ff6fa8', '#6fc8ff', '#ffd23f'][Math.floor(rnd() * 3)]; g.beginPath(); g.roundRect ? g.roundRect(2, 3, 26, 6, 3) : g.rect(2, 3, 26, 6); g.fill(); }); break;
    case 'comet': c = mk(150, 40, (g) => { const gr = g.createLinearGradient(0, 20, 150, 20); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.95)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 20); g.lineTo(138, 12); g.lineTo(138, 28); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(140, 20, 8, 0, 7); g.fill(); }); break;
    default: c = mk(2, 2, () => {});
  }
  return (SPR[kind] = c);
}
const skyCache = [];
function skyOf(i) {   // 하늘 + 해/달/무지개/오로라 (한 번만 그려 둠)
  if (skyCache[i]) return skyCache[i];
  const T = THEMES[i], R = mulberry32(100 + i);
  return (skyCache[i] = mk(W, H, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, T.sky[0]); gr.addColorStop(0.55, T.sky[1]); gr.addColorStop(1, T.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const glow = (x, y, r, c) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
    const stars = (n, a) => { for (let k = 0; k < n; k++) { g.fillStyle = `rgba(255,255,255,${(a * (0.4 + R() * 0.6)).toFixed(2)})`; g.beginPath(); g.arc(R() * W, R() * H, 0.6 + R() * 1.8, 0, 7); g.fill(); } };
    if (i === 0) { glow(720, 360, 280, 'rgba(255,240,200,.9)'); g.fillStyle = '#fff3c0'; g.beginPath(); g.arc(720, 360, 56, 0, 7); g.fill(); }
    if (i === 1) { stars(150, 0.95); glow(190, 120, 160, 'rgba(255,240,200,.55)'); g.fillStyle = '#fff3c9'; g.beginPath(); g.arc(190, 120, 44, 0, 7); g.fill(); g.fillStyle = THEMES[1].sky[1]; g.beginPath(); g.arc(210, 108, 40, 0, 7); g.fill(); }
    if (i === 3) { glow(480, 400, 360, 'rgba(255,245,190,.85)'); g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(480, 400, 90, 0, 7); g.fill(); g.fillStyle = 'rgba(150,80,150,.35)'; g.beginPath(); g.moveTo(0, 470); for (let x = 0; x <= W; x += 40) g.lineTo(x, 450 - Math.sin(x / 110) * 26 - 20); g.lineTo(W, H); g.lineTo(0, H); g.fill(); }
    if (i === 5) { ['#ff9aa8', '#ffcf8a', '#fff29a', '#a8f0a8', '#9ad4ff', '#c8a8ff'].forEach((c, k) => { g.strokeStyle = c; g.globalAlpha = 0.5; g.lineWidth = 16; g.beginPath(); g.arc(W / 2, 640, 520 - k * 15, Math.PI, 0); g.stroke(); }); g.globalAlpha = 1; }
    if (i === 6) { stars(90, 0.8); [['rgba(120,255,190,.38)', 150], ['rgba(190,140,255,.32)', 230], ['rgba(120,230,255,.25)', 310]].forEach(([c, y0]) => { const ag = g.createLinearGradient(0, y0 - 80, 0, y0 + 120); ag.addColorStop(0, 'rgba(0,0,0,0)'); ag.addColorStop(0.45, c); ag.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ag; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 30) g.lineTo(x, y0 + Math.sin(x / 90 + y0) * 40); g.lineTo(W, y0 + 160); for (let x = W; x >= 0; x -= 30) g.lineTo(x, y0 + 160 + Math.sin(x / 70 + y0) * 30); g.fill(); }); g.fillStyle = 'rgba(220,245,255,.9)'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 30) g.lineTo(x, 480 - Math.abs(Math.sin(x / 130)) * 40); g.lineTo(W, H); g.fill(); }
    if (i === 8) { stars(170, 0.95); glow(220, 150, 220, 'rgba(255,120,200,.35)'); glow(760, 380, 260, 'rgba(100,140,255,.32)'); }
    if (i === 9) { glow(480, 120, 360, 'rgba(255,255,255,.9)'); }
    if (i === 2) { glow(160, 90, 200, 'rgba(255,255,220,.8)'); }
    if (i === 7) { glow(780, 110, 240, 'rgba(255,255,255,.7)'); }
    if (i === 4) { for (let k = 0; k < 30; k++) { g.fillStyle = ['rgba(255,255,255,.7)', 'rgba(255,230,120,.6)', 'rgba(150,210,255,.6)'][k % 3]; g.beginPath(); g.arc(R() * W, R() * H, 2 + R() * 3, 0, 7); g.fill(); } }
  }));
}
// 아래에서 위로 올라갈수록 천천히 내려오는 장식(시차) — 올라가는 느낌
function decoList(i) {
  const T = THEMES[i], R = mulberry32(300 + i), list = [];
  T.deco.forEach((kind) => {
    const n = { cloud: 7, heart: 8, star: 12, island: 3, lolly: 4, balloon: 5, planet: 2, crystal: 3, flake: 18, bubble: 12, bird: 3, sprinkle: 14, comet: 2, sun: 0, sun2: 0, moon: 0, rainbow: 0, aurora: 0 }[kind] || 0;
    for (let k = 0; k < n; k++) list.push({ kind, x: R() * W, y: R() * 900, f: kind === 'cloud' ? 0.12 + R() * 0.2 : kind === 'island' || kind === 'planet' || kind === 'crystal' ? 0.28 + R() * 0.1 : 0.15 + R() * 0.3, s: 0.6 + R() * 0.7, dx: (R() - 0.5) * 12, p: R() * 6 });
  });
  return list;
}
const decoCache = [];
function drawTheme(g, i, a, cam, t) {
  g.globalAlpha = a; g.drawImage(skyOf(i), 0, 0, W, H);
  const L = decoCache[i] || (decoCache[i] = decoList(i)), LOOP = 900;
  for (const d of L) {
    const sp = sprite(d.kind); if (!sp.lw || sp.lw < 4) continue;
    const y = (((d.y + cam * d.f) % LOOP) + LOOP) % LOOP - 180;
    const x = d.x + Math.sin(t * 0.3 + d.p) * 14 + d.dx * t * 0.2;
    const xx = ((x % (W + 240)) + W + 240) % (W + 240) - 120;
    const w = sp.lw * d.s, h = sp.lh * d.s;
    g.globalAlpha = a * (d.kind === 'cloud' ? 0.9 : 1); g.drawImage(sp, xx - w / 2, y - h / 2, w, h);
  }
  g.globalAlpha = 1;
}
const motes = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.2, s: 8 + Math.random() * 20, p: Math.random() * 6 }));

/* ---------- 네트워크 ---------- */
const Net = { offset: 0, rtt: 1e9, me: null, round: -1, s: { status: 'lobby', round: 0, seed: 1, duration: 300, startAt: 0, endsAt: 0 }, friends: new Map(), n: 1, pending: false, rank: null, ok: true, fails: 0 };
const serverNow = () => Date.now() + Net.offset;
const platX = (pl) => (pl.mv ? pl.mv.x0 + Math.sin(serverNow() / 1000 * pl.mv.sp + pl.mv.ph) * pl.mv.r : pl.x);
const hzX = (hz) => (((hz.x0 + hz.d * hz.sp * (serverNow() / 1000)) % (W + 160)) + (W + 160)) % (W + 160) - 80;   // 방해물 위치(모두 같은 시계)
async function post(body, timeout) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), timeout || 9000);
  try { const r = await fetch(API, { method: 'POST', body: JSON.stringify(body), signal: ctl.signal }); return await r.json(); }
  finally { clearTimeout(tm); }
}
function takeClock(t0, t1, now) { const rtt = t1 - t0; if (rtt <= Net.rtt * 1.5 + 50) { Net.rtt = Math.min(Net.rtt, rtt); Net.offset = now + rtt / 2 - t1; } }

let profile = {}; try { profile = JSON.parse(localStorage.getItem('et_profile') || '{}'); } catch (e) { profile = {}; }
const Shop = {   // 코인·구매한 캐릭터·꼬리 효과 (이 크롬북에 저장)
  coins: 0, owned: new Set(), trails: new Set(), trail: 0, dirty: false, free: new URLSearchParams(location.search).has('unlock'),
  load() { try { const o = JSON.parse(localStorage.getItem('et_shop') || '{}'); this.coins = o.coins | 0; this.owned = new Set(o.owned || []); this.trails = new Set(o.trails || []); this.trail = o.trail | 0; } catch (e) {} if (Number.isInteger(profile.skin) && profile.skin >= 10) this.owned.add(profile.skin); },
  save() { try { localStorage.setItem('et_shop', JSON.stringify({ coins: this.coins, owned: [...this.owned], trails: [...this.trails], trail: this.trail })); } catch (e) {} },
  price(i) { return i >= JELLY0 ? (i < 60 ? 0 : i < 70 ? 30 : 50) : [0, 30, 50, 70, 90][Math.floor(i / 10) % 5]; },
  has(i) { return this.free || i < 10 || (i >= JELLY0 && i < 60) || this.owned.has(i); },
  add(n) { this.coins += n; this.dirty = true; },
  flush() { if (this.dirty) { this.dirty = false; this.save(); } },
};
Shop.load();
let skin = Number.isInteger(profile.skin) && profile.skin < NSKIN && Shop.has(profile.skin) ? profile.skin : JELLY0 + Math.floor(Math.random() * 10);
$('nameInput').value = profile.name || '';
const grid = $('skinGrid');
let buyArm = -1;
const setMsg = (t) => { $('joinMsg').textContent = t; };
function refreshShop() {
  $('coinNow').textContent = '🪙 ' + Shop.coins;
  [...grid.children].forEach((b) => { const i = +b.dataset.i; b.classList.toggle('sel', i === skin); b.classList.toggle('locked', !Shop.has(i)); b.querySelector('.lock').textContent = Shop.has(i) ? '' : '🔒' + Shop.price(i); });
  [...$('trailRow').children].forEach((b) => { const k = +b.dataset.k; b.classList.toggle('sel', k === Shop.trail); b.querySelector('i').textContent = k === 0 || Shop.trails.has(k) || Shop.free ? '' : ' 🪙' + b.dataset.p; });
  [...$('teamRow').children].forEach((b) => b.classList.toggle('sel', +b.dataset.k === (profile.team | 0)));
}
const armBuy = (id, text) => { buyArm = id; setMsg(text); sfx('pop'); setTimeout(() => { if (buyArm === id) { buyArm = -1; setMsg(''); } }, 3500); };
const SKORDER = []; for (let i = JELLY0; i < NSKIN; i++) SKORDER.push(i); for (let i = 0; i < JELLY0; i++) SKORDER.push(i);
function refreshPreviews() { [...grid.children].forEach((b) => previewSkin(b.querySelector('canvas'), +b.dataset.i)); }
for (const i of SKORDER) {
  const b = document.createElement('button'); b.className = 'skin'; b.type = 'button'; b.dataset.i = i;
  const c = document.createElement('canvas'); previewSkin(c, i); const lk = document.createElement('span'); lk.className = 'lock'; b.append(c, lk);
  b.onclick = () => {
    unlock();
    if (!Shop.has(i)) {
      const pr = Shop.price(i);
      if (Shop.coins < pr) { setMsg(`🔒 코인 ${pr}개가 필요해요 (지금 ${Shop.coins}개) — 게임에서 🪙을 모아 보세요!`); sfx('wrong'); return; }
      if (buyArm !== i) { armBuy(i, `🪙 ${pr}개로 이 친구를 데려올까요? 한 번 더 누르면 구매!`); return; }
      Shop.coins -= pr; Shop.owned.add(i); Shop.save(); buyArm = -1; setMsg('🎉 새 친구가 생겼어요!'); sfx('correct');
    }
    skin = i; sfx('gift'); refreshShop();
  };
  grid.append(b);
}
[...$('trailRow').children].forEach((b) => {
  b.onclick = () => {
    unlock(); const k = +b.dataset.k, pr = +b.dataset.p;
    if (k && !Shop.trails.has(k) && !Shop.free) {
      if (Shop.coins < pr) { setMsg(`🔒 코인 ${pr}개가 필요해요 (지금 ${Shop.coins}개)`); sfx('wrong'); return; }
      if (buyArm !== 100 + k) { armBuy(100 + k, `🪙 ${pr}개로 살까요? 한 번 더 누르면 구매!`); return; }
      Shop.coins -= pr; Shop.trails.add(k); buyArm = -1; setMsg('🎉 새 효과를 샀어요!'); sfx('correct');
    }
    Shop.trail = k; Shop.save(); sfx('gift'); refreshShop();
  };
});
[...$('teamRow').children].forEach((b) => { b.onclick = () => { profile.team = +b.dataset.k; sfx('pop'); refreshShop(); }; });
refreshShop();
const randId = () => Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

let scene = null;
$('joinBtn').onclick = () => joinGame();
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinGame(); });
async function joinGame() {
  unlock();
  const name = $('nameInput').value.trim();
  if (!name) { $('joinMsg').textContent = '닉네임을 써 주세요!'; return; }
  profile = { name, skin, id: profile.id || randId(), team: profile.team | 0 };
  localStorage.setItem('et_profile', JSON.stringify(profile));
  $('joinBtn').disabled = true; $('joinMsg').textContent = '연결하는 중…';
  try {
    const t0 = Date.now();
    const res = await post({ act: 'sync', id: profile.id, name, skin, x: W / 2, y: 0, tr: [], sq: 0, round: -1, h: 0, c: 0 });
    const t1 = Date.now();
    if (!res || !res.ok) throw new Error('bad');
    takeClock(t0, t1, res.now);
    $('joinBtn').disabled = false; $('joinMsg').textContent = '';
    Net.me = profile;
    $('join').classList.add('hidden'); $('game').classList.remove('hidden');
    applySync(res, true);
    if (!scene) scene = new Scene();
    scene.start(); Music.start();
    schedulePoll(0);
  } catch (e) {
    $('joinBtn').disabled = false; $('joinMsg').textContent = '서버에 연결하지 못했어요. 잠시 후 다시 눌러 주세요!';
  }
}
function schedulePoll(ms) { clearTimeout(Net.timer); Net.timer = setTimeout(poll, ms); }
async function poll() {
  if (!Net.me) return;
  if (Net.pending) { schedulePoll(500); return; }
  Net.pending = true;
  const sc = scene, p = sc.p;
  const tr = sc.trail.splice(0, sc.trail.length).slice(-8), hit = sc.pendingHits.splice(0, 2);
  try {
    const t0 = Date.now();
    const res = await post({ act: 'sync', id: profile.id, name: profile.name, skin: profile.skin, x: Math.round(p.x), y: Math.round(p.y), tr, sq: sc.sq, round: Net.round, h: sc.best, c: sc.correct, bo: sc.bo, mx: sc.maxCombo, wq: sc.wq, hit, em: sc.em ? sc.em.n : 0, emq: sc.emq, tm: profile.team | 0 });
    const t1 = Date.now();
    if (res && res.ok) { takeClock(t0, t1, res.now); applySync(res, false); Net.fails = 0; if (!Net.ok) { Net.ok = true; sc.toast('📡 다시 연결됐어요!'); } }
  } catch (e) {
    sc.trail.unshift(...tr); sc.pendingHits.unshift(...hit);
    if (++Net.fails === 3) { Net.ok = false; sc.toast('📡 연결이 불안해요… 다시 연결하는 중', 3500); }
  }
  Net.pending = false;
  schedulePoll(1300 + Math.random() * 250);
}
function applySync(res, first) {
  const prev = Net.s; Net.s = res.s; Net.n = res.n; Net.rank = res.rank || null;
  const seen = new Set();
  for (const [id, name, sk, x, y, tr, sq, sc, em] of res.p) {
    seen.add(id);
    let f = Net.friends.get(id);
    if (!f) { f = { id, name, skin: sk, x, y, from: { x, y, a: 0, f: 0 }, q: [], prog: 0, lastSq: sq, cur: { x, y, a: 0, f: 0 } }; Net.friends.set(id, f); }
    f.name = name; f.skin = sk; f.score = sc | 0; f.em = em | 0;
    const k = Math.min(Math.max(0, sq - f.lastSq), (tr || []).length);
    if (k > 0) { tr.slice(tr.length - k).forEach((s) => f.q.push({ x: s[0], y: s[1], a: s[2], f: s[3], e: s[4] | 0 })); f.lastSq = sq; }
    else if (!f.q.length && (Math.abs(f.cur.x - x) > 40 || Math.abs(f.cur.y - y) > 40)) { f.q.push({ x, y, a: 0, f: f.cur.f }); }
    if (f.q.length > 14) f.q.splice(0, f.q.length - 6);
  }
  for (const id of [...Net.friends.keys()]) if (!seen.has(id)) Net.friends.delete(id);
  Net.aw = res.aw || null;
  if (scene && res.hits && res.hits.length) for (const h of res.hits) scene.getHit(h[0], h[1]);
  if (scene && scene.started) scene.onSession(prev, first);
  if (first) Net.round = res.s.round;
}
Net.getRound = () => Net.round;

/* ---------- 퀴즈 ---------- */
const Quiz = {
  deck: [], open: false, locked: true, cur: null, onDone: null,
  next() { if (!this.deck.length) { this.deck = QS.map((_, i) => i); for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; } } const i = this.deck.pop(); this.curIdx = i; return QS[i]; },
  show(tag, onDone) {
    const q = this.next(); this.cur = q; this.onDone = onDone; this.open = true; this.locked = false;
    $('qTag').textContent = tag; $('qQ').textContent = q.q; $('qKo').textContent = q.ko ? '💡 ' + q.ko : ''; $('qFeed').textContent = '';
    const opts = [q.a, ...q.w].map((t, i) => ({ t, ok: i === 0 })); for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    this.opts = opts;
    const box = $('qChoices'); box.innerHTML = '';
    opts.forEach((o, i) => { const b = document.createElement('button'); const n = document.createElement('b'); n.textContent = i + 1; b.append(n, document.createTextNode(o.t)); b.onclick = () => this.pick(i); box.append(b); });
    $('quiz').classList.remove('hidden');
  },
  pick(i) {
    if (this.locked || !this.open) return; this.locked = true;
    const ok = this.opts[i].ok, bs = $('qChoices').children;
    [...bs].forEach((b, k) => { b.disabled = true; if (this.opts[k].ok) b.classList.add('ok'); });
    if (!ok) bs[i].classList.add('no');
    $('qFeed').textContent = ok ? `🎉 정답! ⭐ +${GAME.pointsPer}점` : '😢 아쉬워요! 초록색이 정답이에요.';
    sfx(ok ? 'correct' : 'wrong');
    const cb = this.onDone;
    setTimeout(() => { this.hide(); cb && cb(ok); }, ok ? 900 : 1900);
  },
  hide() { this.open = false; this.locked = true; $('quiz').classList.add('hidden'); },
};
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter' && scene) scene.useRetry();
  if (Quiz.open && /^[1-3]$/.test(e.key)) Quiz.pick(+e.key - 1);
  else if (!Quiz.open && /^[1-4]$/.test(e.key) && scene && !$('game').classList.contains('hidden')) scene.emote(+e.key);
  if ((e.code === 'KeyX' || e.code === 'KeyZ') && !e.repeat && scene && !Quiz.open) scene.useItem();
  if (e.key === 'm' || e.key === 'M') $('muteBtn').click();
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !$('game').classList.contains('hidden')) e.preventDefault();
});

/* ---------- 게임 장면 ---------- */
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; if (!e.repeat && (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW')) Scene.jumpPressed = performance.now(); });
window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') Scene.jumpReleased = true; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

class Scene {
  constructor() {
    this.p = { x: W / 2, y: -2, vx: 0, vy: 0, flip: false, anim: 0, ground: false };
    this.camY = -460; this.t = 0; this.started = false;
    this.energy = 100; this.best = 0; this.correct = 0; this.jumps = 0; this.coyote = -1e9; this.jumpBuf = -1e9; this.lastGroundY = 0; this.safeZ = 0;
    this.trail = []; this.sq = 0; this.trailAt = 0; this.lastQuizAt = 0; this.quizBusy = false;
    this.gifts = new Map(); this.freeze = false; this.countN = null; this.hudAt = 0; this.toastT = null; this.lastStatus = 'lobby';
    this.lives = 3; this.retry = null; this.rise = null; this.bal = null; this.wing = null; this.plummet = null; this.taken = new Map(); this.lastGroundX = W / 2;
    this.wasGround = false; this.prevVy = 0; this.shake = 0; this.puffs = []; this.bs = 0; this.bv = 0; this.fallFx = 0; this.whooshed = false;
    this.cr = new Map(); this.coinTaken = new Set(); this.wrongIdx = new Set(); this.pendingHits = []; this.tf = [];
    this.em = null; this.emq = 0; this.feedAt = 0; this.darkA = 0; this.tfAcc = 0; this.evSeen = Net.s.ev ? Net.s.ev.id : null;
    this.resetRun();
  }
  resetRun() {
    this.combo = 0; this.maxCombo = 0; this.bo = 0; this.runCoins = 0; this.item = null; this.pendingHits.length = 0;
    this.slowUntil = 0; this.slowF = 1; this.kb = null; this.invUntil = 0; this.gateDone = 0; this.wq = {};
    this.cr.clear(); this.coinTaken.clear(); this.wrongIdx.clear();
  }
  goldOn() { const ev = Net.s.ev; return !!(ev && ev.k === 'gold' && serverNow() < ev.until && Net.s.status === 'play'); }
  moonOn() { const ev = Net.s.ev; return !!(ev && ev.k === 'moon' && serverNow() < ev.until && Net.s.status === 'play'); }
  applyEvent(ev) {
    if (ev.k === 'gold') { this.toast('⚡ 골든타임! 30초 동안 점수 2배!', 2400); this.feed('⚡ 선생님 이벤트: 골든타임!'); sfx('win'); }
    else if (ev.k === 'moon') { this.toast('🌙 달나라 중력! 몸이 둥실둥실~', 2400); this.feed('🌙 선생님 이벤트: 달나라 중력!'); sfx('boing'); }
    else if (ev.k === 'balloon') {
      this.feed('🎈 선생님 이벤트: 모두 풍선!');
      if (!this.frozen && !this.rise && !this.plummet) { this.bal = { t: 0, ev: true }; this.wing = null; this.jumps = 1; this.toast('🎈 모두에게 풍선 선물! 둥실둥실~', 1800); sfx('gift'); }
    }
  }
  feed(text) { const box = $('feed'); const d = document.createElement('div'); d.textContent = text; box.append(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), 3400); }
  emote(n) { if (!this.started || Quiz.open) return; const now = performance.now(); if (this.em && now - this.em.t < 700) return; this.em = { n, t: now }; this.emq++; sfx('pop'); }
  getHit(from, type) {
    const bolt = type === 'bolt'; this.slowUntil = performance.now() + (bolt ? 2600 : 2000); this.slowF = bolt ? 0.18 : 0.45;
    this.feed(`${bolt ? '⚡' : '❄️'} ${iga(from)} ${bolt ? '번개를 쐈어요!' : '얼렸어요!'}`); sfx('ice'); this.shake = 0.15;
  }
  useItem() {
    if (!this.item || this.frozen || !this.running || this.rise) return;
    const my = this.best + this.correct * GAME.pointsPer + this.bo; let tgt = null;
    for (const f of Net.friends.values()) { const sc = f.score | 0; if (sc <= my) continue; if (this.item === 'bolt') { if (!tgt || sc > tgt.score) tgt = f; } else if (!tgt || sc < tgt.score) tgt = f; }
    if (!tgt) { this.toast('앞에 친구가 없어요! (내가 1등이에요)', 1500); return; }
    this.pendingHits.push({ to: tgt.id, t: this.item }); this.feed(`${this.item === 'bolt' ? '⚡' : '❄️'} ${tgt.name}에게 ${this.item === 'bolt' ? '번개!' : '얼음!'}`); sfx('ice'); this.item = null;
  }
  chaseInfo(my) { let above = null, rank = 1, n = 1; for (const f of Net.friends.values()) { n++; const sc = f.score | 0; if (sc > my) { rank++; if (!above || sc < above.score) above = f; } } return { above, rank, n }; }
  overtake(my) {
    const now = performance.now();
    for (const f of Net.friends.values()) {
      const d = (f.score | 0) - my;
      if (f.ah === undefined) { f.ah = d > 0; continue; }
      if (!f.ah && d > 4) { f.ah = true; if (d < 80 && now - this.feedAt > 1800) { this.feedAt = now; this.feed(`💨 ${iga(f.name)} 나를 추월!`); } }
      else if (f.ah && d < -4) { f.ah = false; if (-d < 80 && now - this.feedAt > 1800) { this.feedAt = now; this.feed(`🎉 ${eulreul(f.name)} 추월했어요!`); } }
    }
  }
  comboFx() {
    const c = this.combo;
    this.toast(`🔥 ${c}콤보! 점프가 더 높아져요`, 1600); this.burst(this.p.x, this.p.y - 30, 14);
    if (c === 5 || (c > 5 && c % 5 === 0)) { this.item = 'bolt'; this.feed('⚡ 번개 획득! X키로 1등을 느리게!'); }
    else if (c % 3 === 0 && this.item !== 'bolt') { this.item = 'ice'; this.feed('❄️ 얼음 획득! X키로 앞 친구를 느리게!'); }
  }
  crTouch(pl) { const t = performance.now(), st = this.cr.get(pl.id); if (st === undefined || t - st > 4800) this.cr.set(pl.id, t); }
  crGone(pl) { const st = this.cr.get(pl.id); if (st === undefined) return false; const el = performance.now() - st; return el > 900 && el <= 4800; }
  updateTrail(dt) {
    const p = this.p, moving = Math.abs(p.vx) > 20 || !p.ground;
    this.tfAcc += dt;
    if (this.tfAcc > 0.045 && !this.frozen) {
      this.tfAcc = 0;
      if (this.combo >= 3) this.tf.push({ x: p.x + (Math.random() - 0.5) * 16, y: p.y - 4, vy: -50 - Math.random() * 40, l: 0.45, k: 'f' });
      if (Shop.trail && moving) this.tf.push({ x: p.x + (Math.random() - 0.5) * 12, y: p.y - 14 + Math.random() * 8, vy: 20, l: 0.6, k: Shop.trail, h: Math.random() });
    }
    for (let i = this.tf.length - 1; i >= 0; i--) { const q = this.tf[i]; q.l -= dt; if (q.l <= 0) this.tf.splice(i, 1); else q.y += q.vy * dt; }
    if (this.tf.length > 60) this.tf.splice(0, this.tf.length - 60);
  }
  start() {
    this.started = true; this.last = performance.now();
    const place = () => { this.p.x = W / 2 + (Math.random() - 0.5) * 360; this.p.y = -2; };
    place(); this.camY = -460;
    if (!this.raf) { const loop = (now) => { this.raf = requestAnimationFrame(loop); this.frame(now); }; this.raf = requestAnimationFrame(loop); }
  }
  toast(text, ms) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('show'), ms || 1800); }
  center(text, small) { const el = $('center'); if (!text) { el.classList.add('hidden'); return; } el.textContent = text; el.classList.toggle('small', !!small); el.classList.remove('hidden'); }
  teleport(x, y) { this.rise = this.plummet = this.bal = this.wing = this.retry = null; this.lastGroundX = x; this.p.x = x; this.p.y = y; this.p.vx = 0; this.p.vy = 0; this.lastGroundY = y; this.safeZ = zoneOf(y); this.camY = Math.min(y - 330, -460); }
  onSession(prev, first) {
    const s = Net.s;
    if (!first && s.round !== Net.round) {   // 새 판 시작
      Net.round = s.round;
      this.best = 0; this.correct = 0; this.gifts.clear(); this.taken.clear(); this.jumps = 0; this.lives = 3; this.resetRun();
      this.teleport(W / 2 + (Math.random() - 0.5) * 360, -2);
      if (Quiz.open) Quiz.hide(); this.quizBusy = false;
      this.lastQuizAt = performance.now() + Math.max(0, s.startAt - serverNow());
      $('result').classList.add('hidden');
    }
    if (s.status === 'lobby') { $('result').classList.add('hidden'); if (this.lastStatus !== 'lobby') { this.best = 0; this.correct = 0; this.energy = 100; this.lives = 3; this.taken.clear(); this.resetRun(); } }
    if (s.status === 'ended' && this.lastStatus !== 'ended') { if (Quiz.open) Quiz.hide(); this.quizBusy = false; }
    this.lastStatus = s.status;
  }
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    const s = Net.s, sNow = serverNow();
    const countdown = s.status === 'play' && sNow < s.startAt;
    const running = s.status === 'play' && !countdown;
    this.running = running;
    this.frozen = this.quizBusy || countdown || s.status === 'ended';
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    for (let i = 0; i < steps; i++) this.physics(h, running);
    if (running) {
            const hh = heightOf(this.p.y); if (hh > this.best) { if (this.goldOn()) this.bo += hh - this.best; this.best = hh; }
      if (!this.quizBusy && now - this.lastQuizAt > GAME.quizEvery * 1000) this.openQuiz('⏰ 퀴즈 타임!');
      const gk = Math.floor(hh / 50);
      if (gk > this.gateDone && !this.quizBusy && !this.rise && !this.plummet) { this.gateDone = gk; this.openQuiz(`🚪 ${gk * 50}m 문 퀴즈!`, true); }
      const ev = s.ev; if (ev && ev.id !== this.evSeen) { this.evSeen = ev.id; if (sNow < ev.until) this.applyEvent(ev); }
    }
    if (now - this.trailAt > 300) { this.trailAt = now; this.sq++; this.trail.push([Math.round(this.p.x), Math.round(this.p.y), this.p.anim, this.p.flip ? 1 : 0, this.fxId()]); if (this.trail.length > 20) this.trail.shift(); }
    this.bv += (-this.bs * 420 - this.bv * 5.2) * dt; this.bs += this.bv * dt; if (Math.abs(this.bs) < 0.003 && Math.abs(this.bv) < 0.08) { this.bs = 0; this.bv = 0; }
    if (this.p.vy > 520 && !this.p.ground) this.fallFx = Math.min(1, this.fallFx + dt * 6); else this.fallFx = Math.max(0, this.fallFx - dt * 5);
    const zc = zoneOf(this.p.y); if (zc !== this.zoneShown) { if (this.zoneShown !== undefined && zc > 0) { const th = mapOf(Net.s.seed, zc); this.toast(`🌈 ${THEME_NAMES[th]}에 도착! (${heightOf(this.p.y)}m)` + (ZFX_MSG[th] ? ' · ' + ZFX_MSG[th] : ''), 2800); sfx('gift'); } this.zoneShown = zc; }
    this.updateFriends(dt); this.updateTrail(dt);
    this.camY += (Math.min(this.p.y - 330, -460) - this.camY) * Math.min(1, dt * (this.plummet ? 16 : 7));
    if (this.retry && this.p.y < -320) this.retry = null;
    this.render();
    if (now - this.hudAt > 120) { this.hudAt = now; this.hud(sNow, countdown, running); Shop.flush(); }
    Scene.jumpReleased = false;
  }
  fxId() { return this.bal ? 1 : (this.wing || this.rise) ? 2 : 0; }
  physics(dt, running) {
    const p = this.p, k = keys;
    if (this.rise) { this.stepRise(dt); return; }
    if (this.plummet) { this.stepPlummet(dt); return; }
    let ix = 0;
    if (!this.frozen) { if (k.ArrowLeft || k.KeyA) ix -= 1; if (k.ArrowRight || k.KeyD) ix += 1; }
    const t = performance.now();
    const fxz = ZFX[mapOf(Net.s.seed, zoneOf(p.y))] || {};
    const slow = this.slowUntil > t ? this.slowF : 1, tvx = ix * PHYS.speed * slow;
    if (fxz.slip && !this.frozen) p.vx += (tvx - p.vx) * Math.min(1, dt * 3.2); else p.vx = tvx;
    let windV = fxz.wind && !this.frozen ? Math.sin(serverNow() / 1000 * 0.6) * fxz.wind : 0;
    if (ix) p.flip = ix < 0;
    const jb = this.combo >= 5 ? 1.09 : this.combo >= 3 ? 1.05 : 1;
    if (this.ridePl && this.wasGround && !this.frozen) { const nx = platX(this.ridePl); if (this.rideX !== undefined) p.x += nx - this.rideX; this.rideX = nx; if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W; } else { this.rideX = undefined; if (!this.wasGround) this.ridePl = null; }
    if (!this.frozen) {
      if (Scene.jumpPressed) { this.jumpBuf = Scene.jumpPressed; Scene.jumpPressed = 0; }
      if (t - this.jumpBuf < 120 && !this.bal && !(this.wing && this.wing.t < 1.5)) {
        if (t - this.coyote < 90 && this.jumps === 0) { p.vy = -PHYS.jump * jb; this.jumps = 1; this.jumpBuf = -1e9; this.coyote = -1e9; sfx('jump'); this.bs = 0.12; this.bv = 9; }
        else if (this.jumps < 2 && !p.ground) {
          { p.vy = -PHYS.djump * jb; this.jumps = 2; this.jumpBuf = -1e9; sfx('djump'); this.bs = 0.1; this.bv = 8; this.burst(p.x, p.y + 4, 8); }
        }
      }
      if (Scene.jumpReleased && p.vy < -400 && !this.bal && !this.wing) p.vy = -400;
    } else p.vx = 0;
    const py = p.y;
    let grav = true;
    if (this.bal && !this.frozen) {   // 🎈 둥실둥실 떠오르다가 뻥! 하고 쓩~ 내려와요
      const b = this.bal; b.t += dt;
      if (b.t < 1.7) { p.vy = -Math.min(430, 120 + b.t * 1400); grav = false; this.jumps = 1; }
      else { this.bal = null; p.vy = b.ev ? 320 : 780; this.jumps = 2; sfx('whoosh'); this.shake = 0.2; this.burst(p.x, p.y - 100, 14); this.toast('🎈 뻥! 쓩~ 내려가요!', 1500); }
    }
    if (this.wing && !this.frozen) {   // 🪽 날개: 슝 올라간 뒤 잠시 두둥실 날아요
      const w = this.wing; w.t += dt;
      if (w.t < 1.5) { p.vy = -Math.min(660, 150 + w.t * 1800); grav = false; this.jumps = 1; }
      else if (w.t > 4.2) { this.wing = null; this.toast('날개가 사라졌어요', 1200); }
    }
    const gm = (fxz.low ? 0.62 : 1) * (this.moonOn() ? 0.5 : 1);
    if (grav) p.vy = Math.min(this.wing && this.wing.t >= 1.5 ? 140 : 950, p.vy + PHYS.g * gm * dt);
    if (this.kb) { windV += this.kb.vx * (this.kb.t / 0.35); this.kb.t -= dt; if (this.kb.t <= 0) this.kb = null; }
    p.x += (p.vx + windV) * dt; p.y += p.vy * dt;
    if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W;   // 왼쪽 끝으로 나가면 오른쪽에서, 오른쪽 끝으로 나가면 왼쪽에서
    p.ground = false;
    {
      const z = zoneOf(p.y);
      for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) {
        const Z = buildZone(Net.s.seed, zz);
        if (p.vy >= 0) for (const pl of Z.plats) {
          if (pl.cr && this.crGone(pl)) continue;
          const px = platX(pl);
          if (py <= pl.y + 5 && p.y >= pl.y && p.x + 15 > px && p.x - 15 < px + pl.w) { p.y = pl.y; p.vy = 0; p.ground = true; this.ridePl = pl.mv ? pl : null; if (pl.cr) this.crTouch(pl); }
        }
        for (const sp of Z.springs) if (p.vy >= 0 && Math.abs(p.x - sp.x) < 18 && p.y >= sp.y - 10 && py <= sp.y + 4 && !this.frozen) { p.vy = -PHYS.spring; this.jumps = 1; this.coyote = -1e9; sp.t = this.t; this.bs = 0.15; this.bv = 11; sfx('boing'); this.burst(sp.x, sp.y - 6, 10); }
      }
    }
    if (p.ground) {
      if (!this.wasGround && this.prevVy > 200) { this.bs = -Math.min(0.55, 0.16 + this.prevVy / 2000); this.bv = 0; if (this.prevVy > 480) this.burst(p.x, p.y, 5 + Math.min(8, this.prevVy / 150 | 0)); if (this.prevVy > 800) { this.shake = 0.15; } }
      this.whooshed = false;
      this.coyote = t; this.jumps = 0; this.lastGroundY = p.y; this.lastGroundX = p.x; this.safeZ = zoneOf(p.y);
    }
    this.wasGround = p.ground; this.prevVy = p.vy;
    if (!p.ground && p.vy > 640 && !this.whooshed) { this.whooshed = true; sfx('whoosh'); this.fallFx = 1; }
    p.anim = !p.ground ? (p.vy < 0 ? 2 : 3) : Math.abs(p.vx) > 10 ? 1 : 0;
    // 선물 상자
    if (!this.frozen) {
      const z = zoneOf(p.y);
      for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) for (const g of buildZone(Net.s.seed, zz).gifts) {
        if (this.gifts.get(g.id) > t) continue;
        if (Math.abs(p.x - g.x) < 26 && Math.abs((p.y - 16) - g.y) < 30) {
          if (!running) { if (!this.hintAt || t - this.hintAt > 3000) { this.hintAt = t; this.toast('🎁 게임이 시작되면 열 수 있어요'); } continue; }
          this.gifts.set(g.id, t + GAME.giftRespawn); sfx('gift'); Shop.add(COIN.gift); this.runCoins += COIN.gift; this.openQuiz('🎁 선물 상자 퀴즈!');
        }
      }
    }
    // 풍선·새 알 먹기
    if (!this.frozen) {
      const z = zoneOf(p.y);
      for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) for (const it of buildZone(Net.s.seed, zz).items) {
        if (this.taken.get(it.id) > t) continue;
        if (Math.abs(p.x - it.x) < 30 && Math.abs((p.y - 22) - it.y) < 38) {
          this.taken.set(it.id, t + 25000); sfx('gift'); this.burst(it.x, it.y, 12); this.jumps = 1;
          if (it.k === 'b') { this.bal = { t: 0 }; this.wing = null; this.toast('🎈 풍선을 먹었어요! 둥실둥실~', 1600); }
          else { this.wing = { t: 0 }; this.bal = null; this.toast('🥚 새 알이 부화! 날개가 생겼어요! 슝~', 1600); }
        }
      }
    }
    // 코인 · 날아다니는 방해물
    if (!this.frozen && running) {
      const z = zoneOf(p.y);
      for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) {
        const Z = buildZone(Net.s.seed, zz);
        for (const cn of Z.coins) {
          if (this.coinTaken.has(cn.id)) continue;
          if (Math.abs(p.x - cn.x) < 26 && Math.abs((p.y - 22) - cn.y) < 34) { this.coinTaken.add(cn.id); this.runCoins++; Shop.add(1); sfx('coin'); this.burst(cn.x, cn.y, 5); }
        }
        if (t > this.invUntil && !this.rise && !this.plummet) for (const hz of Z.hz) {
          const hx = hzX(hz);
          if (Math.abs(p.x - hx) < 30 && Math.abs((p.y - 24) - hz.y) < 26) {
            this.invUntil = t + 1300; this.kb = { vx: (p.x < hx ? -1 : 1) * 420, t: 0.35 }; p.vy = -230; this.bs = -0.25; this.bv = 0; sfx('bonk'); this.shake = 0.2; this.burst(p.x, p.y - 20, 8);
            this.feed(hz.k === 'bird' ? '🐦 새에 부딪혔어요!' : hz.k === 'rock' ? '☄️ 운석에 부딪혔어요!' : '⛄ 눈덩이에 맞았어요!');
          }
        }
      }
    }
    // 받침 없이 멀리 떨어지면 슈웅~ 바닥까지!
    if (!p.ground && p.vy > 300 && !this.frozen && !this.bal && !this.wing && this.lastGroundY < -250 && p.y > this.lastGroundY + 460 && !this.platBelow(190)) {
      this.plummet = { ox: this.lastGroundX, oy: this.lastGroundY, v: Math.max(p.vy, 800) };
      sfx('whoosh'); this.fallFx = 1; this.whooshed = true; this.toast('슈웅~ 바닥까지!', 1500); p.vx = 0; p.anim = 3;
    }
  }
  platBelow(d) {   
    const p = this.p, z = zoneOf(p.y);
    for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) for (const pl of buildZone(Net.s.seed, zz).plats) if (pl.y >= p.y && pl.y - p.y < d && p.x + 15 > platX(pl) && p.x - 15 < platX(pl) + pl.w) return true;
    return false;
  }
  stepPlummet(dt) {
    const p = this.p, pm = this.plummet;
    pm.v = Math.min(2600, pm.v + 5200 * dt); p.vy = pm.v; p.y += pm.v * dt; p.anim = 3; this.fallFx = 1;
    if (p.y >= 0) {
      p.y = 0; p.vy = 0; p.ground = true; this.plummet = null; this.jumps = 0; this.lastGroundY = 0; this.lastGroundX = p.x; this.coyote = performance.now();
      sfx('thud'); this.shake = 0.5; this.burst(p.x, 0, 16); this.bs = -0.45; this.bv = 0; this.fallFx = 0; this.camY = Math.min(p.y - 330, -460);
      if (pm.oy < -250) {
        if (this.lives > 0) { this.retry = { x: pm.ox, y: pm.oy }; this.toast(`❤️ 생명을 쓰면 ${heightOf(pm.oy)}m 원래 자리로 올라가요!`, 3200); }
        else this.toast('생명이 없어요 😢 다시 처음부터 올라가요!', 2600);
      }
    }
  }
  useRetry() {
    if (!this.retry || this.lives <= 0 || this.frozen || this.rise) return;
    const p = this.p, r = this.retry; this.lives--; this.retry = null;
    const dist = Math.hypot(r.x - p.x, r.y - p.y);
    this.rise = { fx: p.x, fy: p.y, tx: r.x, ty: r.y, t: 0, dur: clamp(dist / 1500, 1.4, 3.2) };
    sfx('gift'); this.toast('❤️ 생명 1개 사용! 날아서 올라가요~', 1800);
  }
  stepRise(dt) {
    if (this.frozen) return;
    const p = this.p, r = this.rise; r.t += dt; const u = Math.min(1, r.t / r.dur), e = u * u * (3 - 2 * u);
    p.x = r.fx + (r.tx - r.fx) * e; p.y = r.fy + (r.ty - r.fy) * e; p.vx = 0; p.vy = -200; p.anim = 2; this.fallFx = 0; this.whooshed = false;
    if (Math.random() < 0.5) this.puffs.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + 4, vx: (Math.random() - 0.5) * 40, vy: 60, l: 0.4 });
    if (u >= 1) {
      p.y = r.ty; p.x = r.tx; p.vy = 0; p.ground = true; this.rise = null; this.jumps = 0; this.lastGroundY = r.ty; this.lastGroundX = r.tx; this.coyote = performance.now();
      sfx('gift'); this.burst(p.x, p.y, 10); this.toast('원래 자리로 돌아왔어요! 💪', 1500);
    }
  }
  burst(x, y, n) { for (let i = 0; i < n; i++) this.puffs.push({ x, y, vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 120, l: 0.4 }); }
  openQuiz(tag, gate) {
    if (this.quizBusy || !QS.length) return;
    this.quizBusy = true; this.p.vx = 0;
    Quiz.show(tag, (ok) => {
      const qi = Quiz.curIdx;
      if (ok) {
        this.correct++; this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        const gain = gate ? COIN.gate : COIN.answer; Shop.add(gain); this.runCoins += gain;
        if (this.goldOn()) this.bo += GAME.pointsPer;
        if (this.lives < 5) { this.lives++; this.toast('❤️ 생명 +1!', 1400); }
        if (this.combo >= 3) this.comboFx();
      } else {
        this.combo = 0; this.wq[qi] = (this.wq[qi] || 0) + 1; this.wrongIdx.add(qi);
        if (gate) { this.lives = Math.max(0, this.lives - 1); this.toast('🚪 문이 닫혔어요… ❤️ -1', 1800); }
      }
      this.quizBusy = false; this.lastQuizAt = performance.now();
    });
  }
  updateFriends(dt) {
    for (const f of Net.friends.values()) {
      const q = f.q;
      f.bv = (f.bv || 0) + (-(f.bs || 0) * 420 - (f.bv || 0) * 5.2) * dt; f.bs = (f.bs || 0) + f.bv * dt;
      if (q.length) {
        const speed = 1 + Math.max(0, q.length - 5) * 0.35;
        f.prog += dt / 0.3 * speed;
        while (f.prog >= 1 && q.length) { const pa = f.from.a; f.from = { ...q[0] }; q.shift(); f.prog -= 1; if (!q.length) f.prog = 0; if (f.from.a === 2 && pa !== 2) { f.bs = 0.12; f.bv = 9; } else if (pa === 3 && f.from.a < 2) { f.bs = -0.5; f.bv = 0; } }
        if (q.length) {
          const a = f.from, b = q[0];
          if (Math.abs(b.x - a.x) > 300 || Math.abs(b.y - a.y) > 300) { f.cur = { x: b.x, y: b.y, a: b.a, f: b.f, e: b.e }; f.from = { ...b }; f.prog = 0; q.shift(); }
          else f.cur = { x: a.x + (b.x - a.x) * f.prog, y: a.y + (b.y - a.y) * f.prog, a: b.a, f: b.f, e: b.e };
        } else f.cur = { ...f.from };
      }
    }
  }
  /* ----- 그리기 ----- */
  render() {
    const g = ctx, cam = this.camY, p = this.p, s = Net.s;
    g.setTransform(RES, 0, 0, RES, 0, 0);
    const ox = this.shake > 0 ? (Math.random() - 0.5) * 8 * this.shake * 6 : 0; this.shake = Math.max(0, this.shake - 0.016);
    // 배경: 구역마다 다른 하늘, 경계에서 부드럽게 섞기
    const u = -(cam + 270) / ZONE_H, zi = Math.max(0, Math.floor(u)), f = u - zi;
    drawTheme(g, mapOf(s.seed, zi), 1, cam, this.t);
    if (f > 0.86) drawTheme(g, mapOf(s.seed, zi + 1), (f - 0.86) / 0.14, cam, this.t);
    // 반짝이 먼지
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (const m of motes) { m.y -= m.s * 0.016; m.x += Math.sin(this.t + m.p) * 0.15; if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; } g.globalAlpha = 0.35 + 0.35 * Math.sin(this.t * 2 + m.p); g.beginPath(); g.arc(m.x, m.y, m.r, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.save(); g.translate(ox, -cam);
    const z0 = zoneOf(cam + 270);
    for (let zz = Math.max(0, z0 - 1); zz <= z0 + 1; zz++) {
      const Z = buildZone(s.seed, zz);
      for (const pl of Z.plats) if (pl.y > cam - 60 && pl.y < cam + H + 60) this.drawPlat(g, pl.mv ? { ...pl, x: platX(pl) } : pl, zz);
      for (const sp of Z.springs) if (sp.y > cam - 60 && sp.y < cam + H + 60) this.drawSpring(g, sp);
      for (const it of Z.items) if (it.y > cam - 60 && it.y < cam + H + 60 && !(this.taken.get(it.id) > performance.now())) this.drawItem(g, it);
      for (const gf of Z.gifts) if (gf.y > cam - 60 && gf.y < cam + H + 60 && !(this.gifts.get(gf.id) > performance.now())) this.drawGift(g, gf);
      for (const cn of Z.coins) if (cn.y > cam - 60 && cn.y < cam + H + 60 && !this.coinTaken.has(cn.id)) this.drawCoin(g, cn);
      for (const hz of Z.hz) if (hz.y > cam - 60 && hz.y < cam + H + 60) this.drawHazard(g, hz);
    }
    this.drawGates(g, cam);
    let lead = 0; for (const fr of Net.friends.values()) lead = Math.max(lead, fr.score || 0);
    const myScore = this.best + this.correct * GAME.pointsPer, meCrown = s.status === 'play' && myScore > 0 && myScore >= lead; if (!(s.status === 'play')) lead = 0; else if (meCrown) lead = Math.max(lead, myScore);
    for (const fr of Net.friends.values()) {
      const c = fr.cur; if (c.y < cam - 80 || c.y > cam + H + 80) continue;
      const crowned = lead > 0 && fr.score === lead;
      for (const off of (c.x < 50 ? [0, W] : c.x > W - 50 ? [0, -W] : [0])) {
        if (c.e === 2) this.drawWings(g, c.x + off, c.y, this.t + fr.x);
        g.globalAlpha = 0.86; drawChar(g, fr.skin, c.x + off, c.y, { t: this.t + fr.x, anim: c.a, flip: !!c.f, scale: 1.25, bs: (fr.bs || 0) + (c.a === 3 ? 0.08 : 0), bv: fr.bv || 0 }); g.globalAlpha = 1;
        if (c.e === 1) this.drawBalloon(g, c.x + off, c.y, this.t + fr.x);
        if (crowned) this.drawCrown(g, c.x + off, c.y - 50, this.t);
      }
      this.label(g, fr.name, c.x, c.y - (crowned ? 92 : 68), '#ffffff');
      if (fr.em) this.drawEmote(g, c.x, c.y - (crowned ? 122 : 98), fr.em);
    }
    if (this.fallFx > 0.05) {   // 슈웅~ 떨어지는 속도선
      g.save(); g.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const lx = p.x + (k - 3) * 9 + Math.sin(this.t * 40 + k) * 2, len = 40 + (k % 3) * 22 + Math.min(80, p.vy / 12);
        g.strokeStyle = `rgba(255,255,255,${(0.55 * this.fallFx).toFixed(2)})`; g.lineWidth = 3; g.beginPath(); g.moveTo(lx, p.y - 50 - ((k * 37) % 30)); g.lineTo(lx, p.y - 50 - ((k * 37) % 30) - len); g.stroke(); }
      g.restore();
    }
    const fx = this.fxId(); this.drawTrail(g);
    g.globalAlpha = (this.invUntil > performance.now() && Math.floor(this.t * 14) % 2) ? 0.45 : 1;
    for (const off of (p.x < 50 ? [0, W] : p.x > W - 50 ? [0, -W] : [0])) { if (fx === 2) this.drawWings(g, p.x + off, p.y, this.t); drawChar(g, profile.skin, p.x + off, p.y, { t: this.t, anim: p.anim, flip: p.flip, scale: 1.35, bs: this.bs + (p.ground ? 0 : clamp(-p.vy / 2600, -0.12, 0.16)), bv: this.bv }); if (fx === 1) this.drawBalloon(g, p.x + off, p.y, this.t); if (meCrown) this.drawCrown(g, p.x + off, p.y - 50, this.t); }
    g.globalAlpha = 1; this.drawFrozen(g);
    if (this.fallFx > 0.5) { g.save(); g.globalAlpha = Math.min(1, this.fallFx); g.font = '900 26px "Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#7a62c8'; g.strokeText('슈웅~', p.x + 52, p.y - 90); g.fillStyle = '#fff'; g.fillText('슈웅~', p.x + 52, p.y - 90); g.restore(); }
    this.label(g, profile.name, p.x, p.y - (meCrown ? 96 : 72), '#ffe27a');
    if (this.em && performance.now() - this.em.t < 2400) this.drawEmote(g, p.x, p.y - (meCrown ? 126 : 102), this.em.n);
    for (let i = this.puffs.length - 1; i >= 0; i--) { const q = this.puffs[i]; q.l -= 0.016; if (q.l <= 0) { this.puffs.splice(i, 1); continue; } q.x += q.vx * 0.016; q.y += q.vy * 0.016; g.globalAlpha = q.l * 2; g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, 3 + (0.4 - q.l) * 8, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.restore();
    this.drawFog(g);
  }
  label(g, text, x, y, color) {   // 머리 위 닉네임 이름표
    g.font = '800 17px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + 18;
    g.fillStyle = 'rgba(40,24,80,.62)'; this.rr(g, x - w / 2, y - 12, w, 24, 12); g.fill();
    g.strokeStyle = color; g.lineWidth = 1.6; g.globalAlpha = 0.7; this.rr(g, x - w / 2, y - 12, w, 24, 12); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = color; g.fillText(text, x, y + 1); g.textBaseline = 'alphabetic';
  }
  drawWings(g, x, y, t) {
    const fl = Math.sin(t * 20) * 0.45;
    for (const d of [-1, 1]) { g.save(); g.translate(x + d * 20, y - 30); g.rotate(d * (0.5 + fl)); g.scale(d, 1);
      g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(26, -34, 52, -10); g.quadraticCurveTo(38, -4, 46, 8); g.quadraticCurveTo(28, 6, 30, 18); g.quadraticCurveTo(14, 12, 0, 4); g.closePath();
      g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#9aa6d8'; g.lineJoin = 'round'; g.stroke(); g.restore(); }
  }
  drawBalloon(g, x, y, t) {
    const by = y - 128 + Math.sin(t * 3) * 3;
    g.save(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, by + 32); g.quadraticCurveTo(x + 8, y - 80, x + 2, y - 54); g.stroke();
    g.beginPath(); g.ellipse(x, by, 26, 31, 0, 0, 7); const gr = g.createRadialGradient(x - 9, by - 12, 4, x, by, 34); gr.addColorStop(0, '#ffc2d6'); gr.addColorStop(1, '#ff4f7e'); g.fillStyle = gr; g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#c2305a'; g.stroke();
    g.beginPath(); g.moveTo(x - 5, by + 33); g.lineTo(x + 5, by + 33); g.lineTo(x, by + 40); g.closePath(); g.fillStyle = '#ff4f7e'; g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - 10, by - 12, 5, 9, -0.5, 0, 7); g.fill(); g.restore();
  }
  drawCrown(g, x, y, t) {
    g.save(); g.translate(x, y + Math.sin(t * 4) * 1.5); g.rotate(Math.sin(t * 2) * 0.06);
    g.beginPath(); g.moveTo(-15, 10); g.lineTo(-18, -10); g.lineTo(-8, -2); g.lineTo(0, -15); g.lineTo(8, -2); g.lineTo(18, -10); g.lineTo(15, 10); g.closePath();
    g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#b8860b'; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = '#ff5a7a'; g.beginPath(); g.arc(0, 3, 2.8, 0, 7); g.fill(); g.fillStyle = '#5ac8ff'; g.beginPath(); g.arc(-9, 5, 2, 0, 7); g.arc(9, 5, 2, 0, 7); g.fill(); g.restore();
  }
  drawItem(g, it) {
    const x = it.x, y = it.y + Math.sin(this.t * 3 + it.x) * 4;
    g.save();
    if (it.k === 'b') {
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y + 18); g.quadraticCurveTo(x + 6, y + 30, x, y + 40); g.stroke();
      g.beginPath(); g.ellipse(x, y, 15, 18, 0, 0, 7); const gr = g.createRadialGradient(x - 5, y - 7, 2, x, y, 20); gr.addColorStop(0, '#ffc2d6'); gr.addColorStop(1, '#ff4f7e'); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = '#c2305a'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(x - 6, y - 7, 3, 5.5, -0.5, 0, 7); g.fill();
    } else {
      g.beginPath(); g.ellipse(x, y, 13, 17, 0, 0, 7); g.fillStyle = '#fff6dc'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#c99a4a'; g.stroke();
      g.fillStyle = '#8fd0ff'; [[-5, -5, 3], [4, 3, 3.4], [-3, 8, 2.2]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); });
      g.fillStyle = '#fff'; g.strokeStyle = '#9aa6d8'; g.lineWidth = 1.6; [-1, 1].forEach((d) => { g.beginPath(); g.ellipse(x + d * 17, y - 3, 7, 3.6, d * -0.6, 0, 7); g.fill(); g.stroke(); });
    }
    g.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 6 + x); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 14, y - 20, 2.4, 0, 7); g.fill();
    g.restore();
  }
  drawPlat(g, pl, z) {
    if (!pl.cr) return this.drawPlatBase(g, pl, z);
    const st = this.cr.get(pl.id), el = st === undefined ? -1 : performance.now() - st;
    if (el > 900 && el <= 4800) return;
    g.save();
    if (el > 0 && el <= 900) { g.translate(Math.sin(el * 0.06) * 2.5, 0); g.globalAlpha = 1 - el / 900 * 0.5; }
    this.drawPlatBase(g, pl, z);
    g.fillStyle = 'rgba(255,196,120,.3)'; this.rr(g, pl.x, pl.y, pl.w, 18, 9); g.fill();
    g.strokeStyle = 'rgba(120,70,60,.75)'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
    const cx = pl.x + pl.w / 2; g.moveTo(cx - 8, pl.y + 2); g.lineTo(cx - 3, pl.y + 8); g.lineTo(cx - 9, pl.y + 14); g.moveTo(cx + 14, pl.y + 2); g.lineTo(cx + 9, pl.y + 9); g.lineTo(cx + 15, pl.y + 15); g.stroke();
    g.restore();
  }
  drawCoin(g, c) {
    const w = Math.abs(Math.cos(this.t * 4 + c.x)) * 10 + 2, y = c.y + Math.sin(this.t * 3 + c.x) * 3;
    g.beginPath(); g.ellipse(c.x, y, w, 11, 0, 0, 7); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#c28a00'; g.stroke();
    g.beginPath(); g.ellipse(c.x, y, Math.max(1, w - 4), 6.5, 0, 0, 7); g.strokeStyle = 'rgba(194,138,0,.7)'; g.lineWidth = 1.5; g.stroke();
  }
  drawHazard(g, hz) {
    const x = hzX(hz), y = hz.y + Math.sin(this.t * 2 + hz.x0) * 6, fl = Math.sin(this.t * 14 + hz.x0) * 0.6;
    g.save(); g.translate(x, y); g.scale(hz.d, 1); g.lineJoin = 'round';
    if (hz.k === 'bird') {
      g.fillStyle = '#ff7a8a'; g.strokeStyle = '#a8324a'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-17, -2); g.lineTo(-27, -6); g.lineTo(-25, 4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(15, -2); g.lineTo(26, 2); g.lineTo(15, 5); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff9aa8'; g.save(); g.translate(-2, -8); g.rotate(fl); g.beginPath(); g.ellipse(0, -9, 7, 13, 0, 0, 7); g.fill(); g.stroke(); g.restore();
      g.fillStyle = '#2a1c3a'; g.beginPath(); g.arc(7, -3, 2.2, 0, 7); g.fill();
    } else if (hz.k === 'rock') {
      const gr = g.createLinearGradient(-60, 0, 0, 0); gr.addColorStop(0, 'rgba(255,200,120,0)'); gr.addColorStop(1, 'rgba(255,170,90,.8)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-70, 0); g.lineTo(0, -12); g.lineTo(0, 12); g.closePath(); g.fill();
      g.fillStyle = '#8d82a8'; g.strokeStyle = '#4a4068'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(60,50,90,.5)'; [[-4, -4, 3.5], [5, 4, 2.6], [-2, 7, 2]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(dx, dy, r, 0, 7); g.fill(); });
    } else {
      g.fillStyle = '#f3fbff'; g.strokeStyle = '#8cc4e8'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(140,196,232,.55)'; g.beginPath(); g.arc(-4, 3, 6, 0, 7); g.fill();
      g.fillStyle = '#2a4a6a'; g.beginPath(); g.arc(3, -3, 1.8, 0, 7); g.arc(9, -3, 1.8, 0, 7); g.fill();
    }
    g.restore();
  }
  drawGates(g, cam) {   // 50m마다 나오는 퀴즈 문
    const k0 = Math.max(1, Math.ceil(-(cam + H + 60) / 500)), k1 = Math.floor(-(cam - 60) / 500);
    for (let k = k0; k <= k1; k++) {
      const y = -k * 500, open = k <= this.gateDone;
      g.save(); g.globalAlpha = open ? 0.4 : 0.95;
      g.strokeStyle = open ? '#fff' : '#ffd23f'; g.lineWidth = 5; g.setLineDash([16, 10]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]);
      g.fillStyle = open ? '#9aa6d8' : '#ff8fb0'; [60, W - 60].forEach((px) => { g.fillRect(px - 5, y - 54, 10, 54); g.beginPath(); g.arc(px, y - 58, 9, 0, 7); g.fill(); });
      g.restore();
      this.label(g, (open ? '🚪 열린 문 ' : '🚪 퀴즈 문 ') + k * 50 + 'm', W / 2, y - 22, open ? '#cfd6ff' : '#fff3a8');
    }
  }
  drawEmote(g, x, y, n) {
    const bob = Math.sin(this.t * 6) * 2;
    g.save(); g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = '#6a4fc0'; g.lineWidth = 2.4; this.rr(g, x - 20, y - 20 + bob, 40, 36, 14); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 5, y + 15 + bob); g.lineTo(x, y + 23 + bob); g.lineTo(x + 5, y + 15 + bob); g.closePath(); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
    g.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(EMOTES[n] || '', x, y - 1 + bob); g.restore();
  }
  drawTrail(g) {
    for (const q of this.tf) {
      g.globalAlpha = Math.min(1, q.l * 2);
      if (q.k === 'f') { g.fillStyle = q.l > 0.25 ? '#ffb02e' : '#ff5a3a'; g.beginPath(); g.arc(q.x, q.y, 3 + q.l * 8, 0, 7); g.fill(); }
      else if (q.k === 3) { g.fillStyle = `hsl(${(q.h * 360 + this.t * 200) % 360},90%,65%)`; g.beginPath(); g.arc(q.x, q.y, 4.5, 0, 7); g.fill(); }
      else { g.font = '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q.k === 1 ? '✨' : '💗', q.x, q.y); }
    }
    g.globalAlpha = 1; g.textBaseline = 'alphabetic';
  }
  drawFrozen(g) {
    if (this.slowUntil <= performance.now()) return;
    const p = this.p; g.save(); g.fillStyle = 'rgba(150,220,255,.35)'; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(p.x, p.y - 22, 30, 36, 0, 0, 7); g.fill(); g.stroke();
    g.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.fillText('❄️', p.x, p.y - 56); g.restore();
  }
  drawFog(g) {   // 어두운 밤하늘 구간: 내 주변만 보여요
    const on = (ZFX[mapOf(Net.s.seed, zoneOf(this.p.y))] || {}).dark ? 1 : 0;
    this.darkA += (on - this.darkA) * 0.08; if (this.darkA < 0.02) return;
    const sx = this.p.x, sy = this.p.y - this.camY - 30, gr = g.createRadialGradient(sx, sy, 90, sx, sy, 380);
    gr.addColorStop(0, 'rgba(4,4,28,0)'); gr.addColorStop(1, `rgba(4,4,28,${(0.78 * this.darkA).toFixed(2)})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  drawPlatBase(g, pl, z) {
    const T = THEMES[mapOf(Net.s.seed, z)].plat, fill = T[0], edge = T[1];
    if (pl.kind === 'floor') {
      g.fillStyle = edge; g.fillRect(0, pl.y, W, 120); g.fillStyle = fill; this.rr(g, -10, pl.y, W + 20, 30, 12); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; this.rr(g, -10, pl.y, W + 20, 8, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 20; x < W; x += 70) { g.beginPath(); g.arc(x, pl.y + 52, 7, 0, 7); g.fill(); }
      return;
    }
    const h = 18;
    g.fillStyle = 'rgba(40,25,70,.22)'; this.rr(g, pl.x + 2, pl.y + 5, pl.w, h, 9); g.fill();
    g.fillStyle = edge; this.rr(g, pl.x, pl.y, pl.w, h, 9); g.fill();
    g.fillStyle = fill; this.rr(g, pl.x + 1.5, pl.y + 1.5, pl.w - 3, h - 5, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; this.rr(g, pl.x + 7, pl.y + 3, pl.w - 14, 4, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.4)'; for (let x = pl.x + 22; x < pl.x + pl.w - 10; x += 26) { g.beginPath(); g.arc(x, pl.y + 12, 2.2, 0, 7); g.fill(); }
    if (pl.mv) {   // 움직이는 판 표시: 양옆 화살표
      g.fillStyle = 'rgba(255,255,255,.9)'; g.strokeStyle = edge; g.lineWidth = 1.5;
      [[pl.x + 9, -1], [pl.x + pl.w - 9, 1]].forEach(([ax, d]) => { g.beginPath(); g.moveTo(ax + d * 4, pl.y + 9); g.lineTo(ax - d * 3, pl.y + 4.5); g.lineTo(ax - d * 3, pl.y + 13.5); g.closePath(); g.fill(); g.stroke(); });
    }
    if (pl.kind === 'cp') {   // 구역 시작 표시 깃발
      const x = pl.x + 22; g.fillStyle = '#7a62c8'; g.fillRect(x, pl.y - 44, 3, 44); g.fillStyle = '#ff8fb0'; g.beginPath(); g.moveTo(x + 3, pl.y - 44); g.lineTo(x + 40, pl.y - 34); g.lineTo(x + 3, pl.y - 24); g.fill();
      this.label(g, '⛰ ' + heightOf(pl.y - 30) + 'm', pl.x + pl.w / 2 + 14, pl.y - 26, '#fff3a8');
    }
  }
  rr(g, x, y, w, h, r) { g.beginPath(); if (!r) { g.rect(x, y, w, h); return; } g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  drawSpring(g, sp) {
    const squash = this.t - (sp.t || -9) < 0.15 ? 0.55 : 1;
    g.fillStyle = '#6a4fc0'; g.fillRect(sp.x - 12, sp.y - 4, 24, 4);
    g.strokeStyle = '#ff6b8a'; g.lineWidth = 3; g.beginPath(); const hh = 18 * squash;
    for (let i = 0; i <= 4; i++) { const yy = sp.y - 4 - (hh * i) / 4; g.lineTo(sp.x + (i % 2 ? 10 : -10), yy); } g.stroke();
    g.fillStyle = '#ffd23f'; g.fillRect(sp.x - 13, sp.y - 6 - hh, 26, 4);
  }
  drawGift(g, gf) {
    const y = gf.y + Math.sin(this.t * 3 + gf.x) * 3;
    g.fillStyle = '#ff5a7a'; this.rr(g, gf.x - 15, y - 12, 30, 26, 4); g.fill(); g.strokeStyle = 'rgba(60,20,60,.8)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#ffe27a'; g.fillRect(gf.x - 3, y - 12, 6, 26); g.fillRect(gf.x - 15, y - 1, 30, 5);
    g.beginPath(); g.ellipse(gf.x - 6, y - 15, 6, 4, -0.5, 0, 7); g.ellipse(gf.x + 6, y - 15, 6, 4, 0.5, 0, 7); g.fill();
  }
  /* ----- HUD ----- */
  hud(sNow, countdown, running) {
    const s = Net.s;
    $('hudH').textContent = `📏 ${heightOf(this.p.y)} m · 최고 ${this.best}`;
    const my = this.best + this.correct * GAME.pointsPer + this.bo;
    $('hudScore').textContent = `⭐ ${my}점${this.goldOn() ? ' ⚡x2' : ''}`;
    $('hudCoin').textContent = `🪙 ${Shop.coins} (+${this.runCoins})`;
    $('hudCombo').textContent = `🔥 ${this.combo}콤보`; $('hudCombo').classList.toggle('hidden', this.combo < 2);
    $('hudItem').textContent = this.item === 'bolt' ? '⚡ 번개 · X키' : this.item === 'ice' ? '❄️ 얼음 · X키' : ''; $('hudItem').classList.toggle('hidden', !this.item);
    const ch = this.chaseInfo(my), showRank = s.status === 'play' && ch.n > 1;
    $('hudRank').textContent = `🏅 ${ch.rank}/${ch.n}등`; $('hudRank').classList.toggle('hidden', !showRank);
    $('hudChase').textContent = ch.above ? `🎯 ${ch.above.name} +${(ch.above.score | 0) - my}` : '👑 내가 1등!'; $('hudChase').classList.toggle('hidden', !showRank);
    if (running) this.overtake(my);
    $('hudN').textContent = `👥 ${Net.n}명`;
    $('hudLife').textContent = '❤️'.repeat(this.lives) + '🤍'.repeat(Math.max(0, 5 - this.lives));
    $('retryBtn').classList.toggle('hidden', !this.retry || this.lives <= 0);
        let rem = null, phase = '';
    if (s.status === 'lobby') phase = '🛝 연습 시간 · 선생님이 곧 시작해요! 마음껏 뛰어 보세요';
    else if (s.status === 'ended') { rem = 0; phase = '🏁 게임 끝'; }
    else if (countdown) { rem = s.duration * 1000; phase = '준비!'; }
    else { rem = s.endsAt - sNow; phase = '🎁 선물 상자·30초 퀴즈 정답이면 +30점 · 🎈 풍선 · 🥚 새 알을 찾아요!'; }
    { const ev = s.ev; if (running && ev && sNow < ev.until && ev.k !== 'balloon') phase = (ev.k === 'gold' ? '⚡ 골든타임! 점수 2배' : '🌙 달나라 중력! 둥실둥실') + ` · ${Math.ceil((ev.until - sNow) / 1000)}초`; }
    const timer = $('hudTimer');
    if (rem == null) timer.textContent = '--:--'; else { const sec = Math.max(0, Math.ceil(rem / 1000)); timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; }
    timer.classList.toggle('warn', running && rem != null && rem < 10500);
    $('phase').textContent = phase;
    if (countdown) { const n = Math.ceil((s.startAt - sNow) / 1000); if (n !== this.countN) { this.countN = n; this.center(String(n)); sfx('beep'); } }
    else if (this.countN != null && s.status === 'play') { this.countN = null; this.center('GO!'); sfx('go'); setTimeout(() => this.center(null), 700); }
    else if (s.status === 'ended') this.showResult();
    else if (this.countN != null) { this.countN = null; this.center(null); }
    if (s.status !== 'ended') this.resultShown = false;
  }
  showResult() {
    if (this.resultShown) { return; }
    const rank = Net.rank; if (!rank) return;
    this.resultShown = true; sfx('win');
    const me = rank.find((r) => r[5] === profile.id);
    Shop.flush();
    $('myRank').textContent = me ? `${me[1]} 님은 ${me[0]}등! ⭐ ${me[2]}점 · 정답 ${me[3]}개 · 최고 ${me[4]}m · 🪙 +${this.runCoins}` : `수고했어요! 🪙 +${this.runCoins}`;
    const aw = Net.aw || {}, awBox = $('awards'); awBox.innerHTML = '';
    const addAw = (t) => { const d = document.createElement('div'); d.textContent = t; awBox.append(d); };
    if (aw.c) addAw(`🎯 가장 많이 맞힌 친구: ${aw.c[0]} (정답 ${aw.c[1]}개)`);
    if (aw.h) addAw(`🏔 가장 높이 오른 친구: ${aw.h[0]} (${aw.h[1]}m)`);
    if (aw.mx) addAw(`🔥 콤보왕: ${aw.mx[0]} (${aw.mx[1]}연속 정답)`);
    if (aw.tm && aw.tm.length) addAw(`👥 우승 모둠: ${aw.tm[0][0]}모둠 (합계 ${aw.tm[0][1]}점)`);
    const rv = $('review'); rv.classList.add('hidden'); rv.innerHTML = '';
    const wi = [...this.wrongIdx];
    if (!wi.length) rv.textContent = '틀린 문제가 없어요! 대단해요 👏';
    else wi.slice(0, 8).forEach((i) => { const q = QS[i]; if (!q) return; const d = document.createElement('div'); d.className = 'rv'; d.textContent = q.q.replace(/\n/g, ' ') + '  →  ✅ ' + q.a; rv.append(d); });
    $('reviewBtn').textContent = wi.length ? `📝 틀린 문제 복습 (${wi.length})` : '📝 틀린 문제 복습';
    startPodium(rank.slice(0, 3));
    const ol = $('rankList'); ol.innerHTML = '';
    rank.slice(0, 10).forEach((r) => { const li = document.createElement('li'); li.textContent = `${['🥇', '🥈', '🥉'][r[0] - 1] || r[0] + '.'} ${r[1]} — ${r[2]}점 (정답 ${r[3]})`; if (me && r[5] === me[5]) li.className = 'me'; ol.append(li); });
    $('result').classList.remove('hidden');
  }
}

/* ---------- 시상식 ---------- */
let podiumRaf = 0;
const confetti = Array.from({ length: 46 }, (_, i) => ({ x: Math.random() * 720, y: Math.random() * 260, v: 40 + Math.random() * 70, c: ['#ff7aa8', '#ffd23f', '#7ac8ff', '#9be58a', '#c8a8ff'][i % 5], r: Math.random() * 6 }));
function startPodium(top) {
  const cp = $('podium'), g = cp.getContext('2d'), t0 = performance.now(), slots = [[0, 360, 108, '#ffd23f', '#b8860b'], [1, 180, 74, '#dfe3ee', '#8a90a6'], [2, 540, 50, '#e8b080', '#9a6a40']];
  cancelAnimationFrame(podiumRaf);
  const loop = (now) => {
    if ($('result').classList.contains('hidden')) { podiumRaf = 0; return; }
    podiumRaf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000; g.clearRect(0, 0, 720, 260);
    for (const q of confetti) { q.y += q.v * 0.016; q.r += 0.1; if (q.y > 262) { q.y = -6; q.x = Math.random() * 720; } g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.fillStyle = q.c; g.fillRect(-4, -2, 8, 4); g.restore(); }
    for (const [i, cx, h, c1, c2] of slots) {
      const r = top[i]; if (!r) continue;
      g.fillStyle = c2; g.beginPath(); g.roundRect ? g.roundRect(cx - 78, 242 - h, 156, h, 10) : g.rect(cx - 78, 242 - h, 156, h); g.fill();
      g.fillStyle = c1; g.beginPath(); g.roundRect ? g.roundRect(cx - 78, 242 - h, 156, h - 6, 10) : g.rect(cx - 78, 242 - h, 156, h - 6); g.fill();
      g.fillStyle = '#3a2a6a'; g.font = '900 30px "Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.fillText(r[0], cx, 242 - h + 34);
      g.font = '800 16px "Malgun Gothic",sans-serif'; g.fillText(r[1].length > 7 ? r[1].slice(0, 7) + '…' : r[1], cx, 242 - h + 56);
      if (h > 90) { g.font = '700 14px "Malgun Gothic",sans-serif'; g.fillText(r[2] + '점', cx, 242 - h + 76); }
      const hop = Math.abs(Math.sin(t * 3.2 + i * 1.3)) * 18, sq = Math.sin(t * 6.4 + i * 2.6) * 0.06;
      drawChar(g, r[6] | 0, cx, 242 - h - hop, { t, anim: 2, scale: 1.7, bs: sq, bv: Math.cos(t * 6.4 + i * 2.6) * 4 });
      if (i === 0 && scene) scene.drawCrown(g, cx, 242 - h - hop - 78, t);
    }
  };
  podiumRaf = requestAnimationFrame(loop);
}
$('reviewBtn').onclick = () => $('review').classList.toggle('hidden');

/* ---------- 교사 화면 ---------- */
let tpw = sessionStorage.getItem('et_pw') || '', tTimer = null;
async function askTeacher() {
  const pw = prompt('교사용 비밀번호를 입력하세요');
  if (pw == null) return;
  try { const r = await post({ act: 'login', pw }); if (!r.ok) return alert('비밀번호가 틀렸어요.'); tpw = pw; sessionStorage.setItem('et_pw', pw); openTeacher(); }
  catch (e) { alert('서버에 연결하지 못했어요.'); }
}
$('tBtn').onclick = askTeacher; $('tBtn2').onclick = () => { if (tpw) openTeacher(); else askTeacher(); };
function openTeacher() { $('teacher').classList.remove('hidden'); clearTimeout(tTimer); tPoll(); }
$('toStudent').onclick = () => { $('teacher').classList.add('hidden'); clearTimeout(tTimer); };
async function admin(cmd, extra) {
  try { const r = await post({ act: 'admin', pw: tpw, cmd, ...(extra || {}) }); if (r && r.ok) renderT(r); else if (r && r.error) alert(r.error); return r; } catch (e) { return null; }
}
const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
let tData = null, tOff = 0;
function renderT(r) {
  tData = r; tOff = r.now - Date.now();
  const s = r.s; $('tN').textContent = `접속 ${r.n}명`;
  $('tState').textContent = { lobby: '🛝 연습 시간 (출발 전)', play: '🎮 게임 중', ended: '🏁 게임 끝' }[s.status];
  $('tStart').disabled = s.status === 'play';
  const body = $('tBody'); body.innerHTML = '';
  r.rank.forEach((x) => { const tr = document.createElement('tr'); [x[0], x[1], x[2], x[3], x[4] + ' m'].forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.append(td); }); body.append(tr); });
  const evb = r.s.ev, evLeft = evb ? Math.ceil((evb.until - r.now) / 1000) : 0;
  $('tEv').textContent = evb && evLeft > 0 && s.status === 'play' ? ({ gold: '⚡ 골든타임', moon: '🌙 달나라 중력', balloon: '🎈 모두 풍선' }[evb.k]) + ` 진행 중 (${evLeft}초)` : '';
  ['evGold', 'evMoon', 'evBalloon'].forEach((id) => { $(id).disabled = s.status !== 'play'; });
  const wr = $('tWrong'); wr.innerHTML = '';
  (r.wrong || []).forEach(([qi, n]) => { const q = (window.QUESTIONS || [])[qi]; if (!q) return; const tr = document.createElement('tr'); [q.q.replace(/\n/g, ' '), '✅ ' + q.a, n + '번'].forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.append(td); }); wr.append(tr); });
  if (!wr.children.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 3; td.textContent = '아직 틀린 문제가 없어요'; tr.append(td); wr.append(tr); }
  const tm = $('tTeams'); tm.innerHTML = '';
  (r.teams || []).forEach(([t, sum, n], i) => { const tr = document.createElement('tr'); [(i === 0 ? '🏆 ' : '') + t + '모둠', sum + '점', n + '명'].forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.append(td); }); tm.append(tr); });
  if (!tm.children.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 3; td.textContent = '학생이 입장할 때 모둠을 고르면 모둠 점수가 나와요'; tr.append(td); tm.append(tr); }
  const lob = $('tLobby'); lob.innerHTML = ''; (r.lobby || []).forEach((n) => { const sp = document.createElement('span'); sp.textContent = n; lob.append(sp); });
  drawT();
}
function drawT() {
  if (!tData) return; const s = tData.s, now = Date.now() + tOff;
  $('tTime').textContent = s.status === 'play' ? fmt((s.endsAt - now) / 1000) : s.status === 'ended' ? '00:00' : fmt(s.duration);
}
async function tPoll() { await admin('state'); clearTimeout(tTimer); tTimer = setTimeout(tPoll, 2000); }
setInterval(drawT, 250);
$('tPlus').onclick = () => admin('addTime', { delta: 1 });
$('tMinus').onclick = () => admin('addTime', { delta: -1 });
$('tStart').onclick = () => { const s = tData && tData.s; if (s && s.status === 'ended' && !confirm('새 게임을 시작할까요?')) return; admin('start'); };
$('tEnd').onclick = () => { if (confirm('지금 게임을 끝낼까요?')) admin('end'); };
$('tReset').onclick = () => admin('reset');
$('evGold').onclick = () => admin('event', { k: 'gold' });
$('evMoon').onclick = () => admin('event', { k: 'moon' });
$('evBalloon').onclick = () => admin('event', { k: 'balloon' });
if (new URLSearchParams(location.search).has('teacher')) { askTeacher(); }
fit();
window.__et = { Music, Net, Quiz, buildZone, mapOf, get scene() { return scene; } };
})();
