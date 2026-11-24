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

// ---------- vibração (não existe no iPhone; lá o aviso é som + tela) ----------
export function vibrate(pattern = [220, 120, 220]) {
  if (!state.settings.vibrar) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}

// ---------- o app em segundo plano (outro aplicativo aberto ou tela bloqueada) ----------
// O que cada sistema deixa uma página instalada (PWA) fazer, sem servidor (pesquisa de 2025-2026, código e documentos dos
// navegadores):
//  • ANDROID (Chrome 139 em diante): a página em segundo plano CONGELA depois de 1 minuto em silêncio (antes eram 5):
//    relógios, avisos e o som param. A página que está tocando som não congela, e "tocando" é o medidor de nível do Chrome
//    (acima de −72 dBFS), não o ouvido. O som pela Web Audio não pede o foco de áudio do Android: toca junto da música
//    (Spotify etc.) sem pausar nem abaixar. Por isso, enquanto um descanso (ou o cronômetro da corrida) corre, o app toca
//    pela Web Audio um tom grave e baixíssimo (30 Hz a −60 dBFS: inaudível no alto-falante do celular e no fone), e a
//    página continua viva: o som e a notificação do fim saem na hora certa. Fontes: blink-dev "Faster background freezing
//    on Android" (2025); Chromium page_scheduler_impl (kRecentAudioDelay), services/audio/output_stream.cc
//    (kSilenceThresholdDBFS), content/browser/media/session/media_session_impl.cc (Web Audio fora do foco de áudio).
//  • iPHONE: a página pausa logo que sai da tela, e o som da Web Audio para junto (categoria "Ambient" do iOS). Só um
//    <audio> que JÁ está tocando, na categoria "Playback", continua em segundo plano, e essa categoria pausa a música de
//    outros aplicativos (WebKit: bugs 198277, 264473; DOMAudioSession.cpp e AudioSessionIOS.mm). Não existe tipo de sessão
//    de áudio que toque em segundo plano E misture com a música. Por isso, no iPhone, o aviso com a tela bloqueada é uma
//    escolha: "Tocar o descanso como faixa" (abaixo), que pausa a música durante o descanso.
//  • Notificação marcada para mais tarde, sem servidor, não existe em nenhum dos dois (Notification Triggers foi
//    abandonado pelo Chrome; o Safari só tem push com servidor). A notificação do fim sai da página viva (Android) ou da
//    faixa (iPhone com a opção ligada).
//  • Notificação estável: uma só, com a hora do fim, mostrada quando a pessoa sai do app (nada de repostar a cada 5 s, que
//    para quando a página congela e recria a notificação que a pessoa dispensou). No fim, a mesma etiqueta vira
//    "Descanso terminado". As duas saem da central só quando a pessoa volta ao app.

// --- manter a página viva (Android) ---
const segurando = new Set(); // motivos: 'descanso', 'serie', 'corrida'
let tomFundo = null;
function ligarTomFundo() {
  if (tomFundo || isIOS() || !ctx) return; // no iPhone não adianta: o som da página para em segundo plano
  try {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 30; // grave demais para o alto-falante do celular
    g.gain.value = 0.001; // −60 dBFS: acima do limite de "som tocando" do Chrome (−72 dBFS), sem som que se ouça
    o.connect(g); g.connect(ctx.destination); o.start();
    tomFundo = { o, g };
  } catch { tomFundo = null; }
}
function desligarTomFundo() {
  if (!tomFundo) return;
  try { tomFundo.o.stop(); tomFundo.o.disconnect(); tomFundo.g.disconnect(); } catch { /* já parado */ }
  tomFundo = null;
}
// Liga ou desliga um motivo para manter o app vivo em segundo plano (descanso, série por tempo, cronômetro da corrida).
export function manterNoFundo(motivo, ligado) {
  if (ligado) segurando.add(motivo); else segurando.delete(motivo);
  if (segurando.size) ligarTomFundo(); else desligarTomFundo();
}
// o som pode ter sido liberado depois de o motivo começar (primeiro toque): tenta de novo
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => { if (segurando.size && !tomFundo) ligarTomFundo(); }, { capture: true, passive: true });

// --- o descanso como uma faixa de áudio (opção, para a tela bloqueada) ---
// Uma faixa do tamanho do descanso: silêncio e, no fim, o som do alerta. Começa no toque que inicia o descanso (o navegador
// só deixa tocar depois de um toque) e segue tocando em segundo plano, porque é mídia de verdade. No iPhone, a sessão
// de áudio vai para "playback" enquanto ela toca (a única que continua em segundo plano) e volta depois. Pausa a música
// de outros aplicativos durante o descanso: no Android, mídia com mais de 5 s pede o foco de áudio inteiro (Chromium,
// media_content_type.cc); no iPhone, "playback" não mistura. A tela de bloqueio mostra "Descanso" (Media Session).
export const faixaDisponivel = () => typeof Audio !== 'undefined' && typeof URL !== 'undefined' && !!URL.createObjectURL && !!OAC();
let faixa = null, faixaUrl = '', faixaFim = 0;
const FAIXA_HZ = 16000;
function pararFaixa() {
  if (faixa) { try { faixa.pause(); faixa.removeAttribute('src'); faixa.load(); } catch { /* ignore */ } }
  if (faixaUrl) { try { URL.revokeObjectURL(faixaUrl); } catch { /* ignore */ } faixaUrl = ''; }
  faixaFim = 0;
  try { if (navigator.audioSession) navigator.audioSession.type = 'transient'; } catch { /* sem suporte */ }
  try { if (navigator.mediaSession) navigator.mediaSession.metadata = null; } catch { /* ignore */ }
}
const faixaTocando = () => !!faixaFim && !!faixa && !faixa.paused;
async function tocarFaixa(fim) {
  pararFaixa();
  const id = state.settings.somAlerta || SOM_PADRAO;
  const seg = (fim - Date.now()) / 1000;
  if (!state.settings.somFaixa || !state.settings.som || id === 'silencioso' || !faixaDisponivel() || seg < 3 || seg > 900) return;
  try {
    // o som do alerta, gravado na taxa da faixa
    const dur = (DURACAO[id] || 1) + 0.15;
    const off = new (OAC())(1, Math.round(FAIXA_HZ * dur), FAIXA_HZ);
    montar(off, id, 0.02);
    const buf = await off.startRendering();
    const som = buf.getChannelData(0);
    const n0 = Math.max(0, Math.round((fim - Date.now()) / 1000 * FAIXA_HZ));
    const n = n0 + som.length;
    const out = new DataView(new ArrayBuffer(44 + n * 2));
    const txt = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, FAIXA_HZ, true); out.setUint32(28, FAIXA_HZ * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); txt(36, 'data'); out.setUint32(40, n * 2, true);
    for (let i = 0; i < som.length; i++) { const v = Math.max(-1, Math.min(1, som[i])); out.setInt16(44 + (n0 + i) * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    if (!faixa) { faixa = new Audio(); faixa.preload = 'auto'; faixa.addEventListener('ended', () => pararFaixa()); }
    faixaUrl = URL.createObjectURL(new Blob([out], { type: 'audio/wav' }));
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* sem suporte */ }
    try { if (navigator.mediaSession && typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: 'Descanso', artist: `Termina às ${horaDe(fim)}`, album: 'FitCore', artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] }); } catch { /* ignore */ }
    faixa.src = faixaUrl; // a cada vez um endereço novo (no iPhone com iOS 26, reaproveitar o mesmo deixa o áudio mudo: WebKit, bug 295518)
    faixaFim = fim;
    const p = faixa.play();
    if (p && typeof p.catch === 'function') p.catch(() => pararFaixa());
  } catch { pararFaixa(); }
}

// --- notificações ---
const TAG_AVISO = 'fitcore-descanso';
export const avisoDisponivel = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export const avisoPermitido = () => { try { return avisoDisponivel() && Notification.permission === 'granted'; } catch { return false; } };
export async function pedirPermissaoDeAviso() {
  if (!avisoDisponivel()) return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}
const horaDe = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
async function notificar(titulo, opcoes) {
  if (!state.settings.avisoFundo || !avisoPermitido()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(titulo, { tag: TAG_AVISO, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', ...opcoes });
  } catch { /* sem permissão ou sem suporte: segue só com o aviso da tela */ }
}
async function fecharAvisos() {
  try {
    if (!avisoDisponivel()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) for (const n of await reg.getNotifications({ tag: TAG_AVISO })) n.close();
  } catch { /* ignore */ }
}

// --- o relógio do descanso (vale em qualquer tela do app) ---
// Avisa no fim do descanso mesmo com outra tela aberta. Voltando ao app depois do fim, o aviso ainda toca se o descanso
// acabou há menos de 1 minuto; com mais tempo, só a tela mostra.
export const ATRASO_MAX_AVISO = 60000;
let fimVigiado = 0, avisadoPara = 0, vigiaT = 0;
export function alertaDoDescanso(fim) {
  if (!fim || avisadoPara === fim) return;
  avisadoPara = fim;
  if (Date.now() - fim > ATRASO_MAX_AVISO) return;
  // a faixa já toca o som no fim (e, em segundo plano, é ela que toca): não repete
  if (!(faixaFim === fim && faixaTocando())) tocarAlerta(state.settings.somAlerta, 'Descanso terminado');
  vibrate();
  if (document.visibilityState !== 'visible') notificar('Descanso terminado', { body: 'Hora da próxima série.', renotify: true, silent: !state.settings.som, vibrate: state.settings.vibrar ? [220, 120, 220] : undefined, requireInteraction: true });
}
function vigiar() {
  if (!fimVigiado) { clearInterval(vigiaT); vigiaT = 0; return; }
  if (Date.now() >= fimVigiado) {
    const f = fimVigiado; fimVigiado = 0; clearInterval(vigiaT); vigiaT = 0;
    alertaDoDescanso(f);
    manterNoFundo('descanso', false);
  }
}
// O descanso que termina em `quando` (ms): vigia o fim, mantém o app vivo no Android e, com a opção, toca a faixa.
export function agendarAviso(quando) {
  fimVigiado = Number.isFinite(quando) && quando > Date.now() ? quando : 0;
  clearInterval(vigiaT); vigiaT = 0;
  manterNoFundo('descanso', !!fimVigiado);
  if (!fimVigiado) { pararFaixa(); return; }
  vigiaT = setInterval(vigiar, 250);
  if (faixaFim !== fimVigiado) tocarFaixa(fimVigiado);
  if (document.visibilityState === 'hidden') mostrarContagem();
}
// a notificação do descanso em andamento: uma só, com a hora do fim, quando a pessoa sai do app
function mostrarContagem() {
  if (!fimVigiado || fimVigiado - Date.now() < 3000) return;
  notificar('Descanso em andamento', { body: `Termina às ${horaDe(fimVigiado)}. Toque para voltar ao treino.`, silent: true, renotify: false });
}
export function cancelarAviso() {
  fimVigiado = 0; clearInterval(vigiaT); vigiaT = 0;
  manterNoFundo('descanso', false);
  // a faixa que já chegou ao som do fim toca até o fim (ela se limpa sozinha)
  if (!(faixaFim && Date.now() >= faixaFim - 500 && faixaTocando())) pararFaixa();
  fecharAvisos();
}
// O descanso chegou ao fim sozinho (a tela do treino viu). Com o app na frente, limpa tudo; em segundo plano, deixa a
// notificação do fim em paz (ela é fechada quando a pessoa volta).
export function fimDoDescanso() { if (document.visibilityState === 'visible') cancelarAviso(); }
// o aparelho consegue manter a tela ligada?
export const telaLigadaDisponivel = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') mostrarContagem();
    else { vigiar(); fecharAvisos(); }
  });
}
