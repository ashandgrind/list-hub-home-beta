row t.error;
                    t.data.session ? await x(t.data.session) : "splash" === w.view && (y("gate"), s.hash && v("That sign-in link has expired or was already used — request a new one."))
                } catch (e) {
                    d("sessionErr"), y("gate"), v("Sign-in problem: " + (e.message || e) + " — try again.")
                }
            }(): setTimeout(e, 10)
        }()
}();