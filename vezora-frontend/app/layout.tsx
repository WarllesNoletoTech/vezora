import type { Metadata } from 'next';
import type {ReactNode} from 'react';
import './globals.css';
export const metadata: Metadata = {title:'Vezora — Sua marca. Sua agenda.',description:'Agendamentos modernos para profissionais de beleza e bem-estar.'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
