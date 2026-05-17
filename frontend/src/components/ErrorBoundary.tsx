import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-surface p-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          
          <h1 className="text-3xl font-display font-bold text-on-surface mb-3">Oops! Terjadi Kesalahan</h1>
          <p className="text-on-surface-variant max-w-md mb-8 leading-relaxed">
            Aplikasi mengalami masalah teknis yang tidak terduga. Kami telah mencatat masalah ini untuk diperbaiki.
          </p>

          {this.state.error && (
            <div className="w-full max-w-2xl bg-surface-low border border-outline-variant/10 rounded-2xl p-4 mb-8 text-left overflow-auto max-h-48">
              <p className="text-red-400 font-mono text-xs whitespace-pre-wrap">
                {this.state.error.stack}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-surface rounded-2xl font-bold hover:shadow-neon-cyan transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Halaman</span>
            </button>
            
            <a
              href="/"
              className="flex items-center gap-2 px-6 py-3 bg-surface-high border border-outline-variant/10 text-on-surface rounded-2xl font-bold hover:bg-surface-highest transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Kembali ke Beranda</span>
            </a>
          </div>
          
          <p className="mt-12 text-xs text-on-surface-variant/40">
            Tridjaya Group Dashboard &bull; System Recovery Mode
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
