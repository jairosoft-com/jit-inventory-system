import { useLocation } from 'react-router-dom';

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const title = pathname
    .split('/')
    .pop()
    ?.replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Page';

  return (
    <div className="dash-page animate-fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">{title}</h1>
          <p className="dash-page-desc">This section is currently a placeholder for Iteration 1.</p>
        </div>
      </div>
      <div className="dash-card" style={{ marginTop: '24px' }}>
        <div className="dash-card-content-empty">
          <div className="dash-empty-state">
            <div className="dash-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 17v-5M12 17V9M15 17v-3" />
              </svg>
            </div>
            <h3 className="dash-empty-heading">{title} Content Stub</h3>
            <p className="dash-empty-text">This feature will be fully implemented in a subsequent release.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
