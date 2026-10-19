import { useState } from 'preact/hooks';
import { api } from '../domain/api';

export default function SignupForm(): preact.JSX.Element {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    setSubmitting(true);

    const result = await api.signup({ name, email, password, role });
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.user?.role === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div class="auth-card">
      <div class="auth-card__header">
        <h1 class="auth-card__title">Create an account</h1>
        <p class="auth-card__subtitle">
          Join to manage your scripts, shared team content, and video captures
        </p>
      </div>

      {error && (
        <div class="auth-alert auth-alert--error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} class="auth-form">
        <label class="auth-field">
          <span>Full Name</span>
          <input
            type="text"
            required
            autoComplete="name"
            placeholder="Jane Doe"
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>

        <label class="auth-field">
          <span>Email address</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>

        <label class="auth-field">
          <span>Password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>

        <div class="auth-role-select">
          <span class="auth-role-title">Account Role</span>
          <div class="auth-role-options">
            <label class={`auth-role-card ${role === 'user' ? 'auth-role-card--selected' : ''}`}>
              <input
                type="radio"
                name="role"
                value="user"
                checked={role === 'user'}
                onChange={() => setRole('user')}
              />
              <div class="auth-role-card__content">
                <strong>Standard User</strong>
                <small>
                  Record with teleprompter, create personal scripts, and save video recordings
                </small>
              </div>
            </label>

            <label class={`auth-role-card ${role === 'admin' ? 'auth-role-card--selected' : ''}`}>
              <input
                type="radio"
                name="role"
                value="admin"
                checked={role === 'admin'}
                onChange={() => setRole('admin')}
              />
              <div class="auth-role-card__content">
                <strong>Administrator</strong>
                <small>
                  Upload and share scripts for recording users, and manage all recordings
                </small>
              </div>
            </label>
          </div>
        </div>

        <button type="submit" disabled={submitting} class="button button--primary auth-submit-btn">
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <div class="auth-card__footer">
        <p>
          Already have an account? <a href="/login">Log in here</a>
        </p>
      </div>
    </div>
  );
}
