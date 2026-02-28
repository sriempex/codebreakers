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

// ── Console Background (removed — circuit board is the permanent background) ──
// Stub functions to prevent runtime errors from old references
let _consoleBg='#080a10';
let _consoleTex='none';
let _consoleTexOpacity=40;
const _textureCSS={none:''};
function applyConsoleBg(){}
function setConsoleBgColor(){}
function updateConsoleBg(){}
function setConsoleTexture(){}
function updateTexOpacity(){}
function resetConsoleBg(){}
function saveConsoleBgConfig(){}
function restoreConsoleBg(){}
function syncConsoleBgFromConfig(){}



