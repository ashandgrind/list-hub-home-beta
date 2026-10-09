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
    window.__lh = { version: "lh6.3-rename-ui" };
}();
