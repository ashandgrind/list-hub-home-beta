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
SEE_FULL_FILE_ON_DISK
}();