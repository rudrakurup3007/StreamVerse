/* StreamVerse – every call to the backend lives in this file. */
const API_URL = "http://127.0.0.1:8000";

const API = {
  token: () => localStorage.getItem("sv_token"),
  setToken: (t) => localStorage.setItem("sv_token", t),
  clear: () => localStorage.removeItem("sv_token"),
};

function errorText(data, status) {
  if (data && typeof data.detail === "string") return data.detail;
  if (data && Array.isArray(data.detail) && data.detail.length) {
    const d = data.detail[0],
      field = d.loc && d.loc[d.loc.length - 1],
      msg = String(d.msg).replace(/^Value error, /, "");
    return String(d.msg).startsWith("Value error") || !field ? msg : field + ": " + msg;
  }
  return "Something went wrong (error " + status + ")";
}

async function request(method, path, body) {
  const headers = {},
    token = API.token();
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Cannot reach the server. Please check that the backend is running.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) {
    if (res.status === 401 && token && path !== "/auth/login") API.clear();
    const err = new Error(errorText(data, res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- converting database values to what the pages use ---------- */
const day = (d) => (d ? d + "T00:00:00" : d);
const pad = (n) => String(n).padStart(2, "0");

const fmtDur = (min) =>
  min >= 60 ? Math.floor(min / 60) + "h " + pad(min % 60) + "m" : min + "m";

// "2h 04m", "2h", "45m" or plain minutes -> minutes (NaN if it makes no sense)
function parseDur(text) {
  const t = String(text).trim().toLowerCase();
  if (/^\d+$/.test(t)) return +t;
  const m = t.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m?)?$/);
  if (!m || (!m[1] && !m[2])) return NaN;
  return (+m[1] || 0) * 60 + (+m[2] || 0);
}

const monthsFromDays = (days) =>
  days >= 365 ? Math.max(12, Math.round(days / 365) * 12) : Math.max(1, Math.round(days / 30));
const daysFromMonths = (m) => (m % 12 === 0 ? (m / 12) * 365 : m * 30);

const toUser = (u) => ({
  id: u.User_ID,
  name: u.Name,
  email: u.Email,
  phone: u.Phone || "",
  role: u.Role,
});

const toPlan = (p) => ({
  id: p.Plan_ID,
  name: p.Plan_Name,
  price: Number(p.Price),
  months: p.Duration_Months,
  days: daysFromMonths(p.Duration_Months),
  scope: p.Access_Type === "All" ? "All" : "Movies, Series",
  q: p.Video_Quality,
});

const toContent = (c) => ({
  id: c.Content_ID,
  title: c.Title,
  cat: c.Type,
  lang: c.Language,
  year: c.Release_Year,
  dur: fmtDur(c.Duration_Minutes),
  rating: Math.round(Number(c.Rating) * 5) / 10,
});

const toSub = (s) =>
  s.State === "none"
    ? null
    : { id: s.Subscription_ID, plan: s.Plan_ID, start: day(s.Start_Date), end: day(s.End_Date), state: s.State };

const toHistory = (h) => ({
  id: h.History_ID,
  cid: h.Content_ID,
  at: h.Watched_At,
  pct: h.Progress,
  email: h.Email || "",
  title: h.Title,
});

const planBody = (o, quality) => ({
  plan_name: o.name,
  price: o.price,
  duration_months: monthsFromDays(o.days),
  video_quality: quality || "HD",
  access_type: o.scope === "All" ? "All" : "Limited",
});

const contentBody = (o) => ({
  title: o.title,
  type: o.cat,
  release_year: o.year,
  language: o.lang,
  duration_minutes: parseDur(o.dur),
  rating: Math.round(o.rating * 20) / 10,
});

/* ---------- user calls ---------- */
API.login = (email, password) => request("POST", "/auth/login", { email, password });
API.signup = (o) =>
  request("POST", "/auth/signup", { name: o.name, email: o.email, phone: o.phone, password: o.pass });
API.logout = () => API.clear();
API.me = async () => toUser(await request("GET", "/auth/me"));
API.updateProfile = async (name, phone) => toUser(await request("PUT", "/auth/me", { name, phone }));
API.changePassword = (old_password, new_password) =>
  request("PUT", "/auth/password", { old_password, new_password });
API.plans = async () => (await request("GET", "/subscriptions/plans")).map(toPlan);
API.mySub = async () => toSub(await request("GET", "/subscriptions/me"));
API.subscribe = (plan_id) => request("POST", "/subscriptions/subscribe", { plan_id });
API.content = async () => (await request("GET", "/content")).map(toContent);
API.access = (id) => request("GET", "/watch/access/" + id);
API.saveProgress = (content_id, progress) =>
  request("POST", "/watch/progress", { content_id, progress });
API.history = async () => (await request("GET", "/watch/history")).map(toHistory);
API.parseDur = parseDur;

/* ---------- admin calls ---------- */
API.admin = {
  dashboard: () => request("GET", "/admin/dashboard"),
  reports: () => request("GET", "/admin/reports"),

  users: async () =>
    (await request("GET", "/admin/users")).map((u) => ({ ...toUser(u), state: u.Subscription_State })),
  addUser: (o) =>
    request("POST", "/admin/users", { name: o.name, email: o.email, phone: o.phone, password: o.pass }),
  editUser: (row, o) =>
    request("PUT", "/admin/users/" + row.id, {
      name: o.name,
      email: o.email,
      phone: o.phone,
      new_password: o.pass || null,
    }),
  delUser: (row) => request("DELETE", "/admin/users/" + row.id),

  addPlan: (o) => request("POST", "/admin/plans", planBody(o)),
  editPlan: (row, o) => request("PUT", "/admin/plans/" + row.id, planBody(o, row.q)),
  delPlan: (row) => request("DELETE", "/admin/plans/" + row.id),

  addContent: (o) => request("POST", "/admin/content", contentBody(o)),
  editContent: (row, o) => request("PUT", "/admin/content/" + row.id, contentBody(o)),
  delContent: (row) => request("DELETE", "/admin/content/" + row.id),

  subs: async (state) =>
    (await request("GET", "/admin/subscriptions" + (state ? "?state=" + state : ""))).map((s) => ({
      id: s.Subscription_ID,
      name: s.Name,
      email: s.Email,
      plan: s.Plan_ID,
      start: day(s.Start_Date),
      end: day(s.End_Date),
      state: s.State,
      st: s.Status,
    })),
  editSub: (row, o) =>
    request("PUT", "/admin/subscriptions/" + row.id, { plan_id: o.plan, status: o.st }),
  delSub: (row) => request("DELETE", "/admin/subscriptions/" + row.id),

  history: async () =>
    (await request("GET", "/admin/watch-history")).map((h) => toHistory(h)),
  delHistory: (row) => request("DELETE", "/admin/watch-history/" + row.id),
};