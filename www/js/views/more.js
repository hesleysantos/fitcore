// Minha academia, Ajustes (com backup) e Sobre.
import { h, btn, icon, note, toggle, seg, stepper, sectionTitle, toast, confirmSheet, sheet, fmtDate, plural, dateKey } from '../ui.js';
import { state, update, exportData, readBackup, applyBackup, previousInfo, restorePrevious, resetAll } from '../store.js';
import { refresh, replace } from '../router.js';
import { EXERCICIOS } from '../data/exercises.js';
import { EQUIPAMENTOS, CATEGORIAS_EQUIP } from '../data/equipment.js';
import { REFS } from '../data/knowledge.js';
import { REFS_CORRIDA } from '../data/corrida.js';
import { REFS_SONO } from '../data/sono.js';
import { cancelarAviso, avisoDisponivel, avisoPermitido, pedirPermissaoDeAviso, telaLigadaDisponivel, SONS_ALERTA, SOM_PADRAO, tocarAlerta, unlockAudio, prepararSom } from '../device.js';
import { canSuggestInstall, openInstall, isIos } from '../install.js';
import { entregarArquivo } from './arquivo.js';
import { abrirExportar } from './exportar.js';
import { abrirPrivacidade, abrirTermos, blocoPrivacidade, blocoTermos } from './termos.js';
import { folhaDoNome } from './home.js';

export const APP_VERSAO = '1.28.0';

// ---------- Minha academia ----------
export function gymView() {
  const body = [];
  body.push(h('p', { class: 'muted', text: 'Marque os aparelhos que a sua academia tem. O Treinador e os filtros de exercícios passam a considerar só o que está disponível.' }));
  body.push(h('div', { class: 'card row between' }, h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Minha academia tem tudo' }), h('div', { class: 'small muted', text: 'Desligue para escolher aparelho por aparelho.' })), toggle(state.gym.all, (v) => { update((s) => { s.gym.all = v; }); refresh(); }, 'Minha academia tem todos os aparelhos')));
  if (!state.gym.all) {
    const disp = EXERCICIOS.filter((e) => e.equip.every((q) => state.gym.has[q])).length;
    body.push(note('info', `${disp} de ${EXERCICIOS.length} exercícios podem ser feitos com os aparelhos marcados.`));
    body.push(h('div', { class: 'row' },
      btn('Marcar todos', () => { update((s) => { for (const k of Object.keys(EQUIPAMENTOS)) s.gym.has[k] = true; }); refresh(); }, 'sm grow'),
      btn('Desmarcar todos', () => { update((s) => { s.gym.has = {}; }); refresh(); }, 'sm grow ghost')));
    for (const [cat, nome] of Object.entries(CATEGORIAS_EQUIP)) {
      const card = h('div', { class: 'card tight' });
      for (const [k, e] of Object.entries(EQUIPAMENTOS)) {
        if (e.cat !== cat) continue;
        card.appendChild(h('div', { class: 'menu-item' }, h('span', { class: 'grow', text: e.nome }), toggle(!!state.gym.has[k], (v) => { update((s) => { if (v) s.gym.has[k] = true; else delete s.gym.has[k]; }); refresh(); }, e.nome)));
      }
      body.push(sectionTitle(nome));
      body.push(card);
    }
  }
  return { title: 'Minha academia', back: '', body };
}

// ---------- backup ----------
const AVISO_BACKUP = 'O arquivo de backup contém os seus dados de saúde e de treino, sem senha. Guarde-o só em um lugar seu (por exemplo, a sua nuvem pessoal) e não o envie a outras pessoas.';
async function exportar() {
  const ok = await confirmSheet({ title: 'Fazer backup', text: AVISO_BACKUP, okLabel: 'Continuar' });
  if (!ok) return;
  const text = exportData();
  const nome = `fitcore-backup-${dateKey()}.json`; // data local do aparelho
  try { readBackup(text); } catch { toast('O histórico ficou grande demais para um backup. Fale com o suporte do aplicativo.'); return; }
  const marcar = () => update((st) => { st.ui.backupEm = new Date().toISOString(); });
  try {
    const r = await entregarArquivo(text, nome, ['application/json', 'text/plain'], 'Backup do FitCore');
    if (r === 'cancelado') return; // a pessoa fechou a folha de compartilhar: não é erro
    marcar();
    if (r === 'baixado') toast('Backup gerado. Confira a pasta de downloads; se o arquivo não apareceu, use “Copiar o backup como texto”.');
    refresh();
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    copiar(text, marcar);
  }
}
function copiar(text, marcar) {
  const ta = h('textarea', { class: 'input', readonly: true, rows: 6, 'aria-label': 'Conteúdo do backup' });
  ta.value = text;
  const sh = sheet({
    title: 'Copiar backup',
    body: [h('p', { class: 'small muted', text: 'Toque em “Copiar” e cole o texto em um lugar seguro e só seu, como um bloco de notas protegido.' }), ta],
    footer: [btn('Fechar', () => sh.close(), 'ghost'), btn('Copiar', async () => {
      try { await navigator.clipboard.writeText(text); toast('Backup copiado'); marcar(); } catch { ta.focus(); ta.select(); toast('Selecione e copie o texto manualmente'); }
    }, 'primary', 'copy')],
  });
}
// "12 treinos, 20 noites de sono e 2 planos": só o que tem registro (itens com 0 ficam de fora). '' = nada.
function listaDeDados(r) {
  const itens = [
    [r.treinos, 'treino', 'treinos'], [r.corridas, 'corrida', 'corridas'], [r.noites, 'noite de sono', 'noites de sono'],
    [r.diasDeDiario, 'dia de diário alimentar', 'dias de diário alimentar'], [r.dores, 'registro de dor', 'registros de dor'],
    [r.pesos, 'registro de peso', 'registros de peso'], [r.planos, 'plano', 'planos'],
  ].filter(([n]) => Number(n) > 0).map(([n, um, varios]) => plural(n, um, varios));
  return itens.length <= 1 ? itens.join('') : itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
}
function importar() {
  const ta = h('textarea', { class: 'input', rows: 5, placeholder: 'Ou cole aqui o texto do backup', 'aria-label': 'Texto do backup' });
  const file = h('input', { type: 'file', accept: 'application/json,.json,text/plain', class: 'input', 'aria-label': 'Arquivo de backup' });
  // primeiro lê e valida; só depois mostra o que será restaurado e pede a confirmação
  const aplicar = async (text) => {
    let lido;
    try { lido = readBackup(text); } catch (e) { toast(e.message || 'Não foi possível ler o backup.'); return; }
    const r = lido.resumo;
    const doBackup = listaDeDados(r);
    const doAparelho = listaDeDados({ treinos: state.sessions.length, corridas: state.runs.length, noites: state.sono.registros.length, diasDeDiario: Array.isArray(state.diario.dias) ? state.diario.dias.length : 0, dores: state.dores.length, pesos: state.body.length, planos: state.plans.length });
    const feito = r.exportadoEm ? ` Feito em ${fmtDate(r.exportadoEm, true)}.` : '';
    const partes = [(doBackup ? `Este backup tem ${doBackup}.` : 'Este backup não tem registros.') + feito,
      doAparelho ? `Hoje este aparelho tem ${doAparelho}, que serão substituídos.` : 'Este aparelho ainda não tem registros.'];
    if (state.current) partes.push('O treino em andamento será descartado.');
    if (r.descartados) partes.push(`${plural(r.descartados, 'registro inválido foi ignorado', 'registros inválidos foram ignorados')}.`);
    partes.push('Se mudar de ideia, use “Desfazer a última restauração” em Ajustes.');
    const ok = await confirmSheet({ title: 'Restaurar este backup?', text: partes.join(' '), okLabel: 'Restaurar', danger: true });
    if (!ok) return;
    cancelarAviso(); // um descanso em contagem no treino descartado não deve tocar depois
    const guardou = await applyBackup(lido.dados);
    sh.close();
    toast(`Backup restaurado: ${plural(r.treinos, 'treino', 'treinos')} no histórico.${guardou ? '' : ' Não foi possível guardar os dados anteriores para desfazer.'}`);
    replace('');
  };
  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    if (!f) return;
    file.value = ''; // permite escolher o mesmo arquivo de novo depois de um erro
    if (f.size > 24 * 1024 * 1024) { toast('Arquivo grande demais para ser um backup do FitCore.'); return; }
    const rd = new FileReader();
    rd.onload = () => aplicar(String(rd.result || ''));
    rd.onerror = () => toast('Não foi possível ler o arquivo.');
    rd.readAsText(f);
  });
  const sh = sheet({
    title: 'Restaurar backup',
    body: [h('p', { class: 'small muted', text: 'Escolha o arquivo de backup salvo anteriormente (fitcore-backup-….json). Só restaure arquivos que você mesmo criou.' }), file, ta],
    footer: [btn('Cancelar', () => sh.close(), 'ghost'), btn('Restaurar texto colado', () => { if (ta.value.trim()) aplicar(ta.value.trim()); else toast('Cole o texto do backup ou escolha um arquivo.'); }, 'primary')],
  });
}

// Escolha do som do alerta (fim do descanso, fim de série por tempo e trocas da corrida): cada opção toca ao ser
// escolhida e "Ouvir" repete. "Silencioso" desliga o som (settings.som = false) e guarda o último som escolhido.
function escolhaDeSom(atual) {
  let escolhido = SONS_ALERTA[atual] ? atual : SOM_PADRAO;
  const box = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Som do alerta', id: 'som-alerta' });
  const sub = h('div', { class: 'small muted', id: 'som-alerta-sub' });
  const ouvir = btn('Ouvir', () => { unlockAudio(); tocarAlerta(escolhido); }, 'sm ghost', 'play');
  const desenhar = () => {
    while (box.firstChild) box.removeChild(box.firstChild);
    for (const [id, [nome]] of Object.entries(SONS_ALERTA)) box.appendChild(h('button', { type: 'button', class: 'chip' + (id === escolhido ? ' on' : ''), role: 'radio', 'aria-checked': id === escolhido ? 'true' : 'false', 'data-som': id,
      onClick: () => {
        escolhido = id;
        update((s) => { s.settings.som = id !== 'silencioso'; if (id !== 'silencioso') s.settings.somAlerta = id; });
        unlockAudio(); prepararSom(id); tocarAlerta(id); desenhar();
      } }, nome));
    sub.textContent = SONS_ALERTA[escolhido][1] + '.' + (escolhido === 'alto' ? ' Com fone de ouvido, prefira Equilibrado ou Discreto.' : '') + (isIos() && escolhido !== 'silencioso' ? ' No iPhone, o som toca por cima da música e não toca com o modo silencioso ligado.' : ' A música abaixa enquanto o aviso toca.');
    ouvir.style.visibility = escolhido === 'silencioso' ? 'hidden' : '';
  };
  desenhar();
  return h('div', { class: 'col gap-s menu-item' }, h('div', { class: 'row between' }, h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Som do alerta' }), h('div', { class: 'small muted', text: 'Fim do descanso, de séries por tempo e trocas da corrida.' })), ouvir), box, sub);
}

// ---------- Ajustes ----------
export function settingsView() {
  const st = state.settings;
  const set = (k, v) => { update((s) => { s.settings[k] = v; }); };
  const linha = (titulo, sub, ctrl) => h('div', { class: 'row between menu-item' }, h('div', { class: 'grow' }, h('div', { class: 'bold', text: titulo }), sub ? h('div', { class: 'small muted', text: sub }) : null), ctrl);
  const body = [];
  // nome da saudação do Início (views/home.js)
  body.push(h('button', { class: 'card row click', type: 'button', id: 'ajuste-nome', onClick: () => folhaDoNome() }, icon('user', 'accent'),
    h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Seu nome' }), h('div', { class: 'small muted', text: st.nome || 'Para a saudação do Início' })), icon('right', 's muted')));
  body.push(sectionTitle('Aparência'));
  body.push(h('div', { class: 'card col' }, h('div', { class: 'bold', text: 'Tema' }), seg([['auto', 'Automático'], ['escuro', 'Escuro'], ['claro', 'Claro']], st.tema, (v) => { set('tema', v); refresh(); }),
    // letra: 125% e 150% do tamanho do navegador (css/app.css); o zoom do aparelho continua valendo por cima
    h('div', { class: 'bold mt', text: 'Tamanho da letra' }), h('div', { id: 'letra' }, seg([['normal', 'Normal'], ['grande', 'Grande'], ['muito', 'Muito grande']], st.letra, (v) => { set('letra', v); refresh(); }))));
  body.push(h('div', { class: 'card tight' },
    linha('Alto contraste', 'Texto, bordas e foco mais fortes, no tema claro e no escuro.', toggle(!!st.contraste, (v) => set('contraste', v), 'Alto contraste')),
    linha('Figuras em movimento', 'As demonstrações tocam sozinhas, como um vídeo.', toggle(st.animar !== false, (v) => set('animar', v), 'Figuras em movimento'))));
  body.push(sectionTitle('Durante o treino'));
  body.push(h('div', { class: 'card tight' },
    telaLigadaDisponivel() ? linha('Manter a tela ligada', 'Durante o treino ou a corrida, a tela não apaga sozinha. Depois volta ao normal.' + (isIos() ? ' Em iPhones com sistema mais antigo pode não funcionar.' : ''), toggle(st.telaLigada, (v) => set('telaLigada', v), 'Manter a tela ligada')) : linha('Manter a tela ligada', 'Este navegador não oferece esse recurso. Aumente o tempo de bloqueio da tela nas configurações do aparelho.', h('span', { class: 'small muted', text: 'Indisponível' })),
    escolhaDeSom(st.som ? st.somAlerta : 'silencioso'),
    // fala do fim do descanso: no iPhone, é a fala que baixa a música um instante (device.js)
    linha('Falar “Descanso terminado”', isIos() ? 'Junto do som. No iPhone, a música abaixa enquanto a voz fala.' : 'Junto do som, no fim do descanso.', toggle(st.voz !== false, (v) => { set('voz', v); if (v) { unlockAudio(); tocarAlerta(st.somAlerta, 'Descanso terminado'); } }, 'Falar “Descanso terminado”')),
    linha('Vibrar ao fim do descanso', isIos() ? 'O iPhone não deixa páginas vibrarem: o aviso é o som e a tela.' : 'Só no Android.', toggle(st.vibrar, (v) => set('vibrar', v), 'Vibrar ao fim do descanso')),
    // aviso por notificação quando a pessoa troca de aplicativo durante o descanso (só onde o navegador oferece)
    // fora do app (device.js): no Android, o som e a notificação saem sozinhos, junto da música; no iPhone, o sistema pausa
    // o app fora da tela, e o aviso do fim só toca com ele aberto
    avisoDisponivel() ? linha('Notificação do descanso', isIos() ? 'Ao sair do app, mostra a hora do fim. No iPhone, o som do fim só toca com o app na tela: deixe-o aberto no descanso e mude a música pela Central de Controle.' : 'Ao sair do app, mostra a hora do fim e avisa quando acabar, sem pausar a sua música.', toggle(!!st.avisoFundo && avisoPermitido(), async (v) => {
      if (!v) { set('avisoFundo', false); return; }
      if (await pedirPermissaoDeAviso()) { set('avisoFundo', true); toast('Aviso ligado.'); } else { set('avisoFundo', false); toast('O navegador não deu permissão para notificações. Libere nas configurações do site e tente de novo.'); refresh(); }
    }, 'Notificação do descanso')) : null));
  body.push(h('div', { class: 'card row between' }, h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Descanso padrão' }), h('div', { class: 'small muted', text: 'Para o treino livre, em segundos.' })), stepper({ value: st.descanso, min: 15, max: 600, step: 15, label: 'Descanso padrão em segundos', cls: 'sm', onChange: (v) => set('descanso', v) })));

  body.push(sectionTitle('Seus dados'));
  body.push(note('info', 'Seus dados ficam só neste aparelho. Faça backup de vez em quando para não perder.'));
  body.push(h('div', { class: 'card col' },
    h('div', { class: 'small muted', text: state.ui.backupEm ? `Último backup gerado em ${fmtDate(state.ui.backupEm, true)}` : 'Você ainda não fez nenhum backup.' }),
    btn('Fazer backup agora', exportar, 'block primary', 'download'),
    btn('Restaurar um backup', importar, 'block', 'upload'),
    // caminho que funciona em qualquer aparelho, quando o arquivo não baixa nem compartilha
    btn('Copiar o backup como texto', async () => { const ok = await confirmSheet({ title: 'Copiar o backup', text: AVISO_BACKUP, okLabel: 'Continuar' }); if (!ok) return; const texto = exportData(); try { readBackup(texto); } catch { toast('O histórico ficou grande demais para um backup.'); return; } copiar(texto, () => update((x) => { x.ui.backupEm = new Date().toISOString(); })); }, 'block plain sm', 'copy'),
    // discreto, como o pedido: planilhas (CSV) e resumo para imprimir ficam dentro da folha
    btn('Exportar para planilha ou PDF', abrirExportar, 'block plain sm', 'share')));
  const desfazer = h('div');
  body.push(desfazer);
  previousInfo().then((p) => {
    if (!p || !desfazer.isConnected) return;
    desfazer.appendChild(btn(`Desfazer a última restauração (${plural(p.treinos, 'treino', 'treinos')} antes dela)`, async () => {
      const ok = await confirmSheet({ title: 'Desfazer a restauração?', text: 'Os dados que estavam no aparelho antes da última restauração voltam, e os dados atuais são substituídos.', okLabel: 'Desfazer', danger: true });
      if (!ok) return;
      if (await restorePrevious()) { toast('Restauração desfeita'); replace(''); }
    }, 'block', 'history'));
  }).catch(() => {});
  if (canSuggestInstall()) body.push(btn('Instalar o aplicativo neste aparelho', openInstall, 'block', 'phone'));
  body.push(btn('Apagar todos os meus dados', async () => {
    const ok = await confirmSheet({ title: 'Apagar tudo?', text: 'Todos os seus dados (treinos, corridas, sono, alimentação, peso, dores e respostas) serão apagados deste aparelho. Não dá para desfazer.', okLabel: 'Apagar tudo', danger: true });
    if (!ok) return;
    const ok2 = await confirmSheet({ title: 'Tem certeza?', text: 'Esta é a última confirmação. Se quiser guardar os dados, cancele e faça um backup antes.', okLabel: 'Sim, apagar', danger: true });
    if (!ok2) return;
    cancelarAviso();
    const apagou = await resetAll();
    toast(apagou ? 'Dados apagados' : 'Não foi possível apagar tudo: o armazenamento do aparelho não respondeu. Feche o aplicativo, abra de novo e repita.');
    replace('');
  }, 'block plain danger', 'trash'));
  // privacidade e termos: discretos, no fim, cada um abre a sua folha
  body.push(h('div', { class: 'row legal-links' }, btn('Privacidade', abrirPrivacidade, 'plain sm', 'shield'), btn('Termos de uso', abrirTermos, 'plain sm', 'book')));
  return { title: 'Ajustes', back: '', body };
}

// ---------- Sobre ----------
export function aboutView() {
  const body = [];
  body.push(h('div', { class: 'card col center' }, ...['claro', 'escuro'].map((v) => h('img', { src: `icons/logo-${v}.png`, alt: 'FitCore', width: 720, height: 584, class: 'logo-sobre so-' + v })), h('h2', { text: 'Treino e Nutrição' }), h('p', { class: 'small muted', text: `Versão ${APP_VERSAO}` })));
  const bloco = (titulo, ps) => { const d = h('details', { class: 'acc' }, h('summary', { text: titulo })); const inner = h('div'); for (const p of ps) inner.appendChild(typeof p === 'string' ? h('p', { text: p }) : p); d.appendChild(inner); return d; };
  // os mesmos textos das folhas de Privacidade e Termos de uso de Ajustes (views/termos.js)
  body.push(bloco('Termos de uso e aviso de saúde', blocoTermos()));
  body.push(bloco('Privacidade e seus dados', blocoPrivacidade()));
  const refs = h('div', { class: 'col gap-s' });
  // a mesma publicação pode estar nas duas listas: aparece uma vez só
  const todasRefs = [...new Set([...Object.values(REFS), ...Object.values(REFS_CORRIDA), ...Object.values(REFS_SONO)])];
  for (const t of todasRefs) refs.appendChild(h('p', { class: 'ref', text: '• ' + t }));
  body.push(bloco(`Referências científicas (${todasRefs.length})`, [h('p', { class: 'small', text: 'As orientações do Treinador (musculação e corrida), da Nutricionista e da meta de sono vêm destas publicações:' }), refs]));
  body.push(bloco('De onde vem a técnica dos exercícios', [
    'A descrição de cada exercício (posição, passo a passo, respiração, erros comuns e músculos) foi conferida, página por página, em bibliotecas de exercícios e publicações abertas: ACE (American Council on Exercise), NASM, NSCA, artigos científicos de acesso aberto e, quando não havia página nessas fontes, guias de treinadores certificados.',
    'As páginas usadas aparecem no fim da tela de cada exercício, em "Fontes da técnica". Quando as fontes divergem, o aplicativo fica com a orientação mais conservadora.',
  ]));
  body.push(bloco('Como as animações são feitas', [
    'As figuras são desenhadas pelo próprio aplicativo a partir de um modelo de corpo humano articulado, com ossos de comprimento fixo e articulações que respeitam os limites naturais de movimento. Elas tocam sozinhas, como um vídeo curto em repetição; para ver figuras paradas, desligue "Figuras em movimento" em Ajustes. Os músculos principais de cada exercício aparecem em vermelho e os auxiliares em laranja.',
    'Algumas animações usam vista de frente, de costas ou de cima para mostrar melhor o movimento; quando isso acontece, a vista é indicada na figura.',
  ]));
  body.push(h('p', { class: 'tiny muted center', text: 'Composição dos alimentos: TACO (NEPA/UNICAMP), TBCA (USP/FoRC) e USDA FoodData Central.' }));
  return { title: 'Sobre', back: '', body };
}
