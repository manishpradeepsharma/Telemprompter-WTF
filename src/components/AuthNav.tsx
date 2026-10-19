import { useEffect, useState } from 'preact/hooks';
import { api, type User } from '../domain/api';

export default function AuthNav(): preact.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuth().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    window.location.href = '/';
  };

  if (loading) {
    return <div class="auth-nav-skeleton" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div class="auth-nav">
        <a href="/login" class="auth-link auth-link--login">
          Log in
        </a>
        <a href="/signup" class="auth-btn auth-btn--signup">
          Sign up
        </a>
      </div>
    );
  }

  return (
    <div class="auth-nav auth-nav--logged-in">
      <div class="auth-user-info">
        <span class="auth-user-name">{user.name}</span>
        <span class={`auth-role-badge auth-role-badge--${user.role}`}>
          {user.role === 'admin' ? 'Admin' : 'User'}
        </span>
      </div>
      <div class="auth-links">
        {user.role === 'admin' && (
          <a href="/admin" class="auth-link auth-link--admin">
            Admin Panel
          </a>
        )}
        <a href="/scripts" class="auth-link">
          Scripts
        </a>
        <a href="/recordings" class="auth-link">
          Recordings
        </a>
        <button type="button" onClick={handleLogout} class="auth-btn-logout">
          Log out
        </button>
      </div>
    </div>
  );
}
