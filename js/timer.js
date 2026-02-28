// ══════ TIMER ══════
let timerSec=0,timerPaused=true,timerOriginal=0,timerStarted=false;
let timerMode='none'; // 'countdown' or 'event'
let _eventCfgHydrated=false;
let eventSettings={
  startTime:null, // ISO string
  endTime:null,   // ISO string
  autoLock:true,
  showLeaderboardOnExpiry:true,
  expired:false
};

function onTimerModeChange(){
  timerMode=document.getElementById('timerMode').value;
  // Stop schedule interval when leaving Event Schedule
  if(timerMode!=='event' && _globalTimerInterval){clearInterval(_globalTimerInterval);_globalTimerInterval=null;}
  document.getElementById('timerCountdownControls').style.display=timerMode==='countdown'?'':'none';
  document.getElementById('timerEventControls').style.display=timerMode==='event'?'':'none';
  if(timerMode==='event')updateEventStatus();
  if(timerMode==='countdown'){
    if(!window.__applyingCfg){ timerPaused=true; timerStarted=false; }
    const pb=document.getElementById('pauseBtn');
    if(pb){
      pb.textContent = (!timerStarted) ? '▶ START' : (timerPaused ? '▶ RESUME' : '⏸ PAUSE');
    }
    const ct=document.getElementById('cTimer');
    if(ct)ct.classList.toggle('paused', !timerStarted || timerPaused);
    renderTimerLabel('Manual Countdown');
    renderTimer();
    updateAdminTimerDisplay();
    if(!window.__applyingCfg) saveEventConfigToBackend();
  }
  if(timerMode==='event'){
    if(!window.__applyingCfg) eventSettings.expired=false;
    // Reflect current config in inputs
    try{
      const si=document.getElementById('eventStartInput');
      const ei=document.getElementById('eventEndInput');
      const toLocal=(iso)=>{ if(!iso) return ''; const d=new Date(iso); const pad=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes()); };
      if(si) si.value = toLocal(eventSettings.startTime);
      if(ei) ei.value = toLocal(eventSettings.endTime);
    }catch(e){}
    startGlobalEventTimer(true);
    updateAdminTimerDisplay();
    if(!window.__applyingCfg) saveEventConfigToBackend();
  }
  // No timer mode — show infinity symbol, stop any running timer updates
  if(timerMode==='none'){
    var timerBlock=document.querySelector('.timer-block');
    if(timerBlock)timerBlock.style.display='';
    if(_globalTimerInterval){clearInterval(_globalTimerInterval);_globalTimerInterval=null}
    timerPaused=true;
    var el=document.getElementById('cTimer');
    if(el){el.textContent='∞';el.classList.add('is-infinity');}
    renderTimerLabel('No Timer');
    var ap=document.getElementById('apTimerDisplay');
    if(ap)ap.textContent='∞';
    saveEventConfigToBackend();
  }else{
    var timerBlock2=document.querySelector('.timer-block');
    if(timerBlock2)timerBlock2.style.display='';
  }
}

function updateAdminTimerDisplay(){
  const ap=document.getElementById('apTimerDisplay');
  if(!ap)return;
  if(timerMode==='none'){
    ap.textContent='∞';
    return;
  }
  if(timerMode==='event'){
    const s=eventSettings.startTime?new Date(eventSettings.startTime):null;
    const e=eventSettings.endTime?new Date(eventSettings.endTime):null;
    const fmt=(d)=> d ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—';
    ap.textContent = (s||e) ? (fmt(s)+(e?('–'+fmt(e)):'') ) : '—';
    return;
  }
  // manual countdown
  const h=Math.floor(timerSec/3600),m=Math.floor((timerSec%3600)/60),s=timerSec%60;
  ap.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function onEventTimeChange(){
  const startVal=document.getElementById('eventStartInput').value;
  const endVal=document.getElementById('eventEndInput').value;
  eventSettings.startTime=startVal?new Date(startVal).toISOString():null;
  eventSettings.endTime=endVal?new Date(endVal).toISOString():null;
  eventSettings.expired=false;
  updateEventStatus();
  startGlobalEventTimer(true);
  updateAdminTimerDisplay();
  saveEventConfigToBackend();
}

let _globalTimerInterval=null;
function startGlobalEventTimer(runOnce=false){
  if(_globalTimerInterval)clearInterval(_globalTimerInterval);
  if(timerMode!=='event' && timerMode!=='none'){
    return;
  }
  // No timer mode — show infinity symbol and stop
  if(timerMode==='none'){
    var tb=document.querySelector('.timer-block');
    if(tb)tb.style.display='';
    var el=document.getElementById('cTimer');
    if(el){el.textContent='∞';el.classList.add('is-infinity');}
    renderTimerLabel('No Timer');
    return;
  }
  // Show timer block if it was hidden
  var tb2=document.querySelector('.timer-block');
  if(tb2)tb2.style.display='';
  if(!eventSettings.startTime||!eventSettings.endTime)return;
  
  const _tick=()=>{
    const timerEl=document.getElementById('cTimer');
    
    // Paused — show frozen time
    if(eventPaused&&_pausedTimeRemaining!==null){
      const diff=_pausedTimeRemaining;
      const h=Math.floor(diff/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      if(timerEl){
        timerEl.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
        timerEl.style.color='var(--amber)';
      }
      return;
    }
    
    const now=Date.now();
    const start=new Date(eventSettings.startTime).getTime();
    const end=new Date(eventSettings.endTime).getTime();
    
    if(now<start){
      const diff=start-now;
      const h=Math.floor(diff/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      if(timerEl)timerEl.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    }else if(now>=start&&now<end){
      const diff=end-now;
      const h=Math.floor(diff/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      if(timerEl){
        timerEl.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
        timerEl.style.color=(diff<300000)?'var(--red)':'';
      }
    }else if(!eventSettings.expired){
      eventSettings.expired=true;
      if(timerEl){timerEl.textContent='00:00:00';timerEl.style.color='var(--red)'}
      onTimerExpired();
    }
    updateEventStatus();
  };
  if(typeof _globalTimerInterval!=='undefined' && _globalTimerInterval){
    clearInterval(_globalTimerInterval);
    _globalTimerInterval=null;
  }
  if(runOnce){ _tick(); return; }
  _tick();
  _globalTimerInterval=setInterval(_tick,1000);
}

// handleEventExpiry — now handled by onTimerExpired + showEventLockOverlay

function showPublicLeaderboard(){
  // Build and show a player-facing leaderboard
  const teams=getSortedTeams();
  const maxFields=intelFields.length||1;
  
  let html='<div style="width:90%;max-width:600px;max-height:80vh;overflow-y:auto">';
  html+='<div style="text-align:center;margin-bottom:24px"><div style="font-family:Russo One,sans-serif;font-size:22px;color:var(--green);letter-spacing:4px">FINAL STANDINGS</div><div style="font-family:Saira,sans-serif;font-size:10px;color:#666;letter-spacing:2px;margin-top:4px">'+teams.length+' teams competed</div></div>';
  
  teams.slice(0,20).forEach((t,i)=>{
    const rank=i+1;
    const medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'';
    const score=t.submissionResults?t.submissionResults.totalScore:0;
    const possible=t.submissionResults?t.submissionResults.totalPossible:(maxFields*10);
    const pct=possible?Math.round((score/possible)*100):0;
    const barColor=rank===1?'#ffd700':rank===2?'#c0c0c0':rank===3?'#cd7f32':'#333';
    const submitted=t.submitTime?'Submitted':'Not submitted';
    
    html+=`<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.05);${rank<=3?'background:rgba(255,255,255,.02)':''}">
      <div style="font-family:Russo One,sans-serif;font-size:${rank<=3?'18':'14'}px;color:${rank===1?'#ffd700':rank===2?'#c0c0c0':rank===3?'#cd7f32':'#555'};min-width:36px;text-align:center">${medal||'#'+rank}</div>
      <div style="flex:1">
        <div style="font-family:Saira,sans-serif;font-size:13px;color:#ddd;font-weight:600">${t.name}</div>
        <div style="height:3px;background:#111;border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${barColor};border-radius:2px"></div></div>
      </div>
      <div style="text-align:right">
        <div style="font-family:Oxanium,sans-serif;font-size:16px;font-weight:700;color:${rank<=3?'#fff':'#aaa'}">${pct}%</div>
        <div style="font-family:IBM Plex Mono,monospace;font-size:8px;color:#555">${submitted}</div>
      </div>
    </div>`;
  });
  
  html+='<div style="text-align:center;margin-top:20px"><button onclick="closePublicLeaderboard()" style="padding:10px 24px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#888;font-family:Saira,sans-serif;font-size:10px;letter-spacing:2px;cursor:pointer;border-radius:4px;text-transform:uppercase">Close</button></div>';
  html+='</div>';
  
  const overlay=document.createElement('div');
  overlay.id='publicLeaderboard';
  overlay.style.cssText='position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=html;
  document.body.appendChild(overlay);
}
function closePublicLeaderboard(){
  const el=document.getElementById('publicLeaderboard');
  if(el)el.remove();
}

