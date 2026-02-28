// ═══════════════════════════════════════════════════════════════
// SECURITY HARDENING
// ═══════════════════════════════════════════════════════════════

// Block right-click context menu (non-admin)
document.addEventListener('contextmenu',e=>{
  if(!isAdmin){e.preventDefault();return false}
});

// Block keyboard shortcuts for dev tools & view source (non-admin)
document.addEventListener('keydown',e=>{
  if(isAdmin)return; // Admins bypass all restrictions
  // F12
  if(e.key==='F12'){e.preventDefault();return false}
  // Ctrl+Shift+I (Dev tools)
  if(e.ctrlKey&&e.shiftKey&&e.key==='I'){e.preventDefault();return false}
  // Ctrl+Shift+J (Console)
  if(e.ctrlKey&&e.shiftKey&&e.key==='J'){e.preventDefault();return false}
  // Ctrl+Shift+C (Element inspector)
  if(e.ctrlKey&&e.shiftKey&&e.key==='C'){e.preventDefault();return false}
  // Ctrl+U (View source)
  if(e.ctrlKey&&e.key==='u'){e.preventDefault();return false}
  // Ctrl+S (Save page)
  if(e.ctrlKey&&e.key==='s'){e.preventDefault();return false}
  // Ctrl+P (Print)
  if(e.ctrlKey&&e.key==='p'){e.preventDefault();return false}
});

// Block drag on images (prevents drag-to-desktop saving)
document.addEventListener('dragstart',e=>{
  if(!isAdmin&&(e.target.tagName==='IMG'||e.target.tagName==='VIDEO')){e.preventDefault()}
});

// Disable text selection on feed & media content (non-admin)
document.addEventListener('selectstart',e=>{
  if(!isAdmin&&(e.target.closest('.feed-grid')||e.target.closest('#mvBody'))){e.preventDefault()}
});

// Clear console periodically to discourage snooping
if(!isAdmin){
  const _cc=()=>{try{console.clear()}catch(e){}};
  setInterval(_cc,3000);
  // Override console methods for non-admin
  const _noop=()=>{};
  if(!window._adminConsole){
    window._adminConsole={log:console.log,warn:console.warn,error:console.error};
  }
}

// Detect dev tools open (debugger pause — non-admin only)
// Softened: shows overlay warning instead of destroying the page
let _devtoolsWarned=false;
setInterval(()=>{
  if(isAdmin||_devtoolsWarned)return;
  const t=performance.now();
  debugger;
  if(performance.now()-t>100){
    _devtoolsWarned=true;
    const overlay=document.createElement('div');
    overlay.id='devtoolsOverlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:monospace';
    overlay.innerHTML='<div style="color:#ff3333;font-size:18px;letter-spacing:3px">⚠ DEVELOPER TOOLS DETECTED</div><div style="color:#888;font-size:13px;max-width:400px;text-align:center;line-height:1.6">Please close developer tools to continue the experience.</div><button onclick="this.parentElement.remove();_devtoolsWarned=false" style="margin-top:12px;padding:10px 28px;background:none;border:1px solid #555;color:#aaa;cursor:pointer;font-family:monospace;letter-spacing:2px;border-radius:4px">DISMISS</button>';
    document.body.appendChild(overlay);
  }
},4000);

// Restore console for admin after login
function unlockAdminConsole(){
  if(window._adminConsole){
    console.log=window._adminConsole.log;
    console.warn=window._adminConsole.warn;
    console.error=window._adminConsole.error;
  }
}


// ═══════════════════════════════════════════════════════════════
// CONSOLE GRID THEMES (removed — CRT is the permanent style)
// Stub functions retained to prevent runtime errors from old references
// ═══════════════════════════════════════════════════════════════

const _gridThemes=[{id:'crt',name:'CRT Monitor'}];
let _currentGridTheme='crt';
let _previewThemeIdx=0;
let _previewOriginalTheme='crt';

function updateThemeLabel(){}
function openThemePreview(){}
function closeThemePreview(){}
function cycleThemePreview(){}
function applyThemeFromPreview(){}
function updateThemePreviewUI(){}
function renderThemePreviewGrid(){}
function applyThemeToPreviewGrid(){}
function selectGridTheme(){}
function applyGridTheme(){}

// ── Console Background Color & Texture ──
let _consoleBg='#080a10';
let _consoleTex='none';
let _consoleTexOpacity=40;

const _textureCSS={
  none:'',
  scanlines:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.03) 2px,rgba(255,255,255,.03) 4px)',
  grid:'repeating-linear-gradient(0deg,transparent,transparent 11px,rgba(0,255,136,.04) 11px,rgba(0,255,136,.04) 12px),repeating-linear-gradient(90deg,transparent,transparent 11px,rgba(0,255,136,.04) 11px,rgba(0,255,136,.04) 12px)',
  noise:'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 512 512\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'512\' height=\'512\' filter=\'url(%23n)\' opacity=\'0.08\'/%3E%3C/svg%3E")',
  circuit:'repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(0,212,255,.04) 20px,rgba(0,212,255,.04) 21px),repeating-linear-gradient(0deg,transparent,transparent 30px,rgba(0,212,255,.04) 30px,rgba(0,212,255,.04) 31px),repeating-linear-gradient(45deg,transparent 0px,transparent 28px,rgba(0,212,255,.025) 28px,rgba(0,212,255,.025) 29px)',
  hex:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'28\' height=\'49\' viewBox=\'0 0 28 49\'%3E%3Cpath d=\'M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15z\' fill=\'none\' stroke=\'rgba(0,212,255,0.06)\' stroke-width=\'0.5\'/%3E%3Cpath d=\'M13.99 33.75l13 7.5v15l-13 7.5L1 56.25v-15z\' fill=\'none\' stroke=\'rgba(0,212,255,0.06)\' stroke-width=\'0.5\'/%3E%3Cpath d=\'M27.99 -8.25l13 7.5v15l-13 7.5L15 6.75v-15z\' fill=\'none\' stroke=\'rgba(0,212,255,0.06)\' stroke-width=\'0.5\'/%3E%3C/svg%3E")'
};

function applyConsoleBg(){
  const screen=document.getElementById('consoleScreen');
  const overlay=document.getElementById('consoleBgOverlay');
  const settingsScreen=document.getElementById('settingsScreen');
  const settingsOverlay=document.getElementById('settingsBgOverlay');
  // Set CSS variable so body and all panels inherit the background
  document.documentElement.style.setProperty('--bg-deep',_consoleBg);
  document.documentElement.style.setProperty('--console-bg',_consoleBg);
  if(screen)screen.style.background=_consoleBg;
  if(settingsScreen)settingsScreen.style.background=_consoleBg;
  // Apply texture to both overlays
  const applyTex=(ov)=>{
    if(!ov)return;
    if(_consoleTex==='none'){
      ov.style.background='';
      ov.style.opacity='0';
    }else{
      ov.style.background=_textureCSS[_consoleTex]||'';
      ov.style.opacity=String(_consoleTexOpacity/100);
    }
  };
  applyTex(overlay);
  applyTex(settingsOverlay);
}

function setConsoleBgColor(color){
  _consoleBg=color;
  const picker=document.getElementById('consoleBgColor');
  const hex=document.getElementById('consoleBgHex');
  if(picker)picker.value=color;
  if(hex)hex.value=color;
  applyConsoleBg();
  saveConsoleBgConfig();
}

function updateConsoleBg(){
  const picker=document.getElementById('consoleBgColor');
  const hex=document.getElementById('consoleBgHex');
  if(picker){_consoleBg=picker.value;if(hex)hex.value=picker.value}
  applyConsoleBg();
  saveConsoleBgConfig();
}

function setConsoleTexture(tex){
  _consoleTex=tex;
  document.querySelectorAll('.cbg-tex').forEach(b=>{
    b.classList.toggle('active',b.dataset.tex===tex);
  });
  applyConsoleBg();
  saveConsoleBgConfig();
}

function updateTexOpacity(){
  const slider=document.getElementById('consoleBgTexOpacity');
  const label=document.getElementById('texOpacityVal');
  if(slider){_consoleTexOpacity=parseInt(slider.value);if(label)label.textContent=slider.value+'%'}
  applyConsoleBg();
  saveConsoleBgConfig();
}

function resetConsoleBg(){
  setConsoleBgColor('#080a10');
  setConsoleTexture('none');
  _consoleTexOpacity=40;
  const slider=document.getElementById('consoleBgTexOpacity');
  const label=document.getElementById('texOpacityVal');
  if(slider)slider.value='40';
  if(label)label.textContent='40%';
  applyConsoleBg();
  saveConsoleBgConfig();
}

function saveConsoleBgConfig(){
  const blip=document.getElementById('blipConsoleBg');
  if(blip){blip.style.opacity='1';setTimeout(()=>blip.style.opacity='0',1500)}
  // Save locally for instant restore
  try{
    localStorage.setItem('cb_consoleBg',JSON.stringify({color:_consoleBg,texture:_consoleTex,texOpacity:_consoleTexOpacity}));
  }catch(e){}
  // Save to backend config
  apiCall('saveEventConfig',{config:{consoleBgColor:_consoleBg,consoleBgTexture:_consoleTex,consoleBgTexOpacity:String(_consoleTexOpacity)}});
}

function restoreConsoleBg(){
  // Try localStorage first for instant display
  try{
    const raw=localStorage.getItem('cb_consoleBg');
    if(raw){
      const cfg=JSON.parse(raw);
      if(cfg.color)_consoleBg=cfg.color;
      if(cfg.texture)_consoleTex=cfg.texture;
      if(cfg.texOpacity!==undefined)_consoleTexOpacity=cfg.texOpacity;
    }
  }catch(e){}
  applyConsoleBg();
}

function syncConsoleBgFromConfig(cfg){
  if(cfg.consoleBgColor)_consoleBg=cfg.consoleBgColor;
  if(cfg.consoleBgTexture)_consoleTex=cfg.consoleBgTexture;
  if(cfg.consoleBgTexOpacity!==undefined)_consoleTexOpacity=parseInt(cfg.consoleBgTexOpacity);
  // Update UI controls if visible
  const picker=document.getElementById('consoleBgColor');
  const hex=document.getElementById('consoleBgHex');
  const slider=document.getElementById('consoleBgTexOpacity');
  const label=document.getElementById('texOpacityVal');
  if(picker)picker.value=_consoleBg;
  if(hex)hex.value=_consoleBg;
  if(slider)slider.value=String(_consoleTexOpacity);
  if(label)label.textContent=_consoleTexOpacity+'%';
  document.querySelectorAll('.cbg-tex').forEach(b=>{
    b.classList.toggle('active',b.dataset.tex===_consoleTex);
  });
  // Save locally for next load
  try{localStorage.setItem('cb_consoleBg',JSON.stringify({color:_consoleBg,texture:_consoleTex,texOpacity:_consoleTexOpacity}))}catch(e){}
  applyConsoleBg();
}



