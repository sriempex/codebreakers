// ══════ PAGE-BASED ADMIN NAVIGATION ══════
let _gearReturnScreen='consoleScreen';
let _gearReturnPanel=null;
let _currentAdminPage=null; // 'settingsScreen' when on admin page, null otherwise

function handleGearClick(){
  const dd=document.getElementById('gearDropdown');
  if(dd.classList.contains('open')){
    closeGearDropdown();
    // If on an admin page, return to where we came from
    if(_currentAdminPage){returnFromAdminPage()}
  }else{
    // If already on an admin page, just show dropdown to switch
    if(_currentAdminPage){
      openGearDropdown();
    }else{
      openGearDropdown();
    }
  }
}

function openGearDropdown(){
  document.getElementById('gearDropdown').classList.add('open');
}
function closeGearDropdown(){
  document.getElementById('gearDropdown').classList.remove('open');
}

// Close gear dropdown when clicking outside
document.addEventListener('click',function(e){
  const dd=document.getElementById('gearDropdown');
  const gear=document.getElementById('adminGearIcon');
  if(dd&&dd.classList.contains('open')&&!dd.contains(e.target)&&gear&&!gear.contains(e.target)){closeGearDropdown()}
});

function navigateToAdmin(screenId,tabId){
  // Remember where we came from (only if coming from non-admin screen)
  if(!_currentAdminPage){
    _gearReturnScreen=_currentScreen;
    // Remember open panel
    const openPanelEl=document.querySelector('.expanded-panel.visible');
    _gearReturnPanel=openPanelEl?openPanelEl.id:null;
  }
  _currentAdminPage='settingsScreen';
  // Move panels into page sections if not already done
  mountAdminPanels();
  showScreen('settingsScreen');
  initSettingsPage();
  // If a specific tab was requested, switch to it
  if(tabId){
    _switchToTab('settingsScreen',tabId);
  }
  // Refresh data in background — no re-switch needed, renders update in-place
  loadEventData();
  updateGearIcon();
  updatePreviewIcon();
}

// Helper: switch to a tab and auto-find its button
function _switchToTab(screenId,tabId){
  var tabBtn=null;
  var screen=document.getElementById(screenId);
  if(screen){
    screen.querySelectorAll('.admin-page-tab').forEach(function(t){
      var onc=t.getAttribute('onclick')||'';
      if(onc.indexOf("'"+tabId+"'")>-1){tabBtn=t}
    });
  }
  switchPageTab(screenId,tabId,tabBtn);
}

function returnFromAdminPage(){
  // Unmount panels back to body so overlays still work for backward compat
  _currentAdminPage=null;
  showScreen(_gearReturnScreen);
  // Restore open panel if any
  if(_gearReturnPanel){
    const panelMap={expFeed:'feed',expMedia:'media',expIntel:'intel',expVault:'vault'};
    const tileId=panelMap[_gearReturnPanel];
    if(tileId)setTimeout(function(){openPanel(tileId)},100);
    _gearReturnPanel=null;
  }
  updateGearIcon();
  updatePreviewIcon();
}

function updateGearIcon(){
  const gear=document.getElementById('adminGearIcon');
  if(gear)gear.classList.toggle('active',!!_currentAdminPage);
}

function updatePreviewIcon(){
  const icon=document.getElementById('adminPreviewIcon');
  if(!icon)return;
  // Hide preview icon on admin settings page
  if(_currentAdminPage){
    icon.style.display='none';
  }else{
    icon.style.display='';
    icon.classList.toggle('active',document.body.classList.contains('player-preview'));
  }
}

let _panelsMounted=false;
function mountAdminPanels(){
  if(_panelsMounted)return;
  _panelsMounted=true;
  // Settings sections
  var setEvent=document.getElementById('set-event');
  var setIntel=document.getElementById('set-intel');
  var setAppearance=document.getElementById('set-appearance');
  var setUsers=document.getElementById('set-users');
  // Event tab: config + registration + tutorial
  if(setEvent){
    setEvent.appendChild(document.getElementById('adminPanel'));
    setEvent.appendChild(document.getElementById('registrationPanel'));
    setEvent.appendChild(document.getElementById('tutorialConfigPanel'));
  }
  // Intel & Scoring tab: keys/codes + scoring
  if(setIntel){
    setIntel.appendChild(document.getElementById('keysCodesPanel'));
    setIntel.appendChild(document.getElementById('scoringPanel'));
  }
  // Appearance tab
  if(setAppearance)setAppearance.appendChild(document.getElementById('appearancePanel'));
  // Users tab
  if(setUsers)setUsers.appendChild(document.getElementById('portalUsersPanel'));
  // Dashboard sections (now inside settings)
  var dashTeams=document.getElementById('dash-teams');
  var dashLb=document.getElementById('dash-leaderboard');
  var dashSessions=document.getElementById('dash-sessions');
  var dashBroadcast=document.getElementById('dash-broadcast');
  if(dashTeams)dashTeams.appendChild(document.getElementById('dashboardPanel'));
  if(dashLb)dashLb.appendChild(document.getElementById('leaderboardModule'));
  if(dashSessions)dashSessions.appendChild(document.getElementById('sessionMgmtPanel'));
  if(dashBroadcast)dashBroadcast.appendChild(document.getElementById('broadcastPanel'));
}

function initSettingsPage(){
  var allPanels=['adminPanel','scoringPanel','registrationPanel','tutorialConfigPanel','keysCodesPanel','appearancePanel','portalUsersPanel','dashboardPanel','leaderboardModule','sessionMgmtPanel','broadcastPanel'];
  allPanels.forEach(function(id){
    var el=document.getElementById(id);
    if(el){el.style.cssText='';el.classList.add('active')}
  });
  // Init the active tab's content (after config hydration to avoid value flicker)
  if(!window.__configHydrated){
    document.documentElement.classList.add('is-hydrating-settings');
    // Run once config lands
    document.addEventListener('cb:configHydrated', function _once(){
      // Re-run init now that config is in place
      try{initSettingsPage()}catch(e){}
    }, {once:true});
    return;
  }
  var activeSection=document.querySelector('#settingsScreen .admin-page-section.active');
  if(activeSection){
    var sid=activeSection.id;
    if(sid==='set-event'){syncAdminPanelSettings();syncRegistrationSettings();renderTutorialStepList();var tg=document.getElementById('tutGlobalToggle');if(tg)tg.classList.toggle('on',tutorialEnabled)}
    if(sid==='set-intel'){renderKeysCodes();renderScoringEditor()}
    if(sid==='set-appearance'){updateThemeLabel();initTypographyPanel()}
    if(sid==='set-users'){renderPortalUsersList();refreshAdminList()}
    if(sid==='dash-teams'){renderTeamMonitor();startTeamMonitor()}
    if(sid==='dash-leaderboard'){renderFullLeaderboard()}
  }
}

function switchPageTab(screenId,sectionId,btn){
  // Switch active tab button
  const screen=document.getElementById(screenId);
  if(!screen)return;
  screen.querySelectorAll('.admin-page-tab').forEach(function(t){t.classList.remove('active')});
  if(btn)btn.classList.add('active');
  // Switch active section
  screen.querySelectorAll('.admin-page-section').forEach(function(s){s.classList.remove('active')});
  var section=document.getElementById(sectionId);
  if(section)section.classList.add('active');
  // Init content for the activated section (after config hydration to avoid value flicker)
  if(!window.__configHydrated){
    document.documentElement.classList.add('is-hydrating-settings');
    // Remember desired tab and hydrate later
    window.__pendingSettingsTab=sectionId;
    document.addEventListener('cb:configHydrated', function _once(){
      try{
        var target=window.__pendingSettingsTab||'set-event';
        window.__pendingSettingsTab=null;
        // Re-run tab activation now that config is ready
        switchPageTab(screenId,target,screen.querySelector('.admin-page-tab.active'));
      }catch(e){}
    }, {once:true});
    saveSession();
    return;
  }
  if(sectionId==='set-event'){syncAdminPanelSettings();syncRegistrationSettings();renderTutorialStepList();var tg=document.getElementById('tutGlobalToggle');if(tg)tg.classList.toggle('on',tutorialEnabled)}
  if(sectionId==='set-intel'){renderKeysCodes();renderScoringEditor()}
  if(sectionId==='set-appearance'){updateThemeLabel();initTypographyPanel()}
  if(sectionId==='set-users'){renderPortalUsersList();refreshAdminList()}
  if(sectionId==='dash-teams'){renderTeamMonitor();startTeamMonitor()}
  if(sectionId==='dash-leaderboard'){renderFullLeaderboard()}
  if(sectionId==='dash-sessions'){renderSessionMgmt&&renderSessionMgmt()}
  if(sectionId==='dash-broadcast'){initBroadcastPanel&&initBroadcastPanel()}
  // Persist current tab state
  saveSession();
}

// Override togglePlayerPreview to update icon
var _origTogglePlayerPreview=togglePlayerPreview;
togglePlayerPreview=function(){
  _origTogglePlayerPreview();
  updatePreviewIcon();
};

// ═══════════════════════════════════════════════════════════════
// DEFERRED RESTORE — runs AFTER all let/const declarations
// to avoid Temporal Dead Zone errors from restoreSession()
// ═══════════════════════════════════════════════════════════════
(function(){
  // Apply deferred grid theme variable (declared above as let)
  if(window._deferredGridTheme){
    _currentGridTheme=window._deferredGridTheme;
    delete window._deferredGridTheme;
  }
  // Execute deferred admin navigation (after DOM is ready)
  function _runDeferredAdminRestore(){
    if(!window._deferredAdminRestore) return;
    var page=window._deferredAdminRestore.page||'settingsScreen';
    var tab=window._deferredAdminRestore.tab||null;

    _gearReturnScreen='consoleScreen';

    // Ensure the target screen exists before navigating.
    // IMPORTANT: do NOT delete the deferred object until we successfully navigate,
    // otherwise the DOMContentLoaded retry will have nothing to restore.
    var el=document.getElementById(page);
    if(!el){
      document.addEventListener('DOMContentLoaded',function(){_runDeferredAdminRestore();},{once:true});
      return;
    }

    delete window._deferredAdminRestore;
    navigateToAdmin(page,tab);
  }
  _runDeferredAdminRestore()
})();

