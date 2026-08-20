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

## Fase 1 (pronta) x Fase 2 (próxima)

**Fase 1 — feita nesta entrega**: seleção de unidade (nome + unidade, sem
senha), menu principal com cards de KPI, cadastro de Equipamentos e de
Preventiva de Armazém (com vínculo automático nas abas fixas, do jeito que
já funcionava na planilha), e as telas operacionais de Preventivas de
Equipamentos/Armazém (status colorido, marcar como realizada).

**Fase 2 — próxima**: tela de Manutenções Corretivas (com Tempo Parado e
Custo Total calculados), Histórico com filtros múltiplos, e tela de Custos
com o detalhamento. O Dashboard Geral (Google Sheets) já cobre esses dados
hoje; a Fase 2 leva essas mesmas informações para dentro do app.

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
