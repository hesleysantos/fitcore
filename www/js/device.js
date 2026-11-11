// Recursos do aparelho usados durante o treino: manter a tela ligada, bipe e vibração.
import { state } from './store.js';

const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function plugin(method, args) {
  try {
    if (native() && window.Capacitor.nativePromise) return window.Capacitor.nativePromise('Aparelho', method, args || {}).catch(() => null);
  } catch { /* ignore */ }
  return Promise.resolve(null);
}

// ---------- tela ligada ----------
let lock = null;
let wanted = false;
async function acquire() {
  if (!wanted || document.visibilityState !== 'visible') return;
  if (native()) { plugin('telaLigada', { ligada: true }); return; }
  try {
    if ('wakeLock' in navigator && !lock) {
      const novo = await navigator.wakeLock.request('screen');
      lock = novo;
      novo.addEventListener('release', () => { if (lock === novo) lock = null; });
    }
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (wanted) acquire(); });
export function keepAwake(on) {
  wanted = on && state.settings.telaLigada;
  if (wanted) acquire();
  else {
    if (native()) plugin('telaLigada', { ligada: false });
    if (lock) { lock.release().catch(() => {}); lock = null; }
  }
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
    if (native()) { plugin('vibrar', { ms: 400 }); return; }
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}
// ---------- aviso do fim do descanso com o app em segundo plano ----------
// No aplicativo Android, o próprio sistema dispara a vibração e o bipe no horário certo, mesmo com outro aplicativo
// na frente ou com a tela apagada (nesses casos o cronômetro da página fica suspenso). Com o FitCore na frente, quem
// avisa é a própria tela, e o Android não repete. No navegador não há como agendar: o aviso depende da página aberta.
export function agendarAviso(quando) {
  if (!native() || !Number.isFinite(quando) || quando <= Date.now()) return;
  if (!state.settings.som && !state.settings.vibrar) return;
  plugin('agendarAviso', { em: Math.round(quando), som: !!state.settings.som, vibrar: !!state.settings.vibrar });
}
export function cancelarAviso() { if (native()) plugin('cancelarAviso'); }

export const isNativeApp = native;
export const nativeCall = (pluginName, method, args) => {
  try { if (native() && window.Capacitor.nativePromise) return window.Capacitor.nativePromise(pluginName, method, args || {}); } catch { /* ignore */ }
  return Promise.reject(new Error('indisponível'));
};
