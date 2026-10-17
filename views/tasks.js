// views/tasks.js
import { tr } from '../i18n.js';
import { $, S, esc, fmtShort, get, list, meter, parse, today } from '../core.js';

export function attCount(list) {
  const l = (list || []).filter(a2 => a2.type === 'link').length, f = (list || []).filter(a2 => a2.type === 'file').length;
  return l || f ? `<span class="att-count" title="${tr('Links & documents')}">${l ? `🔗 ${l}` : ''}${l && f ? ' · ' : ''}${f ? `📎 ${f}` : ''}</span>` : '';
}
export function taskRow(x) {
  const t = today(), p = x.data.projectId ? get(x.data.projectId) : null;
  const over = x.data.due && x.data.due < t && !x.data.done;
  return `<li class="task ${x.data.done ? 'is-done' : ''}">
    <button class="box-btn" data-action="toggle-task" data-id="${x.id}" aria-pressed="${!!x.data.done}" aria-label="${esc(x.data.title)}: ${tr(x.data.done ? 'mark as not done' : 'mark as done')}"><span class="box" aria-hidden="true"></span></button>
    <button class="task-main" data-action="edit-task" data-id="${x.id}">
      <span class="label">${esc(x.data.title)}</span>
      <span class="meta">${p ? `<span class="chip">${esc(p.data.name)}</span>` : ''}${attCount(x.data.attachments)}${x.data.due ? `<span class="${over ? 'late' : 'muted'}">${over ? tr('Overdue, ') : ''}${x.data.due === t ? tr('today') : fmtShort(x.data.due)}</span>` : ''}</span>
    </button></li>`;
}

export function viewTasks() {
  const t = today(), all = list('task');
  const tabs = {
    today: { label: tr('Today'), items: all.filter(x => !x.data.done && x.data.due && x.data.due <= t) },
    upcoming: { label: tr('Upcoming'), items: all.filter(x => !x.data.done && x.data.due && x.data.due > t) },
    someday: { label: tr('No date'), items: all.filter(x => !x.data.done && !x.data.due) },
    done: { label: tr('Done'), items: all.filter(x => x.data.done) },
  };
  const cur = tabs[S.taskTab];
  const items = cur.items.sort((a, b) => S.taskTab === 'done' ? (b.updated_at || '').localeCompare(a.updated_at || '') : (a.data.due || '').localeCompare(b.data.due || ''));
  const projects = list('project');
  return `
  <header class="page-head"><h1>${tr("Tasks")}</h1></header>
  <form class="quick-add" data-form="quick-task">
    <label class="sr" for="qt">${tr("New task")}</label>
    <input id="qt" name="title" placeholder="${tr("Add a task…")}" autocomplete="off" required>
    <input name="due" type="date" value="${S.taskTab === 'today' ? t : ''}" aria-label="${tr("Due date")}">
    <button class="btn primary">${tr("Add")}</button>
  </form>
  <div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button role="tab" aria-selected="${k === S.taskTab}" data-action="task-tab" data-tab="${k}">${v.label}<span class="count">${v.items.length}</span></button>`).join('')}</div>
  <section class="panel">
    ${items.length ? `<ul class="task-list">${items.map(taskRow).join('')}</ul>` : `<p class="note">${tr(S.taskTab === 'done' ? 'Finished tasks show up here.' : 'Nothing here. Add a task above.')}</p>`}
  </section>
  <div class="panel-head section-head"><h2>${tr("Projects")}</h2><button class="btn small" data-action="new-project">${tr("Add project")}</button></div>
  ${projects.length ? `<div class="project-grid">${projects.map(p => {
    const ts = all.filter(x => x.data.projectId === p.id), done = ts.filter(x => x.data.done).length;
    const left = p.data.deadline ? Math.ceil((parse(p.data.deadline) - parse(t)) / 864e5) : null;
    return `<button class="panel project" data-action="edit-project" data-id="${p.id}">
      <span class="pname">${esc(p.data.name)}</span>
      <span class="muted">${tr('{done} of {total} tasks done', { done, total: ts.length })}</span>${attCount(p.data.attachments)}
      ${meter(ts.length ? done / ts.length : 0, p.data.name)}
      ${left !== null ? `<span class="${left < 0 ? 'late' : 'muted'}">${left < 0 ? tr('{n} days late', { n: -left }) : left === 0 ? tr('Due today') : tr('{n} days to go', { n: left })}</span>` : ''}
    </button>`;
  }).join('')}</div>` : `<section class="panel"><p class="note">${tr("Group tasks into projects, like an exam, a trip or a side project.")}</p></section>`}`;
}
