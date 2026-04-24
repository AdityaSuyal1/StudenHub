// public/js/pomodoro.js

var timerInterval = null;
var timerRunning  = false;
var timerSeconds  = 25 * 60;
var timerMins     = 25;
var timerMode     = 'focus';    // 'focus' or 'break'
var sessionCount  = 0;          // sessions in current set (max 4)

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  loadStats();
};

function buildPage() {
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header"><div class="page-title">Pomodoro <span>Timer</span></div></div>'
    + '<div class="pomo-center">'

    // Mode buttons
    + '<div class="pomo-modes">'
    + '<button class="pomo-mode-btn active" onclick="setMode(25,\'Focus Session\',\'focus\',this)">🍅 Focus (25m)</button>'
    + '<button class="pomo-mode-btn" onclick="setMode(50,\'Deep Work\',\'focus\',this)">🔥 Deep Work (50m)</button>'
    + '<button class="pomo-mode-btn" onclick="setMode(90,\'Flow State\',\'focus\',this)">🧠 Flow State (90m)</button>'
    + '<button class="pomo-mode-btn" onclick="setMode(5,\'Short Break\',\'break\',this)">☕ Short Break (5m)</button>'
    + '<button class="pomo-mode-btn" onclick="setMode(15,\'Long Break\',\'break\',this)">🌿 Long Break (15m)</button>'
    + '</div>'

    // Clock
    + '<div class="pomo-clock">'
    + '<div class="pomo-time" id="pomo-display">25:00</div>'
    + '<div class="pomo-label" id="pomo-label">Focus Session</div>'
    + '</div>'

    // Session dots (4 per set)
    + '<div class="pomo-dots" id="pomo-dots">'
    + '<div class="pomo-dot"></div><div class="pomo-dot"></div><div class="pomo-dot"></div><div class="pomo-dot"></div>'
    + '</div>'

    // Controls
    + '<div class="pomo-controls">'
    + '<button class="btn-pomo-start" id="pomo-btn" onclick="toggleTimer()">▶ Start</button>'
    + '<button class="btn-pomo-reset" onclick="resetTimer()">↺ Reset</button>'
    + '</div>'

    // Stats
    + '<div class="pomo-stats">'
    + '<div class="pomo-stat"><div class="val" id="ps-today">0</div><div class="lbl">Today</div></div>'
    + '<div class="pomo-stat"><div class="val" id="ps-total">0</div><div class="lbl">Total</div></div>'
    + '<div class="pomo-stat"><div class="val" id="ps-mins">0</div><div class="lbl">Minutes</div></div>'
    + '</div>'
    + '</div>';
}

function setMode(mins, label, type, btn) {
  clearInterval(timerInterval);
  timerRunning = false;
  timerMins    = mins;
  timerSeconds = mins * 60;
  timerMode    = type;
  document.getElementById('pomo-btn').textContent   = '▶ Start';
  document.getElementById('pomo-label').textContent = label;
  document.querySelectorAll('.pomo-mode-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  updateDisplay();
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('pomo-btn').textContent = '▶ Start';
  } else {
    timerRunning = true;
    document.getElementById('pomo-btn').textContent = '⏸ Pause';
    timerInterval = setInterval(tick, 1000);
  }
}

function tick() {
  if (timerSeconds <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('pomo-btn').textContent = '▶ Start';

    if (timerMode === 'focus') {
      sessionCount = (sessionCount + 1) % 4;
      updateDots();
      recordSession();
    }
    resetTimer();
    return;
  }
  timerSeconds--;
  updateDisplay();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning  = false;
  timerSeconds  = timerMins * 60;
  document.getElementById('pomo-btn').textContent = '▶ Start';
  updateDisplay();
}

function updateDisplay() {
  var m = Math.floor(timerSeconds / 60);
  var s = timerSeconds % 60;
  document.getElementById('pomo-display').textContent =
    String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updateDots() {
  var dots = document.querySelectorAll('.pomo-dot');
  dots.forEach(function (d, i) {
    d.classList.toggle('done', i < sessionCount);
  });
}

function recordSession() {
  showToast('Session complete! Great work! 🎉');

  if (Auth.isGuest()) {
    var p = GuestDB.getObj('pomo');
    p.total      = (p.total || 0) + 1;
    p.total_mins = (p.total_mins || 0) + timerMins;
    var today = new Date().toDateString();
    p.today_count = (p.today_date === today ? (p.today_count || 0) : 0) + 1;
    p.today_date  = today;

    // Streak logic
    var yd = new Date(); yd.setDate(yd.getDate() - 1);
    var yesterday = yd.toDateString();
    if (p.last_date === yesterday) p.streak = (p.streak || 0) + 1;
    else if (p.last_date !== today) p.streak = 1;
    p.last_date = today;

    GuestDB.setObj('pomo', p);
    updateStatsDisplay(p.today_count, p.total, p.total_mins);
    return;
  }

  api.post('/api/pomodoro', { mins: timerMins }).then(function (r) {
    if (r) updateStatsDisplay(r.today_count, r.total, r.total_mins);
  });
}

function loadStats() {
  if (Auth.isGuest()) {
    var p = GuestDB.getObj('pomo');
    var today = new Date().toDateString();
    updateStatsDisplay(
      p.today_date === today ? (p.today_count || 0) : 0,
      p.total || 0,
      p.total_mins || 0
    ); return;
  }
  api.get('/api/pomodoro').then(function (r) {
    if (r) updateStatsDisplay(r.today_count, r.total, r.total_mins);
  });
}

function updateStatsDisplay(today, total, mins) {
  document.getElementById('ps-today').textContent = today || 0;
  document.getElementById('ps-total').textContent = total || 0;
  document.getElementById('ps-mins').textContent  = mins  || 0;
}
