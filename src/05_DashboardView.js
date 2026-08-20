/**
 * 05_DashboardView.js
 * Monta a aba visual "Dashboard": filtros, KPIs, tabela comparativa entre
 * unidades e gráficos — tudo lendo a aba Dashboard_Data (04_Dashboard.js).
 *
 * Rodar de novo (buildDashboardSheet) redesenha o layout do zero — é
 * seguro, porque quem guarda os dados de verdade são as outras abas, não
 * esta. Ajustar cores/posição dos gráficos manualmente depois é normal e
 * esperado (Inserir > Gráfico), o script só garante a base pronta.
 */

// Células de filtro (nomeadas para ficar fácil de achar/mudar).
const FILTER_CELLS = {
  UNIDADE: 'C4',
  ANO: 'C5',
  MES: 'C6',
  CLASSIFICACAO: 'G4',
  TIPO: 'G5',
};

function buildDashboardSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.DASHBOARD);
  if (!sheet) sheet = ss.insertSheet(SHEETS.DASHBOARD);
  else _removeExistingCharts_(sheet);
  sheet.clear();
  sheet.setHiddenGridlines(true);

  _drawHeaderAndFilters_(sheet);
  const kpiEndRow = _drawKpis_(sheet, 8);
  const comp = _drawComparativoUnidades_(sheet, kpiEndRow + 2);
  const afterCharts = _drawCharts_(sheet, comp);
  _drawTopEquipTables_(sheet, afterCharts);

  sheet.setColumnWidths(1, 10, 130);
  sheet.hideColumns(15, 2); // O:P — área auxiliar interna do gráfico de evolução mensal
  sheet.setActiveSelection('A1');
}

function _removeExistingCharts_(sheet) {
  sheet.getCharts().forEach(c => sheet.removeChart(c));
}

function _drawHeaderAndFilters_(sheet) {
  sheet.getRange('A1:J1').merge().setValue('Dashboard Geral de Manutenção')
    .setFontSize(18).setFontWeight('bold').setBackground('#1c2b39').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 36);

  sheet.getRange('A3').setValue('Filtros').setFontWeight('bold').setFontSize(11);

  const labels = [
    ['B4', 'Unidade:'], ['B5', 'Ano:'], ['B6', 'Mês:'],
    ['F4', 'Classificação:'], ['F5', 'Tipo:'],
  ];
  labels.forEach(([cell, text]) => sheet.getRange(cell).setValue(text).setFontWeight('bold').setHorizontalAlignment('right'));

  sheet.getRange(FILTER_CELLS.UNIDADE).setValue('Todas');
  sheet.getRange(FILTER_CELLS.ANO).setValue('Todos');
  sheet.getRange(FILTER_CELLS.MES).setValue('Todos');
  sheet.getRange(FILTER_CELLS.CLASSIFICACAO).setValue('Todas');
  sheet.getRange(FILTER_CELLS.TIPO).setValue('Todos');

  const anos = [];
  const anoAtual = new Date().getFullYear();
  for (let a = anoAtual - 3; a <= anoAtual + 1; a++) anos.push(String(a));
  const meses = MESES_PT.map((m, i) => _mesLabel_(i + 1));

  _listValidation_(sheet, FILTER_CELLS.UNIDADE, ['Todas', ...UNIDADES]);
  _listValidation_(sheet, FILTER_CELLS.ANO, ['Todos', ...anos]);
  _listValidation_(sheet, FILTER_CELLS.MES, ['Todos', ...meses]);
  _listValidation_(sheet, FILTER_CELLS.CLASSIFICACAO, ['Todas', ...CLASSIFICACOES]);
  _listValidation_(sheet, FILTER_CELLS.TIPO, ['Todos', ...TIPOS_MANUTENCAO]);

  [FILTER_CELLS.UNIDADE, FILTER_CELLS.ANO, FILTER_CELLS.MES, FILTER_CELLS.CLASSIFICACAO, FILTER_CELLS.TIPO]
    .forEach(cell => sheet.getRange(cell).setBackground('#eaf1f8').setFontWeight('bold'));

  sheet.getRange('A3:J6').setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
}

function _listValidation_(sheet, cell, list) {
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  sheet.getRange(cell).setDataValidation(rule);
}

// As quatro funções abaixo somam/contam usando as colunas auxiliares K
// (MatchBase) e L (MatchAll) de Dashboard_Data, escritas por _writeMatchFlags_
// (04_Dashboard.js) — não um critério "array" dentro do próprio SUMIFS.

/** Fórmula SUMIFS sobre o bloco "Detalhe" de Dashboard_Data, respeitando todos os filtros ativos. */
function _detalheSum_(sumCol) {
  return `SUMIFS(Dashboard_Data!$${sumCol}:$${sumCol}, Dashboard_Data!$L:$L, 1)`;
}

/** Igual a _detalheSum_, mas fixando também o Tipo (ex: só "PREVENTIVA"), ignorando o filtro de Tipo/Classificação. */
function _detalheSumTipo_(sumCol, tipoFixo) {
  return `SUMIFS(Dashboard_Data!$${sumCol}:$${sumCol}, Dashboard_Data!$K:$K, 1, Dashboard_Data!$G:$G, "${tipoFixo}")`;
}

function _detalheSumClassif_(sumCol, classifFixa) {
  return `SUMIFS(Dashboard_Data!$${sumCol}:$${sumCol}, Dashboard_Data!$K:$K, 1, Dashboard_Data!$F:$F, "${classifFixa}")`;
}

function _countDetalhe_() {
  return `COUNTIF(Dashboard_Data!$L:$L, 1)`;
}

function _countDetalheClassif_(classifFixa) {
  return `COUNTIFS(Dashboard_Data!$K:$K, 1, Dashboard_Data!$F:$F, "${classifFixa}")`;
}

function _statusVlookup_(colInBlock) {
  // Bloco Status_Preventivas começa na coluna U (21). colInBlock: 2=EmDia,3=ParaHoje,4=Atrasado,5=Pendente,6=Total,7=PercEmDia,8=PercAtrasado
  return `IFERROR(VLOOKUP(IF($${FILTER_CELLS.UNIDADE}="Todas","TOTAL",$${FILTER_CELLS.UNIDADE}), Dashboard_Data!$U:$AB, ${colInBlock}, FALSE), 0)`;
}

function _kpiTile_(sheet, row, col, label, formula, format) {
  const labelCell = sheet.getRange(row, col, 1, 2);
  labelCell.merge().setValue(label).setFontSize(9).setFontColor('#5f6b7a').setWrap(true).setVerticalAlignment('top');
  const valueCell = sheet.getRange(row + 1, col, 1, 2);
  valueCell.merge().setFormula('=' + formula).setFontSize(16).setFontWeight('bold');
  if (format) valueCell.setNumberFormat(format);
  sheet.getRange(row, col, 2, 2).setBorder(true, true, true, true, false, false, '#dddddd', SpreadsheetApp.BorderStyle.SOLID)
    .setBackground('#f7f9fb');
}

function _drawKpis_(sheet, startRow) {
  sheet.getRange(startRow, 1).setValue('Preventivas').setFontWeight('bold').setFontSize(12);
  let row = startRow + 1;
  const moeda = 'R$ #,##0.00';
  const pct = '0.0%';

  _kpiTile_(sheet, row, 1, 'Total de preventivas', _statusVlookup_(6), '0');
  _kpiTile_(sheet, row, 3, 'Preventivas de equipamentos',
    `IF($${FILTER_CELLS.UNIDADE}="Todas", COUNTA(Preventivas_Equipamentos!$C$2:$C), COUNTIF(Preventivas_Equipamentos!$C$2:$C,$${FILTER_CELLS.UNIDADE}))`, '0');
  _kpiTile_(sheet, row, 5, 'Preventivas prediais',
    `IF($${FILTER_CELLS.UNIDADE}="Todas", COUNTA(Preventivas_Armazem!$C$2:$C), COUNTIF(Preventivas_Armazem!$C$2:$C,$${FILTER_CELLS.UNIDADE}))`, '0');
  _kpiTile_(sheet, row, 7, 'Preventivas em dia', _statusVlookup_(2), '0');
  _kpiTile_(sheet, row, 9, '% em dia', _statusVlookup_(7), pct);
  row += 2;
  _kpiTile_(sheet, row, 1, 'Preventivas para hoje', _statusVlookup_(3), '0');
  _kpiTile_(sheet, row, 3, 'Preventivas atrasadas', _statusVlookup_(4), '0');
  _kpiTile_(sheet, row, 5, '% atrasadas', _statusVlookup_(8), pct);
  row += 2;

  sheet.getRange(row, 1).setValue('Manutenções').setFontWeight('bold').setFontSize(12);
  row += 1;
  _kpiTile_(sheet, row, 1, 'Total de manutenções', _countDetalhe_(), '0');
  _kpiTile_(sheet, row, 3, 'Manutenções prediais', _countDetalheClassif_('PREDIAL'), '0');
  _kpiTile_(sheet, row, 5, 'Manutenções de equipamentos', _countDetalheClassif_('EQUIPAMENTOS'), '0');
  row += 2;

  // Tempo parado e recorrência — sempre as 3 unidades, não muda com o filtro
  // de Unidade lá em cima (igual ao dashboard antigo).
  sheet.getRange(row, 1).setValue('Tempo Parado e Recorrência').setFontWeight('bold').setFontSize(12);
  row += 1;
  UNIDADES.forEach((unidade, i) => {
    _kpiTile_(sheet, row, 1 + i * 2, `Tempo Parado — ${unidade}`,
      `IFERROR(VLOOKUP("${unidade}",Dashboard_Data!$M:$R,5,FALSE),0)`, '0.0" h"');
  });
  _kpiTile_(sheet, row, 7, 'Tempo Parado Total', `SUM(Dashboard_Data!$Q$2:$Q$${1 + UNIDADES.length})`, '0.0" h"');
  _kpiTile_(sheet, row, 9, 'Equipamentos Recorrentes (Corretivas)', 'COUNTIF(Dashboard_Data!$BB$2:$BB$16,">1")', '0');
  row += 2;

  sheet.getRange(row, 1).setValue('Custos').setFontWeight('bold').setFontSize(12);
  row += 1;
  _kpiTile_(sheet, row, 1, 'Custo total', _detalheSum_('I'), moeda);
  _kpiTile_(sheet, row, 3, 'Custo de preventivas', _detalheSumTipo_('I', 'PREVENTIVA'), moeda);
  _kpiTile_(sheet, row, 5, 'Custo de corretivas', _detalheSumTipo_('I', 'CORRETIVA'), moeda);
  _kpiTile_(sheet, row, 7, 'Custo predial', _detalheSumClassif_('I', 'PREDIAL'), moeda);
  _kpiTile_(sheet, row, 9, 'Custo de equipamentos', _detalheSumClassif_('I', 'EQUIPAMENTOS'), moeda);
  row += 2;

  return row;
}

function _drawComparativoUnidades_(sheet, startRow) {
  sheet.getRange(startRow, 1).setValue('Comparativo entre Unidades').setFontWeight('bold').setFontSize(12);
  const headerRow = startRow + 1;
  const headers = ['Unidade', 'Preventivas', 'Atrasadas', 'Manutenções', 'Horas Paradas', 'Custo Total'];
  sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1c2b39').setFontColor('#ffffff');

  for (let i = 0; i < UNIDADES.length; i++) {
    const r = headerRow + 1 + i;
    const ddRow = 2 + i; // Dashboard_Data!M2:R4 é o bloco RESUMO_UNIDADE
    sheet.getRange(r, 1).setFormula(`=Dashboard_Data!M${ddRow}`);
    sheet.getRange(r, 2).setFormula(`=Dashboard_Data!N${ddRow}`);
    sheet.getRange(r, 3).setFormula(`=Dashboard_Data!O${ddRow}`);
    sheet.getRange(r, 4).setFormula(`=Dashboard_Data!P${ddRow}`);
    sheet.getRange(r, 5).setFormula(`=Dashboard_Data!Q${ddRow}`).setNumberFormat('0.0');
    sheet.getRange(r, 6).setFormula(`=Dashboard_Data!R${ddRow}`).setNumberFormat('R$ #,##0.00');
  }
  const totalRow = headerRow + 1 + UNIDADES.length;
  sheet.getRange(totalRow, 1).setValue('TOTAL').setFontWeight('bold');
  for (let c = 2; c <= 6; c++) {
    const colLetter = String.fromCharCode(64 + c);
    sheet.getRange(totalRow, c)
      .setFormula(`=SUM(${colLetter}${headerRow + 1}:${colLetter}${headerRow + UNIDADES.length})`)
      .setFontWeight('bold');
    if (c === 6) sheet.getRange(totalRow, c).setNumberFormat('R$ #,##0.00');
    if (c === 5) sheet.getRange(totalRow, c).setNumberFormat('0.0');
  }
  sheet.getRange(headerRow, 1, UNIDADES.length + 2, headers.length)
    .setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

  return { headerRow, dataStartRow: headerRow + 1, dataEndRow: headerRow + UNIDADES.length, totalRow };
}

function _drawCharts_(sheet, comp) {
  const titleRow = comp.totalRow + 2;
  sheet.getRange(titleRow, 1).setValue('Gráficos').setFontWeight('bold').setFontSize(12);
  const anchorRow = titleRow + 1;

  const custoPorUnidade = sheet.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange(comp.dataStartRow, 1, UNIDADES.length, 1)) // coluna Unidade
    .addRange(sheet.getRange(comp.dataStartRow, 6, UNIDADES.length, 1)) // coluna Custo Total
    .setPosition(anchorRow, 1, 0, 0)
    .setOption('title', 'Custo por Unidade')
    .setOption('width', 420).setOption('height', 260)
    .build();
  sheet.insertChart(custoPorUnidade);

  const manutPorUnidade = sheet.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange(comp.dataStartRow, 1, UNIDADES.length, 1)) // coluna Unidade
    .addRange(sheet.getRange(comp.dataStartRow, 4, UNIDADES.length, 1)) // coluna Manutenções
    .setPosition(anchorRow, 5, 0, 0)
    .setOption('title', 'Quantidade de Manutenções por Unidade')
    .setOption('width', 420).setOption('height', 260)
    .build();
  sheet.insertChart(manutPorUnidade);

  // Bloco Status_Preventivas em Dashboard_Data: header na linha 1, Macatuba/Jundiaí I/
  // Jundiaí II nas linhas 2-4, TOTAL na linha 5 (colunas U:AB — ver DD.STATUS_PREV).
  const dd = getSheet_(SHEETS.DASH_DATA);
  const totalStatusRow = 2 + UNIDADES.length; // linha TOTAL dentro do bloco
  const statusPizza = sheet.newChart().setChartType(Charts.ChartType.PIE)
    .addRange(dd.getRange(1, 22, 1, 4))               // V1:Y1 -> EmDia, ParaHoje, Atrasado, Pendente
    .addRange(dd.getRange(totalStatusRow, 22, 1, 4))  // linha TOTAL
    .setTransposeRowsAndColumns(true)
    .setPosition(anchorRow + 16, 1, 0, 0)
    .setOption('title', 'Status das Preventivas (consolidado)')
    .setOption('width', 420).setOption('height', 260)
    .build();
  sheet.insertChart(statusPizza);

  const evolucao = sheet.newChart().setChartType(Charts.ChartType.LINE)
    .addRange(_evolucaoTodasRange_(sheet))
    .setPosition(anchorRow + 16, 5, 0, 0)
    .setOption('title', 'Evolução Mensal de Custos (todas as unidades)')
    .setOption('width', 420).setOption('height', 260)
    .build();
  sheet.insertChart(evolucao);

  // Bloco Tipo_Dist (BE:BF — DD.TIPO_DIST): header linha 1, 1 linha por tipo.
  const nTipo = TIPOS_MANUTENCAO.length;
  const tipoPizza = sheet.newChart().setChartType(Charts.ChartType.PIE)
    .addRange(dd.getRange(2, 57, nTipo, 1))       // BE2:BE8 — nomes dos tipos
    .addRange(dd.getRange(1, 58, nTipo + 1, 1))   // BF1:BF8 — Qtd (com cabeçalho)
    .setPosition(anchorRow + 33, 1, 0, 0)
    .setOption('title', 'Distribuição por Tipo de Manutenção')
    .setOption('width', 420).setOption('height', 260)
    .build();
  sheet.insertChart(tipoPizza);

  // Bloco Top_Corretivas (AZ:BB — DD.TOP_CORRETIVAS), até 10 primeiras linhas.
  const recorrentesBar = sheet.newChart().setChartType(Charts.ChartType.BAR)
    .addRange(dd.getRange(2, 52, 10, 1))          // AZ2:AZ11 — equipamento
    .addRange(dd.getRange(1, 54, 11, 1))          // BB1:BB11 — QtdCorretivas (com cabeçalho)
    .setPosition(anchorRow + 33, 5, 0, 0)
    .setOption('title', 'Equipamentos Recorrentes (Corretivas)')
    .setOption('width', 420).setOption('height', 260)
    .build();
  sheet.insertChart(recorrentesBar);

  // Bloco Top_Equip_Tempo (AS:AW — DD.TOP_EQUIP_TEMPO), até 10 primeiras linhas.
  const tempoBar = sheet.newChart().setChartType(Charts.ChartType.BAR)
    .addRange(dd.getRange(2, 45, 10, 1))          // AS2:AS11 — equipamento
    .addRange(dd.getRange(1, 48, 11, 1))          // AV1:AV11 — TempoParadoTotal (com cabeçalho)
    .setPosition(anchorRow + 50, 1, 0, 0)
    .setOption('title', 'Tempo Parado por Equipamento (Top 10)')
    .setOption('width', 420).setOption('height', 260)
    .build();
  sheet.insertChart(tempoBar);

  return anchorRow + 67; // linha livre logo abaixo de todos os gráficos, com folga
}

/** Duas tabelas lado a lado: equipamentos com mais manutenções e com mais tempo parado. */
function _drawTopEquipTables_(sheet, startRow) {
  sheet.getRange(startRow, 1).setValue('Top 10 Equipamentos').setFontWeight('bold').setFontSize(12);
  const tableRow = startRow + 1;
  _topEquipTable_(sheet, tableRow, 1, 'Mais manutenções', DD.TOP_EQUIP.start);
  _topEquipTable_(sheet, tableRow, 7, 'Maior tempo parado', DD.TOP_EQUIP_TEMPO.start);
}

function _topEquipTable_(sheet, row, col, title, ddStartCol) {
  sheet.getRange(row, col).setValue(title).setFontStyle('italic').setFontWeight('bold').setFontSize(10);
  const headerRow = row + 1;
  const headers = ['Equipamento', 'Unidade', 'Qtd. Manut.', 'Tempo Parado (h)', 'Custo Total'];
  sheet.getRange(headerRow, col, 1, 5).setValues([headers]).setFontWeight('bold').setBackground('#1c2b39').setFontColor('#ffffff');

  const dd = getSheet_(SHEETS.DASH_DATA);
  for (let i = 0; i < 10; i++) {
    const r = headerRow + 1 + i;
    const ddRow = 2 + i;
    for (let j = 0; j < 5; j++) {
      const ddCol = ddStartCol + j;
      const cell = sheet.getRange(r, col + j);
      cell.setFormula(`=IFERROR(INDEX(Dashboard_Data!${_a1_(ddCol)}:${_a1_(ddCol)},${ddRow}),"")`);
      if (j === 3) cell.setNumberFormat('0.0');
      if (j === 4) cell.setNumberFormat('R$ #,##0.00');
    }
  }
  sheet.getRange(headerRow, col, 11, 5).setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * Monta, numa área auxiliar do próprio Dashboard (colunas O:P, fora da área
 * visível dos KPIs), só as linhas de Evolução Mensal com Unidade = "TODAS"
 * — é o que o gráfico de linha precisa (uma linha por mês, não por unidade).
 */
function _evolucaoTodasRange_(sheet) {
  const outCol = 15; // coluna O
  sheet.getRange(1, outCol, 1, 2).setValues([['Mês', 'Custo Total']]);
  sheet.getRange(2, outCol, 300, 2).clearContent();
  sheet.getRange(2, outCol).setFormula(
    `=IFERROR(SORT(FILTER({Dashboard_Data!AN2:AN1000, Dashboard_Data!AQ2:AQ1000}, Dashboard_Data!AO2:AO1000="TODAS")),"")`
  );
  return sheet.getRange(1, outCol, 200, 2);
}
