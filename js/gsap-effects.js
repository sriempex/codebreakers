// ══════ GSAP EFFECTS — Tactile Bounce & Breathing Glows ══════
// Requires: gsap loaded globally

(function(){
  if(!window.gsap) return;

  // ─────────────────────────────────────────────
  // 1. TACTILE BOUNCE — Vault Keypad & All Buttons
  // ─────────────────────────────────────────────

  // Bounce effect for any pressed element
  function bouncePress(el){
    gsap.killTweensOf(el);
    gsap.timeline()
      .to(el, {scale:0.82, duration:0.06, ease:'power2.in'})
      .to(el, {scale:1.06, duration:0.12, ease:'back.out(3)'})
      .to(el, {scale:1, duration:0.15, ease:'power1.out'});
  }

  // Heavier bounce for ENTER / submit keys
  function heavyBounce(el){
    gsap.killTweensOf(el);
    gsap.timeline()
      .to(el, {scale:0.78, duration:0.06, ease:'power2.in'})
      .to(el, {scale:1.1, duration:0.14, ease:'back.out(4)'})
      .to(el, {scale:1, duration:0.18, ease:'elastic.out(1,0.5)'});
  }

  // Error shake for failed vault codes
  function errorShake(el){
    gsap.killTweensOf(el);
    gsap.timeline()
      .to(el, {x:-6, duration:0.05})
      .to(el, {x:6, duration:0.05})
      .to(el, {x:-4, duration:0.05})
      .to(el, {x:4, duration:0.05})
      .to(el, {x:-2, duration:0.04})
      .to(el, {x:0, duration:0.04});
  }

  // Attach bounce to vault keypad via event delegation
  document.addEventListener('pointerdown', function(e){
    // Vault keypad keys
    const kbKey = e.target.closest('.kb-key');
    if(kbKey){
      if(kbKey.classList.contains('enter-key')){
        heavyBounce(kbKey);
      } else {
        bouncePress(kbKey);
      }
      return;
    }

    // Intel submit button
    const submitBtn = e.target.closest('.intel-submit-btn');
    if(submitBtn && !submitBtn.disabled){
      heavyBounce(submitBtn);
      return;
    }

    // Intel confirm modal buttons
    const confirmBtn = e.target.closest('.intel-confirm-back, .intel-confirm-send');
    if(confirmBtn){
      heavyBounce(confirmBtn);
      return;
    }

    // Console grid tiles
    const tile = e.target.closest('.crt-monitor');
    if(tile){
      bouncePress(tile);
      return;
    }

    // Generic btn-standard buttons (admin, modals)
    const stdBtn = e.target.closest('.btn-standard');
    if(stdBtn){
      bouncePress(stdBtn);
      return;
    }
  });

  // Expose errorShake globally so vault.js can use it
  window._gsapErrorShake = errorShake;

  // ─────────────────────────────────────────────
  // 2. BREATHING GLOWS — CRT Tiles & Status Elements
  // ─────────────────────────────────────────────

  // Tile glow breathing — subtle radiance pulse on each tile
  function initTileBreathing(){
    const glows = document.querySelectorAll('.tile-glow');
    if(!glows.length) return;

    glows.forEach((glow, i) => {
      gsap.to(glow, {
        opacity: 0.6,
        scale: 1.15,
        duration: 2 + (i * 0.4), // Stagger so they don't all pulse in sync
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: i * 0.3
      });
    });
  }

  // CRT LED breathing — the small indicator LEDs on each tile
  function initLedBreathing(){
    const leds = document.querySelectorAll('.crt-led');
    if(!leds.length) return;

    leds.forEach((led, i) => {
      gsap.to(led, {
        opacity: 0.4,
        duration: 1.5 + (i * 0.3),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: i * 0.2
      });
    });
  }

  // Console worldmap background breathing
  function initWorldmapBreathing(){
    const maps = document.querySelectorAll('.console-worldmap');
    if(!maps.length) return;

    maps.forEach(map => {
      gsap.to(map, {
        opacity: 0.08,
        duration: 6,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    });
  }

  // Status dots — enhanced pulsing with GSAP (smoother than CSS keyframes)
  function initDotBreathing(){
    // Active dots — fast, energetic pulse
    document.querySelectorAll('.tile-dot.active').forEach(dot => {
      gsap.to(dot, {
        boxShadow: '0 0 12px rgba(0,255,136,.8), 0 0 20px rgba(0,255,136,.3)',
        scale: 1.3,
        duration: 0.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    });

    // Idle dots — slower, amber pulse
    document.querySelectorAll('.tile-dot.idle').forEach(dot => {
      gsap.to(dot, {
        boxShadow: '0 0 8px rgba(204,136,0,.6), 0 0 16px rgba(204,136,0,.2)',
        scale: 1.2,
        duration: 2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    });

    // Silent dots — very slow, subtle
    document.querySelectorAll('.tile-dot.silent').forEach(dot => {
      gsap.to(dot, {
        opacity: 0.3,
        duration: 4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    });
  }

  // Timer breathing — pulse intensity increases as timer runs low
  function initTimerBreathing(){
    const digits = document.querySelector('.timer-digits');
    if(!digits) return;

    // Watch for the .critical or .warning class being added
    const observer = new MutationObserver(()=>{
      if(digits.classList.contains('critical')){
        gsap.killTweensOf(digits);
        gsap.to(digits, {
          textShadow: '0 0 20px rgba(255,50,50,.8), 0 0 40px rgba(255,50,50,.3)',
          scale: 1.03,
          duration: 0.4,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        });
      } else if(digits.classList.contains('paused')){
        gsap.killTweensOf(digits);
        gsap.to(digits, {
          opacity: 0.5,
          duration: 1,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        });
      } else {
        gsap.killTweensOf(digits);
        gsap.set(digits, {clearProps: 'all'});
      }
    });
    observer.observe(digits, {attributes: true, attributeFilter: ['class']});
  }

  // Topbar elements breathing
  function initTopbarBreathing(){
    // Timer colon separator pulse
    const colons = document.querySelectorAll('.timer-sep');
    colons.forEach(sep => {
      gsap.to(sep, {
        opacity: 0.3,
        duration: 1,
        ease: 'steps(1)',
        repeat: -1,
        yoyo: true
      });
    });

    // Signal status dot
    const sigDot = document.querySelector('.signal-dot');
    if(sigDot){
      gsap.to(sigDot, {
        boxShadow: '0 0 8px rgba(0,255,136,.6)',
        scale: 1.3,
        duration: 1.2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    }
  }

  // ─────────────────────────────────────────────
  // 3. INITIALIZATION
  // ─────────────────────────────────────────────

  // Re-initialize breathing effects whenever grid re-renders
  // (tiles get replaced, so GSAP tweens on old elements die)
  const _origRenderGrid = window.renderGrid;
  if(typeof _origRenderGrid === 'function'){
    window.renderGrid = function(){
      _origRenderGrid.apply(this, arguments);
      // Re-apply breathing after DOM update
      requestAnimationFrame(()=>{
        initTileBreathing();
        initLedBreathing();
        initDotBreathing();
      });
    };
  }

  // Initial setup on DOM ready
  function initAllEffects(){
    initTileBreathing();
    initLedBreathing();
    initWorldmapBreathing();
    initDotBreathing();
    initTimerBreathing();
    initTopbarBreathing();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAllEffects);
  } else {
    // DOM already ready, delay slightly to ensure grid is rendered
    setTimeout(initAllEffects, 500);
  }

})();
