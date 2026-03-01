// ══════ GSAP EFFECTS — Optimized for Performance ══════
// All animations use transform + opacity (GPU composited)
// Box-shadow animations removed — they trigger full repaint every frame
// Glow effects use CSS class toggles with CSS transitions instead

(function(){
  if(!window.gsap) return;

  // ─────────────────────────────────────────────
  // 1. TACTILE BOUNCE — Vault Keypad & All Buttons
  // ─────────────────────────────────────────────

  function bouncePress(el){
    gsap.killTweensOf(el);
    gsap.timeline()
      .to(el, {scale:0.88, duration:0.05, ease:'power2.in'})
      .to(el, {scale:1.04, duration:0.08, ease:'back.out(3)'})
      .to(el, {scale:1, duration:0.1, ease:'power1.out'});
  }

  function heavyBounce(el){
    gsap.killTweensOf(el);
    gsap.timeline()
      .to(el, {scale:0.82, duration:0.05, ease:'power2.in'})
      .to(el, {scale:1.08, duration:0.1, ease:'back.out(4)'})
      .to(el, {scale:1, duration:0.12, ease:'power1.out'});
  }

  function errorShake(el){
    gsap.killTweensOf(el);
    gsap.timeline()
      .to(el, {x:-5, duration:0.04})
      .to(el, {x:5, duration:0.04})
      .to(el, {x:-3, duration:0.04})
      .to(el, {x:3, duration:0.04})
      .to(el, {x:0, duration:0.03});
  }

  document.addEventListener('pointerdown', function(e){
    const kbKey = e.target.closest('.kb-key');
    if(kbKey){ kbKey.classList.contains('enter-key') ? heavyBounce(kbKey) : bouncePress(kbKey); return; }
    const submitBtn = e.target.closest('.intel-submit-btn');
    if(submitBtn && !submitBtn.disabled){ heavyBounce(submitBtn); return; }
    const confirmBtn = e.target.closest('.intel-confirm-back, .intel-confirm-send');
    if(confirmBtn){ heavyBounce(confirmBtn); return; }
    const tile = e.target.closest('.crt-monitor');
    if(tile){ bouncePress(tile); return; }
    const stdBtn = e.target.closest('.btn-standard');
    if(stdBtn){ bouncePress(stdBtn); return; }
  });

  window._gsapErrorShake = errorShake;

  // ─────────────────────────────────────────────
  // 1b. HOVER EFFECTS — Console Grid Tiles
  // ─────────────────────────────────────────────
  // transform + opacity ONLY — no box-shadow animation
  // CSS class .tile-hover handles border/glow via CSS transition

  const _hoverTimelines = new WeakMap();

  function onTileEnter(tile){
    if(_hoverTimelines.has(tile)) _hoverTimelines.get(tile).kill();
    tile.classList.add('tile-hover');
    const icon = tile.querySelector('.tile-icon');
    const glow = tile.querySelector('.tile-glow');
    const tl = gsap.timeline();
    tl.to(tile, {scale:1.04, y:-3, duration:0.15, ease:'power2.out', overwrite:'auto'}, 0);
    if(icon) tl.to(icon, {scale:1.1, duration:0.15, ease:'power2.out', overwrite:'auto'}, 0);
    if(glow) tl.to(glow, {opacity:0.8, scale:1.3, duration:0.15, ease:'power2.out', overwrite:'auto'}, 0);
    _hoverTimelines.set(tile, tl);
  }

  function onTileLeave(tile){
    if(_hoverTimelines.has(tile)){ _hoverTimelines.get(tile).kill(); _hoverTimelines.delete(tile); }
    tile.classList.remove('tile-hover');
    const icon = tile.querySelector('.tile-icon');
    const glow = tile.querySelector('.tile-glow');
    const tl = gsap.timeline();
    tl.to(tile, {scale:1, y:0, duration:0.2, ease:'power3.out', overwrite:'auto'}, 0);
    if(icon) tl.to(icon, {scale:1, duration:0.2, ease:'power3.out', overwrite:'auto'}, 0);
    if(glow) tl.to(glow, {opacity:0.4, scale:1, duration:0.2, ease:'power3.out', overwrite:'auto'}, 0);
    _hoverTimelines.set(tile, tl);
  }

  function initTileHover(){
    document.querySelectorAll('.crt-monitor').forEach(tile => {
      if(tile._hoverBound) return;
      tile._hoverBound = true;
      tile.addEventListener('mouseenter', () => onTileEnter(tile));
      tile.addEventListener('mouseleave', () => onTileLeave(tile));
    });
  }

  // ─────────────────────────────────────────────
  // 2. BREATHING GLOWS — transform + opacity only
  // ─────────────────────────────────────────────

  function initTileBreathing(){
    document.querySelectorAll('.tile-glow').forEach((glow, i) => {
      gsap.to(glow, { opacity:0.5, scale:1.1, duration:2.5+(i*0.5), ease:'sine.inOut', repeat:-1, yoyo:true, delay:i*0.3 });
    });
  }

  function initLedBreathing(){
    document.querySelectorAll('.crt-led').forEach((led, i) => {
      gsap.to(led, { opacity:0.4, duration:1.5+(i*0.3), ease:'sine.inOut', repeat:-1, yoyo:true, delay:i*0.2 });
    });
  }

  function initWorldmapBreathing(){
    document.querySelectorAll('.console-worldmap').forEach(map => {
      gsap.to(map, { opacity:0.08, duration:6, ease:'sine.inOut', repeat:-1, yoyo:true });
    });
  }

  function initDotBreathing(){
    document.querySelectorAll('.tile-dot.active').forEach(dot => {
      gsap.to(dot, { opacity:0.6, scale:1.2, duration:0.8, ease:'sine.inOut', repeat:-1, yoyo:true });
    });
    document.querySelectorAll('.tile-dot.idle').forEach(dot => {
      gsap.to(dot, { opacity:0.5, scale:1.15, duration:2, ease:'sine.inOut', repeat:-1, yoyo:true });
    });
    document.querySelectorAll('.tile-dot.silent').forEach(dot => {
      gsap.to(dot, { opacity:0.3, duration:4, ease:'sine.inOut', repeat:-1, yoyo:true });
    });
  }

  function initTimerBreathing(){
    const digits = document.querySelector('.timer-digits');
    if(!digits) return;
    const observer = new MutationObserver(()=>{
      gsap.killTweensOf(digits);
      if(digits.classList.contains('critical')){
        gsap.to(digits, { scale:1.03, opacity:0.7, duration:0.4, ease:'sine.inOut', repeat:-1, yoyo:true });
      } else if(digits.classList.contains('paused')){
        gsap.to(digits, { opacity:0.5, duration:1, ease:'sine.inOut', repeat:-1, yoyo:true });
      } else {
        gsap.set(digits, {clearProps:'all'});
      }
    });
    observer.observe(digits, {attributes:true, attributeFilter:['class']});
  }

  function initTopbarBreathing(){
    document.querySelectorAll('.timer-sep').forEach(sep => {
      gsap.to(sep, { opacity:0.3, duration:1, ease:'steps(1)', repeat:-1, yoyo:true });
    });
    const sigDot = document.querySelector('.signal-dot');
    if(sigDot) gsap.to(sigDot, { opacity:0.5, scale:1.2, duration:1.2, ease:'sine.inOut', repeat:-1, yoyo:true });
  }

  // ─────────────────────────────────────────────
  // 3. INITIALIZATION
  // ─────────────────────────────────────────────

  const _origRenderGrid = window.renderGrid;
  if(typeof _origRenderGrid === 'function'){
    window.renderGrid = function(){
      _origRenderGrid.apply(this, arguments);
      requestAnimationFrame(()=>{ initTileHover(); initTileBreathing(); initLedBreathing(); initDotBreathing(); });
    };
  }

  // ─────────────────────────────────────────────
  // 4. INTEL FIELD ENHANCEMENTS — CSS class toggle
  // ─────────────────────────────────────────────
  // All glow effects via CSS classes + transitions (zero JS repaint cost)

  function initIntelFieldEffects(){
    document.addEventListener('mouseenter', function(e){
      const row = e.target.closest('.intel-exp-row');
      if(row) row.classList.add('intel-row-hover');
    }, true);
    document.addEventListener('mouseleave', function(e){
      const row = e.target.closest('.intel-exp-row');
      if(row) row.classList.remove('intel-row-hover');
    }, true);
    document.addEventListener('focusin', function(e){
      const target = e.target.closest('.intel-exp-input') || e.target.closest('.intel-prefix-wrap');
      if(!target) return;
      target.classList.add('intel-input-focus');
      const row = target.closest('.intel-exp-row');
      if(row) row.classList.add('intel-row-focus');
    }, true);
    document.addEventListener('focusout', function(e){
      const target = e.target.closest('.intel-exp-input') || e.target.closest('.intel-prefix-wrap');
      if(!target) return;
      target.classList.remove('intel-input-focus');
      const row = target.closest('.intel-exp-row');
      if(row) row.classList.remove('intel-row-focus');
    }, true);
  }

  function staggerIntelFields(){
    const rows = document.querySelectorAll('#intelForm .intel-exp-row');
    if(!rows.length) return;
    gsap.from(rows, { opacity:0, y:8, duration:0.15, stagger:0.025, ease:'power2.out', clearProps:'opacity,y' });
  }
  window._staggerIntelFields = staggerIntelFields;

  function initAllEffects(){
    initTileHover();
    initTileBreathing();
    initLedBreathing();
    initWorldmapBreathing();
    initDotBreathing();
    initTimerBreathing();
    initTopbarBreathing();
    initIntelFieldEffects();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAllEffects);
  } else {
    setTimeout(initAllEffects, 300);
  }

})();
