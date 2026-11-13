'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
export default function MobileNav(){
 const [open,setOpen]=useState(false);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 return <div className="mobile-nav-wrap">
   <button type="button" className="mobile-nav-toggle" aria-label={open?'Fechar menu de navegação':'Abrir menu de navegação'} aria-expanded={open} aria-controls="vezora-mobile-nav" onClick={()=>setOpen(!open)}>{open?<X size={22}/>:<Menu size={22}/>}</button>
   {open&&<nav id="vezora-mobile-nav" className="mobile-nav-panel" aria-label="Navegação principal">
     <a href="/#recursos" onClick={()=>setOpen(false)}>Recursos</a>
     <a href="/#como-funciona" onClick={()=>setOpen(false)}>Como funciona</a>
     <a href="/#planos" onClick={()=>setOpen(false)}>Planos</a>
     <Link href="/entrar" onClick={()=>setOpen(false)}>Entrar</Link>
     <Link href="/cadastro" className="mobile-nav-primary" onClick={()=>setOpen(false)}>Criar meu espaço <ArrowRight size={17}/></Link>
   </nav>}
 </div>;
}
