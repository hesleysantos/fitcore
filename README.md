# FitCore — Treino e Nutrição

Aplicativo de academia que funciona **100% offline**:

- **286 exercícios** e 86 aparelhos (inclusive 32 exercícios para fazer em casa sem aparelhos) com figura humana animada (com o aparelho), que toca sozinha como um vídeo, e os músculos trabalhados em destaque. As mãos mudam conforme o exercício: espalmadas no apoio, com os dedos fechados em volta da barra ou do halter, ou soltas;
- técnica de cada exercício conferida em fontes abertas (ACE, NASM, NSCA, artigos científicos), listadas na tela do exercício;
- busca e filtros por grupo muscular, equipamento, nível e aparelhos da sua academia;
- **treinos por dia da semana** totalmente personalizáveis, com 9 modelos prontos. Cada dia mostra, em seções separadas, a musculação e a corrida;
- registro do treino com um toque por série, cronômetro de descanso, sugestão de carga e histórico;
- **Evolução**: análise automática dos treinos registrados, com dicas curtas (constância, séries por músculo, equilíbrio, exercícios travados, recuperação, ritmo do peso, volta depois de um tempo parado), cada uma com a fonte;
- **Treinador virtual**: entrevista (objetivo, idade, experiência, tempo sem treinar, limitações, aparelhos, o que tem em casa) → plano de treino, com sugestão periódica de troca de exercícios que você aceita ou não. Dá para priorizar até 2 músculos, e “Outra versão” sempre troca exercícios de verdade (ou avisa que não há outra);
- **dores**: conte uma dor ao Treinador (local, tipo, intensidade) e o treino se ajusta — troca, alivia ou tira os exercícios que carregam a região, na musculação e na corrida; dor de alerta pede avaliação e a região não é treinada. O aviso aparece também no treino em andamento;
- **Treinador de corrida**: do iniciante (corrida e caminhada) ao avançado, por tempo, ritmo ou esforço, com ou sem relógio; plano por objetivo ou prova, acompanhamento pelos registros, volta de pausa, cronômetro guiado e ajuste por dor. Só marca uma prova quando o prazo comporta a distância;
- **Nutricionista virtual**: entrevista → metas de calorias, proteína e água, o que comer antes e depois de cada treino e cardápio de exemplo. 269 alimentos com faixa de preço pesquisada, opção de alimentos mais baratos, cardápio com o que você tem em casa e alimentação ajustada à corrida e à prova;
- **meta de sono**: faixa de horas pela idade (consensos da National Sleep Foundation e da Academia Americana de Medicina do Sono), ajustada à semana de treino e à prova; hora de deitar, registro das noites, semana em barras e dicas com fonte;
- **objetivos alinhados**: o objetivo do treino e o da alimentação andam juntos (ganhar massa com ganhar massa, emagrecer com emagrecer). Ao mudar um, o app pergunta se iguala o outro; você pode manter diferentes;
- **volta depois de uma pausa**: depois de 2 semanas ou mais parado, o treino segue o consenso CSCCa/NSCA de 2019 por 2 semanas (4 no cardio depois de 3 meses parado): menos séries por músculo, descanso mais longo e cardio com metade do tempo na primeira semana. A carga do primeiro treino vem de 10% a 50% menor (escolha conservadora do app) e sobe a cada treino. O tempo parado também entra no plano do Treinador e nas dicas;
- **corrida e musculação juntas**: o app pergunta o que vem primeiro (corrida, musculação ou os dois por igual) e reorganiza a semana — pernas longe do treino forte e do longão, sempre com dia de descanso — e oferece **fortalecimento para corrida**, na academia ou em casa, para quem malha e para quem não malha;
- **análise do treino de corrida feito**: compara o que foi feito com o que o plano mostrou (tempo, distância, ritmo e esforço), diz o que isso acrescentou ou tirou e ajusta os treinos seguintes quando o desvio se repete. A aba Treinos anda pelas semanas (passadas e futuras) e avisa quando não é a semana atual;
- **avaliação do treino montado à mão**: foco, músculo que mais e que menos trabalha, para que serve (força, ganho de massa, resistência), séries por semana de cada grupo, equilíbrio e se serve para o seu perfil, com a troca sugerida;
- **diário alimentar**: “Comi isso” ou “Comi outra coisa” em cada refeição, alimentos anotados ao longo do dia com as calorias de cada um e quanto falta (ou passou) da meta. Menores de 18 e quem informou transtorno alimentar não recebem contagem de calorias;
- **cochilos**: registro dos cochilos do dia; até 18 anos somam à meta de sono (recomendação em 24 horas) e, para adultos, aparecem à parte, com dicas quando são longos, frequentes ou tarde;
- **uma resposta de saúde vale para tudo**: idade, gestação e doenças informadas a um dos treinadores protegem também as metas da Nutricionista e o diário (vale sempre a resposta mais protegida);
- tudo baseado em diretrizes e estudos publicados (293 referências; as que só abriam no resumo foram trocadas por fontes lidas em texto completo ou retiradas; listadas em *Sobre → Referências científicas*).

Os dados ficam **somente no aparelho**. Não há servidor, cadastro, anúncios nem rastreadores.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `www/` | O aplicativo (site/PWA). É esta pasta que vai para a hospedagem. |
| `www/js/data/` | Catálogo de exercícios, aparelhos, alimentos (TACO), modelos de treino e base de conhecimento. |
| `www/js/anim/` | Motor das animações: esqueleto articulado, desenho do corpo (pele, rosto, roupa, músculos) e aparelhos. |
| `www/js/logic/` | Regras do Treinador, da Nutricionista e do progresso. |
| `www/js/views/` | Telas. |
| `tests/` | Testes automáticos de dados e de lógica. |
| `tools/` | Servidor local, gerador do service worker e dos ícones, verificação das animações. |
| `.github/workflows/` | Publicação automática do site no GitHub Pages. |

Não há etapa de compilação para o site: é HTML, CSS e JavaScript puros, sem bibliotecas de terceiros.

## Rodar no computador

```bash
npm start
```

Abra `http://localhost:5173`. Requer Node.js 22 ou mais novo.

## Testes

```bash
npm test
```

Roda 328 testes (centenas de milhares de perfis simulados no Treinador, na corrida, na Nutricionista e no sono; sensibilidade dos questionários, pergunta por pergunta; dores e limitações conferidas pela mecânica de cada exercício; corrida e musculação combinadas; avaliação de treino; diário alimentar; cochilos; armazenamento com o banco do aparelho falhando; validação de backup; catálogo com fontes; política de segurança) e três verificadores das 286 animações: física (ossos de comprimento fixo, articulações dentro do limite, nada atravessa o chão), postura e equilíbrio, e cabos (nenhum cabo atravessa o corpo).

Teste de uso de ponta a ponta (clica no app como um usuário: entrevista, treino, evolução, nutrição, backup e uso sem internet). Deixe `npm start` rodando em outro terminal e execute:

```bash
npm run test:uso
```

Outros roteiros de ponta a ponta, rodados do mesmo jeito (`node tools/e2e/navegador.mjs <roteiro>`): `tools/e2e/organizacao.mjs` (organização dos treinos: planos, dias, agenda, treino em andamento), `tools/e2e/ajustes-de-perfil.mjs` (objetivos alinhados e volta depois de uma pausa), `tools/e2e/corrida.mjs` (Treinador de corrida), `tools/e2e/sono.mjs` (meta de sono e cochilos), `tools/e2e/combinado.mjs` (corrida e musculação juntas, fortalecimento) e `tools/e2e/diario.mjs` (diário alimentar; `HORA=12:30` simula outro horário).

Precisa do Microsoft Edge ou do Google Chrome instalado. `tools/e2e/textos.mjs` mede a quantidade de texto de cada tela.

Para ver todas as animações lado a lado: `http://localhost:5173/tools/gallery.html` (use `?g=peito`, `?live=1`; `?foco=mao` aproxima as mãos).

## Depois de alterar qualquer arquivo de `www/`

```bash
npm run build
```

Isso gera de novo `www/sw.js` (a lista de arquivos guardados para uso offline). Sem esse passo, quem já instalou o app não recebe a atualização.

## Publicar o site (Android, iPhone e qualquer navegador)

O FitCore é um PWA: instala-se pelo navegador, sem loja e sem APK.

- **Android (Chrome):** ao abrir o endereço, o app oferece “Instalar”; também dá para usar o menu ⋮ → *Adicionar à tela inicial*.
- **iPhone (Safari):** *Compartilhar → Adicionar à Tela de Início* (o próprio app mostra esse passo a passo na primeira abertura). Instale antes de registrar treinos: no iPhone, os dados do navegador e os do app instalado ficam separados, e o Safari pode apagar os dados de um site que fica 7 dias sem ser aberto; instalado, isso não acontece.

Depois de instalado, abre em tela cheia e funciona sem internet. O que depende do aparelho: a vibração só existe no Android; no iPhone o bipe não toca com o modo silencioso ligado; o aviso do fim do descanso com o app em segundo plano é uma notificação do navegador (opção em Ajustes), confiável no Android e sujeita a atraso no iPhone, que pausa o app em segundo plano.

### GitHub Pages (já configurado)

1. Crie o repositório no GitHub e envie este projeto para a branch `main`.
2. No repositório, abra *Settings → Pages* e, em *Build and deployment → Source*, escolha **GitHub Actions**.
3. A cada envio para a `main`, o fluxo `.github/workflows/pages.yml` roda os testes e publica a pasta `www/`. O endereço fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

O GitHub Pages não permite cabeçalhos de segurança personalizados; nesse caso valem a política de segurança (CSP) da própria página e a proteção contra iframe feita por código, que já fazem parte do app.

### Outras hospedagens

**Cloudflare Pages** e **Netlify** também servem: basta publicar o conteúdo de `www/`. Os dois leem o arquivo `www/_headers`, que traz os cabeçalhos de segurança extras (HSTS, bloqueio de iframe etc.).

O app precisa de HTTPS para instalar e para funcionar offline.

## Segurança

- Política de segurança de conteúdo (CSP) estrita: só carrega arquivos do próprio app; sem scripts ou estilos embutidos; sem conexões externas; Trusted Types ativado. A página não pode abrir nenhuma conexão; só o service worker baixa arquivos, e apenas do próprio site, para o uso offline.
- A interface é montada sem `innerHTML`: texto digitado pelo usuário nunca vira código.
- Backup importado é validado campo a campo (tipos, tamanhos, ids existentes), com proteção contra poluição de protótipo.
- O service worker só responde a arquivos do próprio site.
- Permissões: nenhuma obrigatória. A única opcional é a de notificações do navegador, para o aviso do fim do descanso.
- Duas janelas do app abertas ao mesmo tempo não sobrescrevem os dados uma da outra.
- O app não roda dentro de iframe de outro site.

## Avisos

- O app oferece **orientação educativa**. Não substitui médico, profissional de educação física nem nutricionista. “Treinador” e “Nutricionista” são assistentes virtuais baseados em regras fixas.
- Composição dos alimentos: TACO (NEPA/UNICAMP), com complementos da TBCA (USP/FoRC) e do USDA. A TBCA pede citação da fonte e não permite uso comercial dos dados; se o app for comercializado, substitua os 15 itens marcados com `fonte: 'TBCA'` em `www/js/data/foods.js`.
