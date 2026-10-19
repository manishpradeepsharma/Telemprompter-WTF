import { useEffect, useState, useMemo } from 'preact/hooks';
import { api, type User, type ScriptItem, type FolderItem } from '../domain/api';

interface ScriptOrganizerProps {
  mode: 'user' | 'admin';
  currentUser?: User | null;
}

// Tree node helper type
interface FolderNode extends FolderItem {
  children: FolderNode[];
  level: number;
}

type SortOption = 'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc' | 'length_desc';

const FolderIcon = () => (
  <svg class="tree-svg-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

const FolderOpenIcon = () => (
  <svg class="tree-svg-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path
      fillRule="evenodd"
      d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-2.83 2H4a2 2 0 01-2-2V6z"
      clipRule="evenodd"
    />
    <path d="M6 12a2 2 0 011.89-1.34h9.22a2 2 0 011.89 2.66l-1.5 4.5A2 2 0 0115.61 19H7.39a2 2 0 01-1.89-1.34L4 12z" />
  </svg>
);

const AllScriptsIcon = () => (
  <svg class="tree-svg-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
  </svg>
);

const FileIcon = () => (
  <svg class="tree-svg-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path
      fillRule="evenodd"
      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
      clipRule="evenodd"
    />
  </svg>
);

const UsersIcon = () => (
  <svg class="tree-svg-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);

const UserIcon = () => (
  <svg class="tree-svg-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path
      fillRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
      clipRule="evenodd"
    />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path
      fillRule="evenodd"
      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
      clipRule="evenodd"
    />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
    <path
      fillRule="evenodd"
      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

const ClockIcon = () => (
  <svg class="meta-svg-icon" viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </svg>
);

export default function ScriptOrganizer({
  mode,
  currentUser,
}: ScriptOrganizerProps): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(currentUser ?? null);
  const [loading, setLoading] = useState(true);

  // Raw data from server
  const [sharedScripts, setSharedScripts] = useState<ScriptItem[]>([]);
  const [myScripts, setMyScripts] = useState<ScriptItem[]>([]);
  const [sharedFolders, setSharedFolders] = useState<FolderItem[]>([]);
  const [myFolders, setMyFolders] = useState<FolderItem[]>([]);

  // Selection / Navigation State
  // selectedFolderId: 'ALL' | 'UNCATEGORIZED' | 'SHARED_ALL' | 'MY_ALL' | specific folder uuid
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc' | 'length_desc'
  >('updated_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('teleprompter_scripts_view_mode');
      if (saved === 'grid' || saved === 'table') return saved;
    }
    return 'table';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('teleprompter_scripts_view_mode', mode);
    }
  };
  const [pageSize, setPageSize] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Batch operations
  const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());
  const [batchTargetFolder, setBatchTargetFolder] = useState<string>('');
  const [batchLoading, setBatchLoading] = useState(false);

  // Modals / Dialogs
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalParentId, setFolderModalParentId] = useState<string | null>(null);
  const [folderModalName, setFolderModalName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptEditId, setScriptEditId] = useState<string | null>(null);
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptContent, setScriptContent] = useState('');
  const [scriptFolderId, setScriptFolderId] = useState<string>('');
  const [scriptIsShared, setScriptIsShared] = useState<boolean>(mode === 'admin');
  const [scriptSaving, setScriptSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!currentUser) {
      api.getAuth().then((u) => {
        setUser(u);
        loadAll();
      });
    } else {
      loadAll();
    }
  }, [currentUser]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [scriptsRes, foldersRes] = await Promise.all([api.getScripts(), api.getFolders()]);
      setSharedScripts(scriptsRes.sharedScripts || []);
      setMyScripts(scriptsRes.myScripts || []);
      setSharedFolders(foldersRes.sharedFolders || []);
      setMyFolders(foldersRes.myFolders || []);
      const all = [...(scriptsRes.sharedScripts || []), ...(scriptsRes.myScripts || [])];
      const targetId = new URLSearchParams(window.location.search).get('id');
      if (targetId) {
        const found = all.find((s) => s.id === targetId);
        if (found) {
          handleOpenEditScript(found);
          if (found.folder_id) setSelectedFolderId(found.folder_id);
          if (window.history?.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('id');
            window.history.replaceState({}, '', url.pathname);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load scripts/folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Combine all company scripts
  const allAvailableScripts = useMemo(() => {
    const map = new Map<string, ScriptItem>();
    sharedScripts.forEach((s) => map.set(s.id, s));
    myScripts.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [sharedScripts, myScripts]);

  // Combine all company folders
  const allAvailableFolders = useMemo(() => {
    const map = new Map<string, FolderItem>();
    sharedFolders.forEach((f) => map.set(f.id, f));
    myFolders.forEach((f) => map.set(f.id, f));
    return Array.from(map.values());
  }, [sharedFolders, myFolders]);

  // Folder lookup map
  const folderMap = useMemo(() => {
    const map = new Map<string, FolderItem>();
    allAvailableFolders.forEach((f) => map.set(f.id, f));
    return map;
  }, [allAvailableFolders]);

  // Script count per folder
  const folderScriptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorized = 0;
    allAvailableScripts.forEach((s) => {
      if (!s.folder_id) {
        uncategorized++;
      } else {
        counts.set(s.folder_id, (counts.get(s.folder_id) || 0) + 1);
      }
    });
    counts.set('UNCATEGORIZED', uncategorized);
    counts.set('ALL', allAvailableScripts.length);
    return counts;
  }, [allAvailableScripts]);

  // Build recursive folder tree
  const folderTree = useMemo(() => {
    const rootNodes: FolderNode[] = [];
    const childrenMap = new Map<string, FolderNode[]>();

    allAvailableFolders.forEach((f) => {
      const node: FolderNode = { ...f, children: [], level: 0 };
      if (!f.parent_id) {
        rootNodes.push(node);
      } else {
        const arr = childrenMap.get(f.parent_id) || [];
        arr.push(node);
        childrenMap.set(f.parent_id, arr);
      }
    });

    const attachChildren = (nodes: FolderNode[], level: number) => {
      nodes.forEach((n) => {
        n.level = level;
        const kids = childrenMap.get(n.id) || [];
        n.children = kids;
        attachChildren(kids, level + 1);
      });
    };

    attachChildren(rootNodes, 0);
    return rootNodes;
  }, [allAvailableFolders]);

  // Filtered and Sorted scripts
  const filteredScripts = useMemo(() => {
    let list = allAvailableScripts;

    // 1. Folder filtering
    if (selectedFolderId === 'UNCATEGORIZED') {
      list = list.filter((s) => !s.folder_id);
    } else if (selectedFolderId === 'SHARED_ONLY') {
      list = list.filter((s) => s.is_shared === 1);
    } else if (selectedFolderId === 'MY_ONLY') {
      list = list.filter((s) => user && s.created_by === user.id);
    } else if (selectedFolderId !== 'ALL') {
      // Collect target folder + all nested subfolder IDs
      const folderIdsToMatch = new Set<string>([selectedFolderId]);
      const collectDescendants = (parentId: string) => {
        allAvailableFolders.forEach((f) => {
          if (f.parent_id === parentId) {
            folderIdsToMatch.add(f.id);
            collectDescendants(f.id);
          }
        });
      };
      collectDescendants(selectedFolderId);
      list = list.filter((s) => s.folder_id && folderIdsToMatch.has(s.folder_id));
    }

    // 2. Search filtering
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const titleMatch = s.title.toLowerCase().includes(q);
        const contentMatch = s.content.toLowerCase().includes(q);
        const creatorMatch = s.creator_name?.toLowerCase().includes(q);
        return titleMatch || contentMatch || creatorMatch;
      });
    }

    // 3. Sorting
    const sorted = [...list];
    if (sortBy === 'updated_desc') {
      sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === 'updated_asc') {
      sorted.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
    } else if (sortBy === 'title_asc') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'title_desc') {
      sorted.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'length_desc') {
      sorted.sort((a, b) => b.content.length - a.content.length);
    }

    return sorted;
  }, [allAvailableScripts, selectedFolderId, allAvailableFolders, searchQuery, sortBy, user]);

  // Pagination calculation
  const totalItems = filteredScripts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedScripts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredScripts.slice(start, start + pageSize);
  }, [filteredScripts, safeCurrentPage, pageSize]);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedScriptIds(new Set());
  }, [selectedFolderId, searchQuery, sortBy, pageSize]);

  // Reading time & word count helper
  const getScriptStats = (text: string) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const minutes = words / 130; // standard speaking pace
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    return { words, duration };
  };

  // Folder actions
  const handleOpenCreateFolder = (parentId: string | null = null) => {
    if (!user) {
      showToast('error', 'Please log in to create folders');
      window.location.href = '/login';
      return;
    }
    setEditingFolderId(null);
    setFolderModalParentId(parentId);
    setFolderModalName('');
    setShowFolderModal(true);
  };

  const handleOpenRenameFolder = (folder: FolderItem) => {
    if (!user) {
      showToast('error', 'Please log in to rename folders');
      window.location.href = '/login';
      return;
    }
    setEditingFolderId(folder.id);
    setFolderModalParentId(folder.parent_id);
    setFolderModalName(folder.name);
    setShowFolderModal(true);
  };

  const handleSaveFolder = async (e: Event) => {
    e.preventDefault();
    if (!folderModalName.trim()) return;

    if (editingFolderId) {
      const res = await api.updateFolder(editingFolderId, {
        name: folderModalName.trim(),
        parent_id: folderModalParentId,
      });
      if (res.ok) {
        showToast('success', `Folder renamed to "${folderModalName.trim()}"`);
        setShowFolderModal(false);
        loadAll();
      } else {
        showToast('error', res.error || 'Failed to rename folder');
      }
    } else {
      const res = await api.createFolder({
        name: folderModalName.trim(),
        parent_id: folderModalParentId,
      });
      if (res.folder) {
        showToast('success', `Folder "${res.folder.name}" created`);
        setShowFolderModal(false);
        // Automatically ensure parent is expanded so the newly created folder is visible
        if (folderModalParentId) {
          setCollapsedFolders((prev) => ({ ...prev, [folderModalParentId]: false }));
        }
        // Automatically select newly created folder
        setSelectedFolderId(res.folder.id);
        loadAll();
      } else {
        showToast('error', res.error || 'Failed to create folder');
      }
    }
  };

  const handleDeleteFolder = async (folder: FolderItem) => {
    if (!user) {
      showToast('error', 'Please log in to delete folders');
      window.location.href = '/login';
      return;
    }
    if (
      !confirm(
        `Are you sure you want to delete folder "${folder.name}"?\nAny scripts inside will be moved to Uncategorized so you don't lose them.`,
      )
    )
      return;

    const res = await api.deleteFolder(folder.id);
    if (res.ok) {
      showToast('success', `Folder "${folder.name}" deleted. Scripts moved to Uncategorized.`);
      if (selectedFolderId === folder.id) {
        setSelectedFolderId('ALL');
      }
      loadAll();
    } else {
      showToast('error', res.error || 'Failed to delete folder');
    }
  };

  // Batch Selection
  const handleToggleSelectAll = () => {
    if (selectedScriptIds.size === paginatedScripts.length) {
      setSelectedScriptIds(new Set());
    } else {
      const next = new Set<string>();
      paginatedScripts.forEach((s) => next.add(s.id));
      setSelectedScriptIds(next);
    }
  };

  const handleToggleSelectScript = (id: string) => {
    const next = new Set(selectedScriptIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedScriptIds(next);
  };

  const handleBatchMove = async () => {
    if (selectedScriptIds.size === 0) return;
    setBatchLoading(true);
    const targetId = batchTargetFolder === 'UNCATEGORIZED' ? null : batchTargetFolder || null;
    const res = await api.batchMoveScripts(Array.from(selectedScriptIds), targetId);
    setBatchLoading(false);

    if (res.ok) {
      showToast('success', `Moved ${res.count || selectedScriptIds.size} scripts successfully!`);
      setSelectedScriptIds(new Set());
      setBatchTargetFolder('');
      loadAll();
    } else {
      showToast('error', res.error || 'Failed to move scripts');
    }
  };

  const handleBatchDelete = async () => {
    if (!user) {
      showToast('error', 'Please log in to delete scripts');
      window.location.href = '/login';
      return;
    }
    if (selectedScriptIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedScriptIds.size} selected scripts?`))
      return;

    setBatchLoading(true);
    let deletedCount = 0;
    let lastError = '';
    for (const id of Array.from(selectedScriptIds)) {
      const res = await api.deleteScript(id);
      if (res.ok) {
        deletedCount++;
      } else if (res.error) {
        lastError = res.error;
      }
    }
    setBatchLoading(false);

    if (deletedCount > 0) {
      showToast('success', `Deleted ${deletedCount} script(s).`);
      setSelectedScriptIds(new Set());
      loadAll();
    } else {
      showToast('error', lastError || 'Failed to delete selected script(s)');
    }
  };

  // Quick single move
  const handleSingleMove = async (scriptId: string, folderId: string) => {
    if (!user) {
      showToast('error', 'Please log in to organize scripts');
      window.location.href = '/login';
      return;
    }
    const targetFolderId = folderId === 'UNCATEGORIZED' ? null : folderId;
    const res = await api.updateScript(scriptId, { folder_id: targetFolderId });
    if (res.ok) {
      const folderName = targetFolderId
        ? folderMap.get(targetFolderId)?.name || 'Folder'
        : 'Uncategorized';
      showToast('success', `Script moved to "${folderName}"`);
      loadAll();
    } else {
      showToast('error', res.error || 'Failed to move script');
    }
  };

  // Script Modal (Create / Edit)
  const handleOpenCreateScript = () => {
    if (!user) {
      showToast('error', 'Please log in to write scripts');
      window.location.href = '/login';
      return;
    }
    setScriptEditId(null);
    setScriptTitle('');
    setScriptContent('');
    setScriptFolderId(
      selectedFolderId !== 'ALL' &&
        selectedFolderId !== 'UNCATEGORIZED' &&
        selectedFolderId !== 'SHARED_ONLY' &&
        selectedFolderId !== 'MY_ONLY'
        ? selectedFolderId
        : '',
    );
    setScriptIsShared(true);
    setShowScriptModal(true);
  };

  const handleOpenEditScript = (s: ScriptItem) => {
    if (!user) {
      showToast('error', 'Please log in to edit scripts');
      window.location.href = '/login';
      return;
    }
    setScriptEditId(s.id);
    setScriptTitle(s.title);
    setScriptContent(s.content);
    setScriptFolderId(s.folder_id || '');
    setScriptIsShared(true);
    setShowScriptModal(true);
  };

  const handleSaveScript = async (e: Event) => {
    e.preventDefault();
    if (!scriptTitle.trim() || !scriptContent.trim()) {
      showToast('error', 'Title and content are required');
      return;
    }

    setScriptSaving(true);
    const targetFolderId = scriptFolderId || null;

    if (scriptEditId) {
      const res = await api.updateScript(scriptEditId, {
        title: scriptTitle.trim(),
        content: scriptContent.trim(),
        folder_id: targetFolderId,
        is_shared: true,
      });
      setScriptSaving(false);
      if (res.ok) {
        showToast('success', 'Script updated successfully!');
        setShowScriptModal(false);
        loadAll();
      } else {
        showToast('error', res.error || 'Failed to update script');
      }
    } else {
      const res = await api.createScript({
        title: scriptTitle.trim(),
        content: scriptContent.trim(),
        folder_id: targetFolderId,
        is_shared: true,
      });
      setScriptSaving(false);
      if (res.script) {
        showToast('success', 'New script created!');
        setShowScriptModal(false);
        loadAll();
      } else {
        showToast('error', res.error || 'Failed to create script');
      }
    }
  };

  const handleDeleteSingleScript = async (id: string, title: string) => {
    if (!user) {
      showToast('error', 'Please log in to delete scripts');
      window.location.href = '/login';
      return;
    }
    if (!confirm(`Delete script "${title}"?`)) return;
    const res = await api.deleteScript(id);
    if (res.ok) {
      showToast('success', 'Script deleted');
      loadAll();
    } else {
      showToast('error', res.error || 'Failed to delete script');
    }
  };

  const handleUseInTeleprompter = (s: ScriptItem) => {
    localStorage.setItem('teleprompter_imported_script', s.content);
    localStorage.setItem('teleprompter_active_script_id', s.id);
    localStorage.setItem('teleprompter_active_title', s.title);
    localStorage.setItem('teleprompter_active_script_content', s.content);
    localStorage.setItem('teleprompter_active_folder_id', s.folder_id || '');
    const allF = [...sharedFolders, ...myFolders];
    const folder = allF.find((f) => f.id === s.folder_id);
    localStorage.setItem('teleprompter_active_folder_name', folder ? folder.name : 'Uncategorized');
    localStorage.setItem('teleprompter_autoplay', '1');
    window.location.href = '/?present=1';
  };

  const handleImportFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!scriptTitle) {
      setScriptTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) setScriptContent(text);
    };
    reader.readAsText(file);
  };

  // Render tree item recursively
  const renderTreeNode = (node: FolderNode) => {
    const isCollapsed = collapsedFolders[node.id];
    const isSelected = selectedFolderId === node.id;
    const count = folderScriptCounts.get(node.id) || 0;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} class="tree-node-wrap">
        <div
          class={`tree-item ${isSelected ? 'tree-item--selected' : ''}`}
          style={{ paddingLeft: `${node.level * 14 + 8}px` }}
          onClick={() => {
            setSelectedFolderId(node.id);
            setMobileFoldersOpen(false);
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              class="tree-expander"
              aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsedFolders((prev) => ({ ...prev, [node.id]: !prev[node.id] }));
              }}
            >
              {isCollapsed ? '▶' : '▼'}
            </button>
          ) : (
            <span class="tree-expander-placeholder">•</span>
          )}

          <span class="tree-icon">{isSelected ? <FolderOpenIcon /> : <FolderIcon />}</span>
          <span class="tree-label" title={node.name}>
            {node.name}
          </span>
          <span class="tree-badge">{count}</span>

          <div class="tree-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              class="tree-action-btn"
              title="Add subfolder"
              onClick={() => handleOpenCreateFolder(node.id)}
            >
              +
            </button>
            <button
              type="button"
              class="tree-action-btn"
              title="Rename folder"
              onClick={() => handleOpenRenameFolder(node)}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              class="tree-action-btn tree-action-btn--danger"
              title="Delete folder"
              onClick={() => handleDeleteFolder(node)}
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div class="tree-children">{node.children.map(renderTreeNode)}</div>
        )}
      </div>
    );
  };

  // Get active folder name for breadcrumb
  const activeFolderName = useMemo(() => {
    if (selectedFolderId === 'ALL') return 'All Scripts';
    if (selectedFolderId === 'UNCATEGORIZED') return 'Uncategorized Scripts';
    if (selectedFolderId === 'SHARED_ONLY') return 'Shared Scripts';
    if (selectedFolderId === 'MY_ONLY') return 'My Personal Scripts';
    return folderMap.get(selectedFolderId)?.name || 'Folder';
  }, [selectedFolderId, folderMap]);

  if (loading) {
    return (
      <div class="organizer-loading-state">
        <div class="organizer-spinner"></div>
        <p>Loading folder hierarchy and scripts library…</p>
      </div>
    );
  }

  return (
    <div class="script-organizer">
      {/* Toast Notification */}
      {notification && (
        <div class={`organizer-toast organizer-toast--${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Organizer Header */}
      <div class="organizer-header">
        <div class="organizer-header__left">
          <div class="organizer-breadcrumbs">
            <button
              type="button"
              class="breadcrumb-btn"
              onClick={() => {
                setSelectedFolderId('ALL');
                setMobileFoldersOpen(false);
              }}
            >
              Library
            </button>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-current">{activeFolderName}</span>
            <span class="breadcrumb-count">({totalItems})</span>
          </div>
        </div>

        <div class="organizer-header__actions">
          <button
            type="button"
            class="button button--accent organizer-create-btn"
            onClick={handleOpenCreateScript}
          >
            <span>+</span> New Script
          </button>
        </div>
      </div>

      {/* Main Layout: Left Folder Tree Sidebar & Right Script Grid/Table */}
      <div class="organizer-layout">
        {/* SIDEBAR: Folder Tree Explorer */}
        <aside class="organizer-sidebar">
          <div
            class="sidebar-header"
            onClick={() => setMobileFoldersOpen((prev) => !prev)}
            role="button"
            tabIndex={0}
            aria-expanded={mobileFoldersOpen}
          >
            <div class="sidebar-header__title-wrap">
              <span class="sidebar-mobile-chevron">{mobileFoldersOpen ? '▼' : '▶'}</span>
              <h3>Folders ({allAvailableFolders.length})</h3>
            </div>
            <button
              type="button"
              class="sidebar-add-folder-btn"
              title="Create Root Category / Folder"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenCreateFolder(null);
              }}
            >
              + New
            </button>
          </div>

          <nav class={`tree-container ${mobileFoldersOpen ? 'tree-container--open' : ''}`}>
            {/* Virtual Node: All Scripts */}
            <div
              class={`tree-item ${selectedFolderId === 'ALL' ? 'tree-item--selected' : ''}`}
              onClick={() => {
                setSelectedFolderId('ALL');
                setMobileFoldersOpen(false);
              }}
            >
              <span class="tree-icon">
                <AllScriptsIcon />
              </span>
              <span class="tree-label">All Scripts</span>
              <span class="tree-badge">{folderScriptCounts.get('ALL') || 0}</span>
            </div>

            {/* Virtual Node: Uncategorized */}
            <div
              class={`tree-item ${selectedFolderId === 'UNCATEGORIZED' ? 'tree-item--selected' : ''}`}
              onClick={() => {
                setSelectedFolderId('UNCATEGORIZED');
                setMobileFoldersOpen(false);
              }}
            >
              <span class="tree-icon">
                <FileIcon />
              </span>
              <span class="tree-label">Uncategorized</span>
              <span class="tree-badge">{folderScriptCounts.get('UNCATEGORIZED') || 0}</span>
            </div>

            {mode === 'user' && (
              <>
                <div
                  class={`tree-item ${selectedFolderId === 'SHARED_ONLY' ? 'tree-item--selected' : ''}`}
                  onClick={() => {
                    setSelectedFolderId('SHARED_ONLY');
                    setMobileFoldersOpen(false);
                  }}
                >
                  <span class="tree-icon">
                    <UsersIcon />
                  </span>
                  <span class="tree-label">Shared with me</span>
                  <span class="tree-badge">{sharedScripts.length}</span>
                </div>
                <div
                  class={`tree-item ${selectedFolderId === 'MY_ONLY' ? 'tree-item--selected' : ''}`}
                  onClick={() => {
                    setSelectedFolderId('MY_ONLY');
                    setMobileFoldersOpen(false);
                  }}
                >
                  <span class="tree-icon">
                    <UserIcon />
                  </span>
                  <span class="tree-label">My Own Scripts</span>
                  <span class="tree-badge">{myScripts.length}</span>
                </div>
              </>
            )}

            <div class="tree-divider">
              <span>FOLDERS</span>
            </div>

            {/* Hierarchical Custom Folder Tree */}
            <div class="tree-scrollable">
              {folderTree.length === 0 ? (
                <div class="tree-empty-notice">
                  <p>No custom folders yet.</p>
                  <button
                    type="button"
                    class="text-button text-button--library"
                    onClick={() => handleOpenCreateFolder(null)}
                  >
                    + Create first folder
                  </button>
                </div>
              ) : (
                folderTree.map(renderTreeNode)
              )}
            </div>
          </nav>
        </aside>

        {/* MAIN EXPLORER: Search, Batch Actions, Script List/Grid, Pagination */}
        <main class="organizer-main">
          {/* Controls Bar: Fast Search + Sort + View Mode */}
          <div class="organizer-controls">
            <div class="organizer-search-box">
              <span class="search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder={`Search ${allAvailableScripts.length} scripts by title, content or author…`}
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
              <label class="sort-selector">
                <span class="sort-label">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy((e.currentTarget as HTMLSelectElement).value as SortOption)
                  }
                >
                  <option value="updated_desc">Recently Updated</option>
                  <option value="updated_asc">Oldest First</option>
                  <option value="title_asc">Title (A → Z)</option>
                  <option value="title_desc">Title (Z → A)</option>
                  <option value="length_desc">Script Length (Words)</option>
                </select>
              </label>

              <div class="view-mode-toggle">
                <button
                  type="button"
                  class={`view-btn ${viewMode === 'grid' ? 'view-btn--active' : ''}`}
                  title="Card Grid View"
                  onClick={() => handleSetViewMode('grid')}
                >
                  ▦ Grid
                </button>
                <button
                  type="button"
                  class={`view-btn ${viewMode === 'table' ? 'view-btn--active' : ''}`}
                  title="Compact Table View"
                  onClick={() => handleSetViewMode('table')}
                >
                  ☰ List
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Action Toolbar (Appears when 1 or more scripts selected) */}
          {selectedScriptIds.size > 0 && (
            <div class="batch-toolbar">
              <div class="batch-toolbar__info">
                <strong>{selectedScriptIds.size}</strong> scripts selected
              </div>
              <div class="batch-toolbar__actions">
                <select
                  class="batch-folder-select"
                  value={batchTargetFolder}
                  onChange={(e) =>
                    setBatchTargetFolder((e.currentTarget as HTMLSelectElement).value)
                  }
                >
                  <option value="">Move selected to folder…</option>
                  <option value="UNCATEGORIZED">Move to Uncategorized</option>
                  {allAvailableFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  class="button button--secondary batch-move-btn"
                  disabled={!batchTargetFolder || batchLoading}
                  onClick={handleBatchMove}
                >
                  {batchLoading ? 'Moving…' : 'Apply Move'}
                </button>

                <button
                  type="button"
                  class="button admin-danger-btn batch-delete-btn"
                  disabled={batchLoading}
                  onClick={handleBatchDelete}
                >
                  Delete Selected
                </button>

                <button
                  type="button"
                  class="text-button"
                  onClick={() => setSelectedScriptIds(new Set())}
                >
                  Deselect all
                </button>
              </div>
            </div>
          )}

          {/* Select All Bar & Fast Metrics */}
          <div class="organizer-meta-bar">
            <label class="select-all-label">
              <input
                type="checkbox"
                checked={
                  paginatedScripts.length > 0 &&
                  paginatedScripts.every((s) => selectedScriptIds.has(s.id))
                }
                onChange={handleToggleSelectAll}
              />
              <span>Select all visible ({paginatedScripts.length})</span>
            </label>

            <div class="meta-status">
              {searchQuery && (
                <span class="meta-tag">
                  Matching: "{searchQuery}" ({totalItems})
                </span>
              )}
              <span class="meta-page-info">
                Page {safeCurrentPage} of {totalPages} ({totalItems} total scripts)
              </span>
            </div>
          </div>

          {/* Script Cards or Table */}
          {paginatedScripts.length === 0 ? (
            <div class="scripts-empty-view">
              <div class="empty-icon">📭</div>
              <h3>No scripts found</h3>
              <p>
                {searchQuery
                  ? `No scripts match "${searchQuery}" in this view.`
                  : 'This folder does not contain any scripts yet.'}
              </p>
              <div class="empty-view-actions">
                {searchQuery && (
                  <button
                    type="button"
                    class="button button--secondary"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </button>
                )}
                <button
                  type="button"
                  class="button button--accent"
                  onClick={handleOpenCreateScript}
                >
                  + Write New Script
                </button>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div class="scripts-grid">
              {paginatedScripts.map((s) => {
                const isSelected = selectedScriptIds.has(s.id);
                const stats = getScriptStats(s.content);
                const folder = s.folder_id ? folderMap.get(s.folder_id) : null;

                return (
                  <div
                    key={s.id}
                    class={`script-card ${isSelected ? 'script-card--selected' : ''}`}
                  >
                    <div class="script-card__top">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectScript(s.id)}
                        class="script-card__checkbox"
                        aria-label={`Select script ${s.title}`}
                      />
                      <div class="script-card__tags">
                        {folder ? (
                          <span
                            class="script-folder-tag"
                            onClick={() => setSelectedFolderId(folder.id)}
                            title="Filter by this folder"
                          >
                            <FolderIcon />
                            <span>{folder.name}</span>
                          </span>
                        ) : (
                          <span class="script-folder-tag script-folder-tag--none">
                            Uncategorized
                          </span>
                        )}
                        {s.is_shared === 1 && <span class="script-shared-tag">Shared</span>}
                      </div>
                    </div>

                    <h4 class="script-card__title" title={s.title}>
                      {s.title}
                    </h4>

                    <p class="script-card__snippet">{s.content.slice(0, 140)}…</p>

                    <div class="script-card__meta">
                      <span class="meta-duration">
                        <ClockIcon /> {stats.duration}
                      </span>
                      <span>•</span>
                      <span>{stats.words} words</span>
                      <span>•</span>
                      <span>{new Date(s.updated_at).toLocaleDateString()}</span>
                    </div>

                    <div class="script-card__footer">
                      <button
                        type="button"
                        class="script-record-btn"
                        title="Directly launch Teleprompter and start recording"
                        onClick={() => handleUseInTeleprompter(s)}
                      >
                        ▶ Record
                      </button>

                      <div class="script-card__actions">
                        <select
                          class="script-quick-folder-select"
                          value={s.folder_id || 'UNCATEGORIZED'}
                          title="Change folder"
                          onChange={(e) =>
                            handleSingleMove(s.id, (e.currentTarget as HTMLSelectElement).value)
                          }
                        >
                          <option value="UNCATEGORIZED">Uncategorized</option>
                          {allAvailableFolders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          class="script-icon-btn"
                          title="Edit script"
                          onClick={() => handleOpenEditScript(s)}
                        >
                          <EditIcon />
                        </button>

                        <button
                          type="button"
                          class="script-icon-btn script-icon-btn--danger"
                          title="Delete script"
                          onClick={() => handleDeleteSingleScript(s.id, s.title)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div class="scripts-table-wrap">
              <table class="scripts-table">
                <thead>
                  <tr>
                    <th class="th-checkbox"></th>
                    <th>Script</th>
                    <th>Folder</th>
                    <th class="col-stats">Length</th>
                    <th class="col-stats">Read Time</th>
                    <th class="col-date">Updated</th>
                    <th class="th-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedScripts.map((s) => {
                    const isSelected = selectedScriptIds.has(s.id);
                    const stats = getScriptStats(s.content);
                    const folder = s.folder_id ? folderMap.get(s.folder_id) : null;

                    return (
                      <tr key={s.id} class={isSelected ? 'tr--selected' : ''}>
                        <td class="td-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectScript(s.id)}
                          />
                        </td>
                        <td class="td-title">
                          <strong title={s.title}>{s.title}</strong>
                          <div class="td-mobile-meta">
                            <span>
                              <ClockIcon /> {stats.duration}
                            </span>
                            <span>•</span>
                            <span>{stats.words}w</span>
                          </div>
                          <small>{s.content.slice(0, 70)}…</small>
                        </td>
                        <td class="td-folder">
                          {folder ? (
                            <span
                              class="script-folder-tag"
                              onClick={() => {
                                setSelectedFolderId(folder.id);
                                setMobileFoldersOpen(false);
                              }}
                            >
                              <FolderIcon />
                              <span>{folder.name}</span>
                            </span>
                          ) : (
                            <span class="script-folder-tag script-folder-tag--none">
                              Uncategorized
                            </span>
                          )}
                        </td>
                        <td class="col-stats">{stats.words}w</td>
                        <td class="col-stats">{stats.duration}</td>
                        <td class="col-date">{new Date(s.updated_at).toLocaleDateString()}</td>
                        <td class="td-actions">
                          <button
                            type="button"
                            class="script-record-btn script-record-btn--sm"
                            title="Directly launch Teleprompter and start recording"
                            onClick={() => handleUseInTeleprompter(s)}
                          >
                            ▶ Record
                          </button>
                          <button
                            type="button"
                            class="script-icon-btn"
                            title="Edit"
                            onClick={() => handleOpenEditScript(s)}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            class="script-icon-btn script-icon-btn--danger"
                            title="Delete"
                            onClick={() => handleDeleteSingleScript(s.id, s.title)}
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div class="organizer-pagination">
              <div class="pagination-page-size">
                <span>Items per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(Number((e.currentTarget as HTMLSelectElement).value))
                  }
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div class="pagination-buttons">
                <button
                  type="button"
                  class="pagination-btn"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  title="First page"
                >
                  ««
                </button>
                <button
                  type="button"
                  class="pagination-btn"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="Previous page"
                >
                  ‹ Prev
                </button>

                <span class="pagination-status">
                  Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  class="pagination-btn"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  title="Next page"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  class="pagination-btn"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Last page"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FOLDER MODAL (Create or Rename Folder) */}
      {showFolderModal && (
        <div class="organizer-modal-backdrop" onClick={() => setShowFolderModal(false)}>
          <div class="organizer-modal" onClick={(e) => e.stopPropagation()}>
            <div class="organizer-modal__header">
              <h3>
                {editingFolderId ? 'Rename Folder / Category' : 'Create New Folder / Category'}
              </h3>
              <button
                type="button"
                class="organizer-modal__close"
                onClick={() => setShowFolderModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFolder} class="organizer-modal__body">
              <label class="form-field">
                <span>Folder Name</span>
                <input
                  type="text"
                  placeholder="e.g. Q4 Executive Briefings, Onboarding Scripts..."
                  value={folderModalName}
                  onInput={(e) => setFolderModalName((e.currentTarget as HTMLInputElement).value)}
                  autoFocus
                  required
                />
              </label>

              {!editingFolderId && (
                <label class="form-field">
                  <span>Parent Folder (Optional)</span>
                  <select
                    value={folderModalParentId || ''}
                    onChange={(e) =>
                      setFolderModalParentId((e.currentTarget as HTMLSelectElement).value || null)
                    }
                  >
                    <option value="">(None - Top Level Root Folder)</option>
                    {allAvailableFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div class="organizer-modal__actions">
                <button
                  type="button"
                  class="button button--secondary"
                  onClick={() => setShowFolderModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="button button--accent">
                  {editingFolderId ? 'Save Changes' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCRIPT MODAL (Create or Edit Script) */}
      {showScriptModal && (
        <div class="organizer-modal-backdrop" onClick={() => setShowScriptModal(false)}>
          <div class="organizer-modal organizer-modal--large" onClick={(e) => e.stopPropagation()}>
            <div class="organizer-modal__header">
              <h3>{scriptEditId ? 'Edit Script' : 'Create New Script'}</h3>
              <button
                type="button"
                class="organizer-modal__close"
                onClick={() => setShowScriptModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveScript} class="organizer-modal__body">
              <div class="modal-form-grid">
                <label class="form-field">
                  <span>Script Title</span>
                  <input
                    type="text"
                    placeholder="e.g. Keynote Presentation 2026"
                    value={scriptTitle}
                    onInput={(e) => setScriptTitle((e.currentTarget as HTMLInputElement).value)}
                    required
                  />
                </label>

                <label class="form-field">
                  <span>Category / Folder</span>
                  <select
                    value={scriptFolderId}
                    onChange={(e) =>
                      setScriptFolderId((e.currentTarget as HTMLSelectElement).value)
                    }
                  >
                    <option value="">Uncategorized</option>
                    {allAvailableFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {mode === 'admin' && (
                <label class="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={scriptIsShared}
                    onChange={(e) =>
                      setScriptIsShared((e.currentTarget as HTMLInputElement).checked)
                    }
                  />
                  <span>
                    Publish as Shared Script (automatically available to all recording users)
                  </span>
                </label>
              )}

              <label class="form-field">
                <div class="form-field-header">
                  <span>Script Content</span>
                  <label class="file-import-label">
                    <span>Upload from file (.txt, .md)</span>
                    <input
                      type="file"
                      accept=".txt,.md"
                      onChange={handleImportFile}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                <textarea
                  rows={10}
                  placeholder="Paste or write teleprompter script here..."
                  value={scriptContent}
                  onInput={(e) => setScriptContent((e.currentTarget as HTMLTextAreaElement).value)}
                  required
                />
              </label>

              <div class="script-modal-stats">
                {(() => {
                  const s = getScriptStats(scriptContent);
                  return (
                    <span>
                      Stats: <strong>{s.words}</strong> words • Estimated reading time:{' '}
                      <strong>{s.duration}</strong>
                    </span>
                  );
                })()}
              </div>

              <div class="organizer-modal__actions">
                <button
                  type="button"
                  class="button button--secondary"
                  onClick={() => setShowScriptModal(false)}
                >
                  Cancel
                </button>
                {scriptContent.trim() && (
                  <button
                    type="button"
                    class="button button--primary"
                    onClick={() =>
                      handleUseInTeleprompter({
                        id: scriptEditId || '',
                        title: scriptTitle || 'Untitled Script',
                        content: scriptContent,
                        folder_id: scriptFolderId || null,
                        created_by: '',
                        creator_name: '',
                        is_shared: scriptIsShared ? 1 : 0,
                        created_at: '',
                        updated_at: '',
                      })
                    }
                  >
                    ▶ Launch Teleprompter
                  </button>
                )}
                <button type="submit" class="button button--accent" disabled={scriptSaving}>
                  {scriptSaving ? 'Saving…' : scriptEditId ? 'Update Script' : 'Save Script'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
