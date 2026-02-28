// ══════ SESSION MANAGEMENT ══════
function openSessionMgmt(){switchAdminTab('sessionMgmtPanel')}
function closeSessionMgmt(){const el=document.getElementById('sessionMgmtPanel');el.classList.remove('active');el.style.cssText='';hideAdminTabs()}
function destroySessions(mode){
  const labels={all:'DESTROY ALL SESSIONS (including yours)',teams:'DESTROY ALL TEAM SESSIONS',exceptMe:'DESTROY ALL SESSIONS EXCEPT YOURS'};
  if(!confirm(labels[mode]+'?\n\nAffected users will be kicked to the login screen immediately.')){return}
  const msg=document.getElementById('sessionMgmtMsg');
  msg.className='ap-msg';msg.textContent='Destroying sessions...';
  apiCall('destroySessions',{mode}).then(r=>{
    console.log('destroySessions response:',JSON.stringify(r));
    if(r.ok){
      msg.className='ap-msg ok';msg.textContent='✓ '+r.message;
      if(mode==='exceptMe'&&r.newToken){
        adminSession.adminToken=r.newToken;
        saveSession();
        msg.textContent+=' — Your token has been refreshed.';
      }else if(mode==='all'){
        msg.textContent+=' — Reloading in 2s...';
        setTimeout(()=>{localStorage.removeItem('cb_session');sessionStorage.removeItem('cb_session');location.reload()},2000);
      }
    }else{
      msg.className='ap-msg err';msg.textContent='✗ '+(r.error||'Failed');
    }
  });
}

function nukeAllTeams(){
  if(!confirm('☢ NUKE ALL TEAMS?\n\nThis permanently deletes ALL teams, their submissions, drafts, vault progress, and leaderboard entries.\n\nThis CANNOT be undone.'))return;
  if(!confirm('Are you absolutely sure? Type YES in the next prompt to confirm.'))return;
  var answer=prompt('Type YES to confirm total team wipe:');
  if(answer!=='YES'){alert('Cancelled.');return}
  var msg=document.getElementById('nukeMgmtMsg');
  msg.className='ap-msg';msg.textContent='Nuking all teams...';
  Promise.all([
    apiCall('clearAllData',{scope:'teams'}),
    apiCall('clearAllData',{scope:'submissions'})
  ]).then(function(results){
    var r=results[0]||{ok:false};

    if(r.ok){
      msg.className='ap-msg ok';msg.textContent='☢ '+r.message;
      registeredTeams.length=0;manualTeams.length=0;
      renderTeamMonitor();renderLeaderboard();renderFullLeaderboard();
    }else{
      msg.className='ap-msg err';msg.textContent='✗ '+(r.error||'Failed');
    }
  });
}

function nukeSelectedTeams(){
  var checks=document.querySelectorAll('.tm-nuke-check:checked');
  if(!checks.length){alert('No teams selected.');return}
  var ids=[];checks.forEach(function(cb){ids.push(cb.dataset.team)});
  if(!confirm('☢ NUKE '+ids.length+' TEAM'+(ids.length>1?'S':'')+'?\n\nIDs: '+ids.join(', ')+'\n\nThis permanently deletes their data. Cannot be undone.'))return;
  var msg=document.getElementById('tmNukeBar');
  (async function(){
    // Remove team submissions (if any) and team records
    var draftResp = await apiCall('getDrafts',{});
    var draftsObj = (draftResp&&draftResp.ok&&draftResp.drafts)?draftResp.drafts:null;
    for(var i=0;i<ids.length;i++){
      var tid=ids[i];
      try{await apiCall('desubmitTeam',{teamId:tid})}catch(e){}
      try{await apiCall('removeTeam',{teamId:tid})}catch(e){}
      if(draftsObj && draftsObj[tid]){delete draftsObj[tid]}
    }
    if(draftsObj){
      try{await apiCall('saveDrafts',{drafts:draftsObj})}catch(e){}
    }
    return {ok:true,message:'Selected teams removed'};
  })().then(function(r){
    if(r.ok){
      ids.forEach(function(id){
        var idx=registeredTeams.findIndex(function(t){return t.id===id});
        if(idx>=0)registeredTeams.splice(idx,1);
        var mi=manualTeams.findIndex(function(t){return t.id===id});
        if(mi>=0)manualTeams.splice(mi,1);
      });
      renderTeamMonitor();renderLeaderboard();renderFullLeaderboard();
      alert('☢ '+r.message);
    }else{
      alert('Failed: '+(r.error||'Unknown error'));
    }
  });
}

