import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'teleprompter.sqlite');
export const db = new DatabaseSync(dbPath);

// Initialize tables
db.exec(`
  PRAGMA journal_mode = WAL;
  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    is_shared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filesize INTEGER NOT NULL,
    mimetype TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    script_id TEXT,
    script_title TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_by TEXT NOT NULL,
    is_shared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migration: add folder_id to scripts if not present
try {
  db.exec(`ALTER TABLE scripts ADD COLUMN folder_id TEXT;`);
} catch {
  // Column already exists
}

// Migration: add script_content, folder_id, folder_name to recordings
try {
  db.exec(`ALTER TABLE recordings ADD COLUMN script_content TEXT;`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE recordings ADD COLUMN folder_id TEXT;`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE recordings ADD COLUMN folder_name TEXT;`);
} catch {
  // Column already exists
}
