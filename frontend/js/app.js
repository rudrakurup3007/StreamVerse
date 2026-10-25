/* StreamVerse – plain JS. Data comes from the backend through api.js. */
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const CATS = ["Movies", "Series", "News", "Sports", "Kids"],
  DAY = 864e5;
const LOGO =
  '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="6" width="22" height="22" rx="7" fill="#FF6B4A"/><rect x="6" y="2" width="22" height="22" rx="7" fill="#4F46E5"/><path d="M14 9l8 5-8 5z" fill="#fff"/></svg><b>Stream<span>Verse</span></b>';
const fd = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  ft = (d) =>
    fd(d) +
    ", " +
    new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
let USER = null,
  SUB = null,
  PLANS = [],
  CONTENT = [],
  HIST = [];
const me = () => USER,
  mySub = () => SUB,
  plans = () => PLANS,
  contents = () => CONTENT;
const status = (s) => (!s || s.state === "upcoming" ? "none" : s.state),
  live = (st) => st === "active" || st === "expiring";
const badge = (s) =>
  ({
    active: '<span class="bd ok">✔ Active</span>',
    expiring: '<span class="bd warn">⚠ Expiring Soon</span>',
    expired: '<span class="bd bad">✕ Expired</span>',
    cancelled: '<span class="bd mut">– Cancelled</span>',
    none: '<span class="bd mut">– No plan</span>',
  })[s] || '<span class="bd mut">– No plan</span>';
const dur = (p) => (p.months === 12 ? "1 year" : p.months === 1 ? "1 month" : p.months + " months"),
  planOf = (s) => s && plans().find((p) => p.id == s.plan);
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
    API.logout();
    location = "login.html";
  };
}
const logout = () => {
  API.logout();
  location = "login.html";
};
/* ---------- history + player ---------- */
async function player(c) {
  let a;
  try {
    a = await API.access(c.id);
  } catch (err) {
    toast(err.message, "bad");
    return;
  }
  let body, t;
  const head = `<h2 id="pt">${esc(c.title)}</h2><span class="bd cat c-${c.cat}">${c.cat}</span> <span class="meta">${c.lang} · ${c.year} · ${c.dur}</span>`;
  if (!a.allowed && a.reason === "category_not_included") {
    body = `<div class="al warn" role="alert">${esc(a.message)}</div><a class="btn" href="plans.html">Explore Plans</a>`;
  } else if (!a.allowed) {
    body = `<div class="al bad" role="alert">${esc(a.message)}</div><div class="acts"><a class="btn" href="plans.html">Renew Plan</a><a class="btn sec" href="plans.html">View Plans</a></div>`;
  } else {
    let pct = a.resume_from,
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
      const done = () => window.afterPlayer && afterPlayer();
      if (m.getPct && m.getPct() > 0)
        API.saveProgress(c.id, m.getPct())
          .then(() => toast("Progress saved to Watch History"))
          .catch((err) => toast(err.message, "bad"))
          .finally(done);
      else done();
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
    c.innerHTML = `<h2>Welcome back</h2><p class="meta">Sign in to keep watching.</p><div class="seg" role="tablist"><button class="on" data-m="User">User</button><button data-m="Admin">Admin</button></div><div id="al"></div><form id="fm" novalidate>${F("email", "Email", "email")}${F("pw", "Password", "password")}<button class="btn" style="width:100%" id="go">Sign In</button></form><p id="su">Don't have an account? <a href="signup.html">Sign up</a></p><p class="meta" id="hint">Demo user: rahul@gmail.com / Demo@1234</p>`;
    bind(c);
    $$(".seg button").forEach(
      (b) =>
        (b.onclick = () => {
          mode = b.dataset.m;
          $$(".seg button").forEach((x) => x.classList.toggle("on", x === b));
          $("#su").hidden = mode === "Admin";
          $("#hint").textContent =
            mode === "Admin"
              ? "Demo admin: admin@streamverse.com / Admin@1234"
              : "Demo user: rahul@gmail.com / Demo@1234";
        }),
    );
    $("#fm").onsubmit = async (e) => {
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
      const fail = (m) => {
        g.disabled = false;
        g.textContent = "Sign In";
        $("#al").innerHTML = `<div class="al bad" role="alert">${esc(m)}</div>`;
      };
      const wrong = `Incorrect email or password for ${mode.toLowerCase()} sign in.`;
      let r;
      try {
        r = await API.login(em, pw);
      } catch (err) {
        return fail(err.status === 401 ? wrong : err.message);
      }
      if (r.user.Role !== mode) return fail(wrong);
      API.setToken(r.token);
      $("#al").innerHTML = '<div class="al ok" role="status">✔ Signed in. Redirecting…</div>';
      setTimeout(() => (location = mode === "Admin" ? "admin.html" : "browse.html"), 700);
    };
  },
  signup() {
    const c = $("#card");
    c.innerHTML = `<h2>Create your account</h2><p class="meta">It takes under a minute.</p><form id="fm" novalidate>${F("name", "Full name")}${F("email", "Email address", "email")}${F("phone", "Phone number", "tel")}${F("pw", "Password", "password")}${F("cf", "Confirm password", "password")}<button class="btn" style="width:100%">Create Account</button></form><p>Already registered? <a href="login.html">Sign in</a></p>`;
    bind(c);
    $("#fm").onsubmit = async (e) => {
      e.preventDefault();
      const v = (id) => $("#" + id).value.trim();
      const er = [
        setErr("name", v("name").length < 2 ? "Enter your full name." : ""),
        setErr(
          "email",
          !EM.test(v("email")) ? "Enter a valid email." : "",
        ),
        setErr(
          "phone",
          !/^[6-9]\d{9}$/.test(v("phone")) ? "Enter a 10-digit mobile number." : "",
        ),
        setErr("pw", $("#pw").value.length < 8 ? "Use at least 8 characters." : ""),
        setErr("cf", $("#cf").value !== $("#pw").value ? "Passwords do not match." : ""),
      ];
      if (er.some(Boolean)) return;
      const g = $("#fm .btn");
      g.disabled = true;
      try {
        await API.signup({
          name: v("name"),
          email: v("email"),
          phone: v("phone"),
          pass: $("#pw").value,
        });
        API.setToken((await API.login(v("email"), $("#pw").value)).token);
      } catch (err) {
        g.disabled = false;
        if (/email/i.test(err.message)) setErr("email", err.message);
        else if (/phone/i.test(err.message)) setErr("phone", err.message);
        else if (/password/i.test(err.message)) setErr("pw", err.message);
        else toast(err.message, "bad");
        return;
      }
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
            `<article class="plan${p.id == 2 ? " pop" : ""}${cs && live(cst) && cs.plan == p.id ? " sel" : ""}">${p.id == 2 ? '<span class="tag">Most Popular</span>' : p.days >= 365 ? '<span class="tag" style="background:var(--te)">Best Value</span>' : ""}<h2>${esc(p.name)}</h2><div class="price">₹${p.price.toLocaleString("en-IN")}</div><div class="meta">${dur(p)}</div><span class="bd ${p.scope === "All" ? "ok" : "mut"}">${p.scope === "All" ? "All categories" : esc(p.scope)}</span><ul><li>${p.scope === "All" ? "Movies, Series, News, Sports & Kids" : esc(p.scope) + " only"}</li><li>Watch history & resume</li><li>Cancel anytime</li></ul><button class="btn${p.id == 2 ? " co" : ""}" data-p="${p.id}">${cs && live(cst) && cs.plan == p.id ? "✔ Current plan" : "Select Plan"}</button></article>`,
        )
        .join("");
      $$("[data-p]").forEach(
        (b) =>
          (b.onclick = () => {
            const p = plans().find((x) => x.id == b.dataset.p),
              m = modal(
                `<h2>Confirm ${esc(p.name)}</h2><p>₹${p.price.toLocaleString("en-IN")} for ${dur(p)}. Access: ${p.scope === "All" ? "all categories" : esc(p.scope)}.</p><p class="meta">Demo: no payment is taken; the plan is saved to your account.</p><div class="acts"><button class="btn" id="cf">Confirm plan</button><button class="btn sec" data-x>Cancel</button></div>`,
              );
            $("#cf").onclick = async () => {
              try {
                await API.subscribe(p.id);
                SUB = await API.mySub();
              } catch (err) {
                m.close();
                toast(err.message, "bad");
                return;
              }
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
    $("#after").hidden = !live(st);
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
      HIST
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
        h = HIST;
      $("#pf").innerHTML =
        `<section class="sec2"><h2>Profile information</h2><dl class="kv"><dt>Name</dt><dd>${esc(u.name)}</dd><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Phone</dt><dd>${esc(u.phone)}</dd><dt>Account role</dt><dd>${u.role}</dd></dl></section>
  <section class="sec2"><h2>Subscription ${badge(st)}</h2>${s ? `<dl class="kv"><dt>Current plan</dt><dd>${esc(p ? p.name : "—")}</dd><dt>Start date</dt><dd>${fd(s.start)}</dd><dt>End date</dt><dd>${fd(s.end)}</dd></dl>` : "<p>You have no plan yet.</p>"}</section>
  <section class="sec2"><h2>Viewing statistics</h2><div class="stats"><div class="st"><b>${h.length}</b>Total items watched</div><div class="st" style="--ac:var(--te)"><b>${h.filter((x) => x.pct >= 100).length}</b>Completed items</div></div></section>
  <div class="acts"><button class="btn" id="ep">Edit Profile</button><button class="btn sec" id="cp">Change Password</button><a class="btn sec" href="watch-history.html">View Watch History</a><a class="btn co" href="plans.html">Manage Subscription</a></div>`;
      $("#ep").onclick = () => {
        const m = modal(
          `<h2>Edit profile</h2><form id="ef" novalidate>${F("name", "Full name", "text", u.name)}${F("phone", "Phone number", "tel", u.phone)}<div class="acts"><button class="btn">Save changes</button><button type="button" class="btn sec" data-x>Cancel</button></div></form>`,
        );
        $("#ef").onsubmit = async (e) => {
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
          try {
            USER = await API.updateProfile(n, ph);
          } catch (err) {
            if (/phone/i.test(err.message)) setErr("phone", err.message);
            else toast(err.message, "bad");
            return;
          }
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
        $("#pf2").onsubmit = async (e) => {
          e.preventDefault();
          if (
            [
              setErr("old", $("#old").value ? "" : "Enter your current password."),
              setErr("nw", $("#nw").value.length < 8 ? "Use at least 8 characters." : ""),
              setErr(
                "cf",
                $("#cf").value !== $("#nw").value ? "Passwords do not match." : "",
              ),
            ].some(Boolean)
          )
            return;
          try {
            await API.changePassword($("#old").value, $("#nw").value);
          } catch (err) {
            if (/current/i.test(err.message)) setErr("old", err.message);
            else toast(err.message, "bad");
            return;
          }
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
    const pn = (id) => {
        const p = plans().find((x) => x.id == id);
        return p ? p.name : "—";
      },
      ct = (id) => {
        const c = contents().find((x) => x.id == id);
        return c ? c.title : "—";
      },
      planOpts = () => plans().map((p) => [p.id, p.name]);
    const E = {
      users: {
        t: "Users",
        rows: [],
        load: async () => (E.users.rows = await API.admin.users()),
        api: { add: API.admin.addUser, edit: API.admin.editUser, del: API.admin.delUser },
        cols: [
          ["Name", (r) => esc(r.name)],
          ["Email", (r) => esc(r.email)],
          ["Phone", (r) => esc(r.phone)],
          ["Subscription", (r) => badge(status(r))],
        ],
        f: [
          ["name", "Full name"],
          ["email", "Email", "email"],
          ["phone", "Phone", "tel"],
          ["pass", "Password", "text"],
        ],
        add: 1,
        fl: ["All", "active", "expiring", "expired", "none"],
        fn: (r, v) => status(r) === v,
      },
      plans: {
        t: "Subscription Plans",
        rows: [],
        load: async () => {
          PLANS = await API.plans();
          E.subs.f[0][3] = planOpts();
          return (E.plans.rows = PLANS);
        },
        api: { add: API.admin.addPlan, edit: API.admin.editPlan, del: API.admin.delPlan },
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
        check: (o) =>
          o.price < 0
            ? ["price", "Enter 0 or more"]
            : o.days < 1
              ? ["days", "Enter 30 or 365"]
              : null,
      },
      content: {
        t: "Content",
        rows: [],
        load: async () => {
          CONTENT = await API.content();
          return (E.content.rows = CONTENT);
        },
        api: { add: API.admin.addContent, edit: API.admin.editContent, del: API.admin.delContent },
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
        check: (o) => {
          const m = API.parseDur(o.dur);
          return !(m > 0)
            ? ["dur", "Use a format like 2h 04m or 45m"]
            : o.rating < 0 || o.rating > 5
              ? ["rating", "Enter 0 to 5"]
              : o.year < 1901 || o.year > 2155
                ? ["year", "Enter a year from 1901 to 2155"]
                : null;
        },
      },
      subs: {
        t: "Subscriptions",
        rows: [],
        load: async () => (E.subs.rows = await API.admin.subs()),
        api: { edit: API.admin.editSub, del: API.admin.delSub },
        cols: [
          ["User", (r) => esc(r.email)],
          ["Plan", (r) => esc(pn(r.plan))],
          ["Start", (r) => fd(r.start)],
          ["End", (r) => fd(r.end)],
          ["Status", (r) => badge(status(r))],
        ],
        f: [
          ["plan", "Plan", "select", planOpts()],
          ["st", "Status", "select", ["Active", "Expired", "Cancelled"]],
        ],
        fl: ["All", "active", "expiring", "expired", "cancelled"],
        fn: (r, v) => status(r) === v,
        remind: 1,
      },
      history: {
        t: "Watch History",
        rows: [],
        load: async () => (E.history.rows = await API.admin.history()),
        api: { del: API.admin.delHistory },
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
    const go = async (s) => {
      cur = s;
      pg = 1;
      q = "";
      fv = "All";
      $$("#side [data-s]").forEach((b) => {
        b.classList.toggle("on", b.dataset.s === s);
      });
      try {
        if (s === "dashboard") await dash();
        else if (s === "reports") await rep();
        else {
          await E[s].load();
          tbl();
        }
      } catch (err) {
        toast(err.message, "bad");
      }
    };
    $$("#side [data-s]").forEach((b) => (b.onclick = () => go(b.dataset.s)));
    async function dash() {
      const t = await API.admin.dashboard(),
        users = await API.admin.users(),
        subs = await API.admin.subs("expired"),
        ex = users
          .filter((u) => u.state === "expired")
          .map((u) => ({
            email: u.email,
            ...subs.filter((x) => x.email === u.email).sort((a, b) => b.id - a.id)[0],
          }));
      $("#main").innerHTML = `<h1>Dashboard</h1><div class="stats">${[
        ["Total users", t.total_users, "#4F46E5"],
        ["Active subscriptions", t.active_subscriptions, "#0D9488"],
        ["Expired subscriptions", ex.length, "#DC2626"],
        ["Total content items", t.total_content, "#FF6B4A"],
        ["Watch-history records", t.total_watch_history, "#F59E0B"],
      ]
        .map((x) => `<div class="st" style="--ac:${x[2]}"><b>${x[1]}</b>${x[0]}</div>`)
        .join(
          "",
        )}</div><h2>Renewal reminders needed</h2>${ex.length ? `<div class="tw"><table><tr><th>User</th><th>Plan</th><th>Expired on</th></tr>${ex.map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(pn(x.plan))}</td><td>${fd(x.end)} ${badge("expired")}</td></tr>`).join("")}</table></div>` : '<div class="empty">No expired subscriptions.</div>'}`;
    }
    async function rep() {
      const R = await API.admin.reports(),
        mx = Math.max(1, ...R.content_by_category.map((x) => x.items));
      $("#main").innerHTML =
        `<h1>Reports</h1><section class="sec2"><h2>Content by category</h2>${R.content_by_category
          .map(
            (x) =>
              `<div class="hb c-${x.Type}"><span>${x.Type}</span><i style="width:${(x.items / mx) * 60}%"></i><b>${x.items}</b></div>`,
          )
          .join(
            "",
          )}</section><section class="sec2"><h2>Most watched</h2>${R.most_watched.length ? R.most_watched.map((t) => `<div class="hb"><span style="width:180px">${esc(t.Title)}</span><i style="width:${t.views * 40}px"></i><b>${t.views}</b></div>`).join("") : '<p class="meta">No viewing data yet.</p>'}</section>`;
    }
    function tbl() {
      const d = E[cur],
        all = d.rows;
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
            $("#yd").onclick = async () => {
              try {
                await d.api.del(all[+b.dataset.d]);
                await d.load();
              } catch (err) {
                m.close();
                toast(err.message, "bad");
                return;
              }
              m.close();
              toast("Record deleted");
              tbl();
            };
          }),
      );
    }
    function form(i) {
      const d = E[cur],
        all = d.rows,
        r = i < 0 ? {} : all[i],
        K = cur === "content" ? { cat: "cat" } : {};
      const m = modal(
        `<h2>${i < 0 ? "Add" : "Edit"} ${d.t.replace(/s$/, "")}</h2><form id="af" novalidate>${d.f.map((f) => F(f[0], i >= 0 && cur === "users" && f[0] === "pass" ? "New password (leave blank to keep)" : f[1], f[2] || "text", f[2] === "date" && r[f[0]] ? r[f[0]].slice(0, 10) : (r[f[0]] ?? ""), f[3])).join("")}<div class="acts"><button class="btn">Save</button><button type="button" class="btn sec" data-x>Cancel</button></div></form>`,
      );
      $("#af").onsubmit = async (e) => {
        e.preventDefault();
        let bad = 0;
        const o = {};
        d.f.forEach((f) => {
          let v = $("#" + f[0]).value.trim();
          const optional = cur === "users" && f[0] === "pass" && i >= 0;
          if (setErr(f[0], v || optional ? "" : "Required")) bad = 1;
          o[f[0]] = f[2] === "number" || f[0] === "plan" ? +v : v;
        });
        if (bad) return;
        const problem = d.check && d.check(o);
        if (problem) {
          setErr(problem[0], problem[1]);
          return;
        }
        if (cur === "users" && all.some((u, j) => u.email === o.email && j !== i)) {
          setErr("email", "Email already exists");
          return;
        }
        try {
          if (i < 0) await d.api.add(o);
          else await d.api.edit(all[i], o);
          await d.load();
        } catch (err) {
          toast(err.message, "bad");
          return;
        }
        m.close();
        toast("Saved");
        tbl();
      };
    }
    go("dashboard");
  },
};
async function boot() {
  try {
    PLANS = await API.plans();
    if (API.token()) {
      try {
        USER = await API.me();
        CONTENT = await API.content();
        if (USER.role !== "Admin") {
          SUB = await API.mySub();
          if (PG === "history" || PG === "profile") HIST = await API.history();
        }
      } catch (e) {
        if (e.status === 401) USER = null;
        else throw e;
      }
    }
  } catch (e) {
    toast(e.message, "bad");
  }
  pages[PG] && pages[PG]();
}
boot();
$$(".logo").forEach((e) => {
  if (!e.innerHTML) e.innerHTML = LOGO;
});