// ══════ GRAIN + DUST ══════
const gc=document.getElementById('grainCanvas'),gx=gc.getContext('2d');
const GRAIN_SCALE=4; // render at 1/4 resolution
function rg(){gc.width=Math.ceil(innerWidth/GRAIN_SCALE);gc.height=Math.ceil(innerHeight/GRAIN_SCALE);gc.style.width=innerWidth+'px';gc.style.height=innerHeight+'px';gx.imageSmoothingEnabled=false}
let lastGrain=0;
function dg(t){requestAnimationFrame(dg);if(t-lastGrain<125)return;lastGrain=t;const w=gc.width,h=gc.height;if(!w||!h)return;const id=gx.createImageData(w,h),d=id.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=8}gx.putImageData(id,0,0)}
rg();let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(rg,200)});requestAnimationFrame(dg);
for(let i=0;i<5;i++){const p=document.createElement('div');p.className='dust';p.style.left=Math.random()*100+'vw';p.style.animationDuration=(12+Math.random()*16)+'s';p.style.animationDelay=(Math.random()*12)+'s';const s=1+Math.random()*1.5;p.style.width=s+'px';p.style.height=s+'px';document.body.appendChild(p)}

// ══════ LOGIN SCREEN ══════
let manualVaultKeys=[];
let currentVaultTeam=null;

function setLoginLed(state){
  const led=document.getElementById('loginLed');
  if(!led)return;
  led.className='login-led'+(state?' '+state:'');
}
function setLoginStatus(text,cls){
  const el=document.getElementById('loginCrtStatus');
  if(!el)return;
  el.className='login-crt-status'+(cls?' '+cls:'');
  el.innerHTML=text;
  const div=document.getElementById('loginCrtDivider');
  if(div)div.style.display=text?'':'none';
}
function loginBack(){
  const pwZone=document.getElementById('loginCrtPwZone');
  // If password zone is visible, go back to ID-only state
  if(pwZone&&pwZone.style.display!=='none'){
    pwZone.style.display='none';
    document.getElementById('loginPw').value='';
    setLoginStatus('');
    setLoginLed(document.getElementById('loginId').value.trim()?'active':'');
    return;
  }
  // Otherwise go back to landing
  showScreen('landingScreen');
}
function submitLogin(){
  // Clear any stale admin session to prevent expired tokens from contaminating login
  adminSession=null;
  // PREVIEW MODE INTERCEPTION
  if(document.body.classList.contains('landing-preview-mode')){
    const btn=document.getElementById('loginSubmitBtn');
    setLoginLed('active');
    setLoginStatus('<span class="login-crt-spinner"></span>AUTHENTICATING...','authenticating');
    btn.style.opacity='.4';btn.style.pointerEvents='none';
    setTimeout(()=>{
      setLoginLed('granted');
      setLoginStatus('ACCESS GRANTED','granted');
      playSuccess();
    },1500);
    setTimeout(()=>{resetLoginScreen()},3500);
    return;
  }
  const idVal=document.getElementById('loginId').value.trim();
  if(!idVal){setLoginStatus(getLoginPrompt(),'denied');setTimeout(()=>setLoginStatus(getLoginPrompt(),''),2000);return}
  const pwZone=document.getElementById('loginCrtPwZone');
  const btn=document.getElementById('loginSubmitBtn');
  setLoginLed('active');
  setLoginStatus('<span class="login-crt-spinner"></span>AUTHENTICATING...','authenticating');
  btn.style.opacity='.4';btn.style.pointerEvents='none';
  // Admin password phase
  if(pwZone.style.display!=='none'){
    const pw=document.getElementById('loginPw').value;
    if(!pw){setLoginStatus('ENTER PASSWORD','denied');setTimeout(()=>setLoginStatus('ENTER PASSWORD',''),1500);btn.style.opacity='';btn.style.pointerEvents='';return}
    apiCall('login',{username:idVal,password:pw}).then(result=>{
      if(result.ok){
        adminSession={username:result.username,role:result.role,adminToken:result.adminToken};
        isAdmin=true;document.body.classList.add('admin-mode');
        currentVaultTeam={id:'ADMIN',name:'ADMIN',displayName:'ADMINISTRATOR',type:'admin',members:['Admin'],memberDetails:[]};
        updateConsoleForTeam(currentVaultTeam);syncAdminDropdownToggles();saveSession();
        loginSuccess();loadEventData();startTeamMonitor();document.dispatchEvent(new Event('adminReady'));
      }else{
        setLoginLed('denied');setLoginStatus('ACCESS DENIED — AUTH FAILED','denied');
        btn.style.opacity='';btn.style.pointerEvents='';
        playDenied();document.getElementById('flashR').classList.add('on');
        setTimeout(()=>document.getElementById('flashR').classList.remove('on'),300);
        setTimeout(()=>{setLoginLed('active');setLoginStatus('ENTER PASSWORD','')},2000);
      }
    });
    return;
  }
  // First entry — try as Team ID
  apiCall('loginTeam',{teamId:idVal}).then(result=>{
    if(result.ok){
      const t=result;
      currentVaultTeam={id:t.teamId,name:t.teamName,type:t.type,
        members:(t.members||[]).map(m=>typeof m==='string'?m:m.name),
        memberDetails:t.members||[],lastActive:Date.now(),fieldsCompleted:0,
        submitTime:null,registeredAt:t.registeredAt,submissionResults:null};
      if(!registeredTeams.find(r=>r.id===t.teamId)){registeredTeams.push(currentVaultTeam)}
      updateConsoleForTeam(currentVaultTeam);saveSession();loginSuccess();startBroadcastPolling();startActivityTracker();
      apiCall('getEventConfig').then(cfg=>{
        if(cfg.ok&&cfg.config)applyEventConfig(cfg.config);
        // Load drafts from backend after intel fields are rendered
        loadDraftsFromBackend();
      });
    }else{
      apiCall('validateUsername',{username:idVal}).then(vResult=>{
        if(vResult.ok&&vResult.found){
          pwZone.style.display='';document.getElementById('loginPw').focus();
          setLoginStatus('ENTER PASSWORD','');setLoginLed('active');
          btn.style.opacity='';btn.style.pointerEvents='';
        }else{
          setLoginLed('denied');setLoginStatus('ACCESS DENIED — INVALID ID','denied');
          btn.style.opacity='';btn.style.pointerEvents='';
          playDenied();document.getElementById('flashR').classList.add('on');
          setTimeout(()=>document.getElementById('flashR').classList.remove('on'),300);
          setTimeout(()=>{setLoginLed('');setLoginStatus('')},2000);
        }
      });
    }
  });
}
function loginSuccess(){
  playSuccess();if(isAdmin)unlockAdminConsole();
  setLoginLed('granted');setLoginStatus('ACCESS GRANTED','granted');
  document.getElementById('flashG').classList.add('on');
  setTimeout(()=>document.getElementById('flashG').classList.remove('on'),400);
  const btn=document.getElementById('loginSubmitBtn');
  btn.style.opacity='.4';btn.style.pointerEvents='none';
  setTimeout(()=>openVault(),800);
}
function getLoginPrompt(){
  const mode=regSettings.participantMode||'team';
  return mode==='individual'?'ENTER YOUR PLAYER ID':mode==='hybrid'?'ENTER YOUR ID':'ENTER YOUR TEAM ID';
}
function resetLoginScreen(){
  document.getElementById('loginId').value='';document.getElementById('loginPw').value='';
  document.getElementById('loginCrtPwZone').style.display='none';
  const btn=document.getElementById('loginSubmitBtn');
  btn.style.opacity='';btn.style.pointerEvents='';
  setLoginLed('');
  // Dynamic prompt based on participant mode
  setLoginStatus(getLoginPrompt(),'');
}
// Enter key support on login fields
document.getElementById('loginId')?.addEventListener('keydown',e=>{if(e.key==='Enter')submitLogin()});
document.getElementById('loginPw')?.addEventListener('keydown',e=>{if(e.key==='Enter')submitLogin()});
// LED flashes on input activity
document.getElementById('loginId')?.addEventListener('input',function(){
  const pwZone=document.getElementById('loginCrtPwZone');
  if(pwZone&&pwZone.style.display!=='none'){
    pwZone.style.display='none';
    setLoginStatus('');
  }
  if(this.value.trim()){
    setLoginLed('active');setLoginStatus('');
  }else{
    setLoginLed('');
    setLoginStatus(getLoginPrompt(),'');
  }
});
document.getElementById('loginPw')?.addEventListener('input',function(){
  setLoginLed(this.value.trim()||document.getElementById('loginId').value.trim()?'active':'');
});

function updateConsoleForTeam(team){
  const teamEl=document.querySelector('.console-team');
  if(teamEl){
    const typeIcon=team.type==='individual'?'👤 ':'';
    teamEl.childNodes[0].textContent=typeIcon+team.name.toUpperCase()+' ';
  }
  const cardName=document.querySelector('.team-card-name');
  const cardId=document.querySelector('.team-card-id');
  if(cardName)cardName.textContent=team.displayName||team.name;
  if(cardId)cardId.textContent='ID: '+team.id;
  const membersHtml=team.members.map((m,i)=>`<div class="team-card-member"><div class="team-card-avatar">${i+1}</div><span class="team-card-mname">${m}</span></div>`).join('');
  const memberSection=document.querySelector('.team-card-section');
  if(memberSection){
    const label=memberSection.querySelector('.team-card-label');
    memberSection.innerHTML='';
    if(label)memberSection.appendChild(label);
    memberSection.insertAdjacentHTML('beforeend',membersHtml);
  }
}
function openVault(){
  const ov=document.getElementById('vaultOpenOverlay');
  const voText=document.getElementById('voText');
  const voSub=document.getElementById('voSub');
  const voBar=document.getElementById('voBar');
  const voPct=document.getElementById('voPct');
  const voFill=document.getElementById('voFill');

  // Reset percentage
  voPct.textContent='0%';

  // Build GSAP timeline
  const tl=gsap.timeline({
    onComplete:()=>{
      showScreen('consoleScreen');
      document.getElementById('notepadTrigger').classList.add('visible');
      startElapsedTimer();
      // Clean up overlay classes
      gsap.set([voText,voSub,voBar,voFill,voPct],{clearProps:'all'});
      ov.classList.remove('active');
      voText.classList.remove('show');
      voSub.classList.remove('show');
      voBar.classList.remove('show');
      voFill.classList.remove('go');
      voPct.classList.remove('show');
      voPct.textContent='0%';
      // Tutorial or briefing after a beat
      gsap.delayedCall(0.5,()=>{
        if(shouldShowTutorial()){startTutorial()}else{checkShowBriefing()}
      });
    }
  });

  // Phase 1: Overlay appears
  tl.call(()=>ov.classList.add('active'))
  // Phase 2: Text elements fade in with stagger
    .call(()=>{voText.classList.add('show');voSub.classList.add('show')},null,'+=0.3')
    .call(()=>{voBar.classList.add('show');voPct.classList.add('show')},null,'+=0.0')
  // Phase 3: Progress bar fills with animated percentage counter
    .call(()=>{
      voFill.classList.add('go');
      gsap.to({pct:0},{
        pct:100,
        duration:2.2,
        ease:'power2.inOut',
        onUpdate:function(){
          voPct.textContent=Math.round(this.targets()[0].pct)+'%';
        }
      });
    },null,'+=0.9')
  // Phase 4: Hold for dramatic effect, then complete
    .to({},{duration:2.5});
}

