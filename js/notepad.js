// ══════ LOGOUT ══════
// ══════ NOTEPAD ══════
let notepadOpen=false;
function toggleNotepad(){
  notepadOpen=!notepadOpen;
  document.getElementById('notepadPanel').classList.toggle('open',notepadOpen);
  if(notepadOpen){
    playTileClick();
    // Load saved notes
    const saved=localStorage.getItem('dd_notes')||'';
    document.getElementById('notepadText').value=saved;
    updateNoteCount();
    updateNoteDot();
    setTimeout(()=>document.getElementById('notepadText').focus(),350);
  }
}
function onNoteInput(){
  const text=document.getElementById('notepadText').value;
  localStorage.setItem('dd_notes',text);
  updateNoteCount();
  updateNoteDot();
}
function updateNoteCount(){
  const len=document.getElementById('notepadText').value.length;
  document.getElementById('notepadCount').textContent=len+' character'+(len!==1?'s':'');
}
function updateNoteDot(){
  const has=document.getElementById('notepadText').value.trim().length>0;
  document.getElementById('notepadDot').classList.toggle('has-notes',has);
}
function clearNotes(){
  if(!confirm('Clear all notes? This cannot be undone.'))return;
  document.getElementById('notepadText').value='';
  localStorage.removeItem('dd_notes');
  updateNoteCount();
  updateNoteDot();
}
// Load dot state on init
document.addEventListener('DOMContentLoaded',()=>{
  if(localStorage.getItem('dd_notes'))document.getElementById('notepadDot').classList.add('has-notes');
  restoreConsoleBg();
  try{_installInteractionDelegates();}catch(e){}
});

function showLogout(){
  playConfirmPrompt();
  const box=document.getElementById('logoutBoxContent');
  if(isAdmin){
    box.innerHTML=`<h3>⚠ Confirm Logout</h3><p>You will be logged out of the admin console. Continue?</p><div style="display:flex;gap:12px;justify-content:center"><button class="btn-standard btn-ghost" onclick="hideLogout()">Cancel</button><button class="btn-standard btn-red" onclick="doLogout()">Logout</button></div>`;
  }else{
    const mode=regSettings.participantMode;
    const idLabel=mode==='individual'?'your ID':'your Team ID';
    const idValue=currentVaultTeam?currentVaultTeam.id:'';
    box.innerHTML=`<h3>⚠ Confirm Logout</h3><p>You'll need ${idLabel} to re-enter. Make sure you have it saved.</p>${idValue?`<div style="text-align:center;margin:12px 0;padding:10px;background:rgba(0,255,136,.04);border:1px solid rgba(0,255,136,.12);border-radius:4px"><div style="font-family:Saira,sans-serif;font-size:8px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">${idLabel}</div><div style="font-family:Oxanium,sans-serif;font-size:18px;font-weight:700;color:var(--green);letter-spacing:3px">${idValue}</div></div>`:''}<div style="display:flex;gap:12px;justify-content:center"><button class="btn-standard btn-ghost" onclick="hideLogout()">Cancel</button><button class="btn-standard btn-red" onclick="doLogout()">Logout</button></div>`;
  }
  document.getElementById('logoutModal').classList.add('active');
}
function hideLogout(){document.getElementById('logoutModal').classList.remove('active')}
function doLogout(){
  hideLogout();
  // Clear session but preserve team-specific game state (isSubmitted, vault, drafts)
  try{localStorage.removeItem('cb_session');sessionStorage.removeItem('cb_session')}catch(e){}
  notepadOpen=false;document.getElementById('notepadPanel').classList.remove('open');
  document.getElementById('notepadTrigger').classList.remove('visible');
  if(elapsedInterval){clearInterval(elapsedInterval);elapsedInterval=null}
  elapsedSec=0;currentVaultTeam=null;
  isSubmitted=false;
  vkFailCount=0;vkTotalFails=0;vkRateLimited=false;vkCode='';
  _vaultLockoutEnd=null;_sessionStartTime=null;
  // Stop broadcast polling
  if(_broadcastPollInterval){clearInterval(_broadcastPollInterval);_broadcastPollInterval=null}
  // Clear admin state on logout
  if(isAdmin){isAdmin=false;document.body.classList.remove('admin-mode');closeAdminDropdown()}
  showScreen('landingScreen');
}

let audioCtx;
function getAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx}
// #7 Soft Beep Tap — vault keypad presses
function playClick(){
  const c=getAudio(),t=c.currentTime;
  const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=1400;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06,t+.008);
  g.gain.exponentialRampToValueAtTime(.001,t+.08);
  o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.08);
}
// #8 Snap Click — grid tile clicks
function playTileClick(){
  const c=getAudio(),t=c.currentTime;
  const o=c.createOscillator(),g=c.createGain();o.type='sawtooth';o.frequency.value=3000;
  o.frequency.exponentialRampToValueAtTime(500,t+.02);
  g.gain.setValueAtTime(.1,t);g.gain.exponentialRampToValueAtTime(.001,t+.03);
  o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.04);
}
// #36 Radar Blip — incoming updates / notifications
function playAlert(){
  const c=getAudio(),t=c.currentTime;
  const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=2600;
  o.frequency.exponentialRampToValueAtTime(2200,t+.08);
  g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);
  o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.25);
}
// #20 Hydraulic Slide — confirm prompts (submit intel, logout)
function playConfirmPrompt(){
  const c=getAudio(),t=c.currentTime;
  const buf=c.createBuffer(1,c.sampleRate*.25,c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
  const s=c.createBufferSource(),hp=c.createBiquadFilter(),ng=c.createGain();
  s.buffer=buf;hp.type='highpass';hp.frequency.value=3000;
  ng.gain.setValueAtTime(.12,t);ng.gain.exponentialRampToValueAtTime(.001,t+.25);
  s.connect(hp);hp.connect(ng);ng.connect(c.destination);s.start(t);
  setTimeout(()=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=80;
  g.gain.setValueAtTime(.15,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.2);
  o.connect(g);g.connect(c.destination);o.start(c.currentTime);o.stop(c.currentTime+.2)},150);
}
function playSuccess(){
  const c=getAudio(),now=c.currentTime;
  // Sub thud - felt more than heard
  const sub=c.createOscillator(),sg=c.createGain();
  sub.connect(sg);sg.connect(c.destination);sub.type='sine';
  sub.frequency.setValueAtTime(60,now);
  sg.gain.setValueAtTime(.15,now);sg.gain.exponentialRampToValueAtTime(.001,now+.3);
  sub.start(now);sub.stop(now+.3);
  // 3-tone ascending chord: C5 E5 G5
  [523,659,784].forEach((f,i)=>{
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.type='sine';
    const t=now+i*.09;
    o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.07,t+.015);
    g.gain.setValueAtTime(.07,t+.15);g.gain.exponentialRampToValueAtTime(.001,t+.5);
    o.start(t);o.stop(t+.5);
  });
  // High shimmer - breathy top end
  const buf=c.createBuffer(1,c.sampleRate*.4,c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){const t=i/d.length;d[i]=(Math.random()*2-1)*.02*Math.pow(1-t,2)}
  const sh=c.createBufferSource();sh.buffer=buf;
  const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=6000;
  const shg=c.createGain();shg.gain.setValueAtTime(.3,now);shg.gain.exponentialRampToValueAtTime(.001,now+.4);
  sh.connect(hp);hp.connect(shg);shg.connect(c.destination);sh.start(now+.05);
  // Final confirmation ping
  const ping=c.createOscillator(),pg=c.createGain();
  ping.connect(pg);pg.connect(c.destination);ping.type='sine';
  ping.frequency.setValueAtTime(1047,now+.3);
  pg.gain.setValueAtTime(0,now+.3);pg.gain.linearRampToValueAtTime(.06,now+.31);
  pg.gain.exponentialRampToValueAtTime(.001,now+.8);
  ping.start(now+.3);ping.stop(now+.8);
}
function playDenied(){const c=getAudio();[0,.15].forEach(off=>{const t=c.currentTime+off,buf=c.createBuffer(1,c.sampleRate*.1,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++){const s=i/c.sampleRate;d[i]=((Math.sin(s*100*Math.PI*2)>0?1:-1)*.12+(Math.random()*2-1)*.04)*(1-i/d.length)}const src=c.createBufferSource();src.buffer=buf;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=400;const g=c.createGain();g.gain.setValueAtTime(.5,t);src.connect(lp);lp.connect(g);g.connect(c.destination);src.start(t)})}
function playVaultUnlock(){
  const c=getAudio(),now=c.currentTime;
  // Deep mechanical "clunk" — bolt unlocking
  const clunk=c.createBuffer(1,c.sampleRate*.15,c.sampleRate),cd=clunk.getChannelData(0);
  for(let i=0;i<cd.length;i++){const t=i/cd.length;cd[i]=(Math.random()*2-1)*.6*Math.pow(1-t,3)*Math.sin(t*80)}
  const cs=c.createBufferSource();cs.buffer=clunk;
  const cf=c.createBiquadFilter();cf.type='lowpass';cf.frequency.value=300;
  const cg=c.createGain();cg.gain.setValueAtTime(.6,now);
  cs.connect(cf);cf.connect(cg);cg.connect(c.destination);cs.start(now);
  // Rising shimmer — vault opening
  const riseLen=c.sampleRate*.6,rise=c.createBuffer(1,riseLen,c.sampleRate),rd=rise.getChannelData(0);
  for(let i=0;i<riseLen;i++){const t=i/riseLen;rd[i]=(Math.sin(t*t*4000)+Math.sin(t*t*6000)*.5)*.03*Math.sin(t*Math.PI)}
  const rs=c.createBufferSource();rs.buffer=rise;
  const rg=c.createGain();rg.gain.setValueAtTime(.4,now+.1);
  rs.connect(rg);rg.connect(c.destination);rs.start(now+.1);
  // Satisfying chord: C4 E4 G4 C5 — major resolved
  [262,330,392,523].forEach((f,i)=>{
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.type='sine';
    const t=now+.15+i*.06;
    o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06,t+.02);
    g.gain.setValueAtTime(.06,t+.3);g.gain.exponentialRampToValueAtTime(.001,t+.8);
    o.start(t);o.stop(t+.8);
  });
  // High sparkle at the end
  const sp=c.createOscillator(),sg=c.createGain();
  sp.connect(sg);sg.connect(c.destination);sp.type='sine';
  sp.frequency.setValueAtTime(1568,now+.5);sp.frequency.exponentialRampToValueAtTime(2093,now+.7);
  sg.gain.setValueAtTime(0,now+.5);sg.gain.linearRampToValueAtTime(.04,now+.52);
  sg.gain.exponentialRampToValueAtTime(.001,now+1);
  sp.start(now+.5);sp.stop(now+1);
}
function playPanelOpen(){
  // Soft tactile thud + subtle hi freq air
  const c=getAudio();
  const buf=c.createBuffer(1,c.sampleRate*.04,c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){const t=i/d.length;d[i]=(Math.random()*2-1)*.15*Math.pow(1-t,3)}
  const s=c.createBufferSource();s.buffer=buf;
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=800;
  const g=c.createGain();g.gain.setValueAtTime(.5,c.currentTime);
  s.connect(lp);lp.connect(g);g.connect(c.destination);s.start(c.currentTime);
  // Tiny high click
  const o=c.createOscillator(),g2=c.createGain();
  o.connect(g2);g2.connect(c.destination);o.type='sine';
  o.frequency.setValueAtTime(2400,c.currentTime);
  g2.gain.setValueAtTime(.03,c.currentTime);g2.gain.exponentialRampToValueAtTime(.001,c.currentTime+.03);
  o.start(c.currentTime);o.stop(c.currentTime+.03);
}

