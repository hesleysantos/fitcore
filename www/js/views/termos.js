// Privacidade e termos de uso: um texto só, usado na folha de Ajustes e nos blocos da tela Sobre.
// Cada afirmação foi conferida no código e nas fontes:
//   - nada é enviado: o código não faz requisição de rede, e a página bloqueia conexões (CSP connect-src 'none' em
//     index.html); fontes, imagens e scripts só do próprio site ('self'); sem analytics nem anúncios;
//   - dados no aparelho: store.js (IndexedDB, com reserva em localStorage);
//   - GitHub Pages: "When a GitHub Pages site is visited, the visitor's IP address is logged and stored for security
//     purposes, regardless of whether the visitor has signed into GitHub or not." (docs.github.com, "About GitHub Pages",
//     seção "Data collection");
//   - LGPD (Lei 13.709/2018, texto do planalto.gov.br): dado referente à saúde é dado pessoal sensível (art. 5º, II), que
//     só pode ser tratado nas hipóteses do art. 11;
//   - termos: os mesmos cuidados do Treinador e da corrida (triagem PAR-Q+ e liberação médica em logic/saude.js; sinais
//     para parar o exercício; menores de idade com acompanhamento de um adulto, como em logic/corrida.js).
import { h, sheet, btn } from '../ui.js';

export const PRIVACIDADE = [
  ['Sem conta e sem servidor.', 'O FitCore não tem cadastro nem servidor. Tudo o que você registra (treinos, corridas, peso, sono, alimentação, dores e respostas de saúde) fica só neste aparelho, guardado pelo navegador.'],
  ['Nada é enviado.', 'O aplicativo não manda seus dados para ninguém. Não tem anúncios, análise de uso, rastreadores nem conteúdo de outros sites, e a página bloqueia qualquer envio pela internet.'],
  ['A internet só baixa o aplicativo.', 'Ela serve para baixar os arquivos do aplicativo e as atualizações. O site fica no GitHub Pages, que registra e guarda o endereço IP de quem visita, por segurança, mesmo sem conta no GitHub. Seus registros não vão para lá.'],
  ['Backup e planilhas são seus.', 'Só são criados quando você pede, não têm senha e ficam onde você salvar. Guarde em lugar seu e envie só a quem você escolher.'],
  ['Como apagar tudo.', 'Em Ajustes, toque em “Apagar todos os meus dados”. Limpar os dados do site no navegador também apaga. Backups e planilhas que você salvou fora do aplicativo você mesmo apaga.'],
  ['Permissões.', 'O aplicativo não pede localização, câmera, microfone nem contatos. A única permissão, opcional, é a de notificações, para avisar o fim do descanso.'],
  ['Lei Geral de Proteção de Dados.', 'Pela LGPD (Lei 13.709/2018), dado sobre saúde é dado pessoal sensível (art. 5º, II), com regras mais rígidas de uso (art. 11). Por isso o FitCore não coleta nada: os dados ficam com você, que pode ver, exportar e apagar tudo a qualquer momento.'],
];
export const TERMOS = [
  ['Informação, não tratamento.', 'O FitCore dá informação educativa sobre treino, corrida, sono e alimentação. Não faz diagnóstico, não prescreve tratamento e não substitui médico, profissional de educação física ou nutricionista. O Treinador e a Nutricionista são assistentes que seguem regras fixas.'],
  ['Antes de começar.', 'As perguntas de saúde seguem a triagem PAR-Q+. Quando ela pede liberação médica, comece só depois de passar por um médico. Doença, dor, gravidez ou muito tempo parado também pedem avaliação antes.'],
  ['Pare e procure ajuda', 'se sentir dor ou pressão no peito, falta de ar fora do normal, tontura, desmaio ou palpitações.'],
  ['Menores de 18 anos', 'só devem usar com um responsável e, de preferência, com acompanhamento de um profissional.'],
  ['Por sua conta.', 'Você decide o que fazer com as sugestões. Cargas, ritmos e calorias são estimativas: na dúvida, diminua ou pare.'],
];

const paragrafos = (itens) => itens.map(([t, txt]) => h('p', null, h('b', { text: t }), ' ' + txt));
export const blocoPrivacidade = () => paragrafos(PRIVACIDADE);
export const blocoTermos = () => paragrafos(TERMOS);

// Folhas abertas pelos links do fim de Ajustes
export function abrirPrivacidade() {
  const s = sheet({ title: 'Privacidade', body: h('div', { class: 'col textos-legais', id: 'folha-privacidade' }, blocoPrivacidade()), footer: [btn('Fechar', () => s.close(), 'ghost')] });
  return s;
}
export function abrirTermos() {
  const s = sheet({ title: 'Termos de uso', body: h('div', { class: 'col textos-legais', id: 'folha-termos' }, blocoTermos()), footer: [btn('Fechar', () => s.close(), 'ghost')] });
  return s;
}
