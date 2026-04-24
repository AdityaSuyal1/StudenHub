// public/js/analytics.js
// Data Analysis + Bar charts for Assignments, Pomodoro, Notes, PYQs

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  setActiveNav('analytics');

  if (Auth.isGuest()) {
    loadGuestAnalytics();
  } else {
    loadAnalytics();
  }
};

// ── Chart.js global defaults (dark theme friendly) ────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size   = 12;

var PALETTE = [
  '#8b5cf6', '#a78bfa', '#6366f1', '#818cf8',
  '#34d399', '#10b981', '#f59e0b', '#fbbf24',
  '#ef4444', '#f87171', '#06b6d4', '#22d3ee'
];

var PRIORITY_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#34d399' };

function mkBar(id, labels, data, colors, opts) {
  var ctx = document.getElementById(id);
  if (!ctx) return;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: opts && opts.label ? opts.label : 'Count',
        data: data,
        backgroundColor: colors || PALETTE,
        borderRadius: 7,
        borderSkipped: false,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e1e2e',
          borderColor: 'rgba(139,92,246,0.4)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 30,
            callback: function(val, i) {
              var lbl = this.getLabelForValue(val);
              return lbl && lbl.length > 14 ? lbl.substring(0, 13) + '…' : lbl;
            }
          }
        }
      }
    }
  });
}

function mkHorizontalBar(id, labels, data, colors) {
  var ctx = document.getElementById(id);
  if (!ctx) return;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors || PALETTE,
        borderRadius: 7,
        borderSkipped: false,
        borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e1e2e',
          borderColor: 'rgba(139,92,246,0.4)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8'
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
}

function mkDoughnut(id, labels, data, colors) {
  var ctx = document.getElementById(id);
  if (!ctx) return;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors || PALETTE,
        borderWidth: 2,
        borderColor: '#1e1e2e',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 12,
            boxWidth: 12,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#1e1e2e',
          borderColor: 'rgba(139,92,246,0.4)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8'
        }
      }
    }
  });
}

// ── Main loader (authenticated users) ────────────────────────
function loadAnalytics() {
  api.get('/api/analytics').then(function(d) {
    if (!d || d.error) { showToast('Could not load analytics.'); return; }
    renderAll(d);
  });
}

// ── Render everything ─────────────────────────────────────────
function renderAll(d) {
  // Update summary stats
  document.getElementById('an-total-assign').textContent = d.assignments.total || 0;
  var totalNotes = d.notes.by_subject.reduce(function(s,n){return s+Number(n.c);},0)
                 + (d.notes.by_color.reduce(function(s,n){return s+Number(n.c);},0));
  // Use notes total from server if available
  document.getElementById('an-total-notes').textContent  = d.notes.total || totalNotes || 0;
  document.getElementById('an-total-pomo').textContent   = d.pomodoro.total || 0;
  var pyqTotal = d.pyq.by_subject.reduce(function(s,p){return s+Number(p.c);},0);
  document.getElementById('an-total-pyq').textContent    = pyqTotal || 0;

  // ── Assignments: Completion doughnut ────────────────────────
  if (d.assignments.total > 0) {
    mkDoughnut('chart-assign-status',
      ['Done ✅', 'Pending ⏳'],
      [d.assignments.done, d.assignments.pending],
      ['#34d399', '#f59e0b']
    );
  } else {
    emptyChart('chart-assign-status');
  }

  // ── Assignments: By Priority bar ────────────────────────────
  if (d.assignments.by_priority.length) {
    var prLabels = d.assignments.by_priority.map(function(p){return p.priority;});
    var prData   = d.assignments.by_priority.map(function(p){return Number(p.c);});
    var prColors = prLabels.map(function(l){return PRIORITY_COLORS[l] || '#8b5cf6';});
    mkBar('chart-assign-priority', prLabels, prData, prColors);
  } else {
    emptyChart('chart-assign-priority');
  }

  // ── Assignments: By Subject bar ──────────────────────────────
  if (d.assignments.by_subject.length) {
    mkHorizontalBar('chart-assign-subject',
      d.assignments.by_subject.map(function(a){return a.subject || 'Other';}),
      d.assignments.by_subject.map(function(a){return Number(a.c);}),
      PALETTE
    );
  } else {
    emptyChart('chart-assign-subject');
  }

  // ── Notes: By Subject bar ────────────────────────────────────
  if (d.notes.by_subject.length) {
    mkHorizontalBar('chart-notes-subject',
      d.notes.by_subject.map(function(n){return n.subject || 'Other';}),
      d.notes.by_subject.map(function(n){return Number(n.c);}),
      PALETTE
    );
  } else {
    emptyChart('chart-notes-subject');
  }

  // ── Notes: By Color doughnut ─────────────────────────────────
  var COLOR_MAP = {
    purple:'#8b5cf6', green:'#34d399', yellow:'#f59e0b',
    red:'#ef4444', blue:'#3b82f6', pink:'#ec4899', orange:'#f97316'
  };
  if (d.notes.by_color.length) {
    mkDoughnut('chart-notes-color',
      d.notes.by_color.map(function(n){return n.color || 'Default';}),
      d.notes.by_color.map(function(n){return Number(n.c);}),
      d.notes.by_color.map(function(n){return COLOR_MAP[n.color] || '#8b5cf6';})
    );
  } else {
    emptyChart('chart-notes-color');
  }

  // ── Pomodoro summary ─────────────────────────────────────────
  var hours = Math.floor(d.pomodoro.total_mins / 60);
  var mins  = d.pomodoro.total_mins % 60;
  document.getElementById('pomo-summary').innerHTML =
    pomoRow('🍅 Total Sessions', d.pomodoro.total) +
    pomoRow('⏱️ Total Time', hours + 'h ' + mins + 'm') +
    pomoRow('📅 Today', d.pomodoro.today + ' sessions') +
    pomoRow('🔥 Streak', d.pomodoro.streak + ' days');

  // ── Streak display ───────────────────────────────────────────
  document.getElementById('streak-display').innerHTML =
    '<div class="streak-num-big">🔥 ' + d.pomodoro.streak + '</div>' +
    '<div class="streak-label">Day streak</div>' +
    '<div class="streak-today">Today: ' + d.pomodoro.today + ' session' + (d.pomodoro.today !== 1 ? 's' : '') + '</div>';

  // ── PYQ: By Subject bar ──────────────────────────────────────
  if (d.pyq.by_subject.length) {
    mkHorizontalBar('chart-pyq-subject',
      d.pyq.by_subject.map(function(p){return p.subject || 'Other';}),
      d.pyq.by_subject.map(function(p){return Number(p.c);}),
      PALETTE
    );
  } else {
    emptyChart('chart-pyq-subject');
  }

  // ── PYQ: By Year bar ─────────────────────────────────────────
  if (d.pyq.by_year.length) {
    mkBar('chart-pyq-year',
      d.pyq.by_year.map(function(p){return String(p.year);}),
      d.pyq.by_year.map(function(p){return Number(p.c);}),
      PALETTE
    );
  } else {
    emptyChart('chart-pyq-year');
  }

  // ── PYQ: By Semester bar ─────────────────────────────────────
  if (d.pyq.by_semester.length) {
    mkBar('chart-pyq-sem',
      d.pyq.by_semester.map(function(p){return p.semester || 'Other';}),
      d.pyq.by_semester.map(function(p){return Number(p.c);}),
      PALETTE
    );
  } else {
    emptyChart('chart-pyq-sem');
  }

  // ── Grades: Subject Percentage bar ───────────────────────────
  if (d.grades.by_subject.length) {
    var gradeColors = d.grades.by_subject.map(function(g) {
      var pct = g.percentage;
      if (pct >= 80) return '#34d399';
      if (pct >= 60) return '#f59e0b';
      return '#ef4444';
    });
    mkBar('chart-grades',
      d.grades.by_subject.map(function(g){return g.subject;}),
      d.grades.by_subject.map(function(g){return g.percentage;}),
      gradeColors,
      { label: 'Percentage (%)' }
    );
  } else {
    emptyChart('chart-grades');
  }

  // ── Flashcards: Known vs Unknown ─────────────────────────────
  var fTotal = d.flashcards.known + d.flashcards.unknown;
  if (fTotal > 0) {
    mkDoughnut('chart-flashcards',
      ['Known ✅ (' + d.flashcards.known + ')', 'Unknown ❌ (' + d.flashcards.unknown + ')'],
      [d.flashcards.known, d.flashcards.unknown],
      ['#34d399', '#ef4444']
    );
  } else {
    emptyChart('chart-flashcards');
  }
}

function pomoRow(label, val) {
  return '<div class="pomo-row"><span class="lbl">' + label + '</span><span class="val">' + val + '</span></div>';
}

function emptyChart(id) {
  var ctx = document.getElementById(id);
  if (!ctx) return;
  var parent = ctx.parentElement;
  parent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted,#94a3b8);font-size:13px;flex-direction:column;gap:6px"><span style="font-size:24px">📭</span>No data yet</div>';
}

// ── Guest mode: pull from localStorage ───────────────────────
function loadGuestAnalytics() {
  var assigns = GuestDB.get('assignments');
  var notes   = GuestDB.get('notes');
  var pyqs    = GuestDB.get('pyq');
  var pomo    = GuestDB.getObj('pomo');
  var cards   = GuestDB.get('flashcards');
  var grades  = GuestDB.get('grades');

  // Build analytics object matching server format
  var byPriority = {};
  assigns.forEach(function(a) {
    if (!byPriority[a.priority]) byPriority[a.priority] = { priority: a.priority, c: 0, done_count: 0 };
    byPriority[a.priority].c++;
    if (a.done) byPriority[a.priority].done_count++;
  });

  var bySubjectA = {};
  assigns.forEach(function(a) {
    if (!a.subject) return;
    bySubjectA[a.subject] = (bySubjectA[a.subject] || 0) + 1;
  });

  var bySubjectN = {};
  notes.forEach(function(n) {
    if (!n.subject) return;
    bySubjectN[n.subject] = (bySubjectN[n.subject] || 0) + 1;
  });

  var byColorN = {};
  notes.forEach(function(n) {
    var c = n.color || 'purple';
    byColorN[c] = (byColorN[c] || 0) + 1;
  });

  var bySubjectP = {};
  pyqs.forEach(function(p) {
    bySubjectP[p.subject] = (bySubjectP[p.subject] || 0) + 1;
  });

  var byYearP = {};
  pyqs.forEach(function(p) {
    if (p.year) byYearP[p.year] = (byYearP[p.year] || 0) + 1;
  });

  var bySemP = {};
  pyqs.forEach(function(p) {
    if (p.semester) bySemP[p.semester] = (bySemP[p.semester] || 0) + 1;
  });

  var gradesBySubject = {};
  (grades || []).forEach(function(g) {
    if (!gradesBySubject[g.subject]) gradesBySubject[g.subject] = { marks: 0, max: 0 };
    gradesBySubject[g.subject].marks += Number(g.marks);
    gradesBySubject[g.subject].max   += Number(g.max_marks);
  });

  var knownTotal = cards.reduce(function(s,c){return s+(c.known||0);},0);
  var unknownTotal = cards.reduce(function(s,c){return s+(c.unknown||0);},0);

  var today = new Date().toDateString();
  var d = {
    assignments: {
      by_priority: Object.values(byPriority),
      by_subject:  Object.keys(bySubjectA).map(function(k){return{subject:k,c:bySubjectA[k]};}),
      total:       assigns.length,
      done:        assigns.filter(function(a){return a.done;}).length,
      pending:     assigns.filter(function(a){return !a.done;}).length
    },
    notes: {
      by_subject: Object.keys(bySubjectN).map(function(k){return{subject:k,c:bySubjectN[k]};}),
      by_color:   Object.keys(byColorN).map(function(k){return{color:k,c:byColorN[k]};}),
      total:      notes.length
    },
    pyq: {
      by_subject:  Object.keys(bySubjectP).map(function(k){return{subject:k,c:bySubjectP[k]};}),
      by_year:     Object.keys(byYearP).sort().map(function(k){return{year:k,c:byYearP[k]};}),
      by_semester: Object.keys(bySemP).map(function(k){return{semester:k,c:bySemP[k]};})
    },
    pomodoro: {
      total:      pomo.total || 0,
      total_mins: pomo.total_mins || 0,
      streak:     pomo.streak || 0,
      today:      pomo.today_date === today ? (pomo.today_count || 0) : 0
    },
    grades: {
      by_subject: Object.keys(gradesBySubject).map(function(k){
        var g = gradesBySubject[k];
        return { subject: k, percentage: g.max > 0 ? Math.round((g.marks/g.max)*100) : 0 };
      })
    },
    flashcards: { known: knownTotal, unknown: unknownTotal }
  };

  renderAll(d);
}
