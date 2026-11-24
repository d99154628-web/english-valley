/**
 * 황동 하늘 · 로봇 점프 탐험 — Apps Script 서버 (JSON API)
 * 배포: 웹 앱 / 실행 사용자: 나 / 액세스: 모든 사용자
 * 저장: CacheService + PropertiesService (스프레드시트 필요 없음)
 */
var PW = '0634';
var TOKEN = 'brass-0634-teacher';
var ONLINE_MS = 9000;

function doGet() { return out_({ ok: true, app: 'robot-jump' }); }

function doPost(e) {
  var b = {}, r;
  try { b = JSON.parse(e.postData.contents); } catch (err) {}
  try { r = route_(b); } catch (err2) { r = { error: String(err2) }; }
  return out_(r);
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function cache_() { return CacheService.getScriptCache(); }
function props_() { return PropertiesService.getScriptProperties(); }
function uid_() { return Utilities.getUuid(); }
function roomId_(b) { var r = String(b.room || '6-1'); return /^[1-6]-[1-6]$/.test(r) ? r : '6-1'; }

/* ---------- 방 ---------- */
function getRoom_(id) {
  var c = cache_(), raw = c.get('room_' + id), r;
  if (!raw) { raw = props_().getProperty('room_' + id); if (raw) c.put('room_' + id, raw, 21600); }
  r = raw ? JSON.parse(raw) : { id: id, run: uid_(), status: 'waiting', duration: 300, starts: 0, ends: 0, seed: Math.floor(Math.random() * 100000) };
  if (r.status === 'running' && Date.now() >= r.ends) { r.status = 'ended'; setRoom_(r); }
  return r;
}
function setRoom_(r) {
  var s = JSON.stringify(r);
  props_().setProperty('room_' + r.id, s);
  cache_().put('room_' + r.id, s, 21600);
}

/* ---------- 학생 목록 ---------- */
function ids_(room) {
  var c = cache_(), raw = c.get('ids_' + room);
  if (!raw) { raw = props_().getProperty('ids_' + room) || '[]'; c.put('ids_' + room, raw, 21600); }
  return JSON.parse(raw);
}
function setIds_(room, a) {
  var raw = JSON.stringify(a);
  props_().setProperty('ids_' + room, raw);
  cache_().put('ids_' + room, raw, 21600);
}
function addId_(room, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var a = JSON.parse(props_().getProperty('ids_' + room) || '[]');
    if (a.indexOf(id) < 0) { a.push(id); if (a.length > 80) a = a.slice(a.length - 80); setIds_(room, a); }
  } finally { lock.releaseLock(); }
}
function getP_(room, id) { var v = cache_().get('p_' + room + '_' + id); return v ? JSON.parse(v) : null; }
function setP_(room, p) { cache_().put('p_' + room + '_' + p.id, JSON.stringify(p), 3600); }
function all_(room) {
  var ids = ids_(room), c = cache_(), out = [];
  if (!ids.length) return out;
  var got = c.getAll(ids.map(function (k) { return 'p_' + room + '_' + k; }));
  ids.forEach(function (k) { var v = got['p_' + room + '_' + k]; if (v) { try { out.push(JSON.parse(v)); } catch (e) {} } });
  return out;
}
function rows_(room, r, now) {
  var list = all_(room).filter(function (p) { return !p.left; });
  list.forEach(function (p) { if (p.run !== r.run) { p.height = 0; p.bonus = 0; p.ok = 0; p.tried = 0; } });
  list.sort(function (a, b) { return (b.height + b.bonus) - (a.height + a.bonus); });
  return list.map(function (p) {
    return { id: p.id, name: p.name, robot: p.robot, height: p.height, bonus: p.bonus, ok: p.ok, tried: p.tried, online: now - p.t < ONLINE_MS };
  });
}
function peers_(room, now) {
  return all_(room).filter(function (p) { return !p.left && now - p.t < ONLINE_MS; }).map(function (p) {
    return { id: p.id, name: p.name, robot: p.robot, trail: p.trail || [], seq: p.seq || 0, lastSeen: p.t };
  });
}
function pack_(room, r, extra) {
  var now = Date.now(), o = { room: r, rows: rows_(room, r, now), now: now };
  for (var k in extra) o[k] = extra[k];
  return o;
}

/* ---------- 라우터 ---------- */
function route_(b) {
  var room = roomId_(b), a = b.action, now = Date.now();
  if (a === 'login') {
    if (String(b.password) !== PW) return { error: '비밀번호가 달라요.' };
    return { token: TOKEN };
  }
  var teacherActs = ['roster', 'start', 'end', 'reset', 'duration', 'adjust'];
  if (teacherActs.indexOf(a) >= 0) {
    if (b.token !== TOKEN) return { error: '로그인이 필요해요.' };
    return teacher_(room, a, b);
  }
  var r = getRoom_(room);
  if (a === 'join') {
    var id = uid_();
    var p = { id: id, name: String(b.name || '').slice(0, 20), robot: Math.max(0, Math.min(29, Number(b.robot) || 0)),
              run: r.run, height: 0, bonus: 0, ok: 0, tried: 0, t: now, trail: [], seq: 0 };
    setP_(room, p); addId_(room, id);
    return pack_(room, r, { player: id, playerName: p.name, peers: peers_(room, now) });
  }
  if (a === 'state') return pack_(room, r, { peers: [] });
  if (a === 'leave') {
    var lp = getP_(room, String(b.player || ''));
    if (lp) { lp.left = true; setP_(room, lp); }
    return { ok: true };
  }
  if (a === 'progress') {
    var pid = String(b.player || '');
    var me = getP_(room, pid);
    if (!me || me.left) return pack_(room, r, { kicked: true, peers: [] });
    if (me.run !== r.run) { me.run = r.run; me.height = 0; me.bonus = 0; me.ok = 0; me.tried = 0; }
    var live = r.status === 'running' && now >= r.starts && now < r.ends + 3000;
    if (live) {
      me.height = Math.max(me.height, Math.max(0, Math.floor(Number(b.height) || 0)));
      if (String(b.run) === r.run) {
        me.bonus = Math.max(me.bonus, Math.max(0, Math.floor(Number(b.bonus) || 0)));
        me.ok = Math.max(me.ok, Math.floor(Number(b.ok) || 0));
        me.tried = Math.max(me.tried, Math.floor(Number(b.tried) || 0));
      }
    }
    me.trail = (Array.isArray(b.trail) ? b.trail : []).slice(-30);
    me.seq = Number(b.seq) || 0; me.t = now;
    setP_(room, me);
    return pack_(room, r, { peers: peers_(room, now) });
  }
  return { error: '알 수 없는 요청' };
}

/* ---------- 교사 ---------- */
function teacher_(room, a, b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var r = getRoom_(room), now = Date.now();
    var dur = Math.max(60, Math.min(3600, Number(b.duration) || r.duration || 300));
    if (a === 'start' && (r.status === 'waiting' || r.status === 'ended')) {
      r.duration = dur; r.run = uid_(); r.status = 'running'; r.starts = now + 4000; r.ends = r.starts + dur * 1000;
      r.seed = Math.floor(Math.random() * 100000);
    } else if (a === 'end' && r.status === 'running') {
      r.status = 'ended'; r.ends = now;
    } else if (a === 'duration' && (r.status === 'waiting' || r.status === 'ended')) {
      r.duration = dur;
    } else if (a === 'adjust' && r.status === 'running') {
      r.ends = Math.max(now + 5000, r.ends + (Number(b.delta) || 0) * 1000);
    } else if (a === 'reset') {
      var ids = ids_(room);
      cache_().removeAll(ids.map(function (k) { return 'p_' + room + '_' + k; }));
      setIds_(room, []);
      r = { id: room, run: uid_(), status: 'waiting', duration: r.duration || 300, starts: 0, ends: 0, seed: Math.floor(Math.random() * 100000) };
    }
    if (a !== 'roster') setRoom_(r);
    return pack_(room, r, {});
  } finally { lock.releaseLock(); }
}
