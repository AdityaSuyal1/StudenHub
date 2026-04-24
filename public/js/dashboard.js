// public/js/dashboard.js

window.onload = function() {
  Auth.requireAuth();
  initTopbar();

  var h = new Date().getHours();
  var user = Auth.getUser();
  var name = Auth.isGuest() ? 'Guest' : (user ? user.name.split(' ')[0] : 'Student');
  var time = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  document.getElementById('greeting').textContent = 'Good ' + time + ', ' + name + '! 👋';

  if (Auth.isGuest()) { loadGuestDashboard(); return; }
  loadDashboard();
};

function loadDashboard() {
  api.get('/api/dashboard').then(function(data) {
    if (!data) return;

    // Stats
    document.getElementById('s-notes').textContent   = data.counts.notes;
    document.getElementById('s-pending').textContent = data.counts.pending_assignments;
    document.getElementById('s-cards').textContent   = data.counts.flashcards;
    document.getElementById('s-pomo').textContent    = data.counts.pomodoros_total;

    // Upcoming assignments
    var aEl = document.getElementById('dash-assignments');
    if (!data.upcoming_assignments.length) {
      aEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No pending assignments 🎉</p>';
    } else {
      aEl.innerHTML = data.upcoming_assignments.map(function(a) {
        var bc = a.priority === 'High' ? 'badge-red' : a.priority === 'Medium' ? 'badge-yellow' : 'badge-green';
        return '<div class="mini-item"><span>📌</span><span>' + a.title + '</span>'
          + '<span class="badge ' + bc + ' mini-item-right">' + (a.due_date || 'No date') + '</span></div>';
      }).join('');
    }

    // Subject progress
    var pEl = document.getElementById('dash-progress');
    if (!data.subject_progress.length) {
      pEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Add grades to see progress</p>';
    } else {
      pEl.innerHTML = data.subject_progress.slice(0, 4).map(function(s) {
        return '<div style="margin-bottom:12px">'
          + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">'
          + '<span>' + s.name + '</span><span>' + s.percentage + '%</span></div>'
          + '<div class="progress-wrap"><div class="progress-bar" style="width:' + s.percentage + '%"></div></div></div>';
      }).join('');
    }

    // Recent notes
    var nEl = document.getElementById('dash-notes');
    if (!data.recent_notes.length) {
      nEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No notes yet</p>';
    } else {
      nEl.innerHTML = data.recent_notes.map(function(n) {
        return '<div class="mini-item"><span>📝</span><span>' + (n.title || 'Untitled') + '</span>'
          + (n.subject ? '<span class="badge badge-purple mini-item-right">' + n.subject + '</span>' : '') + '</div>';
      }).join('');
    }

    // Streak
    document.getElementById('dash-streak').innerHTML =
      '<div class="streak-num">🔥 ' + data.streak + ' Day' + (data.streak !== 1 ? 's' : '') + '</div>'
      + '<div class="streak-sub">Complete at least 1 Pomodoro daily to keep your streak!</div>';
  });
}

function loadGuestDashboard() {
  var notes   = GuestDB.get('notes');
  var assigns = GuestDB.get('assignments');
  var cards   = GuestDB.get('flashcards');
  var pomo    = GuestDB.getObj('pomo');

  document.getElementById('s-notes').textContent   = notes.length;
  document.getElementById('s-pending').textContent = assigns.filter(function(a) { return !a.done; }).length;
  document.getElementById('s-cards').textContent   = cards.length;
  document.getElementById('s-pomo').textContent    = pomo.total || 0;

  var pending = assigns.filter(function(a) { return !a.done; }).slice(0, 4);
  var aEl = document.getElementById('dash-assignments');
  aEl.innerHTML = pending.length
    ? pending.map(function(a) {
        return '<div class="mini-item"><span>📌</span><span>' + a.title + '</span>'
          + '<span class="badge badge-yellow mini-item-right">' + (a.due_date || 'No date') + '</span></div>';
      }).join('')
    : '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No pending assignments</p>';

  document.getElementById('dash-progress').innerHTML =
    '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Add grades to see progress</p>';

  var nEl = document.getElementById('dash-notes');
  nEl.innerHTML = notes.length
    ? notes.slice(-3).reverse().map(function(n) {
        return '<div class="mini-item"><span>📝</span><span>' + (n.title || 'Untitled') + '</span></div>';
      }).join('')
    : '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No notes yet</p>';

  document.getElementById('dash-streak').innerHTML =
    '<div class="streak-num">🔥 ' + (pomo.streak || 0) + ' Day' + ((pomo.streak || 0) !== 1 ? 's' : '') + '</div>'
    + '<div class="streak-sub">Complete at least 1 Pomodoro daily!</div>';
}
