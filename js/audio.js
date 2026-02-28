// ══════ AUDIO ══════
// ══════ TEAM CARD ══════
let teamCardOpen=false,elapsedSec=0,elapsedInterval=null;
function toggleTeamCard(e){
  if(e)e.stopPropagation();
  teamCardOpen=!teamCardOpen;
  document.getElementById('teamCard').classList.toggle('open',teamCardOpen);
  if(teamCardOpen){
    updateTeamCardStats();
    onTeamCardOpen();
  }
}
function updateTeamCardStats(){
  // Elapsed
  const m=String(Math.floor(elapsedSec/60)).padStart(2,'0');
  const s=String(elapsedSec%60).padStart(2,'0');
  document.getElementById('tcElapsed').textContent=m+':'+s;
  // Intel marked
  const inputs=document.querySelectorAll('.intel-exp-input');
  let n=0;inputs.forEach(inp=>{if(inp.value.trim())n++});
  document.getElementById('tcIntel').textContent=n+' / '+inputs.length+(isSubmitted?' ✓':'');
}
// Start elapsed timer when console opens
function startElapsedTimer(){
  if(elapsedInterval)return;
  // Set session start time if not restored from game state
  if(!_sessionStartTime)_sessionStartTime=Date.now()-elapsedSec*1000;
  elapsedInterval=setInterval(()=>{elapsedSec++;if(teamCardOpen)updateTeamCardStats()},1000);
}
// Close card when clicking outside
document.addEventListener('click',()=>{if(teamCardOpen){teamCardOpen=false;document.getElementById('teamCard').classList.remove('open')}});

