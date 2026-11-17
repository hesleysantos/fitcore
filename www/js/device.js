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

// ---------- som do alerta (fim do descanso e fim de série por tempo) ----------
// Sintetizado na hora (sem arquivo de áudio). A pessoa escolhe em Ajustes; `id` → [nome, descrição].
export const SONS_ALERTA = {
  equilibrado: ['Equilibrado', 'Dois toques claros, volume médio'],
  sino: ['Sino', 'Badalada de sino, que soa e vai sumindo'],
  alto: ['Alto', 'Bipes agudos, mais altos que a música no momento do bipe, com um teto para proteger o ouvido'],
  longo: ['Longo', 'Toque que se repete por cerca de 4 segundos'],
  discreto: ['Discreto', 'Um toque suave e baixo'],
  silencioso: ['Silencioso', 'Sem som: só a vibração (se estiver ligada) e o aviso na tela'],
};
export const SOM_PADRAO = 'equilibrado';
// um tom com envelope de ataque rápido e queda exponencial; `saida` é para onde ele vai (padrão: alto-falante)
function tom(t0, freq, dur, vol, tipo = 'sine', saida = null) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(saida || ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
// Saída do som "Alto": mais alto que a música no momento do bipe, com teto.
// - Volume: os bipes são onda quadrada com pico em cerca de −3 dB do máximo digital. Onda quadrada tem a média igual ao
//   pico, então soam bem acima de uma música normalizada pelos serviços de streaming (cerca de −14 LUFS): perto de 10 dB a
//   mais, só durante o bipe (0,2 s).
// - Frequência: entre 2 e 3 kHz, a faixa em que o ouvido é mais sensível (curvas de mesma sonoridade, ISO 226).
// - Teto: o compressor funciona como limitador em −3 dB e nada passa disso, para não ferir o ouvido com fone.
// - No iPhone, a sessão de áudio "transient" ainda baixa a música durante o bipe (ver sessaoDeAudioCurta).
function saidaForte() {
  const c = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
  if (!c) return null;
  try { c.threshold.value = -3; c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.1; } catch { /* valores padrão */ }
  c.connect(ctx.destination);
  return c;
}
// No iPhone (Safari 16.4+), "transient" faz o aviso tocar por cima da música, baixando ela um instante, em vez de
// interromper o que estiver tocando.
function sessaoDeAudioCurta() { try { if (navigator.audioSession) navigator.audioSession.type = 'transient'; } catch { /* sem suporte */ } }
// sino: parciais inarmônicos (como os de um sino de verdade), cada um sumindo no seu tempo
function sino(t0, base, vol) {
  for (const [r, v, d] of [[0.5, 0.35, 3.2], [1, 1, 2.6], [1.19, 0.45, 2], [1.56, 0.4, 1.6], [2, 0.5, 1.3], [2.74, 0.25, 0.9], [3.76, 0.15, 0.6]]) tom(t0, base * r, d, vol * v);
}
export function tocarAlerta(id = state.settings.somAlerta) {
  if (!state.settings.som || !ctx || id === 'silencioso') return;
  try {
    sessaoDeAudioCurta();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const t = ctx.currentTime + 0.03;
    switch (SONS_ALERTA[id] ? id : SOM_PADRAO) {
      case 'sino': sino(t, 880, 0.45); break;
      case 'alto': { const s = saidaForte(); for (let i = 0; i < 4; i++) { tom(t + i * 0.32, i % 2 ? 2637 : 2093, 0.22, 0.45, 'square', s); tom(t + i * 0.32, i % 2 ? 1319 : 1047, 0.22, 0.25, 'square', s); } break; }
      case 'longo': for (let i = 0; i < 6; i++) { tom(t + i * 0.7, 784, 0.3, 0.5); tom(t + i * 0.7 + 0.32, 1046, 0.32, 0.5); } break;
      case 'discreto': tom(t, 660, 0.45, 0.18); break;
      default: tom(t, 784, 0.35, 0.5); tom(t + 0.32, 1175, 0.5, 0.5);
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
// Contagem do descanso na central de notificações: quando a pessoa sai do app com o descanso rodando, aparece uma
// notificação com o tempo que falta e a hora em que termina, atualizada a cada 5 s em silêncio (mesma etiqueta, sem som),
// até o fim, quando ela vira "Descanso terminado". Se o sistema pausar a página (iPhone), a contagem para no último valor,
// mas a hora de término continua certa.
let fimDoAviso = 0;
let contagemT = 0;
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const horaDe = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
async function mostrarContagem() {
  if (document.visibilityState === 'visible' || !fimDoAviso || fimDoAviso - Date.now() < 1000 || !state.settings.avisoFundo || !avisoPermitido()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(`Descanso: faltam ${mmss(fimDoAviso - Date.now())}`, { body: `Termina às ${horaDe(fimDoAviso)}. Toque para voltar ao treino.`, tag: TAG_AVISO, renotify: false, silent: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
  } catch { /* sem permissão ou sem suporte */ }
}
function pararContagem() { clearInterval(contagemT); contagemT = 0; }
function iniciarContagem() {
  pararContagem();
  if (!fimDoAviso || fimDoAviso <= Date.now()) return;
  mostrarContagem();
  contagemT = setInterval(() => { if (!fimDoAviso || fimDoAviso - Date.now() < 1000 || document.visibilityState === 'visible') { pararContagem(); return; } mostrarContagem(); }, 5000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') iniciarContagem(); else pararContagem(); });
export function agendarAviso(quando) {
  clearTimeout(avisoT); avisoT = 0;
  fimDoAviso = 0; pararContagem();
  if (!state.settings.avisoFundo || !avisoPermitido() || !Number.isFinite(quando) || quando <= Date.now()) return;
  fimDoAviso = quando;
  if (document.visibilityState === 'hidden') iniciarContagem();
  avisoT = setTimeout(async () => {
    avisoT = 0;
    fimDoAviso = 0; pararContagem();
    if (document.visibilityState === 'visible') return; // com o app na frente, a tela já avisa
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.showNotification('Descanso terminado', { body: 'Hora da próxima série.', tag: TAG_AVISO, renotify: true, silent: !state.settings.som, vibrate: state.settings.vibrar ? [220, 120, 220] : undefined, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } catch { /* sem permissão ou sem suporte: segue só com o aviso da tela */ }
  }, Math.min(quando - Date.now(), 3600000));
}
export function cancelarAviso() { clearTimeout(avisoT); avisoT = 0; fimDoAviso = 0; pararContagem(); fecharAvisos(); }
// O descanso chegou ao fim sozinho. Com o app na frente, a tela já avisou: limpa o agendamento. Em segundo plano, deixa
// o agendamento e a notificação em paz (o cronômetro da página e o aviso disparam quase juntos: cancelar aqui apagava
// a notificação logo depois de ela aparecer); ela é fechada quando a pessoa volta para o app.
export function fimDoDescanso() { if (document.visibilityState === 'visible') cancelarAviso(); }
// o aparelho consegue manter a tela ligada?
export const telaLigadaDisponivel = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fecharAvisos(); });
