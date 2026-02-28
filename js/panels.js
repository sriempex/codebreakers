// ══════ INTERACTION RELIABILITY PATCHES ══════
// Some mobile/trackpad combos occasionally swallow 'click' on complex tiles (esp. when overlay divs exist).
// We add delegated pointer/click handling so grid + evidence items open reliably with a single tap/click.
function _installInteractionDelegates(){
  const fg=document.getElementById('feedGridView');
  if(fg && !fg.__ddBound){
    fg.__ddBound=true;
    let down=null;
    let _lastOpen=0;
    function _openPostOnce(idx){
      const now=Date.now();
      if(now-_lastOpen<300) return; // debounce double-fires
      _lastOpen=now;
      try{openPost(parseInt(idx,10));}catch(err){}
    }
    fg.addEventListener('pointerdown',e=>{
      const card=e.target.closest('.feed-card');
      if(!card) return;
      if(e.target.closest('.drag-handle')||e.target.closest('.admin-edit-btn')) return;
      if(e.button!==undefined && e.button!==0) return;
      down={x:e.clientX,y:e.clientY,idx:card.dataset.idx,pt:e.pointerType||'mouse',t:Date.now()};
    },{passive:true});
    fg.addEventListener('pointerup',e=>{
      if(!down) return;
      const card=e.target.closest('.feed-card');
      if(!card || card.dataset.idx!==down.idx){ down=null; return; }
      const dx=Math.abs(e.clientX-down.x), dy=Math.abs(e.clientY-down.y);
      if(dx<=10 && dy<=10){
        _openPostOnce(down.idx);
      }
      down=null;
    },{passive:true});
    fg.addEventListener('click',e=>{
      if(e.target.closest('.drag-handle')||e.target.closest('.admin-edit-btn')) return;
      const card=e.target.closest('.feed-card');
      if(!card) return;
      _openPostOnce(card.dataset.idx);
    });
  }

  const ml=document.getElementById('mediaList');
  if(ml && !ml.__ddBound){
    ml.__ddBound=true;
    let down=null;
    let _lastOpen=0;
    function _openMediaOnce(idx){
      const now=Date.now();
      if(now-_lastOpen<300) return;
      _lastOpen=now;
      try{openMediaViewer(parseInt(idx,10));}catch(err){}
    }
    ml.addEventListener('pointerdown',e=>{
      const item=e.target.closest('.media-exp-item');
      if(!item) return;
      if(e.button!==undefined && e.button!==0) return;
      down={x:e.clientX,y:e.clientY,idx:item.dataset.idx,pt:e.pointerType||'mouse'};
    },{passive:true});
    ml.addEventListener('pointerup',e=>{
      if(!down) return;
      const item=e.target.closest('.media-exp-item');
      if(!item || item.dataset.idx!==down.idx){ down=null; return; }
      const dx=Math.abs(e.clientX-down.x), dy=Math.abs(e.clientY-down.y);
      if(dx<=10 && dy<=10){
        _openMediaOnce(down.idx);
      }
      down=null;
    },{passive:true});
    ml.addEventListener('click',e=>{
      const item=e.target.closest('.media-exp-item');
      if(!item) return;
      _openMediaOnce(item.dataset.idx);
    });
  }
}

// ══════ PANELS ══════
const overlay=document.getElementById('panelOverlay');
let currentFeedView='grid';
function _syncPanelIcon(tileId){
  const tile=gridTiles.find(t=>t.id===tileId);if(!tile)return;
  const panelMap={feed:'expFeed',media:'expMedia',intel:'expIntel',vault:'expVault'};
  const panel=document.getElementById(panelMap[tileId]);if(!panel)return;
  const iconEl=panel.querySelector('.panel-icon');if(!iconEl)return;
  const isImg=tile.icon.startsWith('http')||tile.icon.startsWith('data:');
  if(isImg){iconEl.innerHTML='<img src="'+tile.icon+'" style="width:18px;height:18px;object-fit:contain;vertical-align:middle">';}
  else{iconEl.textContent=tile.icon;}
}
function openPanel(t){playTileClick();recordTileAccess(t);adminPanelIds.forEach(id=>{const el=document.getElementById(id);if(el){el.classList.remove('active');el.style.cssText=''}});document.querySelectorAll('.expanded-panel').forEach(p=>p.classList.remove('visible'));document.getElementById({feed:'expFeed',media:'expMedia',intel:'expIntel',vault:'expVault'}[t]).classList.add('visible');_syncPanelIcon(t);_instantShow(overlay);if(window._histPush)window._histPush('panel');saveSession();if(!isAdmin&&currentVaultTeam)apiCall('heartbeat',{teamId:currentVaultTeam.id});
  if(t==='feed'){renderFeed();setFeedView('grid');_refreshPanelData('feed')}if(t==='media'){renderMedia();_refreshPanelData('media')}if(t==='intel'){renderIntelForm();restoreIntelDraft();_refreshPanelData('intel')}if(t==='vault'){renderVaultPanel();_refreshPanelData('vault')}}

// Fresh data fetch on panel open — ensures frontend matches backend
function _refreshPanelData(panel){
  if(_isTutorialRunning())return; // Don't refresh during tutorial — causes badge flicker
  if(panel==='feed'){
    if(_saveFeedTimer||_feedSaveInFlight||Date.now()<_feedSaveCooldown){console.log('[FEED] Refresh blocked — save pending/inflight/cooldown');return}
    apiCall('getFeedPosts').then(r=>{
      if(r.ok&&r.posts){
        // Smart merge: never overwrite local data that has mediaUrls if backend is missing them
        // (Cloudflare KV eventual consistency can return stale reads for up to 60s)
        const localHasMedia=posts.some(p=>p.mediaUrl);
        const backendMissingMedia=localHasMedia&&posts.length===r.posts.length&&r.posts.some((bp,i)=>!bp.mediaUrl&&posts[i]&&posts[i].mediaUrl);
        if(backendMissingMedia){console.log('[FEED] Refresh skipped — backend appears stale (missing mediaUrls local has)');return}
        const changed=JSON.stringify(r.posts)!==JSON.stringify(posts.map(p=>({emoji:p.emoji,bg:p.bg,cap:p.cap,capFont:p.capFont||'',mediaUrl:p.mediaUrl||'',mediaType:p.mediaType||'image',focalX:p.focalX||50,focalY:p.focalY||50})));
        if(changed){posts=r.posts;renderFeed();renderGrid();_cacheContent("cb_posts",posts)}
      }
    });
  }else if(panel==='media'){
    if(_saveMediaTimer||_mediaSaveInFlight||Date.now()<_mediaSaveCooldown){return} // Save pending/cooldown
    apiCall('getMediaItems').then(r=>{
      if(r.ok&&r.items){
        const changed=r.items.length!==mediaItems.length||JSON.stringify(r.items)!==JSON.stringify(mediaItems.map(m=>({name:m.name,desc:m.desc||'',url:m.url,type:m.type||'image',nameFont:m.nameFont||'',descFont:m.descFont||'',vaultLocked:m.vaultLocked||false})));
        if(changed){mediaItems=_normalizeMediaItems(r.items);syncVaultCodesFromMedia();restoreGameState();renderMedia();renderGrid();_cacheContent("cb_media",mediaItems)}
      }
    });
  }else if(panel==='intel'){
    apiCall('getIntelFields').then(r=>{
      if(r.ok&&r.fields){
        const changed=r.fields.length!==intelFields.length||JSON.stringify(r.fields)!==JSON.stringify(intelFields);
        if(changed){
          // Preserve current input values before re-render
          const curVals={};
          document.querySelectorAll('.intel-exp-input').forEach(inp=>{if(inp.dataset.idx&&inp.value.trim())curVals[inp.dataset.idx]=inp.value});
          intelFields=r.fields||[];
          // Normalize shapes (type vs fieldType) so money/phone/etc render correctly immediately
          intelFields.forEach(f=>{try{if(f&&typeof f==='object'){if(!f.type&&f.fieldType)f.type=f.fieldType;if(!f.fieldType&&f.type)f.fieldType=f.type}}catch(e){}});
          renderIntelForm();
          // Restore typed values
          document.querySelectorAll('.intel-exp-input').forEach(inp=>{if(curVals[inp.dataset.idx])inp.value=curVals[inp.dataset.idx]});
          renderGrid();_cacheContent("cb_intel",intelFields);
        }
      }
    });
  }else if(panel==='vault'){
    apiCall('getEventConfig').then(cfg=>{
      if(cfg.ok&&cfg.config)applyEventConfig(cfg.config);
      syncVaultCodesFromMedia();restoreGameState();renderVaultPanel();
    });
  }
}
function closePanel(){_stopAllFeedVideos();overlay.style.cssText='';overlay.classList.remove('active');saveGameState();setTimeout(()=>{document.querySelectorAll('.expanded-panel').forEach(p=>p.classList.remove('visible'));saveSession();renderGrid()},120)
  try{_forceCursorKill();}catch(e){}
}

// Feed view modes
function feedClose(){
  // In focus mode, go back to grid. In grid mode, close panel entirely.
  if(currentFeedView==='single'){
    setFeedView('grid');
  }else{
    closePanel();
  }
}
function toggleFeedCaption(){
  const overlay=document.getElementById('feedCapOverlay');
  const cap=document.getElementById('singleCap');
  const text=document.getElementById('feedCapOverlayText');
  text.textContent=cap.textContent;
  text.style.fontFamily=cap.style.fontFamily;
  overlay.classList.add('visible');
  document.getElementById('feedCapMore').classList.remove('visible');
}
function closeFeedCapOverlay(){
  document.getElementById('feedCapOverlay').classList.remove('visible');
  // Re-check if more button needed
  const cap=document.getElementById('singleCap');
  const more=document.getElementById('feedCapMore');
  if(more&&cap)more.classList.toggle('visible',cap.scrollHeight>cap.clientHeight+2);
}
function updateFeedCloseBtn(){
  const btn=document.getElementById('feedCloseBtn');
  if(!btn)return;
  if(currentFeedView==='single'){
    btn.textContent='← GRID';
  }else{
    btn.textContent='✕ CLOSE';
  }
}
function setFeedView(mode){
  currentFeedView=mode;
  document.querySelectorAll('.feed-view-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById({grid:'fvGrid',single:'fvSingle'}[mode])?.classList.add('active');
  const gridEl=document.getElementById('feedGridView');
  const singleEl=document.getElementById('feedSingleView');
  const toggleEl=document.getElementById('feedViewToggle');
  const body=document.getElementById('feedExpBody');
  if(mode==='grid'){
    gridEl.style.display='';
    singleEl.classList.remove('visible');toggleEl.style.display='';
    if(body)body.classList.remove('focus-active');
    // Stop all videos/audio when returning to grid
    _stopAllFeedVideos();
  } else {
    gridEl.style.display='none';singleEl.classList.add('visible');
    toggleEl.style.display='';renderSinglePost();
    if(body)body.classList.add('focus-active');
  }
  updateFeedCloseBtn();
  saveSession();
}
function _stopAllFeedVideos(){
  document.querySelectorAll('#expFeed video, #expFeed iframe').forEach(el=>{
    if(el.tagName==='VIDEO'){el.pause();el.muted=true;el.currentTime=0}
    else if(el.tagName==='IFRAME'){try{el.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}','*')}catch(e){}}
  });
}

let currentPost=0;
function openPost(i){currentPost=i;if(window._histPush)window._histPush('feedFocus');setFeedView('single')}
function renderSinglePost(){
  if(!posts.length){
    const img=document.getElementById('singleImg');
    if(img){img.style.background='';img.textContent='';img.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:Chakra Petch,sans-serif;font-size:11px;color:#333;letter-spacing:1px">No intelligence available</div>'}
    document.getElementById('singleCounter').textContent='0 / 0';
    const capEl=document.getElementById('singleCap');if(capEl)capEl.textContent='';
    return;
  }
  if(currentPost>=posts.length)currentPost=0;
  const p=posts[currentPost],img=document.getElementById('singleImg');
  const resolved=(p.mediaUrl&&(p.mediaType==='video'||isVideoUrl(p.mediaUrl)))?resolveVideoEmbed(p.mediaUrl):null;
  const editBtn=document.body.classList.contains('admin-mode')&&!document.body.classList.contains('player-preview')?`<div class="feed-single-edit" onclick="event.stopPropagation();editFeedPost(${currentPost})" title="Edit this post">✎</div>`:'';
  const muted=isPostMuted(currentPost);

  if(resolved&&resolved.type==='direct'){
    img.style.background='#000';img.style.backgroundSize='';img.textContent='';
    img.innerHTML=`<video class="feed-single-video" id="feedSingleVid" src="${resolved.url}" loop playsinline preload="auto" ${muted?'muted':''} controls></video>${editBtn}`;
    setTimeout(()=>{const v=document.getElementById('feedSingleVid');if(v){v.muted=muted;v.play().catch(()=>{})}},50);
  }else if(resolved&&resolved.type==='external'){
    img.style.background='#000';img.style.backgroundSize='';img.textContent='';
    img.innerHTML=buildExternalLink(resolved,editBtn);
  }else if(resolved&&resolved.embed){
    img.style.background='#000';img.style.backgroundSize='';img.textContent='';
    img.innerHTML=buildEmbedIframe(resolved,true,muted)+editBtn;
  }else if(resolved&&resolved.type==='iframe-fallback'){
    img.style.background='#000';img.style.backgroundSize='';img.textContent='';
    img.innerHTML=`<iframe src="${resolved.url}" style="width:100%;height:100%;border:none" allow="autoplay;encrypted-media" allowfullscreen></iframe>${editBtn}`;
  }else if(p.mediaUrl){
    // Image — wrapped for zoom/pan
    img.style.background='';img.style.backgroundSize='';
    img.innerHTML=`<div class="feed-zoom-wrapper" id="feedZoomWrap"><div class="no-download-shield" oncontextmenu="return false"></div><img src="${p.mediaUrl}" draggable="false"></div>${editBtn}`;
    resetFeedZoom();
  }else{
    // Emoji placeholder
    img.style.background=p.bg;img.style.backgroundSize='';img.textContent=p.emoji;img.innerHTML=p.emoji+editBtn;
  }
  const capEl=document.getElementById('singleCap');
  capEl.textContent=p.cap;
  capEl.style.fontFamily=getFontFamily(resolveFont('feedCap',p.capFont||''));
  // Close any open overlay
  const overlay=document.getElementById('feedCapOverlay');
  if(overlay)overlay.classList.remove('visible');
  document.getElementById('singleCounter').textContent=(currentPost+1)+' / '+posts.length;
  // Check if caption overflows fixed zone
  requestAnimationFrame(()=>{
    const more=document.getElementById('feedCapMore');
    if(more&&capEl)more.classList.toggle('visible',capEl.scrollHeight>capEl.clientHeight+2);
  });
}
