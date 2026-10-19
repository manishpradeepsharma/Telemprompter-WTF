export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

export interface ScriptItem {
  id: string;
  title: string;
  content: string;
  created_by: string;
  creator_name: string;
  is_shared: number;
  folder_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  is_shared: number;
  created_at: string;
}

export interface RecordingItem {
  id: string;
  filename: string;
  original_name: string;
  filepath: string;
  filesize: number;
  mimetype: string;
  duration_seconds: number;
  script_id: string | null;
  script_title: string | null;
  script_content?: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
  live_script_id?: string | null;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: string;
}

export interface FinalCutItem {
  id: string;
  title: string;
  filename: string;
  original_name: string;
  filepath: string;
  filesize: number;
  mimetype: string;
  duration_seconds: number;
  folder_id: string | null;
  folder_name: string | null;
  script_id: string | null;
  script_title: string | null;
  platform_tag: string;
  notes: string | null;
  user_id: string;
  user_name: string;
  user_email?: string;
  created_at: string;
}

export const api = {
  async getAuth(): Promise<User | null> {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user ?? null;
    } catch {
      return null;
    }
  },

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<{ user?: User; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Login failed' };
      return { user: data.user };
    } catch {
      return { error: 'Network error or server unavailable' };
    }
  },

  async signup(data: {
    email: string;
    password: string;
    name: string;
    role: 'user' | 'admin';
  }): Promise<{ user?: User; error?: string }> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Signup failed' };
      return { user: result.user };
    } catch {
      return { error: 'Network error or server unavailable' };
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
  },

  async getFolders(): Promise<{ sharedFolders: FolderItem[]; myFolders: FolderItem[] }> {
    try {
      const res = await fetch('/api/folders', { credentials: 'include' });
      if (!res.ok) return { sharedFolders: [], myFolders: [] };
      return await res.json();
    } catch {
      return { sharedFolders: [], myFolders: [] };
    }
  },

  async createFolder(data: {
    name: string;
    parent_id?: string | null | undefined;
    is_shared?: boolean | undefined;
  }): Promise<{ folder?: FolderItem; error?: string }> {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to create folder' };
      return { folder: result };
    } catch {
      return { error: 'Network error or server unavailable' };
    }
  },

  async updateFolder(
    id: string,
    data: { name?: string | undefined; parent_id?: string | null | undefined },
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const result = await res.json();
        return { ok: false, error: result.error || 'Failed to update folder' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error' };
    }
  },

  async deleteFolder(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE', credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getScripts(): Promise<{ sharedScripts: ScriptItem[]; myScripts: ScriptItem[] }> {
    try {
      const res = await fetch('/api/scripts', { credentials: 'include' });
      if (!res.ok) return { sharedScripts: [], myScripts: [] };
      return await res.json();
    } catch {
      return { sharedScripts: [], myScripts: [] };
    }
  },

  async createScript(data: {
    title: string;
    content: string;
    is_shared?: boolean | undefined;
    folder_id?: string | null | undefined;
  }): Promise<{ script?: ScriptItem; error?: string }> {
    try {
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to save script' };
      return { script: result };
    } catch {
      return { error: 'Network error or server unavailable' };
    }
  },

  async updateScript(
    id: string,
    data: {
      title?: string | undefined;
      content?: string | undefined;
      is_shared?: boolean | undefined;
      folder_id?: string | null | undefined;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/scripts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const result = await res.json();
        return { ok: false, error: result.error || 'Failed to update script' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error' };
    }
  },

  async batchMoveScripts(
    scriptIds: string[],
    folderId: string | null,
  ): Promise<{ ok: boolean; count?: number; error?: string }> {
    try {
      const res = await fetch('/api/scripts/move-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_ids: scriptIds, folder_id: folderId }),
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) return { ok: false, error: result.error || 'Failed to move scripts' };
      return { ok: true, count: result.count };
    } catch {
      return { ok: false, error: 'Network error' };
    }
  },

  async deleteScript(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/scripts/${id}`, { method: 'DELETE', credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async uploadRecording(payload: {
    videoBlob: Blob;
    durationSeconds: number;
    scriptTitle?: string | undefined;
    scriptId?: string | undefined;
    scriptContent?: string | undefined;
    folderId?: string | undefined;
    folderName?: string | undefined;
  }): Promise<{ recording?: RecordingItem; error?: string }> {
    try {
      const formData = new FormData();
      const ext = payload.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('video', payload.videoBlob, `recording-${Date.now()}.${ext}`);
      formData.append('durationSeconds', String(payload.durationSeconds));
      if (payload.scriptTitle) formData.append('scriptTitle', payload.scriptTitle);
      if (payload.scriptId) formData.append('scriptId', payload.scriptId);
      if (payload.scriptContent) formData.append('scriptContent', payload.scriptContent);
      if (payload.folderId) formData.append('folderId', payload.folderId);
      if (payload.folderName) formData.append('folderName', payload.folderName);

      const res = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Upload failed' };
      return { recording: data };
    } catch {
      return { error: 'Network error during upload' };
    }
  },

  async getRecordings(): Promise<{ recordings: RecordingItem[]; role: 'user' | 'admin' }> {
    try {
      const res = await fetch('/api/recordings', { credentials: 'include' });
      if (!res.ok) return { recordings: [], role: 'user' };
      return await res.json();
    } catch {
      return { recordings: [], role: 'user' };
    }
  },

  async deleteRecording(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getFinalCuts(): Promise<{ finalCuts: FinalCutItem[]; role: 'user' | 'admin' }> {
    try {
      const res = await fetch('/api/final-cuts', { credentials: 'include' });
      if (!res.ok) return { finalCuts: [], role: 'user' };
      return await res.json();
    } catch {
      return { finalCuts: [], role: 'user' };
    }
  },

  async uploadFinalCut(payload: {
    videoFile: File;
    title: string;
    folderId?: string | undefined;
    folderName?: string | undefined;
    scriptId?: string | undefined;
    scriptTitle?: string | undefined;
    platformTag?: string | undefined;
    notes?: string | undefined;
    durationSeconds?: number | undefined;
  }): Promise<{ finalCut?: FinalCutItem; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('video', payload.videoFile);
      formData.append('title', payload.title);
      if (payload.folderId) formData.append('folderId', payload.folderId);
      if (payload.folderName) formData.append('folderName', payload.folderName);
      if (payload.scriptId) formData.append('scriptId', payload.scriptId);
      if (payload.scriptTitle) formData.append('scriptTitle', payload.scriptTitle);
      if (payload.platformTag) formData.append('platformTag', payload.platformTag);
      if (payload.notes) formData.append('notes', payload.notes);
      if (payload.durationSeconds)
        formData.append('durationSeconds', String(payload.durationSeconds));

      const res = await fetch('/api/final-cuts/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Upload failed' };
      return { finalCut: data };
    } catch {
      return { error: 'Network error during upload' };
    }
  },

  async deleteFinalCut(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/final-cuts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
