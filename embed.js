/* List Hub embed widget: a login-free, read-only view of one household's List.
   Built for TVs, kiosks, and dashboards (for example in an iframe).

   URL:  /listhub/embed#token=lhe_...&refresh=60&theme=dark&columns=auto&store=Costco
   The token can also be passed as ?token=, but the #fragment form is preferred
   because browsers never send the fragment to servers, proxies, or logs.

   Data comes from public.lh_embed_list(p_token), which only accepts read-only
   embed tokens (lhe_) and only returns display fields. */
(function () {
  "use strict";

  var SUPABASE_URL = "https://dphkvcdohqsvefbdhsfx.supabase.co";
  /* public anon key, same one the main app ships */
  var SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGt2Y2RvaHFzdmVmYmRoc2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTcxMjIsImV4cCI6MjA5OTU3MzEyMn0.Ts8vvKm8VuOYCgmtKxNQe71Ga2qjUH5jiCSlOe9vxSo";

  function readParams() {
    var out = {};
    function take(str) {
      if (!str) return;
      str.replace(/^[?#]/, "").split("&").forEach(function (pair) {
        if (!pair) return;
        var i = pair.indexOf("=");
        var k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, " "));
        var v = i < 0 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
        if (k) out[k.toLowerCase()] = v;
      });
    }
    take(location.search);
    take(location.hash); /* fragment wins */
    return out;
  }

  var P = readParams();
  var TOKEN = (P.token || "").trim();
  var REFRESH = Math.round(Number(P.refresh));
  if (!isFinite(REFRESH) || REFRESH <= 0) REFRESH = 60;
  REFRESH = Math.min(3600, Math.max(15, REFRESH));
  var THEME = P.theme === "light" ? "light" : "dark";
  var COLUMNS = /^[1-4]$/.test(P.columns || "") ? Number(P.columns) : "auto";
  var STORE = (P.store || "").trim().toLowerCase();
  var SCROLL = P.scroll !== "0" && P.scroll !== "off";

  /* keep a ?token= out of the address bar and any later Referer */
  if (/[?&]token=/i.test(location.search) && history.replaceState) {
    try {
      var q = location.search.replace(/^\?/, "").split("&").filter(function (p) {
        return p && !/^token=/i.test(p);
      });
      var h = location.hash.replace(/^#/, "");
      if (!/(^|&)token=/i.test(h)) h = "token=" + encodeURIComponent(TOKEN) + (h ? "&" + h : "");
      history.replaceState(null, "", location.pathname + (q.length ? "?" + q.join("&") : "") + "#" + h);
    } catch (e) {}
  }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  document.body.className = "theme-" + THEME;
  var listEl = $("e-list");
  if (COLUMNS !== "auto") {
    listEl.style.columnCount = String(COLUMNS);
    listEl.classList.add("fixed-cols");
  }

  var lastOk = null;
  var timer = null;
  var dead = false;

  function setMsg(text, kind) {
    var m = $("e-msg");
    m.textContent = text || "";
    m.className = "e-msg" + (kind ? " " + kind : "");
    m.hidden = !text;
  }

  function fmtTime(d) {
    try {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function resolve(it) {
    var item = { name: it.name, category: it.section || "", subsection: it.subsection || "" };
    if (it.pinned) item.category_source = "user";
    return window.LHCats.resolveItem(item);
  }

  function itemHtml(it) {
    var meta = "";
    if (it.quantity) meta += '<span class="e-qty">' + esc(it.quantity) + "</span>";
    if (it.store && !STORE) meta += '<span class="e-store">' + esc(it.store) + "</span>";
    return '<li class="e-item"><span class="e-name">' + esc(it.name) + "</span>" + (meta ? '<span class="e-tags">' + meta + "</span>" : "") + "</li>";
  }

  function render(data) {
    var items = (data.items || []).filter(function (it) {
      return !STORE || String(it.store || "").toLowerCase() === STORE;
    });
    var title = data.household ? data.household + " List" : "List";
    if (STORE) title += " \u00b7 " + (items[0] && items[0].store ? items[0].store : P.store);
    $("e-title").textContent = title;
    document.title = title;
    $("e-count").textContent = items.length === 1 ? "1 item" : items.length + " items";
    $("e-updated").textContent = "Updated " + fmtTime(new Date());
    if (!items.length) {
      listEl.innerHTML = "";
      setMsg("All done here. Nothing on the list.", "empty");
      return;
    }
    setMsg("");
    listEl.innerHTML = window.LHCats.groupItems(items, resolve).map(function (g) {
      var body = g.subs.map(function (s) {
        return (s.name ? '<h3 class="e-sub">' + (s.emoji ? s.emoji + " " : "") + esc(s.name) + "</h3>" : "") +
          '<ul class="e-items">' + s.items.map(itemHtml).join("") + "</ul>";
      }).join("");
      return '<section class="e-group" data-section="' + esc(g.section) + '"><h2 class="e-sec"><span>' +
        g.emoji + " " + esc(g.section) + '</span><span class="e-n">' + g.count + "</span></h2>" + body + "</section>";
    }).join("");
  }

  function showInvalid() {
    dead = true;
    lastOk = null;
    listEl.innerHTML = "";
    $("e-title").textContent = "List Hub";
    $("e-count").textContent = "";
    $("e-updated").textContent = "";
    setMsg("This list link isn't working. It may have been revoked. Ask someone in the household for a new embed link from List Hub, Menu, TV and embed.", "error");
    if (timer) clearInterval(timer);
  }

  function load() {
    if (dead) return;
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(SUPABASE_URL + "/rest/v1/rpc/lh_embed_list", {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: "Bearer " + SUPABASE_ANON,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ p_token: TOKEN }),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (data) {
      clearTimeout(to);
      if (!data || data.status !== "ok") return showInvalid();
      lastOk = Date.now();
      render(data);
    }).catch(function () {
      clearTimeout(to);
      if (lastOk) {
        $("e-updated").textContent = "Offline, showing " + fmtTime(new Date(lastOk)) + ". Retrying.";
      } else {
        setMsg("Can't reach List Hub right now. Retrying.", "error");
      }
    });
  }

  /* gentle auto-scroll for long lists on screens nobody touches */
  function autoScroll() {
    var main = $("embed");
    var pauseUntil = Date.now() + 5000;
    var dir = 1;
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, function () { pauseUntil = Date.now() + 30000; }, { passive: true });
    });
    setInterval(function () {
      var max = main.scrollHeight - main.clientHeight;
      if (max <= 4 || Date.now() < pauseUntil) return;
      main.scrollTop += dir;
      if (main.scrollTop >= max - 1) { dir = -1; pauseUntil = Date.now() + 6000; }
      else if (main.scrollTop <= 0) { dir = 1; pauseUntil = Date.now() + 6000; }
    }, 60);
  }

  function start() {
    if (!window.LHCats) {
      setMsg("List Hub didn't load. Reload the page.", "error");
      return;
    }
    if (!/^lhe_[A-Za-z0-9_-]{20,196}$/.test(TOKEN)) {
      if (TOKEN) return showInvalid();
      dead = true;
      $("e-title").textContent = "List Hub";
      setMsg("This embed link is missing its token. Create one in List Hub under Menu, TV and embed.", "error");
      return;
    }
    load();
    timer = setInterval(load, REFRESH * 1000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) load();
    });
    if (SCROLL) autoScroll();
  }

  window.__lhEmbed = { params: { refresh: REFRESH, theme: THEME, columns: COLUMNS, store: STORE, scroll: SCROLL }, reload: load };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
