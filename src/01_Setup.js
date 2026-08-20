/**
 * 01_Setup.js
 * Menu do app + criação/organização das abas. Rodar setupSpreadsheet() uma
 * vez é seguro mesmo em uma planilha que já tem dados: ele só CRIA o que
 * está faltando (nunca apaga aba ou linha existente).
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔧 Gestão de Manutenção')
    .addItem('1) Configurar planilha (criar abas/validações)', 'setupSpreadsheet')
    .addItem('2) Instalar automações (gatilhos)', 'installTriggers')
    .addSeparator()
    .addItem('Atualizar Dashboard agora', 'refreshDashboardData')
    .addItem('Sincronizar cadastros pendentes', 'syncAllPendingCadastros')
    .addToUi();
}

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  _ensureSheetWithHeaders(ss, SHEETS.CADASTRO_EQUIP, COLS.CADASTRO_EQUIP);
  _ensureSheetWithHeaders(ss, SHEETS.CADASTRO_ARMAZEM, COLS.CADASTRO_ARMAZEM);
  _ensureSheetWithHeaders(ss, SHEETS.PREV_EQUIP, COLS.PREV_EQUIP);
  _ensureSheetWithHeaders(ss, SHEETS.PREV_ARMAZEM, COLS.PREV_ARMAZEM);
  _ensureSheetWithHeaders(ss, SHEETS.HISTORICO, COLS.HISTORICO);
  _ensureSheetWithHeaders(ss, SHEETS.MANUTENCOES, COLS.MANUTENCOES);

  _setupConfigSheet(ss);
  clearHeaderCache();

  _applyValidations();
  _applyConditionalFormatting();
  _ensureDashboardDataSheet(ss);
  buildDashboardSheet();

  SpreadsheetApp.getUi().alert(
    'Planilha configurada!\n\nPróximo passo: menu "Gestão de Manutenção" → ' +
    '"Instalar automações (gatilhos)" para ligar o vínculo automático ' +
    'Cadastro → Preventivas e a atualização diária do dashboard.'
  );
}

function _ensureSheetWithHeaders(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  const isNew = !sheet;
  if (isNew) sheet = ss.insertSheet(name);

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const hasHeaders = existingHeaders.some(h => h !== '');
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1c2b39')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function _setupConfigSheet(ss) {
  let sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) sheet = ss.insertSheet(SHEETS.CONFIG);

  const columns = [
    ['Unidades', ...UNIDADES],
    ['Classificação', ...CLASSIFICACOES],
    ['Tipo de Manutenção', ...TIPOS_MANUTENCAO],
    ['Frequência', ...FREQUENCIAS],
    ['Status Preventiva', ...STATUS_PREVENTIVA],
    ['Criticidade', ...CRITICIDADES],
  ];

  sheet.clear();
  columns.forEach((col, i) => {
    sheet.getRange(1, i + 1, col.length, 1).setValues(col.map(v => [v]));
    sheet.getRange(1, i + 1).setFontWeight('bold').setBackground('#1c2b39').setFontColor('#ffffff');
  });

  // Tabela auxiliar Frequência -> Dias, usada em VLOOKUP pelas fórmulas de
  // "Próxima Preventiva" nas abas fixas. Fica nas colunas H:I.
  const freqTable = [['Frequência', 'Dias'], ...FREQUENCIAS.map(f => [f, FREQUENCIA_DIAS[f]])];
  sheet.getRange(1, 8, freqTable.length, 2).setValues(freqTable);
  sheet.getRange(1, 8, 1, 2).setFontWeight('bold').setBackground('#1c2b39').setFontColor('#ffffff');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, columns.length + 2);
}

function _rangeName(colLetter) {
  return SHEETS.CONFIG + '!$' + colLetter + '$2:$' + colLetter + '$50';
}

function _applyValidations() {
  const unidadeRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getRange(_rangeName('A')), true)
    .setAllowInvalid(false)
    .build();
  const classifRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getRange(_rangeName('B')), true)
    .setAllowInvalid(false)
    .build();
  const tipoRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getRange(_rangeName('C')), true)
    .setAllowInvalid(false)
    .build();
  const freqRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getRange(_rangeName('D')), true)
    .setAllowInvalid(false)
    .build();
  const critRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getRange(_rangeName('F')), true)
    .setAllowInvalid(false)
    .build();

  _setValidation(SHEETS.CADASTRO_EQUIP, 'Unidade', unidadeRule);
  _setValidation(SHEETS.CADASTRO_EQUIP, 'Frequência Preventiva', freqRule);
  _setValidation(SHEETS.CADASTRO_ARMAZEM, 'Unidade', unidadeRule);
  _setValidation(SHEETS.CADASTRO_ARMAZEM, 'Frequência', freqRule);
  _setValidation(SHEETS.CADASTRO_ARMAZEM, 'Criticidade', critRule);
  _setValidation(SHEETS.PREV_EQUIP, 'Frequência', freqRule);
  _setValidation(SHEETS.PREV_ARMAZEM, 'Frequência', freqRule);
  _setValidation(SHEETS.HISTORICO, 'Unidade', unidadeRule);
  _setValidation(SHEETS.HISTORICO, 'Classificação', classifRule);
  _setValidation(SHEETS.MANUTENCOES, 'Unidade', unidadeRule);
  _setValidation(SHEETS.MANUTENCOES, 'Classificação', classifRule);
  _setValidation(SHEETS.MANUTENCOES, 'Tipo', tipoRule);
}

function _setValidation(sheetName, headerName, rule) {
  const sheet = getSheet_(sheetName);
  const col = colIndex(sheetName, headerName);
  sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 999), 1).setDataValidation(rule);
}

function _applyConditionalFormatting() {
  [SHEETS.PREV_EQUIP, SHEETS.PREV_ARMAZEM].forEach(sheetName => {
    const sheet = getSheet_(sheetName);
    const col = colIndex(sheetName, 'Status');
    const range = sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 999), 1);
    const rules = [
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('ATRASADO').setBackground('#f4c7c3').setFontColor('#a50e0e')
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('PARA HOJE').setBackground('#fce8b2').setFontColor('#7f6000')
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('EM DIA').setBackground('#b7e1cd').setFontColor('#274e13')
        .setRanges([range]).build(),
    ];
    sheet.setConditionalFormatRules(rules);
  });
}

function _ensureDashboardDataSheet(ss) {
  let sheet = ss.getSheetByName(SHEETS.DASH_DATA);
  if (!sheet) sheet = ss.insertSheet(SHEETS.DASH_DATA);
  sheet.hideSheet();
  return sheet;
}
