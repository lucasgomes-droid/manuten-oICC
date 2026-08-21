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

## 0-d) Excluir cadastro de equipamento/armazém (some das Preventivas junto)

Agora dá pra excluir um cadastro direto na lista: em **Cadastro de
Equipamentos** e **Cadastro de Preventiva de Armazém**, cada item da lista
ganhou um botão **🗑️ Excluir**, que abre uma confirmação antes de apagar.

É uma "exclusão lógica" (soft delete): o item some da lista de cadastro, do
dropdown de **Lançar Manutenção** e das abas **Preventivas de
Equipamentos/Armazém** ao mesmo tempo — automaticamente, sem precisar apagar
nada em mais de um lugar. Só o cadastro ativo desaparece; nada é apagado de
verdade na planilha (a linha continua lá, só marcada como inativa) e o que já
foi registrado em `Historico_Preventivas` e `Manutencoes_Custos` (as
manutenções e preventivas já feitas daquele item) continua no histórico
normalmente, para auditoria.

Essa rodada mudou 2 arquivos na planilha (`00_Config.js`, `07_WebApp.js` —
`01_Setup.js` não mudou, mas rode "Configurar planilha" de novo mesmo assim
para a coluna nova **Cadastro Ativo** aparecer nas 4 abas: `Cadastro_
Equipamentos`, `Cadastro_Preventiva_Armazem`, `Preventivas_Equipamentos` e
`Preventivas_Armazem`) + 4 no GitHub (`app.js`, `api.js`, `css/style.css`,
`sw.js`).

## 0-c) Budget por ano — já funciona, só ganhou um seletor de ano

Boa notícia: a aba **Orcamento** já foi pensada pra isso desde a Fase 2 —
cada linha é Unidade + Classificação + **Ano** + Budget Anual, e o
Dashboard de Gastos já calcula Gasto/Saldo olhando só os lançamentos
daquele ano (então quando o ano vira, o Gasto de fato "zera" sozinho —
os lançamentos de 2026 não contam mais pro total de 2027). Nada disso
precisou mudar.

O que essa rodada adicionou foi só a possibilidade de **ver** anos
diferentes no app (antes ele sempre mostrava o ano corrente, sem opção de
trocar): um seletor de ano no topo do Dashboard de Gastos e do Dashboard
de Tempo Ocioso.

**Pra já deixar 2027 pronto** (não precisa esperar o ano virar): abra a
aba Orcamento e adicione linhas novas, uma por Unidade + Classificação,
com Ano = 2027 e o Budget Anual que você quiser pra cada uma — por
exemplo:

| Unidade | Classificação | Ano | Budget Anual |
|---|---|---|---|
| Macatuba | EQUIPAMENTOS | 2027 | 160000 |
| Macatuba | PREDIAL | 2027 | 75000 |
| ... | ... | 2027 | ... |

Essa atualização (0-c) é só nos arquivos `docs/app/js/app.js` e
`docs/app/js/api.js` no GitHub — **não precisa mexer em nada na
planilha/Apps Script desta vez**.

## 0-b) Ajustes finos depois da Fase 3 (a mesma atualização de sempre)

Depois do primeiro retorno de testes, mais alguns ajustes: Classificação
agora vem antes de Equipamento/Local no lançamento (e a lista já filtra
certo); Tempo Ocioso e Gastos ganharam filtro de mês; Gastos ganhou "Gasto
por equipamento"; dá pra reagendar a Próxima Preventiva ou anexar um
documento em negociação sem marcar como realizada (segundo botão na lista
de preventivas); a lista de nomes do login saiu do código e foi pra uma
aba nova **Usuarios** na planilha — edite direto lá pra adicionar/remover
alguém. Desta vez só 3 arquivos mudaram na planilha (`00_Config.js`,
`01_Setup.js`, `07_WebApp.js` — não precisa mexer em `02_Cadastro.js` nem
`03_Historico.js`) + 2 no GitHub (`app.js`, `css/style.css`) — e rodar
"Configurar planilha" de novo pra a aba Usuarios e a coluna "Anexo
Negociação" aparecerem.

## 0) Já tenho o app no ar — como atualizo pra Fase 3?

Mesma lógica de sempre: nenhum arquivo novo, nenhuma URL muda. É só
substituir o **conteúdo** de arquivos que já existem, nos mesmos lugares:

**Na planilha (Apps Script)** — substitua o conteúdo destes 5 arquivos
pelos novos (mesmo nome, mesmo lugar — apague tudo que tem dentro de cada
um e cole o novo conteúdo por cima):
`00_Config.js`, `01_Setup.js`, `03_Historico.js`, `07_WebApp.js` (e
`02_Cadastro.js`, se eu tiver avisado que ele mudou nesta rodada). Depois:

1. Salve (Ctrl+S)
2. No menu **🔧 Gestão de Manutenção**, rode de novo **"1) Configurar
   planilha"** — isso adiciona a coluna nova **Registrado Por** em
   `Historico_Preventivas` e `Manutencoes_Custos`, sem apagar nada que já
   existia (é seguro rodar de novo quantas vezes precisar)
3. **Implantar → Gerenciar implantações** → ícone de lápis na implantação
   existente → **Nova versão** → **Implantar** (a URL continua a mesma)
4. Na **primeira vez** que a API rodar depois dessa atualização, o Google
   vai pedir autorização de novo (aparece ao tentar usar o app, ou você
   pode forçar rodando qualquer função pelo editor do Apps Script) — é
   porque a Fase 3 passou a usar o **Google Drive** para guardar os
   anexos. É a sua própria planilha pedindo permissão pra criar arquivos
   no seu Drive; aceite normalmente.

**No GitHub (app)** — substitua o conteúdo destes 4 arquivos:
`docs/app/js/app.js`, `docs/app/css/style.css`, `docs/app/sw.js`, e
opcionalmente `docs/app/js/api.js` se eu avisar que mudou. Não mexa em
`docs/app/js/config.js` — ele já está com a sua URL certa. Depois de
subir, espera 1-2 minutos e testa o link de sempre.

**Sobre a lista de nomes (login)**: os nomes fixos (Eduardo, Ricardo,
Lucas, Jesiel, Guilherme, Matheus, Daniely) estão em `00_Config.js`
(`USUARIOS`) — se alguém entrar ou sair da equipe, me fala que eu ajusto
essa lista pra você.

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
   `Data Fim`, `Tempo Parada (h)` e `Registrado Por` preenchidos.
7. Em **Lançar Manutenção**, registre uma **Corretiva** de teste (escolha
   o equipamento na lista, preencha início/fim/valor e anexe qualquer
   arquivo) — confira se apareceu em **Manutenções Corretivas** e em
   `Manutencoes_Custos`, com o link do anexo funcionando.
8. Repita o passo 7 escolhendo **Preventiva** no seletor — confira se
   apareceu em **Manutenções Preventivas** (não em Corretivas).
9. Abra o **Dashboard de Gastos** — confira se os valores de Budget batem
   com o que está na aba `Orcamento`, e se "Custo por tipo de manutenção"
   já mostra PREVENTIVA (com o valor do passo 8).
10. No **Menu Principal**, clique num status (ex: "atrasada") — deve abrir
    a lista de preventivas já filtrada por esse status.
11. Na tela de entrada, escolha **"Todas as unidades"** — deve aparecer só
    o menu com os 2 dashboards (sem cadastro), e cada um deve mostrar o
    gráfico comparando as 3 unidades.
12. Em **Cadastro de Equipamentos** (ou Armazém), clique **🗑️ Excluir** num
    item de teste, confirme — o item deve sumir da lista de cadastro, do
    dropdown de Lançar Manutenção e da lista de Preventivas correspondente.
    Confira na planilha: a linha continua lá em `Cadastro_Equipamentos` e em
    `Preventivas_Equipamentos`, só a coluna **Cadastro Ativo** virou `FALSO`.

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
