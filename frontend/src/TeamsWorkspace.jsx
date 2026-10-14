import { useCallback, useEffect, useMemo, useState } from "react";

const API = "/api";
const STATUSES = [
  { value: "TODO", label: "To do", tone: "todo" },
  { value: "IN_PROGRESS", label: "In progress", tone: "progress" },
  { value: "DONE", label: "Done", tone: "done" },
];

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
  const response = await fetch(path, { method, credentials: "same-origin", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  let payload = null;
  if (type.includes("json")) payload = await response.json().catch(() => null);
  else { const text = await response.text().catch(() => ""); payload = text ? { detail: text } : null; }
  if (!response.ok) {
    const error = new Error((payload && (payload.detail || payload.message || payload.error)) || "Request failed. Please try again.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function Avatar({ user, size = 34 }) {
  const name = user?.name || "Team member";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
  const color = user?.avatarColor || "#9B8AFB";
  return <span className="user-avatar" title={name} aria-label={name} style={{ width: size, height: size, backgroundColor: color }}>
    {user?.avatarUrl ? <><img src={user.avatarUrl} alt="" onError={(event) => { event.currentTarget.remove(); if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = "grid"; }} /><span className="user-avatar-initials" style={{ display: "none" }}>{initials}</span></> : initials}
  </span>;
}

function initials(name) {
  return String(name || "T").trim().split(/\s+/).slice(0,2).map((part) => part[0] || "").join("").toUpperCase();
}

export default function TeamsWorkspace({ notify = () => {} }) {
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [teamDialog, setTeamDialog] = useState("");
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [taskDialog, setTaskDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState(() => new Set());

  const activeTeam = useMemo(() => teams.find((team) => String(team.id) === String(activeTeamId)) || null, [teams, activeTeamId]);
  const board = useMemo(() => STATUSES.map((status) => ({ ...status, tasks: tasks.filter((task) => String(task.status || "TODO").toUpperCase() === status.value) })), [tasks]);

  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    setError("");
    try {
      const result = await request(API + "/teams");
      const loaded = Array.isArray(result) ? result : [];
      setTeams(loaded);
      setActiveTeamId((current) => current && loaded.some((team) => String(team.id) === String(current)) ? current : (loaded[0]?.id ?? null));
    } catch (e) {
      setError(e.message || "Couldn't load teams.");
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  const loadWorkspace = useCallback(async (teamId) => {
    if (!teamId) return;
    setLoadingWorkspace(true);
    try {
      const [taskResult, memberResult, activityResult] = await Promise.all([
        request(API + "/teams/" + teamId + "/tasks"),
        request(API + "/teams/" + teamId + "/members"),
        request(API + "/teams/" + teamId + "/activity"),
      ]);
      setTasks(Array.isArray(taskResult) ? taskResult : []);
      setMembers(Array.isArray(memberResult) ? memberResult : []);
      setActivity(Array.isArray(activityResult) ? activityResult : []);
    } catch (e) {
      setError(e.message || "Couldn't load this team's workspace.");
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);
  useEffect(() => {
    if (activeTeamId) loadWorkspace(activeTeamId);
    else { setTasks([]); setMembers([]); setActivity([]); }
  }, [activeTeamId, loadWorkspace]);

  useEffect(() => {
    if (!selectedTask || !activeTeamId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await request(API + "/teams/" + activeTeamId + "/tasks/" + selectedTask.id + "/comments");
        if (!cancelled) setComments(Array.isArray(result) ? result : []);
      } catch (e) {
        if (!cancelled) notify(e.message || "Couldn't load comments.", "error");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTask?.id, activeTeamId, notify]);

  async function createTeam(event) {
    event.preventDefault();
    const name = teamName.trim();
    if (!name) { setError("Enter a team name."); return; }
    setSaving(true); setError("");
    try {
      const team = await request(API + "/teams", { method: "POST", body: { name } });
      setTeams((current) => [team, ...current.filter((item) => String(item.id) !== String(team.id))]);
      setActiveTeamId(team.id); setTeamName(""); setTeamDialog("");
      notify("Team created. Share its code to invite teammates.");
    } catch (e) { setError(e.message || "Couldn't create the team."); }
    finally { setSaving(false); }
  }

  async function joinTeam(event) {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError("Enter the code you received."); return; }
    setSaving(true); setError("");
    try {
      const team = await request(API + "/teams/join", { method: "POST", body: { code } });
      setTeams((current) => [team, ...current.filter((item) => String(item.id) !== String(team.id))]);
      setActiveTeamId(team.id); setJoinCode(""); setTeamDialog("");
      notify("You've joined " + team.name + ".");
    } catch (e) { setError(e.message || "Couldn't join that team."); }
    finally { setSaving(false); }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      notify("Team code copied.");
    } catch {
      window.prompt("Copy this team code and share it with your teammates:", code);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title || !activeTeamId) return;
    setSaving(true); setError("");
    try {
      const task = await request(API + "/teams/" + activeTeamId + "/tasks", { method: "POST", body: { title, description: taskDescription.trim() } });
      setTasks((current) => [task, ...current]);
      setTaskTitle(""); setTaskDescription(""); setTaskDialog(false);
      const feed = await request(API + "/teams/" + activeTeamId + "/activity");
      setActivity(Array.isArray(feed) ? feed : []);
      notify("Shared task created.");
    } catch (e) { setError(e.message || "Couldn't create that task."); }
    finally { setSaving(false); }
  }

  async function updateStatus(task, status) {
    if (!activeTeamId || busyIds.has(task.id) || status === task.status) return;
    setBusyIds((current) => new Set(current).add(task.id));
    try {
      const updated = await request(API + "/teams/" + activeTeamId + "/tasks/" + task.id, { method: "PATCH", body: { status } });
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
      const feed = await request(API + "/teams/" + activeTeamId + "/activity");
      setActivity(Array.isArray(feed) ? feed : []);
      notify("Shared task status updated.");
    } catch (e) { notify(e.message || "Couldn't update that task.", "error"); }
    finally { setBusyIds((current) => { const next = new Set(current); next.delete(task.id); return next; }); }
  }

  async function postComment(event) {
    event.preventDefault();
    const body = commentDraft.trim();
    if (!body || !selectedTask || !activeTeamId) return;
    setSaving(true);
    try {
      const saved = await request(API + "/teams/" + activeTeamId + "/tasks/" + selectedTask.id + "/comments", { method: "POST", body: { body } });
      setComments((current) => [...current, saved]);
      setCommentDraft("");
      const feed = await request(API + "/teams/" + activeTeamId + "/activity");
      setActivity(Array.isArray(feed) ? feed : []);
      notify("Comment posted.");
    } catch (e) { notify(e.message || "Couldn't post the comment.", "error"); }
    finally { setSaving(false); }
  }

  return (
    <section className="teams-page">
      <div className="teams-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" />WORK BETTER TOGETHER</div><h1>Teams<span className="heading-period">.</span></h1><p className="page-subtitle">Shared tasks, visible progress, and every teammate's contribution in one place.</p></div>
        <div className="teams-heading-actions"><button className="secondary-button" onClick={() => { setTeamDialog("join"); setError(""); }}>↗ Join team</button><button className="primary-button" onClick={() => { setTeamDialog("create"); setError(""); }}>＋ Create team</button></div>
      </div>

      {error && <div className="team-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

      <div className="team-workspace-layout">
        <aside className="team-picker-panel">
          <div className="team-picker-heading"><span>YOUR TEAMS</span><span className="nav-count">{teams.length}</span></div>
          {loadingTeams ? <div className="team-picker-empty">Loading teams…</div> : teams.length === 0 ?
            <div className="team-picker-empty"><div className="team-empty-mark">✳</div><strong>No teams yet</strong><p>Create a team or join one with a team code.</p><button className="secondary-button" onClick={() => { setTeamDialog("create"); setError(""); }}>Get started</button></div> :
            <div className="team-picker-list">{teams.map((team) => <button key={team.id} className={"team-picker-item" + (String(activeTeamId) === String(team.id) ? " selected" : "")} onClick={() => setActiveTeamId(team.id)}><span className="team-icon">{initials(team.name).slice(0,2)}</span><span className="team-picker-copy"><strong>{team.name}</strong><small>{team.memberCount} {team.memberCount === 1 ? "member" : "members"}</small></span><span aria-hidden="true">›</span></button>)}</div>}
          <div className="team-picker-footer"><button onClick={() => { setTeamDialog("create"); setError(""); }}>＋ Create a team</button><button onClick={() => { setTeamDialog("join"); setError(""); }}>↗ Join with code</button></div>
        </aside>

        {activeTeam ? <div className="team-workspace">
          <section className="team-hero-card">
            <div className="team-hero-main"><div className="team-hero-mark">✳</div><div><div className="team-role-label">{activeTeam.role === "OWNER" ? "TEAM OWNER" : "TEAM MEMBER"}</div><h2>{activeTeam.name}</h2><p>{activeTeam.memberCount} {activeTeam.memberCount === 1 ? "member" : "members"} · Shared workspace</p></div></div>
            <div className="team-code-block"><span>TEAM INVITE CODE</span><div><strong>{activeTeam.teamCode}</strong><button title="Copy team code" aria-label="Copy team code" onClick={() => copyCode(activeTeam.teamCode)}>⧉</button></div><small>Share this unique code so others can join.</small></div>
          </section>

          <section className="team-members-strip"><div><div className="team-section-kicker">THE PEOPLE</div><h3>Your teammates</h3></div><div className="team-member-stack">{members.map((member) => <span className="team-member-person" key={member.user.id}><Avatar user={member.user} size={36} /><span>{member.user.name}</span><small>{member.role.toLowerCase()}</small></span>)}</div></section>

          <section className="team-shared-board">
            <div className="team-section-heading"><div><div className="team-section-kicker">IN SYNC</div><h3>Shared task board <span className="board-total">{tasks.length}</span></h3><p>Task changes and comments show who made each contribution.</p></div><div className="team-board-actions"><button className="secondary-button" disabled={loadingWorkspace} onClick={() => loadWorkspace(activeTeam.id)}>↻ Refresh</button><button className="primary-button" onClick={() => { setError(""); setTaskTitle(""); setTaskDescription(""); setTaskDialog(true); }}>＋ Shared task</button></div></div>

            <div className="kanban-grid team-kanban-grid">{board.map((column) => <section className={"kanban-column column-" + column.tone} key={column.value}>
              <div className="column-heading"><div className="column-title-group"><span className={"column-status-dot " + column.tone}><span className="status-indicator" /></span><h3>{column.label}</h3><span className="column-count">{column.tasks.length}</span></div></div>
              <div className="task-stack">{loadingWorkspace ? <div className="task-skeleton" /> : column.tasks.length === 0 ? <div className="column-empty"><span className="column-empty-icon">○</span><p>No shared tasks here yet.</p></div> : column.tasks.map((task) => {
                const actor = task.updatedBy || task.createdBy;
                const busy = busyIds.has(task.id);
                return <article className="task-card team-task-card" key={task.id} style={{ "--actor-color": actor?.avatarColor || "var(--purple)" }}>
                  <div className="task-card-top"><span className="task-id">TEAM-{String(task.id).padStart(3,"0")}</span><button className="discussion-button" onClick={() => { setSelectedTask(task); setComments([]); setCommentDraft(""); }}>Comment ({comments.length && selectedTask?.id === task.id ? comments.length : "view"})</button></div>
                  <h4>{task.title}</h4><p className={"task-description" + (!task.description ? " no-description" : "")}>{task.description || "No description added."}</p>
                  <div className="team-task-activity-tag"><Avatar user={actor} size={25} /><span><strong>{actor?.name || "Team member"}</strong><small>{task.updatedAt ? new Date(task.updatedAt).toLocaleString() : "Task created"}</small></span></div>
                  <div className="task-card-bottom"><span className={"task-status-label " + column.tone}><span className="status-indicator" />{column.label}</span><label className="status-select-wrap"><span className="visually-hidden">Change status for {task.title}</span><select aria-label={"Change status for " + task.title} value={String(task.status || "TODO").toUpperCase()} disabled={busy} onChange={(event) => updateStatus(task,event.target.value)}>{STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><span className="status-chevron">⌄</span></label></div>
                </article>;
              })}</div>
              {column.value === "TODO" && <button className="add-card-button" onClick={() => { setTaskTitle(""); setTaskDescription(""); setTaskDialog(true); }}>＋ Add shared task</button>}
            </section>)}</div>
          </section>

          <section className="team-activity-panel"><div className="team-section-kicker">TEAM PULSE</div><h3>Recent activity</h3><p>Task updates and comments, with the contributor shown by avatar and color.</p>
            {activity.length === 0 ? <div className="activity-empty">Team activity will appear here as you work together.</div> : <div className="team-activity-list">{activity.map((item) => <article className="team-activity-item" key={item.id} style={{ "--actor-color": item.actor?.avatarColor || "var(--purple)" }}><Avatar user={item.actor} size={34} /><div className="team-activity-copy"><div><strong>{item.actor?.name || "Teammate"}</strong> <span>{item.detail}</span></div><small>{item.taskTitle} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</small></div></article>)}</div>}
          </section>
        </div> : <div className="team-no-selection"><div className="team-empty-mark">✳</div><h2>Make space for teamwork.</h2><p>Create a team and invite people with its unique code, or join a team using a code from a teammate.</p><div><button className="primary-button" onClick={() => { setTeamDialog("create"); setError(""); }}>＋ Create team</button><button className="secondary-button" onClick={() => { setTeamDialog("join"); setError(""); }}>Join a team</button></div></div>}
      </div>

      {teamDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTeamDialog(""); }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="team-dialog-title"><div className="modal-heading"><span className="modal-icon">{teamDialog === "create" ? "✳" : "↗"}</span><button className="icon-button modal-close" aria-label="Close team form" disabled={saving} onClick={() => setTeamDialog("")}>×</button><div className="eyebrow">TEAM WORKSPACE</div><h2 id="team-dialog-title">{teamDialog === "create" ? "Create a team" : "Join a team"}</h2><p>{teamDialog === "create" ? "Start a shared space and invite others with your unique code." : "Enter the invite code shared by your teammate."}</p></div><form className="create-form" onSubmit={teamDialog === "create" ? createTeam : joinTeam}>{teamDialog === "create" ? <label className="form-field"><span>Team name <em>*</em></span><input autoFocus maxLength={100} placeholder="e.g. Project Nova" value={teamName} onChange={(event) => setTeamName(event.target.value)} required /></label> : <label className="form-field"><span>Team code <em>*</em></span><input autoFocus maxLength={9} placeholder="ABCD-EFGH" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} required /></label>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setTeamDialog("")}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Please wait…" : teamDialog === "create" ? "Create team" : "Join team"}</button></div></form></section></div>}

      {taskDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTaskDialog(false); }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="shared-task-title"><div className="modal-heading"><span className="modal-icon">＋</span><button className="icon-button modal-close" aria-label="Close shared task form" disabled={saving} onClick={() => setTaskDialog(false)}>×</button><div className="eyebrow">TEAM TASK</div><h2 id="shared-task-title">Create a shared task</h2><p>This task and its activity will be visible to all members.</p></div><form className="create-form" onSubmit={createTask}><label className="form-field"><span>Task title <em>*</em></span><input autoFocus maxLength={120} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Prepare the team review" required /></label><label className="form-field"><span>Description <small>OPTIONAL</small></span><textarea rows={3} maxLength={1000} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Add context for your teammates…" /></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setTaskDialog(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving || !taskTitle.trim()}>{saving ? "Saving…" : "Create shared task"}</button></div></form></section></div>}

      {selectedTask && activeTeam && <div className="modal-backdrop discussion-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTask(null); }}><section className="discussion-modal" role="dialog" aria-modal="true" aria-labelledby="discussion-title"><div className="discussion-heading"><div><div className="team-section-kicker">TEAM DISCUSSION</div><h2 id="discussion-title">{selectedTask.title}</h2><p>{activeTeam.name} · Shared with all team members.</p></div><button className="icon-button" aria-label="Close discussion" onClick={() => setSelectedTask(null)}>×</button></div><div className="discussion-comments">{comments.length === 0 ? <div className="activity-empty">No comments yet. Start the conversation.</div> : comments.map((comment) => <article className="comment-item" key={comment.id} style={{ "--actor-color": comment.author?.avatarColor || "var(--purple)" }}><Avatar user={comment.author} size={34} /><div className="comment-content"><div className="comment-meta"><strong>{comment.author?.name || "Team member"}</strong><time>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}</time></div><p>{comment.body}</p></div></article>)}</div><form className="comment-form" onSubmit={postComment}><textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} rows={3} placeholder="Write a comment for your teammates…" required /><div><small>{commentDraft.length}/1000</small><button className="primary-button" type="submit" disabled={saving || !commentDraft.trim()}>{saving ? "Posting…" : "Post comment"}</button></div></form></section></div>}
    </section>
  );
}
