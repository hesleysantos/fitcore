# FitCore — Treino e Nutrição

Aplicativo de academia que funciona **100% offline**:

- **232 exercícios** com figura humana animada (com o aparelho), que toca sozinha como um vídeo, e os músculos trabalhados em destaque. As mãos mudam conforme o exercício: espalmadas no apoio, com os dedos fechados em volta da barra ou do halter, ou soltas;
- técnica de cada exercício conferida em fontes abertas (ACE, NASM, NSCA, artigos científicos), listadas na tela do exercício;
- busca e filtros por grupo muscular, equipamento, nível e aparelhos da sua academia;
- **treinos por dia** totalmente personalizáveis, com 9 modelos prontos;
- registro do treino com um toque por série, cronômetro de descanso, sugestão de carga e histórico;
- **Evolução**: análise automática dos treinos registrados, com dicas curtas (constância, séries por músculo, equilíbrio, exercícios travados, recuperação, ritmo do peso, volta depois de um tempo parado), cada uma com a fonte;
- **Treinador virtual**: entrevista (objetivo, idade, experiência, tempo sem treinar, limitações, aparelhos) → plano de treino, com sugestão periódica de troca de exercícios que você aceita ou não;
- **Nutricionista virtual**: entrevista → metas de calorias, proteína e água, o que comer antes e depois de cada treino e cardápio de exemplo;
- **objetivos alinhados**: o objetivo do treino e o da alimentação andam juntos (ganhar massa com ganhar massa, emagrecer com emagrecer). Ao mudar um, o app pergunta se iguala o outro; você pode manter diferentes;
- **volta depois de uma pausa**: o tempo sem treinar entra no plano do Treinador, na carga sugerida do treino (de 10% a 50% menor, subindo a cada treino) e nas dicas;
- tudo baseado em diretrizes publicadas (56 referências listadas em *Sobre → Referências científicas*).

Os dados ficam **somente no aparelho**. Não há servidor, cadastro, anúncios nem rastreadores.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `www/` | O aplicativo (site/PWA). É esta pasta que vai para a hospedagem e para dentro do APK. |
| `www/js/data/` | Catálogo de exercícios, aparelhos, alimentos (TACO), modelos de treino e base de conhecimento. |
| `www/js/anim/` | Motor das animações: esqueleto articulado, desenho do corpo (pele, rosto, roupa, músculos) e aparelhos. |
| `www/js/logic/` | Regras do Treinador, da Nutricionista e do progresso. |
| `www/js/views/` | Telas. |
| `android/` | Projeto Android (Capacitor). |
| `tests/` | Testes automáticos de dados e de lógica. |
| `tools/` | Servidor local, gerador do service worker e dos ícones, verificação das animações. |
| `dist/` | APK pronto para instalar (fora do repositório; publique-o em *Releases*). |
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

Roda 95 testes (mais de 2.500 perfis simulados no Treinador e na Nutricionista, análise de evolução, tempo parado, objetivos alinhados, mãos das figuras, gravação dos dados, validação de backup, catálogo com fontes, política de segurança) e a verificação de física e a postura das 232 animações (ossos de comprimento fixo, articulações dentro do limite, nada atravessa o chão, mãos e pés alcançam o aparelho, mãos apoiadas no chão quando o corpo está deitado).

Teste de uso de ponta a ponta (clica no app como um usuário: entrevista, treino, evolução, nutrição, backup e uso sem internet). Deixe `npm start` rodando em outro terminal e execute:

```bash
npm run test:uso
```

Outros roteiros de ponta a ponta, rodados do mesmo jeito (`node tools/e2e/navegador.mjs <roteiro>`): `tools/e2e/organizacao.mjs` (organização dos treinos: planos, dias, agenda, treino em andamento) e `tools/e2e/ajustes-de-perfil.mjs` (objetivos alinhados e volta depois de uma pausa).

Precisa do Microsoft Edge ou do Google Chrome instalado. `tools/e2e/textos.mjs` mede a quantidade de texto de cada tela.

Para ver todas as animações lado a lado: `http://localhost:5173/tools/gallery.html` (use `?g=peito`, `?live=1`; `?foco=mao` aproxima as mãos).

## Depois de alterar qualquer arquivo de `www/`

```bash
npm run build
```

Isso gera de novo `www/sw.js` (a lista de arquivos guardados para uso offline). Sem esse passo, quem já instalou o app não recebe a atualização.

## Publicar o site (iPhone e qualquer navegador)

O iPhone instala o app como PWA: a pessoa abre o endereço no Safari e toca em *Compartilhar → Adicionar à Tela de Início* (o próprio app mostra esse passo a passo na primeira abertura).

### GitHub Pages (já configurado)

1. Crie o repositório no GitHub e envie este projeto para a branch `main`.
2. No repositório, abra *Settings → Pages* e, em *Build and deployment → Source*, escolha **GitHub Actions**.
3. A cada envio para a `main`, o fluxo `.github/workflows/pages.yml` roda os testes e publica a pasta `www/`. O endereço fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. Para distribuir o APK, crie uma *Release* no GitHub e anexe o arquivo de `dist/`.

O GitHub Pages não permite cabeçalhos de segurança personalizados; nesse caso valem a política de segurança (CSP) da própria página e a proteção contra iframe feita por código, que já fazem parte do app.

### Outras hospedagens

**Cloudflare Pages** e **Netlify** também servem: basta publicar o conteúdo de `www/`. Os dois leem o arquivo `www/_headers`, que traz os cabeçalhos de segurança extras (HSTS, bloqueio de iframe etc.).

O app precisa de HTTPS para instalar e para funcionar offline.

## Gerar o APK (Android)

Requisitos: JDK 21 e Android SDK (plataforma 36 e build-tools 36).

```bash
npm run android:sync
cd android
./gradlew assembleRelease
```

O APK assinado sai em `android/app/build/outputs/apk/release/app-release.apk`.

### Chave de assinatura — guarde bem

- `android/fitcore-release.jks` e `android/keystore.properties` são a chave e a senha que assinam o APK.
- **Faça uma cópia de segurança dos dois arquivos em local seguro.** Sem eles não é possível publicar atualizações que instalem por cima do app já instalado.
- Eles estão no `.gitignore` e **nunca** devem ser publicados nem enviados a ninguém.

## Segurança

- Política de segurança de conteúdo (CSP) estrita: só carrega arquivos do próprio app; sem scripts ou estilos embutidos; sem conexões externas; Trusted Types ativado. A página não pode abrir nenhuma conexão; só o service worker baixa arquivos, e apenas do próprio site, para o uso offline.
- A interface é montada sem `innerHTML`: texto digitado pelo usuário nunca vira código.
- Backup importado é validado campo a campo (tipos, tamanhos, ids existentes), com proteção contra poluição de protótipo.
- O service worker só responde a arquivos do próprio site.
- Android: **sem permissão de internet** (o sistema bloqueia qualquer conexão), sem backup automático na nuvem, depuração do WebView desligada, única permissão: vibração. Nenhum plugin de terceiros.
- Duas janelas do app abertas ao mesmo tempo não sobrescrevem os dados uma da outra.
- O app não roda dentro de iframe de outro site.

## Avisos

- O app oferece **orientação educativa**. Não substitui médico, profissional de educação física nem nutricionista. “Treinador” e “Nutricionista” são assistentes virtuais baseados em regras fixas.
- Composição dos alimentos: TACO (NEPA/UNICAMP), com complementos da TBCA (USP/FoRC) e do USDA. A TBCA pede citação da fonte e não permite uso comercial dos dados; se o app for comercializado, substitua os 15 itens marcados com `fonte: 'TBCA'` em `www/js/data/foods.js`.
