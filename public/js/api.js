// public/js/api.js
// Shared API helper and auth utilities used by every page.

// ✅ FIXED: Works for localhost, Render, Vercel, Railway, or any custom domain
var API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:10000"
    : window.location.origin;   // automatically uses whatever domain the site is hosted on

// ── Token management ────────────────────────────────────────
var Auth = {
  getToken:  function() { return localStorage.getItem('sh_token'); },
  getUser:   function() {
    try { return JSON.parse(localStorage.getItem('sh_user')); }
    catch(e) { return null; }
  },
  setSession: function(token, user) {
    localStorage.setItem('sh_token', token);
    localStorage.setItem('sh_user',  JSON.stringify(user));
  },
  clearSession: function() {
    localStorage.removeItem('sh_token');
    localStorage.removeItem('sh_user');
  },
  isGuest: function() { return localStorage.getItem('sh_guest') === 'true'; },
  setGuest: function() { localStorage.setItem('sh_guest', 'true'); },
  clearGuest: function() { localStorage.removeItem('sh_guest'); },
  requireAuth: function() {
    if (!this.getToken() && !this.isGuest()) {
      window.location.href = '../index.html';
    }
  }
};

// ── Generic fetch wrapper ────────────────────────────────────
function apiCall(method, url, body) {
  var opts = {
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  var token = Auth.getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body)  opts.body = JSON.stringify(body);

  return fetch(API_BASE + url, opts).then(function(r) {
    if (r.status === 401) {
      Auth.clearSession();
      window.location.href = '../index.html';
      return;
    }
    return r.json();
  });
}

// Shortcuts
var api = {
  get:    function(url)        { return apiCall('GET',    url); },
  post:   function(url, body)  { return apiCall('POST',   url, body); },
  patch:  function(url, body)  { return apiCall('PATCH',  url, body); },
  delete: function(url, body)  { return apiCall('DELETE', url, body); }
};

// ── Guest localStorage fallback ──────────────────────────────
var GuestDB = {
  get:    function(k) { try{return JSON.parse(localStorage.getItem('g_'+k))||[];}catch(e){return [];} },
  set:    function(k,v){ localStorage.setItem('g_'+k, JSON.stringify(v)); },
  getObj: function(k) { try{return JSON.parse(localStorage.getItem('g_'+k))||{};}catch(e){return {};} },
  setObj: function(k,v){ localStorage.setItem('g_'+k, JSON.stringify(v)); }
};

// ── Toast notification ───────────────────────────────────────
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2800);
}

// ── Render the topbar user info ──────────────────────────────
function initTopbar() {
  var nameEl   = document.getElementById('topbar-name');
  var avatarEl = document.getElementById('topbar-avatar');
  var bannerEl = document.getElementById('guest-banner');
  var lbtn     = document.getElementById('logout-btn');

  if (Auth.isGuest()) {
    if (nameEl)   nameEl.textContent  = 'Guest';
    if (avatarEl) avatarEl.textContent = '👤';
    if (bannerEl) bannerEl.classList.add('show');
    if (lbtn)     lbtn.textContent = 'Exit Guest';
  } else {
    var user = Auth.getUser();
    if (user && nameEl)   nameEl.textContent  = user.name;
    if (user && avatarEl) avatarEl.textContent = user.name ? user.name[0].toUpperCase() : 'S';
  }

  if (lbtn) {
    lbtn.onclick = function() {
      Auth.clearSession();
      Auth.clearGuest();
      window.location.href = '../index.html';
    };
  }
}

// ── Highlight active sidebar link ────────────────────────────
function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

// ── Grade helpers ────────────────────────────────────────────
function getGradeLetter(pct) {
  if (pct >= 90) return 'O';
  if (pct >= 80) return 'A+';
  if (pct >= 70) return 'A';
  if (pct >= 60) return 'B+';
  if (pct >= 50) return 'B';
  if (pct >= 40) return 'C';
  return 'F';
}

function getGradeClass(letter) {
  var map = {'O':'grade-O','A+':'grade-Aplus','A':'grade-A','B+':'grade-Bplus','B':'grade-B','C':'grade-C','F':'grade-F'};
  return map[letter] || 'grade-F';
}
