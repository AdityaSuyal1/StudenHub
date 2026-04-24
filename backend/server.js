// server.js — StudenHub backend (Turso / LibSQL edition)
// Stack: Node.js + Express + Turso (hosted SQLite) + JWT auth
//
// HOW TO RUN:
//   cd backend && npm install && node server.js
//   Requires TURSO_URL and TURSO_TOKEN in .env

// ─── Load .env ───────────────────────────────────────────────
var fs = require('fs');
var envPath = require('path').join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(function(line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    var eq = line.indexOf('=');
    if (eq === -1) return;
    var key = line.substring(0, eq).trim();
    var val = line.substring(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
}

var express = require('express');
var bcrypt  = require('bcryptjs');
var jwt     = require('jsonwebtoken');
var path    = require('path');
var db      = require('./database');

var app  = express();
var PORT = process.env.PORT || 10000;
var JWT_SECRET = process.env.JWT_SECRET || 'studenhub_secret_key_change_in_production';

// ─── CORS: must handle preflight OPTIONS before any route ────
var cors = require('cors');
var corsOptions = {
  origin: true,                 // mirror request origin
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ← preflight for ALL routes (fixes POST JSON blocked online)

// ─── Body parsers ────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' })); // fallback for form-encoded bodies

app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Helper: extract rows from Turso result ──────────────────
// Turso/@libsql returns integer columns as BigInt.
// BigInt breaks JSON.stringify() and embeds as "123n" in innerHTML onclick attrs.
// sanitizeVal converts every BigInt to a plain Number before we touch the data.
function sanitizeVal(v) {
  if (typeof v === 'bigint') return Number(v);
  return v;
}

function toObjects(result) {
  if (!result || !result.rows) return [];

  // @libsql/client Row objects look like plain objects but Object.keys() returns []
  // because named properties are non-enumerable. Only numeric index access works.
  // ALWAYS zip using result.columns + row[i].
  return result.rows.map(row => {
    var obj = {};
    result.columns.forEach((col, i) => {
      obj[col] = sanitizeVal(row[i]);
    });
    return obj;
  });
}
function firstRow(result) {
  var rows = toObjects(result);
  return rows.length > 0 ? rows[0] : null;
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
function requireLogin(req, res, next) {
  var header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Please login first.' });
  var token = header.replace('Bearer ', '').trim();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
}

// ─── AUTH ROUTES ─────────────────────────────────────────────

// POST /api/register
app.post('/api/register', async function(req, res) {
  try {
    var name = req.body.name, email = req.body.email,
        password = req.body.password, course = req.body.course;
    if (!name || !email || !password)
      return res.json({ error: 'Please fill all fields.' });

    var existing = firstRow(await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] }));
    if (existing) return res.json({ error: 'This email is already registered.' });

    var hashed = bcrypt.hashSync(password, 10);
    var result = await db.execute({
      sql:  'INSERT INTO users (name, email, password, course) VALUES (?, ?, ?, ?)',
      args: [name, email, hashed, course || null]
    });
    var newId = Number(result.lastInsertRowid);
    var token = jwt.sign({ id: newId, name: name, email: email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token: token, user: { id: newId, name: name, email: email, course: course } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/login
app.post('/api/login', async function(req, res) {
  try {
    var email = req.body.email, password = req.body.password;
    if (!email || !password) return res.json({ error: 'Enter email and password.' });
    var user = firstRow(await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] }));
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.json({ error: 'Wrong email or password.' });
    var token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token: token, user: { id: user.id, name: user.name, email: user.email, course: user.course } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/me
app.get('/api/me', requireLogin, async function(req, res) {
  try {
    var user = firstRow(await db.execute({ sql: 'SELECT id, name, email, course, created_at FROM users WHERE id = ?', args: [req.user.id] }));
    res.json(user || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DASHBOARD ───────────────────────────────────────────────

app.get('/api/dashboard', requireLogin, async function(req, res) {
  try {
    var uid = req.user.id;

    var noteCountRow    = firstRow(await db.execute({ sql: 'SELECT COUNT(*) AS c FROM notes WHERE user_id = ?', args: [uid] }));
    var pendingCountRow = firstRow(await db.execute({ sql: 'SELECT COUNT(*) AS c FROM assignments WHERE user_id = ? AND done = 0', args: [uid] }));
    var cardCountRow    = firstRow(await db.execute({ sql: 'SELECT COUNT(*) AS c FROM flashcards WHERE user_id = ?', args: [uid] }));
    var pomo            = firstRow(await db.execute({ sql: 'SELECT * FROM pomodoro_stats WHERE user_id = ?', args: [uid] })) || {};

    var upcoming    = toObjects(await db.execute({ sql: 'SELECT * FROM assignments WHERE user_id = ? AND done = 0 ORDER BY CASE WHEN due_date IS NULL OR due_date = "" THEN 1 ELSE 0 END, due_date ASC LIMIT 5', args: [uid] }));
    var recentNotes = toObjects(await db.execute({ sql: 'SELECT id, title, subject, color, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 3', args: [uid] }));
    var grades      = toObjects(await db.execute({ sql: 'SELECT marks, max_marks, subject FROM grades WHERE user_id = ?', args: [uid] }));

    var subjectMap = {};
    grades.forEach(function(g) {
      if (!subjectMap[g.subject]) subjectMap[g.subject] = { marks: 0, max: 0 };
      subjectMap[g.subject].marks += Number(g.marks);
      subjectMap[g.subject].max   += Number(g.max_marks);
    });
    var subjectProgress = Object.keys(subjectMap).map(function(name) {
      return { name: name, percentage: Math.round((subjectMap[name].marks / subjectMap[name].max) * 100) };
    });

    var today = new Date().toDateString();
    res.json({
      counts: {
        notes: Number(noteCountRow.c),
        pending_assignments: Number(pendingCountRow.c),
        flashcards: Number(cardCountRow.c),
        pomodoros_total: pomo.total || 0,
        pomodoros_today: (pomo.today_date === today ? pomo.today_count : 0) || 0
      },
      streak: pomo.streak || 0,
      upcoming_assignments: upcoming,
      recent_notes: recentNotes,
      subject_progress: subjectProgress
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── NOTES ───────────────────────────────────────────────────

app.get('/api/notes', requireLogin, async function(req, res) {
  try {
    var search  = req.query.search  || '';
    var subject = req.query.subject || '';
    var q = 'SELECT * FROM notes WHERE user_id = ?';
    var p = [req.user.id];
    if (search)  { q += ' AND (title LIKE ? OR body LIKE ?)'; p.push('%'+search+'%','%'+search+'%'); }
    if (subject) { q += ' AND subject = ?'; p.push(subject); }
    q += ' ORDER BY created_at DESC';
    res.json(toObjects(await db.execute({ sql: q, args: p })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notes', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    if (!b.title && !b.body) return res.json({ error: 'Note cannot be empty.' });
    var r = await db.execute({ sql: 'INSERT INTO notes (user_id, title, body, subject, color) VALUES (?,?,?,?,?)', args: [req.user.id, b.title||null, b.body||null, b.subject||null, b.color||'purple'] });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/notes/:id', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    await db.execute({ sql: 'UPDATE notes SET title=?, body=?, subject=?, color=?, updated_at=datetime("now") WHERE id=? AND user_id=?', args: [b.title||null, b.body||null, b.subject||null, b.color||'purple', req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notes/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM notes WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ASSIGNMENTS ─────────────────────────────────────────────

app.get('/api/assignments', requireLogin, async function(req, res) {
  try {
    var filter = req.query.filter || 'all';
    var q = 'SELECT * FROM assignments WHERE user_id = ?';
    var p = [req.user.id];
    if (filter === 'pending') q += ' AND done = 0';
    if (filter === 'done')    q += ' AND done = 1';
    if (filter === 'high')    { q += ' AND priority = ?'; p.push('High'); }
    q += ' ORDER BY CASE WHEN due_date IS NULL OR due_date="" THEN 1 ELSE 0 END, due_date ASC';
    res.json(toObjects(await db.execute({ sql: q, args: p })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assignments', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    if (!b || typeof b !== 'object') return res.status(400).json({ error: 'Invalid request body. Make sure Content-Type is application/json.' });
    if (!b.title || !b.title.toString().trim()) return res.json({ error: 'Title is required.' });
    var title    = b.title.toString().trim();
    var subject  = b.subject  ? b.subject.toString().trim()  : null;
    var due_date = b.due_date ? b.due_date.toString().trim() : null;
    var priority = ['High','Medium','Low'].includes(b.priority) ? b.priority : 'Medium';
    var notes    = b.notes    ? b.notes.toString().trim()    : null;
    var r = await db.execute({
      sql:  'INSERT INTO assignments (user_id, title, subject, due_date, priority, notes) VALUES (?,?,?,?,?,?)',
      args: [req.user.id, title, subject, due_date, priority, notes]
    });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/assignments/:id/toggle', requireLogin, async function(req, res) {
  try {
    var item = firstRow(await db.execute({ sql: 'SELECT done FROM assignments WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] }));
    if (!item) return res.json({ error: 'Not found.' });
    await db.execute({ sql: 'UPDATE assignments SET done = ? WHERE id = ? AND user_id = ?', args: [item.done ? 0 : 1, req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/assignments/:id', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    await db.execute({ sql: 'UPDATE assignments SET title=?, subject=?, due_date=?, priority=?, notes=? WHERE id=? AND user_id=?', args: [b.title, b.subject||null, b.due_date||null, b.priority||'Medium', b.notes||null, req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/assignments/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM assignments WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TIMETABLE ───────────────────────────────────────────────

app.get('/api/timetable', requireLogin, async function(req, res) {
  try {
    res.json(toObjects(await db.execute({ sql: 'SELECT * FROM timetable WHERE user_id = ? ORDER BY day, slot', args: [req.user.id] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timetable', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    if (!b.subject || !b.day || !b.slot) return res.json({ error: 'Subject, day and slot are required.' });
    var r = await db.execute({ sql: 'INSERT INTO timetable (user_id, subject, day, slot, room, color) VALUES (?,?,?,?,?,?)', args: [req.user.id, b.subject, b.day, b.slot, b.room||null, b.color||null] });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/timetable/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM timetable WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── STUDY PLANNER ───────────────────────────────────────────

app.get('/api/planner', requireLogin, async function(req, res) {
  try {
    var q = 'SELECT * FROM planner WHERE user_id = ?';
    var p = [req.user.id];
    if (req.query.day) { q += ' AND day = ?'; p.push(req.query.day); }
    q += ' ORDER BY day, time';
    res.json(toObjects(await db.execute({ sql: q, args: p })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/planner', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    if (!b.subject || !b.day) return res.json({ error: 'Subject and day are required.' });
    var r = await db.execute({ sql: 'INSERT INTO planner (user_id, subject, day, time, duration, color) VALUES (?,?,?,?,?,?)', args: [req.user.id, b.subject, b.day, b.time||null, b.duration||1, b.color||null] });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/planner/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM planner WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PYQ ─────────────────────────────────────────────────────

app.get('/api/pyq', requireLogin, async function(req, res) {
  try {
    var s = req.query.search || '';
    var q = 'SELECT * FROM pyq WHERE user_id = ?';
    var p = [req.user.id];
    if (s) { q += ' AND (subject LIKE ? OR notes LIKE ?)'; p.push('%'+s+'%','%'+s+'%'); }
    q += ' ORDER BY year DESC, created_at DESC';
    res.json(toObjects(await db.execute({ sql: q, args: p })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pyq', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    if (!b.subject) return res.json({ error: 'Subject is required.' });
    var r = await db.execute({ sql: 'INSERT INTO pyq (user_id, subject, year, semester, link, notes) VALUES (?,?,?,?,?,?)', args: [req.user.id, b.subject, b.year||null, b.semester||null, b.link||null, b.notes||null] });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/pyq/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM pyq WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── MODEL PAPERS ────────────────────────────────────────────

app.get('/api/model-papers', requireLogin, async function(req, res) {
  try {
    var s = req.query.search || '';
    var q = 'SELECT * FROM model_papers WHERE user_id = ?';
    var p = [req.user.id];
    if (s) { q += ' AND (title LIKE ? OR subject LIKE ?)'; p.push('%'+s+'%','%'+s+'%'); }
    q += ' ORDER BY created_at DESC';
    res.json(toObjects(await db.execute({ sql: q, args: p })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/model-papers', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    if (!b.title) return res.json({ error: 'Title is required.' });
    var r = await db.execute({ sql: 'INSERT INTO model_papers (user_id, title, subject, prepared_by, marks, link, description) VALUES (?,?,?,?,?,?,?)', args: [req.user.id, b.title, b.subject||null, b.prepared_by||null, b.marks||null, b.link||null, b.description||null] });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/model-papers/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM model_papers WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FLASHCARDS ──────────────────────────────────────────────

app.get('/api/flashcards', requireLogin, async function(req, res) {
  try {
    var q = 'SELECT * FROM flashcards WHERE user_id = ?';
    var p = [req.user.id];
    if (req.query.deck) { q += ' AND deck = ?'; p.push(req.query.deck); }
    q += ' ORDER BY id ASC';
    var cards = toObjects(await db.execute({ sql: q, args: p }));
    var deckRows = toObjects(await db.execute({ sql: 'SELECT DISTINCT deck FROM flashcards WHERE user_id = ? AND deck IS NOT NULL ORDER BY deck', args: [req.user.id] }));
    var decks = deckRows.map(function(d) { return d.deck; });
    res.json({ cards: cards, decks: decks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/flashcards', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    if (!b.question || !b.answer) return res.json({ error: 'Question and answer are required.' });
    var r = await db.execute({ sql: 'INSERT INTO flashcards (user_id, question, answer, deck) VALUES (?,?,?,?)', args: [req.user.id, b.question, b.answer, b.deck||null] });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/flashcards/:id/mark', requireLogin, async function(req, res) {
  try {
    var result = req.body.result;
    if (result === 'know')
      await db.execute({ sql: 'UPDATE flashcards SET known = known + 1 WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    else
      await db.execute({ sql: 'UPDATE flashcards SET unknown = unknown + 1 WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/flashcards/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM flashcards WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GRADES ──────────────────────────────────────────────────

app.get('/api/grades', requireLogin, async function(req, res) {
  try {
    var grades = toObjects(await db.execute({ sql: 'SELECT * FROM grades WHERE user_id = ? ORDER BY created_at DESC', args: [req.user.id] }));
    var tm = 0, tmax = 0;
    grades.forEach(function(g) { tm += Number(g.marks); tmax += Number(g.max_marks); });
    var overall = tmax > 0 ? Math.round((tm / tmax) * 100) : null;
    res.json({ grades: grades, overall_percentage: overall, total_exams: grades.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/grades', requireLogin, async function(req, res) {
  try {
    var b = req.body;
    var marks = parseFloat(b.marks), max = parseFloat(b.max_marks);
    if (!b.subject)           return res.json({ error: 'Subject is required.' });
    if (isNaN(marks))         return res.json({ error: 'Enter valid marks.' });
    if (isNaN(max) || max<=0) return res.json({ error: 'Enter valid total marks.' });
    if (marks > max)          return res.json({ error: 'Marks cannot exceed total.' });
    var r = await db.execute({ sql: 'INSERT INTO grades (user_id, subject, exam_type, marks, max_marks) VALUES (?,?,?,?,?)', args: [req.user.id, b.subject, b.exam_type||null, marks, max] });
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/grades/:id', requireLogin, async function(req, res) {
  try {
    await db.execute({ sql: 'DELETE FROM grades WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POMODORO ────────────────────────────────────────────────

app.get('/api/pomodoro', requireLogin, async function(req, res) {
  try {
    var stats = firstRow(await db.execute({ sql: 'SELECT * FROM pomodoro_stats WHERE user_id = ?', args: [req.user.id] }));
    if (!stats) return res.json({ total: 0, total_mins: 0, streak: 0, today_count: 0 });
    var today = new Date().toDateString();
    if (stats.today_date !== today)
      await db.execute({ sql: 'UPDATE pomodoro_stats SET today_count = 0, today_date = ? WHERE user_id = ?', args: [today, req.user.id] });
    res.json(firstRow(await db.execute({ sql: 'SELECT * FROM pomodoro_stats WHERE user_id = ?', args: [req.user.id] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pomodoro', requireLogin, async function(req, res) {
  try {
    var mins  = parseInt(req.body.mins) || 25;
    var today = new Date().toDateString();
    var yd = new Date(); yd.setDate(yd.getDate() - 1);
    var yesterday = yd.toDateString();

    var existing = firstRow(await db.execute({ sql: 'SELECT * FROM pomodoro_stats WHERE user_id = ?', args: [req.user.id] }));
    if (!existing) {
      await db.execute({ sql: 'INSERT INTO pomodoro_stats (user_id, total, total_mins, streak, last_date, today_date, today_count) VALUES (?,1,?,1,?,?,1)', args: [req.user.id, mins, today, today] });
    } else {
      var newStreak     = existing.last_date === yesterday ? Number(existing.streak) + 1 : existing.last_date !== today ? 1 : Number(existing.streak);
      var newTodayCount = (existing.today_date === today ? Number(existing.today_count) : 0) + 1;
      await db.execute({ sql: 'UPDATE pomodoro_stats SET total=total+1, total_mins=total_mins+?, streak=?, last_date=?, today_date=?, today_count=? WHERE user_id=?', args: [mins, newStreak, today, today, newTodayCount, req.user.id] });
    }
    res.json(firstRow(await db.execute({ sql: 'SELECT * FROM pomodoro_stats WHERE user_id = ?', args: [req.user.id] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ANALYTICS ───────────────────────────────────────────────

app.get('/api/analytics', requireLogin, async function(req, res) {
  try {
    var uid = req.user.id;

    // Assignments by priority
    var asgByPriority = toObjects(await db.execute({
      sql: 'SELECT priority, COUNT(*) AS c, SUM(done) AS done_count FROM assignments WHERE user_id=? GROUP BY priority',
      args: [uid]
    }));

    // Assignments by subject (top 8)
    var asgBySubject = toObjects(await db.execute({
      sql: 'SELECT subject, COUNT(*) AS c FROM assignments WHERE user_id=? AND subject IS NOT NULL AND subject != "" GROUP BY subject ORDER BY c DESC LIMIT 8',
      args: [uid]
    }));

    // Assignments by completion status
    var asgDoneCount   = (firstRow(await db.execute({ sql: 'SELECT COUNT(*) AS c FROM assignments WHERE user_id=? AND done=1', args: [uid] })) || {}).c || 0;
    var asgTotalCount  = (firstRow(await db.execute({ sql: 'SELECT COUNT(*) AS c FROM assignments WHERE user_id=?', args: [uid] })) || {}).c || 0;

    // Total notes count
    var totalNotesRow = firstRow(await db.execute({ sql: 'SELECT COUNT(*) AS c FROM notes WHERE user_id=?', args: [uid] }));
    var totalNotes = Number((totalNotesRow || {}).c || 0);

    // Notes by subject (top 8)
    var notesBySubject = toObjects(await db.execute({
      sql: 'SELECT subject, COUNT(*) AS c FROM notes WHERE user_id=? AND subject IS NOT NULL AND subject != "" GROUP BY subject ORDER BY c DESC LIMIT 8',
      args: [uid]
    }));

    // Notes by color
    var notesByColor = toObjects(await db.execute({
      sql: 'SELECT color, COUNT(*) AS c FROM notes WHERE user_id=? GROUP BY color ORDER BY c DESC',
      args: [uid]
    }));

    // PYQ by subject (top 8)
    var pyqBySubject = toObjects(await db.execute({
      sql: 'SELECT subject, COUNT(*) AS c FROM pyq WHERE user_id=? GROUP BY subject ORDER BY c DESC LIMIT 8',
      args: [uid]
    }));

    // PYQ by year
    var pyqByYear = toObjects(await db.execute({
      sql: 'SELECT year, COUNT(*) AS c FROM pyq WHERE user_id=? AND year IS NOT NULL GROUP BY year ORDER BY year ASC',
      args: [uid]
    }));

    // PYQ by semester
    var pyqBySem = toObjects(await db.execute({
      sql: 'SELECT semester, COUNT(*) AS c FROM pyq WHERE user_id=? AND semester IS NOT NULL GROUP BY semester ORDER BY c DESC',
      args: [uid]
    }));

    // Pomodoro stats
    var pomoStats = firstRow(await db.execute({ sql: 'SELECT * FROM pomodoro_stats WHERE user_id=?', args: [uid] })) || {};

    // Grades by subject
    var gradesBySubject = toObjects(await db.execute({
      sql: 'SELECT subject, SUM(marks) AS total_marks, SUM(max_marks) AS total_max FROM grades WHERE user_id=? GROUP BY subject ORDER BY subject',
      args: [uid]
    })).map(function(g) {
      return { subject: g.subject, percentage: Math.round((Number(g.total_marks) / Number(g.total_max)) * 100) };
    });

    // Flashcard performance
    var flashStats = firstRow(await db.execute({
      sql: 'SELECT SUM(known) AS known, SUM(unknown) AS unknown FROM flashcards WHERE user_id=?',
      args: [uid]
    })) || {};

    res.json({
      assignments: {
        by_priority: asgByPriority,
        by_subject:  asgBySubject,
        total:       Number(asgTotalCount),
        done:        Number(asgDoneCount),
        pending:     Number(asgTotalCount) - Number(asgDoneCount)
      },
      notes: {
        by_subject: notesBySubject,
        by_color:   notesByColor,
        total:      totalNotes
      },
      pyq: {
        by_subject: pyqBySubject,
        by_year:    pyqByYear,
        by_semester: pyqBySem
      },
      pomodoro: {
        total:      Number(pomoStats.total || 0),
        total_mins: Number(pomoStats.total_mins || 0),
        streak:     Number(pomoStats.streak || 0),
        today:      Number(pomoStats.today_count || 0)
      },
      grades: {
        by_subject: gradesBySubject
      },
      flashcards: {
        known:   Number(flashStats.known || 0),
        unknown: Number(flashStats.unknown || 0)
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CATCH-ALL ───────────────────────────────────────────────
app.get('*', function(req, res) {
  if (!req.path.startsWith('/api'))
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', function () {
  console.log('\n🚀 StudenHub Backend Running on port:', PORT);
});
