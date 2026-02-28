// ══════ VAULT PUZZLE (in-console keypad) ══════
let vaultCodes=[];
// vaultCodes is now synced FROM media items that have vaultLocked:true + vaultCode set.
// Call syncVaultCodesFromMedia() after any media change.
function syncVaultCodesFromMedia(){
  // Preserve unlock state by code
  const unlockedMap={};
  vaultCodes.forEach(c=>{if(c.unlocked)unlockedMap[c.code.toUpperCase()]=c.unlockedAt});
  vaultCodes.length=0;
  mediaItems.forEach((m,i)=>{
    if(m.vaultLocked&&m.vaultCode&&m.vaultCode.trim()){
      const codeUp=m.vaultCode.trim().toUpperCase();
      vaultCodes.push({
        code:codeUp,
        label:m.name||'Locked Item',
        desc:m.desc||'',
        codename:m.vaultCodename||m.name||'FILE-'+String(i+1).padStart(3,'0'),
        unlocked:unlockedMap[codeUp]?true:false,
        unlockedAt:unlockedMap[codeUp]||null,
        linkedMediaIdx:i
      });
    }
  });
}
let vkCode='';let vkFailCount=0;let vkTotalFails=0;let vkRateLimited=false;
let _vaultLockoutEnd=null;
let _sessionStartTime=null;
const vkDisp=document.getElementById('vDisp');
function vkUpdDisp(){if(vkDisp){vkDisp.textContent=vkCode.length?vkCode:'ENTER CODE';vkDisp.style.color='';vkDisp.style.fontSize='';vkDisp.style.letterSpacing=''}const triesEl=document.getElementById('vkTries');if(triesEl)triesEl.style.visibility=vkCode.length?'hidden':'visible'}
function vkType(ch){playClick();if(vkRateLimited)return;if(vkCode.length<20){vkCode+=ch;vkUpdDisp();vkGlitch()}}
function vkDel(){playClick();if(vkRateLimited)return;vkCode=vkCode.slice(0,-1);vkUpdDisp();vkGlitch()}
function vkClear(){playClick();if(vkRateLimited)return;vkCode='';vkUpdDisp();vkGlitch()}
function vkGlitch(){const d=document.querySelector('#expVault .v-display');if(!d)return;d.classList.remove('glitch');void d.offsetWidth;d.classList.add('glitch');setTimeout(()=>d.classList.remove('glitch'),150)}
function vkSubmit(){
  if(vkRateLimited||!vkCode.length)return;
  const entered=vkCode.trim().toUpperCase();
  const match=vaultCodes.find(c=>c.code.toUpperCase()===entered&&!c.unlocked);
  if(match){
    match.unlocked=true;match.unlockedAt=new Date().toISOString();
    let releasedName='Classified File';
    if(match.linkedMediaIdx!==null&&match.linkedMediaIdx!==undefined&&mediaItems[match.linkedMediaIdx]){
      mediaItems[match.linkedMediaIdx]._isNew=true;
      // NOTE: Do not mutate vaultLocked here; unlock visibility is team-scoped via vaultCodes + localStorage.
      releasedName=mediaItems[match.linkedMediaIdx].name||match.label;
    }
    playVaultUnlock();
    vkDisp.textContent='✓ UNLOCKED';vkDisp.style.color='#00ff88';vkDisp.style.fontSize='13px';vkDisp.style.letterSpacing='2px';
    document.getElementById('flashG').classList.add('on');
    setTimeout(()=>document.getElementById('flashG').classList.remove('on'),400);
    vkFailCount=0;vkTotalFails=0;
    updateTriesDisplay();
    // Show unlock notification to player
    showVaultUnlockNotification(releasedName);
    setTimeout(()=>{vkCode='';vkUpdDisp();renderVaultPanel()},2000);
    renderGrid();renderMedia();
    saveGameState();
  }else if(vaultCodes.find(c=>c.code.toUpperCase()===entered&&c.unlocked)){
    vkDisp.textContent='⚡ ALREADY UNLOCKED';vkDisp.style.color='var(--amber)';vkDisp.style.fontSize='13px';
    playClick();
    setTimeout(()=>{vkCode='';vkUpdDisp()},1500);
  }else{
    vkFailCount++;vkTotalFails++;
    playDenied();vkDisp.textContent='✗ INVALID CODE';vkDisp.style.color='#ff3333';
    document.getElementById('flashR').classList.add('on');setTimeout(()=>document.getElementById('flashR').classList.remove('on'),300);
    const maxAttempts=regSettings.vaultMaxAttempts||5;
    const cooldown=regSettings.vaultCooldownSec||30;
    const unlimited=regSettings.vaultUnlimitedAttempts;
    updateTriesDisplay();
    saveGameState();
    if(unlimited){
      setTimeout(()=>{vkCode='';vkUpdDisp()},1200);
    }else{
      const remaining=maxAttempts-vkTotalFails;
      if(remaining<=0){
        triggerVaultLockout(cooldown,'SECURITY LOCKOUT','Maximum attempts reached · '+cooldown+'s cooldown');
      }else{
        setTimeout(()=>{vkCode='';vkUpdDisp()},1200);
      }
    }
  }
}
function showVaultUnlockNotification(fileName){
  // Create a toast notification for vault unlock
  let toast=document.getElementById('vaultUnlockToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='vaultUnlockToast';
    toast.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(80px);z-index:999;padding:14px 24px;border-radius:6px;border:1px solid rgba(0,255,136,.3);background:linear-gradient(180deg,rgba(10,20,15,.95),rgba(5,15,10,.98));backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.6),0 0 20px rgba(0,255,136,.1);transition:transform .4s ease,opacity .4s ease;opacity:0;max-width:90vw;text-align:center';
    document.body.appendChild(toast);
  }
  toast.innerHTML=`<div style="font-family:'Saira',sans-serif;font-size:10px;letter-spacing:3px;color:var(--green);font-weight:700;margin-bottom:4px">🔓 CLASSIFIED FILE RELEASED</div><div style="font-family:'Exo 2',sans-serif;font-size:12px;color:#ccc"><strong>${fileName}</strong> is now available in the Evidence Locker</div>`;
  requestAnimationFrame(()=>{toast.style.opacity='1';toast.style.transform='translateX(-50%) translateY(0)'});
  setTimeout(()=>{toast.style.opacity='0';toast.style.transform='translateX(-50%) translateY(80px)'},4500);
}
function updateTriesDisplay(){
  const el=document.getElementById('vkTries');
  if(!el)return;
  const unlimited=regSettings.vaultUnlimitedAttempts;
  if(unlimited){el.textContent='';el.className='v-tries';return}
  const max=regSettings.vaultMaxAttempts||5;
  const remaining=Math.max(0,max-vkTotalFails);
  el.textContent=remaining+' OF '+max+' ATTEMPT'+(remaining!==1?'S':'')+' REMAINING';
  // Progressive colour: green → amber → red
  if(remaining<=1)el.className='v-tries critical';
  else if(remaining<=3)el.className='v-tries warning';
  else el.className='v-tries plenty';
}
function triggerVaultLockout(seconds,title,subtitle){
  vkRateLimited=true;
  // Store absolute end time so cooldown survives browser close
  if(!_vaultLockoutEnd||_vaultLockoutEnd<Date.now()){
    _vaultLockoutEnd=Date.now()+seconds*1000;
  }
  saveGameState();
  const limiter=document.getElementById('vRateLimit');
  const timerEl=document.getElementById('vRateLimitTimer');
  const textEl=document.getElementById('vRateLimitText');
  const subEl=document.getElementById('vRateLimitSub');
  const fillEl=document.getElementById('vRateLimitFill');
  textEl.textContent='⚠ '+title;
  subEl.textContent=subtitle;
  let countdown=seconds;
  const total=seconds;
  timerEl.textContent=formatLockoutTime(countdown);
  if(fillEl)fillEl.style.width='100%';
  limiter.classList.add('active');
  const interval=setInterval(()=>{
    countdown--;
    timerEl.textContent=formatLockoutTime(countdown);
    if(fillEl)fillEl.style.width=((countdown/total)*100)+'%';
    if(countdown<=0){
      clearInterval(interval);
      limiter.classList.remove('active');
      vkRateLimited=false;
      vkFailCount=0;vkTotalFails=0;
      vkCode='';vkUpdDisp();
      updateTriesDisplay();
      _vaultLockoutEnd=null;
      saveGameState();
    }
  },1000);
}

function formatLockoutTime(s){
  if(s>=60){const m=Math.floor(s/60);const sec=s%60;return m+':'+String(sec).padStart(2,'0')}
  return String(s);
}
function renderVaultPanel(){
  const list=document.getElementById('vaultUnlockList');
  const count=document.getElementById('vaultUnlockCount');
  if(!list)return;
  const unlocked=vaultCodes.filter(c=>c.unlocked).length;
  if(count)count.textContent=vaultBadgeText();
  const dot=document.getElementById('vkDot');
  const lbl=document.getElementById('vkLbl');
  if(dot&&lbl){
    const statusEl=document.getElementById('vkStatus');
    if(unlocked===vaultCodes.length&&vaultCodes.length>0){if(statusEl)statusEl.style.display='';dot.classList.add('ok');lbl.classList.add('ok');lbl.textContent='ALL UNLOCKED'}
    else if(unlocked>0){if(statusEl)statusEl.style.display='';dot.className='v-dot';dot.style.background='radial-gradient(circle at 40% 35%,#ffcc44,#cc8811)';dot.style.boxShadow='0 0 6px rgba(255,170,51,.5)';lbl.textContent=unlocked+' UNLOCKED'}
    else{if(statusEl)statusEl.style.display='none'}
  }
  if(vaultCodes.length===0){
    list.innerHTML='<div class="vault-unlock-empty">No vault codes configured yet. The admin can add codes in the Keys & Codes panel.</div>';
    return;
  }
  const isAdmin=document.body.classList.contains('admin-mode');
  list.innerHTML=vaultCodes.map((c,i)=>{
    if(c.unlocked){
      let viewLink='';
      if(c.linkedMediaIdx!==null&&c.linkedMediaIdx!==undefined){
        viewLink=`<div class="vui-media-link" onclick="event.stopPropagation();closePanel();setTimeout(()=>{openPanel('media');setTimeout(()=>openMediaViewer(${c.linkedMediaIdx}),300)},350)">▸ View in Evidence Locker</div>`;
      }
      return `<div class="vault-unlock-item">
        <span class="vui-icon">🔓</span>
        <div class="vui-info"><div class="vui-label">${c.label}</div><div class="vui-desc">${c.desc||'Unlocked'}</div>${viewLink}</div>
        <span class="vui-status unlocked">UNLOCKED</span>
      </div>`;
    }else{
      const codename=c.codename||'FILE-'+String(i+1).padStart(3,'0');
      return `<div class="vault-unlock-item locked">
        <span class="vui-icon">🔒</span>
        <div class="vui-info"><div class="vui-label vui-classified">${codename}</div><div class="vui-desc vui-classified-sub">CLASSIFIED · Enter the correct code to unlock</div>${isAdmin?`<div class="vui-admin-hint">Admin: code = ${c.code}</div>`:''}</div>
        <span class="vui-status locked">LOCKED</span>
      </div>`;
    }
  }).join('');
  updateTriesDisplay();
}
let vkSymMode=false;
function vkToggleSymbols(){
  vkSymMode=!vkSymMode;
  document.getElementById('vkSymLabel').textContent=vkSymMode?'ABC':'SYM';
  const rows=vkSymMode?symRows:alphaRows;
  document.querySelectorAll('#expVault .kb-row').forEach((row,ri)=>{
    if(ri===0)return;
    if(ri>=1&&ri<=3){
      const chars=rows[ri-1];if(!chars)return;
      const keys=row.querySelectorAll('.kb-key:not(.fn)');
      keys.forEach((key,ki)=>{
        if(ki<chars.length){key.style.display='';key.querySelector('span').textContent=chars[ki];key.onclick=()=>vkType(chars[ki])}
        else key.style.display='none';
      });
    }
  });
  playClick();
}

