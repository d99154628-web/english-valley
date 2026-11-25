'use strict';
const $=id=>document.getElementById(id),show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
const names=['주전자 토토','시계탑 틱','보일러 포포','라디오 루','버섯 모모','잠수부 딥','태엽 틱톡','쌍안경 비비','참새 치치','랜턴 루미','망원경 코스','궤도 탱탱','이끼 포레','바람 윙윙','깔때기 피코','종소리 벨','배낭 로버','꽃게 크랩','자석 마그','새싹 그로','축음기 멜로','프로펠러 피피','굴뚝 스팀','우산 레인','정원 위리','카메라 찰칵','스프링 점피','등대 비콘','온실 가든','로켓 코코'];
let playerName='';
let peers=new Map(),trail=[],seq=0,lastSample=0,roundReady=false,finishRun='',finalRows=null;
const serverNow=()=>Date.now()+offset;
const practicing=()=>state?.status==='waiting';
const playing=()=>state&&['running','ending'].includes(state.status)&&serverNow()>=state.starts&&serverNow()<state.ends;
const canMove=()=>mode==='play'&&!!state&&(practicing()||playing());
let selected=0,mode='lobby',room='6-1',token=sessionStorage.getItem('brassTeacher3')||'',player='',run='',state=null,rows=[],offset=0,connected=false,lastSync=0,busy=false,soundOn=false,audioCtx,quizOpen=false,paused=false,fallWait=false,activeBox=0,boxSerial=0,solved=0,tried=0,bonus=0,lives=3,energy=100,worldTime=0,toastTimer;
let teacherStatus='';
const sprite=(el,i)=>{el.style.backgroundPosition=`${i%6*20}% ${Math.floor(i/6)*25}%`};
for(let i=0;i<30;i++){const b=document.createElement('button');b.className='robot-option';b.setAttribute('role','radio');b.setAttribute('aria-label',names[i]);b.setAttribute('aria-checked',i===0?'true':'false');b.title=names[i];const d=document.createElement('div');d.className='robot';sprite(d,i);b.append(d);const n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');b.append(n);b.onclick=()=>{selected=i;document.querySelectorAll('.robot-option').forEach((x,j)=>x.setAttribute('aria-checked',String(i===j)));sprite($('heroRobot'),i);$('heroName').textContent=`${String(i+1).padStart(2,'0')} · ${names[i]}`;RobotAudio.sfx('click')};$('robots').append(b)}
for(const id of ['grade','tGrade'])for(let i=1;i<=6;i++)$(id).add(new Option(i+'학년',i));
for(const id of ['classroom','tClass'])for(let i=1;i<=6;i++)$(id).add(new Option(i+'반',i));
for(let i=1;i<=60;i++)$('number').add(new Option(i+'번',i));$('grade').value=$('tGrade').value='6';
$('tBank').innerHTML=(window.QUESTIONS||[]).length+'문제 <i>무작위</i>';
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000)}
function setSound(value){soundOn=value;RobotAudio.enable(value);$('sound').textContent=value?'♪ 소리 켬':'♪ 소리 끔';$('sound').setAttribute('aria-pressed',String(value));$('sound').setAttribute('aria-label',value?'소리 끄기':'소리 켜기');}
$('sound').onclick=()=>{setSound(!soundOn);sessionStorage.setItem('brassSound',soundOn?'on':'off');if(soundOn)RobotAudio.sfx('click')};
$('musicVolume').oninput=e=>RobotAudio.musicVolume(Number(e.target.value)/100);

/* ---------- Firebase 실시간 연결 (jt/<방> 아래에 짧은 글자로 저장) ---------- */
const FB=firebase.initializeApp({databaseURL:'https://jump-tower-live-default-rtdb.asia-southeast1.firebasedatabase.app'}).database();
const SV=firebase.database.ServerValue;
const rid=()=>Math.random().toString(36).slice(2,10).padEnd(8,'0');
const R=()=>'rj'+room;
const ref=(b,p)=>FB.ref('jt/'+R()+'/'+b+(p?'/'+p:''));
FB.ref('.info/serverTimeOffset').on('value',s=>{offset=s.val()||0});
FB.ref('.info/connected').on('value',s=>{connected=!!s.val();$('connection').textContent=connected?'● 관제소 연결됨':'○ 재연결 중';if(connected&&player)sendPos(true)});
let plMap={},scMap={},onSet=new Set(),watching='',stTimer=0;
function parseState(v){if(!v)return{status:'waiting',run:'init0000',starts:0,ends:0,duration:300,seed:0};const a=String(v).split('|');const starts=+a[2]||0;return{status:{w:'waiting',r:'running',e:'ended'}[a[0]]||'waiting',run:a[1]||'init0000',starts,ends:starts+(+a[3]||0)*1000,duration:+a[4]||300,seed:+a[5]||0}}
function packState(s){return[{waiting:'w',running:'r',ended:'e'}[s.status],s.run,Math.round(s.starts),Math.max(0,Math.round((s.ends-s.starts)/1000)),s.duration,s.seed].join('|')}
let rawState=null;
function effState(){if(!rawState)return null;const s={...rawState};if(s.status==='running'&&serverNow()>=s.ends)s.status='ended';return s}
function buildRows(){const out=[];for(const id in plMap){const p=String(plMap[id]).split('|');const sc=String(scMap[id]||'').split('|');const cur=state&&sc[0]===state.run;out.push({id,robot:+p[0]||0,name:p.slice(1).join('|'),height:cur?+sc[1]||0:0,bonus:cur?+sc[2]||0:0,ok:cur?+sc[3]||0:0,tried:cur?+sc[4]||0:0,online:onSet.has(id)})}out.sort((a,b)=>(b.height+b.bonus)-(a.height+a.bonus));rows=out}
function unwatch(){if(!watching)return;const base=FB.ref('jt/'+watching);['st','pl','sc','ps'].forEach(b=>base.child(b).off());watching='';plMap={};scMap={};onSet=new Set();peers.clear();rawState=null}
function watch(){if(watching===R())return;unwatch();watching=R();
ref('st','g').on('value',s=>{rawState=parseState(s.val());onState()});
ref('pl').on('value',s=>{plMap=s.val()||{};if(player&&!plMap[player]&&joinedAt&&Date.now()-joinedAt>4000)kicked();buildRows();afterRows()});
ref('sc').on('value',s=>{scMap=s.val()||{};buildRows();afterRows()});
const ps=ref('ps');
ps.on('child_added',s=>{onSet.add(s.key);gotPos(s.key,s.val());buildRows()});
ps.on('child_changed',s=>gotPos(s.key,s.val()));
ps.on('child_removed',s=>{onSet.delete(s.key);peers.delete(s.key);buildRows()});}
function gotPos(id,v){if(id===player)return;const a=String(v).split('|');let p=peers.get(id);if(!p){p={points:[]};peers.set(id,p)}const t=serverNow();if(p.points.length&&t-p.points[p.points.length-1][0]>1500)p.points=[];p.points.push([t,+a[0]||0,+a[1]||0]);if(p.points.length>40)p.points.shift()}
function afterRows(){if(mode==='teacher')renderTeacher();if(player&&mode==='play')renderRanks()}
let lastStatus='';
function onState(){state=effState();if(!state)return;buildRows();if(mode==='teacher')renderTeacher();if(player&&['waiting','play','finished'].includes(mode)){if(run!==state.run){run=state.run;resetGame();trail=[];peers.clear();finishRun='';finalRows=null;roundReady=false;lastScore='';screen('play');pushScore(true)}if(state.status==='ended'){if(lastStatus!=='ended'||finishRun!==run){pushScore(true);const r=run;setTimeout(()=>{if(run===r&&state&&state.status==='ended')finish()},1600)}}else if(mode!=='play')screen('play');renderRanks()}lastStatus=state.status}
setInterval(()=>{if(rawState&&rawState.status==='running'){const was=state&&state.status;const now=effState();if(now.status!==was)onState();else state=now}},500);
let lastScore='';
function pushScore(force){if(!player||!state)return;const h=practicing()?0:Math.floor(highest/10);const v=[state.run,h,practicing()?0:bonus,practicing()?0:solved,practicing()?0:tried].join('|');if(v!==lastScore||force){lastScore=v;ref('sc',player).set(v).catch(()=>{})}}
setInterval(()=>{if(player&&playing())pushScore()},1500);
let lastPosSent='',lastPosAt=0;
function sendPos(force){if(!player)return;const v=Math.round(x)+'|'+Math.round(y);const now=Date.now();if(!force&&(v===lastPosSent||now-lastPosAt<140))return;lastPosSent=v;lastPosAt=now;const r=ref('ps',player);r.set(v).catch(()=>{});if(force)r.onDisconnect().remove()}
let joinedAt=0;
function kicked(){const was=player;player='';joinedAt=0;trail=[];peers.clear();show('quiz',false);show('paused',false);show('fallen',false);clearRescue();fallWait=false;show('countdown',false);screen('lobby');if(was)toast('선생님이 새로 고침했어요. 다시 입장해 주세요.')}

function screen(name){for(const id of ['lobby','teacher','waiting','login','finished'])show(id,false);show('hud',name==='play'||name==='waiting');show('footer',name==='lobby');show('touchControls',name==='play');show('practiceBanner',name==='play'&&practicing());show('liveRanks',name==='play');show('gameTeacher',name==='play'||name==='finished');show('gameLeave',name==='play');if($(name))show(name);mode=name}
$('teacherOpen').onclick=()=>{if(token){room=$('tGrade').value+'-'+$('tClass').value;screen('teacher');watch();renderTeacher()}else show('login')};$('loginBack').onclick=()=>show('login',false);
$('loginForm').onsubmit=e=>{e.preventDefault();if($('password').value.trim()!=='0634'){toast('비밀번호가 달라요.');return}token='ok';sessionStorage.setItem('brassTeacher3',token);$('password').value='';show('login',false);room=$('tGrade').value+'-'+$('tClass').value;screen('teacher');watch();renderTeacher()};
$('joinForm').onsubmit=async e=>{e.preventDefault();if(sessionStorage.getItem('brassSound')!=='off')setSound(true);$('join').disabled=true;try{room=$('grade').value+'-'+$('classroom').value;watch();const id=rid();await ref('pl',id).set(selected+'|'+($('number').value+'번 '+$('name').value.trim()).slice(0,20));player=id;joinedAt=Date.now();playerName=$('name').value.trim();roundReady=false;finishRun='';finalRows=null;trail=[];lastScore='';const st=await ref('st','g').once('value');rawState=parseState(st.val());state=effState();run=state.run;resetGame();screen('play');sendPos(true);pushScore(true);if(state.status==='ended')finish();if(state.status==='running'){roundReady=serverNow()>=state.starts;toast('진행 중인 탐험에 합류했어요! 남은 시간 '+timeString(remaining()))}buildRows();renderRanks()}catch(e){toast('연결 오류 · 잠시 후 다시 눌러 주세요.')}finally{$('join').disabled=false}};
function removeMe(){if(!player)return;const id=player;ref('ps',id).remove();ref('pl',id).remove();ref('sc',id).remove()}
$('leave').onclick=()=>{removeMe();player='';screen('lobby')};
$('studentLink').onclick=()=>{screen('lobby')};
for(const id of ['tGrade','tClass'])$(id).onchange=()=>{room=$('tGrade').value+'-'+$('tClass').value;teacherStatus='';watch();renderTeacher()};
async function writeState(fn){const cur=parseState((await ref('st','g').once('value')).val());const next=fn(cur);if(next)await ref('st','g').set(packState(next));return next}
async function teacherAct(action){const dur=Number($('duration').value)||300,now=serverNow();
if(action==='start')await writeState(s=>{const e=effState()||s;if(e.status==='running')return null;const starts=now+4000;return{status:'running',run:rid(),starts,ends:starts+dur*1000,duration:dur,seed:Math.floor(Math.random()*100000)}});
if(action==='end')await writeState(s=>s.status==='running'&&now<s.ends?{...s,status:'ended',ends:Math.max(s.starts,now)}:null);
if(action==='duration')await writeState(s=>s.status==='running'&&now<s.ends?null:{...s,duration:dur});
if(action==='reset'){const snap=await FB.ref('jt/'+R()).once('value');const v=snap.val()||{};const jobs=[];for(const b of ['pl','sc','ps'])for(const k in (v[b]||{}))jobs.push(ref(b,k).remove());await Promise.all(jobs);await writeState(s=>({status:'waiting',run:rid(),starts:0,ends:0,duration:s.duration||dur,seed:0}))}}
for(const [id,action] of [['start','start'],['end','end'],['reset','reset'],['saveTime','duration']])$(id).onclick=async()=>{if(id==='reset'&&!confirm('학생 모두를 내보내고 명단을 비울까요?'))return;try{$(id).disabled=true;await teacherAct(action);toast(id==='saveTime'?'탐험 시간을 적용했어요.':id==='start'?'모든 로봇이 출발합니다!':id==='reset'?'새 라운드 준비 완료':'탐험을 종료했어요.')}catch(e){toast('연결 오류 · 다시 눌러 주세요.')}finally{$(id).disabled=false;renderTeacher()}};
function timeString(s){s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function remaining(){return !state?300:['running','ending'].includes(state.status)?(state.ends-Math.max(serverNow(),state.starts))/1000:state.status==='ended'?0:state.duration}
function rankAt(i,list=rows){const score=list[i].height+list[i].bonus;return list.findIndex(x=>x.height+x.bonus===score)+1}
function renderTeacher(){if(!state)return;if(teacherStatus&&teacherStatus!=='ended'&&state.status==='ended'&&rows.length){RobotAudio.fanfare();confetti(4200)}teacherStatus=state.status;$('tStatus').textContent={waiting:'🛝 연습 시간',running:'🎮 게임 중',ending:'🏁 종료 준비',ended:'🏁 게임 끝'}[state.status];$('tCount').textContent=rows.filter(r=>r.online).length+'명';$('tClock').textContent=timeString(remaining());$('duration').disabled=!['waiting','ended'].includes(state.status);$('saveTime').disabled=!['waiting','ended'].includes(state.status);$('start').disabled=!['waiting','ended'].includes(state.status);$('end').disabled=state.status!=='running';$('roster').replaceChildren();if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.style.textAlign='center';td.style.padding='50px';td.textContent='아직 탑승한 탐험가가 없어요. 학생들에게 같은 학년·반을 선택하도록 안내하세요.';tr.append(td);$('roster').append(tr)}rows.forEach((r,i)=>{const rank=rankAt(i),tr=document.createElement('tr');const vals=[['🥇','🥈','🥉'][rank-1]||rank+'위',r.name+(r.online?' · 접속 중':' · 연결 끊김')+' · '+names[r.robot],r.height+'m',r.ok+' / '+r.tried,r.bonus+'점',(r.height+r.bonus)+'점'];vals.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});$('roster').append(tr)})}
$('csv').onclick=()=>{const esc=v=>'"'+String(v).replaceAll('"','""').replace(/^[=+@-]/,"'")+'"';const lines=[['순위','이름','최고높이','정답수','풀이수','보너스','총점'],...rows.map((r,i)=>[rankAt(i),r.name,r.height,r.ok,r.tried,r.bonus,r.height+r.bonus])];const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+lines.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.download='황동하늘_'+room+'_결과.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};

let tripleFx=0,starTime=0,collectedStars=new Set();
let bodyStretch=0,bodyVelocity=0,bodyLean=0;
let grounded=true,coyote=5,jumpBuffer=0,landingSquash=0;
let x=550,y=0,vy=0,jumps=0,highest=0,camera=0,lastPlatform=0,keys={},particles=[];
function resetGame(){lastStage=0;starTime=0;collectedStars=new Set();bodyStretch=0;bodyVelocity=0;bodyLean=0;grounded=true;coyote=5;jumpBuffer=0;landingSquash=0;x=550;y=0;vy=0;jumps=0;highest=0;camera=0;lastPlatform=0;boxSerial=0;bonus=0;solved=0;tried=0;lives=3;energy=100;worldTime=0;safePlatform=0;quizOpen=false;paused=false;fallWait=false;show('quiz',false);show('paused',false);show('fallen',false);clearRescue();clearRescue()}

// Fixed 60 Hz physics: a firm takeoff, faster falling, and a momentum-aware air impulse.
const JUMP_PHYSICS={takeoff:14.5,riseGravity:.70,fallGravity:1.05,maxFall:22,airImpulse:12.2,airCarry:.35,minAir:10.8,maxAir:15.8};
function jump(){if(!canMove()||quizOpen||paused||fallWait)return;jumpBuffer=6}
const needCharge=()=>!practicing()&&energy<=10&&grounded&&!rescue&&!platform(lastPlatform).spring;
function applyJump(){
if(jumpBuffer<=0)return;
if(!practicing()&&energy<=10){if(needCharge()){jumpBuffer=0;openQuestion()}return}
if(grounded||coyote>0){vy=JUMP_PHYSICS.takeoff;jumps=1;RobotAudio.sfx('jump');bodyStretch=-.13;bodyVelocity=.095}
else if(jumps<(starTime>0?3:2)){vy=Math.max(JUMP_PHYSICS.minAir,Math.min(JUMP_PHYSICS.maxAir,vy*JUMP_PHYSICS.airCarry+JUMP_PHYSICS.airImpulse));jumps++;if(jumps===3){vy=Math.max(vy,15.5);tripleFx=performance.now();toast('★ 트리플 점프!')}RobotAudio.sfx(jumps===3?'triple':'double');bodyStretch=-.09;bodyVelocity=.12}
else return;
energy=Math.max(0,energy-(jumps>=2?3:2));grounded=false;coyote=0;jumpBuffer=0;landingSquash=0;
}

addEventListener('keydown',e=>{if(mode!=='play'||e.target.matches('input,select,textarea'))return;if(rescue&&!quizOpen&&!paused&&(e.code==='Enter'||e.code==='NumpadEnter')){e.preventDefault();respawn();return}if(['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW'].includes(e.code)){e.preventDefault();keys[e.code]=true;if(!e.repeat&&['Space','ArrowUp','KeyW'].includes(e.code))jump()}});addEventListener('keyup',e=>{keys[e.code]=false});addEventListener('blur',()=>{keys={};jumpBuffer=0});
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;if(b.dataset.key==='Space')jump()};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.key]=false}
$('pause').onclick=()=>{paused=true;keys={};show('paused')};$('resume').onclick=()=>{paused=false;show('paused',false)};
function platform(i,time=worldTime){
const seed=(state?.seed||0)*.001;const baseX=i===0?550:550+Math.sin(i*.87+seed)*245,baseY=i*95;
const spring=i>0&&i%9===4,star=i>0&&i%6===2,kind=i<3||spring?'fixed':i%3===0?'horizontal':i%5===0?'vertical':'fixed';
const phase=time*(kind==='horizontal'?.95:1.75)+i*.73+seed;
return{x:baseX+(kind==='horizontal'?Math.sin(phase)*55:0),y:baseY+(kind==='vertical'?Math.sin(phase)*36:0),w:i===0?1100:155,spring,star,kind,baseX,baseY};
}

/* ---------- 떨어졌을 때: Enter → 생명 1개 → 원래 자리로 ---------- */
let safePlatform=0,rescue=null;
function startFall(){rescue={i:safePlatform,until:performance.now()+8000};RobotAudio.sfx('fall');rescueTip();show('rescueTip')}
function rescueTip(){const t=$('rescueTip');let h;if(practicing())h='⬇ 떨어지는 중! <b>Enter</b> = 떨어진 발판으로 돌아가기 <small>(연습이라 생명을 안 써요)</small>';else if(lives>0)h='⬇ 떨어지는 중! <b>Enter</b> = 생명 1개 쓰고(♥ '+lives+' → '+(lives-1)+') 떨어진 발판으로 <small>· 안 누르면 생명을 아끼고 아래 발판에서 다시 올라가요</small>';else h='⬇ 생명이 없어요. 아래 발판에서 다시 올라가요! <small>문제를 맞히면 생명 +1</small>';if(t.innerHTML!==h)t.innerHTML=h}
function clearRescue(){rescue=null;if($('rescueTip'))show('rescueTip',false)}
function respawn(){if(!rescue||quizOpen||paused)return;const free=practicing();if(!free){if(lives<=0)return;lives--}
const i=rescue.i,p=platform(i);clearRescue();keys={};x=p.x;y=p.y;lastPlatform=i;safePlatform=i;
vy=0;jumps=0;grounded=true;coyote=5;jumpBuffer=0;bodyStretch=-.2;bodyVelocity=.1;camera=Math.max(0,y-ch*.38);RobotAudio.sfx('spring');toast(free?'떨어진 발판으로 돌아왔어요!':'♥ 생명 1개를 쓰고 떨어진 발판으로 돌아왔어요!')}
$('respawn').onclick=respawn;$('rescueTip').onclick=respawn;

/* ---------- 문제 (게임 안에서 바로 냄) ---------- */
let deck=[],curQ=null;
function nextQ(){const Q=window.QUESTIONS||[];if(!deck.length){deck=Q.map((_,i)=>i);for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}}return Q[deck.pop()]}
function openQuestion(){if(quizOpen||fallWait||!playing()||mode!=='play')return;const q=nextQ();if(!q)return;quizOpen=true;curQ=q;RobotAudio.sfx('box');keys={};show('quiz');show('continue',false);$('feedback').textContent='';$('quizLabel').textContent='⚡ 에너지 부족 · 충전 문제 '+(boxSerial+1);$('question').textContent=q.q;const qi=$('qImg');if(q.img){qi.src=q.img;qi.alt='문제 그림';show('qImg')}else{qi.removeAttribute('src');show('qImg',false)}$('options').replaceChildren();const opts=[q.a].concat(q.w);for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]]}opts.forEach((text,i)=>{const b=document.createElement('button');b.textContent=String.fromCharCode(65+i)+'. '+text;b.dataset.ok=text===q.a?'1':'';b.onclick=()=>answer(b);$('options').append(b)})}
function answer(btn){for(const b of $('options').children){b.disabled=true;if(b.dataset.ok)b.style.borderColor='#8fe3a0'}tried++;const ko=curQ.ko?' ('+curQ.ko+')':'';if(btn.dataset.ok){energy=100;bonus+=100;solved++;lives=Math.min(5,lives+1);$('feedback').textContent='정답! 에너지 100% 충전 · +100점 · 생명 +1'+ko;$('feedback').style.color='#e7c477';RobotAudio.sfx('correct')}else{btn.style.borderColor='#e2b2a0';energy=65;$('feedback').textContent='정답은 “'+curQ.a+'”예요'+ko+'. 에너지를 65%까지 충전했어요!';$('feedback').style.color='#e2b2a0';RobotAudio.sfx('wrong')}boxSerial++;show('continue')}
$('continue').onclick=()=>{quizOpen=false;show('quiz',false);keys={}};
addEventListener('keydown',e=>{if(!quizOpen||mode!=='play')return;const k={Digit1:0,Digit2:1,Digit3:2,KeyA:0,KeyB:1,KeyC:2,Numpad1:0,Numpad2:1,Numpad3:2}[e.code];if(k!==undefined){const b=$('options').children[k];if(b&&!b.disabled)answer(b)}else if((e.code==='Enter'||e.code==='Space')&&!$('continue').classList.contains('hidden')){e.preventDefault();$('continue').click()}});

/* ---------- 게임 끝: 팡파레 + 순위 ---------- */
function finish(){if(finishRun===run)return;finishRun=run;finalRows=rows.map(r=>({...r})).sort((a,b)=>(b.height+b.bonus)-(a.height+a.bonus));quizOpen=false;paused=false;fallWait=false;keys={};jumpBuffer=0;show('quiz',false);show('paused',false);show('fallen',false);clearRescue();show('countdown',false);screen('finished');const me=finalRows.find(r=>r.id===player);if(me){highest=Math.max(highest,me.height*10);bonus=Math.max(bonus,me.bonus);solved=Math.max(solved,me.ok)}const myRank=me?rankAt(finalRows.indexOf(me),finalRows):0;$('finalScore').innerHTML=(Math.floor(highest/10)+bonus)+'<small>POINTS'+(myRank?' · '+myRank+'등 / '+finalRows.length+'명':'')+'</small>';$('finalDetail').textContent=`최고 ${Math.floor(highest/10)}m · 정답 ${solved}개 · 다음 출발 신호를 기다려요`;
$('top3').replaceChildren();finalRows.slice(0,3).forEach((r,i)=>{const el=document.createElement('div');el.className='place p'+(i+1);const m=document.createElement('b');m.textContent=['🥇','🥈','🥉'][i];const rb=document.createElement('div');rb.className='robot';sprite(rb,r.robot);const n=document.createElement('span');n.textContent=r.name.replace(/^\d+번\s*/,'');const s=document.createElement('small');s.textContent=(r.height+r.bonus)+'점';el.append(m,rb,n,s);$('top3').append(el)});
$('podium').replaceChildren();finalRows.forEach((r,i)=>{if(i<3)return;const el=document.createElement('div');el.className='podium-row'+(r.id===player?' me':'');const a=document.createElement('span'),b=document.createElement('span');a.textContent=rankAt(i,finalRows)+'위 '+r.name;b.textContent=(r.height+r.bonus)+'점';el.append(a,b);$('podium').append(el)});
RobotAudio.fanfare();confetti(4500)}
const cv=$('confetti'),cx=cv.getContext('2d');let bits=[],confUntil=0;
function confetti(ms){cv.width=innerWidth;cv.height=innerHeight;const cols=['#e3b76a','#ffe193','#8de0ce','#e2b2a0','#c69cff','#ffffff','#ff8f8f'];for(let i=0;i<180;i++)bits.push({x:Math.random()*cv.width,y:-20-Math.random()*cv.height*.6,vx:(Math.random()-.5)*3,vy:2+Math.random()*3.5,r:Math.random()*6.3,vr:(Math.random()-.5)*.3,w:6+Math.random()*6,h:8+Math.random()*8,c:cols[i%cols.length]});confUntil=performance.now()+ms;if(bits.length<=180)requestAnimationFrame(confLoop)}
function confLoop(t){cx.clearRect(0,0,cv.width,cv.height);bits.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.vy+=.03;b.r+=b.vr;cx.save();cx.translate(b.x,b.y);cx.rotate(b.r);cx.fillStyle=b.c;cx.fillRect(-b.w/2,-b.h/2,b.w,b.h*Math.abs(Math.cos(b.r*2)));cx.restore()});bits=bits.filter(b=>b.y<cv.height+30);if(t<confUntil||bits.length){if(t>confUntil)bits=bits.filter(b=>b.y<cv.height);requestAnimationFrame(confLoop)}else{bits=[];cx.clearRect(0,0,cv.width,cv.height)}}

$('home').onclick=()=>leaveGame();
const canvas=$('world'),ctx=canvas.getContext('2d'),atlas=new Image(),city=new Image();atlas.src='robots.webp';city.src='city.webp';let cw=1100,ch=720;
function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;cw=1100;ch=innerHeight/innerWidth*1100}resize();addEventListener('resize',resize);
const BIOME_HEIGHT=1000; // 10 world units = 1 metre.
const biomes=[
{name:'황동 도시',top:'#172c2c',bottom:'#8c8863',light:'#d9b96e',deck:'#786b4f'},
{name:'태양의 사막',top:'#935b45',bottom:'#ebc17d',light:'#ffd98b',deck:'#b98950'},
{name:'눈꽃 겨울 숲',top:'#385771',bottom:'#b8d5da',light:'#e5f6ff',deck:'#698d9a'},
{name:'은하 우주 정거장',top:'#100e28',bottom:'#343563',light:'#d4c5ff',deck:'#655c86'},
{name:'산호 바닷속',top:'#124d67',bottom:'#07343f',light:'#85e4da',deck:'#427e7c'}];
function worldIndex(){return Math.floor(highest/BIOME_HEIGHT)%biomes.length}
function drawRobot(px,py,size,index){if(atlas.complete&&atlas.naturalWidth){const sw=atlas.width/6,sh=atlas.height/5;ctx.drawImage(atlas,index%6*sw,Math.floor(index/6)*sh,sw,sh,px-size/2,py-size,size,size)}else{ctx.fillStyle='#bba679';ctx.fillRect(px-16,py-38,32,38);ctx.fillStyle='#fff2b2';ctx.fillRect(px-10,py-29,5,5);ctx.fillRect(px+5,py-29,5,5)}}
function drawBackground(t){
const idx=['lobby','teacher'].includes(mode)?0:worldIndex(),b=biomes[idx];
const g=ctx.createLinearGradient(0,0,0,ch);g.addColorStop(0,b.top);g.addColorStop(1,b.bottom);ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
const oval=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()};
const ridge=(base,amp,color,seed)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,ch);for(let x=0;x<=cw+20;x+=20)ctx.lineTo(x,base+Math.sin(x/180+seed)*amp+Math.sin(x/340+seed)*amp*.4);ctx.lineTo(cw,ch);ctx.closePath();ctx.fill()};
if(idx===0){
if(city.complete&&city.naturalWidth){ctx.save();ctx.globalAlpha=.55;const sc=Math.max(cw/city.width,ch/city.height);ctx.drawImage(city,(cw-city.width*sc)/2,(ch-city.height*sc)/2,city.width*sc,city.height*sc);ctx.restore()}
for(const xx of [55,1045]){ctx.fillStyle='#21332bd0';ctx.fillRect(xx-15,0,30,ch);for(let i=0;i<10;i++){ctx.fillStyle='#b99a6455';ctx.fillRect(xx-20,(i*130+camera*.2)%(ch+130),40,10)}}
}else if(idx===1){
oval(850,135,62,62,'#ffe1a1');oval(850,135,79,79,'#ffe1a115');
ridge(ch*.64,50,'#bb8050',2);ridge(ch*.78,55,'#d69e60',4);ridge(ch*.94,40,'#e6b676',1);
for(const [xx,yy,sz] of [[130,ch*.70,110],[925,ch*.8,75]]){ctx.fillStyle='#865936';ctx.beginPath();ctx.moveTo(xx-sz,yy);ctx.lineTo(xx,yy-sz);ctx.lineTo(xx+sz,yy);ctx.fill();ctx.fillStyle='#b68048';ctx.beginPath();ctx.moveTo(xx,yy-sz);ctx.lineTo(xx+sz,yy);ctx.lineTo(xx+sz*.2,yy);ctx.fill()}
ctx.strokeStyle='#536247';ctx.lineWidth=12;ctx.lineCap='round';for(const xx of [70,1020]){ctx.beginPath();ctx.moveTo(xx,ch);ctx.lineTo(xx,ch-140);ctx.moveTo(xx,ch-65);ctx.lineTo(xx-23,ch-85);ctx.lineTo(xx-23,ch-115);ctx.moveTo(xx,ch-95);ctx.lineTo(xx+22,ch-105);ctx.lineTo(xx+22,ch-135);ctx.stroke()}ctx.lineCap='butt';
for(let i=0;i<28;i++){ctx.fillStyle='#ffe3a34a';ctx.fillRect((i*131+t*30)%cw,(i*73)%ch,13,1)}
}else if(idx===2){
for(let i=0;i<6;i++){const xx=i*245-80,yy=ch*.72+(i%2)*65;ctx.fillStyle='#688998';ctx.beginPath();ctx.moveTo(xx-180,yy+130);ctx.lineTo(xx,yy-220);ctx.lineTo(xx+180,yy+130);ctx.fill();ctx.fillStyle='#e6eef0';ctx.beginPath();ctx.moveTo(xx,yy-220);ctx.lineTo(xx-55,yy-112);ctx.lineTo(xx-8,yy-134);ctx.lineTo(xx+30,yy-100);ctx.lineTo(xx+55,yy-112);ctx.fill()}
for(let i=0;i<10;i++){const xx=i<5?i*38:920+(i-5)*42,yy=ch-40+(i%3)*20,h=130+(i%4)*30;ctx.fillStyle='#355e64';ctx.beginPath();ctx.moveTo(xx,yy-h);ctx.lineTo(xx-45,yy);ctx.lineTo(xx+45,yy);ctx.fill();ctx.fillStyle='#cee5e4';ctx.beginPath();ctx.moveTo(xx,yy-h);ctx.lineTo(xx-27,yy-h*.4);ctx.lineTo(xx+27,yy-h*.4);ctx.fill()}
for(let i=0;i<65;i++)oval((i*83+Math.sin(t*.5+i)*22)%cw,(i*97+t*(10+i%5)+camera*.12)%(ch+20)-10,1+i%3,1+i%3,'#edf9ffb0');
}else if(idx===3){
ctx.save();ctx.globalAlpha=.17;ctx.strokeStyle='#b584c4';ctx.lineWidth=95;ctx.beginPath();ctx.moveTo(-100,ch*.7);ctx.bezierCurveTo(280,-70,750,ch+120,1200,40);ctx.stroke();ctx.restore();
for(let i=0;i<95;i++)oval((i*137.7)%cw,(i*83.3+camera*.06)%ch,i%8===0?2:1,i%8===0?2:1,'#f0eaff');
oval(890,205,79,79,'#a091bd');ctx.save();ctx.translate(890,205);ctx.rotate(-.4);ctx.strokeStyle='#d9bd9077';ctx.lineWidth=13;ctx.beginPath();ctx.ellipse(0,0,120,24,0,0,Math.PI*2);ctx.stroke();ctx.restore();oval(150,ch*.74,46,46,'#5685a2');oval(138,ch*.74-9,14,9,'#8bbdbb');
const sx=(t*15)%1400-150;ctx.strokeStyle='#d7e9ff70';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,80);ctx.lineTo(sx+70,57);ctx.stroke();
}else{
ctx.save();ctx.globalAlpha=.07;ctx.fillStyle='#b1ffff';for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(i*250,0);ctx.lineTo(i*250+40,0);ctx.lineTo(i*250+220,ch);ctx.lineTo(i*250+90,ch);ctx.fill()}ctx.restore();
ridge(ch*.9,30,'#1a655e',2);
for(let i=0;i<16;i++){const xx=i<8?i*20:960+(i-8)*20,yy=ch+15;ctx.strokeStyle=i%2?'#549c80':'#357d73';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(xx,yy);ctx.bezierCurveTo(xx-30,yy-80,xx+30+Math.sin(t+i)*15,yy-125,xx+Math.sin(t+i)*25,yy-180-i%4*25);ctx.stroke()}
for(let i=0;i<7;i++){const xx=i<4?40+i*35:980+(i-4)*40;ctx.strokeStyle=i%2?'#cd8a85':'#bbad73';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(xx,ch);ctx.lineTo(xx,ch-70);ctx.moveTo(xx,ch-30);ctx.lineTo(xx-18,ch-52);ctx.lineTo(xx-25,ch-80);ctx.moveTo(xx,ch-50);ctx.lineTo(xx+24,ch-77);ctx.stroke()}
for(let i=0;i<9;i++){const xx=(i*149+t*(i%2?12:-10)+cw*100)%cw,yy=90+i*63%Math.max(100,ch-170);ctx.fillStyle=i%2?'#e0b98177':'#8ec9cb66';ctx.beginPath();ctx.ellipse(xx,yy,17,7,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(xx-13,yy);ctx.lineTo(xx-25,yy-9);ctx.lineTo(xx-25,yy+9);ctx.fill()}
ctx.strokeStyle='#9fece95a';ctx.lineWidth=1;for(let i=0;i<35;i++){ctx.beginPath();ctx.arc((i*137+Math.sin(t+i)*10)%cw,ch-((i*97+t*18+camera*.1)%(ch+30)),3+i%5,0,Math.PI*2);ctx.stroke()}
}
if(mode==='lobby'||mode==='teacher'){ctx.fillStyle='#081c1b55';ctx.fillRect(0,0,cw,ch)}
}

let prev=0,acc=0;function loop(ms){const dt=Math.min((ms-prev)/1000||0,.05);prev=ms;RobotAudio.lower(quizOpen||paused||fallWait||mode==='teacher');ctx.setTransform(canvas.width/cw,0,0,canvas.height/ch,0,0);multiplayerFrame(ms);drawBackground(ms/1000);if(['play','waiting','finished'].includes(mode)){if(canMove()&&!quizOpen&&!paused&&!fallWait){acc+=dt;while(acc>=1/60&&!quizOpen&&!fallWait){update();acc-=1/60}if(practicing()){energy=100;bonus=0;solved=0;tried=0}else if(energy<=10&&grounded&&!rescue&&!platform(lastPlatform).spring)openQuestion()}else acc=0;drawWorld(ms/1000);$('height').innerHTML=Math.floor(highest/10)+' <i>m</i>';$('score').textContent=practicing()?'연습':Math.floor(highest/10)+bonus;$('lives').textContent=practicing()?'♥ 연습 무제한':'♥ '.repeat(lives)+'♡ '.repeat(Math.max(0,5-lives));$('clock').textContent=practicing()?'연습 중':timeString(remaining());$('starPower').textContent=starTime>0?'★ 트리플 점프 '+Math.ceil(starTime)+'초':'☆ 별을 먹으면 15초 트리플 점프';$('starPower').classList.toggle('active',starTime>0);$('next').textContent=connected?'에너지 '+Math.ceil(energy)+'% · 10% 이하에서 문제':'연결 복구 중 · 잠시 대기';$('energyFill').style.width=energy+'%';$('energyTrack').setAttribute('aria-valuenow',String(Math.ceil(energy)));$('energyTrack').classList.toggle('low',energy<=30);$('biome').textContent=String(worldIndex()+1).padStart(2,'0')+' · '+biomes[worldIndex()].name;}if(mode==='teacher')$('tClock').textContent=timeString(remaining());requestAnimationFrame(loop)}
function update(){
const P=JUMP_PHYSICS;
const previousTime=worldTime;worldTime=playing()?Math.max(0,(serverNow()-state.starts)/1000):worldTime+1/60;starTime=Math.max(0,starTime-1/60);energy=Math.max(0,energy-.2/60);
if(grounded){const before=platform(lastPlatform,previousTime),after=platform(lastPlatform);x+=after.x-before.x;y+=after.y-before.y;}
x+=(keys.ArrowRight||keys.KeyD?5:0)-(keys.ArrowLeft||keys.KeyA?5:0);
if(x<-25)x=1125;if(x>1125)x=-25;
landingSquash*=.72;
const stretchTarget=grounded?0:Math.min(.14,Math.abs(vy)*.007);
bodyVelocity=(bodyVelocity+(stretchTarget-bodyStretch)*.20)*.73;
bodyStretch=Math.max(-.27,Math.min(.30,bodyStretch+bodyVelocity));
const horizontal=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0);
bodyLean+=(horizontal*(grounded?.035:.07)-bodyLean)*.18;
if(grounded){const support=platform(lastPlatform);if(Math.abs(y-support.y)>.5||x+18<=support.x-support.w/2||x-18>=support.x+support.w/2){grounded=false;coyote=5;jumps=Math.max(1,jumps)}}
if(grounded&&platform(lastPlatform).spring&&Math.abs(x-platform(lastPlatform).x)<48){vy=26;grounded=false;coyote=0;jumps=1;jumpBuffer=0;bodyStretch=-.24;bodyVelocity=.15;RobotAudio.sfx('spring');}
applyJump();jumpBuffer=Math.max(0,jumpBuffer-1);
if(!grounded)coyote=Math.max(0,coyote-1);
const old=y;
if(!grounded){vy=Math.max(-P.maxFall,vy-(vy>0?P.riseGravity:P.fallGravity));y+=vy;}
if(!grounded&&vy<=0){
const lo=Math.max(0,Math.floor(y/95)-1),hi=Math.max(0,Math.ceil(old/95)+1);
for(let i=lo;i<=hi;i++){const p=platform(i);if(old>=platform(i,previousTime).y&&y<=p.y&&x+18>p.x-p.w/2&&x-18<p.x+p.w/2){
landingSquash=Math.min(.16,Math.abs(vy)*.012);y=p.y;vy=0;jumps=0;grounded=true;coyote=5;lastPlatform=i;if(!p.spring)safePlatform=i;
bodyStretch=-Math.min(.24,.08+landingSquash);bodyVelocity=-.028;
if(landingSquash>.06)RobotAudio.sfx('land',Math.min(1,landingSquash/.16));
if(p.spring&&Math.abs(x-p.x)<48){vy=26;grounded=false;coyote=0;jumps=1;jumpBuffer=0;bodyStretch=-.24;bodyVelocity=.15;RobotAudio.sfx('spring');toast('스프링 점프! ↑')}
break;
}}
}
// Collect stars by body overlap, including during a fast spring ascent.
for(let i=Math.max(1,Math.floor((Math.min(old,y)-80)/95));i<=Math.ceil((Math.max(old,y)+100)/95);i++){
const p=platform(i);if(p.star&&!collectedStars.has(i)&&Math.abs(x-p.x)<38&&Math.max(old,y)+72>=p.y+57&&Math.min(old,y)<=p.y+83){collectedStars.add(i);starTime=15;RobotAudio.sfx('star');toast('★ 15초 동안 트리플 점프! 별을 다시 먹으면 시간이 갱신돼요.');}
}
highest=Math.max(highest,y);
if(needCharge())openQuestion();
if(!rescue&&!grounded&&vy<0&&safePlatform>1&&y<platform(safePlatform).y-260)startFall();
if(rescue&&(y>=platform(rescue.i).y-5||(grounded&&performance.now()>rescue.until)))clearRescue();else if(rescue)rescueTip();
if(y<0){y=0;vy=0;jumps=0;grounded=true;coyote=5;lastPlatform=0;safePlatform=0}
// Keep the lift's travel visible instead of cancelling it with camera tracking.
if(!(grounded&&platform(lastPlatform).kind==='vertical'))camera+=(Math.max(0,y-ch*.38)-camera)*.16;
}

function drawWorld(t){const base=ch-70,sy=yy=>base-yy+camera;const low=Math.max(0,Math.floor((camera-100)/95)),high=Math.ceil((camera+ch)/95);for(let i=low;i<high;i++){const p=platform(i),py=sy(p.y);if(py<-100||py>ch+100)continue;ctx.save();if(p.kind!=='fixed'){ctx.strokeStyle='#dfcc8b55';ctx.setLineDash([4,6]);ctx.lineWidth=2;ctx.beginPath();if(p.kind==='horizontal'){ctx.moveTo(p.baseX-55,py+8);ctx.lineTo(p.baseX+55,py+8)}else{ctx.moveTo(p.x,sy(p.baseY-36));ctx.lineTo(p.x,sy(p.baseY+36))}ctx.stroke();ctx.setLineDash([])}ctx.shadowColor='#0005';ctx.shadowBlur=12;ctx.fillStyle=biomes[worldIndex()].deck;ctx.strokeStyle=p.kind==='fixed'?'#b4a075':'#8de0ce';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(p.x-p.w/2,py,p.w,15,4);ctx.fill();ctx.stroke();ctx.shadowBlur=0;drawPlatformTrim(p,py);if(p.kind!=='fixed'){ctx.fillStyle='#cdf6e7';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText(p.kind==='horizontal'?'↔':'↕',p.x,py-8)}ctx.fillStyle='#d5bb7d';for(let j=0;j<Math.min(12,p.w/25);j++){ctx.beginPath();ctx.arc(p.x-p.w/2+12+j*25,py+7,2,0,7);ctx.fill()}ctx.fillStyle='#1a2d24';ctx.fillRect(p.x-p.w/2+10,py+15,p.w-20,5);if(p.spring)drawSpring(p.x,py,t);if(p.star&&!collectedStars.has(i)){ctx.save();ctx.translate(p.x,py-70);ctx.rotate(Math.sin(t*2+i)*.15);ctx.shadowColor='#ffdc65';ctx.shadowBlur=18;ctx.fillStyle='#ffe392';ctx.strokeStyle='#fff4cd';ctx.lineWidth=2;ctx.beginPath();for(let k=0;k<10;k++){const r=k%2?9:20,a=k*Math.PI/5-Math.PI/2;const sx=Math.cos(a)*r,sy=Math.sin(a)*r;if(k)ctx.lineTo(sx,sy);else ctx.moveTo(sx,sy)}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}ctx.restore()}drawPeers(sy);if(starTime>0||performance.now()-tripleFx<600)drawStarAura(x,sy(y)-36,t);ctx.save();ctx.translate(x,sy(y)+4);ctx.rotate(bodyLean);ctx.scale(1/Math.sqrt(1+bodyStretch),1+bodyStretch);drawRobot(0,0,76,selected);ctx.restore();drawNameTag(x,sy(y)-76*(1+bodyStretch)-13);if(playing()&&rows.find(r=>r.online)?.id===player)drawCrown(x,sy(y)-112);if(mode==='play'){ctx.fillStyle='#172921d0';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(starTime>0?'★ SPACE 트리플 점프 · '+Math.ceil(starTime)+'초':'← → 이동 SPACE 더블점프',550,ch-25)}if(highest>0){const stage=Math.floor(highest/BIOME_HEIGHT);if(stage>lastStage){lastStage=stage;toast('새로운 세계 · '+biomes[stage%biomes.length].name+'에 도착했어요!')}}}let lastStage=0;requestAnimationFrame(loop);

function drawStarAura(px,py,t){ctx.save();const burst=Math.max(0,1-(performance.now()-tripleFx)/600);const blink=starTime>0&&starTime<3?(Math.sin(t*18)>0?1:.25):1;ctx.globalAlpha=blink;ctx.strokeStyle='#ffe392';ctx.shadowColor='#ffd34d';ctx.shadowBlur=18;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(px,py,48+burst*25,52+burst*25,0,0,7);ctx.stroke();ctx.fillStyle='#fff4cd';for(let k=0;k<6;k++){const a=t*3+k*Math.PI/3,r=50+burst*40;ctx.beginPath();ctx.arc(px+Math.cos(a)*r,py+Math.sin(a)*r*.9,3+burst*3,0,7);ctx.fill()}if(starTime>0){ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffe392';ctx.fillText('점프 '+Math.max(0,3-jumps)+'번 남음',px,py+62)}ctx.restore()}
function drawNameTag(px,py){if(!playerName)return;ctx.save();ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const w=Math.min(230,ctx.measureText(playerName).width+20);const nx=Math.max(w/2+4,Math.min(cw-w/2-4,px));ctx.fillStyle='#14261eed';ctx.strokeStyle='#e5c685bb';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(nx-w/2,py-12,w,24,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff2cd';ctx.fillText(playerName,nx,py,w-12);ctx.restore();}

// Brass piston launcher: bolted foot, guide rods, copper coil, worn pressure plate.
function drawSpring(px,py,t){
ctx.save();ctx.translate(px,py);
const near=Math.abs(x-px)<48&&Math.abs(y-(ch-70-py+camera))<40;
const h=near?20:27+Math.sin(t*2)*.7;
const metal=ctx.createLinearGradient(-27,0,27,0);metal.addColorStop(0,'#514b39');metal.addColorStop(.3,'#c5ab6c');metal.addColorStop(.5,'#e0c58a');metal.addColorStop(1,'#665a3b');
ctx.fillStyle='#302f28';ctx.fillRect(-28,-5,56,7);
ctx.strokeStyle='#514f43';ctx.lineWidth=6;for(const xx of [-17,17]){ctx.beginPath();ctx.moveTo(xx,-5);ctx.lineTo(xx,-h);ctx.stroke()}
ctx.strokeStyle='#c2b78f';ctx.lineWidth=2;for(const xx of [-17,17]){ctx.beginPath();ctx.moveTo(xx-1,-6);ctx.lineTo(xx-1,-h);ctx.stroke()}
ctx.fillStyle='#716d55';ctx.fillRect(-5,-h,10,h-4);
ctx.lineJoin='round';ctx.strokeStyle='#302b20';ctx.lineWidth=5;coil();ctx.stroke();ctx.strokeStyle='#ba9556';ctx.lineWidth=2.5;coil();ctx.stroke();
function coil(){ctx.beginPath();ctx.moveTo(-12,-5);for(let k=0;k<=8;k++)ctx.lineTo(k%2?12:-12,-6-k*(h-8)/8)}
ctx.fillStyle=metal;ctx.strokeStyle='#3c382a';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-28,-h-7,56,9,3);ctx.fill();ctx.stroke();
ctx.strokeStyle='#ead3a080';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-23,-h-5);ctx.lineTo(23,-h-5);ctx.stroke();
for(const xx of [-22,22]){ctx.fillStyle='#393a30';ctx.beginPath();ctx.arc(xx,-h-2,2,0,Math.PI*2);ctx.fill()}
ctx.fillStyle='#e4c878';ctx.shadowColor='#f1cb6a';ctx.shadowBlur=5;ctx.fillRect(-3,-h-4,6,2);ctx.restore();
}

function drawPlatformTrim(p,py){
const idx=worldIndex();ctx.save();
if(idx===1){ctx.strokeStyle='#eac789';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x-p.w/2+5,py+2);ctx.lineTo(p.x+p.w/2-5,py+2);ctx.stroke()}
if(idx===2){ctx.fillStyle='#e5f6f5';ctx.beginPath();ctx.roundRect(p.x-p.w/2,py-3,p.w,5,3);ctx.fill();for(let i=0;i<5;i++){const xx=p.x-p.w/2+15+i*28;ctx.beginPath();ctx.moveTo(xx,py+15);ctx.lineTo(xx+4,py+25+i%3*4);ctx.lineTo(xx+8,py+15);ctx.fill()}}
if(idx===3){ctx.fillStyle='#a9edf5';for(const xx of [p.x-p.w/2+4,p.x+p.w/2-8])ctx.fillRect(xx,py+4,4,7);ctx.strokeStyle='#bdb2e5';ctx.strokeRect(p.x-20,py+5,40,4)}
if(idx===4){ctx.strokeStyle='#81cbb0';ctx.lineWidth=2;for(let i=0;i<4;i++){const xx=p.x-p.w/2+20+i*35;ctx.beginPath();ctx.moveTo(xx,py+18);ctx.quadraticCurveTo(xx+10,py+25,xx+3,py+34);ctx.stroke()}}
ctx.restore();
}

function interpolated(points,time){if(!points.length)return null;if(time<=points[0][0])return points[0];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(time<=b[0]){const f=Math.max(0,Math.min(1,(time-a[0])/Math.max(1,b[0]-a[0])));let dx=b[1]-a[1];if(Math.abs(dx)>550)dx-=Math.sign(dx)*1100;if(Math.abs(b[2]-a[2])>500)return b;return[time,(a[1]+dx*f+1100)%1100,a[2]+(b[2]-a[2])*f]}}return points[points.length-1]}
function drawPeers(sy){if(mode!=='play')return;for(const [id,p] of peers){const info=String(plMap[id]||'');if(!info)continue;const q=interpolated(p.points,serverNow()-220);if(!q||sy(q[2])< -100||sy(q[2])>ch+100)continue;const parts=info.split('|');ctx.save();ctx.globalAlpha=.85;drawRobot(q[1],sy(q[2])+4,76,+parts[0]||0);const own=playerName;playerName=parts.slice(1).join('|').replace(/^\d+번\s*/,'');drawNameTag(q[1],sy(q[2])-89);playerName=own;if(playing()&&rows.find(r=>r.online)?.id===id)drawCrown(q[1],sy(q[2])-112);ctx.restore()}}
function drawCrown(px,py){ctx.save();ctx.font='21px sans-serif';ctx.textAlign='center';ctx.fillText('👑',px,py);ctx.restore()}
function renderRanks(){const out=$('rankList');out.replaceChildren();rows.filter(r=>r.online).slice(0,5).forEach((r,i)=>{const line=document.createElement('div');line.textContent=`${i===0?'👑':i+1+'.'} ${r.name} · ${r.height+r.bonus}점`;if(r.id===player)line.className='mine';out.append(line)})}
function multiplayerFrame(ms){if(mode!=='play')return;const now=serverNow();show('practiceBanner',practicing());const countdown=state&&state.status==='running'&&now<state.starts;show('countdown',!!countdown);if(countdown){$('countNumber').textContent=Math.ceil((state.starts-now)/1000);keys={};jumpBuffer=0}else if(playing()&&!roundReady){roundReady=true;resetGame();trail=[];lastScore='';pushScore(true);buildRows();renderRanks();toast('출발!');RobotAudio.sfx('correct')}
if(ms-lastSample>=70&&player){lastSample=ms;sendPos(false)}
}
function leaveGame(){removeMe();player='';peers.clear();trail=[];show('quiz',false);show('paused',false);show('fallen',false);clearRescue();fallWait=false;show('countdown',false);screen('lobby')}
$('gameLeave').onclick=leaveGame;
$('gameTeacher').onclick=()=>window.open('index.html?teacher=1','_blank','noopener');
for(const [id,delta] of [['addMinute',60],['subtractMinute',-60]])$(id).onclick=async()=>{try{const now=serverNow();await writeState(s=>s.status==='running'&&now<s.ends?{...s,ends:Math.max(now+5000,s.ends+delta*1000)}:null);toast(delta>0?'1분 늘렸어요.':'1분 줄였어요.')}catch(e){toast('연결 오류 · 다시 눌러 주세요.')}};
addEventListener('pagehide',()=>{if(player)ref('ps',player).remove()});
if(new URLSearchParams(location.search).has('teacher'))setTimeout(()=>$('teacherOpen').click(),0);
