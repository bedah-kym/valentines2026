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
    reveal_at DATETIME,
    passphrase_hash TEXT,
    passphrase_salt TEXT,
    payment_status TEXT,
    paid_at DATETIME,
    payment_reference TEXT,
    payment_provider TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
    response_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    viewed_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_unique_id ON proposals(unique_id);
`);

// Migration: Add response_note if it doesn't exist
try {
  const tableInfo = db.pragma('table_info(proposals)');
  const hasNoteColumn = tableInfo.some(col => col.name === 'response_note');
  if (!hasNoteColumn) {
    db.exec('ALTER TABLE proposals ADD COLUMN response_note TEXT');
    console.log('Migrated: Added response_note column');
  }

  const hasRevealAt = tableInfo.some(col => col.name === 'reveal_at');
  if (!hasRevealAt) {
    db.exec('ALTER TABLE proposals ADD COLUMN reveal_at DATETIME');
    console.log('Migrated: Added reveal_at column');
  }

  const hasPassphrase = tableInfo.some(col => col.name === 'passphrase_hash');
  if (!hasPassphrase) {
    db.exec('ALTER TABLE proposals ADD COLUMN passphrase_hash TEXT');
    console.log('Migrated: Added passphrase_hash column');
  }

  const hasPassphraseSalt = tableInfo.some(col => col.name === 'passphrase_salt');
  if (!hasPassphraseSalt) {
    db.exec('ALTER TABLE proposals ADD COLUMN passphrase_salt TEXT');
    console.log('Migrated: Added passphrase_salt column');
  }

  const hasPaymentStatus = tableInfo.some(col => col.name === 'payment_status');
  if (!hasPaymentStatus) {
    db.exec('ALTER TABLE proposals ADD COLUMN payment_status TEXT');
    console.log('Migrated: Added payment_status column');
  }

  const hasPaidAt = tableInfo.some(col => col.name === 'paid_at');
  if (!hasPaidAt) {
    db.exec('ALTER TABLE proposals ADD COLUMN paid_at DATETIME');
    console.log('Migrated: Added paid_at column');
  }

  const hasPaymentRef = tableInfo.some(col => col.name === 'payment_reference');
  if (!hasPaymentRef) {
    db.exec('ALTER TABLE proposals ADD COLUMN payment_reference TEXT');
    console.log('Migrated: Added payment_reference column');
  }

  const hasPaymentProvider = tableInfo.some(col => col.name === 'payment_provider');
  if (!hasPaymentProvider) {
    db.exec('ALTER TABLE proposals ADD COLUMN payment_provider TEXT');
    console.log('Migrated: Added payment_provider column');
  }
} catch (err) {
  console.error('Migration error:', err);
}

// Query helpers
const queries = {
  create: db.prepare(`
    INSERT INTO proposals (unique_id, persona, sender_name, recipient_name, content, reveal_at, passphrase_hash, passphrase_salt)
    VALUES (@unique_id, @persona, @sender_name, @recipient_name, @content, @reveal_at, @passphrase_hash, @passphrase_salt)
  `),

  getByUniqueId: db.prepare(`
    SELECT * FROM proposals WHERE unique_id = ?
  `),

  updateStatus: db.prepare(`
    UPDATE proposals SET status = ?, response_note = ?, viewed_at = CURRENT_TIMESTAMP WHERE unique_id = ?
  `),

  markViewed: db.prepare(`
    UPDATE proposals SET viewed_at = CURRENT_TIMESTAMP WHERE unique_id = ? AND viewed_at IS NULL
  `),

  updatePayment: db.prepare(`
    UPDATE proposals
    SET payment_status = ?, paid_at = ?, payment_reference = ?, payment_provider = ?
    WHERE unique_id = ?
  `)
};

module.exports = {
  db,
  queries
};
