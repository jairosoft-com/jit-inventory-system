import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, checkAuth, user, isLoading: storeLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!storeLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [storeLoading, user, navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Please check your credentials and try again.');
      setIsLoading(false);
    }
  };

  if (storeLoading || user) {
    return (
      <div className="login-page">
        <span
          className="login-spinner"
          style={{
            width: '40px',
            height: '40px',
            borderColor: 'rgba(31,94,255,0.12)',
            borderTopColor: '#1f5eff',
          }}
        />
      </div>
    );
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-cover" aria-label="JIT Inventory cover image">
          <div className="login-cover-overlay" />
        </section>

        <section className="login-panel">
          <div className="login-panel-header">
            <img className="login-panel-logo" src="/logo.svg" alt="JIT Inventory logo" />
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && (
              <div className="login-error" role="alert">
                <span>{error}</span>
              </div>
            )}

            <label className="login-field">
              <span>Email address</span>
              <input
                type="email"
                placeholder="admin@jitims.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="login-field">
              <div className="login-label-row">
                <span>Password</span>
                <button type="button" className="login-link" tabIndex={-1}>
                  Forgot password?
                </button>
              </div>
              <div className="login-password-row">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-visibility"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button id="login-submit" type="submit" className="login-submit" disabled={isLoading}>
              {isLoading ? <span className="login-spinner" /> : 'Sign In'}
            </button>
          </form>

          <p className="login-footer">© {new Date().getFullYear()} JIT IMS. All rights reserved.</p>
        </section>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(31, 94, 255, 0.08), transparent 32%),
            linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
        }

        .login-shell {
          width: min(1280px, 100%);
          min-height: min(800px, calc(100vh - 48px));
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
          overflow: hidden;
          border-radius: 32px;
          background: white;
          border: 1px solid rgba(215, 224, 234, 0.9);
          box-shadow: 0 24px 60px -28px rgba(15, 23, 42, 0.35);
        }

        .login-cover {
          position: relative;
          min-height: 100%;
          background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.4)),
            url('/login%20cover.jpg') center center / cover no-repeat;
        }

        .login-cover-overlay {
          position: absolute;
          inset: 0;
        }

        .login-panel {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }

        .login-panel-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          margin-top: -150px; /* Push the logo higher */
          margin-bottom: 100px; /* Adjust spacing below the logo */
        }

        .login-panel-logo {
          width: 300px; /* Enlarge the logo */
          height: 300px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .login-form {
          display: grid;
          gap: 18px;
        }

        .login-error {
          border: 1px solid rgba(197, 48, 48, 0.18);
          background: var(--danger-muted);
          color: var(--danger);
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 14px;
        }

        .login-field {
          display: grid;
          gap: 8px;
        }

        .login-field > span,
        .login-label-row > span {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .login-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .login-link {
          border: 0;
          background: transparent;
          padding: 0;
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .login-field input {
          width: 100%;
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid var(--surface-border);
          background: white;
          padding: 0 16px;
          font: inherit;
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        .login-field input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 4px var(--accent-muted);
        }

        .login-password-row {
          position: relative;
        }

        .login-password-row input {
          padding-right: 72px;
        }

        .login-visibility {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: var(--accent);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .login-submit {
          min-height: 50px;
          margin-top: 8px;
          border: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--accent), #5b8cff);
          color: white;
          font: inherit;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 16px 24px -16px rgba(31, 94, 255, 0.55);
        }

        .login-submit:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .login-spinner {
          display: inline-block;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        .login-footer {
          margin: 22px 0 0;
          color: var(--text-tertiary);
          font-size: 12px;
          text-align: center;
        }

        @media (max-width: 980px) {
          .login-page {
            padding: 16px;
          }

          .login-shell {
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .login-cover {
            min-height: 420px;
          }
        }

        @media (max-width: 640px) {
          .login-shell {
            border-radius: 24px;
          }

          .login-panel {
            padding: 28px 22px 24px;
          }

          .login-panel-header {
            margin-top: -10px;
            margin-bottom: 24px;
          }

          .login-panel-logo {
            width: 140px;
            height: 140px;
          }
        }
      `}</style>
    </main>
  );
}