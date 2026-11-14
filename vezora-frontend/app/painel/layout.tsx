import type {Metadata} from 'next';
import type {ReactNode} from 'react';

/** Área pessoal/operacional: nunca deve ser exibida em resultados públicos de busca. */
export const metadata:Metadata={robots:{index:false,follow:false,noarchive:true}};

export default function PrivateLayout({children}:{children:ReactNode}){return children;}
