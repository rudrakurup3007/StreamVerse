/* StreamVerse – plain JS, localStorage as a stand-in data layer (no backend). */
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = (k, d) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  },
  SV = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const CATS = ["Movies", "Series", "News", "Sports", "Kids"],
  DAY = 864e5;
const LOGO =
  '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="6" width="22" height="22" rx="7" fill="#FF6B4A"/><rect x="6" y="2" width="22" height="22" rx="7" fill="#4F46E5"/><path d="M14 9l8 5-8 5z" fill="#fff"/></svg><b>Stream<span>Verse</span></b>';
const ago = (d) => new Date(Date.now() - d * DAY).toISOString(),
  fd = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  ft = (d) =>
    fd(d) +
    ", " +
    new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
(function seed() {
  if (!LS("sv_content"))
    SV(
      "sv_content",
      [
        ["The Last Lighthouse", "Movies", "English", 2024, "2h 04m", 4.6],
        ["Monsoon Letters", "Movies", "Hindi", 2023, "2h 18m", 4.4],
        ["Paper Kites", "Movies", "Tamil", 2022, "1h 52m", 4.1],
        ["Neon Harbour", "Movies", "English", 2025, "1h 47m", 4.8],
        ["Midnight Mess", "Series", "Hindi", 2024, "8 eps · 42m", 4.5],
        ["Code of Kings", "Series", "English", 2023, "10 eps · 50m", 4.7],
        ["The Spice Route", "Series", "Malayalam", 2022, "6 eps · 38m", 4.2],
        ["Evening Bulletin", "News", "English", 2026, "30m", 4.0],
        ["Desh Darpan", "News", "Hindi", 2026, "45m", 3.9],
        ["Pitch Perfect Cricket", "Sports", "English", 2025, "3h 10m", 4.6],
        ["Kabaddi Finals Live", "Sports", "Hindi", 2026, "2h 30m", 4.3],
        ["Grand Slam Weekly", "Sports", "English", 2026, "55m", 4.1],
        ["Pico & the Moon Train", "Kids", "English", 2024, "24m", 4.7],
        ["Chhota Explorer", "Kids", "Hindi", 2025, "22m", 4.5],
        ["Bubble Bakery", "Kids", "English", 2023, "20m", 4.4],
      ].map((c, i) => ({
        id: i + 1,
        title: c[0],
        cat: c[1],
        lang: c[2],
        year: c[3],
        dur: c[4],
        rating: c[5],
      })),
    );
  if (!LS("sv_plans"))
    SV("sv_plans", [
      { id: 1, name: "Movies & Series", price: 100, days: 30, scope: "Movies, Series" },
      { id: 2, name: "All Access Monthly", price: 250, days: 30, scope: "All" },
      { id: 3, name: "All Access Annual", price: 2000, days: 365, scope: "All" },
    ]);
  if (!LS("sv_users")) {
    SV("sv_users", [
      {
        id: 1,
        name: "Aarav Mehta",
        email: "aarav@demo.com",
        phone: "9876543210",
        pass: "demo1234",
        role: "User",
      },
      {
        id: 2,
        name: "Meera Nair",
        email: "meera@demo.com",
        phone: "9123456780",
        pass: "demo1234",
        role: "User",
      },
    ]);
    SV("sv_subs", {
      "aarav@demo.com": {
        plan: 2,
        start: ago(10),
        end: new Date(Date.now() + 20 * DAY).toISOString(),
      },
      "meera@demo.com": { plan: 1, start: ago(45), end: ago(15) },
    });
    SV("sv_hist", [
      { id: 1, email: "aarav@demo.com", cid: 6, at: ago(1), pct: 100 },
      { id: 2, email: "aarav@demo.com", cid: 4, at: ago(3), pct: 45 },
    ]);
  }
})();
const me = () => {
    const s = LS("sv_session");
    return (
      s &&
      (s.role === "Admin"
        ? { name: "Admin", email: s.email, role: "Admin" }
        : LS("sv_users", []).find((u) => u.email === s.email))
    );
  },
  mySub = () => LS("sv_subs", {})[me().email],
  plans = () => LS("sv_plans", []),
  contents = () => LS("sv_content", []);
const status = (s) => {
  if (!s) return "none";
  const d = (new Date(s.end) - Date.now()) / DAY;
  return d < 0 ? "expired" : d <= 7 ? "expiring" : "active";
};
const badge = (s) =>
  ({
    active: '<span class="bd ok">✔ Active</span>',
    expiring: '<span class="bd warn">⚠ Expiring Soon</span>',
    expired: '<span class="bd bad">✕ Expired</span>',
    none: '<span class="bd mut">– No plan</span>',
  })[s];
const dur = (p) => (p.days >= 365 ? "1 year" : "1 month"),
  planOf = (s) => s && plans().find((p) => p.id == s.plan);
const canWatch = (cat, s) => {
  const p = planOf(s);
  return p && (p.scope === "All" || p.scope.split(", ").includes(cat));
};
const esc = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
function toast(m, t = "") {
  const e = document.createElement("div");
  e.className = "toast " + t;
  e.setAttribute("role", "status");
  e.textContent = m;
  document.body.append(e);
  setTimeout(() => e.remove(), 3200);
}
function modal(html, onClose) {
  const o = document.createElement("div");
  o.className = "ov";
  o.innerHTML =
    '<div class="md" role="dialog" aria-modal="true" tabindex="-1">' + html + "</div>";
  document.body.append(o);
  const prev = document.activeElement;
  const close = () => {
    document.removeEventListener("keydown", k);
    o.remove();
    prev && prev.focus();
    onClose && onClose();
  };
  const k = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      const f = $$("button,input,select,a", o);
      if (!f.length) return;
      const a = f[0],
        z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    }
  };
  document.addEventListener("keydown", k);
  o.onclick = (e) => {
    if (e.target === o) close();
  };
  $$("[data-x]", o).forEach((b) => (b.onclick = close));
  ($("input,button", o) || $(".md", o)).focus();
  return { el: o, close };
}
function F(id, label, type = "text", val = "", opts) {
  let i;
  if (type === "select")
    i = `<select id="${id}">${opts
      .map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}"${v == val ? " selected" : ""}>${esc(l)}</option>`;
      })
      .join("")}</select>`;
  else i = `<input id="${id}" type="${type}" value="${esc(val)}" autocomplete="off">`;
  return `<div class="fld" id="f_${id}"><label for="${id}">${label}</label>${type === "password" ? `<div class="pw">${i}<button type="button" data-pw="${id}" aria-label="Show password">Show</button></div>` : i}<div class="err" aria-live="polite"></div></div>`;
}
function bind(root = document) {
  $$("[data-pw]", root).forEach(
    (b) =>
      (b.onclick = () => {
        const i = $("#" + b.dataset.pw);
        const s = i.type === "password";
        i.type = s ? "text" : "password";
        b.textContent = s ? "Hide" : "Show";
      }),
  );
}
function setErr(id, m) {
  const f = $("#f_" + id);
  f.classList.toggle("bad", !!m);
  $(".err", f).textContent = m || "";
  return !!m;
}
const EM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function guard(admin) {
  const u = me();
  if (!u) {
    location = "login.html";
    return null;
  }
  if (admin && u.role !== "Admin") {
    location = "browse.html";
    return null;
  }
  if (!admin && u.role === "Admin") {
    location = "admin.html";
    return null;
  }
  return u;
}
function nav(active) {
  const u = me(),
    st = status(mySub()),
    L = [
      ["browse.html", "Browse"],
      ["watch-history.html", "Watch History"],
      ["my-subscription.html", "Profile"],
    ];
  $("#nav").innerHTML =
    `<a class="logo" href="browse.html">${LOGO}</a><nav aria-label="Main">${L.map((l) => `<a href="${l[0]}"${l[0] === active ? ' class="on" aria-current="page"' : ""}>${l[1]}</a>`).join("")}</nav>${badge(st)}<span class="av" title="${esc(u.name)}">${u.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()}</span><button class="btn sec sm" id="lo">Logout</button>`;
  $("#lo").onclick = () => {
    localStorage.removeItem("sv_session");
    location = "login.html";
  };
}
const logout = () => {
  localStorage.removeItem("sv_session");
  location = "login.html";
};
/* ---------- history + player ---------- */
function saveHist(cid, pct) {
  const u = me(),
    h = LS("sv_hist", []);
  let r = h.find((x) => x.email === u.email && x.cid == cid);
  if (r) {
    r.at = new Date().toISOString();
    r.pct = Math.max(r.pct, pct);
  } else
    h.push({ id: Date.now(), email: u.email, cid, at: new Date().toISOString(), pct });
  SV("sv_hist", h);
}
function player(c) {
  const s = mySub(),
    st = status(s),
    p = planOf(s);
  let body, t;
  const head = `<h2 id="pt">${esc(c.title)}</h2><span class="bd cat c-${c.cat}">${c.cat}</span> <span class="meta">${c.lang} · ${c.year} · ${c.dur}</span>`;
  if (!s || st === "expired") {
    body = `<div class="al bad" role="alert">${s ? "Your subscription has expired. Renew now to continue watching." : "You have no active plan. Choose a plan to start watching."}</div><div class="acts"><a class="btn" href="plans.html">Renew Plan</a><a class="btn sec" href="plans.html">View Plans</a></div>`;
  } else if (!canWatch(c.cat, s)) {
    body = `<div class="al warn" role="alert">Your <b>${esc(p.name)}</b> plan covers ${esc(p.scope)} only. ${c.cat} is included in All Access plans.</div><a class="btn" href="plans.html">Explore Plans</a>`;
  } else {
    const h = LS("sv_hist", []).find((x) => x.email === me().email && x.cid == c.id);
    let pct = h && h.pct < 100 ? h.pct : 0,
      run = true;
    body = `<div class="pl"><i id="pb" aria-hidden="true">❚❚</i></div><div class="al ok">▶ Now Watching</div><div class="hb"><div class="pg" role="progressbar" aria-valuemin="0" aria-valuemax="100"><b id="pf"></b></div><b id="pp"></b></div><div class="acts"><button class="btn sec" id="pt2">Pause</button></div><p class="meta">Demo player: progress is simulated and saved to Watch History.</p>`;
    t = 1;
    setTimeout(() => {
      const draw = () => {
        $("#pf").style.width = pct + "%";
        $("#pp").textContent = pct + "%";
        $("[role=progressbar]").setAttribute("aria-valuenow", pct);
      };
      draw();
      t = setInterval(() => {
        if (run && pct < 100) {
          pct = Math.min(100, pct + 2);
          draw();
        }
      }, 1000);
      $("#pt2").onclick = (e) => {
        run = !run;
        e.target.textContent = run ? "Pause" : "Resume";
        $("#pb").textContent = run ? "❚❚" : "▶";
      };
      m.el.dataset.pct = 0;
      m.getPct = () => pct;
    }, 0);
  }
  const m = modal(
    head +
      body +
      `<div class="acts" style="margin-top:14px"><button class="btn sec" data-x>Close</button></div>`,
    () => {
      clearInterval(t);
      if (m.getPct && m.getPct() > 0) {
        saveHist(c.id, m.getPct());
        toast("Progress saved to Watch History");
      }
      if (window.afterPlayer) afterPlayer();
    },
  );
  m.el.firstChild.setAttribute("aria-labelledby", "pt");
  $$("[data-x]", m.el).forEach((b) => (b.onclick = m.close));
  return m;
}
/* ---------- pages ---------- */
const PG = document.body.dataset.page;
const pages = {
  index() {
    const u = me();
    if (u) location = u.role === "Admin" ? "admin.html" : "browse.html";
  },
  login() {
    let mode = "User";
    const c = $("#card");
    c.innerHTML = `<h2>Welcome back</h2><p class="meta">Sign in to keep watching.</p><div class="seg" role="tablist"><button class="on" data-m="User">User</button><button data-m="Admin">Admin</button></div><div id="al"></div><form id="fm" novalidate>${F("email", "Email", "email")}${F("pw", "Password", "password")}<button class="btn" style="width:100%" id="go">Sign In</button></form><p id="su">Don't have an account? <a href="signup.html">Sign up</a></p><p class="meta" id="hint">Demo user: aarav@demo.com / demo1234</p>`;
    bind(c);
    $$(".seg button").forEach(
      (b) =>
        (b.onclick = () => {
          mode = b.dataset.m;
          $$(".seg button").forEach((x) => x.classList.toggle("on", x === b));
          $("#su").hidden = mode === "Admin";
          $("#hint").textContent =
            mode === "Admin"
              ? "Demo admin: admin@streamverse.com / admin123"
              : "Demo user: aarav@demo.com / demo1234";
        }),
    );
    $("#fm").onsubmit = (e) => {
      e.preventDefault();
      const em = $("#email").value.trim(),
        pw = $("#pw").value;
      $("#al").innerHTML = "";
      const a = setErr(
          "email",
          !em
            ? "Enter your email."
            : !EM.test(em)
              ? "Enter a valid email like name@mail.com."
              : "",
        ),
        b = setErr("pw", pw ? "" : "Enter your password.");
      if (a || b) return;
      const g = $("#go");
      g.disabled = true;
      g.textContent = "Signing in…";
      setTimeout(() => {
        let ok = false;
        if (mode === "Admin") ok = em === "admin@streamverse.com" && pw === "admin123";
        else ok = LS("sv_users", []).some((u) => u.email === em && u.pass === pw);
        if (!ok) {
          g.disabled = false;
          g.textContent = "Sign In";
          $("#al").innerHTML =
            `<div class="al bad" role="alert">Incorrect email or password for ${mode.toLowerCase()} sign in.</div>`;
          return;
        }
        SV("sv_session", { email: em, role: mode });
        $("#al").innerHTML =
          '<div class="al ok" role="status">✔ Signed in. Redirecting…</div>';
        setTimeout(
          () => (location = mode === "Admin" ? "admin.html" : "browse.html"),
          700,
        );
      }, 800);
    };
  },
  signup() {
    const c = $("#card");
    c.innerHTML = `<h2>Create your account</h2><p class="meta">It takes under a minute.</p><form id="fm" novalidate>${F("name", "Full name")}${F("email", "Email address", "email")}${F("phone", "Phone number", "tel")}${F("pw", "Password", "password")}${F("cf", "Confirm password", "password")}<button class="btn" style="width:100%">Create Account</button></form><p>Already registered? <a href="login.html">Sign in</a></p>`;
    bind(c);
    $("#fm").onsubmit = (e) => {
      e.preventDefault();
      const v = (id) => $("#" + id).value.trim(),
        us = LS("sv_users", []);
      const er = [
        setErr("name", v("name").length < 2 ? "Enter your full name." : ""),
        setErr(
          "email",
          !EM.test(v("email"))
            ? "Enter a valid email."
            : us.some((u) => u.email === v("email"))
              ? "This email is already registered."
              : "",
        ),
        setErr(
          "phone",
          !/^[6-9]\d{9}$/.test(v("phone")) ? "Enter a 10-digit mobile number." : "",
        ),
        setErr("pw", $("#pw").value.length < 8 ? "Use at least 8 characters." : ""),
        setErr("cf", $("#cf").value !== $("#pw").value ? "Passwords do not match." : ""),
      ];
      if (er.some(Boolean)) return;
      us.push({
        id: Date.now(),
        name: v("name"),
        email: v("email"),
        phone: v("phone"),
        pass: $("#pw").value,
        role: "User",
      });
      SV("sv_users", us);
      SV("sv_session", { email: v("email"), role: "User" });
      c.innerHTML = `<div class="al ok" role="status">✔ Account created. You're signed in.</div><h2>Next: choose a plan</h2><p>Pick a subscription to unlock content.</p><a class="btn" href="plans.html">Choose a plan</a>`;
    };
  },
  plans() {
    const u = guard();
    if (!u) return;
    nav("plans.html");
    const s = mySub(),
      st = status(s);
    const draw = () => {
      const cs = mySub(),
        cst = status(cs);
      $("#pl").innerHTML = plans()
        .map(
          (p) =>
            `<article class="plan${p.id == 2 ? " pop" : ""}${cs && cst !== "expired" && cs.plan == p.id ? " sel" : ""}">${p.id == 2 ? '<span class="tag">Most Popular</span>' : p.days >= 365 ? '<span class="tag" style="background:var(--te)">Best Value</span>' : ""}<h2>${esc(p.name)}</h2><div class="price">₹${p.price.toLocaleString("en-IN")}</div><div class="meta">${dur(p)}</div><span class="bd ${p.scope === "All" ? "ok" : "mut"}">${p.scope === "All" ? "All categories" : esc(p.scope)}</span><ul><li>${p.scope === "All" ? "Movies, Series, News, Sports & Kids" : esc(p.scope) + " only"}</li><li>Watch history & resume</li><li>Cancel anytime</li></ul><button class="btn${p.id == 2 ? " co" : ""}" data-p="${p.id}">${cs && cst !== "expired" && cs.plan == p.id ? "✔ Current plan" : "Select Plan"}</button></article>`,
        )
        .join("");
      $$("[data-p]").forEach(
        (b) =>
          (b.onclick = () => {
            const p = plans().find((x) => x.id == b.dataset.p),
              m = modal(
                `<h2>Confirm ${esc(p.name)}</h2><p>₹${p.price.toLocaleString("en-IN")} for ${dur(p)}. Access: ${p.scope === "All" ? "all categories" : esc(p.scope)}.</p><p class="meta">Demo: no payment is taken; the plan is saved in this browser.</p><div class="acts"><button class="btn" id="cf">Confirm plan</button><button class="btn sec" data-x>Cancel</button></div>`,
              );
            $("#cf").onclick = () => {
              const all = LS("sv_subs", {});
              all[me().email] = {
                plan: p.id,
                start: new Date().toISOString(),
                end: new Date(Date.now() + p.days * DAY).toISOString(),
              };
              SV("sv_subs", all);
              m.close();
              toast(p.name + " activated");
              draw();
              nav("plans.html");
              $("#after").hidden = false;
            };
          }),
      );
    };
    draw();
    $("#after").hidden = !(s && st !== "expired");
  },
  browse() {
    const u = guard();
    if (!u) return;
    nav("browse.html");
    let cat = "All",
      q = "";
    const st = status(mySub());
    $("#chips").innerHTML = ["All", ...CATS]
      .map(
        (c) =>
          `<button class="chip c-${c}" aria-pressed="${c === "All"}" data-c="${c}">${c}</button>`,
      )
      .join("");
    if (st !== "active" && st !== "expiring")
      $("#ban").innerHTML =
        `<div class="al ${st === "expired" ? "bad" : "warn"}" role="alert">${st === "expired" ? "Your subscription has expired. Renew now to continue watching." : "You have no plan yet. Choose one to start watching."} <a href="plans.html">View plans</a></div>`;
    else if (st === "expiring")
      $("#ban").innerHTML =
        '<div class="al warn">Your plan expires soon. <a href="plans.html">Renew</a></div>';
    const draw = () => {
      const l = contents().filter(
        (c) => (cat === "All" || c.cat === cat) && c.title.toLowerCase().includes(q),
      );
      $("#grid").innerHTML = l.length
        ? l
            .map(
              (c) =>
                `<article class="card c-${c.cat}"><div style="display:flex;gap:6px;align-items:center"><span class="bd cat">${c.cat}</span>${c.rating >= 4.7 ? '<span class="bd warn">★ Top rated</span>' : ""}<span class="rt">★ ${c.rating}</span></div><h3>${esc(c.title)}</h3><div class="meta">${esc(c.lang)} · ${c.year} · ${esc(c.dur)}</div><button class="btn" data-w="${c.id}">Watch Now</button></article>`,
            )
            .join("")
        : `<div class="empty" style="grid-column:1/-1"><h3>No matching content</h3><p>Try another category or clear your search.</p><button class="btn sec" id="clr">Clear filters</button></div>`;
      $$("[data-w]").forEach(
        (b) => (b.onclick = () => player(contents().find((c) => c.id == b.dataset.w))),
      );
      const k = $("#clr");
      if (k)
        k.onclick = () => {
          cat = "All";
          q = "";
          $("#q").value = "";
          sync();
        };
    };
    const sync = () => {
        $$(".chip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.c === cat));
        load();
      },
      load = () => {
        $("#grid").innerHTML = '<div class="sk"></div>'.repeat(6);
        setTimeout(draw, 450);
      };
    $$(".chip").forEach(
      (b) =>
        (b.onclick = () => {
          cat = b.dataset.c;
          sync();
        }),
    );
    $("#q").oninput = (e) => {
      q = e.target.value.toLowerCase();
      draw();
    };
    $("#go").onclick = () => $("#chips").scrollIntoView({ behavior: "smooth" });
    window.afterPlayer = () => nav("browse.html");
    load();
    const w = new URLSearchParams(location.search).get("watch");
    if (w)
      setTimeout(() => {
        const c = contents().find((x) => x.id == w);
        c && player(c);
      }, 600);
  },
  history() {
    const u = guard();
    if (!u) return;
    nav("watch-history.html");
    let tab = "All";
    const rows = () =>
      LS("sv_hist", [])
        .filter((h) => h.email === u.email)
        .map((h) => ({ ...h, c: contents().find((c) => c.id == h.cid) }))
        .filter((h) => h.c)
        .sort((a, b) => new Date(b.at) - new Date(a.at));
    const draw = () => {
      const r = rows(),
        f = r.filter((h) => tab === "All" || (tab === "Completed") === h.pct >= 100);
      $$(".tabs .chip").forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.t === tab);
        const n =
          b.dataset.t === "All"
            ? r.length
            : r.filter((h) => (b.dataset.t === "Completed") === h.pct >= 100).length;
        b.textContent = b.dataset.t + " (" + n + ")";
      });
      $("#list").innerHTML = !r.length
        ? `<div class="empty"><h3>You haven't watched anything yet.</h3><p>Explore Browse to find something great.</p><a class="btn" href="browse.html">Explore Browse</a></div>`
        : !f.length
          ? '<div class="empty">Nothing in this tab yet.</div>'
          : f
              .map(
                (h) =>
                  `<div class="row c-${h.c.cat}" style="border-left:6px solid var(--ac)"><div class="t"><b>${esc(h.c.title)}</b><div class="meta">${h.c.cat} · ${ft(h.at)}</div></div><div class="pgw"><div class="pg"><b style="width:${h.pct}%"></b></div><b>${h.pct}%</b></div>${h.pct >= 100 ? '<span class="bd ok">✔ Completed</span>' : '<span class="bd warn">◔ In Progress</span>'}${h.pct < 100 ? `<a class="btn sm" href="browse.html?watch=${h.cid}">Resume</a>` : ""}</div>`,
              )
              .join("");
    };
    $$(".tabs .chip").forEach(
      (b) =>
        (b.onclick = () => {
          tab = b.dataset.t;
          draw();
        }),
    );
    draw();
  },
  profile() {
    const u = guard();
    if (!u) return;
    nav("my-subscription.html");
    const draw = () => {
      const u = me(),
        s = mySub(),
        st = status(s),
        p = planOf(s),
        h = LS("sv_hist", []).filter((x) => x.email === u.email);
      $("#pf").innerHTML =
        `<section class="sec2"><h2>Profile information</h2><dl class="kv"><dt>Name</dt><dd>${esc(u.name)}</dd><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Phone</dt><dd>${esc(u.phone)}</dd><dt>Account role</dt><dd>${u.role}</dd></dl></section>
  <section class="sec2"><h2>Subscription ${badge(st)}</h2>${s ? `<dl class="kv"><dt>Current plan</dt><dd>${esc(p ? p.name : "—")}</dd><dt>Start date</dt><dd>${fd(s.start)}</dd><dt>End date</dt><dd>${fd(s.end)}</dd></dl>` : "<p>You have no plan yet.</p>"}</section>
  <section class="sec2"><h2>Viewing statistics</h2><div class="stats"><div class="st"><b>${h.length}</b>Total items watched</div><div class="st" style="--ac:var(--te)"><b>${h.filter((x) => x.pct >= 100).length}</b>Completed items</div></div></section>
  <div class="acts"><button class="btn" id="ep">Edit Profile</button><button class="btn sec" id="cp">Change Password</button><a class="btn sec" href="watch-history.html">View Watch History</a><a class="btn co" href="plans.html">Manage Subscription</a></div>`;
      $("#ep").onclick = () => {
        const m = modal(
          `<h2>Edit profile</h2><form id="ef" novalidate>${F("name", "Full name", "text", u.name)}${F("phone", "Phone number", "tel", u.phone)}<div class="acts"><button class="btn">Save changes</button><button type="button" class="btn sec" data-x>Cancel</button></div></form>`,
        );
        $("#ef").onsubmit = (e) => {
          e.preventDefault();
          const n = $("#name").value.trim(),
            ph = $("#phone").value.trim();
          if (
            [
              setErr("name", n.length < 2 ? "Enter your name." : ""),
              setErr(
                "phone",
                /^[6-9]\d{9}$/.test(ph) ? "" : "Enter a 10-digit mobile number.",
              ),
            ].some(Boolean)
          )
            return;
          const us = LS("sv_users", []);
          const x = us.find((z) => z.email === u.email);
          x.name = n;
          x.phone = ph;
          SV("sv_users", us);
          m.close();
          toast("Profile updated");
          nav("my-subscription.html");
          draw();
        };
      };
      $("#cp").onclick = () => {
        const m = modal(
          `<h2>Change password</h2><form id="pf2" novalidate>${F("old", "Current password", "password")}${F("nw", "New password", "password")}${F("cf", "Confirm new password", "password")}<div class="acts"><button class="btn">Update password</button><button type="button" class="btn sec" data-x>Cancel</button></div></form>`,
        );
        bind(m.el);
        $("#pf2").onsubmit = (e) => {
          e.preventDefault();
          const us = LS("sv_users", []),
            x = us.find((z) => z.email === u.email);
          if (
            [
              setErr(
                "old",
                $("#old").value !== x.pass ? "Current password is incorrect." : "",
              ),
              setErr("nw", $("#nw").value.length < 8 ? "Use at least 8 characters." : ""),
              setErr(
                "cf",
                $("#cf").value !== $("#nw").value ? "Passwords do not match." : "",
              ),
            ].some(Boolean)
          )
            return;
          x.pass = $("#nw").value;
          SV("sv_users", us);
          m.close();
          toast("Password changed");
        };
      };
    };
    draw();
  },
  admin() {
    const u = guard(true);
    if (!u) return;
    const subs = () =>
        Object.entries(LS("sv_subs", {})).map(([email, s]) => ({ email, ...s })),
      hist = () => LS("sv_hist", []),
      users = () => LS("sv_users", []);
    const pn = (id) => {
        const p = plans().find((x) => x.id == id);
        return p ? p.name : "—";
      },
      ct = (id) => {
        const c = contents().find((x) => x.id == id);
        return c ? c.title : "—";
      };
    const E = {
      users: {
        t: "Users",
        get: users,
        set: (v) => SV("sv_users", v),
        cols: [
          ["Name", (r) => esc(r.name)],
          ["Email", (r) => esc(r.email)],
          ["Phone", (r) => esc(r.phone)],
          ["Subscription", (r) => badge(status(LS("sv_subs", {})[r.email]))],
        ],
        f: [
          ["name", "Full name"],
          ["email", "Email", "email"],
          ["phone", "Phone", "tel"],
          ["pass", "Password", "text"],
        ],
        add: 1,
        fl: ["All", "active", "expiring", "expired", "none"],
        fn: (r, v) => status(LS("sv_subs", {})[r.email]) === v,
      },
      plans: {
        t: "Subscription Plans",
        get: plans,
        set: (v) => SV("sv_plans", v),
        cols: [
          ["Plan", (r) => esc(r.name)],
          ["Price", (r) => "₹" + r.price],
          ["Duration", (r) => dur(r)],
          ["Scope", (r) => esc(r.scope)],
        ],
        f: [
          ["name", "Plan name"],
          ["price", "Price (₹)", "number"],
          ["days", "Days (30 or 365)", "number"],
          ["scope", "Scope", "select", ["All", "Movies, Series"]],
        ],
        add: 1,
      },
      content: {
        t: "Content",
        get: contents,
        set: (v) => SV("sv_content", v),
        cols: [
          ["Title", (r) => esc(r.title)],
          ["Category", (r) => `<span class="bd cat c-${r.cat}">${r.cat}</span>`],
          ["Language", (r) => esc(r.lang)],
          ["Year", (r) => r.year],
          ["Duration", (r) => esc(r.dur)],
          ["Rating", (r) => "★ " + r.rating],
        ],
        f: [
          ["title", "Title"],
          ["cat", "Category", "select", CATS],
          ["lang", "Language"],
          ["year", "Release year", "number"],
          ["dur", "Duration"],
          ["rating", "Rating (0–5)", "number"],
        ],
        add: 1,
        fl: ["All", ...CATS],
        fn: (r, v) => r.cat === v,
      },
      subs: {
        t: "Subscriptions",
        get: subs,
        set: (rows) => {
          const o = {};
          rows.forEach(({ email, ...s }) => (o[email] = s));
          SV("sv_subs", o);
        },
        cols: [
          ["User", (r) => esc(r.email)],
          ["Plan", (r) => esc(pn(r.plan))],
          ["Start", (r) => fd(r.start)],
          ["End", (r) => fd(r.end)],
          ["Status", (r) => badge(status(r))],
        ],
        f: [
          ["plan", "Plan", "select", plans().map((p) => [p.id, p.name])],
          ["end", "End date", "date"],
        ],
        fl: ["All", "active", "expiring", "expired"],
        fn: (r, v) => status(r) === v,
        remind: 1,
      },
      history: {
        t: "Watch History",
        get: hist,
        set: (v) => SV("sv_hist", v),
        cols: [
          ["User", (r) => esc(r.email)],
          ["Title", (r) => esc(ct(r.cid))],
          ["Watched", (r) => ft(r.at)],
          ["Progress", (r) => r.pct + "%"],
          [
            "Status",
            (r) =>
              r.pct >= 100
                ? '<span class="bd ok">✔ Completed</span>'
                : '<span class="bd warn">◔ In Progress</span>',
          ],
        ],
        fl: ["All", "Completed", "In Progress"],
        fn: (r, v) => (v === "Completed") === r.pct >= 100,
        ro: 1,
      },
    };
    let cur = "dashboard",
      pg = 1,
      q = "",
      fv = "All";
    const items = [
      ["dashboard", "Dashboard"],
      ["users", "Users"],
      ["plans", "Subscription Plans"],
      ["content", "Content"],
      ["subs", "Subscriptions"],
      ["history", "Watch History"],
      ["reports", "Reports"],
    ];
    $("#side").innerHTML =
      `<a class="logo" href="admin.html">${LOGO}</a>` +
      items.map((i) => `<button data-s="${i[0]}">${i[1]}</button>`).join("") +
      '<button id="lo">Logout</button>';
    $("#lo").onclick = logout;
    const go = (s) => {
      cur = s;
      pg = 1;
      q = "";
      fv = "All";
      $$("#side [data-s]").forEach((b) => {
        b.classList.toggle("on", b.dataset.s === s);
      });
      s === "dashboard" ? dash() : s === "reports" ? rep() : tbl();
    };
    $$("#side [data-s]").forEach((b) => (b.onclick = () => go(b.dataset.s)));
    function dash() {
      const s = subs(),
        ex = s.filter((x) => status(x) === "expired");
      $("#main").innerHTML = `<h1>Dashboard</h1><div class="stats">${[
        ["Total users", users().length, "#4F46E5"],
        [
          "Active subscriptions",
          s.filter((x) => status(x) !== "expired").length,
          "#0D9488",
        ],
        ["Expired subscriptions", ex.length, "#DC2626"],
        ["Total content items", contents().length, "#FF6B4A"],
        ["Watch-history records", hist().length, "#F59E0B"],
      ]
        .map((x) => `<div class="st" style="--ac:${x[2]}"><b>${x[1]}</b>${x[0]}</div>`)
        .join(
          "",
        )}</div><h2>Renewal reminders needed</h2>${ex.length ? `<div class="tw"><table><tr><th>User</th><th>Plan</th><th>Expired on</th></tr>${ex.map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(pn(x.plan))}</td><td>${fd(x.end)} ${badge("expired")}</td></tr>`).join("")}</table></div>` : '<div class="empty">No expired subscriptions.</div>'}`;
    }
    function rep() {
      const c = contents(),
        mx = Math.max(1, ...CATS.map((k) => c.filter((x) => x.cat === k).length)),
        w = {};
      hist().forEach((h) => (w[h.cid] = (w[h.cid] || 0) + 1));
      const top = Object.entries(w)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      $("#main").innerHTML =
        `<h1>Reports</h1><section class="sec2"><h2>Content by category</h2>${CATS.map(
          (k) => {
            const n = c.filter((x) => x.cat === k).length;
            return `<div class="hb c-${k}"><span>${k}</span><i style="width:${(n / mx) * 60}%"></i><b>${n}</b></div>`;
          },
        ).join(
          "",
        )}</section><section class="sec2"><h2>Most watched</h2>${top.length ? top.map((t) => `<div class="hb"><span style="width:180px">${esc(ct(t[0]))}</span><i style="width:${t[1] * 40}px"></i><b>${t[1]}</b></div>`).join("") : '<p class="meta">No viewing data yet.</p>'}</section>`;
    }
    function tbl() {
      const d = E[cur],
        all = d.get();
      let rows = all
        .map((r, i) => ({ r, i }))
        .filter(
          ({ r }) =>
            (fv === "All" || d.fn(r, fv)) && JSON.stringify(r).toLowerCase().includes(q),
        );
      const pages = Math.max(1, Math.ceil(rows.length / 6));
      pg = Math.min(pg, pages);
      const v = rows.slice((pg - 1) * 6, pg * 6);
      $("#main").innerHTML =
        `<div class="bar"><h1 style="margin:0;flex:1">${d.t}</h1>${d.add ? '<button class="btn" id="ad">+ Add</button>' : ""}</div><div class="bar" style="margin:14px 0"><input id="sq" type="search" placeholder="Search…" aria-label="Search" value="${esc(q)}">${d.fl ? `<select id="fs" aria-label="Filter">${d.fl.map((o) => `<option${o === fv ? " selected" : ""}>${o}</option>`).join("")}</select>` : ""}</div>${v.length ? `<div class="tw"><table><tr>${d.cols.map((c) => `<th scope="col">${c[0]}</th>`).join("")}<th scope="col">Actions</th></tr>${v.map(({ r, i }) => `<tr>${d.cols.map((c) => `<td>${c[1](r)}</td>`).join("")}<td>${d.f ? `<button class="btn sm sec" data-e="${i}">Edit</button> ` : ""}${d.remind && status(r) === "expired" ? `<button class="btn sm co" data-r="${i}">Remind</button> ` : ""}<button class="btn sm del" data-d="${i}">Delete</button></td></tr>`).join("")}</table></div>` : '<div class="empty"><h3>No records found</h3><p>Change the search or filter.</p></div>'}<div class="pgn"><button class="btn sm sec" id="pv"${pg < 2 ? " disabled" : ""}>Prev</button><span>Page ${pg} of ${pages}</span><button class="btn sm sec" id="nx"${pg >= pages ? " disabled" : ""}>Next</button></div>`;
      $("#sq").oninput = (e) => {
        q = e.target.value.toLowerCase();
        pg = 1;
        const p = e.target.selectionStart;
        tbl();
        const n = $("#sq");
        n.focus();
        n.setSelectionRange(p, p);
      };
      const fs = $("#fs");
      if (fs)
        fs.onchange = (e) => {
          fv = e.target.value;
          pg = 1;
          tbl();
        };
      $("#pv").onclick = () => {
        pg--;
        tbl();
      };
      $("#nx").onclick = () => {
        pg++;
        tbl();
      };
      const ad = $("#ad");
      if (ad) ad.onclick = () => form(-1);
      $$("[data-e]").forEach((b) => (b.onclick = () => form(+b.dataset.e)));
      $$("[data-r]").forEach(
        (b) =>
          (b.onclick = () =>
            toast(
              "Reminder flagged for " + all[b.dataset.r].email + " (demo: no email sent)",
            )),
      );
      $$("[data-d]").forEach(
        (b) =>
          (b.onclick = () => {
            const m = modal(
              `<h2>Delete this record?</h2><p>This cannot be undone.</p><div class="acts"><button class="btn del" id="yd">Delete</button><button class="btn sec" data-x>Cancel</button></div>`,
            );
            $("#yd").onclick = () => {
              all.splice(+b.dataset.d, 1);
              d.set(all);
              m.close();
              toast("Record deleted");
              tbl();
            };
          }),
      );
    }
    function form(i) {
      const d = E[cur],
        all = d.get(),
        r = i < 0 ? {} : all[i],
        K = cur === "content" ? { cat: "cat" } : {};
      const m = modal(
        `<h2>${i < 0 ? "Add" : "Edit"} ${d.t.replace(/s$/, "")}</h2><form id="af" novalidate>${d.f.map((f) => F(f[0], f[1], f[2] || "text", f[2] === "date" && r[f[0]] ? r[f[0]].slice(0, 10) : (r[f[0]] ?? ""), f[3])).join("")}<div class="acts"><button class="btn">Save</button><button type="button" class="btn sec" data-x>Cancel</button></div></form>`,
      );
      $("#af").onsubmit = (e) => {
        e.preventDefault();
        let bad = 0;
        const o = {};
        d.f.forEach((f) => {
          let v = $("#" + f[0]).value.trim();
          if (setErr(f[0], v ? "" : "Required")) bad = 1;
          o[f[0]] =
            f[2] === "number" || f[0] === "plan"
              ? +v
              : f[2] === "date"
                ? new Date(v).toISOString()
                : v;
        });
        if (bad) return;
        if (cur === "users" && all.some((u, j) => u.email === o.email && j !== i)) {
          setErr("email", "Email already exists");
          return;
        }
        if (i < 0) {
          o.id = Date.now();
          if (cur === "users") o.role = "User";
          all.push(o);
        } else Object.assign(all[i], o);
        d.set(all);
        m.close();
        toast("Saved");
        tbl();
      };
    }
    go("dashboard");
  },
};
pages[PG] && pages[PG]();
$$(".logo").forEach((e) => {
  if (!e.innerHTML) e.innerHTML = LOGO;
});
