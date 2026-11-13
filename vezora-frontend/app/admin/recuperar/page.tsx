import type { Metadata } from 'next';
import RecoverSessionButton from './RecoverSessionButton';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Recuperar acesso administrativo',robots:{index:false,follow:false}};
export default function Page(){return <main className="ad-bootstrap"><section className="ad-bootstrap-card"><div className="ad-bootstrap-logo">V</div><h1>Recuperar acesso ao Vezora</h1><p>Esta opção encerra apenas a sessão armazenada neste navegador. Não modifica lojistas, reservas ou o MongoDB.</p><RecoverSessionButton/><p>Se a interface continuar desatualizada, limpe os dados apenas de <b>vezora-agendamentos.vercel.app</b> nas configurações do Chrome e entre novamente.</p></section></main>}
