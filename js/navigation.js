// ══════ SCREEN NAVIGATION ══════
// Config hydration flag (prevents settings value flicker on refresh)
if(window.__configHydrated===undefined)window.__configHydrated=false;

let _currentScreen='landingScreen';
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');_currentScreen=id;const lb=document.getElementById('logoutBtn');if(lb)lb.classList.toggle('visible',id==='consoleScreen');if(id!=='settingsScreen'){_currentAdminPage=null;updateGearIcon()}if(currentVaultTeam)saveSession()
  try{_forceCursorKill();}catch(e){}
}
function goToRegistration(){
  const mode=regSettings.participantMode||'team';
  // Update registration screen text based on mode
  const title=document.getElementById('regScreenTitle');
  const sub=document.getElementById('regScreenSubtitle');
  const typeChoice=document.getElementById('regTypeChoice');
  if(mode==='individual'){
    if(title)title.textContent=operationName;
    if(sub)sub.textContent='Individual Registration';
    if(typeChoice)typeChoice.style.display='none';
  }else if(mode==='hybrid'){
    if(title)title.textContent=operationName;
    if(sub)sub.textContent='Registration Portal';
    if(typeChoice)typeChoice.style.display='flex';
  }else{
    if(title)title.textContent=operationName;
    if(sub)sub.textContent='Team Registration Portal';
    if(typeChoice)typeChoice.style.display='none';
  }
  buildRegForm();
  if(window._histPush)window._histPush('register');
  showScreen('regScreen');
}
function goToLogin(){
  resetLoginScreen();
  if(window._histPush)window._histPush('login');
  showScreen('loginScreen');
  setTimeout(()=>document.getElementById('loginId').focus(),300);
}
function setRegLed(state){
  const led=document.getElementById('regLed');
  if(!led)return;
  led.className='login-led'+(state?' '+state:'');
}
function setRegStatus(text,cls){
  const el=document.getElementById('regCrtStatus');
  if(!el)return;
  el.className='login-crt-status'+(cls?' '+cls:'');
  el.innerHTML=text;
  const div=document.getElementById('regCrtDivider');
  if(div)div.style.display=text?'':'none';
}
function regBack(){
  // ESC on registration goes back to login screen
  setRegLed('');setRegStatus('');
  showScreen('loginScreen');
  setTimeout(()=>document.getElementById('loginId').focus(),300);
}
function goToConsole(){
  if(window._histPush)window._histPush('console');
  showScreen('consoleScreen');document.getElementById('notepadTrigger').classList.add('visible');startElapsedTimer();
  renderGrid(); // Ensure grid renders even if config hasn't loaded yet
  // If no team loaded (admin direct entry), show admin identity
  if(!currentVaultTeam&&isAdmin){
    currentVaultTeam={id:'ADMIN',name:'ADMIN',displayName:'ADMINISTRATOR',type:'admin',members:['Admin'],memberDetails:[]};
    updateConsoleForTeam(currentVaultTeam);
  }
}
function selectRegType(el){
  document.querySelectorAll('.reg-type-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  currentRegType=el.dataset.type;
  buildRegForm();
}

// ══════ LANDING PAGE ══════
function updateLandingForMode(){
  const mode=regSettings.participantMode||'team';
  const regText=document.getElementById('loginRegText');
  const regAction=document.getElementById('loginRegAction');
  const regLink=document.getElementById('loginRegLink');
  
  if(!regText)return;
  if(regLink)regLink.style.display=regSettings.registrationOpen===false?'none':'';
  const crtLabel=document.getElementById('loginCrtLabel');
  if(mode==='team'){
    regText.textContent="Don't have a Team ID?";
    regAction.textContent='Register your team';
    if(crtLabel)crtLabel.textContent='TEAM ID';
  }else if(mode==='individual'){
    regText.textContent="Need to register?";
    regAction.textContent='Sign up here';
    if(crtLabel)crtLabel.textContent='USER ID';
  }else{
    regText.textContent="Need to register?";
    regAction.textContent='Sign up here';
    if(crtLabel)crtLabel.textContent='TEAM / USER ID';
  }
}
function updateLandingBanner(){
  const url=regSettings.landingBannerUrl||'';
  applyBannerImage(url);
  syncBannerPreview();
  showSaveBlip('blipLandingBanner');
}
function applyBannerImage(url){
  const img=document.getElementById('landingBannerImg');
  const icon=document.querySelector('.landing-banner-icon');
  if(url&&img&&icon){img.src=url;img.style.display='block';icon.style.display='none'}
  else if(img&&icon){img.style.display='none';icon.style.display='block';icon.textContent=regSettings.bannerFallback||'🔐'}
}
function clearLandingBanner(){
  regSettings.landingBannerUrl='';
  applyBannerImage('');
  syncBannerPreview();
}
function syncBannerPreview(){
  const prev=document.getElementById('apBannerPreview');
  const status=document.getElementById('apBannerStatus');
  const url=regSettings.landingBannerUrl||'';
  const fallback=regSettings.bannerFallback||'🔐';
  if(url){
    prev.innerHTML=`<img src="${url}" alt="Preview">`;
    if(status)status.textContent='✓ Image set';status.style.color='var(--green)';
  }else{
    prev.innerHTML=`<span class="bp-emoji">${fallback}</span>`;
    if(status){status.textContent='No image set — showing fallback icon';status.style.color='#555'}
  }
}
function updateBannerFallback(){
  const val=document.getElementById('apBannerFallback')?.value||'🔐';
  regSettings.bannerFallback=val;
  const icon=document.querySelector('.landing-banner-icon');
  if(icon)icon.textContent=val;
  syncBannerPreview();
  saveEventConfigToBackend();
}
function handleBannerUpload(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  // Show local preview immediately
  const reader=new FileReader();
  reader.onload=function(e){
    applyBannerImage(e.target.result);
  };
  reader.readAsDataURL(file);
  // Upload to R2
  uploadFileToDrive(file,'banners').then(result=>{
    regSettings.landingBannerUrl=result.directUrl;
    applyBannerImage(result.directUrl);
    syncBannerPreview();
    saveEventConfigToBackend();
  }).catch(err=>{
    console.error('Banner upload error:',err);
    // Fallback to data URL
    const r2=new FileReader();
    r2.onload=function(e2){regSettings.landingBannerUrl=e2.target.result;syncBannerPreview();saveEventConfigToBackend()};
    r2.readAsDataURL(file);
  });
}
function handleAdminBannerUpload(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  // Upload to R2 first, then show preview
  const reader=new FileReader();
  reader.onload=function(e){
    const localUrl=e.target.result;
    // Upload to R2 in background
    uploadFileToDrive(file,'banners').then(result=>{
      showBannerPreviewModal(result.directUrl,input);
    }).catch(err=>{
      console.error('Banner R2 upload error:',err);
      showBannerPreviewModal(localUrl,input);
    });
  };
  reader.readAsDataURL(file);
  input.value=''; // reset so same file can be re-selected
}

let _pendingBannerUrl='';
function showBannerPreviewModal(url,inputEl){
  _pendingBannerUrl=url;
  showEditModal(`<h3>📷 Banner Preview</h3>
    <p style="font-family:'Chakra Petch',sans-serif;font-size:10px;color:#888;margin-bottom:16px">How your banner will appear on the landing page.</p>
    <div style="display:flex;justify-content:center;margin-bottom:20px">
      <div style="width:180px;height:180px;border-radius:50%;overflow:hidden;border:2px solid rgba(0,212,255,.3);box-shadow:0 0 30px rgba(0,212,255,.08);background:#080a10;display:flex;align-items:center;justify-content:center">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn-standard btn-ghost" onclick="cancelBannerPreview()">✕ Cancel</button>
      <button class="btn-standard btn-cyan" onclick="acceptBannerPreview()">✓ Use This Image</button>
    </div>`);
}
function acceptBannerPreview(){
  regSettings.landingBannerUrl=_pendingBannerUrl;
  applyBannerImage(_pendingBannerUrl);
  syncBannerPreview();
  saveEventConfigToBackend();
  hideEditModal();
  _pendingBannerUrl='';
}
function cancelBannerPreview(){
  _pendingBannerUrl='';
  hideEditModal();
}
function updateLandingTitle(){
  regSettings.landingTitle=document.getElementById('apLandingTitle')?.value||'Code Breakers';
  document.getElementById('landingTitleEl').textContent=regSettings.landingTitle;
  showSaveBlip('blipLandingTitle');
  saveEventConfigToBackend();
}
function updateLandingSubtitle(){
  regSettings.landingSubtitle=document.getElementById('apLandingSubtitle')?.value||'Operations Console';
  document.getElementById('landingSubEl').textContent=regSettings.landingSubtitle;
  showSaveBlip('blipLandingSub');
  saveEventConfigToBackend();
}

