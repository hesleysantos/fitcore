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
// Como o aviso toca (e por quê):
//  • Os sons são sintetizados (sem arquivo). Ao primeiro toque, cada som escolhido é gravado uma vez como um áudio curto
//    (WAV, menos de 5 s) e tocado por um elemento <audio>.
//  • ANDROID (Chrome): um áudio curto, de menos de 5 segundos, pede o foco de áudio "passageiro": a música de outro
//    aplicativo abaixa (duck) enquanto o aviso toca e volta sozinha (Chromium, "Audio Focus Handling"; Android, "Manage
//    audio focus": AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).
//  • iPHONE: o áudio da página fica na sessão "transient" (navigator.audioSession, Safari 16.4+), que toca por cima da
//    música sem interromper; no iPhone ela segue o modo silencioso do aparelho (WebKit, bug 264473). O que baixa a música
//    no iPhone é a fala do sistema (speechSynthesis abaixa o outro áudio enquanto fala: WebKit, bug 278598): por isso o
//    aviso do fim do descanso diz "Descanso terminado" junto do som (Ajustes: "Falar o aviso").
//  • O iPhone pausa o áudio ao bloquear a tela, trocar de app, numa ligação ou com a Siri ("interrupted"): cada toque na
//    tela, e a volta para o app, retomam o áudio; o aviso espera a retomada antes de tocar (no Android, se ela falhar,
//    toca pelo <audio> gravado).
let ctx = null;
const AC = () => (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null);
const OAC = () => (typeof window !== 'undefined' ? window.OfflineAudioContext || window.webkitOfflineAudioContext : null);
export const isIOS = () => typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
function sessaoDeAudioCurta() { try { if (navigator.audioSession && navigator.audioSession.type !== 'transient') navigator.audioSession.type = 'transient'; } catch { /* sem suporte */ } }
let falaLiberada = false;
// Navegadores só liberam áudio depois de um toque: chame isto em qualquer toque do usuário (o app chama em todos).
export function unlockAudio() {
  try {
    sessaoDeAudioCurta();
    if (!ctx) { const C = AC(); if (C) ctx = new C(); }
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); // no iPhone o estado pode ser "interrupted"
  } catch { ctx = null; }
  prepararGravacoes();
  // a fala do iPhone também só sai depois de uma primeira fala dentro de um toque (uma fala vazia e sem volume)
  try {
    if (!falaLiberada && typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined') {
      const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); falaLiberada = true;
    }
  } catch { /* sem fala */ }
}
// todo toque, em qualquer tela, retoma o áudio interrompido; a volta para o app também tenta
if (typeof document !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, () => { if (!ctx || ctx.state !== 'running' || !falaLiberada) unlockAudio(); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });
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
function tom(ac, t0, freq, dur, vol, tipo = 'sine', saida = null) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = tipo; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(saida || ac.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
// Saída do som "Alto": mais alto que a música no momento do bipe, com teto.
// - Volume: os bipes são onda quadrada com pico em cerca de −3 dB do máximo digital. Onda quadrada tem a média igual ao
//   pico, então soam bem acima de uma música normalizada pelos serviços de streaming (cerca de −14 LUFS): perto de 10 dB a
//   mais, só durante o bipe (0,2 s).
// - Frequência: entre 2 e 3 kHz, a faixa em que o ouvido é mais sensível (curvas de mesma sonoridade, ISO 226).
// - Teto: o compressor funciona como limitador em −3 dB e nada passa disso, para não ferir o ouvido com fone.
function saidaForte(ac) {
  const c = ac.createDynamicsCompressor ? ac.createDynamicsCompressor() : null;
  if (!c) return null;
  try { c.threshold.value = -3; c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.1; } catch { /* valores padrão */ }
  c.connect(ac.destination);
  return c;
}
// sino: parciais inarmônicos (como os de um sino de verdade), cada um sumindo no seu tempo
function sino(ac, t0, base, vol) {
  for (const [r, v, d] of [[0.5, 0.35, 3.2], [1, 1, 2.6], [1.19, 0.45, 2], [1.56, 0.4, 1.6], [2, 0.5, 1.3], [2.74, 0.25, 0.9], [3.76, 0.15, 0.6]]) tom(ac, t0, base * r, d, vol * v);
}
// monta o som `id` no contexto `ac`, a partir do instante t; devolve a duração (s)
function montar(ac, id, t) {
  switch (SONS_ALERTA[id] ? id : SOM_PADRAO) {
    case 'sino': sino(ac, t, 880, 0.45); return 3.3;
    case 'alto': { const s = saidaForte(ac); for (let i = 0; i < 4; i++) { tom(ac, t + i * 0.32, i % 2 ? 2637 : 2093, 0.22, 0.45, 'square', s); tom(ac, t + i * 0.32, i % 2 ? 1319 : 1047, 0.22, 0.25, 'square', s); } return 1.4; }
    case 'longo': for (let i = 0; i < 6; i++) { tom(ac, t + i * 0.7, 784, 0.3, 0.5); tom(ac, t + i * 0.7 + 0.32, 1046, 0.32, 0.5); } return 4.4;
    case 'discreto': tom(ac, t, 660, 0.45, 0.18); return 0.6;
    default: tom(ac, t, 784, 0.35, 0.5); tom(ac, t + 0.32, 1175, 0.5, 0.5); return 0.95;
  }
}
// ---- gravação de cada som em WAV (para o <audio>) ----
const DURACAO = { equilibrado: 0.95, sino: 3.3, alto: 1.4, longo: 4.4, discreto: 0.6 }; // segundos (o que montar() devolve)
const gravados = new Map(); // id → URL do WAV
const gravando = new Set();
function wav(buf) {
  const n = buf.length, sr = buf.sampleRate, dados = buf.getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); txt(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, dados[i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Blob([out], { type: 'audio/wav' });
}
function gravar(id) {
  const O = OAC();
  if (!O || gravados.has(id) || gravando.has(id) || id === 'silencioso' || typeof URL === 'undefined' || !URL.createObjectURL) return;
  gravando.add(id);
  try {
    // o tamanho exato de cada som (todos com menos de 5 s: no Android, é o que faz a música só abaixar)
    const sr = 22050, dur = (DURACAO[id] || 1) + 0.15;
    const off = new O(1, Math.round(sr * dur), sr);
    montar(off, id, 0.02);
    const fim = (buf) => { gravando.delete(id); try { if (buf) gravados.set(id, URL.createObjectURL(wav(buf))); } catch { /* sem gravação */ } };
    const p = off.startRendering();
    if (p && typeof p.then === 'function') p.then(fim, () => fim(null)); else off.oncomplete = (e) => fim(e.renderedBuffer);
  } catch { gravando.delete(id); }
}
function prepararGravacoes() { try { gravar(state.settings.somAlerta || SOM_PADRAO); } catch { /* ignore */ } }
// o <audio> do aviso (Android): depois do primeiro toque na página, o navegador deixa tocar sem outro toque
let elemento = null;
function tocarGravado(id) {
  const url = gravados.get(id);
  if (!url || typeof Audio === 'undefined') return false;
  try {
    if (!elemento) { elemento = new Audio(); elemento.preload = 'auto'; }
    elemento.muted = false; elemento.src = url; elemento.currentTime = 0;
    const p = elemento.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch { return false; }
}
function tocarNoContexto(id) {
  if (!ctx) return false;
  try { montar(ctx, id, ctx.currentTime + 0.03); return true; } catch { return false; }
}
// fala curta do aviso (no iPhone, é o que baixa a música)
function falar(frase) {
  try {
    if (!frase || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    const u = new SpeechSynthesisUtterance(frase); u.lang = 'pt-BR'; u.rate = 1.05; u.volume = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* sem fala */ }
}
// `frase`: o que dizer junto do som (só se "Falar o aviso" estiver ligado)
export function tocarAlerta(id = state.settings.somAlerta, frase = '') {
  if (!state.settings.som || id === 'silencioso') return;
  sessaoDeAudioCurta();
  if (frase && state.settings.voz) falar(frase);
  // Android e outros: o áudio gravado (curto) baixa a música; sem ele, o som na hora
  const ios = isIOS();
  if (!ios && tocarGravado(id)) return;
  if (!ctx) { if (!ios) tocarGravado(id); return; }
  if (ctx.state === 'running') { tocarNoContexto(id); return; }
  // áudio interrompido (iPhone): espera retomar, até 1,5 s; se não der, no Android toca o gravado (no iPhone fica a fala)
  let feito = false;
  const fallback = setTimeout(() => { if (!feito) { feito = true; if (!ios) tocarGravado(id); } }, 1500);
  ctx.resume().then(() => { if (!feito && ctx.state === 'running') { feito = true; clearTimeout(fallback); tocarNoContexto(id); } }, () => {});
}
// Ajustes: troca o som → grava o novo
export function prepararSom(id) { gravar(id); }

// ---------- fim do descanso, mesmo fora da tela do treino ----------
// Quem avisa é um relógio do app inteiro (não só a tela do treino): se a pessoa abrir outra tela durante o descanso, o
// aviso toca do mesmo jeito. Voltando ao app depois do fim (o iPhone pausa o app em segundo plano), o aviso ainda toca
// se o descanso acabou há menos de 1 minuto; com mais tempo, só a tela mostra.
export const ATRASO_MAX_AVISO = 60000;
let fimVigiado = 0, avisadoPara = 0, vigiaT = 0;
export function alertaDoDescanso(fim) {
  if (!fim || avisadoPara === fim) return;
  avisadoPara = fim;
  if (Date.now() - fim <= ATRASO_MAX_AVISO) { tocarAlerta(state.settings.somAlerta, 'Descanso terminado'); vibrate(); }
}
function vigiar() {
  if (!fimVigiado) { clearInterval(vigiaT); vigiaT = 0; return; }
  if (Date.now() >= fimVigiado) { const f = fimVigiado; fimVigiado = 0; clearInterval(vigiaT); vigiaT = 0; alertaDoDescanso(f); }
}
export function vigiarDescanso(fim) {
  fimVigiado = Number.isFinite(fim) && fim > 0 ? fim : 0;
  clearInterval(vigiaT); vigiaT = 0;
  if (fimVigiado) vigiaT = setInterval(vigiar, 250);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') vigiar(); });

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
  vigiarDescanso(quando);
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
export function cancelarAviso() { vigiarDescanso(0); clearTimeout(avisoT); avisoT = 0; fimDoAviso = 0; pararContagem(); fecharAvisos(); }
// O descanso chegou ao fim sozinho. Com o app na frente, a tela já avisou: limpa o agendamento. Em segundo plano, deixa
// o agendamento e a notificação em paz (o cronômetro da página e o aviso disparam quase juntos: cancelar aqui apagava
// a notificação logo depois de ela aparecer); ela é fechada quando a pessoa volta para o app.
export function fimDoDescanso() { if (document.visibilityState === 'visible') cancelarAviso(); }
// o aparelho consegue manter a tela ligada?
export const telaLigadaDisponivel = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fecharAvisos(); });
