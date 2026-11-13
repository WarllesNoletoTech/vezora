import { BusinessType } from '@prisma/client';

export const businessChoices = Object.values(BusinessType);
export const businessThemes: Record<BusinessType, {label:string; primary:string; secondary:string}> = {
  BARBEARIA: {label:'Barbearia',primary:'#B8844A',secondary:'#171C21'},
  CABELEIREIRO: {label:'Cabeleireiro(a)',primary:'#9B6B48',secondary:'#30261F'},
  SALAO_BELEZA: {label:'Salão de beleza',primary:'#9A667C',secondary:'#332432'},
  NAIL_DESIGNER: {label:'Nail designer',primary:'#AC4E7A',secondary:'#33192D'},
  MANICURE_PEDICURE: {label:'Manicure e pedicure',primary:'#B66479',secondary:'#3A2730'},
  LASH_DESIGNER: {label:'Lash designer',primary:'#8467B2',secondary:'#2E2242'},
  SOBRANCELHAS: {label:'Design de sobrancelhas',primary:'#986A45',secondary:'#39291D'},
  ESTETICA: {label:'Estética',primary:'#4E867D',secondary:'#19312F'},
  MAQUIAGEM: {label:'Maquiagem',primary:'#B16E87',secondary:'#3C2635'},
  DEPILACAO: {label:'Depilação',primary:'#7C8A62',secondary:'#283128'},
  MASSOTERAPIA: {label:'Massoterapia',primary:'#577F80',secondary:'#1B3035'},
  PODOLOGIA: {label:'Podologia',primary:'#577F98',secondary:'#20323C'},
  OUTROS: {label:'Outros serviços',primary:'#346D84',secondary:'#182E3C'}
};
export function themeFor(value: BusinessType) {return businessThemes[value];}
