import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, unlinkSync, readFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import { db } from './db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 4322;
const filestoreDir = join(__dirname, '../filestore');
if (!existsSync(filestoreDir)) {
  mkdirSync(filestoreDir, { recursive: true });
}

// Multer storage for recording files
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, filestoreDir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || (file.mimetype.includes('mp4') ? '.mp4' : '.webm');
    const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    cb(null, `recording-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve filestore files directly
app.use('/filestore', express.static(filestoreDir));

// Health check endpoint for Docker & monitoring
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

// Helper: password hashing & verification
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(keyBuffer, derivedKey);
}

// Seed or synchronize default admin account (admin / TPrompt123)
function seedDefaultAdmin() {
  try {
    const adminUser = (process.env.ADMIN_USER || 'admin').trim();
    const adminPass = process.env.ADMIN_PASSWORD || 'TPrompt123';
    const hash = hashPassword(adminPass);
    const now = new Date().toISOString();

    const existing = db
      .prepare('SELECT id, email, name, role FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?')
      .get(adminUser.toLowerCase(), adminUser.toLowerCase());

    if (!existing) {
      const id = 'admin-default-root';
      db.prepare(
        `
        INSERT INTO users (id, email, name, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, 'admin', ?)
      `,
      ).run(id, adminUser.toLowerCase(), adminUser, hash, now);
      console.log(`[Admin Seed] Initialized default administrator '${adminUser}'`);
    } else {
      // Ensure password matches and role is admin
      db.prepare(
        `
        UPDATE users
        SET password_hash = ?, role = 'admin'
        WHERE id = ?
      `,
      ).run(hash, existing.id);
      console.log(
        `[Admin Seed] Synchronized default administrator '${existing.name || adminUser}'`,
      );
    }
  } catch (err) {
    console.error('[Admin Seed] Error synchronizing default admin account:', err);
  }
}
seedDefaultAdmin();

// Organization sharing: ensure all folders and scripts are shared across the company
try {
  db.exec(`
    UPDATE folders SET is_shared = 1 WHERE is_shared = 0;
    UPDATE scripts SET is_shared = 1 WHERE is_shared = 0;
  `);
} catch (err) {
  console.error('Error synchronizing organization shared items:', err);
}

function isDockerOrBridgeIp(ip) {
  if (!ip) return false;
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    // 172.16.0.0 - 172.31.255.255 (Standard Docker bridge subnets)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 10.0.2.x (VirtualBox / WSL NAT)
    if (parts[0] === 10 && parts[1] === 0 && parts[2] === 2) return true;
    // 192.168.65.x (Docker Desktop VM NAT)
    if (parts[0] === 192 && parts[1] === 168 && parts[2] === 65) return true;
  }
  return false;
}

// Helper: detect local LAN IP
function getLanIp(reqHost) {
  const envIp = (process.env.LAN_IP || process.env.HOST_IP || '').trim();
  if (envIp) {
    return envIp;
  }

  // If request host is an actual LAN IP (e.g. user loaded page via 192.168.x.x)
  if (reqHost) {
    const cleanHost = reqHost.split(':')[0].trim();
    if (
      cleanHost &&
      cleanHost !== 'localhost' &&
      cleanHost !== '127.0.0.1' &&
      !isDockerOrBridgeIp(cleanHost) &&
      /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost)
    ) {
      return cleanHost;
    }
  }

  const interfaces = os.networkInterfaces();
  let candidate = null;
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isDockerOrBridgeIp(iface.address)) {
          return iface.address;
        }
        if (!candidate) candidate = iface.address;
      }
    }
  }
  return candidate || '192.168.1.5';
}

app.get('/api/lan-info', (req, res) => {
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
  const lanIp = getLanIp(forwardedHost);
  const isDockerIp = isDockerOrBridgeIp(lanIp);
  const httpPort = 4321;
  const httpsPort = 4323;
  const sslKeyPath = join(__dirname, '../ssl/key.pem');
  const sslCertPath = join(__dirname, '../ssl/cert.pem');
  const hasHttps = existsSync(sslKeyPath) && existsSync(sslCertPath);
  res.json({
    lanIp,
    isDockerIp,
    httpPort,
    httpsPort,
    hasHttps,
    lanUrl: hasHttps ? `https://${lanIp}:${httpsPort}` : `http://${lanIp}:${httpPort}`,
    httpUrl: `http://${lanIp}:${httpPort}`,
    httpsUrl: `https://${lanIp}:${httpsPort}`,
  });
});

// Helper: parse cookies from header
function getSessionToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookieHeader = req.headers['cookie'];
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/tp_token=([^;]+)/);
  return match ? match[1] : null;
}

// Helper: get current user from session token
function getCurrentUser(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT users.id, users.email, users.name, users.role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `);
  const row = stmt.get(token, new Date().toISOString());
  return row || null;
}

// ---------------- AUTH ROUTES ----------------

// Sign up
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const userRole = role === 'admin' ? 'admin' : 'user';

    // Check existing
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const userId = randomBytes(12).toString('hex');
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO users (id, email, name, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(userId, cleanEmail, name.trim(), passwordHash, userRole, now);

    // Create session (valid 30 days)
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
    ).run(token, userId, expiresAt, now);

    res.setHeader(
      'Set-Cookie',
      `tp_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    );
    return res.status(201).json({
      token,
      user: { id: userId, email: cleanEmail, name: name.trim(), role: userRole },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Username or email and password are required' });
    }
    const cleanIdentifier = email.trim().toLowerCase();
    const user = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?')
      .get(cleanIdentifier, cleanIdentifier);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const token = randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      `
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
    ).run(token, user.id, expiresAt, now);

    res.setHeader(
      'Set-Cookie',
      `tp_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    );
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.setHeader('Set-Cookie', 'tp_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res.json({ ok: true });
});

// Current User
app.get('/api/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  return res.json({ user });
});

// ---------------- ADMIN USER MANAGEMENT ROUTES ----------------

// Get all users (Admin only)
app.get('/api/admin/users', (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    const users = db
      .prepare(
        `
      SELECT 
        users.id, 
        users.email, 
        users.name, 
        users.role, 
        users.created_at,
        (SELECT COUNT(*) FROM scripts WHERE scripts.created_by = users.id) as scripts_count,
        (SELECT COUNT(*) FROM recordings WHERE recordings.user_id = users.id) as recordings_count
      FROM users
      ORDER BY users.created_at DESC
    `,
      )
      .all();

    return res.json({ users });
  } catch (error) {
    console.error('Fetch users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user (Admin only)
app.post('/api/admin/users', (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email/username, name, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const userRole = role === 'admin' ? 'admin' : 'user';

    const existing = db
      .prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?')
      .get(cleanEmail, cleanName.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    const userId = randomBytes(12).toString('hex');
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO users (id, email, name, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(userId, cleanEmail, cleanName, passwordHash, userRole, now);

    return res.status(201).json({
      user: {
        id: userId,
        email: cleanEmail,
        name: cleanName,
        role: userRole,
        created_at: now,
        scripts_count: 0,
        recordings_count: 0,
      },
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user role, name, or reset password (Admin only)
app.patch('/api/admin/users/:id', (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    const { id } = req.params;
    const { role, name, password } = req.body;

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protect against demoting oneself if you are the only admin
    if (targetUser.id === currentUser.id && role && role !== 'admin') {
      const adminCount = db
        .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
        .get();
      if (adminCount.count <= 1) {
        return res
          .status(400)
          .json({ error: 'Cannot demote the only remaining administrator account' });
      }
    }

    let updatedHash = targetUser.password_hash;
    if (password && password.trim()) {
      updatedHash = hashPassword(password.trim());
    }

    const updatedRole = role === 'admin' || role === 'user' ? role : targetUser.role;
    const updatedName = name && name.trim() ? name.trim() : targetUser.name;

    db.prepare(
      `
      UPDATE users
      SET role = ?, name = ?, password_hash = ?
      WHERE id = ?
    `,
    ).run(updatedRole, updatedName, updatedHash, id);

    return res.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: updatedName,
        role: updatedRole,
        created_at: targetUser.created_at,
      },
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only)
app.delete('/api/admin/users/:id', (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    const { id } = req.params;
    if (id === currentUser.id) {
      return res.status(400).json({ error: 'Cannot delete your own active administrator account' });
    }

    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    return res.json({ ok: true, deletedId: id });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ---------------- FOLDER ROUTES ----------------

// Get folders (all folders in company organization)
app.get('/api/folders', (_req, res) => {
  try {
    const folders = db
      .prepare(
        `
      SELECT id, name, parent_id, created_by, is_shared, created_at
      FROM folders
      ORDER BY name ASC
    `,
      )
      .all();

    return res.json({ sharedFolders: folders, myFolders: [] });
  } catch (error) {
    console.error('Fetch folders error:', error);
    return res.status(500).json({ error: 'Failed to load folders' });
  }
});

// Create folder
app.post('/api/folders', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please log in to create folders' });
    }
    const { name, parent_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folderId = randomBytes(10).toString('hex');
    const shared = 1; // All folders in company organization are shared
    const parentId = parent_id && parent_id.trim() ? parent_id.trim() : null;
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO folders (id, name, parent_id, created_by, is_shared, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(folderId, name.trim(), parentId, user.id, shared, now);

    return res.status(201).json({
      id: folderId,
      name: name.trim(),
      parent_id: parentId,
      created_by: user.id,
      is_shared: shared,
      created_at: now,
    });
  } catch (error) {
    console.error('Create folder error:', error);
    return res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Update folder (rename or move under another parent)
app.put('/api/folders/:id', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to update folders' });

    const { id } = req.params;
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    const { name, parent_id } = req.body;
    const newName = name !== undefined ? name.trim() : folder.name;
    const newParent =
      parent_id !== undefined
        ? parent_id && parent_id.trim()
          ? parent_id.trim()
          : null
        : folder.parent_id;

    if (!newName) {
      return res.status(400).json({ error: 'Folder name cannot be empty' });
    }

    // Prevent circular parenting
    if (newParent === id) {
      return res.status(400).json({ error: 'Folder cannot be its own parent' });
    }

    db.prepare(
      `
      UPDATE folders
      SET name = ?, parent_id = ?
      WHERE id = ?
    `,
    ).run(newName, newParent, id);

    return res.json({ ok: true, id, name: newName, parent_id: newParent });
  } catch (error) {
    console.error('Update folder error:', error);
    return res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Delete folder
app.delete('/api/folders/:id', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to delete folders' });

    const { id } = req.params;
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    // Unassign scripts in this folder (keep scripts, remove folder association)
    db.prepare('UPDATE scripts SET folder_id = NULL WHERE folder_id = ?').run(id);

    // Promote child folders to parent's parent
    db.prepare('UPDATE folders SET parent_id = ? WHERE parent_id = ?').run(folder.parent_id, id);

    // Delete folder
    db.prepare('DELETE FROM folders WHERE id = ?').run(id);

    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    return res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// ---------------- SCRIPT ROUTES ----------------

// Get scripts (all scripts in company organization)
app.get('/api/scripts', (_req, res) => {
  try {
    const scripts = db
      .prepare(
        `
      SELECT id, title, content, created_by, creator_name, is_shared, folder_id, created_at, updated_at
      FROM scripts
      ORDER BY updated_at DESC
    `,
      )
      .all();

    return res.json({ sharedScripts: scripts, myScripts: [] });
  } catch (error) {
    console.error('Fetch scripts error:', error);
    return res.status(500).json({ error: 'Failed to load scripts' });
  }
});

// Create script
app.post('/api/scripts', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please log in to save scripts' });
    }
    const { title, content, folder_id } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Script title and content are required' });
    }

    const shared = 1; // All scripts in company organization are shared
    const folderId = folder_id && folder_id.trim() ? folder_id.trim() : null;
    const scriptId = randomBytes(10).toString('hex');
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO scripts (id, title, content, created_by, creator_name, is_shared, folder_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(scriptId, title.trim(), content.trim(), user.id, user.name, shared, folderId, now, now);

    return res.status(201).json({
      id: scriptId,
      title: title.trim(),
      content: content.trim(),
      created_by: user.id,
      creator_name: user.name,
      is_shared: shared,
      folder_id: folderId,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    console.error('Create script error:', error);
    return res.status(500).json({ error: 'Failed to create script' });
  }
});

// Update script
app.put('/api/scripts/:id', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to update scripts' });

    const { id } = req.params;
    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
    if (!script) return res.status(404).json({ error: 'Script not found' });

    const { title, content, folder_id } = req.body;
    const folderId =
      folder_id !== undefined
        ? folder_id && folder_id.trim()
          ? folder_id.trim()
          : null
        : script.folder_id;
    const now = new Date().toISOString();

    db.prepare(
      `
      UPDATE scripts
      SET title = ?, content = ?, is_shared = 1, folder_id = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(
      title ? title.trim() : script.title,
      content ? content.trim() : script.content,
      folderId,
      now,
      id,
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('Update script error:', error);
    return res.status(500).json({ error: 'Failed to update script' });
  }
});

// Batch move scripts to folder
app.post('/api/scripts/move-batch', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to move scripts' });

    const { script_ids, folder_id } = req.body;
    if (!Array.isArray(script_ids) || script_ids.length === 0) {
      return res.status(400).json({ error: 'script_ids must be a non-empty array' });
    }

    const targetFolderId = folder_id && folder_id.trim() ? folder_id.trim() : null;
    const now = new Date().toISOString();

    let updatedCount = 0;
    const stmt = db.prepare('UPDATE scripts SET folder_id = ?, updated_at = ? WHERE id = ?');

    for (const sid of script_ids) {
      const result = stmt.run(targetFolderId, now, sid);
      if (result.changes > 0) updatedCount++;
    }

    return res.json({ ok: true, count: updatedCount });
  } catch (error) {
    console.error('Batch move scripts error:', error);
    return res.status(500).json({ error: 'Failed to batch move scripts' });
  }
});

// Delete script
app.delete('/api/scripts/:id', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to delete scripts' });

    const { id } = req.params;
    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
    if (!script) return res.status(404).json({ error: 'Script not found' });

    db.prepare('DELETE FROM scripts WHERE id = ?').run(id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete script error:', error);
    return res.status(500).json({ error: 'Failed to delete script' });
  }
});

// ---------------- RECORDINGS ROUTES ----------------

// Upload recording to server
app.post('/api/recordings/upload', upload.single('video'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      // If file was uploaded by multer, clean it up
      if (req.file) unlinkSync(req.file.path);
      return res.status(401).json({ error: 'Please log in to upload recordings' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { scriptId, scriptTitle, scriptContent, folderId, folderName, durationSeconds } =
      req.body;
    const recordingId = randomBytes(12).toString('hex');
    const now = new Date().toISOString();

    let resolvedContent = scriptContent || '';
    let resolvedFolderId = folderId || null;
    let resolvedFolderName = folderName || null;
    let resolvedTitle = scriptTitle || 'Untitled Script';

    if (scriptId) {
      try {
        const scriptRow = db
          .prepare('SELECT title, content, folder_id FROM scripts WHERE id = ?')
          .get(scriptId);
        if (scriptRow) {
          if (!resolvedContent) resolvedContent = scriptRow.content;
          if (!resolvedFolderId) resolvedFolderId = scriptRow.folder_id;
          if (!resolvedTitle || resolvedTitle === 'Teleprompter Session')
            resolvedTitle = scriptRow.title;
        }
      } catch (err) {
        console.warn('Could not query script row:', err);
      }
    }

    if (resolvedFolderId && !resolvedFolderName) {
      try {
        const folderRow = db.prepare('SELECT name FROM folders WHERE id = ?').get(resolvedFolderId);
        if (folderRow) resolvedFolderName = folderRow.name;
      } catch (err) {
        console.warn('Could not query folder row:', err);
      }
    }

    db.prepare(
      `
      INSERT INTO recordings (
        id, filename, original_name, filepath, filesize, mimetype,
        duration_seconds, script_id, script_title, script_content, folder_id, folder_name,
        user_id, user_name, user_email, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      recordingId,
      req.file.filename,
      req.file.originalname,
      `/filestore/${req.file.filename}`,
      req.file.size,
      req.file.mimetype,
      parseInt(durationSeconds, 10) || 0,
      scriptId || null,
      resolvedTitle,
      resolvedContent || null,
      resolvedFolderId || null,
      resolvedFolderName || 'Uncategorized',
      user.id,
      user.name,
      user.email,
      now,
    );

    return res.status(201).json({
      id: recordingId,
      filename: req.file.filename,
      url: `/filestore/${req.file.filename}`,
      filesize: req.file.size,
      duration_seconds: parseInt(durationSeconds, 10) || 0,
      script_id: scriptId || null,
      script_title: resolvedTitle,
      script_content: resolvedContent || null,
      folder_id: resolvedFolderId || null,
      folder_name: resolvedFolderName || 'Uncategorized',
      created_at: now,
    });
  } catch (error) {
    console.error('Upload recording error:', error);
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Failed to upload recording' });
  }
});

// Get recordings (admin gets all, user gets their own)
app.get('/api/recordings', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const query = `
      SELECT 
        r.*,
        COALESCE(r.script_content, s.content, '') AS script_content,
        COALESCE(r.folder_id, s.folder_id, '') AS folder_id,
        COALESCE(r.folder_name, f.name, 'Uncategorized') AS folder_name,
        s.id AS live_script_id
      FROM recordings r
      LEFT JOIN scripts s ON r.script_id = s.id
      LEFT JOIN folders f ON COALESCE(r.folder_id, s.folder_id) = f.id
    `;

    let recordings;
    if (user.role === 'admin') {
      recordings = db.prepare(`${query} ORDER BY r.created_at DESC`).all();
    } else {
      recordings = db
        .prepare(`${query} WHERE r.user_id = ? ORDER BY r.created_at DESC`)
        .all(user.id);
    }

    return res.json({ recordings, role: user.role });
  } catch (error) {
    console.error('Fetch recordings error:', error);
    return res.status(500).json({ error: 'Failed to load recordings' });
  }
});

// Delete recording
app.delete('/api/recordings/:id', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    if (user.role !== 'admin' && recording.user_id !== user.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Remove from filestore disk
    const diskPath = join(filestoreDir, recording.filename);
    if (existsSync(diskPath)) {
      unlinkSync(diskPath);
    }

    db.prepare('DELETE FROM recordings WHERE id = ?').run(id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete recording error:', error);
    return res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// ---------------- FINAL CUTS (EDITED VIDEOS) ROUTES ----------------

// Upload edited final cut
app.post('/api/final-cuts/upload', upload.single('video'), (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      if (req.file) unlinkSync(req.file.path);
      return res.status(401).json({ error: 'Please log in to upload final cuts' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const {
      title,
      folderId,
      folderName,
      scriptId,
      scriptTitle,
      platformTag,
      notes,
      durationSeconds,
    } = req.body;

    const cutId = randomBytes(12).toString('hex');
    const now = new Date().toISOString();
    const resolvedTitle = (title && title.trim()) || req.file.originalname.replace(/\.[^/.]+$/, '');
    let resolvedFolderName = folderName || 'Uncategorized';

    if (folderId && (!folderName || folderName === 'Uncategorized')) {
      try {
        const folderRow = db.prepare('SELECT name FROM folders WHERE id = ?').get(folderId);
        if (folderRow) resolvedFolderName = folderRow.name;
      } catch (err) {
        console.warn('Could not query folder row:', err);
      }
    }

    db.prepare(
      `
      INSERT INTO final_cuts (
        id, title, filename, original_name, filepath, filesize, mimetype,
        duration_seconds, folder_id, folder_name, script_id, script_title,
        platform_tag, notes, user_id, user_name, user_email, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      cutId,
      resolvedTitle,
      req.file.filename,
      req.file.originalname,
      `/filestore/${req.file.filename}`,
      req.file.size,
      req.file.mimetype,
      parseInt(durationSeconds, 10) || 0,
      folderId || null,
      resolvedFolderName,
      scriptId || null,
      scriptTitle || null,
      platformTag || 'all',
      notes || '',
      user.id,
      user.name,
      user.email,
      now,
    );

    return res.status(201).json({
      id: cutId,
      title: resolvedTitle,
      filename: req.file.filename,
      url: `/filestore/${req.file.filename}`,
      filesize: req.file.size,
      mimetype: req.file.mimetype,
      duration_seconds: parseInt(durationSeconds, 10) || 0,
      folder_id: folderId || null,
      folder_name: resolvedFolderName,
      script_id: scriptId || null,
      script_title: scriptTitle || null,
      platform_tag: platformTag || 'all',
      notes: notes || '',
      user_id: user.id,
      user_name: user.name,
      created_at: now,
    });
  } catch (error) {
    console.error('Upload final cut error:', error);
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Failed to upload final cut' });
  }
});

// Get all final cuts (team library)
app.get('/api/final-cuts', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const query = `
      SELECT 
        fc.*,
        COALESCE(fc.folder_name, f.name, 'Uncategorized') AS folder_name
      FROM final_cuts fc
      LEFT JOIN folders f ON fc.folder_id = f.id
      ORDER BY fc.created_at DESC
    `;

    const finalCuts = db.prepare(query).all();
    return res.json({ finalCuts, role: user.role });
  } catch (error) {
    console.error('Fetch final cuts error:', error);
    return res.status(500).json({ error: 'Failed to load final cuts' });
  }
});

// Delete final cut
app.delete('/api/final-cuts/:id', (req, res) => {
  try {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const cut = db.prepare('SELECT * FROM final_cuts WHERE id = ?').get(id);
    if (!cut) return res.status(404).json({ error: 'Final cut not found' });

    if (user.role !== 'admin' && cut.user_id !== user.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const diskPath = join(filestoreDir, cut.filename);
    if (existsSync(diskPath)) {
      unlinkSync(diskPath);
    }

    db.prepare('DELETE FROM final_cuts WHERE id = ?').run(id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete final cut error:', error);
    return res.status(500).json({ error: 'Failed to delete final cut' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT} (accessible via LAN)`);
  console.log(`Filestore directory: ${filestoreDir}`);
});

// Optional HTTPS Gateway for Mobile Device Camera Permissions
const sslKeyPath = join(__dirname, '../ssl/key.pem');
const sslCertPath = join(__dirname, '../ssl/cert.pem');
const WEB_HOST = process.env.WEB_HOST || '127.0.0.1';
const WEB_PORT = process.env.WEB_PORT ? parseInt(process.env.WEB_PORT, 10) : 4321;

if (existsSync(sslKeyPath) && existsSync(sslCertPath)) {
  try {
    const httpsGateway = https.createServer(
      {
        key: readFileSync(sslKeyPath),
        cert: readFileSync(sslCertPath),
      },
      (req, res) => {
        // Forward to frontend server
        const proxyReq = http.request(
          {
            hostname: WEB_HOST,
            port: WEB_PORT,
            path: req.url,
            method: req.method,
            headers: {
              ...req.headers,
              'x-forwarded-proto': 'https',
              host: req.headers.host,
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          },
        );
        proxyReq.on('error', (err) => {
          res.writeHead(502);
          res.end('HTTPS Mobile Gateway error: ' + err.message);
        });
        req.pipe(proxyReq, { end: true });
      },
    );

    httpsGateway.on('upgrade', (req, socket) => {
      const proxyReq = http.request({
        hostname: WEB_HOST,
        port: WEB_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers,
      });
      proxyReq.on('upgrade', (proxyRes, proxySocket) => {
        socket.write(
          `HTTP/1.1 101 Switching Protocols\r\n` +
            Object.entries(proxyRes.headers)
              .map(([k, v]) => `${k}: ${v}\r\n`)
              .join('') +
            '\r\n',
        );
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });
      proxyReq.on('error', () => {
        socket.destroy();
      });
      proxyReq.end();
    });

    httpsGateway.listen(4323, '0.0.0.0', () => {
      console.log('HTTPS Mobile Gateway listening on https://0.0.0.0:4323 (Enables Mobile Camera)');
    });
  } catch (err) {
    console.warn('Could not start HTTPS Mobile Gateway:', err.message);
  }
}
