(function () {
  var N = 4;
  var script = document.currentScript;
  var base = (script && script.src || './').replace(/[^/]+$/, '');
  function loadChunks() {
    return Promise.all(Array.from({ length: N }, function (_, i) {
      return fetch(base + 'app.b64.' + i + '.txt?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('chunk ' + i + ' ' + r.status);
        return r.text();
      });
    })).then(function (parts) {
      var bin = atob(parts.map(function (p) { return p.trim(); }).join(''));
      var code;
      try { code = decodeURIComponent(escape(bin)); } catch (e) { code = bin; }
      (0, eval)(code);
    });
  }
  function upgradeIfNeeded() {
    if (document.getElementById('login-email') || document.getElementById('magic-btn')) {
      return Promise.resolve();
    }
    return fetch(base + 'index.html?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('index.html ' + r.status);
      return r.text();
    }).then(function (html) {
      if (html.indexOf('Magic link') === -1 && html.indexOf('login-email') === -1) {
        throw new Error('unexpected index payload');
      }
      html = html
        .replace(/href=(["'])styles\.css\1/g, 'href="' + base + 'styles.css?t=' + Date.now() + '"')
        .replace(/src=(["'])app\.js\1/g, 'src="' + base + 'app.js?t=' + Date.now() + '"');
      document.open();
      document.write(html);
      document.close();
      throw new Error('UPGRADED');
    });
  }
  upgradeIfNeeded()
    .then(loadChunks)
    .catch(function (e) {
      if (e && e.message === 'UPGRADED') return;
      var el = document.getElementById('gate-info') || document.getElementById('gate-error') || document.getElementById('status') || document.body;
      if (el && el.textContent !== undefined) el.textContent = 'Failed to load app: ' + (e && e.message || e);
      if (el && el.classList) el.classList.remove('hidden');
      console.error(e);
    });
})();
