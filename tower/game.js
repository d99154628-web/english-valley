(function () {
'use strict';
const API = 'https://script.google.com/macros/s/AKfycbw5doexlj-huQ_CXWStLB-amo5l-KzKqo_fQj7I7QKIV1M9WFpFeLQrxp1XnzvazZpZ4g/exec';
const W = 960, H = 540, ZONE_H = 1800;
const PHYS = { g: 1300, speed: 250, jump: 640, djump: 580, spring: 1080 };
const GAME = { quizEvery: 30, drain: 1.5, energyPer: 30, pointsPer: 30, giftRespawn: 20000 };
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const stageEl = $('stage');
const QS = window.QUESTIONS || [];

/* ---------- 화면 크기 ---------- */
function fit() { stageEl.style.setProperty('--u', (stageEl.clientWidth / 960).toFixed(3)); }
window.addEventListener('resize', fit); fit();

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
  whoosh: () => tone(900, 0.6, 'sawtooth', 0.06, -700), win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, 0, i * 0.11)); },
};
const sfx = (n) => { try { SFX[n](); } catch (e) {} };
$('muteBtn').onclick = () => { muted = !muted; $('muteBtn').textContent = muted ? '🔇' : '🔊'; };

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
const diffOf = (z) => Math.min(1, z / 12);
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
  const out = { z, plats, gifts, springs, cp: { x: cx0, y: cy0 } };
  if (zoneCache.size > 200) zoneCache.clear(); zoneCache.set(key, out); return out;
}

/* ---------- 캐릭터: 말랑말랑 동글동글 30종 (동물 10종 × 색 3가지) ---------- */
const SPECIES = [
  { n: 'bunny', cols: ['#ffffff', '#fff0d2', '#e6dcff'] }, { n: 'cat', cols: ['#ffbd7a', '#d3d8e2', '#fff6ee'] },
  { n: 'bear', cols: ['#d9a46c', '#f0c9a8', '#a9826a'] }, { n: 'dog', cols: ['#f6dca8', '#ffffff', '#c89a70'] },
  { n: 'chick', cols: ['#ffe46e', '#ffcf7a', '#fff6b0'] }, { n: 'frog', cols: ['#90e394', '#86dcec', '#ccf28e'] },
  { n: 'penguin', cols: ['#7b93e0', '#566086', '#ff9fbb'] }, { n: 'panda', cols: ['#ffffff', '#c9f5e6', '#ffd9e6'] },
  { n: 'pig', cols: ['#ffb9cc', '#ffd6e4', '#f6a9dc'] }, { n: 'mouse', cols: ['#dcdcec', '#f8d9c8', '#cfe6ff'] },
];
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function drawChar(g, skin, x, y, o) {   // (x,y)=발 바닥 가운데. o: {t, flip, scale, anim}
  const sp = SPECIES[skin % 10], col = sp.cols[Math.floor(skin / 10) % 3], line = shade(col, 0.62), n = sp.n;
  const s = o.scale || 1.3, t = o.t, run = o.anim === 1;
  let sx = 1 + Math.sin(t * 2.2) * 0.02, sy = 1 - Math.sin(t * 2.2) * 0.025;
  if (run) { sx = 1 + Math.sin(t * 16) * 0.05; sy = 1 - Math.sin(t * 16) * 0.07; }
  if (o.anim === 2) { sx = 0.9; sy = 1.14; } else if (o.anim === 3) { sx = 1.07; sy = 0.93; }
  const hop = run ? Math.abs(Math.sin(t * 8)) * 3 : 0;
  g.save(); g.translate(x, y - hop); g.scale((o.flip ? -1 : 1) * s * sx, s * sy);
  g.lineJoin = 'round'; g.lineWidth = 1.6; g.strokeStyle = line;
  const ell = (cx, cy, rx, ry, fill, rot) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, rot || 0, 0, 7); g.fillStyle = fill; g.fill(); g.stroke(); };
  const dot = (cx, cy, r, fill) => { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = fill; g.fill(); };
  const dark = n === 'panda' ? '#3a3a48' : shade(col, 0.82);
  // 뒤쪽 (귀·꼬리)
  if (n === 'bunny') { ell(-8, -39, 4.6, 12, col, -0.12); ell(8, -39, 4.6, 12, col, 0.12); dot(-8, -39, 0); ell(-8, -39, 2.2, 8, '#ffc6d6', -0.12); ell(8, -39, 2.2, 8, '#ffc6d6', 0.12); }
  if (n === 'cat') { [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(d * 15, -22); g.quadraticCurveTo(d * 17, -38, d * 8, -33); g.quadraticCurveTo(d * 5, -30, d * 4, -29); g.closePath(); g.fillStyle = col; g.fill(); g.stroke(); g.beginPath(); g.moveTo(d * 13, -26); g.quadraticCurveTo(d * 14, -34, d * 9, -31); g.closePath(); g.fillStyle = '#ffc6d6'; g.fill(); }); }
  if (n === 'bear') { ell(-12, -29, 6, 6, col); ell(12, -29, 6, 6, col); ell(-12, -29, 3, 3, '#f7d4c0'); ell(12, -29, 3, 3, '#f7d4c0'); }
  if (n === 'panda') { ell(-12, -29, 6, 6, '#3a3a48'); ell(12, -29, 6, 6, '#3a3a48'); }
  if (n === 'mouse') { ell(-13, -28, 7.5, 7.5, col); ell(13, -28, 7.5, 7.5, col); ell(-13, -28, 4.5, 4.5, '#ffc6d6'); ell(13, -28, 4.5, 4.5, '#ffc6d6'); }
  if (n === 'pig') { [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(d * 8, -28); g.lineTo(d * 16, -36); g.lineTo(d * 15, -24); g.closePath(); g.fillStyle = shade(col, 0.95); g.fill(); g.stroke(); }); }
  if (n === 'dog') { ell(-16, -19, 5, 10, shade(col, 0.82), 0.25); ell(16, -19, 5, 10, shade(col, 0.82), -0.25); }
  if (n === 'frog') { ell(-9, -30, 6.5, 6.5, col); ell(9, -30, 6.5, 6.5, col); }
  // 몸 (동글동글 말랑)
  const grd = g.createRadialGradient(-6, -24, 3, 0, -15, 22); grd.addColorStop(0, shade(col, 1.08)); grd.addColorStop(1, col);
  g.beginPath(); g.ellipse(0, -15, 18, 15, 0, 0, 7); g.fillStyle = grd; g.fill(); g.stroke();
  // 배 / 무늬
  if (n === 'penguin') { ell(0, -11, 11, 11, '#ffffff'); }
  else if (n === 'panda') { ell(-10, -14, 5, 6, '#3a3a48', 0.2); ell(10, -14, 5, 6, '#3a3a48', -0.2); g.lineWidth = 0; ell(0, -9, 10, 8, '#ffffff'); g.lineWidth = 1.6; }
  else { g.save(); g.lineWidth = 0; g.beginPath(); g.ellipse(0, -9, 10, 8, 0, 0, 7); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); g.restore(); }
  if (n === 'cat') { g.strokeStyle = shade(col, 0.8); g.lineWidth = 1.4; for (const dx of [-3, 0, 3]) { g.beginPath(); g.moveTo(dx, -29); g.lineTo(dx, -25); g.stroke(); } g.strokeStyle = line; g.lineWidth = 1.6; }
  // 발·팔 (콩알)
  const fo = run ? Math.sin(t * 16) * 2.5 : 0;
  ell(-8 + fo, -1.5, 5.2, 3.4, n === 'penguin' || n === 'chick' ? '#ffa94d' : dark); ell(8 - fo, -1.5, 5.2, 3.4, n === 'penguin' || n === 'chick' ? '#ffa94d' : dark);
  const aw = run ? Math.sin(t * 16 + 1) * 0.5 : o.anim === 2 ? -0.9 : 0.1;
  g.save(); g.translate(-17, -14); g.rotate(0.5 + aw); ell(0, 0, 3.6, 5, dark); g.restore();
  g.save(); g.translate(17, -14); g.rotate(-0.5 - aw); ell(0, 0, 3.6, 5, dark); g.restore();
  // 얼굴
  const blink = (Math.floor(t * 1.3 + skin) % 4 === 0) && (t * 1.3 + skin) % 1 < 0.12;
  const ey = -18;
  if (blink) { g.strokeStyle = '#3a2848'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-9, ey); g.lineTo(-5, ey); g.moveTo(5, ey); g.lineTo(9, ey); g.stroke(); }
  else { dot(-7, ey, 2.3, '#2e2038'); dot(7, ey, 2.3, '#2e2038'); dot(-6.3, ey - 0.9, 0.8, '#fff'); dot(7.7, ey - 0.9, 0.8, '#fff'); }
  g.fillStyle = 'rgba(255,120,150,.5)'; g.beginPath(); g.ellipse(-12, -13.5, 3.2, 2.1, 0, 0, 7); g.ellipse(12, -13.5, 3.2, 2.1, 0, 0, 7); g.fill();
  g.strokeStyle = '#2e2038'; g.lineWidth = 1.2; g.lineCap = 'round';
  if (n === 'chick') { g.beginPath(); g.moveTo(-3, -15); g.lineTo(3, -15); g.lineTo(0, -11); g.closePath(); g.fillStyle = '#ffa94d'; g.fill(); }
  else if (n === 'penguin') { g.beginPath(); g.moveTo(-3.5, -15); g.lineTo(3.5, -15); g.lineTo(0, -10.5); g.closePath(); g.fillStyle = '#ffa94d'; g.fill(); }
  else if (n === 'pig') { g.beginPath(); g.ellipse(0, -13, 5.5, 3.8, 0, 0, 7); g.fillStyle = '#ff9fb8'; g.fill(); dot(-1.9, -13, 0.9, '#b94a6a'); dot(1.9, -13, 0.9, '#b94a6a'); }
  else { dot(0, -14.6, 1.3, n === 'dog' || n === 'bear' || n === 'panda' ? '#3a2848' : '#ff8aa8'); g.beginPath(); g.arc(-1.8, -12.8, 1.8, 0.1, Math.PI - 0.3); g.arc(1.8, -12.8, 1.8, 0.3, Math.PI - 0.1); g.stroke(); }
  if (n === 'chick') { ell(0, -34, 2, 4, col, 0); ell(-3.5, -33, 1.8, 3.5, col, -0.5); ell(3.5, -33, 1.8, 3.5, col, 0.5); }
  if (n === 'frog') { dot(-9, -30, 0); }
  g.restore();
}
function previewSkin(canvas, skin) { canvas.width = 64; canvas.height = 64; const g = canvas.getContext('2d'); drawChar(g, skin, 32, 56, { t: 0, anim: 0, scale: 1.2 }); }

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
const rnd = mulberry32(777);
function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
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
  g.globalAlpha = a; g.drawImage(skyOf(i), 0, 0);
  const L = decoCache[i] || (decoCache[i] = decoList(i)), LOOP = 900;
  for (const d of L) {
    const sp = sprite(d.kind); if (sp.width < 4) continue;
    const y = (((d.y + cam * d.f) % LOOP) + LOOP) % LOOP - 180;
    const x = d.x + Math.sin(t * 0.3 + d.p) * 14 + d.dx * t * 0.2;
    const xx = ((x % (W + 240)) + W + 240) % (W + 240) - 120;
    const w = sp.width * d.s, h = sp.height * d.s;
    g.globalAlpha = a * (d.kind === 'cloud' ? 0.9 : 1); g.drawImage(sp, xx - w / 2, y - h / 2, w, h);
  }
  g.globalAlpha = 1;
}
const motes = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.2, s: 8 + Math.random() * 20, p: Math.random() * 6 }));

/* ---------- 네트워크 ---------- */
const Net = { offset: 0, rtt: 1e9, me: null, round: -1, s: { status: 'lobby', round: 0, seed: 1, duration: 300, startAt: 0, endsAt: 0 }, friends: new Map(), n: 1, pending: false, rank: null, ok: true, fails: 0 };
const serverNow = () => Date.now() + Net.offset;
async function post(body, timeout) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), timeout || 9000);
  try { const r = await fetch(API, { method: 'POST', body: JSON.stringify(body), signal: ctl.signal }); return await r.json(); }
  finally { clearTimeout(tm); }
}
function takeClock(t0, t1, now) { const rtt = t1 - t0; if (rtt <= Net.rtt * 1.5 + 50) { Net.rtt = Math.min(Net.rtt, rtt); Net.offset = now + rtt / 2 - t1; } }

let profile = {}; try { profile = JSON.parse(localStorage.getItem('et_profile') || '{}'); } catch (e) { profile = {}; }
let skin = Number.isInteger(profile.skin) ? profile.skin : Math.floor(Math.random() * 30);
$('nameInput').value = profile.name || '';
const grid = $('skinGrid');
for (let i = 0; i < 30; i++) {
  const b = document.createElement('button'); b.className = 'skin' + (i === skin ? ' sel' : ''); b.type = 'button';
  const c = document.createElement('canvas'); previewSkin(c, i); b.append(c);
  b.onclick = () => { skin = i; [...grid.children].forEach((e, k) => e.classList.toggle('sel', k === i)); unlock(); sfx('gift'); };
  grid.append(b);
}
const randId = () => Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

let scene = null;
$('joinBtn').onclick = () => joinGame();
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinGame(); });
async function joinGame() {
  unlock();
  const name = $('nameInput').value.trim();
  if (!name) { $('joinMsg').textContent = '닉네임을 써 주세요!'; return; }
  profile = { name, skin, id: profile.id || randId() };
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
    scene.start();
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
  const tr = sc.trail.splice(0, sc.trail.length).slice(-8);
  try {
    const t0 = Date.now();
    const res = await post({ act: 'sync', id: profile.id, name: profile.name, skin: profile.skin, x: Math.round(p.x), y: Math.round(p.y), tr, sq: sc.sq, round: Net.round, h: sc.best, c: sc.correct });
    const t1 = Date.now();
    if (res && res.ok) { takeClock(t0, t1, res.now); applySync(res, false); Net.fails = 0; if (!Net.ok) { Net.ok = true; sc.toast('📡 다시 연결됐어요!'); } }
  } catch (e) {
    sc.trail.unshift(...tr);
    if (++Net.fails === 3) { Net.ok = false; sc.toast('📡 연결이 불안해요… 다시 연결하는 중', 3500); }
  }
  Net.pending = false;
  schedulePoll(1300 + Math.random() * 250);
}
function applySync(res, first) {
  const prev = Net.s; Net.s = res.s; Net.n = res.n; Net.rank = res.rank || null;
  const seen = new Set();
  for (const [id, name, sk, x, y, tr, sq] of res.p) {
    seen.add(id);
    let f = Net.friends.get(id);
    if (!f) { f = { id, name, skin: sk, x, y, from: { x, y, a: 0, f: 0 }, q: [], prog: 0, lastSq: sq, cur: { x, y, a: 0, f: 0 } }; Net.friends.set(id, f); }
    f.name = name; f.skin = sk;
    const k = Math.min(Math.max(0, sq - f.lastSq), (tr || []).length);
    if (k > 0) { tr.slice(tr.length - k).forEach((s) => f.q.push({ x: s[0], y: s[1], a: s[2], f: s[3] })); f.lastSq = sq; }
    else if (!f.q.length && (Math.abs(f.cur.x - x) > 40 || Math.abs(f.cur.y - y) > 40)) { f.q.push({ x, y, a: 0, f: f.cur.f }); }
    if (f.q.length > 14) f.q.splice(0, f.q.length - 6);
  }
  for (const id of [...Net.friends.keys()]) if (!seen.has(id)) Net.friends.delete(id);
  if (scene && scene.started) scene.onSession(prev, first);
  if (first) Net.round = res.s.round;
}
Net.getRound = () => Net.round;

/* ---------- 퀴즈 ---------- */
const Quiz = {
  deck: [], open: false, locked: true, cur: null, onDone: null,
  next() { if (!this.deck.length) { this.deck = QS.map((_, i) => i); for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; } } return QS[this.deck.pop()]; },
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
  if (Quiz.open && /^[1-3]$/.test(e.key)) Quiz.pick(+e.key - 1);
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
    this.wasGround = false; this.prevVy = 0; this.shake = 0; this.puffs = [];
  }
  start() {
    this.started = true; this.last = performance.now();
    const place = () => { this.p.x = W / 2 + (Math.random() - 0.5) * 360; this.p.y = -2; };
    place(); this.camY = -460;
    if (!this.raf) { const loop = (now) => { this.raf = requestAnimationFrame(loop); this.frame(now); }; this.raf = requestAnimationFrame(loop); }
  }
  toast(text, ms) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('show'), ms || 1800); }
  center(text, small) { const el = $('center'); if (!text) { el.classList.add('hidden'); return; } el.textContent = text; el.classList.toggle('small', !!small); el.classList.remove('hidden'); }
  teleport(x, y) { this.p.x = x; this.p.y = y; this.p.vx = 0; this.p.vy = 0; this.lastGroundY = y; this.safeZ = zoneOf(y); this.camY = Math.min(y - 330, -460); }
  onSession(prev, first) {
    const s = Net.s;
    if (!first && s.round !== Net.round) {   // 새 판 시작
      Net.round = s.round;
      this.best = 0; this.correct = 0; this.gifts.clear(); this.jumps = 0;
      this.teleport(W / 2 + (Math.random() - 0.5) * 360, -2);
      if (Quiz.open) Quiz.hide(); this.quizBusy = false;
      this.lastQuizAt = performance.now() + Math.max(0, s.startAt - serverNow());
      $('result').classList.add('hidden');
    }
    if (s.status === 'lobby') { $('result').classList.add('hidden'); if (this.lastStatus !== 'lobby') { this.best = 0; this.correct = 0; this.energy = 100; } }
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
            const hh = heightOf(this.p.y); if (hh > this.best) this.best = hh;
      if (!this.quizBusy && now - this.lastQuizAt > GAME.quizEvery * 1000) this.openQuiz('⏰ 퀴즈 타임!');
    }
    if (now - this.trailAt > 300) { this.trailAt = now; this.sq++; this.trail.push([Math.round(this.p.x), Math.round(this.p.y), this.p.anim, this.p.flip ? 1 : 0]); if (this.trail.length > 20) this.trail.shift(); }
    this.updateFriends(dt);
    this.camY += (Math.min(this.p.y - 330, -460) - this.camY) * Math.min(1, dt * 7);
    this.render();
    if (now - this.hudAt > 120) { this.hudAt = now; this.hud(sNow, countdown, running); }
    Scene.jumpReleased = false;
  }
  physics(dt, running) {
    const p = this.p, k = keys;
    let ix = 0;
    if (!this.frozen) { if (k.ArrowLeft || k.KeyA) ix -= 1; if (k.ArrowRight || k.KeyD) ix += 1; }
    p.vx = ix * PHYS.speed;
    if (ix) p.flip = ix < 0;
    const t = performance.now();
    if (!this.frozen) {
      if (Scene.jumpPressed) { this.jumpBuf = Scene.jumpPressed; Scene.jumpPressed = 0; }
      if (t - this.jumpBuf < 120) {
        if (t - this.coyote < 90 && this.jumps === 0) { p.vy = -PHYS.jump; this.jumps = 1; this.jumpBuf = -1e9; this.coyote = -1e9; sfx('jump'); }
        else if (this.jumps < 2 && !p.ground) {
          { p.vy = -PHYS.djump; this.jumps = 2; this.jumpBuf = -1e9; sfx('djump'); this.burst(p.x, p.y + 4, 8); }
        }
      }
      if (Scene.jumpReleased && p.vy < -400) p.vy = -400;
    } else p.vx = 0;
    const py = p.y;
    p.vy = Math.min(950, p.vy + PHYS.g * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < 14) p.x = 14; if (p.x > W - 14) p.x = W - 14;
    p.ground = false;
    {
      const z = zoneOf(p.y);
      for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) {
        const Z = buildZone(Net.s.seed, zz);
        if (p.vy >= 0) for (const pl of Z.plats) {
          if (py <= pl.y + 5 && p.y >= pl.y && p.x + 15 > pl.x && p.x - 15 < pl.x + pl.w) { p.y = pl.y; p.vy = 0; p.ground = true; }
        }
        for (const sp of Z.springs) if (p.vy >= 0 && Math.abs(p.x - sp.x) < 18 && p.y >= sp.y - 10 && py <= sp.y + 4 && !this.frozen) { p.vy = -PHYS.spring; this.jumps = 1; this.coyote = -1e9; sp.t = this.t; sfx('boing'); this.burst(sp.x, sp.y - 6, 10); }
      }
    }
    if (p.ground) {
      if (!this.wasGround && this.prevVy > 480) { this.burst(p.x, p.y, 5); if (this.prevVy > 800) { this.shake = 0.15; } }
      this.coyote = t; this.jumps = 0; this.lastGroundY = p.y; this.safeZ = zoneOf(p.y);
    }
    this.wasGround = p.ground; this.prevVy = p.vy;
    p.anim = !p.ground ? (p.vy < 0 ? 2 : 3) : Math.abs(p.vx) > 10 ? 1 : 0;
    // 선물 상자
    if (!this.frozen) {
      const z = zoneOf(p.y);
      for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) for (const g of buildZone(Net.s.seed, zz).gifts) {
        if (this.gifts.get(g.id) > t) continue;
        if (Math.abs(p.x - g.x) < 26 && Math.abs((p.y - 16) - g.y) < 30) {
          if (!running) { if (!this.hintAt || t - this.hintAt > 3000) { this.hintAt = t; this.toast('🎁 게임이 시작되면 열 수 있어요'); } continue; }
          this.gifts.set(g.id, t + GAME.giftRespawn); sfx('gift'); this.openQuiz('🎁 선물 상자 퀴즈!');
        }
      }
    }
    // 크게 떨어지면 슈웅~ 하고 구역 시작 지점으로
    if (this.safeZ > 0 && p.y > cpY(this.safeZ) + 360 && !this.frozen) {
      const c = buildZone(Net.s.seed, this.safeZ).cp; sfx('whoosh'); this.shake = 0.3; this.teleport(c.x, c.y); this.toast('슈웅~ 구역 시작점으로 돌아왔어요!');
    }
  }
  burst(x, y, n) { for (let i = 0; i < n; i++) this.puffs.push({ x, y, vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 120, l: 0.4 }); }
  openQuiz(tag) {
    if (this.quizBusy || !QS.length) return;
    this.quizBusy = true; this.p.vx = 0;
    Quiz.show(tag, (ok) => {
      if (ok) { this.correct++; }
      this.quizBusy = false; this.lastQuizAt = performance.now();
    });
  }
  updateFriends(dt) {
    for (const f of Net.friends.values()) {
      const q = f.q;
      if (q.length) {
        const speed = 1 + Math.max(0, q.length - 5) * 0.35;
        f.prog += dt / 0.3 * speed;
        while (f.prog >= 1 && q.length) { f.from = { ...q[0] }; q.shift(); f.prog -= 1; if (!q.length) f.prog = 0; }
        if (q.length) {
          const a = f.from, b = q[0];
          if (Math.abs(b.x - a.x) > 300 || Math.abs(b.y - a.y) > 300) { f.cur = { x: b.x, y: b.y, a: b.a, f: b.f }; f.from = { ...b }; f.prog = 0; q.shift(); }
          else f.cur = { x: a.x + (b.x - a.x) * f.prog, y: a.y + (b.y - a.y) * f.prog, a: b.a, f: b.f };
        } else f.cur = { ...f.from };
      }
    }
  }
  /* ----- 그리기 ----- */
  render() {
    const g = ctx, cam = this.camY, p = this.p, s = Net.s;
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
      for (const pl of Z.plats) if (pl.y > cam - 60 && pl.y < cam + H + 60) this.drawPlat(g, pl, zz);
      for (const sp of Z.springs) if (sp.y > cam - 60 && sp.y < cam + H + 60) this.drawSpring(g, sp);
      for (const gf of Z.gifts) if (gf.y > cam - 60 && gf.y < cam + H + 60 && !(this.gifts.get(gf.id) > performance.now())) this.drawGift(g, gf);
    }
    for (const fr of Net.friends.values()) {
      const c = fr.cur; if (c.y < cam - 80 || c.y > cam + H + 80) continue;
      drawChar(g, fr.skin, c.x, c.y, { t: this.t + fr.x, anim: c.a, flip: !!c.f, scale: 1.25 });
      this.label(g, fr.name, c.x, c.y - 68, '#ffffff');
    }
    drawChar(g, profile.skin, p.x, p.y, { t: this.t, anim: p.anim, flip: p.flip, scale: 1.35 });
    this.label(g, profile.name, p.x, p.y - 72, '#ffe27a');
    for (let i = this.puffs.length - 1; i >= 0; i--) { const q = this.puffs[i]; q.l -= 0.016; if (q.l <= 0) { this.puffs.splice(i, 1); continue; } q.x += q.vx * 0.016; q.y += q.vy * 0.016; g.globalAlpha = q.l * 2; g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, 3 + (0.4 - q.l) * 8, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.restore();
  }
  label(g, text, x, y, color) {
    g.font = '700 15px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(30,20,70,.9)'; g.lineJoin = 'round';
    g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
  }
  drawPlat(g, pl, z) {
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
    $('hudScore').textContent = `⭐ ${this.best + this.correct * GAME.pointsPer}점`;
    $('hudN').textContent = `👥 ${Net.n}명`;
        let rem = null, phase = '';
    if (s.status === 'lobby') phase = '🛝 연습 시간 · 선생님이 곧 시작해요! 마음껏 뛰어 보세요';
    else if (s.status === 'ended') { rem = 0; phase = '🏁 게임 끝'; }
    else if (countdown) { rem = s.duration * 1000; phase = '준비!'; }
    else { rem = s.endsAt - sNow; phase = '🎁 선물 상자를 먹거나 30초마다 퀴즈! 정답이면 +30점!'; }
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
    $('myRank').textContent = me ? `${me[1]} 님은 ${me[0]}등! ⭐ ${me[2]}점 · 정답 ${me[3]}개 · 최고 ${me[4]}m` : '수고했어요!';
    const ol = $('rankList'); ol.innerHTML = '';
    rank.slice(0, 10).forEach((r) => { const li = document.createElement('li'); li.textContent = `${['🥇', '🥈', '🥉'][r[0] - 1] || r[0] + '.'} ${r[1]} — ${r[2]}점 (정답 ${r[3]})`; if (me && r[5] === me[5]) li.className = 'me'; ol.append(li); });
    $('result').classList.remove('hidden');
  }
}

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
if (new URLSearchParams(location.search).has('teacher')) { askTeacher(); }
window.__et = { Net, Quiz, buildZone, mapOf, get scene() { return scene; } };
})();
