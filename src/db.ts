import Database from 'better-sqlite3';
import { join } from 'node:path';

const db = new Database(join(process.cwd(), 'voxreport.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    isArchived INTEGER DEFAULT 0,
    originalFileName TEXT,
    filePath TEXT,
    transcription TEXT,
    summary TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// Migration for existing databases
try {
  db.prepare('ALTER TABLE reports ADD COLUMN progress INTEGER DEFAULT 0').run();
} catch {
  // Column might already exist
}
try {
  db.prepare('ALTER TABLE reports ADD COLUMN isArchived INTEGER DEFAULT 0').run();
} catch {
  // Column might already exist
}

export default db;
