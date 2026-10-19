import { useState } from 'preact/hooks';
import { api } from '../domain/api';

export default function LoginForm(): preact.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await api.login({ email, password });
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
        <h1 class="auth-card__title">Welcome back</h1>
        <p class="auth-card__subtitle">Log in to manage shared scripts and recordings</p>
      </div>

      {error && (
        <div class="auth-alert auth-alert--error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} class="auth-form">
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
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>

        <button type="submit" disabled={submitting} class="button button--primary auth-submit-btn">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div class="auth-card__footer">
        <p>
          Don&apos;t have an account? <a href="/signup">Sign up here</a>
        </p>
      </div>
    </div>
  );
}
