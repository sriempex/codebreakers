// ══════ ADMIN EDIT MODALS ══════
function showEditModal(html){document.getElementById('editBox').innerHTML=html;document.getElementById('adminEditModal').classList.add('active')}
function hideEditModal(){document.getElementById('adminEditModal').classList.remove('active');_resetZoomCursor()}

// ── File type auto-detection ──
const typeMap={wav:'audio',mp3:'audio',ogg:'audio',flac:'audio',aac:'audio',m4a:'audio',wma:'audio',pdf:'document',doc:'document',docx:'document',txt:'document',csv:'document',xlsx:'document',xls:'document',rtf:'document',png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',svg:'image',bmp:'image',mp4:'video',mov:'video',avi:'video',mkv:'video',webm:'video',zip:'document',rar:'document'};
const iconMap={document:'📄',image:'🖼️',audio:'🎵',video:'🎬',dossier:'📋',doc:'📄',map:'🗺️',locked:'🔒'};
function detectType(name){const ext=(name.split('.').pop()||'').toLowerCase();return typeMap[ext]||'document'}
function detectIcon(type){return iconMap[type]||'📄'}

// ── Upload storage ──
let pendingUpload='';
function handleUpload(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{pendingUpload=e.target.result;const zone=document.getElementById('uploadZone');zone.classList.add('has-file');zone.innerHTML=`<img src="${pendingUpload}" class="upload-preview"><br>✓ ${file.name}`};
  reader.readAsDataURL(file);
}
let pendingMediaFileUrl='';
let _uploadingIndicator=null;

async function uploadFileToDrive(file,subfolder){
  // Step 1: Get an upload ticket from cb-api (secret stays server-side)
  const ticketResult=await apiCall('getUploadUrl',{subfolder:subfolder||''});
  if(!ticketResult.ok)throw new Error(ticketResult.error||'Failed to get upload authorization');
  
  // Step 2: Upload directly to R2 Worker with the one-time ticket
  const formData=new FormData();
  formData.append('file',file);
  formData.append('fileName',file.name||'upload_'+Date.now());
  formData.append('mimeType',file.type||'application/octet-stream');
  formData.append('subfolder',subfolder||'');
  
  const resp=await fetch(ticketResult.uploadUrl,{
    method:'POST',
    headers:{'X-Upload-Ticket':ticketResult.ticket},
    body:formData
  });
  
  const result=await resp.json();
  if(!result.ok)throw new Error(result.error||'Upload failed');
  
  return{
    ok:true,
    directUrl:result.url,
    previewUrl:result.url,
    fileId:result.key,
    fileName:result.fileName,
    mimeType:result.mimeType
  };
}

function showUploadProgress(zone,msg){
  if(zone)zone.innerHTML=`<div style="text-align:center;padding:10px"><div class="upload-spinner"></div><div style="font-size:9px;color:var(--amber);margin-top:6px;letter-spacing:1px">${msg||'UPLOADING TO DRIVE...'}</div></div>`;
}

function handleMediaUpload(input){
  const file=input.files[0];if(!file)return;
  const nameEl=document.getElementById('em_name');
  const typeEl=document.getElementById('em_type');
  const iconEl=document.getElementById('em_ico');
  if(!nameEl.value.trim())nameEl.value=file.name;
  const t=detectType(file.name);
  typeEl.value=t;
  iconEl.value=detectIcon(t);
  
  // Show upload progress
  input.insertAdjacentHTML('afterend','<div id="em_upload_status" style="font-size:9px;color:var(--cyan);margin-top:4px">Uploading...</div>');
  
  uploadFileToDrive(file,'media').then(result=>{
    pendingMediaFileUrl=result.directUrl;
    const status=document.getElementById('em_upload_status');
    if(status){status.textContent='✓ Uploaded successfully';status.style.color='var(--green)'}
  }).catch(err=>{
    console.error('Upload error:',err);
    const status=document.getElementById('em_upload_status');
    if(status){status.textContent='✗ Upload failed — try again';status.style.color='var(--red)'}
  }).finally(()=>{try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur()}catch(e){} _resetZoomCursor();});
}
function switchTab(btn,tab){btn.parentElement.querySelectorAll('.edit-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');btn.parentElement.parentElement.querySelectorAll('.edit-tab-content').forEach(c=>c.classList.remove('active'));document.getElementById('tab-'+tab).classList.add('active')}

// ── Operation Name ──
function editOperationName(){
  showEditModal(`<h3>Edit Operation Details</h3>
    <div class="edit-font-row"><div class="edit-field"><label>Operation Title</label><input id="eo_name" value="${operationName}"></div><div class="edit-field"><label>Font</label>${fontSelect('eo_name_font',operationFont)}</div></div>
    <div style="display:flex;gap:10px;margin-top:6px;justify-content:flex-end"><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveOperationName()">Save</button></div>`);
}
function saveOperationName(){
  operationName=document.getElementById('eo_name').value.trim()||'Operation Dead Drop';
  operationFont=document.getElementById('eo_name_font').value;
  const ct=document.getElementById('consoleTitle');
  if(ct)ct.textContent='◈ '+operationName;
  applyOperationFont(operationFont);
  // Update page title and registration screen
  document.title=operationName+' — Console';
  const regTitle=document.getElementById('regScreenTitle');
  if(regTitle)regTitle.textContent=operationName;
  const loginTitle=document.getElementById('loginTitle');
  if(loginTitle)loginTitle.textContent=operationName;
  hideEditModal();
  saveEventConfigToBackend();
}

// ── Grid Tiles ──
function vaultBadgeText(){
  const u=vaultCodes.filter(c=>c.unlocked).length,t=vaultCodes.length;
  if(t===0)return 'EMPTY';
  if(u===0)return t===1?'1 LOCKED ITEM':t+' LOCKED ITEMS';
  if(u===t)return t===1?'1 ITEM UNLOCKED':t+' ITEMS UNLOCKED';
  return u+' OF '+t+' ITEMS UNLOCKED';
}
function updateVaultBadgeColor(){
  const badge=document.getElementById('vaultBadge');
  if(!badge)return;
  const u=vaultCodes.filter(c=>c.unlocked).length,t=vaultCodes.length;
  badge.textContent=vaultBadgeText();
  if(t===0){badge.style.color='';return}
  const pct=u/t;
  if(pct>=1){badge.style.color='#00ff88';badge.style.textShadow='0 0 8px rgba(0,255,136,.5)'}
  else if(pct>=0.75){badge.style.color='#66ff88';badge.style.textShadow='0 0 4px rgba(0,255,136,.3)'}
  else if(pct>=0.5){badge.style.color='#aadd66';badge.style.textShadow=''}
  else if(pct>0){badge.style.color='#ccbb44';badge.style.textShadow=''}
  else{badge.style.color='';badge.style.textShadow=''}
}
function tileBadgeText(id,isAdmin){
  if(id==='feed')return posts.length?posts.length+(posts.length===1?' POST':' POSTS'):'NO INTEL';
  if(id==='media'){
    const count=isAdmin?mediaItems.length:mediaItems.filter(m=>!m.vaultLocked||vaultCodes.find(c=>c.linkedMediaIdx===mediaItems.indexOf(m)&&c.unlocked)).length;
    return count?count+(count===1?' ITEM':' ITEMS'):'0 ITEMS';
  }
  if(id==='vault')return vaultBadgeText();
  // intel — count filled fields from best available source
  let filled=0;
  // 1. Try DOM inputs (most current when panel is open)
  const inputs=document.querySelectorAll('.intel-exp-input');
  if(inputs.length>0){
    inputs.forEach(inp=>{if(inp.value&&inp.value.trim())filled++});
  }else{
    // 2. Fall back to localStorage drafts (reliable when panel is closed)
    try{
      const tid=currentVaultTeam?.id||'UNKNOWN';
      const raw=localStorage.getItem('cb_gs_'+tid+'_intelDraft');
      if(raw){const d=JSON.parse(raw);filled=Object.keys(d).filter(k=>d[k]&&String(d[k]).trim()).length}
    }catch(e){}
  }
  if(isSubmitted) return filled+' OF '+intelFields.length+' SUBMITTED';
  return filled+' OF '+intelFields.length+' ENTERED';
}
function renderGrid(){
  updateTileStates(); // Always recalculate orb states before rendering
  const isA=document.body.classList.contains('admin-mode')&&!document.body.classList.contains('player-preview');
  const g=document.getElementById('consoleGrid');
  g.innerHTML=gridTiles.map((t,i)=>{
    const isIntel=t.id==='intel';
    const isVault=t.id==='vault';
    const badgeCls=isVault?' crimson':isIntel?' violet':'';
    return `<div class="crt-monitor" data-tile="${t.id}" onclick="openPanel('${t.id}')">
      ${isA?`<div class="admin-edit-btn" onclick="event.stopPropagation();editGridTile(${i})">✎</div>`:''}
      <div class="crt-screw s1"></div><div class="crt-screw s2"></div><div class="crt-screw s3"></div><div class="crt-screw s4"></div>
      <div class="crt-led"></div>
      <div class="crt-screen">
        <div class="tile-glow"></div>
        <div class="tile-icon">${t.icon.startsWith('http')||t.icon.startsWith('data:')?`<img src="${t.icon}" style="width:58px;height:58px;object-fit:contain">`:t.icon}</div>
        <div class="tile-label" style="${fontStyle(t.labelFont)}">${t.label}</div>
        <div class="tile-sub" style="${fontStyle(t.subFont)}">${t.sub}</div>
        <div class="tile-badge${badgeCls}" id="${t.badgeId}">${tileBadgeText(t.id,isA)}</div>
        <div class="tile-status" title="${t.dotClass==='active'?'Activity detected recently':t.dotClass==='idle'?'No recent activity':'No activity recorded yet'}"><div class="tile-dot ${t.dotClass}"></div><span class="tile-status-label ${t.dotClass}">${t.status}</span></div>
      </div>
    </div>`;
  }).join('');
  updateVaultBadgeColor();
}
function editGridTile(i){
  const t=gridTiles[i];
  const isImgIcon=t.icon.startsWith('http')||t.icon.startsWith('data:');
  showEditModal(`<h3>Edit Grid Tile: ${t.label}</h3>
    <div class="edit-field"><label>Icon</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="eg_icon" value="${isImgIcon?'':t.icon}" placeholder="Type emoji (e.g. 📡)" style="flex:1;${isImgIcon?'display:none':''}">
        <label style="cursor:pointer;font-size:9px;color:var(--cyan);letter-spacing:1px;padding:8px 12px;border:1px solid rgba(0,212,255,.2);border-radius:3px;background:rgba(0,212,255,.05);white-space:nowrap">
          📁 Upload Image
          <input type="file" accept="image/*" onchange="handleGridIconUpload(this)" style="display:none">
        </label>
      </div>
      ${isImgIcon?`<div style="margin-top:6px;display:flex;align-items:center;gap:8px"><img src="${t.icon}" style="width:36px;height:36px;object-fit:contain;border-radius:4px;border:1px solid var(--border)"><span style="font-size:8px;color:#666">Current icon</span><button onclick="document.getElementById('eg_icon').style.display='';document.getElementById('eg_icon').value='📡';this.parentElement.remove()" style="font-size:8px;color:var(--red);background:none;border:1px solid rgba(255,50,50,.2);border-radius:3px;padding:2px 8px;cursor:pointer">Remove</button></div>`:''}
      <div id="eg_icon_preview"></div>
    </div>
    <div class="edit-font-row">
      <div class="edit-field"><label>Label</label><input id="eg_label" value="${t.label}"></div>
      <div class="edit-field"><label>Label Font</label>${fontSelect('eg_label_font',t.labelFont)}</div>
    </div>
    <label style="display:flex;align-items:center;gap:6px;margin:-8px 0 10px;cursor:pointer"><input type="checkbox" id="eg_label_all"><span style="font-size:9px;color:#888;letter-spacing:1px">Apply label font to all grid tiles</span></label>
    <div class="edit-font-row"><div class="edit-field"><label>Description</label><input id="eg_sub" value="${t.sub}"></div><div class="edit-field"><label>Desc Font</label>${fontSelect('eg_sub_font',t.subFont)}</div></div>
    <label style="display:flex;align-items:center;gap:6px;margin:-8px 0 10px;cursor:pointer"><input type="checkbox" id="eg_sub_all"><span style="font-size:9px;color:#888;letter-spacing:1px">Apply description font to all grid tiles</span></label>
    <div style="font-size:9px;color:#555;letter-spacing:.5px;padding:6px 0;border-top:1px solid var(--border);margin-top:4px">🟢 Status orb is auto-managed by activity thresholds (configurable in Mission Control)</div>
    <div style="display:flex;gap:10px;margin-top:6px;justify-content:flex-end"><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveGridTile(${i})">Save</button></div>`);
  // If image icon, store URL in hidden state
  if(isImgIcon)document.getElementById('eg_icon').value=t.icon;
}
function handleGridIconUpload(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  const preview=document.getElementById('eg_icon_preview');
  // Show uploading state
  preview.innerHTML=`<div style="margin-top:6px;display:flex;align-items:center;gap:8px"><span style="font-size:8px;color:var(--amber);letter-spacing:1px">⏳ Uploading to R2...</span></div>`;
  // Upload to R2
  uploadFileToDrive(file,'grid-icons').then(result=>{
    document.getElementById('eg_icon').value=result.directUrl;
    document.getElementById('eg_icon').style.display='none';
    preview.innerHTML=`<div style="margin-top:6px;display:flex;align-items:center;gap:8px"><img src="${result.directUrl}" style="width:36px;height:36px;object-fit:contain;border-radius:4px;border:1px solid var(--border)"><span style="font-size:8px;color:var(--green)">✓ Image uploaded</span></div>`;
  }).catch(err=>{
    console.error('Grid icon upload error:',err);
    // Fallback to data URL if R2 fails
    const reader=new FileReader();
    reader.onload=function(e){
      document.getElementById('eg_icon').value=e.target.result;
      preview.innerHTML=`<div style="margin-top:6px;display:flex;align-items:center;gap:8px"><img src="${e.target.result}" style="width:36px;height:36px;object-fit:contain;border-radius:4px;border:1px solid var(--border)"><span style="font-size:8px;color:var(--amber)">✓ Image loaded (local)</span></div>`;
    };
    reader.readAsDataURL(file);
  });
}
function saveGridTile(i){
  gridTiles[i].icon=document.getElementById('eg_icon').value.trim()||'📡';
  gridTiles[i].label=document.getElementById('eg_label').value.trim();
  gridTiles[i].sub=document.getElementById('eg_sub').value.trim();
  const lf=document.getElementById('eg_label_font').value;
  const sf=document.getElementById('eg_sub_font').value;
  gridTiles[i].labelFont=lf;
  gridTiles[i].subFont=sf;
  if(document.getElementById('eg_label_all').checked)gridTiles.forEach(t=>t.labelFont=lf);
  if(document.getElementById('eg_sub_all').checked)gridTiles.forEach(t=>t.subFont=sf);
  try{localStorage.setItem('cb_gridTiles',JSON.stringify(gridTiles.map(t=>({id:t.id,icon:t.icon,label:t.label,sub:t.sub,labelFont:t.labelFont,subFont:t.subFont}))))}catch(e){}
  hideEditModal();renderGrid();saveEventConfigToBackend();
}

// ── Intel Fields ──
function renderIntelForm(){
  const isA=document.body.classList.contains('admin-mode')&&!document.body.classList.contains('player-preview');
  const form=document.getElementById('intelForm');
  // Preserve existing input values
  const prevVals={};
  form.querySelectorAll('.intel-exp-input').forEach(inp=>{prevVals[inp.dataset.idx]=inp.value});
  let html='';
  intelFields.forEach((f,i)=>{
    const num=String(i+1).padStart(2,'0');
    // Admin tools are positioned absolutely — they don't affect row layout
    const adminTools=isA?`<div class="intel-admin-tools"><div class="drag-handle" onpointerdown="startIntelDrag(event,${i})" onclick="event.stopPropagation()">⋮⋮</div><div class="admin-row-edit" onclick="event.stopPropagation();editIntelField(${i})">✎</div></div>`:'';
    const _lFont=resolveFont('intelLabel',f.font||'');
    const _iFont=resolveFont('intelInput',f.inputFont||'');
    const lStyle=_lFont?` style="${fontStyle(_lFont)}"`:'';
    const iStyle=_iFont?` style="${fontStyle(_iFont)}"`:'';
    const clearBtn=`<div class="intel-saved-blip" data-save-idx="${i}">SAVED</div><div class="intel-exp-clear" onclick="clearIntelSlot(this)" title="Clear">✕</div>`;
    const keyHandler='onkeydown="if(event.key===\'Enter\'){this.blur()}"';
    const ph=f.placeholder||'···';
    if((f.type||f.fieldType)==='money'){
      const _moneyIStyle=_iFont?`border:none;background:transparent;box-shadow:none;${fontStyle(_iFont)}`:'border:none;background:transparent;box-shadow:none';
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><div class="intel-prefix-wrap"><span class="intel-prefix">$</span><input class="intel-exp-input" style="${_moneyIStyle}" placeholder="${ph}" data-idx="${i}" oninput="formatMoney(this)" ${keyHandler}></div>${clearBtn}</div>`;
    }else if(f.type==='phone'){
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><input class="intel-exp-input"${iStyle} placeholder="${f.placeholder||'(XXX) XXX-XXXX'}" data-idx="${i}" oninput="formatPhone(this)" ${keyHandler}>${clearBtn}</div>`;
    }else if(f.type==='number'){
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><input class="intel-exp-input"${iStyle} placeholder="${ph}" data-idx="${i}" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9.\\-]/g,'')" ${keyHandler}>${clearBtn}</div>`;
    }else if(f.type==='date'){
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><input class="intel-exp-input"${iStyle} placeholder="${f.placeholder||'MM/DD/YYYY'}" data-idx="${i}" oninput="formatDate(this)" maxlength="10" ${keyHandler}>${clearBtn}</div>`;
    }else if(f.type==='email'){
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><input class="intel-exp-input"${iStyle} placeholder="${f.placeholder||'name@domain.com'}" data-idx="${i}" inputmode="email" ${keyHandler}>${clearBtn}</div>`;
    }else if(f.type==='plate'){
      const _plateIStyle=`text-transform:uppercase;letter-spacing:2px${_iFont?';'+fontStyle(_iFont):''}`;
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><input class="intel-exp-input" placeholder="${f.placeholder||'ABC-1234'}" data-idx="${i}" style="${_plateIStyle}" oninput="this.value=this.value.toUpperCase()" maxlength="12" ${keyHandler}>${clearBtn}</div>`;
    }else if(f.type==='select'){
      const opts=(f.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('');
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><select class="intel-exp-input intel-select"${iStyle} data-idx="${i}"><option value="">— Select —</option>${opts}</select>${clearBtn}</div>`;
    }else if(f.type==='dual'){
      const ph1=f.placeholder1||'Value 1';
      const ph2=f.placeholder2||'Value 2';
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><div class="intel-dual-wrap"><input class="intel-exp-input"${iStyle} placeholder="${ph1}" data-idx="${i}" ${keyHandler}><span class="intel-dual-sep">&</span><input class="intel-exp-input"${iStyle} placeholder="${ph2}" data-idx="${i}b" ${keyHandler}></div>${clearBtn}</div>`;
    }else{
      html+=`<div class="intel-exp-row" data-idx="${i}">${adminTools}<span class="intel-exp-num">${num}</span><span class="intel-exp-label"${lStyle}>${f.label} ${f.emoji}</span><input class="intel-exp-input"${iStyle} placeholder="${ph}" data-idx="${i}" ${keyHandler}>${clearBtn}</div>`;
    }
  });
  if(isA)html+=`<div class="admin-add-btn" style="margin-top:10px;padding:14px;max-width:600px;width:100%" onclick="addIntelField()">+ Add Intel Field</div>`;
  form.innerHTML=html;
  // Render transmit button into sticky dock
  const dock=document.getElementById('intelTransmitDock');
  const isAdminUser=document.body.classList.contains('admin-mode');
  const isPreview=document.body.classList.contains('player-preview');
  if(dock){
    if(isAdminUser&&!isPreview){
      dock.innerHTML=`<button class="intel-submit-btn intel-submit-admin-test" id="intelSubmitBtn" onclick="showConfirm()">SUBMIT INTEL</button>`;
    }else{
      dock.innerHTML=`<button class="intel-submit-btn" id="intelSubmitBtn" onclick="showConfirm()">SUBMIT INTEL</button>`;
    }
  }
  // Restore values
  form.querySelectorAll('.intel-exp-input').forEach(inp=>{if(prevVals[inp.dataset.idx])inp.value=prevVals[inp.dataset.idx]});
  if(isSubmitted){form.querySelectorAll('.intel-exp-input').forEach(inp=>{inp.disabled=true});const btn=document.getElementById('intelSubmitBtn');if(btn){btn.disabled=true;btn.textContent='INTEL SUBMITTED'};const ntc=document.getElementById('intelNotice');if(ntc)ntc.style.display='none';form.querySelectorAll('.intel-saved-blip,.intel-exp-clear').forEach(el=>el.style.display='none')}
  // Sync intelLabels array
  syncIntelLabels();
}
// Delegated listener: auto-save intel draft as user types
let _draftSaveTimer=null;
function saveDraftsToBackend(){
  if(!currentVaultTeam||isAdmin)return;
  const drafts={};
  document.querySelectorAll('.intel-exp-input').forEach(inp=>{
    const idx=inp.dataset.idx;
    if(idx!==undefined&&inp.value.trim())drafts[idx]=inp.value;
  });
  apiCall('saveDrafts',{teamId:currentVaultTeam.id,drafts:drafts}).then(r=>{
    if(!r||!r.ok)console.warn('Draft save failed:',r);
  });
}
function loadDraftsFromBackend(){
  if(!currentVaultTeam||isAdmin)return;
  apiCall('getDrafts',{teamId:currentVaultTeam.id}).then(r=>{
    if(!r||!r.ok)return;
    // Restore submission state from backend
    if(r.submitted&&!isSubmitted){
      isSubmitted=true;
      try{localStorage.setItem(_gsKey('isSubmitted'),'1')}catch(e){}
      // Store submitted answers as draft so restoreIntelDraft can populate them
      if(r.answers&&typeof r.answers==='object'&&Object.keys(r.answers).length>0){
        const indexedAnswers={};
        intelFields.forEach((f,i)=>{if(r.answers[f.label])indexedAnswers[String(i)]=r.answers[f.label]});
        try{localStorage.setItem(_gsKey('intelDraft'),JSON.stringify(indexedAnswers))}catch(e){}
      }
      // Lock form if intel panel is already rendered
      const intelInputs=document.querySelectorAll('.intel-exp-input');
      if(intelInputs.length>0){
        intelFields.forEach((f,i)=>{const inp=intelInputs[i];if(inp&&r.answers&&r.answers[f.label])inp.value=r.answers[f.label]});
        intelInputs.forEach(inp=>inp.disabled=true);
        const btn=document.getElementById('intelSubmitBtn');
        if(btn){btn.disabled=true;btn.textContent='INTEL SUBMITTED'}
      }
      renderGrid(); // Update tile badge
      return;
    }
    // Not submitted — restore drafts
    if(!r.drafts)return;
    const drafts=typeof r.drafts==='string'?JSON.parse(r.drafts):r.drafts;
    if(!drafts||typeof drafts!=='object')return;
    try{localStorage.setItem(_gsKey('intelDraft'),JSON.stringify(drafts))}catch(e){}
    document.querySelectorAll('.intel-exp-input').forEach(inp=>{
      const idx=inp.dataset.idx;
      if(idx!==undefined&&drafts[idx]&&!inp.value.trim()){inp.value=drafts[idx]}
    });
  });
}
(function(){
  const form=document.getElementById('intelForm');
  if(form){
    // Auto-save drafts as user types (silent, no blip)
    form.addEventListener('input',function(e){
      if(e.target.classList.contains('intel-exp-input')){
        clearTimeout(_draftSaveTimer);
        _draftSaveTimer=setTimeout(()=>{
          saveGameState();
          saveDraftsToBackend();
        },1500);
      }
    });
    // Show SAVED blip on blur (tab/click away) or Enter — only if field has content
    function _showSavedBlip(target){
      if(!target.classList.contains('intel-exp-input'))return;
      const idx=target.dataset.idx;
      if(!target.value.trim())return; // Don't show SAVED on empty/cleared fields
      const blip=document.querySelector('.intel-saved-blip[data-save-idx="'+idx+'"]');
      if(blip){
        blip.classList.add('show');
        clearTimeout(blip._hideTimer);
        blip._hideTimer=setTimeout(()=>blip.classList.remove('show'),2500);
      }
      // Also trigger an immediate save
      clearTimeout(_draftSaveTimer);
      saveGameState();
      saveDraftsToBackend();
    }
    form.addEventListener('focusout',function(e){_showSavedBlip(e.target)});
    form.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&e.target.classList.contains('intel-exp-input')){_showSavedBlip(e.target)}
    });
    // Also handle select dropdowns (change event)
    form.addEventListener('change',function(e){
      if(e.target.classList.contains('intel-exp-input')){_showSavedBlip(e.target)}
    });
  }
})();
function syncIntelLabels(){
  const labels=[];
  intelFields.forEach(f=>{
    if(f.type==='dual'){labels.push(f.label+' 1');labels.push(f.label+' 2')}
    else labels.push(f.label);
  });
  while(intelLabels.length)intelLabels.pop();
  labels.forEach(l=>intelLabels.push(l));
}
function clearIntelSlot(btn){
  const row=btn.closest('.intel-exp-row');
  if(!row)return;
  row.querySelectorAll('.intel-exp-input').forEach(inp=>{inp.value='';inp.focus()});
}
function editIntelField(i){
  const f=intelFields[i];
  const a=f.answer||{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10};
  const isDual=f.type==='dual';
  const expInputs=isDual?
    `<div class="edit-font-row"><div class="edit-field"><label>Expected Answer 1</label><input id="ei_exp1" value="${(a.expected[0]||'')}" placeholder="Primary answer"></div><div class="edit-field"><label>Expected Answer 2</label><input id="ei_exp2" value="${(a.expected[1]||'')}" placeholder="Second value"></div></div>`:
    `<div class="edit-field"><label>Expected Answer</label><input id="ei_exp1" value="${(a.expected[0]||'')}" placeholder="The correct answer"></div>`;

  showEditModal(`<h3>Edit Intel Field #${i+1}</h3>
    <div class="edit-tabs" style="margin-bottom:14px"><button class="edit-tab active" onclick="switchTab(this,'field')">Field Settings</button><button class="edit-tab" onclick="switchTab(this,'answer')">🔑 Answer Key</button></div>
    <div class="edit-tab-content active" id="tab-field">
      <div class="edit-field-row">
        <div class="edit-field"><label>Label</label><input id="ei_label" value="${f.label}"></div>
        <div class="edit-field" style="flex:.3"><label>Emoji</label><input id="ei_emoji" value="${f.emoji}"></div>
      </div>
      <div class="edit-font-row"><div class="edit-field"><label>Input Type</label><select id="ei_type"><option${f.type==='text'?' selected':''} value="text">Text (general)</option><option${f.type==='number'?' selected':''} value="number">Number</option><option${f.type==='money'?' selected':''} value="money">Money ($)</option><option${f.type==='phone'?' selected':''} value="phone">Phone #</option><option${f.type==='date'?' selected':''} value="date">Date</option><option${f.type==='email'?' selected':''} value="email">Email</option><option${f.type==='plate'?' selected':''} value="plate">License Plate</option><option${f.type==='dual'?' selected':''} value="dual">Dual Field</option><option${f.type==='select'?' selected':''} value="select">Multiple Choice</option></select></div></div>
      ${isDual?`<div class="edit-field-row"><div class="edit-field"><label>Placeholder 1</label><input id="ei_ph1" value="${f.placeholder1||''}" placeholder="e.g. Island 1"></div><div class="edit-field"><label>Placeholder 2</label><input id="ei_ph2" value="${f.placeholder2||''}" placeholder="e.g. Island 2"></div></div>`:f.type==='select'?`<div class="edit-field"><label>Dropdown Options (comma-separated)</label><input id="ei_options" value="${(f.options||[]).join(', ')}" placeholder="e.g. Option A, Option B, Option C"></div>`:`<div class="edit-field"><label>Placeholder Text</label><input id="ei_ph" value="${f.placeholder||''}" placeholder="e.g. Enter answer here"></div>`}

    </div>
    <div class="edit-tab-content" id="tab-answer">
      ${expInputs}
      <div class="edit-field"><label>Accepted Alternatives (comma-separated)</label><input id="ei_alts" value="${(a.alts||[]).join(', ')}" placeholder="e.g. NY, New York City, NYC"></div>
      <div class="edit-field-row">
        <div class="edit-field"><label>Match Mode</label><select id="ei_match"><option value="exact"${a.matchMode==='exact'?' selected':''}>Exact Match</option><option value="contains"${a.matchMode==='contains'?' selected':''}>Contains</option><option value="fuzzy"${a.matchMode==='fuzzy'?' selected':''}>Fuzzy Match</option></select></div>
        <div class="edit-field"><label>Fuzzy Tolerance (%)</label><input type="number" id="ei_fuzzy" value="${a.fuzzyThreshold||85}" min="50" max="100" step="5"></div>
      </div>
      <div class="edit-field-row">
        <div class="edit-field"><label>Points</label><input type="number" id="ei_pts" value="${a.points||10}" min="1" max="100"></div>
        <div class="edit-field"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ei_case" ${a.caseSensitive?'checked':''}> Case Sensitive</label></div>
      </div>
      <div style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:4px;background:rgba(0,255,136,.02)">
        <div style="font-family:Saira,sans-serif;font-size:9px;letter-spacing:2px;color:var(--green);margin-bottom:8px;font-weight:600">TEST ANSWER</div>
        <div class="edit-font-row"><div class="edit-field"><input id="ei_test" placeholder="Type a test submission..."></div><button class="ap-btn ap-btn-green" onclick="testIntelAnswer(${i})" style="flex-shrink:0;margin-bottom:10px">Test</button></div>
        <div id="ei_testResult" style="font-family:IBM Plex Mono,monospace;font-size:9px;letter-spacing:1px;min-height:16px"></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px"><button class="btn-standard btn-red" onclick="confirmDelete(this,()=>deleteIntelField(${i}))">Delete</button><span style="flex:1"></span><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveIntelField(${i})">Save</button></div>`);
}
function testIntelAnswer(i){
  const testVal=document.getElementById('ei_test').value;
  const cfg={
    expected:[document.getElementById('ei_exp1').value.trim()],
    alts:(document.getElementById('ei_alts').value||'').split(',').map(s=>s.trim()).filter(Boolean),
    caseSensitive:document.getElementById('ei_case').checked,
    matchMode:document.getElementById('ei_match').value,
    fuzzyThreshold:parseInt(document.getElementById('ei_fuzzy').value)||85,
    points:parseInt(document.getElementById('ei_pts').value)||10
  };
  const exp2=document.getElementById('ei_exp2');
  if(exp2)cfg.expected.push(exp2.value.trim());

  const r=checkSingleAnswer(testVal,cfg);
  const el=document.getElementById('ei_testResult');
  if(r.correct){
    el.style.color='var(--green)';
    el.textContent='✓ ACCEPTED — '+r.match+(r.similarity?' ('+r.similarity+'% match)':'');
  }else if(r.match==='empty'){
    el.style.color='var(--amber)';el.textContent='— No input to test';
  }else if(r.match==='no-answer-key'){
    el.style.color='var(--amber)';el.textContent='— No expected answer configured';
  }else{
    el.style.color='var(--red)';
    el.textContent='✗ REJECTED — closest match: '+r.closestSimilarity+'%';
  }
}
function saveIntelField(i){
  intelFields[i].label=document.getElementById('ei_label').value.trim();
  intelFields[i].emoji=document.getElementById('ei_emoji').value.trim();
  intelFields[i].type=document.getElementById('ei_type').value;
  // font/inputFont managed centrally via Typography panel — not edited per-field
  // Save placeholders / options
  if(intelFields[i].type==='dual'){
    intelFields[i].placeholder1=document.getElementById('ei_ph1')?.value.trim()||'';
    intelFields[i].placeholder2=document.getElementById('ei_ph2')?.value.trim()||'';
  }else if(intelFields[i].type==='select'){
    intelFields[i].options=(document.getElementById('ei_options')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  }else{
    intelFields[i].placeholder=document.getElementById('ei_ph')?.value.trim()||'';
  }
  // Save answer config
  const exp1=document.getElementById('ei_exp1')?.value.trim()||'';
  const exp2=document.getElementById('ei_exp2')?.value.trim()||'';
  intelFields[i].answer={
    expected:exp2?[exp1,exp2]:[exp1],
    alts:(document.getElementById('ei_alts')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    caseSensitive:document.getElementById('ei_case')?.checked||false,
    matchMode:document.getElementById('ei_match')?.value||'exact',
    fuzzyThreshold:parseInt(document.getElementById('ei_fuzzy')?.value)||85,
    points:parseInt(document.getElementById('ei_pts')?.value)||10
  };
  hideEditModal();renderIntelForm();renderGrid();saveIntelFieldsToBackend();
}
// Two-step delete: first click shows confirm, second click executes
function confirmDelete(btn,fn){
  if(btn.dataset.armed){fn();return}
  btn.dataset.armed='1';btn.textContent='⚠ Confirm?';btn.style.background='rgba(255,50,50,.25)';
  setTimeout(()=>{if(btn){btn.dataset.armed='';btn.textContent='Delete';btn.style.background=''}},3000);
}
function deleteIntelField(i){intelFields.splice(i,1);hideEditModal();renderIntelForm();renderGrid();saveIntelFieldsToBackend()}
function addIntelField(){
  showEditModal(`<h3>Add Intel Field</h3>
    <div class="edit-field-row">
      <div class="edit-field"><label>Label</label><input id="ei_label" value=""></div>
      <div class="edit-field" style="flex:.3"><label>Emoji</label><input id="ei_emoji" value="📋"></div>
    </div>
    <div class="edit-field"><label>Input Type</label><select id="ei_type"><option value="text" selected>Text (general)</option><option value="number">Number</option><option value="money">Money ($)</option><option value="phone">Phone #</option><option value="date">Date</option><option value="email">Email</option><option value="plate">License Plate</option><option value="dual">Dual Field</option><option value="select">Multiple Choice</option></select></div>
    <div style="display:flex;gap:10px;margin-top:6px;justify-content:flex-end"><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveNewIntelField()">Add Field</button></div>`);
}
function saveNewIntelField(){
  intelFields.push({
    label:document.getElementById('ei_label').value.trim()||'New Field',
    emoji:document.getElementById('ei_emoji').value.trim()||'📋',
    type:document.getElementById('ei_type').value,
    font:'',
    inputFont:'',
    answer:{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85,points:10}
  });
  hideEditModal();renderIntelForm();renderGrid();saveIntelFieldsToBackend();
}

// ── Feed Posts ──
let pendingFeedUpload='';
let pendingFeedUploadType='';
function handleFeedUpload(input){
  const file=input.files[0];if(!file)return;
  const zone=document.getElementById('feedUploadZone');
  const isVideo=file.type.startsWith('video/');
  
  showUploadProgress(zone,'UPLOADING '+(isVideo?'VIDEO':'IMAGE')+' TO DRIVE...');
  
  uploadFileToDrive(file,'feed').then(result=>{
    if(isVideo){
      pendingFeedUpload=result.directUrl;
      pendingFeedUploadType='video';
      zone.innerHTML=`<div style="text-align:center"><div style="font-size:24px;margin-bottom:4px">🎬</div><span style="font-size:9px;color:var(--green)">✓ ${file.name} uploaded to Drive</span></div>`;
      zone.classList.add('has-file');
      showFocalPointForUpload(null);
    }else{
      pendingFeedUpload=result.directUrl;
      pendingFeedUploadType='image';
      console.log('[FEED UPLOAD] R2 success, URL:',result.directUrl);
      zone.innerHTML=`<img src="${result.directUrl}" class="upload-preview"><br><span style="font-size:9px;color:var(--green)">✓ ${file.name} uploaded to Drive</span>`;
      zone.classList.add('has-file');
      showFocalPointForUpload(result.directUrl);
    }
    const vidField=document.getElementById('ef_video');
    if(vidField)vidField.value='';
  }).catch(err=>{
    console.error('[FEED UPLOAD] FAILED, falling back to local:',err);
    // Fallback to local
    if(isVideo){
      const blobUrl=URL.createObjectURL(file);
      pendingFeedUpload=blobUrl;
      pendingFeedUploadType='video';
      zone.innerHTML=`<video src="${blobUrl}" style="max-width:100%;max-height:120px;border-radius:4px" muted autoplay loop playsinline></video><br><span style="font-size:9px;color:var(--amber)">⚠ ${file.name} (local only - Drive failed)</span>`;
      zone.classList.add('has-file');
      showFocalPointForUpload(null);
    }else{
      const reader=new FileReader();
      reader.onload=e=>{
        pendingFeedUpload=e.target.result;
        pendingFeedUploadType='image';
        zone.innerHTML=`<img src="${pendingFeedUpload}" class="upload-preview"><br><span style="font-size:9px;color:var(--amber)">⚠ ${file.name} (local only - Drive failed)</span>`;
        zone.classList.add('has-file');
        showFocalPointForUpload(pendingFeedUpload);
      };
      reader.readAsDataURL(file);
    }
    const vidField=document.getElementById('ef_video');
    if(vidField)vidField.value='';
  });
}
function editFeedPost(i){
  const p=posts[i];pendingFeedUpload='';pendingFeedUploadType='';
  pendingFocalX=p.focalX||50;pendingFocalY=p.focalY||50;
  const hasMedia=!!p.mediaUrl;
  const isVid=hasMedia&&(p.mediaType==='video'||isVideoUrl(p.mediaUrl));
  const previewHtml=hasMedia?(isVid?`<video src="${p.mediaUrl}" style="max-width:100%;max-height:120px;border-radius:4px" muted autoplay loop playsinline></video><br><span style="font-size:9px;color:var(--green)">✓ Current video</span>`:`<img src="${p.mediaUrl}" class="upload-preview"><br><span style="font-size:9px;color:var(--green)">✓ Current image</span>`):'Click to upload image or video';
  showEditModal(`<h3>Edit Feed Post #${i+1}</h3>
    <div class="edit-field"><label>📷 Media</label>
      <div class="upload-zone ${hasMedia?'has-file':''}" id="feedUploadZone" onclick="document.getElementById('feedFileInput').click()">${hasMedia?previewHtml:'Click to upload image or video'}</div>
      <input type="file" id="feedFileInput" accept="image/*,video/*" style="display:none" onchange="handleFeedUpload(this)">
    </div>
    <div class="edit-field" id="focalPointField" style="${hasMedia&&!isVid?'':'display:none'}"><label>📌 Grid Crop Position <span style="font-size:8px;color:#555">Click to set focal point</span></label>
      <div class="focal-point-container" id="focalPointContainer" onmousedown="startFocalDrag(event)" ontouchstart="startFocalDrag(event)">
        <img src="${hasMedia&&!isVid?p.mediaUrl:''}" id="focalImg">
        <div class="focal-point-crosshair"></div>
        <div class="focal-point-marker" id="focalMarker" style="left:${p.focalX||50}%;top:${p.focalY||50}%"></div>
      </div>
      <div style="font-size:8px;color:#555;letter-spacing:.5px;margin-top:4px">Position: <span id="focalDisplay">${p.focalX||50}%, ${p.focalY||50}%</span></div>
    </div>
    <div class="edit-field"><label>Caption</label><textarea id="ef_cap">${p.cap}</textarea></div>
    <div style="display:flex;gap:10px;margin-top:6px"><button class="btn-standard btn-red" onclick="confirmDelete(this,()=>deleteFeedPost(${i}))">Delete</button><span style="flex:1"></span><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveFeedPost(${i})">Save</button></div>`);
}
// ── Focal Point Selector ──
let pendingFocalX=50,pendingFocalY=50,focalDragging=false;
function startFocalDrag(e){
  e.preventDefault();focalDragging=true;
  updateFocalFromEvent(e);
  const onMove=ev=>{if(focalDragging)updateFocalFromEvent(ev)};
  const onEnd=()=>{focalDragging=false;window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onEnd);window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onEnd)};
  window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onEnd);
  window.addEventListener('touchmove',onMove,{passive:false});window.addEventListener('touchend',onEnd);
}
function updateFocalFromEvent(e){
  const c=document.getElementById('focalPointContainer');if(!c)return;
  const rect=c.getBoundingClientRect();
  const clientX=e.touches?e.touches[0].clientX:e.clientX;
  const clientY=e.touches?e.touches[0].clientY:e.clientY;
  const x=Math.max(0,Math.min(100,((clientX-rect.left)/rect.width)*100));
  const y=Math.max(0,Math.min(100,((clientY-rect.top)/rect.height)*100));
  pendingFocalX=Math.round(x);pendingFocalY=Math.round(y);
  const marker=document.getElementById('focalMarker');
  if(marker){marker.style.left=pendingFocalX+'%';marker.style.top=pendingFocalY+'%'}
  const display=document.getElementById('focalDisplay');
  if(display)display.textContent=pendingFocalX+'%, '+pendingFocalY+'%';
}
function showFocalPointForUpload(imgSrc){
  const field=document.getElementById('focalPointField');
  const img=document.getElementById('focalImg');
  if(field&&img&&imgSrc){field.style.display='';img.src=imgSrc;pendingFocalX=50;pendingFocalY=50;
    const marker=document.getElementById('focalMarker');if(marker){marker.style.left='50%';marker.style.top='50%'}
    const display=document.getElementById('focalDisplay');if(display)display.textContent='50%, 50%';
  } else if(field){field.style.display='none'}
}

function isVideoUrl(url){
  if(!url)return false;
  return /youtube|youtu\.be|vimeo|drive\.google|dailymotion|streamable|loom\.com/i.test(url)||/\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}
function saveFeedPost(i){
  if(pendingFeedUpload){
    posts[i].mediaUrl=pendingFeedUpload;
    posts[i].mediaType=pendingFeedUploadType||'image';
  }
  posts[i].focalX=pendingFocalX;
  posts[i].focalY=pendingFocalY;
  posts[i].cap=document.getElementById('ef_cap').value.trim();
  pendingFeedUpload='';pendingFeedUploadType='';hideEditModal();renderFeed();renderGrid();
  if(document.getElementById('fvSingle')?.classList.contains('active'))renderSinglePost();
  saveFeedPostsToBackend();
}

// ── R2 Cleanup — delete file from R2 via backend proxy ──
function deleteFromR2(url){
  if(!url||!url.includes('.workers.dev/file/'))return;
  const key=url.split('/file/')[1];
  if(!key)return;
  apiCall('proxyDeleteFile',{fileKey:key}).catch(e=>{});
}

function deleteFeedPost(i){const delPost=posts[i];if(delPost&&delPost.imageUrl)deleteFromR2(delPost.imageUrl);posts.splice(i,1);if(currentPost>=posts.length)currentPost=Math.max(0,posts.length-1);hideEditModal();renderFeed();renderGrid();
  if(document.getElementById('fvSingle')?.classList.contains('active'))renderSinglePost();
  saveFeedPostsToBackend();
}
function addFeedPost(){pendingFeedUpload='';pendingFeedUploadType='';showEditModal(`<h3>Add Feed Post</h3>
    <div class="edit-field"><label>📷 Media</label>
      <div class="upload-zone" id="feedUploadZone" onclick="document.getElementById('feedFileInput').click()">Click to upload image or video</div>
      <input type="file" id="feedFileInput" accept="image/*,video/*" style="display:none" onchange="handleFeedUpload(this)">
    </div>
    <div class="edit-field"><label>Caption</label><textarea id="ef_cap"></textarea></div>
    <div style="display:flex;gap:10px;margin-top:6px;justify-content:flex-end"><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveNewFeedPost()">Add Post</button></div>`)}
function saveNewFeedPost(){
  const p={emoji:'📷',bg:'#1a1a2a',cap:document.getElementById('ef_cap').value.trim(),capFont:'',mediaType:'image',mediaUrl:''};
  if(pendingFeedUpload){
    p.mediaUrl=pendingFeedUpload;
    p.mediaType=pendingFeedUploadType||'image';
  }
  console.log('[FEED] saveNewFeedPost mediaUrl:',p.mediaUrl?.substring(0,80));
  posts.push(p);pendingFeedUpload='';hideEditModal();renderFeed();renderGrid();
  if(document.getElementById('fvSingle')?.classList.contains('active'))renderSinglePost();
  saveFeedPostsToBackend();
}

// ── Media Items (enhanced with file upload + auto-detect) ──
// ── Media Icon Picker (dropdown + custom upload) ──
const mediaIconPresets=[
  {v:'📄',l:'Document'},{v:'🖼️',l:'Image'},{v:'🎵',l:'Audio'},{v:'🎬',l:'Video'},
  {v:'📋',l:'Dossier'},{v:'🔒',l:'Locked'},{v:'📁',l:'File'},{v:'📊',l:'Data'},
  {v:'🗺️',l:'Map'},{v:'📎',l:'Attachment'},{v:'📷',l:'Photo'},{v:'🎤',l:'Recording'},
  {v:'💾',l:'Disk'},{v:'🔑',l:'Key'},{v:'📡',l:'Signal'},{v:'⚠️',l:'Warning'}
];
function buildIconPicker(currentIcon){
  const isCustom=currentIcon&&(currentIcon.startsWith('http')||currentIcon.startsWith('data:'));
  const opts=mediaIconPresets.map(p=>`<option value="${p.v}"${!isCustom&&currentIcon===p.v?' selected':''}>${p.v} ${p.l}</option>`).join('');
  return `<div style="display:flex;gap:4px;align-items:center">
    <select id="em_ico_select" onchange="if(this.value!=='__custom__')document.getElementById('em_ico').value=this.value" style="flex:1;font-size:13px" onfocus="this.classList.add('ico-expanded')" onblur="this.classList.remove('ico-expanded')">
      ${opts}
      <option value="__custom__"${isCustom?' selected':''}>⊕ Custom...</option>
    </select>
    <input id="em_ico" type="hidden" value="${currentIcon||'📄'}">
    <label style="cursor:pointer;font-size:8px;color:var(--cyan);padding:6px 8px;border:1px solid rgba(0,212,255,.2);border-radius:3px;white-space:nowrap" title="Upload custom icon">
      📁<input type="file" accept="image/*" onchange="handleIconUpload(this)" style="display:none">
    </label>
  </div>`;
}
function handleIconUpload(input){
  const file=input.files[0];if(!file)return;
  uploadFileToDrive(file,'icon').then(r=>{
    document.getElementById('em_ico').value=r.directUrl;
    const sel=document.getElementById('em_ico_select');if(sel)sel.value='__custom__';
  }).catch(()=>{
    const reader=new FileReader();
    reader.onload=e=>{document.getElementById('em_ico').value=e.target.result;const sel=document.getElementById('em_ico_select');if(sel)sel.value='__custom__'};
    reader.readAsDataURL(file);
  });
}

function editMediaItem(i){
  pendingMediaFileUrl='';
  const m=mediaItems[i];
  const typeOpts=['document','image','audio','video','dossier'].map(t=>`<option${m.type===t?' selected':''}>${t}</option>`).join('');
  const hasFile=m.fileUrl&&!m.fileUrl.startsWith('data:')&&!m.fileUrl.startsWith('blob:');
  const fileInfo=hasFile?`<div style="font-size:9px;color:var(--green);margin-bottom:6px">✓ File uploaded · <span style="color:#666;cursor:pointer" onclick="if(confirm('Remove uploaded file?')){document.getElementById('em_url_cleared').value='1';this.parentElement.style.display='none'}">remove</span></div>`:'';
  showEditModal(`<h3>Edit Item #${i+1}</h3>
    ${fileInfo}
    <div class="edit-field"><label>Upload File${hasFile?' (replace existing)':''}</label><input type="file" id="em_file" onchange="handleMediaUpload(this)"></div>
    <input type="hidden" id="em_url_cleared" value="0">
    <div class="edit-field"><label>File Name</label><input id="em_name" value="${m.name}"></div>
    <div class="edit-field-row">
      <div class="edit-field" style="flex:.4"><label>Icon</label>${buildIconPicker(m.icon)}</div>
    </div>
    <div class="edit-field"><label>Description</label><textarea id="em_desc">${m.desc}</textarea></div>
    <div class="edit-field-row">
      <div class="edit-field"><label>Category</label><select id="em_type">${typeOpts}</select></div>
      <div class="edit-field"><label>File Password <span style="color:#666;font-weight:400">(to open/view)</span></label><input id="em_key" value="${m.unlockKey||''}" placeholder="Leave blank = no password"></div>
    </div>
    <div style="margin:10px 0;padding:12px 14px;border:1px solid ${m.vaultLocked?'rgba(255,170,51,.25)':'var(--border)'};border-radius:5px;background:${m.vaultLocked?'rgba(255,170,51,.04)':'rgba(255,255,255,.01)'}" id="em_vault_box">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="em_vaultlock" ${m.vaultLocked?'checked':''} onchange="toggleVaultLockUI()"><span style="font-family:'Saira',sans-serif;font-size:11px;color:${m.vaultLocked?'var(--amber)':'#888'};letter-spacing:1px;font-weight:600">🔐 Vault-Locked</span></label>
      <div id="em_vault_fields" style="margin-top:10px;${m.vaultLocked?'':'display:none'}">
        <div class="edit-field-row" style="margin-top:4px">
          <div class="edit-field"><label>Vault Code <span style="color:#666;font-weight:400">(players enter this on the Vault keypad)</span></label><input id="em_vaultcode" value="${m.vaultCode||''}" placeholder="e.g. SHADOW42" style="font-size:13px;letter-spacing:3px;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="edit-field" style="flex:.6"><label>Codename <span style="color:#666;font-weight:400">(shown when locked)</span></label><input id="em_vaultcodename" value="${m.vaultCodename||''}" placeholder="e.g. FILE-001" style="letter-spacing:2px;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
        </div>
        <div style="font-family:'Chakra Petch',sans-serif;font-size:9px;color:#666;margin-top:4px">This item will be hidden from players until they crack the vault code. Once unlocked, it appears in the Evidence Locker.</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:6px"><button class="btn-standard btn-red" onclick="confirmDelete(this,()=>deleteMediaItem(${i}))">Delete</button><span style="flex:1"></span><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveMediaItem(${i})">Save</button></div>`);
}
function toggleVaultLockUI(){
  const cb=document.getElementById('em_vaultlock');
  const fields=document.getElementById('em_vault_fields');
  const box=document.getElementById('em_vault_box');
  const lbl=box.querySelector('span[style]');
  if(cb.checked){
    fields.style.display='';
    box.style.borderColor='rgba(255,170,51,.25)';
    box.style.background='rgba(255,170,51,.04)';
    if(lbl)lbl.style.color='var(--amber)';
  }else{
    fields.style.display='none';
    box.style.borderColor='var(--border)';
    box.style.background='rgba(255,255,255,.01)';
    if(lbl)lbl.style.color='#888';
  }
}
function saveMediaItem(i){mediaItems[i].icon=document.getElementById('em_ico').value.trim();mediaItems[i].name=document.getElementById('em_name').value.trim();mediaItems[i].desc=document.getElementById('em_desc').value.trim();mediaItems[i].type=document.getElementById('em_type').value;const cleared=document.getElementById('em_url_cleared')?.value==='1';if(pendingMediaFileUrl){mediaItems[i].fileUrl=pendingMediaFileUrl}else if(cleared){if(mediaItems[i].fileUrl)deleteFromR2(mediaItems[i].fileUrl);mediaItems[i].fileUrl=''}mediaItems[i].unlockKey=document.getElementById('em_key').value.trim();const vl=document.getElementById('em_vaultlock');if(vl){mediaItems[i].vaultLocked=vl.checked;if(vl.checked){mediaItems[i].vaultCode=(document.getElementById('em_vaultcode')?.value.trim().toUpperCase()||'');mediaItems[i].vaultCodename=(document.getElementById('em_vaultcodename')?.value.trim().toUpperCase()||'')}else{mediaItems[i].vaultCode='';mediaItems[i].vaultCodename=''}}pendingMediaFileUrl='';hideEditModal();syncVaultCodesFromMedia();renderMedia();renderGrid();renderKeysCodes();renderVaultPanel();saveMediaItemsToBackend()}
function deleteMediaItem(i){const delMedia=mediaItems[i];if(delMedia&&delMedia.fileUrl)deleteFromR2(delMedia.fileUrl);mediaItems.splice(i,1);hideEditModal();syncVaultCodesFromMedia();renderMedia();renderGrid();renderVaultPanel();renderKeysCodes();saveMediaItemsToBackend()}
function addMediaItem(){
  pendingMediaFileUrl='';
  showEditModal(`<h3>Add Item</h3>
    <div class="edit-field"><label>Upload File</label><input type="file" id="em_file" onchange="handleMediaUpload(this)"></div>
    <div class="edit-field"><label>File Name</label><input id="em_name" value=""></div>
    <div class="edit-field-row">
      <div class="edit-field" style="flex:.4"><label>Icon</label>${buildIconPicker('📄')}</div>
    </div>
    <div class="edit-field"><label>Description</label><textarea id="em_desc"></textarea></div>
    <div class="edit-field-row">
      <div class="edit-field"><label>Category</label><select id="em_type"><option>document</option><option>image</option><option>audio</option><option>video</option><option>dossier</option></select></div>
      <div class="edit-field"><label>File Password <span style="color:#666;font-weight:400">(to open/view)</span></label><input id="em_key" value="" placeholder="Leave blank = no password"></div>
    </div>
    <div style="margin:10px 0;padding:12px 14px;border:1px solid var(--border);border-radius:5px;background:rgba(255,255,255,.01)" id="em_vault_box">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="em_vaultlock" onchange="toggleVaultLockUI()"><span style="font-family:'Saira',sans-serif;font-size:11px;color:#888;letter-spacing:1px;font-weight:600">🔐 Vault-Locked</span></label>
      <div id="em_vault_fields" style="margin-top:10px;display:none">
        <div class="edit-field-row" style="margin-top:4px">
          <div class="edit-field"><label>Vault Code</label><input id="em_vaultcode" value="" placeholder="e.g. SHADOW42" style="font-size:13px;letter-spacing:3px;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="edit-field" style="flex:.6"><label>Codename</label><input id="em_vaultcodename" value="" placeholder="e.g. FILE-001" style="letter-spacing:2px;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:6px;justify-content:flex-end"><button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button><button class="btn-standard btn-cyan" onclick="saveNewMediaItem()">Add Item</button></div>`);
}
function saveNewMediaItem(){const vl=document.getElementById('em_vaultlock');const isVL=vl&&vl.checked;mediaItems.push({icon:document.getElementById('em_ico').value.trim()||'📄',name:document.getElementById('em_name').value.trim(),desc:document.getElementById('em_desc').value.trim(),type:document.getElementById('em_type').value,fileUrl:pendingMediaFileUrl||'',unlockKey:document.getElementById('em_key').value.trim(),nameFont:'',descFont:'',vaultLocked:isVL,vaultCode:isVL?(document.getElementById('em_vaultcode')?.value.trim().toUpperCase()||''):'',vaultCodename:isVL?(document.getElementById('em_vaultcodename')?.value.trim().toUpperCase()||''):''});pendingMediaFileUrl='';hideEditModal();syncVaultCodesFromMedia();renderMedia();renderGrid();renderVaultPanel();renderKeysCodes();saveMediaItemsToBackend()}

