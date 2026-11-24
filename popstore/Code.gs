/**
 * 세계 문화 팝업 스토어 — Apps Script 서버 (JSON API)
 * 배포: 웹 앱 / 실행 사용자: 나 / 액세스: 모든 사용자
 * 저장: CacheService + PropertiesService (스프레드시트 필요 없음)
 */
var PW = '0634';

function doGet() { return out_({ ok: true, app: 'popstore11' }); }

function doPost(e) {
  var b = {}, r;
  try { b = JSON.parse(e.postData.contents); } catch (err) {}
  try { r = route_(b); } catch (err2) { r = { err: String(err2) }; }
  return out_(r);
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function route_(b) {
  if (b.act === 'sync') return sync_(b);
  if (b.act === 'chest') return chest_(b);
  if (b.act === 'teacher') return teacher_(b);
  return { err: 'unknown' };
}

/* ---------- 공통 ---------- */
function cache_() { return CacheService.getScriptCache(); }
function props_() { return PropertiesService.getScriptProperties(); }

function game_() {
  var c = cache_(), raw = c.get('game'), g;
  if (!raw) { raw = props_().getProperty('game'); if (raw) c.put('game', raw, 21600); }
  g = raw ? JSON.parse(raw) : { round: 0, status: 'wait', endAt: 0, steal: true, mins: 10 };
  if (g.status === 'run' && Date.now() > g.endAt) { g.status = 'end'; setGame_(g); }
  return g;
}
function setGame_(g) {
  var s = JSON.stringify(g);
  props_().setProperty('game', s);
  cache_().put('game', s, 21600);
}

function ids_() {
  var c = cache_(), raw = c.get('ids');
  if (!raw) { raw = props_().getProperty('ids') || '[]'; c.put('ids', raw, 21600); }
  return JSON.parse(raw);
}
function addId_(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var raw = props_().getProperty('ids') || '[]', a = JSON.parse(raw);
    if (a.indexOf(id) < 0) {
      a.push(id);
      if (a.length > 300) a = a.slice(a.length - 300);
      raw = JSON.stringify(a);
      props_().setProperty('ids', raw);
    }
    cache_().put('ids', raw, 21600);
  } finally { lock.releaseLock(); }
}

function all_() {
  var ids = ids_(), c = cache_(), out = [];
  for (var i = 0; i < ids.length; i += 90) {
    var part = ids.slice(i, i + 90);
    var got = c.getAll(part.map(function (k) { return 'p_' + k; }));
    part.forEach(function (k) {
      var v = got['p_' + k];
      if (!v) return;
      try { var o = JSON.parse(v); o.id = k; out.push(o); } catch (e) {}
    });
  }
  return out;
}

function inRound_(list, g) {
  var now = Date.now();
  return list.filter(function (p) {
    if (g.status === 'wait') return now - p.t < 60000;
    return p.r === g.round;
  });
}

function feed_(msg) {
  var c = cache_(), a = [];
  try { a = JSON.parse(c.get('feed') || '[]'); } catch (e) {}
  a.push({ t: Date.now(), m: msg });
  if (a.length > 14) a = a.slice(a.length - 14);
  c.put('feed', JSON.stringify(a), 3600);
}
function pushDelta_(id, d) {
  var c = cache_(), a = [];
  try { a = JSON.parse(c.get('d_' + id) || '[]'); } catch (e) {}
  a.push(d);
  c.put('d_' + id, JSON.stringify(a), 900);
}

/* ---------- 학생: 상태 올리기 + 순위 받기 ---------- */
function sync_(b) {
  var g = game_(), c = cache_(), now = Date.now();
  var id = String(b.id || '').slice(0, 40);
  if (!id) return { game: g, now: now };
  if (ids_().indexOf(id) < 0) addId_(id);

  var coins = Math.max(0, Math.floor(Number(b.coins) || 0));
  var sh = Math.max(0, Math.min(9, Math.floor(Number(b.sh) || 0)));
  var deltas = [];
  if (c.get('d_' + id)) {
    var lock = LockService.getScriptLock();
    lock.waitLock(6000);
    try {
      var raw = c.get('d_' + id);
      if (raw) { deltas = JSON.parse(raw); c.remove('d_' + id); }
    } finally { lock.releaseLock(); }
    deltas.forEach(function (d) {
      if (d.k === 'steal') coins = Math.max(0, coins - d.amt);
      if (d.k === 'swap') coins = d.set;
      if (d.k === 'block') sh = Math.max(0, sh - 1);
    });
  }
  var me = { n: String(b.name || '').slice(0, 12), c: coins, s: Math.floor(Number(b.served) || 0),
             sh: sh, lv: Math.floor(Number(b.lv) || 1), r: Number(b.round) || 0, t: now };
  c.put('p_' + id, JSON.stringify(me), 1200);

  var list = inRound_(all_(), g);
  list.sort(function (x, y) { return y.c - x.c; });
  var rank = 0;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) { rank = i + 1; break; }
  return {
    game: g, now: now, deltas: deltas, rank: rank, n: list.length,
    top: list.slice(0, 5).map(function (p) { return { n: p.n, c: p.c }; })
  };
}

/* ---------- 학생: 상자에서 뺏기/바꾸기가 나왔을 때 ---------- */
function chest_(b) {
  var g = game_(), now = Date.now();
  var id = String(b.id || '').slice(0, 40);
  if (g.status !== 'run' || !g.steal || !id) return { none: true };
  var myCoins = Math.max(0, Math.floor(Number(b.coins) || 0));
  var myName = String(b.name || '').slice(0, 12);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var c = cache_();
    var others = inRound_(all_(), g).filter(function (p) { return p.id !== id && now - p.t < 40000; });
    if (!others.length) return { none: true };
    var v, i;
    if (b.kind === 'swap') {
      v = others[0];
      for (i = 1; i < others.length; i++) if (others[i].c > v.c) v = others[i];
      if (v.c <= myCoins) return { none: true };
      var got = v.c;
      v.c = myCoins; v.t = now;
      var vid = v.id; delete v.id;
      c.put('p_' + vid, JSON.stringify(v), 1200);
      pushDelta_(vid, { k: 'swap', set: myCoins, from: myName });
      feed_('🔄 ' + myName + ' ⇄ ' + v.n + ' : 코인 바꾸기!');
      return { set: got, name: v.n };
    }
    var rich = others.filter(function (p) { return p.c > 0; });
    if (!rich.length) return { none: true };
    var total = 0;
    rich.forEach(function (p) { total += p.c; });
    var pick = Math.random() * total;
    v = rich[rich.length - 1];
    for (i = 0; i < rich.length; i++) { pick -= rich[i].c; if (pick <= 0) { v = rich[i]; break; } }
    var vid2 = v.id; delete v.id;
    if (v.sh > 0) {
      v.sh -= 1;
      c.put('p_' + vid2, JSON.stringify(v), 1200);
      pushDelta_(vid2, { k: 'block', from: myName });
      feed_('🛡 ' + v.n + ' 방패 성공! ' + myName + '의 약탈 실패');
      return { blocked: true, name: v.n };
    }
    var amt = Math.floor(v.c * 0.25);
    v.c -= amt;
    c.put('p_' + vid2, JSON.stringify(v), 1200);
    pushDelta_(vid2, { k: 'steal', amt: amt, from: myName });
    feed_('🐦 ' + myName + ' → ' + v.n + ' : 코인 ' + amt + '개 약탈!');
    return { amt: amt, name: v.n };
  } finally { lock.releaseLock(); }
}

/* ---------- 교사 ---------- */
function teacher_(b) {
  if (String(b.pw) !== PW) return { err: 'pw' };
  var g = game_(), now = Date.now(), c = cache_();
  var cmd = b.cmd;
  if (cmd === 'start') {
    var mins = Math.max(1, Math.min(40, Number(b.v) || g.mins || 10));
    g = { round: now, status: 'run', endAt: now + mins * 60000, steal: g.steal !== false, mins: mins };
    setGame_(g); c.remove('feed');
  } else if (cmd === 'end') {
    g.status = 'end'; g.endAt = now; setGame_(g);
  } else if (cmd === 'time') {
    if (g.status === 'run') { g.endAt = Math.max(now + 5000, g.endAt + (Number(b.v) || 0) * 60000); setGame_(g); }
  } else if (cmd === 'steal') {
    g.steal = !!b.v; setGame_(g);
  } else if (cmd === 'reset') {
    var ids = ids_();
    c.removeAll(ids.map(function (k) { return 'p_' + k; }).concat(ids.map(function (k) { return 'd_' + k; })));
    props_().setProperty('ids', '[]'); c.put('ids', '[]', 21600); c.remove('feed');
    g = { round: 0, status: 'wait', endAt: 0, steal: g.steal !== false, mins: g.mins || 10 };
    setGame_(g);
  }
  var list = inRound_(all_(), g);
  list.sort(function (x, y) { return y.c - x.c; });
  var feed = [];
  try { feed = JSON.parse(c.get('feed') || '[]'); } catch (e) {}
  return {
    game: g, now: now, feed: feed,
    players: list.map(function (p) { return { n: p.n, c: p.c, s: p.s, sh: p.sh, lv: p.lv, on: now - p.t < 20000 }; })
  };
}
