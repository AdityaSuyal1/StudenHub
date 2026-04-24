// public/js/flashcards.js

var fcIndex = 0;
var fcCards = [];

window.onload = function () {
  Auth.requireAuth();
  initTopbar();
  buildPage();
  loadCards();
};

function buildPage() {
  var main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-header">'
    + '<div class="page-title">Flash<span>cards</span></div>'
    + '<button class="btn-primary" onclick="toggleAddForm()">+ Add Card</button>'
    + '</div>'
    + '<div id="add-form" class="card" style="display:none;margin-bottom:18px">'
    + '<div class="form-row">'
    + '<div class="form-group" style="flex:2"><label>Question (Front)</label><textarea id="fc-q" rows="3" placeholder="What is...?"></textarea></div>'
    + '<div class="form-group" style="flex:2"><label>Answer (Back)</label><textarea id="fc-a" rows="3" placeholder="The answer is..."></textarea></div>'
    + '<div class="form-group"><label>Subject / Deck</label><input type="text" id="fc-deck" placeholder="e.g. Physics"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn-primary" onclick="saveCard()">Save Card</button>'
    + '<button class="btn-outline" onclick="toggleAddForm()">Cancel</button>'
    + '</div></div>'
    + '<div id="fc-viewer"></div>'
    + '<div class="cards-grid" id="fc-grid"></div>';
}

function toggleAddForm() {
  var f = document.getElementById('add-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function saveCard() {
  var q    = document.getElementById('fc-q').value.trim();
  var a    = document.getElementById('fc-a').value.trim();
  var deck = document.getElementById('fc-deck').value.trim();

  if (!q || !a) { showToast('Enter both question and answer.'); return; }

  if (Auth.isGuest()) {
    var list = GuestDB.get('flashcards');
    list.push({ id: Date.now(), question: q, answer: a, deck: deck, known: 0, unknown: 0 });
    GuestDB.set('flashcards', list);
    clearForm(); fcIndex = 0; loadCards(); showToast('Card added!'); return;
  }

  api.post('/api/flashcards', { question: q, answer: a, deck: deck })
    .then(function (r) {
      if (!r || r.error) { showToast(r ? r.error : 'Error'); return; }
      clearForm(); fcIndex = 0; loadCards(); showToast('Card added!');
    });
}

function clearForm() {
  ['fc-q','fc-a','fc-deck'].forEach(function (id) { document.getElementById(id).value = ''; });
}

function loadCards() {
  if (Auth.isGuest()) {
    fcCards = GuestDB.get('flashcards');
    renderAll(); return;
  }
  api.get('/api/flashcards').then(function (r) {
    fcCards = (r && Array.isArray(r.cards)) ? r.cards : [];
    renderAll();
  });
}

function renderAll() {
  renderViewer();
  renderGrid();
}

function renderViewer() {
  var el = document.getElementById('fc-viewer');
  if (!fcCards.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">🃏</div><h3>No flashcards yet</h3><p>Add your first card above!</p></div>';
    return;
  }

  fcIndex = Math.min(fcIndex, fcCards.length - 1);
  var card = fcCards[fcIndex];

  el.innerHTML = '<div class="flashcard-wrap">'
    + '<div class="flashcard" id="the-card" onclick="flipCard()">'
    + '<div class="fc-face fc-front"><div class="lbl">Question ' + (fcIndex + 1) + ' of ' + fcCards.length + '</div>'
    + '<div class="text">' + card.question + '</div>'
    + '<div class="hint">Click to reveal answer</div></div>'
    + '<div class="fc-face fc-back"><div class="lbl">Answer</div>'
    + '<div class="text">' + card.answer + '</div>'
    + '<div class="hint">Click to flip back</div></div>'
    + '</div></div>'
    + '<div class="fc-nav">'
    + '<button onclick="navigate(-1)">← Prev</button>'
    + '<span class="fc-counter">' + (fcIndex + 1) + ' / ' + fcCards.length + (card.deck ? ' — ' + card.deck : '') + '</span>'
    + '<button onclick="navigate(1)">Next →</button>'
    + '</div>'
    + '<div class="fc-result">'
    + '<button class="btn-dontknow" onclick="mark(' + card.id + ',\'unknown\')">✗ Don\'t Know</button>'
    + '<button class="btn-know"     onclick="mark(' + card.id + ',\'know\')">✓ Know It</button>'
    + '</div>';
}

function renderGrid() {
  var el = document.getElementById('fc-grid');
  if (!fcCards.length) { el.innerHTML = ''; return; }
  el.innerHTML = fcCards.map(function (c) {
    return '<div class="card">'
      + '<div class="card-header"><div class="card-title">' + c.question.substring(0, 60) + (c.question.length > 60 ? '…' : '') + '</div>'
      + '<button class="btn-danger" onclick="deleteCard(' + c.id + ')">🗑️</button></div>'
      + '<div class="card-body">' + c.answer.substring(0, 80) + '</div>'
      + '<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">'
      + (c.deck ? '<span class="badge badge-purple">' + c.deck + '</span>' : '<span></span>')
      + '<span style="font-size:11px;color:var(--text-muted)">✓' + (c.known || 0) + ' &nbsp;✗' + (c.unknown || 0) + '</span>'
      + '</div></div>';
  }).join('');
}

function flipCard() {
  var el = document.getElementById('the-card');
  if (el) el.classList.toggle('flipped');
}

function navigate(dir) {
  if (!fcCards.length) return;
  fcIndex = (fcIndex + dir + fcCards.length) % fcCards.length;
  renderViewer();
}

function mark(id, result) {
  if (Auth.isGuest()) {
    var list = GuestDB.get('flashcards');
    var card = list.find(function (c) { return c.id === id; });
    if (card) { if (result === 'know') card.known++; else card.unknown++; }
    GuestDB.set('flashcards', list);
    fcCards = list;
    navigate(1); return;
  }
  api.patch('/api/flashcards/' + id + '/mark', { result: result }).then(function () {
    loadCards();
  });
}

function deleteCard(id) {
  if (Auth.isGuest()) {
    GuestDB.set('flashcards', GuestDB.get('flashcards').filter(function (c) { return c.id !== id; }));
    fcIndex = 0; loadCards(); return;
  }
  api.delete('/api/flashcards/' + id).then(function () { fcIndex = 0; loadCards(); });
}
