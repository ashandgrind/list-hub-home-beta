.focusMode && a.focusMode.indexOf("continuous") >= 0 && n.applyConstraints({
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
            beauty: "Personal Care",
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
                    r = LHCats.barcodeHint(n);
                w.pending.hint = {
                    category: r.category,
                    section: r.section,
                    subsection: r.subsection,
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
        };

        function agentApiBaseUrl() {
            return t + "/functions/v1/lh-agent-api"
        }

        function agentWhen(iso) {
            if (!iso) return "never";
            var when = new Date(iso);
            return isNaN(when) ? "" : when.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
            })
        }

        function agentRpcErrorMessage(err) {
            var msg = err && (err.message || err.details || String(err)) || "Request failed";
            if (/could not find the function|schema cache|404|PGRST202/i.test(msg)) return "AI agent tokens aren’t on the server yet. Apply the agent_tokens migration first.";
            if (/not_allowed|42501/i.test(msg)) return "Only household members can manage agent tokens.";
            if (/not_found|P0002/i.test(msg)) return "That token is already gone.";
            return msg
        }

        function agentInstructionsSnippet() {
            var base = agentApiBaseUrl();
            return [
                "You are helping the Pollock household shop with List Hub.",
                "",
                "API base: " + base,
                "Auth header: Authorization: Bearer <paste the lh_ token from List Hub → Menu → AI agents>",
                "",
                "Read the open grocery list (markdown, grouped by store then section):",
                "  GET " + base + "/list?format=markdown&status=open",
                "",
                "JSON (includes item ids for updates):",
                "  GET " + base + "/list?format=json&status=open",
                "",
                "Wishlist:",
                "  GET " + base + "/wishlist?format=markdown",
                "",
                "After you add something to a store cart, or learn it is unavailable or already bought:",
                "  POST " + base + "/items/{id}/status",
                "  { \"status\": \"in_cart\" | \"bought\" | \"unavailable\", \"store\": \"Publix\", \"note\": \"optional\" }",
                "",
                "in_cart = you put it in a store cart (it stays on the List).",
                "bought = they have it (checks it off and records a purchase).",
                "unavailable = that store did not have it (it stays on the List).",
                "",
                "OpenAPI: GET " + base + "/openapi.json",
                "",
                "Group by preferred store, then store section (Produce, Dairy, …). Use the item name and quantity. Preferred store may be empty — ask which store they are shopping. Do not invent items. Do not spend money. Do not email anyone."
            ].join("\n")
        }

        function formatOpenListMarkdown(listKind) {
            var openItems = $(listKind || "needs"),
                byStore = {},
                storeNames = [];
            openItems.forEach(function(item) {
                var storeRow = Y(item.preferred_store_id),
                    storeName = storeRow && storeRow.name ? storeRow.name : "Any store";
                if (!byStore[storeName]) {
                    byStore[storeName] = [];
                    storeNames.push(storeName)
                }
                byStore[storeName].push(item)
            });
            storeNames.sort(function(left, right) {
                if (left === "Any store") return 1;
                if (right === "Any store") return -1;
                return left.localeCompare(right)
            });
            var title = "wish" === (listKind || "needs") ? "Wishlist" : "List",
                lines = ["# List Hub — " + title, ""];
            if (!openItems.length) {
                lines.push("_Nothing open._");
                return lines.join("\n") + "\n"
            }
            storeNames.forEach(function(storeName) {
                lines.push("## " + storeName, "");
                LHCats.groupItems(byStore[storeName], catOf).forEach(function(group) {
                    lines.push("### " + group.section, "");
                    group.subs.forEach(function(sub) {
                        if (sub.name) lines.push("#### " + sub.name, "");
                        sub.items.forEach(function(item) {
                            var extra = [item.qty, item.notes].filter(Boolean).join(" · ");
                            lines.push("- [ ] " + item.name + (extra ? " — " + extra : ""))
                        });
                        lines.push("")
                    })
                })
            });
            return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
        }

        function fallbackCopyText(text) {
            var area = document.createElement("textarea");
            area.value = text;
            area.setAttribute("readonly", "");
            area.style.position = "fixed";
            area.style.top = "0";
            area.style.left = "0";
            area.style.width = "2px";
            area.style.height = "2px";
            area.style.opacity = "0.01";
            area.style.fontSize = "16px";
            document.body.appendChild(area);
            area.focus();
            area.select();
            area.setSelectionRange(0, text.length);
            var ok = false;
            try {
                ok = document.execCommand("copy")
            } catch (err) {
                ok = false
            }
            document.body.removeChild(area);
            return ok
        }

        function copyTextToClipboard(text) {
            if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
                return navigator.clipboard.writeText(text).then(function() {
                    return true
                }, function() {
                    return fallbackCopyText(text)
                })
            }
            return Promise.resolve(fallbackCopyText(text))
        }

        function shareOrCopyText(title, text) {
            if (typeof navigator.share === "function") {
                return navigator.share({
                    title: title,
                    text: text
                }).then(function() {
                    return "shared"
                }, function(err) {
                    if (err && err.name === "AbortError") return "cancelled";
                    return copyTextToClipboard(text).then(function(ok) {
                        return ok ? "copied" : "failed"
                    })
                })
            }
            return copyTextToClipboard(text).then(function(ok) {
                return ok ? "copied" : "failed"
            })
        }

        var agentSettingsFresh = null;

        function bindAgentSettings() {
            var createBtn = l("#agent-create-btn");
            createBtn && (createBtn.onclick = async function() {
                var nameInput = l("#agent-token-name"),
                    tokenName = (nameInput && nameInput.value || "").trim();
                if (!tokenName) return f("Name this agent first (e.g. Grok Bot).");
                createBtn.disabled = !0;
                try {
                    var created = await _().rpc("lh_create_agent_token", {
                        name: tokenName
                    });
                    if (created.error) return g(agentRpcErrorMessage(created.error), !0), void f(agentRpcErrorMessage(created.error), 5e3);
                    agentSettingsFresh = created.data;
                    nameInput && (nameInput.value = "");
                    openAgentSettings()
                } catch (err) {
                    f(agentRpcErrorMessage(err), 5e3)
                } finally {
                    createBtn.disabled = !1
                }
            });
            l("#agent-copy-fresh") && (l("#agent-copy-fresh").onclick = function() {
                if (!agentSettingsFresh || !agentSettingsFresh.token) return;
                copyTextToClipboard(agentSettingsFresh.token).then(function(ok) {
                    f(ok ? "Token copied. It won’t be shown again after you leave this screen." : "Couldn’t copy — select the token and copy it.")
                })
            });
            l("#agent-copy-url") && (l("#agent-copy-url").onclick = function() {
                copyTextToClipboard(agentApiBaseUrl()).then(function(ok) {
                    f(ok ? "API URL copied." : "Couldn’t copy the API URL.")
                })
            });
            l("#agent-copy-instructions") && (l("#agent-copy-instructions").onclick = function() {
                copyTextToClipboard(agentInstructionsSnippet()).then(function(ok) {
                    f(ok ? "Instructions copied — paste them into your AI." : "Couldn’t copy the instructions.")
                })
            });
            l("#agent-setpw") && (l("#agent-setpw").onclick = function() {
                z("Set a password", "Lets you sign in with email + password when you don’t want to wait for an email.")
            });
            u("#sheet [data-revoke]").forEach(function(btn) {
                btn.onclick = async function() {
                    var tokenId = btn.getAttribute("data-revoke");
                    if (!tokenId) return;
                    btn.disabled = !0;
                    try {
                        var revoked = await _().rpc("lh_revoke_agent_token", {
                            id: tokenId
                        });
                        if (revoked.error) return f(agentRpcErrorMessage(revoked.error), 5e3);
                        if (agentSettingsFresh && agentSettingsFresh.id === tokenId) agentSettingsFresh = null;
                        f("Token revoked.");
                        openAgentSettings()
                    } catch (err) {
                        f(agentRpcErrorMessage(err), 5e3)
                    } finally {
                        btn.disabled = !1
                    }
                }
            })
        }

        async function openAgentSettings() {
            var listed = [];
            var listErr = "";
            try {
                var res = await _().rpc("lh_list_agent_tokens");
                if (res.error) listErr = agentRpcErrorMessage(res.error);
                else listed = Array.isArray(res.data) ? res.data : []
            } catch (err) {
                listErr = agentRpcErrorMessage(err)
            }
            var fresh = agentSettingsFresh;
            var needsPassword = l("#setpw-btn") && !l("#setpw-btn").classList.contains("hidden");
            var tokenRows = listed.length ? listed.map(function(tok) {
                return '<div class="agent-row"><div><strong>' + h(tok.name || "Agent") + "</strong><p class=\"meta\">Created " + h(agentWhen(tok.created_at)) + (tok.created_by ? " · " + h(tok.created_by) : "") + " · last used " + h(agentWhen(tok.last_used_at)) + "</p></div><button type=\"button\" class=\"btn ghost sm danger\" data-revoke=\"" + h(tok.id) + "\">Revoke</button></div>"
            }).join("") : '<p class="hint">No active tokens yet.</p>';
            U('<div class="modal-top"><strong>Menu</strong><button class="btn ghost sm" data-close>Close</button></div>' +
                (needsPassword ? '<button type="button" class="btn wide" id="agent-setpw">🔑 Set a password</button>' : "") +
                '<div class="agent-sec"><h3>AI agents</h3><p class="hint" style="margin-top:0">Create a named token so Grok, ChatGPT, Claude, or a custom agent can read this household’s list and fill a store cart. The token is shown once — copy it now.</p>' +
                '<div class="agent-create"><input id="agent-token-name" type="text" maxlength="80" placeholder="Name (Grok Bot, ChatGPT…)" enterkeyhint="done"><button type="button" class="btn primary" id="agent-create-btn">Create</button></div>' +
                (fresh && fresh.token ? '<div class="agent-once" id="agent-fresh"><strong>Copy this token now.</strong> It will not be shown again.<code class="agent-token-value">' + h(fresh.token) + '</code><button type="button" class="btn sm" id="agent-copy-fresh">Copy token</button></div>' : "") +
                (listErr ? '<p class="error">' + h(listErr) + "</p>" : "") +
                '<div class="group-title"><span>Active tokens</span></div>' + tokenRows +
                '</div><div class="agent-sec"><h3>API base URL</h3><textarea class="agent-url" id="agent-url" readonly rows="2">' + h(agentApiBaseUrl()) + '</textarea><div class="agent-copy-row"><button type="button" class="btn sm" id="agent-copy-url">Copy URL</button></div></div>' +
                '<div class="agent-sec"><h3>Instructions for your AI</h3><textarea class="agent-instructions" id="agent-instructions" readonly rows="12">' + h(agentInstructionsSnippet()) + '</textarea><div class="agent-copy-row"><button type="button" class="btn sm" id="agent-copy-instructions">Copy instructions</button></div></div>');
            bindAgentSettings();
            var nameField = l("#agent-token-name");
            nameField && setTimeout(function() {
                nameField.focus()
            }, 40)
        }

        async function exportListForAi() {
            var markdown = formatOpenListMarkdown("needs");
            if (!$("needs").length) return f("Nothing on the List to export.");
            var result = await shareOrCopyText("List Hub — List", markdown);
            if ("shared" === result) f("List shared.");
            else if ("copied" === result) f("List copied as markdown.");
            else if ("cancelled" !== result) f("Couldn’t share or copy the list.", 5e3)
        }

        window.__lh.api = {
            addItems: ne,
            onScanned: Ee,
            lookupProduct: Le,
            localCat: F,
            catOf: catOf,
            parseVoice: Ce,
            showConfirm: xe,
            reload: O,
            planTrip: de,
            tripView: le,
            render: se,
            recFinish: He,
            openWish: openWish,
            openFindOptions: openFindOptions,
            adderLabel: adderLabel,
            formatOpenListMarkdown: formatOpenListMarkdown,
            openAgentSettings: openAgentSettings,
            exportListForAi: exportListForAi,
            agentApiBaseUrl: agentApiBaseUrl
        },
        function e() {
            window.supabase && window.supabase.createClient ? async function() {
                d("sbReady"), s.err ? (y("gate"), v("That sign-in link didn’t work (" + s.err + "). It may have expired or already been used — request a new one below.")) : s.hash || s.stored ? (y("splash"), l("#splash-msg").textContent = s.hash ? s.recovery ? "Opening password setup…" : "Signing you in…" : "Loading your list…", setTimeout(function() {
                    "splash" === w.view && (l("#splash-msg").textContent = "Still working… (slow connection?)", l("#splash-retry").classList.remove("hidden"))
                }, 6e3)) : y("gate");
                var e = _();
                try {
                    var t = await e.auth.getSession();
                    if (d("session"), t.error) th