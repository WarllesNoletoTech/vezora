import Link from 'next/link';
import { ArrowLeft, CalendarX2 } from 'lucide-react';
import Brand from '@/components/Brand';
export default function NotFound(){return <main className="system-state-page"><div className="system-state-card"><Brand/><CalendarX2 size={45} color="#9D5D8D"/><h1>Página não encontrada</h1><p>O link pode ter mudado ou o espaço de agendamentos não existe.</p><Link href="/" className="btn btn-primary"><ArrowLeft size={18}/> Voltar para o início</Link></div></main>}
