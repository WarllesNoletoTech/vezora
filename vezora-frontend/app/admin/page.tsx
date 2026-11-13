import type { Metadata } from 'next';
import AdminLoader from './AdminLoader';

export const metadata: Metadata = {
  title: 'Administração',
  description: 'Painel administrativo do Vezora',
  robots: { index: false, follow: false },
};

// Entrada renderizável no servidor: mantém um estado legível mesmo
// quando o JavaScript do dashboard falha durante o carregamento.
export default function AdminPage() {
  return <AdminLoader />;
}
