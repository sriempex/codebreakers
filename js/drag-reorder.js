// ══════ LANDING PAGE PREVIEW ══════
function previewLandingPage(){
  _previewReturnPanel='appearancePanel';
  closeAppearancePanel();
  // Use proper screen switching
  showScreen('landingScreen');
  // Show preview banner
  document.getElementById('landingPreviewOverlay').classList.add('active');
  // Set landing tab as active
  document.querySelectorAll('.lp-preview-nav').forEach((b,i)=>b.classList.toggle('active',i===0));
  // Add preview mode class to hide admin controls
  document.body.classList.add('landing-preview-mode');
  // Hide logout btn during preview
  const lb=document.getElementById('logoutBtn');if(lb)lb.classList.remove('visible');
}
function closeLandingPreview(){
  document.getElementById('landingPreviewOverlay').classList.remove('active');
  document.body.classList.remove('landing-preview-mode');
  showScreen('consoleScreen');
  document.getElementById('notepadTrigger').classList.add('visible');
  // Reset login screen
  resetLoginScreen();
  // Reset reg form
  const regForm=document.getElementById('regForm');if(regForm)regForm.style.display='';
  const regSuccess=document.getElementById('regSuccess');if(regSuccess)regSuccess.style.display='none';
  const regBtnRow=document.getElementById('regBtnRow');if(regBtnRow)regBtnRow.style.display='';
  const regBtn=document.getElementById('regSubmitBtn');
  if(regBtn){const s=regBtn.querySelector('span');if(s)s.textContent='REGISTER';regBtn.style.opacity='';regBtn.style.pointerEvents=''}
  // Return to the panel that launched preview
  if(_previewReturnPanel){setTimeout(()=>openAppearancePanel(),120);_previewReturnPanel=null}
}
function previewNav(screenId,btn){
  showScreen(screenId);
  document.querySelectorAll('.lp-preview-nav').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
}

// ══════ DRAG-TO-REORDER ══════
let _drag={active:false,type:null,fromIdx:null,ghost:null,overIdx:null};

function startDrag(e,type,idx){
  e.preventDefault();e.stopPropagation();
  const target=e.target.closest(type==='feed'?'.feed-card':'.media-exp-item');
  if(!target)return;

  _drag={active:true,type,fromIdx:idx,ghost:null,overIdx:null};

  // Create ghost
  const rect=target.getBoundingClientRect();
  const ghost=target.cloneNode(true);
  ghost.className='drag-ghost';
  ghost.style.width=rect.width+'px';
  ghost.style.height=rect.height+'px';
  ghost.style.left=rect.left+'px';
  ghost.style.top=rect.top+'px';
  document.body.appendChild(ghost);
  _drag.ghost=ghost;

  // Mark source as dragging
  target.classList.add('dragging');

  const offsetX=e.clientX-rect.left;
  const offsetY=e.clientY-rect.top;

  function onMove(ev){
    const cx=ev.clientX||ev.touches?.[0]?.clientX||0;
    const cy=ev.clientY||ev.touches?.[0]?.clientY||0;
    ghost.style.left=(cx-offsetX)+'px';
    ghost.style.top=(cy-offsetY)+'px';

    // Find drop target
    ghost.style.display='none';
    const el=document.elementFromPoint(cx,cy);
    ghost.style.display='';

    const selector=type==='feed'?'.feed-card[data-idx]':'.media-exp-item[data-idx]';
    const items=document.querySelectorAll(selector);
    items.forEach(it=>it.classList.remove('drag-over'));

    if(el){
      const dropTarget=el.closest(selector);
      if(dropTarget){
        const dropIdx=parseInt(dropTarget.dataset.idx);
        if(!isNaN(dropIdx)&&dropIdx!==idx){
          dropTarget.classList.add('drag-over');
          _drag.overIdx=dropIdx;
        }
      }
    }
  }

  function onEnd(){
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onEnd);
    window.removeEventListener('pointercancel',onEnd);

    if(ghost)ghost.remove();

    // Clear all visual states
    const selector=_drag.type==='feed'?'.feed-card':'.media-exp-item';
    document.querySelectorAll(selector).forEach(el=>{
      el.classList.remove('dragging','drag-over');
    });

    // Perform reorder
    if(_drag.overIdx!==null&&_drag.overIdx!==_drag.fromIdx){
      const arr=_drag.type==='feed'?posts:mediaItems;
      const from=_drag.fromIdx;
      const to=_drag.overIdx;
      const item=arr.splice(from,1)[0];
      arr.splice(to,0,item);

      if(_drag.type==='feed'){
        renderFeed();renderGrid();saveFeedPostsToBackend();
      }else{
        syncVaultCodesFromMedia();renderMedia();renderGrid();renderVaultPanel();renderKeysCodes();saveMediaItemsToBackend();
      }
    }

    _drag={active:false,type:null,fromIdx:null,ghost:null,overIdx:null};
  }

  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onEnd);
  window.addEventListener('pointercancel',onEnd);
}

