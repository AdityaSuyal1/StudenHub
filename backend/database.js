// database.js — Turso (LibSQL) client
var { createClient } = require('@libsql/client');
var fs   = require('fs');
var path = require('path');

if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) {
  console.error('❌ Missing TURSO_URL or TURSO_TOKEN');
  process.exit(1);
}

var db = createClient({
  url:       process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN
});

async function initSchema() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    // Strip all comments, then split on semicolons
    const statements = schema
      .replace(/--[^\n]*/g, '')          // strip -- single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')  // strip /* block comments */
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement individually.
    // IMPORTANT: @libsql/client v0.6+ requires the `args` field to always be
    // present in the statement object — even for DDL with no parameters.
    // db.batch(..., 'write') triggers Turso's migration jobs API which returns
    // HTTP 400 on free-tier / standard databases, so we use execute() instead.
    for (const sql of statements) {
      await db.execute({ sql, args: [] });
    }

    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ Schema error:", err);
    process.exit(1);
  }
}

initSchema();

module.exports = db;
