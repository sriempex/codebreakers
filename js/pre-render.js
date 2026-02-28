// Pre-render theme injection — runs before body paints
// Reads cached theme from localStorage and injects a CSS class on consoleGrid
// via a MutationObserver that fires the moment the element exists in DOM.
(function(){
  try{
    var t=localStorage.getItem('cb_gridTheme');
    if(t&&t!=='crt'){
      var obs=new MutationObserver(function(m,o){
        var g=document.getElementById('consoleGrid');
        if(g){g.classList.add('grid-theme-'+t);o.disconnect()}
      });
      if(document.body){
        var g=document.getElementById('consoleGrid');
        if(g)g.classList.add('grid-theme-'+t);
      }else{
        document.addEventListener('DOMContentLoaded',function(){
          var g=document.getElementById('consoleGrid');
          if(g)g.classList.add('grid-theme-'+t);
        });
        obs.observe(document.documentElement,{childList:true,subtree:true});
      }
    }
    // Intel theme pre-render
    var it=localStorage.getItem('cb_intelTheme');
    if(it&&it!=='standard'){
      var obs2=new MutationObserver(function(m,o){
        var p=document.getElementById('expIntel');
        if(p){p.classList.add('intel-theme-'+it);o.disconnect()}
      });
      if(document.body){
        var p=document.getElementById('expIntel');
        if(p)p.classList.add('intel-theme-'+it);
      }else{
        document.addEventListener('DOMContentLoaded',function(){
          var p=document.getElementById('expIntel');
          if(p)p.classList.add('intel-theme-'+it);
        });
        obs2.observe(document.documentElement,{childList:true,subtree:true});
      }
    }
  }catch(e){}
})();
