import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TeamsWorkspace from "./TeamsWorkspace";

const API = "/api";
const STATUSES = [
  { value: "TODO", label: "To do", tone: "todo", icon: "circle" },
  { value: "IN_PROGRESS", label: "In progress", tone: "progress", icon: "clock" },
  { value: "DONE", label: "Done", tone: "done", icon: "checkCircle" },
];
const iconMap = {
  spark: <><path d="m12 3 1.8 5.7L20 11l-6.2 2.3L12 19l-1.8-5.7L4 11l6.2-2.3L12 3Z" /><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  arrow: <><path d="M7 17 17 7M8 7h9v9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  circle: <circle cx="12" cy="12" r="9" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 17.5 6L20 12M4 12l2.5 6A7 7 0 0 0 18.4 15" /></>,
  moon: <path d="M20.8 14A8.7 8.7 0 0 1 10 3.2 8.9 8.9 0 1 0 20.8 14Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  trend: <><path d="m3 16 6-6 4 4 8-9" /><path d="M15 5h6v6" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7s-1.1 2.1-3.1 3.8M6.2 6.3C3.5 8.2 2 12 2 12s3.6 7 10 7a10.6 10.6 0 0 0 4-.8" /></>,
};
function Icon({ name, size = 18, className = "" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconMap[name] || iconMap.spark}</svg>;
}
async function getCsrfToken() {
  const response = await fetch(API + "/auth/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Secure connection failed. Refresh the page and try again.");
  const data = await response.json();
  if (!data.token) throw new Error("Security token missing. Refresh the page and try again.");
  return data.token;
}
async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) headers["X-XSRF-TOKEN"] = await getCsrfToken();
  const response = await fetch(path, { method, credentials: "same-origin", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  if (response.status === 204) return null;
  let payload = null;
  if ((response.headers.get("content-type") || "").includes("json")) payload = await response.json().catch(() => null);
  else { const text = await response.text().catch(() => ""); payload = text ? { detail: text } : null; }
  if (!response.ok) {
    const error = new Error((payload && (payload.detail || payload.message || payload.error)) || (response.status === 401 ? "Please sign in to continue." : "Request failed. Please try again."));
    error.status = response.status;
    throw error;
  }
  return payload;
}
const normalizeStatus = (status) => STATUSES.some((item) => item.value === String(status || "").toUpperCase()) ? String(status).toUpperCase() : "TODO";
const todayLabel = () => new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(new Date());

function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busyTaskIds, setBusyTaskIds] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [activePage, setActivePage] = useState("overview");
  const [theme, setTheme] = useState(() => { try { return window.localStorage.getItem("taskflow-theme") || "dark"; } catch { return "dark"; } });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const toastTimer = useRef(null);

  const notify = useCallback((message, type = "success") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const result = await apiRequest(API + "/tasks");
      const loaded = Array.isArray(result) ? result : [];
      loaded.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      setTasks(loaded);
    } catch (error) {
      if (error.status === 401) { setUser(null); setTasks([]); }
      else setLoadError(error.message || "Couldn't load tasks. Check your connection and try again.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiRequest(API + "/auth/me");
        if (!cancelled) {
          setUser(result.user);
          setProfileName(result.user.name || "");
          setProfileAvatarUrl(result.user.avatarUrl || "");
          await loadTasks();
        }
      } catch (error) {
        if (!cancelled && error.status !== 401) setAuthError("TaskFlow couldn't connect to the server. Refresh the page and try again.");
      } finally { if (!cancelled) setAuthChecking(false); }
    })();
    return () => { cancelled = true; if (toastTimer.current) window.clearTimeout(toastTimer.current); };
  }, [loadTasks]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem("taskflow-theme", theme); } catch { /* storage may be disabled */ }
  }, [theme]);

  useEffect(() => {
    if (!isCreateOpen && !isProfileOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (isCreateOpen && !isSaving) closeCreateModal();
        if (isProfileOpen && !isProfileSaving) closeProfileModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCreateOpen, isProfileOpen, isSaving, isProfileSaving]);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => normalizeStatus(task.status) === "DONE").length;
    const inProgress = tasks.filter((task) => normalizeStatus(task.status) === "IN_PROGRESS").length;
    const todo = tasks.filter((task) => normalizeStatus(task.status) === "TODO").length;
    return { total: tasks.length, completed, inProgress, todo, completion: tasks.length ? Math.round(completed / tasks.length * 100) : 0 };
  }, [tasks]);
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const status = normalizeStatus(task.status);
      const matchesFilter = filter === "all" || (filter === "active" && status !== "DONE") || (filter === "completed" && status === "DONE");
      const matchesSearch = !query || [task.title, task.description, String(task.id || "")].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [tasks, search, filter]);
  const board = useMemo(() => STATUSES.map((status) => ({ ...status, tasks: filteredTasks.filter((task) => normalizeStatus(task.status) === status.value) })), [filteredTasks]);

  async function handleAuthSubmit(event) {
    event.preventDefault(); setAuthError("");
    const email = authEmail.trim().toLowerCase();
    const name = authName.trim();
    if (authMode === "register" && !name) { setAuthError("Enter your name to create an account."); return; }
    if (!email || !authPassword) { setAuthError("Enter your email address and password."); return; }
    if (authMode === "register" && authPassword.length < 8) { setAuthError("Use at least 8 characters for your password."); return; }
    setAuthLoading(true);
    try {
      const result = await apiRequest(API + "/auth/" + (authMode === "register" ? "register" : "login"), {
        method: "POST",
        body: authMode === "register" ? { name, email, password: authPassword } : { email, password: authPassword },
      });
      setUser(result.user); setProfileName(result.user.name || ""); setProfileAvatarUrl(result.user.avatarUrl || ""); setAuthPassword(""); setAuthError("");
      await loadTasks();
      notify(authMode === "register" ? "Welcome to TaskFlow. Your workspace is ready." : "Welcome back, " + result.user.name + ".");
    } catch (error) { setAuthError(error.message || "Couldn't sign in. Please try again."); }
    finally { setAuthLoading(false); setAuthChecking(false); }
  }

  async function handleLogout() {
    setIsAccountMenuOpen(false);
    try { await apiRequest(API + "/auth/logout", { method: "POST" }); }
    catch (error) {
      if (error.status !== 401) { notify(error.message || "Sign-out couldn't be confirmed. Please try again.", "error"); return; }
    }
    setUser(null); setTasks([]); setAuthMode("login"); setAuthName(""); setAuthEmail(""); setAuthPassword(""); setAuthError(""); setIsProfileOpen(false); setActivePage("overview");
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    const cleaned = profileName.trim();
    if (!cleaned) { setProfileError("Name cannot be empty."); return; }
    setIsProfileSaving(true); setProfileError("");
    try {
      const result = await apiRequest(API + "/auth/profile", { method: "PATCH", body: { name: cleaned, avatarUrl: profileAvatarUrl } });
      setUser(result.user); setProfileName(result.user.name); setProfileAvatarUrl(result.user.avatarUrl || ""); setIsProfileOpen(false); setActivePage("overview"); notify("Your profile has been updated.");
    } catch (error) { setProfileError(error.message || "Couldn't update your profile."); }
    finally { setIsProfileSaving(false); }
  }

  async function handleCreate(event) {
    event.preventDefault();
    const cleanedTitle = title.trim(); const cleanedDescription = description.trim();
    if (!cleanedTitle) return;
    setIsSaving(true);
    try {
      const saved = await apiRequest(API + "/tasks", { method: "POST", body: { title: cleanedTitle, description: cleanedDescription, status: "TODO" } });
      setTasks((current) => [saved, ...current]); setTitle(""); setDescription(""); setIsCreateOpen(false); setFilter("all"); setSearch(""); setActivePage("tasks"); notify("Task created. Let's make it happen.");
    } catch (error) { if (error.status === 401) setUser(null); notify(error.message || "Couldn't save that task. Try again.", "error"); }
    finally { setIsSaving(false); }
  }

  async function handleStatusChange(task, nextStatus) {
    if (normalizeStatus(task.status) === nextStatus || busyTaskIds.has(task.id)) return;
    setBusyTaskIds((current) => new Set(current).add(task.id));
    try {
      const updated = await apiRequest(API + "/tasks/" + task.id, { method: "PATCH", body: { status: nextStatus } });
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
      notify("Moved to " + (STATUSES.find((status) => status.value === nextStatus)?.label || "new status") + ".");
    } catch (error) { if (error.status === 401) setUser(null); notify(error.message || "Couldn't update that task.", "error"); }
    finally { setBusyTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; }); }
  }

  async function handleDelete(task) {
    if (!window.confirm("Delete “" + task.title + "”? This can't be undone.")) return;
    setBusyTaskIds((current) => new Set(current).add(task.id));
    try {
      await apiRequest(API + "/tasks/" + task.id, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id)); notify("Task deleted.");
    } catch (error) { if (error.status === 401) setUser(null); notify(error.message || "Couldn't delete that task.", "error"); }
    finally { setBusyTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; }); }
  }

  function navigateTo(page) {
    setActivePage(page); setIsMobileNavOpen(false); setIsAccountMenuOpen(false);
    if (page === "tasks") window.setTimeout(() => document.getElementById("task-board")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    if (page === "overview") window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
    if (page === "account") { setProfileName(user?.name || ""); setProfileAvatarUrl(user?.avatarUrl || ""); setProfileError(""); setIsProfileOpen(true); }
  }
  function closeCreateModal() { if (isSaving) return; setIsCreateOpen(false); setTitle(""); setDescription(""); }
  function closeProfileModal() { if (isProfileSaving) return; setIsProfileOpen(false); setActivePage("overview"); }

  if (authChecking) return <div className="boot-screen"><div className="boot-logo"><Icon name="spark" size={26} /></div><div className="boot-spinner" /><p>Getting your workspace ready…</p></div>;

  if (!user) return (
    <div className="auth-shell">
      <div className="auth-orb auth-orb-a" /><div className="auth-orb auth-orb-b" /><div className="auth-grid" />
      <aside className="auth-showcase">
        <a className="auth-brand" href="/" aria-label="TaskFlow home"><span className="brand-mark"><Icon name="spark" size={23} /></span><span>taskflow<span className="brand-period">.</span></span></a>
        <div className="showcase-content"><div className="showcase-kicker"><span className="live-dot" />YOUR SPACE TO GET THINGS DONE</div><h1>Turn your<br />plans into <span>progress.</span></h1><p>A calmer, clearer way to manage your work. Keep your priorities close and your momentum going.</p>
          <div className="showcase-checklist"><div><span className="showcase-check"><Icon name="check" size={15} /></span><span><strong>Find your focus</strong><small>Bring your tasks into one clear view.</small></span></div><div><span className="showcase-check"><Icon name="check" size={15} /></span><span><strong>Build momentum</strong><small>Make progress visible, one task at a time.</small></span></div><div><span className="showcase-check"><Icon name="check" size={15} /></span><span><strong>Own your workspace</strong><small>Your account, your tasks, your way.</small></span></div></div>
        </div><div className="showcase-footer"><span>DESIGNED FOR CLARITY</span><span>BUILT FOR MOMENTUM</span></div>
        <div className="showcase-glow-card"><div className="glow-card-head"><span>YOUR PROGRESS</span><b><Icon name="trend" size={13} />ON TRACK</b></div><div className="glow-card-title">Small steps<span>.</span></div><div className="glow-card-bars">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ height: (28 + ((i * 19) % 70)) + "%" }} />)}</div><p>Consistency beats intensity. Keep moving.</p></div>
      </aside>
      <main className="auth-main"><div className="auth-topline"><span>{authMode === "login" ? "New to TaskFlow?" : "Already have a workspace?"}</span><button className="auth-top-link" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>{authMode === "login" ? "Create account" : "Sign in"} <Icon name="arrow" size={14} /></button></div>
        <section className="auth-card"><div className="auth-card-icon"><Icon name={authMode === "login" ? "lock" : "spark"} size={22} /></div><div className="auth-card-eyebrow">{authMode === "login" ? "YOUR WORKSPACE AWAITS" : "A FRESH START"}</div><h2>{authMode === "login" ? "Welcome back." : "Create your space."}</h2><p className="auth-card-description">{authMode === "login" ? "Sign in and pick up where you left off." : "Create an account and make your work feel lighter."}</p>
          <div className="auth-tabs" role="tablist" aria-label="Account access"><button role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Sign in</button><button role="tab" aria-selected={authMode === "register"} className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setAuthError(""); }}>Create account</button></div>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" && <label className="auth-field"><span>Your name</span><div className="auth-input"><Icon name="user" size={17} /><input type="text" autoComplete="name" maxLength={80} placeholder="What should we call you?" value={authName} onChange={(e) => setAuthName(e.target.value)} required /></div></label>}
            <label className="auth-field"><span>Email address</span><div className="auth-input"><Icon name="mail" size={17} /><input type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required /></div></label>
            <label className="auth-field"><span>Password {authMode === "register" && <small>8+ CHARACTERS</small>}</span><div className="auth-input"><Icon name="lock" size={17} /><input type={showPassword ? "text" : "password"} autoComplete={authMode === "register" ? "new-password" : "current-password"} minLength={authMode === "register" ? 8 : 1} maxLength={72} placeholder={authMode === "register" ? "Create a strong password" : "Enter your password"} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}><Icon name={showPassword ? "eyeOff" : "eye"} size={17} /></button></div></label>
            {authError && <div className="form-error" role="alert"><Icon name="x" size={15} /><span>{authError}</span></div>}
            <button className="auth-submit" type="submit" disabled={authLoading}>{authLoading ? <><span className="spinner" />{authMode === "login" ? "Signing in…" : "Creating account…"}</> : <>{authMode === "login" ? "Sign in to TaskFlow" : "Create my account"}<Icon name="arrow" size={17} /></>}</button>
          </form><div className="auth-security"><Icon name="shield" size={15} /><span>Your tasks stay private to your account.</span></div><div className="auth-switch">{authMode === "login" ? "New to TaskFlow?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>{authMode === "login" ? "Create an account" : "Sign in instead"}</button></div>
        </section><footer className="auth-copyright">© {new Date().getFullYear()} TaskFlow <span>·</span> Make room for meaningful work.</footer>
      </main>
    </div>
  );

  const completion = stats.completion;
  const firstName = (user.name || "there").trim().split(/\s+/)[0];
  const greeting = new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening";

  return (
    <div className="app-shell">
      {isMobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setIsMobileNavOpen(false)} />}
      {isAccountMenuOpen && <button className="menu-backdrop" aria-label="Close account menu" onClick={() => setIsAccountMenuOpen(false)} />}
      <aside className={"sidebar" + (isMobileNavOpen ? " sidebar-open" : "")}>
        <div className="brand"><span className="brand-mark"><Icon name="spark" size={22} /></span><span className="brand-copy"><strong>taskflow<span>.</span></strong><small>YOUR WORKSPACE</small></span><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setIsMobileNavOpen(false)}><Icon name="x" /></button></div>
        <div className="workspace-switcher"><span className="workspace-avatar">TF</span><span className="workspace-copy"><strong>Personal workspace</strong><small>Signed in as {firstName}</small></span><span className="presence" title="Connected"><span className="live-dot" /></span></div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation"><button className={"nav-link" + (activePage === "overview" ? " active" : "")} onClick={() => navigateTo("overview")}><Icon name="grid" /><span>Overview</span>{activePage === "overview" && <span className="nav-indicator" />}</button><button className={"nav-link" + (activePage === "tasks" ? " active" : "")} onClick={() => navigateTo("tasks")}><Icon name="list" /><span>My tasks</span><span className="nav-count">{tasks.length}</span></button><button className={"nav-link" + (activePage === "teams" ? " active" : "")} onClick={() => navigateTo("teams")}><Icon name="user" /><span>Teams</span></button><button className={"nav-link" + (activePage === "account" ? " active" : "")} onClick={() => navigateTo("account")}><Icon name="user" /><span>Account</span></button></nav>
        <div className="nav-section-label nav-space">YOUR FOCUS</div><div className="focus-card"><span className="focus-icon"><Icon name="spark" size={17} /></span><strong>One thing at a time.</strong><p>Progress comes from the little things you finish today.</p><div className="focus-progress"><span style={{ width: completion + "%" }} /></div><small>{completion}% of tasks completed</small></div>
        <div className="sidebar-bottom"><button className="online-status" onClick={loadTasks} title="Refresh tasks and check connection"><span className="online-dot" /><span>{isLoading ? "Refreshing workspace…" : "Workspace connected"}</span><Icon name="refresh" size={14} className={isLoading ? "spin-icon" : ""} /></button><div className="profile-row"><div className="profile-avatar">{firstName.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></div><button className="icon-button profile-action" aria-label="Open profile settings" onClick={() => navigateTo("account")}><Icon name="chevron" size={17} /></button></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setIsMobileNavOpen(true)}><Icon name="menu" size={21} /></button><div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activePage === "tasks" ? "My tasks" : activePage === "teams" ? "Teams" : activePage === "account" ? "Account" : "Overview"}</strong></div><div className="topbar-right"><span className="date-chip"><Icon name="calendar" size={15} />{todayLabel()}</span><button className="theme-toggle" title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></button><div className="account-anchor"><button className="avatar-button" aria-label="Open account menu" aria-expanded={isAccountMenuOpen} onClick={() => setIsAccountMenuOpen((current) => !current)}>{firstName.slice(0,1).toUpperCase()}</button>{isAccountMenuOpen && <div className="account-popover"><div className="account-popover-profile"><span className="profile-avatar large">{firstName.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div><button onClick={() => navigateTo("account")}><Icon name="user" size={16} />Profile settings</button><button className="logout-item" onClick={handleLogout}><Icon name="logout" size={16} />Sign out</button></div>}</div></div></header>

        <div className="page-content" id="overview">
          {activePage === "teams" ? <TeamsWorkspace notify={notify} /> : <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />A CLEARER WAY TO WORK</div><h1>Good {greeting.toLowerCase()}, {firstName}<span className="heading-period">.</span></h1><p className="page-subtitle">A little structure goes a long way. Here's where things stand today.</p></div><button className="primary-button new-task-button" onClick={() => setIsCreateOpen(true)}><Icon name="plus" size={18} />New task</button></section>
          <section className="metrics-grid" aria-label="Task summary">
            <article className="metric-card metric-purple"><div className="metric-top"><span className="metric-icon"><Icon name="grid" /></span><span className="metric-kicker">ALL TIME</span></div><div className="metric-value">{isLoading ? "—" : stats.total}</div><div className="metric-footer"><strong>Total tasks</strong><span>Across your workspace</span></div><span className="metric-decoration decoration-purple" /></article>
            <article className="metric-card metric-orange"><div className="metric-top"><span className="metric-icon"><Icon name="clock" /></span><span className="metric-kicker">IN MOTION</span></div><div className="metric-value">{isLoading ? "—" : stats.inProgress}</div><div className="metric-footer"><strong>In progress</strong><span>Work happening now</span></div><span className="metric-decoration decoration-orange" /></article>
            <article className="metric-card metric-green"><div className="metric-top"><span className="metric-icon"><Icon name="checkCircle" /></span><span className="metric-kicker">ACCOMPLISHED</span></div><div className="metric-value">{isLoading ? "—" : stats.completed}</div><div className="metric-footer"><strong>Completed</strong><span>Things you got done</span></div><span className="metric-decoration decoration-green" /></article>
            <article className="metric-card metric-blue"><div className="metric-top"><span className="metric-icon"><Icon name="trend" /></span><span className="metric-kicker">YOUR MOMENTUM</span></div><div className="metric-value">{isLoading ? "—" : completion}<span className="metric-percent">%</span></div><div className="metric-footer"><strong>Completion rate</strong><span>{stats.todo} {stats.todo === 1 ? "task" : "tasks"} still to do</span></div><span className="metric-decoration decoration-blue" /></article>
          </section>
          <section className="focus-banner"><div className="banner-copy"><div className="banner-label"><Icon name="spark" size={15} />YOUR DAILY MOMENTUM</div><h2>Small steps. <span>Real progress.</span></h2><p>Every task you finish makes room for what matters next.</p></div><div className="banner-progress-wrap"><div className="banner-progress-heading"><span>Completion progress</span><strong>{completion}%</strong></div><div className="banner-progress-track"><span style={{ width: completion + "%" }} /></div><div className="banner-progress-foot"><span>{stats.completed} completed</span><span>{stats.total} total tasks</span></div></div><div className="banner-orb banner-orb-one" /><div className="banner-orb banner-orb-two" /></section>

          <section className="board-section" id="task-board">
            <div className="board-heading"><div><div className="eyebrow">KEEP IT MOVING</div><h2>Your task board <span className="board-total">{filteredTasks.length}</span></h2><p>Capture it, work on it, then celebrate getting it done.</p></div><div className="board-actions"><button className="secondary-button" onClick={loadTasks} disabled={isLoading}><Icon name="refresh" className={isLoading ? "spin-icon" : ""} size={16} />Refresh</button><button className="secondary-button" onClick={() => setIsCreateOpen(true)}><Icon name="plus" size={17} />Add task</button></div></div>
            <div className="board-toolbar"><div className="filter-tabs" role="group" aria-label="Filter tasks"><button className={filter === "all" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("all")}>All tasks <span>{tasks.length}</span></button><button className={filter === "active" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("active")}>Active</button><button className={filter === "completed" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("completed")}>Completed</button></div><label className="search-box"><Icon name="search" size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />{search && <button className="search-clear" aria-label="Clear search" onClick={() => setSearch("")}><Icon name="x" size={15} /></button>}</label></div>
            {loadError && <div className="error-panel" role="alert"><span className="error-icon"><Icon name="refresh" /></span><div><strong>Tasks are temporarily unavailable</strong><p>{loadError}</p></div><button className="secondary-button" onClick={loadTasks}><Icon name="refresh" size={15} />Try again</button></div>}
            {!loadError && <div className="kanban-grid" aria-busy={isLoading}>{board.map((column) => <section className={"kanban-column column-" + column.tone} key={column.value} aria-label={column.label + " tasks"}>
              <div className="column-heading"><div className="column-title-group"><span className={"column-status-dot " + column.tone}><Icon name={column.icon} size={14} /></span><h3>{column.label}</h3><span className="column-count">{column.tasks.length}</span></div></div>
              <div className="task-stack">{isLoading ? <><div className="task-skeleton" /><div className="task-skeleton skeleton-short" /></> : column.tasks.length === 0 ? <div className="column-empty"><span className="column-empty-icon"><Icon name={column.icon} size={20} /></span><p>{search || filter !== "all" ? "No matching tasks" : column.value === "TODO" ? "A fresh start." : column.value === "IN_PROGRESS" ? "Nothing in motion yet." : "Your wins will show up here."}</p>{column.value === "TODO" && !search && filter === "all" && <button onClick={() => setIsCreateOpen(true)}>Add your first task <Icon name="arrow" size={14} /></button>}</div> : column.tasks.map((task) => <article className={"task-card task-card-" + column.tone} key={task.id}>
                <div className="task-card-top"><span className="task-id">TASK-{String(task.id || "").padStart(3, "0")}</span><button className="icon-button delete-task-button" title="Delete task" aria-label={"Delete " + task.title} disabled={busyTaskIds.has(task.id)} onClick={() => handleDelete(task)}><Icon name="trash" size={16} /></button></div><h4>{task.title || "Untitled task"}</h4><p className={"task-description" + (!task.description ? " no-description" : "")}>{task.description || "No description added."}</p>
                <div className="task-card-bottom"><span className={"task-status-label " + column.tone}><span className="status-indicator" />{column.label}</span><label className="status-select-wrap"><span className="visually-hidden">Change status for {task.title}</span><select aria-label={"Change status for " + task.title} value={normalizeStatus(task.status)} disabled={busyTaskIds.has(task.id)} onChange={(event) => handleStatusChange(task, event.target.value)}>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Icon name="chevron" size={13} /></label></div>{busyTaskIds.has(task.id) && <div className="task-busy-bar" />}
              </article>)}</div>
              {column.value === "TODO" && !isLoading && <button className="add-card-button" onClick={() => setIsCreateOpen(true)}><Icon name="plus" size={16} />Add a task</button>}
            </section>)}</div>}
          </section>
          <footer className="page-footer"><span><span className="footer-mark"><Icon name="spark" size={13} /></span>TaskFlow <span className="footer-dot">·</span> A little progress goes a long way.</span><span className="footer-live"><span className="online-dot" />Private workspace · Signed in</span></footer>
          </>}
        </div>
      </main>

      {isCreateOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateModal(); }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-modal-title"><div className="modal-heading"><span className="modal-icon"><Icon name="spark" size={21} /></span><button className="icon-button modal-close" aria-label="Close form" disabled={isSaving} onClick={closeCreateModal}><Icon name="x" /></button><div className="eyebrow">MAKE IT HAPPEN</div><h2 id="create-modal-title">Create a new task</h2><p>Get it out of your head and onto your board.</p></div><form onSubmit={handleCreate} className="create-form"><label className="form-field"><span>Task title <em>*</em></span><input autoFocus type="text" maxLength={120} placeholder="e.g. Prepare the review presentation" value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label className="form-field"><span>Description <small>OPTIONAL</small></span><textarea rows={4} maxLength={1000} placeholder="Add a little context so future-you knows where to start…" value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="form-note"><span className="task-status-label todo"><span className="status-indicator" />To do</span><span>You'll be able to update the status later.</span></div><div className="modal-actions"><button type="button" className="secondary-button" disabled={isSaving} onClick={closeCreateModal}>Cancel</button><button type="submit" className="primary-button" disabled={isSaving || !title.trim()}>{isSaving ? <><span className="spinner" />Saving…</> : <><Icon name="plus" size={17} />Create task</>}</button></div></form></section></div>}

      {isProfileOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProfileModal(); }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title"><div className="modal-heading"><span className="modal-icon"><Icon name="user" size={21} /></span><button className="icon-button modal-close" aria-label="Close profile" onClick={closeProfileModal}><Icon name="x" /></button><div className="eyebrow">YOUR ACCOUNT</div><h2 id="profile-modal-title">Profile settings</h2><p>Keep your workspace details up to date.</p></div><form onSubmit={handleProfileSave} className="create-form"><label className="form-field"><span>Display name</span><input type="text" maxLength={80} value={profileName} onChange={(event) => setProfileName(event.target.value)} required /></label><label className="form-field"><span>Profile image URL <small>OPTIONAL</small></span><input type="url" maxLength={500} placeholder="https://example.com/photo.jpg" value={profileAvatarUrl} onChange={(event) => setProfileAvatarUrl(event.target.value)} /><small className="avatar-help">Paste a publicly accessible image URL. Leave blank to use your colored initials avatar.</small></label><label className="form-field"><span>Email address</span><input type="email" value={user.email} readOnly /></label>{profileError && <div className="form-error" role="alert"><Icon name="x" size={15} /><span>{profileError}</span></div>}<div className="form-note"><Icon name="shield" size={16} /><span>Your tasks are only visible to your account.</span></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={closeProfileModal}>Cancel</button><button type="submit" className="primary-button" disabled={isProfileSaving || !profileName.trim()}>{isProfileSaving ? <><span className="spinner" />Saving…</> : <><Icon name="check" size={17} />Save changes</>}</button></div></form></section></div>}

      {toast && <div className={"toast toast-" + toast.type} role="status"><span className="toast-icon"><Icon name={toast.type === "error" ? "x" : "check"} size={17} /></span><span>{toast.message}</span><button aria-label="Dismiss message" onClick={() => setToast(null)}><Icon name="x" size={15} /></button></div>}
    </div>
  );
}
export default App;
