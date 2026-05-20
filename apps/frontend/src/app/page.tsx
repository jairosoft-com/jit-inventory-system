"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { login, checkAuth, user, isLoading: storeLoading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user && !storeLoading) {
      router.push("/dashboard");
    }
  }, [user, storeLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Please check your credentials and try again.");
      setIsLoading(false);
    }
  };

  if (storeLoading) {
    return (
      <div className="login-page">
        <div className="login-bg-grid" />
        <span className="login-spinner" style={{ width: "40px", height: "40px", borderColor: "rgba(37,99,235,0.1)", borderTopColor: "#2563eb" }} />
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Premium white enterprise background decorations */}
      <div className="login-bg-grid" />
      <div className="login-bg-glow login-bg-glow--1" />
      <div className="login-bg-glow login-bg-glow--2" />

      <div className="login-container animate-fade-in-up">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
              <path
                d="M12 14h16v2H12zm0 5h12v2H12zm0 5h14v2H12z"
                fill="white"
                opacity="0.95"
              />
              <defs>
                <linearGradient
                  id="logo-grad"
                  x1="0"
                  y1="0"
                  x2="40"
                  y2="40"
                >
                  <stop stopColor="#2563eb" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="login-title">JIT Inventory</h1>
            <p className="login-subtitle">
              Equipment &amp; Asset Management
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="login-divider" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <h2 className="login-form-heading">Sign in to your account</h2>

          {error && (
            <div className="login-error" role="alert">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="login-field">
            <label htmlFor="login-email" className="login-label">
              Email address
            </label>
            <div className="login-input-wrapper">
              <svg
                className="login-input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="M22 7l-10 6L2 7" />
              </svg>
              <input
                id="login-email"
                type="email"
                placeholder="admin@jitims.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="login-field">
            <div className="login-label-row">
              <label htmlFor="login-password" className="login-label">
                Password
              </label>
              <button type="button" className="login-forgot" tabIndex={-1}>
                Forgot password?
              </button>
            </div>
            <div className="login-input-wrapper">
              <svg
                className="login-input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="11" width="18" height="11" rx="3" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="login-spinner" />
            ) : (
              <>
                Sign In
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="login-footer">
          © {new Date().getFullYear()} JIT IMS — All rights reserved.
        </p>
      </div>

      <style>{`
        /* ── Login Page ────────────────────────── */

        .login-page {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
          background: #f8fafc;
          overflow: hidden;
        }

        /* Background grid overlay */
        .login-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
        }

        /* Floating premium soft ambient glow blobs */
        .login-bg-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
        }
        .login-bg-glow--1 {
          width: 500px;
          height: 500px;
          top: -15%;
          left: -10%;
          background: rgba(37, 99, 235, 0.05);
        }
        .login-bg-glow--2 {
          width: 400px;
          height: 400px;
          bottom: -10%;
          right: -8%;
          background: rgba(59, 130, 246, 0.03);
        }

        /* Clean White Card container */
        .login-container {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: 40px 36px 32px;
          box-shadow: var(--shadow-lg);
        }

        /* Brand */
        .login-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }

        .login-logo {
          flex-shrink: 0;
        }

        .login-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: 11px;
          color: var(--text-tertiary);
          margin: 2px 0 0;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        /* Divider */
        .login-divider {
          height: 1px;
          background: var(--surface-border);
          margin-bottom: 28px;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .login-form-heading {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 4px;
        }

        /* Error banner */
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--danger-muted);
          color: var(--danger);
          border: 1px solid rgba(220, 38, 38, 0.15);
          border-radius: var(--radius-md);
          font-size: 13px;
          animation: fadeIn 0.25s ease;
        }

        /* Field */
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .login-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .login-forgot {
          background: none;
          border: none;
          font-size: 12px;
          color: var(--accent);
          cursor: pointer;
          padding: 0;
          transition: color var(--transition-fast);
        }
        .login-forgot:hover {
          color: var(--accent-hover);
        }

        /* Input wrapper */
        .login-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .login-input-icon {
          position: absolute;
          left: 14px;
          color: var(--text-tertiary);
          pointer-events: none;
          transition: color var(--transition-fast);
        }

        .login-input-wrapper:focus-within .login-input-icon {
          color: var(--accent);
        }

        .login-input {
          width: 100%;
          height: 44px;
          padding: 0 14px 0 42px;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 14px;
          font-family: inherit;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .login-input::placeholder {
          color: var(--input-placeholder);
        }
        .login-input:focus {
          outline: none;
          border-color: var(--input-border-focus);
          box-shadow: 0 0 0 3px var(--accent-muted);
        }

        /* Password toggle */
        .login-toggle-pw {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color var(--transition-fast);
        }
        .login-toggle-pw:hover {
          color: var(--text-secondary);
        }

        /* Submit Button */
        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 44px;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          margin-top: 4px;
          transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: var(--shadow-glow);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Spinner */
        .login-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* Footer */
        .login-footer {
          text-align: center;
          font-size: 11px;
          color: var(--text-tertiary);
          margin: 28px 0 0;
        }

        /* ── Responsive ──────────────────────── */

        @media (max-width: 480px) {
          .login-container {
            padding: 28px 20px 24px;
            border-radius: var(--radius-lg);
          }
        }
      `}</style>
    </div>
  );
}
