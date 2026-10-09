/* Loads app.parts/* (the List Hub IIFE) so the full file can be stored in slices. */
(function () {
  var parts = ["app.parts/00.js", "app.parts/01.js", "app.parts/02.js", "app.parts/03.js", "app.parts/04.js"];
  Promise.all(parts.map(function (p) {
    return fetch(p).then(function (r) {
      if (!r.ok) throw new Error("missing " + p);
      return r.text();
    });
  })).then(function (chunks) {
    var s = document.createElement("script");
    s.textContent = chunks.join("");
    document.body.appendChild(s);
  }).catch(function (err) {
    console.error(err);
  });
})();
