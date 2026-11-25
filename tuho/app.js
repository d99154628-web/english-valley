/* Lesson 11 Do You Know Anything About Tuho? — 교과서 154·155·158·159쪽 교사용 화면 */
const STUDENT = !!window.STUDENT;
const $ = s => document.querySelector(s);
const SND = new Set(/*SND*/["a_dresses", "a_drums", "a_toys", "b_no", "b_yes", "g_no", "g_yes", "p_cookie", "p_dresses", "p_drums", "p_game", "p_hat", "p_toys", "q_boomerangs", "q_djembes", "q_nonla", "q_saris", "q_tuho", "q_yakgwa", "s_cookie", "s_dresses", "s_drums", "s_game", "s_hat", "s_toys", "sfx_click", "sfx_correct", "sfx_fanfare", "sfx_sparkle", "sfx_wrong", "v_it_fun", "v_it_nice", "v_it_tasty", "v_they_beautiful", "v_they_fun", "v_they_nice", "w_boomerangs", "w_djembes", "w_nonla", "w_saris", "w_tuho", "w_yakgwa"]);

/* ---------- 물건 ---------- */
const IT = {
  tuho:{en:"Tuho",it:1,ph:"a Korean game",q:"q_tuho",s:"s_game",w:"w_tuho",p:"p_game"},
  nonla:{en:"nón lá",it:1,ph:"a Vietnamese hat",q:"q_nonla",s:"s_hat",w:"w_nonla",p:"p_hat"},
  djembes:{en:"djembes",it:0,ph:"African drums",q:"q_djembes",s:"s_drums",a:"a_drums",w:"w_djembes",p:"p_drums"},
  yakgwa:{en:"yakgwa",it:1,ph:"a Korean cookie",q:"q_yakgwa",s:"s_cookie",w:"w_yakgwa",p:"p_cookie"},
  boomerangs:{en:"boomerangs",it:0,ph:"Australian toys",q:"q_boomerangs",s:"s_toys",a:"a_toys",w:"w_boomerangs",p:"p_toys"},
  saris:{en:"saris",it:0,ph:"Indian dresses",q:"q_saris",s:"s_dresses",a:"a_dresses",w:"w_saris",p:"p_dresses"}
};
const sent = k => (IT[k].it ? "It’s " : "They’re ") + IT[k].ph + ".";
const sentAre = k => (IT[k].it ? "It’s " : "They are ") + IT[k].ph + ".";
const img = k => `img/${k}.webp`;

/* ---------- 소리 ---------- */
const A = {on:true, cur:null, bgm:null, bgmOn:false};
function sfx(n, v=.7){ if(!A.on||!SND.has(n)) return; const a=new Audio(`snd/${n}.mp3`); a.volume=v; a.play().catch(()=>{}); }
function stopVoice(){ if(A.cur){A.cur.pause();A.cur=null} try{speechSynthesis.cancel()}catch(e){} document.querySelectorAll(".say.playing").forEach(b=>b.classList.remove("playing")); }
function play1(key, text){
  return new Promise(res=>{
    if(key && SND.has(key)){
      const a=new Audio(`snd/${key}.mp3`); A.cur=a; duck(true);
      let d=false; const fin=()=>{if(d)return;d=true;duck(false);res()};
      a.onended=fin; a.onerror=fin; a.onpause=fin; a.play().catch(fin);
    } else if(text){
      try{const u=new SpeechSynthesisUtterance(text.replace(/’/g,"'"));u.lang="en-US";u.rate=.85;u.onend=res;u.onerror=res;speechSynthesis.speak(u)}catch(e){res()}
    } else res();
  });
}
async function seq(list, btn){
  stopVoice(); if(btn) btn.classList.add("playing");
  const token = A.token = Symbol();
  for(const [k,t] of list){ if(A.token!==token) break; await play1(k,t); await new Promise(r=>setTimeout(r,250)); }
  if(btn) btn.classList.remove("playing");
}
function duck(d){ if(A.bgm) A.bgm.volume = d ? .05 : .16; }
function toggleBgm(){
  if(!A.bgm){ A.bgm=new Audio("snd/bgm.mp3"); A.bgm.loop=true; A.bgm.volume=.16; }
  A.bgmOn=!A.bgmOn; if(A.bgmOn) A.bgm.play().catch(()=>{}); else A.bgm.pause();
  $("#bgmBtn").classList.toggle("on",A.bgmOn);
}
const SAY = (list) => `<button class="say" data-say='${JSON.stringify(list).replace(/'/g,"&#39;")}' title="듣기">🔊</button>`;
const BL = (ans, extra="") => `<span class="blank" data-ans="${ans}">${ans}${extra}</span>`;

/* ---------- 땅따먹기 판 (교과서 155쪽 그대로) ---------- */
const BOARD = [
  {k:"tuho",ox:"x"},{k:"saris",ox:"o",f:["","Indian"," dresses"]},{k:"boomerangs",ox:"x"},
  {k:"nonla",ox:"o",f:["a Vietnamese ","hat",""]},{k:"djembes",ox:"x"},{k:"yakgwa",ox:"o",f:["a ","Korean"," cookie"]},
  {k:"boomerangs",ox:"x",f:["","Australian"," toys"]},{k:"tuho",ox:"o",f:["a Korean ","game",""]},{k:"saris",ox:"x"},
  {k:"yakgwa",ox:"o"},{k:"nonla",ox:"x"},{k:"djembes",ox:"o",f:["","African"," drums"]}
];
const G = {turn:"red", own:Array(12).fill(null), names:{red:"빨강 팀",blue:"파랑 팀"}};

/* 159쪽 고르기 */
const W = {a:null, at:null, b:null, bt:null};
const AT = ["fun","tasty","nice"], BT = ["fun","beautiful","nice"];

/* ---------- 슬라이드 ---------- */
const S = [];
const add = o => S.push(o);

add({id:"cover", sec:0, cover:true, html:()=>`
  <div class="cover"><img class="bg" src="img/cover.webp" alt=""><div class="shade"></div>
    <div class="ttl"><div class="l">6학년 영어 · LESSON 11</div>
      <h1>Do You Know Anything<br>About Tuho?</h1>
      <p>🌏 세계 문화 박람회에 온 걸 환영해요!</p></div>
    <div class="menu">
      <button data-go="a1"><img src="img/fair.webp" alt=""><div><b>154쪽</b><span>Read and Talk<br>Read and Write</span></div></button>
      <button data-go="p1"><img src="img/board.webp" alt=""><div><b>155쪽</b><span>Play 3<br>땅따먹기 놀이</span></div></button>
      <button data-go="r1"><img src="img/shop.webp" alt=""><div><b>158쪽</b><span>Ready to Write<br>Words · Sentences</span></div></button>
      <button data-go="l1"><img src="img/desk.webp" alt=""><div><b>159쪽</b><span>Let’s Write<br>Share It</span></div></button>
    </div></div>`});

/* 154 A */
add({id:"a1", sec:1, page:"154", no:"A", label:"Read and Talk", sub:"그림 보고 대화 읽기", tip:["154","A번","Read and Talk ①"], html:()=>`
  <div class="scene"><img src="img/fair.webp" alt="세계 문화 박람회">
    <div class="bub" style="left:40px;top:30px" data-say='[["q_tuho","Do you know anything about Tuho?"]]'><img src="img/girl.webp" style="width:50px;height:50px;border-radius:50%;object-fit:cover"> <span class="en">Do you know anything<br>about Tuho?</span></div>
    <div class="bub" style="left:545px;top:30px" data-say='[["q_nonla","Do you know anything about nón lá?"]]'><img src="img/boy.webp" style="width:50px;height:50px;border-radius:50%;object-fit:cover"> <span class="en">Do you know anything<br>about nón lá?</span></div>
    <div class="bub" style="left:1050px;top:30px" data-say='[["q_djembes","Do you know anything about djembes?"]]'><img src="img/girl.webp" style="width:50px;height:50px;border-radius:50%;object-fit:cover"> <span class="en">Do you know anything<br>about djembes?</span></div>
    <div class="bub ans up" style="left:60px;top:430px" data-say='[["b_yes","Yes, I do."],["s_game","It’s a Korean game."]]'><span class="en">Yes, I do. It’s a<br>Korean game.</span></div>
    <div class="bub ans up" style="left:545px;top:430px" data-say='[["g_no","No, I don’t."],["s_hat","It’s a Vietnamese hat."]]'><span class="en">No, I don’t.<br>It’s a Vietnamese hat.</span></div>
    <div class="bub ans up" style="left:1050px;top:430px"><span class="en">Yes, I do.<br>${BL("They’re African drums.")}</span></div>
  </div>`});

add({id:"a2", sec:1, page:"154", no:"A", label:"Read and Talk", sub:"빈칸에 알맞은 문장 고르기", tip:["154","A번","빈칸에 알맞은 문장"], html:()=>`
  <div style="display:grid;grid-template-columns:520px 1fr;gap:34px;height:100%;align-items:center">
    <div>
      <div class="photo" style="height:300px"><img src="img/djembes.webp" alt=""></div>
      <div class="card" style="padding:22px 26px;margin-top:22px;font-size:32px;font-weight:600;line-height:1.6" >
        <div class="en">👧 Do you know anything about djembes?</div>
        <div class="en">👦 Yes, I do. <span id="a2ans" class="blank" data-ans="They’re African drums.">They’re African drums.</span></div>
      </div>
    </div>
    <div>
      <div style="font-size:30px;font-weight:800;margin-bottom:18px">✏️ 아래에서 알맞은 문장을 골라 보세요.</div>
      <div class="choices">
        ${[["saris","They’re Indian dresses.",0],["yakgwa","It’s a Korean cookie.",0],["djembes","They’re African drums.",1],["boomerangs","They’re Australian toys.",0]]
          .map(([k,t,ok])=>`<button class="choice en" data-choice="${ok}" data-k="${k}"><img src="${img(k)}" alt="">${t}</button>`).join("")}
      </div>
    </div>
  </div>`});

/* 154 B */
const BQ = [
  {k:"boomerangs", n:1, lines:[["girl",`Do you know anything about ${BL("boomerangs")}?`,[["q_boomerangs","Do you know anything about boomerangs?"]]],["boy","Yes, I do. They’re Australian toys.",[["b_yes","Yes, I do."],["s_toys","They’re Australian toys."]]]]},
  {k:"saris", n:2, lines:[["girl","Do you know anything about saris?",[["q_saris","Do you know anything about saris?"]]],["boy","No, I don’t.",[["b_no","No, I don’t."]]],["girl",`They’re ${BL("Indian dresses")}.`,[["s_dresses","They’re Indian dresses."]]]]},
  {k:"yakgwa", n:3, lines:[["girl","Do you know anything about yakgwa?",[["q_yakgwa","Do you know anything about yakgwa?"]]],["boy",`Yes, I do. It’s ${BL("a Korean cookie")}.`,[["b_yes","Yes, I do."],["s_cookie","It’s a Korean cookie."]]]]}
];
BQ.forEach(q=>add({id:"b"+q.n, sec:1, page:"154", no:"B-"+q.n, label:"Read and Write", sub:`${q.n}번 대화 완성하기`, tip:["154",`B ${"①②③"[q.n-1]}번`,"Read and Write"], html:()=>`
  <div class="wordbox">${["a Korean cookie","boomerangs","Indian dresses"].map(w=>`<span class="w en" data-w="${w}">${w}</span>`).join("")}</div>
  <div class="qwrap" style="height:calc(100% - 80px)">
    <div class="photo" style="position:relative"><img src="${img(q.k)}" alt=""><span class="num" style="position:absolute;left:18px;top:18px;width:60px;height:60px;font-size:32px">${q.n}</span></div>
    <div class="lines">
      ${q.lines.map(([who,t,au],i)=>`<div class="line"><span class="who"><img src="img/${who}.webp" alt=""></span><b style="width:44px">${"ABA"[i]}:</b><span class="en">${t}</span>${SAY(au)}</div>`).join("")}
      <div style="display:flex;gap:14px;margin-top:20px">
        <button class="btn gold" data-act="reveal">✨ 정답 보기</button>
        <button class="btn teal" data-say='${JSON.stringify(q.lines.flatMap(l=>l[2]))}'>🔊 대화 전체 듣기</button>
      </div>
    </div>
  </div>`}));

/* 155 Play 3 */
const cellHTML = (c,i,step) => `<div class="cell ${G.own[i]&&step===2?G.own[i]:""}" data-cell="${i}">
  <img src="${img(c.k)}" alt=""><span class="nm en">${IT[c.k].en}</span><span class="ox ${c.ox}">${c.ox==="o"?"○":"✕"}</span>
  ${c.f?`<div class="ph en">${c.f[0]}${step===1?BL(c.f[1]):`<b style="color:var(--pink)">${c.f[1]}</b>`}${c.f[2]}</div>`:""}
  ${G.own[i]&&step===2?`<div class="flag">${G.own[i]==="red"?"🚩":"🏳️"}</div>`:""}</div>`;

add({id:"p1", sec:2, page:"155", no:"C STEP 1", label:"Play 3", sub:"빈칸 채워 땅따먹기 판 완성하기", tip:["155","C번 STEP 1","Play 3 판 완성하기"], html:()=>`
  <div style="display:grid;grid-template-columns:900px 1fr;gap:34px;height:100%">
    <div class="board">${BOARD.map((c,i)=>cellHTML(c,i,1)).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:20px;justify-content:center">
      <div class="panel" style="font-size:28px;line-height:1.6;font-weight:600">
        <div style="font-size:24px;color:var(--soft);font-weight:800">STEP 1</div>
        그림을 보고, 빈칸을 채워<br>땅따먹기 판을 완성해 보세요.
        <div style="margin-top:14px;font-size:24px;color:var(--soft)">빈칸(?)을 누르면 정답이 하나씩 나와요.</div>
      </div>
      <div class="panel" style="font-size:26px;font-weight:700;line-height:1.8">
        <div><span class="ox o" style="display:inline-grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#21a36b;color:#fff">○</span> <span class="en">Yes, I do.</span></div>
        <div><span style="display:inline-grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#e8504a;color:#fff">✕</span> <span class="en">No, I don’t.</span></div>
      </div>
      <button class="btn gold" data-act="reveal" style="align-self:flex-start">✨ 정답 모두 보기</button>
    </div>
  </div>`});

add({id:"p2", sec:2, page:"155", no:"C STEP 2", label:"Play 3", sub:"묻고 답하며 땅따먹기 놀이", tip:["155","C번 STEP 2","땅따먹기 놀이"], html:()=>{
  const sc = t => G.own.filter(x=>x===t).length;
  return `<div style="display:grid;grid-template-columns:900px 1fr;gap:34px;height:100%">
    <div class="board" id="board">${BOARD.map((c,i)=>cellHTML(c,i,2)).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="panel" style="font-size:24px;line-height:1.55;font-weight:600">
        ① 지우개를 튕겨 들어간 칸의 그림에 대해 짝이 물어요.<br>
        ② <b style="color:#21a36b">○</b>면 <span class="en">“Yes, I do. …”</span>, <b style="color:#e8504a">✕</b>면 <span class="en">“No, I don’t.”</span><br>
        ③ 바르게 말하면 그 칸은 우리 땅! 🚩
      </div>
      <div class="team ${G.turn==="red"?"now":""}" style="color:var(--red)">🚩 ${G.names.red}<span class="sc">${sc("red")}</span></div>
      <div class="team ${G.turn==="blue"?"now":""}" style="color:var(--blue)">🏳️ ${G.names.blue}<span class="sc">${sc("blue")}</span></div>
      <div style="font-size:24px;font-weight:800;text-align:center">지금은 <span style="color:${G.turn==="red"?"var(--red)":"var(--blue)"}">${G.names[G.turn]}</span> 차례예요</div>
      <button class="btn gold" data-act="flick" style="justify-content:center;height:72px;font-size:28px">🧽 지우개 튕기기</button>
      <div style="display:flex;gap:10px">
        <button class="btn ghost" data-act="turn" style="flex:1;justify-content:center;font-size:19px">🔄 차례 바꾸기</button>
        <button class="btn ghost" data-act="greset" style="flex:1;justify-content:center;font-size:19px">🧹 새 판</button>
      </div>
      <div style="font-size:18px;color:var(--soft);text-align:center">칸을 직접 눌러도 돼요</div>
    </div></div>`}});

/* 158 */
const R6 = [["nonla","a Vietnamese ","hat",""],["boomerangs","","Australian"," toys"],["yakgwa","a Korean ","cookie",""],["saris","","Indian"," dresses"],["djembes","","African"," drums"],["tuho","a Korean ","game",""]];
add({id:"r1", sec:3, page:"158", no:"A Words", label:"Ready to Write", sub:"알맞은 낱말 써서 어구 완성하기", tip:["158","A번 Words ①~⑥","Ready to Write"], html:()=>`
  <div style="display:grid;grid-template-columns:420px 1fr;gap:28px;height:100%">
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="photo" style="flex:1"><img src="img/shop.webp" alt="세계 문화 가게" style="object-position:40% 50%"></div>
      <button class="btn gold" data-act="reveal" style="justify-content:center">✨ 정답 모두 보기</button>
    </div>
    <div class="words6">${R6.map(([k,a,b,c],i)=>`<div class="w6"><img src="${img(k)}" alt=""><div class="t"><span class="num">${i+1}</span><span class="en">${a}${BL(b)}${c}</span><span style="flex:1"></span>${SAY([[IT[k].p,IT[k].ph]])}</div></div>`).join("")}</div>
  </div>`});

add({id:"r2", sec:3, page:"158", no:"A Sentences", label:"Ready to Write", sub:"어구 골라 문장 완성하기", tip:["158","A번 Sentences ①②","Ready to Write"], html:()=>`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;height:100%;align-items:center">
    ${[["tuho","a Korean game",[["q_tuho","Do you know anything about Tuho?"],["s_game","It’s a Korean game."]],"It’s"],["boomerangs","Australian toys",[["q_boomerangs","Do you know anything about boomerangs?"],["a_toys","They are Australian toys."]],"They are"]]
      .map(([k,ans,au,lead],i)=>`<div class="card" style="overflow:hidden">
        <div style="height:330px;position:relative"><img src="${img(k)}" style="width:100%;height:100%;object-fit:cover" alt=""><span class="num" style="position:absolute;left:18px;top:18px;width:56px;height:56px;font-size:30px">${i+1}</span></div>
        <div style="padding:24px 30px;font-size:34px;font-weight:600;line-height:1.9" class="en">
          Do you know anything about ${IT[k].en}?<br>${lead} ${BL(ans)}.
          <div style="margin-top:8px">${SAY(au)}</div></div></div>`).join("")}
  </div>
  <div style="position:absolute;right:40px;bottom:6px"><button class="btn gold" data-act="reveal">✨ 정답 모두 보기</button></div>`});

/* 159 B ❶ */
add({id:"l1", sec:4, page:"159", no:"B ❶", label:"Let’s Write", sub:"설명하고 싶은 것과 특징 고르기", tip:["159","B번 ❶","보기 A·B에서 고르기"], html:()=>`
  <div style="font-size:26px;font-weight:700;margin-bottom:14px">보기 A와 보기 B에서 설명하고 싶은 것과 그 특징을 하나씩 골라 ○ 해 보세요. <span style="color:var(--soft);font-size:21px">(눌러서 골라요)</span></div>
  <div class="pick"><div class="row A">${["tuho","yakgwa","nonla"].map(k=>`<button class="it ${W.a===k?"sel":""}" data-pick="a" data-v="${k}"><img src="${img(k)}" alt=""><b class="en">${IT[k].en}</b><span class="en">${IT[k].ph}</span></button>`).join("")}</div>
    <div class="traits A"><h4>보기 A에서 고른 물건의 특징</h4><div class="tr-row">${AT.map(t=>`<button class="trait en ${W.at===t?"sel":""}" data-pick="at" data-v="${t}">${t}</button>`).join("")}</div></div></div>
  <div class="pick"><div class="row B">${["boomerangs","djembes","saris"].map(k=>`<button class="it ${W.b===k?"sel":""}" data-pick="b" data-v="${k}"><img src="${img(k)}" alt=""><b class="en">${IT[k].en}</b><span class="en">${IT[k].ph}</span></button>`).join("")}</div>
    <div class="traits B"><h4>보기 B에서 고른 물건의 특징</h4><div class="tr-row">${BT.map(t=>`<button class="trait en ${W.bt===t?"sel":""}" data-pick="bt" data-v="${t}">${t}</button>`).join("")}</div></div></div>`});

/* 159 B ❷ 예시 */
const U = (t,n) => `<span class="u">${t}<sup>${n}</sup></span>`;
add({id:"l2", sec:4, page:"159", no:"B ❷", label:"Let’s Write", sub:"주어진 글 읽어 보기 (예시)", tip:["159","B번 ❷","주어진 글 읽기"], html:()=>`
  <div style="display:grid;grid-template-columns:1fr 330px;gap:30px;height:100%;align-items:center">
    <div class="essay en">
      Do you know anything about ${U("yakgwa",1)}?<br>
      It’s ${U("a Korean cookie",2)}. It’s very ${U("tasty",3)}.<br>
      Do you know anything about ${U("djembes",4)}?<br>
      They are ${U("African drums",5)}. They are very ${U("fun",6)}.
    </div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="photo" style="height:210px"><img src="img/yakgwa.webp" alt=""></div>
      <div class="photo" style="height:210px"><img src="img/djembes.webp" alt=""></div>
      <button class="btn teal" style="justify-content:center" data-say='[["q_yakgwa",""],["s_cookie",""],["v_it_tasty",""],["q_djembes",""],["a_drums",""],["v_they_fun",""]]'>🔊 글 전체 듣기</button>
    </div>
  </div>`});

/* 159 B ❷ 우리 글 */
add({id:"l3", sec:4, page:"159", no:"B ❷", label:"Let’s Write", sub:"❶에서 고른 두 가지 설명하는 글 쓰기", tip:["159","B번 ❷","내가 고른 것으로 글쓰기"], html:()=>{
  const a=W.a||"tuho", at=W.at||"fun", b=W.b||"saris", bt=W.bt||"nice";
  const B2 = (t,n) => `<span class="blank" data-ans="${t}">${t}<sup>${n}</sup></span>`;
  const au=[[IT[a].q,""],[IT[a].s,""],["v_it_"+at,""],[IT[b].q,""],[IT[b].a,""],["v_they_"+bt,""]];
  return `<div style="font-size:24px;font-weight:700;color:var(--soft);margin-bottom:12px">${W.a?"❶에서 고른 것으로 만든 글이에요.":"❶에서 고르지 않으면 지도서 예시 답(Tuho·fun / saris·nice)이 나와요."} 빈칸을 눌러 하나씩 확인해요.</div>
  <div style="display:grid;grid-template-columns:1fr 330px;gap:30px;align-items:center">
    <div class="essay en" style="line-height:2.2">
      Do you know anything about ${B2(IT[a].en,1)}?<br>
      It’s ${B2(IT[a].ph,2)}. It’s very ${B2(at,3)}.<br>
      Do you know anything about ${B2(IT[b].en,4)}?<br>
      They are ${B2(IT[b].ph,5)}. They are very ${B2(bt,6)}.
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="photo" style="height:190px"><img src="${img(a)}" alt=""></div>
      <div class="photo" style="height:190px"><img src="${img(b)}" alt=""></div>
      <button class="btn gold" data-act="reveal" style="justify-content:center">✨ 정답 모두 보기</button>
      <button class="btn teal" style="justify-content:center" data-say='${JSON.stringify(au)}'>🔊 글 전체 듣기</button>
    </div>
  </div>`}});

/* 159 C */
add({id:"l4", sec:4, page:"159", no:"C", label:"Share It", sub:"완성한 글을 짝과 바꿔 읽기", tip:["159","C번","Share It"], html:()=>`
  <div style="display:grid;grid-template-columns:1fr 500px;gap:30px;height:100%">
    <div class="photo"><img src="img/share.webp" alt=""></div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="panel" style="font-size:26px;line-height:1.7;font-weight:600">
        ① 짝과 공책을 바꿔요.<br>② 짝이 쓴 글을 소리 내어 읽어요.<br>③ 잘한 점을 한 가지 말해 줘요. 👍
      </div>
      <div class="panel"><div class="timer" id="timer">3:00</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
          <button class="btn teal" data-act="tstart">▶ 시작</button><button class="btn ghost" data-act="treset">↺ 3분</button></div></div>
      <div class="panel" style="text-align:center"><div style="font-size:22px;font-weight:800;color:var(--soft);margin-bottom:6px">나 ☆ · 친구 ♡ 스스로 평가</div>
        <div class="stars" data-stars>${"<span>⭐</span>".repeat(3)}<span style="width:20px"></span>${"<span>💗</span>".repeat(3)}</div></div>
    </div>
  </div>`});

add({id:"end", sec:5, cover:true, html:()=>`
  <div class="cover"><img class="bg" src="img/cover.webp" alt=""><div class="shade"></div>
    <div class="ttl" style="top:250px"><div class="l">GREAT JOB!</div><h1>Well done, everyone! 🎉</h1><p>오늘 배운 표현: <span class="en">Do you know anything about ~? · Yes, I do. / No, I don’t.</span></p></div></div>`});

/* ---------- 화면 ---------- */
let cur = 0;
function render(dir){
  const s=S[cur];
  stopVoice();
  $("#slide").innerHTML = `<div class="fade-in" style="height:100%;position:relative">${s.html()}</div>`;
  $("#slide").style.padding = s.cover ? "0" : "";
  $("#slide").style.top = s.cover ? "0" : "74px";
  $("#slide").style.bottom = s.cover ? "0" : "70px";
  $("#hdr").innerHTML = s.cover ? "" : `<span class="badge">교과서 ${s.page}쪽</span><span class="qtitle" data-tipfor="${cur}"><span class="en">${s.no} · ${s.label}</span><small>${s.sub}</small></span>`;
  $("#prev").disabled = cur===0; $("#next").disabled = cur===S.length-1;
  $("#dots").innerHTML = S.map((x,i)=>`<i class="${i===cur?"on":""} ${i>0&&S[i-1].sec!==x.sec?"sec":""}" data-dot="${i}" title="${x.page?x.page+"쪽 "+x.no:""}"></i>`).join("");
  if(s.id==="a2" && $("#a2ans")) {}
  if(s.id==="end") { sfx("sfx_fanfare",.6); confetti(); }
  // 쓴 낱말 표시
  markUsed();
}
function go(i){ if(i<0||i>=S.length) return; cur=i; sfx("sfx_click",.5); render(); }
function goId(id){ const i=S.findIndex(s=>s.id===id); if(i>=0) go(i); }
function markUsed(){ document.querySelectorAll(".wordbox .w").forEach(w=>{ const used=[...document.querySelectorAll(".blank.open")].some(b=>b.dataset.ans===w.dataset.w); w.classList.toggle("used",used); }); }

/* 쪽수 크게 보기 */
function showTip(i){ const s=S[i]; if(!s||!s.tip) return; const [p,n,d]=s.tip;
  $("#tip").innerHTML=`<div class="t1">📖 교과서</div><div class="t2">${p}쪽</div><div class="t3">${n}</div><div class="t4 en">${d}</div>`; $("#tip").classList.add("show"); }
function hideTip(){ $("#tip").classList.remove("show"); }

/* 빈칸 열기 */
function openBlank(b, quiet){ if(b.classList.contains("open")) return; b.classList.add("open"); if(!quiet) sfx("sfx_correct",.5); markUsed(); }

/* 클릭 처리 */
document.addEventListener("click", e=>{
  const t=e.target.closest("button,[data-say],.blank,[data-cell],[data-dot],.stars span");
  if(!t) return;
  if(t.classList.contains("blank")){ openBlank(t); return; }
  if(t.dataset.dot!==undefined){ go(+t.dataset.dot); return; }
  if(t.dataset.go){ goId(t.dataset.go); return; }
  if(t.dataset.say){ seq(JSON.parse(t.dataset.say), t.classList.contains("say")?t:null); return; }
  if(t.dataset.choice!==undefined){
    if(t.dataset.choice==="1"){ t.classList.add("ok"); sfx("sfx_correct"); const b=$("#a2ans"); if(b){openBlank(b,true)} setTimeout(()=>seq([["b_yes","Yes, I do."],["s_drums","They’re African drums."]]),400); confetti(40); }
    else { t.classList.remove("no"); void t.offsetWidth; t.classList.add("no"); sfx("sfx_wrong"); }
    return;
  }
  if(t.dataset.cell!==undefined){ if(S[cur].id==="p2") openCell(+t.dataset.cell); return; }
  if(t.dataset.pick){ const k=t.dataset.pick; W[k]=W[k]===t.dataset.v?null:t.dataset.v; sfx("sfx_click",.6); const y=$("#slide").scrollTop; render(); return; }
  if(t.closest(".stars")){ const all=[...t.parentNode.querySelectorAll("span")].filter(x=>x.textContent); const i=all.indexOf(t); const grp=i<3?all.slice(0,3):all.slice(3); const gi=i<3?i:i-3; grp.forEach((x,j)=>x.classList.toggle("on",j<=gi)); sfx("sfx_sparkle",.5); return; }
  const act=t.dataset.act;
  if(act==="reveal"){ const bs=[...document.querySelectorAll("#slide .blank:not(.open)")]; bs.forEach((b,i)=>setTimeout(()=>openBlank(b,true),i*120)); if(bs.length) sfx("sfx_sparkle"); return; }
  if(act==="flick") return flick();
  if(act==="turn"){ G.turn=G.turn==="red"?"blue":"red"; sfx("sfx_click"); render(); return; }
  if(act==="greset"){ G.own.fill(null); G.turn="red"; sfx("sfx_sparkle"); render(); return; }
  if(act==="tstart") return timerToggle(t);
  if(act==="treset") return timerReset();
  if(act==="mclose"){ closeModal(); return; }
  if(act==="mans") return modalAnswer();
  if(act==="mwin"){ G.own[M.i]=G.turn; sfx("sfx_fanfare",.5); confetti(60); G.turn=G.turn==="red"?"blue":"red"; closeModal(); render(); checkEnd(); return; }
  if(act==="mlose"){ sfx("sfx_wrong"); G.turn=G.turn==="red"?"blue":"red"; closeModal(); render(); return; }
});
document.addEventListener("mouseover", e=>{ const q=e.target.closest(".qtitle"); if(q) showTip(+q.dataset.tipfor); });
document.addEventListener("mouseout", e=>{ const q=e.target.closest(".qtitle"); if(q && !q.contains(e.relatedTarget)) hideTip(); });
document.addEventListener("keydown", e=>{
  if($(".lock.show")) return;
  if(e.key==="ArrowRight"||e.key==="PageDown") go(cur+1);
  if(e.key==="ArrowLeft"||e.key==="PageUp") go(cur-1);
  if(e.key==="Escape") closeModal();
});

/* 땅따먹기 모달 */
const M={i:-1};
function openCell(i){
  const c=BOARD[i], it=IT[c.k];
  if(G.own[i]){ sfx("sfx_wrong",.4); return; }
  M.i=i; sfx("sfx_click");
  $("#modal").innerHTML=`<div class="box">
    <div class="photo"><img src="${img(c.k)}" alt=""></div>
    <div style="display:flex;flex-direction:column;gap:16px;justify-content:center">
      <div style="font-size:22px;font-weight:800;color:${G.turn==="red"?"var(--red)":"var(--blue)"}">${G.names[G.turn]} 차례 · 짝이 물어요</div>
      <div class="line" style="font-size:36px"><span class="who"><img src="img/girl.webp" alt=""></span><span class="en">Do you know anything about ${it.en}?</span>${SAY([[it.q,`Do you know anything about ${it.en}?`]])}</div>
      <div id="mans" style="min-height:120px"></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn gold" data-act="mans">💬 대답 보기 (${c.ox==="o"?"○":"✕"})</button>
        <button class="btn teal" data-act="mwin">🚩 성공! 우리 땅</button>
        <button class="btn ghost" data-act="mlose">다음 기회에</button>
        <button class="btn ghost" data-act="mclose">닫기</button>
      </div>
    </div></div>`;
  $("#modal").classList.add("show");
  setTimeout(()=>seq([[it.q,`Do you know anything about ${it.en}?`]]),250);
}
function modalAnswer(){
  const c=BOARD[M.i], it=IT[c.k];
  const yes = c.ox==="o";
  const lines = yes ? [["boy",`Yes, I do. ${sent(c.k)}`,[["b_yes","Yes, I do."],[it.s,sent(c.k)]]]]
                    : [["boy","No, I don’t.",[["b_no","No, I don’t."]]],["girl",sent(c.k),[[it.s,sent(c.k)]]]];
  $("#mans").innerHTML = lines.map(([w,t,au])=>`<div class="line fade-in" style="font-size:36px"><span class="who"><img src="img/${w}.webp" alt=""></span><span class="en">${t}</span>${SAY(au)}</div>`).join("");
  seq(lines.flatMap(l=>l[2]));
}
function closeModal(){ $("#modal").classList.remove("show"); stopVoice(); }
function checkEnd(){ if(G.own.every(Boolean)){ const r=G.own.filter(x=>x==="red").length, b=12-r; setTimeout(()=>{ sfx("sfx_fanfare"); confetti(150);
  $("#modal").innerHTML=`<div class="box" style="grid-template-columns:1fr;text-align:center"><div style="font-size:80px">🏆</div><div style="font-size:54px;font-weight:900">${r===b?"무승부! 모두 잘했어요":(r>b?G.names.red:G.names.blue)+" 승리!"}</div><div style="font-size:34px;margin:10px 0 20px">🚩 ${r} : ${b} 🏳️</div><div><button class="btn" data-act="mclose">닫기</button></div></div>`; $("#modal").classList.add("show"); },700);} }
function flick(){
  const free=G.own.map((o,i)=>o?null:i).filter(x=>x!==null); if(!free.length) return;
  const i=free[Math.floor(Math.random()*free.length)];
  const board=$("#board"), cell=board.querySelector(`[data-cell="${i}"]`);
  const st=$("#stage").getBoundingClientRect(), sc=st.width/1600, r=cell.getBoundingClientRect();
  const e=document.createElement("div"); e.className="eraser"; e.style.left="1000px"; e.style.top="800px"; e.style.transform="rotate(0deg)";
  $("#stage").appendChild(e); sfx("sfx_click");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ e.style.left=((r.left-st.left)/sc+(r.width/sc)/2-40)+"px"; e.style.top=((r.top-st.top)/sc+(r.height/sc)/2-25)+"px"; e.style.transform="rotate(720deg)"; }));
  setTimeout(()=>{ cell.classList.add("target"); sfx("sfx_sparkle"); },900);
  setTimeout(()=>{ e.remove(); openCell(i); },1900);
}

/* 타이머 */
const T={left:180,id:null};
function timerToggle(btn){ if(T.id){clearInterval(T.id);T.id=null;btn.textContent="▶ 계속";return} btn.textContent="⏸ 멈춤";
  T.id=setInterval(()=>{T.left--; const el=$("#timer"); if(el) el.textContent=`${Math.floor(T.left/60)}:${String(T.left%60).padStart(2,"0")}`; if(T.left<=0){clearInterval(T.id);T.id=null;sfx("sfx_fanfare");T.left=180;}},1000); }
function timerReset(){ clearInterval(T.id); T.id=null; T.left=180; render(); }

/* 색종이 */
function confetti(n=90){
  const c=$("#confetti"), x=c.getContext("2d"); c.width=1600; c.height=900;
  const cols=["#ef6a5b","#f6b44a","#2fa59a","#7a4fd0","#e0307a","#3a7be0"];
  const P=Array.from({length:n},()=>({x:800+(Math.random()-.5)*400,y:450,vx:(Math.random()-.5)*22,vy:-Math.random()*18-6,r:Math.random()*6+5,c:cols[Math.floor(Math.random()*6)],a:Math.random()*6}));
  let f=0; (function loop(){ x.clearRect(0,0,1600,900); P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.55;p.a+=.2;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r,-p.r/2,p.r*2,p.r);x.restore()}); if(++f<110) requestAnimationFrame(loop); else x.clearRect(0,0,1600,900); })();
}

/* 크기 맞추기 */
function fit(){ const s=Math.min(innerWidth/1600, innerHeight/900); $("#stage").style.transform=`scale(${s})`; }
addEventListener("resize", fit);

/* 상단 버튼 */
$("#prev").onclick=()=>go(cur-1); $("#next").onclick=()=>go(cur+1);
$("#homeBtn").onclick=()=>go(0);
$("#bgmBtn").onclick=toggleBgm;
$("#sndBtn").onclick=()=>{A.on=!A.on; $("#sndBtn").textContent=A.on?"🔔 효과음":"🔕 효과음"; if(!A.on) stopVoice();};
$("#fsBtn").onclick=()=>{ if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); else document.exitFullscreen(); };
if(STUDENT){
  $("#swBtn").textContent="🔒 교사용";
  $("#swBtn").onclick=()=>{ $("#lock").classList.add("show"); setTimeout(()=>$("#pw").focus(),50); };
  $("#pwOk").onclick=chk; $("#pw").addEventListener("keydown",e=>{if(e.key==="Enter")chk(); if(e.key==="Escape")$("#lock").classList.remove("show")});
  $("#pwNo").onclick=()=>$("#lock").classList.remove("show");
  function chk(){ if($("#pw").value==="0634") location.href="index.html"; else { $("#pw").value=""; $("#pw").placeholder="다시 입력"; sfx("sfx_wrong"); } }
} else {
  $("#swBtn").textContent="🧒 학생용 화면";
  $("#swBtn").onclick=()=>location.href="student.html";
}
fit(); render();
