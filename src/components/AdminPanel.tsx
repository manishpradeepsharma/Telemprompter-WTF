import { useEffect, useState } from 'preact/hooks';
import { api, type User, type RecordingItem, type AdminUserItem } from '../domain/api';
import ScriptOrganizer from './ScriptOrganizer';

export default function AdminPanel(): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'scripts' | 'recordings' | 'users'>('scripts');

  // Recordings state
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user');

  // Reset password state
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [resetModalUserName, setResetModalUserName] = useState('');
  const [newPasswordValue, setNewPasswordValue] = useState('');

  // Status feedback
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    api.getAuth().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser?.role === 'admin') {
        loadRecordings();
        loadUsers();
      }
    });
  }, []);

  const loadRecordings = async () => {
    const recordingsData = await api.getRecordings();
    setRecordings(recordingsData.recordings);
  };

  const loadUsers = async () => {
    const usersData = await api.getUsers();
    setUsers(usersData);
  };

  const handleDeleteRecording = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording file from server filestore?'))
      return;
    const ok = await api.deleteRecording(id);
    if (ok) {
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      if (activeVideo?.includes(id)) setActiveVideo(null);
    }
  };

  const handleCreateUser = async (e: Event) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!createEmail.trim() || !createName.trim() || !createPassword.trim()) {
      setActionError('All fields are required.');
      return;
    }

    const res = await api.createUser({
      email: createEmail.trim(),
      name: createName.trim(),
      password: createPassword.trim(),
      role: createRole,
    });

    if (res.error) {
      setActionError(res.error);
      return;
    }

    if (res.user) {
      setUsers((prev) => [res.user!, ...prev]);
      setShowCreateModal(false);
      setCreateEmail('');
      setCreateName('');
      setCreatePassword('');
      setCreateRole('user');
      setActionSuccess(`User "${res.user.name}" created successfully.`);
      setTimeout(() => setActionSuccess(''), 4000);
    }
  };

  const handleRoleChange = async (targetUser: AdminUserItem, newRole: 'user' | 'admin') => {
    setActionError('');
    setActionSuccess('');

    const res = await api.updateUser(targetUser.id, { role: newRole });
    if (res.error) {
      setActionError(res.error);
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
    setActionSuccess(`Updated role for ${targetUser.name} to ${newRole.toUpperCase()}.`);
    setTimeout(() => setActionSuccess(''), 3000);
  };

  const handleResetPassword = async (e: Event) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!resetModalUserId || !newPasswordValue.trim()) {
      setActionError('Please provide a new password.');
      return;
    }

    const res = await api.updateUser(resetModalUserId, { password: newPasswordValue.trim() });
    if (res.error) {
      setActionError(res.error);
      return;
    }

    setResetModalUserId(null);
    setResetModalUserName('');
    setNewPasswordValue('');
    setActionSuccess('Password updated successfully.');
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const handleDeleteUser = async (targetUser: AdminUserItem) => {
    if (targetUser.id === user?.id) {
      alert('You cannot delete your own logged-in admin account.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete user "${targetUser.name}" (${targetUser.email})? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setActionError('');
    setActionSuccess('');
    const res = await api.deleteUser(targetUser.id);
    if (!res.success) {
      setActionError(res.error || 'Failed to delete user.');
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    setActionSuccess(`User "${targetUser.name}" has been deleted.`);
    setTimeout(() => setActionSuccess(''), 3000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return <div class="admin-loading">Verifying administrative access…</div>;
  }

  if (!user || user.role !== 'admin') {
    return (
      <div class="admin-unauthorized">
        <h2>Administrator Access Required</h2>
        <p>
          You must be logged in as an administrator to access the script and filestore management
          panel.
        </p>
        <div class="admin-unauthorized__actions">
          <a href="/login" class="button button--primary">
            Log in
          </a>
          <a href="/signup" class="button button--quiet">
            Sign up as Admin
          </a>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = searchUser.toLowerCase().trim();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const standardCount = users.filter((u) => u.role === 'user').length;

  return (
    <div class="admin-container admin-container--dense">
      <header class="admin-header admin-header--dense">
        <div class="admin-header__brand">
          <span class="auth-role-badge auth-role-badge--admin">Admin</span>
          <span class="admin-header__title">Workspace</span>
        </div>
        <div class="admin-nav-tabs">
          <button
            type="button"
            class={`admin-tab-btn ${tab === 'scripts' ? 'admin-tab-btn--active' : ''}`}
            onClick={() => setTab('scripts')}
          >
            Shared Scripts & Folders
          </button>
          <button
            type="button"
            class={`admin-tab-btn ${tab === 'recordings' ? 'admin-tab-btn--active' : ''}`}
            onClick={() => setTab('recordings')}
          >
            Server Recordings ({recordings.length})
          </button>
          <button
            type="button"
            class={`admin-tab-btn ${tab === 'users' ? 'admin-tab-btn--active' : ''}`}
            onClick={() => setTab('users')}
          >
            Manage Users ({users.length})
          </button>
        </div>
      </header>

      {tab === 'scripts' && (
        <div class="admin-section">
          <ScriptOrganizer mode="admin" currentUser={user} />
        </div>
      )}

      {tab === 'recordings' && (
        <div class="admin-section">
          {activeVideo && (
            <div class="admin-video-modal" onClick={() => setActiveVideo(null)}>
              <div class="admin-video-modal__content" onClick={(e) => e.stopPropagation()}>
                <video src={activeVideo} controls autoPlay />
                <button
                  type="button"
                  class="admin-video-modal__close"
                  onClick={() => setActiveVideo(null)}
                >
                  ✕ Close
                </button>
              </div>
            </div>
          )}

          <div class="admin-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h2>User Recordings in Server Filestore</h2>
                <p class="admin-card__desc" style={{ marginBottom: 0 }}>
                  All recordings uploaded by users from the teleprompter. Stored on server SQLite &
                  filestore folder.
                </p>
              </div>
              <a href="/recordings" class="button button--secondary button--small">
                🎬 View in Recordings Gallery
              </a>
            </div>

            {recordings.length === 0 ? (
              <p class="admin-empty">No recordings uploaded to server yet.</p>
            ) : (
              <div class="admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Category</th>
                      <th>User</th>
                      <th>Script / Title</th>
                      <th>Duration</th>
                      <th>Size</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordings.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <button
                            type="button"
                            class="admin-preview-btn"
                            onClick={() => setActiveVideo(rec.filepath)}
                          >
                            ▶ Play
                          </button>
                        </td>
                        <td>
                          <span class="organizer-badge-folder">
                            📁 {rec.folder_name || 'Uncategorized'}
                          </span>
                        </td>
                        <td>
                          <strong>{rec.user_name}</strong>
                          <small>{rec.user_email}</small>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--ink)' }}>
                            {rec.script_title || 'Untitled'}
                          </strong>
                          {rec.script_content && (
                            <small
                              style={{
                                color: 'var(--muted)',
                                display: 'block',
                                maxWidth: '280px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {rec.script_content}
                            </small>
                          )}
                          {rec.script_id && (
                            <a
                              href={`/scripts?id=${rec.script_id}`}
                              class="script-quick-link"
                              style={{ display: 'inline-block', marginTop: '0.2rem' }}
                            >
                              ↗ Original Script
                            </a>
                          )}
                        </td>
                        <td>{formatSeconds(rec.duration_seconds)}</td>
                        <td>{formatFileSize(rec.filesize)}</td>
                        <td>{new Date(rec.created_at).toLocaleString()}</td>
                        <td>
                          <div class="admin-row-actions">
                            <a
                              href={rec.filepath}
                              download={rec.filename}
                              class="button button--quiet button--small"
                            >
                              Download
                            </a>
                            <button
                              type="button"
                              class="admin-danger-btn"
                              onClick={() => handleDeleteRecording(rec.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div class="admin-section">
          {actionError && (
            <div class="auth-alert auth-alert--error" style={{ marginBottom: '1rem' }} role="alert">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div
              class="auth-alert auth-alert--success"
              style={{
                marginBottom: '1rem',
                background: '#ecfdf5',
                borderColor: '#a7f3d0',
                color: '#065f46',
              }}
              role="status"
            >
              ✓ {actionSuccess}
            </div>
          )}

          <div class="admin-stats-bar">
            <div class="admin-stat-card">
              <div class="admin-stat-card__label">Total Registered</div>
              <div class="admin-stat-card__value">{users.length}</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-card__label">Administrators</div>
              <div class="admin-stat-card__value">{adminCount}</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-card__label">Standard Users</div>
              <div class="admin-stat-card__value">{standardCount}</div>
            </div>
          </div>

          <div class="admin-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h2>Registered User Accounts</h2>
                <p class="admin-card__desc" style={{ marginBottom: 0 }}>
                  Manage access roles, create users, or reset credentials.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Filter users…"
                  value={searchUser}
                  onInput={(e) => setSearchUser((e.target as HTMLInputElement).value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.82rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    minWidth: '180px',
                  }}
                />
                <button
                  type="button"
                  class="button button--primary button--small"
                  onClick={() => {
                    setActionError('');
                    setShowCreateModal(true);
                  }}
                >
                  ➕ Add New User
                </button>
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <p class="admin-empty">No users match your search criteria.</p>
            ) : (
              <div class="admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>User Account</th>
                      <th>System Role</th>
                      <th>Scripts</th>
                      <th>Recordings</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isSelf = u.id === user.id;
                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>
                              {u.name}
                              {isSelf && <span class="admin-badge--you">You</span>}
                            </strong>
                            <small>{u.email}</small>
                          </td>
                          <td>
                            {isSelf ? (
                              <span class="auth-role-badge auth-role-badge--admin">Admin</span>
                            ) : (
                              <select
                                class="admin-role-select"
                                value={u.role}
                                onChange={(e) =>
                                  handleRoleChange(
                                    u,
                                    (e.target as HTMLSelectElement).value as 'user' | 'admin',
                                  )
                                }
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            )}
                          </td>
                          <td>{u.scripts_count ?? 0}</td>
                          <td>{u.recordings_count ?? 0}</td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>
                            <div class="admin-row-actions">
                              <button
                                type="button"
                                class="button button--quiet button--small"
                                onClick={() => {
                                  setActionError('');
                                  setResetModalUserId(u.id);
                                  setResetModalUserName(u.name);
                                  setNewPasswordValue('');
                                }}
                              >
                                Reset Password
                              </button>
                              <button
                                type="button"
                                class="admin-danger-btn"
                                disabled={isSelf}
                                title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                                style={{
                                  opacity: isSelf ? 0.4 : 1,
                                  cursor: isSelf ? 'not-allowed' : 'pointer',
                                }}
                                onClick={() => !isSelf && handleDeleteUser(u)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div class="organizer-modal" onClick={() => setShowCreateModal(false)}>
          <div
            class="organizer-modal__card"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="organizer-modal__header">
              <h3>Create New User</h3>
              <button
                type="button"
                class="organizer-modal__close"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser} class="organizer-modal__form">
              <label class="organizer-modal__label">
                <span>Display Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={createName}
                  onInput={(e) => setCreateName((e.target as HTMLInputElement).value)}
                />
              </label>

              <label class="organizer-modal__label">
                <span>Email or Username</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. john or john@example.com"
                  value={createEmail}
                  onInput={(e) => setCreateEmail((e.target as HTMLInputElement).value)}
                />
              </label>

              <label class="organizer-modal__label">
                <span>Password</span>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={createPassword}
                  onInput={(e) => setCreatePassword((e.target as HTMLInputElement).value)}
                />
              </label>

              <label class="organizer-modal__label">
                <span>Role</span>
                <select
                  value={createRole}
                  onChange={(e) =>
                    setCreateRole((e.target as HTMLSelectElement).value as 'user' | 'admin')
                  }
                  style={{
                    padding: '0.45rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    width: '100%',
                  }}
                >
                  <option value="user">User (Standard Access)</option>
                  <option value="admin">Administrator (Full Admin Access)</option>
                </select>
              </label>

              <div class="organizer-modal__actions" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  class="button button--quiet"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="button button--primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalUserId && (
        <div class="organizer-modal" onClick={() => setResetModalUserId(null)}>
          <div
            class="organizer-modal__card"
            style={{ maxWidth: '400px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="organizer-modal__header">
              <h3>Reset Password</h3>
              <button
                type="button"
                class="organizer-modal__close"
                onClick={() => setResetModalUserId(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleResetPassword} class="organizer-modal__form">
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 1rem 0' }}>
                Set a new password for user <strong>{resetModalUserName}</strong>:
              </p>
              <label class="organizer-modal__label">
                <span>New Password</span>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPasswordValue}
                  onInput={(e) => setNewPasswordValue((e.target as HTMLInputElement).value)}
                />
              </label>
              <div class="organizer-modal__actions" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  class="button button--quiet"
                  onClick={() => setResetModalUserId(null)}
                >
                  Cancel
                </button>
                <button type="submit" class="button button--primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
