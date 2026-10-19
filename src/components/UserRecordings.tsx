import { useEffect, useState } from 'preact/hooks';
import { api, type User, type RecordingItem } from '../domain/api';

export default function UserRecordings(): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    api.getAuth().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        loadRecordings();
      }
    });
  }, []);

  const loadRecordings = async () => {
    const data = await api.getRecordings();
    setRecordings(data.recordings);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording from server storage?')) return;
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
    return <div class="admin-loading">Loading your recordings…</div>;
  }

  if (!user) {
    return (
      <div class="admin-unauthorized">
        <h2>Log in to view recordings</h2>
        <p>Your uploaded video captures are stored securely in your server account.</p>
        <div class="admin-unauthorized__actions">
          <a href="/login" class="button button--primary">
            Log in
          </a>
          <a href="/signup" class="button button--quiet">
            Sign up
          </a>
        </div>
      </div>
    );
  }

  return (
    <div class="recordings-container">
      <header class="scripts-page-header">
        <div>
          <h1>My Saved Recordings</h1>
          <p>
            Manage and download videos recorded with the teleprompter and uploaded to server
            storage.
          </p>
        </div>
      </header>

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

      {recordings.length === 0 ? (
        <div class="admin-card">
          <p class="admin-empty">
            No recordings uploaded yet. When you record a video in the teleprompter, click{' '}
            <strong>Upload to Server</strong> in the preview screen to save it here!
          </p>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a href="/" class="button button--primary">
              Go to Teleprompter
            </a>
          </div>
        </div>
      ) : (
        <div class="recordings-grid">
          {recordings.map((rec) => (
            <article key={rec.id} class="recording-card">
              <div class="recording-card__video-wrap" onClick={() => setActiveVideo(rec.filepath)}>
                <video src={rec.filepath} preload="metadata" />
                <div class="recording-card__play-badge">▶ Play</div>
              </div>

              <div class="recording-card__body">
                <h3 class="recording-card__title">{rec.script_title || 'Untitled Recording'}</h3>
                <div class="recording-card__meta">
                  <span>⏱ {formatSeconds(rec.duration_seconds)}</span>
                  <span>📦 {formatFileSize(rec.filesize)}</span>
                  <span>📅 {new Date(rec.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div class="recording-card__footer">
                <a
                  href={rec.filepath}
                  download={rec.filename}
                  class="button button--primary button--small"
                >
                  Download
                </a>
                <button type="button" class="admin-danger-btn" onClick={() => handleDelete(rec.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
