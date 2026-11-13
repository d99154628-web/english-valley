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

/* ---------- 캐릭터 (30종: 10색 × 3모양) ---------- */
const SKIN_COLORS = [['#ff8fa3', '#ffd0da'], ['#ffb347', '#ffe0b0'], ['#ffe066', '#fff5b8'], ['#8ce99a', '#d3f9d8'], ['#63e6be', '#c3fae8'], ['#74c0fc', '#d0ebff'], ['#9775fa', '#e5dbff'], ['#f783ac', '#ffdeeb'], ['#ced4da', '#f8f9fa'], ['#c99a6b', '#f0dcc4']];
function drawChar(g, skin, x, y, o) {   // (x,y)=발 바닥 가운데. o: {t, vx, vy, flip, scale, anim}
  const [c1, c2] = SKIN_COLORS[skin % 10], form = Math.floor(skin / 10) % 3, s = o.scale || 1.25;
  const run = o.anim === 1, bob = run ? Math.sin(o.t * 18) * 1.6 : Math.sin(o.t * 3) * 0.6;
  const stretch = o.anim === 2 ? 1.1 : o.anim === 3 ? 0.94 : 1;
  g.save(); g.translate(x, y); g.scale((o.flip ? -1 : 1) * s, s * stretch);
  const dark = 'rgba(40,20,70,.85)';
  // 발
  g.fillStyle = c1; g.strokeStyle = dark; g.lineWidth = 1.6;
  const fo = run ? Math.sin(o.t * 18) * 3 : 0;
  [[-6 + fo, 0], [6 - fo, 0]].forEach((p) => { g.beginPath(); g.ellipse(p[0], -2, 4.5, 3, 0, 0, 7); g.fill(); g.stroke(); });
  // 귀/모자 (뒤)
  if (form === 0) { [[-7, -1], [7, 1]].forEach(([dx, rot]) => { g.fillStyle = c1; g.beginPath(); g.ellipse(dx, -37 + bob, 4, 10, rot * 0.12, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#ffc2d4'; g.beginPath(); g.ellipse(dx, -37 + bob, 1.8, 6, rot * 0.12, 0, 7); g.fill(); }); }
  // 몸
  g.fillStyle = c1; g.beginPath(); g.ellipse(0, -15 + bob * 0.5, 13, 14, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = c2; g.beginPath(); g.ellipse(0, -10 + bob * 0.5, 8, 8, 0, 0, 7); g.fill();
  if (form === 1) { g.fillStyle = c1; [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(d * 12, -22 + bob); g.lineTo(d * 11, -35 + bob); g.lineTo(d * 3, -27 + bob); g.closePath(); g.fill(); g.stroke(); }); g.fillStyle = '#ffc2d4'; [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(d * 10, -25 + bob); g.lineTo(d * 10, -31 + bob); g.lineTo(d * 6, -27 + bob); g.closePath(); g.fill(); }); }
  if (form === 2) { g.strokeStyle = '#3a8a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -28 + bob); g.quadraticCurveTo(2, -34 + bob, 0, -37 + bob); g.stroke(); g.fillStyle = '#6fd67a'; g.beginPath(); g.ellipse(-4, -37 + bob, 5, 3, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(4, -37 + bob, 5, 3, 0.5, 0, 7); g.fill(); }
  // 얼굴
  g.fillStyle = dark; g.beginPath(); g.arc(-4.5, -18 + bob * 0.5, 1.9, 0, 7); g.arc(4.5, -18 + bob * 0.5, 1.9, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-3.9, -18.7 + bob * 0.5, 0.7, 0, 7); g.arc(5.1, -18.7 + bob * 0.5, 0.7, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,100,130,.45)'; g.beginPath(); g.ellipse(-8, -14 + bob * 0.5, 2.4, 1.6, 0, 0, 7); g.ellipse(8, -14 + bob * 0.5, 2.4, 1.6, 0, 0, 7); g.fill();
  g.strokeStyle = dark; g.lineWidth = 1.2; g.beginPath(); g.arc(0, -13.5 + bob * 0.5, 2.2, 0.15, Math.PI - 0.15); g.stroke();
  g.restore();
}
function previewSkin(canvas, skin) { canvas.width = 56; canvas.height = 60; const g = canvas.getContext('2d'); drawChar(g, skin, 28, 54, { t: 0, anim: 0, scale: 1.15 }); }

/* ---------- 배경 ---------- */
const BASE = (function () { const s = document.currentScript; return s && s.src ? s.src.replace(/[^/]*$/, '') : ''; })();
const bgs = [];
function bgImg(i) {
  if (!bgs[i]) { const im = new Image(); im.src = BASE + 'bg/m' + i + '.jpg'; bgs[i] = im; }
  return bgs[i];
}
function drawBg(g, i, a) {
  const im = bgImg(i);
  g.globalAlpha = a;
  if (im.complete && im.naturalWidth) g.drawImage(im, 0, 0, W, H);
  else { g.fillStyle = '#2a2560'; g.fillRect(0, 0, W, H); }
  g.globalAlpha = 1;
}
const motes = Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.4, s: 8 + Math.random() * 22, p: Math.random() * 6 }));

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
    $('qFeed').textContent = ok ? `🎉 정답! ⚡ 에너지 +${GAME.energyPer}  ⭐ +${GAME.pointsPer}점` : '😢 아쉬워요! 초록색이 정답이에요.';
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
      this.best = 0; this.correct = 0; this.energy = 100; this.gifts.clear(); this.jumps = 0;
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
      this.energy = Math.max(0, this.energy - GAME.drain * dt);
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
          if (this.energy > 0 || !running) { p.vy = -PHYS.djump; this.jumps = 2; this.jumpBuf = -1e9; sfx('djump'); this.burst(p.x, p.y, 8); }
          else if (!this.noEnAt || t - this.noEnAt > 2500) { this.noEnAt = t; this.jumpBuf = -1e9; this.toast('⚡ 에너지가 없어요! 퀴즈를 맞히면 더블점프 충전'); }
        }
      }
      if (Scene.jumpReleased && p.vy < -220) p.vy = -220;
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
          if (py <= pl.y + 5 && p.y >= pl.y && p.x + 11 > pl.x && p.x - 11 < pl.x + pl.w) { p.y = pl.y; p.vy = 0; p.ground = true; }
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
      if (ok) { this.energy = Math.min(100, this.energy + GAME.energyPer); this.correct++; }
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
    // 배경: 구역마다 다른 그림, 경계에서 부드럽게 섞기
    const u = -(cam + 270) / ZONE_H, zi = Math.max(0, Math.floor(u)), f = u - zi;
    drawBg(g, mapOf(s.seed, zi), 1);
    if (f > 0.86) drawBg(g, mapOf(s.seed, zi + 1), (f - 0.86) / 0.14);
    else if (zi > 0 && f < 0.04) { /* 아래 구역과 겹침 없음 */ }
    bgImg(mapOf(s.seed, zi + 1));
    g.fillStyle = 'rgba(15,10,40,.10)'; g.fillRect(0, 0, W, H);
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
      drawChar(g, fr.skin, c.x, c.y, { t: this.t + fr.x, anim: c.a, flip: !!c.f, scale: 1.2 });
      this.label(g, fr.name, c.x, c.y - 62, '#ffffff');
    }
    drawChar(g, profile.skin, p.x, p.y, { t: this.t, anim: p.anim, flip: p.flip, scale: 1.3 });
    this.label(g, profile.name, p.x, p.y - 66, '#ffe27a');
    for (let i = this.puffs.length - 1; i >= 0; i--) { const q = this.puffs[i]; q.l -= 0.016; if (q.l <= 0) { this.puffs.splice(i, 1); continue; } q.x += q.vx * 0.016; q.y += q.vy * 0.016; g.globalAlpha = q.l * 2; g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, 3 + (0.4 - q.l) * 8, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.restore();
  }
  label(g, text, x, y, color) {
    g.font = '700 15px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(30,20,70,.9)'; g.lineJoin = 'round';
    g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
  }
  drawPlat(g, pl, z) {
    const th = pl.kind === 'floor' ? 90 : 16, r = pl.kind === 'floor' ? 0 : 6;
    g.fillStyle = 'rgba(40,25,70,.28)'; g.fillRect(pl.x + 3, pl.y + 4, pl.w, th);
    g.fillStyle = '#d9c3a0'; this.rr(g, pl.x, pl.y, pl.w, th, r); g.fill();
    g.fillStyle = '#fff1d6'; this.rr(g, pl.x, pl.y, pl.w, 6, r); g.fill();
    g.fillStyle = 'rgba(120,90,60,.35)'; for (let x = pl.x + 32; x < pl.x + pl.w - 10; x += 32) g.fillRect(x, pl.y + 8, 2, th - 10);
    g.strokeStyle = 'rgba(70,45,90,.7)'; g.lineWidth = 2; this.rr(g, pl.x, pl.y, pl.w, th, r); g.stroke();
    if (pl.kind === 'cp') {   // 구역 시작 표시 깃발
      const x = pl.x + 20; g.fillStyle = '#6a4fc0'; g.fillRect(x, pl.y - 44, 3, 44); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(x + 3, pl.y - 44); g.lineTo(x + 40, pl.y - 34); g.lineTo(x + 3, pl.y - 24); g.fill();
      this.label(g, '⛰ ' + heightOf(pl.y - 30) + 'm', pl.x + pl.w / 2 + 10, pl.y - 26, '#ffe27a');
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
    const ef = $('eFill'); ef.style.width = this.energy + '%'; ef.classList.toggle('low', this.energy < 25);
    let rem = null, phase = '';
    if (s.status === 'lobby') phase = '🛝 연습 시간 · 선생님이 곧 시작해요! 마음껏 뛰어 보세요';
    else if (s.status === 'ended') { rem = 0; phase = '🏁 게임 끝'; }
    else if (countdown) { rem = s.duration * 1000; phase = '준비!'; }
    else { rem = s.endsAt - sNow; phase = '🎁 선물 상자를 먹거나 30초마다 퀴즈! 정답이면 점수와 에너지 ⚡'; }
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
