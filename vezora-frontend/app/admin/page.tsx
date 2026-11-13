import type { Metadata } from 'next';
import AdminLoader from './AdminLoader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Administração',
  description: 'Painel administrativo do Vezora',
  robots: { index: false, follow: false },
};

// Renderiza o estado inicial da área administrativa no HTML do servidor.
// Evita a tela totalmente branca quando o carregamento do JS não se completa.
export default function AdminPage() {
  return <AdminLoader />;
}
