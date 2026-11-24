/* Mozart K.525 theme, original acoustic-guitar rendering and accompaniment. Physically modelled plucked strings,
warm wooden body resonances, stereo room, and a continuous audio-clock loop. */
window.RobotAudio=(()=>{
let ac,master,music,fx,wet,timer,next=0,step=0,on=false,volume=.30,duck=1;const cache=new Map();
// Mozart K.525, movement I: opening theme, octave-lowered for guitar.
const mozart=[
[67,-1,0,62,67,-1,0,62],[67,62,67,71,74,-1,0,0],
[72,-1,0,69,72,-1,0,69],[72,69,66,69,62,-1,0,0],
[67,0,67,-1,-1,71,69,67],[67,66,66,-1,-1,69,72,66],
[69,67,67,-1,-1,71,69,67],[67,66,66,-1,-1,69,72,66],
[67,67,66,66,67,67,69,69],[71,71,72,72,74,-1,0,0],
[62,-1,-1,-1,64,-1,-1,-1],[60,-1,60,-1,59,-1,59,-1],
[57,-1,57,-1,55,54,52,54],[55,0,57,0,59,0,0,0],
[69,71,72,69,71,69,66,62],[67,-1,-1,-1,0,0,0,0]
].flat();
const G=[43,50,55,59],D=[50,57,60,66],C=[48,55,60,64];
const mozartHarmony=[G,G,D,D,G,D,G,D,G,G,G,C,D,G,D,G];
const F=[41,48,53,57],CG=[48,55,60,64],GG=[43,50,59,62];
const joy=[
[64,-1,64,-1,65,-1,67,-1],[67,-1,65,-1,64,-1,62,-1],
[60,-1,60,-1,62,-1,64,-1],[64,-1,-1,62,62,-1,-1,-1],
[64,-1,64,-1,65,-1,67,-1],[67,-1,65,-1,64,-1,62,-1],
[60,-1,60,-1,62,-1,64,-1],[62,-1,-1,60,60,-1,-1,-1]
].flat();
const cancan=[
[67,-1,72,-1,71,69,67,65],[64,-1,64,-1,64,65,67,69],
[67,-1,72,-1,71,69,67,65],[64,-1,60,-1,60,-1,0,0],
[69,-1,74,-1,72,71,69,67],[65,-1,65,-1,65,67,69,71],
[72,71,72,71,72,71,72,71],[72,-1,-1,-1,0,0,0,0]
].flat();
const sections=[
{notes:mozart,chords:mozartHarmony,bpm:120},
{notes:joy.concat(joy),chords:[CG,CG,CG,GG,CG,CG,GG,CG,CG,CG,CG,GG,CG,CG,GG,CG],bpm:126},
{notes:cancan.concat(cancan),chords:[CG,CG,GG,CG,F,F,GG,CG,CG,CG,GG,CG,F,F,GG,CG],bpm:138},
{notes:[64,67,72,67,62,66,69,74],chords:[D],bpm:124}
];let section=0;
function init(){if(ac)return;ac=new(window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=0;const limiter=ac.createDynamicsCompressor();limiter.threshold.value=-14;limiter.ratio.value=5;master.connect(limiter);limiter.connect(ac.destination);music=ac.createGain();music.gain.value=volume;music.connect(master);fx=ac.createGain();fx.gain.value=.65;fx.connect(master);wet=ac.createConvolver();const impulse=ac.createBuffer(2,ac.sampleRate*1.5,ac.sampleRate);let seed=881;for(let c=0;c<2;c++){const d=impulse.getChannelData(c);for(let i=0;i<d.length;i++){seed=(seed*1664525+1013904223)>>>0;d[i]=(seed/2147483648-1)*Math.pow(1-i/d.length,3)*.22;}}wet.buffer=impulse;const reverb=ac.createGain();reverb.gain.value=.16;wet.connect(reverb);reverb.connect(master);timer=setInterval(schedule,60);document.addEventListener('visibilitychange',()=>{if(document.hidden){ac.suspend()}else if(on){ac.resume();next=ac.currentTime+.1}});}
function guitar(note){if(cache.has(note))return cache.get(note);const rate=ac.sampleRate,f=440*Math.pow(2,(note-69)/12),period=Math.round(rate/f),n=Math.floor(rate*3.8),buf=ac.createBuffer(1,n,rate),out=buf.getChannelData(0),ring=new Float32Array(period);let seed=note*7727;for(let i=0;i<period;i++){seed=(seed*1664525+1013904223)>>>0;ring[i]=(seed/2147483648-1)*.75}let prev=0;for(let i=0;i<n;i++){const p=i%period,a=ring[p],b=ring[(p+1)%period];ring[p]=(a+b)*.497;prev=prev*.27+a*.73;const t=i/rate;out[i]=(prev*.72+Math.sin(2*Math.PI*f*t)*Math.exp(-t*2.5)*.11)*Math.min(1,i/90)*Math.min(1,(n-i)/500);}cache.set(note,buf);return buf;}
function pluck(note,time,gain=.22,pan=0,bus=music,duration=3.8){const source=ac.createBufferSource(),g=ac.createGain(),p=ac.createStereoPanner();source.buffer=guitar(note);g.gain.setValueAtTime(gain,time);g.gain.setValueAtTime(gain,time+Math.max(.01,duration-.04));g.gain.linearRampToValueAtTime(0,time+duration);p.pan.value=pan;source.connect(g);g.connect(p);p.connect(bus);if(bus===music)p.connect(wet);source.start(time);source.stop(time+duration+.02);source.onended=()=>{source.disconnect();g.disconnect();p.disconnect()};}
function schedule(){if(!ac||!on||ac.state!=='running')return;if(next<ac.currentTime-.1)next=ac.currentTime+.08;while(next<ac.currentTime+.3){const part=sections[section],interval=60/part.bpm/2,bar=Math.floor(step/8),k=step%8,chord=part.chords[bar],note=part.notes[step];if(note>0){let length=1;while(step+length<part.notes.length&&part.notes[step+length]===-1)length++;pluck(note,next,.34,.12,music,length*interval*.87);}if(k%2===0)pluck(chord[k===0?0:1+k/2%3],next,.11,-.3,music,interval*1.7);if(k===2||k===6){[1,2,3].forEach((n,i)=>pluck(chord[n],next+i*.016,.048,-.15,music,interval*1.3));}next+=interval;step++;if(step===part.notes.length){step=0;section=(section+1)%sections.length;}}}

function enable(value){init();on=value;if(on){ac.resume();next=ac.currentTime+.06;}master.gain.cancelScheduledValues(ac.currentTime);master.gain.setTargetAtTime(on?.8:0,ac.currentTime,.09);}
function musicVolume(value){volume=value;if(music)music.gain.setTargetAtTime(volume*duck,ac.currentTime,.3)}
function lower(value){const d=value?.4:1;if(d!==duck){duck=d;musicVolume(volume)}}
function glide(from,to,d=.18,gain=.13,type='sine',delay=0){if(!on||!ac)return;const t=ac.currentTime+delay,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+d);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(fx);o.start(t);o.stop(t+d+.02);o.onended=()=>{o.disconnect();g.disconnect()};}
function sfx(kind,strength=1){if(!on||!ac)return;switch(kind){case'star':[79,84,88,91].forEach((n,i)=>pluck(n,ac.currentTime+i*.06,.23,0,fx));break;case'triple':glide(500,1400,.24,.12,'triangle');break;case'spring':glide(90,1100,.32,.16,'triangle');glide(600,300,.2,.06,'sine',.12);break;case'jump':glide(150,530,.17,.12,'triangle');glide(85,55,.065,.13);break;case'double':glide(270,920,.19,.12,'triangle');glide(700,1200,.12,.055,'sine',.06);break;case'land':glide(130,48,.085,.13*strength);glide(480,270,.065,.035*strength,'triangle');break;case'box':[72,76,79].forEach((n,i)=>pluck(n,ac.currentTime+i*.09,.24,0,fx));break;case'correct':[72,76,79,84].forEach((n,i)=>pluck(n,ac.currentTime+i*.11,.28,0,fx));break;case'wrong':glide(330,240,.18,.08,'triangle');glide(245,190,.22,.07,'sine',.13);break;case'fall':glide(480,110,.42,.09,'triangle');break;case'click':pluck(79,ac.currentTime,.16,0,fx);break;case'finish':[60,64,67,72,76,79,84].forEach((n,i)=>pluck(n,ac.currentTime+i*.13,.28,0,fx));break;}}
/* 팡파레: 소리 켜기와 상관없이 울리는 금관 느낌 팡파레 */
let fan;
function fanfare(){try{fan=fan||new(window.AudioContext||window.webkitAudioContext)();fan.resume();const out=fan.createGain();out.gain.value=.5;const comp=fan.createDynamicsCompressor();out.connect(comp);comp.connect(fan.destination);
const hz=m=>440*Math.pow(2,(m-69)/12);
const horn=(m,t,d,v=.2)=>{const st=fan.currentTime+t;[[1,'sawtooth',v],[1.005,'square',v*.35],[2,'sine',v*.25]].forEach(([mul,type,g])=>{const o=fan.createOscillator(),gn=fan.createGain(),lp=fan.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(hz(m)*mul,st);lp.type='lowpass';lp.frequency.setValueAtTime(900,st);lp.frequency.linearRampToValueAtTime(2600,st+.08);gn.gain.setValueAtTime(.0001,st);gn.gain.linearRampToValueAtTime(g,st+.03);gn.gain.setValueAtTime(g*.85,st+Math.max(.05,d-.08));gn.gain.exponentialRampToValueAtTime(.0001,st+d);o.connect(lp);lp.connect(gn);gn.connect(out);o.start(st);o.stop(st+d+.05)})};
const drum=(t)=>{const st=fan.currentTime+t,o=fan.createOscillator(),g=fan.createGain();o.frequency.setValueAtTime(120,st);o.frequency.exponentialRampToValueAtTime(50,st+.25);g.gain.setValueAtTime(.5,st);g.gain.exponentialRampToValueAtTime(.001,st+.3);o.connect(g);g.connect(out);o.start(st);o.stop(st+.32)};
// 빰-빰-빰 빠아~ 빰빠밤!
[[67,0,.16],[67,.18,.16],[67,.36,.16],[72,.56,.6],[69,.0+1.2,.14],[71,1.36,.14],[72,1.52,1.2]].forEach(([m,t,d])=>horn(m,t,d));
[[60,.56,.6],[64,.56,.6],[64,1.52,1.2],[67,1.52,1.2],[48,1.52,1.2]].forEach(([m,t,d])=>horn(m,t,d,.12));
[0,.18,.36,.56,1.2,1.36,1.52].forEach(drum);
[84,88,91,96].forEach((m,i)=>{const st=fan.currentTime+1.6+i*.09,o=fan.createOscillator(),g=fan.createGain();o.type='triangle';o.frequency.value=hz(m);g.gain.setValueAtTime(.08,st);g.gain.exponentialRampToValueAtTime(.001,st+.6);o.connect(g);g.connect(out);o.start(st);o.stop(st+.65)});
}catch(e){}}
return{enable,musicVolume,lower,sfx,fanfare};
})();
