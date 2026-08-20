# Deploy do app novo (PWA + API)

Este guia substitui o antigo `GUIA_APPSHEET.md` — o app novo é **independente
do AppSheet**. O AppSheet atual continua existindo só como referência/fonte
histórica; ele não precisa mais ser reconfigurado.

Arquitetura:

```
Frontend (PWA em docs/app/)  →  Backend/API (Apps Script, src/07_WebApp.js)  →  Planilha (Google Sheets)
      hospedado no GitHub Pages          "App da Web" do Apps Script              seu banco de dados
```

Há duas partes pra colocar no ar: **(1)** publicar a API na planilha, **(2)**
publicar o app (PWA) no GitHub Pages. Faça nessa ordem — o app precisa da
URL da API pra funcionar.

---

## 0) Já tenho a Fase 1 no ar — como atualizo pra Fase 2?

Boa notícia: nenhum arquivo novo foi criado, nem a URL da API nem a do app
mudam. É só substituir o **conteúdo** de arquivos que já existem, nos
mesmos lugares de sempre:

**Na planilha (Apps Script)** — substitua o conteúdo destes 5 arquivos
pelos novos (mesmo nome, mesmo lugar — apague tudo que tem dentro de cada
um e cole o novo conteúdo por cima):
`00_Config.js`, `01_Setup.js`, `02_Cadastro.js`, `03_Historico.js`,
`07_WebApp.js`. Depois:

1. Salve (Ctrl+S)
2. No menu **🔧 Gestão de Manutenção**, rode de novo **"1) Configurar
   planilha"** — isso cria a aba nova **Orcamento** (com os valores de
   budget que você mandou por print, já preenchidos) sem mexer em nada que
   já existia
3. **Implantar → Gerenciar implantações** → ícone de lápis na implantação
   existente → **Nova versão** → **Implantar** (a URL continua a mesma,
   não precisa mudar nada no app)

**No GitHub (app)** — substitua o conteúdo destes 4 arquivos, do mesmo
jeito que você já fez (arrastando pra a página de upload do GitHub, ou
editando direto pelo GitHub Desktop): `docs/app/js/app.js`,
`docs/app/js/api.js`, `docs/app/css/style.css`, `docs/app/sw.js`. Não mexa
em `docs/app/js/config.js` — ele já está com a sua URL certa. Depois de
subir, espera 1-2 minutos e testa o link de sempre.

**Ajuste manual que só você consegue fazer**: na aba **Orcamento**, o
budget de Jundiaí II entrou como uma linha só ("GERAL", R$100.000) porque
no print que você mandou ele não vinha separado por Equipamentos/Predial
como Macatuba e Jundiaí I. Se você tiver esse valor separado, é só apagar
a linha "GERAL" e adicionar duas linhas novas (uma "EQUIPAMENTOS", uma
"PREDIAL") — o app recalcula sozinho.

---

## 1) Publicar a API (Apps Script → App da Web)

Pré-requisito: você já colou todos os arquivos de `src/` (incluindo o novo
`07_WebApp.js`) no editor do Apps Script da sua planilha, na ordem do
`README.md`, e já rodou **"1) Configurar planilha"** pelo menos uma vez.

1. No editor do Apps Script, clique em **Implantar → Nova implantação**.
2. No ícone de engrenagem ao lado de "Selecionar tipo", escolha **App da
   Web**.
3. Preencha:
   - **Descrição**: `API Gestão de Manutenção` (ou o que preferir)
   - **Executar como**: `Eu (seu e-mail)`
   - **Quem pode acessar**: `Qualquer pessoa`
     (precisa ser "Qualquer pessoa" para o app funcionar sem cada usuário
     ter que fazer login Google — a segurança fica no token opcional, veja
     o passo 4)
4. Clique em **Implantar**. Na primeira vez vai pedir autorização — é o
   script pedindo permissão para ler/escrever a própria planilha, é
   esperado e seguro (é a sua planilha, seu script).
5. Copie a **URL do app da Web** (termina em `/exec`). Ela vai parecer com:
   `https://script.google.com/macros/s/AKfycb.../exec`
6. **(Recomendado) Proteja a API com um token**: no menu **🔧 Gestão de
   Manutenção** da planilha, rode **"Configurar token da API"** e digite
   uma senha/token qualquer (ex: `macatuba-2026-xyz`). Sem isso, qualquer
   pessoa com a URL consegue ler e gravar dados na planilha.

### Atualizando a API depois

Sempre que editar algum arquivo em `src/` (incluindo `07_WebApp.js`), volte
em **Implantar → Gerenciar implantações**, clique no ícone de lápis da
implantação existente, e em "Versão" escolha **Nova versão** → **Implantar**.
Isso atualiza a mesma URL (não precisa mudar o `config.js` do app de novo).
Criar uma implantação totalmente nova geraria uma URL diferente.

---

## 2) Publicar o app (PWA) no GitHub Pages

O app fica em `docs/app/` dentro deste repositório. O GitHub Pages, quando
configurado para servir a partir da pasta `/docs`, publica esse app em:

```
https://SEU-USUARIO.github.io/SEU-REPOSITORIO/app/
```

Passos:

1. Suba este repositório para o GitHub (veja `README.md` se ainda não fez
   isso: `git remote add origin ...`, `git push -u origin main`).
2. No GitHub, abra o repositório → **Settings → Pages**.
3. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha `main` e a pasta **`/docs`** → **Save**.
5. Espere 1–2 minutos e acesse `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/app/`.

### Conectando o app na API

1. Edite `docs/app/js/config.js` (no seu computador, no repositório local).
2. Cole a URL do passo 1.5 em `API_BASE_URL`.
3. Se você configurou um token no passo 1.6, cole o mesmo valor em
   `API_TOKEN`.
4. Salve, `git add`, `git commit`, `git push` — o GitHub Pages atualiza
   sozinho em ~1 minuto.

```js
window.APP_CONFIG = {
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
  API_TOKEN: 'macatuba-2026-xyz', // ou '' se não configurou token
  ...
};
```

---

## 3) Testar

1. Abra a URL do app no celular ou no computador.
2. Você deve ver a tela **"Gestão de Manutenção"** pedindo nome + unidade.
3. Escolha a unidade, entre, e confira se o **Menu Principal** carrega os
   cards com números reais (equipamentos, preventivas, % em dia).
4. Cadastre um equipamento de teste em **Cadastro de Equipamentos** e
   confira se ele aparece automaticamente em **Preventivas de
   Equipamentos** (mesmo comportamento de "aba fixa" que já existia — só
   que agora pelo app, não só pela planilha).
5. Confira também direto na planilha: a linha nova deve ter aparecido nas
   duas abas (`Cadastro_Equipamentos` e `Preventivas_Equipamentos`).
6. Marque uma preventiva de **equipamento** como realizada — deve pedir
   Data/Hora Início e Fim, mostrar o tempo parado calculado antes de você
   confirmar, e o registro deve aparecer em `Historico_Preventivas` com
   `Data Fim` e `Tempo Parada (h)` preenchidos.
7. Registre uma **Manutenção Corretiva** de teste e confira se apareceu em
   `Manutencoes_Custos`.
8. Abra o **Dashboard de Gastos** — confira se os valores de Budget batem
   com o que está na aba `Orcamento`.
9. Na tela de entrada, escolha **"Todas as unidades"** — deve aparecer só
   o menu com os 2 dashboards (sem cadastro).

Se algo não aparecer, abra o Console do navegador (F12 → Console) — os
erros da API aparecem lá com a mensagem exata (ex: token inválido, campo
faltando, etc.).

## 4) Instalar como app (PWA)

No celular (Android/Chrome ou iPhone/Safari), abra a URL do app e use
**"Adicionar à tela inicial"** (menu do navegador). Ele abre em tela cheia,
com ícone próprio, como um app nativo — sem precisar de loja de aplicativos.

---

## Segurança e limites que vale saber

- A "API" é um Web App do Apps Script — grátis, mas com limites de cota do
  Google (chamadas por dia, tempo de execução por chamada). Para o uso de
  3 unidades isso não deve ser problema, mas se o app crescer muito, vale
  ficar de olho.
- Sem senha por usuário (só nome + unidade, como combinado) — o controle de
  acesso real está no token da API (passo 1.6) e em quem você compartilha o
  link do app.
- O token, se configurado, viaja na URL (nas chamadas GET) e no corpo (nas
  chamadas POST) — não é criptografia militar, é uma trava simples contra
  "alguém achou o link por acaso". Para o cenário de uso interno entre as 3
  unidades, é suficiente.
