// A quiet plucked-string phrase is synthesized locally, so the offline package
// needs no audio file and remains within the Mini Tool asset whitelist.
const music={audio:null,wanted:true,forMic:false,version:0,pending:false,timer:0,step:0,playing:false,unlocked:false,buffers:new Map()};
// A pentatonic phrase with space between phrases. No recording or media asset.
const MUSIC_NOTES=[[293.66,1.5],[369.99,.5],[440,1],[493.88,1],[440,2],[369.99,1],[329.63,1],[293.66,2],[0,1],[440,1],[587.33,1.5],[493.88,.5],[440,1],[369.99,2],[329.63,1],[293.66,3],[0,2],[369.99,1],[440,.5],[493.88,.5],[587.33,2],[659.25,1],[587.33,1],[493.88,2],[440,1],[369.99,1],[329.63,1],[293.66,3],[0,2]];
function syncMusicUI(){
 const b=$('musicToggle');if(!b)return;const enabled=music.wanted&&!music.forMic;
 b.innerHTML=icon(enabled?'sound':'mute');b.setAttribute('aria-pressed',String(enabled));
 b.setAttribute('aria-label',music.forMic?'音乐已暂停，麦克风使用中':enabled?'关闭音乐':'播放音乐');b.title=b.getAttribute('aria-label');
 $('musicNote').textContent=music.forMic?'麦克风开启时音乐暂停':music.playing?'音乐播放中':'';
}
function pluckMusicNote(frequency,when,volume,voice='guzheng'){
 const audio=music.audio;if(!audio)return;const key=frequency+':'+voice;let buffer=music.buffers.get(key);
 if(!buffer){
  const length=Math.round(audio.sampleRate*(voice==='pipa'?1.2:3)),delay=Math.round(audio.sampleRate/frequency),ring=new Float32Array(delay);
  let seed=(Math.round(frequency*100)^7719)>>>0;
  for(let i=0;i<delay;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;ring[i]=(seed/4294967296*2-1)*.7;}
  buffer=audio.createBuffer(1,length,audio.sampleRate);const data=buffer.getChannelData(0),damping=voice==='pipa'?.984:.997;
  for(let i=0;i<length;i++){const j=i%delay,value=ring[j];ring[j]=(value+ring[(j+1)%delay])*.5*damping;data[i]=value*Math.min(1,i/(audio.sampleRate*.004));}
  music.buffers.set(key,buffer);
 }
 const source=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(voice==='pipa'?3300:2300,when);
 gain.gain.setValueAtTime(volume,when);gain.gain.linearRampToValueAtTime(0,when+buffer.duration);source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(when);
}
function playMusicPhrase(){
 clearTimeout(music.timer);if(!music.wanted||music.forMic||document.hidden||!music.audio||music.audio.state!=='running'){music.playing=false;syncMusicUI();return;}
 const now=music.audio.currentTime+.025,[note,beats]=MUSIC_NOTES[music.step%MUSIC_NOTES.length];
 if(note){pluckMusicNote(note,now,.15,music.step%3===1?'pipa':'guzheng');if(music.step%5===0)pluckMusicNote(146.83,now+.06,.09);if(beats===.5)pluckMusicNote(note*1.005,now+.07,.035,'pipa');}
 music.step++;music.playing=true;syncMusicUI();music.timer=setTimeout(playMusicPhrase,beats*620);
}
async function playMusic(){
 if(!music.unlocked||!music.wanted||music.forMic||document.hidden||music.pending)return;
 const version=++music.version;music.pending=true;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){$('musicNote').textContent='此环境暂不支持背景声';return;}
  if(!music.audio)music.audio=new Audio();await music.audio.resume();
  if(version!==music.version||!music.wanted||music.forMic||document.hidden){music.audio.suspend();return;}
  playMusicPhrase();
 }catch{/* Autoplay is policy-controlled. Keep the user's intended state. */}
 finally{music.pending=false;syncMusicUI();}
}
function pauseMusicForMic(){music.forMic=true;music.version++;clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();syncMusicUI();}
function resumeMusicAfterMic(){if(!music.forMic)return;music.forMic=false;if(music.wanted&&!document.hidden)playMusic();else syncMusicUI();}
$('musicToggle').onclick=()=>{music.unlocked=true;music.wanted=!music.wanted;music.version++;if(!music.wanted){clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();}else playMusic();syncMusicUI();};
function resumeDefaultMusic(e){music.unlocked=true;if(e?.target?.closest?.('#musicToggle'))return;if(music.wanted&&!music.forMic&&(!music.audio||music.audio.state!=='running'))playMusic();}
for(const type of ['pointerdown','keydown'])document.addEventListener(type,resumeDefaultMusic,{passive:true});
$('musicCredit').onclick=()=>openModal('设置说明',`<div class="about-text"><h3>背景音乐</h3><p>本机合成的古筝、琵琶风格纯音乐，以五声音阶与拨弦音色陪伴创作，不读取或上传音频文件。音乐默认开启，可用页面顶部的声音按钮关闭。浏览器限制自动播放时，会在第一次操作后开始。</p><h3>吹气与作品</h3><p>麦克风只在点击「吹气」后申请。声音在本机换算为风力，不录音、不上传；收音期间背景声暂停。照片与作品也只在当前浏览器处理和保存。</p></div>`);
document.addEventListener('visibilitychange',()=>{if(document.hidden){music.version++;clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();syncMusicUI();}else if(music.wanted)playMusic();});
window.addEventListener('pagehide',()=>{music.version++;clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();});
window.addEventListener('pageshow',()=>{if(music.wanted)playMusic();});
syncMusicUI();
setTimeout(()=>playMusic(),0);

// Breath is approximated by local audio energy. No recorder, network request, or saved audio.
const mic={state:'off',stream:null,context:null,source:null,analyser:null,buffer:null,token:0,timer:0,calibration:0,floor:0,frames:0};
function stopMic(state='off'){
  mic.token++;clearTimeout(mic.timer);mic.timer=0;
  if(mic.stream)mic.stream.getTracks().forEach(track=>track.stop());
  if(mic.source){try{mic.source.disconnect();}catch{}}
  if(mic.context){try{const close=mic.context.close();if(close&&close.catch)close.catch(()=>{});}catch{}}
  mic.stream=mic.context=mic.source=mic.analyser=mic.buffer=null;mic.state=state;resumeMusicAfterMic();
  const b=$('micBtn');if(b){b.disabled=false;b.classList.remove('listening');b.setAttribute('aria-pressed','false');b.textContent='吹气';}
}
async function toggleMic(){
  if(screen!=='ritual'||r.phase!=='drying')return;
  if(mic.state==='listening'||mic.state==='requesting'){stopMic();$('micStatus').textContent='';return;}
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){mic.state='unavailable';$('micStatus').textContent='可用扇风';toast('当前环境无法开启麦克风，可用扇风。');return;}
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){mic.state='unavailable';$('micStatus').textContent='可用扇风';return;}
  pauseMusicForMic();const token=++mic.token;mic.state='requesting';$('micBtn').textContent='取消';$('micStatus').textContent='等待许可';
  try{
    mic.context=new Audio();await mic.context.resume();
    if(token!==mic.token||r.phase!=='drying')return;
    mic.timer=setTimeout(()=>{if(token!==mic.token)return;stopMic('unavailable');$('micStatus').textContent='可用扇风';},15000);
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(token!==mic.token||r.phase!=='drying'||screen!=='ritual'||document.hidden){stream.getTracks().forEach(t=>t.stop());return;}
    clearTimeout(mic.timer);mic.timer=0;mic.stream=stream;
    mic.source=mic.context.createMediaStreamSource(stream);mic.analyser=mic.context.createAnalyser();mic.analyser.fftSize=1024;mic.analyser.smoothingTimeConstant=.65;mic.buffer=new Float32Array(mic.analyser.fftSize);mic.source.connect(mic.analyser);
    // Deliberately never connect to the speakers; prevent feedback.
    mic.calibration=performance.now()+700;mic.floor=0;mic.frames=0;mic.state='listening';
    $('micBtn').classList.add('listening');$('micBtn').setAttribute('aria-pressed','true');$('micBtn').textContent='停止吹气';$('micStatus').textContent='校准中';
    stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(mic.stream===stream){stopMic('unavailable');$('micStatus').textContent='已断开';}}));
  }catch(err){if(token!==mic.token)return;stopMic(err.name==='NotAllowedError'?'denied':'unavailable');$('micStatus').textContent='可用扇风';}
}
$('micBtn').onclick=toggleMic;
$('micBtn').setAttribute('aria-pressed','false');
function readWind(now){
  if(mic.state!=='listening'||!mic.analyser)return 0;
  try{mic.analyser.getFloatTimeDomainData(mic.buffer);}catch{stopMic('unavailable');$('micStatus').textContent='已暂停';return 0;}
  let energy=0;for(let i=0;i<mic.buffer.length;i++)energy+=mic.buffer[i]*mic.buffer[i];const rms=Math.sqrt(energy/mic.buffer.length);
  if(now<mic.calibration){mic.floor+=rms;mic.frames++;return 0;}
  const noiseFloor=mic.floor/Math.max(1,mic.frames),level=clamp((rms-Math.min(.018,noiseFloor)*1.4-.003)/.07);
  const label=level>.65?'风起':level>.1?'有风':'听风中';if($('micStatus').textContent!==label)$('micStatus').textContent=label;return level;
}
function beginDrying(){if(r.phase!=='washing'||r.wash<1||!resistRemovalComplete()||screen!=='ritual')return;r.dry=0;r.ox=0;r.wind=0;stopFan();phase('drying');$('micStatus').textContent='';soundPlay('cloth');}
function updateDrying(dt,now){
 if(r.phase!=='drying'||r.wash<1||!resistRemovalComplete())return;
 const signal=readWind(now),manual=now<r.fanUntil?.72:0,target=Math.max(signal,manual);
 // Stronger audio raises the wave amplitude continuously, then the breeze
 // relaxes smoothly after a breath instead of jumping between wind presets.
 r.wind=lerp(r.wind,target,1-Math.exp(-dt*(target>r.wind?6:2.8)));
 r.ox=clamp(r.ox+dt/14*(1+.7*r.wind));r.dry=clamp(r.dry+dt/32*(1+3*r.wind));
 updateDryUI();if(r.dry>=1&&r.ox>=1)finishRitual();
}
function updateDryUI(){
 if(r.phase==='drying'){
  const button=$('fanBtn'),active=performance.now()<r.fanUntil,label=active?'停止扇风':'扇风',pressed=String(active);
  if(button.textContent!==label)button.textContent=label;
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
 }
 const percent=Math.floor(Math.min(r.dry,r.ox)*100)+'%',reading=$('dryPercent'),progress=$('ritualProgress');
 if(reading.textContent!==percent)reading.textContent=percent;
 if(progress.style.width!==percent)progress.style.width=percent;
 const wind=String(Math.round(r.wind*1000)/1000),tools=$('dryTools');
 if(tools.style.getPropertyValue('--wind')!==wind)tools.style.setProperty('--wind',wind);
 const lit=Math.round(r.wind*12);document.querySelectorAll('.wind-meter i').forEach((bar,i)=>{const active=i<lit;if(bar.classList.contains('lit')!==active)bar.classList.toggle('lit',active);});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();stopFan();if(typeof r!=='undefined'&&r.phase==='drying')$('micStatus').textContent='已暂停';}});
window.addEventListener('pagehide',()=>{stopMic();stopFan();});
window.addEventListener('beforeunload',()=>{stopMic();stopFan();});
