import { useEffect, useState, useMemo, useRef } from 'preact/hooks';
import { api, type User, type FinalCutItem, type FolderItem, type ScriptItem } from '../domain/api';

/* Professional SVG Icons */
const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const VideoCameraIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const BookOpenIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    <path d="M6 6h10" />
    <path d="M6 10h10" />
  </svg>
);

const FilmReelIcon = () => (
  <svg
    class="tree-svg-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="2.5" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);

const FileDocumentIcon = () => (
  <svg
    class="tree-svg-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const FolderIcon = () => (
  <svg
    class="tree-svg-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const SmartphoneIcon = () => (
  <svg
    class="tree-svg-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="2" width="14" height="20" rx="2.5" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const MonitorPlayIcon = () => (
  <svg
    class="tree-svg-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <polygon points="10 8 15 10 10 12 10 8" fill="currentColor" stroke="none" />
  </svg>
);

const LinkedInIcon = () => (
  <svg
    class="tree-svg-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="3" />
    <line x1="8" y1="11" x2="8" y2="17" />
    <circle cx="8" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    <path d="M12 17v-3.5a2 2 0 0 1 4 0V17" />
    <line x1="12" y1="11" x2="12" y2="17" />
  </svg>
);

const MusicNoteIcon = () => (
  <svg
    class="tree-svg-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ListIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const GridIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const PlayIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-hidden="true"
  >
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CopyIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SparkleIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2l2.4 7.4L22 12l-7.6 2.6L12 22l-2.4-7.4L2 12l7.6-2.6z" />
  </svg>
);

export default function FinalCutsOrganizer(): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalCuts, setFinalCuts] = useState<FinalCutItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);

  // Filters and controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'duration_desc' | 'duration_asc' | 'title'
  >('newest');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('teleprompter_final_cuts_view_layout');
      if (saved === 'grid' || saved === 'list') return saved;
    }
    return 'list';
  });

  const handleSetViewLayout = (layout: 'grid' | 'list') => {
    setViewLayout(layout);
    if (typeof window !== 'undefined') {
      localStorage.setItem('teleprompter_final_cuts_view_layout', layout);
    }
  };

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState('');
  const [uploadScriptId, setUploadScriptId] = useState('');
  const [uploadPlatform, setUploadPlatform] = useState('reels');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const [cutsData, foldersData, scriptsData] = await Promise.all([
        api.getFinalCuts(),
        api.getFolders(),
        api.getScripts(),
      ]);
      setFinalCuts(cutsData.finalCuts || []);
      const allFolders = [...(foldersData.sharedFolders || []), ...(foldersData.myFolders || [])];
      setFolders(allFolders);
      const allScripts = [...(scriptsData.sharedScripts || []), ...(scriptsData.myScripts || [])];
      setScripts(allScripts);
    } catch (err) {
      console.error('Failed to load final cuts data:', err);
    }
  };

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      setSelectedFile(file);
      if (!uploadTitle.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setUploadTitle(cleanName);
      }
    }
  };

  const handleUploadSubmit = async (e: Event) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a video file to upload.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Please enter a title for the final cut.');
      return;
    }

    setUploading(true);
    setUploadError('');

    const targetFolder = folders.find((f) => f.id === uploadFolderId);
    const targetScript = scripts.find((s) => s.id === uploadScriptId);

    const res = await api.uploadFinalCut({
      videoFile: selectedFile,
      title: uploadTitle.trim(),
      folderId: uploadFolderId || undefined,
      folderName: targetFolder ? targetFolder.name : 'Uncategorized',
      scriptId: uploadScriptId || undefined,
      scriptTitle: targetScript ? targetScript.title : undefined,
      platformTag: uploadPlatform,
      notes: uploadNotes.trim() || undefined,
    });

    setUploading(false);

    if (res.error) {
      setUploadError(res.error);
    } else if (res.finalCut) {
      setFinalCuts((prev) => [res.finalCut!, ...prev]);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadNotes('');
      setUploadFolderId('');
      setUploadScriptId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this final cut from server storage?')) return;
    const ok = await api.deleteFinalCut(id);
    if (ok) {
      setFinalCuts((prev) => prev.filter((c) => c.id !== id));
      if (activeVideo?.url.includes(id)) setActiveVideo(null);
    }
  };

  // Filter and sort final cuts
  const filteredCuts = useMemo(() => {
    return finalCuts.filter((cut) => {
      // Folder filter
      if (selectedFolderId === 'UNCATEGORIZED') {
        if (cut.folder_id) return false;
      } else if (selectedFolderId !== 'ALL') {
        if (cut.folder_id !== selectedFolderId) return false;
      }

      // Platform filter
      if (selectedPlatform !== 'ALL') {
        if (cut.platform_tag !== selectedPlatform) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (cut.title || '').toLowerCase().includes(q);
        const notesMatch = (cut.notes || '').toLowerCase().includes(q);
        const userMatch = (cut.user_name || '').toLowerCase().includes(q);
        const folderMatch = (cut.folder_name || '').toLowerCase().includes(q);
        const scriptMatch = (cut.script_title || '').toLowerCase().includes(q);
        return titleMatch || notesMatch || userMatch || folderMatch || scriptMatch;
      }

      return true;
    });
  }, [finalCuts, selectedFolderId, selectedPlatform, searchQuery]);

  const sortedCuts = useMemo(() => {
    return [...filteredCuts].sort((a, b) => {
      if (sortBy === 'newest')
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest')
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'duration_desc') return (b.duration_seconds || 0) - (a.duration_seconds || 0);
      if (sortBy === 'duration_asc') return (a.duration_seconds || 0) - (b.duration_seconds || 0);
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      return 0;
    });
  }, [filteredCuts, sortBy]);

  // Counts by folder
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorized = 0;
    finalCuts.forEach((c) => {
      if (!c.folder_id) {
        uncategorized++;
      } else {
        counts.set(c.folder_id, (counts.get(c.folder_id) || 0) + 1);
      }
    });
    counts.set('UNCATEGORIZED', uncategorized);
    counts.set('ALL', finalCuts.length);
    return counts;
  }, [finalCuts]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getPlatformLabel = (tag: string) => {
    switch (tag) {
      case 'reels':
        return { label: 'Reels / Shorts (9:16)', badge: '9:16 Vertical' };
      case 'youtube':
        return { label: 'YouTube (16:9)', badge: '16:9 Landscape' };
      case 'linkedin':
        return { label: 'LinkedIn (1:1)', badge: '1:1 Square' };
      case 'tiktok':
        return { label: 'TikTok (9:16)', badge: '9:16 TikTok' };
      default:
        return { label: 'General / Cross-Platform', badge: 'Deliverable' };
    }
  };

  if (loading) {
    return (
      <div class="organizer-loading-state">
        <div class="organizer-spinner" />
        <p>Loading final cuts library…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div class="organizer-auth-notice">
        <h2>Authentication Required</h2>
        <p>Please log in to manage, upload, and review final social media cuts.</p>
        <div class="organizer-auth-notice__actions">
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
    <div class="script-organizer">
      <header class="scripts-page-header">
        <div>
          <h1>Final Cuts & Social Video Releases</h1>
          <p>
            Ready-to-publish edited videos uploaded by video editors. Filter by category, preview
            playback, and download deliverables for social media.
          </p>
        </div>
        <div class="scripts-page-header__actions">
          <button type="button" class="button button--accent" onClick={() => setIsUploadOpen(true)}>
            <PlusIcon />
            <span>Upload Final Cut</span>
          </button>
          <a href="/recordings" class="button button--secondary">
            <VideoCameraIcon />
            <span>Raw Recordings</span>
          </a>
          <a href="/scripts" class="button button--secondary">
            <BookOpenIcon />
            <span>Script Library</span>
          </a>
        </div>
      </header>

      {/* Video Preview Player Modal */}
      {activeVideo && (
        <div class="admin-video-modal" onClick={() => setActiveVideo(null)}>
          <div class="admin-video-modal__content" onClick={(e) => e.stopPropagation()}>
            <div class="admin-video-modal__header">
              <h3>{activeVideo.title}</h3>
              <button
                type="button"
                class="admin-video-modal__close"
                onClick={() => setActiveVideo(null)}
              >
                ✕ Close
              </button>
            </div>
            <video src={activeVideo.url} controls autoPlay />
            <div class="admin-video-modal__actions">
              <a
                href={activeVideo.url}
                download
                class="button button--primary"
                title="Download video file for publishing"
              >
                <DownloadIcon />
                <span>Download Video</span>
              </a>
              <button
                type="button"
                class="button button--secondary"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + activeVideo.url);
                  alert('Video link copied to clipboard!');
                }}
              >
                <CopyIcon />
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Final Cut Modal */}
      {isUploadOpen && (
        <div class="organizer-modal" onClick={() => !uploading && setIsUploadOpen(false)}>
          <div
            class="organizer-modal__card organizer-modal__card--wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div class="organizer-modal__header">
              <div>
                <span class="organizer-badge-folder">
                  <SparkleIcon /> Post-Production Deliverable
                </span>
                <h2>Upload Final Cut Video</h2>
              </div>
              <button
                type="button"
                class="organizer-modal__close"
                disabled={uploading}
                onClick={() => setIsUploadOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} class="organizer-form">
              {uploadError && <div class="form-error-banner">{uploadError}</div>}

              <label class="form-field">
                <span>Video File (.mp4, .mov, .webm) *</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  required
                  disabled={uploading}
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <span class="form-hint">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </span>
                )}
              </label>

              <label class="form-field">
                <span>Title *</span>
                <input
                  type="text"
                  required
                  disabled={uploading}
                  value={uploadTitle}
                  onInput={(e) => setUploadTitle(e.currentTarget.value)}
                  placeholder="e.g. 60-Sec Feature Teaser (Final Cut)"
                />
              </label>

              <div class="form-grid-2">
                <label class="form-field">
                  <span>Category / Folder</span>
                  <select
                    disabled={uploading}
                    value={uploadFolderId}
                    onChange={(e) => setUploadFolderId(e.currentTarget.value)}
                  >
                    <option value="">Uncategorized</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="form-field">
                  <span>Target Social Platform</span>
                  <select
                    disabled={uploading}
                    value={uploadPlatform}
                    onChange={(e) => setUploadPlatform(e.currentTarget.value)}
                  >
                    <option value="reels">Reels / Shorts (9:16)</option>
                    <option value="youtube">YouTube Full (16:9)</option>
                    <option value="linkedin">LinkedIn / Feed (1:1)</option>
                    <option value="tiktok">TikTok (9:16)</option>
                    <option value="all">General / Cross-Platform</option>
                  </select>
                </label>
              </div>

              <label class="form-field">
                <span>Associated Script (Optional)</span>
                <select
                  disabled={uploading}
                  value={uploadScriptId}
                  onChange={(e) => setUploadScriptId(e.currentTarget.value)}
                >
                  <option value="">None / Standalone Video</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>

              <label class="form-field">
                <span>Editor Notes / Publishing Instructions</span>
                <textarea
                  rows={3}
                  disabled={uploading}
                  value={uploadNotes}
                  onInput={(e) => setUploadNotes(e.currentTarget.value)}
                  placeholder="e.g. Captions added, background music mixed at -18dB. Ready for Instagram and YouTube Shorts."
                />
              </label>

              <div class="organizer-modal__actions">
                <button
                  type="button"
                  class="button button--secondary"
                  disabled={uploading}
                  onClick={() => setIsUploadOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="button button--primary" disabled={uploading}>
                  {uploading ? 'Uploading Video…' : 'Upload Final Cut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Layout Split */}
      <div class="organizer-layout">
        {/* SIDEBAR: Categories & Platform Presets */}
        <aside class="organizer-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-header__title-wrap">
              <h3>Categories</h3>
            </div>
            <span class="tree-badge">{finalCuts.length} Total</span>
          </div>

          <div class="tree-container">
            <div class="tree-scrollable">
              <div
                class={`tree-item ${selectedFolderId === 'ALL' && selectedPlatform === 'ALL' ? 'tree-item--selected' : ''}`}
                onClick={() => {
                  setSelectedFolderId('ALL');
                  setSelectedPlatform('ALL');
                }}
                role="button"
                tabIndex={0}
              >
                <span class="tree-icon">
                  <FilmReelIcon />
                </span>
                <span class="tree-label">All Final Cuts</span>
                <span class="tree-badge">{folderCounts.get('ALL') || 0}</span>
              </div>

              <div
                class={`tree-item ${selectedFolderId === 'UNCATEGORIZED' ? 'tree-item--selected' : ''}`}
                onClick={() => setSelectedFolderId('UNCATEGORIZED')}
                role="button"
                tabIndex={0}
              >
                <span class="tree-icon">
                  <FileDocumentIcon />
                </span>
                <span class="tree-label">Uncategorized</span>
                <span class="tree-badge">{folderCounts.get('UNCATEGORIZED') || 0}</span>
              </div>

              {folders.map((f) => {
                const count = folderCounts.get(f.id) || 0;
                return (
                  <div
                    key={f.id}
                    class={`tree-item ${selectedFolderId === f.id ? 'tree-item--selected' : ''}`}
                    onClick={() => setSelectedFolderId(f.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <span class="tree-icon">
                      <FolderIcon />
                    </span>
                    <span class="tree-label" title={f.name}>
                      {f.name}
                    </span>
                    <span class="tree-badge">{count}</span>
                  </div>
                );
              })}

              <div class="tree-divider">SOCIAL PLATFORMS</div>

              {[
                { id: 'reels', label: 'Reels / Shorts (9:16)', Icon: SmartphoneIcon },
                { id: 'youtube', label: 'YouTube (16:9)', Icon: MonitorPlayIcon },
                { id: 'linkedin', label: 'LinkedIn (1:1)', Icon: LinkedInIcon },
                { id: 'tiktok', label: 'TikTok (9:16)', Icon: MusicNoteIcon },
              ].map((p) => {
                const IconComponent = p.Icon;
                return (
                  <div
                    key={p.id}
                    class={`tree-item ${selectedPlatform === p.id ? 'tree-item--selected' : ''}`}
                    onClick={() => setSelectedPlatform(selectedPlatform === p.id ? 'ALL' : p.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <span class="tree-icon">
                      <IconComponent />
                    </span>
                    <span class="tree-label">{p.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* MAIN EXPLORER */}
        <main class="organizer-main">
          {/* Controls Bar */}
          <div class="organizer-controls">
            <div class="organizer-search-box">
              <span class="search-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder={`Search ${finalCuts.length} final cuts by title, notes, or editor...`}
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
                <label for="cuts-sort-select">Sort:</label>
                <select
                  id="cuts-sort-select"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      (e.currentTarget as HTMLSelectElement).value as
                        'newest' | 'oldest' | 'duration_desc' | 'duration_asc' | 'title',
                    )
                  }
                >
                  <option value="newest">Recently Uploaded</option>
                  <option value="oldest">Oldest First</option>
                  <option value="duration_desc">Longest Duration</option>
                  <option value="duration_asc">Shortest Duration</option>
                  <option value="title">Alphabetical (A-Z)</option>
                </select>
              </div>

              <div class="view-mode-toggle" role="group" aria-label="View layout">
                <button
                  type="button"
                  class={`view-btn ${viewLayout === 'list' ? 'view-btn--active' : ''}`}
                  onClick={() => handleSetViewLayout('list')}
                  title="List view"
                >
                  <ListIcon />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  class={`view-btn ${viewLayout === 'grid' ? 'view-btn--active' : ''}`}
                  onClick={() => handleSetViewLayout('grid')}
                  title="Grid view"
                >
                  <GridIcon />
                  <span>Grid</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div class="organizer-summary">
            <span>
              Showing <strong>{sortedCuts.length}</strong> of {finalCuts.length} final cuts
            </span>
          </div>

          {/* CONTENT: List View (Default) or Grid View */}
          {sortedCuts.length === 0 ? (
            <div class="organizer-empty">
              <p>No final cuts found.</p>
              <button
                type="button"
                class="button button--primary"
                onClick={() => setIsUploadOpen(true)}
              >
                <PlusIcon />
                <span>Upload First Final Cut</span>
              </button>
            </div>
          ) : viewLayout === 'list' ? (
            <div class="scripts-table-wrap">
              <table class="scripts-table">
                <thead>
                  <tr>
                    <th>Title & Notes</th>
                    <th>Platform</th>
                    <th>Category</th>
                    <th class="col-stats">Duration</th>
                    <th class="col-stats">Size</th>
                    <th class="col-date">Uploaded</th>
                    <th class="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCuts.map((cut) => {
                    const platform = getPlatformLabel(cut.platform_tag);
                    return (
                      <tr key={cut.id}>
                        <td class="td-title">
                          <strong title={cut.title}>{cut.title}</strong>
                          {cut.notes && (
                            <div class="td-cut-notes">
                              <MessageSquareIcon />
                              <span>{cut.notes}</span>
                            </div>
                          )}
                          {cut.script_title && (
                            <div class="td-cut-script">
                              <BookOpenIcon />
                              <span>
                                Script: <em>{cut.script_title}</em>
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <span class="cut-platform-badge">{platform.badge}</span>
                        </td>
                        <td>
                          <span class="badge-folder">{cut.folder_name || 'Uncategorized'}</span>
                        </td>
                        <td class="col-stats">{formatDuration(cut.duration_seconds)}</td>
                        <td class="col-stats">{formatFileSize(cut.filesize)}</td>
                        <td class="col-date">
                          <div>{new Date(cut.created_at).toLocaleDateString()}</div>
                          <small style={{ color: 'var(--muted)' }}>by {cut.user_name}</small>
                        </td>
                        <td class="td-actions">
                          <div class="table-actions-group">
                            <button
                              type="button"
                              class="table-btn table-btn--primary"
                              onClick={() =>
                                setActiveVideo({ url: cut.filepath, title: cut.title })
                              }
                              title="Play Video Preview"
                            >
                              <PlayIcon />
                              <span>Preview</span>
                            </button>
                            <a
                              href={cut.filepath}
                              download
                              class="table-btn table-btn--secondary"
                              title="Download video file"
                            >
                              <DownloadIcon />
                              <span>Save</span>
                            </a>
                            <button
                              type="button"
                              class="table-btn table-btn--danger table-btn--icon"
                              onClick={() => handleDelete(cut.id)}
                              title="Delete final cut"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="recordings-grid">
              {sortedCuts.map((cut) => {
                const platform = getPlatformLabel(cut.platform_tag);
                return (
                  <div key={cut.id} class="recording-card">
                    <div
                      class="recording-card__video-preview"
                      onClick={() => setActiveVideo({ url: cut.filepath, title: cut.title })}
                    >
                      <video src={cut.filepath} preload="metadata" />
                      <div class="recording-card__play-overlay">
                        <span>
                          <PlayIcon />
                        </span>
                      </div>
                      <span class="recording-card__duration">
                        {formatDuration(cut.duration_seconds)}
                      </span>
                      <span class="cut-card-platform-tag">{platform.badge}</span>
                    </div>

                    <div class="recording-card__content">
                      <div class="recording-card__header">
                        <span class="recording-card__folder">
                          <FolderIcon />
                          <span>{cut.folder_name || 'Uncategorized'}</span>
                        </span>
                        <span class="recording-card__size">{formatFileSize(cut.filesize)}</span>
                      </div>

                      <h3 class="recording-card__title" title={cut.title}>
                        {cut.title}
                      </h3>

                      {cut.notes && (
                        <p class="cut-card-notes">
                          <MessageSquareIcon />
                          <span>{cut.notes}</span>
                        </p>
                      )}

                      {cut.script_title && (
                        <div class="cut-card-script-link">
                          <BookOpenIcon />
                          <span>Script: {cut.script_title}</span>
                        </div>
                      )}

                      <div class="recording-card__footer" style={{ marginTop: '0.85rem' }}>
                        <div class="table-actions-group">
                          <button
                            type="button"
                            class="table-btn table-btn--primary"
                            onClick={() => setActiveVideo({ url: cut.filepath, title: cut.title })}
                          >
                            <PlayIcon />
                            <span>Preview</span>
                          </button>
                          <a href={cut.filepath} download class="table-btn table-btn--secondary">
                            <DownloadIcon />
                            <span>Save</span>
                          </a>
                          <button
                            type="button"
                            class="table-btn table-btn--danger table-btn--icon"
                            onClick={() => handleDelete(cut.id)}
                            title="Delete final cut"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
