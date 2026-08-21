# Gestão de Manutenção — Macatuba / Jundiaí I / Jundiaí II

App próprio e independente (PWA) de gestão de manutenção das 3 unidades,
com Google Sheets como banco de dados central e Google Apps Script como
API/backend. O AppSheet que vocês usavam antes **não é mais necessário** —
ele fica apenas como referência histórica dos dados, se quiserem consultar.

Veja `docs/ARQUITETURA.md` para o desenho completo da base de dados e do
Dashboard, e `docs/DEPLOY_APP_NOVO.md` para o passo a passo de publicar a
API e o app.

## O que tem aqui

```
appsscript.json          manifesto do projeto Apps Script
src/
  00_Config.js            constantes (nomes de aba/coluna, unidades, etc.)
  01_Setup.js             cria as abas, validações e formatação — rodar 1x
  02_Cadastro.js          vínculo automático Cadastro → Preventivas (abas fixas)
  03_Historico.js         log automático em Historico_Preventivas
  04_Dashboard.js         motor de agregação (Dashboard_Data)
  05_DashboardView.js     monta a aba visual "Dashboard" (KPIs, filtros, gráficos)
  06_Triggers.js          instala os gatilhos (onEdit + diário)
  07_WebApp.js            API (App da Web) que o app novo consome — doGet/doPost
docs/
  app/                    o app novo (PWA) — HTML/CSS/JS puro, publicado no GitHub Pages
  ARQUITETURA.md          desenho da base de dados e do dashboard
  DEPLOY_APP_NOVO.md      passo a passo: publicar a API + publicar o app no GitHub Pages
```

## Fase 1, Fase 2 e Fase 3 (todas prontas)

**Fase 1**: seleção de unidade (nome + unidade, sem senha), menu principal
com cards de KPI, cadastro de Equipamentos e de Preventiva de Armazém (com
vínculo automático nas abas fixas), e as telas operacionais de Preventivas
de Equipamentos/Armazém (status colorido, marcar como realizada).

**Fase 2**: tela de Manutenções Corretivas (com Data/Hora Início e Fim,
Tempo Parado calculado automaticamente); Histórico de preventivas com
filtros (busca, classificação, ano — sem filtro de unidade, já que ela é
escolhida na entrada do app); Dashboard de Gastos por unidade (Budget,
Gasto e Saldo, separados por Equipamentos e Predial, mais custo por tipo e
evolução mensal); Dashboard de Tempo Ocioso (quantos equipamentos pararam,
quanto tempo cada um, total, e quais são recorrentes); e a opção **"Todas
as unidades"** na tela de entrada, que dá acesso só aos 2 dashboards acima
já consolidados nas 3 unidades — sem cadastro nem lançamento, que
continuam exigindo escolher uma unidade específica.

Ao marcar uma preventiva de **equipamento** como realizada, ou ao registrar
uma **corretiva**, o app pede Data/Hora Início e Fim e calcula o tempo
parado sozinho — isso é o que alimenta o Dashboard de Tempo Ocioso.

O Budget de cada unidade fica numa aba nova, **Orcamento** (Unidade,
Classificação, Ano, Budget Anual), criada automaticamente por
"Configurar planilha" com os valores que você passou por print — edite
direto na aba a qualquer momento para ajustar ou adicionar outros anos.

**Fase 3**: login por nome (lista fixa de pessoas, sem digitar — cada
nome já tem uma unidade padrão, menos os "gerais" que escolhem na hora);
todo lançamento novo (corretiva, preventiva com custo, ou marcar uma
preventiva de rotina como feita) grava quem registrou; **anexo**
(orçamento, nota fiscal, certificação) obrigatório nos lançamentos de
manutenção e opcional ao marcar uma preventiva de rotina — fica salvo no
Google Drive (pasta "Gestão de Manutenção - Anexos", organizada por
unidade) e aparece como link clicável no Histórico e nas listas, para
auditoria; **Equipamento/Local** agora é uma lista suspensa vinda direto
do cadastro (evita erro de digitação), com opção de digitar manualmente
se o item ainda não estiver cadastrado; a tela de **Manutenções
Corretivas** virou **"Lançar Manutenção"**, com um seletor Corretiva/
Preventiva/Outro tipo — o histórico continua em duas abas separadas
(Manutenções Corretivas e Manutenções Preventivas); os cards de status no
menu principal (atrasadas, pendentes etc.) agora são clicáveis e abrem a
lista já filtrada; e os dois dashboards de "Todas as unidades" ganharam
gráfico comparando Macatuba/Jundiaí I/Jundiaí II lado a lado.

Combinado com o Lucas: campos obrigatórios (equipamento, classificação,
início, fim, valor e anexo) ficaram bem restritivos de propósito — se
algum lançamento no dia a dia não tiver, por exemplo, um valor ainda
definido, me avisa que eu relaxo essa regra pontualmente.

Ajustes finos depois do primeiro teste: Classificação vem antes de
Equipamento/Local (que filtra certo pela lista de cadastro); filtro de mês
nos dois dashboards; "Gasto por equipamento" no Dashboard de Gastos;
"Manutenções Preventivas" agora junta lançamentos com custo E preventivas
de rotina marcadas como feitas; nas Preventivas dá pra reagendar a Próxima
Preventiva ou anexar um documento em negociação sem marcar como
realizada; e a lista de nomes do login saiu do código pra uma aba
**Usuarios** (Nome, Unidade) — edite direto na planilha pra adicionar,
remover ou renomear alguém.

Depois disso: em **Cadastro de Equipamentos** e **Cadastro de Preventiva de
Armazém**, cada item ganhou um botão **🗑️ Excluir** (com confirmação antes
de apagar). É uma exclusão lógica — o item some da lista de cadastro, do
dropdown de Lançar Manutenção e das Preventivas ao mesmo tempo, mas nada é
apagado de verdade na planilha nem no histórico já registrado.

## Como instalar na sua planilha Google Sheets

1. Abra a planilha (a mesma que o AppSheet já usa, ou a cópia migrada que eu
   te mandei — `nova_gestao_manutencao.xlsx` — depois de importada/anexada
   no Google Sheets).
2. **Extensões → Apps Script**.
3. Apague o `Code.gs` vazio que vem por padrão.
4. Para cada arquivo em `src/` (nessa ordem: `00_Config.js` primeiro), crie
   um novo arquivo de script (ícone **+** → Script) com o mesmo nome, e cole
   o conteúdo. Também copie o conteúdo de `appsscript.json` para o arquivo
   de manifesto do projeto (ícone de engrenagem → "Mostrar arquivo
   appsscript.json" se não aparecer direto).
5. Salve e recarregue a planilha (F5 no navegador). Vai aparecer um novo
   menu **🔧 Gestão de Manutenção**.
6. Rode, nessa ordem:
   - **1) Configurar planilha (criar abas/validações)**
   - **2) Instalar automações (gatilhos)** — a primeira vez vai pedir para
     autorizar o script (é normal, é a sua própria planilha pedindo
     permissão para editar a si mesma).
7. Teste: cadastre um equipamento novo em `Cadastro_Equipamentos` e confira
   se apareceu automaticamente uma linha em `Preventivas_Equipamentos`.
8. Agora siga `docs/DEPLOY_APP_NOVO.md` para publicar a API (App da Web) e
   o app (PWA) no GitHub Pages — é o próximo passo pra usar o app de
   verdade, em vez de mexer direto na planilha.

## Versionar no GitHub

Este diretório já é um repositório git local. Para subir:

```bash
git remote add origin <URL_DO_SEU_REPOSITORIO>
git branch -M main
git push -u origin main
```

Se preferir manter o código sincronizado automaticamente com o Apps Script
(em vez de copiar e colar toda vez que ajustarmos algo), o
[`clasp`](https://github.com/google/clasp) da própria Google faz isso —
posso te ajudar a configurar quando quiser.

## Fluxo de trabalho daqui pra frente

Como combinamos: eu ajusto o código aqui, te mando o arquivo atualizado, você
cola no editor do Apps Script, testamos juntos, e quando estiver bom você
sobe pro GitHub. Qualquer comportamento que não estiver do jeito que você
queria, me fala qual tela/aba e o que deveria acontecer — é mais rápido eu
ajustar o script do que você mexer na planilha na mão.
