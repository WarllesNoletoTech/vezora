import type { Metadata } from 'next';
import AdminDiagnosticPanel from './AdminDiagnosticPanel';

export const metadata: Metadata = { title: 'Diagnóstico administrativo', robots: { index: false, follow: false } };

// Texto renderizado no servidor independente do JavaScript do navegador.
export default function DiagnosticPage() {
  return <main className="ad-diagnostic-page">
    <div className="ad-diagnostic-card">
      <span className="ad-diagnostic-mark">Vezora • Diagnóstico</span>
      <h1>Verificação do painel administrativo</h1>
      <p>Se esta mensagem apareceu, o servidor Next.js está entregando a rota de diagnóstico. A verificação abaixo identifica sessão, API e permissão de administrador.</p>
      <AdminDiagnosticPanel />
      <a href="/admin">Voltar ao painel</a>
    </div>
  </main>;
}
