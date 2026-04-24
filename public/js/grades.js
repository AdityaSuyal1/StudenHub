// public/js/grades.js

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  renderGrades();
};

function buildPage() {
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header">'
    + '<div class="page-title">Grade <span>Tracker</span></div>'
    + '</div>'
    + '<div class="gpa-card">'
    + '<div class="gpa-number" id="gpa-display">--</div>'
    + '<div class="gpa-label"><h3>Overall Percentage</h3><p id="gpa-desc">Add your marks to see your percentage</p></div>'
    + '</div>'
    + '<div class="card" style="margin-bottom:18px">'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>Subject</label><input type="text" id="g-sub" placeholder="e.g. Mathematics"/></div>'
    + '<div class="form-group"><label>Exam Type</label><select id="g-exam"><option>Mid Term</option><option>End Term</option><option>Quiz</option><option>Assignment</option><option>Lab</option><option>Practical</option></select></div>'
    + '<div class="form-group"><label>Marks Obtained</label><input type="number" id="g-marks" placeholder="e.g. 85" min="0"/></div>'
    + '<div class="form-group"><label>Total Marks</label><input type="number" id="g-total" placeholder="e.g. 100" min="1"/></div>'
    + '</div>'
    + '<button class="btn-primary" onclick="saveGrade()">+ Add Grade</button>'
    + '</div>'
    + '<table class="grades-table">'
    + '<thead><tr><th>Subject</th><th>Exam</th><th>Marks</th><th>Total</th><th>%</th><th>Grade</th><th></th></tr></thead>'
    + '<tbody id="grades-body"></tbody>'
    + '</table>';
}

function saveGrade() {
  var subject = document.getElementById('g-sub').value.trim();
  var exam    = document.getElementById('g-exam').value;
  var marks   = parseFloat(document.getElementById('g-marks').value);
  var total   = parseFloat(document.getElementById('g-total').value);

  if (!subject)          { showToast('Enter subject name.'); return; }
  if (isNaN(marks))      { showToast('Enter marks obtained.'); return; }
  if (isNaN(total) || total <= 0) { showToast('Enter valid total marks.'); return; }
  if (marks > total)     { showToast('Marks cannot exceed total.'); return; }

  if (Auth.isGuest()) {
    var list = GuestDB.get('grades');
    list.push({ id: Date.now(), subject: subject, exam_type: exam, marks: marks, max_marks: total, created_at: new Date().toLocaleDateString() });
    GuestDB.set('grades', list);
    clearForm(); renderGrades(); showToast('Grade added!'); return;
  }

  api.post('/api/grades', { subject: subject, exam_type: exam, marks: marks, max_marks: total })
    .then(function (r) {
      if (!r || r.error) { showToast(r ? r.error : 'Error'); return; }
      clearForm(); renderGrades(); showToast('Grade added!');
    });
}

function clearForm() {
  ['g-sub','g-marks','g-total'].forEach(function (id) { document.getElementById(id).value = ''; });
}

function deleteGrade(id) {
  if (Auth.isGuest()) {
    GuestDB.set('grades', GuestDB.get('grades').filter(function (g) { return g.id !== id; }));
    renderGrades(); return;
  }
  api.delete('/api/grades/' + id).then(renderGrades);
}

function renderGrades() {
  if (Auth.isGuest()) {
    var list = GuestDB.get('grades');
    renderTable(list, computeSummary(list)); return;
  }
  api.get('/api/grades').then(function (r) {
    if (!r) return;
    renderTable(r.grades || [], { percentage: r.overall_percentage, total_exams: r.total_exams });
  });
}

function computeSummary(grades) {
  if (!grades.length) return { percentage: null, total_exams: 0 };
  var tm = grades.reduce(function (s, g) { return s + g.marks; }, 0);
  var tmax = grades.reduce(function (s, g) { return s + g.max_marks; }, 0);
  return { percentage: Math.round((tm / tmax) * 100), total_exams: grades.length };
}

function renderTable(grades, summary) {
  var tbody = document.getElementById('grades-body');

  if (!grades.length) {
    document.getElementById('gpa-display').textContent = '--';
    document.getElementById('gpa-desc').textContent    = 'Add your marks to see your percentage';
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No grades added yet.</td></tr>';
    return;
  }

  var pct = summary.percentage;
  document.getElementById('gpa-display').textContent = pct + '%';
  document.getElementById('gpa-desc').textContent    = 'Overall across ' + summary.total_exams + ' exam' + (summary.total_exams !== 1 ? 's' : '');

  tbody.innerHTML = grades.map(function (g) {
    var p      = Math.round((g.marks / g.max_marks) * 100);
    var letter = getGradeLetter(p);
    var cls    = getGradeClass(letter);
    return '<tr>'
      + '<td>' + g.subject + '</td>'
      + '<td>' + (g.exam_type || '—') + '</td>'
      + '<td>' + g.marks + '</td>'
      + '<td>' + g.max_marks + '</td>'
      + '<td>' + p + '%</td>'
      + '<td><span class="grade-pill ' + cls + '">' + letter + '</span></td>'
      + '<td><button class="btn-danger" onclick="deleteGrade(' + g.id + ')">🗑️</button></td>'
      + '</tr>';
  }).join('');
}
