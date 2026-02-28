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
  // 1b. HOVER EFFECTS — Console Grid Tiles
  // ─────────────────────────────────────────────

  // Track active hover tweens so we can kill them cleanly
  const _hoverTimelines = new WeakMap();

  function onTileEnter(tile){
    // Kill any existing hover-out tween
    if(_hoverTimelines.has(tile)){
      _hoverTimelines.get(tile).kill();
    }

    const screen = tile.querySelector('.crt-screen');
    const icon = tile.querySelector('.tile-icon');
    const glow = tile.querySelector('.tile-glow');

    const tl = gsap.timeline();

    // Tile: lift + slight scale
    tl.to(tile, {
      scale: 1.04,
      y: -4,
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto'
    }, 0);

    // Screen: cyber glow border via boxShadow
    if(screen){
      tl.to(screen, {
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,.6), inset 0 0 20px rgba(0,0,0,.3), 0 0 12px rgba(0,255,136,.12), 0 0 30px rgba(0,255,136,.05), 0 0 60px rgba(0,255,136,.02)',
        borderColor: 'rgba(0,255,136,0.2)',
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto'
      }, 0);
    }

    // Icon: scale up with subtle pulse
    if(icon){
      tl.to(icon, {
        scale: 1.12,
        filter: 'grayscale(0) brightness(1.15) drop-shadow(0 0 8px rgba(0,255,136,.25))',
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto'
      }, 0);
    }

    // Glow: expand and brighten
    if(glow){
      tl.to(glow, {
        width: 180,
        height: 180,
        opacity: 1,
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto'
      }, 0);
    }

    // Outer tile glow via boxShadow
    tl.to(tile, {
      boxShadow: '0 8px 30px rgba(0,0,0,.6), 0 14px 60px rgba(0,0,0,.3), 0 0 25px rgba(0,255,136,.04), 0 0 50px rgba(0,255,136,.02), inset 0 1px 0 rgba(255,255,255,.06)',
      duration: 0.25,
      ease: 'power2.out',
      overwrite: 'auto'
    }, 0);

    // Subtle continuous pulse while hovering
    tl.to(screen || tile, {
      boxShadow: screen
        ? 'inset 0 2px 8px rgba(0,0,0,.6), inset 0 0 20px rgba(0,0,0,.3), 0 0 16px rgba(0,255,136,.16), 0 0 40px rgba(0,255,136,.06), 0 0 70px rgba(0,255,136,.025)'
        : undefined,
      duration: 0.8,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    }, 0.2);

    _hoverTimelines.set(tile, tl);
  }

  function onTileLeave(tile){
    // Kill hover timeline
    if(_hoverTimelines.has(tile)){
      _hoverTimelines.get(tile).kill();
      _hoverTimelines.delete(tile);
    }

    const screen = tile.querySelector('.crt-screen');
    const icon = tile.querySelector('.tile-icon');
    const glow = tile.querySelector('.tile-glow');

    const tl = gsap.timeline();

    // Return everything to resting state
    tl.to(tile, {
      scale: 1,
      y: 0,
      boxShadow: '0 4px 24px rgba(0,0,0,.3), 0 12px 48px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.06)',
      duration: 0.25,
      ease: 'power3.out',
      overwrite: 'auto'
    }, 0);

    if(screen){
      tl.to(screen, {
        boxShadow: 'inset 0 1px 6px rgba(0,0,0,.35), inset 0 0 16px rgba(0,0,0,.15), 0 0 1px rgba(0,255,136,.06)',
        borderColor: 'rgba(0,255,136,0.06)',
        duration: 0.25,
        ease: 'power3.out',
        overwrite: 'auto'
      }, 0);
    }

    if(icon){
      tl.to(icon, {
        scale: 1,
        filter: 'grayscale(0.2) brightness(0.9)',
        duration: 0.25,
        ease: 'power3.out',
        overwrite: 'auto'
      }, 0);
    }

    if(glow){
      tl.to(glow, {
        width: 100,
        height: 100,
        opacity: 0.5,
        duration: 0.25,
        ease: 'power3.out',
        overwrite: 'auto'
      }, 0);
    }

    _hoverTimelines.set(tile, tl);
  }

  // Attach hover directly to each tile — mouseenter/mouseleave
  // won't fire when moving between child elements
  function initTileHover(){
    document.querySelectorAll('.crt-monitor').forEach(tile => {
      if(tile._hoverBound) return; // prevent double-bind
      tile._hoverBound = true;
      tile.addEventListener('mouseenter', () => onTileEnter(tile));
      tile.addEventListener('mouseleave', () => onTileLeave(tile));
    });
  }

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
        initTileHover();
        initTileBreathing();
        initLedBreathing();
        initDotBreathing();
      });
    };
  }

  // ─────────────────────────────────────────────
  // 4. INTEL FIELD ENHANCEMENTS — LED-style glow
  // ─────────────────────────────────────────────

  function initIntelFieldEffects(){
    // Intel rows — subtle edge-light on hover
    document.addEventListener('mouseenter', function(e){
      const row = e.target.closest('.intel-exp-row');
      if(!row) return;

      gsap.to(row, {
        borderColor: 'rgba(0,255,136,0.4)',
        boxShadow: '0 0 12px rgba(0,255,136,.06), 0 0 30px rgba(0,255,136,.025), inset 0 0 20px rgba(0,255,136,.03)',
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto'
      });

      // Number label glow
      const num = row.querySelector('.intel-exp-num');
      if(num){
        gsap.to(num, {
          color: 'rgba(0,255,136,0.7)',
          textShadow: '0 0 8px rgba(0,255,136,.3)',
          duration: 0.2,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    }, true);

    document.addEventListener('mouseleave', function(e){
      const row = e.target.closest('.intel-exp-row');
      if(!row) return;

      gsap.to(row, {
        borderColor: 'rgba(0,255,136,0.15)',
        boxShadow: 'none',
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto'
      });

      const num = row.querySelector('.intel-exp-num');
      if(num){
        gsap.to(num, {
          color: 'rgba(0,255,136,0.35)',
          textShadow: 'none',
          duration: 0.25,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    }, true);

    // Intel inputs — LED activation glow on focus
    document.addEventListener('focusin', function(e){
      const input = e.target.closest('.intel-exp-input');
      const prefixWrap = e.target.closest('.intel-prefix-wrap');
      const target = input || prefixWrap;
      if(!target) return;

      gsap.to(target, {
        borderColor: 'rgba(0,255,136,0.55)',
        boxShadow: '0 0 14px rgba(0,255,136,.1), 0 0 30px rgba(0,255,136,.04), inset 0 0 12px rgba(0,255,136,.04)',
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto'
      });

      // Parent row gets a subtle highlight
      const row = target.closest('.intel-exp-row');
      if(row){
        gsap.to(row, {
          borderColor: 'rgba(0,255,136,0.35)',
          background: 'linear-gradient(180deg, rgba(0,255,136,.03), rgba(0,255,136,.008))',
          boxShadow: '0 0 8px rgba(0,255,136,.04), inset 0 0 16px rgba(0,255,136,.02)',
          duration: 0.25,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    }, true);

    document.addEventListener('focusout', function(e){
      const input = e.target.closest('.intel-exp-input');
      const prefixWrap = e.target.closest('.intel-prefix-wrap');
      const target = input || prefixWrap;
      if(!target) return;

      gsap.to(target, {
        borderColor: 'rgba(0,255,136,0.2)',
        boxShadow: 'none',
        duration: 0.3,
        ease: 'power2.out',
        overwrite: 'auto'
      });

      const row = target.closest('.intel-exp-row');
      if(row){
        gsap.to(row, {
          borderColor: 'rgba(0,255,136,0.15)',
          background: 'linear-gradient(180deg, rgba(0,255,136,.01), transparent)',
          boxShadow: 'none',
          duration: 0.3,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    }, true);
  }

  // Intel field stagger — animate rows in when panel opens
  function staggerIntelFields(){
    const rows = document.querySelectorAll('#intelForm .intel-exp-row');
    if(!rows.length) return;

    gsap.from(rows, {
      opacity: 0,
      y: 12,
      borderColor: 'rgba(0,255,136,0)',
      duration: 0.3,
      stagger: 0.05,
      ease: 'power2.out',
      clearProps: 'opacity,y'
    });
  }

  // Expose stagger for panel open calls
  window._staggerIntelFields = staggerIntelFields;

  // Initial setup on DOM ready
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
    // DOM already ready, delay slightly to ensure grid is rendered
    setTimeout(initAllEffects, 500);
  }

})();
