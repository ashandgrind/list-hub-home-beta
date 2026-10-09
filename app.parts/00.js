/* Auth redirects return to wherever the app is served (root on list-hub-live, /listhub/ on hq.cruxibl.com). */
function lhAuthRedirect() {
    return location.origin + location.pathname.replace(/[^/]*$/, "");
}
! function() {
    "use strict";
    var e, t = "https://dphkvcdohqsvefbdhsfx.supabase.co",
        n = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGt2Y2RvaHFzdmVmYmRoc2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTcxMjIsImV4cCI6MjA5OTU3MzEyMn0.Ts8vvKm8VuOYCgmtKxNQe71Ga2qjUH5jiCSlOe9vxSo",
        a = "a0000000-0000-4000-8000-000000000001",
        r = {
            Food: "🍎",
            Household: "🧻",
            "Personal care": "🧴",
            "Personal Care": "🧴",
            Health: "💊",
            Electronics: "⚡",
            Pets: "🐾",
            Baby: "🍼",
            Hardware: "🔧",
            Clothing: "👕",
            Other: "📦",
            "Outdoor & Sports": "🚴",
            Auto: "🚗"
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
            var sub = await _().from("lh_items").select("id,subsection");
            if (!sub.error && sub.data) {
                w.hasSubcol = !0;
                sub.data.forEach(function(e) {
                    var t = w.items.find(function(t) {
                        return t.id === e.id
                    });
                    t && (t.subsection = e.subsection || t.subsection || "")
                })
            }
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
        U('<div class="modal-top"><strong>' + h(e.name) + '</strong><button class="btn ghost sm" data-close>Close</button></div><div class="detail-head">' + p("Category", h((catOf(e).emoji || "📦") + " " + catOf(e).label)) + p("Added", h(c || "—") + (o ? " · " + h(o) : " · adder unknown")) + (i ? p("Preferred store", h(i.name)) : "") + (e.preferred_source ? p("Preferred source", h(e.preferred_source)) : "") + "</div>" + (n ? '<div class="deal-card"><div class="deal-price">Best find · $' + h(money(n.price)) + '</div><div class="deal-sub">' + h(n.title) + (n.source ? " · " + h(n.source) : "") + "</div>" + (d ? '<div class="deal-cmp">' + h(d) + "</div>" : "") + (n.url ? '<a class="deal-link" href="' + h(n.url) + '" target="_blank" rel="noopener">Open listing</a>' : "") + "</div>" : null != e.target_price ? '<div class="deal-card muted">No priced finds yet. Target $' + h(money(e.target_price)) + ".</div>" : '<div class="deal-card muted">No finds yet — log a deal below.</div>') + reqHtml + '<form id="wish-edit" class="wish-form"><label class="field"><span>Notes / description</span><textarea id="wish-notes" rows="3" placeholder="What you want, size, must-haves…">' + h(e.notes || "") + '</textarea></label><label class="field"><span>Target price (USD)</span><input id="wish-price" inputmode="decimal" enterkeyhint="done" placeholder="e.g. 400" value="' + h(null != e.target_price ? String(e.target_price) : "") + '"></label><label class="field"><span>Preferred store</span><select id="wish-store" class="sel">' + ee(e.preferred_store_id) + '</select></label><label class="field"><span>Preferred source / seller</span><input id="wish-source" placeholder="Amazon, eBay, FB Marketplace…" value="' + h(e.preferred_source || "") + '"></label><label class="field"><span>Product links <small>(one per line, optional “Label URL”)</small></span><textarea id="wish-links" rows="3" placeholder="https://…">' + h(formatLinks(e.product_links)) + "</textarea></label>" + (links.length ? '<div class="link-list">' + links.map(function(e) {
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
        subcats: {},
        hasSubcol: false,
        trips: [],
        finds: [],
        findsByItem: {},
        findRequests: [],
        reqByItem: {},
        loadedAt: 0,
        pending: null
    };
    window.__lh = {
        version: "lh6.3",
        S: w,
        T: c,
        cats: window.LHCats,
        catOf: function(e) {
            return catOf(e)
        }
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
        w.member = e.member, w.stores = e.stores || [], w.lists = e.lists || [], w.items = e.items || [], w.history = e.history || [], w.prefs = e.prefs || [], w.cats = e.cats || {}, w.subcats = e.subcats || {}, w.trips = e.trips || [], w.displayName = e.member && e.member.display_name || "Member", w.who = p(w.displayName) || "chris";
        if ((e.items || []).some(function(t) {
                return t && Object.prototype.hasOwnProperty.call(t, "subsection")
            })) w.hasSubcol = !0;
        (e.history || []).forEach(function(t) {
            t && t.name_key && t.subsection && (w.subcats[t.name_key] = t.subsection)
        })
    }
    async function lhBootstrap() {
        var e = await _().rpc("lh_bootstrap");
        if (e.error) throw e.error;
        setTimeout(loadRepurchase, 0);
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
                var a = await lhBootstrap();
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
            var e = await lhBootstrap();
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
                    emailRedirectTo: lhAuthRedirect(),
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
        a.innerHTML = e || "", a.classList.toggle("hidden", !e), l("#pw-setup-btn").classList.toggle("hidden", !t), l(