// ══════ TUTORIAL SYSTEM ══════
const TUTORIAL_STEPS_DEFAULT=[
  {id:'grid',selector:'.console-grid',icon:'🖥️',title:'Mission Console',body:'These are your mission panels. Each one contains different intelligence and tools. Tap any panel to open it.',enabled:true},
  {id:'feed',selector:'.crt-monitor[data-tile="feed"]',icon:'📡',title:'Intelligence Feed',body:'Surveillance imagery and intercepted visuals from the field. Check here for visual clues.',enabled:true},
  {id:'media',selector:'.crt-monitor[data-tile="media"]',icon:'📁',title:'Evidence Locker',body:'Classified files and documents. Some may be vault-locked and require a code to access.',enabled:true},
  {id:'intel',selector:'.crt-monitor[data-tile="intel"]',icon:'🔍',title:'Intel Submissions',body:'Enter your answers here. Fill in each field with the intelligence you\'ve gathered, Your progress saves automatically — press Submit Intel only when you\'re ready to lock in your final answers.',enabled:true},
  {id:'vault',selector:'.crt-monitor[data-tile="vault"]',icon:'🔐',title:'Vault',body:'Enter secret codes to unlock classified evidence. Codes can be found hidden throughout the mission.',enabled:true},
  {id:'timer',selector:'.timer-block',icon:'⏱️',title:'Mission Timer',body:'Keep an eye on the clock. When time runs out, the mission is over.',enabled:true},
  {id:'identity',selector:'.topbar-identity',icon:'🪪',title:'Your Identity',body:'Your team name and details. Tap to see your team card with member info and notifications.',enabled:true},
  {id:'notepad',selector:'#notepadTrigger',icon:'📝',title:'Notepad',body:'Your personal scratchpad. Jot down clues, codes, or anything you need to remember.',enabled:true}
];
let tutorialSteps=JSON.parse(JSON.stringify(TUTORIAL_STEPS_DEFAULT));
let tutorialEnabled=true;
let _tutCurrentStep=0;
function _isTutorialRunning(){return document.getElementById('tutorialOverlay')?.classList.contains('active')}
let _tutIsPreview=false;

function openTutorialConfig(){
  switchAdminTab('tutorialConfigPanel');
  renderTutorialStepList();
  const tg=document.getElementById('tutGlobalToggle');
  tg.classList.toggle('on',tutorialEnabled);
  const bg=document.getElementById('briefingGlobalToggle');
  bg.classList.toggle('on',!!briefingConfig.enabled);
  const st=document.getElementById('briefingSourceType');
  st.value=briefingConfig.sourceType||'upload';
  onBriefingTypeChange();
  document.getElementById('briefingTitle').value=briefingConfig.title||'';
  document.getElementById('briefingSubtitle').value=briefingConfig.subtitle||'';
  if(briefingConfig.sourceType==='upload'){document.getElementById('briefingFileUrl').value=briefingConfig.videoUrl||''}
  else{document.getElementById('briefingVideoUrl').value=briefingConfig.videoUrl||''}
}
function closeTutorialConfig(){const el=document.getElementById('tutorialConfigPanel');el.classList.remove('active');el.style.cssText='';hideAdminTabs()}

function renderTutorialStepList(){
  const list=document.getElementById('tutStepList');
  list.innerHTML=tutorialSteps.map((s,i)=>{
    const escaped=s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="tut-step-card" data-tut-idx="${i}">
    <div class="tut-drag" onpointerdown="startTutDrag(event,${i})">⋮⋮</div>
    <span class="tut-icon" style="font-family:Oxanium,sans-serif;font-weight:700;font-size:11px;color:var(--cyan);width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,212,255,.25);border-radius:50%;background:rgba(0,212,255,.06);flex-shrink:0">${i+1}</span>
    <div class="tut-text"><textarea onchange="updateTutStep(${i},this.value)" onblur="updateTutStep(${i},this.value)">${escaped}</textarea></div>
    <div class="tut-step-toggle${s.enabled?' on':''}" onclick="toggleTutStep(${i})"></div>
  </div>`}).join('');
}

function toggleTutorialGlobal(){tutorialEnabled=!tutorialEnabled;document.getElementById('tutGlobalToggle').classList.toggle('on',tutorialEnabled);saveTutorialConfig()}
function toggleTutStep(i){tutorialSteps[i].enabled=!tutorialSteps[i].enabled;renderTutorialStepList();saveTutorialConfig()}
function updateTutStep(i,text){tutorialSteps[i].body=text;saveTutorialConfig()}

// Tutorial step drag reorder
let _tutDrag={active:false,fromIdx:null,ghost:null,overIdx:null};
function startTutDrag(e,idx){
  e.preventDefault();e.stopPropagation();
  const target=e.target.closest('.tut-step-card');
  if(!target)return;
  _tutDrag={active:true,fromIdx:idx,ghost:null,overIdx:null};
  const rect=target.getBoundingClientRect();
  const ghost=target.cloneNode(true);ghost.className='drag-ghost';
  ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';
  ghost.style.left=rect.left+'px';ghost.style.top=rect.top+'px';
  document.body.appendChild(ghost);_tutDrag.ghost=ghost;
  target.classList.add('dragging');
  const ox=e.clientX-rect.left,oy=e.clientY-rect.top;
  function onMove(ev){
    const cx=ev.clientX||0,cy=ev.clientY||0;
    ghost.style.left=(cx-ox)+'px';ghost.style.top=(cy-oy)+'px';
    ghost.style.display='none';const el=document.elementFromPoint(cx,cy);ghost.style.display='';
    document.querySelectorAll('.tut-step-card').forEach(c=>c.classList.remove('drag-over'));
    if(el){const dt=el.closest('.tut-step-card');if(dt){const di=parseInt(dt.dataset.tutIdx);if(!isNaN(di)&&di!==idx){dt.classList.add('drag-over');_tutDrag.overIdx=di}}}
  }
  function onEnd(){
    window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onEnd);
    if(ghost)ghost.remove();
    document.querySelectorAll('.tut-step-card').forEach(c=>c.classList.remove('dragging','drag-over'));
    if(_tutDrag.overIdx!==null&&_tutDrag.overIdx!==_tutDrag.fromIdx){
      const item=tutorialSteps.splice(_tutDrag.fromIdx,1)[0];
      tutorialSteps.splice(_tutDrag.overIdx,0,item);
      renderTutorialStepList();saveTutorialConfig();
    }
    _tutDrag={active:false,fromIdx:null,ghost:null,overIdx:null};
  }
  window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onEnd);
}

function saveTutorialConfig(){
  apiCall('saveEventConfig',{config:{
    tutorialEnabled:tutorialEnabled,
    tutorialSteps:JSON.stringify(tutorialSteps),
    briefingConfig:JSON.stringify(briefingConfig)
  }}).then(r=>{
    if(!r||!r.ok)console.error('Tutorial config save failed:',r);
  });
}

function resetTutorialForAll(){
  if(!confirm('Reset tutorial for all teams? Everyone will see the tutorial again on their next login.'))return;
  apiCall('saveEventConfig',{config:{tutorialGen:String(Date.now())}}).then(r=>{
    if(r.ok){const msg=document.getElementById('briefingMsg');if(msg){msg.className='ap-msg ok';msg.textContent='✓ Tutorial reset for all teams';setTimeout(()=>msg.textContent='',3000)}}
  });
}

let _tutFromConfig=false;
function previewTutorial(){
  closeTutorialConfig();
  _tutFromConfig=true;
  _tutIsPreview=true;
  if(isAdmin&&!document.body.classList.contains('player-preview')){
    _tutWasAdmin=true;
    togglePlayerPreview();
    setTimeout(()=>startTutorial(),300);
  }else{
    startTutorial();
  }
}

// Tutorial spotlight engine
function startTutorial(){
  const enabled=tutorialSteps.filter(s=>s.enabled);
  if(!enabled.length)return;
  // Re-render grid to ensure badges/labels reflect current state
  renderGrid();
  // Ensure notepad is collapsed so the trigger spotlight is correct
  if(typeof notepadOpen!=='undefined'&&notepadOpen){notepadOpen=false;document.getElementById('notepadPanel').classList.remove('open')}
  _tutCurrentStep=0;
  document.getElementById('tutorialOverlay').classList.add('active');
  showTutorialStep();
}

function showTutorialStep(){
  const enabled=tutorialSteps.filter(s=>s.enabled);
  if(_tutCurrentStep<0||_tutCurrentStep>=enabled.length){endTutorial();return}
  const step=enabled[_tutCurrentStep];
  const el=document.querySelector(step.selector);
  const spotlight=document.getElementById('tutSpotlight');
  const tooltip=document.getElementById('tutTooltip');
  const title=document.getElementById('tutTooltipTitle');
  const body=document.getElementById('tutTooltipBody');
  const dots=document.getElementById('tutDots');
  const backBtn=document.getElementById('tutBtnBack');
  const nextBtn=document.getElementById('tutBtnNext');

  title.textContent=step.title;
  body.textContent=step.body;
  dots.innerHTML=enabled.map((_,i)=>`<div class="tut-tooltip-dot${i===_tutCurrentStep?' active':''}"></div>`).join('');
  backBtn.style.display=_tutCurrentStep===0?'none':'';
  nextBtn.textContent=_tutCurrentStep===enabled.length-1?'DONE':'NEXT';

  // Reset tooltip transform in case it was centered previously
  tooltip.style.transform='';

  const isVisible=el&&(el.offsetParent!==null||getComputedStyle(el).position==='fixed')&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0;
  if(isVisible){
    // Scroll into view if needed
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
    // Wait for scroll to settle then position
    setTimeout(()=>{
      let rect=el.getBoundingClientRect();
      // For flex/grid containers with centered content, measure tight child bounds
      // to avoid highlighting empty buffer space
      const cs=getComputedStyle(el);
      const isCentered=cs.alignContent==='center'||cs.justifyContent==='center';
      const isFlexGrid=cs.display.includes('flex')||cs.display.includes('grid');
      if(isFlexGrid&&isCentered&&el.children.length>0){
        let cTop=Infinity,cLeft=Infinity,cBottom=-Infinity,cRight=-Infinity;
        for(const child of el.children){
          const cr=child.getBoundingClientRect();
          if(cr.width===0||cr.height===0)continue;
          cTop=Math.min(cTop,cr.top);cLeft=Math.min(cLeft,cr.left);
          cBottom=Math.max(cBottom,cr.bottom);cRight=Math.max(cRight,cr.right);
        }
        if(cTop!==Infinity){
          rect={top:cTop,left:cLeft,bottom:cBottom,right:cRight,width:cRight-cLeft,height:cBottom-cTop};
        }
      }
      const pad=8;
      // Clamp spotlight within viewport
      const top=Math.max(4,rect.top-pad);
      const left=Math.max(4,rect.left-pad);
      const w=Math.min(rect.width+pad*2,window.innerWidth-left-4);
      const h=Math.min(rect.height+pad*2,window.innerHeight-top-4);
      spotlight.style.left=left+'px';
      spotlight.style.top=top+'px';
      spotlight.style.width=w+'px';
      spotlight.style.height=h+'px';
      spotlight.style.display='block';

      // Position tooltip relative to spotlight
      const tipH=180;
      const tipW=360;
      if(top+h+tipH+20<window.innerHeight){
        // Below element
        tooltip.style.top=(top+h+12)+'px';
        tooltip.style.bottom='auto';
      }else if(top-tipH-12>0){
        // Above element
        tooltip.style.top=(top-tipH-12)+'px';
        tooltip.style.bottom='auto';
      }else if(h>window.innerHeight*0.5){
        // Element fills most of screen (grid) — inside at top
        tooltip.style.top=(top+12)+'px';
        tooltip.style.bottom='auto';
      }else{
        tooltip.style.top='auto';
        tooltip.style.bottom='20px';
      }
      // Center tooltip over the element, clamped to viewport edges
      const elCenter=rect.left+rect.width/2;
      const tipLeft=Math.max(16,Math.min(elCenter-tipW/2,window.innerWidth-tipW-16));
      tooltip.style.left=tipLeft+'px';
    },150);
  }else{
    // Element not visible or not found — show tooltip centered
    spotlight.style.display='none';
    tooltip.style.top='50%';tooltip.style.left='50%';
    tooltip.style.transform='translate(-50%,-50%)';
  }
}

function tutorialStep(dir){
  const enabled=tutorialSteps.filter(s=>s.enabled);
  _tutCurrentStep+=dir;
  if(_tutCurrentStep>=enabled.length){endTutorial();return}
  if(_tutCurrentStep<0)_tutCurrentStep=0;
  showTutorialStep();
}

let _tutWasAdmin=false;
function replayTutorial(){
  _tutWasAdmin=false;
  if(isAdmin&&!document.body.classList.contains('player-preview')){
    _tutWasAdmin=true;
    togglePlayerPreview();
    setTimeout(()=>{_tutIsPreview=true;startTutorial()},300);
  }else{
    _tutIsPreview=true;
    startTutorial();
  }
}

function endTutorial(){
  document.getElementById('tutorialOverlay').classList.remove('active');
  document.getElementById('tutSpotlight').style.display='none';
  renderGrid(); // Sync grid with latest data after tutorial
  if(!_tutIsPreview){
    const teamId=currentVaultTeam?.id||'unknown';
    try{localStorage.setItem('cb_tutSeen_'+teamId,localStorage.getItem('cb_tutorialGen')||'1')}catch(e){}
    checkShowBriefing();
  }
  if(_tutWasAdmin){
    _tutWasAdmin=false;
    togglePlayerPreview();
  }
  const wasFromConfig=_tutFromConfig;
  _tutIsPreview=false;
  _tutFromConfig=false;
  if(wasFromConfig){setTimeout(()=>openTutorialConfig(),200)}
}

function shouldShowTutorial(){
  if(!tutorialEnabled)return false;
  if(isAdmin&&!document.body.classList.contains('player-preview'))return false;
  const teamId=currentVaultTeam?.id;
  if(!teamId)return false;
  const seen=localStorage.getItem('cb_tutSeen_'+teamId)||'';
  const gen=localStorage.getItem('cb_tutorialGen')||'1';
  return seen!==gen;
}

// ══════ MISSION BRIEFING ══════
let briefingConfig={enabled:false,sourceType:'upload',videoUrl:'',title:'',subtitle:''};

function toggleBriefingGlobal(){briefingConfig.enabled=!briefingConfig.enabled;document.getElementById('briefingGlobalToggle').classList.toggle('on',briefingConfig.enabled);saveTutorialConfig()}

function onBriefingTypeChange(){
  const type=document.getElementById('briefingSourceType').value;
  briefingConfig.sourceType=type;
  document.getElementById('briefingUploadZone').style.display=type==='upload'?'':'none';
  document.getElementById('briefingUrlZone').style.display=type!=='upload'?'':'none';
  saveTutorialConfig();
}

function saveBriefingConfig(){
  const type=document.getElementById('briefingSourceType').value;
  briefingConfig.sourceType=type;
  briefingConfig.title=document.getElementById('briefingTitle').value.trim();
  briefingConfig.subtitle=document.getElementById('briefingSubtitle').value.trim();
  if(type==='upload'){briefingConfig.videoUrl=document.getElementById('briefingFileUrl').value.trim()}
  else{briefingConfig.videoUrl=document.getElementById('briefingVideoUrl').value.trim()}
  saveTutorialConfig();
}

function uploadBriefingVideo(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  const msg=document.getElementById('briefingMsg');
  msg.className='ap-msg';msg.textContent='Uploading video...';
  // Use the same upload ticket system as media
  apiCall('getUploadUrl',{filename:file.name,contentType:file.type}).then(r=>{
    if(!r.ok){msg.className='ap-msg err';msg.textContent='✗ '+r.error;return}
    const formData=new FormData();formData.append('file',file);
    fetch(r.uploadUrl,{method:'POST',headers:{'X-Upload-Ticket':r.ticket},body:formData}).then(resp=>resp.json()).then(u=>{
      if(u.ok){
        briefingConfig.videoUrl=u.url;
        document.getElementById('briefingFileUrl').value=u.url;
        msg.className='ap-msg ok';msg.textContent='✓ Video uploaded';
        saveBriefingConfig();
      }else{msg.className='ap-msg err';msg.textContent='✗ Upload failed'}
    }).catch(()=>{msg.className='ap-msg err';msg.textContent='✗ Upload error'});
  });
}

function resetBriefingForAll(){
  if(!confirm('Reset briefing for all teams? Everyone will see the briefing again on their next login.'))return;
  apiCall('saveEventConfig',{config:{briefingGen:String(Date.now())}}).then(r=>{
    if(r.ok){const msg=document.getElementById('briefingMsg');if(msg){msg.className='ap-msg ok';msg.textContent='✓ Briefing reset for all teams';setTimeout(()=>msg.textContent='',3000)}}
  });
}

function previewBriefing(){
  closeTutorialConfig();
  showBriefingModal();
}

function checkShowBriefing(){
  if(!briefingConfig.enabled||!briefingConfig.videoUrl)return;
  if(isAdmin&&!document.body.classList.contains('player-preview'))return;
  const teamId=currentVaultTeam?.id;
  if(!teamId)return;
  const seen=localStorage.getItem('cb_briefSeen_'+teamId)||'';
  const gen=localStorage.getItem('cb_briefingGen')||'1';
  if(seen===gen)return;
  showBriefingModal();
}

function showBriefingModal(){
  const modal=document.getElementById('briefingModal');
  const container=document.getElementById('briefingVideoContainer');
  const titleEl=document.getElementById('briefingModalTitle');
  const subEl=document.getElementById('briefingModalSubtitle');
  titleEl.textContent=briefingConfig.title||'Mission Briefing';
  subEl.textContent=briefingConfig.subtitle||'';
  // Render video based on source type
  const url=briefingConfig.videoUrl||'';
  if(briefingConfig.sourceType==='youtube'||url.includes('youtube.com')||url.includes('youtu.be')||url.includes('vimeo.com')){
    let embedUrl=url;
    const ytMatch=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if(ytMatch)embedUrl='https://www.youtube.com/embed/'+ytMatch[1]+'?autoplay=1';
    const vimeoMatch=url.match(/vimeo\.com\/(\d+)/);
    if(vimeoMatch)embedUrl='https://player.vimeo.com/video/'+vimeoMatch[1]+'?autoplay=1';
    container.innerHTML=`<iframe src="${embedUrl}" allow="autoplay;fullscreen" allowfullscreen></iframe>`;
  }else{
    container.innerHTML=`<video src="${url}" controls autoplay playsinline></video>`;
  }
  modal.classList.add('active');
}

function dismissBriefing(){
  const modal=document.getElementById('briefingModal');
  modal.classList.remove('active');
  // Stop video
  const container=document.getElementById('briefingVideoContainer');
  container.innerHTML='';
  // Mark seen
  const teamId=currentVaultTeam?.id;
  if(teamId){
    try{localStorage.setItem('cb_briefSeen_'+teamId,localStorage.getItem('cb_briefingGen')||'1')}catch(e){}
  }
}

