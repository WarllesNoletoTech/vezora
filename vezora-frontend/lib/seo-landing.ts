/** Páginas próprias por segmento, com conteúdo específico e sem depoimentos inventados. */
export const landingPages={
 'agendamento-para-barbearias':{
  title:'Sistema de agendamento online para barbearias',
  description:'Organize cortes e barbas, horários dos barbeiros e reservas online com a identidade da sua barbearia. Conheça a agenda Vezora.',
  tag:'BARBEARIAS',heading:'Sua barbearia com horários organizados e reservas online.',
  lead:'Quando os barbeiros trabalham em horários diferentes, a agenda precisa mostrar a disponibilidade certa para cada atendimento. O Vezora permite organizar a equipe e criar uma página com a identidade da barbearia, onde o cliente escolhe o serviço, o profissional e o horário disponível.',
  challenges:['Evitar dois clientes no mesmo horário do barbeiro.','Definir a duração de corte, barba e combos separadamente.','Compartilhar o link da barbearia pelo Instagram ou WhatsApp.'],
  steps:['Cadastre corte masculino, barba e combos com duração e preço.','Defina a escala de cada barbeiro.','Divulgue sua página e receba agendamentos online.'],
  faq:[['Preciso de um aplicativo diferente para cada barbeiro?','Não. Cada estabelecimento gerencia seus profissionais e horários no mesmo painel.'],['É possível exigir sinal?','Sim. Você pode configurar um sinal nos serviços e receber pelo Mercado Pago conectado ao estabelecimento.']]
 },
 'agenda-para-nail-designers':{
  title:'Agenda online para nail designers e manicures',
  description:'Agendamento online para nail designer, banho em gel, alongamento e manicure. Personalize a marca, organize horários e receba sinais pelo Vezora.',
  tag:'UNHAS',heading:'Mais organização para suas clientes de unhas.',
  lead:'Alongamento, manutenção, banho em gel e esmaltação têm durações diferentes. Uma agenda online facilita a escolha do procedimento e do horário sem depender de mensagens para cada marcação. No Vezora, sua cliente vê a identidade visual do estúdio e reserva diretamente.',
  challenges:['Informar preço e duração de cada procedimento.','Manter os horários de manutenção organizados.','Pedir sinal para reduzir reservas não confirmadas.'],
  steps:['Cadastre alongamento, manutenção e esmaltação.','Personalize logo, capa e cores do estúdio.','Defina o sinal e compartilhe seu link com as clientes.'],
  faq:[['Posso usar minha própria logo?','Sim. Você envia a logo e a imagem de capa no painel da marca.'],['As clientes precisam criar conta?','Não. Elas preenchem os dados necessários durante o agendamento.']]
 },
 'agendamento-para-lash-designers':{
  title:'Agendamento online para lash designers',
  description:'Agenda de extensão de cílios e manutenção para lash designers. Tenha horários organizados, página personalizada e lembretes pelo WhatsApp.',
  tag:'CÍLIOS',heading:'Uma agenda que acompanha os atendimentos do seu studio de cílios.',
  lead:'Procedimentos de aplicação e manutenção de cílios costumam exigir tempos específicos. Com o Vezora, você informa esses tempos, organiza a disponibilidade e oferece às clientes uma página de reservas com a marca do seu espaço.',
  challenges:['Separar aplicação completa e manutenção por duração.','Exibir somente os horários disponíveis.','Enviar lembretes de atendimento com mensagens prontas.'],
  steps:['Cadastre técnicas e manutenções como serviços.','Organize os dias e horários de atendimento.','Envie o link de agendamento e acompanhe as reservas.'],
  faq:[['O sistema envia mensagens sozinho pelo WhatsApp?','As mensagens de confirmação e lembrete são preparadas pelo Vezora, mas você escolhe quando enviá-las pelo WhatsApp.'],['Posso ter mais de uma profissional?','Sim. Você pode cadastrar profissionais com horários diferentes.']]
 },
 'agenda-para-saloes':{
  title:'Sistema de agendamento para salões de beleza',
  description:'Agenda online para salão de beleza com profissionais, serviços, relatórios e agendamentos personalizados. Organize sua operação com o Vezora.',
  tag:'SALÕES',heading:'Uma agenda para serviços, profissionais e horários do salão.',
  lead:'Corte, escova, coloração e outros serviços podem ocupar períodos diferentes da agenda. O Vezora reúne horários e profissionais no mesmo sistema, oferece uma página pública para reservas e disponibiliza relatórios de atendimentos no painel.',
  challenges:['Gerenciar agendas individuais em uma equipe.','Organizar preços e durações de serviços variados.','Acompanhar atendimentos e indicadores financeiros.'],
  steps:['Cadastre os serviços e valores do salão.','Configure cada profissional e seus horários.','Compartilhe a página para as clientes escolherem o atendimento.'],
  faq:[['Posso cadastrar funcionárias e comissões?','Sim. O painel permite registrar profissionais, salário contratado e regras de comissão.'],['As clientes escolhem o profissional?','Sim. A página de reservas mostra os profissionais disponíveis para escolher.']]
 },
 'agendamentos-com-pix':{
  title:'Agendamento online com sinal por Pix',
  description:'Conheça o Vezora: agendamentos online com sinal via Pix ou cartão usando a conta Mercado Pago do próprio estabelecimento.',
  tag:'PAGAMENTOS',heading:'Confirme horários com um sinal online por Pix.',
  lead:'Quando um serviço exige reserva antecipada, o Vezora permite configurar um sinal e encaminhar o cliente para pagar com o Mercado Pago. O recebimento fica associado à conta conectada pelo próprio estabelecimento, sem exigir que o cliente tenha uma conta no Mercado Pago para pagar via Pix.',
  challenges:['Definir quais serviços exigem sinal e o valor.','Oferecer Pix e cartão em uma experiência de pagamento externa.','Acompanhar o status do sinal na reserva após a confirmação do provedor.'],
  steps:['Conecte a conta Mercado Pago do estabelecimento.','Configure o sinal dos serviços escolhidos.','Compartilhe o link e acompanhe a confirmação do pagamento.'],
  faq:[['O Vezora recebe o dinheiro do sinal?','O sinal é direcionado à conta Mercado Pago que o estabelecimento autorizou. A assinatura do Vezora é uma cobrança separada.'],['O agendamento é confirmado sem pagamento?','Quando há sinal obrigatório, a reserva só é confirmada depois da aprovação do pagamento.']]
 }
} as const;
export type SeoLandingSlug=keyof typeof landingPages;
