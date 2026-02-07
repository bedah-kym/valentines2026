const Database = require('better-sqlite3');
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, 'db', 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unique_id TEXT UNIQUE NOT NULL,
    persona TEXT NOT NULL CHECK(persona IN ('fortune', 'achievement', 'letter')),
    sender_name TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    viewed_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_unique_id ON proposals(unique_id);
`);

// Query helpers
const queries = {
    create: db.prepare(`
    INSERT INTO proposals (unique_id, persona, sender_name, recipient_name, content)
    VALUES (@unique_id, @persona, @sender_name, @recipient_name, @content)
  `),

    getByUniqueId: db.prepare(`
    SELECT * FROM proposals WHERE unique_id = ?
  `),

    updateStatus: db.prepare(`
    UPDATE proposals SET status = ?, viewed_at = CURRENT_TIMESTAMP WHERE unique_id = ?
  `),

    markViewed: db.prepare(`
    UPDATE proposals SET viewed_at = CURRENT_TIMESTAMP WHERE unique_id = ? AND viewed_at IS NULL
  `)
};

module.exports = {
    db,
    queries
};
