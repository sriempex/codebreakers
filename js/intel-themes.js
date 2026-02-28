// ══════ INTEL DISPLAY THEME ══════
let _currentIntelTheme='standard';
function setIntelTheme(id){
  _currentIntelTheme=id;
  applyIntelTheme(id);
  // Save to backend
  apiCall('saveEventConfig',{config:{intelTheme:id}});
  // Flash save blip
  const blip=document.getElementById('blipIntelTheme');
  if(blip){blip.classList.add('show');setTimeout(()=>blip.classList.remove('show'),1500)}
}
function applyIntelTheme(id){
  _currentIntelTheme=id||'standard';
  const panel=document.getElementById('expIntel');
  if(!panel)return;
  panel.classList.remove('intel-theme-minimal','intel-theme-holo','intel-theme-dossier');
  if(id&&id!=='standard')panel.classList.add('intel-theme-'+id);
  try{localStorage.setItem('cb_intelTheme',_currentIntelTheme)}catch(e){}
  // Update appearance panel UI
  const names={standard:'Standard',minimal:'Sleek Minimal',holo:'Holo HUD Green',dossier:'Green Dossier'};
  const lbl=document.getElementById('currentIntelThemeLabel');
  if(lbl)lbl.textContent='Current: '+(names[_currentIntelTheme]||'Standard');
}

// ══════ INTEL THEME PREVIEW ══════
const _intelThemes=[{id:'standard',name:'Standard'},{id:'minimal',name:'Sleek Minimal'},{id:'holo',name:'Holo HUD Green'},{id:'dossier',name:'Green Dossier'}];
let _intelPreviewIdx=0;
let _intelPreviewOriginal='standard';

function openIntelThemePreview(){
  _intelPreviewOriginal=_currentIntelTheme;
  _intelPreviewIdx=_intelThemes.findIndex(t=>t.id===_currentIntelTheme);
  if(_intelPreviewIdx<0)_intelPreviewIdx=0;
  closeAppearancePanel();
  document.getElementById('intelThemePreviewOverlay').style.display='flex';
  renderIntelThemePreview();
  updateIntelThemePreviewUI();
}

function closeIntelThemePreview(){
  document.getElementById('intelThemePreviewOverlay').style.display='none';
  applyIntelTheme(_intelPreviewOriginal);
  setTimeout(()=>openAppearancePanel(),120);
}

function cycleIntelThemePreview(dir){
  _intelPreviewIdx=(_intelPreviewIdx+dir+_intelThemes.length)%_intelThemes.length;
  renderIntelThemePreview();
  updateIntelThemePreviewUI();
}

function applyIntelThemeFromPreview(){
  setIntelTheme(_intelThemes[_intelPreviewIdx].id);
  document.getElementById('intelThemePreviewOverlay').style.display='none';
  setTimeout(()=>openAppearancePanel(),120);
}

function updateIntelThemePreviewUI(){
  document.getElementById('intelThemePreviewName').textContent=_intelThemes[_intelPreviewIdx].name;
  document.getElementById('intelThemePreviewCounter').textContent=(_intelPreviewIdx+1)+' / '+_intelThemes.length;
}

function renderIntelThemePreview(){
  const themeId=_intelThemes[_intelPreviewIdx].id;
  const container=document.getElementById('intelThemePreviewContent');
  const themeClass=themeId!=='standard'?' intel-theme-'+themeId:'';
  var rows='';
  var fields=intelFields.length?intelFields:[{label:'Sample Field',emoji:'🔍',type:'text'}];
  fields.forEach(function(f,i){
    var num=String(i+1).padStart(2,'0');
    var ph=f.placeholder||'···';
    var inputHtml='';
    if(f.type==='money'){
      inputHtml='<div class="intel-prefix-wrap"><span class="intel-prefix">$</span><input class="intel-exp-input" style="border:none;background:transparent;box-shadow:none" placeholder="'+ph+'"></div>';
    }else if(f.type==='phone'){
      inputHtml='<input class="intel-exp-input" placeholder="'+(f.placeholder||'(XXX) XXX-XXXX')+'">';
    }else if(f.type==='select'){
      var opts=(f.options||[]).map(function(o){return '<option>'+o+'</option>'}).join('');
      inputHtml='<select class="intel-exp-input intel-select"><option>— Select —</option>'+opts+'</select>';
    }else if(f.type==='dual'){
      inputHtml='<div class="intel-dual-wrap"><input class="intel-exp-input" placeholder="'+(f.placeholder1||'Value 1')+'"><span class="intel-dual-sep">&amp;</span><input class="intel-exp-input" placeholder="'+(f.placeholder2||'Value 2')+'"></div>';
    }else{
      inputHtml='<input class="intel-exp-input" placeholder="'+ph+'">';
    }
    rows+='<div class="intel-exp-row" style="max-width:600px;width:100%"><span class="intel-exp-num">'+num+'</span><span class="intel-exp-label">'+f.label+' '+(f.emoji||'')+'</span>'+inputHtml+'</div>';
  });
  container.innerHTML='<div class="expanded-panel'+themeClass+'" style="position:relative;display:flex;flex-direction:column;opacity:1;pointer-events:auto;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.06);background:var(--bg-panel);max-width:560px;margin:0 auto;max-height:70vh"><div class="exp-header" style="pointer-events:none;display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0"><span class="panel-icon" style="font-size:18px">'+(function(){var _t=gridTiles.find(function(x){return x.id==="intel"});if(!_t)return "🎯";if(_t.icon.startsWith("http")||_t.icon.startsWith("data:"))return "<img src=\""+_t.icon+"\" style=\"width:18px;height:18px;object-fit:contain\">";return _t.icon})()+'</span><span class="exp-title" style="font-family:Saira,sans-serif;font-size:13px;letter-spacing:2px;color:#fff;font-weight:700">Intel Submissions</span></div><div class="exp-body intel-exp-body" style="display:flex;flex-direction:column;overflow:hidden;flex:1;padding:0"><div class="intel-scroll-area" style="flex:1;overflow-y:auto;padding:20px 20px 0;display:flex;flex-direction:column;gap:8px;align-items:center"><div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%">'+rows+'</div></div><div class="intel-transmit-dock" style="flex-shrink:0;padding:14px 20px;display:flex;justify-content:center;align-items:center"><button class="intel-submit-btn" disabled style="pointer-events:none">SUBMIT INTEL</button></div></div></div>';
}

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY — Central font management
// ═══════════════════════════════════════════════════════════════

function initTypographyPanel(){
  const zones=[
    {key:'feedCap',   id:'fc_feedCap_wrap'},
    {key:'mediaName', id:'fc_mediaName_wrap'},
    {key:'mediaDesc', id:'fc_mediaDesc_wrap'},
    {key:'intelLabel',id:'fc_intelLabel_wrap'},
    {key:'intelInput',id:'fc_intelInput_wrap'},
    {key:'vaultDisplay',id:'fc_vaultDisplay_wrap'}
  ];
  zones.forEach(({key,id})=>{
    const wrap=document.getElementById(id);
    if(!wrap){return;}
    // Build styled select inline
    const groups=[
      {label:'Default',fonts:[]},
      {label:'Military / Industrial',fonts:['Russo One','Black Ops One','Quantico','Aldrich','Staatliches']},
      {label:'Sci-Fi / Tech',fonts:['Orbitron','Oxanium','Audiowide','Electrolize','Michroma','Chakra Petch']},
      {label:'Clean / UI',fonts:['Saira','Exo 2','Play','Rajdhani','Teko']},
      {label:'Monospace / Terminal',fonts:['IBM Plex Mono','JetBrains Mono','Share Tech Mono','Nova Mono','Major Mono Display']},
      {label:'Retro / Pixel',fonts:['Press Start 2P','VT323','Silkscreen']},
    ];
    let selHtml=`<select id="${id}_sel" style="width:100%;background:#080a10;border:1px solid var(--border);border-radius:3px;padding:6px 10px;color:#ddd;font-family:'IBM Plex Mono',monospace;font-size:10px;outline:none">`;
    selHtml+=`<option value=""${!fontConfig[key]?' selected':''}>— Default —</option>`;
    groups.slice(1).forEach(g=>{
      selHtml+=`<optgroup label="${g.label}">`;
      g.fonts.forEach(fn=>{
        const f=availableFonts.find(x=>x.name===fn);
        if(f)selHtml+=`<option value="${f.name}"${f.name===fontConfig[key]?' selected':''}>${f.name}</option>`;
      });
      selHtml+=`</optgroup>`;
    });
    selHtml+=`</select>`;
    wrap.innerHTML=selHtml;
    const sel=wrap.querySelector('select');
    // Add live font preview below the dropdown
    const preview=document.createElement('div');
    preview.id=id+'_preview';
    preview.style.cssText='margin-top:6px;padding:6px 10px;border:1px solid rgba(255,255,255,.04);border-radius:3px;background:rgba(255,255,255,.015);font-size:13px;color:#aaa;letter-spacing:.5px;min-height:20px;transition:font-family .15s';
    preview.textContent='The quick brown fox jumps over the lazy dog';
    wrap.appendChild(preview);
    function updatePreview(){
      const fontName=sel.value;
      if(fontName){
        preview.style.fontFamily="'"+fontName+"',sans-serif";
        preview.style.color='#ccc';
      }else{
        preview.style.fontFamily='inherit';
        preview.style.color='#666';
      }
    }
    updatePreview();
    if(sel){
      sel.onchange=function(){
        fontConfig[key]=this.value;
        updatePreview();
        applyFontConfig();
        saveEventConfigToBackend();
        blip('blipTypography');
      };
    }
  });
}

function applyFontConfig(){
  // Vault keypad display
  const vDisp=document.getElementById('vDisp');
  if(vDisp){const fam=getFontFamily(fontConfig.vaultDisplay||'');vDisp.style.fontFamily=fam||'';}
  // Set CSS custom properties — panels pick these up on next natural render
  document.documentElement.style.setProperty('--fc-vault',getFontFamily(fontConfig.vaultDisplay||'')||'inherit');
  document.documentElement.style.setProperty('--fc-feed-cap',getFontFamily(fontConfig.feedCap||'')||'inherit');
  document.documentElement.style.setProperty('--fc-media-name',getFontFamily(fontConfig.mediaName||'')||'inherit');
  document.documentElement.style.setProperty('--fc-media-desc',getFontFamily(fontConfig.mediaDesc||'')||'inherit');
}

function resetFontConfig(){
  Object.keys(fontConfig).forEach(k=>fontConfig[k]='');
  initTypographyPanel();
  applyFontConfig();
  saveEventConfigToBackend();
  blip('blipTypography');
}

function blip(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.style.opacity='1';
  setTimeout(()=>el.style.opacity='',2000);
}

// ═══════════════════════════════════════════════════════════════
// VAULT LOCK PICKER — add existing media file to vault from KC panel
// ═══════════════════════════════════════════════════════════════

function openVaultLockPicker(){
  // Get unlocked media items (not already vault-locked, must have a file/name)
  const available=mediaItems.map((m,i)=>({m,i})).filter(({m})=>!m.vaultLocked&&m.name);
  let gridHtml='';
  if(available.length){
    gridHtml=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-height:240px;overflow-y:auto;margin-bottom:16px">`;
    available.forEach(({m,i})=>{
      const typeLabel={image:'IMG',audio:'AUD',video:'VID',document:'DOC',dossier:'DOS'}[m.type]||m.type.toUpperCase().slice(0,3);
      gridHtml+=`<div class="vlp-item" onclick="selectVlpItem(this,${i})" data-idx="${i}" style="border:1px solid var(--border);border-radius:4px;padding:10px 8px;cursor:pointer;text-align:center;transition:all .15s;background:rgba(255,255,255,.01)">
        <div style="font-size:22px;margin-bottom:4px">${m.icon}</div>
        <div style="font-family:'Chakra Petch',sans-serif;font-size:9px;color:#ddd;letter-spacing:.5px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:7px;color:#555;letter-spacing:1px">${typeLabel}</div>
      </div>`;
    });
    gridHtml+=`</div>`;
  }else{
    gridHtml=`<div style="font-family:'Chakra Petch',sans-serif;font-size:10px;color:#555;padding:20px 0;text-align:center">All items are already vault-locked, or no items exist in the Evidence Locker yet.</div>`;
  }

  showEditModal(`<h3>🔐 Vault Lock an Existing File</h3>
    <p style="font-family:'Chakra Petch',sans-serif;font-size:10px;color:#888;margin-bottom:14px;line-height:1.6">Select an Evidence Locker item to vault-lock. Players will see it as classified until they crack the code.</p>
    <div style="font-family:'Saira',sans-serif;font-size:9px;letter-spacing:2px;color:var(--amber);text-transform:uppercase;margin-bottom:8px;font-weight:700">Select File</div>
    ${gridHtml}
    <div id="vlpCodeFields" style="display:none">
      <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
        <div style="font-family:'Saira',sans-serif;font-size:9px;letter-spacing:2px;color:var(--amber);text-transform:uppercase;margin-bottom:10px;font-weight:700">Set Vault Code</div>
        <div class="edit-field-row" style="gap:10px">
          <div class="edit-field"><label>Vault Code</label><input id="vlpCode" placeholder="e.g. DEADROP7" style="text-transform:uppercase;letter-spacing:2px;font-family:'IBM Plex Mono',monospace" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="edit-field"><label>Codename (shown to players)</label><input id="vlpCodename" placeholder="e.g. OPERATION BLACKOUT" style="text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace" oninput="this.value=this.value.toUpperCase()"></div>
        </div>
        <div style="font-family:'Chakra Petch',sans-serif;font-size:9px;color:#555;margin-top:6px">Players see the codename but not the file — it appears as a locked entry in the Vault panel.</div>
      </div>
    </div>
    <input type="hidden" id="vlpSelectedIdx" value="">
    <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">
      <button class="btn-standard btn-ghost" onclick="hideEditModal()">Cancel</button>
      <button class="btn-standard btn-amber" onclick="confirmVaultLock()">🔐 Lock to Vault</button>
    </div>`);

  // Add hover styles dynamically
  document.querySelectorAll('.vlp-item').forEach(el=>{
    el.addEventListener('mouseenter',()=>{if(!el.classList.contains('selected'))el.style.borderColor='rgba(255,170,51,.3)'});
    el.addEventListener('mouseleave',()=>{if(!el.classList.contains('selected'))el.style.borderColor='var(--border)'});
  });
}

function selectVlpItem(el,idx){
  document.querySelectorAll('.vlp-item').forEach(x=>{
    x.classList.remove('selected');
    x.style.borderColor='var(--border)';
    x.style.background='rgba(255,255,255,.01)';
  });
  el.classList.add('selected');
  el.style.borderColor='rgba(255,170,51,.5)';
  el.style.background='rgba(255,170,51,.05)';
  document.getElementById('vlpSelectedIdx').value=idx;
  document.getElementById('vlpCodeFields').style.display='block';
  // Pre-fill codename from file name
  const codenameInp=document.getElementById('vlpCodename');
  if(codenameInp&&!codenameInp.value&&mediaItems[idx]){
    codenameInp.value=mediaItems[idx].name.toUpperCase().replace(/[^A-Z0-9 ]/g,'');
  }
  document.getElementById('vlpCode').focus();
}

function confirmVaultLock(){
  const idxStr=document.getElementById('vlpSelectedIdx').value;
  if(idxStr===''){alert('Please select a file first.');return;}
  const idx=parseInt(idxStr);
  const code=(document.getElementById('vlpCode').value||'').trim().toUpperCase();
  const codename=(document.getElementById('vlpCodename').value||'').trim().toUpperCase();
  if(!code){alert('Please set a vault code.');document.getElementById('vlpCode').focus();return;}
  if(!mediaItems[idx]){alert('File not found.');return;}
  // Check for duplicate code
  const duplicate=mediaItems.some((m,i)=>i!==idx&&m.vaultLocked&&m.vaultCode===code);
  if(duplicate){alert('That code is already in use by another vault item. Please choose a different code.');return;}
  mediaItems[idx].vaultLocked=true;
  mediaItems[idx].vaultCode=code;
  mediaItems[idx].vaultCodename=codename||code;
  hideEditModal();
  syncVaultCodesFromMedia();
  renderMedia();renderGrid();renderVaultPanel();renderKeysCodes();
  saveMediaItemsToBackend();
}



