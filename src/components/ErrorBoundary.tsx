import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#07090e] text-neutral-200 flex flex-col items-center justify-center p-6 text-center font-mono">
          <div className="max-w-md w-full bg-neutral-950 border border-red-800/80 rounded-lg p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-red-950/60 border border-red-700/80 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-red-400">FUJA DA SOLANGE!!</h1>
            <p className="text-xs text-neutral-400">
              Ocorreu um imprevisto na renderização. Não se preocupe, seus dados locais estão seguros.
            </p>
            {this.state.error && (
              <div className="text-[11px] bg-red-950/40 border border-red-900/50 text-red-300 p-2.5 rounded text-left overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold py-2.5 rounded text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <RotateCcw className="w-4 h-4" /> RECARREGAR O JOGO
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded text-xs cursor-pointer transition"
              >
                Voltar à Página Inicial
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
