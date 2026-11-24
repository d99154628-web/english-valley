'use strict';
// 미드나잇 크리스마스 · 영어 방탈출 — GitHub Pages + Firebase 실시간 버전
// 렉 줄이기: ① 서버에 1.8초마다 묻던 방식 → Firebase가 바뀔 때만 알려 줌 ② 문제는 기기 안에서 바로 열고 채점
// ③ 방 그림·캐릭터·단서는 미리 그려 두고 매 프레임 그대로 찍기 ④ 매 프레임 바뀌던 화면 글자·지도는 바뀔 때만 갱신
const $=id=>document.getElementById(id),escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROOM_NAMES=['얼어붙은 현관','속삭이는 서재','유령의 연회장','뒤틀린 시계방','별빛 온실','비밀의 장난감방','오로라 출구'];
const TEACHER_PASS='0634';
const params=new URLSearchParams(location.search);

/* ---------- 그림: 필요한 것만 그때그때 불러오기 ---------- */
const art={};
function loadArt(name){if(art[name])return art[name];const img=new Image();img.decoding='async';img.src='assets/'+name+'.webp?v=1';img.onload=()=>{if(name==='directions'){charFrames=null;heroCache=null}if(name==='manor-hero')heroCache=null};art[name]=img;return img}
function ready(img){return img&&img.complete&&img.naturalWidth>0}
function preloadRooms(){const upto=isTeacher?6:Math.min(6,unlocked+1);for(let i=0;i<=upto;i++)loadArt(ART_NAMES[i]);if(localCorrect>=ESCAPE_GOAL-3||isTeacher){loadArt('sky');loadArt('sleigh')}}
loadArt('manor-hero');loadArt('directions');

/* ---------- Firebase ---------- */
const FB=firebase.initializeApp({databaseURL:'https://jump-tower-live-default-rtdb.asia-southeast1.firebasedatabase.app'}).database();
let offset=0,connected=true;
FB.ref('.info/serverTimeOffset').on('value',s=>{offset=s.val()||0});
FB.ref('.info/connected').on('value',s=>{connected=!!s.val();const c=$('conn');c.textContent=connected?'● 연결됨':'○ 다시 연결 중';c.classList.toggle('off',!connected);if(connected&&auth)publishPos(true,true)});
const serverNow=()=>Date.now()+offset;
const rid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const base=r=>FB.ref('jt/mc'+r);

let room='',auth=null,isTeacher=false,st=defaultSt(),players={},scores={},watching='';
let my={x:192,y:248,facing:'down'},keys={},path=[],moving=false,activeQuestion=null,quizLocked=false,unlocked=0,resultRound=-1,lastRound=null,localCursor=0,localCorrect=0,escapedAt=0,toastTimer,endWritten=-1;
function defaultSt(){return{status:'lobby',round:0,duration:900,startAt:0,endsAt:0}}
function effStatus(){return st.status==='play'&&serverNow()>=st.endsAt?'ended':st.status}
function playing(){const n=serverNow();return st.status==='play'&&n>=st.startAt&&n<st.endsAt}
function myName(){const p=auth&&players[auth.id];return p?p.no+'번 '+p.nm:''}
function roomTitle(r){const[a,b]=String(r).split('-');return a+'학년 '+b+'반'}

function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
function sound(kind){HolidayAudio.sfx(kind)}
function info(html){$('infoContent').innerHTML=html;$('infoDialog').showModal()}

function unwatch(){if(!watching)return;const b=base(watching);['st','pl','sc'].forEach(k=>b.child(k).off());watchStage(null);watching='';players={};scores={};st=defaultSt();lastRound=null}
function watch(r){if(watching===r)return;unwatch();watching=r;const b=base(r);
 b.child('st').on('value',s=>{st={...defaultSt(),...(s.val()||{})};onSession()});
 b.child('pl').on('value',s=>{players=s.val()||{};if(auth&&!isTeacher&&!players[auth.id]&&$('game').hidden===false){kicked();return}scheduleHUD()});
 b.child('sc').on('value',s=>{scores=s.val()||{};const me=auth&&scores[auth.id];if(me&&me.r===st.round){localCorrect=Math.max(localCorrect,me.c||0);localCursor=Math.max(localCursor,me.cur||0);localFinalCorrect=Math.max(localFinalCorrect,me.f||0);escapedAt=me.e||escapedAt;setUnlocked()}scheduleHUD()})}
function kicked(){leaveGame();toast('선생님이 명단을 비웠어요. 다시 입장해 주세요.')}

/* 같은 방에 있는 친구만 받아 오기(방마다 따로 저장) */
let peers={},stageWatch=null;
function stageKeyOf(){return flight&&!isTeacher?'fly':String(Math.max(0,stageAt(my.x,my.y)))}
function watchStage(key){if(stageWatch&&stageWatch.key===key)return;if(stageWatch){stageWatch.ref.off()}peers={};stageWatch=null;if(key===null||!watching)return;const ref=base(watching).child('ps/'+key);stageWatch={key,ref};
 const put=s=>{if(auth&&s.key===auth.id)return;const[x,y,f]=String(s.val()).split('|');const p=peers[s.key];if(p){p.tx=+x;p.ty=+y;p.facing=f}else peers[s.key]={x:+x,y:+y,tx:+x,ty:+y,facing:f,walk:0}};
 ref.on('child_added',put);ref.on('child_changed',put);ref.on('child_removed',s=>{delete peers[s.key]})}
let pubKey=null,pubVal='',pubAt=0;
function publishPos(force=false,reconnect=false){if(isTeacher||!auth||!watching)return;const key=stageKeyOf(),val=Math.round(my.x)+'|'+Math.round(my.y)+'|'+(my.facing||'down'),b=base(watching).child('ps');
 if(key!==pubKey||reconnect){if(pubKey!==null&&pubKey!==key){const old=b.child(pubKey+'/'+auth.id);old.onDisconnect().cancel();old.remove()}pubKey=key;b.child(key+'/'+auth.id).onDisconnect().remove();force=true}
 const now=performance.now();if(!force&&(val===pubVal||now-pubAt<300))return;pubVal=val;pubAt=now;b.child(key+'/'+auth.id).set(val);try{localStorage.setItem('mc-pos',JSON.stringify({id:auth.id,round:st.round,x:my.x,y:my.y,facing:my.facing}))}catch{}}
function unpublish(){if(pubKey!==null&&auth&&watching){const r=base(watching).child('ps/'+pubKey+'/'+auth.id);r.onDisconnect().cancel();r.remove()}pubKey=null;pubVal=''}

function setUnlocked(){const before=unlocked;unlocked=isTeacher?6:Math.min(ROOM_COUNT-1,Math.floor(localCorrect/3));if(unlocked!==before)preloadRooms()}
function onSession(){
 if(lastRound!==st.round){const first=lastRound===null;lastRound=st.round;stopFlight();if($('quizDialog').open)$('quizDialog').close();activeQuestion=null;path=[];
  const me=auth&&scores[auth.id];localCursor=me&&me.r===st.round?me.cur||0:0;localCorrect=me&&me.r===st.round?me.c||0:0;localFinalCorrect=me&&me.r===st.round?me.f||0:0;escapedAt=me&&me.r===st.round?me.e||0:0;setUnlocked();
  let pos=null;if(first&&auth){try{const p=JSON.parse(localStorage.getItem('mc-pos')||'null');if(p&&p.id===auth.id&&p.round===st.round)pos=p}catch{}}
  my=pos?{x:pos.x,y:pos.y,facing:pos.facing||'down'}:isTeacher?{...spawnAt(0),facing:'down'}:{x:192,y:248,facing:'down'};
  if(!walkableAt(my.x,my.y,isTeacher?6:unlocked))my={...spawnAt(Math.max(0,Math.min(unlocked,stageAt(my.x,my.y)))),facing:'down'};
  if(!first&&st.status!=='lobby'){resultRound=-1}
  if(auth&&!isTeacher){if(escapedAt&&scores[auth.id]?.fly)startFlight(escapedAt);publishPos(true)}}
 if(effStatus()==='ended'&&st.round>0&&resultRound!==st.round&&!$('game').hidden){resultRound=st.round;showResult()}
 scheduleHUD()}

/* ---------- 입장 ---------- */
function tab(teacher){$('studentTab').setAttribute('aria-selected',!teacher);$('teacherTab').setAttribute('aria-selected',teacher);$('joinForm').hidden=teacher;$('teacherForm').hidden=!teacher;$('entryError').textContent='';$('teacherShortcut').hidden=teacher;if(teacher&&sessionStorage.getItem('mcTeacher')!=='ok')setTimeout(()=>$('tPass').focus(),50)}
$('studentTab').onclick=()=>tab(false);$('teacherTab').onclick=()=>tab(true);$('teacherShortcut').onclick=()=>tab(true);
if(sessionStorage.getItem('mcTeacher')==='ok')$('tPass').placeholder='이미 확인했어요';
$('joinForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter||$('joinForm').querySelector('button');btn.disabled=true;$('entryError').textContent='';
 try{const r=$('grade').value+'-'+$('classNo').value,no=Number($('studentNo').value),nm=$('playerName').value.trim().replace(/\s+/g,' ');
  if(!Number.isInteger(no)||no<1||no>60)throw Error('번호를 1~60 사이의 숫자로 입력해 주세요.');if(!nm||nm.length>14)throw Error('이름을 1~14자로 입력해 주세요.');
  const b=base(r),[pl,ss]=await Promise.all([b.child('pl').get(),b.child('st').get()]);const list=pl.val()||{},s={...defaultSt(),...(ss.val()||{})};
  let id=Object.keys(list).find(k=>Number(list[k].no)===no),team=id?list[id].team||null:null;const again=!!id;
  if(!id){id=rid();if(Object.keys(list).length>=60)throw Error('한 대기실에는 60명까지 입장할 수 있어요.')}
  if(!team&&s.status==='play'&&serverNow()<s.endsAt){let a=0,c=0;for(const k in list){if(list[k].team==='santa')a++;else if(list[k].team==='rudolph')c++}team=a<=c?'santa':'rudolph'}
  const up={};up['pl/'+id]={no,nm,team};if(!again)up['sc/'+id]={c:0,cur:0,f:0,e:0,r:s.round};await b.update(up);
  auth={room:r,id};isTeacher=false;try{localStorage.setItem('mc-player',JSON.stringify(auth))}catch{}enter(r);if(again)toast('같은 번호로 다시 들어왔어요. 점수는 그대로예요.')}
 catch(err){$('entryError').textContent=err.message&&!/permission|network/i.test(err.message)?err.message:'연결을 확인하고 다시 눌러 주세요.'}finally{btn.disabled=false}};
$('teacherForm').onsubmit=async e=>{e.preventDefault();if(sessionStorage.getItem('mcTeacher')!=='ok'){if($('tPass').value.trim()!==TEACHER_PASS){$('entryError').textContent='교사 비밀번호가 달라요.';return}sessionStorage.setItem('mcTeacher','ok')}$('tPass').value='';
 const r=$('tGrade').value+'-'+$('tClass').value,min=Math.max(1,Math.min(90,Math.floor(Number($('duration').value)||15)));
 try{const ref=base(r).child('st'),s=(await ref.get()).val();if(!s)await ref.set({...defaultSt(),duration:min*60});else if(s.status!=='play')await ref.update({duration:min*60})}catch{$('entryError').textContent='연결을 확인하고 다시 눌러 주세요.';return}
 auth=null;isTeacher=true;sessionStorage.setItem('mcTeacherRoom',r);enter(r)};
function enter(r){room=r;watch(r);$('lobby').hidden=true;$('game').hidden=false;document.body.classList.toggle('teacher',isTeacher);$('teacherPanel').hidden=!isTeacher;if(isTeacher){$('teacherCode').textContent=roomTitle(r);$('playerBadge').textContent='교사 관전 모드'}setUnlocked();preloadRooms();resize();syncFlightUI();lastUiKey='';lastMapKey='';scheduleHUD();$('world').focus()}
function leaveGame(){stopFlight();unpublish();unwatch();auth=null;isTeacher=false;try{localStorage.removeItem('mc-player')}catch{}sessionStorage.removeItem('mcTeacherRoom');$('game').hidden=true;$('lobby').hidden=false;document.body.classList.remove('teacher');for(const d of document.querySelectorAll('dialog[open]'))d.close()}
$('leaveBtn').onclick=()=>{if(confirm(isTeacher?'교사 화면에서 나갈까요?':'교실에서 나갈까요? 같은 반·번호로 다시 입장하면 점수가 그대로 이어져요.'))leaveGame()};

/* ---------- 화면 글자: 바뀔 때만 갱신 ---------- */
let hudTimer=0;function scheduleHUD(){if(hudTimer)return;hudTimer=setTimeout(()=>{hudTimer=0;updateHUD()},120)}
function playerRows(){return Object.entries(players).map(([id,p])=>{const s=scores[id];return{id,name:p.no+'번 '+p.nm,no:Number(p.no),nm:p.nm,team:p.team,c:s&&s.r===st.round?s.c||0:0,cur:s&&s.r===st.round?s.cur||0:0,e:s&&s.r===st.round?s.e||0:0}}).sort((a,b)=>b.c-a.c||a.no-b.no)}
function teamScores(rows){const t={santa:0,rudolph:0};for(const r of rows)if(r.team)t[r.team]+=r.c;return t}
function rankRows(ps){return ps.map(p=>'<div class="player-row '+(p.id===auth?.id?'mine':'')+'"><span class="avatar">'+(p.team==='santa'?'🎅':p.team==='rudolph'?'🦌':'✦')+'</span><span class="name">'+escapeHTML(p.name)+(p.id===auth?.id?' <small>나</small>':'')+'</span><b>'+p.c+'</b></div>').join('')}
let lastListHTML='';
function updateHUD(){if($('game').hidden)return;const rows=playerRows(),sc=teamScores(rows),s=effStatus(),me=auth&&players[auth.id];
 $('santaScore').textContent=sc.santa;$('rudolphScore').textContent=sc.rudolph;$('playerCount').textContent=rows.length+'명';const html=rankRows(rows);if(html!==lastListHTML){lastListHTML=html;$('playerList').innerHTML=html}
 $('myName').textContent=isTeacher?'교사 관전':myName()||'탐험가';$('myCorrect').textContent=localCorrect;$('mySeen').innerHTML=(localCursor%200)+'<em>/200</em>';
 $('playerBadge').textContent=isTeacher?'교사 관전 모드':me?.team==='santa'?'🎅 산타 팀':me?.team==='rudolph'?'🦌 루돌프 팀':'팀 배정 대기';$('waiting').hidden=s!=='lobby'||!!flight;
 $('teacherDuration').textContent=Math.round(st.duration/60)+'분';$('startBtn').disabled=s==='play';$('startBtn').textContent=s==='ended'?'새 게임 출발 →':'모두 함께 출발 →';$('endBtn').disabled=s!=='play';$('resetBtn').disabled=s==='lobby'&&st.round===0;
 $('teacherNotice').textContent=rows.length+'명 입장 · '+(s==='lobby'?'출발하면 팀이 무작위로 균형 있게 배정됩니다.':s==='play'?'진행 중에도 시간을 조정할 수 있습니다.':'게임이 끝났습니다. 결과를 내려받거나 새 게임을 시작하세요.');
 lastMapKey='';updateMap()}
let lastMapKey='';
function updateMap(){if(flight)return;const cur=Math.max(0,stageAt(my.x,my.y)),key=cur+'|'+unlocked+'|'+localCorrect+'|'+localFinalCorrect+'|'+escapedAt;if(key===lastMapKey)return;lastMapKey=key;
 $('roomLabel').textContent=String(cur+1).padStart(2,'0')+' · '+ROOM_NAMES[cur];$('roomLabel').title=ROOM_LAYOUTS[cur]?.type||'';$('roomProgress').textContent=Math.min(ROOM_COUNT,unlocked+1)+' / '+ROOM_COUNT;$('escapeProgress').style.width=Math.min(100,(Math.min(localCorrect,18)+Math.min(localFinalCorrect,3))/ESCAPE_GOAL*100)+'%';
 $('miniMap').innerHTML=Array.from({length:8},(_,r)=>{const i=SEQUENCE.indexOf(r);if(i<0)return '<span></span>';return '<div class="map-cell '+(i<=unlocked||isTeacher?'open ':'')+(i===cur?'current':'')+'">'+String(i+1).padStart(2,'0')+'</div>'}).join('');
 $('nextMission').textContent=escapedAt?'탈출 성공! 다시 문제를 풀며 팀을 도울 수 있어요.':unlocked===6?(localFinalCorrect>=3&&localCorrect>=ESCAPE_GOAL?'오로라 출구로 나가 별빛 썰매 여행을 시작하세요.':'마지막 공간에서 '+Math.max(0,3-localFinalCorrect)+'문제를 더 맞혀 출구를 열어요.'):(3-localCorrect%3)+'문제를 더 맞히면 다음 방의 문이 열려요.'}

/* ---------- 교사 명령 ---------- */
async function teacherDo(fn){try{await fn()}catch(e){toast('연결을 확인하고 다시 눌러 주세요.')}}
$('startBtn').onclick=()=>teacherDo(async()=>{const ids=Object.keys(players);if(!ids.length){toast('학생이 입장한 뒤 시작해 주세요.');return}for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}const round=st.round+1,at=serverNow()+4000,up={st:{status:'play',round,duration:st.duration,startAt:at,endsAt:at+st.duration*1000}};ids.forEach((id,i)=>{up['pl/'+id+'/team']=i%2?'rudolph':'santa';up['sc/'+id]={c:0,cur:0,f:0,e:0,r:round}});up.ps=null;resultRound=-1;await base(room).update(up);toast('곧 탐험이 시작됩니다!')});
function shiftTime(delta){teacherDo(async()=>{const s=effStatus();if(s==='play'){await base(room).child('st').update({endsAt:Math.max(serverNow()+1000,st.endsAt+delta*1000)})}else if(s==='lobby'||s==='ended'){await base(room).child('st').update({duration:Math.max(60,Math.min(5400,st.duration+delta))})}})}
$('plusTime').onclick=()=>shiftTime(60);$('minusTime').onclick=()=>shiftTime(-60);
$('endBtn').onclick=()=>{if(confirm('지금 게임을 종료하고 팀 결과를 볼까요?'))teacherDo(()=>base(room).child('st').update({status:'ended',endsAt:Math.min(st.endsAt,serverNow())}))};
$('resetBtn').onclick=()=>{if(confirm('점수를 초기화하고 모든 학생을 대기실로 돌릴까요?'))teacherDo(async()=>{const round=st.round+1,up={st:{status:'lobby',round,duration:st.duration,startAt:0,endsAt:0},ps:null};for(const id in players){up['pl/'+id+'/team']=null;up['sc/'+id]={c:0,cur:0,f:0,e:0,r:round}}resultRound=-1;await base(room).update(up)})};
$('clearRoster').onclick=()=>{if(confirm(roomTitle(room)+' 학생 명단과 점수를 모두 지울까요?'))teacherDo(async()=>{await base(room).update({pl:null,sc:null,ps:null,st:{status:'lobby',round:st.round+1,duration:st.duration,startAt:0,endsAt:0}});toast('명단을 비웠어요.')})};
async function copy(t){try{await navigator.clipboard.writeText(t);toast('복사했습니다.')}catch{info('<h2>복사할 내용</h2><p style="overflow-wrap:anywhere;user-select:all">'+escapeHTML(t)+'</p>')}}
const pageURL=()=>location.origin+location.pathname;
$('copyInvite').onclick=()=>copy(pageURL()+'?room='+room);$('studentView').onclick=()=>window.open(pageURL()+'?student=1&room='+room,'_blank');
$('downloadResults').onclick=()=>{const cell=s=>'"'+String(s).replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"';const[g,c]=room.split('-');const rows=[['학년','반','번호','이름','팀','정답 수','응답 수','탈출'],...playerRows().sort((a,b)=>a.no-b.no).map(p=>[g,c,p.no,p.nm,p.team==='santa'?'산타':p.team==='rudolph'?'루돌프':'대기',p.c,p.cur,p.e?'O':''])];const blob=new Blob(['﻿'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='크리스마스_방탈출_'+roomTitle(room)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('bankBtn').onclick=()=>info('<div class="overline">QUESTION LIBRARY</div><h2>10개 단원 · 200문항</h2><p>단원별 어휘 8개 · 표현 6개 · 빈칸 4개 · 대화/독해 2개</p>'+UNITS.map(u=>'<div class="unit-row"><span>'+u.unit+'. '+escapeHTML(u.title)+'<br><small>'+escapeHTML(u.topic)+'</small></span><b>20</b></div>').join(''));

/* ---------- 소리 ---------- */
$('infoClose').onclick=()=>$('infoDialog').close();$('guideBtn').onclick=()=>info('<div class="overline">HOW TO PLAY</div><h2>자정의 저택에 오신 것을 환영해요</h2><ol><li>선생님이 우리 반 대기실을 열면, 학생들은 학년·반·번호·이름을 입력해 입장해요.</li><li>선생님이 출발하면 산타와 루돌프로 팀이 골고루 나뉘어요.</li><li>방향키 / WASD 또는 지도를 눌러 걸어요. 빛나는 책·선물·수정에 다가가 E키를 누르세요.</li><li>정답 3개마다 다음 방의 문이 열려요. 마지막 공간의 3문제를 포함해 총 21개 이상을 맞히고 출구로 나가면 별빛 썰매 여행이 시작돼요! 그 뒤에도 추가 문제를 풀 수 있어요.</li><li>제한 시간 안에 정답 수가 더 많은 팀이 승리해요. 동점이면 공동 우승!</li></ol><hr><p>학생마다 200문항이 다른 순서로 나와요. 한 바퀴를 모두 마친 뒤에만 새로 섞여 반복돼요.</p>');
function updateAudioUI(){const a=HolidayAudio,p=a.prefs;for(const id of['soundBtn','lobbySoundBtn']){const b=$(id);if(b){b.textContent=p.enabled?'♪ 소리 설정':'♪ 소리 꺼짐';b.setAttribute('aria-label','배경음과 효과음 설정')}}if($('currentCarol'))$('currentCarol').textContent=a.track.title;for(const[id,key]of[['allSound','enabled'],['bgmSound','music'],['effectSound','effects']])if($(id))$(id).checked=p[key];for(const[id,key]of[['bgmVolume','musicVolume'],['effectVolume','effectsVolume']])if($(id)){$(id).value=Math.round(p[key]*100);$(id+'Label').textContent=Math.round(p[key]*100)+'%'}}
function showAudioSettings(){HolidayAudio.unlock().catch(()=>{});info('<div class="overline">CHRISTMAS SOUND</div><h2>캐럴과 효과음</h2><div class="audio-now"><small>지금 연주하는 캐럴</small><strong id="currentCarol"></strong><button class="secondary" id="nextCarol">다음 캐럴 ⏭</button></div><label class="audio-toggle"><span>전체 소리 켜기</span><input id="allSound" type="checkbox"></label><label class="audio-toggle"><span>캐럴 메들리 배경음</span><input id="bgmSound" type="checkbox"></label><label for="bgmVolume">배경음 음량 <span id="bgmVolumeLabel"></span></label><input id="bgmVolume" type="range" min="0" max="100" step="1"><label class="audio-toggle"><span>게임 효과음</span><input id="effectSound" type="checkbox"></label><label for="effectVolume">효과음 음량 <span id="effectVolumeLabel"></span></label><input id="effectVolume" type="range" min="0" max="100" step="1"><p>정답 · 오답 · 문제 열기 · 봉인 해제 · 공간 이동 · 발걸음 · 출발 · 종료 효과음</p><hr><p class="audio-playlist">'+CAROL_TRACKS.map((t,i)=>'<span>'+String(i+1).padStart(2,'0')+' '+escapeHTML(t.title)+'</span>').join('')+'</p><p>문제를 읽을 때는 배경음이 자동으로 작아집니다.</p>');updateAudioUI();for(const[id,key]of[['allSound','enabled'],['bgmSound','music'],['effectSound','effects']])$(id).onchange=async e=>{const checked=e.target.checked;await HolidayAudio.unlock();HolidayAudio.set(key,checked);if(key==='effects'&&checked)sound('correct')};for(const[id,key]of[['bgmVolume','musicVolume'],['effectVolume','effectsVolume']])$(id).oninput=e=>HolidayAudio.set(key,Number(e.target.value)/100);$('effectVolume').onchange=()=>sound('open');$('nextCarol').onclick=async()=>{await HolidayAudio.unlock();HolidayAudio.next()}}
HolidayAudio.onChange=updateAudioUI;$('soundBtn').onclick=showAudioSettings;$('lobbySoundBtn').onclick=showAudioSettings;updateAudioUI();
function firstAudioGesture(){HolidayAudio.unlock().catch(()=>{})}document.addEventListener('pointerdown',firstAudioGesture,{once:true,capture:true});document.addEventListener('keydown',firstAudioGesture,{once:true,capture:true});document.addEventListener('visibilitychange',()=>HolidayAudio.visibility(document.hidden));$('quizDialog').addEventListener('close',()=>HolidayAudio.duck(false));

/* ---------- 결과 ---------- */
function showResult(){if($('quizDialog').open)$('quizDialog').close();activeQuestion=null;const rows=playerRows(),{santa:a,rudolph:b}=teamScores(rows);$('winnerTitle').textContent=a===b?'산타와 루돌프, 공동 우승!':a>b?'산타 팀의 크리스마스 승리!':'루돌프 팀의 크리스마스 승리!';$('resultSummary').textContent='함께 푼 정답 '+(a+b)+'개 · 모두의 도전이 저택을 밝혔어요.';$('finalSanta').textContent=a;$('finalRudolph').textContent=b;$('resultPlayers').innerHTML=rankRows(rows.slice(0,8));$('resultClose').textContent=flight?'별빛 여행 계속하기 →':'지도로 돌아가기 →';if(!$('resultDialog').open)$('resultDialog').showModal();sound('finish')}
$('resultClose').onclick=()=>$('resultDialog').close();$('quizClose').onclick=()=>{$('quizDialog').close();keys={}};

/* ---------- 문제: 기기 안에서 바로 열고 채점(서버 기다림 없음) ---------- */
function shuffled(seed,n){let a=Array.from({length:n},(_,i)=>i),h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);function r(){h|=0;h=h+0x6D2B79F5|0;let t=Math.imul(h^h>>>15,1|h);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}for(let i=n-1;i>0;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function questionAt(id,round,cursor){const cycle=Math.floor(cursor/QUESTIONS.length),deck=shuffled(id+':'+round+':'+cycle,QUESTIONS.length);if(cycle>0){const prev=shuffled(id+':'+round+':'+(cycle-1),QUESTIONS.length);if(deck[0]===prev.at(-1))[deck[0],deck[1]]=[deck[1],deck[0]]}const q=QUESTIONS[deck[cursor%QUESTIONS.length]],order=shuffled(id+':'+round+':option:'+cursor,4);return{q,order,cycle,cursor,options:order.map(i=>[q.answer,...q.wrong][i])}}
function openQuestion(){if(flight)return;if(nearPortal()&&(isTeacher||playing())){usePortal();return}if(isTeacher||!playing())return;if(!nearObject()){toast('빛나는 선물·책·수정에 조금 더 가까이 가세요.');return}if($('quizDialog').open)return;keys={};path=[];publishPos(true);
 activeQuestion=questionAt(auth.id,st.round,localCursor);quizLocked=false;$('quizFeedback').textContent='';$('quizContinue').hidden=true;$('quizMeta').textContent='LESSON '+activeQuestion.q.unit+' · '+(localCursor%200+1)+' / 200'+(activeQuestion.cycle>0?' · '+(activeQuestion.cycle+1)+'번째 순환':'');$('quizType').textContent=activeQuestion.q.type+' · 봉인된 단서';$('quizPrompt').textContent=activeQuestion.q.prompt;
 $('options').replaceChildren(...activeQuestion.options.map((text,i)=>{const b=document.createElement('button');b.className='option';const n=document.createElement('span');n.textContent=i+1;b.append(n,document.createTextNode(text));b.onclick=()=>answer(i);return b}));$('quizDialog').showModal();HolidayAudio.duck(true);sound('open')}
function answer(i){if(quizLocked||!activeQuestion)return;quizLocked=true;const buttons=[...$('options').children];buttons.forEach(b=>b.disabled=true);const a=activeQuestion;
 if(!playing()||a.cursor!==localCursor){$('quizFeedback').textContent='시간이 끝났거나 이미 처리된 문제예요.';$('quizContinue').hidden=false;return}
 const correct=a.order[i]===0,finalPoint=correct&&stageAt(my.x,my.y)===6?1:0;buttons.forEach((b,j)=>{if(a.order[j]===0)b.classList.add('correct')});if(!correct)buttons[i].classList.add('wrong');
 $('quizFeedback').textContent=(correct?'정답! 팀 점수 +1 ✦':'아쉽지만 괜찮아요. 정답: '+a.q.answer)+'\n'+a.q.explanation;$('quizContinue').hidden=false;
 localCursor++;if(correct)localCorrect++;localFinalCorrect+=finalPoint;const before=unlocked;setUnlocked();
 base(room).child('sc/'+auth.id).update({c:localCorrect,cur:localCursor,f:localFinalCorrect,r:st.round});
 if(unlocked>before){sound('unlock');toast('✦ 다음 방의 봉인이 풀렸어요!')}else sound(correct?'correct':'wrong');if(escapeReady(localCorrect,localFinalCorrect,stageAt(my.x,my.y))&&!escapedAt)toast('마지막 봉인이 풀렸어요! 오로라 출구로 나가면 썰매 여행이 시작돼요.');scheduleHUD()}
$('landBtn').onclick=()=>{landFromFlight();if(auth&&!isTeacher)base(room).child('sc/'+auth.id+'/fly').set(null)};
$('quizContinue').onclick=()=>{$('quizDialog').close();activeQuestion=null;$('world').focus()};$('interactBtn').onclick=openQuestion;$('mobileInteract').onclick=openQuestion;
$('mapBtn').onclick=()=>{info('<div class="overline">THE MANOR MAP</div><h2>자정의 저택 지도</h2><p>'+escapeHTML(isTeacher?'교사 관전 모드입니다. 지도를 눌러 다른 방으로 이동할 수 있어요.':'정답 세 개마다 다음 문이 열려요. 각 공간의 문으로 다가가 E키를 누르면 다음 공간의 입구로 이어집니다.')+'</p><div class="minimap" id="largeMap">'+Array.from({length:8},(_,r)=>{const i=SEQUENCE.indexOf(r);if(i<0)return '<span></span>';return '<button data-room="'+r+'" class="map-cell '+(i<=unlocked||isTeacher?'open':'')+'" style="height:60px">'+(i+1)+'</button>'}).join('')+'</div><ol>'+ROOM_NAMES.map((n,i)=>'<li style="color:'+(i<=unlocked||isTeacher?'#edca85':'#7d929d')+'">'+n+' · '+ROOM_LAYOUTS[i].type+(i<=unlocked||isTeacher?' · 열림':' · 봉인됨')+'</li>').join('')+'</ol>');document.querySelectorAll('#largeMap button').forEach(b=>b.onclick=()=>{const r=Number(b.dataset.room);if(isTeacher){my={...spawnAt(SEQUENCE.indexOf(r)),facing:'down'};$('infoDialog').close();updateMap()}else toast('방 안의 출입문에 다가가 E키를 눌러 이동하세요.')})};

/* ---------- 미리 그려 두는 그림(캐시) ---------- */
const world=$('world'),wg=world.getContext('2d');let cam={x:0,y:0},frameAt=0,backingScale=2,viewScale=2,lastAudioCountdown=-1;
let bgCache={},clueCache={},portalCache={},labelCache=new Map(),charFrames=null,heroCache=null;
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c}
function resize(){if($('game').hidden)return;const cw=world.clientWidth||800,ch=world.clientHeight||500;
 // 화면 선명도는 최대 1.25배까지만(크롬북에서 2배로 그리면 그릴 점이 4배가 됨)
 const q=Math.min(window.devicePixelRatio||1,1.25,1700/cw);viewScale=window.innerWidth<760?1.45:2.1;const bs=q*viewScale;world.width=Math.round(cw*q);world.height=Math.round(ch*q);if(Math.abs(bs-backingScale)>.001){backingScale=bs;bgCache={};clueCache={};portalCache={};labelCache.clear();charFrames=null;skyKey=''}}
window.addEventListener('resize',()=>{clearTimeout(resize.t);resize.t=setTimeout(resize,150)});
function roomBg(stage){if(bgCache[stage])return bgCache[stage];const im=loadArt(ART_NAMES[stage]);if(!ready(im))return null;const c=makeCanvas(384*backingScale,320*backingScale),g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,0,0,c.width,c.height);bgCache[stage]=c;return c}
function buildCharFrames(){const im=art.directions;if(!ready(im))return null;charFrames={};for(const team of['santa','rudolph'])for(const facing of['down','up','right']){const f=directionFrame(team,facing,im.naturalWidth,im.naturalHeight),c=makeCanvas(42*backingScale,43*backingScale),g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,f.sx,f.sy,f.sw,f.sh,0,0,c.width,c.height);charFrames[team+facing]=c}return charFrames}
function character(g,x,y,team,t=0,walking=false,scale=1,facing='down'){g.save();g.translate(x,y);g.scale(scale,scale);g.fillStyle='#16202733';g.fillRect(-8,-1,16,4);const bob=walking?Math.sin(t*11)*1.2:0;const fr=charFrames||buildCharFrames();if(fr){const tm=team==='rudolph'?'rudolph':'santa',col=facing==='up'?'up':facing==='left'||facing==='right'?'right':'down';g.translate(0,bob);if(facing==='left')g.scale(-1,1);g.drawImage(fr[tm+col],-21,-43,42,43)}g.restore()}
function clueSprite(kind){if(clueCache[kind])return clueCache[kind];const s=backingScale,c=makeCanvas(60*s,64*s),g=c.getContext('2d');g.scale(s,s);const x=30,y=40;const glow=g.createRadialGradient(x,y-9,1,x,y-9,27);glow.addColorStop(0,'#ffe4a96b');glow.addColorStop(1,'#ffe4a900');g.fillStyle=glow;g.fillRect(x-29,y-38,58,58);g.fillStyle='#4b3a3430';g.beginPath();g.ellipse(x,y+1,10,3,0,0,Math.PI*2);g.fill();drawClueShape(g,kind,x,y);clueCache[kind]=c;return c}
function drawClueShape(g,kind,x,y){if(kind==='gift'){const c='#ac535b';g.save();g.translate(x,y);g.fillStyle='#15212b33';g.beginPath();g.ellipse(0,1,9,2.5,0,0,Math.PI*2);g.fill();g.fillStyle=c;g.strokeStyle='#5b3c3d';g.lineWidth=.65;g.beginPath();g.roundRect(-8,-14,16,13,1.5);g.fill();g.stroke();g.fillStyle='#f1e0b7';g.fillRect(-1.4,-14,2.8,13);g.beginPath();g.roundRect(-9,-16,18,4,1);g.fillStyle=c;g.fill();g.stroke();g.fillStyle='#f1e0b7';g.fillRect(-1.4,-16,2.8,4);g.strokeStyle='#e8cc91';g.lineWidth=1.5;for(const d of[-1,1]){g.beginPath();g.ellipse(d*3,-18,3.5,2,d*.4,0,Math.PI*2);g.stroke()}g.restore()}
 else if(kind==='book'){g.fillStyle='#e5d3a4';g.strokeStyle='#796249';g.lineWidth=.7;g.beginPath();g.moveTo(x-11,y-16);g.quadraticCurveTo(x-5,y-19,x,y-15);g.quadraticCurveTo(x+5,y-19,x+11,y-16);g.lineTo(x+11,y-3);g.quadraticCurveTo(x+5,y-6,x,y-2);g.quadraticCurveTo(x-5,y-6,x-11,y-3);g.closePath();g.fill();g.stroke();g.beginPath();g.moveTo(x,y-15);g.lineTo(x,y-2);g.stroke();g.strokeStyle='#9a8566';for(let i=0;i<3;i++){g.beginPath();g.moveTo(x-8,y-13+i*3);g.lineTo(x-3,y-12+i*3);g.moveTo(x+3,y-12+i*3);g.lineTo(x+8,y-13+i*3);g.stroke()}}
 else{g.fillStyle='#9ed5d3';g.strokeStyle='#e6f8dd';g.lineWidth=.8;g.beginPath();g.moveTo(x,y-23);g.lineTo(x+8,y-13);g.lineTo(x+5,y-3);g.lineTo(x,y);g.lineTo(x-6,y-5);g.lineTo(x-8,y-13);g.closePath();g.fill();g.stroke();g.fillStyle='#ddf4d9';g.beginPath();g.moveTo(x,y-23);g.lineTo(x,y);g.lineTo(x-3,y-12);g.closePath();g.fill()}
 g.fillStyle='#f2be5d';g.strokeStyle='#705131';g.lineWidth=.7;g.beginPath();g.moveTo(x-5,y-32);g.lineTo(x+5,y-32);g.lineTo(x,y-27);g.closePath();g.fill();g.stroke()}
function portalSprite(locked,label,icon){const key=locked+label+icon;if(portalCache[key])return portalCache[key];const s=backingScale,c=makeCanvas(56*s,48*s),g=c.getContext('2d');g.scale(s,s);g.translate(28,26);const color=locked?'#d0b082':'#a7ddcf';g.strokeStyle=color;g.fillStyle=locked?'#59493a44':'#7cc6c444';g.lineWidth=1.3;g.beginPath();g.ellipse(0,1,14,6,0,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#142333df';g.beginPath();g.roundRect(-25,8,50,11,3);g.fill();g.fillStyle='#f1dfb7';g.font='6px sans-serif';g.textAlign='center';g.fillText(label,0,16);portalCache[key]=c;return c}
function iconSprite(icon,color){const key='i'+icon+color;if(portalCache[key])return portalCache[key];const s=backingScale,c=makeCanvas(16*s,16*s),g=c.getContext('2d');g.scale(s,s);g.fillStyle=color;g.font='bold 10px sans-serif';g.textAlign='center';g.fillText(icon,8,12);portalCache[key]=c;return c}
function labelSprite(name,mine){const key=name+'|'+mine;let c=labelCache.get(key);if(c)return c;const s=backingScale,m=makeCanvas(1,1).getContext('2d');m.font='7px sans-serif';const tw=m.measureText(name).width;c=makeCanvas((tw+8)*s,11*s);const g=c.getContext('2d');g.scale(s,s);g.fillStyle=mine?'#c3b17a':'#172934dc';g.fillRect(0,0,tw+8,11);g.fillStyle=mine?'#1f3139':'#d7dfd1';g.font='7px sans-serif';g.textAlign='center';g.fillText(name,(tw+8)/2,8);c.w=tw+8;labelCache.set(key,c);if(labelCache.size>200)labelCache.delete(labelCache.keys().next().value);return c}

/* ---------- 첫 화면 그림: 한 번 그려 두고 눈송이만 움직이기 ---------- */
function seeded(n){let h=Math.sin(n*127.1+311.7)*43758.5453;return h-Math.floor(h)}
function drawHero(t){const cv=$('hero'),g=cv.getContext('2d');if(cv.width!==1000||cv.height!==1200){cv.width=1000;cv.height=1200;heroCache=null}
 if(!heroCache){const im=art['manor-hero'];heroCache=makeCanvas(1000,1200);const h=heroCache.getContext('2d');h.fillStyle='#29303a';h.fillRect(0,0,1000,1200);if(ready(im)){h.imageSmoothingQuality='high';const k=Math.max(1000/im.naturalWidth,1200/im.naturalHeight),w=im.naturalWidth*k,hh=im.naturalHeight*k;h.drawImage(im,(1000-w)/2,(1200-hh)/2,w,hh)}const v=h.createLinearGradient(0,0,0,1200);v.addColorStop(0,'#15202b80');v.addColorStop(.25,'#15202b00');v.addColorStop(.65,'#15202b00');v.addColorStop(1,'#111d2bde');h.fillStyle=v;h.fillRect(0,0,1000,1200);const d=art.directions;if(ready(d)){h.imageSmoothingQuality='high';for(const[team,x,y]of[['santa',430,700],['rudolph',585,725]]){const f=directionFrame(team,'down',d.naturalWidth,d.naturalHeight);h.fillStyle='#16202733';h.beginPath();h.ellipse(x,y+3,32,11,0,0,Math.PI*2);h.fill();h.drawImage(d,f.sx,f.sy,f.sw,f.sh,x-75.6,y-154.8,151.2,154.8)}}if(!ready(im)||!ready(d))setTimeout(()=>{heroCache=null},400)}
 g.drawImage(heroCache,0,0);g.fillStyle='#ffedb980';for(let i=0;i<25;i++){const x=seeded(i+17)*1000+Math.sin(t*.4+i)*8,y=(seeded(i+37)*1200+t*(i%3+1)*8)%1200,s=i%4?2:4;g.fillRect(x-s/2,y-s/2,s,s)}}

/* ---------- 게임 화면 ---------- */
function walkable(x,y){return stageAt(x,y)===stageAt(my.x,my.y)&&walkableAt(x,y,isTeacher?6:unlocked)}
let portalCooldown=0,transitionAlpha=0;
function nearPortal(){return portalsFor(stageAt(my.x,my.y)).find(p=>Math.hypot(p.x-my.x,p.y-my.y)<25)}
function nearObject(){return objectsFor(stageAt(my.x,my.y)).find(o=>Math.hypot(o.x-my.x,o.y-my.y)<49)}
function usePortal(){const p=nearPortal();if(!p)return false;if(Date.now()<portalCooldown)return true;const cur=stageAt(my.x,my.y);
 if(p.exit){if(escapePending)return true;if(!isTeacher&&!escapeReady(localCorrect,localFinalCorrect,cur)){portalCooldown=Date.now()+1500;toast('마지막 공간에서 '+Math.max(0,3-localFinalCorrect)+'문제를 더 맞히고 출구로 나가세요.');return true}portalCooldown=Date.now()+2000;if(isTeacher){startFlight(0,true);return true}escapedAt=escapedAt||serverNow();base(room).child('sc/'+auth.id).update({e:escapedAt,fly:1,r:st.round});startFlight(escapedAt);return true}
 if(!isTeacher&&p.to>unlocked){portalCooldown=Date.now()+1500;toast((3-localCorrect%3)+'문제를 더 맞히면 다음 공간의 문이 열려요.');return true}
 const target=destinationFor(cur,p.to);if(!target)return true;my={...target,facing:my.facing||'down'};loadArt(ART_NAMES[Math.min(6,p.to+1)]);sound('portal');keys={};path=[];portalCooldown=Date.now()+1400;transitionAlpha=.8;updateMap();publishPos(true);toast('⌖ '+ROOM_NAMES[p.to]+' · '+ROOM_LAYOUTS[p.to].type);return true}
let lastClock='',lastUiKey='',lastCountdown='';
function updateGameClock(){const now=serverNow(),s=effStatus();let rem=st.status==='lobby'?st.duration:Math.max(0,Math.ceil((st.endsAt-now)/1000));const txt=String(Math.floor(rem/60)).padStart(2,'0')+':'+String(rem%60).padStart(2,'0'),key=txt+s;
 if(key!==lastClock){lastClock=key;$('clock').textContent=txt;$('statusLabel').textContent=s==='lobby'?'출발 대기':s==='ended'?'탐험 종료':'자정까지 남은 시간';document.querySelector('.clock-wrap').classList.toggle('urgent',rem<=30&&s==='play')}
 const cd=st.status==='play'&&now<st.startAt,n=cd?Math.ceil((st.startAt-now)/1000):0;if(String(n)!==lastCountdown){lastCountdown=String(n);$('countdown').hidden=!cd;if(cd)$('countdown').textContent=n}if(cd&&n!==lastAudioCountdown){lastAudioCountdown=n;sound('tick')}else if(!cd&&lastAudioCountdown>0&&s==='play'){lastAudioCountdown=-1;sound('start')}
 if(s==='ended'&&st.round>0&&resultRound!==st.round){if(isTeacher&&st.status==='play'&&endWritten!==st.round){endWritten=st.round;base(room).child('st/status').set('ended')}resultRound=st.round;scheduleHUD();showResult()}}
function dialogOpen(){return $('quizDialog').open||$('infoDialog').open||$('resultDialog').open}
function renderWorld(t,dt){const g=wg,bs=backingScale,w=world.width/bs,h=world.height/bs;g.setTransform(bs,0,0,bs,0,0);updateGameClock();if(flight){drawFlight(g,w,h,t,dt);return}
 const canMove=!escapePending&&!dialogOpen()&&(isTeacher||playing());moving=false;const previous={x:my.x,y:my.y};
 if(canMove){let dx=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),dy=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0);if(dx||dy){path=[];const m=Math.hypot(dx,dy);dx/=m;dy/=m}else if(path.length){const p=path[0],dist=Math.hypot(p.x-my.x,p.y-my.y);if(dist<3)path.shift();else{dx=(p.x-my.x)/dist;dy=(p.y-my.y)/dist}}const speed=82*dt;if(dx||dy){if(walkable(my.x+dx*speed,my.y)){my.x+=dx*speed;moving=true}if(walkable(my.x,my.y+dy*speed)){my.y+=dy*speed;moving=true}}}
 if(moving){my.facing=facingFromDelta(my.x-previous.x,my.y-previous.y,my.facing||'down');sound('step');updateMap()}
 if(!isTeacher&&auth)publishPos();
 const currentStage=Math.max(0,stageAt(my.x,my.y)),origin=roomCoords(currentStage);watchStage(String(currentStage));
 cam.x=w>=416?origin.x+(384-w)/2:Math.max(origin.x-16,Math.min(origin.x+400-w,my.x-w/2));cam.y=h>=352?origin.y+(320-h)/2:Math.max(origin.y-16,Math.min(origin.y+336-h,my.y-h/2));cam.x=Math.round(cam.x*bs)/bs;cam.y=Math.round(cam.y*bs)/bs;
 g.fillStyle='#101724';g.fillRect(0,0,w,h);const bg=roomBg(currentStage);
 if(bg){g.setTransform(1,0,0,1,0,0);g.drawImage(bg,Math.round((origin.x-cam.x)*bs),Math.round((origin.y-cam.y)*bs));g.setTransform(bs,0,0,bs,0,0)}else{g.fillStyle='#a99a84';g.fillRect(origin.x-cam.x,origin.y-cam.y,384,320);g.fillStyle='#ead9b6';g.font='11px sans-serif';g.textAlign='center';g.fillText('저택을 밝히는 중…',origin.x-cam.x+192,origin.y-cam.y+160)}
 g.save();g.translate(-cam.x,-cam.y);
 for(const ob of objectsFor(currentStage)){const y=ob.y+Math.sin(t*2+ob.x)*1.6;g.drawImage(clueSprite(ob.k),ob.x-30,y-40,60,64)}
 for(const p of portalsFor(currentStage)){const locked=!isTeacher&&(p.exit?!escapeReady(localCorrect,localFinalCorrect,currentStage):p.to>unlocked),label=p.exit?'오로라 출구':locked?'봉인된 문':'공간 이동',icon=p.exit?'✦':locked?'⚿':p.to>currentStage?'➜':'↩';g.drawImage(portalSprite(locked,label,icon),p.x-28,p.y-26,56,48);g.drawImage(iconSprite(icon,locked?'#d0b082':'#a7ddcf'),p.x-8,p.y-20+Math.sin(t*2)*2,16,16)}
 const k=1-Math.exp(-dt*10),all=[];for(const id in peers){const p=peers[id];const ox=p.x,oy=p.y;p.x+=(p.tx-p.x)*k;p.y+=(p.ty-p.y)*k;p.walk=Math.abs(p.x-ox)+Math.abs(p.y-oy)>.05;const pl=players[id];if(!pl)continue;if(stageAt(p.x,p.y)!==currentStage)continue;all.push({x:p.x,y:p.y,facing:p.facing,team:pl.team,name:pl.no+'번 '+pl.nm,mine:false,walk:p.walk})}
 if(!isTeacher)all.push({x:my.x,y:my.y,facing:my.facing,team:players[auth?.id]?.team,name:myName(),mine:true,walk:moving});all.sort((a,b)=>a.y-b.y);
 for(const p of all){character(g,p.x,p.y,p.team,t,p.walk,1,p.facing||'down');if(p.name){const l=labelSprite(p.name,p.mine);g.drawImage(l,p.x-l.w/2,p.y-47,l.w,11)}if(p.mine){g.fillStyle='#d5bd82';g.fillRect(p.x,p.y+6,1,5);g.fillRect(p.x-2,p.y+8,5,1)}}
 if(isTeacher){g.fillStyle='#e7d49b';g.fillRect(my.x,my.y-8,1,17);g.fillRect(my.x-8,my.y,17,1);g.font='8px sans-serif';g.textAlign='center';g.fillText('교사 관전',my.x,my.y-17)}
 g.restore();
 g.fillStyle='#c5d9ce66';for(let i=0;i<22;i++){const x=(seeded(i+51)*w+Math.sin(t*.3+i)*7)%w,y=(seeded(i+69)*h+t*(i%2+1)*3)%h;g.fillRect(x,y,1,1)}
 const near=nearObject(),door=nearPortal(),play=playing();const hide=(!play&&!isTeacher)||(!door&&(!near||isTeacher)),label=door?'<kbd>E</kbd> '+(door.exit?'오로라 출구 열기':door.to>currentStage?'다음 공간으로 이동 →':'이전 공간으로 돌아가기 ←'):'<kbd>E</kbd> 봉인된 문제 열기',uiKey=hide+label;
 if(uiKey!==lastUiKey){lastUiKey=uiKey;$('interactBtn').hidden=hide;$('interactBtn').innerHTML=label}
 if(canMove&&moving&&door&&Math.hypot(door.x-my.x,door.y-my.y)<18&&Date.now()>portalCooldown)usePortal();
 if(transitionAlpha>0){g.fillStyle='rgba(9,17,29,'+transitionAlpha+')';g.fillRect(0,0,w,h);transitionAlpha=Math.max(0,transitionAlpha-dt*2)}}
let heroAt=0,idleAt=0;
function frame(now){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min(.05,(now-frameAt)/1000||.016),t=now/1000;
 if(!$('lobby').hidden){if(now-heroAt>=32){heroAt=now;drawHero(t)}frameAt=now;return}
 if($('game').hidden){frameAt=now;return}
 // 문제 창·결과 창이 떠 있을 때는 뒤 화면을 다시 그리지 않고 시계만 갱신
 if(dialogOpen()&&!flight){if(now-idleAt>250){idleAt=now;updateGameClock()}frameAt=now;return}
 frameAt=now;renderWorld(t,dt)}
requestAnimationFrame(frame);
world.addEventListener('pointerdown',e=>{if(dialogOpen())return;const r=world.getBoundingClientRect();if(flight){flight.target={x:((e.clientX-r.left)/r.width-.5)*world.width/backingScale*.45,y:((e.clientY-r.top)/r.height-.5)*world.height/backingScale*.4};return}const x=(e.clientX-r.left)/r.width*(world.width/backingScale)+cam.x,y=(e.clientY-r.top)/r.height*(world.height/backingScale)+cam.y;path=pathTo(my,x,y,isTeacher?6:unlocked);if(!path.length)toast('벽과 가구를 피해 열린 바닥을 눌러 주세요.');world.focus()});
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(dialogOpen()){if($('quizDialog').open&&/^[1-4]$/.test(e.key)&&!e.repeat)answer(Number(e.key)-1);return}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyE'].includes(e.code)&&!$('game').hidden){e.preventDefault();keys[e.code]=true;if((e.code==='KeyE'||e.code==='Space')&&!e.repeat)openQuestion()}});
window.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>{keys={};path=[]});
document.querySelectorAll('[data-dir]').forEach(b=>{const code={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[b.dataset.dir];b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[code]=true};b.onpointerup=b.onpointercancel=()=>keys[code]=false});

/* ---------- 시작 ---------- */
(function boot(){const r=params.get('room');if(r&&/^\d-\d+$/.test(r)){const[g,c]=r.split('-');$('grade').value=g;$('classNo').value=c;$('tGrade').value=g;$('tClass').value=c}
 if(params.has('teacher'))tab(true);if(params.has('student'))return;
 const tr=sessionStorage.getItem('mcTeacherRoom');if(sessionStorage.getItem('mcTeacher')==='ok'&&tr){isTeacher=true;enter(tr);return}
 let saved=null;try{saved=JSON.parse(localStorage.getItem('mc-player')||'null')}catch{}if(saved&&saved.room&&saved.id&&(!r||r===saved.room)){base(saved.room).child('pl/'+saved.id).get().then(s=>{if(s.exists()){auth=saved;enter(saved.room)}else{try{localStorage.removeItem('mc-player')}catch{}}}).catch(()=>{})}})();
