import { useEffect, useState, useMemo } from 'preact/hooks';
import { api, type User, type RecordingItem, type FolderItem } from '../domain/api';

export default function UserRecordings(): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [activeScriptModal, setActiveScriptModal] = useState<RecordingItem | null>(null);

  // Filters and controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'duration_desc' | 'duration_asc' | 'title'
  >('newest');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('teleprompter_recordings_view_layout');
      if (saved === 'grid' || saved === 'list') return saved;
    }
    return 'list';
  });

  const handleSetViewLayout = (layout: 'grid' | 'list') => {
    setViewLayout(layout);
    if (typeof window !== 'undefined') {
      localStorage.setItem('teleprompter_recordings_view_layout', layout);
    }
  };

  useEffect(() => {
    api.getAuth().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        loadData();
      }
    });
  }, []);

  const loadData = async () => {
    try {
      const [recordingsData, foldersData] = await Promise.all([
        api.getRecordings(),
        api.getFolders(),
      ]);
      setRecordings(recordingsData.recordings || []);
      const allFolders = [...(foldersData.sharedFolders || []), ...(foldersData.myFolders || [])];
      setFolders(allFolders);
    } catch (err) {
      console.error('Failed to load recordings and folders:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording from server storage?')) return;
    const ok = await api.deleteRecording(id);
    if (ok) {
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      if (activeVideo?.includes(id)) setActiveVideo(null);
      if (activeScriptModal?.id === id) setActiveScriptModal(null);
    }
  };

  const handleReRecord = (rec: RecordingItem) => {
    const content = rec.script_content || rec.script_title || 'Teleprompter Session';
    localStorage.setItem('teleprompter_imported_script', content);
    if (rec.script_id) localStorage.setItem('teleprompter_active_script_id', rec.script_id);
    localStorage.setItem('teleprompter_active_title', rec.script_title || 'Teleprompter Session');
    localStorage.setItem('teleprompter_active_script_content', content);
    if (rec.folder_id) localStorage.setItem('teleprompter_active_folder_id', rec.folder_id);
    if (rec.folder_name) localStorage.setItem('teleprompter_active_folder_name', rec.folder_name);
    localStorage.setItem('teleprompter_autoplay', '1');
    window.location.href = '/?present=1';
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

  const getWordCountAndDuration = (text: string) => {
    const words = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const minutes = words / 130;
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return {
      words,
      duration: `${m ? `${m}m ` : ''}${s}s`,
    };
  };

  // Build list of folder categories with counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: recordings.length,
      UNCATEGORIZED: 0,
    };

    recordings.forEach((r) => {
      const fid = r.folder_id;
      if (!fid || fid === 'UNCATEGORIZED') {
        counts.UNCATEGORIZED = (counts.UNCATEGORIZED || 0) + 1;
      } else {
        counts[fid] = (counts[fid] || 0) + 1;
      }
    });

    return counts;
  }, [recordings]);

  // Unique folders present in recordings or folder list
  const availableFolders = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];

    // Add folders that exist
    folders.forEach((f) => {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        list.push({ id: f.id, name: f.name });
      }
    });

    // Also add any folder from recordings that might not be in folders list
    recordings.forEach((r) => {
      if (r.folder_id && !seen.has(r.folder_id)) {
        seen.add(r.folder_id);
        list.push({ id: r.folder_id, name: r.folder_name || 'Folder' });
      }
    });

    return list;
  }, [folders, recordings]);

  // Filtered & sorted recordings
  const filteredRecordings = useMemo(() => {
    const result = recordings.filter((r) => {
      // Folder category filter
      if (selectedFolderId === 'UNCATEGORIZED') {
        if (r.folder_id && r.folder_id !== 'UNCATEGORIZED') return false;
      } else if (selectedFolderId !== 'ALL') {
        if (r.folder_id !== selectedFolderId) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = (r.script_title || '').toLowerCase().includes(query);
        const contentMatch = (r.script_content || '').toLowerCase().includes(query);
        const folderMatch = (r.folder_name || '').toLowerCase().includes(query);
        if (!titleMatch && !contentMatch && !folderMatch) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'duration_desc') {
        return (b.duration_seconds || 0) - (a.duration_seconds || 0);
      }
      if (sortBy === 'duration_asc') {
        return (a.duration_seconds || 0) - (b.duration_seconds || 0);
      }
      if (sortBy === 'title') {
        return (a.script_title || '').localeCompare(b.script_title || '');
      }
      return 0;
    });

    return result;
  }, [recordings, selectedFolderId, searchQuery, sortBy]);

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
            Manage, review, and search videos recorded with the teleprompter. Access original
            scripts and re-record in one click.
          </p>
        </div>
        <div class="scripts-page-header__actions">
          <a href="/scripts" class="button button--secondary">
            📚 Script Library
          </a>
          <a href="/?present=1" class="button button--primary">
            ▶ Launch Teleprompter
          </a>
        </div>
      </header>

      {/* Video Modal Player */}
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

      {/* Full Script Modal */}
      {activeScriptModal && (
        <div class="organizer-modal" onClick={() => setActiveScriptModal(null)}>
          <div
            class="organizer-modal__card organizer-modal__card--script-reader"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="organizer-modal__header">
              <div>
                <span class="organizer-badge-folder">
                  📁 {activeScriptModal.folder_name || 'Uncategorized'}
                </span>
                <h2>{activeScriptModal.script_title || 'Untitled Script'}</h2>
              </div>
              <button
                type="button"
                class="organizer-modal__close"
                onClick={() => setActiveScriptModal(null)}
              >
                ✕
              </button>
            </div>

            <div class="recording-full-script-body">
              <div class="recording-full-script-text">
                {activeScriptModal.script_content ? (
                  activeScriptModal.script_content
                ) : (
                  <p class="admin-empty">No script text recorded for this session.</p>
                )}
              </div>
              {activeScriptModal.script_content && (
                <div class="script-modal-stats">
                  {(() => {
                    const stats = getWordCountAndDuration(activeScriptModal.script_content);
                    return (
                      <span>
                        Words: <strong>{stats.words}</strong> • Estimated reading time:{' '}
                        <strong>{stats.duration}</strong>
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            <div class="organizer-modal__actions">
              <button
                type="button"
                class="button button--secondary"
                onClick={() => setActiveScriptModal(null)}
              >
                Close
              </button>
              {activeScriptModal.script_id && (
                <a
                  href={`/scripts?id=${activeScriptModal.script_id}`}
                  class="button button--quiet"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ↗ Open in Script Library
                </a>
              )}
              <button
                type="button"
                class="button button--primary"
                onClick={() => handleReRecord(activeScriptModal)}
              >
                ▶ Re-record in Teleprompter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout: Sidebar & Content */}
      <div class="organizer-layout">
        {/* Left Category Sidebar */}
        <aside class="organizer-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-header__title-wrap">
              <h3>Categories</h3>
            </div>
            <span class="tree-badge">{recordings.length} Total</span>
          </div>

          <div class="tree-container">
            <div class="tree-scrollable">
              <div
                class={`tree-item ${selectedFolderId === 'ALL' ? 'tree-item--selected' : ''}`}
                onClick={() => setSelectedFolderId('ALL')}
                role="button"
                tabIndex={0}
              >
                <span class="tree-icon">🎬</span>
                <span class="tree-label">All Recordings</span>
                <span class="tree-badge">{folderCounts.ALL || 0}</span>
              </div>

              <div
                class={`tree-item ${selectedFolderId === 'UNCATEGORIZED' ? 'tree-item--selected' : ''}`}
                onClick={() => setSelectedFolderId('UNCATEGORIZED')}
                role="button"
                tabIndex={0}
              >
                <span class="tree-icon">📄</span>
                <span class="tree-label">Uncategorized</span>
                <span class="tree-badge">{folderCounts.UNCATEGORIZED || 0}</span>
              </div>

              {availableFolders.length > 0 && (
                <>
                  <div class="tree-divider">FOLDERS</div>
                  {availableFolders.map((folder) => {
                    const count = folderCounts[folder.id] || 0;
                    const isSelected = selectedFolderId === folder.id;
                    return (
                      <div
                        key={folder.id}
                        class={`tree-item ${isSelected ? 'tree-item--selected' : ''}`}
                        onClick={() => setSelectedFolderId(folder.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <span class="tree-icon">📁</span>
                        <span class="tree-label" title={folder.name}>
                          {folder.name}
                        </span>
                        <span class="tree-badge">{count}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main class="organizer-main">
          {/* Controls Bar: Search, Sort, Views */}
          <div class="organizer-controls">
            <div class="organizer-search-box">
              <span class="search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                type="text"
                placeholder={`Search ${recordings.length} recordings by title, script, or category...`}
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.currentTarget as HTMLInputElement).value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  class="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div class="organizer-filters">
              <div class="sort-selector">
                <label for="recordings-sort-select">Sort:</label>
                <select
                  id="recordings-sort-select"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      (e.currentTarget as HTMLSelectElement).value as
                        'newest' | 'oldest' | 'duration_desc' | 'duration_asc' | 'title',
                    )
                  }
                >
                  <option value="newest">Recently Recorded</option>
                  <option value="oldest">Oldest First</option>
                  <option value="duration_desc">Longest Duration</option>
                  <option value="duration_asc">Shortest Duration</option>
                  <option value="title">Alphabetical (A-Z)</option>
                </select>
              </div>

              <div class="view-mode-toggle" role="group" aria-label="View layout">
                <button
                  type="button"
                  class={`view-btn ${viewLayout === 'grid' ? 'view-btn--active' : ''}`}
                  onClick={() => handleSetViewLayout('grid')}
                  title="Grid view"
                >
                  ⊞ Grid
                </button>
                <button
                  type="button"
                  class={`view-btn ${viewLayout === 'list' ? 'view-btn--active' : ''}`}
                  onClick={() => handleSetViewLayout('list')}
                  title="List view"
                >
                  ☰ List
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div class="organizer-summary">
            <span>
              Showing <strong>{filteredRecordings.length}</strong> of{' '}
              <strong>{recordings.length}</strong> recordings
              {selectedFolderId !== 'ALL' && (
                <>
                  {' '}
                  in{' '}
                  <span class="summary-folder-pill">
                    {selectedFolderId === 'UNCATEGORIZED'
                      ? 'Uncategorized'
                      : availableFolders.find((f) => f.id === selectedFolderId)?.name || 'Category'}
                  </span>
                </>
              )}
            </span>
          </div>

          {/* Empty State */}
          {filteredRecordings.length === 0 ? (
            <div class="admin-card">
              <p class="admin-empty">
                {recordings.length === 0
                  ? 'No recordings uploaded yet. When you finish recording in the teleprompter, click Upload to Server to view and manage them here!'
                  : 'No recordings match your current search or category filter.'}
              </p>
              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                {recordings.length === 0 ? (
                  <a href="/?present=1" class="button button--primary">
                    ▶ Start Recording
                  </a>
                ) : (
                  <button
                    type="button"
                    class="button button--secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFolderId('ALL');
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          ) : viewLayout === 'grid' ? (
            /* Grid View */
            <div class="recordings-grid">
              {filteredRecordings.map((rec) => (
                <article key={rec.id} class="recording-card recording-card--rich">
                  <div
                    class="recording-card__video-wrap"
                    onClick={() => setActiveVideo(rec.filepath)}
                  >
                    <video src={rec.filepath} preload="metadata" />
                    <div class="recording-card__play-badge">▶ Play Video</div>
                  </div>

                  <div class="recording-card__body">
                    <div class="recording-card__header-row">
                      <span class="organizer-badge-folder">
                        📁 {rec.folder_name || 'Uncategorized'}
                      </span>
                      <time class="recording-card__date">
                        {new Date(rec.created_at).toLocaleDateString()}
                      </time>
                    </div>

                    <h3 class="recording-card__title">
                      {rec.script_title || 'Untitled Recording'}
                    </h3>

                    <div class="recording-card__meta-bar">
                      <span>⏱ {formatSeconds(rec.duration_seconds)}</span>
                      <span>📦 {formatFileSize(rec.filesize)}</span>
                    </div>

                    {/* Script Snippet & Link Section */}
                    <div class="recording-card__script-snippet">
                      <div class="recording-card__script-header">
                        <span class="snippet-label">Attached Script</span>
                        {rec.script_id && (
                          <a
                            href={`/scripts?id=${rec.script_id}`}
                            class="script-quick-link"
                            title="Open original script in library"
                          >
                            ↗ Original Script
                          </a>
                        )}
                      </div>
                      <p class="snippet-text">
                        {rec.script_content
                          ? rec.script_content.slice(0, 160) +
                            (rec.script_content.length > 160 ? '…' : '')
                          : 'No text recorded with this session.'}
                      </p>
                      {rec.script_content && (
                        <button
                          type="button"
                          class="view-script-link-btn"
                          onClick={() => setActiveScriptModal(rec)}
                        >
                          👁 Read Full Script
                        </button>
                      )}
                    </div>
                  </div>

                  <div class="recording-card__footer">
                    <button
                      type="button"
                      class="script-record-btn script-record-btn--sm"
                      title="Launch teleprompter with this script and re-record"
                      onClick={() => handleReRecord(rec)}
                    >
                      ▶ Re-record
                    </button>
                    <div class="recording-card__actions-group">
                      <a
                        href={rec.filepath}
                        download={rec.filename}
                        class="button button--small button--secondary"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        class="admin-danger-btn admin-danger-btn--sm"
                        onClick={() => handleDelete(rec.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            /* List View */
            <div class="admin-table-wrap">
              <table class="admin-table recordings-table">
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Category</th>
                    <th>Title & Script Snippet</th>
                    <th>Duration</th>
                    <th>Size</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecordings.map((rec) => (
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
                      <td class="td-script-details">
                        <strong class="rec-list-title">
                          {rec.script_title || 'Untitled Recording'}
                        </strong>
                        <p class="rec-list-snippet">
                          {rec.script_content
                            ? rec.script_content.slice(0, 120) +
                              (rec.script_content.length > 120 ? '…' : '')
                            : 'No text script'}
                        </p>
                        <div class="rec-list-links">
                          {rec.script_content && (
                            <button
                              type="button"
                              class="view-script-link-btn"
                              onClick={() => setActiveScriptModal(rec)}
                            >
                              👁 View Script
                            </button>
                          )}
                          {rec.script_id && (
                            <a href={`/scripts?id=${rec.script_id}`} class="script-quick-link">
                              ↗ Original Script
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <span class="meta-tag">⏱ {formatSeconds(rec.duration_seconds)}</span>
                      </td>
                      <td>
                        <span class="meta-tag">📦 {formatFileSize(rec.filesize)}</span>
                      </td>
                      <td>{new Date(rec.created_at).toLocaleDateString()}</td>
                      <td class="td-actions">
                        <button
                          type="button"
                          class="script-record-btn script-record-btn--sm"
                          title="Re-record in teleprompter"
                          onClick={() => handleReRecord(rec)}
                        >
                          ▶ Re-record
                        </button>
                        <a
                          href={rec.filepath}
                          download={rec.filename}
                          class="button button--small button--secondary"
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          class="admin-danger-btn admin-danger-btn--sm"
                          onClick={() => handleDelete(rec.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
