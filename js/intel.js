// ══════ INTEL ══════
let isSubmitted=false;
let submissionResults=null; // Stores grading results after submit

function formatPhone(el){
  let v=el.value.replace(/\D/g,'').slice(0,10);
  if(v.length>6)v='('+v.slice(0,3)+') '+v.slice(3,6)+'-'+v.slice(6);
  else if(v.length>3)v='('+v.slice(0,3)+') '+v.slice(3);
  else if(v.length>0)v='('+v;
  el.value=v;
}
function formatMoney(el){
  // Preserve cursor intent: strip everything non-digit
  const raw=el.value.replace(/[^0-9]/g,'');
  if(!raw){el.value='';return;}
  // Format with commas
  el.value=parseInt(raw,10).toLocaleString('en-US');
}
function formatDate(el){
  let v=el.value.replace(/\D/g,'').slice(0,8);
  if(v.length>4)v=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);
  else if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);
  el.value=v;
}

// ── Levenshtein Distance (fuzzy matching) ──
function levenshtein(a,b){
  const m=a.length,n=b.length;
  const d=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++)d[i][0]=i;
  for(let j=0;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
    const cost=a[i-1]===b[j-1]?0:1;
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
  }
  return d[m][n];
}
function similarity(a,b){
  if(!a&&!b)return 1;if(!a||!b)return 0;
  const maxLen=Math.max(a.length,b.length);
  if(maxLen===0)return 1;
  return((maxLen-levenshtein(a,b))/maxLen)*100;
}

// ── Answer Checking ──
function normalizeAnswer(str,caseSensitive){
  let s=str.trim();
  // Strip common noise: extra spaces, trailing periods
  s=s.replace(/\s+/g,' ').replace(/\.$/,'');
  // Strip currency symbols and commas so $2,000,000 == 2000000
  s=s.replace(/[$,]/g,'');
  if(!caseSensitive)s=s.toLowerCase();
  return s;
}

function checkSingleAnswer(submitted,answerConfig){
  if(!submitted.trim())return{correct:false,score:0,match:'empty'};
  const cfg=answerConfig||{expected:[''],alts:[],caseSensitive:false,matchMode:'exact',fuzzyThreshold:85};
  const cs=cfg.caseSensitive;
  const sub=normalizeAnswer(submitted,cs);

  // Build list of all acceptable answers
  const acceptables=[...cfg.expected.filter(e=>e.trim()),...(cfg.alts||[]).filter(a=>a.trim())];
  if(!acceptables.length)return{correct:false,score:0,match:'no-answer-key'};

  for(const ans of acceptables){
    const norm=normalizeAnswer(ans,cs);
    // Exact match
    if(sub===norm)return{correct:true,score:cfg.points||10,match:'exact'};
  }

  // Contains match
  if(cfg.matchMode==='contains'){
    for(const ans of acceptables){
      const norm=normalizeAnswer(ans,cs);
      if(sub.includes(norm)||norm.includes(sub))return{correct:true,score:cfg.points||10,match:'contains'};
    }
  }

  // Fuzzy match — only when explicitly set to fuzzy mode
  if(cfg.matchMode==='fuzzy'){
    for(const ans of acceptables){
      const norm=normalizeAnswer(ans,cs);
      const sim=similarity(sub,norm);
      if(sim>=cfg.fuzzyThreshold)return{correct:true,score:cfg.points||10,match:'fuzzy',similarity:Math.round(sim)};
    }
  }

  // Find closest match for feedback
  let bestSim=0;
  for(const ans of acceptables){
    const norm=normalizeAnswer(ans,cs);
    const sim=similarity(sub,norm);
    if(sim>bestSim)bestSim=sim;
  }
  return{correct:false,score:0,match:'wrong',closestSimilarity:Math.round(bestSim)};
}

function gradeAllSubmissions(){
  const results=[];
  let totalScore=0,totalPossible=0,correctCount=0;

  intelFields.forEach((f,i)=>{
    const pts=f.answer?.points||10;
    totalPossible+=pts;

    if(f.type==='dual'){
      // Dual fields: check both values
      const inp1=document.querySelector(`.intel-exp-input[data-idx="${i}"]`);
      const inp2=document.querySelector(`.intel-exp-input[data-idx="${i}b"]`);
      const v1=inp1?inp1.value:'';
      const v2=inp2?inp2.value:'';
      const exp=f.answer?.expected||['',''];

      // Try both orderings (teams might swap the two values)
      const r1a=checkSingleAnswer(v1,{...f.answer,expected:[exp[0]||'']});
      const r1b=checkSingleAnswer(v2,{...f.answer,expected:[exp[1]||'']});
      const r2a=checkSingleAnswer(v1,{...f.answer,expected:[exp[1]||'']});
      const r2b=checkSingleAnswer(v2,{...f.answer,expected:[exp[0]||'']});

      const score1=(r1a.correct?1:0)+(r1b.correct?1:0);
      const score2=(r2a.correct?1:0)+(r2b.correct?1:0);

      if(score1>=score2){
        const bothCorrect=r1a.correct&&r1b.correct;
        results.push({field:f.label,type:'dual',correct:bothCorrect,partialCorrect:score1===1,submitted:[v1,v2],results:[r1a,r1b],score:bothCorrect?pts:(score1===1?Math.round(pts/2):0)});
        if(bothCorrect)correctCount++;
        totalScore+=bothCorrect?pts:(score1===1?Math.round(pts/2):0);
      }else{
        const bothCorrect=r2a.correct&&r2b.correct;
        results.push({field:f.label,type:'dual',correct:bothCorrect,partialCorrect:score2===1,submitted:[v1,v2],results:[r2a,r2b],score:bothCorrect?pts:(score2===1?Math.round(pts/2):0)});
        if(bothCorrect)correctCount++;
        totalScore+=bothCorrect?pts:(score2===1?Math.round(pts/2):0);
      }
    }else{
      const inp=document.querySelector(`.intel-exp-input[data-idx="${i}"]`);
      const v=inp?inp.value:'';
      const r=checkSingleAnswer(v,f.answer);
      results.push({field:f.label,type:'single',correct:r.correct,submitted:v,result:r,score:r.score});
      if(r.correct)correctCount++;
      totalScore+=r.score;
    }
  });

  return{results,totalScore,totalPossible,correctCount,totalFields:intelFields.length,percentage:totalPossible?Math.round((totalScore/totalPossible)*100):0};
}
function updateIntelBadge(){const filled=document.querySelectorAll('.intel-exp-input');let n=0;filled.forEach(inp=>{if(inp.value.trim())n++});const badge=document.getElementById('intelBadge');if(badge)badge.textContent=n+' / '+filled.length+' ENTERED'}
document.addEventListener('input',e=>{if(e.target.classList.contains('intel-exp-input'))updateIntelBadge()});
function showConfirm(){
  if(isSubmitted)return;
  // Player preview dry-run — show confirm then simulate
  playConfirmPrompt();const inputs=document.querySelectorAll('.intel-exp-input'),body=document.getElementById('confirmBody');body.innerHTML='';
  syncIntelLabels();let li=0;
  inputs.forEach((inp)=>{let v=inp.value.trim();const idx=inp.dataset.idx;
    const fi=parseInt(idx);if(!isNaN(fi)&&intelFields[fi]&&intelFields[fi].type==='money'&&v)v='$'+v;
    const label=intelLabels[li]||'Field '+(li+1);li++;
    body.innerHTML+=`<div class="confirm-row"><span class="confirm-label">${label}</span><span class="confirm-value ${v?'':'empty'}">${v||'— empty —'}</span></div>`});
  document.getElementById('confirmModal').classList.add('active')}
function hideConfirm(){document.getElementById('confirmModal').classList.remove('active')}
function finalSubmit(){
  // Player preview dry-run — full visual feedback, then reset
  if(document.body.classList.contains('player-preview')){
    document.getElementById('confirmModal').classList.remove('active');
    document.querySelectorAll('.intel-exp-input').forEach(inp=>{inp.disabled=true});
    const btn=document.getElementById('intelSubmitBtn');if(btn){btn.textContent='INTEL SUBMITTED';btn.disabled=true}
    document.getElementById('intelBadge').textContent='SUBMITTED';
    playSuccess();
    document.getElementById('flashG').classList.add('on');
    setTimeout(()=>document.getElementById('flashG').classList.remove('on'),400);
    // Reset after 3 seconds
    setTimeout(()=>{
      document.querySelectorAll('.intel-exp-input').forEach(inp=>{inp.disabled=false;inp.value=''});
      if(btn){btn.textContent='SUBMIT INTEL';btn.disabled=false}
      updateIntelBadge();
    },3000);
    return;
  }

  isSubmitted=true;
  // Grade all answers locally — results stored for admin/leaderboard
  submissionResults=gradeAllSubmissions();
  submissionResults.submittedAt=new Date().toISOString();
  saveGameState();

  document.getElementById('confirmModal').classList.remove('active');
  document.querySelectorAll('.intel-exp-input').forEach(inp=>{inp.disabled=true});
  // Show neutral checkmarks — NO indication of right/wrong
    document.getElementById('intelSubmitBtn').disabled=true;
  const _sl=document.getElementById('intelSubmitBtn');if(_sl){_sl.textContent='INTEL SUBMITTED';_sl.disabled=true;}
  document.getElementById('intelBadge').textContent=tileBadgeText('intel',false);
  document.getElementById('intelBadge').classList.remove('amber');
  playSuccess();
  document.getElementById('flashG').classList.add('on');
  setTimeout(()=>document.getElementById('flashG').classList.remove('on'),400);

  // Send to backend
  if(currentVaultTeam&&currentVaultTeam.id!=='ADMIN'){
    const answers={};
    document.querySelectorAll('.intel-exp-input').forEach(inp=>{
      const idx=inp.dataset.idx;
      const fi=parseInt(idx);
      if(!isNaN(fi)&&intelFields[fi]){
        const key=intelFields[fi].label;
        if(idx.endsWith('b')){answers[key+'_2']=inp.value.trim()}
        else{answers[key]=inp.value.trim()}
      }
    });
    apiCall('submitAnswers',{teamId:currentVaultTeam.id,answers:answers}).then(r=>{
      if(r.ok){/* submission saved */}
      else{/* submission save failed */}
    });
  }
}

