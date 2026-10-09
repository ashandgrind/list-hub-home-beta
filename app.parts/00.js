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
        if ("paused" === e.status) return "Paused \u00b7 was searching " + freqPhrase(e.frequency) + (t ? " \u00b7 last run " + t : "") + ".";
        if ("pending" === e.status && !e.last_run_at) return "once" === e.frequency ? "Queued \u2014 Shopping Buddy will search once shortly." : "Queued \u2014 searching " + freqPhrase(e.frequency) + " starting shortly.";
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
