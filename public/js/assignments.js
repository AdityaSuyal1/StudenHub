// public/js/assignments.js

var currentFilter = 'all';

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  renderAssignments();
};

function buildPage() {
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header">'
    + '<div class="page-title">Assignment <span>Tracker</span></div>'
    + '</div>'
    + '<div class="card" style="margin-bottom:18px">'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>Title</label><input type="text" id="a-title" placeholder="e.g. DBMS Lab Report"/></div>'
    + '<div class="form-group"><label>Subject</label><input type="text" id="a-subject" placeholder="e.g. DBMS"/></div>'
    + '<div class="form-group"><label>Due Date</label><input type="date" id="a-due"/></div>'
    + '<div class="form-group"><label>Priority</label><select id="a-priority"><option value="High">🔴 High</option><option value="Medium" selected>🟡 Medium</option><option value="Low">🟢 Low</option></select></div>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:14px"><label>Notes (optional)</label><textarea id="a-notes" rows="2" placeholder="Extra details..."></textarea></div>'
    + '<button class="btn-primary" id="save-btn" onclick="saveAssignment()">+ Add Assignment</button>'
    + '</div>'
    + '<div class="filter-tabs">'
    + '<button class="filter-tab active" onclick="setFilter(\'all\',this)">All</button>'
    + '<button class="filter-tab" onclick="setFilter(\'pending\',this)">⏳ Pending</button>'
    + '<button class="filter-tab" onclick="setFilter(\'done\',this)">✅ Done</button>'
    + '<button class="filter-tab" onclick="setFilter(\'high\',this)">🔴 High Priority</button>'
    + '</div>'
    + '<div id="assign-list"></div>';
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderAssignments();
}

function saveAssignment() {
  var titleEl   = document.getElementById('a-title');
  var title     = titleEl.value.trim();
  var subject   = document.getElementById('a-subject').value.trim();
  var due       = document.getElementById('a-due').value;
  var priority  = document.getElementById('a-priority').value;
  var notes     = document.getElementById('a-notes').value.trim();

  if (!title) { showToast('Enter assignment title.'); titleEl.focus(); return; }

  // ── Guest mode ──────────────────────────────────────────────
  if (Auth.isGuest()) {
    var list = GuestDB.get('assignments');
    list.push({ id: Date.now(), title: title, subject: subject, due_date: due, priority: priority, notes: notes, done: false });
    GuestDB.set('assignments', list);
    clearForm();
    renderAssignments();
    showToast('Assignment added!');
    return;
  }

  // ── Logged-in: POST to backend ──────────────────────────────
  var btn = document.getElementById('save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  api.post('/api/assignments', {
    title:    title,
    subject:  subject,
    due_date: due,
    priority: priority,
    notes:    notes
  }).then(function (r) {
    // ✅ apiCall() already shows a toast on network error and returns null
    if (!r) return;
    if (r.error) { showToast(r.error); return; }
    clearForm();
    renderAssignments();
    showToast('Assignment added!');
  }).finally(function () {
    // ✅ always re-enable the button whether it succeeded or failed
    if (btn) { btn.disabled = false; btn.textContent = '+ Add Assignment'; }
  });
}

function clearForm() {
  ['a-title', 'a-subject', 'a-due', 'a-notes'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function toggleDone(id) {
  if (Auth.isGuest()) {
    var list = GuestDB.get('assignments');
    var item = list.find(function (a) { return a.id === id; });
    if (item) item.done = !item.done;
    GuestDB.set('assignments', list);
    renderAssignments();
    return;
  }
  api.patch('/api/assignments/' + id + '/toggle').then(function(r) {
    if (r) renderAssignments();
  });
}

function deleteAssignment(id) {
  if (Auth.isGuest()) {
    GuestDB.set('assignments', GuestDB.get('assignments').filter(function (a) { return a.id !== id; }));
    renderAssignments();
    return;
  }
  api.delete('/api/assignments/' + id).then(function(r) {
    if (r) renderAssignments();
  });
}

function renderAssignments() {
  if (Auth.isGuest()) {
    var list = GuestDB.get('assignments');
    if (currentFilter === 'pending') list = list.filter(function (a) { return !a.done; });
    else if (currentFilter === 'done') list = list.filter(function (a) { return a.done; });
    else if (currentFilter === 'high') list = list.filter(function (a) { return a.priority === 'High'; });
    renderList(list.map(function (a) {
      return { id: a.id, title: a.title, subject: a.subject, due_date: a.due_date, priority: a.priority, notes: a.notes, done: a.done ? 1 : 0 };
    }));
    return;
  }

  var url = '/api/assignments?filter=' + currentFilter;
  api.get(url).then(function (r) {
    // ✅ null means network error (toast already shown), just don't crash
    if (r === null) return;
    renderList(Array.isArray(r) ? r : []);
  });
}

function renderList(list) {
  var el = document.getElementById('assign-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">✅</div><h3>Nothing here!</h3><p>All clear.</p></div>';
    return;
  }
  el.innerHTML = list.map(function (a) {
    var pc = a.priority === 'High' ? 'badge-red' : a.priority === 'Medium' ? 'badge-yellow' : 'badge-green';
    return '<div class="assign-item' + (a.done ? ' done' : '') + '">'
      + '<button class="check-btn' + (a.done ? ' checked' : '') + '" onclick="toggleDone(' + a.id + ')">' + (a.done ? '✓' : '') + '</button>'
      + '<div class="assign-info">'
      + '<div class="assign-title" style="' + (a.done ? 'text-decoration:line-through' : '') + '">' + escHtml(a.title) + '</div>'
      + '<div class="assign-meta">'
      + (a.subject  ? '📚 ' + escHtml(a.subject)  + ' &nbsp;|&nbsp; ' : '')
      + (a.due_date ? '📅 ' + a.due_date + ' &nbsp;|&nbsp; ' : '')
      + '<span class="badge ' + pc + '">' + a.priority + '</span>'
      + (a.notes ? '<br>💬 ' + escHtml(a.notes) : '')
      + '</div></div>'
      + '<button class="btn-danger" onclick="deleteAssignment(' + a.id + ')">🗑️</button>'
      + '</div>';
  }).join('');
}

// ✅ Prevent XSS when rendering user input into innerHTML
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
