import Link from 'next/link';
export default function Brand({light=false}:{light?:boolean}){
 return <Link href="/" aria-label="Vezora — Página inicial" className={`brand ${light?'light':''}`}>
   <img className="brand-mark-image" src="/brand/vezora-symbol.svg" alt="" width={38} height={38} decoding="async"/>
   <span className="brand-name">vezora<span className="brand-dot">.</span></span>
 </Link>;
}
