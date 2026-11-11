// Minha academia, Ajustes (com backup) e Sobre.
import { h, btn, icon, note, toggle, seg, stepper, sectionTitle, toast, confirmSheet, sheet, fmtDate, plural, dateKey } from '../ui.js';
import { state, update, exportData, readBackup, applyBackup, previousInfo, restorePrevious, resetAll } from '../store.js';
import { refresh, replace } from '../router.js';
import { EXERCICIOS } from '../data/exercises.js';
import { EQUIPAMENTOS, CATEGORIAS_EQUIP } from '../data/equipment.js';
import { REFS } from '../data/knowledge.js';
import { isNativeApp, nativeCall } from '../device.js';
import { canSuggestInstall, openInstall } from '../install.js';

export const APP_VERSAO = '1.0.0';

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
  try { readBackup(text); } catch { toast('O histórico ficou grande demais para um backup. Fale com o suporte do app.'); return; }
  const marcar = () => update((st) => { st.ui.backupEm = new Date().toISOString(); });
  if (isNativeApp()) {
    try {
      await nativeCall('Aparelho', 'compartilharBackup', { nome, texto: text });
      marcar(); refresh();
      return;
    } catch { /* cai para a cópia manual */ }
    copiar(text, marcar);
    return;
  }
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const file = typeof File !== 'undefined' ? new File([blob], nome, { type: 'application/json' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: 'Backup do FitCore' });
      marcar(); refresh();
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: nome });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    marcar(); toast('Backup salvo na pasta de downloads'); refresh();
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
function importar() {
  const ta = h('textarea', { class: 'input', rows: 5, placeholder: 'Ou cole aqui o texto do backup', 'aria-label': 'Texto do backup' });
  const file = h('input', { type: 'file', accept: 'application/json,.json,text/plain', class: 'input', 'aria-label': 'Arquivo de backup' });
  // primeiro lê e valida; só depois mostra o que será restaurado e pede a confirmação
  const aplicar = async (text) => {
    let lido;
    try { lido = readBackup(text); } catch (e) { toast(e.message || 'Não foi possível ler o backup.'); return; }
    const r = lido.resumo;
    const partes = [`Este backup tem ${plural(r.treinos, 'treino', 'treinos')} no histórico e ${plural(r.planos, 'plano', 'planos')}${r.exportadoEm ? `, feito em ${fmtDate(r.exportadoEm, true)}` : ''}.`,
      `Hoje este aparelho tem ${plural(state.sessions.length, 'treino', 'treinos')} e ${plural(state.plans.length, 'plano', 'planos')}, que serão substituídos.`];
    if (state.current) partes.push('O treino em andamento será descartado.');
    if (r.descartados) partes.push(`${plural(r.descartados, 'registro inválido foi ignorado', 'registros inválidos foram ignorados')}.`);
    partes.push('Se mudar de ideia, use “Desfazer a última restauração” em Ajustes.');
    const ok = await confirmSheet({ title: 'Restaurar este backup?', text: partes.join(' '), okLabel: 'Restaurar', danger: true });
    if (!ok) return;
    await applyBackup(lido.dados);
    sh.close();
    toast(`Backup restaurado: ${plural(r.treinos, 'treino', 'treinos')} no histórico.`);
    replace('');
  };
  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    if (!f) return;
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

// ---------- Ajustes ----------
export function settingsView() {
  const st = state.settings;
  const set = (k, v) => { update((s) => { s.settings[k] = v; }); };
  const linha = (titulo, sub, ctrl) => h('div', { class: 'row between menu-item' }, h('div', { class: 'grow' }, h('div', { class: 'bold', text: titulo }), sub ? h('div', { class: 'small muted', text: sub }) : null), ctrl);
  const body = [];
  body.push(sectionTitle('Aparência'));
  body.push(h('div', { class: 'card col' }, h('div', { class: 'bold', text: 'Tema' }), seg([['auto', 'Automático'], ['escuro', 'Escuro'], ['claro', 'Claro']], st.tema, (v) => { set('tema', v); refresh(); })));
  body.push(h('div', { class: 'card tight' },
    linha('Figuras em movimento', 'As demonstrações tocam sozinhas, como um vídeo.', toggle(st.animar !== false, (v) => set('animar', v), 'Figuras em movimento'))));
  body.push(sectionTitle('Durante o treino'));
  body.push(h('div', { class: 'card tight' },
    linha('Manter a tela ligada', 'Enquanto o treino está aberto.', toggle(st.telaLigada, (v) => set('telaLigada', v), 'Manter a tela ligada')),
    linha('Som ao fim do descanso', 'Dois bipes.', toggle(st.som, (v) => set('som', v), 'Som ao fim do descanso')),
    linha('Vibrar ao fim do descanso', 'Só no Android.', toggle(st.vibrar, (v) => set('vibrar', v), 'Vibrar ao fim do descanso'))));
  body.push(h('div', { class: 'card row between' }, h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Descanso padrão' }), h('div', { class: 'small muted', text: 'Para o treino livre, em segundos.' })), stepper({ value: st.descanso, min: 15, max: 600, step: 15, label: 'Descanso padrão em segundos', cls: 'sm', onChange: (v) => set('descanso', v) })));

  body.push(sectionTitle('Seus dados'));
  body.push(note('info', 'Seus dados ficam só neste aparelho. Faça backup de vez em quando para não perder.'));
  body.push(h('div', { class: 'card col' },
    h('div', { class: 'small muted', text: state.ui.backupEm ? `Último backup gerado em ${fmtDate(state.ui.backupEm, true)}` : 'Você ainda não fez nenhum backup.' }),
    btn('Fazer backup agora', exportar, 'block primary', 'download'),
    btn('Restaurar um backup', importar, 'block', 'upload')));
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
    const ok = await confirmSheet({ title: 'Apagar tudo?', text: 'Todos os treinos, planos, histórico e respostas serão apagados deste aparelho. Não dá para desfazer.', okLabel: 'Apagar tudo', danger: true });
    if (!ok) return;
    const ok2 = await confirmSheet({ title: 'Tem certeza?', text: 'Esta é a última confirmação. Se quiser guardar os dados, cancele e faça um backup antes.', okLabel: 'Sim, apagar', danger: true });
    if (!ok2) return;
    await resetAll();
    if (isNativeApp()) nativeCall('Aparelho', 'limparBackups', {}).catch(() => {});
    toast('Dados apagados');
    replace('');
  }, 'block plain danger', 'trash'));
  return { title: 'Ajustes', back: '', body };
}

// ---------- Sobre ----------
export function aboutView() {
  const body = [];
  body.push(h('div', { class: 'card col center' }, h('img', { src: 'icons/icon-192.png', alt: '', width: 72, height: 72, class: 'appic-l' }), h('h2', { text: 'FitCore — Treino e Nutrição' }), h('p', { class: 'small muted', text: `Versão ${APP_VERSAO}` })));
  const bloco = (titulo, ps) => { const d = h('details', { class: 'acc' }, h('summary', { text: titulo })); const inner = h('div'); for (const p of ps) inner.appendChild(typeof p === 'string' ? h('p', { text: p }) : p); d.appendChild(inner); return d; };
  body.push(bloco('Aviso importante sobre saúde', [
    'Este aplicativo oferece informação educativa sobre exercícios e alimentação, baseada em diretrizes e estudos publicados. Ele não faz diagnóstico, não prescreve tratamento, treino individualizado ou dieta, e não substitui médico, profissional de educação física ou nutricionista.',
    'Antes de iniciar um programa de exercícios, principalmente se você tem alguma doença, sente dor, está grávida ou está parado há muito tempo, procure avaliação médica.',
    'Interrompa o exercício e procure atendimento se sentir dor ou pressão no peito, falta de ar fora do normal, tontura, desmaio ou palpitações.',
    'O “Treinador” e a “Nutricionista” do aplicativo são assistentes virtuais que seguem regras fixas. Não são profissionais registrados.',
  ]));
  body.push(bloco('Privacidade e seus dados', [
    'Tudo o que você registra (treinos, peso, respostas ao Treinador e à Nutricionista) fica guardado somente neste aparelho. O aplicativo não tem cadastro, não envia dados para servidores, não usa anúncios, rastreadores nem serviços de terceiros.',
    'Como os dados não saem do aparelho, só você tem acesso a eles. O arquivo de backup, quando você decide criá-lo, não tem senha e fica sob sua responsabilidade: guarde-o em lugar seguro, pois contém informações de saúde. No Android, a cópia temporária usada para compartilhar o backup é apagada quando você faz um novo backup ou apaga os dados.',
    'Você pode apagar todos os dados a qualquer momento em Ajustes → Apagar todos os meus dados. Desinstalar o aplicativo ou limpar os dados do navegador também apaga tudo.',
    'O aplicativo funciona sem internet. Na versão aberta ou instalada pelo navegador (iPhone, Android ou computador), a conexão só é usada para baixar o próprio aplicativo e suas atualizações.',
    'Permissão usada no Android: só vibração (aviso do fim do descanso). O aplicativo Android nem sequer pede acesso à internet: o próprio sistema impede qualquer conexão. Nenhuma permissão de localização, câmera, microfone, contatos ou arquivos.',
  ]));
  const refs = h('div', { class: 'col gap-s' });
  for (const k of Object.keys(REFS)) refs.appendChild(h('p', { class: 'ref', text: '• ' + REFS[k] }));
  body.push(bloco(`Referências científicas (${Object.keys(REFS).length})`, [h('p', { class: 'small', text: 'As orientações do Treinador e da Nutricionista vêm destas publicações:' }), refs]));
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
