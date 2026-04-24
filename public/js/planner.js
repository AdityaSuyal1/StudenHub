// public/js/planner.js

var DAYS_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  renderPlanner();
};

function buildPage() {
  var todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header">'
    + '<div class="page-title">Study <span>Planner</span></div>'
    + '<button class="btn-primary" onclick="openForm()">+ Add Session</button>'
    + '</div>'
    + '<div id="add-form" class="card" style="display:none;margin-bottom:18px">'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>Subject</label><input type="text" id="pl-subject" placeholder="e.g. Algorithms"/></div>'
    + '<div class="form-group"><label>Day</label><select id="pl-day">'
    + DAYS_ORDER.map(function(d){ return '<option'+(d===todayName?' selected':'')+'>'+d+'</option>'; }).join('')
    + '</select></div>'
    + '<div class="form-group"><label>Time</label><input type="time" id="pl-time"/></div>'
    + '<div class="form-group"><label>Duration (hrs)</label><input type="number" id="pl-dur" min="0.5" max="8" step="0.5" value="1"/></div>'
    + '<div class="form-group"><label>Colour</label><select id="pl-color"><option value="">Default</option><option value="green">Green</option><option value="yellow">Yellow</option></select></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn-primary" onclick="savePlanner()">Save</button>'
    + '<button class="btn-outline" onclick="closeForm()">Cancel</button>'
    + '</div></div>'
    + '<div class="planner-grid" id="planner-grid"></div>'
    + '<div class="card"><h3 style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">📋 All Sessions</h3>'
    + '<table class="sessions-table"><thead><tr><th>Subject</th><th>Day</th><th>Time</th><th>Duration</th><th></th></tr></thead>'
    + '<tbody id="sessions-body"></tbody></table></div>';
}

function openForm()  { document.getElementById('add-form').style.display = 'block'; }
function closeForm() { document.getElementById('add-form').style.display = 'none'; }

function savePlanner() {
  var subject  = document.getElementById('pl-subject').value.trim();
  var day      = document.getElementById('pl-day').value;
  var time     = document.getElementById('pl-time').value;
  var duration = parseFloat(document.getElementById('pl-dur').value) || 1;
  var color    = document.getElementById('pl-color').value;

  if (!subject) { showToast('Enter subject name.'); return; }

  if (Auth.isGuest()) {
    var list = GuestDB.get('planner');
    list.push({ id: Date.now(), subject: subject, day: day, time: time, duration: duration, color: color });
    GuestDB.set('planner', list);
    document.getElementById('pl-subject').value = '';
    closeForm(); renderPlanner(); showToast('Session added!'); return;
  }

  api.post('/api/planner', { subject: subject, day: day, time: time, duration: duration, color: color })
    .then(function (r) {
      if (!r || r.error) { showToast(r ? r.error : 'Error'); return; }
      document.getElementById('pl-subject').value = '';
      closeForm(); renderPlanner(); showToast('Session added!');
    });
}

function deleteSession(id) {
  if (Auth.isGuest()) {
    GuestDB.set('planner', GuestDB.get('planner').filter(function (s) { return s.id !== id; }));
    renderPlanner(); return;
  }
  api.delete('/api/planner/' + id).then(renderPlanner);
}

function renderPlanner() {
  if (Auth.isGuest()) { buildPlannerView(GuestDB.get('planner')); return; }
  api.get('/api/planner').then(function (r) { buildPlannerView(Array.isArray(r) ? r : []); });
}

function buildPlannerView(sessions) {
  var todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  var grid = document.getElementById('planner-grid');
  var tbody = document.getElementById('sessions-body');
  if (!grid || !tbody) return;

  // Weekly grid
  grid.innerHTML = DAYS_ORDER.map(function (day) {
    var daySessions = sessions.filter(function (s) { return s.day === day; });
    return '<div class="planner-day' + (day === todayName ? ' today' : '') + '">'
      + '<div class="planner-day-name">' + day.substring(0, 3) + '</div>'
      + daySessions.map(function (s) {
          return '<div class="planner-event ' + (s.color || '') + '" onclick="deleteSession(' + s.id + ')" title="Click to remove">'
            + s.subject + (s.time ? '<br>' + s.time : '') + ' (' + s.duration + 'h)</div>';
        }).join('')
      + '</div>';
  }).join('');

  // Table list
  var sorted = sessions.slice().sort(function (a, b) {
    return DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
  });

  tbody.innerHTML = sorted.length
    ? sorted.map(function (s) {
        return '<tr><td>' + s.subject + '</td><td>' + s.day + '</td><td>' + (s.time || '—') + '</td><td>' + s.duration + 'h</td>'
          + '<td><button class="btn-danger" onclick="deleteSession(' + s.id + ')">🗑️</button></td></tr>';
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">No sessions yet.</td></tr>';
}
