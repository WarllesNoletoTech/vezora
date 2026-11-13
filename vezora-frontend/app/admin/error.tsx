'use client';
import {useEffect} from 'react';
import Link from 'next/link';
import {AlertTriangle,RefreshCw} from 'lucide-react';
export default function AdminError({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('Falha ao renderizar painel admin',error)},[error]);
 return <main className="ad-denied" role="alert"><AlertTriangle size={40}/><h1>Não foi possível abrir o painel administrativo</h1><p>O painel encontrou um erro de renderização. Atualize a página ou verifique se as versões frontend e backend estão publicadas juntas.</p><small>Falha de renderização. Consulte F12 → Console para identificar o erro; não envie tokens nem credenciais.</small><button className="btn btn-primary" onClick={reset}><RefreshCw size={16}/> Tentar novamente</button><Link href="/entrar">Voltar ao login</Link></main>;
}
