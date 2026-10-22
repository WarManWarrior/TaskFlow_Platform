import { useMemo, useState } from "react";

const API = "/api";
const PROJECT_STATUSES = [
  { value: "PLANNED", label: "Planned" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "COMPLETED", label: "Completed" },
];

async function csrfToken() {
  const response = await fetch(API + "/auth/csrf", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Couldn't start a secure request. Refresh and try again.");
  const payload = await response.json();
  if (!payload.token) throw new Error("Security token missing. Refresh and try again.");
  return payload.token;
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    headers["X-XSRF-TOKEN"] = await csrfToken();
  }

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
    const error = new Error(
      (payload && (payload.detail || payload.message || payload.error)) ||
      "Request failed. Please try again."
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

const emptyForm = () => ({
  name: "",
  description: "",
  status: "PLANNED",
  startDate: "",
  targetDate: "",
});

const dateLabel = (value) => {
  if (!value) return "Not set";
  const parsed = new Date(value + "T00:00:00");
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
};

export default function ProjectsWorkspace({
  notify = () => {},
  teamId,
  projects = [],
  setProjects = () => {},
  loadingProjects = false,
  onRefresh = () => {},
  onViewTasks = () => {},
  taskCounts = {},
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) =>
      !query ||
      project.name?.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query)
    );
  }, [projects, search]);

  const summary = useMemo(() => {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    return {
      total: projects.length,
      active: projects.filter((project) => project.status === "ACTIVE").length,
      completed: projects.filter((project) => project.status === "COMPLETED").length,
      overdue: projects.filter((project) =>
        project.targetDate && project.targetDate < today && project.status !== "COMPLETED"
      ).length,
    };
  }, [projects]);

  function openCreate() {
    setEditingProject(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  }

  function openEdit(project) {
    setEditingProject(project);
    setForm({
      name: project.name || "",
      description: project.description || "",
      status: project.status || "PLANNED",
      startDate: project.startDate || "",
      targetDate: project.targetDate || "",
    });
    setError("");
    setFormOpen(true);
  }

  async function submitProject(event) {
    event.preventDefault();
    if (!teamId || saving) return;
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
    };
    try {
      const basePath = API + "/teams/" + teamId + "/projects";
      const result = editingProject
        ? await request(basePath + "/" + editingProject.id, { method: "PATCH", body: payload })
        : await request(basePath, { method: "POST", body: payload });
      if (editingProject) {
        setProjects((current) => current.map((item) => item.id === result.id ? result : item));
      } else {
        setProjects((current) => [result, ...current]);
      }
      setFormOpen(false);
      setEditingProject(null);
      setForm(emptyForm());
      notify(editingProject ? "Project updated." : "Project created.", "success");
    } catch (e) {
      setError(e.message || "Couldn't save this project.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project) {
    if (!window.confirm('Delete project "' + project.name + '"? This cannot be undone.')) return;
    setError("");
    try {
      await request(API + "/teams/" + teamId + "/projects/" + project.id, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (editingProject?.id === project.id) setFormOpen(false);
      notify("Project deleted.", "success");
    } catch (e) {
      setError(e.message || "Couldn't delete this project.");
    }
  }

  return (
    <section className="projects-page">
      <div className="projects-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />PROJECT PLANNING</div>
          <h2>Project portfolio<span className="heading-period">.</span></h2>
          <p className="page-subtitle">Plan deliverables, track target dates, and keep each project's tasks together.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate} disabled={!teamId}>
          <span aria-hidden="true">＋</span> New project
        </button>
      </div>

      <section className="projects-summary" aria-label="Project summary">
        <article className="projects-summary-card"><span>All projects</span><strong>{summary.total}</strong></article>
        <article className="projects-summary-card"><span>Active</span><strong>{summary.active}</strong></article>
        <article className="projects-summary-card"><span>Completed</span><strong>{summary.completed}</strong></article>
        <article className={"projects-summary-card" + (summary.overdue ? " is-overdue" : "")}><span>Past target date</span><strong>{summary.overdue}</strong></article>
      </section>

      {error && !formOpen && <div className="projects-error" role="alert">{error}</div>}

      <>
        <div className="projects-toolbar">
          <label className="projects-search">
            <span className="sr-only">Search projects</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects…" />
          </label>
          <button className="secondary-button" type="button" onClick={onRefresh} disabled={loadingProjects}>↻ Refresh</button>
        </div>

        {loadingProjects ? (
          <div className="projects-empty"><span className="boot-spinner" /><p>Loading projects…</p></div>
        ) : visibleProjects.length === 0 ? (
          <div className="projects-empty">
            <div className="projects-empty-icon">▦</div>
            <h2>{search ? "No matching projects" : "Your team plan starts here"}</h2>
            <p>{search ? "Try another keyword." : "Create a project to group related work, set a target date, and keep the team aligned."}</p>
            {!search && <button className="primary-button" type="button" onClick={openCreate}>＋ Create first project</button>}
          </div>
        ) : (
          <div className="projects-grid">
            {visibleProjects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card-top">
                  <span className={"project-status-badge status-" + String(project.status || "PLANNED").toLowerCase()}>{PROJECT_STATUSES.find((item) => item.value === project.status)?.label || project.status}</span>
                  <span className="project-id">PRJ-{String(project.id).padStart(3, "0")}</span>
                </div>
                <h3>{project.name}</h3>
                <p className={"project-description" + (!project.description ? " muted" : "")}>{project.description || "No project description yet."}</p>
                <div className="project-dates">
                  <div><span>Start</span><strong>{dateLabel(project.startDate)}</strong></div>
                  <div><span>Target</span><strong>{dateLabel(project.targetDate)}</strong></div>
                </div>
                <div className="project-creator"><span>Created by</span><strong>{project.createdBy?.name || "Team member"}</strong></div>
                <div className="project-card-actions">
                  <button className="secondary-button" type="button" onClick={() => onViewTasks(project.id)}>View tasks ({taskCounts[project.id] || 0})</button>
                  <button className="secondary-button" type="button" onClick={() => openEdit(project)}>Edit</button>
                  <button className="project-delete-button" type="button" disabled={(taskCounts[project.id] || 0) > 0} title={(taskCounts[project.id] || 0) > 0 ? "Move this project's tasks to another project or the unassigned list first." : "Delete project"} onClick={() => deleteProject(project)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </>

      {formOpen && (
        <div className="projects-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
          <section className="projects-modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
            <div className="projects-modal-header">
              <div><div className="eyebrow"><span className="eyebrow-line" />PROJECT DETAILS</div><h2 id="project-form-title">{editingProject ? "Edit project" : "New project"}</h2></div>
              <button className="icon-button" type="button" aria-label="Close project form" onClick={() => !saving && setFormOpen(false)}>×</button>
            </div>
            <form className="projects-form" onSubmit={submitProject}>
              <label><span>Project name</span><input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Mobile app launch" /></label>
              <label><span>Description</span><textarea rows={4} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What outcome is this project meant to deliver?" /></label>
              <div className="projects-form-grid">
                <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label><span>Start date</span><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
                <label><span>Target date</span><input type="date" min={form.startDate || undefined} value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label>
              </div>
              {error && <div className="projects-error" role="alert">{error}</div>}
              <div className="projects-modal-actions">
                <button className="secondary-button" type="button" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button>
                <button className="primary-button" type="submit" disabled={saving || !form.name.trim()}>{saving ? "Saving…" : editingProject ? "Save changes" : "Create project"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
