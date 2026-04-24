-- ================================================================
--  StudenHub — Complete Database Schema
--  File     : schema.sql
--  Engine   : SQLite  (also compatible with MySQL / MariaDB)
--  Run with : sqlite3 data/studenhub.db < schema.sql
-- ================================================================


-- ----------------------------------------------------------------
--  TABLE 1: users
--  Stores every registered account.
--  Passwords are hashed with bcrypt — never stored as plain text.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,           -- bcrypt hash
    course     TEXT,                       -- e.g. "B.Tech CSE", "MBA"
    created_at TEXT    DEFAULT (datetime('now'))
);


-- ----------------------------------------------------------------
--  TABLE 2: notes
--  One row per note. Linked to the user who wrote it.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    title      TEXT,
    body       TEXT,
    subject    TEXT,
    color      TEXT    DEFAULT 'purple',   -- purple/green/yellow/red/blue
    created_at TEXT    DEFAULT (datetime('now')),
    updated_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 3: assignments
--  Tracks homework, projects, lab reports, etc.
--  done = 0 (pending) or 1 (completed)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    title      TEXT    NOT NULL,
    subject    TEXT,
    due_date   TEXT,                       -- stored as YYYY-MM-DD
    priority   TEXT    DEFAULT 'Medium'
                       CHECK(priority IN ('High','Medium','Low')),
    notes      TEXT,                       -- extra details
    done       INTEGER DEFAULT 0
                       CHECK(done IN (0,1)),
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 4: timetable
--  Weekly class schedule. One row = one class slot.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT    NOT NULL,
    day     TEXT    NOT NULL
            CHECK(day IN ('Monday','Tuesday','Wednesday',
                          'Thursday','Friday','Saturday','Sunday')),
    slot    TEXT    NOT NULL,              -- e.g. "9:00 AM"
    room    TEXT,                          -- e.g. "Room 204"
    color   TEXT,                          -- cell highlight color
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 5: planner
--  Study session planner — different from the timetable.
--  Timetable = fixed class schedule.
--  Planner   = personal study plan per day.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planner (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL,
    subject  TEXT    NOT NULL,
    day      TEXT    NOT NULL,
    time     TEXT,                         -- start time, e.g. "14:00"
    duration REAL    DEFAULT 1,            -- hours, e.g. 1.5
    color    TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 6: pyq
--  Previous Year Question papers added by the user.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pyq (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    subject    TEXT    NOT NULL,
    year       INTEGER,                    -- e.g. 2023
    semester   TEXT,                       -- e.g. "Semester 5"
    link       TEXT,                       -- URL to the PDF
    notes      TEXT,                       -- topics covered, difficulty
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 7: model_papers
--  Model / practice question papers.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS model_papers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT    NOT NULL,          -- e.g. "DBMS Model Paper Set A"
    subject     TEXT,
    prepared_by TEXT,                      -- teacher or institute name
    marks       INTEGER,                   -- total marks for the paper
    link        TEXT,                      -- URL to the PDF
    description TEXT,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 8: flashcards
--  Question-answer cards for self-testing.
--  known   = times user clicked "I Know This"
--  unknown = times user clicked "Don't Know"
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcards (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL,
    question TEXT    NOT NULL,
    answer   TEXT    NOT NULL,
    deck     TEXT,                         -- subject/group name
    known    INTEGER DEFAULT 0,
    unknown  INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 9: grades
--  Marks obtained in each exam.
--  Percentage and grade letter are computed at query time —
--  not stored — so they are always up to date.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    subject    TEXT    NOT NULL,
    exam_type  TEXT,                       -- Mid Term / End Term / Quiz …
    marks      REAL    NOT NULL,           -- marks obtained
    max_marks  REAL    NOT NULL,           -- total marks for that exam
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
--  TABLE 10: pomodoro_stats
--  One row per user — updated every time a session finishes.
--  UNIQUE on user_id ensures only one stats row per user.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pomodoro_stats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE,
    total       INTEGER DEFAULT 0,         -- all-time session count
    total_mins  INTEGER DEFAULT 0,         -- all-time minutes studied
    streak      INTEGER DEFAULT 0,         -- consecutive days studied
    last_date   TEXT,                      -- last study date (for streak)
    today_date  TEXT,                      -- today's date string
    today_count INTEGER DEFAULT 0,         -- sessions done today
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ================================================================
--  INDEXES — speed up common queries
-- ================================================================

-- Most queries filter by user_id, so index every foreign key
CREATE INDEX IF NOT EXISTS idx_notes_user       ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_timetable_user   ON timetable(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_user     ON planner(user_id);
CREATE INDEX IF NOT EXISTS idx_pyq_user         ON pyq(user_id);
CREATE INDEX IF NOT EXISTS idx_model_user       ON model_papers(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user  ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_grades_user      ON grades(user_id);
CREATE INDEX IF NOT EXISTS idx_pomo_user        ON pomodoro_stats(user_id);

-- Speed up assignment filtering (pending/done)
CREATE INDEX IF NOT EXISTS idx_assignments_done ON assignments(user_id, done);

-- Speed up timetable grid rendering
CREATE INDEX IF NOT EXISTS idx_timetable_day    ON timetable(user_id, day);

-- Speed up grade summary calculation
CREATE INDEX IF NOT EXISTS idx_grades_subject   ON grades(user_id, subject);

-- Speed up email lookup during login
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);


-- ================================================================
--  SUMMARY
--
--  Table            Stores
--  ─────────────    ───────────────────────────────────────────
--  users            Account credentials and profile
--  notes            Study notes with subject tagging
--  assignments      Tasks with due dates and priority
--  timetable        Fixed weekly class schedule
--  planner          Personal daily study sessions
--  pyq              Previous year question papers
--  model_papers     Model / practice question papers
--  flashcards       Q&A cards with known/unknown tracking
--  grades           Exam marks and percentage tracking
--  pomodoro_stats   Timer stats with streak tracking
--
--  All tables use ON DELETE CASCADE, meaning if a user account
--  is deleted, all their data is automatically deleted too.
-- ================================================================
