// ═══════════════════════════════════════════════════════════════
// ADMIN EVENT ACTIONS
// ═══════════════════════════════════════════════════════════════

let eventPaused=false;
let _pausedTimeRemaining=null;

function toggleEventPause(){
  if(!eventSettings.startTime||!eventSettings.endTime)return;
  const btn=document.getElementById('eventPauseBtn');
  if(!eventPaused){
    // Pause — save remaining time, stop countdown
    const now=Date.now();
    const end=new Date(eventSettings.endTime).getTime();
    _pausedTimeRemaining=Math.max(0,end-now);
    eventPaused=true;
    if(btn)btn.innerHTML='▶ Resume Timer';
    // Broadcast pause to players
    apiCall('sendBroadcast',{message:'⏸ Event timer has been paused by the administrator.',type:'text'});
  }else{
    // Resume — set new end time based on remaining time
    const newEnd=new Date(Date.now()+_pausedTimeRemaining);
    eventSettings.endTime=newEnd.toISOString();
    const inp=document.getElementById('eventEndInput');
    if(inp)inp.value=eventSettings.endTime.substring(0,16);
    eventSettings.expired=false;
    eventPaused=false;
    _pausedTimeRemaining=null;
    if(btn)btn.innerHTML='⏸ Pause Timer';
    startGlobalEventTimer();
    saveEventConfigToBackend();
    apiCall('sendBroadcast',{message:'▶ Event timer has been resumed.',type:'text'});
  }
}

function forceEndEvent(){
  if(!confirm('Force end the event NOW? This will lock all players and reveal the leaderboard immediately.'))return;
  // Set end time to now
  eventSettings.endTime=new Date().toISOString();
  eventSettings.expired=false;
  const inp=document.getElementById('eventEndInput');
  if(inp)inp.value=eventSettings.endTime.substring(0,16);
  eventPaused=false;
  _pausedTimeRemaining=null;
  startGlobalEventTimer();
  saveEventConfigToBackend();
  apiCall('sendBroadcast',{message:'⛔ The event has been ended by the administrator.',type:'text'});
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function exportResults(){
  const teams=getSortedTeams();
  const maxFields=intelFields.length||1;
  const totalPossible=intelFields.reduce((s,f)=>(s+(f.answer?.points||10)),0);
  const eventName=operationName||'Code Breakers';
  const now=new Date();
  const dateStr=now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

  let rows='';
  teams.forEach((t,i)=>{
    const rank=i+1;
    const sr=t.submissionResults;
    const score=sr?sr.totalScore:0;
    const correct=sr?sr.correctCount:0;
    const pct=totalPossible?Math.round((score/totalPossible)*100):0;
    const members=(t.members||[]).join(', ');
    const submitted=t.submitTime?new Date(t.submitTime).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):'—';
    const medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'';
    const rowBg=rank<=3?'background:#f8f9fa':'';
    const rankColor=rank===1?'#d4a017':rank===2?'#757575':rank===3?'#a0522d':'#333';
    rows+=`<tr style="${rowBg}">
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:${rankColor};font-size:${rank<=3?'16':'13'}px">${medal||'#'+rank}</td>
      <td style="padding:10px 12px"><div style="font-weight:600;font-size:13px;color:#1a1a1a">${esc(t.name)}</div><div style="font-size:10px;color:#888;margin-top:2px">${esc(members)}</div></td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;font-size:15px;color:#1a1a1a">${score}<span style="font-size:10px;color:#999;font-weight:400">/${totalPossible}</span></td>
      <td style="padding:10px 12px;text-align:center"><div style="background:#eee;border-radius:10px;height:8px;overflow:hidden;min-width:80px"><div style="height:100%;width:${pct}%;background:${rank===1?'#d4a017':rank===2?'#757575':rank===3?'#a0522d':'#4CAF50'};border-radius:10px"></div></div><div style="font-size:10px;color:#888;margin-top:3px">${pct}%</div></td>
      <td style="padding:10px 12px;text-align:center;color:#666;font-size:11px">${correct}/${maxFields}</td>
      <td style="padding:10px 12px;text-align:center;color:#666;font-size:11px">${submitted}</td>
    </tr>`;
  });

  let fieldRows='';
  intelFields.forEach((f,i)=>{
    const pts=f.answer?.points||10;
    const hasKey=f.answer?.expected?.filter(e=>e.trim()).length>0;
    fieldRows+=`<tr>
      <td style="padding:6px 12px;font-size:11px;color:#555">${i+1}</td>
      <td style="padding:6px 12px;font-size:11px">${esc(f.label)}</td>
      <td style="padding:6px 12px;text-align:center;font-size:11px">${f.type}</td>
      <td style="padding:6px 12px;text-align:center;font-weight:600">${pts}</td>
      <td style="padding:6px 12px;text-align:center;font-size:11px">${f.answer?.matchMode||'exact'}</td>
      <td style="padding:6px 12px;text-align:center">${hasKey?'<span style="color:#4CAF50">✓</span>':'<span style="color:#999">—</span>'}</td>
    </tr>`;
  });

  const report=`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(eventName)} — Results Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;background:#fff;padding:40px}
@media print{body{padding:20px}.toolbar{display:none!important}.page-break{page-break-before:always}}
.header{text-align:center;margin-bottom:40px;padding-bottom:20px;border-bottom:3px solid #1a1a1a}
.header h1{font-size:28px;font-weight:800;letter-spacing:1px;margin-bottom:4px}
.header .sub{font-size:12px;color:#888;letter-spacing:2px;text-transform:uppercase}
.header .meta{font-size:11px;color:#aaa;margin-top:8px}
.section{margin-bottom:32px}
.section h2{font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a1a1a;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #eee}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{background:#1a1a1a;color:#fff;padding:10px 12px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase}

tbody td{padding:10px 12px;vertical-align:middle}

tbody tr{border-bottom:1px solid #eee}
tbody tr:hover{background:#f5f5f5}
.stats{display:flex;gap:20px;margin-bottom:24px;flex-wrap:wrap}
.stat{flex:1;min-width:120px;padding:16px;background:#f8f9fa;border-radius:8px;text-align:center}
.stat .val{font-size:28px;font-weight:800;color:#1a1a1a}
.stat .lbl{font-size:10px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:4px}
.footer{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:10px;color:#ccc}
.toolbar{position:fixed;top:10px;right:10px;display:flex;gap:8px;z-index:100}
.toolbar button{padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px}
.toolbar button:hover{background:#f5f5f5}
</style></head><body class=\"config-hydrating\">
<div class="toolbar">
  <button onclick="window.print()">🖨 Print / Save as PDF</button>
</div>
<div class="header">
  <h1>${esc(eventName)}</h1>
  <div class="sub">Final Results Report</div>
  <div class="meta">Generated ${dateStr} at ${timeStr}</div>
</div>
<div class="stats">
  <div class="stat"><div class="val">${teams.length}</div><div class="lbl">Teams</div></div>
  <div class="stat"><div class="val">${teams.filter(t=>t.submitTime).length}</div><div class="lbl">Submitted</div></div>
  <div class="stat"><div class="val">${maxFields}</div><div class="lbl">Intel Fields</div></div>
  <div class="stat"><div class="val">${totalPossible}</div><div class="lbl">Max Score</div></div>
  <div class="stat"><div class="val">${teams.length>0&&teams[0].submissionResults?teams[0].submissionResults.totalScore:0}</div><div class="lbl">Top Score</div></div>
</div>
<div class="section">
  <h2>🏆 Final Standings</h2>
  <table><thead><tr><th style="width:60px;text-align:center">Rank</th><th>Team</th><th style="text-align:center;width:100px">Score</th><th style="text-align:center;width:120px">Progress</th><th style="text-align:center;width:80px">Correct</th><th style="text-align:center;width:100px">Submitted</th></tr></thead>
  <tbody>${rows}</tbody></table>
</div>
<div class="section page-break">
  <h2>📋 Scoring Configuration</h2>
  <table><thead><tr><th style="width:40px">#</th><th>Field</th><th style="text-align:center;width:80px">Type</th><th style="text-align:center;width:60px">Points</th><th style="text-align:center;width:80px">Match</th><th style="text-align:center;width:60px">Key Set</th></tr></thead>
  <tbody>${fieldRows}</tbody></table>
</div>
<div class="footer">
  <p>${esc(eventName)} — Code Breakers Platform</p>
  <p style="margin-top:4px">Confidential — For internal use only</p>
</div>
</body></html>`;

  const blob=new Blob([report],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  window.open(url,'_blank');
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}

// ══════ SCORING EDITOR ══════
let scoringConfig={timeBonus:false,timeBonusMax:50,timeBonusDecay:'linear'};

function renderScoringEditor(){
  const list=document.getElementById('seFieldList');
  if(!list)return;
  let html='',totalPts=0;
  intelFields.forEach((f,i)=>{
    const pts=f.answer?.points||10;
    totalPts+=pts;
    const mode=f.answer?.matchMode||'exact';
    const fuzzy=f.answer?.fuzzyThreshold||85;
    html+=`<div style="display:grid;grid-template-columns:2fr 80px 100px 80px;gap:0;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);align-items:center">
      <div style="font-family:Chakra Petch,sans-serif;font-size:11px;color:#ddd">${f.emoji||''} ${esc(f.label)}<span style="font-size:9px;color:#555;margin-left:6px">(${f.type})</span></div>
      <div style="text-align:center"><input type="number" value="${pts}" min="1" max="1000" onchange="seUpdateField(${i},'points',parseInt(this.value))" style="width:54px;background:#080a10;border:1px solid var(--border);border-radius:3px;padding:4px 6px;color:var(--green);font-family:Oxanium,sans-serif;font-size:11px;text-align:center;outline:none"></div>
      <div style="text-align:center"><select onchange="seUpdateField(${i},'matchMode',this.value)" style="background:#080a10;border:1px solid var(--border);border-radius:3px;padding:4px 6px;color:#aaa;font-family:IBM Plex Mono,monospace;font-size:9px;outline:none">
        <option value="exact"${mode==='exact'?' selected':''}>Exact</option>
        <option value="contains"${mode==='contains'?' selected':''}>Contains</option>
        <option value="fuzzy"${mode==='fuzzy'?' selected':''}>Fuzzy</option>
      </select></div>
      <div style="text-align:center"><input type="number" value="${fuzzy}" min="50" max="100" onchange="seUpdateField(${i},'fuzzyThreshold',parseInt(this.value))" style="width:48px;background:#080a10;border:1px solid var(--border);border-radius:3px;padding:4px 6px;color:#aaa;font-family:IBM Plex Mono,monospace;font-size:9px;text-align:center;outline:none" ${mode!=='fuzzy'?'disabled':''}></div>
    </div>`;
  });
  list.innerHTML=html||'<div style="padding:16px;text-align:center;font-size:10px;color:#555">No intel fields configured yet.</div>';
  const total=document.getElementById('seTotalPossible');
  if(total)total.textContent=totalPts;
}

function seUpdateField(idx,prop,val){
  if(!intelFields[idx])return;
  if(!intelFields[idx].answer)intelFields[idx].answer={expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10};
  intelFields[idx].answer[prop]=val;
  renderScoringEditor();
  saveIntelFieldsToBackend();
  showSaveBlip('blipScoring');
}

function seApplyDefaultPoints(){
  const pts=parseInt(document.getElementById('seDefaultPoints')?.value||10);
  const mode=document.getElementById('seDefaultMode')?.value||'exact';
  intelFields.forEach(f=>{
    if(!f.answer)f.answer={expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10};
    f.answer.points=pts;
    f.answer.matchMode=mode;
  });
  renderScoringEditor();
  saveIntelFieldsToBackend();
  showSaveBlip('blipScoring');
}

function seApplyDefaultMode(){
  const mode=document.getElementById('seDefaultMode')?.value||'exact';
  intelFields.forEach(f=>{
    if(!f.answer)f.answer={expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10};
    f.answer.matchMode=mode;
  });
  renderScoringEditor();
  saveIntelFieldsToBackend();
  showSaveBlip('blipScoring');
}

function updateScoringConfig(){
  scoringConfig.timeBonus=document.getElementById('seTimeBonus')?.checked||false;
  scoringConfig.timeBonusMax=parseInt(document.getElementById('seTimeBonusMax')?.value||50);
  scoringConfig.timeBonusDecay=document.getElementById('seTimeBonusDecay')?.value||'linear';
  const cfg=document.getElementById('seTimeBonusConfig');
  if(cfg)cfg.style.display=scoringConfig.timeBonus?'flex':'none';
  saveEventConfigToBackend();
}

function clearAllData(){
  if(!confirm('⚠ NUCLEAR RESET\n\nThis will permanently delete:\n• All registered teams\n• All submissions & scores\n• All broadcast messages\n\nFeed posts, media items, intel fields, and vault codes will NOT be affected.\n\nThis cannot be undone. Continue?'))return;
  if(!confirm('Are you absolutely sure? Type thinking...'))return;
  
  apiCall('clearAllData',{scope:'all'}).then(r=>{
    if(r.ok){
      // Clear local state
      registeredTeams.length=0;
      manualTeams.length=0;
      eventSettings.expired=false;
      renderLeaderboard();
      renderFullLeaderboard();
      renderTeamMonitor();
      showPlayerBanner('text','All event data has been cleared.');
    }
  });
}

function updateEventStatus(){
  const msg=document.getElementById('eventStatusMsg');
  if(!msg)return;
  if(!eventSettings.startTime||!eventSettings.endTime){
    msg.textContent='Set both start and end times to activate event timer';msg.style.color='#666';return;
  }
  if(eventPaused){msg.textContent='⏸ Event is PAUSED';msg.style.color='var(--amber)';return}
  const now=Date.now();
  const start=new Date(eventSettings.startTime).getTime();
  const end=new Date(eventSettings.endTime).getTime();
  if(now<start){msg.textContent='⏳ Event has not started yet';msg.style.color='var(--amber)'}
  else if(now>=start&&now<end){msg.textContent='🟢 Event is LIVE';msg.style.color='var(--green)'}
  else{msg.textContent='🔴 Event has ended';msg.style.color='var(--red)'}
}

// Countdown mode functions
function togglePause(){
  // Manual countdown start/pause/resume
  const pb=document.getElementById('pauseBtn');
  const timerEl=document.getElementById('cTimer');
  if(timerMode!=='countdown')return;
  if(!timerStarted){
    if(timerSec<=0)return;
    timerStarted=true;
    timerPaused=false;
    if(pb)pb.textContent='⏸ PAUSE';
    timerEl?.classList.remove('paused');
  }else{
    timerPaused=!timerPaused;
    if(pb)pb.textContent=timerPaused?'▶ RESUME':'⏸ PAUSE';
    timerEl?.classList.toggle('paused',timerPaused);
  }
  updateAdminTimerDisplay();
  saveEventConfigToBackend();
}
function setNewTime(){const v=document.getElementById('timerInput').value.trim();const parts=v.split(':');if(parts.length===3){timerSec=parseInt(parts[0])*3600+parseInt(parts[1])*60+parseInt(parts[2]);timerOriginal=timerSec;renderTimer()
  timerPaused=true; timerStarted=false;
  const pb=document.getElementById('pauseBtn'); if(pb)pb.textContent='▶ START';
  document.getElementById('cTimer')?.classList.add('paused');
  updateAdminTimerDisplay();
  saveEventConfigToBackend();
}else if(parts.length===2){timerSec=parseInt(parts[0])*60+parseInt(parts[1]);timerOriginal=timerSec;renderTimer()}}
function resetTimer(){
  timerSec=timerOriginal;
  timerPaused=true;
  timerStarted=false;
  const pb=document.getElementById('pauseBtn');
  if(pb)pb.textContent='▶ START';
  const ct=document.getElementById('cTimer');
  ct?.classList.add('paused');
  renderTimer();
  updateAdminTimerDisplay();
  saveEventConfigToBackend();
}
function renderTimer(){
  const el=document.getElementById('cTimer');
  if(!el)return;
  if(!_eventCfgHydrated)return;
  if(timerMode==='event'){
    // schedule mode renders via startGlobalEventTimer
    return;
  }
  if(timerMode==='none'){
    el.textContent='∞';
    el.classList.add('is-infinity');
    return;
  }
  el.classList.remove('is-infinity');
  const h=Math.floor(timerSec/3600),m=Math.floor((timerSec%3600)/60),s=timerSec%60;
  el.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function renderTimerLabel(label){
  const labelEl=document.querySelector('.timer-label');
  if(labelEl)labelEl.textContent=label;
}

function tickTimer(){
  if(!_eventCfgHydrated)return;
  if(timerMode==='none')return; // Open-ended, no timer
  if(timerMode==='countdown'){
    if(timerPaused||timerSec<=0)return;
    timerSec--;renderTimer();
    if(timerSec<=0)onTimerExpired();
  }
}
function onTimerExpired(){
  eventSettings.expired=true;
  updateEventStatus();
  if(eventSettings.autoLock&&!isAdmin){
    showEventLockOverlay();
  }
  if(eventSettings.showLeaderboardOnExpiry&&!isAdmin){
    // Auto-show leaderboard after short delay
    setTimeout(()=>openLeaderboard(),2000);
  }
}
function showEventLockOverlay(){
  let overlay=document.getElementById('eventLockOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='eventLockOverlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;animation:fadeIn .5s ease';
    overlay.innerHTML=`
      <div style="font-family:Staatliches,cursive;font-size:32px;color:var(--red);letter-spacing:6px;text-transform:uppercase">⏱ Time's Up</div>
      <div style="font-family:Chakra Petch,sans-serif;font-size:14px;color:#888;letter-spacing:1px">The event has ended. All submissions are now locked.</div>
      <div style="font-family:IBM Plex Mono,monospace;font-size:11px;color:#555;letter-spacing:2px;margin-top:8px">Final results are being compiled...</div>
      <button onclick="removeEventLockShowResults()" style="margin-top:20px;padding:10px 24px;background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.3);color:var(--green);font-family:Saira,sans-serif;font-size:11px;letter-spacing:3px;cursor:pointer;border-radius:4px;text-transform:uppercase;font-weight:700">View Results</button>
    `;
    document.body.appendChild(overlay);
    // Lock all interactive elements for players
    document.querySelectorAll('.intel-exp-input,.v-key,.login-hw-btn,.intel-submit-btn').forEach(el=>{el.disabled=true;el.style.pointerEvents='none';el.style.opacity='.4'});
    document.body.classList.add('event-locked');
  }
}
function removeEventLockShowResults(){
  const ov=document.getElementById('eventLockOverlay');
  if(ov)ov.remove();
  showPublicLeaderboard();
}
function getEventState(){
  if(!eventSettings.startTime||!eventSettings.endTime)return'setup';
  const now=Date.now();
  const start=new Date(eventSettings.startTime).getTime();
  const end=new Date(eventSettings.endTime).getTime();
  if(eventPaused)return'paused';
  if(now<start)return'pre-event';
  if(now>=start&&now<end)return'live';
  return'ended';
}


