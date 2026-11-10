/**
 * English Valley — Apps Script 서버 코드
 * 학생 진행 상황을 '스크립트 속성(PropertiesService)'에 저장합니다. (스프레드시트 필요 없음)
 *
 * 배포: 배포 > 새 배포 > 유형: 웹 앱
 *       실행 사용자: 나 / 액세스 권한: 모든 사용자
 */
const TEACHER_PW = '0634';
const PREFIX = 'S|';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('English Valley · 하얀 새의 영어 여행')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- 학생 ---------- */
function makeKey_(ban, num, name) {
  return String(ban).trim() + '-' + String(num).trim() + '-' + String(name).trim();
}

/** 로그인: 기록이 있으면 이어서, 없으면 새로 만듭니다. */
function login(ban, num, name) {
  const key = makeKey_(ban, num, name);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty(PREFIX + key);
    let rec;
    if (raw) {
      rec = JSON.parse(raw);
      rec.last = Date.now();
    } else {
      rec = { key: key, ban: String(ban).trim(), num: String(num).trim(), name: String(name).trim(),
              map: 0, q: {}, done: false, start: Date.now(), last: Date.now() };
    }
    props.setProperty(PREFIX + key, JSON.stringify(rec));
    return rec;
  } finally {
    lock.releaseLock();
  }
}

/** 진행 저장 (학생 화면이 문제를 풀 때마다 호출) */
function saveProgress(rec) {
  if (!rec || !rec.key) return false;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const clean = {
      key: String(rec.key), ban: String(rec.ban), num: String(rec.num), name: String(rec.name),
      map: Math.max(0, Math.min(9, Number(rec.map) || 0)),
      q: {}, done: !!rec.done,
      start: Number(rec.start) || Date.now(), last: Date.now()
    };
    for (let i = 0; i < 50; i++) {
      const r = rec.q && rec.q[i];
      if (r) clean.q[i] = { a: Number(r.a) || 0, c: r.c ? 1 : 0, t: Number(r.t) || 0 };
    }
    props.setProperty(PREFIX + clean.key, JSON.stringify(clean));
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 교사 ---------- */
function teacherLogin(pw) {
  return String(pw) === TEACHER_PW;
}

function checkPw_(pw) {
  if (String(pw) !== TEACHER_PW) throw new Error('비밀번호가 달라요');
}

/** 전체 학생 진행 현황 */
function getAll(pw) {
  checkPw_(pw);
  const all = PropertiesService.getScriptProperties().getProperties();
  const list = [];
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(PREFIX) === 0) {
      try { list.push(JSON.parse(all[k])); } catch (e) {}
    }
  });
  return { now: Date.now(), list: list };
}

function deleteStudent(pw, key) {
  checkPw_(pw);
  PropertiesService.getScriptProperties().deleteProperty(PREFIX + key);
  return true;
}

function resetAll(pw) {
  checkPw_(pw);
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(function (k) {
    if (k.indexOf(PREFIX) === 0) props.deleteProperty(k);
  });
  return true;
}


/* ---------- 같은 맵의 친구 보기 (접속 위치 공유) ---------- */
function presence(p) {
  if (!p || !p.key) return [];
  const cache = CacheService.getScriptCache();
  const now = Date.now();
  cache.put('pr_' + p.key, JSON.stringify({ n: String(p.name).slice(0, 12), m: Number(p.map) || 0, x: Number(p.x) || 0, y: Number(p.y) || 0, z: Number(p.z) || 0, f: Number(p.f) || 1, t: now }), 30);
  const keys = PropertiesService.getScriptProperties().getKeys()
    .filter(function (k) { return k.indexOf(PREFIX) === 0; })
    .map(function (k) { return k.substring(PREFIX.length); })
    .filter(function (k) { return k !== p.key; });
  const out = [];
  for (let i = 0; i < keys.length; i += 90) {
    const part = keys.slice(i, i + 90);
    const got = cache.getAll(part.map(function (k) { return 'pr_' + k; }));
    part.forEach(function (k) {
      const v = got['pr_' + k];
      if (!v) return;
      try { const o = JSON.parse(v); if (now - o.t < 12000) { o.key = k; out.push(o); } } catch (e) {}
    });
  }
  return out;
}
