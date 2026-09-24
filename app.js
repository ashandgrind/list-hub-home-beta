(function () {
  var N = 4;
  var script = document.currentScript;
  var base = (script && script.src || './').replace(/[^/]+$/, '');
  // Nodes the decoded app binds on init. A stale Vercel/jsDelivr boot shell can
  // have Magic/Password auth (login-email) while still missing voice/barcode IDs.
  var REQUIRED_IDS = [
    'login-email', 'magic-btn', 'barcode-btn', 'scan-modal', 'scan-close',
    'scan-file-btn', 'scan-video', 'scan-hint', 'toast', 'voice-confirm'
  ];
  function missingRequiredId(root) {
    var doc = root || document;
    for (var i = 0; i < REQUIRED_IDS.length; i++) {
      if (!doc.getElementById(REQUIRED_IDS[i])) return REQUIRED_IDS[i];
    }
    return null;
  }
  function htmlMissingRequiredIds(html) {
    var missing = [];
    for (var i = 0; i < REQUIRED_IDS.length; i++) {
      var id = REQUIRED_IDS[i];
      if (html.indexOf('id="' + id + '"') === -1 && html.indexOf("id='" + id + "'") === -1) {
        missing.push(id);
      }
    }
    return missing;
  }
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
      var missing = missingRequiredId();
      if (missing) throw new Error("Cannot bind #" + missing + " (HTML/JS mismatch)");
      (0, eval)(code);
    });
  }
  function upgradeIfNeeded() {
    if (!missingRequiredId()) {
      return Promise.resolve();
    }
    return fetch(base + 'index.html?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('index.html ' + r.status);
      return r.text();
    }).then(function (html) {
      if (html.indexOf('Magic link') === -1 && html.indexOf('login-email') === -1) {
        throw new Error('unexpected index payload');
      }
      var missing = htmlMissingRequiredIds(html);
      if (missing.length) {
        throw new Error('index.html missing: ' + missing.join(', '));
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
