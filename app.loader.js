
(function(){
  function go(){
    var parts=window.__LH_CHUNKS||[];
    if(parts.length< 3){ setTimeout(go,20); return; }
    var code=parts.join('');
    var s=document.createElement('script');
    s.textContent=code;
    document.body.appendChild(s);
  }
  go();
})();
