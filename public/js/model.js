// public/js/model.js

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  renderModel();
};

function buildPage() {
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header">'
    + '<div class="page-title">Model <span>Question Papers</span></div>'
    + '</div>'
    + '<div class="card" style="margin-bottom:18px">'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>Paper Title</label><input type="text" id="m-title" placeholder="e.g. Network Security Model Paper"/></div>'
    + '<div class="form-group"><label>Subject</label><input type="text" id="m-sub" placeholder="e.g. CNS"/></div>'
    + '<div class="form-group"><label>Prepared By</label><input type="text" id="m-by" placeholder="e.g. Prof. Sharma"/></div>'
    + '<div class="form-group"><label>Total Marks</label><input type="number" id="m-marks" placeholder="e.g. 100"/></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>PDF Link (optional)</label><input type="url" id="m-link" placeholder="https://..."/></div>'
    + '<div class="form-group" style="flex:3"><label>Description</label><input type="text" id="m-desc" placeholder="Topics covered, sections, etc."/></div>'
    + '</div>'
    + '<button class="btn-primary" onclick="saveModel()">+ Add Model Paper</button>'
    + '</div>'
    + '<div class="search-bar"><span>🔍</span><input type="text" id="model-search" placeholder="Search papers..." oninput="renderModel()"/></div>'
    + '<div id="model-list"></div>';
}

function saveModel() {
  var title = document.getElementById('m-title').value.trim();
  var sub   = document.getElementById('m-sub').value.trim();
  var by    = document.getElementById('m-by').value.trim();
  var marks = document.getElementById('m-marks').value;
  var link  = document.getElementById('m-link').value.trim();
  var desc  = document.getElementById('m-desc').value.trim();

  if (!title) { showToast('Enter paper title.'); return; }

  if (Auth.isGuest()) {
    var list = GuestDB.get('model_papers');
    list.push({ id: Date.now(), title: title, subject: sub, prepared_by: by, marks: marks, link: link, description: desc });
    GuestDB.set('model_papers', list);
    clearForm(); renderModel(); showToast('Model paper added!'); return;
  }

  api.post('/api/model-papers', { title: title, subject: sub, prepared_by: by, marks: marks, link: link, description: desc })
    .then(function (r) {
      if (!r || r.error) { showToast(r ? r.error : 'Error'); return; }
      clearForm(); renderModel(); showToast('Model paper added!');
    });
}

function clearForm() {
  ['m-title','m-sub','m-by','m-marks','m-link','m-desc'].forEach(function (id) { document.getElementById(id).value = ''; });
}

function deleteModel(id) {
  if (Auth.isGuest()) {
    GuestDB.set('model_papers', GuestDB.get('model_papers').filter(function (x) { return x.id !== id; }));
    renderModel(); return;
  }
  api.delete('/api/model-papers/' + id).then(renderModel);
}

function renderModel() {
  var q = (document.getElementById('model-search') ? document.getElementById('model-search').value : '').toLowerCase();

  if (Auth.isGuest()) {
    var list = GuestDB.get('model_papers').filter(function (m) {
      return (m.title + m.subject + m.prepared_by).toLowerCase().includes(q);
    }).reverse();
    renderList(list); return;
  }

  api.get('/api/model-papers' + (q ? '?search=' + encodeURIComponent(q) : ''))
    .then(function (r) { renderList(Array.isArray(r) ? r : []); });
}

function renderList(list) {
  var el = document.getElementById('model-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h3>No model papers yet</h3><p>Add model question papers above.</p></div>';
    return;
  }
  el.innerHTML = list.map(function (m) {
    return '<div class="paper-card">'
      + '<div class="paper-icon">📋</div>'
      + '<div class="paper-info">'
      + '<h3>' + m.title + '</h3>'
      + '<p>' + (m.subject || '—') + (m.prepared_by ? ' &nbsp;|&nbsp; By ' + m.prepared_by : '') + (m.marks ? ' &nbsp;|&nbsp; ' + m.marks + ' marks' : '') + '</p>'
      + (m.description ? '<p style="font-size:11px;margin-top:3px">' + m.description.substring(0, 80) + '</p>' : '')
      + '</div>'
      + '<div class="paper-actions">'
      + (m.link ? '<a href="' + m.link + '" target="_blank" class="btn-open">🔗 Open</a>' : '')
      + '<button class="btn-danger" onclick="deleteModel(' + m.id + ')">🗑️</button>'
      + '</div></div>';
  }).join('');
}
