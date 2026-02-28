// ══════ INTEL DRAG REORDER ══════
// Extend the existing drag system to support intel fields
function startIntelDrag(e,idx){
  e.preventDefault();e.stopPropagation();
  const target=e.target.closest('.intel-exp-row');
  if(!target)return;
  _drag={active:true,type:'intel',fromIdx:idx,ghost:null,overIdx:null};
  const rect=target.getBoundingClientRect();
  const ghost=target.cloneNode(true);ghost.className='drag-ghost';
  ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';
  ghost.style.left=rect.left+'px';ghost.style.top=rect.top+'px';
  document.body.appendChild(ghost);_drag.ghost=ghost;
  target.classList.add('dragging');
  const ox=e.clientX-rect.left,oy=e.clientY-rect.top;
  function onMove(ev){
    const cx=ev.clientX||0,cy=ev.clientY||0;
    ghost.style.left=(cx-ox)+'px';ghost.style.top=(cy-oy)+'px';
    ghost.style.display='none';const el=document.elementFromPoint(cx,cy);ghost.style.display='';
    document.querySelectorAll('.intel-exp-row[data-idx]').forEach(c=>c.classList.remove('drag-over'));
    if(el){const dt=el.closest('.intel-exp-row[data-idx]');if(dt){const di=parseInt(dt.dataset.idx);if(!isNaN(di)&&di!==idx){dt.classList.add('drag-over');_drag.overIdx=di}}}
  }
  function onEnd(){
    window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onEnd);
    if(ghost)ghost.remove();
    document.querySelectorAll('.intel-exp-row').forEach(c=>c.classList.remove('dragging','drag-over'));
    if(_drag.overIdx!==null&&_drag.overIdx!==_drag.fromIdx){
      const item=intelFields.splice(_drag.fromIdx,1)[0];
      intelFields.splice(_drag.overIdx,0,item);
      renderIntelForm();renderGrid();saveIntelFieldsToBackend();
    }
    _drag={active:false,type:null,fromIdx:null,ghost:null,overIdx:null};
  }
  window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onEnd);
}

// ══════ APPLY TUTORIAL/BRIEFING CONFIG FROM BACKEND ══════
function applyTutorialBriefingConfig(cfg){
  if(cfg.tutorialEnabled!==undefined)tutorialEnabled=(cfg.tutorialEnabled==='true'||cfg.tutorialEnabled===true);
  if(cfg.tutorialSteps){
    if(typeof cfg.tutorialSteps==="string"){try{tutorialSteps=JSON.parse(cfg.tutorialSteps)}catch(e){}}
    else if(Array.isArray(cfg.tutorialSteps)){tutorialSteps=cfg.tutorialSteps}
  }
  if(cfg.tutorialGen){try{localStorage.setItem('cb_tutorialGen',String(cfg.tutorialGen))}catch(e){}}
  if(cfg.briefingGen){try{localStorage.setItem('cb_briefingGen',String(cfg.briefingGen))}catch(e){}}
  if(cfg.briefingConfig){
    if(typeof cfg.briefingConfig==="string"){try{briefingConfig=JSON.parse(cfg.briefingConfig)}catch(e){}}
    else if(typeof cfg.briefingConfig==="object"){briefingConfig=cfg.briefingConfig}
  }
}

// ══════ FUTURE UPGRADES (NOTED) ══════
// TODO: Pre-event Lobby — Holding screen with countdown for teams before event starts
// TODO: Hint System — Timed or purchasable hints per puzzle, configurable in admin
// TODO: Analytics Dashboard — Team activity heatmaps, completion rates, time-per-puzzle
// TODO: Puzzle Builder — Multi-stage puzzle flow with progression gating
// ══════ END FUTURE NOTES ══════
setInterval(tickTimer,1000);
// Initial dynamic renders — defer renderGrid to after restoreSession
// so cached posts/media/intel are in memory when the grid first paints.
// renderGrid() will be called by restoreSession → applyScreenAndPanel,
// or by loadEventData if no session exists.
renderIntelForm();
buildRegForm();
updateLandingForMode();

// ═══════════════════════════════════════════════════════════════
// SESSION PERSISTENCE
// ═══════════════════════════════════════════════════════════════

function _sessionStore(){return regSettings.sessionPersist?localStorage:sessionStorage}
function saveSession(){
  try{
    // Only save when user is authenticated on the console screen
    if(_currentScreen!=='consoleScreen'&&_currentScreen!=='settingsScreen')return;
    if(!currentVaultTeam)return;
    const data={type:isAdmin?'admin':'team',team:currentVaultTeam,savedAt:Date.now()};
    if(isAdmin){
      data.adminSession=adminSession;
      // Save which admin page is open
      if(_currentAdminPage||_currentScreen==='settingsScreen')data.adminPage='settingsScreen';
      // Save active tab within settings page
      var activeTab=document.querySelector('#settingsScreen .admin-page-section.active');
      if(activeTab)data.adminTab=activeTab.id;
    }
    // Save which player panel is open so refresh restores exactly where the user was
    const openPanelEl=document.querySelector('.expanded-panel.visible');
    if(openPanelEl)data.panel=openPanelEl.id;
    // Save feed view state so focus mode + post index survive refresh
    data.feedView=currentFeedView;
    data.feedPost=currentPost;// Persist session in the active storage mode only.
// This prevents "stale admin token" loops caused by old sessions lingering in localStorage.
const json=JSON.stringify(data);
const store=_sessionStore(); // localStorage if persist mode, else sessionStorage
store.setItem('cb_session',json);
// Clear the other store to avoid resurrecting an expired session later
(store===localStorage?sessionStorage:localStorage).removeItem('cb_session');
}catch(e){}
}

// ── Game State Persistence ──
// Persists vault progress, intel answers, cooldown, and elapsed timer
// so browser close / refresh doesn't lose gameplay progress.
// Keyed per team to prevent cross-team bleed.

function _gsKey(suffix){
  const tid=currentVaultTeam?.id||'UNKNOWN';
  return 'cb_gs_'+tid+'_'+suffix;
}

function saveGameState(){
  try{
    if(!currentVaultTeam)return;

    // 1. Vault unlock progress — which codes have been cracked
    const unlocks={};
    vaultCodes.forEach(c=>{if(c.unlocked)unlocks[c.code]={at:c.unlockedAt}});
    localStorage.setItem(_gsKey('vaultUnlocks'),JSON.stringify(unlocks));

    // 2. Vault fail counters
    localStorage.setItem(_gsKey('vaultFails'),JSON.stringify({
      failCount:vkFailCount,
      totalFails:vkTotalFails
    }));

    // 3. Vault cooldown — store absolute end time so it survives browser close
    // _vaultLockoutEnd is set by triggerVaultLockout()
    if(_vaultLockoutEnd){
      localStorage.setItem(_gsKey('vaultLockout'),JSON.stringify({endTime:_vaultLockoutEnd}));
    }else{
      localStorage.removeItem(_gsKey('vaultLockout'));
    }

    // 4. Intel form answers (typed but not yet submitted)
    const intelAnswers={};
    document.querySelectorAll('.intel-exp-input').forEach(inp=>{
      const idx=inp.dataset.idx;
      if(idx!==undefined&&inp.value.trim())intelAnswers[idx]=inp.value;
    });
    localStorage.setItem(_gsKey('intelDraft'),JSON.stringify(intelAnswers));

    // 5. Submission status
    localStorage.setItem(_gsKey('isSubmitted'),isSubmitted?'1':'0');

    // 6. Elapsed timer — store session start time (absolute) so we can compute elapsed on restore
    if(!_sessionStartTime)_sessionStartTime=Date.now()-elapsedSec*1000;
    localStorage.setItem(_gsKey('sessionStart'),String(_sessionStartTime));

  }catch(e){console.warn('saveGameState error:',e)}
}

function restoreGameState(){
  try{
    if(!currentVaultTeam)return;

    // 1. Vault unlock progress
    const unlockRaw=localStorage.getItem(_gsKey('vaultUnlocks'));
    if(unlockRaw){
      const unlocks=JSON.parse(unlockRaw);
      vaultCodes.forEach(c=>{
        const u=unlocks[c.code];
        if(u){c.unlocked=true;c.unlockedAt=u.at||new Date().toISOString();
          // Also unlock the linked media item
          if(typeof c.linkedMediaIdx==='number'&&mediaItems[c.linkedMediaIdx]){
            // NOTE: Do not mutate vaultLocked here; unlock visibility is team-scoped via vaultCodes + localStorage.
          }
        }
      });
    }

    // 2. Vault fail counters
    const failRaw=localStorage.getItem(_gsKey('vaultFails'));
    if(failRaw){
      const f=JSON.parse(failRaw);
      vkFailCount=f.failCount||0;
      vkTotalFails=f.totalFails||0;
    }

    // 3. Vault cooldown — check if lockout is still active
    const lockoutRaw=localStorage.getItem(_gsKey('vaultLockout'));
    if(lockoutRaw){
      const l=JSON.parse(lockoutRaw);
      const remaining=Math.ceil((l.endTime-Date.now())/1000);
      if(remaining>0){
        // Cooldown still active — resume it
        _vaultLockoutEnd=l.endTime;
        triggerVaultLockout(remaining,'SECURITY LOCKOUT','Cooldown in progress · '+remaining+'s remaining');
      }else{
        // Cooldown expired while browser was closed — clear it
        localStorage.removeItem(_gsKey('vaultLockout'));
        _vaultLockoutEnd=null;
        vkFailCount=0;vkTotalFails=0;
        localStorage.setItem(_gsKey('vaultFails'),JSON.stringify({failCount:0,totalFails:0}));
      }
    }

    // 4. Submission status
    const subRaw=localStorage.getItem(_gsKey('isSubmitted'));
    if(subRaw==='1')isSubmitted=true;

    // 5. Elapsed timer — compute from stored start time
    const startRaw=localStorage.getItem(_gsKey('sessionStart'));
    if(startRaw){
      _sessionStartTime=parseInt(startRaw);
      elapsedSec=Math.floor((Date.now()-_sessionStartTime)/1000);
    }

  }catch(e){console.warn('restoreGameState error:',e)}
}

function restoreIntelDraft(){
  // Called after renderIntelForm to restore typed answers
  try{
    if(!currentVaultTeam)return;
    const raw=localStorage.getItem(_gsKey('intelDraft'));
    if(!raw)return;
    const answers=JSON.parse(raw);
    document.querySelectorAll('.intel-exp-input').forEach(inp=>{
      const idx=inp.dataset.idx;
      if(idx!==undefined&&answers[idx]){inp.value=answers[idx]}
    });
  }catch(e){}
}

function clearGameState(){
  try{
    if(!currentVaultTeam)return;
    const prefixes=['vaultUnlocks','vaultFails','vaultLockout','intelDraft','isSubmitted','sessionStart'];
    prefixes.forEach(p=>localStorage.removeItem(_gsKey(p)));
  }catch(e){}
}

// Auto-save game state periodically and on visibility change
setInterval(()=>{if(currentVaultTeam&&(_currentScreen==='consoleScreen'||_currentScreen==='settingsScreen')){saveGameState();saveSession()}},5000);
function _saveAll(){if(currentVaultTeam&&(_currentScreen==='consoleScreen'||_currentScreen==='settingsScreen')){saveGameState();saveSession()}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')_saveAll()});
window.addEventListener('beforeunload',_saveAll);
window.addEventListener('pagehide',_saveAll);

function clearSession(){
  try{
    clearGameState();
    localStorage.removeItem('cb_session');
    sessionStorage.removeItem('cb_session');
    localStorage.removeItem('cb_posts');
    localStorage.removeItem('cb_media');
    localStorage.removeItem('cb_intel');
    _vaultLockoutEnd=null;
    _sessionStartTime=null;
  }catch(e){}
}

function restoreSession(){
  try{
    // Try sessionStorage first (always valid if tab is still open),
    // then localStorage with 2-minute grace window for team sessions
    let raw=sessionStorage.getItem('cb_session');
    let fromLocalStorage=false;
    if(!raw){
      raw=localStorage.getItem('cb_session');
      fromLocalStorage=true;
    }
    if(!raw)return false;
    const data=JSON.parse(raw);
    if(!data||!data.team)return false;

    // For team sessions restored from localStorage (browser was closed):
    // enforce 2-minute grace window — if closed longer, require re-login
    if(fromLocalStorage&&data.type==='team'&&data.savedAt){
      const elapsed=Date.now()-data.savedAt;
      const graceMs=2*60*1000; // 2 minutes
      if(elapsed>graceMs){
        localStorage.removeItem('cb_session');
        return false;
      }
    }

// For admin sessions restored from localStorage:
// Do NOT restore — admin tokens are typically short-lived. Restoring from a previous browser session
// can cause an immediate "Admin session expired" loop.
if(fromLocalStorage&&data.type==='admin'){
  localStorage.removeItem('cb_session');
  return false;
}

    const targetScreen='consoleScreen';
    const panelMap={expFeed:'feed',expMedia:'media',expIntel:'intel',expVault:'vault'};

    // Restore cached content (posts/media/intel) from localStorage BEFORE rendering
    // This makes images appear instantly instead of waiting 3-5s for backend API
    _restoreContentCache();

    // Detect mobile for conditional panel restore
    const _isMobileRestore=window.innerWidth<=768; // (kept for other responsive logic)

    function applyScreenAndPanel(){
      // Set up screen first (hidden — opacity:0 via .screen default)
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      document.getElementById(targetScreen).classList.add('active');
      _currentScreen=targetScreen;
      const lb=document.getElementById('logoutBtn');if(lb)lb.classList.toggle('visible',true);
      document.getElementById('notepadTrigger').classList.add('visible');

      // Open panel SYNCHRONOUSLY before any paint if one was saved
      // On mobile: skip panel restore — land on console grid so user has context
      // On desktop: restore exactly where they were (prevents flash)
      if(data.panel&&panelMap[data.panel]){
        const panelEl=document.getElementById(data.panel);
        if(panelEl){
          document.querySelectorAll('.expanded-panel').forEach(p=>p.classList.remove('visible'));
          panelEl.classList.add('visible');
          // Show overlay immediately, no transition
          overlay.style.cssText='opacity:1;pointer-events:all;transition:none';
          overlay.classList.add('active');
          // Render panel content immediately with whatever is in memory
          // Backend refresh will update it in the background
          const t=panelMap[data.panel];
          if(t==='feed'){
            renderFeed();
            // Restore exact feed view state — grid or focus mode + post index
            if(data.feedView==='single'&&typeof data.feedPost==='number'){
              currentPost=data.feedPost;
              setFeedView('single');
            }else{
              setFeedView('grid');
            }
          }
          if(t==='media')renderMedia();
          if(t==='intel'){renderIntelForm();restoreIntelDraft()}
          if(t==='vault')renderVaultPanel();
        }
      }
    }

    if(data.type==='admin'&&data.adminSession){
      adminSession=data.adminSession;
      isAdmin=true;
      document.body.classList.add('admin-mode');
      currentVaultTeam=data.team;
      updateConsoleForTeam(currentVaultTeam);
      syncAdminDropdownToggles();
      restoreGameState();
      applyScreenAndPanel();
      // Apply cached theme + operation name BEFORE first renderGrid
      // NOTE: _currentGridTheme is declared later with let, so we defer theme assignment
      // to avoid TDZ. We use applyGridTheme() which is already declared, and defer the
      // variable assignment to the post-declaration block below.
      try{
        const ct=localStorage.getItem('cb_gridTheme');
        if(ct){applyGridTheme(ct);window._deferredGridTheme=ct}
        const cn=localStorage.getItem('cb_opName');
        if(cn){operationName=cn;const el=document.getElementById('consoleTitle');if(el)el.textContent='◈ '+cn;document.title=cn+' — Console'}
        const cf=localStorage.getItem('cb_opFont');
        if(cf){operationFont=cf;applyOperationFont(cf)}
      }catch(e){}
      renderGrid(); // Render grid with cached data + theme immediately
      // Restore admin panel — DEFERRED to avoid TDZ with let declarations
      // navigateToAdmin() accesses _panelsMounted, _currentAdminPage, _currentGridTheme etc.
      // which are declared with let/const AFTER this point in the file
      if(data.adminPage){
        window._deferredAdminRestore={page:data.adminPage||'settingsScreen',tab:data.adminTab||null};
      }
      startElapsedTimer();
      startTeamMonitor();
      loadEventData().then(function(){
        if(_currentAdminPage==='settingsScreen'){
          var as=document.querySelector('#settingsScreen .admin-page-section.active');
          if(as)_switchToTab('settingsScreen',as.id);
        }
      });
      return true;
    }else if(data.type==='team'&&data.team.id){
      currentVaultTeam=data.team;
      if(!registeredTeams.find(r=>r.id===data.team.id))registeredTeams.push(currentVaultTeam);
      updateConsoleForTeam(currentVaultTeam);
      restoreGameState();
      applyScreenAndPanel();
      // Apply cached theme + operation name BEFORE first renderGrid
      try{
        const ct=localStorage.getItem('cb_gridTheme');
        if(ct){applyGridTheme(ct);window._deferredGridTheme=ct}
        const cn=localStorage.getItem('cb_opName');
        if(cn){operationName=cn;const el=document.getElementById('consoleTitle');if(el)el.textContent='◈ '+cn;document.title=cn+' — Console'}
        const cf=localStorage.getItem('cb_opFont');
        if(cf){operationFont=cf;applyOperationFont(cf)}
      }catch(e){}
      renderGrid(); // Render grid with cached data + theme immediately
      startElapsedTimer();
      // Load config and fresh content in background — UI already showing
      apiCall('getEventConfig').then(cfg=>{
        if(cfg.ok&&cfg.config)applyEventConfig(cfg.config);
        // Re-sync vault codes after fresh data arrives, then re-apply unlock state
        syncVaultCodesFromMedia();
        restoreGameState();
        // Re-render panel with fresh backend data once it arrives
        if(data.panel&&panelMap[data.panel]){
          const t=panelMap[data.panel];
          if(t==='feed'){
            renderFeed();
            if(data.feedView==='single'&&typeof data.feedPost==='number'){
              currentPost=data.feedPost;
              setFeedView('single');
            }else{
              setFeedView(currentFeedView);
            }
          }
          if(t==='media')renderMedia();
          if(t==='intel'){renderIntelForm();restoreIntelDraft()}
          if(t==='vault')renderVaultPanel();
        }
        // Also update grid badges after vault state is restored
        renderGrid();
        loadDraftsFromBackend();
      });
      startBroadcastPolling();
      startActivityTracker();
      return true;
    }
  }catch(e){console.error('restoreSession error:',e);}
  return false;
}

// Auto-restore on page load
if(!restoreSession()){
  renderGrid(); // No session — render default grid
}

