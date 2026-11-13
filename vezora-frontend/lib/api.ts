export async function api<T>(path:string,options:RequestInit={}) :Promise<T>{
  const res=await fetch(`/api${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})},cache:'no-store'});
  const isJson=(res.headers.get('content-type')||'').includes('application/json');
  const value=isJson?await res.json().catch(()=>({})):{};
  if(!res.ok){
    if(res.status===404 && !isJson) throw new Error('Rota da API nao encontrada. Verifique o deploy do frontend e o endereco do backend.');
    throw new Error((value as {error?:string}).error || (res.status>=500?'Serviço temporariamente indisponível. Tente novamente em alguns instantes.':`Erro ${res.status}`));
  }
  return value as T;
}
export function brl(cents:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);}
export function niceDate(date:string,timeZone='America/Sao_Paulo'){return new Date(date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone});}
export function whatsappUrl(phone:string,msg:string){const digits=phone.replace(/\D/g,'');const p=digits.startsWith('55') && (digits.length===12 || digits.length===13)?digits:`55${digits}`;return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;}
export type Service={id:string;name:string;description:string;priceCents:number;durationMin:number;depositMode:'NONE'|'PERCENT'|'FIXED';depositValue:number;active:boolean};
export type Professional={id:string;name:string;photoUrl:string;active:boolean;schedule:Record<string,[string,string]|null>};
export type Tenant={id:string;name:string;slug:string;bio:string;whatsapp:string;instagram:string;address:string;logoUrl:string;coverUrl:string;primaryColor:string;secondaryColor:string;timezone:string};
export type Booking={id:string;clientName:string;clientPhone:string;startAt:string;endAt:string;status:string;depositCents:number;paymentStatus:string|null;service:{name:string;priceCents:number};professional:{name:string}};

/** Envia somente os campos editáveis; chaves internas do MongoDB são imutáveis. */
export function editableTenant(t: Tenant) {
  return {
    name: t.name, bio: t.bio, whatsapp: t.whatsapp, instagram: t.instagram,
    address: t.address, logoUrl: t.logoUrl, coverUrl: t.coverUrl,
    primaryColor: t.primaryColor, secondaryColor: t.secondaryColor, timezone: t.timezone
  };
}
