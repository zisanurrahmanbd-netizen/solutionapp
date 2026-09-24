import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { PermissionsProvider } from './context/PermissionsContext';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'sans-serif', background: '#000', color: '#fff', minHeight: '100vh' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>Application Encountered an Error</h1>
          <pre style={{ background: '#18181b', padding: 16, borderRadius: 8, overflowX: 'auto', marginTop: 16, color: '#a1a1aa' }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 20, padding: '10px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
          >
            Clear Cache & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <BrandingProvider>
            <AuthProvider>
              <PermissionsProvider>
                <App />
              </PermissionsProvider>
            </AuthProvider>
          </BrandingProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// ── PWA: register the service worker (production builds only) ─────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });

    // Activate any waiting service worker immediately instead of waiting
    // for every tab to close.
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        reg.waiting.postMessage('SKIP_WAITING');
      }
    });

    // When a new service worker takes control, reload once so the page
    // runs the latest bundle instead of a stale cached shell.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('sw:autoReload') === '1') return;
      sessionStorage.setItem('sw:autoReload', '1');
      window.location.reload();
    });
  });
}