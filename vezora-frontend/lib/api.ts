export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name='ApiError';
  }
}
export async function api<T>(path:string,options:RequestInit={}) :Promise<T>{
  if(!path.startsWith('/')||path.startsWith('//')) throw new ApiError('Caminho de API inválido',400);
  let res: Response;
  try {
    const headers=new Headers(options.headers);
    if(options.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
    res=await fetch(`/api${path}`,{...options,credentials:'same-origin',headers,cache:'no-store'});
  } catch(error) {
    if(error instanceof Error && error.name==='AbortError')throw error;
    throw new ApiError('Falha de conexão com a API. Verifique sua internet e o Heroku.',0);
  }
  const isJson=(res.headers.get('content-type')||'').includes('application/json');
  const value=isJson?await res.json().catch(()=>({})):{ };
  if(!res.ok){
    const backendMessage=(value as {error?:unknown}).error;
    const requestId=((value as {requestId?:unknown}).requestId || res.headers.get('x-request-id'));
    const supportCode=typeof requestId==='string' && /^[a-zA-Z0-9-]{8,80}$/.test(requestId)?` (referência: ${requestId})`:'';
    const message=typeof backendMessage==='string'&&backendMessage.trim()?backendMessage:
      res.status===401?'Entre na sua conta novamente.':
      res.status===403?'Você não possui permissão para esta operação.':
      res.status===404?'Rota da API não encontrada. Confira as versões publicadas.':
      res.status>=500?'Serviço temporariamente indisponível. Confira os logs do Heroku.':`Erro HTTP ${res.status}`;
    throw new ApiError(res.status>=500?message+supportCode:message,res.status);
  }
  return value as T;
}
export function brl(cents:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);}
export function niceDate(date:string,timeZone='America/Sao_Paulo'){return new Date(date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone});}
export function whatsappUrl(phone:string,msg:string){const digits=phone.replace(/\D/g,'');const p=digits.startsWith('55') && (digits.length===12 || digits.length===13)?digits:`55${digits}`;return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;}
export type Service={id:string;name:string;description:string;priceCents:number;durationMin:number;depositMode:'NONE'|'PERCENT'|'FIXED';depositValue:number;active:boolean};
export type Professional={id:string;name:string;photoUrl:string;active:boolean;schedule:Record<string,[string,string]|null>;role:'OWNER'|'EMPLOYEE'|'CONTRACTOR';salaryEnabled:boolean;salaryCents:number;commissionMode:'NONE'|'PERCENT'|'FIXED';commissionValue:number};
import type {BusinessType} from '@/lib/business';
export type Tenant={businessType:BusinessType|null;id:string;name:string;slug:string;bio:string;whatsapp:string;instagram:string;address:string;logoUrl:string;coverUrl:string;primaryColor:string;secondaryColor:string;timezone:string};
export type Booking={id:string;clientName:string;clientPhone:string;startAt:string;endAt:string;status:string;depositCents:number;paymentStatus:string|null;service:{name:string;priceCents:number};professional:{name:string}};

/** Envia somente os campos editáveis; chaves internas do MongoDB são imutáveis. */
export function editableTenant(t: Tenant) {
  return {
    businessType: t.businessType, name: t.name, bio: t.bio, whatsapp: t.whatsapp, instagram: t.instagram,
    address: t.address, logoUrl: t.logoUrl, coverUrl: t.coverUrl,
    primaryColor: t.primaryColor, secondaryColor: t.secondaryColor, timezone: t.timezone
  };
}
