(function () {
'use strict';
const API = (window.__API || 'https://script.google.com/macros/s/AKfycbwsG56siCMnKxM0IHbAOzOzUUGX73jM2hmo7KUtOcEEzPtZCG7h6q8L-wFFNaam-rgi0A/exec');   // 말랑 크리스마스 점프 타워 전용 서버 (Apps Script)
const W = 960, H = 540, ZONE_H = 1000;   // 100m 올라갈 때마다 새로운 하늘 나라
const PHYS = { g: 1300, speed: 250, jump: 640, djump: 580, spring: 1080 };
const GAME = { drain: 3.4, energyPer: 30, pointsPer: 30, giftRespawn: 20000, gap: 2500, gateEvery: 100, superV: 1250, wrongE: 35 };   // ⚡ 에너지가 0이 되면 퀴즈 (약 30초마다) — 정답: 에너지 가득 + 🚀슈퍼 점프 + ❤️
const COIN = { gift: 5, answer: 3, gate: 5 };
const ZFX = { 5: { slip: 1 }, 6: { wind: 40 }, 7: { wind: 30 }, 8: { low: 1 }, 9: { slip: 1 }, 11: { low: 1 } };   // 구간 이벤트(풍경별)
const ZFX_MSG = { 5: '🧊 미끄러운 얼음 궁전', 6: '🌬 설산 바람 — 옆으로 밀려요', 7: '🎁 선물 구름 바람', 8: '🔔 구름 왕국 — 몸이 가벼워요!', 9: '❄️ 스노우볼 속 — 미끄러워요', 11: '🪐 크리스마스 우주 — 몸이 가벼워요!' };
const HZ_KIND = ['snow', 'snow', 'snow', 'snow', 'snow', 'snow', 'bird', 'bird', 'bird', 'snow', 'rock', 'rock'];
const EMOTES = ['', '😆', '👍', '😭', '🔥'];
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const stageEl = $('stage');
const QS = window.QUESTIONS || [];

/* ---------- 화면 크기 ---------- */
let RES = 1, LOWQ = false;   // LOWQ: 느린 크롬북이면 자동으로 가벼운 모드
function fit() {
  stageEl.style.setProperty('--u', (stageEl.clientWidth / 960).toFixed(3));
  const r = Math.min(LOWQ ? 1 : 1.25, Math.max(1, Math.round((stageEl.clientWidth * (window.devicePixelRatio || 1) / 960) * 4) / 4));   // 선명하게: 화면 크기에 맞춰 해상도 올림
  if (r !== RES || cv.width !== Math.round(960 * r)) { RES = r; cv.width = Math.round(960 * RES); cv.height = Math.round(540 * RES); for (const k in SPR) delete SPR[k]; skyCache.length = 0; PLATC.clear(); LABELC.clear(); CHC.clear(); for (const k in bgState) delete bgState[k]; }
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
  jump: () => tone(330, 0.13, 'sine', 0.08, 240), djump: () => { tone(494, 0.15, 'sine', 0.07, 330); tone(740, 0.11, 'triangle', 0.035, 160, 0.045); },
  boing: () => tone(240, 0.3, 'sine', 0.2, 600), gift: () => { tone(660, 0.1, 'triangle', 0.15); tone(880, 0.14, 'triangle', 0.15, 0, 0.09); },
  correct: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, 0, i * 0.08)); },
  wrong: () => { tone(330, 0.18, 'sine', 0.065, -35); tone(262, 0.22, 'sine', 0.055, -25, 0.15); },
  beep: () => tone(660, 0.12, 'sine', 0.08), go: () => { [523,659,784,1047].forEach((f,i)=>tone(f,.28,'triangle',.09,0,i*.06)); },
  whoosh: () => tone(900, 0.6, 'sawtooth', 0.06, -700),
  bonk: () => tone(180, 0.17, 'sine', 0.08, -70), pop: () => tone(700, 0.1, 'sine', 0.12, 300),
  ice: () => { tone(1200, 0.25, 'triangle', 0.12, -700); tone(1500, 0.15, 'sine', 0.08, -500, 0.05); },
  fanfare: () => {   // 🎺 게임 끝 팡파레
    const N = [[392, 0, .16], [392, .17, .16], [392, .34, .16], [523, .51, .42], [466, .95, .2], [523, 1.17, .2], [587, 1.39, .2], [659, 1.61, .95]];
    N.forEach(([f, t, d]) => { tone(f, d, 'sawtooth', 0.075, 0, t); tone(f, d, 'square', 0.03, 0, t); tone(f / 2, d, 'triangle', 0.09, 0, t); });
    [523, 784, 1047].forEach((f) => tone(f, 1.0, 'triangle', 0.07, 0, 1.61));
    [1319, 1568, 2093, 1568, 2093].forEach((f, i) => tone(f, 0.12, 'sine', 0.05, 0, 1.7 + i * 0.1));
  },
  super: () => { tone(300, 0.5, 'sine', 0.13, 1300); tone(600, 0.35, 'triangle', 0.06, 1500, 0.05); [1047, 1319, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.06, 0, 0.18 + i * 0.07)); },
  coin: () => { tone(1320, 0.08, 'triangle', 0.09); tone(1760, 0.12, 'triangle', 0.09, 0, 0.06); }, win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, 0, i * 0.11)); },
};
const sfx = (n) => { try { SFX[n](); } catch (e) {} };

/* ---------- 배경음악: 저작권 없는 크리스마스 캐롤(전통 곡) — 브라우저에서 직접 연주해서 번갈아 재생 ---------- */
const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freqOf(n) { const m = /^([A-G])(#|b)?(\d)$/.exec(n); let k = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; return 440 * Math.pow(2, (k - 69) / 12); }
// Original instrumental miniatures, composed for this game.
const SONGS = [
 {name:'구름 위 산책', bpm:110, bass:['C3','G2'], notes:'C5:1 E5:.5 G5:.5 A5:1 G5:1 E5:1 D5:.5 E5:.5 G5:2 A5:1 C6:.5 A5:.5 G5:1 E5:1 D5:1 E5:.5 D5:.5 C5:2 E5:1 G5:.5 A5:.5 C6:1 A5:1 G5:1 E5:1 D5:2 E5:1 D5:1 C5:4'},
 {name:'말랑 친구들의 모험', bpm:118, bass:['F3','C3'], notes:'F5:.5 A5:.5 C6:1 A5:1 G5:1 F5:1 E5:.5 F5:.5 G5:2 A5:1 G5:.5 F5:.5 E5:1 C5:1 D5:1 F5:1 E5:2 F5:.5 A5:.5 C6:1 D6:1 C6:1 A5:1 G5:1 F5:2 G5:1 E5:1 F5:4'},
 {name:'별빛 솜사탕', bpm:102, bass:['G2','D3'], notes:'G4:1 B4:1 D5:1 E5:1 D5:1 B4:.5 A4:.5 G4:2 A4:1 B4:.5 D5:.5 E5:1 G5:1 F#5:1 E5:1 D5:2 B4:1 D5:1 G5:1 F#5:1 E5:1 D5:1 B4:2 A4:1 B4:1 G4:4'}
];
const Music = {
  gain: null, on: true, idx: Math.floor(Math.random() * SONGS.length), timer: null, started: false, nodes: [],
  start() {   // 🎵 구글 AI 스튜디오(Lyria)로 만든 크리스마스 배경음악 — 안 되면 브라우저 연주로 대신
    if (this.started || !ac) return; this.started = true;
    this.gain = ac.createGain(); this.gain.gain.value = this.on ? 1 : 0; this.gain.connect(ac.destination);
    try {
      const a = this.el = new Audio('bgm.mp3?v=1'); a.loop = true; a.volume = 0.42; a.preload = 'auto';
      const src = ac.createMediaElementSource(a); src.connect(this.gain);
      a.play().then(() => { this.file = true; }).catch(() => this.next(0.4));
      a.onerror = () => { if (!this.file) this.next(0.4); };
    } catch (e) { this.next(0.4); }
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
    for (const tok of song.notes.split(' ')) { const [n, d] = tok.split(':'), len = parseFloat(d); this.note(freqOf(n), t0 + beat * spb, Math.min(.65, len * spb * 0.9), 0.045, 'sine'); beat += len; }
    for (let b = 0, k = 0; b < beat; b += 4, k++) this.note(freqOf(song.bass[k % 2]), t0 + b * spb, spb * 2.8, 0.025, 'sine');
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
const NMAP = 12;
const orderCache = new Map();
function mapOf(seed, z) {   // 10개 배경을 섞어서 돌려가며 끝없이
  const c = Math.floor(z / NMAP), key = seed + ':' + c;
  let ids = orderCache.get(key);
  if (!ids) {
    const rnd = mulberry32(hash(seed, c, 0x51ed270b)); ids = Array.from({ length: NMAP }, (_, k) => k);
    if (c > 0) for (let i = NMAP - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
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
    if (row % 11 === 5) gifts.push({ id: z * 100 + row, x: Math.round(cx), y: Math.round(y) - 18 });
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

/* ---------- 캐릭터: 말랑 크리스마스 친구 59종 (구글 플로우 원본에서 깨끗하게 잘라 낸 그림, mallang2.webp 160px × 8칸) ---------- */
const NSKIN = 59, JELLY0 = 0;
const SHEET = new Image(); let sheetOk = false; SHEET.onload = () => { sheetOk = true; if (typeof refreshPreviews === 'function') refreshPreviews(); }; SHEET.src = 'mallang2.webp?v=1';
const OUT = '#8a5646';
const hasJong = (n) => { const c = String(n).charCodeAt(String(n).length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const iga = (n) => n + (hasJong(n) ? '이' : '가'), eulreul = (n) => n + (hasJong(n) ? '을' : '를');
const SH = {}, GRD = {}, CHC = new Map();
function shade(hex, a) {   // 색을 밝게(+)/어둡게(-)
  const k = hex + a; if (SH[k]) return SH[k];
  const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(a >= 0 ? c + (255 - c) * a : c * (1 + a))));
  return (SH[k] = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`);
}
function drawChar(g, skin, x, y, o) {   // (x,y)=발 바닥 가운데. 말랑말랑: 숨쉬기 · 달릴 때 통통 · 착지하면 납작
  if (!sheetOk) return;
  const k = (((skin | 0) % NSKIN) + NSKIN) % NSKIN, s = o.scale || 1.35, t = o.t || 0, run = o.anim === 1;
  let sx = 1 + Math.sin(t * 2.2 + k) * 0.025, sy = 1 - Math.sin(t * 2.2 + k) * 0.035;
  if (run) { sx = 1 + Math.sin(t * 16) * 0.06; sy = 1 - Math.sin(t * 16) * 0.08; }
  const bs = Math.max(-0.5, Math.min(0.5, o.bs || 0)), bv = o.bv || 0; sy *= 1 + bs; sx *= 1 - bs * 0.85;
  if (o.anim === 2) { sx *= 0.94; sy *= 1.07; } else if (o.anim === 3) { sx *= 1.05; sy *= 0.96; }
  const hop = run ? Math.abs(Math.sin(t * 8)) * 3 : 0, D = 58;
  const L = Math.round(D * s), key = k + '|' + L; let spr = CHC.get(key);   // 캐릭터를 미리 알맞은 크기로 줄여 두고 그대로 찍기 (렉 방지)
  if (!spr) { spr = mk(L, L, (q) => { q.imageSmoothingQuality = 'high'; q.drawImage(SHEET, (k % 8) * 160, ((k / 8) | 0) * 160, 160, 160, 0, 0, L, L); }); if (CHC.size > 200) CHC.clear(); CHC.set(key, spr); }
  g.save(); g.translate(x, y - hop); if (o.flip) g.scale(-1, 1);
  g.transform(1, 0, Math.max(-0.35, Math.min(0.35, bv * 0.02)), 1, 0, 0); g.scale(sx, sy);
  if (o.anim === 2) g.rotate(Math.sin(t * 14) * 0.06);
  g.drawImage(spr, -L / 2, -L + 1, L, L);
  g.restore();
}
function previewSkin(canvas, skin) { canvas.width = 64; canvas.height = 64; const g = canvas.getContext('2d'); g.clearRect(0, 0, 64, 64); drawChar(g, skin, 32, 62, { t: 0, anim: 0, scale: 1.05 }); }

/* ---------- 배경: 직접 그린 10가지 하늘 나라 ---------- */
const THEMES = [   // 크리스마스 12개 나라 — 아래(마을)에서 위(우주)로
  { sky: ['#2a2a5a', '#6a4a8a', '#f0a878'], plat: ['#ffffff', '#c84a4a'], deco: ['flake', 'star'] },
  { sky: ['#3a1f1a', '#7a4a2a', '#d8a060'], plat: ['#fff4e0', '#a8642a'], deco: ['flake', 'star'] },
  { sky: ['#1a1f4a', '#3a3a7a', '#f0c080'], plat: ['#ffffff', '#d8402a'], deco: ['flake', 'star'] },
  { sky: ['#2a3a7a', '#7a8ad8', '#e8eaff'], plat: ['#ffffff', '#2f9a5a'], deco: ['flake', 'star'] },
  { sky: ['#2a1a5a', '#6a3a9a', '#c8a0e8'], plat: ['#fff6ec', '#b8743a'], deco: ['flake', 'star'] },
  { sky: ['#3a5a9a', '#8ac0e8', '#e8f6ff'], plat: ['#eaf7ff', '#5aa2dc'], deco: ['flake', 'star'] },
  { sky: ['#06182c', '#0d3a4c', '#1c6a68'], plat: ['#ffffff', '#3aa898'], deco: ['flake', 'star'] },
  { sky: ['#8a6ac8', '#e8a0c0', '#ffd890'], plat: ['#ffffff', '#e85a7a'], deco: ['flake', 'star'] },
  { sky: ['#4a4a9a', '#a08ad8', '#ffd0c0'], plat: ['#fffaf0', '#e0a838'], deco: ['flake', 'star'] },
  { sky: ['#2a3a7a', '#6a8ad0', '#d8e8ff'], plat: ['#ffffff', '#7aa4e0'], deco: ['flake', 'star'] },
  { sky: ['#0a0a2a', '#1a1a4a', '#3a3a7a'], plat: ['#ffffff', '#7a6ac8'], deco: ['flake', 'star'] },
  { sky: ['#05050f', '#120f38', '#32196a'], plat: ['#f0e4ff', '#9a6ad8'], deco: ['star', 'comet'] },
];
const THEME_NAMES = ['눈 내리는 크리스마스 마을', '산타의 장난감 공방', '반짝반짝 크리스마스 마켓', '크리스마스 트리 숲', '진저브레드 사탕 마을', '얼음 궁전', '오로라 설산', '선물 구름 하늘', '황금 종 구름 왕국', '스노우볼 속 세상', '별똥별 밤하늘', '크리스마스 우주'];
const rnd = mulberry32(777);
function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = Math.round(w * RES); c.height = Math.round(h * RES); const g = c.getContext('2d'); g.scale(RES, RES); fn(g, w, h); c.lw = w; c.lh = h; return c; }
function cloudShape(g, x, y, s, fill) { g.fillStyle = fill; g.beginPath(); [[0, 0, 34], [32, -10, 28], [62, 2, 26], [-30, 6, 22], [90, 10, 18], [30, 14, 30]].forEach(([dx, dy, r]) => { g.moveTo(x + dx * s + r * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); }); g.fill(); }
const SPR = {};
function sprite(kind) {
  if (SPR[kind]) return SPR[kind];
  let c;
  if (kind.startsWith('jamo')) { const ch = 'ㄱㄴㅏㅓㅗㅎ'[+kind.slice(4)]; return (SPR[kind] = mk(44, 44, (g) => { g.font = '900 34px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = 'rgba(90,122,200,.9)'; g.strokeText(ch, 22, 24); g.fillStyle = '#fff'; g.fillText(ch, 22, 24); })); }
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
    case 'bird': c = mk(60, 36, (g) => { g.fillStyle = '#fff'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(6, 18); g.quadraticCurveTo(18, 2, 30, 20); g.quadraticCurveTo(42, 2, 54, 18); g.stroke(); g.fillStyle = '#ffc2d4'; g.beginPath(); g.ellipse(30, 22, 9, 8, 0, 0, 7); g.fill(); g.fillStyle = '#2a1c3a'; g.beginPath(); g.arc(33, 20, 1.6, 0, 7); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(38, 22); g.lineTo(44, 24); g.lineTo(38, 26); g.fill(); }); break;
    case 'sprinkle': c = mk(30, 12, (g) => { g.fillStyle = ['#ff6fa8', '#6fc8ff', '#ffd23f'][Math.floor(rnd() * 3)]; g.beginPath(); g.roundRect ? g.roundRect(2, 3, 26, 6, 3) : g.rect(2, 3, 26, 6); g.fill(); }); break;
    case 'comet': c = mk(150, 40, (g) => { const gr = g.createLinearGradient(0, 20, 150, 20); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.95)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 20); g.lineTo(138, 12); g.lineTo(138, 28); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(140, 20, 8, 0, 7); g.fill(); }); break;
    case 'volcano': c = mk(300, 220, (g) => {
      g.fillStyle = '#3a2226'; g.beginPath(); g.moveTo(10, 220); g.lineTo(110, 70); g.lineTo(190, 70); g.lineTo(290, 220); g.closePath(); g.fill();
      g.fillStyle = '#5a3238'; g.beginPath(); g.moveTo(60, 220); g.lineTo(120, 90); g.lineTo(150, 80); g.lineTo(150, 220); g.closePath(); g.fill();
      const lg = g.createLinearGradient(0, 60, 0, 130); lg.addColorStop(0, '#ffe36a'); lg.addColorStop(1, '#ff5a1a'); g.fillStyle = lg; g.beginPath(); g.moveTo(108, 72); g.quadraticCurveTo(150, 52, 192, 72); g.lineTo(178, 104); g.quadraticCurveTo(168, 130, 160, 100); g.quadraticCurveTo(150, 150, 140, 104); g.quadraticCurveTo(130, 122, 122, 100); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,200,90,.9)'; [[130, 40, 6], [168, 30, 5], [150, 12, 4]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }); break;
    case 'ember': c = mk(20, 20, (g) => { const gr = g.createRadialGradient(10, 10, 0, 10, 10, 9); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.5, 'rgba(255,140,40,.95)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 20, 20); }); break;
    case 'smoke': c = mk(220, 110, (g) => { cloudShape(g, 80, 60, 1, 'rgba(60,40,48,.55)'); cloudShape(g, 80, 66, 1, 'rgba(110,70,70,.3)'); }); break;
    case 'lavabub': c = mk(40, 40, (g) => { const gr = g.createRadialGradient(15, 15, 2, 20, 20, 16); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(1, '#ff6a20'); g.fillStyle = gr; g.beginPath(); g.arc(20, 20, 14, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,230,160,.8)'; g.lineWidth = 2; g.stroke(); }); break;
    case 'pine': c = mk(100, 170, (g) => { g.fillStyle = '#7a4a2a'; g.fillRect(44, 130, 12, 36); [[10, 40, 90, 70, '#2f8a58'], [16, 70, 84, 100, '#3aa468'], [22, 104, 78, 140, '#48b878']].forEach(([x0, y0, x1, y1, c2]) => { g.fillStyle = c2; g.beginPath(); g.moveTo(50, y0 - 36); g.lineTo(x1, y1); g.lineTo(x0, y1); g.closePath(); g.fill(); }); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(50, 4); g.lineTo(62, 32); g.lineTo(38, 32); g.closePath(); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(50 + Math.cos(a) * r, 8 + Math.sin(a) * r); } g.fill(); [[40, 60, '#ff5a6a'], [62, 88, '#ffd23f'], [38, 112, '#6ac8ff'], [64, 124, '#ff9ad0']].forEach(([x, y, c3]) => { g.fillStyle = c3; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }); }); break;
    case 'gift': c = mk(60, 60, (g) => { g.fillStyle = '#ff5a6a'; g.fillRect(8, 22, 44, 34); g.fillStyle = '#ffd23f'; g.fillRect(27, 22, 7, 34); g.fillRect(8, 36, 44, 7); g.fillStyle = '#ff5a6a'; g.fillRect(4, 14, 52, 10); g.fillStyle = '#ffd23f'; g.fillRect(27, 14, 7, 10); g.beginPath(); g.ellipse(22, 10, 9, 6, -0.5, 0, 7); g.ellipse(38, 10, 9, 6, 0.5, 0, 7); g.fill(); }); break;
    case 'castle': c = mk(260, 230, (g) => {
      const tw = (x, w, h, c1) => { g.fillStyle = c1; g.fillRect(x, 230 - h, w, h); g.fillStyle = '#ff7ab0'; g.beginPath(); g.moveTo(x - 6, 230 - h); g.lineTo(x + w / 2, 230 - h - 44); g.lineTo(x + w + 6, 230 - h); g.closePath(); g.fill(); g.fillStyle = '#ffe27a'; g.fillRect(x + w / 2 - 5, 230 - h + 16, 10, 16); };
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 0, 0, 0); tw(30, 50, 120, '#fff0fa'); tw(180, 50, 140, '#fff0fa'); tw(100, 64, 160, '#ffe6f6');
      g.fillStyle = '#fff0fa'; g.fillRect(80, 150, 100, 80); g.fillStyle = '#c890e8'; g.beginPath(); g.arc(130, 230, 22, Math.PI, 0); g.fill();
      g.strokeStyle = '#ff7ab0'; g.lineWidth = 2; g.beginPath(); g.moveTo(132, 24); g.lineTo(132, -0); g.stroke(); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(132, 2); g.lineTo(154, 9); g.lineTo(132, 16); g.fill(); }); break;
    case 'mush': c = mk(80, 80, (g) => { g.fillStyle = '#fff2dc'; g.fillRect(32, 42, 16, 34); g.fillStyle = '#ff5a6a'; g.beginPath(); g.ellipse(40, 42, 36, 28, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; [[22, 32, 6], [44, 24, 7], [58, 36, 5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }); break;
    case 'fish': c = mk(70, 40, (g) => { g.fillStyle = '#ffb04a'; g.beginPath(); g.ellipse(30, 20, 24, 14, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(50, 20); g.lineTo(68, 6); g.lineTo(68, 34); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(18, 16, 4, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(18, 16, 2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(30, 8, 4, 24); }); break;
    case 'coral': c = mk(120, 150, (g) => { g.strokeStyle = '#ff7a9a'; g.lineWidth = 10; g.lineCap = 'round'; [[60, 150, 60, 60], [60, 110, 24, 70], [60, 100, 98, 56], [24, 70, 18, 40], [98, 56, 104, 30]].forEach(([x1, y1, x2, y2]) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }); }); break;
    case 'pyramid': c = mk(260, 170, (g) => { g.fillStyle = '#e8b868'; g.beginPath(); g.moveTo(10, 170); g.lineTo(110, 20); g.lineTo(210, 170); g.closePath(); g.fill(); g.fillStyle = '#c8964a'; g.beginPath(); g.moveTo(110, 20); g.lineTo(210, 170); g.lineTo(120, 170); g.closePath(); g.fill(); g.fillStyle = '#d8a858'; g.beginPath(); g.moveTo(170, 170); g.lineTo(220, 90); g.lineTo(256, 170); g.closePath(); g.fill(); }); break;
    case 'cactus': c = mk(70, 110, (g) => { g.fillStyle = '#5ab86a'; g.beginPath(); g.roundRect ? g.roundRect(26, 10, 20, 98, 10) : g.rect(26, 10, 20, 98); g.fill(); g.beginPath(); g.roundRect ? g.roundRect(6, 44, 14, 36, 7) : g.rect(6, 44, 14, 36); g.fill(); g.fillRect(10, 70, 24, 10); g.beginPath(); g.roundRect ? g.roundRect(52, 30, 14, 34, 7) : g.rect(52, 30, 14, 34); g.fill(); g.fillRect(40, 56, 20, 9); g.fillStyle = '#ff7ab0'; g.beginPath(); g.arc(36, 10, 6, 0, 7); g.fill(); }); break;
    case 'leaf': c = mk(50, 60, (g) => { g.fillStyle = 'rgba(200,255,170,.85)'; g.beginPath(); g.moveTo(25, 4); g.quadraticCurveTo(58, 30, 25, 58); g.quadraticCurveTo(-8, 30, 25, 4); g.fill(); g.strokeStyle = 'rgba(80,150,70,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(25, 8); g.lineTo(25, 56); g.stroke(); }); break;
    case 'firefly': c = mk(26, 26, (g) => { const gr = g.createRadialGradient(13, 13, 0, 13, 13, 12); gr.addColorStop(0, '#fffbb0'); gr.addColorStop(0.4, 'rgba(230,255,120,.8)'); gr.addColorStop(1, 'rgba(230,255,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 26, 26); }); break;
    case 'ship': c = mk(250, 220, (g) => { g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(20, 150); g.lineTo(230, 150); g.lineTo(200, 200); g.lineTo(50, 200); g.closePath(); g.fill(); g.fillStyle = '#5a3418'; g.fillRect(122, 20, 8, 132); [[132, 30, 96, 70, 'rgba(255,255,255,.95)'], [112, 44, 80, 70, 'rgba(255,255,255,.9)']].forEach(([x, y, w, h, c1]) => { g.fillStyle = c1; g.beginPath(); if (x > 120) { g.moveTo(x, y); g.quadraticCurveTo(x + w + 8, y + h / 2, x, y + h * 1.6); } else { g.moveTo(x + 8, y); g.quadraticCurveTo(x - w, y + h / 2, x + 8, y + h * 1.6); } g.closePath(); g.fill(); }); g.fillStyle = '#222'; g.fillRect(132, 6, 40, 20); g.fillStyle = '#fff'; g.beginPath(); g.arc(144, 16, 4, 0, 7); g.fill(); }); break;
    case 'block': c = mk(70, 70, (g) => { const col = ['#ff5a6a', '#4aa8ff', '#ffd23f', '#5ac86a'][Math.floor(rnd() * 4)]; g.fillStyle = col; g.fillRect(6, 14, 58, 52); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(6, 14, 58, 8); g.fillStyle = col; [[18, 4], [44, 4]].forEach(([x, y]) => { g.beginPath(); g.roundRect ? g.roundRect(x - 8, y, 16, 12, 3) : g.rect(x - 8, y, 16, 12); g.fill(); }); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(6, 56, 58, 10); g.fillStyle = '#fff'; g.font = '900 26px sans-serif'; g.textAlign = 'center'; g.fillText('ABC'[Math.floor(rnd() * 3)], 35, 52); }); break;
    case 'stormcloud': c = mk(240, 120, (g) => { cloudShape(g, 90, 62, 1.1, 'rgba(70,70,100,.8)'); cloudShape(g, 90, 70, 1.1, 'rgba(120,120,150,.4)'); }); break;
    case 'bolt': c = mk(50, 100, (g) => { g.fillStyle = '#fff6a0'; g.strokeStyle = 'rgba(255,220,80,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 2); g.lineTo(10, 52); g.lineTo(26, 52); g.lineTo(14, 98); g.lineTo(42, 40); g.lineTo(26, 40); g.lineTo(36, 2); g.closePath(); g.fill(); g.stroke(); }); break;
    case 'drop': c = mk(20, 34, (g) => { g.fillStyle = 'rgba(170,210,255,.85)'; g.beginPath(); g.moveTo(10, 2); g.quadraticCurveTo(22, 20, 10, 32); g.quadraticCurveTo(-2, 20, 10, 2); g.fill(); }); break;
    case 'fern': c = mk(100, 120, (g) => { g.strokeStyle = '#4a9a4a'; g.lineWidth = 5; g.lineCap = 'round'; [-1, 0, 1].forEach((d) => { g.beginPath(); g.moveTo(50, 118); g.quadraticCurveTo(50 + d * 20, 60, 50 + d * 42, 20); g.stroke(); for (let k = 0; k < 5; k++) { const t = 0.2 + k * 0.17, x = 50 + d * (42 * t) , y = 118 - 98 * t; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 8); g.moveTo(x, y); g.lineTo(x - 14, y - 8); g.stroke(); } }); }); break;
    case 'egg': c = mk(60, 76, (g) => { g.fillStyle = '#fff2cc'; g.beginPath(); g.ellipse(30, 42, 24, 32, 0, 0, 7); g.fill(); g.fillStyle = '#8acb78'; [[20, 30, 6], [38, 46, 7], [24, 56, 5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }); break;
    case 'snowman': c = mk(80, 130, (g) => { g.fillStyle = '#fff'; g.strokeStyle = 'rgba(140,176,224,.9)'; g.lineWidth = 2; [[40, 96, 28], [40, 50, 20]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }); g.fillStyle = '#333'; g.beginPath(); g.arc(33, 46, 2.4, 0, 7); g.arc(47, 46, 2.4, 0, 7); g.fill(); g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(40, 52); g.lineTo(56, 55); g.lineTo(40, 58); g.fill(); g.fillStyle = '#e84a4a'; g.fillRect(22, 66, 36, 8); g.fillStyle = '#333'; g.fillRect(26, 18, 28, 6); g.fillRect(31, 2, 18, 18); }); break;
    case 'ferris': c = mk(200, 230, (g) => { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(100, 100, 80, 0, 7); g.stroke(); g.beginPath(); g.arc(100, 100, 50, 0, 7); g.stroke(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(100, 100); g.lineTo(100 + Math.cos(a) * 80, 100 + Math.sin(a) * 80); g.stroke(); g.fillStyle = ['#ff5a8a', '#ffd23f', '#5ac8ff', '#8ae068'][k % 4]; g.beginPath(); g.arc(100 + Math.cos(a) * 80, 100 + Math.sin(a) * 80, 9, 0, 7); g.fill(); } g.beginPath(); g.moveTo(100, 100); g.lineTo(60, 228); g.moveTo(100, 100); g.lineTo(140, 228); g.stroke(); }); break;
    case 'rocket': c = mk(60, 120, (g) => { g.fillStyle = '#f4f4ff'; g.beginPath(); g.moveTo(30, 4); g.quadraticCurveTo(58, 40, 50, 92); g.lineTo(10, 92); g.quadraticCurveTo(2, 40, 30, 4); g.fill(); g.fillStyle = '#ff5a6a'; g.beginPath(); g.moveTo(30, 4); g.quadraticCurveTo(46, 20, 48, 30); g.lineTo(12, 30); g.quadraticCurveTo(14, 20, 30, 4); g.fill(); g.fillStyle = '#5ac8ff'; g.beginPath(); g.arc(30, 52, 9, 0, 7); g.fill(); g.fillStyle = '#ff5a6a'; g.beginPath(); g.moveTo(10, 78); g.lineTo(0, 100); g.lineTo(14, 92); g.moveTo(50, 78); g.lineTo(60, 100); g.lineTo(46, 92); g.fill(); g.fillStyle = '#ffb02a'; g.beginPath(); g.moveTo(20, 92); g.lineTo(30, 118); g.lineTo(40, 92); g.fill(); }); break;
    case 'flower': c = mk(70, 100, (g) => { g.strokeStyle = '#4a9a4a'; g.lineWidth = 4; g.beginPath(); g.moveTo(35, 98); g.lineTo(35, 40); g.stroke(); const col = ['#ff7ab0', '#ffd23f', '#ff9a4a', '#c890ff'][Math.floor(rnd() * 4)]; g.fillStyle = col; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.arc(35 + Math.cos(a) * 15, 30 + Math.sin(a) * 15, 11, 0, 7); g.fill(); } g.fillStyle = '#fff2a0'; g.beginPath(); g.arc(35, 30, 9, 0, 7); g.fill(); }); break;
    case 'bee': c = mk(50, 40, (g) => { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(18, 10, 10, 7, -0.4, 0, 7); g.ellipse(32, 10, 10, 7, 0.4, 0, 7); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(25, 24, 17, 11, 0, 0, 7); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(19, 14, 4, 20); g.fillRect(29, 14, 4, 20); g.beginPath(); g.arc(38, 22, 2, 0, 7); g.fill(); }); break;
    case 'building': c = mk(110, 200, (g) => { const col = ['#2a1a4a', '#3a2260', '#241440'][Math.floor(rnd() * 3)]; g.fillStyle = col; g.fillRect(10, 40, 90, 160); for (let y = 54; y < 190; y += 22) for (let x = 20; x < 90; x += 22) { g.fillStyle = rnd() < 0.55 ? ['#ffe27a', '#ff7ad0', '#7ae8ff'][Math.floor(rnd() * 3)] : 'rgba(255,255,255,.08)'; g.fillRect(x, y, 12, 12); } g.strokeStyle = '#ff4ad0'; g.lineWidth = 3; g.strokeRect(10, 40, 90, 160); }); break;
    case 'fruit': c = mk(70, 70, (g) => { const k = Math.floor(rnd() * 3); if (k === 0) { g.fillStyle = '#5ac86a'; g.beginPath(); g.arc(35, 35, 28, 0, Math.PI); g.fill(); g.fillStyle = '#ff5a7a'; g.beginPath(); g.arc(35, 35, 24, 0, Math.PI); g.fill(); g.fillStyle = '#222'; [[22, 44], [35, 50], [48, 44]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 2, 3, 0, 0, 7); g.fill(); }); } else if (k === 1) { g.fillStyle = '#ff9a2a'; g.beginPath(); g.arc(35, 38, 26, 0, 7); g.fill(); g.fillStyle = '#ffd88a'; g.beginPath(); g.arc(35, 38, 20, 0, 7); g.fill(); g.strokeStyle = '#ff9a2a'; g.lineWidth = 2; for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(35, 38); g.lineTo(35 + Math.cos(a * Math.PI / 3) * 20, 38 + Math.sin(a * Math.PI / 3) * 20); g.stroke(); } } else { g.fillStyle = '#ff4a5a'; g.beginPath(); g.moveTo(35, 66); g.bezierCurveTo(4, 40, 10, 14, 35, 20); g.bezierCurveTo(60, 14, 66, 40, 35, 66); g.fill(); g.fillStyle = '#4aa85a'; g.beginPath(); g.ellipse(35, 16, 12, 5, 0, 0, 7); g.fill(); } }); break;
    case 'ghost': c = mk(70, 90, (g) => { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(35, 36, 26, Math.PI, 0); g.lineTo(61, 82); for (let k = 0; k < 4; k++) g.quadraticCurveTo(56 - k * 13, 70, 48 - k * 13, 82); g.lineTo(9, 36); g.fill(); g.fillStyle = '#2a1a3a'; g.beginPath(); g.ellipse(26, 36, 4, 6, 0, 0, 7); g.ellipse(44, 36, 4, 6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(35, 52, 5, 7, 0, 0, 7); g.fill(); }); break;
    case 'bat': c = mk(70, 36, (g) => { g.fillStyle = '#1a0a2a'; g.beginPath(); g.moveTo(35, 10); g.quadraticCurveTo(20, -4, 2, 8); g.quadraticCurveTo(12, 14, 14, 28); g.quadraticCurveTo(22, 18, 30, 26); g.lineTo(35, 20); g.lineTo(40, 26); g.quadraticCurveTo(48, 18, 56, 28); g.quadraticCurveTo(58, 14, 68, 8); g.quadraticCurveTo(50, -4, 35, 10); g.fill(); g.fillStyle = '#ff5a5a'; g.fillRect(31, 12, 3, 3); g.fillRect(38, 12, 3, 3); }); break;
    case 'pump': c = mk(70, 70, (g) => { g.fillStyle = '#ff8a2a'; g.beginPath(); g.ellipse(35, 42, 30, 24, 0, 0, 7); g.fill(); g.strokeStyle = '#d86a10'; g.lineWidth = 2; [-14, 0, 14].forEach((d) => { g.beginPath(); g.ellipse(35 + d, 42, 6, 24, 0, 0, 7); g.stroke(); }); g.fillStyle = '#4a8a3a'; g.fillRect(32, 12, 7, 10); g.fillStyle = '#2a1a0a'; g.beginPath(); g.moveTo(22, 36); g.lineTo(30, 36); g.lineTo(26, 44); g.moveTo(40, 36); g.lineTo(48, 36); g.lineTo(44, 44); g.fill(); g.beginPath(); g.arc(35, 50, 9, 0, Math.PI); g.fill(); }); break;
    case 'palm': c = mk(140, 190, (g) => { g.strokeStyle = '#9a6a3a'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(70, 186); g.quadraticCurveTo(84, 110, 70, 50); g.stroke(); g.fillStyle = '#3aa85a'; [[-1, 0], [-0.5, -0.4], [0.5, -0.4], [1, 0], [0, -0.7]].forEach(([d, u]) => { g.beginPath(); g.moveTo(70, 50); g.quadraticCurveTo(70 + d * 36, 20 + u * 50, 70 + d * 62, 56 + u * 30); g.quadraticCurveTo(70 + d * 36, 40 + u * 50, 70, 54); g.fill(); }); g.fillStyle = '#7a4a2a'; g.beginPath(); g.arc(64, 56, 5, 0, 7); g.arc(77, 58, 5, 0, 7); g.fill(); }); break;
    case 'petal': c = mk(20, 20, (g) => { g.fillStyle = 'rgba(255,170,200,.9)'; g.beginPath(); g.ellipse(10, 10, 8, 5, 0.6, 0, 7); g.fill(); }); break;
    case 'torii': c = mk(200, 160, (g) => { g.fillStyle = '#e8402a'; g.fillRect(36, 40, 14, 118); g.fillRect(150, 40, 14, 118); g.fillRect(14, 30, 172, 14); g.fillRect(28, 56, 144, 10); g.fillStyle = '#2a1a1a'; g.fillRect(8, 22, 184, 9); }); break;
    case 'lantern': c = mk(40, 70, (g) => { g.strokeStyle = '#6a3a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 0); g.lineTo(20, 12); g.stroke(); const gr = g.createRadialGradient(20, 38, 2, 20, 38, 22); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(1, '#ff5a3a'); g.fillStyle = gr; g.beginPath(); g.ellipse(20, 38, 15, 22, 0, 0, 7); g.fill(); g.fillStyle = '#7a2a1a'; g.fillRect(10, 14, 20, 5); g.fillRect(10, 58, 20, 5); }); break;
    case 'jcrown': c = mk(54, 44, (g) => {
      g.lineJoin = 'round';
      const body = (path, c0, c1, c2) => { const gr = g.createLinearGradient(0, 6, 0, 40); gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2); g.fillStyle = gr; path(); g.fill(); };
      const P = () => { g.beginPath(); g.moveTo(8, 36); g.quadraticCurveTo(5, 22, 6, 12); g.quadraticCurveTo(15, 20, 19, 24); g.quadraticCurveTo(21, 12, 27, 5); g.quadraticCurveTo(33, 12, 35, 24); g.quadraticCurveTo(39, 20, 48, 12); g.quadraticCurveTo(49, 22, 46, 36); g.quadraticCurveTo(27, 41, 8, 36); g.closePath(); };
      g.shadowColor = 'rgba(200,120,0,.45)'; g.shadowBlur = 5; body(P, '#fff2a0', '#ffd23f', '#f0a21a');
      g.shadowBlur = 0; g.lineWidth = 2; g.strokeStyle = 'rgba(214,140,10,.85)'; P(); g.stroke();
      [[6, 11, 3.6, '#ff7aa8'], [27, 4, 4, '#7ad8ff'], [48, 11, 3.6, '#ff7aa8']].forEach(([x, y, r, col]) => { const gr = g.createRadialGradient(x - 1, y - 1, 0.5, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, col); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.stroke(); });
      [[17, 31], [27, 31], [37, 31]].forEach(([x, y], k) => { g.fillStyle = k === 1 ? '#ff7aa8' : '#7ad8ff'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x - 1, y - 1, 1, 0, 7); g.fill(); });
      g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.ellipse(17, 14, 6, 2.4, -0.7, 0, 7); g.fill(); g.beginPath(); g.ellipse(11, 28, 3, 1.4, -1.1, 0, 7); g.fill();
    }); break;
    case 'sparkle': c = mk(26, 26, (g) => { const gr = g.createRadialGradient(13, 13, 0, 13, 13, 12); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 26, 26); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(13, 1); g.lineTo(15, 11); g.lineTo(25, 13); g.lineTo(15, 15); g.lineTo(13, 25); g.lineTo(11, 15); g.lineTo(1, 13); g.lineTo(11, 11); g.fill(); }); break;
    case 'dust': c = mk(16, 16, (g) => { const gr = g.createRadialGradient(8, 8, 0, 8, 8, 7); gr.addColorStop(0, 'rgba(255,245,220,.75)'); gr.addColorStop(1, 'rgba(255,245,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 16, 16); }); break;
    case 'confetti': c = mk(14, 10, (g) => { g.fillStyle = ['#ff6fa8', '#6fc8ff', '#ffd23f', '#8ae068'][Math.floor(rnd() * 4)]; g.fillRect(2, 2, 10, 5); }); break;
    case 'dolmen': c = mk(240, 130, (g) => { g.fillStyle = '#8a8a92'; g.beginPath(); g.moveTo(34, 128); g.lineTo(42, 50); g.lineTo(84, 50); g.lineTo(92, 128); g.fill(); g.beginPath(); g.moveTo(148, 128); g.lineTo(156, 50); g.lineTo(198, 50); g.lineTo(206, 128); g.fill(); g.fillStyle = '#a4a4ae'; g.beginPath(); g.moveTo(10, 56); g.quadraticCurveTo(120, 8, 230, 52); g.lineTo(224, 66); g.quadraticCurveTo(120, 36, 16, 70); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(48, 56, 10, 66); }); break;
    case 'hut': c = mk(170, 120, (g) => { g.fillStyle = '#c8a050'; g.beginPath(); g.moveTo(85, 6); g.lineTo(162, 112); g.lineTo(8, 112); g.closePath(); g.fill(); g.strokeStyle = '#8a6a28'; g.lineWidth = 2; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(85, 6); g.lineTo(8 + k * 25.7, 112); g.stroke(); } g.fillStyle = '#4a3418'; g.beginPath(); g.moveTo(70, 112); g.lineTo(100, 112); g.lineTo(96, 78); g.lineTo(74, 78); g.fill(); }); break;
    case 'pottery': c = mk(70, 96, (g) => { g.fillStyle = '#c87a4a'; g.beginPath(); g.moveTo(14, 8); g.lineTo(56, 8); g.quadraticCurveTo(66, 40, 44, 92); g.lineTo(26, 92); g.quadraticCurveTo(4, 40, 14, 8); g.fill(); g.strokeStyle = '#6a3a1a'; g.lineWidth = 2.5; for (let y = 24; y < 80; y += 14) { g.beginPath(); g.moveTo(12 + (y > 60 ? 8 : 0), y); for (let x = 16; x < 56; x += 8) g.lineTo(x, y + ((x / 8) % 2 ? 6 : 0)); g.stroke(); } }); break;
    case 'mirror': c = mk(80, 80, (g) => { g.fillStyle = '#c89a3a'; g.beginPath(); g.arc(40, 40, 34, 0, 7); g.fill(); g.strokeStyle = '#7a5a18'; g.lineWidth = 2; [28, 20, 8].forEach((r) => { g.beginPath(); g.arc(40, 40, r, 0, 7); g.stroke(); }); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.beginPath(); g.moveTo(40 + Math.cos(a) * 20, 40 + Math.sin(a) * 20); g.lineTo(40 + Math.cos(a) * 28, 40 + Math.sin(a) * 28); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(28, 26, 12, 6, -0.6, 0, 7); g.fill(); }); break;
    case 'crown': c = mk(140, 120, (g) => { g.fillStyle = '#ffd23f'; g.strokeStyle = '#b8860b'; g.lineWidth = 2.5; g.fillRect(24, 74, 92, 14); g.strokeRect(24, 74, 92, 14); [[30, 74, 14, 38], [58, 74, 14, 56], [84, 74, 14, 56], [110, 74, 14, 38]].forEach(([x, y, w, h]) => { g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + w / 2, y - h); g.lineTo(x + w + 2, y); g.closePath(); g.fill(); g.stroke(); }); g.fillStyle = '#ffd23f'; [[44, 20], [70, 8], [96, 20]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y + 46); g.lineTo(x, y + 12); g.lineTo(x - 7, y + 4); g.moveTo(x, y + 26); g.lineTo(x + 9, y + 18); g.strokeStyle = '#d8a41a'; g.lineWidth = 4; g.stroke(); }); g.fillStyle = '#3ac8a8'; [[44, 18], [70, 6], [96, 18], [30, 66], [70, 70], [110, 66]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }); g.strokeStyle = '#ffd23f'; g.lineWidth = 2; [[34, 88], [54, 88], [86, 88], [106, 88]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 14); g.stroke(); g.fillStyle = '#3ac8a8'; g.beginPath(); g.arc(x, y + 17, 3.5, 0, 7); g.fill(); }); }); break;
    case 'cheomseong': c = mk(110, 190, (g) => { g.fillStyle = '#d8cdb0'; g.beginPath(); g.moveTo(34, 188); g.quadraticCurveTo(14, 150, 40, 120); g.lineTo(42, 40); g.lineTo(68, 40); g.lineTo(70, 120); g.quadraticCurveTo(96, 150, 76, 188); g.fill(); g.fillStyle = '#b8ac90'; g.fillRect(36, 36, 38, 8); g.fillRect(40, 28, 30, 8); g.fillRect(34, 20, 42, 8); g.fillStyle = '#4a4030'; g.fillRect(48, 96, 14, 18); g.strokeStyle = 'rgba(120,100,70,.5)'; g.lineWidth = 1.5; for (let y = 50; y < 186; y += 14) { g.beginPath(); g.moveTo(26, y); g.lineTo(84, y); g.stroke(); } }); break;
    case 'celadon': c = mk(80, 120, (g) => { const gr = g.createLinearGradient(0, 0, 80, 0); gr.addColorStop(0, '#6ac8b0'); gr.addColorStop(0.45, '#bff0dd'); gr.addColorStop(1, '#4aa890'); g.fillStyle = gr; g.beginPath(); g.moveTo(32, 6); g.lineTo(48, 6); g.lineTo(46, 30); g.quadraticCurveTo(74, 52, 60, 100); g.quadraticCurveTo(58, 116, 40, 116); g.quadraticCurveTo(22, 116, 20, 100); g.quadraticCurveTo(6, 52, 34, 30); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 2; g.beginPath(); g.arc(40, 66, 12, 0, 7); g.moveTo(36, 62); g.quadraticCurveTo(40, 54, 44, 62); g.stroke(); g.fillStyle = '#3a8a78'; g.fillRect(30, 4, 20, 5); }); break;
    case 'pagoda': c = mk(90, 190, (g) => { g.fillStyle = '#d4d0c4'; [[20, 150, 50, 36], [24, 96, 42, 52], [28, 50, 34, 44]].forEach(([x, y, w, h]) => { g.fillRect(x + 8, y, w - 16, h); g.fillStyle = '#b4b0a4'; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + w + 8, y); g.lineTo(x + w - 2, y - 10); g.lineTo(x + 2, y - 10); g.closePath(); g.fill(); g.fillStyle = '#d4d0c4'; }); g.fillStyle = '#b4b0a4'; g.fillRect(43, 14, 4, 34); [20, 30, 40].forEach((y) => g.fillRect(36, y, 18, 3)); g.fillStyle = '#9a9488'; g.fillRect(8, 186, 74, 4); }); break;
    case 'palace': c = mk(320, 190, (g) => { const roof = (x, y, w, c1) => { g.fillStyle = c1; g.beginPath(); g.moveTo(x - 14, y + 6); g.quadraticCurveTo(x + w / 2, y - 20, x + w + 14, y + 6); g.lineTo(x + w, y + 26); g.lineTo(x, y + 26); g.closePath(); g.fill(); g.fillStyle = '#3a4a3a'; g.fillRect(x - 6, y + 22, w + 12, 6); }; g.fillStyle = '#a8a098'; g.fillRect(10, 160, 300, 26); g.fillStyle = '#c8402a'; for (let x = 58; x < 270; x += 36) g.fillRect(x, 106, 8, 54); g.fillStyle = '#2a6a8a'; g.fillRect(48, 96, 224, 12); g.fillStyle = '#e8d8a0'; g.fillRect(52, 110, 216, 50); g.fillStyle = '#c8402a'; for (let x = 58; x < 270; x += 36) g.fillRect(x, 106, 8, 54); roof(30, 70, 260, '#4a5a68'); g.fillStyle = '#2a6a8a'; g.fillRect(110, 52, 100, 12); g.fillStyle = '#c8402a'; for (let x = 116; x < 206; x += 28) g.fillRect(x, 24, 7, 30); g.fillStyle = '#e8d8a0'; g.fillRect(114, 28, 92, 26); for (let x = 116; x < 206; x += 28) { g.fillStyle = '#c8402a'; g.fillRect(x, 28, 7, 28); } roof(90, 4, 140, '#4a5a68'); }); break;
    case 'hangul': c = mk(140, 80, (g) => { g.font = '900 64px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#5a7ac8'; g.strokeText('한글', 70, 42); g.fillStyle = '#fff'; g.fillText('한글', 70, 42); }); break;
    case 'turtle': c = mk(280, 170, (g) => { g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(26, 96); g.lineTo(250, 96); g.lineTo(224, 148); g.lineTo(56, 148); g.closePath(); g.fill(); g.fillStyle = '#5a6a5a'; g.beginPath(); g.moveTo(44, 96); g.quadraticCurveTo(140, 24, 236, 96); g.closePath(); g.fill(); g.fillStyle = '#e8e0c0'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(70 + k * 28, 80 - Math.sin(k * 0.55) * 18); g.lineTo(74 + k * 28, 64 - Math.sin(k * 0.55) * 26); g.lineTo(80 + k * 28, 80 - Math.sin(k * 0.55) * 18); g.fill(); } g.fillStyle = '#3a8a68'; g.beginPath(); g.moveTo(26, 96); g.quadraticCurveTo(0, 80, 6, 58); g.quadraticCurveTo(24, 62, 34, 78); g.lineTo(40, 96); g.fill(); g.fillStyle = '#ff5a3a'; g.beginPath(); g.arc(14, 68, 3.5, 0, 7); g.fill(); g.fillStyle = '#c8402a'; g.fillRect(140, 4, 4, 52); g.beginPath(); g.moveTo(144, 6); g.lineTo(190, 14); g.lineTo(144, 24); g.fill(); g.fillStyle = '#2a1a0a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(80 + k * 30, 122, 4, 0, 7); g.fill(); } }); break;
    case 'gull': c = mk(70, 34, (g) => { g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(4, 22); g.quadraticCurveTo(18, 2, 35, 20); g.quadraticCurveTo(52, 2, 66, 22); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(35, 20, 6, 4, 0, 0, 7); g.fill(); }); break;
    case 'taegeuk': c = mk(170, 118, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 170, 118); g.strokeStyle = '#ccc'; g.lineWidth = 2; g.strokeRect(1, 1, 168, 116); g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(85, 59, 26, Math.PI, 0); g.fill(); g.fillStyle = '#0047a0'; g.beginPath(); g.arc(85, 59, 26, 0, Math.PI); g.fill(); g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(98, 59, 13, 0, Math.PI); g.fill(); g.fillStyle = '#0047a0'; g.beginPath(); g.arc(72, 59, 13, Math.PI, 0); g.fill(); g.fillStyle = '#111'; const bars = (x, y, rot, pat) => { g.save(); g.translate(x, y); g.rotate(rot); pat.forEach((full, k) => { if (full) g.fillRect(-14, k * 7 - 7, 28, 4); else { g.fillRect(-14, k * 7 - 7, 11, 4); g.fillRect(3, k * 7 - 7, 11, 4); } }); g.restore(); }; bars(28, 22, -0.55, [1, 1, 1]); bars(142, 96, -0.55, [0, 0, 0]); bars(142, 22, 0.55, [0, 1, 0]); bars(28, 96, 0.55, [1, 0, 1]); }); break;
    case 'dokdo': c = mk(280, 180, (g) => { g.fillStyle = '#6a6a62'; g.beginPath(); g.moveTo(20, 172); g.lineTo(46, 80); g.lineTo(78, 54); g.lineTo(112, 74); g.lineTo(126, 172); g.fill(); g.beginPath(); g.moveTo(130, 172); g.lineTo(158, 96); g.lineTo(196, 70); g.lineTo(236, 90); g.lineTo(262, 172); g.fill(); g.fillStyle = '#5ab85a'; g.beginPath(); g.moveTo(46, 80); g.lineTo(78, 54); g.lineTo(112, 74); g.lineTo(98, 86); g.lineTo(60, 92); g.closePath(); g.fill(); g.beginPath(); g.moveTo(158, 96); g.lineTo(196, 70); g.lineTo(236, 90); g.lineTo(212, 100); g.lineTo(176, 106); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, 168, 280, 8); }); break;
    case 'hallasan': c = mk(340, 180, (g) => { g.fillStyle = '#5a8a5a'; g.beginPath(); g.moveTo(0, 178); g.quadraticCurveTo(100, 150, 140, 40); g.lineTo(200, 40); g.quadraticCurveTo(240, 150, 340, 178); g.closePath(); g.fill(); g.fillStyle = '#7ab87a'; g.beginPath(); g.moveTo(40, 178); g.quadraticCurveTo(110, 140, 146, 44); g.lineTo(168, 44); g.lineTo(150, 178); g.closePath(); g.fill(); g.fillStyle = '#6a6a72'; g.beginPath(); g.moveTo(138, 46); g.lineTo(160, 22); g.lineTo(182, 46); g.lineTo(202, 42); g.lineTo(140, 42); g.closePath(); g.fill(); g.fillStyle = '#8ad0f0'; g.beginPath(); g.ellipse(168, 44, 18, 5, 0, 0, 7); g.fill(); }); break;
    case 'dolhareubang': c = mk(70, 130, (g) => { g.fillStyle = '#4a4a50'; g.beginPath(); g.moveTo(14, 126); g.quadraticCurveTo(8, 60, 18, 44); g.lineTo(52, 44); g.quadraticCurveTo(62, 60, 56, 126); g.fill(); g.fillStyle = '#5a5a62'; g.beginPath(); g.moveTo(10, 36); g.quadraticCurveTo(35, 10, 60, 36); g.lineTo(56, 18); g.quadraticCurveTo(35, 0, 14, 18); g.fill(); g.fillStyle = '#3a3a40'; g.fillRect(14, 26, 42, 10); g.fillStyle = '#d8d8dc'; g.beginPath(); g.ellipse(28, 54, 5, 3, 0, 0, 7); g.ellipse(44, 54, 5, 3, 0, 0, 7); g.fill(); g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(28, 54, 2, 0, 7); g.arc(44, 54, 2, 0, 7); g.fill(); g.fillRect(30, 70, 12, 4); g.fillStyle = '#5a5a62'; g.beginPath(); g.ellipse(20, 96, 8, 6, 0, 0, 7); g.ellipse(52, 96, 8, 6, 0, 0, 7); g.fill(); }); break;
    case 'tangerine': c = mk(44, 44, (g) => { g.fillStyle = '#ff9a1a'; g.beginPath(); g.arc(22, 26, 16, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(16, 20, 5, 3, -0.5, 0, 7); g.fill(); g.fillStyle = '#4aa84a'; g.beginPath(); g.ellipse(26, 8, 8, 4, 0.5, 0, 7); g.fill(); }); break;
    case 'seoultower': c = mk(70, 250, (g) => { g.fillStyle = '#e8e8f4'; g.fillRect(31, 70, 8, 170); g.fillStyle = '#c8c8d8'; g.fillRect(26, 200, 18, 40); g.fillStyle = '#d8d8ea'; g.beginPath(); g.ellipse(35, 66, 24, 12, 0, 0, 7); g.fill(); g.fillStyle = '#8ad8ff'; g.fillRect(14, 62, 42, 7); g.fillStyle = '#e8e8f4'; g.fillRect(34, 4, 2, 52); g.fillStyle = '#ff5a6a'; g.beginPath(); g.arc(35, 4, 3, 0, 7); g.fill(); g.fillStyle = '#4a5a78'; g.fillRect(10, 236, 50, 12); }); break;
    default: c = mk(2, 2, () => {});
  }
  return (SPR[kind] = c);
}
const skyCache = [], PLATC = new Map(), LABELC = new Map();
const BGIMG = new Set(Array.from({ length: 12 }, (_, k) => k));   // 플로우로 만든 그림 배경이 있는 맵 번호 (bg/번호.jpg)
const bgState = {};
const BGSKIP = new Set(['comet', 'cloud']);
function loadBg(i) {   // 필요할 때 한 번만 불러와서, 다 오면 기존 하늘 그림을 바꿔 끼움 (실패하면 그대로 코드 배경)
  if (bgState[i]) return; bgState[i] = 1;
  const im = new Image(); im.onload = () => { skyCache[i] = mk(W, H, (g) => { g.drawImage(im, 0, 0, W, H); g.fillStyle = 'rgba(20,14,50,.22)'; g.fillRect(0, 0, W, H); }); skyCache[i].img = 1; }; im.src = 'bg/' + i + '.jpg?v=1';
}
function skyOf(i) {   // 플로우 그림 배경(bg/번호.jpg). 그림이 오기 전에는 그라데이션 하늘
  if (BGIMG.has(i) && !bgState[i]) loadBg(i);
  if (skyCache[i]) return skyCache[i];
  const T = THEMES[i], R = mulberry32(100 + i);
  return (skyCache[i] = mk(W, H, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, T.sky[0]); gr.addColorStop(0.55, T.sky[1]); gr.addColorStop(1, T.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(255,255,255,${(0.3 + R() * 0.6).toFixed(2)})`; g.beginPath(); g.arc(R() * W, R() * H, 0.6 + R() * 1.6, 0, 7); g.fill(); }
  }));
}
// 아래에서 위로 올라갈수록 천천히 내려오는 장식(시차) — 올라가는 느낌
function decoList(i) {
  const T = THEMES[i], R = mulberry32(300 + i), list = [];
  T.deco.forEach((kind) => {
    const n = { cloud: 7, heart: 8, star: 12, island: 3, lolly: 4, balloon: 5, planet: 2, crystal: 3, flake: 18, bubble: 12, bird: 3, sprinkle: 14, comet: 2, fern: 5, egg: 4, snowman: 4, ferris: 2, rocket: 2, flower: 8, bee: 5, building: 5, fruit: 7, ghost: 5, bat: 6, pump: 4, palm: 4, petal: 16, dolmen: 3, hut: 3, pottery: 4, mirror: 4, crown: 3, cheomseong: 2, celadon: 4, pagoda: 2, palace: 2, hangul: 6, turtle: 2, gull: 6, taegeuk: 5, dokdo: 2, hallasan: 2, dolhareubang: 3, tangerine: 6, seoultower: 2, volcano: 2, ember: 22, smoke: 4, lavabub: 10, pine: 4, gift: 5, castle: 2, mush: 5, fish: 8, coral: 3, pyramid: 3, cactus: 3, leaf: 10, firefly: 18, ship: 2, block: 7, stormcloud: 5, bolt: 3, drop: 16, sun: 0, sun2: 0, moon: 0, rainbow: 0, aurora: 0 }[kind] || 0;
    for (let k = 0; k < n; k++) list.push({ kind, x: R() * W, y: R() * 900, f: kind === 'cloud' ? 0.12 + R() * 0.2 : kind === 'island' || kind === 'planet' || kind === 'crystal' ? 0.28 + R() * 0.1 : 0.15 + R() * 0.3, s: 0.6 + R() * 0.7, dx: (R() - 0.5) * 12, p: R() * 6 });
  });
  return list;
}
const decoCache = [];
function drawTheme(g, i, a, cam, t) {
  g.globalAlpha = a; g.drawImage(skyOf(i), 0, 0, W, H);
  const L = decoCache[i] || (decoCache[i] = decoList(i)), LOOP = 900;
  for (const d of L) {
    if (BGSKIP.has(d.kind) && skyCache[i] && skyCache[i].img) continue;   // 그림 배경에 이미 있는 큰 장식은 겹치지 않게 뺌
    const sp = sprite(d.kind); if (!sp.lw || sp.lw < 4) continue;
    const y = (((d.y + cam * d.f) % LOOP) + LOOP) % LOOP - 180;
    const x = d.x + Math.sin(t * 0.3 + d.p) * 14 + d.dx * t * 0.2;
    const xx = ((x % (W + 240)) + W + 240) % (W + 240) - 120;
    const w = sp.lw * d.s, h = sp.lh * d.s;
    g.globalAlpha = a * (d.kind === 'cloud' ? 0.9 : 1); g.drawImage(sp, xx - w / 2, y - h / 2, w, h);
  }
  g.globalAlpha = 1;
}
const PART = [['flake', -8, 36], ['sparkle', 6, -14], ['flake', -10, 34], ['flake', -12, 38], ['sprinkle', 6, 40], ['flake', -8, 30], ['flake', -6, 26], ['confetti', 8, 30], ['sparkle', 4, -16], ['flake', -10, 34], ['star', -14, 5], ['sparkle', 5, -14]];   // 맵마다 어울리는 떠다니는 알갱이
const PP = (() => { const r = mulberry32(4242); return Array.from({ length: 30 }, () => ({ x: r() * W, y: r() * H, p: r() * 6.28, s: r() })); })();
function drawParticles(g, i, a, t) {
  const d = PART[i] || PART[0]; let kind = d[0];
  for (let k = 0; k < PP.length; k++) {
    const q = PP[k], kd = kind === 'jamo' ? 'jamo' + (k % 6) : kind, sp = sprite(kd); if (!sp.lw || sp.lw < 4) continue;
    const x = ((q.x + d[1] * t * (0.6 + q.s * 0.8) + Math.sin(t * 0.7 + q.p) * 16) % (W + 60) + W + 60) % (W + 60) - 30;
    const y = ((q.y + d[2] * t * (0.6 + q.s * 0.8)) % (H + 60) + H + 60) % (H + 60) - 30;
    const tw = (kind === 'sparkle' || kind === 'star' || kind === 'firefly') ? 0.5 + 0.5 * Math.sin(t * 2.4 + q.p) : 1;
    const sc = (kind === 'jamo' ? 0.9 : kind === 'drop' ? 0.6 : 0.45 + q.s * 0.65), w = sp.lw * sc, h = sp.lh * sc;
    g.globalAlpha = a * (0.45 + 0.4 * tw); g.drawImage(sp, x - w / 2, y - h / 2, w, h);
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

let profile = {}; try { profile = JSON.parse(localStorage.getItem('xm_profile') || '{}'); } catch (e) { profile = {}; }
const Shop = {   // 코인·구매한 캐릭터·꼬리 효과 (이 크롬북에 저장)
  coins: 0, owned: new Set(), trails: new Set(), trail: 0, dirty: false, free: new URLSearchParams(location.search).has('unlock'),
  load() { try { const o = JSON.parse(localStorage.getItem('xm_shop') || '{}'); this.coins = o.coins | 0; this.owned = new Set(o.owned || []); this.trails = new Set(o.trails || []); this.trail = o.trail | 0; } catch (e) {} if (Number.isInteger(profile.skin) && profile.skin >= 10) this.owned.add(profile.skin); },
  save() { try { localStorage.setItem('xm_shop', JSON.stringify({ coins: this.coins, owned: [...this.owned], trails: [...this.trails], trail: this.trail })); } catch (e) {} },
  price(i) { return i >= JELLY0 ? 0 : [0, 30, 50, 70, 90][Math.floor(i / 10) % 5]; },
  has(i) { return true; },
  add(n) { this.coins += n; this.dirty = true; },
  flush() { if (this.dirty) { this.dirty = false; this.save(); } },
};
Shop.load();
let skin = Number.isInteger(profile.skin) && profile.skin >= 0 && profile.skin < NSKIN ? profile.skin : Math.floor(Math.random() * NSKIN);
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
const SKORDER = Array.from({ length: NSKIN }, (_, i) => i);
function refreshPreviews() { [...grid.children].forEach((b) => previewSkin(b.querySelector('canvas'), +b.dataset.i)); }
for (const i of SKORDER) {
  const b = document.createElement('button'); b.className = 'skin'; b.type = 'button'; b.dataset.i = i; b.title = '말랑 친구 ' + (i + 1); b.setAttribute('aria-label', b.title);
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
  localStorage.setItem('xm_profile', JSON.stringify(profile));
  $('joinBtn').disabled = true; $('joinMsg').textContent = '연결하는 중…';
  try {
    const t0 = Date.now();
    const res = await post({ act: 'sync', id: profile.id, name, skin, x: W / 2, y: 0, tr: [], sq: 0, round: -1, h: 0, c: 0, join: 1 });
    const t1 = Date.now();
    if (!res || !res.ok) throw new Error('bad');
    takeClock(t0, t1, res.now);
    $('joinBtn').disabled = false; $('joinMsg').textContent = '';
    Net.me = profile; Net.gen = (res.s && res.s.gen) | 0;
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
  const tr = sc.trail.splice(0, sc.trail.length).slice(-10), hit = sc.pendingHits.splice(0, 2);
  try {
    const t0 = Date.now();
    const res = await post({ act: 'sync', id: profile.id, name: profile.name, skin: profile.skin, x: Math.round(p.x), y: Math.round(p.y), tr, sq: sc.sq, round: Net.round, h: sc.best, c: sc.correct, bo: sc.bo, mx: sc.maxCombo, wq: sc.wq, hit, em: sc.em ? sc.em.n : 0, emq: sc.emq, tm: profile.team | 0, gen: Net.gen | 0 });
    const t1 = Date.now();
    if (res && res.ok && (res.kick || ((res.s && res.s.gen) | 0) !== (Net.gen | 0))) { Net.pending = false; kicked(); return; }   // 선생님이 새로 고침 → 모두 나가기
    if (res && res.ok) { takeClock(t0, t1, res.now); applySync(res, false); Net.fails = 0; if (!Net.ok) { Net.ok = true; sc.toast('📡 다시 연결됐어요!'); } }
  } catch (e) {
    sc.trail.unshift(...tr); sc.pendingHits.unshift(...hit);
    if (++Net.fails === 3) { Net.ok = false; sc.toast('📡 연결이 불안해요… 다시 연결하는 중', 3500); }
  }
  Net.pending = false;
  schedulePoll(2400 + Math.random() * 500);   // 친구 위치는 2.4~2.9초마다 (서버·크롬북 부담 줄이기, 렉 방지)
}
function kicked() {
  Net.me = null; clearTimeout(Net.timer); Net.friends.clear(); Net.rank = null; Net.fails = 0; Net.ok = true;
  try { if (Quiz.open) Quiz.hide(); if (scene) { scene.quizBusy = false; scene.center(null); scene.endBanner = false; } } catch (e) {}
  $('result').classList.add('hidden'); $('game').classList.add('hidden'); $('join').classList.remove('hidden');
  $('joinBtn').disabled = false; $('joinMsg').textContent = '🧹 선생님이 방을 새로 고쳤어요. 다시 입장해 주세요!';
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
    if (f.q.length > 26) f.q.splice(0, f.q.length - 12);
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
  recent: [],
  next() { if (!this.deck.length) { const seen = new Set(); this.deck = QS.map((_, i) => i).filter((i) => { const k = QS[i].q.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; } } let i = this.deck.pop(), tries = 0; while (tries++ < 12 && this.deck.length && this.recent.some((r) => r.a === QS[i].a.trim().toLowerCase() || r.s === QS[i].q.trim().toLowerCase())) { this.deck.unshift(i); i = this.deck.pop(); }   // 같은 답·같은 문장이 가까이 나오지 않게
    this.recent.push({ a: QS[i].a.trim().toLowerCase(), s: QS[i].q.trim().toLowerCase() }); if (this.recent.length > 8) this.recent.shift(); this.curIdx = i; return QS[i]; },
  show(tag, onDone) {
    const q = this.next(); this.cur = q; this.onDone = onDone; this.open = true; this.locked = false;
    $('qTag').textContent = tag; $('qQ').textContent = q.q; $('qKo').textContent = q.ko ? '💡 ' + q.ko : ''; $('qFeed').textContent = '';
    const opts = [q.a, ...q.w].map((t, i) => ({ t, ok: i === 0 })); for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    this.opts = opts;
    const box = $('qChoices'); box.innerHTML = '';
    opts.forEach((o, i) => { const b = document.createElement('button'); const n = document.createElement('b'); n.textContent = i + 1; b.append(n, document.createTextNode(o.t)); b.onclick = () => this.pick(i); box.append(b); });
    $('quiz').classList.remove('hidden'); if (Music.gain && !muted) Music.gain.gain.setTargetAtTime(0.28, ac.currentTime, .15);
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
  hide() { if (Music.gain && !muted) Music.gain.gain.setTargetAtTime(1, ac.currentTime, .25); this.open = false; this.locked = true; $('quiz').classList.add('hidden'); },
};
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter' && scene) scene.useRetry();
  if (Quiz.open && /^[1-4]$/.test(e.key)) Quiz.pick(+e.key - 1);
  else if (!Quiz.open && /^[1-4]$/.test(e.key) && scene && !$('game').classList.contains('hidden')) scene.emote(+e.key);
  if ((e.code === 'KeyX' || e.code === 'KeyZ') && !e.repeat && scene && !Quiz.open) scene.useItem();
  if (e.key === 'm' || e.key === 'M') $('muteBtn').click();
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !$('game').classList.contains('hidden')) e.preventDefault();
});

/* ---------- 게임 장면 ---------- */
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; if (!e.repeat && (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW')) { Scene.jumpPressed = performance.now(); Scene.jumpReleased = false; } });
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
      if (this.superUntil > performance.now()) for (let k = 0; k < 2; k++) this.tf.push({ x: p.x + (Math.random() - 0.5) * 26, y: p.y + 4, vy: 90 + Math.random() * 60, l: 0.5, k: 'f' });
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
      this.best = 0; this.correct = 0; this.gifts.clear(); this.taken.clear(); this.jumps = 0; this.lives = 3; this.energy = 100; this.resetRun();
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
    const rawDt = (now - this.last) / 1000, dt = Math.min(0.05, rawDt); this.last = now; this.t += dt;
    if (!LOWQ && rawDt < 0.5) { this.perfN = (this.perfN || 0) + 1; this.perfS = (this.perfS || 0) + rawDt; if (this.perfN >= 180) { if (this.perfS / this.perfN > 0.027) { LOWQ = true; fit(); this.toast('💨 가벼운 모드로 바꿨어요 (렉 줄이기)', 1600); } this.perfN = 0; this.perfS = 0; } }
    const s = Net.s, sNow = serverNow();
    const countdown = s.status === 'play' && sNow < s.startAt;
    const over = s.status === 'ended' || (s.status === 'play' && !countdown && s.endsAt > 0 && sNow >= s.endsAt);   // 끝나는 시각이 되면 모두 같이 멈춤
    const running = s.status === 'play' && !countdown && !over;
    this.running = running; this.over = over;
    if (over && this.overRound !== s.round) {   // 게임 끝 순간: 한 번만 팡파레
      this.overRound = s.round;
      if (Quiz.open) Quiz.hide(); this.quizBusy = false;
      this.bal = null; this.wing = null; this.p.vx = 0;
      if (this.lastStatus !== 'lobby' && Net.round === s.round) { sfx('fanfare'); this.countN = null; this.center('🏁 게임 끝!'); this.endBanner = true; }
    }
    if (!over && s.status === 'play' && s.fin && this.finSeen !== s.round && !countdown) { this.finSeen = s.round; this.toast('🏁 선생님이 게임을 끝내요! 3 · 2 · 1…', 2600); sfx('beep'); }
    this.frozen = this.quizBusy || countdown || over;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    for (let i = 0; i < steps; i++) this.physics(h, running);
    if (running) {
            const hh = heightOf(this.p.y); if (hh > this.best) { if (this.goldOn()) this.bo += hh - this.best; this.best = hh; }
      const calm = !this.quizBusy && !this.rise && !this.plummet && now - this.lastQuizAt > GAME.gap;   // 문제가 연달아 나오지 않게
      this.gateDone = Math.max(this.gateDone, Math.floor(hh / GAME.gateEvery));   // 100m 표시선만 남김 (퀴즈 없음)
      if (!this.quizBusy && !this.rise && !this.plummet) {   // ⚡ 에너지가 조금씩 줄어요
        const before = this.energy; this.energy = Math.max(0, this.energy - GAME.drain * dt * (this.moonOn() ? 0.5 : 1));
        if (before >= 25 && this.energy < 25) { this.toast('⚡ 에너지가 얼마 안 남았어요! 곧 퀴즈가 나와요', 1800); sfx('beep'); }
      }
      if (this.energy <= 0 && calm && this.p.ground && !this.bal && !this.wing && !(this.groundPl && (this.groundPl.mv || this.groundPl.cr) && this.p.y < -5)) this.openQuiz('⚡ 에너지 충전 퀴즈! 맞히면 🚀 슈퍼 점프!', false, true);
      const ev = s.ev; if (ev && ev.id !== this.evSeen) { this.evSeen = ev.id; if (sNow < ev.until) this.applyEvent(ev); }
    }
    if (now - this.trailAt > 300) { this.trailAt = now; this.sq++; this.trail.push([Math.round(this.p.x), Math.round(this.p.y), this.p.anim, this.p.flip ? 1 : 0, this.fxId()]); if (this.trail.length > 20) this.trail.shift(); }
    this.bv += (-this.bs * 420 - this.bv * 5.2) * dt; this.bs += this.bv * dt; if (Math.abs(this.bs) < 0.003 && Math.abs(this.bv) < 0.08) { this.bs = 0; this.bv = 0; }
    if (!this.plummet) this.fadeA = Math.max(0, (this.fadeA || 0) - dt * 3.2);
    if (this.p.vy > 520 && !this.p.ground) this.fallFx = Math.min(1, this.fallFx + dt * 6); else this.fallFx = Math.max(0, this.fallFx - dt * 5);
    const zc = zoneOf(this.p.y); if (zc !== this.zoneShown) { if (this.zoneShown !== undefined && zc > 0 && !this.plummet) { const th = mapOf(Net.s.seed, zc); this.toast(`🌈 ${THEME_NAMES[th]}에 도착! (${heightOf(this.p.y)}m)` + (ZFX_MSG[th] ? ' · ' + ZFX_MSG[th] : ''), 2800); sfx('gift'); } this.zoneShown = zc; }
    this.updateFriends(dt); this.updateTrail(dt);
    this.camY += (Math.min(this.p.y - 330, -460) - this.camY) * Math.min(1, dt * (this.plummet ? 16 : 7));
    if (this.retry && this.p.y < -320) this.retry = null;
    this.render();
    if (now - this.hudAt > 120) { this.hudAt = now; this.hud(sNow, countdown, running, over); Shop.flush(); }
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
          if (py <= pl.y + 5 && p.y >= pl.y && p.x + 15 > px && p.x - 15 < px + pl.w) { p.y = pl.y; p.vy = 0; p.ground = true; this.groundPl = pl; this.ridePl = pl.mv ? pl : null; if (pl.cr) this.crTouch(pl); }
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
          this.gifts.set(g.id, t + GAME.giftRespawn); sfx('gift'); Shop.add(COIN.gift); this.runCoins += COIN.gift; this.energy = Math.min(100, this.energy + 12); this.burst(g.x, g.y, 10); this.toast(`🎁 선물! 🪙 +${COIN.gift} · ⚡ +12`, 1100);
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
          if (hz.k === 'bird') continue;   // 새는 지나가기만 하고 부딪히지 않아요
          const hx = hzX(hz);
          if (Math.abs(p.x - hx) < 30 && Math.abs((p.y - 24) - hz.y) < 26) {
            this.invUntil = t + 1300; this.kb = { vx: (p.x < hx ? -1 : 1) * 420, t: 0.35 }; p.vy = -230; this.bs = -0.25; this.bv = 0; sfx('bonk'); this.shake = 0.2; this.burst(p.x, p.y - 20, 8);
            this.feed(hz.k === 'bird' ? '🐦 새에 부딪혔어요!' : hz.k === 'rock' ? '☄️ 운석에 부딪혔어요!' : '⛄ 눈덩이에 맞았어요!');
          }
        }
      }
    }
    // 바로 밑에 받침이 없으면 곧바로 슈웅~ 바닥까지! (옆으로 조금 비껴 착지할 수 있는 판은 받침으로 봐 줌)
    if (!p.ground && p.vy > 160 && !this.frozen && !this.bal && !this.wing && !this.rise && p.y < -140 && !this.platBelow(560, 60)) {
      this.plummet = { ox: this.lastGroundX, oy: this.lastGroundY, v: Math.max(p.vy, 800) };
      sfx('whoosh'); this.fallFx = 1; this.whooshed = true; this.toast('슈웅~ 바닥까지!', 1500); p.vx = 0; p.anim = 3;
    }
  }
  platBelow(d, m) {   // 아래 d 안에 (좌우 m 여유) 받침이 있나?
    const p = this.p, z = zoneOf(p.y); m = m || 15;
    for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) for (const pl of buildZone(Net.s.seed, zz).plats) if (pl.y >= p.y - 4 && pl.y - p.y < d && !(pl.cr && this.crGone(pl)) && p.x + m > platX(pl) && p.x - m < platX(pl) + pl.w) return true;
    for (let zz = Math.max(0, z - 1); zz <= z + 1; zz++) for (const sp of buildZone(Net.s.seed, zz).springs) if (sp.y >= p.y - 4 && sp.y - p.y < d && Math.abs(sp.x - p.x) < m + 18) return true;
    return false;
  }
  stepPlummet(dt) {
    const p = this.p, pm = this.plummet;
    pm.t = (pm.t || 0) + dt; p.anim = 3; this.fallFx = 1;
    if (pm.t < 0.28) { pm.v = Math.min(2600, pm.v + 5200 * dt); p.vy = pm.v; p.y += pm.v * dt; this.fadeA = pm.t / 0.28; if (p.y >= 0) p.y = 0; }   // 잠깐만 떨어지고 화면이 하얘졌다가
    if (pm.t >= 0.28 || p.y >= 0) {   // 바닥에 도착(중간 구간은 건너뜀)
      this.fadeA = 1;
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
  openQuiz(tag, gate, charge) {
    if (this.quizBusy || !QS.length) return;
    this.quizBusy = true; this.p.vx = 0;
    Quiz.show(tag, (ok) => {
      const qi = Quiz.curIdx;
      if (ok) {
        this.correct++; this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        const gain = gate ? COIN.gate : COIN.answer; Shop.add(gain); this.runCoins += gain;
        if (this.goldOn()) this.bo += GAME.pointsPer;
        if (this.lives < 5) { this.lives++; this.toast('🎉 정답! ❤️ 생명 +1!', 1600); } else this.toast('🎉 정답! ❤️ 생명이 가득해요', 1400);
        this.energy = charge ? 100 : Math.min(100, this.energy + GAME.energyPer);
        if (this.combo >= 3) this.comboFx();
        this.superAfter = true;
      } else {
        if (charge) { this.energy = GAME.wrongE; this.toast('😢 아쉬워요! 에너지 조금만 충전 — 다음 문제에 다시 도전!', 2000); }
        this.combo = 0; this.wq[qi] = (this.wq[qi] || 0) + 1; this.wrongIdx.add(qi);
        if (gate) { this.lives = Math.max(0, this.lives - 1); this.toast('🚪 문이 닫혔어요… ❤️ -1', 1800); }
      }
      this.quizBusy = false; this.lastQuizAt = performance.now();
      if (this.superAfter) { this.superAfter = false; this.superJump(); }
    });
  }
  superJump() {   // 🚀 정답 보상: 쭉~ 솟아올라요 (판은 아래에서 통과)
    const p = this.p; if (this.rise || this.plummet) return;
    p.vy = -GAME.superV; p.ground = false; this.jumps = 1; this.coyote = -1e9; this.ridePl = null; this.wasGround = false;
    this.superUntil = performance.now() + 1100; this.bs = 0.3; this.bv = 14; this.shake = 0.12;
    this.burst(p.x, p.y, 18); sfx('super'); this.toast('🚀 슈퍼 점프! ⚡ 에너지 가득 · ❤️ +1', 1800);
  }
  updateFriends(dt) {   // 친구는 받은 길을 0.3초 간격으로 천천히 따라가요 (새 물건을 만들지 않아 가벼움)
    const lite = LOWQ;
    for (const f of Net.friends.values()) {
      const q = f.q, c = f.cur;
      if (!lite) { f.bv = (f.bv || 0) + (-(f.bs || 0) * 420 - (f.bv || 0) * 5.2) * dt; f.bs = (f.bs || 0) + f.bv * dt; } else { f.bs = 0; f.bv = 0; }
      if (!q.length) continue;
      const speed = 1 + Math.max(0, q.length - 10) * 0.3;
      f.prog += dt / 0.3 * speed;
      while (f.prog >= 1 && q.length) {
        const pa = f.from.a, n = q.shift(); f.from.x = n.x; f.from.y = n.y; f.from.a = n.a; f.from.f = n.f; f.from.e = n.e; f.prog -= 1; if (!q.length) f.prog = 0;
        if (n.a === 2 && pa !== 2) { f.bs = 0.12; f.bv = 9; } else if (pa === 3 && n.a < 2) { f.bs = -0.5; f.bv = 0; }
      }
      const a = f.from;
      if (q.length) {
        const b = q[0];
        if (Math.abs(b.x - a.x) > 300 || Math.abs(b.y - a.y) > 300) { a.x = b.x; a.y = b.y; a.a = b.a; a.f = b.f; a.e = b.e; f.prog = 0; q.shift(); c.x = a.x; c.y = a.y; }
        else { c.x = a.x + (b.x - a.x) * f.prog; c.y = a.y + (b.y - a.y) * f.prog; }
        c.a = b.a; c.f = b.f; c.e = b.e;
      } else { c.x = a.x; c.y = a.y; c.a = a.a; c.f = a.f; c.e = a.e; }
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
    if (!LOWQ) { drawParticles(g, mapOf(s.seed, zi), f > 0.86 ? 1 - (f - 0.86) / 0.14 : 1, this.t); if (f > 0.86) drawParticles(g, mapOf(s.seed, zi + 1), (f - 0.86) / 0.14, this.t); }
    // 반짝이 먼지
    g.fillStyle = 'rgba(255,255,255,.55)';
    if (!LOWQ) for (const m of motes) { m.y -= m.s * 0.016; m.x += Math.sin(this.t + m.p) * 0.15; if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; } g.globalAlpha = 0.35 + 0.35 * Math.sin(this.t * 2 + m.p); g.beginPath(); g.arc(m.x, m.y, m.r, 0, 7); g.fill(); }
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
    const VIS = this.visBuf || (this.visBuf = []); VIS.length = 0;
    for (const fr of Net.friends.values()) { const c = fr.cur; if (c.y >= cam - 80 && c.y <= cam + H + 80) VIS.push(fr); }
    if (VIS.length > 16) { const my = p.y; VIS.sort((a, b) => Math.abs(a.cur.y - my) - Math.abs(b.cur.y - my)); VIS.length = 16; }   // 한 화면에 최대 16명까지만 그려 렉 방지
    for (const fr of VIS) {
      const c = fr.cur;
      const crowned = lead > 0 && fr.score === lead;
      for (const off of (c.x < 50 ? [0, W] : c.x > W - 50 ? [0, -W] : [0])) {
        if (c.e === 2) this.drawWings(g, c.x + off, c.y, this.t + fr.x);
        g.globalAlpha = 1; drawChar(g, fr.skin, c.x + off, c.y, { t: this.t + fr.x, anim: c.a, flip: !!c.f, scale: 1.25, bs: (fr.bs || 0) + (c.a === 3 ? 0.08 : 0), bv: fr.bv || 0 }); g.globalAlpha = 1;
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
    if (this.fadeA > 0.01) { g.setTransform(RES, 0, 0, RES, 0, 0); g.fillStyle = `rgba(255,255,255,${Math.min(1, this.fadeA).toFixed(2)})`; g.fillRect(0, 0, W, H); }
  }
  label(g, text, x, y, color) {   // 머리 위 닉네임 이름표 (한 번 그려 두고 재사용)
    const key = text + '|' + color; let c = LABELC.get(key);
    if (!c) {
      ctx.font = '800 17px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; const w = Math.ceil(ctx.measureText(text).width + 18), rr = this.rr.bind(this);
      c = mk(w + 4, 28, (q) => {
        q.font = '800 17px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
        q.fillStyle = 'rgba(40,24,80,.62)'; rr(q, 2, 2, w, 24, 12); q.fill();
        q.strokeStyle = color; q.lineWidth = 1.6; q.globalAlpha = 0.7; rr(q, 2, 2, w, 24, 12); q.stroke(); q.globalAlpha = 1;
        q.fillStyle = color; q.fillText(text, 2 + w / 2, 15);
      });
      if (LABELC.size > 150) LABELC.clear(); LABELC.set(key, c);
    }
    g.drawImage(c, x - c.lw / 2, y - 14, c.lw, c.lh);
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
  drawCrown(g, x, y, t) {   // 👑 젤리 왕관: 한 번만 그려 두고(캐시) 가져다 쓰니까 렉 없음
    const sp = sprite('jcrown'), w = sp.lw || 54, h = sp.lh || 44, bob = Math.sin(t * 4) * 1.5, sc = 1 + Math.sin(t * 5) * 0.03;
    g.save(); g.translate(x, y + bob + 6); g.rotate(Math.sin(t * 2) * 0.06); g.scale(0.5 * sc, 0.5 / sc);
    g.drawImage(sp, -w / 2, -h * 0.62, w, h);
    const tw = 0.5 + 0.5 * Math.sin(t * 6), ks = sprite('sparkle'); if (ks.lw) { g.globalAlpha = 0.4 + 0.6 * tw; g.drawImage(ks, 8, -h * 0.55, 20 * (0.6 + tw * 0.5), 20 * (0.6 + tw * 0.5)); }
    g.restore();
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
    if (hz.k === 'bird') {   // 🐥 젤리 새: 통통 말랑 몸 + 반짝 눈 + 팔랑 날개
      const pal = [['#ff9ab8', '#ffd0de', '#e0527f'], ['#8fd8ff', '#d4f1ff', '#3f9ad0'], ['#ffd85a', '#fff1b0', '#e0a61a'], ['#b8f08a', '#e4fcc8', '#5eb83a'], ['#d0a8ff', '#eadcff', '#8f5ad8']][Math.abs(Math.floor(hz.x0 * 7)) % 5];
      const sq = 1 + Math.sin(this.t * 14 + hz.x0) * 0.07, bob = Math.sin(this.t * 7 + hz.x0) * 1.5;
      g.translate(0, bob); g.scale(sq, 1 / sq);
      g.save(); g.translate(-2, -3); g.rotate(-fl * 0.9 - 0.1); g.fillStyle = pal[2]; g.globalAlpha = 0.5;   // 뒤쪽 날개
      g.beginPath(); g.ellipse(0, -10, 8, 15, 0, 0, 7); g.fill(); g.restore(); g.globalAlpha = 1;
      g.fillStyle = pal[0]; g.beginPath(); g.moveTo(-17, 2); g.quadraticCurveTo(-30, -2, -29, -9); g.quadraticCurveTo(-22, -5, -15, -3); g.fill();   // 꼬리
      const gr = g.createRadialGradient(-5, -9, 2, 0, 0, 22); gr.addColorStop(0, pal[1]); gr.addColorStop(0.55, pal[0]); gr.addColorStop(1, pal[2]);
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 20, 17, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-6, -10, 8, 3.5, -0.4, 0, 7); g.fill();   // 젤리 광택
      g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(17, -1); g.quadraticCurveTo(28, 1, 17, 6); g.closePath(); g.fill();   // 부리
      g.fillStyle = '#2a1c3a'; g.beginPath(); g.ellipse(8, -4, 3.6, 4.4, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(9.3, -5.6, 1.4, 0, 7); g.arc(7, -2.6, 0.8, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,90,130,.35)'; g.beginPath(); g.ellipse(11, 5, 4, 2.6, 0, 0, 7); g.fill();   // 볼터치
      g.save(); g.translate(-8, 0); g.rotate(fl - 0.35); g.fillStyle = pal[1]; g.strokeStyle = pal[2]; g.lineWidth = 1.5;   // 앞쪽 날개
      g.beginPath(); g.ellipse(-3, -9, 6, 11, 0, 0, 7); g.fill(); g.stroke(); g.restore();
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
  drawGates(g, cam) {   // 100m마다 나오는 퀴즈 문
    const k0 = Math.max(1, Math.ceil(-(cam + H + 60) / (GAME.gateEvery * 10))), k1 = Math.floor(-(cam - 60) / (GAME.gateEvery * 10));
    for (let k = k0; k <= k1; k++) {
      const y = -k * GAME.gateEvery * 10, open = k <= this.gateDone;
      g.save(); g.globalAlpha = open ? 0.4 : 0.95;
      g.strokeStyle = open ? '#fff' : '#ffd23f'; g.lineWidth = 5; g.setLineDash([16, 10]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]);
      g.fillStyle = open ? '#9aa6d8' : '#ff8fb0'; [60, W - 60].forEach((px) => { g.fillRect(px - 5, y - 54, 10, 54); g.beginPath(); g.arc(px, y - 58, 9, 0, 7); g.fill(); });
      g.restore();
      this.label(g, '🚩 ' + k * GAME.gateEvery + 'm', W / 2, y - 22, open ? '#cfd6ff' : '#fff3a8');
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
  drawPlatBase(g, pl, z) {   // (PLATC: 판 그림 캐시)
    const T = THEMES[mapOf(Net.s.seed, z)].plat, fill = T[0], edge = T[1];
    if (pl.kind === 'floor') {
      g.fillStyle = edge; g.fillRect(0, pl.y, W, 120); g.fillStyle = fill; this.rr(g, -10, pl.y, W + 20, 30, 12); g.fill();
      g.fillStyle = '#ffffff'; this.rr(g, -10, pl.y - 6, W + 20, 16, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 20; x < W; x += 70) { g.beginPath(); g.arc(x, pl.y + 52, 7, 0, 7); g.fill(); }
      return;
    }
    const key = pl.w + '|' + fill + '|' + edge;   // 판 그림은 한 번만 그려 두고 재사용 (렉 방지)
    let spr = PLATC.get(key);
    if (!spr) {
      const h = 18, w = pl.w, rr = this.rr.bind(this);
      spr = mk(w + 8, h + 20, (q) => {
        q.translate(4, 10);
        q.fillStyle = 'rgba(40,25,70,.22)'; rr(q, 2, 5, w, h, 9); q.fill();
        q.fillStyle = edge; rr(q, 0, 0, w, h, 9); q.fill();
        const cu = q.createLinearGradient(0, 0, 0, h); cu.addColorStop(0, shade(fill, .48)); cu.addColorStop(.5, fill); cu.addColorStop(1, edge);
        q.fillStyle = cu; rr(q, 1.5, 1.5, w - 3, h - 5, 8); q.fill();
        q.fillStyle = 'rgba(255,255,255,.4)'; for (let x = 22; x < w - 10; x += 26) { q.beginPath(); q.arc(x, 12, 2.2, 0, 7); q.fill(); }
        // ❄️ 소복이 쌓인 눈 + 고드름
        q.fillStyle = '#ffffff'; rr(q, -3, -6, w + 6, 11, 6); q.fill();
        for (let x = 10; x < w - 6; x += 17) { q.beginPath(); q.ellipse(x, 4, 5 + (x % 3), 4 + (x % 5) * 0.7, 0, 0, 7); q.fill(); }
        q.fillStyle = 'rgba(200,225,255,.9)'; for (let x = 16; x < w - 10; x += 31) { q.beginPath(); q.moveTo(x - 3, 8); q.lineTo(x + 3, 8); q.lineTo(x, 15 + (x % 4)); q.fill(); }
        q.fillStyle = 'rgba(170,200,240,.55)'; rr(q, 2, 2, w - 4, 3, 2); q.fill();
        q.fillStyle = 'rgba(255,255,255,.95)'; for (let x = 12; x < w - 8; x += 40) { q.beginPath(); q.arc(x, -3, 1.4, 0, 7); q.fill(); }
      });
      if (PLATC.size > 120) PLATC.clear(); PLATC.set(key, spr);
    }
    g.drawImage(spr, pl.x - 4, pl.y - 10, spr.lw, spr.lh);
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
  hud(sNow, countdown, running, over) {
    const s = Net.s;
    $('hudH').textContent = `📏 ${heightOf(this.p.y)} m · 최고 ${this.best}`;
    const my = this.best + this.correct * GAME.pointsPer + this.bo;
    $('hudScore').textContent = `⭐ ${my}점${this.goldOn() ? ' ⚡x2' : ''}`;
    $('hudCoin').textContent = `🪙 ${Shop.coins} (+${this.runCoins})`;
    $('eFill').style.width = Math.max(0, Math.min(100, this.energy)) + '%'; $('eFill').classList.toggle('low', this.energy < 25);
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
    else if (over) { rem = 0; phase = s.status === 'ended' && Net.rank ? '🏁 게임 끝' : '🏁 게임 끝! 순위를 계산하고 있어요…'; }
    else if (countdown) { rem = s.duration * 1000; phase = '준비!'; }
    else { rem = s.endsAt - sNow; phase = '⚡ 에너지가 다 떨어지면 퀴즈! 정답: 🚀 슈퍼 점프 + ❤️ · 바닥까지 떨어지면 Enter로 ❤️ 쓰고 복귀'; }
    { const ev = s.ev; if (running && ev && sNow < ev.until && ev.k !== 'balloon') phase = (ev.k === 'gold' ? '⚡ 골든타임! 점수 2배' : '🌙 달나라 중력! 둥실둥실') + ` · ${Math.ceil((ev.until - sNow) / 1000)}초`; }
    const timer = $('hudTimer');
    if (rem == null) timer.textContent = '--:--'; else { const sec = Math.max(0, Math.ceil(rem / 1000)); timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; }
    timer.classList.toggle('warn', running && rem != null && rem < 10500);
    $('phase').textContent = phase;
    if (countdown) { const n = Math.ceil((s.startAt - sNow) / 1000); if (n !== this.countN) { this.countN = n; this.center(String(n)); sfx('beep'); } }
    else if (this.countN != null && s.status === 'play' && !over) { this.countN = null; this.center('GO!'); sfx('go'); setTimeout(() => this.center(null), 700); }
    else if (s.status === 'ended') this.showResult();
    else if (this.countN != null && !over) { this.countN = null; this.center(null); }
    if (s.status !== 'ended') this.resultShown = false;
    if (!over && this.endBanner) { this.endBanner = false; this.center(null); }
  }
  showResult() {
    if (this.resultShown) { return; }
    const rank = Net.rank; if (!rank) return;
    this.resultShown = true; sfx('win'); if (this.endBanner) { this.endBanner = false; this.center(null); }
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
let tpw = sessionStorage.getItem('xm_pw2') || '', tTimer = null;
function pwDialog() {   // 비밀번호는 ●●●● 로 가려서 입력 (친구가 옆에서 못 보게)
  return new Promise((done) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(20,8,30,.6);display:flex;align-items:center;justify-content:center;font-family:inherit';
    wrap.innerHTML = '<form style="background:#fffaf5;border:4px solid #e24a4a;border-radius:18px;padding:22px 24px;min-width:300px;box-shadow:0 0 0 6px #2f8a5a,0 18px 50px rgba(0,0,0,.4);color:#3a2350">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:12px">👩‍🏫 교사용 비밀번호</div>'
      + '<input type="password" autocomplete="new-password" style="width:100%;box-sizing:border-box;font-size:20px;padding:10px 12px;border:2px solid #e7b4b8;border-radius:10px;letter-spacing:3px">'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button type="button" data-x style="padding:8px 14px;border-radius:10px;border:0;background:#eee;font-weight:700">취소</button>'
      + '<button type="submit" style="padding:8px 16px;border-radius:10px;border:0;background:#c8343f;color:#fff;font-weight:800">들어가기</button></div>'
      + '<div data-m style="color:#c8343f;font-size:14px;margin-top:8px;min-height:18px"></div></form>';
    document.body.append(wrap);
    const f = wrap.querySelector('form'), inp = wrap.querySelector('input');
    const close = (v) => { wrap.remove(); done(v); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(null); });
    inp.addEventListener('keyup', (e) => e.stopPropagation());
    wrap.querySelector('[data-x]').onclick = () => close(null);
    f.onsubmit = (e) => { e.preventDefault(); close(inp.value); };
    setTimeout(() => inp.focus(), 30);
  });
}
async function askTeacher() {
  const pw = await pwDialog();
  if (!pw) return;
  try { const r = await post({ act: 'login', pw }); if (!r.ok) return alert('비밀번호가 틀렸어요.'); tpw = pw; sessionStorage.setItem('xm_pw2', pw); openTeacher(); }
  catch (e) { alert('서버에 연결하지 못했어요.'); }
}
$('tBtn').onclick = askTeacher; $('tBtn2').onclick = () => { if (tpw) openTeacher(); else askTeacher(); };
function openTeacher() { unlock(); $('teacher').classList.remove('hidden'); clearTimeout(tTimer); tPoll(); }
$('toStudent').onclick = () => { $('teacher').classList.add('hidden'); clearTimeout(tTimer); };
async function admin(cmd, extra) {
  try { const r = await post({ act: 'admin', pw: tpw, cmd, ...(extra || {}) }); if (r && r.ok) renderT(r); else if (r && r.error) alert(r.error); return r; } catch (e) { return null; }
}
const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
let tData = null, tOff = 0, tOverRound = null;
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
  const tOver = s.status === 'ended' || (s.status === 'play' && now >= s.endsAt);
  $('tTime').textContent = tOver ? '00:00' : s.status === 'play' ? fmt((s.endsAt - now) / 1000) : fmt(s.duration);
  if (tOver) $('tState').textContent = '🏁 게임 끝';
  if (tOver && tOverRound !== s.round) { const first = tOverRound === null; tOverRound = s.round; if (!first || s.status === 'play') { sfx('fanfare'); clearTimeout(tTimer); tTimer = setTimeout(tPoll, 600); } }
  if (!tOver && tOverRound === null) tOverRound = -1;
}
async function tPoll() { await admin('state'); clearTimeout(tTimer); tTimer = setTimeout(tPoll, 2000); }
setInterval(drawT, 250);
$('tPlus').onclick = () => admin('addTime', { delta: 1 });
$('tMinus').onclick = () => admin('addTime', { delta: -1 });
$('tStart').onclick = () => { const s = tData && tData.s; if (s && s.status === 'ended' && !confirm('새 게임을 시작할까요?')) return; unlock(); admin('start'); };
$('tEnd').onclick = () => { unlock(); if (confirm('지금 게임을 끝낼까요?')) admin('end'); };
$('tReset').onclick = () => admin('reset');
$('tKick').onclick = () => { if (confirm('접속한 학생을 모두 내보내고 명단을 비울까요?\n(학생들은 입장 화면으로 돌아가요)')) admin('kick'); };
$('evGold').onclick = () => admin('event', { k: 'gold' });
$('evMoon').onclick = () => admin('event', { k: 'moon' });
$('evBalloon').onclick = () => admin('event', { k: 'balloon' });
if (new URLSearchParams(location.search).has('teacher')) { askTeacher(); }
fit();
window.__et = { sprite, drawTheme, THEMES, Music, Net, Quiz, buildZone, mapOf, get scene() { return scene; }, get lowq() { return LOWQ; } };
})();

