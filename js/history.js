// ═══════════════════════════════════════════════════════════════
// BROWSER HISTORY — Back button / gesture support (Fix #3)
// ═══════════════════════════════════════════════════════════════
// Push history states when navigating so Android back gesture / iOS
// swipe-back and browser back button work instead of leaving the site.
(function(){
  let _navDepth=0; // track how deep we are to avoid over-popping
  const _historyEnabled=true;

  // Push a state when navigating deeper
  window._histPush=function(stateType){
    if(!_historyEnabled)return;
    _navDepth++;
    history.pushState({type:stateType,depth:_navDepth},'');
  };

  // Pop handler — reverse the last navigation
  window.addEventListener('popstate',function(e){
    if(!_historyEnabled)return;
    const state=e.state;
    _navDepth=Math.max(0,_navDepth-1);

    // Determine what to close based on current UI state
    // Priority: media viewer > feed focus > expanded panel > admin panel > screen nav

    // 1. Media viewer open?
    const mv=document.getElementById('mediaViewer');
    if(mv&&mv.classList.contains('active')){
      closeMediaViewer();return;
    }

    // 2. Feed in focus/single mode?
    const feedPanel=document.getElementById('expFeed');
    if(feedPanel&&feedPanel.classList.contains('visible')&&currentFeedView==='single'){
      setFeedView('grid');return;
    }

    // 3. Any expanded panel open?
    const openExpPanel=document.querySelector('.expanded-panel.visible');
    if(openExpPanel){
      closePanel();return;
    }

    // 4. Any admin panel open?
    const adminIds=['adminPanel','broadcastPanel','leaderboardModule','keysCodesPanel','dashboardPanel','portalUsersPanel','scoringPanel','registrationPanel','appearancePanel','sessionMgmtPanel','tutorialConfigPanel'];
    for(const id of adminIds){
      const el=document.getElementById(id);
      if(el&&el.classList.contains('active')){
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

    // 5. On console screen — go back to landing
    const curScreen=document.querySelector('.screen.active')?.id||'';
    if(curScreen==='consoleScreen'&&!isAdmin){
      // Don't actually log out — just show landing. User can log back in easily.
      showScreen('landingScreen');return;
    }
    if(curScreen==='loginScreen'){loginBack();return}
    if(curScreen==='regScreen'){regBack();return}

    // 6. Nothing to go back to — push a state so we don't leave the site
    if(_navDepth<=0){
      history.pushState({type:'root'},'');
      _navDepth=1;
    }
  });

  // Seed initial state so first back press doesn't leave the site
  if(!history.state){
    history.replaceState({type:'root',depth:0},'');
  }
})();

// ── Build stamp & cache staleness check (admin only) ──
const _BUILD_ID = '20260225-DEBUG';
// Security: HTML sanitizer to prevent XSS
function sanitizeHTML(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#x27;')}
(function(){
  function showBuildStamp(dateStr,status,hint){
    if(!document.body.classList.contains('admin-mode'))return;
    const el=document.getElementById('buildStamp');
    if(!el)return;
    el.style.display='block';
    el.textContent=(dateStr?'Updated '+dateStr+' - ':'')+status;
    el.style.color=status.startsWith('✓')?'#2a6a3a':status.startsWith('⚠')?'#8a6a10':'#333';
    if(hint)el.title=hint;
  }
  function formatLastMod(header){
    if(!header)return '';
    try{
      var d=new Date(header);
      if(isNaN(d))return '';
      var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var h=d.getHours(),m=d.getMinutes();
      var ampm=h>=12?'PM':'AM';
      var h12=h%12||12;
      return months[d.getMonth()]+' '+d.getDate()+', '+h12+':'+String(m).padStart(2,'0')+ampm;
    }catch(e){return ''}
  }

  function checkCache(){
    if(!document.body.classList.contains('admin-mode'))return;
    fetch(window.location.pathname+'?_v='+Date.now(),{method:'HEAD',cache:'no-store'})
      .then(r=>{
        var lastMod=formatLastMod(r.headers.get('last-modified'));
        var etag=r.headers.get('etag')||r.headers.get('cf-cache-status')||'';
        var lastEtag=localStorage.getItem('cb_last_etag');
        if(!lastEtag){
          localStorage.setItem('cb_last_etag',etag);
          showBuildStamp(lastMod,'✓ Cache OK','ETag stored. Future refreshes will detect stale cache.');
        } else if(etag && etag!==lastEtag){
          localStorage.setItem('cb_last_etag',etag);
          showBuildStamp(lastMod,'✓ Fresh deploy','Server returned a new ETag. You are running the latest version.');
        } else {
          var cfStatus=r.headers.get('cf-cache-status')||'';
          if(cfStatus==='HIT'){
            showBuildStamp(lastMod,'⚠ CF cache HIT','Cloudflare serving cached version. Purge cache then hard-refresh.');
          } else {
            showBuildStamp(lastMod,'✓ Cache OK'+(cfStatus?' - CF: '+cfStatus:''),'File appears current.');
          }
        }
      })
      .catch(function(){showBuildStamp('','Build '+_BUILD_ID,'Could not verify cache status.')});
  }

  setTimeout(function(){checkCache()},1200);
  document.addEventListener('adminReady',function(){setTimeout(checkCache,800)});
})();

// Apply stored operation font via centralized helper
if(operationFont)applyOperationFont(operationFont);

