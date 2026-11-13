export const businessOptions = [
  {value:'BARBEARIA', label:'Barbearia', headline:'Corte, barba e estilo', subtitle:'Seu próximo visual começa aqui.', primary:'#B8844A', secondary:'#171C21', icon:'scissors'},
  {value:'CABELEIREIRO', label:'Cabeleireiro(a)', headline:'Seu cabelo, seu estilo', subtitle:'Transforme seu visual com quem entende.', primary:'#9B6B48', secondary:'#30261F',icon:'waves'},
  {value:'SALAO_BELEZA', label:'Salão de beleza', headline:'Realce sua melhor versão', subtitle:'Momentos especiais começam com autocuidado.', primary:'#9A667C', secondary:'#332432',icon:'sparkles'},
  {value:'NAIL_DESIGNER', label:'Nail designer', headline:'Unhas que fazem a diferença', subtitle:'Agende o próximo design das suas unhas.', primary:'#AC4E7A', secondary:'#33192D',icon:'hand'},
  {value:'MANICURE_PEDICURE', label:'Manicure e pedicure', headline:'Um toque de cuidado', subtitle:'Seu próximo atendimento está a um clique.', primary:'#B66479', secondary:'#3A2730',icon:'hand'},
  {value:'LASH_DESIGNER', label:'Lash designer', headline:'Seu olhar em destaque', subtitle:'Escolha um horário para valorizar o seu olhar.', primary:'#8467B2', secondary:'#2E2242',icon:'eye'},
  {value:'SOBRANCELHAS', label:'Design de sobrancelhas', headline:'Cada detalhe importa', subtitle:'Realce a expressão do seu olhar.', primary:'#986A45', secondary:'#39291D',icon:'eye'},
  {value:'ESTETICA', label:'Estética', headline:'Cuidado que transforma', subtitle:'Reserve um tempo para você.', primary:'#4E867D', secondary:'#19312F',icon:'flower'},
  {value:'MAQUIAGEM', label:'Maquiagem', headline:'Seu brilho, sua ocasião', subtitle:'Atendimentos para momentos únicos.', primary:'#B16E87', secondary:'#3C2635',icon:'palette'},
  {value:'DEPILACAO', label:'Depilação', headline:'Seu momento de cuidado', subtitle:'Praticidade para sua rotina.', primary:'#7C8A62', secondary:'#283128',icon:'sparkles'},
  {value:'MASSOTERAPIA', label:'Massoterapia', headline:'Pausa para relaxar', subtitle:'Renove suas energias agendando seu atendimento.', primary:'#577F80', secondary:'#1B3035',icon:'flower'},
  {value:'PODOLOGIA', label:'Podologia', headline:'Cuidado em cada passo', subtitle:'Seu bem-estar merece atenção.', primary:'#577F98', secondary:'#20323C',icon:'footprints'},
  {value:'OUTROS', label:'Outros serviços', headline:'Seu próximo horário está aqui', subtitle:'Agende com praticidade e segurança.', primary:'#346D84', secondary:'#182E3C',icon:'calendar'}
] as const;
export type BusinessType = typeof businessOptions[number]['value'];
export function businessTheme(type:BusinessType|null|undefined){return businessOptions.find(b=>b.value===type)||businessOptions[businessOptions.length-1];}
