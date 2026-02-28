// ══════ REGISTRATION ══════
function formatRegPhone(el){
  let v=el.value.replace(/\D/g,'').slice(0,10);
  if(v.length>6)v='('+v.slice(0,3)+') '+v.slice(3,6)+'-'+v.slice(6);
  else if(v.length>3)v='('+v.slice(0,3)+') '+v.slice(3);
  else if(v.length>0)v='('+v;
  el.value=v;
}
function generateTeamId(name){
  // First 4 uppercase letters of name, pad with X if needed
  const clean=(name||'TEAM').replace(/[^a-zA-Z]/g,'').toUpperCase();
  const prefix=(clean+'XXXX').substring(0,4);
  let id,attempts=0;
  do{
    const num=String(Math.floor(1000+Math.random()*9000));
    id=prefix+'-'+num;
    attempts++;
  }while(registeredTeams.some(t=>t.id===id)&&attempts<100);
  return id;
}
function submitRegistration(){
  // PREVIEW MODE INTERCEPTION
  if(document.body.classList.contains('landing-preview-mode')){
    const btn=document.getElementById('regSubmitBtn');
    const btnSpan=btn.querySelector('span');
    btn.style.opacity='.4';btn.style.pointerEvents='none';
    setRegLed('active');
    setRegStatus('<span class="login-crt-spinner"></span>VALIDATING...','authenticating');
    setTimeout(()=>{
      setRegStatus('<span class="login-crt-spinner"></span>REGISTERING...','authenticating');
    },600);
    setTimeout(()=>{
      setRegLed('granted');
      setRegStatus('REGISTRATION COMPLETE','granted');
      document.getElementById('regForm').style.display='none';
      document.getElementById('regSuccess').style.display='block';
      document.getElementById('regBtnRow').style.display='none';
      document.getElementById('regTeamId').textContent='PREVIEW-0000';
      playSuccess();
    },1200);
    setTimeout(()=>{
      document.getElementById('regForm').style.display='';
      document.getElementById('regSuccess').style.display='none';
      document.getElementById('regBtnRow').style.display='';
      btn.style.opacity='';btn.style.pointerEvents='';
      setRegLed('');setRegStatus('');
    },4000);
    return;
  }
  const mode=regSettings.participantMode||'team';
  let effectiveType=mode==='individual'?'individual':(mode==='team'?'team':currentRegType);

  function regValidationErr(msg){
    setRegLed('denied');
    setRegStatus(msg.toUpperCase(),'denied');
    setTimeout(()=>{setRegLed('');setRegStatus('')},3000);
  }

  if(!regSettings.registrationOpen){regValidationErr('Registration closed');return}

  let entityName='', members=[], email='', phone='', dept='';

  if(effectiveType==='team'){
    entityName=document.getElementById('regTeamName')?.value.trim()||'';
    if(!entityName){regValidationErr('Enter team name');return}
    if(entityName.length>30){regValidationErr('Name too long (max 30)');return}
    if(/[<>"'&]/.test(entityName)){regValidationErr('Invalid characters in name');return}
    const memberCount=parseInt(document.getElementById('regMemberCount')?.value||regSettings.teamSizeMax);
    for(let m=1;m<=memberCount;m++){
      const name=document.getElementById('reg'+m+'Name')?.value.trim();
      const mdept=document.getElementById('reg'+m+'Dept')?.value.trim()||'';
      const memail=document.getElementById('reg'+m+'Email')?.value.trim()||'';
      const mphone=document.getElementById('reg'+m+'Phone')?.value.trim()||'';
      if(!name){regValidationErr('Enter name — member '+m);return}
      if(regSettings.requireEmail&&!memail){regValidationErr('Enter email — member '+m);return}
      if(regSettings.requirePhone&&!mphone){regValidationErr('Enter phone — member '+m);return}
      if(regSettings.requireDept&&!mdept){regValidationErr('Enter dept — member '+m);return}
      members.push({name,dept:mdept,email:memail,phone:mphone});
    }
    email=members[0]?.email||'';phone=members[0]?.phone||'';dept=members[0]?.dept||'';
  }else{
    entityName=document.getElementById('regIndividualName')?.value.trim()||'';
    if(!entityName){regValidationErr('Enter your name');return}
    if(entityName.length>40){regValidationErr('Name too long (max 40)');return}
    if(/[<>"'&]/.test(entityName)){regValidationErr('Invalid characters');return}
    dept=document.getElementById('regIndDept')?.value.trim()||'';
    email=document.getElementById('regIndEmail')?.value.trim()||'';
    phone=document.getElementById('regIndPhone')?.value.trim()||'';
    if(regSettings.requireEmail&&!email){regValidationErr('Enter your email');return}
    if(regSettings.requirePhone&&!phone){regValidationErr('Enter your phone');return}
    if(regSettings.requireDept&&!dept){regValidationErr('Enter your department');return}
    members=[{name:entityName,dept,email,phone}];
  }

  const btn=document.getElementById('regSubmitBtn');
  btn.style.opacity='.4';btn.style.pointerEvents='none';
  setRegLed('active');
  setRegStatus('<span class="login-crt-spinner"></span>VALIDATING...','authenticating');

  // Check for duplicate team name first
  apiCall('checkTeamName',{teamName:entityName}).then(checkResult=>{
    if(checkResult.ok&&checkResult.exists){
      // Duplicate found
      setRegLed('denied');
      setRegStatus('NAME ALREADY EXISTS','denied');
      btn.style.opacity='';btn.style.pointerEvents='';
      playDenied();
      document.getElementById('flashR').classList.add('on');
      setTimeout(()=>document.getElementById('flashR').classList.remove('on'),300);
      setTimeout(()=>{setRegLed('');setRegStatus('')},3000);
      return;
    }
    // Name available — proceed with registration
    setRegStatus('<span class="login-crt-spinner"></span>REGISTERING...','authenticating');
    apiCall('registerTeam',{
      teamName:entityName,
      type:effectiveType,
      members:members,
      email:email,
      phone:phone,
      dept:dept
    }).then(result=>{
      if(result.ok){
        const teamId=result.teamId;
        document.getElementById('regTeamId').textContent=teamId;

        registeredTeams.push({
          id:teamId,name:entityName,type:effectiveType,
          members:members.map(m=>m.name),memberDetails:members,
          lastActive:Date.now(),fieldsCompleted:0,submitTime:null,
          registeredAt:new Date().toISOString(),submissionResults:null
        });

        setRegLed('granted');
        setRegStatus('REGISTRATION COMPLETE','granted');
        document.getElementById('regForm').style.display='none';
        document.getElementById('regSuccess').style.display='block';
        document.getElementById('regBtnRow').style.display='none';
        playSuccess();
        document.getElementById('flashG').classList.add('on');
        setTimeout(()=>document.getElementById('flashG').classList.remove('on'),400);
      }else{
        setRegLed('denied');
        const errMsg=result.error||'Registration failed';
        if(errMsg.toLowerCase().includes('exist')||errMsg.toLowerCase().includes('duplicate')){
          setRegStatus('NAME ALREADY EXISTS','denied');
        }else{
          setRegStatus('REGISTRATION FAILED','denied');
        }
        btn.style.opacity='';btn.style.pointerEvents='';
        playDenied();
        document.getElementById('flashR').classList.add('on');
        setTimeout(()=>document.getElementById('flashR').classList.remove('on'),300);
        setTimeout(()=>{setRegLed('');setRegStatus('')},3000);
      }
    });
  }).catch(()=>{
    // If checkTeamName API doesn't exist, proceed with registration directly
    setRegStatus('<span class="login-crt-spinner"></span>REGISTERING...','authenticating');
    apiCall('registerTeam',{
      teamName:entityName,
      type:effectiveType,
      members:members,
      email:email,
      phone:phone,
      dept:dept
    }).then(result=>{
      if(result.ok){
        const teamId=result.teamId;
        document.getElementById('regTeamId').textContent=teamId;
        registeredTeams.push({
          id:teamId,name:entityName,type:effectiveType,
          members:members.map(m=>m.name),memberDetails:members,
          lastActive:Date.now(),fieldsCompleted:0,submitTime:null,
          registeredAt:new Date().toISOString(),submissionResults:null
        });
        setRegLed('granted');
        setRegStatus('REGISTRATION COMPLETE','granted');
        document.getElementById('regForm').style.display='none';
        document.getElementById('regSuccess').style.display='block';
        document.getElementById('regBtnRow').style.display='none';
        playSuccess();
        document.getElementById('flashG').classList.add('on');
        setTimeout(()=>document.getElementById('flashG').classList.remove('on'),400);
      }else{
        setRegLed('denied');
        setRegStatus('REGISTRATION FAILED','denied');
        btn.style.opacity='';btn.style.pointerEvents='';
        playDenied();
        setTimeout(()=>{setRegLed('');setRegStatus('')},3000);
      }
    });
  });
}

function updateRegSettings(){
  regSettings.teamSizeMin=parseInt(document.getElementById('apMinSize')?.value||2);
  regSettings.teamSizeMax=parseInt(document.getElementById('apMaxSize')?.value||4);
  regSettings.maxTeams=parseInt(document.getElementById('apMaxTeams')?.value||20);
  regSettings.requireEmail=document.getElementById('apReqEmail')?.checked||false;
  regSettings.requirePhone=document.getElementById('apReqPhone')?.checked||false;
  regSettings.requireDept=document.getElementById('apReqDept')?.checked||false;
  regSettings.registrationOpen=document.getElementById('apRegOpen')?.checked||false;
  // Ensure min <= max
  if(regSettings.teamSizeMin>regSettings.teamSizeMax)regSettings.teamSizeMin=regSettings.teamSizeMax;
  // Update status indicator
  const status=document.getElementById('apRegStatus');
  if(status){
    status.textContent=regSettings.registrationOpen?'● OPEN':'● CLOSED';
    status.style.color=regSettings.registrationOpen?'var(--green)':'var(--red)';
  }
  // Rebuild registration form with new member count
  buildRegForm();
  saveEventConfigToBackend();
}

function buildRegForm(){
  const container=document.getElementById('regOperatives');
  if(!container)return;
  const mode=regSettings.participantMode||'team';
  let effectiveType=mode==='individual'?'individual':(mode==='team'?'team':currentRegType);

  // Update section title
  const teamNameField=document.getElementById('regTeamName');

  if(effectiveType==='individual'){
    // Hide team name, show individual name
    const nameSection=teamNameField?.closest('.reg-section');
    if(nameSection){
      nameSection.innerHTML=`<div class="reg-field full"><label class="reg-main-label">Full Name</label><input type="text" id="regIndividualName" placeholder="Enter your full name" maxlength="40"></div>`;
    }
    // Show individual-specific optional fields instead of member slots
    let html='';
    if(regSettings.requireDept||true){html+=`<div class="reg-field full" style="margin-bottom:10px"><label>Department${regSettings.requireDept?'':' (optional)'}</label><input type="text" id="regIndDept" placeholder="Department"></div>`}
    if(regSettings.requireEmail||true){html+=`<div class="reg-field full" style="margin-bottom:10px"><label>Email${regSettings.requireEmail?'':' (optional)'}</label><input type="email" id="regIndEmail" placeholder="email@company.com"></div>`}
    if(regSettings.requirePhone||true){html+=`<div class="reg-field full" style="margin-bottom:10px"><label>Cell #${regSettings.requirePhone?'':' (optional)'}</label><input type="tel" id="regIndPhone" placeholder="(XXX) XXX-XXXX" oninput="formatRegPhone(this)"></div>`}
    container.innerHTML=html;
  }else{
    // Team mode — restore standard team form
    const nameSection=document.getElementById('regTeamName')?.closest('.reg-section')||document.getElementById('regIndividualName')?.closest('.reg-section');
    if(nameSection&&!document.getElementById('regTeamName')){
      nameSection.innerHTML=`<div class="reg-field full"><label class="reg-main-label">Team Name</label><input type="text" id="regTeamName" placeholder="Enter your team name" maxlength="30"></div>`;
    }
    // Standard team member slots
    const max=regSettings.teamSizeMax;
    const min=regSettings.teamSizeMin;
    let html='';
    if(min<max){
      html+=`<div class="reg-field full" style="margin-bottom:12px"><label class="reg-main-label">Number of Team Members</label><select id="regMemberCount" onchange="rebuildMemberSlots()" style="background:#080a10;border:1px solid var(--border);border-radius:4px;padding:10px 14px;color:#ddd;font-family:'IBM Plex Mono',monospace;font-size:12px;width:100%;outline:none">`;
      for(let n=min;n<=max;n++)html+=`<option value="${n}"${n===max?' selected':''}>${n} Members</option>`;
      html+=`</select></div>`;
    }else{
      html+=`<input type="hidden" id="regMemberCount" value="${max}">`;
    }
    html+=`<div id="regMemberSlots"></div>`;
    container.innerHTML=html;
    rebuildMemberSlots();
  }
}

function rebuildMemberSlots(){
  const count=parseInt(document.getElementById('regMemberCount')?.value||regSettings.teamSizeMax);
  const slots=document.getElementById('regMemberSlots');
  if(!slots)return;
  let html='';
  for(let m=1;m<=count;m++){
    html+=`<div class="reg-member-block">
      <div class="reg-member-label"><span class="reg-member-num">${m}</span> Team Member ${m}</div>
      <div class="reg-row">
        <div class="reg-field"><label>Full Name</label><input type="text" id="reg${m}Name" placeholder="First & Last Name"></div>
        ${regSettings.requireDept||true?`<div class="reg-field"><label>Department${regSettings.requireDept?'':' (optional)'}</label><input type="text" id="reg${m}Dept" placeholder="Department"></div>`:''}
      </div>
      <div class="reg-row">
        ${regSettings.requireEmail||true?`<div class="reg-field"><label>Email${regSettings.requireEmail?'':' (optional)'}</label><input type="email" id="reg${m}Email" placeholder="email@company.com"></div>`:''}
        ${regSettings.requirePhone||true?`<div class="reg-field"><label>Cell #${regSettings.requirePhone?'':' (optional)'}</label><input type="tel" id="reg${m}Phone" placeholder="(XXX) XXX-XXXX" oninput="formatRegPhone(this)"></div>`:''}
      </div>
    </div>`;
  }
  slots.innerHTML=html;
}
function proceedToLogin(){
  goToLogin();
  // Pre-fill the Team ID from registration
  const teamId=document.getElementById('regTeamId')?.textContent;
  if(teamId&&teamId!=='—'){
    document.getElementById('loginId').value=teamId;
  }
}

