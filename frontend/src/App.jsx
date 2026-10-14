import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_URL = "/api/tasks";

const STATUSES = [
  { value: "TODO", label: "To do", shortLabel: "To do", icon: "circle", tone: "todo" },
  { value: "IN_PROGRESS", label: "In progress", shortLabel: "In progress", icon: "clock", tone: "progress" },
  { value: "DONE", label: "Done", shortLabel: "Done", icon: "checkCircle", tone: "done" },
];

const iconNodes = {
  sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  arrowUpRight: <><path d="M7 17 17 7M8 7h9v9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  circle: <circle cx="12" cy="12" r="9" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 17.5 6L20 12M4 12l2.5 6A7 7 0 0 0 18.4 15" /></>,
  inbox: <><path d="M4 4h16l1 11-4 5H7l-4-5 1-11Z" /><path d="M3.5 14h5l1.5 3h4l1.5-3h5" /></>,
  filter: <><path d="M4 5h16l-6.5 7.5V19l-3 1v-7.5L4 5Z" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
  trend: <><path d="m3 16 6-6 4 4 8-9" /><path d="M15 5h6v6" /></>,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
};

function Icon({ name, size = 18, strokeWidth = 1.8, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconNodes[name] || iconNodes.sparkle}
    </svg>
  );
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const message = detail && detail.length < 180 ? detail : "The request could not be completed.";
    throw new Error(message || "The request could not be completed.");
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeStatus(status) {
  const value = String(status || "TODO").toUpperCase();
  return STATUSES.some((item) => item.value === value) ? value : "TODO";
}

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyTaskIds, setBusyTaskIds] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
      const data = await apiRequest(API_URL);
      const loadedTasks = Array.isArray(data) ? data : [];
      loadedTasks.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      setTasks(loadedTasks);
    } catch (error) {
      setLoadError("We couldn't connect to your tasks. Check that the TaskFlow API is available, then try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [loadTasks]);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => normalizeStatus(task.status) === "DONE").length;
    const inProgress = tasks.filter((task) => normalizeStatus(task.status) === "IN_PROGRESS").length;
    const todo = tasks.filter((task) => normalizeStatus(task.status) === "TODO").length;
    return {
      total: tasks.length,
      completed,
      inProgress,
      todo,
      completion: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const status = normalizeStatus(task.status);
      const matchesView = view === "all" || (view === "active" && status !== "DONE") || (view === "completed" && status === "DONE");
      const matchesSearch = !query || [task.title, task.description, String(task.id || "")].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesView && matchesSearch;
    });
  }, [tasks, search, view]);

  const board = useMemo(() => STATUSES.map((status) => ({
    ...status,
    tasks: filteredTasks.filter((task) => normalizeStatus(task.status) === status.value),
  })), [filteredTasks]);

  async function handleCreate(event) {
    event.preventDefault();
    const cleanedTitle = title.trim();
    const cleanedDescription = description.trim();
    if (!cleanedTitle) return;

    setIsSaving(true);
    try {
      const savedTask = await apiRequest(API_URL, {
        method: "POST",
        body: { title: cleanedTitle, description: cleanedDescription, status: "TODO" },
      });
      setTasks((current) => [savedTask, ...current]);
      setTitle("");
      setDescription("");
      setIsCreateOpen(false);
      setView("all");
      setSearch("");
      notify("Task created. You're off to a good start.");
    } catch (error) {
      notify("Couldn't save that task. Check the connection and try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(task, nextStatus) {
    const currentStatus = normalizeStatus(task.status);
    if (currentStatus === nextStatus || busyTaskIds.has(task.id)) return;

    setBusyTaskIds((current) => new Set(current).add(task.id));
    try {
      const updatedTask = await apiRequest(API_URL + "/" + task.id, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      setTasks((current) => current.map((item) => item.id === task.id ? updatedTask : item));
      const label = STATUSES.find((item) => item.value === nextStatus)?.label || "Updated";
      notify("Moved to " + label.toLowerCase() + ".");
    } catch (error) {
      notify("Couldn't update the task. Please try again.", "error");
    } finally {
      setBusyTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function handleDelete(task) {
    if (!window.confirm("Delete “" + task.title + "”? This can't be undone.")) return;
    setBusyTaskIds((current) => new Set(current).add(task.id));
    try {
      await apiRequest(API_URL + "/" + task.id, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id));
      notify("Task deleted.");
    } catch (error) {
      notify("Couldn't delete the task. Please try again.", "error");
    } finally {
      setBusyTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  function closeCreateModal() {
    if (isSaving) return;
    setIsCreateOpen(false);
    setTitle("");
    setDescription("");
  }

  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="app-shell">
      {isMobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setIsMobileNavOpen(false)} />}
      <aside className={"sidebar" + (isMobileNavOpen ? " sidebar-open" : "")}>
        <a className="brand" href="#overview" onClick={() => setIsMobileNavOpen(false)}>
          <span className="brand-mark"><Icon name="sparkle" size={22} strokeWidth={2} /></span>
          <span className="brand-copy"><strong>taskflow<span>.</span></strong><small>WORKSPACE</small></span>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={(event) => { event.preventDefault(); setIsMobileNavOpen(false); }}><Icon name="x" /></button>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">TF</span>
          <span className="workspace-copy"><strong>Team workspace</strong><small>Personal plan</small></span>
          <Icon name="chevron" size={16} />
        </div>

        <div className="nav-section-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#overview" onClick={() => setIsMobileNavOpen(false)}><Icon name="grid" /><span>Overview</span><span className="nav-indicator" /></a>
          <a className="nav-link" href="#task-board" onClick={() => setIsMobileNavOpen(false)}><Icon name="list" /><span>My tasks</span><span className="nav-count">{tasks.length}</span></a>
        </nav>

        <div className="nav-section-label nav-section-spaced">YOUR FOCUS</div>
        <div className="focus-card">
          <span className="focus-icon"><Icon name="sparkle" size={17} /></span>
          <strong>One thing at a time.</strong>
          <p>Progress comes from the little things you finish today.</p>
          <div className="focus-progress"><span style={{ width: stats.completion + "%" }} /></div>
          <small>{stats.completion}% of tasks completed</small>
        </div>

        <div className="sidebar-bottom">
          <div className="online-status"><span className="online-dot" /><span>Workspace connected</span></div>
          <div className="profile-row">
            <div className="profile-avatar">S</div>
            <div className="profile-copy"><strong>Workspace member</strong><small>TaskFlow user</small></div>
            <Icon name="dots" size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setIsMobileNavOpen(true)}><Icon name="menu" size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Overview</strong></div>
          <div className="topbar-right">
            <span className="date-chip"><Icon name="calendar" size={15} />{formatDate()}</span>
            <button className="avatar-button" title="TaskFlow workspace member">S</button>
          </div>
        </header>

        <div className="page-content" id="overview">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />A CLEARER WAY TO WORK</div>
              <h1>{greeting}, let's make it count<span className="heading-period">.</span></h1>
              <p className="page-subtitle">A little structure goes a long way. Here's where things stand today.</p>
            </div>
            <button className="primary-button new-task-button" onClick={() => setIsCreateOpen(true)}><Icon name="plus" size={18} />New task</button>
          </section>

          <section className="metrics-grid" aria-label="Task summary">
            <article className="metric-card metric-purple">
              <div className="metric-top"><span className="metric-icon"><Icon name="grid" size={19} /></span><span className="metric-kicker">ALL TIME</span></div>
              <div className="metric-value">{isLoading ? "—" : stats.total}</div>
              <div className="metric-footer"><strong>Total tasks</strong><span>Across your workspace</span></div>
              <span className="metric-decoration metric-decoration-purple" />
            </article>
            <article className="metric-card metric-orange">
              <div className="metric-top"><span className="metric-icon"><Icon name="clock" size={19} /></span><span className="metric-kicker">IN MOTION</span></div>
              <div className="metric-value">{isLoading ? "—" : stats.inProgress}</div>
              <div className="metric-footer"><strong>In progress</strong><span>Work happening now</span></div>
              <span className="metric-decoration metric-decoration-orange" />
            </article>
            <article className="metric-card metric-green">
              <div className="metric-top"><span className="metric-icon"><Icon name="checkCircle" size={19} /></span><span className="metric-kicker">ACCOMPLISHED</span></div>
              <div className="metric-value">{isLoading ? "—" : stats.completed}</div>
              <div className="metric-footer"><strong>Completed</strong><span>Things you got done</span></div>
              <span className="metric-decoration metric-decoration-green" />
            </article>
            <article className="metric-card metric-blue">
              <div className="metric-top"><span className="metric-icon"><Icon name="trend" size={19} /></span><span className="metric-kicker">YOUR MOMENTUM</span></div>
              <div className="metric-value">{isLoading ? "—" : stats.completion}<span className="metric-percent">%</span></div>
              <div className="metric-footer"><strong>Completion rate</strong><span>{stats.todo} {stats.todo === 1 ? "task" : "tasks"} still to do</span></div>
              <span className="metric-decoration metric-decoration-blue" />
            </article>
          </section>

          <section className="focus-banner">
            <div className="banner-copy">
              <div className="banner-label"><Icon name="sparkle" size={15} />YOUR DAILY MOMENTUM</div>
              <h2>Small steps. <span>Real progress.</span></h2>
              <p>Every task you finish makes room for what matters next.</p>
            </div>
            <div className="banner-progress-wrap">
              <div className="banner-progress-heading"><span>Completion progress</span><strong>{stats.completion}%</strong></div>
              <div className="banner-progress-track"><span style={{ width: stats.completion + "%" }} /></div>
              <div className="banner-progress-foot"><span>{stats.completed} completed</span><span>{stats.total} total tasks</span></div>
            </div>
            <div className="banner-orb banner-orb-one" />
            <div className="banner-orb banner-orb-two" />
          </section>

          <section className="board-section" id="task-board">
            <div className="board-heading">
              <div>
                <div className="eyebrow board-eyebrow">KEEP IT MOVING</div>
                <h2>Your task board <span className="board-total">{filteredTasks.length}</span></h2>
                <p>Capture it, work on it, then celebrate getting it done.</p>
              </div>
              <button className="secondary-button board-new-task" onClick={() => setIsCreateOpen(true)}><Icon name="plus" size={17} />Add task</button>
            </div>

            <div className="board-toolbar">
              <div className="filter-tabs" role="group" aria-label="Filter tasks">
                <button className={view === "all" ? "filter-tab selected" : "filter-tab"} onClick={() => setView("all")}>All tasks <span>{tasks.length}</span></button>
                <button className={view === "active" ? "filter-tab selected" : "filter-tab"} onClick={() => setView("active")}>Active</button>
                <button className={view === "completed" ? "filter-tab selected" : "filter-tab"} onClick={() => setView("completed")}>Completed</button>
              </div>
              <label className="search-box">
                <Icon name="search" size={17} />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" />
                {search && <button className="search-clear" aria-label="Clear search" onClick={() => setSearch("")}><Icon name="x" size={15} /></button>}
              </label>
            </div>

            {loadError && (
              <div className="error-panel" role="alert">
                <span className="error-icon"><Icon name="refresh" size={19} /></span>
                <div><strong>Tasks are temporarily unavailable</strong><p>{loadError}</p></div>
                <button className="secondary-button retry-button" onClick={loadTasks}><Icon name="refresh" size={15} />Try again</button>
              </div>
            )}

            {!loadError && (
              <div className="kanban-grid" aria-busy={isLoading}>
                {board.map((column) => (
                  <section className={"kanban-column column-" + column.tone} key={column.value} aria-label={column.label + " tasks"}>
                    <div className="column-heading">
                      <div className="column-title-group">
                        <span className={"column-status-dot " + column.tone}><Icon name={column.icon} size={14} strokeWidth={2} /></span>
                        <h3>{column.label}</h3>
                        <span className="column-count">{column.tasks.length}</span>
                      </div>
                      <button className="icon-button column-menu" title={"Options for " + column.label} aria-label={"Options for " + column.label}><Icon name="dots" size={18} /></button>
                    </div>
                    <div className="task-stack">
                      {isLoading ? (
                        <><div className="task-skeleton" /><div className="task-skeleton skeleton-short" /></>
                      ) : column.tasks.length === 0 ? (
                        <div className="column-empty">
                          <span className="column-empty-icon"><Icon name={column.icon} size={20} /></span>
                          <p>{search || view !== "all" ? "No matching tasks" : column.value === "TODO" ? "A fresh start." : column.value === "IN_PROGRESS" ? "Nothing in motion yet." : "Your wins will show up here."}</p>
                          {column.value === "TODO" && !search && view === "all" && <button onClick={() => setIsCreateOpen(true)}>Add your first task <Icon name="arrowUpRight" size={14} /></button>}
                        </div>
                      ) : column.tasks.map((task) => {
                        const status = normalizeStatus(task.status);
                        const busy = busyTaskIds.has(task.id);
                        return (
                          <article className={"task-card task-card-" + column.tone} key={task.id}>
                            <div className="task-card-top">
                              <span className="task-id">TASK-{String(task.id || "").padStart(3, "0")}</span>
                              <button className="icon-button delete-task-button" title="Delete task" aria-label={"Delete " + task.title} disabled={busy} onClick={() => handleDelete(task)}><Icon name="trash" size={16} /></button>
                            </div>
                            <h4>{task.title || "Untitled task"}</h4>
                            <p className={"task-description" + (!task.description ? " no-description" : "")}>{task.description || "No description added."}</p>
                            <div className="task-card-bottom">
                              <span className={"task-status-label " + column.tone}><span className="status-indicator" />{column.shortLabel}</span>
                              <label className="status-select-wrap">
                                <span className="visually-hidden">Change status for {task.title}</span>
                                <select aria-label={"Change status for " + task.title} value={status} disabled={busy} onChange={(event) => handleStatusChange(task, event.target.value)}>
                                  {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                </select>
                                <Icon name="chevron" size={13} />
                              </label>
                            </div>
                            {busy && <div className="task-busy-bar" />}
                          </article>
                        );
                      })}
                    </div>
                    {column.value === "TODO" && !isLoading && (
                      <button className="add-card-button" onClick={() => setIsCreateOpen(true)}><Icon name="plus" size={16} />Add a task</button>
                    )}
                  </section>
                ))}
              </div>
            )}
          </section>

          <footer className="page-footer">
            <span><span className="footer-mark"><Icon name="sparkle" size={13} /></span>TaskFlow <span className="footer-dot">·</span> A little progress goes a long way.</span>
            <span className="footer-live"><span className="online-dot" />Synced to your workspace</span>
          </footer>
        </div>
      </main>

      {isCreateOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateModal(); }}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
            <div className="modal-heading">
              <span className="modal-icon"><Icon name="sparkle" size={21} /></span>
              <button className="icon-button modal-close" aria-label="Close form" disabled={isSaving} onClick={closeCreateModal}><Icon name="x" /></button>
              <div className="eyebrow">MAKE IT HAPPEN</div>
              <h2 id="create-modal-title">Create a new task</h2>
              <p>Get it out of your head and onto your board.</p>
            </div>
            <form onSubmit={handleCreate} className="create-form">
              <label className="form-field"><span>Task title <em>*</em></span><input autoFocus type="text" maxLength={120} placeholder="e.g. Prepare the review presentation" value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
              <label className="form-field"><span>Description <small>OPTIONAL</small></span><textarea rows={4} maxLength={1000} placeholder="Add a little context so future-you knows where to start..." value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              <div className="form-note"><span className="task-status-label todo"><span className="status-indicator" />To do</span><span>You'll be able to update the status later.</span></div>
              <div className="modal-actions"><button type="button" className="secondary-button" disabled={isSaving} onClick={closeCreateModal}>Cancel</button><button type="submit" className="primary-button" disabled={isSaving || !title.trim()}>{isSaving ? <><span className="spinner" />Saving...</> : <><Icon name="plus" size={17} />Create task</>}</button></div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className={"toast toast-" + toast.type} role="status"><span className="toast-icon"><Icon name={toast.type === "error" ? "x" : "check"} size={17} /></span><span>{toast.message}</span><button aria-label="Dismiss message" onClick={() => setToast(null)}><Icon name="x" size={15} /></button></div>}
    </div>
  );
}

export default App;
