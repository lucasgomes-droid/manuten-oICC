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
  _ensureSheetWithHeaders(ss, SHEETS.ORCAMENTO, COLS.ORCAMENTO);
  _seedOrcamento(ss);
  _ensureSheetWithHeaders(ss, SHEETS.USUARIOS, COLS.USUARIOS);
  _seedUsuarios(ss);

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
  } else {
    // Aba já existia (de uma versão anterior) — só adiciona no fim as
    // colunas novas que ainda não existem, sem tocar em nada que já tinha.
    _ensureColumns_(sheet, headers);
  }
  const totalCols = sheet.getLastColumn();
  sheet.getRange(1, 1, 1, totalCols)
    .setFontWeight('bold')
    .setBackground('#1c2b39')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, totalCols);
  return sheet;
}

/**
 * Adiciona, no fim da linha 1, qualquer cabeçalho de `headers` que ainda não
 * exista na aba — usado para atualizar abas já criadas em versões antigas
 * sem apagar ou reordenar nada que já existe (ex: nova coluna "Registrado
 * Por" adicionada na Fase 3).
 */
function _ensureColumns_(sheet, headers) {
  const lastCol = sheet.getLastColumn();
  const existing = (lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [])
    .map(h => String(h).trim());
  headers.forEach(h => {
    if (existing.indexOf(h) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
      existing.push(h);
    }
  });
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
    ['Classificação Orçamento', ...CLASSIFICACOES_ORCAMENTO],
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

  // Lista de unidades válidas pra coluna "Unidade" da aba Usuarios (inclui
  // "geral", pra quem pode entrar em qualquer unidade). Fica na coluna J.
  const unidadeUsuarioCol = ['Unidade do Usuário', 'geral', ...UNIDADES];
  sheet.getRange(1, 10, unidadeUsuarioCol.length, 1).setValues(unidadeUsuarioCol.map(v => [v]));
  sheet.getRange(1, 10).setFontWeight('bold').setBackground('#1c2b39').setFontColor('#ffffff');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, columns.length + 3);
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
  const classifOrcamentoRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getRange(_rangeName('G')), true)
    .setAllowInvalid(false)
    .build();
  const unidadeUsuarioRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getRange(_rangeName('J')), true)
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
  _setValidation(SHEETS.ORCAMENTO, 'Unidade', unidadeRule);
  _setValidation(SHEETS.ORCAMENTO, 'Classificação', classifOrcamentoRule);
  _setValidation(SHEETS.USUARIOS, 'Unidade', unidadeUsuarioRule);
}

/**
 * Preenche a aba Orcamento com os valores que o Lucas mandou por print (ano
 * corrente) — só na primeira vez (se a aba já tiver alguma linha, não mexe,
 * pra nunca sobrescrever um valor que ele já tenha ajustado na mão).
 * Jundiaí II ainda não tem o budget separado por Equipamentos/Predial, por
 * isso entra como uma linha só "GERAL" — pode ser dividida depois bastando
 * adicionar duas linhas (EQUIPAMENTOS/PREDIAL) e apagar a GERAL.
 */
function _seedOrcamento(ss) {
  const sheet = getSheet_(SHEETS.ORCAMENTO);
  if (sheet.getLastRow() > 1) return; // já tem dados — não sobrescreve

  const ano = new Date().getFullYear();
  const linhas = [
    ['Macatuba', 'EQUIPAMENTOS', ano, 150000],
    ['Macatuba', 'PREDIAL', ano, 72000],
    ['Jundiaí I', 'EQUIPAMENTOS', ano, 120000],
    ['Jundiaí I', 'PREDIAL', ano, 77000],
    ['Jundiaí II', 'GERAL', ano, 100000],
  ];
  sheet.getRange(2, 1, linhas.length, 4).setValues(linhas);
}

/**
 * Preenche a aba Usuarios com a lista inicial (USUARIOS_SEED) — só na
 * primeira vez (se já tiver alguma linha, não mexe, pra nunca sobrescrever
 * uma edição manual sua). Depois de criada, essa aba é a fonte da lista de
 * nomes do login — edite direto nela pra adicionar, remover ou renomear
 * alguém, sem precisar mexer em código.
 */
function _seedUsuarios(ss) {
  const sheet = getSheet_(SHEETS.USUARIOS);
  if (sheet.getLastRow() > 1) return; // já tem dados — não sobrescreve
  const linhas = USUARIOS_SEED.map(u => [u.nome, u.unidade]);
  sheet.getRange(2, 1, linhas.length, 2).setValues(linhas);
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
