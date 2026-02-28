// ══════ VIDEO EMBED RESOLVER ══════
function resolveVideoEmbed(url){
  if(!url)return null;
  const u=url.trim();
  // 1. Direct video file
  if(/\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(u))return{type:'direct',url:u};
  // 2. YouTube
  const yt=u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(yt)return{type:'youtube',id:yt[1],embed:`https://www.youtube-nocookie.com/embed/${yt[1]}`,thumb:`https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`};
  // 3. Vimeo
  const vm=u.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if(vm)return{type:'vimeo',id:vm[1],embed:`https://player.vimeo.com/video/${vm[1]}`,thumb:null};
  // 4. Google Drive
  const gd=u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if(gd)return{type:'gdrive',id:gd[1],embed:`https://drive.google.com/file/d/${gd[1]}/preview`,thumb:`https://drive.google.com/thumbnail?id=${gd[1]}&sz=w400`};
  // 5. Dailymotion
  const dm=u.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
  if(dm)return{type:'dailymotion',id:dm[1],embed:`https://www.dailymotion.com/embed/video/${dm[1]}`,thumb:`https://www.dailymotion.com/thumbnail/video/${dm[1]}`};
  // 6. Streamable
  const st=u.match(/streamable\.com\/([a-zA-Z0-9]+)/);
  if(st)return{type:'streamable',id:st[1],embed:`https://streamable.com/e/${st[1]}`,thumb:null};
  // 7. Loom
  const lm=u.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if(lm)return{type:'loom',id:lm[1],embed:`https://www.loom.com/embed/${lm[1]}`,thumb:null};
  // 8. Facebook video (limited embed support)
  if(/facebook\.com\/.*\/videos\/|fb\.watch/i.test(u))return{type:'external',url:u,label:'Facebook Video'};
  // 9. TikTok (no iframe support)
  if(/tiktok\.com/i.test(u))return{type:'external',url:u,label:'TikTok'};
  // 10. Instagram (no iframe support)
  if(/instagram\.com\/(reel|p)\//i.test(u))return{type:'external',url:u,label:'Instagram'};
  // 11. Twitter/X video (no iframe support)
  if(/(twitter\.com|x\.com)\/.*\/status\//i.test(u))return{type:'external',url:u,label:'X (Twitter)'};
  // 12. Generic URL — try iframe as last resort
  return{type:'iframe-fallback',url:u,thumb:null};
}
function buildEmbedIframe(resolved,autoplay,muted){
  const mutedParam=muted?1:0;
  let src=resolved.embed||resolved.url;
  // Add autoplay/mute params per platform
  if(resolved.type==='youtube')src+=`?autoplay=${autoplay?1:0}&mute=${mutedParam}&loop=1&playlist=${resolved.id}&rel=0&modestbranding=1&iv_load_policy=3&disablekb=0&fs=1&controls=1`;
  else if(resolved.type==='vimeo')src+=`?autoplay=${autoplay?1:0}&muted=${mutedParam}&loop=1`;
  else if(resolved.type==='dailymotion')src+=`?autoplay=${autoplay?1:0}&mute=${mutedParam}`;
  else if(resolved.type==='loom')src+=`?autoplay=${autoplay?1:0}`;
  return `<iframe src="${src}" style="width:100%;height:100%;border:none" allow="autoplay;encrypted-media;fullscreen" allowfullscreen></iframe>`;
}
function buildVideoThumbnail(resolved){
  if(resolved.thumb)return `<img src="${resolved.thumb}" style="width:100%;height:100%;object-fit:cover"><div class="feed-video-badge">▶ VIDEO</div>`;
  // For platforms without thumbnails, show a styled placeholder
  const label=resolved.type==='external'?resolved.label:resolved.type.toUpperCase();
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0c12;gap:6px"><span style="font-size:32px;opacity:.5">▶</span><span style="font-family:IBM Plex Mono,monospace;font-size:8px;color:#555;letter-spacing:2px">${label}</span></div><div class="feed-video-badge">▶ VIDEO</div>`;
}
function buildExternalLink(resolved,editBtn){
  const label=resolved.label||'Video';
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0c12;gap:12px">
    <span style="font-size:40px;opacity:.4">▶</span>
    <span style="font-family:Chakra Petch,sans-serif;font-size:12px;color:#888;letter-spacing:1px">${label}</span>
    <a href="${resolved.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-family:IBM Plex Mono,monospace;font-size:10px;color:var(--cyan);letter-spacing:1px;padding:8px 16px;border:1px solid rgba(0,212,255,.3);border-radius:4px;background:rgba(0,212,255,.06);text-decoration:none;transition:all .2s">Open in ${label} ↗</a>
    <span style="font-family:IBM Plex Mono,monospace;font-size:8px;color:#444;letter-spacing:1px">This platform does not support inline playback</span>
  </div>${editBtn||''}`; 
}
function toggleFeedMute(){
  const muted=isPostMuted(currentPost);
  const newMuted=!muted;
  postMuteState[currentPost]=newMuted;
  feedMuted=newMuted; // Also update global default for new videos
  const vid=document.getElementById('feedSingleVid');
  if(vid)vid.muted=newMuted;
  const btn=document.querySelector('.feed-mute-btn');
  if(btn)btn.textContent=newMuted?'🔇':'🔊';
  // For iframes, need to re-render to apply mute change
  const iframe=document.querySelector('#singleImg iframe');
  if(iframe)renderSinglePost();
}
function navPost(d){currentPost=(currentPost+d+posts.length)%posts.length;resetFeedZoom();renderSinglePost();saveSession()}

// ══════ FEED ZOOM + SWIPE (Unified Interaction Engine) ══════
const feedZoom = {scale:1, x:0, y:0, minScale:1, maxScale:5};

function getFeedZoomWrap(){return document.getElementById('feedZoomWrap')}
function getFeedContainer(){return document.getElementById('singleImg')}
function isZoomablePost(){return !!getFeedZoomWrap()}

function applyFeedZoom(){
  const w=getFeedZoomWrap();if(!w)return;
  w.style.transform=`translate(${feedZoom.x}px,${feedZoom.y}px) scale(${feedZoom.scale})`;
  const c=getFeedContainer();
  if(c){
    if(feedZoom.scale>1.01){c.classList.add('zoomed')}
    else{c.classList.remove('zoomed','dragging')}
  }
}

function clampFeedPan(){
  const c=getFeedContainer();if(!c)return;
  const cw=c.clientWidth, ch=c.clientHeight;
  const sw=cw*feedZoom.scale, sh=ch*feedZoom.scale;
  if(sw<=cw){feedZoom.x=(cw-sw)/2}else{feedZoom.x=Math.min(0,Math.max(cw-sw,feedZoom.x))}
  if(sh<=ch){feedZoom.y=(ch-sh)/2}else{feedZoom.y=Math.min(0,Math.max(ch-sh,feedZoom.y))}
}

function feedZoomTo(cx, cy, newScale){
  const c=getFeedContainer();if(!c)return;
  const rect=c.getBoundingClientRect();
  const px=cx-rect.left, py=cy-rect.top;
  const old=feedZoom.scale;
  feedZoom.scale=Math.min(feedZoom.maxScale,Math.max(feedZoom.minScale,newScale));
  feedZoom.x=px-(px-feedZoom.x)*(feedZoom.scale/old);
  feedZoom.y=py-(py-feedZoom.y)*(feedZoom.scale/old);
  clampFeedPan();applyFeedZoom();
}

function resetFeedZoom(){
  feedZoom.scale=1;feedZoom.x=0;feedZoom.y=0;
  const c=getFeedContainer();if(c){c.classList.remove('zoomed','dragging')}
  const w=getFeedZoomWrap();if(w)w.style.transform='';
}

// ── Unified mouse handler ──
(function(){
  const el=document.getElementById('singleImg');if(!el)return;
  let mDown=false, mMoved=false, mStartX=0, mStartY=0, mPanStartX=0, mPanStartY=0, mSwipeDx=0;

  el.addEventListener('mousedown',function(e){
    if(e.target.closest('.feed-mute-btn')||e.target.closest('.feed-single-edit')||e.target.tagName==='VIDEO'||e.target.tagName==='IFRAME')return;
    mDown=true; mMoved=false; mStartX=e.clientX; mStartY=e.clientY; mSwipeDx=0;
    mPanStartX=feedZoom.x; mPanStartY=feedZoom.y;
    if(feedZoom.scale>1.01) el.classList.add('dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove',function(e){
    if(!mDown)return;
    const dx=e.clientX-mStartX, dy=e.clientY-mStartY;
    if(Math.abs(dx)>3||Math.abs(dy)>3) mMoved=true;
    if(!mMoved)return;

    if(feedZoom.scale>1.01){
      // Panning zoomed image
      feedZoom.x=mPanStartX+dx;
      feedZoom.y=mPanStartY+dy;
      clampFeedPan();applyFeedZoom();
    } else {
      // Swiping between posts
      mSwipeDx=dx;
      el.style.transform=`translateX(${dx*.4}px)`;
      el.style.opacity=1-Math.abs(dx)/600;
    }
  });

  window.addEventListener('mouseup',function(){
    if(!mDown)return; mDown=false;
    el.classList.remove('dragging');

    if(!mMoved && isZoomablePost()){
      // Click — toggle zoom
      if(feedZoom.scale>1.01){
        resetFeedZoom();
      }else{
        // Zoom to 2.5x centered on click
        feedZoom.scale=2.5;
        const c=getFeedContainer();
        if(c){feedZoom.x=(c.clientWidth*(1-2.5))/2;feedZoom.y=(c.clientHeight*(1-2.5))/2}
        clampFeedPan();applyFeedZoom();
      }
    } else if(feedZoom.scale<=1.01 && Math.abs(mSwipeDx)>50){
      // Swipe navigation
      const dir=mSwipeDx>0?-1:1;
      el.style.transition='transform .2s,opacity .2s';
      el.style.transform=`translateX(${mSwipeDx>0?'100px':'-100px'})`;el.style.opacity='0';
      setTimeout(()=>{
        navPost(dir);
        el.style.transition='none';el.style.transform=`translateX(${dir>0?'60px':'-60px'})`;el.style.opacity='0';
        requestAnimationFrame(()=>{
          el.style.transition='transform .25s ease-out,opacity .25s ease-out';
          el.style.transform='translateX(0)';el.style.opacity='1';
        });
      },200);
      setTimeout(()=>{el.style.transition=''},450);
      return;
    }
    // Reset swipe transform if didn't navigate
    if(feedZoom.scale<=1.01){
      el.style.transition='transform .2s,opacity .2s';
      el.style.transform='';el.style.opacity='';
      setTimeout(()=>{el.style.transition=''},250);
    }
  });

  // Scroll wheel zoom
  el.addEventListener('wheel',function(e){
    if(!isZoomablePost())return;
    e.preventDefault();
    const factor=e.deltaY>0?0.82:1.22;
    feedZoomTo(e.clientX,e.clientY,feedZoom.scale*factor);
  },{passive:false});

  // ── Unified touch handler ──
  let tStartX=0, tStartY=0, tMoved=false, tSwipeDx=0, tPanStartX=0, tPanStartY=0;
  let pinching=false, pinchDist0=0, pinchScale0=1, pinchMidX=0, pinchMidY=0;

  function touchDist(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY)}
  function touchMid(t){return{x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2}}

  el.addEventListener('touchstart',function(e){
    if(e.target.closest('.feed-mute-btn')||e.target.closest('.feed-single-edit')||e.target.tagName==='VIDEO'||e.target.tagName==='IFRAME')return;
    tMoved=false; tSwipeDx=0;

    if(e.touches.length===2 && isZoomablePost()){
      // Pinch start
      pinching=true;
      pinchDist0=touchDist(e.touches);
      pinchScale0=feedZoom.scale;
      const mid=touchMid(e.touches);
      pinchMidX=mid.x; pinchMidY=mid.y;
      tPanStartX=feedZoom.x; tPanStartY=feedZoom.y;
      e.preventDefault();
    } else if(e.touches.length===1){
      tStartX=e.touches[0].clientX; tStartY=e.touches[0].clientY;
      tPanStartX=feedZoom.x; tPanStartY=feedZoom.y;
      if(feedZoom.scale>1.01) e.preventDefault();
    }
  },{passive:false});

  el.addEventListener('touchmove',function(e){
    if(pinching && e.touches.length===2){
      // Pinch zoom + pan
      e.preventDefault(); tMoved=true;
      const dist=touchDist(e.touches);
      const mid=touchMid(e.touches);
      feedZoomTo(mid.x, mid.y, pinchScale0*(dist/pinchDist0));
    } else if(e.touches.length===1 && !pinching){
      const dx=e.touches[0].clientX-tStartX;
      const dy=e.touches[0].clientY-tStartY;
      if(Math.abs(dx)>5||Math.abs(dy)>5) tMoved=true;
      if(!tMoved)return;

      if(feedZoom.scale>1.01){
        // Pan zoomed image
        e.preventDefault();
        feedZoom.x=tPanStartX+dx;
        feedZoom.y=tPanStartY+dy;
        clampFeedPan();applyFeedZoom();
      } else {
        // Swipe between posts
        if(Math.abs(dy)>Math.abs(dx))return; // vertical scroll, ignore
        tSwipeDx=dx;
        el.style.transform=`translateX(${dx*.4}px)`;
        el.style.opacity=1-Math.abs(dx)/600;
      }
    }
  },{passive:false});

  el.addEventListener('touchend',function(e){
    if(pinching && e.touches.length<2){
      pinching=false;
      if(feedZoom.scale<1.05) resetFeedZoom();
      return;
    }
    if(e.touches.length>0)return; // still touching

    if(!tMoved && isZoomablePost()){
      // Tap — toggle zoom
      if(feedZoom.scale>1.01){
        resetFeedZoom();
      } else {
        feedZoom.scale=2.5;
        const c=getFeedContainer();
        if(c){feedZoom.x=(c.clientWidth*(1-2.5))/2;feedZoom.y=(c.clientHeight*(1-2.5))/2}
        clampFeedPan();applyFeedZoom();
      }
    } else if(feedZoom.scale<=1.01 && Math.abs(tSwipeDx)>50){
      // Swipe navigation
      const dir=tSwipeDx>0?-1:1;
      el.style.transition='transform .2s,opacity .2s';
      el.style.transform=`translateX(${tSwipeDx>0?'100px':'-100px'})`;el.style.opacity='0';
      setTimeout(()=>{
        navPost(dir);
        el.style.transition='none';el.style.transform=`translateX(${dir>0?'60px':'-60px'})`;el.style.opacity='0';
        requestAnimationFrame(()=>{
          el.style.transition='transform .25s ease-out,opacity .25s ease-out';
          el.style.transform='translateX(0)';el.style.opacity='1';
        });
      },200);
      setTimeout(()=>{el.style.transition=''},450);
      return;
    }

    // Reset swipe transform
    if(feedZoom.scale<=1.01){
      el.style.transition='transform .2s,opacity .2s';
      el.style.transform='';el.style.opacity='';
      setTimeout(()=>{el.style.transition=''},250);
    }
  });
})();

// ══════ OVERSCROLL RUBBER BAND ══════
(function(){
  document.querySelectorAll('.exp-body, #consoleScreen').forEach(el=>{
    let startY=0,pulling=false;
    el.addEventListener('touchstart',e=>{startY=e.touches[0].clientY},{passive:true});
    el.addEventListener('touchmove',e=>{
      const dy=e.touches[0].clientY-startY;
      const atTop=el.scrollTop<=0;
      const atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-1;
      if((atTop&&dy>0)||(atBottom&&dy<0)){
        const pull=Math.min(Math.abs(dy)*.3,60);
        const dir=dy>0?1:-1;
        el.style.transform=`translateY(${pull*dir}px)`;
        el.style.transition='none';
        pulling=true;
      }
    },{passive:true});
    el.addEventListener('touchend',()=>{
      if(pulling){
        el.style.transition='transform .4s cubic-bezier(.25,.46,.45,.94)';
        el.style.transform='translateY(0)';
        pulling=false;
      }
    });
  });
})();

