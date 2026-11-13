/** Limpa somente o cookie de sessao local, independentemente do Heroku. */
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function POST() {
 const response=NextResponse.json({ok:true});
 response.cookies.set('vezora_session','',{path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',expires:new Date(0),maxAge:0});
 response.headers.set('Cache-Control','no-store');
 return response;
}
