'use client';

import AdminDashboard from './AdminDashboard';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryState = { failed: boolean; message: string };
class AdminBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, message: '' };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { failed: true, message: error?.message || 'Falha inesperada ao renderizar o painel.' };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Vezora] Falha na área administrativa', error, info.componentStack);
  }
  render() {
    if (this.state.failed) {
      return <main className="ad-bootstrap" role="alert"><div className="ad-bootstrap-card">
        <div className="ad-bootstrap-logo">!</div>
        <h1>O painel não conseguiu carregar</h1>
        <p>Ocorreu uma falha na interface administrativa. Os dados do MongoDB não foram alterados.</p>
        <p className="ad-bootstrap-error">{this.state.message}</p>
        <div className="ad-bootstrap-actions">
          <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button>
          <a href="/admin/diagnostico">Abrir diagnóstico</a>
        </div>
      </div></main>;
    }
    return this.props.children;
  }
}

export default function AdminLoader() {
  return <AdminBoundary><AdminDashboard /></AdminBoundary>;
}
