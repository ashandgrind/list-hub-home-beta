(function(){
  var N=4, base=(document.currentScript&&document.currentScript.src||'./').replace(/[^/]+$/,'');
  Promise.all(Array.from({length:N},function(_,i){
    return fetch(base+'app.b64.'+i+'.txt?t='+Date.now()).then(function(r){
      if(!r.ok) throw new Error('chunk '+i+' '+r.status);
      return r.text();
    });
  })).then(function(parts){
    var bin=atob(parts.join(''));
    var code;
    try { code = decodeURIComponent(escape(bin)); } catch(e) { code = bin; }
    (0,eval)(code);
  }).catch(function(e){
    var el=document.getElementById('gate-info')||document.body;
    if(el.textContent!==undefined) el.textContent='Failed to load app: '+(e&&e.message||e);
    if(el.classList) el.classList.remove('hidden');
    console.error(e);
  });
})();
