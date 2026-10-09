"#pw-create-btn").classList.toggle("hidden", !n)
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
            redirectTo: lhAuthRedirect()
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
                emailRedirectTo: lhAuthRedirect(),
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
    function catCacheFor(name) {
        var n = p(name),
            o = {};
        if (w.cats[n] || w.subcats[n]) o[n] = {
            category: w.cats[n],
            subsection: w.subcats[n] || ""
        };
        return o
    }

    function catOf(e) {
        return LHCats.resolveItem(e || {}, catCacheFor(e && e.name))
    }

    function rememberCat(name, resolved) {
        var n = p(name);
        n && resolved && (w.cats[n] = resolved.category || resolved.legacy, w.subcats[n] = resolved.subsection || "")
    }

    function applyResolved(item, resolved, source) {
        item.category = resolved.category || resolved.legacy;
        item.subsection = resolved.subsection || "";
        item.category_source = source || resolved.source;
        rememberCat(item.name, resolved)
    }

    function itemCatPatch(resolved, source) {
        var o = {
            category: resolved.category || resolved.legacy,
            category_source: source || resolved.source,
            updated_at: (new Date).toISOString()
        };
        return w.hasSubcol && (o.subsection = resolved.subsection || ""), o
    }

    function cacheUpsert(name, resolved, source) {
        var row = {
            household_id: a,
            name_key: p(name),
            category: resolved.category || resolved.legacy,
            source: source || resolved.source || "local",
            updated_at: (new Date).toISOString()
        };
        w.hasSubcol && (row.subsection = resolved.subsection || "");
        _().from("lh_category_cache").upsert(row, {
            onConflict: "household_id,name_key"
        }).then(function() {}, function() {})
    }

    function F(e) {
        var t = LHCats.classify(e);
        return t.unknown ? null : t.category
    }

    function V(e, t) {
        var n = p(e);
        if (w.cats[n] || w.subcats[n]) return LHCats.fromStored(w.cats[n], w.subcats[n], e, {
            source: "cache"
        });
        var a = w.history.find(function(e) {
            return e.name_key === n && (e.category || e.subsection)
        });
        if (a) return LHCats.fromStored(a.category, a.subsection, e, {
            source: "cache"
        });
        if (t && (t.category || t.section || t.subsection || t.text)) return LHCats.classify(e, {
            section: t.section || t.category,
            subsection: t.subsection,
            text: t.text,
            source: "barcode"
        });
        return LHCats.classify(e)
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
                        if (n && (n.category || n.section)) {
                            var r = LHCats.fromAI(n, e.name);
                            rememberCat(e.name, r);
                            var a = w.items.find(function(t) {
                                return t.id === e.id
                            });
                            a && "user" !== a.category_source && (a.category === r.category && a.subsection === r.subsection && "ai" === a.category_source || (applyResolved(a, r, "ai"), o = !0, _().from("lh_items").update(itemCatPatch(r, "ai")).eq("id", a.id).then(function() {}, function() {})))
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
                    };
                    i.notes && (s.notes = String(i.notes).slice(0, 500));
                    w.hasSubcol && (s.subsection = r.subsection || "");
                    rememberCat(i.name, r);
                var c = await _().from("lh_items").insert(s).select("*").single();
                if (c.error && s.subsection != null && /subsection|schema cache/i.test(c.error.message || "")) {
                    w.hasSubcol = !1, delete s.subsection, c = await _().from("lh_items").insert(s).select("*").single()
                }
                if (c.error) {
                    g(c.error.message, !0);
                    break
                }
                var rpx = "needs" === w.kind && rpFor(i.name);
                rpx && rpx.probably_have && (rpSignal(i.name, i.signalKind || "add"), i.signaled = !0);
                w.items.push(c.data), n.push(c.data), ("local" === r.source || "barcode" === r.source && i.hint && i.hint.text) && J(c.data, i.hint && i.hint.text), ae(i.name, o)
            }
        }
        e.some(function(i) {
            return i.signaled
        }) && setTimeout(loadRepurchase, 800);
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
        return LHCats.groupItems(e, catOf)
    }

    function oe(e) {
        var t = Y(e.preferred_store_id),
            n = adderLabel(e),
            i = bestFind(e.id),
            o = "wish" === w.kind,
            q = currentRequest(e.id),
            z = requestBadge(q);
        var cat = catOf(e);
        return '<article class="item' + ("needed" !== e.status ? " checked" : "") + (o ? " wish-item" : "") + '" data-id="' + e.id + '"><button class="check-btn" type="button" data-act="toggle" aria-label="Got it">✓</button><div class="item-body"' + (o ? ' data-act="detail" role="button" tabindex="0"' : "") + '>' + LHRename.nameRowHtml(e.name, o, h) + '<div class="item-meta"><span class="badge cat' + ("local" === e.category_source ? " guess" : "") + '" data-act="cat" title="Tap to change category">' + (cat.subEmoji || cat.emoji || "📦") + " " + h(o ? cat.label : cat.chip || cat.section) + "</span>" + (e.qty ? '<span class="badge">' + h(e.qty) + "</span>" : "") + (t ? '<span class="badge">' + h(t.name) + "</span>" : "") + (e.preferred_source ? '<span class="badge">' + h(e.preferred_source) + "</span>" : "") + (e.discreet ? '<span class="badge discreet">Discreet</span>' : "") + (n ? '<span class="badge who">' + h(n) + "</span>" : "") + (i ? '<span class="badge deal">Best $' + h(money(i.price)) + "</span>" : "") + (z ? '<span class="badge search">' + h(z) + "</span>" : "") + (o ? '<span class="badge more">Details</span>' : "") + '</div>' + rpLine(e) + '</div>' + (o ? '<button class="find-btn" type="button" data-act="findopts" aria-label="Find options">🔎</button>' : "") + '<button class="x-btn" type="button" data-act="del" aria-label="Delete">✕</button></article>'
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
            }), l("#plan-bar").classList.toggle("hidden", "needs" !== w.kind); l("#recipe-btn") && l("#recipe-btn").classList.toggle("hidden", "needs" !== w.kind);
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
                d.innerHTML = LHCats.renderGroups(o, oe, catOf) + (o.length ? "" : '<div class="empty">All done here.</div>') + (s.length ? '<section class="group"><div class="group-title"><span>Got it · ' + s.length + '</span><button class="btn ghost sm" id="clear-done" type="button">Clear</button></div>' + s.map(oe).join("") + "</section>" : ""), u("#items .item").forEach(function(e) {
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
                            n.error ? g(n.error.message, !0) : setTimeout(loadRepurchase, 500)
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
                        if (!(n && n.target && n.target.closest && n.target.closest('[data-act="cat"], [data-act="findopts"], [data-act="rename"]'))) openWish(t)
                    }, LHRename.attachRename(e, t, {
                        client: _(),
                        wish: "wish" === w.kind,
                        onError: function(err) {
                            g(err && err.message, !0)
                        },
                        onChange: se
                    }), (e.querySelector('[data-act="findopts"]') || {onclick: null}).onclick = function(n) {
                        n && n.stopPropagation && n.stopPropagation();
                        openFindOptions(t)
                    }, e.querySelector('[data-act="cat"]').onclick = function(n) {
                        n && n.stopPropagation && n.stopPropagation();
                        var e = t,
                            cur = catOf(e);
                        U('<div class="modal-top"><strong>Category for “' + h(e.name) + '”</strong><button class="btn ghost sm" data-close>Close</button></div>' + LHCats.pickerHtml(cur) + '<p class="hint">Optional — we’ll remember this for next time. You never have to set it.</p>'), u("#sheet [data-section]").forEach(function(t) {
                            t.onclick = async function() {
                                var resolved = LHCats.fromStored(t.dataset.section, t.dataset.sub || "", e.name, {
                                    trustSection: !0,
                                    source: "user"
                                });
                                N(), applyResolved(e, resolved, "user"), se();
                                var i = await _().from("lh_items").update(itemCatPatch(resolved, "user")).eq("id", e.id);
                                if (i.error) return g(i.error.message, !0);
                                cacheUpsert(e.name, resolved, "user")
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
                    return '<div class="group-title"><span>' + e.emoji + " " + h(e.section) + '</span><button class="btn ghost sm" data-allcat="' + h(e.section) + '">All</button></div>' + e.subs.map(function(s) {
                        return (s.name ? '<div class="subhead"><span>' + h(s.name) + "</span></div>" : "") + s.items.map(function(e) {
                            var n = Y(e.preferred_store_id);
                            return '<div class="pick" data-pick="' + e.id + '"><span class="check-btn' + (t.picked[e.id] ? " on" : "") + '">✓</span><div class="item-body"><div class="item-name">' + h(e.name) + '</div><div class="item-meta">' + (e.qty ? '<span class="badge">' + h(e.qty) + "</span>" : "") + (n ? '<span class="badge">' + h(n.name) + "</span>" : "") + "</div></div></div>"
                        }).join("")
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
                            catOf(e).section === n.dataset.allcat && (t.picked[e.id] = !0)
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
                                var cat = catOf(n),
                                    row = {
                                    trip_id: s.id,
                                    household_id: a,
                                    item_id: e,
                                    name: n.name,
                                    qty: n.qty,
                                    category: cat.category,
                                    sort_order: 100 * LHCats.sortIndex(cat.section, cat.subsection) + t
                                };
                                return w.hasSubcol && (row.subsection = cat.subsection || ""), row
                            });
                            if (c.length) {
                          