// public/js/login.js

// If already logged in, skip to dashboard
window.onload = function() {
  if (Auth.getToken() || Auth.isGuest()) {
    window.location.href = 'pages/dashboard.html';
  }
};

function switchTab(tab) {
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-msg').textContent = '';
}

function setMsg(msg, color) {
  var el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.style.color = color === 'green' ? '#4ade80' : '#f87171';
}

function doRegister() {
  var name   = document.getElementById('r-name').value.trim();
  var email  = document.getElementById('r-email').value.trim();
  var course = document.getElementById('r-course').value.trim();
  var pass   = document.getElementById('r-pass').value.trim();

  if (!name || !email || !pass) { setMsg('Please fill all required fields.'); return; }
  if (pass.length < 6)          { setMsg('Password must be at least 6 characters.'); return; }

  api.post('/api/register', { name: name, email: email, course: course, password: pass })
    .then(function(res) {
      if (!res) return;
      if (res.error) { setMsg(res.error); return; }
      // Auto-login after register
      Auth.setSession(res.token, res.user);
      Auth.clearGuest();
      window.location.href = 'pages/dashboard.html';
    })
    .catch(function() { setMsg('Cannot connect to server. Is the backend running?'); });
}

function doLogin() {
  var email = document.getElementById('l-email').value.trim();
  var pass  = document.getElementById('l-pass').value.trim();

  if (!email || !pass) { setMsg('Please enter email and password.'); return; }

  api.post('/api/login', { email: email, password: pass })
    .then(function(res) {
      if (!res) return;
      if (res.error) { setMsg(res.error); return; }
      Auth.setSession(res.token, res.user);
      Auth.clearGuest();
      window.location.href = 'pages/dashboard.html';
    })
    .catch(function() { setMsg('Cannot connect to server. Is the backend running?'); });
}

function doGuestLogin() {
  Auth.clearSession();
  Auth.setGuest();
  window.location.href = 'pages/dashboard.html';
}
