import { useEffect, useState } from 'preact/hooks';
import { api, type User } from '../domain/api';
import ScriptOrganizer from './ScriptOrganizer';

export default function UserScripts(): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuth().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div class="admin-loading">Loading script workspace…</div>;
  }

  return (
    <div class="user-scripts-container user-scripts-container--dense">
      {!user && (
        <div class="admin-alert admin-alert--warning admin-alert--compact">
          💡 Browsing organization library as guest. <a href="/login">Log in</a> to create, edit, or
          organize scripts and folders.
        </div>
      )}

      <ScriptOrganizer mode="user" currentUser={user} />
    </div>
  );
}
