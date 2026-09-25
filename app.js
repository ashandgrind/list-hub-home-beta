! function() {
    "use strict";
    var e, t = "https://dphkvcdohqsvefbdhsfx.supabase.co",
        n = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGt2Y2RvaHFzdmVmYmRoc2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTcxMjIsImV4cCI6MjA5OTU3MzEyMn0.Ts8vvKm8VuOYCgmtKxNQe71Ga2qjUH5jiCSlOe9vxSo",
        a = "a0000000-0000-4000-8000-000000000001",
        i = ["Food", "Household", "Personal care", "Health", "Electronics", "Pets", "Baby", "Hardware", "Clothing", "Other"],
        r = {
            Food: "🍎",
            Household: "🧻",
            "Personal care": "🧴",
            Health: "💊",
            Electronics: "🔋",
            Pets: "🐾",
            Baby: "🍼",
            Hardware: "🔧",
            Clothing: "👕",
            Other: "📦"
        },
        o = "lh5-snap",
        s = window.__lhBoot || {
            t0: Date.now()
        },
        c = {
            t0: s.t0
        };

    function d(e) {
        c[e] = Date.now() - s.t0
    }

    function l(e) {
        return document.querySelector(e)
    }

    function u(e) {
        return Array.prototype.slice.call(document.querySelectorAll(e))
    }

    function h(e) {
        return String(null == e ? "" : e).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    }

    function p(e) {
        return String(e || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)
    }

    function m(e) {
        return e ? e.charAt(0).toUpperCase() + e.slice(1) : ""
    }

    function adderLabel(e) {
        if (!e) return "";
        if (e.added_by_kind === "unknown") return "";
        var t = String(e.created_by || "").trim();
        if (!t || /^unknown$/i.test(t)) return "";
        if (e.added_by_kind === "assistant" || /shopping\s*buddy/i.test(t) || /^assistant$/i.test(t)) return "Shopping Buddy";
        if (/^chris$/i.test(t)) return "Chris";
        if (/^ellen$/i.test(t)) return "Ellen";
        return t.replace(/\b([a-z])/g, function(e) {
            return e.toUpperCase()
        })
    }

    function money(e) {
        var t = Number(e);
        return isFinite(t) ? String(Math.round(100 * t) / 100) : ""
    }

    function parseLinks(e) {
        if (!e) return [];
        if (typeof e === "string") {
            try {
                e = JSON.parse(e)
            } catch (t) {
                return String(e).split(/\s+/).filter(Boolean).map(function(e) {
                    return {
                        url: e,
                        label: ""
                    }
                })
            }
        }
        return Array.isArray(e) ? e.map(function(e) {
            if (!e) return null;
            if (typeof e === "string") return {
                url: e,
                label: ""
            };
            var t = e.url || e.href || "";
            return t ? {
                url: t,
                label: e.label || e.title || ""
            } : null
        }).filter(Boolean) : []
    }

    function formatLinks(e) {
        return parseLinks(e).map(function(e) {
            return e.label ? e.label + " " + e.url : e.url
        }).join("\n")
    }

    function linksFromText(e) {
        return String(e || "").split(/\n+/).map(function(e) {
            e = e.trim();
            if (!e) return null;
            var t = e.match(/^(.*?)(https?:\/\/\S+)$/i);
            if (t) return {
                url: t[2],
                label: t[1].trim()
            };
            return {
                url: e,
                label: ""
            }
        }).filter(Boolean)
    }

    function bestFind(e) {
        var t = (w.findsByItem[e] || []).filter(function(e) {
            return null != e.price && isFinite(Number(e.price))
        });
        return t.length ? t.slice().sort(function(e, t) {
            return Number(e.price) - Number(t.price)
        })[0] : null
    }

    function compareTarget(e, t) {
        if (null == e || null == t || !isFinite(Number(e)) || !isFinite(Number(t))) return "";
        var n = Number(t) - Number(e);
        return Math.abs(n) < .005 ? "Matches your $" + money(e) + " target." : n < 0 ? "$" + money(-n) + " under your $" + money(e) + " target." : "$" + money(n) + " over your $" + money(e) + " target."
    }

    function relTime(e) {
        if (!e) return "";
        var t = new Date(e);
        if (isNaN(t)) return "";
        var n = Math.round((t.getTime() - Date.now()) / 1e3),
            i = Math.abs(n),
            o, s;
        if (i < 45) return n >= 0 ? "in a moment" : "just now";
        if (i < 3600) o = Math.round(i / 60), s = 1 === o ? "1 min" : o + " min";
        else if (i < 86400) o = Math.round(i / 3600), s = 1 === o ? "1h" : o + "h";
        else if (i < 86400 * 14) o = Math.round(i / 86400), s = 1 === o ? "1 day" : o + " days";
        else return t.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
        });
        return n > 0 ? "in " + s : s + " ago"
    }

    function relWhen(e) {
        if (!e) return "";
        var t = new Date(e);
        if (isNaN(t)) return "";
        var n = new Date,
            i = function(e) {
                return Date.UTC(e.getFullYear(), e.getMonth(), e.getDate())
            },
            o = Math.round((i(t) - i(n)) / 864e5);
        if (t.getTime() < n.getTime()) return relTime(e);
        if (0 === o) return t.getTime() - n.getTime() < 90 * 60 * 1e3 ? relTime(e) : "today";
        if (1 === o) return "tomorrow";
        if (o < 8) return "in " + o + " days";
        return t.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
        })
    }

    function freqPhrase(e) {
        return "daily" === e ? "daily" : "weekly" === e ? "weekly" : "once"
    }

    function rememberRequest(e) {
        if (!e || !e.id) return e;
        w.findRequests = (w.findRequests || []).filter(function(t) {
            return t.id !== e.id
        });
        w.findRequests.unshift(e);
        var t = {};
        w.findRequests.forEach(function(e) {
            (t[e.item_id] = t[e.item_id] || []).push(e)
        });
        w.reqByItem = t;
        return e
    }

    function currentRequest(e) {
        var t = (w.reqByItem && w.reqByItem[e] || []).slice();
        if (!t.length) return null;
        var n = t.filter(function(e) {
            return "pending" === e.status || "active" === e.status || "paused" === e.status
        });
        return n[0] || t[0]
    }

    function requestIsOpen(e) {
        return e && ("pending" === e.status || "active" === e.status || "paused" === e.status)
    }

    function requestStatusLine(e) {
        if (!e) return "Shopping Buddy is not searching this item.";
        var t = e.last_run_at ? relTime(e.last_run_at) : "",
            n = e.next_run_at ? relWhen(e.next_run_at) : "";
        if ("cancelled" === e.status) return "Search stopped.";
        if ("done" === e.status) return "One-time search finished" + (t ? " " + t : "") + ".";
        if ("paused" === e.status) return "Paused · was searching " + freqPhrase(e.frequency) + (t ? " · last run " + t : "") + ".";
        if ("pending" === e.status && !e.last_run_at) return "once" === e.frequency ? "Queued — Shopping Buddy will search once shortly." : "Queued — searching " + freqPhrase(e.frequency) + " starting shortly.";
        var i = ["Searching " + freqPhrase(e.frequency)];
        return t && i.push("last run " + t), n && "done" !== e.status && i.push("next run " + n), i.join(", ")
    }

    function requestBadge(e) {
        if (!requestIsOpen(e)) return "";
        return "paused" === e.status ? "Paused" : "once" === e.frequency ? "Finding" : "daily" === e.frequency ? "Daily" : "Weekly"
    }

    async function hydrateExtras() {
        try {
            var e = await _().from("lh_items").select("id,notes,target_price,preferred_source,product_links,added_by_user_id,added_by_kind,created_by,created_at,preferred_store_id");
            !e.error && e.data && e.data.forEach(function(e) {
                var t = w.items.find(function(t) {
                    return t.id === e.id
                });
                t && Object.assign(t, e)
            })
        } catch (e) {}
        try {
            var t = await _().from("lh_finds").select("*");
            if (!t.error) {
                w.finds = t.data || [];
                w.findsByItem = {};
                w.finds.forEach(function(e) {
                    (w.findsByItem[e.item_id] = w.findsByItem[e.item_id] || []).push(e)
                })
            }
        } catch (e) {}
        try {
            var n = await _().from("lh_find_requests").select("*").order("created_at", {
                ascending: !1
            });
            if (!n.error) {
                w.findRequests = n.data || [];
                w.reqByItem = {};
                w.findRequests.forEach(function(e) {
                    (w.reqByItem[e.item_id] = w.reqByItem[e.item_id] || []).push(e)
                })
            }
        } catch (e) {}
    }

    function requestCardHtml(e) {
        var t = requestIsOpen(e),
            n = e && "paused" === e.status,
            i = '<div class="req-card' + (t ? "" : " muted") + '"><div class="req-k">Find options</div><div class="req-status">' + h(requestStatusLine(e)) + "</div>" + (e && e.last_summary && t ? '<div class="req-sum">' + h(e.last_summary) + "</div>" : "") + (e && (e.max_price || e.condition_pref) && t ? '<div class="item-meta">' + (e.max_price ? '<span class="badge">Max $' + h(money(e.max_price)) + "</span>" : "") + (e.condition_pref && "any" !== e.condition_pref ? '<span class="badge">' + h(e.condition_pref) + "</span>" : "") + "</div>" : "") + '<div class="req-actions"><button type="button" class="btn sm accent" id="req-opts">Find options</button>' + (t && !n ? '<button type="button" class="btn sm ghost" id="req-pause">Pause</button>' : "") + (n ? '<button type="button" class="btn sm" id="req-resume">Resume</button>' : "") + (t ? '<button type="button" class="btn sm danger" id="req-stop">Stop</button>' : "") + "</div></div>";
        return i
    }

    function openWish(e) {
        var t = (w.findsByItem[e.id] || []).slice().sort(function(e, t) {
                return new Date(t.found_at || t.created_at || 0) - new Date(e.found_at || e.created_at || 0)
            }),
            n = bestFind(e.id),
            i = Y(e.preferred_store_id),
            o = adderLabel(e),
            s = e.created_at ? new Date(e.created_at) : null,
            c = s && !isNaN(s) ? s.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric"
            }) : "",
            d = n ? compareTarget(e.target_price, n.price) : "",
            links = parseLinks(e.product_links),
            q = currentRequest(e.id),
            reqHtml = requestCardHtml(q);

        function p(e, t) {
            return '<div class="detail-row"><span class="detail-k">' + h(e) + '</span><span class="detail-v">' + t + "</span></div>"
        }
        U('<div class="modal-top"><strong>' + h(e.name) + '</strong><button class="btn ghost sm" data-close>Close</button></div><div class="detail-head">' + p("Category", h((r[e.category] || "📦") + " " + (e.category || "Other"))) + p("Added", h(c || "—") + (o ? " · " + h(o) : " · adder unknown")) + (i ? p("Preferred store", h(i.name)) : "") + (e.preferred_source ? p("Preferred source", h(e.preferred_source)) : "") + "</div>" + (n ? '<div class="deal-card"><div class="deal-price">Best find · $' + h(money(n.price)) + '</div><div class="deal-sub">' + h(n.title) + (n.source ? " · " + h(n.source) : "") + "</div>" + (d ? '<div class="deal-cmp">' + h(d) + "</div>" : "") + (n.url ? '<a class="deal-link" href="' + h(n.url) + '" target="_blank" rel="noopener">Open listing</a>' : "") + "</div>" : null != e.target_price ? '<div class="deal-card muted">No priced finds yet. Target $' + h(money(e.target_price)) + ".</div>" : '<div class="deal-card muted">No finds yet — log a deal below.</div>') + reqHtml + '<form id="wish-edit" class="wish-form"><label class="field"><span>Notes / description</span><textarea id="wish-notes" rows="3" placeholder="What you want, size, must-haves…">' + h(e.notes || "") + '</textarea></label><label class="field"><span>Target price (USD)</span><input id="wish-price" inputmode="decimal" enterkeyhint="done" placeholder="e.g. 400" value="' + h(null != e.target_price ? String(e.target_price) : "") + '"></label><label class="field"><span>Preferred store</span><select id="wish-store" class="sel">' + ee(e.preferred_store_id) + '</select></label><label class="field"><span>Preferred source / seller</span><input id="wish-source" placeholder="Amazon, eBay, FB Marketplace…" value="' + h(e.preferred_source || "") + '"></label><label class="field"><span>Product links <small>(one per line, optional “Label URL”)</small></span><textarea id="wish-links" rows="3" placeholder="https://…">' + h(formatLinks(e.product_links)) + "</textarea></label>" + (links.length ? '<div class="link-list">' + links.map(function(e) {
            return '<a href="' + h(e.url) + '" target="_blank" rel="noopener">' + h(e.label || e.url) + "</a>"
        }).join("") + "</div>" : "") + '<button class="btn primary" type="submit" id="wish-save">Save details</button></form><div class="finds-block"><div class="group-title"><span>Finds · ' + t.length + "</span></div>" + (t.length ? t.map(function(e) {
            var t = e.found_by_kind === "assistant" || /shopping\s*buddy/i.test(e.found_by || "") ? "Shopping Buddy" : e.found_by && !/^unknown$/i.test(e.found_by) ? e.found_by : "",
                n = e.found_at ? new Date(e.found_at) : null,
                a = n && !isNaN(n) ? n.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                }) : "";
            return '<article class="find-card" data-find="' + e.id + '"><div class="find-top"><strong>' + h(e.title) + "</strong>" + (null != e.price ? '<span class="find-price">$' + h(money(e.price)) + "</span>" : "") + '</div><div class="item-meta">' + (e.source ? '<span class="badge">' + h(e.source) + "</span>" : "") + (e.condition ? '<span class="badge">' + h(e.condition) + "</span>" : "") + (t ? '<span class="badge who">' + h(t) + "</span>" : "") + (a ? '<span class="badge">' + h(a) + "</span>" : "") + "</div>" + (e.notes ? '<p class="find-notes">' + h(e.notes) + "</p>" : "") + '<div class="find-actions">' + (e.url ? '<a class="btn sm" href="' + h(e.url) + '" target="_blank" rel="noopener">Open</a>' : "") + '<button type="button" class="btn ghost sm" data-delfind="' + e.id + '">Remove</button></div></article>'
        }).join("") : '<p class="hint">Nothing logged yet. Add a listing you or Shopping Buddy found.</p>') + '<form id="find-add" class="wish-form"><div class="group-title"><span>Log a find</span></div><label class="field"><span>Title</span><input id="find-title" required placeholder="Listing title" enterkeyhint="next"></label><div class="find-grid"><label class="field"><span>Price</span><input id="find-price" inputmode="decimal" placeholder="0.00"></label><label class="field"><span>Condition</span><select id="find-cond" class="sel"><option value="">—</option><option value="new">New</option><option value="used">Used</option><option value="refurb">Refurb</option></select></label></div><label class="field"><span>Source / seller</span><input id="find-source" placeholder="Amazon, eBay, FB Marketplace, Best Buy…"></label><label class="field"><span>URL</span><input id="find-url" inputmode="url" autocomplete="off" placeholder="https://"></label><label class="field"><span>Notes</span><input id="find-notes" placeholder="Optional"></label><button class="btn accent" type="submit">Add find</button></form></div>');
        var m = l("#wish-store");
        m && m.addEventListener("change", async function() {
            if ("__add__" === this.value) {
                var t = await te(prompt("New store name?"));
                this.innerHTML = ee(t ? t.id : e.preferred_store_id), this.value = t ? t.id : e.preferred_store_id || ""
            }
        });
        l("#wish-edit").onsubmit = async function(t) {
            t.preventDefault();
            var n = l("#wish-store").value;
            "__add__" === n && (n = "");
            var i = l("#wish-price").value.trim(),
                o = "" === i ? null : Number(i.replace(/[$,]/g, ""));
            if (i && !isFinite(o)) return f("Target price should be a number");
            var s = {
                notes: l("#wish-notes").value.trim() || null,
                target_price: o,
                preferred_store_id: n || null,
                preferred_source: l("#wish-source").value.trim() || null,
                product_links: linksFromText(l("#wish-links").value),
                updated_at: (new Date).toISOString()
            };
            this.querySelector("[type=submit]").disabled = !0;
            var c = await _().from("lh_items").update(s).eq("id", e.id);
            if (this.querySelector("[type=submit]").disabled = !1, c.error) return g(c.error.message, !0);
            Object.assign(e, s), se(), f("Saved “" + e.name + "”"), openWish(e)
        };
        l("#find-add").onsubmit = async function(t) {
            t.preventDefault();
            var n = l("#find-title").value.trim();
            if (!n) return;
            var i = l("#find-price").value.trim(),
                o = "" === i ? null : Number(i.replace(/[$,]/g, ""));
            if (i && !isFinite(o)) return f("Price should be a number");
            var s = {
                item_id: e.id,
                household_id: a,
                title: n,
                price: o,
                source: l("#find-source").value.trim() || null,
                url: l("#find-url").value.trim() || null,
                condition: l("#find-cond").value || null,
                notes: l("#find-notes").value.trim() || null
            };
            this.querySelector("[type=submit]").disabled = !0;
            var c = await _().from("lh_finds").insert(s).select("*").single();
            if (this.querySelector("[type=submit]").disabled = !1, c.error) return g(c.error.message, !0);
            w.finds.push(c.data), (w.findsByItem[e.id] = w.findsByItem[e.id] || []).push(c.data), se(), f("Logged find"), openWish(e)
        };
        u("[data-delfind]").forEach(function(t) {
            t.onclick = async function() {
                var n = t.dataset.delfind;
                if (t.dataset.sure !== "1") {
                    t.dataset.sure = "1";
                    t.textContent = "Tap again to remove";
                    t.classList.add("danger");
                    setTimeout(function() {
                        if (t && t.dataset) t.dataset.sure = "0", t.textContent = "Remove", t.classList.remove("danger")
                    }, 4000);
                    return
                }
                t.disabled = !0;
                var i = await _().from("lh_finds").delete().eq("id", n);
                if (i.error) return t.disabled = !1, g(i.error.message, !0);
                w.finds = w.finds.filter(function(e) {
                    return e.id !== n
                }), w.findsByItem[e.id] = (w.findsByItem[e.id] || []).filter(function(e) {
                    return e.id !== n
                }), se(), openWish(e)
            }
        });
        var reqOpts = l("#req-opts");
        reqOpts && (reqOpts.onclick = function() {
            openFindOptions(e)
        });
        var reqPause = l("#req-pause");
        reqPause && (reqPause.onclick = function() {
            setRequestStatus(e, q, "paused")
        });
        var reqResume = l("#req-resume");
        reqResume && (reqResume.onclick = function() {
            setRequestStatus(e, q, "pending", {
                next_run_at: (new Date).toISOString()
            })
        });
        var reqStop = l("#req-stop");
        reqStop && (reqStop.onclick = function() {
            setRequestStatus(e, q, "cancelled")
        })
    }

    async function setRequestStatus(e, t, n, i) {
        if (!t) return;
        var o = Object.assign({
            status: n,
            updated_at: (new Date).toISOString()
        }, i || {});
        var s = await _().from("lh_find_requests").update(o).eq("id", t.id).select("*").single();
        if (s.error) return g(s.error.message, !0);
        rememberRequest(s.data), se(), f("paused" === n ? "Search paused" : "pending" === n ? "Search resumed" : "Search stopped"), openWish(e)
    }

    function openFindOptions(e) {
        var t = currentRequest(e.id),
            n = requestIsOpen(t) ? t : null,
            i = n && n.frequency || "once",
            o = n && null != n.max_price ? String(n.max_price) : "",
            s = n && n.condition_pref || "any",
            c = n && n.notes || "";
        U('<div class="modal-top"><strong>Find options</strong><button class="btn ghost sm" data-close>Close</button></div><p class="hint">Ask Shopping Buddy to look for “' + h(e.name) + '”. Once now runs as soon as the assistant polls; Daily and Weekly keep searching.</p><form id="find-opts" class="wish-form"><div class="field"><span>How often</span><div class="freq-row" id="find-freq">' + [["once", "Once now"], ["daily", "Daily"], ["weekly", "Weekly"]].map(function(e) {
            return '<button type="button" class="chip-btn' + (e[0] === i ? " on" : "") + '" data-freq="' + e[0] + '">' + e[1] + "</button>"
        }).join("") + '</div></div><label class="field"><span>Max price (optional)</span><input id="find-max" inputmode="decimal" enterkeyhint="next" placeholder="e.g. 400" value="' + h(o) + '"></label><div class="field"><span>Condition</span><div class="freq-row" id="find-condpref">' + [["any", "Any"], ["new", "New"], ["used", "Used"]].map(function(e) {
            return '<button type="button" class="chip-btn' + (e[0] === s ? " on" : "") + '" data-cond="' + e[0] + '">' + e[1] + "</button>"
        }).join("") + '</div></div><label class="field"><span>Notes for Shopping Buddy</span><textarea id="find-req-notes" rows="3" placeholder="Size, must-haves, avoid…">' + h(c) + '</textarea></label><button class="btn primary" type="submit">' + (n ? "Update search" : "Start search") + "</button></form>");
        var freqPick = i,
            condPick = s;
        u("#find-freq [data-freq]").forEach(function(e) {
            e.onclick = function() {
                freqPick = e.dataset.freq, u("#find-freq [data-freq]").forEach(function(t) {
                    t.classList.toggle("on", t === e)
                })
            }
        });
        u("#find-condpref [data-cond]").forEach(function(e) {
            e.onclick = function() {
                condPick = e.dataset.cond, u("#find-condpref [data-cond]").forEach(function(t) {
                    t.classList.toggle("on", t === e)
                })
            }
        });
        l("#find-opts").onsubmit = async function(t) {
            t.preventDefault();
            var n = l("#find-max").value.trim(),
                i = "" === n ? null : Number(n.replace(/[$,]/g, ""));
            if (n && !isFinite(i)) return f("Max price should be a number");
            var o = {
                item_id: e.id,
                household_id: a,
                frequency: freqPick,
                max_price: i,
                condition_pref: condPick && "any" !== condPick ? condPick : "any",
                notes: l("#find-req-notes").value.trim() || null,
                status: "pending"
            };
            this.querySelector("[type=submit]").disabled = !0;
            var s = await _().from("lh_find_requests").insert(o).select("*").single();
            if (this.querySelector("[type=submit]").disabled = !1, s.error) return g(s.error.message, !0);
            rememberRequest(s.data), se(), N(), f("once" === freqPick ? "Shopping Buddy will search once" : "Searching " + freqPhrase(freqPick)), openWish(e)
        }
    }

    function f(t, n) {
        var a = l("#toast");
        a.textContent = t, a.classList.remove("hidden"), clearTimeout(e), e = setTimeout(function() {
            a.classList.add("hidden")
        }, n || 3500)
    }

    function g(e, t) {
        var n = l("#status");
        n.textContent = e || "", n.style.color = t ? "var(--danger)" : "var(--muted)"
    }

    function v(e) {
        l("#gate-info").classList.add("hidden");
        var t = l("#gate-error");
        t.textContent = e || "", t.classList.toggle("hidden", !e)
    }

    function b(e) {
        l("#gate-error").classList.add("hidden");
        var t = l("#gate-info");
        t.textContent = e || "", t.classList.toggle("hidden", !e)
    }

    function y(e) {
        document.documentElement.className = "", l("#splash").classList.toggle("hidden", "splash" !== e), l("#gate").classList.toggle("hidden", "gate" !== e), l("#app").classList.toggle("hidden", "app" !== e), w.view = e
    }
    d("script");
    var w = {
        view: null,
        session: null,
        member: null,
        who: "chris",
        displayName: "",
        kind: localStorage.getItem("lh5-kind") || "needs",
        stores: [],
        lists: [],
        items: [],
        history: [],
        prefs: [],
        cats: {},
        trips: [],
        finds: [],
        findsByItem: {},
        findRequests: [],
        reqByItem: {},
        loadedAt: 0,
        pending: null
    };
    window.__lh = {
        version: "lh6.1",
        S: w,
        T: c
    };
    var k = null;

    function _() {
        return k || (k = window.supabase.createClient(t, n, {
            auth: {
                persistSession: !0,
                autoRefreshToken: !0,
                detectSessionInUrl: !0,
                flowType: "implicit",
                storage: window.localStorage,
                lock: function(e, t, n) {
                    return n()
                }
            }
        }), window.lhSupabase = k, k.auth.onAuthStateChange(function(e, t) {
            (window.__lh.events = window.__lh.events || []).push(e), setTimeout(function() {
                ! function(e, t) {
                    if ("SIGNED_OUT" === e) return w.session = null, void("app" === w.view && y("gate"));
                    "PASSWORD_RECOVERY" === e && (s.recovery = !0), !t || "SIGNED_IN" !== e && "PASSWORD_RECOVERY" !== e && "INITIAL_SESSION" !== e && "TOKEN_REFRESHED" !== e && "USER_UPDATED" !== e || (w.session = t, "app" === w.view || T ? s.recovery && "app" === w.view && H() : x(t), P())
                }(e, t)
            }, 0)
        }), k)
    }
    async function S() {
        try {
            var e = await _().auth.getSession();
            e.data.session && (w.session = e.data.session)
        } catch (e) {}
        return w.session && w.session.access_token
    }
    var T = null;

    function L(e, t) {
        try {
            localStorage.setItem(o, JSON.stringify({
                email: e,
                at: Date.now(),
                data: t
            }))
        } catch (e) {}
    }

    function E(e) {
        w.member = e.member, w.stores = e.stores || [], w.lists = e.lists || [], w.items = e.items || [], w.history = e.history || [], w.prefs = e.prefs || [], w.cats = e.cats || {}, w.trips = e.trips || [], w.displayName = e.member && e.member.display_name || "Member", w.who = p(w.displayName) || "chris"
    }
    async function C() {
        var e = await _().rpc("lh_bootstrap");
        if (e.error) throw e.error;
        return e.data
    }
    async function x(e) {
        if (T) return T;
        T = async function() {
            w.session = e;
            var t = p(e.user && e.user.email),
                n = function(e) {
                    try {
                        var t = JSON.parse(localStorage.getItem(o) || "null");
                        if (t && t.email === e && t.data) return t.data
                    } catch (e) {}
                    return null
                }(t);
            n && n.member && (E(n), y("app"), se(), d("cachedUI"), g("Syncing…"));
            try {
                var a = await C();
                if (d("bootstrap"), !a || !a.member) return await _().auth.signOut(), y("gate"), void v("This email isn’t on the Pollock household. Ask Chris to add you.");
                E(a), L(t, a), w.loadedAt = Date.now(), a.member.user_id || _().rpc("lh_claim_member").then(function() {}, function() {}), await hydrateExtras(), y("app"), se(), g(""), d("signedIn"), P(), H()
            } catch (e) {
                d("bootstrapErr"), n ? g("Offline — showing saved list (" + (e.message || "network") + ")", !0) : (y("gate"), v("Signed in, but couldn’t load your list: " + (e.message || "network error") + ". Try again."))
            }
        }();
        try {
            await T
        } finally {
            T = null
        }
    }
    async function O() {
        try {
            var e = await C();
            e && e.member && (E(e), L(p(w.session.user.email), e), w.loadedAt = Date.now(), await hydrateExtras(), se())
        } catch (e) {
            g(e.message || "Refresh failed", !0)
        }
    }
    async function I(e) {
        try {
            var t = await _().rpc("lh_auth_hint", {
                p_email: e
            });
            return t.error ? null : t.data
        } catch (e) {
            return null
        }
    }

    function A(e) {
        return /security purposes|rate limit|429|seconds/i.test(e || "") ? "An email was just sent — please wait about a minute before requesting another, and check your inbox (and spam)." : e
    }
    async function M() {
        var e = p(l("#login-email").value);
        if (v(""), b(""), !e) return v("Enter your email");
        var t = l("#magic-btn");
        t.disabled = !0;
        try {
            var n = await I(e);
            if (n && !n.member) return v("That email isn’t on this household. Only Chris & Ellen can sign in.");
            var a = await _().auth.signInWithOtp({
                email: e,
                options: {
                    emailRedirectTo: location.origin + "/",
                    shouldCreateUser: !0
                }
            });
            if (a.error) return v(A(a.error.message));
            b("Link sent to " + e + ". Open it on this phone — it signs you in right away.")
        } catch (e) {
            v(e.message || "Could not send link")
        } finally {
            t.disabled = !1
        }
    }

    function j(e, t, n) {
        var a = l("#pw-note");
        a.innerHTML = e || "", a.classList.toggle("hidden", !e), l("#pw-setup-btn").classList.toggle("hidden", !t), l("#pw-create-btn").classList.toggle("hidden", !n)
    }
    document.addEventListener("visibilitychange", function() {
        !document.hidden && "app" === w.view && Date.now() - w.loadedAt > 3e4 && O()
    }), l("#splash-retry").onclick = function() {
        y("gate")
    }, u(".auth-tab").forEach(function(e) {
        e.onclick = function() {
            u(".auth-tab").forEach(function(t) {
                t.classList.toggle("active", t === e)
            }), l("#auth-magic").classList.toggle("hidden", "magic" !== e.dataset.auth), l("#auth-password").classList.toggle("hidden", "password" !== e.dataset.auth);
            var t = l("#login-email").value,
                n = l("#pw-email").value;
            t && !n && (l("#pw-email").value = t), n && !t && (l("#login-email").value = n), v(""), b("")
        }
    });
    var q = 0;
    async function D() {
        var e = p(l("#pw-email").value),
            t = l("#pw-password").value || "";
        if (v(""), b(""), j(""), q++, !e || !t) return v("Enter your email and password");
        var n = l("#pw-signin-btn");
        n.disabled = !0, n.textContent = "Signing in…";
        try {
            var a = await _().auth.signInWithPassword({
                email: e,
                password: t
            });
            if (a.error) {
                var i = await I(e);
                return i && !i.member ? v("That email isn’t on this household.") : i && !i.account ? j("There’s no account for <b>" + h(e) + "</b> yet. Tap <b>Create my password</b> to make one with the password you typed.", !1, !0) : i && !i.password_set ? j("<b>This account doesn’t have a password yet.</b> It was created with an email sign-in link, so no password you’ve used elsewhere will work here. Tap below to get a one-time link that lets you choose a password (or just use the Email link tab).", !0, !1) : j("That password didn’t match. Forgot it? Tap below and we’ll email you a link to set a new one.", !0, !1)
            }
            await x(a.data.session)
        } catch (e) {
            v(e.message || "Sign-in failed")
        } finally {
            n.disabled = !1, n.textContent = "Sign in"
        }
    }
    async function R() {
        var e = p(l("#pw-email").value || l("#login-email").value);
        if (v(""), !e) return v("Enter your email first");
        var t = await I(e);
        if (t && !t.member) return v("That email isn’t on this household.");
        if (t && !t.account) return j("No account for this email yet — type the password you want and tap <b>Create my password</b>.", !1, !0);
        var n = await _().auth.resetPasswordForEmail(e, {
            redirectTo: location.origin + "/"
        });
        if (n.error) return v(A(n.error.message));
        j("Sent! Open the email on this phone and tap the link — you’ll be signed in and asked to choose your password.", !1, !1)
    }

    function P() {
        var e, t = l("#setpw-btn");
        t && t.classList.toggle("hidden", !w.session || !!((e = w.session && w.session.user) && e.user_metadata && e.user_metadata.has_password))
    }

    function H() {
        s.recovery && w.session && (s.recovery = !1, z("Choose your password", "You opened a password link for " + h(w.session.user.email) + ". Pick a password so you can use the Password tab next time."))
    }

    function z(e, t) {
        U('<div class="modal-top"><strong>' + h(e) + '</strong><button class="btn ghost sm" data-close>Close</button></div><p class="hint">' + t + '</p><label class="field"><span>New password</span><input id="np1" type="password" autocomplete="new-password" placeholder="At least 6 characters"></label><label class="field"><span>Confirm</span><input id="np2" type="password" autocomplete="new-password"></label><button class="btn primary" id="np-save">Save password</button><p class="error hidden" id="np-err"></p>'), setTimeout(function() {
            var e = l("#np1");
            e && e.focus()
        }, 60), l("#np-save").onclick = async function() {
            var e = l("#np1").value,
                t = l("#np2").value,
                n = l("#np-err");

            function a(e) {
                n.textContent = e, n.classList.remove("hidden")
            }
            if (!e || e.length < 6) return a("At least 6 characters");
            if (e !== t) return a("Passwords don’t match");
            this.disabled = !0;
            var i = await _().auth.updateUser({
                password: e,
                data: {
                    has_password: !0
                }
            });
            if (this.disabled = !1, i.error) return a(i.error.message);
            i.data && i.data.user && w.session && (w.session.user = i.data.user), N(), P(), f("Password saved — you can use the Password tab from now on.", 5e3)
        }
    }

    function U(e) {
        var t = l("#sheet");
        l("#sheet-card").innerHTML = e, t.classList.remove("hidden"), t.setAttribute("aria-hidden", "false"), u("#sheet [data-close]").forEach(function(e) {
            e.onclick = N
        })
    }

    function N() {
        var e = l("#sheet");
        e.classList.add("hidden"), e.setAttribute("aria-hidden", "true"), l("#sheet-card").innerHTML = ""
    }
    l("#magic-btn").onclick = M, l("#login-email").addEventListener("keydown", function(e) {
        "Enter" === e.key && (e.preventDefault(), M())
    }), l("#pw-signin-btn").onclick = D, l("#pw-password").addEventListener("keydown", function(e) {
        "Enter" === e.key && (e.preventDefault(), D())
    }), l("#pw-setup-btn").onclick = R, l("#pw-create-btn").onclick = async function() {
        var e = p(l("#pw-email").value),
            t = l("#pw-password").value || "";
        if (v(""), !e || t.length < 6) return v("Type your email and a password (6+ characters)");
        var n = await I(e);
        if (n && !n.member) return v("That email isn’t on this household.");
        var a = await _().auth.signUp({
            email: e,
            password: t,
            options: {
                emailRedirectTo: location.origin + "/",
                data: {
                    has_password: !0
                }
            }
        });
        return a.error ? v(A(a.error.message)) : a.data.session ? x(a.data.session) : void j("Account created — check your email to confirm, then sign in.", !1, !1)
    }, l("#pw-forgot").onclick = function(e) {
        e.preventDefault(), R()
    }, l("#pw-email").addEventListener("change", async function() {
        var e = p(this.value);
        if (e) {
            var t = ++q,
                n = await I(e);
            t === q && (n && n.member && n.account && !n.password_set ? j("Heads up: this account has no password yet (it was made with an email link). Use the Email link tab, or tap below to set a password.", !0, !1) : n && n.member && !n.account ? j("No account yet for this email — type a password and tap <b>Create my password</b>.", !1, !0) : j(""))
        }
    }), l("#signout-btn").onclick = async function() {
        ye();
        try {
            await _().auth.signOut()
        } catch (e) {}
        try {
            localStorage.removeItem(o)
        } catch (e) {}
        w.session = null, y("gate"), v(""), b("Signed out.")
    }, l("#setpw-btn").onclick = function() {
        z("Set a password", "Lets you sign in with email + password when you don’t want to wait for an email.")
    }, l("#sheet").addEventListener("click", function(e) {
        e.target === this && N()
    });
    var B = [
        ["Pets", /\b(dog|dogs|puppy|cat|cats|kitten|kitty|pet|pets|litter|kibble|flea|chew toy|bird ?seed|fish food|aquarium|leash|collar|purina|friskies|meow mix|pedigree|milk-bone|greenies)\b/],
        ["Baby", /\b(baby|babies|diaper|diapers|wipes|formula|pacifier|infant|toddler|onesie|sippy|pampers|huggies|teether)\b/],
        ["Health", /\b(medicine|meds|tylenol|advil|ibuprofen|acetaminophen|aspirin|allergy|claritin|zyrtec|benadryl|vitamins?|multivitamin|band-?aids?|bandages?|first aid|thermometer|cough|nyquil|dayquil|antacid|tums|pepto|prescription|isopropyl|rubbing alcohol|hydrogen peroxide|neosporin|melatonin|probiotic|contact solution|covid test|gauze)\b/],
        ["Personal care", /\b(shampoo|conditioner|soap|body wash|toothpaste|toothbrush|floss|mouthwash|deodorant|antiperspirant|razors?|shaving|lotion|moisturizer|sunscreen|makeup|mascara|lipstick|lip balm|chapstick|tampons?|feminine|q-?tips|cotton swabs|cotton balls|hair gel|hairspray|hair ties|nail polish|perfume|cologne|face wash|cleanser|dry shampoo|dove|olay|colgate|crest|gillette|old spice)\b/],
        ["Electronics", /\b(batter(y|ies)|aa|aaa|9v|charger|charging|cable|usb|usb-c|lightning cable|hdmi|headphones|earbuds|airpods|phone case|power bank|adapter|smart plug|sd card|memory card|flash drive|mouse|keyboard|printer ink|ink cartridge|toner|remote|duracell|energizer)\b/],
        ["Hardware", /\b(screws?|nails|bolts?|drill|hammer|wrench|screwdriver|pliers|tape measure|duct tape|electrical tape|super glue|caulk|paint|primer|sandpaper|wd-?40|zip ties|hose|mulch|fertilizer|potting soil|seeds|weed killer|lawn|garden|extension cord|air filter|furnace filter|motor oil|wiper|antifreeze|ladder|hinge|anchors)\b/],
        ["Clothing", /\b(socks?|shirts?|t-shirts?|tees?|pants|jeans|shorts|underwear|boxers|bras?|dress|skirt|jacket|coat|hoodie|sweater|shoes|sneakers|boots|sandals|slippers|hat|gloves|scarf|belt|pajamas|leggings|swimsuit)\b/],
        ["Household", /\b(paper towels?|toilet paper|tissues?|kleenex|napkins|trash bags?|garbage bags?|dish soap|dishwasher|detergent|laundry|fabric softener|dryer sheets|bleach|cleaner|lysol|clorox|windex|sponges?|mop|broom|swiffer|vacuum|aluminum foil|foil|plastic wrap|saran|ziploc|zip-?lock|sandwich bags|storage bags|parchment|wax paper|light ?bulbs?|candles?|air freshener|febreze|matches|lighter|paper plates|plastic cups|cutlery|tide|downy|bounty|charmin|cascade|dawn|glad|hefty|oxiclean|magic eraser)\b/],
        ["Food", /\b(milk|eggs?|bread|butter|cheese|yogurt|yoghurt|cream|juice|coffee|tea|water|soda|beer|wine|seltzer|banana|bananas|apples?|oranges?|lemons?|limes?|grapes|berries|strawberr(y|ies)|blueberr(y|ies)|avocados?|tomato(es)?|potato(es)?|onions?|garlic|lettuce|spinach|kale|carrots?|celery|broccoli|peppers?|cucumbers?|mushrooms?|corn|beans|rice|pasta|spaghetti|noodles|flour|sugar|salt|olive oil|oil|vinegar|ketchup|mustard|mayo|mayonnaise|sauce|salsa|chips|crackers|cookies|cereal|oats|oatmeal|granola|snacks?|nuts|peanut butter|jelly|jam|honey|syrup|chicken|beef|steak|pork|bacon|sausage|ham|turkey|fish|salmon|tuna|shrimp|tofu|frozen|pizza|ice cream|soup|broth|spices?|cinnamon|vanilla|bagels?|tortillas?|buns|muffins|cake|chocolate|candy|gum|popcorn|pretzels|hummus|deli|lunch meat|fruit|veggies|vegetables|produce|creamer|half and half|sour cream|cottage cheese|kombucha|gatorade|coke|pepsi|sprite|la croix)\b/]
    ];

    function F(e) {
        for (var t = " " + p(e) + " ", n = 0; n < B.length; n++)
            if (B[n][1].test(t)) return B[n][0];
        return null
    }

    function V(e, t) {
        var n = p(e);
        if (w.cats[n]) return {
            category: w.cats[n],
            source: "cache"
        };
        var a = w.history.find(function(e) {
            return e.name_key === n && e.category
        });
        if (a) return {
            category: a.category,
            source: "cache"
        };
        if (t && t.category) return {
            category: t.category,
            source: "barcode"
        };
        var i = F(e);
        return {
            category: i || "Other",
            source: "local",
            unknown: !i
        }
    }
    var Z = [],
        G = null;

    function J(e, t) {
        Z.push({
            id: e.id,
            name: e.name,
            hint: t || null
        }), clearTimeout(G), G = setTimeout(W, 250)
    }
    async function W() {
        var e = Z.splice(0, 25);
        if (e.length) {
            var a = await S();
            if (a) {
                var i;
                try {
                    var r = await fetch(t + "/functions/v1/lh-categorize", {
                        method: "POST",
                        headers: {
                            Authorization: "Bearer " + a,
                            apikey: n,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            items: e.map(function(e) {
                                return {
                                    name: e.name,
                                    hint: e.hint
                                }
                            })
                        })
                    });
                    i = await r.json()
                } catch (e) {
                    return void(window.__lh.lastAI = {
                        error: String(e)
                    })
                }
                if (window.__lh.lastAI = i, i && i.results) {
                    var o = !1;
                    e.forEach(function(e, t) {
                        var n = i.results[t];
                        if (n && n.category) {
                            w.cats[p(e.name)] = n.category;
                            var a = w.items.find(function(t) {
                                return t.id === e.id
                            });
                            a && "user" !== a.category_source && (a.category === n.category && "ai" === a.category_source || (a.category = n.category, a.category_source = "ai", o = !0, _().from("lh_items").update({
                                category: n.category,
                                category_source: "ai",
                                updated_at: (new Date).toISOString()
                            }).eq("id", a.id).then(function() {}, function() {})))
                        }
                    }), o && se(), Z.length && W()
                }
            }
        }
    }

    function X(e) {
        return w.lists.find(function(t) {
            return t.kind === e
        }) || ("needs" === e ? w.lists.find(function(e) {
            return "grocery" === e.kind
        }) : null)
    }

    function Y(e) {
        return w.stores.find(function(t) {
            return t.id === e
        }) || null
    }

    function K(e) {
        var t = X(e);
        return t ? w.items.filter(function(e) {
            return e.list_id === t.id
        }) : []
    }

    function $(e) {
        return K(e).filter(function(e) {
            return "needed" === e.status
        })
    }

    function Q(e) {
        var t = p(e),
            n = w.prefs.find(function(e) {
                return e.name_key === t
            }) || w.history.find(function(e) {
                return e.name_key === t && e.preferred_store_id
            });
        return n ? n.preferred_store_id : null
    }

    function ee(e) {
        return '<option value="">Any store (optional)</option>' + w.stores.map(function(t) {
            return '<option value="' + t.id + '"' + (e === t.id ? " selected" : "") + ">" + h(t.name) + "</option>"
        }).join("") + '<option value="__add__">+ Add store…</option>'
    }
    async function te(e) {
        if (!(e = String(e || "").trim())) return null;
        for (var t = p(e).replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "store", n = t, i = 2; w.stores.some(function(e) {
                return e.slug === t
            });) t = n + "-" + i++;
        var r = await _().from("lh_stores").insert({
            household_id: a,
            name: e,
            slug: t,
            kind: "other",
            sort_order: 50,
            active: !0
        }).select("*").single();
        return r.error ? (g(r.error.message, !0), null) : (w.stores.push(r.data), f("Added store " + r.data.name), r.data)
    }
    async function ne(e) {
        var t = X(w.kind);
        if (!t) return g("List not found — refresh", !0);
        var n = [];
        g("Adding" + (e.length > 1 ? " " + e.length : "") + "…");
        for (var a = 0; a < e.length; a++) {
            var i = e[a];
            if (i.name) {
                var r = V(i.name, i.hint),
                    o = i.store || Q(i.name) || null,
                    s = {
                        list_id: t.id,
                        name: i.name,
                        qty: i.qty || null,
                        preferred_store_id: o,
                        discreet: !!i.discreet,
                        status: "needed",
                        created_by: w.who,
                        category: r.category,
                        category_source: r.source,
                        barcode: i.barcode || null
                    },
                    c = await _().from("lh_items").insert(s).select("*").single();
                if (c.error) {
                    g(c.error.message, !0);
                    break
                }
                w.items.push(c.data), n.push(c.data), ("local" === r.source || "barcode" === r.source && i.hint && i.hint.text) && J(c.data, i.hint && i.hint.text), ae(i.name, o)
            }
        }
        return se(), n.length && (g(""), f("Added " + (1 === n.length ? "“" + n[0].name + "”" : n.length + " items"))), n
    }

    function ae(e, t) {
        var n = p(e);
        if (n) {
            var i = w.prefs.find(function(e) {
                    return e.name_key === n
                }),
                r = {
                    household_id: a,
                    name_key: n,
                    preferred_store_id: t || i && i.preferred_store_id || null,
                    use_count: (i && i.use_count || 0) + 1,
                    last_used_at: (new Date).toISOString()
                };
            i ? Object.assign(i, r) : w.prefs.push(r);
            var o = w.history.find(function(e) {
                return e.name_key === n
            });
            o ? o.count++ : w.history.unshift({
                name: e,
                name_key: n,
                count: 1
            }), _().from("lh_item_prefs").upsert(r, {
                onConflict: "household_id,name_key"
            }).then(function() {}, function() {})
        }
    }

    function ie(e) {
        var t = l("#suggest-chips"),
            n = p(e);
        if (!n) return t.classList.add("hidden"), void(t.innerHTML = "");
        var a = w.history.filter(function(e) {
            return e.name_key && e.name_key !== n && (e.name_key.indexOf(n) >= 0 || n.length > 3 && n.indexOf(e.name_key) >= 0)
        }).slice(0, 8);
        if (!a.length) return t.classList.add("hidden"), void(t.innerHTML = "");
        t.innerHTML = a.map(function(e, t) {
            return '<button type="button" class="chip-btn" data-s="' + t + '">' + h(e.name) + (e.qty ? " · " + h(e.qty) : "") + "</button>"
        }).join(""), t.classList.remove("hidden"), u("#suggest-chips [data-s]").forEach(function(e) {
            e.onclick = function() {
                var n = a[+e.dataset.s];
                l("#item-name").value = n.name, n.qty && (l("#item-qty").value = n.qty), t.classList.add("hidden"), l("#item-name").focus()
            }
        })
    }

    function re(e) {
        var t = {};
        return e.forEach(function(e) {
            var n = e.category || "Other";
            (t[n] = t[n] || []).push(e)
        }), i.filter(function(e) {
            return t[e]
        }).map(function(e) {
            return [e, t[e]]
        })
    }

    function oe(e) {
        var t = Y(e.preferred_store_id),
            n = adderLabel(e),
            i = bestFind(e.id),
            o = "wish" === w.kind,
            q = currentRequest(e.id),
            z = requestBadge(q);
        return '<article class="item' + ("needed" !== e.status ? " checked" : "") + (o ? " wish-item" : "") + '" data-id="' + e.id + '"><button class="check-btn" type="button" data-act="toggle" aria-label="Got it">✓</button><div class="item-body"' + (o ? ' data-act="detail" role="button" tabindex="0"' : "") + '><div class="item-name">' + h(e.name) + '</div><div class="item-meta"><span class="badge cat' + ("local" === e.category_source ? " guess" : "") + '" data-act="cat" title="Tap to change category">' + (r[e.category] || "📦") + " " + h(e.category || "Other") + "</span>" + (e.qty ? '<span class="badge">' + h(e.qty) + "</span>" : "") + (t ? '<span class="badge">' + h(t.name) + "</span>" : "") + (e.preferred_source ? '<span class="badge">' + h(e.preferred_source) + "</span>" : "") + (e.discreet ? '<span class="badge discreet">Discreet</span>' : "") + (n ? '<span class="badge who">' + h(n) + "</span>" : "") + (i ? '<span class="badge deal">Best $' + h(money(i.price)) + "</span>" : "") + (z ? '<span class="badge search">' + h(z) + "</span>" : "") + (o ? '<span class="badge more">Details</span>' : "") + '</div></div>' + (o ? '<button class="find-btn" type="button" data-act="findopts" aria-label="Find options">🔎</button>' : "") + '<button class="x-btn" type="button" data-act="del" aria-label="Delete">✕</button></article>'
    }

    function se() {
        if (w.member) {
            l("#who-line").textContent = "Signed in as " + w.displayName, u(".tab").forEach(function(e) {
                e.classList.toggle("active", e.dataset.kind === w.kind)
            }), l("#n-needs").textContent = $("needs").length || "", l("#n-wish").textContent = $("wish").length || "";
            var e = l("#item-store"),
                t = e.value;
            e.innerHTML = ee(t), w.pending || (l("#item-name").placeholder = "wish" === w.kind ? "Add to wishlist…" : "Add item…"), l("#trip-banners").innerHTML = "needs" === w.kind ? w.trips.map(function(e) {
                var t = e.items.length,
                    n = e.items.filter(function(e) {
                        return e.checked
                    }).length;
                return '<div class="trip-banner"><span>🛒 ' + h(e.store_name) + " trip · " + n + "/" + t + ' in cart</span><button class="btn sm" data-trip="' + e.id + '" type="button">Open</button></div>'
            }).join("") : "", u("#trip-banners [data-trip]").forEach(function(e) {
                e.onclick = function() {
                    le(e.dataset.trip)
                }
            }), l("#plan-bar").classList.toggle("hidden", "needs" !== w.kind);
            var n = K(w.kind),
                o = n.filter(function(e) {
                    return "needed" === e.status
                }),
                s = n.filter(function(e) {
                    return "needed" !== e.status
                }),
                c = {};
            w.trips.forEach(function(e) {
                e.items.forEach(function(t) {
                    t.item_id && (c[t.item_id] = e.store_name)
                })
            });
            var d = l("#items");
            if (n.length) {
                d.innerHTML = re(o).map(function(e) {
                    return '<section class="group" data-cat="' + h(e[0]) + '"><div class="group-title"><span>' + r[e[0]] + " " + h(e[0]) + " · " + e[1].length + "</span></div>" + e[1].map(oe).join("") + "</section>"
                }).join("") + (o.length ? "" : '<div class="empty">All done here.</div>') + (s.length ? '<section class="group"><div class="group-title"><span>Got it · ' + s.length + '</span><button class="btn ghost sm" id="clear-done" type="button">Clear</button></div>' + s.map(oe).join("") + "</section>" : ""), u("#items .item").forEach(function(e) {
                    var t = w.items.find(function(t) {
                        return t.id === e.dataset.id
                    });
                    t && (c[t.id] && "needed" === t.status && e.querySelector(".item-meta").insertAdjacentHTML("beforeend", '<span class="badge">🛒 ' + h(c[t.id]) + " trip</span>"), e.querySelector('[data-act="toggle"]').onclick = function() {
                        !async function(e) {
                            var t = "needed" === e.status ? "checked" : "needed";
                            e.status = t, se();
                            var n = await _().from("lh_items").update({
                                status: t,
                                updated_at: (new Date).toISOString()
                            }).eq("id", e.id);
                            n.error && g(n.error.message, !0)
                        }(t)
                    }, e.querySelector('[data-act="del"]').onclick = function() {
                        !async function(e) {
                            w.items = w.items.filter(function(t) {
                                return t !== e
                            }), se();
                            var t = await _().from("lh_items").delete().eq("id", e.id);
                            t.error ? (g(t.error.message, !0), O()) : f("Deleted “" + e.name + "”")
                        }(t)
                    },                     (e.querySelector('[data-act="detail"]') || {onclick: null}).onclick = function(n) {
                        if (!(n && n.target && n.target.closest && n.target.closest('[data-act="cat"], [data-act="findopts"]'))) openWish(t)
                    }, (e.querySelector('[data-act="findopts"]') || {onclick: null}).onclick = function(n) {
                        n && n.stopPropagation && n.stopPropagation();
                        openFindOptions(t)
                    }, e.querySelector('[data-act="cat"]').onclick = function(n) {
                        n && n.stopPropagation && n.stopPropagation();
                        var e;
                        U('<div class="modal-top"><strong>Category for “' + h((e = t).name) + '”</strong><button class="btn ghost sm" data-close>Close</button></div><div class="cat-grid">' + i.map(function(t) {
                            return '<button class="chip-btn' + (t === e.category ? " on" : "") + '" data-cat="' + h(t) + '">' + r[t] + " " + h(t) + "</button>"
                        }).join("") + '</div><p class="hint">We’ll remember this for next time.</p>'), u("#sheet [data-cat]").forEach(function(t) {
                            t.onclick = async function() {
                                var n = t.dataset.cat;
                                N(), e.category = n, e.category_source = "user", w.cats[p(e.name)] = n, se();
                                var i = await _().from("lh_items").update({
                                    category: n,
                                    category_source: "user",
                                    updated_at: (new Date).toISOString()
                                }).eq("id", e.id);
                                if (i.error) return g(i.error.message, !0);
                                _().from("lh_category_cache").upsert({
                                    household_id: a,
                                    name_key: p(e.name),
                                    category: n,
                                    source: "user",
                                    updated_at: (new Date).toISOString()
                                }, {
                                    onConflict: "household_id,name_key"
                                }).then(function() {}, function() {})
                            }
                        })
                    })
                });
                var m = l("#clear-done");
                m && (m.onclick = ce)
            } else d.innerHTML = '<div class="empty">' + ("wish" === w.kind ? "Wishlist is empty. Add things you’d like someday." : "Nothing on the List. Add what you need — we’ll sort it.") + "</div>"
        }
    }
    async function ce() {
        var e = K(w.kind).filter(function(e) {
            return "needed" !== e.status
        }).map(function(e) {
            return e.id
        });
        if (e.length) {
            w.items = w.items.filter(function(t) {
                return e.indexOf(t.id) < 0
            }), se();
            var t = (new Date).toISOString(),
                n = await _().from("lh_items").update({
                    status: "bought",
                    bought_at: t,
                    updated_at: t
                }).in("id", e);
            n.error && (g(n.error.message, !0), O())
        }
    }

    function de(e) {
        var t = {
            storeId: e || null,
            picked: {}
        };

        function n() {
            t.picked = {}, $("needs").forEach(function(e) {
                t.storeId && e.preferred_store_id === t.storeId && (t.picked[e.id] = !0)
            })
        }
        n(),
            function e() {
                var o = $("needs"),
                    s = Object.keys(t.picked).filter(function(e) {
                        return t.picked[e]
                    }).length,
                    c = Y(t.storeId);
                U('<div class="modal-top"><strong>Plan a trip</strong><button class="btn ghost sm" data-close>Close</button></div><p class="hint" style="margin-top:0">Where are you going?</p><div class="chips" id="trip-stores">' + w.stores.map(function(e) {
                    return '<button class="chip-btn' + (t.storeId === e.id ? " on" : "") + '" data-store="' + e.id + '">' + h(e.name) + "</button>"
                }).join("") + '<button class="chip-btn" data-store="__new__">+ Other store…</button></div><p class="hint">Tick what to get on this trip:</p>' + (o.length ? re(o).map(function(e) {
                    return '<div class="group-title"><span>' + r[e[0]] + " " + h(e[0]) + '</span><button class="btn ghost sm" data-allcat="' + h(e[0]) + '">All</button></div>' + e[1].map(function(e) {
                        var n = Y(e.preferred_store_id);
                        return '<div class="pick" data-pick="' + e.id + '"><span class="check-btn' + (t.picked[e.id] ? " on" : "") + '">✓</span><div class="item-body"><div class="item-name">' + h(e.name) + '</div><div class="item-meta">' + (e.qty ? '<span class="badge">' + h(e.qty) + "</span>" : "") + (n ? '<span class="badge">' + h(n.name) + "</span>" : "") + "</div></div></div>"
                    }).join("")
                }).join("") : '<div class="empty">The List is empty — add items first.</div>') + '<div class="sheet-foot"><button class="btn primary" id="trip-start"' + (s && c ? "" : " disabled") + ">" + (c ? "Start " + h(c.name) + " trip · " + s + " item" + (1 === s ? "" : "s") : "Pick a store") + "</button></div>"), u("#sheet [data-store]").forEach(function(a) {
                    a.onclick = async function() {
                        if ("__new__" === a.dataset.store) {
                            var i = await te(prompt("Store name?"));
                            if (!i) return;
                            t.storeId = i.id
                        } else t.storeId = a.dataset.store;
                        n(), e()
                    }
                }), u("#sheet [data-pick]").forEach(function(n) {
                    n.onclick = function() {
                        var a = n.dataset.pick;
                        t.picked[a] = !t.picked[a], e()
                    }
                }), u("#sheet [data-allcat]").forEach(function(n) {
                    n.onclick = function() {
                        $("needs").forEach(function(e) {
                            (e.category || "Other") === n.dataset.allcat && (t.picked[e.id] = !0)
                        }), e()
                    }
                });
                var d = l("#trip-start");
                d && (d.onclick = function() {
                    !async function(e) {
                        var t = Y(e.storeId);
                        if (t) {
                            var n = Object.keys(e.picked).filter(function(t) {
                                    return e.picked[t]
                                }),
                                r = l("#trip-start");
                            r && (r.disabled = !0);
                            var o = await _().from("lh_trips").insert({
                                household_id: a,
                                store_id: t.id,
                                store_name: t.name,
                                status: "active",
                                created_by: w.who,
                                export_target: t.app_hint || null
                            }).select("*").single();
                            if (o.error) return r && (r.disabled = !1), g(o.error.message, !0);
                            var s = o.data;
                            s.items = [];
                            var c = n.map(function(e, t) {
                                var n = w.items.find(function(t) {
                                    return t.id === e
                                });
                                return {
                                    trip_id: s.id,
                                    household_id: a,
                                    item_id: e,
                                    name: n.name,
                                    qty: n.qty,
                                    category: n.category,
                                    sort_order: 1e3 * i.indexOf(n.category || "Other") + t
                                }
                            });
                            if (c.length) {
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
                s = {};
            t.items.forEach(function(e) {
                var t = e.category || "Other";
                (s[t] = s[t] || []).push(e)
            });
            var c = t.export_target || (Y(t.store_id) || {}).app_hint;
            U('<div class="modal-top"><strong>🛒 ' + h(t.store_name) + ' trip</strong><button class="btn ghost sm" data-close>Close</button></div><p class="hint" style="margin-top:0" id="trip-count">' + o + " of " + n + " in the cart. Tap items as you grab them.</p>" + i.filter(function(e) {
                return s[e]
            }).map(function(e) {
                return '<div class="group-title"><span>' + r[e] + " " + h(e) + "</span></div>" + s[e].map(function(e) {
                    return '<div class="pick" data-ti="' + e.id + '"><span class="check-btn' + (e.checked ? " on" : "") + '">✓</span><div class="item-body"><div class="item-name" style="' + (e.checked ? "text-decoration:line-through;color:var(--muted)" : "") + '">' + h(e.name) + "</div>" + (e.qty ? '<div class="item-meta"><span class="badge">' + h(e.qty) + "</span></div>" : "") + "</div></div>"
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
                            return '<div class="pick" data-p="' + e.id + '"><span class="check-btn' + (r[e.id] ? " on" : "") + '">✓</span><div class="item-body"><div class="item-name">' + h(e.name) + '</div><div class="item-meta"><span class="badge">' + h(e.category || "Other") + "</span></div></div></div>"
                        }).join("") : '<div class="empty">Everything on the List is already on this trip.</div>') + '<div class="sheet-foot"><button class="btn primary" id="att-add">Add selected</button></div>'), l("#att-back").onclick = t, u("#sheet [data-p]").forEach(function(e) {
                            e.onclick = function() {
                                r[e.dataset.p] = !r[e.dataset.p], n()
                            }
                        }), l("#att-add").onclick = async function() {
                            var n = i.filter(function(e) {
                                return r[e.id]
                            }).map(function(t, n) {
                                return {
                                    trip_id: e.id,
                                    household_id: a,
                                    item_id: t.id,
                                    name: t.name,
                                    qty: t.qty,
                                    category: t.category,
                                    sort_order: 1e5 + n
                                }
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
    l("#add-form").onsubmit = async function(e) {
        e && e.preventDefault();
        var t = l("#item-name"),
            n = t.value.trim();
        if (!n) return t.focus();
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
    }), l("#item-name").addEventListener("input", function() {
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
    };
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
                    a.focusMode && a.focusMode.indexOf("continuous") >= 0 && n.applyConstraints({
                        advanced: [{
                            focusMode: "continuous"
                        }]
                    }).catch(function() {})
                } catch (e) {}
                t.video.srcObject = e;
                var i = t.video.play();
                i && i.catch && i.catch(function() {}), t.timer = setTimeout(we, 300)
            }
        }).catch(function(e) {
            ye();
            var t = e && e.name;
            f("NotAllowedError" === t ? "Camera blocked — allow camera for this site (Settings › Chrome/Safari › Camera), or use a photo." : "Camera unavailable (" + (t || "error") + ") — use a photo.", 7e3)
        })
    }, l("#scan-close").onclick = ye, l("#scan-file-btn").onclick = function() {
        ye(), l("#barcode-file").click()
    };
    var _e = {
            food: "world.openfoodfacts.org",
            beauty: "world.openbeautyfacts.org",
            product: "world.openproductsfacts.org",
            petfood: "world.openpetfoodfacts.org"
        },
        Se = {
            food: "Food",
            beauty: "Personal care",
            petfood: "Pets"
        };

    function Te(e, t) {
        return fetch("https://" + e + "/api/v2/product/" + encodeURIComponent(t) + ".json?fields=product_name,product_name_en,generic_name,brands,quantity,product_type,categories", {
            headers: {
                Accept: "application/json"
            }
        }).then(function(e) {
            return e.json().catch(function() {
                return {
                    status: 0
                }
            })
        }).then(function(t) {
            if (t && 1 === t.status && t.product) {
                var n = t.product,
                    a = (n.product_name || n.product_name_en || n.generic_name || "").trim();
                if (a || n.brands) return {
                    found: !0,
                    name: a,
                    brand: n.brands || "",
                    quantity: n.quantity || "",
                    type: n.product_type || "",
                    categories: String(n.categories || "").slice(0, 120),
                    source: e.replace("world.", "").replace(".org", "")
                }
            }
            var i = t && /different product type: (\w+)/.exec(t.status_verbose || "");
            return {
                found: !1,
                redirect: i && _e[i[1]]
            }
        }).catch(function() {
            return {
                found: !1,
                error: !0
            }
        })
    }

    function Le(e) {
        var a = [];
        return Te(_e.food, e).then(function(t) {
            return a.push("off:" + (t.found ? "hit" : t.redirect ? "→" + t.redirect.split(".")[1] : "miss")), t.found ? t : t.redirect ? Te(t.redirect, e).then(function(e) {
                return a.push("redirect:" + (e.found ? "hit" : "miss")), e
            }) : Promise.all([Te(_e.beauty, e), Te(_e.product, e)]).then(function(e) {
                return a.push("obf:" + (e[0].found ? "hit" : "miss"), "opf:" + (e[1].found ? "hit" : "miss")), e[0].found ? e[0] : e[1]
            })
        }).then(function(i) {
            return i && i.found ? i : async function(e) {
                var a = await S();
                if (!a) return {
                    found: !1,
                    skipped: "no-session"
                };
                try {
                    var i = await fetch(t + "/functions/v1/lh-product-lookup?code=" + encodeURIComponent(e), {
                            headers: {
                                Authorization: "Bearer " + a,
                                apikey: n
                            }
                        }),
                        r = await i.json();
                    return r && r.found ? r : {
                        found: !1,
                        detail: r && (r.error || r.reason)
                    }
                } catch (e) {
                    return {
                        found: !1,
                        error: !0
                    }
                }
            }(e).then(function(e) {
                return a.push("server:" + (e.found ? "hit" : e.skipped || e.detail || "miss")), e
            })
        }).then(function(t) {
            return t.trace = a, window.__lh.lastLookup = {
                code: e,
                result: t
            }, t
        })
    }

    function Ee(e) {
        var t = l("#item-name");
        return w.pending = {
            code: e,
            at: Date.now(),
            hint: null
        }, g("Scanned " + e + " — looking it up…"), Le(e).then(function(n) {
            if (n && n.found) {
                var a = [n.name, n.brand, n.quantity].filter(Boolean).join(" · ").trim() || "Product " + e,
                    i = n.source || "",
                    r = Se[n.type] || (/beauty/.test(i) ? "Personal care" : /petfood/.test(i) ? "Pets" : /food/.test(i) ? "Food" : null);
                w.pending.hint = {
                    category: r,
                    text: [n.name, n.brand, n.categories].filter(Boolean).join(" | ").slice(0, 160)
                }, t.placeholder = "Add item…", t.value = a, ie(a), g("Barcode matched (" + i + ") — review & tap Add"), f("Found: " + a, 5e3)
            } else {
                t.value = "", t.placeholder = "Name for " + e + "…";
                try {
                    t.focus()
                } catch (e) {}
                g("Scanned " + e + " — not found in product databases"), f("Scanned " + e + " — not in product databases. Name it:", 8e3)
            }
        })
    }

    function Ce(e) {
        var t = String(e || "").replace(/[.?!\n]+/g, ",").trim();
        if (!t) return [];
        var n = [];
        return t.split(/\s*(?:,|;|\band\b|\bthen\b|\balso\b)\s*/i).map(function(e) {
            return e.trim()
        }).filter(Boolean).forEach(function(e) {
            if (e = e.replace(/^(add|get|buy|need|we need|pick up)\s+/i, "").trim()) {
                var t = null,
                    a = e,
                    i = e.match(/^(\d+(?:\.\d+)?)\s*(gallons?|lbs?|pounds?|oz|ounces?|packs?|bags?|boxes?|bottles?|cans?|dozen|ct|count|x)?\s+(.+)$/i);
                i ? (t = [i[1], i[2]].filter(Boolean).join(" "), a = i[3]) : (i = e.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(gallons?|lbs?|pounds?|oz|ounces?|packs?|bags?|boxes?|bottles?|cans?|dozen|ct|count)?$/i)) && (a = i[1], t = [i[2], i[3]].filter(Boolean).join(" ")), (a = a.replace(/\s+/g, " ").trim()) && n.push({
                    name: m(a),
                    qty: t
                })
            }
        }), n
    }

    function xe(e) {
        var t = l("#voice-confirm");
        if (!e.length) return t.classList.add("hidden"), t.innerHTML = "", f("Couldn’t pick out any items — try again");

        function n() {
            t.classList.add("hidden"), t.innerHTML = ""
        }
        t.innerHTML = e.map(function(e, t) {
            return '<button type="button" class="chip-btn confirm" data-v="' + t + '">' + h(e.name) + (e.qty ? " · " + h(e.qty) : "") + "</button>"
        }).join("") + '<button type="button" class="chip-btn confirm" data-vall="1">Add all</button><button type="button" class="chip-btn cancel" data-vx="1">Cancel</button>', t.classList.remove("hidden"), u("#voice-confirm [data-v]").forEach(function(t) {
            t.onclick = function() {
                ne(e.splice(+t.dataset.v, 1)), e.length ? xe(e) : n()
            }
        }), t.querySelector("[data-vall]").onclick = function() {
            n(), ne(e)
        }, t.querySelector("[data-vx]").onclick = n
    }
    var Oe = (/iP(hone|ad|od)/.test(navigator.userAgent) || "MacIntel" === navigator.platform && navigator.maxTouchPoints > 1) && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent),
        Ie = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    function Ae(e) {
        try {
            l("#item-name").focus()
        } catch (e) {}
        f(e || "Voice add isn’t available in this browser. Tap the 🎤 on your keyboard to dictate — say items separated by “and”.", 8e3)
    }
    var Me = {
            "not-allowed": "Mic/speech access is blocked. iPhone: Settings › Safari › Microphone → Allow, and Settings › Privacy & Security › Speech Recognition → allow Safari. Or use the keyboard 🎤.",
            "service-not-allowed": "iPhone blocked the speech service. Turn on Settings › General › Keyboard › Enable Dictation, and open this site in Safari itself. For now: tap the item box and use the keyboard 🎤.",
            "no-speech": "Didn’t hear anything — tap 🎤 and start speaking right away.",
            "audio-capture": "No microphone available (another app may be using it).",
            network: "Voice needs an internet connection — check signal and try again."
        },
        je = null;
    setTimeout(function() {
        return fetch(t + "/functions/v1/lh-transcribe?probe=1", {
            headers: {
                apikey: n,
                Authorization: "Bearer " + n
            }
        }).then(function(e) {
            return e.json()
        }).then(function(e) {
            je = !(!e || !e.configured), window.__lh.stt = e
        }).catch(function() {})
    }, 3e3);
    var qe = null;

    function De(e) {
        var t = l("#mic-btn");
        t.textContent = e ? "⏹" : "🎤", t.classList.toggle("listening", e), t.setAttribute("aria-label", e ? "Stop recording" : "Voice add")
    }

    function Re() {
        if (qe && qe.mr && "inactive" !== qe.mr.state) try {
            qe.mr.stop()
        } catch (e) {}
    }

    function Pe() {
        return Ie ? !1 === je ? Ae("Voice add isn’t set up for this browser yet. The keyboard is open — tap its 🎤 to dictate.") : qe ? Re() : (qe = {
            starting: !0
        }, void navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: !0,
                noiseSuppression: !0
            }
        }).then(function(e) {
            var t, n = function() {
                for (var e = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"], t = 0; t < e.length; t++) try {
                    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(e[t])) return e[t]
                } catch (e) {}
                return ""
            }();
            try {
                t = n ? new MediaRecorder(e, {
                    mimeType: n
                }) : new MediaRecorder(e)
            } catch (n) {
                t = new MediaRecorder(e)
            }
            var a = qe = {
                mr: t,
                stream: e,
                chunks: [],
                t0: Date.now(),
                mt: n
            };
            t.ondataavailable = function(e) {
                e.data && e.data.size && a.chunks.push(e.data)
            }, t.onstop = function() {
                He(a)
            }, t.start(1e3), De(!0);
            var i = function() {
                qe === a && g("● Recording… " + Math.max(0, 15 - Math.floor((Date.now() - a.t0) / 1e3)) + "s — tap ⏹ when done")
            };
            i(), a.iv = setInterval(i, 500), a.max = setTimeout(Re, 15e3)
        }).catch(function(e) {
            qe = null, De(!1);
            var t = e && e.name;
            Ae("NotAllowedError" === t || "SecurityError" === t ? "Microphone is blocked. iPhone: Settings › " + (Oe ? "Chrome" : "Safari") + " › Microphone → Allow, then reload. Or use the keyboard 🎤." : "Couldn’t use the microphone (" + (t || "error") + "). Use the keyboard 🎤.")
        })) : Ae()
    }
    async function He(e) {
        qe === e && (qe = null), De(!1), clearInterval(e.iv), clearTimeout(e.max);
        try {
            e.stream.getTracks().forEach(function(e) {
                e.stop()
            })
        } catch (e) {}
        var a = e.mr && e.mr.mimeType || e.mt || "audio/mp4",
            i = new Blob(e.chunks, {
                type: a
            }),
            r = (Date.now() - e.t0) / 1e3;
        if (window.__lh.lastRecording = {
                bytes: i.size,
                type: a,
                secs: r
            }, r < .7 || i.size < 800) return g(""), f("That was too short — tap 🎤, say your items, then tap ⏹.");
        g("Transcribing…");
        try {
            var o = await S();
            if (!o) throw new Error("Sign in again to use voice add");
            var s = await fetch(t + "/functions/v1/lh-transcribe", {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + o,
                        apikey: n,
                        "Content-Type": a.split(";")[0]
                    },
                    body: i
                }),
                c = await s.json().catch(function() {
                    return {}
                });
            if (window.__lh.lastStt = {
                    status: s.status,
                    j: c
                }, 200 === s.status) {
                var d = (c.text || "").trim();
                return window.__lh.lastTranscript = d, d ? (g("Heard: " + d), xe(Ce(d))) : (g(""), f("Didn’t catch any words — try again closer to the mic."))
            }
            if (503 === s.status) return je = !1, g(""), Ae("Voice transcription isn’t set up yet — use the keyboard 🎤 for now.");
            if (401 === s.status || 403 === s.status) return g(""), f(403 === s.status ? "This account isn’t on the household list." : "Sign in again to use voice add.");
            g("Voice error", !0), f("Transcription failed (" + (c.error || s.status) + ") — try again or use the keyboard 🎤.")
        } catch (e) {
            g(""), f(e.message || "Transcription failed — check connection.")
        }
    }
    var ze = null;
    l("#mic-btn").onclick = function() {
            if (qe) return Re();
            if (ze) try {
                ze.stop()
            } catch (e) {} else {
                var e, t = window.SpeechRecognition || window.webkitSpeechRecognition,
                    n = +(localStorage.getItem("lh-sr-blocked") || 0);
                if (!t || Oe || n && Date.now() - n < 6e5) return Pe();
                try {
                    e = new t
                } catch (e) {
                    return Ae()
                }
                ze = e, e.lang = "en-US", e.continuous = !1, e.interimResults = !0;
                var a = "",
                    i = "",
                    r = !1,
                    o = null,
                    s = null,
                    c = !1,
                    d = l("#mic-btn");
                e.onstart = function() {
                    d.classList.add("listening"), g("Listening… e.g. “milk, 2 dozen eggs and bread”"), u(8e3)
                }, e.onresult = function(e) {
                    for (var t = "", n = "", r = 0; r < e.results.length; r++) {
                        var o = e.results[r],
                            s = o[0] && o[0].transcript || "";
                        o.isFinal ? t += s + " " : n += s + " "
                    }
                    a = t.trim(), (i = (t + n).replace(/\s+/g, " ").trim()) && g("Heard: " + i), u(a && !n.trim() ? 700 : 1800)
                }, e.onerror = function(e) {
                    var t = e && e.error || "unknown";
                    window.__lh.lastVoiceError = t, "aborted" === t || "no-speech" === t && i || (r = !0, g("Voice: " + t, !0), "not-allowed" !== t && "service-not-allowed" !== t || localStorage.setItem("lh-sr-blocked", String(Date.now())), "service-not-allowed" === t && Ie && !1 !== je ? (f("Speech service is off — recording instead. Speak now, tap ⏹ when done.", 5e3), setTimeout(Pe, 50)) : "not-allowed" === t || "service-not-allowed" === t ? Ae(Me[t]) : f(Me[t] || "Voice error: " + t, 8e3))
                }, e.onend = function() {
                    if (!c) {
                        c = !0, clearTimeout(o), clearTimeout(s), ze = null, d.classList.remove("listening");
                        var e = i || a;
                        window.__lh.lastTranscript = e, e ? (localStorage.removeItem("lh-sr-blocked"), g("Heard: " + e), xe(Ce(e))) : r || (g(""), f("Didn’t catch that — tap 🎤 and try again."))
                    }
                }, s = setTimeout(function() {
                    try {
                        e.stop()
                    } catch (e) {}
                }, 15e3);
                try {
                    e.start()
                } catch (e) {
                    ze = null, d.classList.remove("listening"), Ae("Couldn’t start voice (" + (e.message || e.name) + ").")
                }
            }

            function u(t) {
                clearTimeout(o), o = setTimeout(function() {
                    try {
                        e.stop()
                    } catch (e) {}
                }, t)
            }
        }, window.__lh.api = {
            addItems: ne,
            onScanned: Ee,
            lookupProduct: Le,
            localCat: F,
            parseVoice: Ce,
            showConfirm: xe,
            reload: O,
            planTrip: de,
            tripView: le,
            render: se,
            recFinish: He,
            openWish: openWish,
            openFindOptions: openFindOptions,
            adderLabel: adderLabel
        },
        function e() {
            window.supabase && window.supabase.createClient ? async function() {
                d("sbReady"), s.err ? (y("gate"), v("That sign-in link didn’t work (" + s.err + "). It may have expired or already been used — request a new one below.")) : s.hash || s.stored ? (y("splash"), l("#splash-msg").textContent = s.hash ? s.recovery ? "Opening password setup…" : "Signing you in…" : "Loading your list…", setTimeout(function() {
                    "splash" === w.view && (l("#splash-msg").textContent = "Still working… (slow connection?)", l("#splash-retry").classList.remove("hidden"))
                }, 6e3)) : y("gate");
                var e = _();
                try {
                    var t = await e.auth.getSession();
                    if (d("session"), t.error) throw t.error;
                    t.data.session ? await x(t.data.session) : "splash" === w.view && (y("gate"), s.hash && v("That sign-in link has expired or was already used — request a new one."))
                } catch (e) {
                    d("sessionErr"), y("gate"), v("Sign-in problem: " + (e.message || e) + " — try again.")
                }
            }(): setTimeout(e, 10)
        }()
}();