# Arquitetura — Gestão de Manutenção (Macatuba, Jundiaí I, Jundiaí II)

## Princípio geral

Uma única planilha Google Sheets central, com abas organizadas por função (não por
unidade). Toda tabela tem uma coluna **Unidade**, o que permite:

- Consolidar as 3 unidades em um único dashboard;
- Filtrar qualquer view do AppSheet ou do Sheets para mostrar só uma unidade;
- Nunca precisar duplicar bases.

Isso já é, em grande parte, como sua planilha atual funciona — a coluna `UNIDADE`
já existe em `Cadastro de Armazém`, `Cadastro Equipamento`, `Preventiva Armazém`,
`Preventivas Equipamentos`, `Historico De Preventivas` e `Custos de Manutenção`.
O que muda é: nomes de aba/coluna padronizados, o vínculo automático
Cadastro → Preventiva, e a forma como o dashboard é calculado (troca as fórmulas
`QUERY`/`LET`/`ARRAYFORMULA` aninhadas — frágeis e difíceis de depurar — por um
motor em Apps Script que escreve valores já prontos numa aba auxiliar
`Dashboard_Data`, e o dashboard só lê essa aba com fórmulas simples).

## Abas da planilha

### 1. `Config`
Listas usadas em validação de dados (dropdowns) no AppSheet e no Sheets:
Unidade, Classificação, Tipo de Manutenção, Frequência, Status de Preventiva,
Criticidade.

### 2. `Cadastro_Equipamentos` (entrada)
| Coluna | Descrição |
|---|---|
| ID_Equipamento | gerado automaticamente (`EQ-000123`) |
| Unidade | Macatuba / Jundiaí I / Jundiaí II |
| Ativo / Patrimônio | |
| Equipamento | descrição/nome |
| Tipo | Empilhadeira, Transpaleteira, Balança, etc. |
| Frequência Preventiva | usada para já nascer a preventiva com periodicidade certa |
| Fornecedor Padrão | opcional |
| Data de Cadastro | preenchida automaticamente |

Ao salvar um novo equipamento aqui (pelo AppSheet ou direto na planilha), o
Apps Script cria automaticamente a linha correspondente na aba
**`Preventivas_Equipamentos`** (fixa).

### 3. `Cadastro_Preventiva_Armazem` (entrada)
Equivalente ao atual `Cadastro de Armazém`: Categoria, Descrição, Prestador,
Criticidade, Frequência. Ao salvar, cria automaticamente a linha em
**`Preventivas_Armazem`** (fixa).

### 4. `Preventivas_Equipamentos` (fixa / auto-alimentada)
Unidade, Equipamento, Tipo, Fornecedor, Frequência, Última Preventiva, Próxima
Preventiva (fórmula), Dias Restantes (fórmula), Status (fórmula: EM DIA / PARA
HOJE / ATRASADO), Observação, Link do orçamento. Ninguém precisa criar linha
aqui manualmente — ela nasce quando um equipamento é cadastrado.

### 5. `Preventivas_Armazem` (fixa / auto-alimentada)
Mesma lógica, para estrutura predial/armazém.

### 6. `Historico_Preventivas`
Log de toda preventiva efetivamente realizada (equipamento ou armazém):
Unidade, Data da Realização, Data Fim, Classificação, Equipamento/Estrutura,
Prestadora, Serviço Realizado, Valor, Anexo. Quando alguém preenche "Última
Preventiva" numa das abas fixas (4 ou 5), o Apps Script já cria a linha aqui
automaticamente — evita digitar a mesma informação duas vezes.

### 7. `Manutencoes_Custos`
Todo o resto (corretivas, instalações, investimentos, pontos de melhoria):
Unidade, Data Início, Data Fim, Tempo Parada (fórmula), Responsável,
Classificação (EQUIPAMENTOS/PREDIAL), Tipo, Equipamento, Descrição, Valor,
Anexo. É o mesmo papel da atual `Custos de Manutenção`.

### 8. `Dashboard_Data` (oculta, só leitura — gerada pelo script)
Tabelas já agregadas (por unidade × classificação × tipo × mês, por
equipamento, por status de preventiva, comparativo entre unidades). O
dashboard nunca calcula "na unha" — ele só lê essa aba.

### 9. `Dashboard`
Filtros (Unidade / Período / Equipamento / Classificação / Tipo / Status /
Prestador) + KPIs + gráficos, alimentados por `Dashboard_Data` com fórmulas
`SUMIFS`/`COUNTIFS` simples — sem `QUERY` string concatenado, sem `LET`
aninhado. Isso é o que estava causando fragilidade na planilha atual.

## Por que separar `Historico_Preventivas` de `Manutencoes_Custos`?

Preventiva é recorrente e está ligada a um "próximo vencimento" (por isso
precisa alimentar a aba 4/5). Corretiva, instalação e investimento não têm
recorrência — só entram como custo/ocorrência. Manter os dois fluxos
separados evita que o cálculo de "próxima preventiva" tenha que filtrar
dentro de uma tabela genérica de manutenção. O Dashboard consolida as duas
fontes automaticamente.

## Fluxo de automação (Apps Script)

```
Cadastro_Equipamentos (nova linha)         Cadastro_Preventiva_Armazem (nova linha)
        │                                              │
        ▼                                              ▼
Preventivas_Equipamentos (linha criada)     Preventivas_Armazem (linha criada)
        │  (usuário preenche "Última Preventiva")       │
        ▼                                              ▼
        Historico_Preventivas (linha criada automaticamente)
                              │
                              ▼
                    refreshDashboardData()  →  Dashboard_Data  →  Dashboard
```

`refreshDashboardData()` roda: (a) sob demanda pelo menu **Gestão de
Manutenção → Atualizar Dashboard**, e (b) automaticamente 1x/dia (gatilho por
tempo).

## Como os KPIs do Dashboard são filtrados (colunas MatchBase / MatchAll)

Os filtros do Dashboard (Unidade/Ano/Mês/Classificação/Tipo) não fazem os
KPIs somarem a coluna inteira de `Dashboard_Data` com uma fórmula tipo
`SUMIFS(..., IF(filtro="Todas", coluna_inteira, filtro))`. Esse truque até
funciona em alguns casos no Google Sheets, mas não é confiável — e quebra
completamente se um dia vocês abrirem/exportarem isso como `.xlsx` (Excel e
LibreOffice fazem "interseção implícita" e avaliam só um valor, não a coluna
toda). Em vez disso, `Dashboard_Data` tem duas colunas auxiliares que são a
própria fórmula, linha a linha:

- **MatchBase** (coluna K): 1 se a linha bate com os filtros de Unidade+Ano+Mês, senão 0.
- **MatchAll** (coluna L): igual, mas também considerando Classificação+Tipo.

Os KPIs então são só `SUMIFS(Dashboard_Data!$I:$I, Dashboard_Data!$L:$L, 1)`
— muito mais simples de ler e impossível de quebrar por causa de um critério
"array". "Custo de preventivas", que precisa ignorar o filtro de Tipo (fixa
Tipo = PREVENTIVA), usa MatchBase (K) + um critério fixo de Tipo, ao invés
de MatchAll.
