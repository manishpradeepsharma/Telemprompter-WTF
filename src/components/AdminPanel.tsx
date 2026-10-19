import { useEffect, useState } from 'preact/hooks';
import { api, type User, type RecordingItem } from '../domain/api';
import ScriptOrganizer from './ScriptOrganizer';

export default function AdminPanel(): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'scripts' | 'recordings'>('scripts');

  // Recordings state
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    api.getAuth().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser?.role === 'admin') {
        loadRecordings();
      }
    });
  }, []);

  const loadRecordings = async () => {
    const recordingsData = await api.getRecordings();
    setRecordings(recordingsData.recordings);
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
    </div>
  );
}
