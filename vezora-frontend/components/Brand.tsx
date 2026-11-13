import Link from 'next/link';
export default function Brand({light=false}:{light?:boolean}){
  return <Link href="/" className={`brand ${light?'light':''}`}><span className="brand-symbol"><span>v</span></span><span>vezora<span className="brand-dot">.</span></span></Link>;
}
