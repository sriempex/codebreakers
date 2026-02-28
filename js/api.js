// ══════ ADMIN ══════
let isAdmin=false;
// ═══════ BACKEND API ═══════
// ══════ API CONFIGURATION ══════
// Cloudflare Worker backend (replaces Google Apps Script)
const API_URL='https://cb-api.sriempex.workers.dev';
const R2_URL='https://cb-media.sriempex.workers.dev';
let adminSession=null; // {username, role, adminToken}
let adminUsers=[]; // populated from backend on admin list fetch
let manualTeams=[];

// Security: Rate limiter for API calls
const _apiRateLimit={lastCall:0,minInterval:100,burst:0,maxBurst:30};
function _checkRateLimit(){
  const now=Date.now();
  if(now-_apiRateLimit.lastCall<_apiRateLimit.minInterval){
    _apiRateLimit.burst++;
    if(_apiRateLimit.burst>_apiRateLimit.maxBurst){console.warn('API rate limit hit');return false}
  }else{_apiRateLimit.burst=Math.max(0,_apiRateLimit.burst-1)}
  _apiRateLimit.lastCall=now;
  return true;
}
async function apiCall(action,data={}){
  if(!_checkRateLimit()&&!['loginTeam','login','getEventConfig'].includes(action)){
    console.warn('Rate limited:',action);
    return{ok:false,error:'Too many requests. Please slow down.'};
  }
  try{
    // Build JSON POST body — clean format for Cloudflare Worker
    const body={action,...data};
    if(adminSession&&!['login','loginTeam','validateUsername'].includes(action))body.adminToken=adminSession.adminToken;
    const resp=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const text=await resp.text();
    try{const result=JSON.parse(text);
      // Detect session invalidation — force re-login
      if(!result.ok&&result.error&&(result.error.includes('expired')||result.error.includes('Invalid or expired'))){
        if(isAdmin){
          alert('Admin session expired. Please log in again.');
          clearSession();location.reload();
          return result;
        }
      }
      return result}
    catch(e){console.error('Parse error:',text.substring(0,200));return {ok:false,error:'Invalid response from server'}}
  }catch(err){
    console.error('API error:',err);
    return {ok:false,error:'Network error — check connection'};
  }
}

// ── Local content cache — instant restore on refresh ──
// Saves posts/media/intel to localStorage so page refreshes don't wait for backend
function _cacheContent(key,data){
  try{localStorage.setItem(key,JSON.stringify(data))}catch(e){}
}

// ── Media item normalization (Evidence Locker) ──
// Backend storage historically used {title,url,filename}. UI expects {name,fileUrl,icon}.
// Normalize aggressively so items never render as "undefined" after refresh or re-fetch.
function _normalizeMediaItem(m){
  if(!m||typeof m!=='object')return {name:'',desc:'',fileUrl:'',type:'image'};
  const name = (m.name!=null?m.name:m.title)!=null ? String(m.name!=null?m.name:m.title) : '';
  const desc = (m.desc!=null?m.desc:m.description)!=null ? String(m.desc!=null?m.desc:m.description) : '';
  const fileUrl = (m.fileUrl!=null?m.fileUrl:m.url)!=null ? String(m.fileUrl!=null?m.fileUrl:m.url) : '';
  const icon = (m.icon!=null?m.icon:m.filename)!=null ? String(m.icon!=null?m.icon:m.filename) : '';
  const out = Object.assign({}, m);
  out.name = name;
  out.title = name;           // legacy mirror
  out.desc = desc;
  out.fileUrl = fileUrl;
  out.url = fileUrl;          // legacy mirror
  out.icon = icon;
  out.filename = icon;        // legacy mirror
  out.type = out.type || (fileUrl && /\.(mp3|wav|ogg|aac|flac)(\?|#|$)/i.test(fileUrl) ? 'audio'
                     : fileUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(fileUrl) ? 'video'
                     : 'image');
  return out;
}
function _normalizeMediaItems(arr){
  if(!Array.isArray(arr))return [];
  return arr.map(_normalizeMediaItem);
}

function _restoreContentCache(){
  let restored=false;
  try{
    const cv=localStorage.getItem('cb_contentVersion');
    if(!cv){
      localStorage.removeItem('cb_posts');
      localStorage.removeItem('cb_media');
      localStorage.removeItem('cb_intel');
      return false;
    }
  }catch(e){}
  try{
    const cp=localStorage.getItem('cb_posts');
    if(cp){const arr=JSON.parse(cp);posts.length=0;arr.forEach(p=>posts.push(p));restored=true;}
  }catch(e){}
  try{
    const cm=localStorage.getItem('cb_media');
    if(cm){const arr=_normalizeMediaItems(JSON.parse(cm));mediaItems.length=0;arr.forEach(m=>mediaItems.push(m));syncVaultCodesFromMedia();restored=true;}
  }catch(e){}
  try{
    const ci=localStorage.getItem('cb_intel');
    if(ci){
      const arr=JSON.parse(ci);
      intelFields.length=0;
      arr.forEach(f=>{
        // Normalize legacy shapes so money/phone/etc render correctly on first open (pre-refresh)
        if(f && typeof f==='object'){
          if(!f.type && f.fieldType) f.type=f.fieldType;
          if(!f.fieldType && f.type) f.fieldType=f.type;
        }
        intelFields.push(f);
      });
      restored=true;
    }
  }catch(e){}
  // Restore grid theme immediately so first paint uses the correct theme
  try{
    const cachedTheme=localStorage.getItem('cb_gridTheme');
    if(cachedTheme){_currentGridTheme=cachedTheme;applyGridTheme(cachedTheme);updateThemeLabel()}
  }catch(e){}
  // Restore operation name/font so console title doesn't flash
  try{
    const cachedOp=localStorage.getItem('cb_opName');
    if(cachedOp){operationName=cachedOp;const ct=document.getElementById('consoleTitle');if(ct)ct.textContent='◈ '+operationName;document.title=operationName+' — Console'}
    const cachedOpFont=localStorage.getItem('cb_opFont');
    if(cachedOpFont){operationFont=cachedOpFont;applyOperationFont(operationFont)}
  }catch(e){}
  // Restore grid tile customisations (icons, labels, fonts) so tiles don't flash defaults
  try{
    const cachedTiles=localStorage.getItem('cb_gridTiles');
    if(cachedTiles){
      const arr=JSON.parse(cachedTiles);
      if(Array.isArray(arr)){
        arr.forEach(saved=>{
          const tile=gridTiles.find(t=>t.id===saved.id);
          if(tile){
            if(saved.icon)tile.icon=saved.icon;
            if(saved.label)tile.label=saved.label;
            if(saved.sub!==undefined)tile.sub=saved.sub;
            if(saved.labelFont!==undefined)tile.labelFont=saved.labelFont;
            if(saved.subFont!==undefined)tile.subFont=saved.subFont;
          }
        });
      }
    }
  }catch(e){}
  return restored;
}

async function loadEventData(){
  // Parallel fetch — Cloudflare Workers handle concurrent requests efficiently
  const [config, feedResult, mediaResult, intelResult, teamsResult, subResult] = await Promise.all([
    apiCall('getEventConfig'),
    apiCall('getFeedPosts'),
    apiCall('getMediaItems'),
    apiCall('getIntelFields'),
    isAdmin ? apiCall('getTeams') : Promise.resolve({ok:false}),
    isAdmin ? apiCall('getSubmissions') : Promise.resolve({ok:false})
  ]);

  // Apply config first (affects rendering of everything else)
  if(config.ok&&config.config)applyEventConfig(config.config);

  if(feedResult.ok&&Array.isArray(feedResult.posts)){
    if(_saveFeedTimer||_feedSaveInFlight||Date.now()<_feedSaveCooldown){
      console.log('[FEED] loadEventData skipped — save cooldown active');
    }else{
      posts.length=0;
      feedResult.posts.forEach(p=>posts.push(p));
      _cacheContent('cb_posts',posts);
      renderFeed();
      if(currentFeedView==='single')renderSinglePost();
    }
  }

  if(mediaResult.ok&&Array.isArray(mediaResult.items)){
    if(_saveMediaTimer||_mediaSaveInFlight||Date.now()<_mediaSaveCooldown){
      console.log('[MEDIA] loadEventData skipped — save cooldown active');
    }else{
    mediaItems.length=0;
    mediaResult.items.forEach(m=>mediaItems.push({
      icon:m.filename||'📄',name:m.title||'',nameFont:m.titleFont||'',
      desc:m.desc||'',descFont:m.descFont||'',
      type:m.type||'doc',fileUrl:m.url||'',
      vaultLocked:m.vaultLocked||false,
      unlockKey:m.unlockKey||'',
      unlocked:m.unlocked||false,
      vaultCode:m.vaultCode||'',
      vaultCodename:m.vaultCodename||''
    }));
    syncVaultCodesFromMedia();
    _cacheContent('cb_media',mediaItems);
    renderMedia();
    }
  }

  if(intelResult.ok&&Array.isArray(intelResult.fields)){
    intelFields.length=0;
    intelResult.fields.forEach(f=>intelFields.push({
      label:f.label||'',emoji:f.emoji||'',type:f.fieldType||'text',
      font:f.font||'',inputFont:f.inputFont||'',answer:f.answer||{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}
    }));
    _cacheContent('cb_intel',intelFields);
    renderIntelForm();
  }

  if(teamsResult.ok&&teamsResult.teams){
    registeredTeams.length=0;manualTeams.length=0;
    teamsResult.teams.forEach(t=>{
      const team={id:t.teamId,name:t.teamName,type:t.type,members:t.members.map(m=>typeof m==='string'?m:m.name),memberDetails:t.members,lastActive:new Date(t.lastActive).getTime(),fieldsCompleted:0,submitTime:null,registeredAt:t.registeredAt,submissionResults:null};
      if(t.manual)manualTeams.push(team);
      registeredTeams.push(team);
    });
    renderPortalUsersList();
  }

  renderVaultPanel();renderKeysCodes();
  // Single grid render after all data is processed — avoids multiple rebuilds that cause status flicker
  renderGrid();

  if(subResult.ok&&subResult.submissions){
    subResult.submissions.forEach(s=>{
      const team=registeredTeams.find(t=>t.id===s.teamId);
      if(team){
        team.submitTime=s.submittedAt;
        team.submissionResults={totalScore:s.score,totalPossible:s.totalPossible||0,correctCount:s.correct,totalFields:s.total};
      }
    });
  }

  refreshAdminList();
  startGlobalEventTimer();
}

function applyEventConfig(cfg){
  // Content version check — nuke stale cache if version mismatch or missing
  try{
    const cachedVer=localStorage.getItem('cb_contentVersion')||'';
    const serverVer=cfg.contentVersion?String(cfg.contentVersion):'';
    if(!serverVer){
      localStorage.removeItem('cb_posts');
      localStorage.removeItem('cb_media');
      localStorage.removeItem('cb_intel');
      localStorage.removeItem('cb_contentVersion');
    }else if(cachedVer!==serverVer){
      if(cachedVer && parseInt(cachedVer) > parseInt(serverVer)){
      }else{
        localStorage.removeItem('cb_posts');
        localStorage.removeItem('cb_media');
        localStorage.removeItem('cb_intel');
        // Do NOT clear the in-memory arrays here — loadEventData will overwrite them
        // momentarily. Clearing them causes a flash of "0 ITEMS" on the grid.
        localStorage.setItem('cb_contentVersion',serverVer);
      }
    }else{
    }
  }catch(e){}
  if(cfg.operationName){operationName=cfg.operationName;const ct=document.getElementById('consoleTitle');if(ct)ct.textContent='◈ '+operationName;document.title=operationName+' — Console';try{localStorage.setItem('cb_opName',cfg.operationName)}catch(e){}}
  if(cfg.operationFont){operationFont=cfg.operationFont;applyOperationFont(operationFont);try{localStorage.setItem('cb_opFont',cfg.operationFont)}catch(e){}}
  if(cfg.gridTheme){_currentGridTheme=cfg.gridTheme;applyGridTheme(cfg.gridTheme);updateThemeLabel();try{localStorage.setItem('cb_gridTheme',cfg.gridTheme)}catch(e){}}
  if(cfg.intelTheme){applyIntelTheme(cfg.intelTheme)}
  if(cfg.participantMode){regSettings.participantMode=cfg.participantMode;const sel=document.getElementById('apParticipantMode');if(sel)sel.value=cfg.participantMode;
    // Refresh login prompt if on login screen and nothing typed yet
    const lid=document.getElementById('loginId');if(lid&&!lid.value.trim()){setLoginStatus(getLoginPrompt(),'')}
  }
  if(cfg.leaderboardStyle){regSettings.leaderboardStyle=cfg.leaderboardStyle;const sel=document.getElementById('apLeaderboardStyle');if(sel)sel.value=cfg.leaderboardStyle}
  if(cfg.landingTitle){regSettings.landingTitle=cfg.landingTitle;const el=document.getElementById('landingTitleEl');if(el)el.textContent=cfg.landingTitle;const inp=document.getElementById('apLandingTitle');if(inp)inp.value=cfg.landingTitle}
  if(cfg.landingSubtitle){regSettings.landingSubtitle=cfg.landingSubtitle;const el=document.getElementById('landingSubEl');if(el)el.textContent=cfg.landingSubtitle;const inp=document.getElementById('apLandingSubtitle');if(inp)inp.value=cfg.landingSubtitle}
  if(cfg.teamSizeMin){regSettings.teamSizeMin=parseInt(cfg.teamSizeMin);const sel=document.getElementById('apMinSize');if(sel)sel.value=cfg.teamSizeMin}
  if(cfg.teamSizeMax){regSettings.teamSizeMax=parseInt(cfg.teamSizeMax);const sel=document.getElementById('apMaxSize');if(sel)sel.value=cfg.teamSizeMax}
  if(cfg.maxTeams){regSettings.maxTeams=parseInt(cfg.maxTeams);const inp=document.getElementById('apMaxTeams');if(inp)inp.value=cfg.maxTeams}
  if(cfg.bannerFallback)regSettings.bannerFallback=cfg.bannerFallback;
  if(cfg.activeToIdle)activityThresholds.activeToIdle=parseInt(cfg.activeToIdle);
  if(cfg.idleToSilent)activityThresholds.idleToSilent=parseInt(cfg.idleToSilent);
  // Console background
  if(cfg.consoleBgColor||cfg.consoleBgTexture)syncConsoleBgFromConfig(cfg);
  // Landing banner
  if(cfg.landingBannerUrl!==undefined){regSettings.landingBannerUrl=cfg.landingBannerUrl;applyBannerImage(cfg.landingBannerUrl);syncBannerPreview()}
  // Registration settings
  if(cfg.requireEmail!==undefined){regSettings.requireEmail=cfg.requireEmail==='true'||cfg.requireEmail===true;const cb=document.getElementById('apReqEmail');if(cb)cb.checked=regSettings.requireEmail}
  if(cfg.requirePhone!==undefined){regSettings.requirePhone=cfg.requirePhone==='true'||cfg.requirePhone===true;const cb=document.getElementById('apReqPhone');if(cb)cb.checked=regSettings.requirePhone}
  if(cfg.requireDept!==undefined){regSettings.requireDept=cfg.requireDept==='true'||cfg.requireDept===true;const cb=document.getElementById('apReqDept');if(cb)cb.checked=regSettings.requireDept}
  if(cfg.registrationOpen!==undefined){
    regSettings.registrationOpen=cfg.registrationOpen==='true'||cfg.registrationOpen===true;
    const cb=document.getElementById('apRegOpen');if(cb)cb.checked=regSettings.registrationOpen;
    const status=document.getElementById('apRegStatus');
    if(status){status.textContent=regSettings.registrationOpen?'● OPEN':'● CLOSED';status.style.color=regSettings.registrationOpen?'var(--green)':'var(--red)'}
  }
  // Vault settings
  if(cfg.vaultMaxAttempts!==undefined){regSettings.vaultMaxAttempts=parseInt(cfg.vaultMaxAttempts)}
  if(cfg.vaultCooldownSec!==undefined){regSettings.vaultCooldownSec=parseInt(cfg.vaultCooldownSec)}
  if(cfg.vaultUnlimitedAttempts!==undefined){regSettings.vaultUnlimitedAttempts=cfg.vaultUnlimitedAttempts==='true'||cfg.vaultUnlimitedAttempts===true}
  if(cfg.sessionPersist!==undefined){regSettings.sessionPersist=cfg.sessionPersist==='true'||cfg.sessionPersist===true;const cb=document.getElementById('apSessionPersist');if(cb)cb.checked=regSettings.sessionPersist;try{localStorage.setItem('cb_sessionPersist',String(regSettings.sessionPersist))}catch(e){}}
  // Event timer
  if(cfg.eventStartTime){eventSettings.startTime=cfg.eventStartTime;const inp=document.getElementById('eventStartInput');if(inp)inp.value=cfg.eventStartTime.substring(0,16)}
  if(cfg.eventEndTime){eventSettings.endTime=cfg.eventEndTime;const inp=document.getElementById('eventEndInput');if(inp)inp.value=cfg.eventEndTime.substring(0,16)}
  if(cfg.eventAutoLock!==undefined){eventSettings.autoLock=cfg.eventAutoLock==='true'||cfg.eventAutoLock===true;const cb=document.getElementById('eventAutoLock');if(cb)cb.checked=eventSettings.autoLock}
  if(cfg.eventShowLeaderboardOnExpiry!==undefined){eventSettings.showLeaderboardOnExpiry=cfg.eventShowLeaderboardOnExpiry==='true'||cfg.eventShowLeaderboardOnExpiry===true;const cb=document.getElementById('eventShowLeaderboard');if(cb)cb.checked=eventSettings.showLeaderboardOnExpiry}
  if(cfg.allowDownloads!==undefined){allowDownloads=cfg.allowDownloads==='true'||cfg.allowDownloads===true}
  if(cfg.timerMode){
    timerMode=cfg.timerMode;
    if(cfg.timerSec!==undefined){timerSec=parseInt(cfg.timerSec)||0;}
    if(cfg.timerOriginal!==undefined){timerOriginal=parseInt(cfg.timerOriginal)||timerSec;}
    if(cfg.timerPaused!==undefined){timerPaused=(cfg.timerPaused==='true'||cfg.timerPaused===true);}
    if(cfg.timerStarted!==undefined){timerStarted=(cfg.timerStarted==='true'||cfg.timerStarted===true);}
    if(cfg.eventStartTime!==undefined){eventSettings.startTime=cfg.eventStartTime||null;}
    if(cfg.eventEndTime!==undefined){eventSettings.endTime=cfg.eventEndTime||null;}
    if(cfg.eventExpired!==undefined){eventSettings.expired=(cfg.eventExpired==='true'||cfg.eventExpired===true);}
    const sel=document.getElementById('timerMode');
    if(sel){sel.value=timerMode;}
    // Apply mode UI without overwriting restored values
    window.__applyingCfg=true;
    onTimerModeChange();
    window.__applyingCfg=false;
    updateAdminTimerDisplay();
    renderTimer();
  }
  // Scoring config
  if(cfg.scoringConfig){try{Object.assign(scoringConfig,JSON.parse(cfg.scoringConfig))}catch(e){}}
  // Typography fontConfig
  if(cfg.fontConfig&&typeof cfg.fontConfig==='object'){
    Object.assign(fontConfig,cfg.fontConfig);
    applyFontConfig();
  }
  // Grid tile customisations (label, icon, sub, fonts)
  let _gridTilesChanged=false;
  if(cfg.gridTiles&&Array.isArray(cfg.gridTiles)){
    cfg.gridTiles.forEach(saved=>{
      const tile=gridTiles.find(t=>t.id===saved.id);
      if(tile){
        if(saved.icon&&tile.icon!==saved.icon){tile.icon=saved.icon;_gridTilesChanged=true}
        if(saved.label&&tile.label!==saved.label){tile.label=saved.label;_gridTilesChanged=true}
        if(saved.sub!==undefined&&tile.sub!==saved.sub){tile.sub=saved.sub;_gridTilesChanged=true}
        if((saved.labelFont||'')!==tile.labelFont){tile.labelFont=saved.labelFont||'';_gridTilesChanged=true}
        if((saved.subFont||'')!==tile.subFont){tile.subFont=saved.subFont||'';_gridTilesChanged=true}
      }
    });
  }
  if(_gridTilesChanged){
    renderGrid();
    try{localStorage.setItem('cb_gridTiles',JSON.stringify(gridTiles.map(t=>({id:t.id,icon:t.icon,label:t.label,sub:t.sub,labelFont:t.labelFont,subFont:t.subFont}))))}catch(e){}
  }
  // Sync threshold UI
  const idleInp=document.getElementById('apThresholdIdle');if(idleInp)idleInp.value=activityThresholds.activeToIdle;
  const silentInp=document.getElementById('apThresholdSilent');if(silentInp)silentInp.value=activityThresholds.idleToSilent;
  // Update landing page labels based on participant mode
  updateLandingForMode();
  updateEventStatus();
  startGlobalEventTimer();
  // Tutorial & briefing config
  applyTutorialBriefingConfig(cfg);

  // Mark config hydration complete — prevents settings values flashing then reverting on refresh
  if(!window.__configHydrated){
    window.__configHydrated=true;
    _eventCfgHydrated=true;
    try{document.body.classList.remove('config-hydrating')}catch(e){}
    try{renderTimer()}catch(e){}
    document.documentElement.classList.remove('is-hydrating-settings');
    try{document.dispatchEvent(new Event('cb:configHydrated'))}catch(e){}
  }

}

// Admin auth now handled via login screen (submitLogin)
function adminGoVault(){document.getElementById('adminChoiceModal').classList.remove('active');goToLogin()}
function adminGoConsole(){document.getElementById('adminChoiceModal').classList.remove('active');goToConsole()}

// ── Admin dropdown ──
function handleAdminTrigger(){
  const dd=document.getElementById('adminDropdown');
  if(dd.classList.contains('open')){closeAdminDropdown()}else{openAdminDropdown()}
}
function openAdminDropdown(){
  syncAdminDropdownToggles();
  document.getElementById('adminDropdown').classList.add('open');
}
function closeAdminDropdown(){document.getElementById('adminDropdown').classList.remove('open')}
function syncAdminDropdownToggles(){
  const ppEl=document.getElementById('admPreviewToggle');
  const isPreview=document.body.classList.contains('player-preview');
  if(ppEl){ppEl.textContent=isPreview?'ON':'OFF';ppEl.className='adm-toggle '+(isPreview?'on-green':'off')}
}
function toggleAllowDownloads(val){
  allowDownloads=typeof val==='boolean'?val:!allowDownloads;
  const cb=document.getElementById('apAllowDownloads');
  if(cb)cb.checked=allowDownloads;
  saveEventConfigToBackend();
}
// Close dropdown when clicking outside
document.addEventListener('click',e=>{
  const dd=document.getElementById('adminDropdown');
  const trigger=document.getElementById('adminTrigger');
  if(dd.classList.contains('open')&&!dd.contains(e.target)&&!trigger.contains(e.target)){closeAdminDropdown()}
});

function toggleEditMode(){
  // Edit mode removed — admin always has edit power via hover-reveal
  // Kept for backward compatibility
}
function togglePlayerPreview(){
  const isPreview=document.body.classList.contains('player-preview');
  if(!isPreview){
    document.body.classList.add('player-preview');
    // Set a placeholder team name for preview
    const teamEl=document.querySelector('.console-team');
    if(teamEl&&teamEl.childNodes[0])teamEl.childNodes[0].textContent='TEAM PREVIEW ';
    // Show exit button where gear icon sits (bottom-right, same size/shape)
    let pill=document.getElementById('previewExitPill');
    if(!pill){
      pill=document.createElement('div');
      pill.id='previewExitPill';
      pill.style.cssText='display:none';
      pill.innerHTML='<span style="font-size:16px;line-height:1">👁</span>';
      pill.title='Exit Player Preview';
      pill.onclick=togglePlayerPreview;
      document.body.appendChild(pill);
    }
    pill.style.display='flex';
  }else{
    document.body.classList.remove('player-preview');
    // Restore admin display
    const teamEl=document.querySelector('.console-team');
    if(teamEl&&teamEl.childNodes[0])teamEl.childNodes[0].textContent='ADMINISTRATOR ';
    // Hide exit pill
    const pill=document.getElementById('previewExitPill');
    if(pill)pill.style.display='none';
  }
  renderGrid();renderFeed();renderMedia();renderIntelForm();renderVaultPanel();
  if(document.getElementById('fvSingle')?.classList.contains('active'))renderSinglePost();
  syncAdminDropdownToggles();
  closeAdminDropdown();
}
// Global keyboard shortcuts
document.addEventListener('keydown',e=>{
  // Media viewer
  if(document.getElementById('mediaViewer').classList.contains('active')){
    if(e.key==='Escape')closeMediaViewer();
    if(e.key==='ArrowLeft')navMedia(-1);
    if(e.key==='ArrowRight')navMedia(1);
    if(e.key===' '&&mvAudio){e.preventDefault();toggleMvAudio()}
    if(e.key===' '&&document.getElementById('mvVideo')){e.preventDefault();toggleMvVideo()}
    return;
  }
  // Feed focus mode — arrow keys navigate posts
  const feedOpen=document.getElementById('expFeed')?.classList.contains('visible');
  if(feedOpen&&currentFeedView==='single'){
    if(e.key==='ArrowLeft'){e.preventDefault();navPost(-1)}
    if(e.key==='ArrowRight'){e.preventDefault();navPost(1)}
    if(e.key==='Escape'){e.preventDefault();setFeedView('grid')}
    return;
  }
  // Vault keypad — type with physical keyboard
  const vaultOpen=document.getElementById('expVault')?.classList.contains('visible');
  if(vaultOpen&&!e.target.closest('input,textarea,select')){
    const key=e.key;
    if(key==='Enter'){e.preventDefault();vkSubmit();return}
    if(key==='Backspace'){e.preventDefault();vkDel();return}
    if(key==='Escape'){e.preventDefault();vkClear();return}
    if(key==='Delete'){e.preventDefault();vkClear();return}
    if(/^[a-zA-Z0-9]$/.test(key)){e.preventDefault();vkType(key.toUpperCase());return}
    if(vkSymMode&&/^[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]$/.test(key)){e.preventDefault();vkType(key);return}
  }
  // Escape closes expanded panel
  if(overlay.classList.contains('active')&&e.key==='Escape'){
    e.preventDefault();closePanel();return;
  }
  // Escape closes landing preview
  if(document.getElementById('landingPreviewOverlay').classList.contains('active')&&e.key==='Escape'){
    e.preventDefault();closeLandingPreview();return;
  }
  // Escape closes theme preview
  if(document.getElementById('themePreviewOverlay').style.display==='flex'&&e.key==='Escape'){
    e.preventDefault();closeThemePreview();return;
  }
  // Arrow keys cycle themes in preview
  if(document.getElementById('themePreviewOverlay').style.display==='flex'){
    if(e.key==='ArrowLeft'){e.preventDefault();cycleThemePreview(-1);return}
    if(e.key==='ArrowRight'){e.preventDefault();cycleThemePreview(1);return}
    if(e.key==='Enter'){e.preventDefault();applyThemeFromPreview();return}
  }
  // Escape closes intel theme preview
  if(document.getElementById('intelThemePreviewOverlay').style.display==='flex'&&e.key==='Escape'){
    e.preventDefault();closeIntelThemePreview();return;
  }
  // Arrow keys cycle intel themes in preview
  if(document.getElementById('intelThemePreviewOverlay').style.display==='flex'){
    if(e.key==='ArrowLeft'){e.preventDefault();cycleIntelThemePreview(-1);return}
    if(e.key==='ArrowRight'){e.preventDefault();cycleIntelThemePreview(1);return}
    if(e.key==='Enter'){e.preventDefault();applyIntelThemeFromPreview();return}
  }
  // Escape closes active admin panels or returns from admin pages
  if(e.key==='Escape'){
    // Admin pages — return to console
    if(_currentAdminPage){e.preventDefault();returnFromAdminPage();return}
    // Broadcast overlay
    const bcEl=document.getElementById('broadcastPanel');
    if(bcEl&&bcEl.classList.contains('active')){e.preventDefault();closeBroadcast();return}
    // Gear dropdown
    const gdd=document.getElementById('gearDropdown');
    if(gdd&&gdd.classList.contains('open')){e.preventDefault();closeGearDropdown();return}
    // Login screen — contextual back
    const curScreen=document.querySelector('.screen.active')?.id||'';
    if(curScreen==='loginScreen'){e.preventDefault();loginBack();return}
    if(curScreen==='regScreen'){e.preventDefault();regBack();return}
    const adminIds=['adminPanel','broadcastPanel','leaderboardModule','keysCodesPanel','dashboardPanel','portalUsersPanel','scoringPanel','registrationPanel','appearancePanel','sessionMgmtPanel','tutorialConfigPanel'];
    for(const id of adminIds){
      const el=document.getElementById(id);
      if(el&&el.classList.contains('active')){
        e.preventDefault();
        if(id==='adminPanel')closeEventSettings();
        else if(id==='broadcastPanel')closeBroadcast();
        else if(id==='leaderboardModule')closeLeaderboard();
        else if(id==='keysCodesPanel')closeKeysCodes();
        else if(id==='dashboardPanel')closeDashboard();
        else if(id==='portalUsersPanel')closePortalUsers();
        else if(id==='scoringPanel')closeScoringPanel();
        else if(id==='registrationPanel')closeRegistrationPanel();
        else if(id==='appearancePanel')closeAppearancePanel();
        else if(id==='sessionMgmtPanel')closeSessionMgmt();
        else if(id==='tutorialConfigPanel')closeTutorialConfig();
        return;
      }
    }
  }
});
document.addEventListener('contextmenu',e=>{
  if(e.target.closest('.feed-card-img')||e.target.closest('.feed-single-img')||e.target.closest('.mv-body')||e.target.closest('.no-download-shield'))e.preventDefault();
});
function exitAdmin(){isAdmin=false;document.body.classList.remove('admin-mode');closeAdminDropdown();closeAdminPanel();closeBroadcast();closeLeaderboard();closeKeysCodes();renderGrid();renderIntelForm()}

