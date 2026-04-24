// public/js/notes.js

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  renderNotes();
};

function saveNote() {
  var title   = document.getElementById('n-title').value.trim();
  var body    = document.getElementById('n-body').value.trim();
  var subject = document.getElementById('n-subject').value;
  var color   = document.getElementById('n-color').value;

  if (!title && !body) { showToast('Please write something first.'); return; }

  if (Auth.isGuest()) {
    var list = GuestDB.get('notes');
    list.push({ id: Date.now(), title: title, body: body, subject: subject, color: color, created_at: new Date().toLocaleDateString('en-IN') });
    GuestDB.set('notes', list);
    clearForm(); renderNotes(); showToast('Note saved!');
    return;
  }

  api.post('/api/notes', { title: title, body: body, subject: subject, color: color })
    .then(function (r) {
      if (!r || r.error) { showToast(r ? r.error : 'Error'); return; }
      clearForm(); renderNotes(); showToast('Note saved!');
    });
}

function clearForm() {
  document.getElementById('n-title').value   = '';
  document.getElementById('n-body').value    = '';
  document.getElementById('n-subject').value = '';
}

function deleteNote(id) {
  if (Auth.isGuest()) {
    GuestDB.set('notes', GuestDB.get('notes').filter(function (n) { return n.id !== id; }));
    renderNotes(); return;
  }
  api.delete('/api/notes/' + id).then(renderNotes);
}

function renderNotes() {
  var q = (document.getElementById('notes-search') ? document.getElementById('notes-search').value : '').toLowerCase();

  if (Auth.isGuest()) {
    var list = GuestDB.get('notes').filter(function (n) {
      return (n.title + n.body + n.subject).toLowerCase().includes(q);
    }).reverse();
    renderList(list); return;
  }

  var url = '/api/notes' + (q ? '?search=' + encodeURIComponent(q) : '');
  api.get(url).then(function (list) { renderList(Array.isArray(list) ? list : []); });
}

function renderList(notes) {
  var el = document.getElementById('notes-list');
  if (!notes.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📝</div><h3>No notes yet</h3><p>Write your first note above!</p></div>';
    return;
  }
  el.innerHTML = notes.map(function (n) {
    return '<div class="card note-color-' + (n.color || 'purple') + '">'
      + '<div class="card-header">'
      + '<div><div class="card-title">' + (n.title || 'Untitled') + '</div>'
      + '<div class="card-meta">' + (n.created_at || '') + (n.subject ? ' &nbsp;|&nbsp; ' + n.subject : '') + '</div></div>'
      + '<button class="btn-danger" onclick="deleteNote(' + n.id + ')">🗑️</button></div>'
      + '<div class="card-body" style="margin-top:8px">' + (n.body || '') + '</div>'
      + (n.subject ? '<div style="margin-top:10px"><span class="badge badge-purple">' + n.subject + '</span></div>' : '')
      + '</div>';
  }).join('');
}
