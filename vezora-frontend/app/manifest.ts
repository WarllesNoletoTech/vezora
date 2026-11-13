import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
 return {
  name: 'Vezora — Agendamentos', short_name:'Vezora', description:'Sua marca. Sua agenda. Seu negócio.',
  start_url:'/painel', scope:'/', display:'standalone', background_color:'#172737', theme_color:'#172737', lang:'pt-BR',
  icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]
 };
}
