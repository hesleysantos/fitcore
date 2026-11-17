// Ponto de entrada: carrega o estado, monta a navegação e desenha a tela atual.
import { h, clear, icon, iconBtn, btn, toast } from './ui.js';
import { load, state, subscribe, onExternalChange, onSaveError, armazenamentoOk } from './store.js';
import { setRenderer, back, replace } from './router.js';
import { initInstall, maybeAutoPrompt } from './install.js';
import { homeView } from './views/home.js';
import { exercisesView, exerciseView } from './views/exercises.js';
import { plansView, dayView } from './views/plans.js';
import { sessionView } from './views/session.js';
import { historyView, sessionDetailView, progressView } from './views/history.js';
import { trainerView } from './views/trainer.js';
import { corridaView, corridaDiaView } from './views/corrida.js';
import { sonoView } from './views/sono.js';
import { nutritionView } from './views/nutrition.js';
import { gymView, settingsView, aboutView } from './views/more.js';

const ROUTES = [
  { re: /^$/, view: homeView, tab: 'inicio' },
  { re: /^treinos$/, view: plansView, tab: 'treinos' },
  { re: /^treino\/([\w-]+)\/([\w-]+)$/, view: dayView, tab: 'treinos' },
  { re: /^exercicios$/, view: exercisesView, tab: 'exercicios' },
  { re: /^exercicio\/([\w-]+)$/, view: exerciseView, tab: 'exercicios' },
  { re: /^sessao$/, view: sessionView, tab: 'treinos', noNav: true },
  { re: /^historico$/, view: historyView, tab: 'inicio' },
  { re: /^historico\/([\w-]+)$/, view: sessionDetailView, tab: 'inicio' },
  { re: /^progresso$/, view: progressView, tab: 'inicio' },
  { re: /^treinador$/, view: trainerView, tab: 'treinador' },
  { re: /^corrida$/, view: corridaView, tab: 'treinador' },
  { re: /^corrida\/dia\/(\d{4}-\d{2}-\d{2})$/, view: corridaDiaView, tab: 'treinador' },
  { re: /^sono$/, view: sonoView, tab: 'inicio' },
  { re: /^nutricao$/, view: nutritionView, tab: 'nutricao' },
  { re: /^academia$/, view: gymView, tab: 'inicio' },
  { re: /^ajustes$/, view: settingsView, tab: 'inicio' },
  { re: /^sobre$/, view: aboutView, tab: 'inicio' },
];
const TABS = [
  ['inicio', '', 'Início', 'home'],
  ['treinos', 'treinos', 'Treinos', 'dumbbell'],
  ['exercicios', 'exercicios', 'Exercícios', 'list'],
  ['treinador', 'treinador', 'Treinador', 'coach'],
  ['nutricao', 'nutricao', 'Nutrição', 'apple'],
];

const root = document.getElementById('app');
let cleanup = null;
let lastPath = null;

function applyTheme() {
  const t = state.settings.tema;
  const light = t === 'claro' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', light ? '#f3f4f7' : '#0e1116');
}

let diaDoDesenho = '';
function render(keepScroll = false) {
  diaDoDesenho = new Date().toDateString();
  let path = '';
  try { path = decodeURIComponent(location.hash.replace(/^#\/?/, '')); } catch { path = ''; }
  let route = null;
  let m = null;
  for (const r of ROUTES) { m = r.re.exec(path); if (m) { route = r; break; } }
  if (!route) { route = ROUTES[0]; m = ['']; }
  const y = keepScroll && path === lastPath ? window.scrollY : 0;
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  let page;
  try { page = route.view(...m.slice(1)) || {}; } catch { page = telaDeErro(); }
  if (page.redirect != null) { replace(page.redirect); return; } // pelo roteador, para o botão Voltar continuar certo
  clear(root);
  // barra superior
  const top = h('header', { class: 'topbar' });
  if (page.back != null) top.appendChild(iconBtn('back', 'Voltar', () => back(page.back)));
  top.appendChild(h('h1', { text: page.title || 'FitCore' }));
  for (const a of page.actions || []) top.appendChild(a);
  root.appendChild(top);
  const noNav = route.noNav || page.noNav;
  const main = h('main', { class: 'view' + (noNav ? ' no-nav' : ''), id: 'conteudo' });
  for (const c of [].concat(page.body || [])) if (c) main.appendChild(c);
  root.appendChild(main);
  if (page.footer) root.appendChild(page.footer);
  if (!noNav) {
    const inner = h('div', { class: 'nav-in' });
    for (const [key, href, label, ic] of TABS) {
      inner.appendChild(h('a', { href: '#/' + href, class: route.tab === key ? 'on' : '', 'aria-current': route.tab === key ? 'page' : null }, icon(ic), label));
    }
    root.appendChild(h('nav', { class: 'nav', 'aria-label': 'Navegação principal' }, inner));
  }
  cleanup = page.cleanup || null;
  lastPath = path;
  document.title = page.title && page.title !== 'FitCore' ? page.title + ' · FitCore' : 'FitCore — Treino e Nutrição';
  window.scrollTo(0, y);
}

// Se uma tela falhar, o app não fica preso: mostra como voltar e como proteger os dados.
function telaDeErro() {
  return {
    title: 'Algo deu errado',
    body: [
      h('div', { class: 'note warn' }, icon('warn'), h('div', { text: 'Não foi possível abrir esta tela. Seus dados continuam guardados no aparelho.' })),
      btn('Voltar ao início', () => { location.hash = '#/'; }, 'primary block', 'home'),
      btn('Abrir Ajustes (backup e restauração)', () => { location.hash = '#/ajustes'; }, 'block', 'settings'),
    ],
  };
}

window.addEventListener('hashchange', () => render());
setRenderer(render);

async function registerSw() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    let url = 'sw.js';
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      const policy = window.trustedTypes.createPolicy('fitcore-sw', { createScriptURL: (u) => { if (u === 'sw.js') return u; throw new TypeError('URL de script não permitida'); } });
      url = policy.createScriptURL('sw.js');
    }
    const reg = await navigator.serviceWorker.register(url, { scope: './' });
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          import('./ui.js').then(({ toast }) => toast('Nova versão instalada. Feche e abra o aplicativo para atualizar.'));
        }
      });
    });
  } catch { /* sem service worker: o app continua funcionando online */ }
}

async function boot() {
  // Defesa contra clickjacking: o app não roda embutido (iframe) em outro site.
  let emMoldura = false;
  try { emMoldura = window.top !== window.self; } catch { emMoldura = true; }
  if (emMoldura) {
    clear(root);
    root.appendChild(h('p', { class: 'center mt-l', text: 'Por segurança, o FitCore não abre dentro de outra página. Abra o endereço do aplicativo diretamente no navegador.' }));
    return;
  }
  initInstall();
  await load();
  applyTheme();
  subscribe(applyTheme);
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme); else if (mq.addListener) mq.addListener(applyTheme); // Safari antigo
  }
  onExternalChange((motivo) => { render(true); toast(motivo === 'conflito' ? 'O aplicativo estava aberto em outra janela: carreguei os dados mais recentes.' : 'Dados atualizados a partir de outra janela do aplicativo.'); });
  onSaveError(() => toast('Atenção: não foi possível salvar. Libere espaço no aparelho e faça um backup em Ajustes.'));
  render();
  if (!armazenamentoOk()) toast('Atenção: o armazenamento principal do aparelho não respondeu. Seus dados estão indo para uma cópia de reserva. Faça um backup em Ajustes.');
  // app deixado aberto de um dia para o outro: ao voltar, redesenha (treino de hoje, semana, datas)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && diaDoDesenho !== new Date().toDateString() && !document.querySelector('.backdrop')) render(true); });
  registerSw();
  maybeAutoPrompt();
}
boot().catch(() => {
  clear(root);
  root.appendChild(h('div', { class: 'view' }, h('h1', { text: 'Não foi possível abrir o aplicativo' }), h('p', { class: 'muted', text: 'Feche e abra de novo. Se o problema continuar, atualize o aplicativo.' }), btn('Tentar de novo', () => location.reload(), 'primary block')));
});
