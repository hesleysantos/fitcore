// Catálogo completo de exercícios (junta os arquivos por grupo muscular).
import peito from './ex/peito.js';
import costas from './ex/costas.js';
import ombros from './ex/ombros.js';
import biceps from './ex/biceps.js';
import triceps from './ex/triceps.js';
import antebraco from './ex/antebraco.js';
import abdomen from './ex/abdomen.js';
import quadriceps from './ex/quadriceps.js';
import posteriores from './ex/posteriores.js';
import gluteos from './ex/gluteos.js';
import panturrilhas from './ex/panturrilhas.js';
import adutores from './ex/adutores.js';
import cardio from './ex/cardio.js';
import funcional from './ex/funcional.js';
import casa from './ex/casa.js';
import mais from './ex/mais.js';

export const EXERCICIOS = [...peito, ...costas, ...ombros, ...biceps, ...triceps, ...antebraco, ...abdomen, ...quadriceps, ...posteriores, ...gluteos, ...panturrilhas, ...adutores, ...cardio, ...funcional, ...casa, ...mais];
export const EX_POR_ID = new Map(EXERCICIOS.map((e) => [e.id, e]));
export const exercicio = (id) => EX_POR_ID.get(id);
