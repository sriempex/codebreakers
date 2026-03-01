// ══════ GSAP EFFECTS — ALL DISABLED FOR PERFORMANCE TESTING ══════
// Everything turned off to isolate whether GSAP is the bottleneck

(function(){
  // Expose stubs so nothing breaks
  window._gsapErrorShake = function(el){
    // CSS-only fallback shake
    el.style.animation = 'none';
    el.offsetHeight; // force reflow
    el.style.animation = 'shake 0.3s ease';
  };
  window._staggerIntelFields = function(){};
})();
