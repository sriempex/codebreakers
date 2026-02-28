// ══════ SAVE BLIP MICRO-FEEDBACK ══════
function showSaveBlip(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.classList.add('show');
  clearTimeout(el._blipTimer);
  el._blipTimer=setTimeout(()=>el.classList.remove('show'),1800);
}
function updateThresholds(){
  activityThresholds.activeToIdle=parseInt(document.getElementById('apThresholdIdle')?.value)||60;
  activityThresholds.idleToSilent=parseInt(document.getElementById('apThresholdSilent')?.value)||300;
  updateTileStates();
  showSaveBlip('blipThresholds');
  saveEventConfigToBackend();
}

// ══════ BACKEND SAVE (debounced) ══════
let _saveConfigTimer=null;
function saveEventConfigToBackend(){
  if(!adminSession)return;
  clearTimeout(_saveConfigTimer);
  _saveConfigTimer=setTimeout(()=>{
    // Cache visual settings to localStorage for instant restore
    try{localStorage.setItem('cb_gridTheme',_currentGridTheme);localStorage.setItem('cb_opName',operationName);if(operationFont)localStorage.setItem('cb_opFont',operationFont)}catch(e){}
    apiCall('saveEventConfig',{config:{
      operationName,operationFont,
      gridTheme:_currentGridTheme,
      fontConfig:fontConfig,
      gridTiles:gridTiles.map(t=>({id:t.id,icon:t.icon,label:t.label,sub:t.sub,labelFont:t.labelFont,subFont:t.subFont})),
      participantMode:regSettings.participantMode,
      leaderboardStyle:regSettings.leaderboardStyle,
      scoringConfig:JSON.stringify(scoringConfig),
      landingTitle:regSettings.landingTitle,
      landingSubtitle:regSettings.landingSubtitle,
      landingBannerUrl:regSettings.landingBannerUrl,
      bannerFallback:regSettings.bannerFallback,
      teamSizeMin:regSettings.teamSizeMin,
      teamSizeMax:regSettings.teamSizeMax,
      maxTeams:regSettings.maxTeams,
      requireEmail:regSettings.requireEmail,
      requirePhone:regSettings.requirePhone,
      requireDept:regSettings.requireDept,
      registrationOpen:regSettings.registrationOpen,
      activeToIdle:activityThresholds.activeToIdle,
      idleToSilent:activityThresholds.idleToSilent,
      vaultMaxAttempts:regSettings.vaultMaxAttempts,
      vaultCooldownSec:regSettings.vaultCooldownSec,
      vaultUnlimitedAttempts:regSettings.vaultUnlimitedAttempts,
      eventStartTime:eventSettings.startTime,
      eventEndTime:eventSettings.endTime,
      eventAutoLock:eventSettings.autoLock,
      eventShowLeaderboardOnExpiry:eventSettings.showLeaderboardOnExpiry,
      allowDownloads:allowDownloads,
      sessionPersist:regSettings.sessionPersist,
      timerMode:timerMode,
      timerSec:timerSec,
      timerOriginal:timerOriginal,
      timerPaused:timerPaused,
      timerStarted:timerStarted,
      eventStartTime:eventSettings.startTime,
      eventEndTime:eventSettings.endTime,
      eventExpired:eventSettings.expired
    }}).then(r=>{});
  },1000); // 1 second debounce
}

let _saveFeedTimer=null;
let _feedSaveInFlight=false;
let _feedSaveCooldown=0; // timestamp — block refreshes until this time (KV eventual consistency guard)
// ── Centralized content version bump ──
// All save functions share a single version stamp to prevent mismatches.
// localStorage is written IMMEDIATELY (so cache restore works on refresh).
// Server call is debounced to avoid duplicate saveEventConfig calls.
let _pendingContentVersion = null;
let _contentVersionTimer = null;
function bumpContentVersion() {
  if (!_pendingContentVersion) _pendingContentVersion = Date.now().toString();
  // Write to localStorage IMMEDIATELY — cache restore depends on this
  try { localStorage.setItem('cb_contentVersion', _pendingContentVersion); } catch(e) {}
  // Debounce the server call so concurrent saves only trigger one saveEventConfig
  clearTimeout(_contentVersionTimer);
  _contentVersionTimer = setTimeout(() => {
    const ver = _pendingContentVersion;
    _pendingContentVersion = null;
    apiCall('saveEventConfig', { config: { contentVersion: ver } });
  }, 2000);
  return _pendingContentVersion;
}

function saveFeedPostsToBackend(){
  if(!adminSession)return;
  clearTimeout(_saveFeedTimer);
  _feedSaveInFlight=true;
  _saveFeedTimer=setTimeout(async()=>{
    _saveFeedTimer=null;
    bumpContentVersion();
    // Retry R2 upload for any local-only media before saving
    for(let i=0;i<posts.length;i++){
      const p=posts[i];
      if(p.mediaUrl&&(p.mediaUrl.startsWith('data:')||p.mediaUrl.startsWith('blob:'))){
        console.log('[FEED] Post',i,'has local-only media, attempting R2 re-upload...');
        try{
          const blob=await(await fetch(p.mediaUrl)).blob();
          const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');
          const file=new File([blob],'feed_'+Date.now()+'_'+i+'.'+ext,{type:blob.type});
          const result=await uploadFileToDrive(file,'feed');
          if(result&&result.directUrl){
            console.log('[FEED] R2 re-upload SUCCESS for post',i,':',result.directUrl.substring(0,80));
            posts[i].mediaUrl=result.directUrl;
            renderFeed();renderGrid();
          }
        }catch(e){
          console.warn('[FEED] R2 re-upload FAILED for post',i,':',e.message);
        }
      }
    }
    const mapped=posts.map(p=>{
      const url=(p.mediaUrl&&(p.mediaUrl.startsWith('data:')||p.mediaUrl.startsWith('blob:')))?'':p.mediaUrl||'';
      return{emoji:p.emoji,bg:p.bg,cap:p.cap,capFont:p.capFont,
        mediaUrl:url,mediaType:p.mediaType,
        focalX:p.focalX||50,focalY:p.focalY||50};
    });
    console.log('[FEED] saveFeedPostsToBackend SENDING',mapped.length,'posts. mediaUrls:',mapped.map(p=>p.mediaUrl?.substring(0,60)));
    apiCall('saveFeedPosts',{posts:mapped}).then(r=>{console.log('[FEED] saveFeedPosts response:',r);if(!r.ok)console.warn('Feed save failed:',r.error)}).finally(()=>{_feedSaveInFlight=false;_feedSaveCooldown=Date.now()+60000});
    _cacheContent('cb_posts',posts);
  },1500);
}

let _saveMediaTimer=null;
let _mediaSaveInFlight=false;
let _mediaSaveCooldown=0;
function saveMediaItemsToBackend(){
  if(!adminSession)return;
  clearTimeout(_saveMediaTimer);
  _mediaSaveInFlight=true;
  _saveMediaTimer=setTimeout(()=>{
    bumpContentVersion();
    apiCall('saveMediaItems',{items:mediaItems.map(_normalizeMediaItem).map(m=>{
      const rawUrl = m.fileUrl || m.url || '';
      const url = (rawUrl&&(rawUrl.startsWith('data:')||rawUrl.startsWith('blob:')))?'':rawUrl;
      // Save both canonical (name/fileUrl/icon) and legacy (title/url/filename) keys for compatibility.
      return{
        type:m.type||'',
        name:m.name||'', fileUrl:url, icon:m.icon||'',
        title:m.name||'', url:url, filename:m.icon||'',
        titleFont:m.nameFont||'',
        nameFont:m.nameFont||'',
        desc:m.desc||'', descFont:m.descFont||'',
        vaultLocked:!!m.vaultLocked,
        unlockKey:m.unlockKey||'',
        unlocked:!!m.unlocked,
        vaultCode:m.vaultCode||'',
        vaultCodename:m.vaultCodename||''
      };
    })}).then(r=>{if(!r.ok)console.warn('Media save failed:',r.error)}).finally(()=>{_mediaSaveInFlight=false;_mediaSaveCooldown=Date.now()+60000});
    _cacheContent('cb_media',mediaItems);
  },1500);
}

let _saveIntelTimer=null;
function saveIntelFieldsToBackend(){
  if(!adminSession)return;
  clearTimeout(_saveIntelTimer);
  _saveIntelTimer=setTimeout(()=>{
    bumpContentVersion();
    apiCall('saveIntelFields',{fields:intelFields.map(f=>({
      label:f.label||'',emoji:f.emoji||'',fieldType:f.type||'text',
      font:f.font||'',inputFont:f.inputFont||'',answer:f.answer||{}
    }))}).then(r=>{});
    _cacheContent('cb_intel',intelFields);
  },1500);
}

// saveVaultCodesToBackend is deprecated — vault codes are now properties of media items
// and persist via saveMediaItemsToBackend(). syncVaultCodesFromMedia() rebuilds the
// runtime vaultCodes array from mediaItems on load and after any edit.

function onParticipantModeChange(){
  regSettings.participantMode=document.getElementById('apParticipantMode')?.value||'team';
  updateLandingForMode();
  buildRegForm();
  showSaveBlip('blipEventSettings');
  saveEventConfigToBackend();
}
function onLeaderboardStyleChange(){
  regSettings.leaderboardStyle=document.getElementById('apLeaderboardStyle')?.value||'mixed';
  showSaveBlip('blipEventSettings');
  saveEventConfigToBackend();
}

// ── Admin Panel ──
const adminPanelIds=['adminPanel','broadcastPanel','leaderboardModule','keysCodesPanel','dashboardPanel','portalUsersPanel','scoringPanel','registrationPanel','appearancePanel','sessionMgmtPanel','tutorialConfigPanel'];

// ══════ LIVE GROUP — Dashboard internal tabs ══════
const dashGroupIds=['dashboardPanel','leaderboardModule','sessionMgmtPanel'];

// ══════ SETUP GROUP — sub-nav between related panels ══════
const setupGroupTabs=[
  {id:'adminPanel',label:'Event',icon:'',subs:[
    {id:'registrationPanel',label:'Registration'},
    {id:'tutorialConfigPanel',label:'Tutorial & Briefing'}
  ]},
  {id:'keysCodesPanel',label:'Intel & Scoring',icon:'',subs:[
    {id:'scoringPanel',label:'Scoring'}
  ]},
  {id:'appearancePanel',label:'Appearance',icon:''},
  {id:'portalUsersPanel',label:'Users & Sessions',icon:''}
];
const setupGroupIds=[];
const setupAllIds={};
setupGroupTabs.forEach(t=>{setupGroupIds.push(t.id);setupAllIds[t.id]=t.id;if(t.subs)t.subs.forEach(s=>{setupGroupIds.push(s.id);setupAllIds[s.id]=t.id})});

function injectSetupNav(activePanelId){
  document.querySelectorAll('.setup-nav').forEach(n=>n.remove());
  const panel=document.getElementById(activePanelId);
  if(!panel)return;
  const header=panel.querySelector('.ap-header,.kc-header,.bc-header,.lb-header');
  if(!header)return;
  let html='';
  setupGroupTabs.forEach(t=>{
    const isParentActive=(t.id===activePanelId)||(t.subs&&t.subs.some(s=>s.id===activePanelId));
    // Main tab
    html+='<button class="setup-nav-btn'+(t.id===activePanelId?' active':'')+'" onclick="switchSetupTab(\''+t.id+'\')">'+t.label+'</button>';
    // Sub-tabs (show only if this parent group is active)
    if(t.subs&&isParentActive){
      t.subs.forEach(s=>{
        html+='<button class="setup-nav-btn'+(s.id===activePanelId?' active':'')+'" onclick="switchSetupTab(\''+s.id+'\')" style="font-size:8px;opacity:.7;padding-left:6px">· '+s.label+'</button>';
      });
    }
  });
  const nav=document.createElement('div');
  nav.className='setup-nav';
  nav.innerHTML=html;
  header.after(nav);
}

function injectDashNav(activePanelId){
  document.querySelectorAll('.dash-nav').forEach(n=>n.remove());
  const panel=document.getElementById(activePanelId);
  if(!panel)return;
  const header=panel.querySelector('.ap-header,.kc-header,.bc-header,.lb-header');
  if(!header)return;
  const tabs=[
    {id:'dashboardPanel',label:'Teams',icon:''},
    {id:'leaderboardModule',label:'Leaderboard',icon:''},
    {id:'sessionMgmtPanel',label:'Sessions',icon:''},
    {id:'broadcastPanel',label:'Broadcast',icon:''}
  ];
  let html='';
  tabs.forEach(t=>{
    html+='<button class="setup-nav-btn'+(t.id===activePanelId?' active':'')+'" onclick="switchDashNavTab(\''+t.id+'\')">'+t.label+'</button>';
  });
  const nav=document.createElement('div');
  nav.className='dash-nav setup-nav';
  nav.innerHTML=html;
  header.after(nav);
}

function switchDashNavTab(panelId){
  switchAdminTab(panelId);
}

function switchSetupTab(panelId){
  switchAdminTab(panelId);
}

function openSetup(subTab){
  switchAdminTab(subTab||'adminPanel');
}
function closeAllAdminPanels(){
  adminPanelIds.forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.classList.remove('active');el.style.cssText=''}
  });
  // Also instant-close content panels
  const ov=document.getElementById('panelOverlay');
  ov.classList.remove('active');
  ov.style.cssText='';
  document.querySelectorAll('.expanded-panel').forEach(p=>p.classList.remove('visible'));
  if(bcMediaRecorder&&bcMediaRecorder.state==='recording')bcMediaRecorder.stop();
  lbExpandedTeam=null;
  hideAdminTabs();
}
function showAdminTabs(activeId){
  const bar=document.getElementById('adminNavBar');
  if(!bar)return;
  bar.classList.add('visible');
  bar.querySelectorAll('.anb-btn').forEach(btn=>{
    // For setup group panels, highlight the Setup button (anb-adminPanel)
    let isActive=btn.id==='anb-'+activeId;
    if(!isActive&&btn.id==='anb-adminPanel'&&setupGroupIds.includes(activeId))isActive=true;
    // For live group panels (broadcast, sessionMgmt), highlight the Live/Dashboard button
    if(!isActive&&btn.id==='anb-dashboardPanel'&&dashGroupIds.includes(activeId))isActive=true;
    btn.classList.toggle('active',isActive);
  });
}
function hideAdminTabs(){
  const bar=document.getElementById('adminNavBar');
  if(bar)bar.classList.remove('visible');
  document.querySelectorAll('.anb-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.setup-nav').forEach(n=>n.remove());
  document.querySelectorAll('.dash-nav').forEach(n=>n.remove());
}
function switchAdminTab(panelId){
  // Determine which group the target panel belongs to
  const _findGroup=function(pid){
    if(dashGroupIds.includes(pid))return 'live';
    if(setupGroupIds.includes(pid))return 'setup';
    return null;
  };
  // Find the currently active admin panel
  const currentPanel=adminPanelIds.find(id=>{const el=document.getElementById(id);return el&&el.classList.contains('active')});
  const currentGroup=currentPanel?_findGroup(currentPanel):null;
  const targetGroup=_findGroup(panelId);
  // If switching within the SAME group, do a smooth content crossfade
  const isSameGroup=currentPanel&&currentPanel!==panelId&&currentGroup&&currentGroup===targetGroup;

  // Common init function for after the panel is visible
  const _initPanel=function(){
    // Debounce backend refresh — avoid redundant fetches on rapid tab switching
    if(adminSession){
      clearTimeout(window._adminTabLoadTimer);
      window._adminTabLoadTimer=setTimeout(function(){loadEventData()},300);
    }
    if(panelId==='adminPanel'){syncAdminPanelSettings()}
    if(panelId==='leaderboardModule'){renderFullLeaderboard()}
    if(panelId==='dashboardPanel'){renderTeamMonitor();startTeamMonitor()}
    if(panelId==='keysCodesPanel'){renderKeysCodes()}
    if(panelId==='portalUsersPanel'){renderPortalUsersList()}
    if(panelId==='scoringPanel'){renderScoringEditor()}
    if(panelId==='registrationPanel'){syncRegistrationSettings()}
    if(panelId==='appearancePanel'){updateThemeLabel();initTypographyPanel()}
    if(panelId==='tutorialConfigPanel'){renderTutorialStepList();const tg=document.getElementById('tutGlobalToggle');if(tg)tg.classList.toggle('on',tutorialEnabled)}
    document.querySelectorAll('.setup-nav').forEach(n=>n.remove());
    if(setupGroupIds.includes(panelId)){injectSetupNav(panelId)}
    document.querySelectorAll('.dash-nav').forEach(n=>n.remove());
    if(dashGroupIds.includes(panelId)){injectDashNav(panelId)}
  };

  if(isSameGroup){
    const outEl=document.getElementById(currentPanel);
    const inEl=document.getElementById(panelId);
    const outContainer=outEl.querySelector('.ap-container,.kc-container,.bc-container,.lb-container');
    const inContainer=inEl.querySelector('.ap-container,.kc-container,.bc-container,.lb-container');
    // Fade out current container content
    if(outContainer){outContainer.style.transition='opacity .1s ease';outContainer.style.opacity='0'}
    setTimeout(function(){
      // Hide old panel instantly
      adminPanelIds.forEach(id=>{
        const el=document.getElementById(id);
        if(el){el.style.cssText='opacity:0;pointer-events:none;transition:none';el.classList.remove('active')}
      });
      // Prep incoming — start container invisible
      if(inContainer){inContainer.style.opacity='0';inContainer.style.transition='none'}
      _instantShow(inEl);
      // Init & inject nav while invisible
      _initPanel();
      // Force reflow then fade in
      if(inContainer)inContainer.offsetHeight;
      if(inContainer){inContainer.style.transition='opacity .1s ease';inContainer.style.opacity='1'}
      // Clean up inline styles after animation
      setTimeout(function(){
        if(outContainer)outContainer.style.cssText='';
        if(inContainer)inContainer.style.cssText='';
      },130);
    },100);
  } else {
    // Normal panel switch (different group or first open)
    adminPanelIds.forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.style.cssText='opacity:0;pointer-events:none;transition:none';el.classList.remove('active')}
    });
    _instantShow(document.getElementById(panelId));
    _initPanel();
  }

  showAdminTabs(panelId);
  saveSession();
}
function syncAdminPanelSettings(){
  renderScoringEditor();
  const minEl=document.getElementById('apMinSize');
  const maxEl=document.getElementById('apMaxSize');
  const maxTEl=document.getElementById('apMaxTeams');
  if(minEl)minEl.value=regSettings.teamSizeMin;
  if(maxEl)maxEl.value=regSettings.teamSizeMax;
  if(maxTEl)maxTEl.value=regSettings.maxTeams;
  const reqE=document.getElementById('apReqEmail');if(reqE)reqE.checked=regSettings.requireEmail;
  const reqP=document.getElementById('apReqPhone');if(reqP)reqP.checked=regSettings.requirePhone;
  const reqD=document.getElementById('apReqDept');if(reqD)reqD.checked=regSettings.requireDept;
  const regO=document.getElementById('apRegOpen');if(regO)regO.checked=regSettings.registrationOpen;
  const status=document.getElementById('apRegStatus');
  if(status){status.textContent=regSettings.registrationOpen?'● OPEN':'● CLOSED';status.style.color=regSettings.registrationOpen?'var(--green)':'var(--red)'}
  const apTimer=document.getElementById('apTimerDisplay');
  if(apTimer)apTimer.textContent=document.getElementById('cTimer').textContent;
  // Sync activity thresholds
  const thIdle=document.getElementById('apThresholdIdle');if(thIdle)thIdle.value=activityThresholds.activeToIdle;
  const thSilent=document.getElementById('apThresholdSilent');if(thSilent)thSilent.value=activityThresholds.idleToSilent;
  // Sync banner preview
  syncBannerPreview();
  // Sync banner fallback
  const fbInput=document.getElementById('apBannerFallback');if(fbInput)fbInput.value=regSettings.bannerFallback||'🔐';
  syncManualCreationUI();
  // Sync downloads checkbox
  const dlCb=document.getElementById('apAllowDownloads');if(dlCb)dlCb.checked=allowDownloads;
}
function _instantShow(el){
  el.style.cssText='opacity:1;pointer-events:all;transition:none';
  el.classList.add('active');
}
let apTimerInterval=null;
// ══════ CHANGE PASSWORD MODAL ══════
function openChangePassword(){
  document.getElementById('changePwModal').style.display='flex';
  document.getElementById('apCurPw').value='';
  document.getElementById('apNewPw').value='';
  document.getElementById('apConfPw').value='';
  document.getElementById('apPwMsg').textContent='';
}
function closeChangePassword(){
  document.getElementById('changePwModal').style.display='none';
}

// ══════ PORTAL USERS PANEL ══════
function openPortalUsers(){
  switchAdminTab('portalUsersPanel');
  refreshAdminList();
  onManualTypeChange();
}
function closePortalUsers(){
  const el=document.getElementById('portalUsersPanel');
  el.style.cssText='';el.classList.remove('active');hideAdminTabs();
}
function renderPortalUsersList(){
  const el=document.getElementById('puCombinedList');
  if(!el)return;
  let html='';
  // Admins first
  adminUsers.forEach((a)=>{
    const isSelf=adminSession&&a.user.toLowerCase()===adminSession.username.toLowerCase();
    const isSuperAdmin=a.role==='superadmin';
    const roleBadge=isSuperAdmin?'SUPER ADMIN':'ADMIN';
    html+=`<div class="ap-team-row">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:1px;padding:2px 8px;border-radius:2px;color:var(--amber);background:rgba(255,170,51,.08);border:1px solid rgba(255,170,51,.15);margin-right:8px;font-weight:600">${roleBadge}</span>
      <span class="ap-team-id">${a.user}</span>
      <span class="ap-team-name" style="color:#555">${isSelf?'(you)':'••••••••'}</span>
      ${!isSuperAdmin&&adminUsers.length>1?`<span class="ap-team-del" onclick="removeAdmin('${a.user}')">✕</span>`:''}
    </div>`;
  });
  // Manual entries
  manualTeams.forEach((t,i)=>{
    const isIndiv=t.type==='individual';
    const badge=isIndiv?'PLAYER':'TEAM';
    const badgeColor=isIndiv?'var(--cyan)':'var(--green)';
    const badgeBg=isIndiv?'rgba(0,212,255,.08)':'rgba(0,255,136,.08)';
    const badgeBorder=isIndiv?'rgba(0,212,255,.15)':'rgba(0,255,136,.15)';
    html+=`<div class="ap-team-row">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:1px;padding:2px 8px;border-radius:2px;color:${badgeColor};background:${badgeBg};border:1px solid ${badgeBorder};margin-right:8px;font-weight:600">${badge}</span>
      <span class="ap-team-id">${t.id}</span>
      <span class="ap-team-name">${t.name}</span>
      <span class="ap-team-del" onclick="removeTeam(${i})">✕</span>
    </div>`;
  });
  if(!html) html='<div style="font-family:Chakra Petch,sans-serif;font-size:10px;color:#555;padding:12px 0;letter-spacing:.5px">No portal users created yet.</div>';
  el.innerHTML=html;
}
function removeManualTeam(i){removeTeam(i)}

// ══════ EVENT CONTROL PANEL ══════
function openEventControl(){
  switchAdminTab('adminPanel');
  syncAdminPanelSettings();
  initTypographyPanel();
  if(apTimerInterval)clearInterval(apTimerInterval);
  apTimerInterval=setInterval(()=>{const el=document.getElementById('apTimerDisplay');if(el)el.textContent=document.getElementById('cTimer').textContent},250);
}
function openAdminPanel(){openEventControl()} // backward compat alias
function closeEventControl(){
  const el=document.getElementById('adminPanel');
  el.style.cssText='';el.classList.remove('active');hideAdminTabs();
  if(apTimerInterval){clearInterval(apTimerInterval);apTimerInterval=null}
}
function closeAdminPanel(){closeEventControl()} // backward compat alias

// ══════ REORGANIZED ADMIN PANEL FUNCTIONS (BUILD 20260223-0600) ══════
let _previewReturnPanel=null;

function openDashboard(){switchAdminTab('dashboardPanel');renderTeamMonitor();startTeamMonitor()}
function closeDashboard(){const el=document.getElementById('dashboardPanel');if(el){el.classList.remove('active');el.style.cssText=''}hideAdminTabs()}

function switchDashTab(tab){
  // Legacy compatibility — redirect to new dash-nav panels
  if(tab==='leaderboard'){switchAdminTab('leaderboardModule')}
  else{switchAdminTab('dashboardPanel');renderTeamMonitor();startTeamMonitor()}
}

function openEventSettings(){switchAdminTab('adminPanel')}
function closeEventSettings(){closeEventControl()}

function openScoringPanel(){switchAdminTab('scoringPanel')}
function closeScoringPanel(){const el=document.getElementById('scoringPanel');if(el){el.classList.remove('active');el.style.cssText=''}hideAdminTabs()}

function openRegistrationPanel(){switchAdminTab('registrationPanel')}
function closeRegistrationPanel(){const el=document.getElementById('registrationPanel');if(el){el.classList.remove('active');el.style.cssText=''}hideAdminTabs()}
function syncRegistrationSettings(){
  const minEl=document.getElementById('apMinSize');const maxEl=document.getElementById('apMaxSize');const maxTEl=document.getElementById('apMaxTeams');
  if(minEl)minEl.value=regSettings.teamSizeMin;if(maxEl)maxEl.value=regSettings.teamSizeMax;if(maxTEl)maxTEl.value=regSettings.maxTeams;
  const reqE=document.getElementById('apReqEmail');if(reqE)reqE.checked=regSettings.requireEmail;
  const reqP=document.getElementById('apReqPhone');if(reqP)reqP.checked=regSettings.requirePhone;
  const reqD=document.getElementById('apReqDept');if(reqD)reqD.checked=regSettings.requireDept;
  const regO=document.getElementById('apRegOpen');if(regO)regO.checked=regSettings.registrationOpen;
  const st=document.getElementById('apRegStatus');
  if(st){st.textContent=regSettings.registrationOpen?'● OPEN':'● CLOSED';st.style.color=regSettings.registrationOpen?'var(--green)':'var(--red)'}
}

function openAppearancePanel(){switchAdminTab('appearancePanel')}
function closeAppearancePanel(){const el=document.getElementById('appearancePanel');if(el){el.classList.remove('active');el.style.cssText=''}hideAdminTabs()}
function openTeamMonitor(){openDashboard()}
function closeTeamMonitor(){closeDashboard()}

function changeAdminPw(){
  const cur=document.getElementById('apCurPw').value;
  const nw=document.getElementById('apNewPw').value;
  const conf=document.getElementById('apConfPw').value;
  const msg=document.getElementById('apPwMsg');
  if(!cur){msg.className='ap-msg err';msg.textContent='✗ Enter current password';return}
  if(nw.length<8){msg.className='ap-msg err';msg.textContent='✗ New password must be at least 8 characters';return}
  if(nw!==conf){msg.className='ap-msg err';msg.textContent='✗ Passwords do not match';return}
  msg.className='ap-msg';msg.textContent='Updating...';
  apiCall('changePassword',{username:adminSession.username,currentPassword:cur,newPassword:nw}).then(r=>{
    if(r.ok){
      msg.className='ap-msg ok';msg.textContent='✓ Password updated successfully';
      document.getElementById('apCurPw').value='';document.getElementById('apNewPw').value='';document.getElementById('apConfPw').value='';
    }else{
      msg.className='ap-msg err';msg.textContent='✗ '+r.error;
    }
  });
}

function addAdmin(){
  const u=document.getElementById('apAddUser').value.trim();
  const p=document.getElementById('apAddPw').value.trim();
  const msg=document.getElementById('apAdminMsg');
  if(!u||!p){msg.className='ap-msg err';msg.textContent='✗ Username and password required';return}
  msg.className='ap-msg';msg.textContent='Adding...';
  apiCall('addAdmin',{newUsername:u,newPassword:p}).then(r=>{
    if(r.ok){
      msg.className='ap-msg ok';msg.textContent='✓ Admin "'+u+'" added';
      document.getElementById('apAddUser').value='';document.getElementById('apAddPw').value='';
      refreshAdminList();
    }else{
      msg.className='ap-msg err';msg.textContent='✗ '+r.error;
    }
  });
}
function removeAdmin(username){
  if(!confirm('Remove admin "'+username+'"?'))return;
  apiCall('removeAdmin',{targetUsername:username}).then(r=>{
    if(r.ok)refreshAdminList();
    else alert(r.error);
  });
}
function refreshAdminList(){
  apiCall('listAdmins').then(r=>{
    if(r.ok){
      adminUsers=r.admins.map(a=>({user:a.username,role:a.role,createdAt:a.createdAt}));
      renderPortalUsersList();
    }
  });
}
function renderAdminList(){renderPortalUsersList()} // backward compat

function createManualTeam(){
  const effectiveType=document.getElementById('apManualType')?.value||'team';
  const name=document.getElementById('apTeamName').value.trim();
  const id=document.getElementById('apTeamId').value.trim()||'';
  const msg=document.getElementById('apTeamMsg');
  if(!name){msg.className='ap-msg err';msg.textContent='✗ Name required';return}
  msg.className='ap-msg';msg.textContent='Creating...';
  apiCall('createManualTeam',{teamName:name,teamId:id,type:effectiveType}).then(r=>{
    if(r.ok){
      msg.className='ap-msg ok';msg.textContent=`✓ ${effectiveType==='individual'?'Participant':'Team'} "${name}" created with ID: ${r.teamId}`;
      document.getElementById('apTeamName').value='';document.getElementById('apTeamId').value='';
      // Add to local cache
      const team={id:r.teamId,name:r.teamName||name,type:effectiveType,members:[],memberDetails:[],lastActive:Date.now(),fieldsCompleted:0,submitTime:null,registeredAt:new Date().toISOString(),submissionResults:null};
      manualTeams.push(team);
      registeredTeams.push(team);
      renderPortalUsersList();
    }else{
      msg.className='ap-msg err';msg.textContent='✗ '+r.error;
    }
  });
}
function onManualTypeChange(){
  const t=document.getElementById('apManualType')?.value||'team';
  const isInd=t==='individual';
  document.getElementById('apManualNameLabel').textContent=isInd?'Participant Name':'Team Name';
  document.getElementById('apManualIdLabel').textContent=isInd?'Participant ID (leave blank to auto-generate)':'Team ID (leave blank to auto-generate)';
  document.getElementById('apTeamName').placeholder=isInd?'e.g. Jane Doe':'e.g. Alpha Squad';
  document.getElementById('apManualCreateBtn').textContent=isInd?'Create Participant':'Create Team';
}
function syncManualCreationUI(){
  // Type dropdown is always visible in Portal Users — just sync labels to current selection
  onManualTypeChange();
}
function autoGenTeamId(){const name=document.getElementById('apTeamName').value.trim()||'TEAM';document.getElementById('apTeamId').value=generateTeamId(name)}
function removeTeam(i){
  const team=manualTeams[i];
  if(!team)return;
  if(!confirm('Remove "'+team.name+'" ('+team.id+')?'))return;
  apiCall('removeTeam',{teamId:team.id}).then(r=>{
    if(r.ok){
      manualTeams.splice(i,1);
      const ri=registeredTeams.findIndex(t=>t.id===team.id);
      if(ri>=0)registeredTeams.splice(ri,1);
      renderPortalUsersList();
    }else{
      alert(r.error||'Failed to remove team');
    }
  });
}
function renderTeamList(){renderPortalUsersList()} // backward compat

// ── Team Monitor (Activity Tracking) ──
const INACTIVE_THRESHOLD=5*60*1000; // fallback
let registeredTeams=[]; // Will be populated from backend; for now demo data
let teamMonitorInterval=null;

function initDemoTeams(){
  // Teams now loaded from backend via loadEventData()
  // This function kept for backward compatibility
  if(registeredTeams.length===0){
    registeredTeams=[];
  }
}
initDemoTeams();

function isTeamActive(t){
  const threshold=(activityThresholds.activeToIdle||120)*1000;
  return(Date.now()-t.lastActive)<threshold;
}
function isTeamIdle(t){
  const activeThreshold=(activityThresholds.activeToIdle||120)*1000;
  const ghostThreshold=(activityThresholds.idleToSilent||600)*1000;
  const elapsed=Date.now()-t.lastActive;
  return elapsed>=activeThreshold&&elapsed<ghostThreshold;
}
function isTeamGhost(t){
  const ghostThreshold=(activityThresholds.idleToSilent||600)*1000;
  return(Date.now()-t.lastActive)>=ghostThreshold;
}
function removeGhostTeam(teamId){
  const idx=registeredTeams.findIndex(t=>t.id===teamId);
  if(idx===-1)return;
  if(!confirm('Remove ghost team "'+registeredTeams[idx].name+'"? This only removes them from the local view — use Clear Data in settings to fully purge from the backend.'))return;
  registeredTeams.splice(idx,1);
  renderTeamMonitor();renderFullLeaderboard();renderLeaderboard();
}
function timeSince(ts){
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return s+'s ago';
  if(s<3600)return Math.floor(s/60)+'m ago';
  return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m ago';
}

function renderTeamMonitor(){
  var el=document.getElementById('apTeamMonitor');
  if(!el)return;
  var active=registeredTeams.filter(function(t){return isTeamActive(t)});
  var idle=registeredTeams.filter(function(t){return isTeamIdle(t)});
  var ghosts=registeredTeams.filter(function(t){return isTeamGhost(t)});
  document.getElementById('apActiveCount').textContent=active.length;
  document.getElementById('apInactiveCount').textContent=idle.length;
  document.getElementById('apTotalCount').textContent=registeredTeams.length;
  var ghostEl=document.getElementById('apGhostCount');
  if(ghostEl){ghostEl.closest('.ap-status-pill').style.display=ghosts.length?'':'none';ghostEl.textContent=ghosts.length}
  var sorted=[].concat(
    active.sort(function(a,b){return b.lastActive-a.lastActive}),
    idle.sort(function(a,b){return b.lastActive-a.lastActive}),
    ghosts.sort(function(a,b){return b.lastActive-a.lastActive})
  );
  var totalPages=Math.max(1,Math.ceil(sorted.length/tmPerPage));
  if(tmCurrentPage>=totalPages)tmCurrentPage=totalPages-1;
  var startIdx=tmCurrentPage*tmPerPage;
  var pageTeams=sorted.slice(startIdx,startIdx+tmPerPage);
  var headerRow='<div class="ap-monitor-row" style="border-bottom:1px solid var(--border);padding-bottom:4px;margin-bottom:4px;opacity:.5"><input type="checkbox" onchange="tmToggleAll(this.checked)" style="margin-right:4px;accent-color:#ff4444"><div class="ap-monitor-dot" style="visibility:hidden"></div><span class="ap-monitor-id" style="font-size:8px;letter-spacing:2px">ID</span><span class="ap-monitor-name" style="font-size:8px;letter-spacing:2px;flex:1">TEAM</span></div>';
  el.innerHTML=pageTeams.length?headerRow+pageTeams.map(function(t){
    var ghost=isTeamGhost(t);
    var on=isTeamActive(t);
    var idleState=isTeamIdle(t);
    var dotClass=on?'on':idleState?'idle':'off';
    var rowClass=ghost?'ghost':on?'active':'idle';
    var statusTag=ghost?'<span class="ap-monitor-ghost-tag">GHOST</span>':idleState?'<span class="ap-monitor-idle-tag">IDLE</span>':'';
    var removeBtn=ghost?'<span class="ap-monitor-remove" onclick="event.stopPropagation();removeGhostTeam(\''+t.id+'\')" title="Remove ghost">\u2715</span>':'';
    var msgBtn='<span class="lb-msg-btn" onclick="event.stopPropagation();sendTeamMessage(\''+t.id+'\',\''+t.name.replace(/'/g,"\\'")+'\')" style="margin-left:auto">\uD83D\uDCAC</span>';
    return '<div class="ap-monitor-row '+rowClass+'"><input type="checkbox" class="tm-nuke-check" data-team="'+t.id+'" onchange="tmUpdateNukeBar()" onclick="event.stopPropagation()" style="margin-right:4px;accent-color:#ff4444"><div class="ap-monitor-dot '+dotClass+'"></div><span class="ap-monitor-id">'+t.id+'</span><span class="ap-monitor-name">'+t.name+'</span>'+statusTag+msgBtn+removeBtn+'</div>';
  }).join(''):'<div style="font-family:Chakra Petch,sans-serif;font-size:9px;color:#555;padding:12px 0;text-align:center">No teams registered yet</div>';
  renderPagination('tmPagination',sorted.length,tmPerPage,tmCurrentPage,function(p){tmCurrentPage=p;renderTeamMonitor()});
  tmUpdateNukeBar();
}
function tmToggleAll(checked){
  document.querySelectorAll('.tm-nuke-check').forEach(function(cb){cb.checked=checked});
  tmUpdateNukeBar();
}
function tmUpdateNukeBar(){
  var checked=document.querySelectorAll('.tm-nuke-check:checked');
  var bar=document.getElementById('tmNukeBar');
  var count=document.getElementById('tmNukeCount');
  if(checked.length>0){bar.style.display='flex';count.textContent=checked.length+' selected'}
  else{bar.style.display='none'}
}
function renderLeaderboard(){
  const el=document.getElementById('apLeaderboard');
  if(!el)return;
  if(!registeredTeams.length){el.innerHTML='<div class="ap-lb-empty">No teams registered yet</div>';return}

  const maxFields=intelFields.length||1;
  const sorted=[...registeredTeams].sort((a,b)=>{
    const aScore=a.submissionResults?a.submissionResults.totalScore:0;
    const bScore=b.submissionResults?b.submissionResults.totalScore:0;
    if(bScore!==aScore)return bScore-aScore;
    if(a.submitTime&&b.submitTime)return a.submitTime.localeCompare(b.submitTime);
    if(a.submitTime)return -1;if(b.submitTime)return 1;
    return b.lastActive-a.lastActive;
  });

  el.innerHTML=sorted.slice(0,5).map((t,i)=>{
    const rank=i+1;
    const rc=rank===1?'gold':rank===2?'silver':rank===3?'bronze':'std';
    const score=t.submissionResults?t.submissionResults.totalScore:0;
    const possible=t.submissionResults?t.submissionResults.totalPossible:(maxFields*10);
    const pct=possible?Math.round((score/possible)*100):0;
    const correct=t.submissionResults?t.submissionResults.correctCount:0;
    const barColor=rank===1?'#ffd700':rank===2?'#c0c0c0':rank===3?'#cd7f32':'#444';
    return `<div class="ap-lb-row">
      <div class="ap-lb-rank ${rc}">#${rank}</div>
      <div class="ap-lb-info">
        <div class="ap-lb-name">${t.name}</div>
        <div class="ap-lb-meta">${t.id} · ${t.submitTime?correct+'/'+maxFields+' correct · '+score+' pts':'Not submitted'}</div>
        <div class="ap-lb-bar" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="ap-lb-score ${rc}">${t.submitTime?pct+'%':'—'}</div>
    </div>`;
  }).join('');
}

// Team monitor — hash-checked refresh + live backend data fetch
let _tmLastHash='',_lbLastHash='';
function startTeamMonitor(){
  if(teamMonitorInterval)clearInterval(teamMonitorInterval);
  teamMonitorInterval=setInterval(async()=>{
    // Fetch teams and submissions from backend every tick
    const [teamsResult, subResult] = await Promise.all([
      apiCall('getTeams'),
      apiCall('getSubmissions')
    ]);
    if(teamsResult.ok&&teamsResult.teams){
      registeredTeams.length=0;manualTeams.length=0;
      teamsResult.teams.forEach(t=>{
        const team={id:t.teamId,name:t.teamName,type:t.type,members:t.members.map(m=>typeof m==='string'?m:m.name),memberDetails:t.members,lastActive:new Date(t.lastActive).getTime(),fieldsCompleted:0,submitTime:null,registeredAt:t.registeredAt,submissionResults:null};
        if(t.manual)manualTeams.push(team);
        registeredTeams.push(team);
      });
    }
    if(subResult.ok&&subResult.submissions){
      subResult.submissions.forEach(s=>{
        const team=registeredTeams.find(t=>t.id===s.teamId);
        if(team){
          team.submitTime=s.submittedAt;
          team.submissionResults={totalScore:s.score,totalPossible:s.totalPossible||0,correctCount:s.correct,totalFields:s.total};
          team.fieldsCompleted=s.correct||0;
        }
      });
    }
    // Only re-render if data actually changed (prevents flicker)
    const tmHash=_teamDataHash();
    if(document.getElementById('dashboardPanel').classList.contains('active')&&tmHash!==_tmLastHash){
      _tmLastHash=tmHash;
      renderTeamMonitor();
    }
    if(document.getElementById('leaderboardModule').classList.contains('active')&&tmHash!==_lbLastHash&&(Date.now()-_lbUserInteractedAt)>5000){
      _lbLastHash=tmHash;
      renderFullLeaderboard();
    }
  },3000);
}
function _teamDataHash(){
  let h=registeredTeams.length;
  for(let i=0;i<registeredTeams.length;i++){
    const t=registeredTeams[i];
    h=((h<<5)-h+(t.fieldsCompleted||0))|0;
    h=((h<<5)-h+(t.submitTime?1:0))|0;
    h=((h<<5)-h+(t.submissionResults?t.submissionResults.totalScore:0))|0;
    // Include activity status so ghost→active triggers re-render
    const status=isTeamActive(t)?2:isTeamIdle(t)?1:0;
    h=((h<<5)-h+status)|0;
    for(let j=0;j<t.name.length;j++)h=((h<<5)-h+t.name.charCodeAt(j))|0;
  }
  // Include expanded team so user interaction doesn't get stomped
  if(lbExpandedTeam)for(let j=0;j<lbExpandedTeam.length;j++)h=((h<<5)-h+lbExpandedTeam.charCodeAt(j))|0;
  return String(h);
}

// ── Full Leaderboard Module ──
let lbFilter='all';
let lbExpandedTeam=null;

function openLeaderboard(){
  switchAdminTab('leaderboardModule');
  renderFullLeaderboard();
}
function closeLeaderboard(){
  const el=document.getElementById('leaderboardModule');
  el.style.cssText='';el.classList.remove('active');
  lbExpandedTeam=null;hideAdminTabs();
}
function setLbFilter(btn,f){
  document.querySelectorAll('.lb-filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');lbFilter=f;
  renderFullLeaderboard();
}

function getSortedTeams(){
  const sort=document.getElementById('lbSort')?.value||'score';
  const search=(document.getElementById('lbSearch')?.value||'').toLowerCase();
  const maxFields=intelFields.length||1;

  let teams=[...registeredTeams];

  // Filter
  if(lbFilter==='active')teams=teams.filter(isTeamActive);
  else if(lbFilter==='inactive')teams=teams.filter(t=>!isTeamActive(t)&&!isTeamGhost(t));
  else if(lbFilter==='ghost')teams=teams.filter(isTeamGhost);
  else if(lbFilter==='submitted')teams=teams.filter(t=>t.submitTime);

  // Search
  if(search)teams=teams.filter(t=>t.name.toLowerCase().includes(search)||t.id.toLowerCase().includes(search));

  // Sort
  teams.sort((a,b)=>{
    switch(sort){
      case 'score':{
        const aScore=a.submissionResults?a.submissionResults.totalScore:0;
        const bScore=b.submissionResults?b.submissionResults.totalScore:0;
        if(bScore!==aScore)return bScore-aScore;
        if(a.submitTime&&b.submitTime)return a.submitTime.localeCompare(b.submitTime);
        if(a.submitTime)return -1;if(b.submitTime)return 1;
        return b.lastActive-a.lastActive;
      }
      case 'fields':return b.fieldsCompleted-a.fieldsCompleted;
      case 'recent':return b.lastActive-a.lastActive;
      case 'name':return a.name.localeCompare(b.name);
      case 'registered':return(a.registeredAt||'').localeCompare(b.registeredAt||'');
      default:return 0;
    }
  });
  return teams;
}

let lbPerPage=15,lbCurrentPage=0;
let tmPerPage=15,tmCurrentPage=0;

function renderFullLeaderboard(){
  var body=document.getElementById('lbBody');
  if(!body)return;
  var teams=getSortedTeams();
  var maxFields=intelFields.length||1;
  var totalPossiblePts=intelFields.reduce(function(s,f){return s+((f.answer&&f.answer.points)||10)},0);
  var totalPages=Math.max(1,Math.ceil(teams.length/lbPerPage));
  if(lbCurrentPage>=totalPages)lbCurrentPage=totalPages-1;
  var startIdx=lbCurrentPage*lbPerPage;
  var pageTeams=teams.slice(startIdx,startIdx+lbPerPage);
  document.getElementById('lbTeamCount').textContent=teams.length+' team'+(teams.length!==1?'s':'');
  var adminActions=document.getElementById('lbAdminActions');
  if(adminActions)adminActions.style.display=isAdmin?'':'none';
  if(!teams.length){
    body.innerHTML='<div style="text-align:center;padding:40px 0"><div style="font-size:40px;opacity:.3;margin-bottom:12px">🏆</div><div style="font-family:Chakra Petch,sans-serif;font-size:11px;color:#555">No teams match your filters</div></div>';
    renderPagination('lbPagination',teams.length,lbPerPage,lbCurrentPage,function(p){lbCurrentPage=p;renderFullLeaderboard()});
    return;
  }
  body.innerHTML=pageTeams.map(function(t,idx){
    var rank=startIdx+idx+1;
    var rc=rank===1?'r1':rank===2?'r2':rank===3?'r3':'rn';
    var on=isTeamActive(t);
    var ghost=isTeamGhost(t);
    var expanded=lbExpandedTeam===t.id;
    var actualScore=t.submissionResults?t.submissionResults.totalScore:0;
    var correctCount=t.submissionResults?t.submissionResults.correctCount:0;
    var scorePct=totalPossiblePts?Math.round((actualScore/totalPossiblePts)*100):0;
    var barColor=rank===1?'#ffd700':rank===2?'#c0c0c0':rank===3?'#cd7f32':'#333';
    // Meta line: score + submission status
    var metaParts=[t.id];
    if(t.submitTime){
      metaParts.push(correctCount+'/'+maxFields+' correct');
      metaParts.push(actualScore+' pts');
      metaParts.push('✓ Submitted');
    }else{
      metaParts.push(actualScore>0?actualScore+' pts':'Awaiting submission');
    }
    var metaHtml=metaParts.map(function(p){
      if(p.indexOf('✓')===0)return '<span style="color:var(--green)">'+p+'</span>';
      return '<span>'+p+'</span>';
    }).join('');
    // Expanded detail
    var detailHtml='';
    if(expanded){
      var members=t.memberDetails||t.members||[];
      var membersHtml=members.map(function(m,mi){
        var name=typeof m==='string'?m:m.name;
        var dept=m.dept||'';var email=m.email||'';
        return '<div class="lb-member-row"><div class="lb-member-num">'+(mi+1)+'</div><span class="lb-member-name">'+name+'</span><span class="lb-member-meta">'+(dept?dept:'')+(dept&&email?' · ':'')+(email?email:'')+'</span></div>';
      }).join('');
      var fieldsHtml='';
      if(t.submissionResults){
        var sr=t.submissionResults;
        fieldsHtml='<div style="display:flex;flex-direction:column;gap:6px;padding:4px 0"><div class="lb-field-row"><span class="lb-field-label">Correct Answers</span><span class="lb-field-status correct">'+(sr.correctCount||0)+' / '+(sr.totalFields||maxFields)+'</span></div><div class="lb-field-row"><span class="lb-field-label">Score</span><span class="lb-field-status '+(sr.totalScore>0?'correct':'empty')+'">'+(sr.totalScore||0)+' / '+totalPossiblePts+' pts</span></div></div>';
      }else{
        fieldsHtml='<div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#555;padding:8px 0">'+(t.submitTime?'Submitted — awaiting scoring':'Awaiting submission')+'</div>';
      }
      var msgBtn2=isAdmin?'<button class="lb-msg-btn" onclick="event.stopPropagation();sendTeamMessage(\''+t.id+'\',\''+t.name.replace(/'/g,"\\'")+'\')">💬 Message Team</button>':'';
      var desubBtn=isAdmin&&t.submitTime?'<button class="lb-desub-btn" onclick="event.stopPropagation();desubmitTeam(\''+t.id+'\')">↩ De-submit</button>':'';
      detailHtml='<div class="lb-detail"><div class="lb-detail-section"><div class="lb-detail-title">👥 Team Members</div>'+membersHtml+'</div><div class="lb-detail-section"><div class="lb-detail-title">📋 Field Status</div>'+fieldsHtml+'</div><div class="lb-detail-section"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+msgBtn2+desubBtn+'</div></div><div class="lb-detail-section"><div style="display:flex;gap:16px;flex-wrap:wrap;font-family:IBM Plex Mono,monospace;font-size:8px;color:#666;letter-spacing:1px"><span>Registered: '+(t.registeredAt?new Date(t.registeredAt).toLocaleTimeString():'-')+'</span>'+(t.submitTime?'<span>Submitted: '+new Date(t.submitTime).toLocaleTimeString()+'</span>':'')+'</div></div></div>';
    }
    var checkbox=isAdmin&&t.submitTime?'<input type="checkbox" class="lb-desubmit-check" data-team="'+t.id+'" onclick="event.stopPropagation()">':'';
    return '<div class="lb-row'+(expanded?' expanded':'')+(ghost?' ghost':'')+'" onclick="toggleLbTeam(\''+t.id+'\')"><div class="lb-row-main">'+checkbox+'<div class="lb-rank '+rc+'">#'+rank+'</div><div class="lb-team-status '+(on?'on':'off')+'"></div><div class="lb-team-info"><div class="lb-team-name">'+t.name+'</div><div class="lb-team-meta">'+metaHtml+'</div></div><div class="lb-score-block"><div class="lb-score-pct '+rc+'">'+(t.submitTime?scorePct:0)+'%</div><div class="lb-score-label">'+(t.submitTime?actualScore+' PTS':'—')+'</div></div></div><div class="lb-progress"><div class="lb-progress-fill" style="width:'+(t.submitTime?scorePct:0)+'%;background:'+barColor+'"></div></div>'+detailHtml+'</div>';
  }).join('');
  renderPagination('lbPagination',teams.length,lbPerPage,lbCurrentPage,function(p){lbCurrentPage=p;renderFullLeaderboard()});
}

let _lbUserInteractedAt=0;
function toggleLbTeam(id){
  lbExpandedTeam=lbExpandedTeam===id?null:id;
  _lbLastHash='';
  _lbUserInteractedAt=Date.now();
  renderFullLeaderboard();
}

// ── Shared Pagination Renderer ──
function renderPagination(containerId,total,perPage,currentPage,onPageChange){
  const el=document.getElementById(containerId);
  if(!el)return;
  const totalPages=Math.ceil(total/perPage);
  if(totalPages<=1){el.innerHTML='';return}
  let html='';
  html+=`<button class="lb-page-btn${currentPage===0?' disabled':''}" onclick="event.stopPropagation()">◂ Prev</button>`;
  // Show max 7 page buttons with ellipsis
  const maxBtns=7;
  let startP=Math.max(0,currentPage-3);
  let endP=Math.min(totalPages-1,startP+maxBtns-1);
  if(endP-startP<maxBtns-1)startP=Math.max(0,endP-maxBtns+1);
  if(startP>0)html+=`<button class="lb-page-btn" data-p="0">1</button><span class="lb-page-info">…</span>`;
  for(let p=startP;p<=endP;p++){
    html+=`<button class="lb-page-btn${p===currentPage?' active':''}" data-p="${p}">${p+1}</button>`;
  }
  if(endP<totalPages-1)html+=`<span class="lb-page-info">…</span><button class="lb-page-btn" data-p="${totalPages-1}">${totalPages}</button>`;
  html+=`<button class="lb-page-btn${currentPage>=totalPages-1?' disabled':''}" data-p="${currentPage+1}">Next ▸</button>`;
  html+=`<span class="lb-page-info">${currentPage*perPage+1}–${Math.min(total,(currentPage+1)*perPage)} of ${total}</span>`;
  el.innerHTML=html;
  el.querySelectorAll('.lb-page-btn:not(.disabled)').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const txt=btn.textContent;
      if(txt.includes('Prev'))onPageChange(Math.max(0,currentPage-1));
      else if(txt.includes('Next'))onPageChange(Math.min(totalPages-1,currentPage+1));
      else if(btn.dataset.p!==undefined)onPageChange(parseInt(btn.dataset.p));
    });
  });
}

// ── Direct Team Messaging ──
function sendTeamMessage(teamId,teamName){
  showEditModal(`<h3>💬 Message: ${teamName}</h3>
    <div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#666;letter-spacing:1px;margin-bottom:10px">Team ID: ${teamId} · Message will display as a banner on their screen</div>
    <div class="edit-field"><label>Message</label><textarea id="tmMsgText" rows="3" placeholder="Type a message to this team..." style="width:100%;background:#080a10;border:1px solid var(--border);border-radius:4px;padding:10px;color:var(--green);font-family:Chakra Petch,sans-serif;font-size:12px;outline:none;resize:vertical"></textarea></div>
    <div style="display:flex;gap:10px;margin-top:12px"><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><span style="flex:1"></span><button class="btn-standard btn-cyan" onclick="dispatchTeamMessage('${teamId}')">📡 Send Message</button></div>`);
}
function dispatchTeamMessage(teamId){
  const msg=document.getElementById('tmMsgText')?.value.trim();
  if(!msg)return;
  // Send as targeted broadcast via backend — [TO:TEAMID] prefix tells player poll to filter
  const targetMsg='[TO:'+teamId+'] '+msg;
  apiCall('sendBroadcast',{message:targetMsg,type:'text'}).then(r=>{
    if(r.ok){
      hideEditModal();
      const flash=document.createElement('div');
      flash.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.3);border-radius:6px;padding:10px 20px;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--cyan);letter-spacing:1px;animation:fadeIn .3s ease';
      flash.textContent='✓ Message sent to '+teamId;
      document.body.appendChild(flash);
      setTimeout(()=>flash.remove(),2500);
    }else{
      alert('Failed to send message: '+(r.error||'Unknown error'));
    }
  });
}

// ── De-submit Mechanism ──
function desubmitTeam(teamId){
  const team=registeredTeams.find(t=>t.id===teamId);
  if(!team)return;
  team.submitTime=null;
  team.submissionResults=null;
  team.isSubmitted=false;
  // Clear on backend
  apiCall('desubmitTeam',{teamId:teamId}).then(r=>{});
  // Notification
  if(!window.teamMessages)window.teamMessages={};
  if(!window.teamMessages[teamId])window.teamMessages[teamId]=[];
  window.teamMessages[teamId].push({text:'Your submission has been reopened for revision by the administrator.',time:new Date().toISOString(),read:false,type:'system'});
  if(currentTeam&&currentTeam.id===teamId){
    isSubmitted=false;
    renderIntelForm();
    showPlayerBanner('text','Your submission has been reopened for revision. You may update your answers and re-submit.');
  }
  renderFullLeaderboard();
  renderLeaderboard();
}
function desubmitSelected(){
  const checks=document.querySelectorAll('.lb-desubmit-check:checked');
  if(!checks.length){
    alert('No teams selected. Expand a submitted team\'s row to use individual de-submit, or check the boxes next to submitted teams.');
    return;
  }
  if(!confirm(`De-submit ${checks.length} team(s)? Their submissions will be unlocked for revision.`))return;
  checks.forEach(cb=>{
    const teamId=cb.dataset.team;
    if(teamId)desubmitTeam(teamId);
  });
}
function desubmitAll(){
  const submitted=registeredTeams.filter(t=>t.submitTime);
  if(!submitted.length){alert('No teams have submitted yet.');return}
  if(!confirm(`De-submit ALL ${submitted.length} team(s)? Every submission will be unlocked for revision.`))return;
  submitted.forEach(t=>desubmitTeam(t.id));
}

// ── Keys & Codes Panel ──
function openKeysCodes(){
  switchAdminTab('keysCodesPanel');
  renderKeysCodes();
}
function closeKeysCodes(){const el=document.getElementById('keysCodesPanel');el.style.cssText='';el.classList.remove('active');hideAdminTabs()}

function renderKeysCodes(){
  const body=document.getElementById('kcBody');
  let html='';

  // Vault Locked Items (driven by media items with vaultLocked + vaultCode)
  const vaultLockedMedia=mediaItems.filter(m=>m.vaultLocked);
  html+=`<div class="kc-section">
    <div class="kc-section-title" style="margin-bottom:4px">🔐 Vault Locked Items (${vaultLockedMedia.length})</div>
    <div style="font-family:Chakra Petch,sans-serif;font-size:9px;color:#666;margin-bottom:8px">Items marked as Vault-Locked in the Evidence Locker. Edit any item there to set or change its Vault Code.</div>
    <button class="ap-btn ap-btn-amber" onclick="openVaultLockPicker()" style="font-size:9px;padding:5px 12px;margin-bottom:10px">＋ Vault Lock Item</button>`;
  if(vaultLockedMedia.length){
    vaultLockedMedia.forEach(m=>{
      const idx=mediaItems.indexOf(m);
      const vaultEntry=vaultCodes.find(c=>c.linkedMediaIdx===idx);
      html+=`<div class="kc-row" style="border-color:${m.vaultCode?'rgba(255,170,51,.15)':'rgba(255,51,51,.1)'}">
        <span class="kc-icon">${m.icon}</span>
        <span class="kc-label">${m.name}<br><span style="font-size:8px;color:#555">${m.desc||''}</span></span>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <input value="${m.vaultCode||''}" placeholder="Set vault code…" style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;background:#080a10;border:1px solid ${m.vaultCode?'rgba(255,170,51,.3)':'var(--border)'};border-radius:3px;padding:4px 10px;color:var(--amber);width:140px;outline:none;text-align:center" oninput="this.value=this.value.toUpperCase()" onchange="updateMediaVaultCode(${idx},this.value)">
          <span style="font-family:'Chakra Petch',sans-serif;font-size:8px;color:#555">${vaultEntry&&vaultEntry.unlocked?'✓ UNLOCKED':m.vaultCode?'Active':'No code set'}</span>
        </div>
        <span class="kc-edit" onclick="editMediaItem(${idx})">✎</span>
      </div>`;
    });
  }else{
    html+=`<div style="font-family:Chakra Petch,sans-serif;font-size:9px;color:#555;padding:4px 0">No vault-locked items. Edit an Evidence Locker item and enable the Vault-Locked toggle to add one.</div>`;
  }
  // Vault attempt settings
  html+=`<div style="margin-top:12px;padding:10px 14px;border:1px solid var(--border);border-radius:4px;background:rgba(255,255,255,.01)">
    <div style="font-family:Saira,sans-serif;font-size:9px;color:#888;letter-spacing:2px;font-weight:600;text-transform:uppercase;margin-bottom:8px">Vault Security Settings</div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="kcVaultUnlimited" ${regSettings.vaultUnlimitedAttempts?'checked':''} onchange="regSettings.vaultUnlimitedAttempts=this.checked"><span style="font-family:Chakra Petch,sans-serif;font-size:10px;color:#aaa">Unlimited attempts</span></label>
      <div style="display:flex;align-items:center;gap:6px"><span style="font-family:Chakra Petch,sans-serif;font-size:10px;color:#888">Max tries:</span><input type="number" id="kcVaultMaxAttempts" value="${regSettings.vaultMaxAttempts}" min="1" max="50" style="width:50px;background:#080a10;border:1px solid var(--border);border-radius:3px;padding:4px 8px;color:var(--green);font-family:IBM Plex Mono,monospace;font-size:11px;text-align:center;outline:none" onchange="regSettings.vaultMaxAttempts=parseInt(this.value)||5"></div>
      <div style="display:flex;align-items:center;gap:6px"><span style="font-family:Chakra Petch,sans-serif;font-size:10px;color:#888">Cooldown:</span><input type="number" id="kcVaultCooldown" value="${regSettings.vaultCooldownSec}" min="5" max="600" style="width:60px;background:#080a10;border:1px solid var(--border);border-radius:3px;padding:4px 8px;color:var(--green);font-family:IBM Plex Mono,monospace;font-size:11px;text-align:center;outline:none" onchange="regSettings.vaultCooldownSec=parseInt(this.value)||30"><span style="font-family:Chakra Petch,sans-serif;font-size:10px;color:#555">sec</span></div>
    </div>
  </div>`;
  html+=`</div>`;

  // Locked Media Keys
  const lockedItems=mediaItems.filter(m=>m.type==='locked');
  html+=`<div class="kc-section">
    <div class="kc-section-title">Locked File Decryption Keys (${lockedItems.length})</div>`;
  if(lockedItems.length){
    lockedItems.forEach((m,li)=>{
      const idx=mediaItems.indexOf(m);
      html+=`<div class="kc-row">
        <span class="kc-icon">${m.icon}</span>
        <span class="kc-label">${m.name}<br><span style="font-size:8px;color:#555">${m.desc}</span></span>
        <span class="kc-value">${m.unlockKey||'<span class="kc-empty">any key</span>'}</span>
        <span class="kc-edit" onclick="editMediaItem(${idx})">✎</span>
      </div>`;
    });
  }else{
    html+=`<div style="font-family:Chakra Petch,sans-serif;font-size:9px;color:#555;padding:8px 0">No locked files configured</div>`;
  }
  html+=`</div>`;

  // Answer Keys Summary
  html+=`<div class="kc-section">
    <div class="kc-section-title">Intel Answer Keys (${intelFields.length})</div>`;
  intelFields.forEach((f,i)=>{
    const a=f.answer||{};
    const exp=a.expected?.filter(e=>e.trim())||[];
    const alts=a.alts||[];
    const allAnswers=[...exp,...alts].filter(Boolean);
    html+=`<div class="kc-row">
      <span class="kc-icon">${f.emoji}</span>
      <span class="kc-label">${f.label}<br><span style="font-size:8px;color:#555">${a.matchMode||'exact'} · ${a.caseSensitive?'Case Sensitive':'Case Insensitive'} · Fuzzy: ${a.fuzzyThreshold||85}% · ${a.points||10}pts</span></span>
      <span class="kc-value" style="min-width:auto;font-size:10px">${allAnswers.length?allAnswers.join(', '):'<span class="kc-empty">not set</span>'}</span>
      <span class="kc-edit" onclick="editIntelField(${i})">✎</span>
    </div>`;
  });
  html+=`</div>`;

  body.innerHTML=html;
}

// Update vault code directly from the Keys & Codes panel inline input
function updateMediaVaultCode(mediaIdx,newCode){
  if(!mediaItems[mediaIdx])return;
  mediaItems[mediaIdx].vaultCode=newCode.trim().toUpperCase();
  syncVaultCodesFromMedia();
  renderVaultPanel();
  saveMediaItemsToBackend();
}

// Vault code management functions (addVaultCode, editVaultCode, etc.) removed.
// Vault codes are now set directly on media items via editMediaItem() and
// syncVaultCodesFromMedia() rebuilds the runtime vaultCodes lookup array.

// ── Broadcast System ──
let bcMode='text';
let bcMediaRecorder=null;
let bcAudioChunks=[];
let bcRecordedBlob=null;
let bcBannerAudio=null;

function openBroadcast(){
  // Navigate to settings broadcast tab
  navigateToAdmin('settingsScreen','dash-broadcast');
}
function closeBroadcast(){
  const el=document.getElementById('broadcastPanel');
  el.style.cssText='';el.classList.remove('active');
  if(bcMediaRecorder&&bcMediaRecorder.state==='recording')bcMediaRecorder.stop();
}
function switchBcTab(btn,tab){
  document.querySelectorAll('.bc-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
  document.getElementById('bcTextTab').style.display=tab==='text'?'':'none';
  document.getElementById('bcVoiceTab').style.display=tab==='voice'?'':'none';
  bcMode=tab;
}

function toggleRecording(){
  const btn=document.getElementById('bcRecBtn');
  const label=document.getElementById('bcRecLabel');
  if(bcMediaRecorder&&bcMediaRecorder.state==='recording'){
    bcMediaRecorder.stop();btn.classList.remove('recording');label.textContent='Processing...';
    return;
  }
  bcAudioChunks=[];bcRecordedBlob=null;
  document.getElementById('bcPreview').style.display='none';
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
    bcMediaRecorder=new MediaRecorder(stream);
    bcMediaRecorder.ondataavailable=e=>{if(e.data.size>0)bcAudioChunks.push(e.data)};
    bcMediaRecorder.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      bcRecordedBlob=new Blob(bcAudioChunks,{type:'audio/webm'});
      const url=URL.createObjectURL(bcRecordedBlob);
      document.getElementById('bcAudioPreview').src=url;
      document.getElementById('bcPreview').style.display='block';
      label.textContent='Recording ready — preview above';
    };
    bcMediaRecorder.start();btn.classList.add('recording');label.textContent='🔴 Recording... tap to stop';
  }).catch(()=>{label.innerHTML='<span style="color:var(--amber)">⚠ Microphone access denied — check browser permissions</span>'});
}

function sendBroadcast(){
  if(bcMode==='text'){
    const msg=document.getElementById('bcMessage').value.trim();
    if(!msg)return;
    apiCall('sendBroadcast',{message:msg,type:'text'}).then(r=>{
      if(r.ok){
        document.getElementById('bcMessage').value='';
        closeBroadcast();
        const flash=document.createElement('div');
        flash.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,255,136,.12);border:1px solid rgba(0,255,136,.3);border-radius:6px;padding:10px 20px;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--green);letter-spacing:1px';
        flash.textContent='✓ Broadcast sent to all teams';
        document.body.appendChild(flash);
        setTimeout(()=>flash.remove(),3000);
      }else{
        alert('Broadcast failed: '+(r.error||'Unknown error')+'\nYou may need to re-login as admin.');
      }
    });
  } else {
    if(!bcRecordedBlob){return}
    uploadFileToDrive(new File([bcRecordedBlob],'broadcast_'+Date.now()+'.webm',{type:bcRecordedBlob.type}),'broadcasts').then(result=>{
      apiCall('sendBroadcast',{message:result.directUrl,type:'voice'}).then(r=>{
        if(r.ok){
          bcRecordedBlob=null;
          document.getElementById('bcPreview').style.display='none';
          document.getElementById('bcRecLabel').textContent='Tap to record';
          closeBroadcast();
        }
      });
    }).catch(err=>{
      bcRecordedBlob=null;
      document.getElementById('bcPreview').style.display='none';
      closeBroadcast();
    });
  }
}

// ── Broadcast Polling (players check for new messages) ──
let _lastBroadcastTime='';
let _broadcastPollInterval=null;

// ── Player Activity Tracker ──
// Tracks clicks, scrolls, keypresses, touches — debounced to avoid spam.
// The broadcast poll reads _lastPlayerActivity to include in heartbeat.
let _lastPlayerActivity=0;
let _activityListenersAttached=false;
function startActivityTracker(){
  if(_activityListenersAttached||isAdmin)return;
  _activityListenersAttached=true;
  function markActive(){_lastPlayerActivity=Date.now()}
  ['click','scroll','keydown','touchstart','pointerdown'].forEach(function(evt){
    document.addEventListener(evt,markActive,{passive:true,capture:true});
  });
  // Mark active immediately on start
  markActive();
}

function startBroadcastPolling(){
  if(_broadcastPollInterval)clearInterval(_broadcastPollInterval);
  if(isAdmin)return;
  _lastBroadcastTime=new Date().toISOString();
  _broadcastPollInterval=setInterval(async()=>{
    if(!currentVaultTeam)return;
    // Parallel fetch — broadcasts + config session check
    const [r, cfg] = await Promise.all([
      apiCall('getBroadcasts',{since:_lastBroadcastTime,teamId:(_lastPlayerActivity&&(Date.now()-_lastPlayerActivity)<(activityThresholds.activeToIdle||120)*1000)?currentVaultTeam?.id:undefined}),
      apiCall('getEventConfig')
    ]);
    if(r.ok&&r.broadcasts&&r.broadcasts.length>0){
      r.broadcasts.forEach(b=>{
        _lastBroadcastTime=b.sentAt;
        // Filter targeted messages: [TO:TEAMID] prefix
        const targetMatch=b.message.match(/^\[TO:([^\]]+)\]\s*/);
        if(targetMatch){
          if(currentVaultTeam&&targetMatch[1]===currentVaultTeam.id){
            showPlayerBanner(b.type,b.message.replace(/^\[TO:[^\]]+\]\s*/,''));
          }
        }else{
          showPlayerBanner(b.type,b.message);
        }
      });
    }
    // Lightweight session generation check (cfg already fetched in parallel above)
    if(cfg.ok&&cfg.config){
      const serverGen=String(cfg.config.sessionGenTeam||'0');
      const localGen=localStorage.getItem('cb_sessionGen')||'0';
      if(localGen!=='0'&&serverGen!=='0'&&localGen!==serverGen){
        clearSession();location.reload();return;
      }
      try{localStorage.setItem('cb_sessionGen',serverGen)}catch(e){}
      // Sync appearance settings pushed by admin
      if(cfg.config.consoleBgColor||cfg.config.consoleBgTexture)syncConsoleBgFromConfig(cfg.config);
      if(cfg.config.intelTheme)applyIntelTheme(cfg.config.intelTheme);
    }
  },5000);
}

let bannerDismissTimer=null;
let bannerProgressInterval=null;
let notifications=[];

function showPlayerBanner(type,content){
  const banner=document.getElementById('playerBanner');
  const icon=document.getElementById('pbIcon');
  const body=document.getElementById('pbContent');
  const progress=document.getElementById('pbProgress');
  playNotification();

  // Store notification and update badge (players only)
  if(!isAdmin){
    notifications.unshift({type,content,time:new Date().toLocaleTimeString(),read:false});
    updateNotificationBadge();
  }

  if(type==='text'){
    icon.textContent='📢';
    body.innerHTML=`<span class="pb-text">${content}</span>`;
  } else {
    icon.textContent='🎙️';
    body.innerHTML=`<div class="pb-audio"><span class="pb-audio-label">Incoming audio from Administrator</span><div class="pb-audio-play" id="pbAudioPlay" onclick="event.stopPropagation();toggleBannerAudio()">▶</div></div>`;
    bcBannerAudio=new Audio(content);
    bcBannerAudio.addEventListener('ended',()=>{document.getElementById('pbAudioPlay').textContent='▶'});
  }

  // Auto-dismiss after 10 seconds with progress bar
  if(bannerDismissTimer)clearTimeout(bannerDismissTimer);
  if(bannerProgressInterval)clearInterval(bannerProgressInterval);
  if(progress)progress.style.width='100%';
  const duration=10000;
  const start=Date.now();
  bannerProgressInterval=setInterval(()=>{
    const elapsed=Date.now()-start;
    const remaining=Math.max(0,1-elapsed/duration);
    if(progress)progress.style.width=(remaining*100)+'%';
    if(remaining<=0)clearInterval(bannerProgressInterval);
  },50);
  bannerDismissTimer=setTimeout(()=>dismissBanner(),duration);

  banner.classList.add('show');
}
function toggleBannerAudio(){
  if(!bcBannerAudio)return;
  const btn=document.getElementById('pbAudioPlay');
  if(bcBannerAudio.paused){bcBannerAudio.play();btn.textContent='⏸'}
  else{bcBannerAudio.pause();btn.textContent='▶'}
}
function dismissBanner(){
  document.getElementById('playerBanner').classList.remove('show');
  if(bcBannerAudio){bcBannerAudio.pause();bcBannerAudio=null}
  if(bannerDismissTimer){clearTimeout(bannerDismissTimer);bannerDismissTimer=null}
  if(bannerProgressInterval){clearInterval(bannerProgressInterval);bannerProgressInterval=null}
  const progress=document.getElementById('pbProgress');if(progress)progress.style.width='0';
}
function playNotification(){
  const c=getAudio();if(!c)return;
  const t=c.currentTime;
  [0,.12,.24].forEach((off,i)=>{
    const freq=[800,1000,1200][i];
    const o=c.createOscillator();o.type='sine';o.frequency.value=freq;
    const g=c.createGain();g.gain.setValueAtTime(.06,t+off);g.gain.exponentialRampToValueAtTime(.001,t+off+.15);
    o.connect(g);g.connect(c.destination);o.start(t+off);o.stop(t+off+.15);
  });
}

function updateNotificationBadge(){
  const badge=document.getElementById('teamNotifBadge');
  const unread=notifications.filter(n=>!n.read).length;
  if(badge){
    badge.textContent=unread;
    badge.classList.toggle('has-notifs',unread>0);
  }
}
function renderNotifications(){
  const list=document.getElementById('teamNotifList');
  if(!list)return;
  if(!notifications.length){list.innerHTML='<div class="notif-empty">No notifications yet</div>';return}
  list.innerHTML=notifications.map((n,i)=>{
    if(n.type==='voice'){
      return `<div class="team-card-notif-item"><span class="notif-time">${n.time}</span><span class="notif-voice-row">🎙️ Voice message <span class="notif-play-btn" onclick="event.stopPropagation();playNotifAudio(${i})" id="notifPlay${i}">▶</span></span></div>`;
    }
    return `<div class="team-card-notif-item"><span class="notif-time">${n.time}</span>${n.content}</div>`;
  }).join('');
}

let _notifAudio=null;
function playNotifAudio(idx){
  const n=notifications[idx];
  if(!n||n.type!=='voice')return;
  const btn=document.getElementById('notifPlay'+idx);
  if(_notifAudio){
    _notifAudio.pause();
    // Reset all play buttons
    document.querySelectorAll('.notif-play-btn').forEach(b=>b.textContent='▶');
    if(_notifAudio._notifIdx===idx){_notifAudio=null;return}
  }
  _notifAudio=new Audio(n.content);
  _notifAudio._notifIdx=idx;
  _notifAudio.play();
  if(btn)btn.textContent='⏸';
  _notifAudio.addEventListener('ended',()=>{if(btn)btn.textContent='▶';_notifAudio=null});
}
function clearNotifications(){
  notifications=[];
  updateNotificationBadge();
  renderNotifications();
}
// Mark notifications as read when team card is opened
function onTeamCardOpen(){
  notifications.forEach(n=>n.read=true);
  updateNotificationBadge();
  renderNotifications();
}

// ── Vault Keypad Symbol Toggle ──
let symMode=false;
const symRows=[
  ['!','@','#','$','%','^','&','*','(',')'],
  ['-','_','=','+','[',']','{','}','|'],
  [';',':','"','<','>','/','.']
];
const alphaRows=[
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M']
];
// Symbol toggle (legacy) — vault puzzle uses vkToggleSymbols

