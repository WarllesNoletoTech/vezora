'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import Brand from '@/components/Brand';
export default function AppError({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('[Vezora UI] Erro inesperado',error)},[error]);
 return <main className="system-state-page"><div className="system-state-card"><Brand/><AlertTriangle size={45} color="#9D5D8D"/><h1>Não conseguimos abrir esta página</h1><p>Tente carregar novamente. Se persistir, informe o erro ao suporte.</p><button className="btn btn-primary" onClick={reset}><RefreshCcw size={18}/> Tentar novamente</button></div></main>
}
