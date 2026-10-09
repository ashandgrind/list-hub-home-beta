      var d = await _().from("lh_trip_items").insert(c).select("*");
                                d.error ? g(d.error.message, !0) : s.items = d.data || []
                            }
                            w.trips.unshift(s), N(), se(), le(s.id)
                        }
                    }(t)
                })
            }()
    }

    function le(e) {
        var t = w.trips.find(function(t) {
            return t.id === e
        });
        t && function e() {
            var n = t.items.length,
                o = t.items.filter(function(e) {
                    return e.checked
                }).length,
                s = LHCats.groupItems(t.items, catOf);
            var c = t.export_target || (Y(t.store_id) || {}).app_hint;
            U('<div class="modal-top"><strong>🛒 ' + h(t.store_name) + ' trip</strong><button class="btn ghost sm" data-close>Close</button></div><p class="hint" style="margin-top:0" id="trip-count">' + o + " of " + n + " in the cart. Tap items as you grab them.</p>" + s.map(function(e) {
                return '<div class="group-title"><span>' + e.emoji + " " + h(e.section) + "</span></div>" + e.subs.map(function(sub) {
                    return (sub.name ? '<div class="subhead"><span>' + h(sub.name) + "</span></div>" : "") + sub.items.map(function(e) {
                        return '<div class="pick" data-ti="' + e.id + '"><span class="check-btn' + (e.checked ? " on" : "") + '">✓</span><div class="item-body"><div class="item-name" style="' + (e.checked ? "text-decoration:line-through;color:var(--muted)" : "") + '">' + h(e.name) + "</div>" + (e.qty ? '<div class="item-meta"><span class="badge">' + h(e.qty) + "</span></div>" : "") + "</div></div>"
                    }).join("")
                }).join("")
            }).join("") + (n ? "" : '<div class="empty">No items on this trip yet.</div>') + '<div class="sheet-foot"><button class="btn" id="trip-more">+ Add more from the List</button><button class="btn soon" id="trip-export" disabled title="Coming soon">📲 Send to ' + h(t.store_name) + ("amazon" === c ? "" : " / Amazon") + ' app — coming soon</button><button class="btn primary" id="trip-finish">Finish trip' + (o ? " · " + o + " bought" : "") + '</button><button class="btn ghost sm" id="trip-cancel" style="justify-self:center">Cancel trip</button></div>'), u("#sheet [data-ti]").forEach(function(n) {
                n.onclick = async function() {
                    var a = t.items.find(function(e) {
                        return e.id === n.dataset.ti
                    });
                    a.checked = !a.checked, e(), se();
                    var i = await _().from("lh_trip_items").update({
                        checked: a.checked,
                        checked_at: a.checked ? (new Date).toISOString() : null
                    }).eq("id", a.id);
                    i.error && g(i.error.message, !0)
                }
            }), l("#trip-more").onclick = function() {
                ! function(e, t) {
                    var n = {};
                    e.items.forEach(function(e) {
                        e.item_id && (n[e.item_id] = 1)
                    });
                    var i = $("needs").filter(function(e) {
                            return !n[e.id]
                        }),
                        r = {};
                    ! function n() {
                        U('<div class="modal-top"><strong>Add to ' + h(e.store_name) + ' trip</strong><button class="btn ghost sm" id="att-back">Back</button></div>' + (i.length ? i.map(function(e) {
                            return '<div class="pick" data-p="' + e.id + '"><span class="check-btn' + (r[e.id] ? " on" : "") + '">✓</span><div class="item-body"><div class="item-name">' + h(e.name) + '</div><div class="item-meta"><span class="badge">' + h(catOf(e).label) + "</span></div></div></div>"
                        }).join("") : '<div class="empty">Everything on the List is already on this trip.</div>') + '<div class="sheet-foot"><button class="btn primary" id="att-add">Add selected</button></div>'), l("#att-back").onclick = t, u("#sheet [data-p]").forEach(function(e) {
                            e.onclick = function() {
                                r[e.dataset.p] = !r[e.dataset.p], n()
                            }
                        }), l("#att-add").onclick = async function() {
                            var n = i.filter(function(e) {
                                return r[e.id]
                            }).map(function(t, n) {
                                var cat = catOf(t),
                                    row = {
                                    trip_id: e.id,
                                    household_id: a,
                                    item_id: t.id,
                                    name: t.name,
                                    qty: t.qty,
                                    category: cat.category,
                                    sort_order: 1e5 + n
                                };
                                return w.hasSubcol && (row.subsection = cat.subsection || ""), row
                            });
                            if (n.length) {
                                var o = await _().from("lh_trip_items").insert(n).select("*");
                                if (o.error) return g(o.error.message, !0);
                                e.items = e.items.concat(o.data || []), se()
                            }
                            t()
                        }
                    }()
                }(t, e)
            }, l("#trip-finish").onclick = function() {
                !async function(e) {
                    var t = e.items.filter(function(e) {
                            return e.checked
                        }).length,
                        n = e.items.length - t;
                    if (confirm("Finish the " + e.store_name + " trip?\n\n" + t + " checked item" + (1 === t ? "" : "s") + " will be marked bought and leave the List." + (n ? "\n" + n + " unchecked stay on the List." : ""))) {
                        var a = await _().rpc("lh_trip_complete", {
                            p_trip: e.id
                        });
                        if (a.error) return g(a.error.message, !0);
                        var i = e.items.filter(function(e) {
                            return e.checked && e.item_id
                        }).map(function(e) {
                            return e.item_id
                        });
                        w.items = w.items.filter(function(e) {
                            return i.indexOf(e.id) < 0
                        }), w.trips = w.trips.filter(function(t) {
                            return t !== e
                        }), N(), se(), f("Trip done — " + (a.data && null != a.data.bought ? a.data.bought : t) + " bought" + (n ? ", " + n + " still on the List" : "") + ".", 5e3), window.__lh.lastTrip = a.data
                    }
                }(t)
            }, l("#trip-cancel").onclick = async function() {
                if (confirm("Cancel this trip? Items stay on the List.")) {
                    var e = await _().from("lh_trips").update({
                        status: "cancelled",
                        completed_at: (new Date).toISOString()
                    }).eq("id", t.id);
                    if (e.error) return g(e.error.message, !0);
                    w.trips = w.trips.filter(function(e) {
                        return e !== t
                    }), N(), se(), f("Trip cancelled")
                }
            }
        }()
    }

    /* ---------- Recipe link import: link/text -> preview sheet -> normal add path ---------- */
    var rcState = null;

    function isLinkOnly(v) {
        return /^\s*(https?:\/\/|www\.)[^\s]+\s*$/i.test(v || "")
    }

    var rpMap = null;
    async function loadRepurchase() {
        try {
            var r = await _().rpc("lh_repurchase");
            if (r.error || !Array.isArray(r.data)) return;
            var m = {};
            r.data.forEach(function(x) {
                var k = x && rcNorm(x.name_key || x.name);
                k && (!m[k] || m[k].last_purchased_at < x.last_purchased_at) && (m[k] = x)
            });
            rpMap = m, window.__lh.repurchase = m, w.member && se()
        } catch (e) {}
    }

    function rpFor(name) {
        if (!rpMap) return null;
        var n = rcNorm(name);
        if (!n) return null;
        if (rpMap[n]) return rpMap[n];
        var best = null;
        Object.keys(rpMap).forEach(function(m) {
            m.length >= 5 && (" " + n).slice(-(m.length + 1)) === " " + m && (!best || m.length > best.length) && (best = m)
        });
        return best ? rpMap[best] : null
    }

    function rpAgo(x) {
        var d = Math.max(0, Math.floor((Date.now() - new Date(x.last_purchased_at).getTime()) / 864e5));
        return 0 === d ? "today" : 1 === d ? "yesterday" : d < 14 ? d + " days ago" : d < 60 ? Math.round(d / 7) + " weeks ago" : Math.round(d / 30) + " months ago"
    }

    function rpSpan(days) {
        var d = +days || 0;
        return d < 14 ? "~" + Math.max(1, Math.round(d)) + " day" + (Math.round(d) > 1 ? "s" : "") : d < 60 ? "~" + Math.round(d / 7) + " weeks" : d < 330 ? "~" + Math.round(d / 30) + " months" : "~" + Math.round(d / 365 * 10) / 10 + " years"
    }

    function rpLine(e) {
        if ("wish" === w.kind || "needed" !== e.status) return "";
        var x = rpFor(e.name);
        if (!x || !x.last_purchased_at) return "";
        var dt = new Date(x.last_purchased_at),
            s = "Last bought " + dt.toLocaleDateString(void 0, {
                month: "short",
                day: "numeric"
            }) + (x.confident && +x.interval_days >= 1 ? " · usually lasts " + rpSpan(x.interval_days) : "");
        return '<div class="item-last">' + h(s) + "</div>"
    }

    function rpSignal(name, kind) {
        _().rpc("lh_repurchase_signal", {
            p_name: name,
            p_kind: kind || "add"
        }).then(function() {}, function() {})
    }

    function rcNorm(e) {
        return p(e).replace(/[^a-z0-9 ]+/g, " ").replace(/\b(fresh|freshly|large|small|medium|ripe|organic|boneless|skinless|whole)\b/g, " ").replace(/\s+/g, " ").trim().replace(/(ies)$/, "y").replace(/(oes|ches|shes|ses|xes)$/, function(m) {
            return m.slice(0, -2)
        }).replace(/([^s])s$/, "$1")
    }

    function rcOnList(name) {
        var n = rcNorm(name);
        if (!n) return null;
        return $("needs").find(function(e) {
            var m = rcNorm(e.name);
            return m && (m === n || m.length >= 5 && (" " + n).slice(-(m.length + 1)) === " " + m)
        }) || null
    }

    function rcQty(x) {
        var q = String(x.quantity || "").trim(),
            un = String(x.unit || "").trim();
        un && q.toLowerCase().indexOf(un.toLowerCase()) < 0 && (q = q ? q + " " + un : "");
        return q.slice(0, 40)
    }

    function openRecipe(prefill, autostart) {
        if ("needs" !== w.kind) {
            w.kind = "needs";
            try {
                localStorage.setItem("lh5-kind", "needs")
            } catch (e) {}
            se()
        }
        rcState && rcState.ctl && rcState.ctl.abort();
        rcState = {
            step: "input",
            input: prefill || "",
            data: null,
            picked: [],
            err: "",
            seq: 0,
            ctl: null
        };
        rcRender();
        autostart && prefill && rcFetch()
    }

    function rcClose() {
        rcState && rcState.ctl && rcState.ctl.abort();
        rcState = null;
        N()
    }

    function rcRender() {
        var r = rcState;
        if (!r) return;
        var top = '<div class="modal-top"><strong>🍳 Add from a recipe</strong><button class="btn ghost sm" type="button" id="rc-close">Close</button></div>';
        if ("input" === r.step) {
            U(top + '<textarea id="rc-in" class="rc-input" rows="4" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Paste a recipe link (website, YouTube, X, TikTok…) — or paste the recipe text">' + h(r.input) + "</textarea>" + (r.err ? '<p class="error" id="rc-err">' + h(r.err) + "</p>" : "") + '<p class="hint">You’ll see the ingredients first — nothing is added until you tap Add.</p><div class="sheet-foot"><button class="btn primary" type="button" id="rc-go">Get ingredients</button></div>');
            var ta = l("#rc-in");
            l("#rc-go").onclick = function() {
                r.input = ta.value.trim();
                if (!r.input) return r.err = "Paste a link or the recipe text first.", void rcRender();
                rcFetch()
            };
            setTimeout(function() {
                ta && !r.input && ta.focus()
            }, 60)
        } else if ("loading" === r.step) {
            U(top + '<div class="rc-loading"><div class="spin"></div><div id="rc-msg">Reading the recipe…</div><p class="hint" style="margin-top:8px">YouTube videos and some sites can take up to a minute.</p></div><div class="sheet-foot"><button class="btn ghost" type="button" id="rc-cancel">Cancel</button></div>');
            l("#rc-cancel").onclick = function() {
                r.ctl && r.ctl.abort(), r.step = "input", r.err = "", rcRender()
            }
        } else if ("preview" === r.step) {
            var d = r.data,
                n = r.picked.filter(Boolean).length,
                onCount = d.ingredients.filter(function(x) {
                    return x._on
                }).length,
                src = d.source_url ? '<a href="' + h(d.source_url) + '" target="_blank" rel="noopener">' + h(d.title || "Recipe") + "</a>" : h(d.title || "Recipe");
            U(top + '<div class="rc-title" id="rc-title">' + src + '</div><div class="rc-sub">' + d.ingredients.length + " ingredient" + (1 === d.ingredients.length ? "" : "s") + (d.servings ? " · serves " + h(d.servings) : "") + (onCount ? " · " + onCount + " already on your List" : "") + '</div><div class="rc-tools"><button type="button" class="chip-btn" id="rc-all">Select all</button><button type="button" class="chip-btn" id="rc-none">Select none</button></div><div class="rc-list" id="rc-list">' + d.ingredients.map(function(x, i) {
                var q = rcQty(x);
                return '<div class="pick' + (r.picked[i] ? "" : " off") + '" data-rc="' + i + '"><span class="check-btn' + (r.picked[i] ? " on" : "") + '">✓</span><div class="item-body"><div class="item-name">' + h(x.name) + '</div><div class="item-meta">' + (q ? '<span class="badge">' + h(q) + "</span>" : "") + (x.note ? "<span>" + h(x.note) + "</span>" : "") + (x.staple ? '<span class="badge staple">Pantry staple</span>' : "") + (x._on ? '<span class="badge onlist">Already on List</span>' : "") + (x._have ? '<span class="badge bought">Bought ' + h(x._ago) + "</span>" : "") + "</div></div></div>"
            }).join("") + '</div><div class="sheet-foot"><button class="btn primary" type="button" id="rc-add"' + (n ? "" : " disabled") + ">" + (n ? "Add " + n + " item" + (1 === n ? "" : "s") + " to List" : "Pick items to add") + '</button><button class="btn ghost sm" type="button" id="rc-back" style="justify-self:center">Try a different link</button></div>');
            u("#sheet [data-rc]").forEach(function(el) {
                el.onclick = function() {
                    var i = +el.dataset.rc;
                    r.picked[i] = !r.picked[i], rcRender()
                }
            });
            l("#rc-all").onclick = function() {
                r.picked = d.ingredients.map(function() {
                    return !0
                }), rcRender()
            };
            l("#rc-none").onclick = function() {
                r.picked = d.ingredients.map(function() {
                    return !1
                }), rcRender()
            };
            l("#rc-back").onclick = function() {
                r.step = "input", r.err = "", rcRender()
            };
            l("#rc-add").onclick = rcAdd
        }
        var c = l("#rc-close");
        c && (c.onclick = rcClose)
    }
    async function rcFetch() {
        var r = rcState;
        if (!r) return;
        var my = ++r.seq;
        r.step = "loading", r.err = "", rcRender();
        var slow = setTimeout(function() {
                var m = l("#rc-msg");
                m && rcState === r && my === r.seq && (m.textContent = "Still reading — checking the page / video description…")
            }, 9e3),
            out = null,
            fail = "";
        try {
            var tok = await S();
            if (!tok) throw new Error("Please sign in again.");
            r.ctl = "undefined" != typeof AbortController ? new AbortController : null;
            var killer = setTimeout(function() {
                    r.ctl && r.ctl.abort()
                }, 12e4),
                body = isLinkOnly(r.input) ? {
                    url: r.input.trim()
                } : {
                    text: r.input
                },
                res = await fetch(t + "/functions/v1/lh-recipe-import", {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + tok,
                        apikey: n,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body),
                    signal: r.ctl ? r.ctl.signal : void 0
                });
            clearTimeout(killer);
            out = await res.json().catch(function() {
                return null
            });
            if (!res.ok && !(out && out.message)) throw new Error("Server error " + res.status);
            window.__lh.lastRecipe = out
        } catch (e) {
            fail = e && "AbortError" === e.name ? "That took too long — try again, or paste the recipe text." : String(e && e.message || e)
        }
        clearTimeout(slow);
        if (rcState !== r || my !== r.seq || "loading" !== r.step) return;
        if (!fail && out && out.error) fail = out.message || "Couldn’t read that recipe. Paste the recipe text instead.";
        if (!fail && !(out && out.ingredients && out.ingredients.length)) fail = "No ingredients found. Paste the recipe text instead.";
        if (fail) return r.step = "input", r.err = fail, void rcRender();
        out.ingredients.forEach(function(x) {
            x._on = !!rcOnList(x.name);
            var rp = !x._on && rpFor(x.name);
            x._have = !!(rp && rp.probably_have), x._ago = x._have ? rpAgo(rp) : ""
        });
        r.data = out, r.picked = out.ingredients.map(function(x) {
            return !x.staple && !x._on && !x._have
        }), r.step = "preview", rcRender()
    }
    async function rcAdd() {
        var r = rcState;
        if (!r || !r.data) return;
        var d = r.data,
            items = d.ingredients.filter(function(x, i) {
                return r.picked[i]
            }).map(function(x) {
                return {
                    name: x.name,
                    qty: rcQty(x) || null,
                    signalKind: x._have ? "recipe_recheck" : "add",
                    notes: [x.note, "Recipe: " + (d.title || "recipe"), d.source_url].filter(Boolean).join(" · ")
                }
            });
        if (!items.length) return;
        var b = l("#rc-add");
        b && (b.disabled = !0, b.textContent = "Adding " + items.length + "…");
        "needs" !== w.kind && (w.kind = "needs", se());
        var added = await ne(items);
        rcState = null, N();
        added && added.length && f("Added " + added.length + " item" + (1 === added.length ? "" : "s") + " from “" + (d.title || "recipe") + "”", 4500)
    }
    window.__lh.openRecipe = openRecipe;
    l("#add-form").onsubmit = async function(e) {
        e && e.preventDefault();
        var t = l("#item-name"),
            n = t.value.trim();
        if (!n) return t.focus();
        if ("needs" === w.kind && isLinkOnly(n)) return t.value = "", l("#recipe-chip").classList.add("hidden"), l("#suggest-chips").classList.add("hidden"), void openRecipe(n, !0);
        var a = l("#item-store").value;
        "__add__" === a && (a = "");
        var i = {
                name: n,
                qty: l("#item-qty").value.trim() || null,
                store: a || null,
                discreet: l("#item-discreet").checked
            },
            r = w.pending;
        r && Date.now() - r.at < 9e5 && (i.barcode = r.code, i.hint = r.hint), w.pending = null, t.placeholder = "Add item…", t.value = "", l("#item-qty").value = "", l("#item-store").value = "", l("#item-discreet").checked = !1, l("#suggest-chips").classList.add("hidden"), l("#split-chip").classList.add("hidden"), await ne([i]), t.focus()
    }, l("#more-toggle").onclick = function() {
        l("#more-row").classList.toggle("hidden")
    }, l("#item-store").addEventListener("change", async function() {
        if ("__add__" === this.value) {
            var e = await te(prompt("New store name?"));
            this.innerHTML = ee(e ? e.id : ""), this.value = e ? e.id : ""
        }
    }), l("#recipe-btn").onclick = function() {
        var v = l("#item-name").value.trim();
        isLinkOnly(v) ? (l("#item-name").value = "", l("#recipe-chip").classList.add("hidden"), openRecipe(v, !0)) : openRecipe("")
    }, l("#item-name").addEventListener("paste", function() {
        var el = this;
        setTimeout(function() {
            var v = el.value.trim();
            "needs" === w.kind && isLinkOnly(v) && (el.value = "", l("#recipe-chip").classList.add("hidden"), l("#suggest-chips").classList.add("hidden"), el.blur(), openRecipe(v, !0))
        }, 0)
    }), l("#item-name").addEventListener("input", function() {
        (function(v) {
            var c = l("#recipe-chip");
            if ("needs" !== w.kind || !isLinkOnly(v)) return c.classList.add("hidden"), void(c.innerHTML = "");
            c.innerHTML = '<button type="button" class="chip-btn confirm" id="recipe-chip-btn">🍳 Get the recipe’s ingredients from this link</button>', c.classList.remove("hidden"), l("#recipe-chip-btn").onclick = function() {
                var u2 = l("#item-name").value.trim();
                l("#item-name").value = "", c.classList.add("hidden"), openRecipe(u2, !0)
            }
        })(this.value);
        ie(this.value),
            function(e) {
                var t = l("#split-chip"),
                    n = /,|;|\sand\s/i.test(e || "") ? Ce(e) : [];
                if (n.length < 2) return t.classList.add("hidden"), void(t.innerHTML = "");
                t.innerHTML = '<button type="button" class="chip-btn confirm" id="split-btn">➕ Add as ' + n.length + " separate items</button>", t.classList.remove("hidden"), l("#split-btn").onclick = function() {
                    l("#item-name").value = "", t.classList.add("hidden"), ne(n)
                }
            }(this.value)
    }), u(".tab").forEach(function(e) {
        e.onclick = function() {
            w.kind = e.dataset.kind, localStorage.setItem("lh5-kind", w.kind), se()
        }
    }), l("#plan-btn").onclick = function() {
        de()
    }, l("#menu-btn") && (l("#menu-btn").onclick = function() {
        openAgentSettings()
    }), l("#export-ai-btn") && (l("#export-ai-btn").onclick = function() {
        exportListForAi()
    });
    var ue = null;

    function he() {
        return window.ZXing && window.ZXing.MultiFormatReader ? Promise.resolve(window.ZXing) : ue || (ue = new Promise(function(e, t) {
            var n = document.createElement("script");
            n.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js", n.async = !0, n.crossOrigin = "anonymous", n.onload = function() {
                window.ZXing && window.ZXing.MultiFormatReader ? e(window.ZXing) : t(new Error("scanner library missing"))
            }, n.onerror = function() {
                ue = null, t(new Error("Barcode scanner failed to load — check your connection"))
            }, document.head.appendChild(n)
        }))
    }
    document.addEventListener("pointerdown", function(e) {
        e.target && e.target.closest && e.target.closest("#barcode-btn,#scan-file-btn") && he().catch(function() {})
    }, !0);
    var pe = ["EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_128"],
        me = null,
        fe = null;

    function ge(e, t, n, a, i, r, o) {
        var s = Math.min(1, r / a),
            c = Math.max(1, Math.round(a * s)),
            d = Math.max(1, Math.round(i * s)),
            l = fe = fe || document.createElement("canvas");
        l.width = o ? d : c, l.height = o ? c : d;
        var u = l.getContext("2d", {
            willReadFrequently: !0
        });
        return u.setTransform(1, 0, 0, 1, 0, 0), o && (u.translate(d, 0), u.rotate(Math.PI / 2)), u.drawImage(e, t, n, a, i, 0, 0, c, d), u.setTransform(1, 0, 0, 1, 0, 0), l
    }

    function ve(e, t, n) {
        var a = new e.MultiFormatReader,
            i = new Map;
        i.set(e.DecodeHintType.POSSIBLE_FORMATS, pe.map(function(t) {
            return e.BarcodeFormat[t]
        })), n && i.set(e.DecodeHintType.TRY_HARDER, !0), a.setHints(i);
        var r = function(e, t, n, a) {
            for (var i = new e.HTMLCanvasElementLuminanceSource(t), r = [e.HybridBinarizer, e.GlobalHistogramBinarizer], o = 0; o < r.length; o++) try {
                return a.decode(new e.BinaryBitmap(new r[o](i)), n)
            } catch (e) {}
            return null
        }(e, t, i, a);
        return r && r.getText() ? {
            text: r.getText(),
            format: String(e.BarcodeFormat[r.getBarcodeFormat()] || "").toLowerCase()
        } : null
    }

    function be(e) {
        var t = l("#lh-scan-debug");
        t && (t.textContent = e)
    }

    function ye() {
        if (me) {
            me.stopped = !0, clearTimeout(me.timer);
            try {
                me.stream && me.stream.getTracks().forEach(function(e) {
                    e.stop()
                })
            } catch (e) {}
            var e = l("#scan-video");
            try {
                e.pause()
            } catch (e) {}
            e.srcObject = null, me = null
        }
        var t = l("#scan-modal");
        t.classList.add("hidden"), t.setAttribute("aria-hidden", "true")
    }

    function we() {
        var e = me;
        if (e && !e.stopped) {
            var t = e.video,
                n = window.ZXing,
                a = performance.now();
            if (n && t.readyState >= 2 && t.videoWidth) {
                var i, r = t.videoWidth,
                    o = t.videoHeight,
                    s = null,
                    c = e.frames++ % 3;
                try {
                    0 === c ? (i = "band", s = ve(n, ge(t, .05 * r, .28 * o, .9 * r, .44 * o, 1280, !1), !0)) : 1 === c ? (i = "full", s = ve(n, ge(t, 0, 0, r, o, 1024, !1), !1)) : (i = "rot90", s = ve(n, ge(t, .3 * r, .05 * o, .4 * r, .9 * o, 1280, !0), !0))
                } catch (t) {
                    e.errors++, e.lastErr = String(t && t.message || t).slice(0, 60)
                }
                if (e.ms = Math.round(performance.now() - a), be("frames " + e.frames + " · " + r + "×" + o + " · " + i + " " + e.ms + "ms" + (e.errors ? " · err " + e.errors + " " + e.lastErr : "")), s) return window.__lh.lastScan = {
                    rawValue: s.text,
                    format: s.format,
                    via: "live-" + i,
                    frames: e.frames
                }, ye(), void Ee(s.text)
            } else be((n ? "waiting for camera… " : "loading scanner… ") + "readyState " + t.readyState);
            e.timer = setTimeout(we, 180)
        }
    }

    function ke(e) {
        return new Promise(function(t, n) {
            var a = URL.createObjectURL(e),
                i = new Image;
            i.onload = function() {
                t({
                    img: i,
                    done: function() {
                        URL.revokeObjectURL(a)
                    }
                })
            }, i.onerror = function() {
                URL.revokeObjectURL(a), n(new Error("image"))
            }, i.src = a
        }).catch(function() {
            if (!window.createImageBitmap) throw new Error("Could not open that photo");
            return createImageBitmap(e).then(function(e) {
                return {
                    img: e,
                    done: function() {
                        e.close && e.close()
                    }
                }
            })
        })
    }
    l("#barcode-file").addEventListener("change", function() {
        var e = this.files && this.files[0];
        this.value = "", e && function(e) {
            return g("Reading barcode…"), Promise.all([he(), ke(e)]).then(function(e) {
                for (var t = e[0], n = e[1], a = n.img, i = a.naturalWidth || a.width, r = a.naturalHeight || a.height, o = null, s = 0, c = [
                        [0, 0, i, r, 1600, !1, !0],
                        [0, 0, i, r, 1024, !1, !0],
                        [0, 0, i, r, 1600, !0, !0],
                        [.1 * i, .3 * r, .8 * i, .4 * r, 1600, !1, !0],
                        [.3 * i, .1 * r, .4 * i, .8 * r, 1600, !0, !0],
                        [0, 0, i, r, 2400, !1, !0],
                        [0, 0, i, r, 800, !1, !0],
                        [0, 0, i, r, 2400, !0, !0]
                    ], d = 0; d < c.length && !o; d++) {
                    var l = c[d];
                    s++;
                    try {
                        o = ve(t, ge(a, l[0], l[1], l[2], l[3], l[4], l[5]), l[6])
                    } catch (e) {}
                }
                return n.done(), window.__lh.lastPhoto = {
                    w: i,
                    h: r,
                    tries: s,
                    ok: !!o
                }, o
            })
        }(e).then(function(e) {
            if (!e) return g(""), void f("Couldn’t find a barcode in that photo — get close so the barcode fills the frame, hold steady, avoid glare. (decode failed)", 8e3);
            window.__lh.lastScan = {
                rawValue: e.text,
                format: e.format,
                via: "photo"
            }, Ee(e.text)
        }).catch(function(e) {
            g(""), f(e && e.message || "Could not read that photo", 6e3)
        })
    }), l("#barcode-btn").onclick = function() {
        if (ye(), !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return f("Camera not available — pick a photo"), void l("#barcode-file").click();
        var e = l("#scan-video");
        e.muted = !0, e.playsInline = !0;
        var t = me = {
                video: e,
                frames: 0,
                errors: 0,
                stopped: !1
            },
            n = l("#scan-modal");
        n.classList.remove("hidden"), n.setAttribute("aria-hidden", "false"), be("starting camera…"), he().catch(function(e) {
            f(e.message)
        }), navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: {
                    ideal: "environment"
                },
                width: {
                    ideal: 1920
                },
                height: {
                    ideal: 1080
                }
            },
            audio: !1
        }).catch(function() {
            return navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment"
                },
                audio: !1
            })
        }).then(function(e) {
            if (t.stopped) e.getTracks().forEach(function(e) {
                e.stop()
            });
            else {
                t.stream = e;
                try {
                    var n = e.getVideoTracks()[0],
                        a = n.getCapabilities ? n.getCapabilities() : {};
                    a