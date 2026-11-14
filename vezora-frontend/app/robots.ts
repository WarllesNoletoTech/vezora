import type {MetadataRoute} from 'next';
import {SITE_URL} from '@/lib/seo-server';

export default function robots():MetadataRoute.Robots{
 return {
  rules:{userAgent:'*',allow:['/','/api/media/'],disallow:['/api/','/agendamento/']},
  sitemap:SITE_URL+'/sitemap.xml',
  host:SITE_URL
 };
}
