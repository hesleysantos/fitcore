// Sugestão de instalação: no Android/Chrome usa o aviso nativo; no iPhone mostra o passo a passo
// (Compartilhar → Adicionar à Tela de Início), porque o iOS não permite instalar por botão.
import { h, btn, icon, sheet, toast } from './ui.js';
import { state, update } from './store.js';
import { refresh } from './router.js';

let deferred = null;
let installedNow = false;

export const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
export const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIosSafari = () => isIos() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { deferred = null; installedNow = true; toast('Aplicativo instalado!'); });
}

export function canSuggestInstall() {
  if (isNative() || isStandalone() || installedNow) return false;
  return true;
}
function dismissedRecently() {
  const d = state.ui.installDismissedAt;
  return d && Date.now() - Date.parse(d) < 14 * 86400000;
}

function iosSteps() {
  const share = h('span', { class: 'row gap-s' }, 'Toque em ', icon('share', 's'), h('b', { text: 'Compartilhar' }));
  const steps = h('div', { class: 'ios-steps' },
    h('div', { class: 'st' }, h('span', { class: 'n', text: '1' }), h('div', null, share, h('div', { class: 'tiny muted', text: 'Fica na barra do navegador, embaixo ou em cima da tela.' }))),
    h('div', { class: 'st' }, h('span', { class: 'n', text: '2' }), h('div', null, 'Role a lista e toque em ', h('b', { text: 'Adicionar à Tela de Início' }))),
    h('div', { class: 'st' }, h('span', { class: 'n', text: '3' }), h('div', null, 'Toque em ', h('b', { text: 'Adicionar' }), '. O ícone do FitCore aparece junto dos seus aplicativos.')));
  const out = [steps];
  if (!isIosSafari()) out.unshift(h('div', { class: 'note info' }, icon('info'), h('div', { text: 'Se não encontrar a opção neste navegador, abra este endereço no Safari e repita os passos.' })));
  return out;
}

export function openInstall() {
  const dismiss = () => update((s) => { s.ui.installDismissedAt = new Date().toISOString(); });
  const why = h('p', { class: 'muted small', text: 'Instalado, o FitCore abre em tela cheia e funciona sem internet.' });
  if (isIos()) {
    const s = sheet({
      title: 'Instalar o FitCore no iPhone',
      body: [why, ...iosSteps(), h('div', { class: 'note warn' }, icon('warn'), h('div', { text: 'Instale antes de registrar treinos: no iPhone, os dados do navegador e os do aplicativo instalado ficam separados.' }))],
      footer: [btn('Agora não', () => { dismiss(); s.close(); }, 'ghost'), btn('Entendi', () => s.close(), 'primary')],
    });
    return;
  }
  if (deferred) {
    const s = sheet({
      title: 'Instalar o FitCore',
      body: [why],
      footer: [
        btn('Agora não', () => { dismiss(); s.close(); }, 'ghost'),
        btn('Instalar', async () => {
          const ev = deferred;
          deferred = null;
          s.close();
          try { ev.prompt(); const r = await ev.userChoice; if (r && r.outcome !== 'accepted') dismiss(); } catch { /* ignore */ }
        }, 'primary', 'download'),
      ],
    });
    return;
  }
  const s = sheet({
    title: 'Instalar o FitCore',
    body: [why, h('div', { class: 'ios-steps' },
      h('div', { class: 'st' }, h('span', { class: 'n', text: '1' }), h('div', null, 'Abra o menu do navegador ', h('b', { text: '(⋮)' }))),
      h('div', { class: 'st' }, h('span', { class: 'n', text: '2' }), h('div', null, 'Toque em ', h('b', { text: isAndroid() ? 'Adicionar à tela inicial' : 'Instalar aplicativo' }))))],
    footer: [btn('Agora não', () => { dismiss(); s.close(); }, 'ghost'), btn('Entendi', () => s.close(), 'primary')],
  });
}

// Cartão para a tela inicial (some depois de instalado ou dispensado).
export function installCard() {
  if (!canSuggestInstall() || dismissedRecently()) return null;
  return h('div', { class: 'card hl' },
    h('div', { class: 'install' },
      h('img', { class: 'appic', src: 'icons/icon-192.png', alt: '', width: 48, height: 48 }),
      h('div', { class: 'grow' },
        h('h3', { text: 'Instale o FitCore no seu celular' }),
        h('p', { class: 'small muted', text: 'Abre como aplicativo, em tela cheia, e funciona sem internet.' }))),
    h('div', { class: 'row mt' },
      btn('Agora não', () => { update((s) => { s.ui.installDismissedAt = new Date().toISOString(); }); refresh(); }, 'ghost sm'),
      h('div', { class: 'grow' }),
      btn(isIos() ? 'Ver como instalar' : 'Instalar', openInstall, 'primary sm', 'download')));
}

// Na primeira abertura pelo navegador, já sugere a instalação.
export function maybeAutoPrompt() {
  if (!canSuggestInstall() || dismissedRecently() || state.ui.onboarded) return;
  setTimeout(() => { if (canSuggestInstall() && !document.querySelector('.backdrop')) openInstall(); }, isIos() ? 900 : 2200);
}
