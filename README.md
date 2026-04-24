# 🎓 StudenHub — Complete Version

**Stack:** Node.js + Express + SQLite + Plain HTML / CSS / JS

---

## 📁 Project Structure

```
studenhub/
│
├── backend/
│   ├── server.js        ← Express server — all API routes
│   ├── database.js      ← Opens SQLite DB and runs schema.sql
│   ├── schema.sql       ← All 10 tables + indexes
│   ├── package.json
│   └── data/
│       └── studenhub.db ← Created automatically on first run
│
└── public/              ← Served as static files by Express
    ├── index.html       ← Login / Register page
    │
    ├── pages/           ← One HTML file per page
    │   ├── dashboard.html
    │   ├── notes.html
    │   ├── timetable.html
    │   ├── assignments.html
    │   ├── planner.html
    │   ├── pyq.html
    │   ├── model.html
    │   ├── pomodoro.html
    │   ├── flashcards.html
    │   └── grades.html
    │
    ├── css/             ← One CSS file per page + shared style.css
    │   ├── style.css        (shared — used by every page)
    │   ├── dashboard.css
    │   ├── notes.css
    │   ├── timetable.css
    │   ├── assignments.css
    │   ├── planner.css
    │   ├── pyq.css
    │   ├── model.css
    │   ├── pomodoro.css
    │   ├── flashcards.css
    │   └── grades.css
    │
    └── js/              ← One JS file per page + shared api.js
        ├── api.js           (shared — Auth, api calls, showToast)
        ├── login.js
        ├── dashboard.js
        ├── notes.js
        ├── timetable.js
        ├── assignments.js
        ├── planner.js
        ├── pyq.js
        ├── model.js
        ├── pomodoro.js
        ├── flashcards.js
        └── grades.js
```

---

## 🚀 How to Run

```bash
cd backend
npm install
node server.js
```

Open **http://localhost:3000** in your browser.

The database file `data/studenhub.db` is created automatically on first run.
All 10 tables are created from `schema.sql`.

---

## 🗄️ Database Tables (schema.sql)

| Table | Stores |
|---|---|
| `users` | Name, email, bcrypt password, course |
| `notes` | Title, body, subject, colour tag |
| `assignments` | Title, subject, due date, priority, done flag |
| `timetable` | Subject, day, time slot, room, colour |
| `planner` | Personal daily study sessions |
| `pyq` | Previous year question papers |
| `model_papers` | Model / practice question papers |
| `flashcards` | Q&A cards with known/unknown score |
| `grades` | Exam marks + percentage calculation |
| `pomodoro_stats` | Timer totals + streak tracking |

All tables use `ON DELETE CASCADE` — deleting a user account removes all their data automatically.

---

## 📡 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/register` | Create account (auto-login) |
| POST | `/api/login` | Login, returns JWT |
| GET  | `/api/me` | Current user profile |
| GET  | `/api/dashboard` | All dashboard stats in one call |
| GET/POST/PATCH/DELETE | `/api/notes` | Notes CRUD |
| GET/POST/PATCH/DELETE | `/api/assignments` | Assignments CRUD + toggle |
| GET/POST/DELETE | `/api/timetable` | Timetable CRUD |
| GET/POST/DELETE | `/api/planner` | Study planner CRUD |
| GET/POST/DELETE | `/api/pyq` | PYQ CRUD |
| GET/POST/DELETE | `/api/model-papers` | Model papers CRUD |
| GET/POST/PATCH/DELETE | `/api/flashcards` | Flashcards CRUD + mark |
| GET/POST/DELETE | `/api/grades` | Grades CRUD |
| GET/POST | `/api/pomodoro` | Pomodoro stats + record session |

All routes except `/api/register` and `/api/login` require a JWT in the `Authorization: Bearer <token>` header.
