// public/js/timetable.js

var DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var TIMES = ['8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'];
var selectedColor = '';

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  renderTimetable();
};

function buildPage() {
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header">'
    + '<div class="page-title">Class <span>Timetable</span></div>'
    + '</div>'
    + '<div class="card" style="margin-bottom:18px">'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>Subject</label><input type="text" id="tt-sub" placeholder="e.g. Mathematics"/></div>'
    + '<div class="form-group"><label>Day</label><select id="tt-day">' + DAYS.map(function(d){return '<option>'+d+'</option>';}).join('') + '</select></div>'
    + '<div class="form-group"><label>Time Slot</label><select id="tt-slot">' + TIMES.map(function(t){return '<option>'+t+'</option>';}).join('') + '</select></div>'
    + '<div class="form-group"><label>Room</label><input type="text" id="tt-room" placeholder="e.g. Room 101"/></div>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:14px"><label>Colour</label>'
    + '<div class="color-row">'
    + '<div class="color-dot purple selected" onclick="pickColor(\'\',this)" title="Purple"></div>'
    + '<div class="color-dot green"  onclick="pickColor(\'green\',this)"  title="Green"></div>'
    + '<div class="color-dot yellow" onclick="pickColor(\'yellow\',this)" title="Yellow"></div>'
    + '<div class="color-dot red"    onclick="pickColor(\'red\',this)"    title="Red"></div>'
    + '<div class="color-dot teal"   onclick="pickColor(\'teal\',this)"   title="Teal"></div>'
    + '</div></div>'
    + '<button class="btn-primary" onclick="saveTT()">+ Add Class</button>'
    + '</div>'
    + '<div class="tt-wrap"><table class="tt-table" id="tt-grid"></table></div>';
}

function pickColor(color, el) {
  selectedColor = color;
  document.querySelectorAll('.color-dot').forEach(function(d) { d.classList.remove('selected'); });
  el.classList.add('selected');
}

function saveTT() {
  var sub  = document.getElementById('tt-sub').value.trim();
  var day  = document.getElementById('tt-day').value;
  var slot = document.getElementById('tt-slot').value;
  var room = document.getElementById('tt-room').value.trim();

  if (!sub) { showToast('Enter subject name.'); return; }

  if (Auth.isGuest()) {
    var list = GuestDB.get('tt');
    list.push({ id: Date.now(), subject: sub, day: day, slot: slot, room: room, color: selectedColor });
    GuestDB.set('tt', list);
    document.getElementById('tt-sub').value  = '';
    document.getElementById('tt-room').value = '';
    renderTimetable(); showToast('Class added!'); return;
  }

  api.post('/api/timetable', { subject: sub, day: day, slot: slot, room: room, color: selectedColor })
    .then(function (r) {
      if (!r || r.error) { showToast(r ? r.error : 'Error'); return; }
      document.getElementById('tt-sub').value  = '';
      document.getElementById('tt-room').value = '';
      renderTimetable(); showToast('Class added!');
    });
}

function deleteTT(id) {
  if (Auth.isGuest()) {
    GuestDB.set('tt', GuestDB.get('tt').filter(function (x) { return x.id !== id; }));
    renderTimetable(); return;
  }
  api.delete('/api/timetable/' + id).then(renderTimetable);
}

function renderTimetable() {
  if (Auth.isGuest()) { buildGrid(GuestDB.get('tt')); return; }
  api.get('/api/timetable').then(function (r) { buildGrid(Array.isArray(r) ? r : []); });
}

function buildGrid(tt) {
  var grid = document.getElementById('tt-grid');
  if (!grid) return;

  var html = '<tr><th>Time</th>' + DAYS.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr>';

  TIMES.forEach(function (time) {
    html += '<tr><th>' + time + '</th>';
    DAYS.forEach(function (day) {
      var entry = tt.find(function (c) { return c.day === day && c.slot === time; });
      if (entry) {
        html += '<td><div class="tt-cell ' + (entry.color || '') + '" onclick="deleteTT(' + entry.id + ')" title="Click to remove">'
          + entry.subject
          + (entry.room ? '<br><small style="font-weight:400;font-size:10px">' + entry.room + '</small>' : '')
          + '</div></td>';
      } else {
        html += '<td></td>';
      }
    });
    html += '</tr>';
  });

  grid.innerHTML = html;
}
