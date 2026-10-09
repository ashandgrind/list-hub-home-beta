/* List Hub in-place item rename.
   Works in the browser (window.LHRename) and in Node (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LHRename = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var EMPTY_HINT = "Name can't be empty.";

  function trimName(value) {
    return String(value == null ? "" : value).trim();
  }

  function prepareRename(currentName, nextName) {
    var name = trimName(nextName);
    if (!name) return { ok: false, reason: "empty", hint: EMPTY_HINT };
    if (name === trimName(currentName)) return { ok: true, unchanged: true, name: name };
    return { ok: true, name: name };
  }

  function namePatch(name, updatedAt) {
    return { name: name, updated_at: updatedAt };
  }

  function createEditor() {
    var phase = "idle";
    return {
      start: function () {
        phase = "editing";
      },
      enter: function () {
        if (phase !== "editing") return "ignore";
        phase = "committed";
        return "save";
      },
      blur: function () {
        if (phase !== "editing") return "ignore";
        phase = "committed";
        return "save";
      },
      escape: function () {
        if (phase !== "editing") return "ignore";
        phase = "cancelled";
        return "cancel";
      },
      phase: function () {
        return phase;
      }
    };
  }

  async function saveRename(client, item, nextName, hooks) {
    hooks = hooks || {};
    var prepared = prepareRename(item.name, nextName);
    if (!prepared.ok) {
      return { ok: false, reason: "empty", hint: prepared.hint, id: item.id, item: item };
    }
    if (prepared.unchanged) {
      return { ok: true, unchanged: true, id: item.id, name: prepared.name, item: item };
    }
    var prev = item.name;
    var patch = namePatch(prepared.name, (new Date).toISOString());
    item.name = prepared.name;
    if (hooks.onOptimistic) hooks.onOptimistic(item);
    var res = await client.from("lh_items").update(patch).eq("id", item.id);
    if (res && res.error) {
      item.name = prev;
      if (hooks.onRollback) hooks.onRollback(item, res.error);
      return { ok: false, reason: "save", error: res.error, id: item.id, patch: patch, item: item };
    }
    return { ok: true, id: item.id, name: prepared.name, patch: patch, item: item };
  }

  function nameRowHtml(name, wish, escapeHtml) {
    var safe = escapeHtml(name);
    if (wish) {
      return '<div class="item-name-row"><div class="item-name">' + safe + '</div><button type="button" class="rename-btn" data-act="rename" aria-label="Rename">✎</button></div>';
    }
    return '<div class="item-name-row"><button type="button" class="item-name item-name-btn" data-act="rename">' + safe + "</button></div>";
  }

  function attachRename(article, item, opts) {
    opts = opts || {};
    var client = opts.client;
    var wish = !!opts.wish;
    var onError = opts.onError || function () {};
    var onChange = opts.onChange || function () {};
    var nodes = article.querySelectorAll("[data-act=rename]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        start();
      });
    }

    function start() {
      if (article.querySelector(".rename-input")) return;
      var nameEl = article.querySelector(".item-name");
      if (!nameEl) return;
      var editor = createEditor();
      editor.start();
      var input = document.createElement("input");
      input.type = "text";
      input.className = "rename-input";
      input.value = item.name;
      input.setAttribute("aria-label", "Item name");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("enterkeyhint", "done");
      nameEl.replaceWith(input);
      var pencil = article.querySelector(".rename-btn");
      if (pencil) pencil.classList.add("hidden");
      input.focus();
      input.select();

      function restoreName(text) {
        var el;
        if (wish) {
          el = document.createElement("div");
          el.className = "item-name";
          el.textContent = text;
        } else {
          el = document.createElement("button");
          el.type = "button";
          el.className = "item-name item-name-btn";
          el.setAttribute("data-act", "rename");
          el.textContent = text;
          el.addEventListener("click", function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            start();
          });
        }
        if (input.parentNode) input.replaceWith(el);
        if (pencil) pencil.classList.remove("hidden");
      }

      function showEmptyHint() {
        var row = article.querySelector(".item-name-row");
        var host = (row && row.parentNode) || article.querySelector(".item-body") || article;
        var hint = article.querySelector(".rename-hint");
        if (!hint && host) {
          hint = document.createElement("div");
          hint.className = "rename-hint";
          hint.setAttribute("role", "status");
          hint.setAttribute("aria-live", "polite");
          if (row && row.parentNode === host) host.insertBefore(hint, row.nextSibling);
          else host.appendChild(hint);
        }
        if (hint) {
          hint.textContent = EMPTY_HINT;
          setTimeout(function () {
            if (hint.parentNode) hint.parentNode.removeChild(hint);
          }, 2500);
        }
      }

      function commit() {
        var value = input.value;
        var prepared = prepareRename(item.name, value);
        if (!prepared.ok) {
          showEmptyHint();
          editor.start();
          return Promise.resolve({ ok: false, reason: "empty", hint: prepared.hint, id: item.id });
        }
        if (prepared.unchanged) {
          restoreName(item.name);
          return Promise.resolve({ ok: true, unchanged: true, id: item.id });
        }
        return saveRename(client, item, value, {
          onOptimistic: function () {
            onChange(item);
          },
          onRollback: function (_item, err) {
            onError(err);
            onChange(item);
          }
        });
      }

      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          if (editor.enter() === "save") commit();
          if (input.parentNode) input.blur();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          if (editor.escape() === "cancel") restoreName(item.name);
          if (input.parentNode) input.blur();
        }
      });
      input.addEventListener("blur", function () {
        if (editor.blur() === "save") commit();
      });
    }
  }

  return {
    EMPTY_HINT: EMPTY_HINT,
    trimName: trimName,
    prepareRename: prepareRename,
    namePatch: namePatch,
    createEditor: createEditor,
    saveRename: saveRename,
    nameRowHtml: nameRowHtml,
    attachRename: attachRename
  };
});
