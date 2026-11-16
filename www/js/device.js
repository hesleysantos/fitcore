// Recursos do aparelho usados durante o treino: manter a tela ligada, bipe e vibração.
import { state } from './store.js';

// ---------- tela ligada ----------
let lock = null;
let wanted = false;
let pedindo = false;
async function acquire() {
  if (!wanted || document.visibilityState !== 'visible') return;
  try {
    if ('wakeLock' in navigator && !lock && !pedindo) {
      pedindo = true;
      let novo;
      try { novo = await navigator.wakeLock.request('screen'); } finally { pedindo = false; }
      // a pessoa saiu da tela enquanto o pedido estava em andamento: solta na hora
      if (!wanted) { novo.release().catch(() => {}); return; }
      lock = novo;
      novo.addEventListener('release', () => { if (lock === novo) lock = null; });
    }
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (wanted) acquire(); });
export function keepAwake(on) {
  wanted = on && state.settings.telaLigada;
  if (wanted) acquire();
  else if (lock) { lock.release().catch(() => {}); lock = null; }
}

// ---------- som ----------
let ctx = null;
// Navegadores só liberam áudio depois de um toque: chame isto em qualquer toque do usuário.
export function unlockAudio() {
  try {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); // no iPhone o estado pode ser "interrupted"
  } catch { ctx = null; }
}
export function beep(times = 2) {
  if (!state.settings.som || !ctx) return;
  try {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.28);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.28 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.2);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + i * 0.28);
      o.stop(t0 + i * 0.28 + 0.22);
    }
  } catch { /* sem áudio */ }
}

// ---------- vibração (não existe no iPhone; lá o aviso é som + tela) ----------
export function vibrate(pattern = [220, 120, 220]) {
  if (!state.settings.vibrar) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}
// ---------- aviso do fim do descanso com o app em segundo plano ----------
// O aplicativo é uma página instalada (PWA): com ele na frente, quem avisa é a própria tela (bipe e vibração). Se a
// pessoa trocar de aplicativo durante o descanso, o aviso sai como notificação do navegador, quando ela ligou a opção em
// Ajustes e deu a permissão. É o melhor possível sem servidor: no Android costuma funcionar; no iPhone o sistema pausa
// a página em segundo plano e o aviso pode só aparecer ao voltar (por isso a tela fica ligada durante o treino).
const TAG_AVISO = 'fitcore-descanso';
let avisoT = 0;
export const avisoDisponivel = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export const avisoPermitido = () => { try { return avisoDisponivel() && Notification.permission === 'granted'; } catch { return false; } };
export async function pedirPermissaoDeAviso() {
  if (!avisoDisponivel()) return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}
async function fecharAvisos() {
  try {
    if (!avisoDisponivel()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) for (const n of await reg.getNotifications({ tag: TAG_AVISO })) n.close();
  } catch { /* ignore */ }
}
export function agendarAviso(quando) {
  clearTimeout(avisoT); avisoT = 0;
  if (!state.settings.avisoFundo || !avisoPermitido() || !Number.isFinite(quando) || quando <= Date.now()) return;
  avisoT = setTimeout(async () => {
    avisoT = 0;
    if (document.visibilityState === 'visible') return; // com o app na frente, a tela já avisa
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.showNotification('Descanso terminado', { body: 'Hora da próxima série.', tag: TAG_AVISO, renotify: true, silent: !state.settings.som, vibrate: state.settings.vibrar ? [220, 120, 220] : undefined, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } catch { /* sem permissão ou sem suporte: segue só com o aviso da tela */ }
  }, Math.min(quando - Date.now(), 3600000));
}
export function cancelarAviso() { clearTimeout(avisoT); avisoT = 0; fecharAvisos(); }
// O descanso chegou ao fim sozinho. Com o app na frente, a tela já avisou: limpa o agendamento. Em segundo plano, deixa
// o agendamento e a notificação em paz (o cronômetro da página e o aviso disparam quase juntos: cancelar aqui apagava
// a notificação logo depois de ela aparecer); ela é fechada quando a pessoa volta para o app.
export function fimDoDescanso() { if (document.visibilityState === 'visible') cancelarAviso(); }
// o aparelho consegue manter a tela ligada?
export const telaLigadaDisponivel = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fecharAvisos(); });
