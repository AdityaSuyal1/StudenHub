// public/js/pyq.js

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  renderPYQ();
};

function buildPage() {
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header">'
    + '<div class="page-title">Previous Year <span>Questions</span></div>'
    + '</div>'
    + '<div class="card" style="margin-bottom:18px">'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>Subject</label><input type="text" id="p-sub" placeholder="e.g. Operating Systems"/></div>'
    + '<div class="form-group"><label>Year</label><input type="number" id="p-year" placeholder="e.g. 2023" min="2000" max="2099"/></div>'
    + '<div class="form-group"><label>Semester</label><select id="p-sem"><option>Semester 1</option><option>Semester 2</option><option>Semester 3</option><option>Semester 4</option><option>Semester 5</option><option>Semester 6</option><option>Semester 7</option><option>Semester 8</option><option>Annual</option></select></div>'
    + '<div class="form-group" style="flex:2"><label>PDF Link (optional)</label><input type="url" id="p-link" placeholder="https://drive.google.com/..."/></div>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:14px"><label>Notes (topics, difficulty…)</label><textarea id="p-notes" rows="2" placeholder="e.g. Units 3 and 4 covered, 2 marks questions..."></textarea></div>'
    + '<button class="btn-primary" onclick="savePYQ()">+ Add PYQ</button>'
    + '</div>'
    + '<div class="search-bar"><span>🔍</span><input type="text" id="pyq-search" placeholder="Search by subject or year..." oninput="renderPYQ()"/></div>'
    + '<div id="pyq-list"></div>';
}

function savePYQ() {
  var sub   = document.getElementById('p-sub').value.trim();
  var year  = document.getElementById('p-year').value;
  var sem   = document.getElementById('p-sem').value;
  var link  = document.getElementById('p-link').value.trim();
  var notes = document.getElementById('p-notes').value.trim();

  if (!sub) { showToast('Enter subject name.'); return; }

  if (Auth.isGuest()) {
    var list = GuestDB.get('pyq');
    list.push({ id: Date.now(), subject: sub, year: year, semester: sem, link: link, notes: notes, created_at: new Date().toLocaleDateString() });
    GuestDB.set('pyq', list);
    clearForm(); renderPYQ(); showToast('PYQ added!'); return;
  }

  api.post('/api/pyq', { subject: sub, year: year, semester: sem, link: link, notes: notes })
    .then(function (r) {
      if (!r || r.error) { showToast(r ? r.error : 'Error'); return; }
      clearForm(); renderPYQ(); showToast('PYQ added!');
    });
}

function clearForm() {
  ['p-sub','p-year','p-link','p-notes'].forEach(function (id) { document.getElementById(id).value = ''; });
}

function deletePYQ(id) {
  if (Auth.isGuest()) {
    GuestDB.set('pyq', GuestDB.get('pyq').filter(function (x) { return x.id !== id; }));
    renderPYQ(); return;
  }
  api.delete('/api/pyq/' + id).then(renderPYQ);
}

function renderPYQ() {
  var q = (document.getElementById('pyq-search') ? document.getElementById('pyq-search').value : '').toLowerCase();

  if (Auth.isGuest()) {
    var list = GuestDB.get('pyq').filter(function (p) {
      return (p.subject + p.year + p.semester).toLowerCase().includes(q);
    }).reverse();
    renderList(list); return;
  }

  api.get('/api/pyq' + (q ? '?search=' + encodeURIComponent(q) : ''))
    .then(function (r) { renderList(Array.isArray(r) ? r : []); });
}

function renderList(list) {
  var el = document.getElementById('pyq-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📄</div><h3>No PYQs yet</h3><p>Add previous year question papers above.</p></div>';
    return;
  }
  el.innerHTML = list.map(function (p) {
    return '<div class="paper-card">'
      + '<div class="paper-icon">📄</div>'
      + '<div class="paper-info">'
      + '<h3>' + p.subject + ' — ' + (p.year || 'N/A') + '</h3>'
      + '<p>' + (p.semester || '') + (p.notes ? ' &nbsp;|&nbsp; ' + p.notes.substring(0, 60) : '') + '</p>'
      + '</div>'
      + '<div class="paper-actions">'
      + (p.link ? '<a href="' + p.link + '" target="_blank" class="btn-open">🔗 Open</a>' : '')
      + '<button class="btn-danger" onclick="deletePYQ(' + p.id + ')">🗑️</button>'
      + '</div></div>';
  }).join('');
}
