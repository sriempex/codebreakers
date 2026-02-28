// ══════ MEDIA VIEWER ══════
let currentMediaIdx=0;
let mvAudio=null;
let mvAudioInterval=null;

function openMediaViewer(i){
  const m=mediaItems[i];
  // Block vault-locked items for non-admin users
  const isAdmin=document.body.classList.contains('admin-mode')&&!document.body.classList.contains('player-preview');
  if(!isAdmin&&m.vaultLocked&&!_isMediaVisibleToPlayer(i)) return;
  if(m._isNew){m._isNew=false;renderMedia()}
  if(m.type==='locked'&&!m.unlocked){renderLockedView(i);showViewer(i);return}
  currentMediaIdx=i;
  showViewer(i);
  renderMediaContent(m);
}

function showViewer(i){
  currentMediaIdx=i;
  const m=mediaItems[i];
  document.getElementById('mvIcon').textContent=m.icon;
  document.getElementById('mvName').textContent=m.name;
  document.getElementById('mvDesc').textContent=m.desc;
  const badge=document.getElementById('mvBadge');
  badge.textContent=m.type;badge.className='mv-badge '+m.type;
  document.getElementById('mvCounter').textContent=((function(){const v=_getVisibleMediaIndices();const p=v.indexOf(i);return p===-1?(i+1)+' / '+mediaItems.length:(p+1)+' / '+v.length})());
  // Download button: only show if admin enabled downloads and file exists
  const dlBtn=document.getElementById('mvDownload');
  dlBtn.style.display=(allowDownloads&&m.fileUrl)?'':'none';
  document.getElementById('mediaViewer').classList.add('active');
  if(window._histPush)window._histPush('mediaViewer');
}

function downloadCurrentMedia(){
  const m=mediaItems[currentMediaIdx];
  if(!m.fileUrl||!allowDownloads)return;
  const eu=convertDriveUrl(m.fileUrl);
  const a=document.createElement('a');
  a.href=eu.direct;a.download=m.name;a.target='_blank';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}

function _resetZoomCursor(){
  try{
    document.body.style.cursor='default';
    // Clear any stuck zoom classes/cursors in viewers
    document.querySelectorAll('.mv-image-viewer.zoomed').forEach(el=>el.classList.remove('zoomed'));
    document.querySelectorAll('.feed-single-img.zoomed').forEach(el=>{el.classList.remove('zoomed'); el.classList.remove('dragging');});
    // Remove any inline cursor styles that may have been applied
    document.querySelectorAll('[style*="cursor"]').forEach(el=>{
      if(el && el.style && el.style.cursor && (el.style.cursor.includes('zoom')||el.style.cursor==='grab'||el.style.cursor==='grabbing'||el.style.cursor==='pointer')) el.style.cursor='';
    });
    // Next tick: fully release cursor to stylesheet defaults
    setTimeout(()=>{try{document.body.style.cursor='';}catch(e){}},0);
  }catch(e){}
}

function _forceCursorKill(){
  try{
    const de=document.documentElement, b=document.body;
    if(de)de.classList.add('cursor-kill');
    if(b)b.classList.add('cursor-kill');
    // Clear any inline cursor too
    if(de)de.style.cursor='auto';
    if(b)b.style.cursor='auto';
    // Remove after a generous delay to ensure browser flushes cursor cache
    setTimeout(()=>{
      try{ if(de){de.classList.remove('cursor-kill');de.style.cursor='';} }catch(e){}
      try{ if(b){b.classList.remove('cursor-kill');b.style.cursor='';} }catch(e){}
    },80);
  }catch(e){}
}



function closeMediaViewer(){
  document.getElementById('mediaViewer').classList.remove('active');
  stopMvAudio();
  // Stop any video
  const vid=document.querySelector('.mv-video');
  if(vid)vid.pause();
  // Clear body content so cursor:pointer elements don't leak into DOM after close
  const mvBody=document.getElementById('mvBody');
  if(mvBody)mvBody.innerHTML='';
  _resetZoomCursor();
  _forceCursorKill();
}

// Cursor watchdog — if any zoom/grab cursor leaks outside the viewer, force reset.
// Uses COMPUTED cursor (not just inline styles) because the stuck cursor symptom is often coming
// from computed :hover state caching in some browsers.
(function(){
  let lastKill=0;
  function shouldKill(cur){
    return !!cur && (cur.indexOf('zoom')>-1 || cur==='grab' || cur==='grabbing');
  }
  document.addEventListener('mousemove',function(e){
    try{
      const mv=document.getElementById('mediaViewer');
      if(mv && mv.classList.contains('active')) return;

      const t=e && e.target ? e.target : document.elementFromPoint(e.clientX,e.clientY);
      if(!t) return;

      const cur=getComputedStyle(t).cursor || '';
      if(shouldKill(cur)){
        const now=Date.now();
        if(now-lastKill>120){ // throttle
          lastKill=now;
          _resetZoomCursor();
          _forceCursorKill();
        }
      }
    }catch(err){}
  },{passive:true});

  // Also run once on pointer up (touch end) to clear any cached cursor state after taps
  document.addEventListener('pointerup',function(){
    try{
      const mv=document.getElementById('mediaViewer');
      if(mv && mv.classList.contains('active')) return;
      _forceCursorKill();
    }catch(e){}
  },{passive:true});
})();


function _isMediaVisibleToPlayer(idx){
  const m=mediaItems[idx];
  if(!m) return false;
  if(!m.vaultLocked) return true;
  // Vault-locked items are visible only if their vault code has been unlocked
  return !!vaultCodes.find(c=>c.linkedMediaIdx===idx&&c.unlocked);
}
function _getVisibleMediaIndices(){
  const isAdmin=document.body.classList.contains('admin-mode')&&!document.body.classList.contains('player-preview');
  if(isAdmin) return mediaItems.map((_,i)=>i);
  return mediaItems.map((_,i)=>i).filter(i=>_isMediaVisibleToPlayer(i));
}
function navMedia(d){
  stopMvAudio();
  const vid=document.querySelector('.mv-video');if(vid)vid.pause();
  const visible=_getVisibleMediaIndices();
  if(!visible.length) return;
  const curPos=visible.indexOf(currentMediaIdx);
  // If current item isn't in visible list (edge case), jump to first visible
  const nextPos=curPos===-1?0:(curPos+d+visible.length)%visible.length;
  currentMediaIdx=visible[nextPos];
  const m=mediaItems[currentMediaIdx];
  showViewer(currentMediaIdx);
  if(m.type==='locked'&&!m.unlocked)renderLockedView(currentMediaIdx);
  else renderMediaContent(m);
}

function renderMediaContent(m){
  const body=document.getElementById('mvBody');
  const url=m.fileUrl||'';

  if(!url){
    body.innerHTML=`<div class="mv-no-file"><div class="mv-no-file-icon">${m.icon}</div><div class="mv-no-file-text">No file attached — add a URL via admin edit</div></div>`;
    return;
  }

  // Base64 or blob URLs can't be embedded in iframes — offer download/open
  if(url.startsWith('data:')||url.startsWith('blob:')){
    const isImage=url.startsWith('data:image')||isImageUrl(url);
    if(isImage){
      body.innerHTML=`<img class="mv-image-viewer" src="${url}" alt="${m.name}" onclick="this.classList.toggle('zoomed')">`;
    }else{
      body.innerHTML=`<div class="mv-no-file"><div class="mv-no-file-icon">${m.icon}</div><div class="mv-no-file-text">File uploaded locally — cannot preview in viewer.${allowDownloads?`<br><br><a href="${url}" download="${m.name||'file'}" style="color:var(--cyan);text-decoration:underline;font-size:11px;letter-spacing:1px">⬇ DOWNLOAD FILE</a>`:''}<br><br><span style="font-size:9px;color:#555">For persistent hosting, upload to Google Drive and paste the share link.</span></div></div>`;
    }
    return;
  }

  // Google Drive URL conversion for embedding
  const embedUrl=convertDriveUrl(url);

  switch(m.type){
    case 'audio':
      renderAudioPlayer(body,m,embedUrl.direct||url);break;
    case 'video':
      renderVideoPlayer(body,m,embedUrl);break;
    case 'doc':
    case 'map':
      renderDocViewer(body,m,url,embedUrl);break;
    case 'locked':
      if(m.unlocked)renderDocViewer(body,m,url,embedUrl);
      else renderLockedView(currentMediaIdx);break;
    default:
      renderDocViewer(body,m,url,embedUrl);
  }
}

// Resolve file URL — all media hosted on Netlify, pass through directly
function convertDriveUrl(url){
  if(!url)return{preview:url,direct:url,id:null};
  // Extract Google Drive file ID from any Drive URL format
  let id=null;
  const patterns=[
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/thumbnail\?.*id=([a-zA-Z0-9_-]+)/
  ];
  for(const p of patterns){const m=url.match(p);if(m){id=m[1];break}}
  if(!id)return{preview:url,direct:url,id:null};
  return{
    id:id,
    direct:'https://drive.google.com/uc?export=view&id='+id,
    preview:'https://drive.google.com/file/d/'+id+'/preview',
    thumbnail:'https://drive.google.com/thumbnail?id='+id+'&sz=w400',
    download:'https://drive.google.com/uc?export=download&id='+id
  };
}

function isDriveUrl(url){return url&&/drive\.google\.com/i.test(url)}
function isImageUrl(url){return/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)||/drive\.google\.com\/(uc|thumbnail)/i.test(url)}
function isPdfUrl(url){return/\.pdf(\?|$)/i.test(url)||url.includes('/preview')}

function isMobileDevice(){
  try{
    const ua=navigator.userAgent||'';
    const touch=(('ontouchstart' in window) || (navigator.maxTouchPoints||0)>0);
    const small=(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
    return (small && (touch || /Mobi|Android|iPhone|iPad|iPod/i.test(ua)));
  }catch(e){
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
  }
}

let _mvPdfScale=1.25;
async function renderPdfJsViewer(body,pdfUrl,opts={}){
  const downloadUrl=opts.downloadUrl||pdfUrl;
  body.innerHTML=`
    <div class="mv-pdfjs-wrap">
      <div class="mv-pdfjs-toolbar">
        <button class="mv-pdfjs-btn" id="mvPdfZoomOut">ZOOM -</button>
        <button class="mv-pdfjs-btn" id="mvPdfZoomIn">ZOOM +</button>
        <a class="mv-pdfjs-btn" href="${downloadUrl}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center">OPEN</a>
        ${allowDownloads?`<a class="mv-pdfjs-btn" href="${downloadUrl}" download target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center">DOWNLOAD</a>`:''}
      </div>
      <div id="mvPdfPages"></div>
      <div class="mv-pdfjs-status" id="mvPdfStatus">Loading PDF…</div>
    </div>`;
  const pagesEl=document.getElementById('mvPdfPages');
  const statusEl=document.getElementById('mvPdfStatus');

  if(!window.pdfjsLib){
    statusEl.textContent='PDF preview unavailable (PDF.js not loaded). Use OPEN to view.';
    return;
  }

  const renderAll=async(scale)=>{
    pagesEl.innerHTML='';
    statusEl.textContent='Rendering…';
    const loadingTask=pdfjsLib.getDocument({url: pdfUrl, withCredentials:false});
    const pdf=await loadingTask.promise;
    const num=pdf.numPages;

    for(let i=1;i<=num;i++){
      const page=await pdf.getPage(i);
      const viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{alpha:false});
      canvas.width=Math.floor(viewport.width);
      canvas.height=Math.floor(viewport.height);
      const wrap=document.createElement('div');
      wrap.className='mv-pdfjs-page';
      wrap.appendChild(canvas);
      pagesEl.appendChild(wrap);
      await page.render({canvasContext:ctx,viewport}).promise;
    }
    statusEl.textContent=`${num} page${num===1?'':'s'} loaded.`;
  };

  let scale=_mvPdfScale;
  const safeRender=async()=>{
    try{ await renderAll(scale); }
    catch(err){
      console.warn('PDF.js render failed',err);
      statusEl.textContent='Could not render PDF in-app (likely CORS or browser restrictions). Use OPEN to view.';
    }
  };

  const zin=document.getElementById('mvPdfZoomIn');
  const zout=document.getElementById('mvPdfZoomOut');
  if(zin) zin.onclick=()=>{scale=Math.min(3,scale+0.25); safeRender();};
  if(zout) zout.onclick=()=>{scale=Math.max(0.75,scale-0.25); safeRender();};

  await safeRender();
}


// ── Audio Player ──
function renderAudioPlayer(body,m,url){
  body.innerHTML=`
    <div class="mv-audio-player">
      <div class="mv-audio-icon">🎧</div>
      <div class="mv-audio-title">${m.name}</div>
      <div class="mv-audio-controls">
        <div class="mv-audio-bar-wrap" id="mvAudioBarWrap" onclick="seekAudio(event)">
          <div class="mv-audio-bar" id="mvAudioBar"></div>
        </div>
        <div class="mv-audio-time"><span id="mvAudioCur">0:00</span><span id="mvAudioDur">0:00</span></div>
        <div class="mv-audio-btns">
          <div class="mv-audio-btn" onclick="skipAudio(-10)" title="Back 10s">⏪</div>
          <div class="mv-audio-btn" id="mvPlayBtn" onclick="toggleMvAudio()" title="Play/Pause">▶</div>
          <div class="mv-audio-btn" onclick="skipAudio(10)" title="Forward 10s">⏩</div>
        </div>
        <div class="mv-audio-vol">
          <span class="mv-audio-vol-icon" onclick="toggleMvMute()">🔊</span>
          <div class="mv-audio-vol-bar" onclick="setMvVolume(event)"><div class="mv-audio-vol-fill" id="mvVolFill"></div></div>
        </div>
      </div>
    </div>`;
  mvAudio=new Audio(url);
  mvAudio.addEventListener('loadedmetadata',()=>{document.getElementById('mvAudioDur').textContent=fmtTime(mvAudio.duration)});
  mvAudio.addEventListener('ended',()=>{
    document.getElementById('mvPlayBtn').textContent='▶';
    document.getElementById('mvPlayBtn').classList.remove('playing');
    clearInterval(mvAudioInterval);
  });
}

function toggleMvAudio(){
  if(!mvAudio)return;
  const btn=document.getElementById('mvPlayBtn');
  if(mvAudio.paused){
    mvAudio.play();btn.textContent='⏸';btn.classList.add('playing');
    mvAudioInterval=setInterval(updateAudioProgress,100);
  }else{
    mvAudio.pause();btn.textContent='▶';btn.classList.remove('playing');
    clearInterval(mvAudioInterval);
  }
}

function updateAudioProgress(){
  if(!mvAudio)return;
  const pct=(mvAudio.currentTime/mvAudio.duration)*100;
  const bar=document.getElementById('mvAudioBar');if(bar)bar.style.width=pct+'%';
  const cur=document.getElementById('mvAudioCur');if(cur)cur.textContent=fmtTime(mvAudio.currentTime);
}

function seekAudio(e){
  if(!mvAudio||!mvAudio.duration)return;
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=(e.clientX-rect.left)/rect.width;
  mvAudio.currentTime=pct*mvAudio.duration;
  updateAudioProgress();
}

function skipAudio(s){if(mvAudio)mvAudio.currentTime=Math.max(0,Math.min(mvAudio.duration,mvAudio.currentTime+s));updateAudioProgress()}

function setMvVolume(e){
  if(!mvAudio)return;
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  mvAudio.volume=pct;
  document.getElementById('mvVolFill').style.width=(pct*100)+'%';
}

function toggleMvMute(){
  if(!mvAudio)return;
  mvAudio.muted=!mvAudio.muted;
  document.querySelector('.mv-audio-vol-icon').textContent=mvAudio.muted?'🔇':'🔊';
}

function stopMvAudio(){
  if(mvAudio){mvAudio.pause();mvAudio.currentTime=0;mvAudio=null}
  if(mvAudioInterval){clearInterval(mvAudioInterval);mvAudioInterval=null}
}

function fmtTime(s){if(!s||isNaN(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}

// ── Video Player ──
function renderVideoPlayer(body,m,eu){
  const url=m.fileUrl||'';
  const resolved=resolveVideoEmbed(url);
  
  if(resolved&&resolved.type==='direct'){
    // Direct video file — use custom player
    const src=eu.direct||eu.preview||resolved.url;
    body.innerHTML=`
      <div class="mv-video-wrap">
        <video class="mv-video" id="mvVideo" src="${src}" preload="metadata"></video>
        <div class="mv-video-controls">
          <div class="mv-video-play" id="mvVidPlay" onclick="toggleMvVideo()">▶</div>
          <div class="mv-video-bar" onclick="seekVideo(event)"><div class="mv-video-progress" id="mvVidProgress"></div></div>
          <span class="mv-video-time" id="mvVidTime">0:00</span>
          <span class="mv-video-full" onclick="fullscreenVideo()" title="Fullscreen">⛶</span>
        </div>
      </div>`;
    const vid=document.getElementById('mvVideo');
    vid.addEventListener('timeupdate',()=>{
      const pct=(vid.currentTime/vid.duration)*100;
      document.getElementById('mvVidProgress').style.width=pct+'%';
      document.getElementById('mvVidTime').textContent=fmtTime(vid.currentTime)+' / '+fmtTime(vid.duration);
    });
    vid.addEventListener('ended',()=>{document.getElementById('mvVidPlay').textContent='▶'});
    vid.addEventListener('click',toggleMvVideo);
  }else if(resolved&&resolved.type==='external'){
    // Non-embeddable platform
    body.innerHTML=`<div class="mv-video-wrap" style="display:flex;align-items:center;justify-content:center">${buildExternalLink(resolved)}</div>`;
  }else if(resolved&&(resolved.embed||resolved.type==='iframe-fallback')){
    // Embeddable platform — iframe
    body.innerHTML=`<div class="mv-video-wrap">${buildEmbedIframe(resolved,false,false)}</div>`;
  }else{
    // Fallback: try Google Drive preview (legacy behavior)
    const src=eu.direct||eu.preview;
    body.innerHTML=`
      <div class="mv-video-wrap">
        <video class="mv-video" id="mvVideo" src="${src}" preload="metadata"></video>
        <div class="mv-video-controls">
          <div class="mv-video-play" id="mvVidPlay" onclick="toggleMvVideo()">▶</div>
          <div class="mv-video-bar" onclick="seekVideo(event)"><div class="mv-video-progress" id="mvVidProgress"></div></div>
          <span class="mv-video-time" id="mvVidTime">0:00</span>
          <span class="mv-video-full" onclick="fullscreenVideo()" title="Fullscreen">⛶</span>
        </div>
      </div>`;
    const vid=document.getElementById('mvVideo');
    if(vid){
      vid.addEventListener('timeupdate',()=>{
        const pct=(vid.currentTime/vid.duration)*100;
        document.getElementById('mvVidProgress').style.width=pct+'%';
        document.getElementById('mvVidTime').textContent=fmtTime(vid.currentTime)+' / '+fmtTime(vid.duration);
      });
      vid.addEventListener('ended',()=>{document.getElementById('mvVidPlay').textContent='▶'});
      vid.addEventListener('click',toggleMvVideo);
    }
  }
}

function toggleMvVideo(){
  const vid=document.getElementById('mvVideo');if(!vid)return;
  const btn=document.getElementById('mvVidPlay');
  if(vid.paused){vid.play();btn.textContent='⏸'}else{vid.pause();btn.textContent='▶'}
}

function seekVideo(e){
  const vid=document.getElementById('mvVideo');if(!vid||!vid.duration)return;
  const rect=e.currentTarget.getBoundingClientRect();
  vid.currentTime=(e.clientX-rect.left)/rect.width*vid.duration;
}

function fullscreenVideo(){
  const vid=document.getElementById('mvVideo');if(!vid)return;
  if(vid.requestFullscreen)vid.requestFullscreen();
  else if(vid.webkitRequestFullscreen)vid.webkitRequestFullscreen();
}

// ── Document / Map / PDF Viewer ──
function isOfficeDoc(url){return/\.(docx?|xlsx?|pptx?|csv)(\?|$)/i.test(url)}
function renderDocViewer(body,m,url,eu){
  const isDrive=!!eu.id;
  const isR2=url.includes('.workers.dev/file/');
  // Images
  if(isImageUrl(url)||(m.type==='map'&&(isImageUrl(url)||isDrive))){
    const src=isDrive?eu.direct:url;
    body.innerHTML=`<img class="mv-image-viewer" src="${src}" alt="${m.name}" onclick="this.classList.toggle('zoomed')" onerror="this.onerror=null;this.src='${isDrive?eu.thumbnail:url}'">`;
    return;
  }
  // Google Drive files: use /preview
  if(isDrive){
    body.innerHTML=`<iframe class="mv-pdf-frame" src="${eu.preview}" allow="autoplay" allowfullscreen></iframe>${allowDownloads?`<div style="text-align:center;margin-top:8px"><a href="${eu.download}" target="_blank" style="color:var(--cyan);font-family:\'Saira\',sans-serif;font-size:10px;letter-spacing:1.5px;text-decoration:none;opacity:.7">DOWNLOAD ORIGINAL</a></div>`:''}`;
    return;
  }
  // R2 files: serve directly in iframe (PDFs render natively, images via img)
  if(isR2){
    // On mobile, render PDFs in-app via PDF.js (iframes are unreliable on iOS Safari).
    if(isMobileDevice() && isPdfUrl(url)){
      renderPdfJsViewer(body,url,{downloadUrl:url});
      return;
    }
    const pdfBlock=(!allowDownloads&&url.match(/\.pdf/i))?'#toolbar=0&navpanes=0':'';
    body.innerHTML=`<iframe class="mv-pdf-frame" src="${url}${pdfBlock}" allowfullscreen></iframe>${allowDownloads?`<div style="text-align:center;margin-top:8px"><a href="${url}" download target="_blank" style="color:var(--cyan);font-family:\'Saira\',sans-serif;font-size:10px;letter-spacing:1.5px;text-decoration:none;opacity:.7">DOWNLOAD ORIGINAL</a></div>`:''}`;
    return;
  }
  // Office docs (non-Drive, non-R2)
  if(isOfficeDoc(url)){
    const officeUrl='https://view.officeapps.live.com/op/embed.aspx?src='+encodeURIComponent(url);
    body.innerHTML=`<iframe class="mv-pdf-frame" src="${officeUrl}" allowfullscreen></iframe>`;
    return;
  }
  // PDFs (non-Drive, non-R2)
  if(isPdfUrl(url)){
    // On mobile, render PDFs in-app via PDF.js (iframes are unreliable on iOS Safari).
    if(isMobileDevice()){
      renderPdfJsViewer(body,url,{downloadUrl:url});
      return;
    }
    const pdfBlock2=(!allowDownloads)?'#toolbar=0&navpanes=0':'';
    body.innerHTML=`<iframe class="mv-pdf-frame" src="${url}${pdfBlock2}" allowfullscreen></iframe>`;
    return;
  }
  // Fallback
  body.innerHTML=`<iframe class="mv-pdf-frame" src="${url}" allowfullscreen></iframe>${allowDownloads?`<div style="text-align:center;margin-top:8px"><a href="${url}" target="_blank" style="color:var(--cyan);font-family:\'Saira\',sans-serif;font-size:10px;letter-spacing:1.5px;text-decoration:none;opacity:.7">OPEN IN NEW TAB</a></div>`:''}`;
}
function renderLockedView(i){
  const m=mediaItems[i];
  const body=document.getElementById('mvBody');
  body.innerHTML=`
    <div class="mv-locked">
      <div class="mv-locked-icon">🔒</div>
      <div class="mv-locked-title">Encrypted File</div>
      <div class="mv-locked-desc">${m.desc}<br><br>Enter the decryption key to access this file.</div>
      <div class="mv-locked-input-wrap">
        <input class="mv-locked-input" id="mvLockKey" placeholder="ENTER KEY" autocomplete="off" spellcheck="false" onkeydown="if(event.key==='Enter')tryUnlock(${i})">
        <button class="mv-locked-submit" onclick="tryUnlock(${i})">DECRYPT</button>
      </div>
      <div id="mvLockErr" style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--red);letter-spacing:1px;height:16px"></div>
    </div>`;
}

function tryUnlock(i){
  const m=mediaItems[i];
  const key=document.getElementById('mvLockKey').value.trim();
  // Admin can set an unlock key on each locked item (default: any non-empty input unlocks for demo)
  if(!key){document.getElementById('mvLockErr').textContent='Enter a decryption key';return}
  if(m.unlockKey&&key.toUpperCase()!==m.unlockKey.toUpperCase()){
    document.getElementById('mvLockErr').textContent='✗ INVALID KEY — ACCESS DENIED';
    playDenied();return;
  }
  m.unlocked=true;
  playSuccess();
  if(m.fileUrl)renderMediaContent(m);
  else document.getElementById('mvBody').innerHTML=`<div class="mv-no-file"><div class="mv-no-file-icon">🔓</div><div class="mv-no-file-text">File decrypted — no file attached yet</div></div>`;
  renderMedia();
}

