// Pre-render theme injection — runs before body paints
(function(){
  try{
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
