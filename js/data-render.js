// ══════ FONTS ══════
const availableFonts=[
  // Military / Industrial
  {name:'Russo One',family:"'Russo One',sans-serif"},
  {name:'Black Ops One',family:"'Black Ops One',sans-serif"},
  {name:'Quantico',family:"'Quantico',sans-serif"},
  {name:'Aldrich',family:"'Aldrich',sans-serif"},
  {name:'Staatliches',family:"'Staatliches',cursive"},
  // Sci-Fi / Tech
  {name:'Orbitron',family:"'Orbitron',sans-serif"},
  {name:'Oxanium',family:"'Oxanium',sans-serif"},
  {name:'Audiowide',family:"'Audiowide',sans-serif"},
  {name:'Electrolize',family:"'Electrolize',sans-serif"},
  {name:'Michroma',family:"'Michroma',sans-serif"},
  {name:'Chakra Petch',family:"'Chakra Petch',sans-serif"},
  // Clean / UI
  {name:'Saira',family:"'Saira',sans-serif"},
  {name:'Exo 2',family:"'Exo 2',sans-serif"},
  {name:'Play',family:"'Play',sans-serif"},
  {name:'Rajdhani',family:"'Rajdhani',sans-serif"},
  {name:'Teko',family:"'Teko',sans-serif"},
  // Monospace / Terminal
  {name:'IBM Plex Mono',family:"'IBM Plex Mono',monospace"},
  {name:'JetBrains Mono',family:"'JetBrains Mono',monospace"},
  {name:'Share Tech Mono',family:"'Share Tech Mono',monospace"},
  {name:'Nova Mono',family:"'Nova Mono',monospace"},
  {name:'Major Mono Display',family:"'Major Mono Display',monospace"},
  // Retro / Pixel
  {name:'Press Start 2P',family:"'Press Start 2P',monospace"},
  {name:'VT323',family:"'VT323',monospace"},
  {name:'Silkscreen',family:"'Silkscreen',sans-serif"},
];
function fontSelect(id,current){
  const groups=[
    {label:'— Military / Industrial —',fonts:['Russo One','Black Ops One','Quantico','Aldrich','Staatliches']},
    {label:'— Sci-Fi / Tech —',fonts:['Orbitron','Oxanium','Audiowide','Electrolize','Michroma','Chakra Petch']},
    {label:'— Clean / UI —',fonts:['Saira','Exo 2','Play','Rajdhani','Teko']},
    {label:'— Monospace / Terminal —',fonts:['IBM Plex Mono','JetBrains Mono','Share Tech Mono','Nova Mono','Major Mono Display']},
    {label:'— Retro / Pixel —',fonts:['Press Start 2P','VT323','Silkscreen']},
  ];
  let html=`<select id="${id}" style="font-size:11px"><option value=""${!current?' selected':''}>Default</option>`;
  groups.forEach(g=>{
    html+=`<optgroup label="${g.label}">`;
    g.fonts.forEach(fn=>{
      const f=availableFonts.find(x=>x.name===fn);
      if(f)html+=`<option value="${f.name}"${f.name===current?' selected':''} style="font-family:${f.family}">${f.name}</option>`;
    });
    html+=`</optgroup>`;
  });
  html+=`</select>`;
  return html;
}
function getFontFamily(name){const f=availableFonts.find(x=>x.name===name);return f?f.family:''}
function applyOperationFont(name){
  const fam=name?getFontFamily(name):'';
  const targets=['consoleTitle','loginTitle','landingTitleEl'];
  targets.forEach(id=>{const el=document.getElementById(id);if(el)el.style.fontFamily=fam});
  // Also update CSS variable so any future themed elements inherit it
  document.documentElement.style.setProperty('--op-font',fam||'inherit');
}
function fontStyle(name){return name?`font-family:${getFontFamily(name)}`:''}

// ══════ DATA ══════
let operationName='Operation Dead Drop';
let operationFont='Staatliches';

// ── Central Typography Config ──
// Global font overrides per content zone. Empty string = use default theme font.
let fontConfig={
  feedCap:'',        // Feed card captions + single post caption
  mediaName:'',      // Media item titles
  mediaDesc:'',      // Media item descriptions
  intelLabel:'',     // Intel field labels (overrides per-field font)
  intelInput:'',     // Intel field inputs (overrides per-field inputFont)
  vaultDisplay:''    // Vault keypad display + vault panel codenames
};

// Resolve: global fontConfig takes precedence over per-item font
function resolveFont(globalKey,perItemFont){
  const g=fontConfig[globalKey]||'';
  return g||perItemFont||'';
}
// vault subtitle removed — login screen uses loginTitle
let gridTiles=[
  {id:'feed',icon:'📡',label:'Intelligence Feed',labelFont:'',sub:'Surveillance imagery & intercepted visuals',subFont:'',badgeId:'feedBadge',dotClass:'silent',status:'SILENT'},
  {id:'media',icon:'🗂️',label:'Evidence Locker',labelFont:'',sub:'Collected assets, files & recovered media',subFont:'',badgeId:'mediaBadge',dotClass:'silent',status:'SILENT'},
  {id:'vault',icon:'🔐',label:'The Vault',labelFont:'',sub:'Enter solved codes to unlock items',subFont:'',badgeId:'vaultBadge',dotClass:'silent',status:'SILENT'},
  {id:'intel',icon:'🎯',label:'Intel Submissions',labelFont:'',sub:'Submit decoded intelligence',subFont:'',badgeId:'intelBadge',dotClass:'silent',status:'SILENT'}
];
// Activity tracking for tile pulse system
const tileActivity={feed:0,media:0,vault:0,intel:0};
const activityThresholds={activeToIdle:120,idleToSilent:600}; // seconds — active<2min, idle 2-10min, ghost>10min
const tileStateLabels={active:'ACTIVE',idle:'IDLE',silent:'SILENT'};
function getTileState(id){
  const last=tileActivity[id];
  if(!last)return'silent';
  const ago=(Date.now()-last)/1000;
  if(ago<activityThresholds.activeToIdle)return'active';
  if(ago<activityThresholds.idleToSilent)return'idle';
  return'silent';
}
function recordTileAccess(id){
  tileActivity[id]=Date.now();
  try{localStorage.setItem('cb_tile_activity',JSON.stringify(tileActivity));}catch(e){}
  updateTileStates();
}
// Restore persisted tile activity from localStorage on load
(function(){
  try{
    const saved=localStorage.getItem('cb_tile_activity');
    if(saved){const d=JSON.parse(saved);Object.keys(tileActivity).forEach(k=>{if(d[k])tileActivity[k]=d[k];});}
  }catch(e){}
  // Update dotClass immediately so renderGrid() below picks up correct states
  updateTileStates();
})();
function updateTileStates(){
  gridTiles.forEach(t=>{
    const state=getTileState(t.id);
    t.dotClass=state;
    t.status=tileStateLabels[state];
    // Update DOM directly if rendered
    const statusEl=document.querySelector(`[data-tile="${t.id}"] .tile-dot`);
    const labelEl=document.querySelector(`[data-tile="${t.id}"] .tile-status-label`);
    if(statusEl){statusEl.className='tile-dot '+state}
    if(labelEl){labelEl.className='tile-status-label '+state;labelEl.textContent=tileStateLabels[state]}
  });
}
// Periodic state decay check every 10 seconds
setInterval(updateTileStates,10000);
let intelFields=[
  {label:'Seller Codename',emoji:'🕵️',type:'text',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Buyer Identity',emoji:'👤',type:'text',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Staging Country',emoji:'🌍',type:'text',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Comms Platform',emoji:'📱',type:'text',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Smuggled Items',emoji:'📦',type:'text',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Hideout Location',emoji:'📍',type:'text',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Payment Amount',emoji:'💰',type:'money',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Burner Phone #',emoji:'📞',type:'phone',font:'',answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}},
  {label:'Target Islands',emoji:'🏝️',type:'dual',font:'',placeholder1:'Island 1',placeholder2:'Island 2',answer:{expected:['',''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}}
];
const intelLabels=['Seller Codename','Buyer Identity','Staging Country','Comms Platform','Smuggled Items','Hideout Location','Payment Amount','Burner Phone #','Target Island 1','Target Island 2'];
let allowDownloads=false;
let feedMuted=true;
const postMuteState={}; // per-post mute memory: {postIndex: true/false}
function isPostMuted(idx){return postMuteState[idx]!==undefined?postMuteState[idx]:feedMuted}
let regSettings={
  teamSizeMin:2,
  teamSizeMax:4,
  maxTeams:20,
  requireEmail:true,
  requirePhone:false,
  requireDept:false,
  registrationOpen:true,
  participantMode:'team',
  leaderboardStyle:'mixed',
  landingBannerUrl:'',
  bannerFallback:'🔐',
  landingTitle:'Code Breakers',
  landingSubtitle:'Rise to The Challenge',
  vaultMaxAttempts:5,
  vaultCooldownSec:30,
  vaultUnlimitedAttempts:false,
  sessionPersist:true
};
let currentRegType='team'; // for hybrid mode tracking
let posts=[];
let mediaItems=[];

// ══════ RENDER ══════

function renderFeed(){
  if(posts.length)console.log('[FEED] renderFeed called. posts[last].mediaUrl:',posts[posts.length-1]?.mediaUrl?.substring(0,80),'trace:',new Error().stack?.split('\n')[2]?.trim());
  const grid=document.getElementById('feedGridView'),isA=document.body.classList.contains('admin-mode')&&!document.body.classList.contains('player-preview');
  if(!posts.length){
    grid.innerHTML=isA
      ?'<div style="grid-column:1/-1;text-align:center;padding:40px"><div style="font-size:32px;margin-bottom:12px;opacity:.3">📡</div><div style="font-family:Chakra Petch,sans-serif;font-size:11px;color:#444;letter-spacing:1px;margin-bottom:16px">No intelligence feed items yet</div><div class="admin-add-btn" onclick="addFeedPost()">+ Add Post</div></div>'
      :'<div style="grid-column:1/-1;text-align:center;padding:40px"><div style="font-size:32px;margin-bottom:12px;opacity:.3">📡</div><div style="font-family:Chakra Petch,sans-serif;font-size:11px;color:#333;letter-spacing:1px">No intelligence available yet</div></div>';
    document.getElementById('feedBadge').textContent=tileBadgeText('feed',isA);
    const fci=document.getElementById('feedCountIndicator');if(fci)fci.textContent='0 POSTS';
    return;
  }
  grid.innerHTML=posts.map((p,i)=>{
    const resolved=(p.mediaUrl&&(p.mediaType==='video'||isVideoUrl(p.mediaUrl)))?resolveVideoEmbed(p.mediaUrl):null;
    const isVid=resolved&&resolved.type==='direct';
    const isEmbeddable=resolved&&resolved.type!=='direct'&&resolved.type!=='external';
    const isExternal=resolved&&resolved.type==='external';
    const isImg=!resolved&&p.mediaUrl;
    let media='';
    if(isImg){
      const fp=`${p.focalX||50}% ${p.focalY||50}%`;
      media=`<div class="no-download-shield" oncontextmenu="return false"></div><img src="${p.mediaUrl}" style="width:100%;height:100%;object-fit:cover;object-position:${fp};pointer-events:none;-webkit-user-drag:none" draggable="false">`;
    } else if(isEmbeddable||isExternal){
      media=buildVideoThumbnail(resolved);
    } else if(isVid){
      media=`<video class="feed-card-thumb" src="${resolved.url}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;pointer-events:none"></video><div class="feed-video-play-icon" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">▶</div><div class="feed-video-badge">VIDEO</div>`;
    } else {
      media=`<span style="opacity:.5">${p.emoji}</span>`;
    }
    const bgStyle=!p.mediaUrl?`background:${p.bg};`:'';
    const _capFont=resolveFont('feedCap',p.capFont||'');
    return `<div class="feed-card" data-idx="${i}">${isA?`<div class="drag-handle" onpointerdown="startDrag(event,'feed',${i})" onclick="event.stopPropagation()">⋮⋮</div><div class="admin-edit-btn" onclick="event.stopPropagation();editFeedPost(${i})">✎</div>`:''}<div class="feed-card-img" style="${bgStyle}" oncontextmenu="return false">${media}</div><div class="feed-card-cap"><p style="${fontStyle(_capFont)}">${p.cap}</p></div></div>`;
  }).join('')+(isA?'<div class="admin-add-btn" onclick="addFeedPost()">+ Add Post</div>':'');
  document.getElementById('feedBadge').textContent=tileBadgeText('feed',isA);
  const fci=document.getElementById('feedCountIndicator');if(fci)fci.textContent=posts.length+(posts.length===1?' POST':' POSTS');
  // Seek video thumbnails to 1s to show a real frame instead of black
  setTimeout(()=>{grid.querySelectorAll('video.feed-card-thumb').forEach(v=>{v.currentTime=1})},100);
}
let _mediaSelectMode=false;
let _mediaSelected=new Set();
function enterMediaSelectMode(){_mediaSelectMode=true;_mediaSelected.clear();renderMedia();const bar=document.getElementById('mediaSelectBar');if(bar){bar.style.display='flex'}}
function exitMediaSelectMode(){_mediaSelectMode=false;_mediaSelected.clear();renderMedia();const bar=document.getElementById('mediaSelectBar');if(bar){bar.style.display='none'}}
function toggleMediaSelect(i){if(_mediaSelected.has(i))_mediaSelected.delete(i);else _mediaSelected.add(i);document.getElementById('mediaSelectCount').textContent=_mediaSelected.size+' selected';renderMedia()}
function selectAllMedia(){const isEdit=document.body.classList.contains('admin-mode');const showAll=isEdit;const visible=showAll?mediaItems:mediaItems.filter(m=>!m.vaultLocked);visible.forEach(m=>{const ri=mediaItems.indexOf(m);_mediaSelected.add(ri)});document.getElementById('mediaSelectCount').textContent=_mediaSelected.size+' selected';renderMedia()}
function deleteSelectedMedia(){if(!_mediaSelected.size)return;if(!confirm('Delete '+_mediaSelected.size+' selected item(s)?'))return;const idxs=Array.from(_mediaSelected).sort((a,b)=>b-a);idxs.forEach(i=>{const m=mediaItems[i];if(m&&m.fileUrl)deleteFromR2(m.fileUrl);mediaItems.splice(i,1)});exitMediaSelectMode();renderMedia();renderGrid();saveMediaItemsToBackend()}
function renderMedia(){
  const list=document.getElementById('mediaList');
  const isEdit=document.body.classList.contains('admin-mode')&&!document.body.classList.contains('player-preview');
  const isAdmin=document.body.classList.contains('admin-mode');
  const isPreview=document.body.classList.contains('player-preview');
  const showAll=isAdmin&&!isPreview;
  const visibleItems=showAll?mediaItems:mediaItems.filter(m=>!m.vaultLocked||vaultCodes.find(c=>c.linkedMediaIdx===mediaItems.indexOf(m)&&c.unlocked));
  // Search filter
  const searchVal=(document.getElementById('mediaSearchFilter')?.value||'').toLowerCase().trim();
  const filtered=searchVal?visibleItems.filter(m=>(m.name||'').toLowerCase().includes(searchVal)||(m.desc||'').toLowerCase().includes(searchVal)||(m.type||'').toLowerCase().includes(searchVal)):visibleItems;
  // Count indicator
  const mci=document.getElementById('mediaCountIndicator');if(mci){const countText=filtered.length+(filtered.length===1?' ITEM':' ITEMS')+(searchVal?' of '+visibleItems.length:'');mci.textContent=countText;}
  const selectBtnHtml=isEdit&&!_mediaSelectMode&&filtered.length>0?`<div style="text-align:right;margin-bottom:8px"><button onclick="enterMediaSelectMode()" style="font-family:'Saira',sans-serif;font-size:10px;letter-spacing:1px;background:none;border:1px solid #333;border-radius:3px;padding:4px 12px;color:#666;cursor:pointer">☑ SELECT</button></div>`:'';
  list.innerHTML=selectBtnHtml+filtered.map((m,i)=>{
    const realIdx=mediaItems.indexOf(m);
    const isVL=m.vaultLocked&&showAll;
    const vlStyle=isVL?'position:relative;border-color:rgba(255,170,51,.2);':'';
    const lockedStyle=m.type==='locked'&&!m.unlocked?'opacity:.4;':'';
    const crosshatch=isVL?'<div class="media-vault-hatch"></div>':'';
    const badge=isVL?'🔐 vault-locked':m.type+(m.type==='locked'&&m.unlocked?' ✓':'');
    const isSelected=_mediaSelected.has(realIdx);
    const selStyle=_mediaSelectMode?(isSelected?'border-color:var(--red);background:rgba(255,51,51,.06);':''):'';
    const checkHtml=_mediaSelectMode?`<div onclick="event.stopPropagation();toggleMediaSelect(${realIdx})" style="position:absolute;top:8px;left:8px;width:18px;height:18px;border:2px solid ${isSelected?'var(--red)':'#444'};border-radius:3px;background:${isSelected?'rgba(255,51,51,.3)':'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;font-size:11px">${isSelected?'✓':''}</div>`:'';
    const clickHandler=_mediaSelectMode?`onclick="toggleMediaSelect(${realIdx})"`:(`onclick="openMediaViewer(${realIdx})"`);
    const _mNameFont=resolveFont('mediaName',m.nameFont||'');
    const _mDescFont=resolveFont('mediaDesc',m.descFont||'');
    // New item glow — items marked as _isNew
    const newGlow=m._isNew?'box-shadow:0 0 12px rgba(0,212,255,.25);border-color:rgba(0,212,255,.3);':'';
    const newBadge=m._isNew?'<span style="position:absolute;top:6px;right:40px;font-family:IBM Plex Mono,monospace;font-size:8px;letter-spacing:1.5px;color:var(--cyan);background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.2);border-radius:2px;padding:1px 6px">NEW</span>':'';
    return `<div class="media-exp-item" data-idx="${realIdx}" style="${lockedStyle}${vlStyle}${selStyle}${newGlow}" ${clickHandler}>${isEdit&&!_mediaSelectMode?`<div class="drag-handle" onpointerdown="startDrag(event,'media',${realIdx})" onclick="event.stopPropagation()">⋮⋮</div><div class="admin-edit-btn" onclick="event.stopPropagation();editMediaItem(${realIdx})" style="position:absolute;top:8px;right:8px">✎</div>`:''}${checkHtml}${crosshatch}${newBadge}<span class="media-exp-icon">${m.icon}</span><div class="media-exp-info"><span class="media-exp-name" style="${fontStyle(_mNameFont)}">${m.name}</span><span class="media-exp-desc" style="${fontStyle(_mDescFont)}">${m.desc}</span></div><span class="media-exp-badge ${m.type}">${badge}</span></div>`;
  }).join('')+(isEdit&&!_mediaSelectMode?'<div class="admin-add-btn" onclick="addMediaItem()">+ Add Item</div>':'');
  const mbadge=document.getElementById('mediaBadge');if(mbadge)mbadge.textContent=tileBadgeText('media',isAdmin);
}


