import { useCallback, useEffect, useMemo, useState } from "react";

const API = "/api";
const TASK_STATUSES = [
  { value: "TODO", label: "To do", tone: "todo" },
  { value: "IN_PROGRESS", label: "In progress", tone: "progress" },
  { value: "DONE", label: "Done", tone: "done" },
];
const PROJECT_STATUSES = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};
const dateInput = (value) => value ? String(value).slice(0, 10) : "";
const dateValue = (value) => value ? new Date(value + "T00:00:00") : null;
const dateLabel = (value, options = { month: "short", day: "numeric" }) => {
  if (!value) return "Not scheduled";
  const parsed = dateValue(dateInput(value));
  return !parsed || Number.isNaN(parsed.getTime()) ? "Not set" : new Intl.DateTimeFormat("en", options).format(parsed);
};
const statusLabel = (value) => TASK_STATUSES.find((item) => item.value === String(value || "").toUpperCase())?.label || "To do";
const taskProgress = (task) => {
  const status = String(task.status || "TODO").toUpperCase();
  if (status === "DONE") return 100;
  const stored = Number(task.progress);
  if (status === "IN_PROGRESS" && (!Number.isFinite(stored) || stored <= 0)) return 50;
  return Math.max(0, Math.min(100, Number.isFinite(stored) ? stored : 0));
};
const dayMs = 86400000;
const localDateKey = (value) => value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
const todayKey = () => localDateKey(new Date());

async function csrfToken() {
  const response = await fetch(API + "/auth/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Couldn't start a secure request. Refresh and try again.");
  const payload = await response.json();
  if (!payload.token) throw new Error("Security token missing. Refresh and try again.");
  return payload.token;
}
async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) headers["X-XSRF-TOKEN"] = await csrfToken();
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  let payload = null;
  if (type.includes("json")) payload = await response.json().catch(() => null);
  else {
    const text = await response.text().catch(() => "");
    payload = text ? { detail: text } : null;
  }
  if (!response.ok) {
    const error = new Error((payload && (payload.detail || payload.message || payload.error)) || "Request failed. Please try again.");
    error.status = response.status;
    throw error;
  }
  return payload;
}
function MemberStack({ members = [], limit = 4 }) {
  if (!members.length) return <span className="dash-no-members">No members</span>;
  return <span className="dash-member-stack" aria-label={members.length + " team members"}>
    {members.slice(0, limit).map((member, index) => (
      <span key={member.user?.id || index} className="dash-avatar" title={member.user?.name || "Team member"} style={{ "--avatar-tone": member.user?.avatarColor || "var(--purple)", zIndex: limit - index }}>
        {member.user?.avatarUrl ? <img src={member.user.avatarUrl} alt="" /> : (member.user?.name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
      </span>
    ))}
    {members.length > limit && <span className="dash-avatar dash-avatar-more">+{members.length - limit}</span>}
  </span>;
}
function ProjectDashboard({ notify = () => {}, onOpenProjects = () => {} }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [teamFilter, setTeamFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedProjects, setExpandedProjects] = useState(() => new Set());
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const blankTaskForm = () => ({ title: "", description: "", teamId: "", projectId: "", startDate: "", dueDate: "", assigneeId: "" });
  const [form, setForm] = useState(blankTaskForm);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const teamResult = await request(API + "/teams");
      const teams = Array.isArray(teamResult) ? teamResult : [];
      const loaded = await Promise.all(teams.map(async (team) => {
        const [projectResult, taskResult, memberResult] = await Promise.all([
          request(API + "/teams/" + team.id + "/projects"),
          request(API + "/teams/" + team.id + "/tasks"),
          request(API + "/teams/" + team.id + "/members"),
        ]);
        const members = Array.isArray(memberResult) ? memberResult : [];
        const tasks = (Array.isArray(taskResult) ? taskResult : []).map((task) => ({ ...task, _teamId: team.id, _teamName: team.name, _members: members }));
        return { team, projects: Array.isArray(projectResult) ? projectResult : [], tasks, members };
      }));
      setWorkspaces(loaded);
      setTeamFilter((current) => current === "all" || loaded.some((item) => String(item.team.id) === String(current)) ? current : "all");
    } catch (e) {
      setError(e.message || "Couldn't load the project dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const visibleWorkspaces = useMemo(() => teamFilter === "all" ? workspaces : workspaces.filter((workspace) => String(workspace.team.id) === String(teamFilter)), [workspaces, teamFilter]);
  const allProjects = useMemo(() => visibleWorkspaces.flatMap((workspace) => workspace.projects.map((project) => ({
    ...project,
    _teamId: workspace.team.id,
    _teamName: workspace.team.name,
    _members: workspace.members,
    _tasks: workspace.tasks.filter((task) => String(task.projectId || "") === String(project.id)),
  }))), [visibleWorkspaces]);
  const allTasks = useMemo(() => visibleWorkspaces.flatMap((workspace) => workspace.tasks), [visibleWorkspaces]);

  const projects = useMemo(() => allProjects.map((project) => {
    const tasks = project._tasks;
    const completed = tasks.filter((task) => String(task.status).toUpperCase() === "DONE").length;
    const inProgress = tasks.filter((task) => String(task.status).toUpperCase() === "IN_PROGRESS").length;
    const todo = tasks.filter((task) => String(task.status).toUpperCase() === "TODO").length;
    const progress = tasks.length ? Math.round(tasks.reduce((total, task) => total + taskProgress(task), 0) / tasks.length) : (project.status === "COMPLETED" ? 100 : 0);
    const openTasks = tasks.filter((task) => String(task.status).toUpperCase() !== "DONE");
    const dueDates = openTasks.map((task) => task.dueDate).filter(Boolean).sort();
    const targetDate = project.targetDate || dueDates[0] || null;
    const overdue = Boolean(targetDate && targetDate < todayKey() && project.status !== "COMPLETED" && progress < 100);
    return { ...project, completed, inProgress, todo, progress, targetDate, overdue };
  }).sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return String(a.name).localeCompare(String(b.name));
  }), [allProjects]);

  const statusCounts = useMemo(() => ({
    todo: allTasks.filter((task) => String(task.status).toUpperCase() === "TODO").length,
    progress: allTasks.filter((task) => String(task.status).toUpperCase() === "IN_PROGRESS").length,
    done: allTasks.filter((task) => String(task.status).toUpperCase() === "DONE").length,
  }), [allTasks]);
  const overallProgress = allTasks.length ? Math.round(allTasks.reduce((total, task) => total + taskProgress(task), 0) / allTasks.length) : 0;
  const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;
  const completedProjects = projects.filter((project) => project.status === "COMPLETED").length;
  const overdueTasks = allTasks.filter((task) => task.dueDate && task.dueDate < todayKey() && String(task.status).toUpperCase() !== "DONE").length;

  const monthlyActivity = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let offset = 3; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = monthDate.getFullYear() + "-" + String(monthDate.getMonth() + 1).padStart(2, "0");
      const tasks = allTasks.filter((task) => String(task.createdAt || "").slice(0, 7) === key);
      months.push({
        key,
        label: new Intl.DateTimeFormat("en", { month: "short" }).format(monthDate),
        total: tasks.length,
        todo: tasks.filter((task) => String(task.status).toUpperCase() === "TODO").length,
        progress: tasks.filter((task) => String(task.status).toUpperCase() === "IN_PROGRESS").length,
        done: tasks.filter((task) => String(task.status).toUpperCase() === "DONE").length,
      });
    }
    return months;
  }, [allTasks]);
  const maxMonthly = Math.max(1, ...monthlyActivity.map((month) => month.total));

  const timeline = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start.getTime() + 27 * dayMs);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const items = [];
    projects.forEach((project) => {
      const from = project.startDate || project.targetDate;
      const to = project.targetDate || project.startDate;
      if (from && to && from <= endKey && to >= startKey) {
        items.push({ id: "project-" + project.id, label: project.name, kind: "project", status: project.status, from, to, teamName: project._teamName, project });
      }
      project._tasks.forEach((task) => {
        if (!task.startDate && !task.dueDate) return;
        const taskFrom = task.startDate || task.dueDate;
        const taskTo = task.dueDate || task.startDate;
        if (taskFrom && taskTo && taskFrom <= endKey && taskTo >= startKey) {
          items.push({ id: "task-" + task.id, label: task.title, kind: "task", status: task.status, from: taskFrom, to: taskTo, task, project });
        }
      });
    });
    return { start, end, startKey, endKey, items };
  }, [projects]);
  const timelineUnscheduled = allTasks.filter((task) => !task.startDate && !task.dueDate && String(task.status).toUpperCase() !== "DONE").length;

  function openNewTask(project = null) {
    setEditingTask(null);
    setForm({ ...blankTaskForm(), teamId: String(project?._teamId || visibleWorkspaces[0]?.team.id || ""), projectId: project ? String(project.id) : "" });
    setFormError("");
    setTaskDialog(true);
  }
  function openSchedule(task) {
    setEditingTask(task);
    setForm({
      ...blankTaskForm(),
      title: task.title || "",
      description: task.description || "",
      teamId: String(task._teamId || task.teamId || ""),
      projectId: String(task.projectId || ""),
      startDate: dateInput(task.startDate),
      dueDate: dateInput(task.dueDate),
      assigneeId: String(task.assignee?.id || ""),
    });
    setFormError("");
    setTaskDialog(true);
  }
  function updateForm(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "teamId") { next.projectId = ""; next.assigneeId = ""; }
      return next;
    });
  }
  const selectedWorkspace = workspaces.find((workspace) => String(workspace.team.id) === String(form.teamId));
  const formProjects = selectedWorkspace?.projects || [];
  const formMembers = selectedWorkspace?.members || [];

  async function saveTask(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      if (editingTask) {
        const result = await request(API + "/teams/" + form.teamId + "/tasks/" + editingTask.id, {
          method: "PATCH",
          body: { startDate: form.startDate || null, dueDate: form.dueDate || null, assigneeId: form.assigneeId || null },
        });
        setWorkspaces((current) => current.map((workspace) => workspace.team.id === editingTask._teamId
          ? { ...workspace, tasks: workspace.tasks.map((task) => task.id === result.id ? { ...task, ...result, _teamId: workspace.team.id, _teamName: workspace.team.name, _members: workspace.members } : task) }
          : workspace));
        notify("Task schedule updated.");
      } else {
        const title = form.title.trim();
        if (!title) { setFormError("Enter a task name."); setSaving(false); return; }
        if (!form.teamId) { setFormError("Choose a team for this task."); setSaving(false); return; }
        await request(API + "/teams/" + form.teamId + "/tasks", {
          method: "POST",
          body: {
            title,
            description: form.description.trim(),
            projectId: form.projectId || null,
            startDate: form.startDate || null,
            dueDate: form.dueDate || null,
            assigneeId: form.assigneeId || null,
          },
        });
        await loadData(true);
        notify("Task added to the project workspace.");
      }
      setTaskDialog(false);
    } catch (e) {
      setFormError(e.message || "Couldn't save this task.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(task, fields) {
    const teamId = task._teamId || task.teamId;
    try {
      const result = await request(API + "/teams/" + teamId + "/tasks/" + task.id, { method: "PATCH", body: fields });
      setWorkspaces((current) => current.map((workspace) => String(workspace.team.id) === String(teamId)
        ? { ...workspace, tasks: workspace.tasks.map((item) => String(item.id) === String(result.id) ? { ...item, ...result, _teamId: workspace.team.id, _teamName: workspace.team.name, _members: workspace.members } : item) }
        : workspace));
    } catch (e) {
      notify(e.message || "Couldn't update this task.", "error");
      await loadData(true);
    }
  }

  function toggleProject(projectId) {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }
  function percentWidth(from, to) {
    const fromDate = dateValue(from);
    const toDate = dateValue(to);
    const rangeDays = Math.max(1, Math.round((timeline.end.getTime() - timeline.start.getTime()) / dayMs) + 1);
    const clippedFrom = Math.max(timeline.start.getTime(), fromDate.getTime());
    const clippedTo = Math.min(timeline.end.getTime(), toDate.getTime());
    return Math.max(1.5, Math.min(100, ((clippedTo - clippedFrom) / dayMs + 1) / rangeDays * 100));
  }
  function timelineLeft(from, to) {
    const itemDate = dateValue(from);
    const clipped = Math.max(timeline.start.getTime(), itemDate.getTime());
    return Math.max(0, Math.min(99, (clipped - timeline.start.getTime()) / (timeline.end.getTime() - timeline.start.getTime() + dayMs) * 100));
  }
  const dateTicks = [0, 7, 14, 21].map((offset) => {
    const value = new Date(timeline.start.getTime() + offset * dayMs);
    return { key: offset, label: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value), left: offset / 28 * 100 };
  });

  if (loading && workspaces.length === 0) return <section className="dash-page"><div className="dash-loading"><span className="boot-spinner" /><p>Preparing your project dashboard…</p></div></section>;

  return (
    <section className="dash-page">
      <div className="dash-welcome">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />PROJECT COMMAND CENTER</div>
          <h1>Project dashboard<span className="heading-period">.</span></h1>
          <p className="page-subtitle">See team workload, deadlines, and project momentum in one place.</p>
        </div>
        <div className="dash-header-actions">
          <label className="dash-team-filter"><span>Workspace</span><select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">All teams</option>{workspaces.map((workspace) => <option key={workspace.team.id} value={workspace.team.id}>{workspace.team.name}</option>)}</select></label>
          <button className="secondary-button" type="button" onClick={() => loadData(true)} disabled={refreshing}>↻ Refresh</button>
          <button className="primary-button" type="button" onClick={() => openNewTask()} disabled={workspaces.length === 0}>＋ New task</button>
        </div>
      </div>

      {error && <div className="dash-error" role="alert"><strong>Couldn't load all workspace data.</strong><span>{error}</span><button className="secondary-button" type="button" onClick={() => loadData()}>Try again</button></div>}

      {workspaces.length === 0 ? (
        <div className="dash-empty"><span className="dash-empty-icon">▦</span><h2>Start with a team project</h2><p>Create a project workspace or join your teammates to see shared work, schedules, and progress here.</p><button className="primary-button" type="button" onClick={onOpenProjects}>Open Projects</button></div>
      ) : (
        <>
          <div className="dash-metrics">
            <article className="dash-metric"><span className="dash-metric-icon violet">▦</span><div><small>SHARED TASKS</small><strong>{allTasks.length}</strong><span>Across {projects.length} projects</span></div><i className="dash-metric-accent violet" /></article>
            <article className="dash-metric"><span className="dash-metric-icon orange">◷</span><div><small>IN PROGRESS</small><strong>{statusCounts.progress}</strong><span>{statusCounts.todo} still to do</span></div><i className="dash-metric-accent orange" /></article>
            <article className="dash-metric"><span className="dash-metric-icon green">✓</span><div><small>COMPLETED TASKS</small><strong>{statusCounts.done}</strong><span>{overallProgress}% completion rate</span></div><i className="dash-metric-accent green" /></article>
            <article className="dash-metric"><span className="dash-metric-icon blue">⌁</span><div><small>PAST-DUE TASKS</small><strong>{overdueTasks}</strong><span>{projects.length} projects in view</span></div><i className="dash-metric-accent blue" /></article>
          </div>

          <div className="dash-top-grid">
            <section className="dash-panel dash-track-panel">
              <div className="dash-panel-title"><span className="dash-panel-icon">◷</span><div><h2>Task track</h2><p>Current status across the selected workspace</p></div><span className="dash-panel-total">{allTasks.length} tasks</span></div>
              <div className="dash-status-bar" role="img" aria-label={statusCounts.todo + " to do, " + statusCounts.progress + " in progress, " + statusCounts.done + " completed"}>
                {allTasks.length > 0 && <><span className="todo" style={{ width: (statusCounts.todo / allTasks.length * 100) + "%" }} /><span className="progress" style={{ width: (statusCounts.progress / allTasks.length * 100) + "%" }} /><span className="done" style={{ width: (statusCounts.done / allTasks.length * 100) + "%" }} /></>}
              </div>
              <div className="dash-track-legend">
                <div><span className="dash-legend-dot todo" /><span>To do</span><strong>{statusCounts.todo}</strong></div>
                <div><span className="dash-legend-dot progress" /><span>In progress</span><strong>{statusCounts.progress}</strong></div>
                <div><span className="dash-legend-dot done" /><span>Completed</span><strong>{statusCounts.done}</strong></div>
              </div>
              <div className="dash-monthly-chart">
                <div className="dash-chart-heading"><strong>Tasks created</strong><span>Last 4 months</span></div>
                <div className="dash-chart-bars">
                  {monthlyActivity.map((month) => <div className="dash-chart-column" key={month.key} title={month.total + " tasks created"}>
                    <div className="dash-chart-stack" style={{ height: Math.max(month.total ? 10 : 3, month.total / maxMonthly * 100) + "%" }}>
                      {month.total > 0 && <><span className="done" style={{ height: (month.done / month.total * 100) + "%" }} /><span className="progress" style={{ height: (month.progress / month.total * 100) + "%" }} /><span className="todo" style={{ height: (month.todo / month.total * 100) + "%" }} /></>}
                    </div><span>{month.label}</span>
                  </div>)}
                </div>
              </div>
            </section>

            <section className="dash-panel dash-progress-panel">
              <div className="dash-panel-title"><span className="dash-panel-icon">↗</span><div><h2>Project progress</h2><p>Completion based on finished tasks</p></div><strong className="dash-average">{overallProgress}%</strong></div>
              <div className="dash-progress-overview"><span>Workspace completion</span><strong>{overallProgress}%</strong></div>
              <div className="dash-progress-track"><span style={{ width: overallProgress + "%" }} /></div>
              <div className="dash-progress-list">
                {projects.length === 0 ? <div className="dash-muted-copy">No projects in this workspace yet.</div> : projects.slice(0, 5).map((project) => <button className="dash-project-progress" key={project.id} type="button" onClick={() => { setExpandedProjects((current) => new Set(current).add(project.id)); document.getElementById("dash-project-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                  <span className="dash-project-progress-name">{project.name}<small>{project._tasks.length} tasks</small></span><span className="dash-mini-track"><i style={{ width: project.progress + "%" }} /></span><strong>{project.progress}%</strong>
                </button>)}
              </div>
              <div className="dash-progress-foot"><span>{activeProjects} active</span><span>{completedProjects} completed</span></div>
            </section>
          </div>

          <section className="dash-panel dash-timeline-panel">
            <div className="dash-panel-title dash-timeline-heading"><span className="dash-panel-icon">▤</span><div><h2>Project timeline</h2><p>Four-week view of project windows and scheduled tasks</p></div><button className="secondary-button" type="button" onClick={() => openNewTask()}>＋ Add schedule</button></div>
            <div className="dash-timeline-range"><span>{dateLabel(timeline.startKey, { month: "short", day: "numeric", year: "numeric" })}</span><span>{dateLabel(timeline.endKey, { month: "short", day: "numeric", year: "numeric" })}</span></div>
            <div className="dash-gantt-scroll">
              <div className="dash-gantt">
                <div className="dash-gantt-header"><div className="dash-gantt-label">Project / task</div><div className="dash-gantt-dates">{dateTicks.map((tick) => <span key={tick.key} style={{ left: tick.left + "%" }}>{tick.label}</span>)}</div></div>
                {timeline.items.length === 0 ? <div className="dash-timeline-empty"><strong>No scheduled work in this four-week window.</strong><span>{timelineUnscheduled} open tasks have no schedule yet. Use Add schedule to set dates and assign an owner.</span></div> : timeline.items.map((item) => <div className={"dash-gantt-row " + (item.kind === "task" ? "is-task" : "is-project")} key={item.id}>
                  <div className="dash-gantt-label">{item.kind === "task" && <span className="dash-gantt-indent" />}{item.kind === "project" ? <strong>{item.label}</strong> : <span>{item.label}</span>}{item.kind === "task" && <button className="dash-inline-edit" type="button" title="Edit task schedule" aria-label={"Edit schedule for " + item.label} onClick={() => openSchedule(item.task)}>✎</button>}</div>
                  <div className="dash-gantt-track">
                    {dateTicks.map((tick) => <i key={tick.key} style={{ left: tick.left + "%" }} />)}
                    <span className={"dash-gantt-bar " + (item.kind === "project" ? "project-bar" : "task-bar status-" + String(item.status || "TODO").toLowerCase())}
                      style={{ left: timelineLeft(item.from, item.to) + "%", width: percentWidth(item.from, item.to) + "%" }} title={item.label + ": " + dateLabel(item.from) + " – " + dateLabel(item.to)}>
                      <span>{item.kind === "project" ? item.project.progress + "% complete" : item.label}</span>
                    </span>
                  </div>
                </div>)}
              </div>
            </div>
            <div className="dash-timeline-footer"><span><i className="dash-timeline-key project-bar" />Project window</span><span><i className="dash-timeline-key status-TODO" />To do</span><span><i className="dash-timeline-key status-IN_PROGRESS" />In progress</span><span><i className="dash-timeline-key status-DONE" />Completed</span><span className="dash-timeline-unscheduled">{timelineUnscheduled} unscheduled open tasks</span></div>
          </section>

          <section className="dash-panel dash-list-panel" id="dash-project-list">
            <div className="dash-panel-title dash-list-heading"><span className="dash-panel-icon">☷</span><div><h2>Project list</h2><p>Expand a project to manage its tasks, dates, assignees, and status.</p></div><button className="primary-button" type="button" onClick={onOpenProjects}>Manage projects <span>↗</span></button></div>
            <div className="dash-table-scroll"><table className="dash-project-table">
              <thead><tr><th className="dash-project-col">Project / task</th><th>Target / due date</th><th>Team</th><th>Status</th><th>Progress</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {projects.length === 0 && <tr><td colSpan="6" className="dash-table-empty">No projects here yet. Use Manage projects to create one.</td></tr>}
                {projects.map((project) => {
                  const expanded = expandedProjects.has(project.id);
                  return <ReactProjectRows
                    key={project.id}
                    project={project}
                    expanded={expanded}
                    members={project._members}
                    onToggle={() => toggleProject(project.id)}
                    onNewTask={() => openNewTask(project)}
                    onEditSchedule={openSchedule}
                    onUpdateTask={updateTask}
                  />;
                })}
              </tbody>
            </table></div>
          </section>
          <footer className="dash-footer"><span>TaskFlow <b>·</b> Projects, people, and progress in one place.</span><span><i />Workspace data refreshed {refreshing ? "in progress…" : "on demand"}</span></footer>
        </>
      )}

      {taskDialog && <div className="dash-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTaskDialog(false); }}><section className="dash-modal" role="dialog" aria-modal="true" aria-labelledby="dash-modal-title">
        <div className="dash-modal-heading"><div><div className="eyebrow">{editingTask ? "KEEP THE PLAN CURRENT" : "PLAN THE WORK"}</div><h2 id="dash-modal-title">{editingTask ? "Schedule task" : "Add a shared task"}</h2><p>{editingTask ? editingTask.title : "Add a task to a team's project workspace."}</p></div><button className="icon-button" type="button" aria-label="Close dialog" disabled={saving} onClick={() => setTaskDialog(false)}>×</button></div>
        <form className="dash-form" onSubmit={saveTask}>
          {!editingTask && <>
            <label className="dash-form-field"><span>Task title *</span><input maxLength={120} value={form.title} onChange={(event) => updateForm("title", event.target.value)} required placeholder="e.g. Prepare launch checklist" /></label>
            <label className="dash-form-field"><span>Description</span><textarea rows={3} maxLength={1000} value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="What needs to get done?" /></label>
            <label className="dash-form-field"><span>Team *</span><select value={form.teamId} onChange={(event) => updateForm("teamId", event.target.value)} required><option value="">Choose a team</option>{workspaces.map((workspace) => <option key={workspace.team.id} value={workspace.team.id}>{workspace.team.name}</option>)}</select></label>
            <label className="dash-form-field"><span>Project</span><select value={form.projectId} onChange={(event) => updateForm("projectId", event.target.value)}><option value="">Unassigned</option>{formProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          </>}
          <div className="dash-form-two">
            <label className="dash-form-field"><span>Start date</span><input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></label>
            <label className="dash-form-field"><span>Due date</span><input type="date" value={form.dueDate} min={form.startDate || undefined} onChange={(event) => updateForm("dueDate", event.target.value)} /></label>
          </div>
          <label className="dash-form-field"><span>Assignee</span><select value={form.assigneeId} onChange={(event) => updateForm("assigneeId", event.target.value)}><option value="">Unassigned</option>{formMembers.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name} · {member.role}</option>)}</select></label>
          {editingTask && <div className="dash-form-note">Current status: {statusLabel(editingTask.status)}. Change task status from the project's shared task board.</div>}
          {formError && <div className="dash-error dash-form-error" role="alert">{formError}</div>}
          <div className="dash-modal-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setTaskDialog(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving || (!editingTask && !form.title.trim())}>{saving ? "Saving…" : editingTask ? "Save schedule" : "Create task"}</button></div>
        </form>
      </section></div>}
    </section>
  );
}

function TaskProgressEditor({ title, value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, title]);
  return <span className="dash-progress-editor">
    <input type="range" min="0" max="100" step="5" value={draft} aria-label={"Progress for " + title} onChange={(event) => setDraft(Number(event.target.value))} />
    <strong>{draft}%</strong>
    {draft !== value && <button type="button" className="dash-progress-save" onClick={() => onSave(draft)} aria-label={"Save progress for " + title}>✓</button>}
  </span>;
}

function ReactProjectRows({ project, expanded, members, onToggle, onNewTask, onEditSchedule, onUpdateTask }) {
  return <>
    <tr className="dash-project-row">
      <td><button className={"dash-expand-button" + (expanded ? " expanded" : "")} type="button" aria-expanded={expanded} onClick={onToggle}><span>›</span></button><span className={"dash-project-swatch swatch-" + String(project.status || "PLANNED").toLowerCase()} /><span className="dash-project-name-cell"><strong>{project.name}</strong><small>{project._teamName} · PRJ-{String(project.id).padStart(3, "0")}</small></span></td>
      <td><strong className={project.overdue ? "is-late" : ""}>{dateLabel(project.targetDate, { month: "short", day: "numeric", year: "numeric" })}</strong>{project.overdue && <small className="dash-late-label">Past target</small>}</td>
      <td><MemberStack members={members} /></td>
      <td><span className={"dash-project-status status-" + String(project.status || "PLANNED").toLowerCase()}><i />{PROJECT_STATUSES[project.status] || project.status}</span></td>
      <td><span className="dash-progress-cell"><span className="dash-mini-track"><i style={{ width: project.progress + "%" }} /></span><strong>{project.progress}%</strong></span></td>
      <td><button className="dash-row-action" type="button" onClick={onNewTask} title="Add task to this project" aria-label={"Add task to " + project.name}>＋</button></td>
    </tr>
    {expanded && <>
      {project._tasks.length === 0 && <tr className="dash-task-row"><td colSpan="6"><span className="dash-no-tasks">No tasks in this project yet.</span><button type="button" className="dash-link-button" onClick={onNewTask}>Add the first task</button></td></tr>}
      {project._tasks.map((task) => <tr className="dash-task-row" key={task.id}>
        <td><span className="dash-task-id">TSK-{String(task.id).padStart(3, "0")}</span><span className="dash-task-title-cell">{task.title}</span></td>
        <td><span className={task.dueDate && task.dueDate < todayKey() && String(task.status).toUpperCase() !== "DONE" ? "is-late" : ""}>{dateLabel(task.dueDate, { month: "short", day: "numeric", year: "numeric" })}</span></td>
        <td>{task.assignee ? <span className="dash-assignee-chip"><MemberStack members={[{ user: task.assignee }]} limit={1} /><span>{task.assignee.name}</span></span> : <span className="dash-no-members">Unassigned</span>}</td>
        <td><select className={"dash-inline-status status-" + String(task.status || "TODO").toLowerCase()} aria-label={"Status of " + task.title} value={String(task.status || "TODO").toUpperCase()} onChange={(event) => onUpdateTask(task, { status: event.target.value })}>{TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></td>
        <td><TaskProgressEditor title={task.title} value={taskProgress(task)} onSave={(progress) => onUpdateTask(task, { progress, status: progress === 100 ? "DONE" : progress === 0 ? "TODO" : "IN_PROGRESS" })} /></td>
        <td><button className="dash-row-action" type="button" onClick={() => onEditSchedule(task)} title="Edit dates and assignee" aria-label={"Schedule " + task.title}>✎</button></td>
      </tr>)}
    </>}
  </>;
}

export default ProjectDashboard;
