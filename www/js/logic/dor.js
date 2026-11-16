// Dores que a pessoa conta ao Treinador (musculação e corrida usam o mesmo registro: state.dores).
// Este arquivo só define o formato, valida o que entra e diz quais dores estão ativas. O que cada treinador FAZ com a
// dor (trocar exercício, reduzir carga ou volume, pausar corrida) fica nas regras de cada um, com as referências.
// Puro: sem DOM e sem importar o estado.

// Locais do corpo (id → nome). A ordem é a da tela.
export const LOCAIS_DOR = {
  pescoco: 'Pescoço', ombro: 'Ombro', cotovelo: 'Cotovelo', punho: 'Punho ou mão', 'coluna-alta': 'Costas (parte de cima)',
  lombar: 'Lombar', quadril: 'Quadril', virilha: 'Virilha', 'coxa-frente': 'Coxa (frente)', 'coxa-tras': 'Coxa (atrás)',
  joelho: 'Joelho', canela: 'Canela', panturrilha: 'Panturrilha', aquiles: 'Tendão de Aquiles', tornozelo: 'Tornozelo', pe: 'Pé',
  peito: 'Peito', abdomen: 'Abdômen', braco: 'Braço', gluteo: 'Glúteo',
};
// Tipo da dor, na linguagem de quem sente.
export const TIPOS_DOR = {
  muscular: ['Dor muscular depois do treino', 'Músculo dolorido ao toque ou ao mexer, um ou dois dias depois; melhora ao aquecer'],
  articular: ['Dor na articulação ou no tendão', 'Dor em um ponto, que aparece ou piora com o movimento'],
  aguda: ['Dor forte ou repentina', 'Fisgada, estalo, inchaço, perda de força ou dor que não deixa apoiar'],
};
// Quando ela aparece.
export const QUANDO_DOR = { durante: 'Durante o treino', depois: 'Depois do treino', repouso: 'Mesmo em repouso' };

const tem = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// dia do calendário que existe de verdade (31 de fevereiro não passa)
const dia = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const t = new Date(v + 'T12:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v ? v : '';
};
export const MAX_DORES = 300;
export const DIAS_ATIVA = 21; // sem atualização por esse tempo, a dor deixa de contar

// Registro validado ou null. Formato:
// { id, data: 'AAAA-MM-DD', onde: id de LOCAIS_DOR, lado: '' | 'e' | 'd' | 'dois', tipo, quando, nivel: 1–10, nota, fim: '' | 'AAAA-MM-DD' }
export function limparDor(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = dia(raw.data);
  if (!data || !tem(LOCAIS_DOR, raw.onde) || !tem(TIPOS_DOR, raw.tipo)) return null;
  const n = typeof raw.nivel === 'number' && Number.isFinite(raw.nivel) ? Math.round(raw.nivel) : 0;
  if (n < 1 || n > 10) return null;
  const id = typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : '';
  if (!id) return null;
  const fim = dia(raw.fim);
  return {
    id, data, onde: raw.onde, lado: ['e', 'd', 'dois'].includes(raw.lado) ? raw.lado : '',
    tipo: raw.tipo, quando: tem(QUANDO_DOR, raw.quando) ? raw.quando : 'durante', nivel: n,
    nota: typeof raw.nota === 'string' ? raw.nota.slice(0, 200) : '', fim: fim && fim >= data ? fim : '',
  };
}
export function limparDores(raw) {
  const out = [];
  const vistos = new Set();
  if (!Array.isArray(raw)) return out;
  for (const x of raw) {
    const d = limparDor(x);
    if (!d || vistos.has(d.id)) continue;
    vistos.add(d.id); out.push(d);
    if (out.length >= MAX_DORES) break;
  }
  return out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000);
// Dores ativas hoje: o relato mais recente de cada local, sem "melhorou" e feito há até DIAS_ATIVA dias.
// `hoje` = 'AAAA-MM-DD'. Devolve da mais forte para a mais fraca, com `dias` = há quantos dias foi contada.
export function doresAtivas(st, hoje) {
  const lista = st && Array.isArray(st.dores) ? st.dores : [];
  if (!dia(hoje)) return [];
  const porLocal = new Map();
  for (const d of lista) {
    if (!d || !tem(LOCAIS_DOR, d.onde) || !dia(d.data) || d.data > hoje) continue;
    const chave = d.onde + '|' + (d.lado || ''); // joelho direito e esquerdo contam separados
    const ant = porLocal.get(chave);
    if (!ant || d.data >= ant.data) porLocal.set(chave, d);
  }
  const out = [];
  for (const d of porLocal.values()) {
    const dias = diasEntre(d.data, hoje);
    if (d.fim || dias > DIAS_ATIVA) continue;
    out.push({ ...d, dias });
  }
  return out.sort((a, b) => b.nivel - a.nivel || a.dias - b.dias);
}
// Sinal de alerta: pede avaliação de um profissional antes de treinar a região.
// O corte em 7 vem da classificação da escala numérica de dor feita em dor de câncer: 1 a 4 leve, 5 a 6 moderada, 7 a 10
// intensa (Serlin 1995, lida na tabela reproduzida em Boonstra 2016 — ref boonstra2016, texto completo). Em dor
// musculoesquelética crônica, Boonstra estimou "intensa" a partir de 8; o aplicativo fica com 7, o corte mais cauteloso.
export const dorDeAlerta = (d) => !!d && (d.tipo === 'aguda' || d.nivel >= 7 || d.quando === 'repouso');
