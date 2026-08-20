/**
 * 02_Cadastro.js
 * Vínculo automático: uma linha nova em Cadastro_Equipamentos ou
 * Cadastro_Preventiva_Armazem cria (uma única vez) a linha correspondente
 * nas abas fixas Preventivas_Equipamentos / Preventivas_Armazem.
 *
 * Isso é acionado por um gatilho onEdit instalável (ver 05_Triggers.js),
 * mas também pode ser rodado manualmente a qualquer momento pelo menu
 * ("Sincronizar cadastros pendentes") — útil para pegar linhas coladas
 * (paste) em bloco, que o onEdit simples às vezes não captura por completo.
 */

function handleEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const name = sheet.getName();
  const row = e.range.getRow();
  if (row === 1) return; // cabeçalho

  try {
    if (name === SHEETS.CADASTRO_EQUIP) {
      syncEquipamentoToPreventiva_(row);
    } else if (name === SHEETS.CADASTRO_ARMAZEM) {
      syncArmazemToPreventiva_(row);
    } else if (name === SHEETS.PREV_EQUIP || name === SHEETS.PREV_ARMAZEM) {
      const col = e.range.getColumn();
      const ultimaCol = colIndex(name, 'Última Preventiva');
      if (col === ultimaCol) {
        onUltimaPreventivaEditada_(name, row);
      }
    } else if (name === SHEETS.MANUTENCOES) {
      recalcTempoParada_(SHEETS.MANUTENCOES, row);
    } else if (name === SHEETS.HISTORICO || name === SHEETS.MANUTENCOES) {
      // qualquer edição nessas abas deixa o dashboard "sujo"; ele é
      // recalculado 1x/dia e sob demanda (não a cada tecla, para não
      // deixar a planilha lenta).
    }
  } catch (err) {
    console.error('handleEdit: ' + err);
  }
}

function syncAllPendingCadastros() {
  const eqSheet = getSheet_(SHEETS.CADASTRO_EQUIP);
  for (let r = 2; r <= eqSheet.getLastRow(); r++) syncEquipamentoToPreventiva_(r);

  const armSheet = getSheet_(SHEETS.CADASTRO_ARMAZEM);
  for (let r = 2; r <= armSheet.getLastRow(); r++) syncArmazemToPreventiva_(r);

  SpreadsheetApp.getActiveSpreadsheet().toast('Sincronização concluída.', 'Gestão de Manutenção');
}

function syncEquipamentoToPreventiva_(row) {
  const cadSheet = getSheet_(SHEETS.CADASTRO_EQUIP);
  const idCol = colIndex(SHEETS.CADASTRO_EQUIP, 'ID_Equipamento');
  const unidadeCol = colIndex(SHEETS.CADASTRO_EQUIP, 'Unidade');
  const equipCol = colIndex(SHEETS.CADASTRO_EQUIP, 'Equipamento');
  const tipoCol = colIndex(SHEETS.CADASTRO_EQUIP, 'Tipo');
  const freqCol = colIndex(SHEETS.CADASTRO_EQUIP, 'Frequência Preventiva');
  const fornCol = colIndex(SHEETS.CADASTRO_EQUIP, 'Fornecedor Padrão');
  const dataCol = colIndex(SHEETS.CADASTRO_EQUIP, 'Data de Cadastro');

  const values = cadSheet.getRange(row, 1, 1, cadSheet.getLastColumn()).getValues()[0];
  const unidade = values[unidadeCol - 1];
  const equipamento = values[equipCol - 1];
  if (!unidade || !equipamento) return; // linha ainda incompleta

  let id = values[idCol - 1];
  if (!id) {
    id = nextId_('EQ');
    cadSheet.getRange(row, idCol).setValue(id);
  }
  if (!values[dataCol - 1]) {
    cadSheet.getRange(row, dataCol).setValue(new Date());
  }

  if (_alreadyLinked_(SHEETS.PREV_EQUIP, 'ID_Equipamento', id)) return;

  const prevSheet = getSheet_(SHEETS.PREV_EQUIP);
  const newRow = prevSheet.getLastRow() + 1;
  const rowData = {
    'ID_Preventiva': nextId_('PE'),
    'ID_Equipamento': id,
    'Unidade': unidade,
    'Equipamento': equipamento,
    'Tipo': values[tipoCol - 1] || '',
    'Fornecedor': values[fornCol - 1] || '',
    'Frequência': values[freqCol - 1] || 'Anual',
    'Última Preventiva': '',
    'Status': 'PENDENTE',
  };
  _writeRowByHeader_(SHEETS.PREV_EQUIP, newRow, rowData);
  _writeStatusFormulas_(SHEETS.PREV_EQUIP, newRow);
}

function syncArmazemToPreventiva_(row) {
  const cadSheet = getSheet_(SHEETS.CADASTRO_ARMAZEM);
  const idCol = colIndex(SHEETS.CADASTRO_ARMAZEM, 'ID_Estrutura');
  const unidadeCol = colIndex(SHEETS.CADASTRO_ARMAZEM, 'Unidade');
  const catCol = colIndex(SHEETS.CADASTRO_ARMAZEM, 'Categoria');
  const descCol = colIndex(SHEETS.CADASTRO_ARMAZEM, 'Descrição');
  const prestCol = colIndex(SHEETS.CADASTRO_ARMAZEM, 'Prestador');
  const freqCol = colIndex(SHEETS.CADASTRO_ARMAZEM, 'Frequência');
  const dataCol = colIndex(SHEETS.CADASTRO_ARMAZEM, 'Data de Cadastro');

  const values = cadSheet.getRange(row, 1, 1, cadSheet.getLastColumn()).getValues()[0];
  const unidade = values[unidadeCol - 1];
  const descricao = values[descCol - 1] || values[catCol - 1];
  if (!unidade || !descricao) return;

  let id = values[idCol - 1];
  if (!id) {
    id = nextId_('AR');
    cadSheet.getRange(row, idCol).setValue(id);
  }
  if (!values[dataCol - 1]) {
    cadSheet.getRange(row, dataCol).setValue(new Date());
  }

  if (_alreadyLinked_(SHEETS.PREV_ARMAZEM, 'ID_Estrutura', id)) return;

  const prevSheet = getSheet_(SHEETS.PREV_ARMAZEM);
  const newRow = prevSheet.getLastRow() + 1;
  const rowData = {
    'ID_Preventiva': nextId_('PA'),
    'ID_Estrutura': id,
    'Unidade': unidade,
    'Equipamento / Estrutura': descricao,
    'Frequência': values[freqCol - 1] || 'Anual',
    'Responsável': values[prestCol - 1] || '',
    'Última Preventiva': '',
    'Status': 'PENDENTE',
  };
  _writeRowByHeader_(SHEETS.PREV_ARMAZEM, newRow, rowData);
  _writeStatusFormulas_(SHEETS.PREV_ARMAZEM, newRow);
}

/** Verifica se já existe uma linha em `sheetName` com ID em `idHeader` = idValue. */
function _alreadyLinked_(sheetName, idHeader, idValue) {
  const sheet = getSheet_(sheetName);
  if (sheet.getLastRow() < 2) return false;
  const col = colIndex(sheetName, idHeader);
  const values = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues().flat();
  return values.includes(idValue);
}

/** Escreve um objeto {NomeDaColuna: valor} numa linha, resolvendo os índices pelo cabeçalho. */
function _writeRowByHeader_(sheetName, row, rowData) {
  const sheet = getSheet_(sheetName);
  Object.keys(rowData).forEach(header => {
    const col = colIndex(sheetName, header);
    sheet.getRange(row, col).setValue(rowData[header]);
  });
}

/**
 * Escreve as fórmulas de Dias Restantes / Próxima Preventiva / Status numa
 * linha das abas fixas. São fórmulas simples de planilha (não dependem do
 * Apps Script para recalcular) — ficam vivas mesmo se o script for removido.
 */
function _writeStatusFormulas_(sheetName, row) {
  const ultimaCol = colIndex(sheetName, 'Última Preventiva');
  const freqCol = colIndex(sheetName, 'Frequência');
  const proximaCol = colIndex(sheetName, 'Próxima Preventiva');
  const diasCol = colIndex(sheetName, 'Dias Restantes');
  const statusCol = colIndex(sheetName, 'Status');

  const ultima = _a1_(ultimaCol) + row;
  const freq = _a1_(freqCol) + row;
  const proxima = _a1_(proximaCol) + row;
  const dias = _a1_(diasCol) + row;

  const sheet = getSheet_(sheetName);
  sheet.getRange(row, proximaCol).setFormula(
    `=IF(${ultima}="","",${ultima}+IFERROR(VLOOKUP(${freq},Config!$H:$I,2,FALSE),365))`
  );
  sheet.getRange(row, diasCol).setFormula(
    `=IF(${proxima}="","",${proxima}-TODAY())`
  );
  sheet.getRange(row, statusCol).setFormula(
    `=IF(${ultima}="","PENDENTE",IF(${dias}<0,"ATRASADO",IF(${dias}<=7,"PARA HOJE","EM DIA")))`
  );
  sheet.getRange(row, proximaCol, 1, 1).setNumberFormat('dd/mm/yyyy');
}

function _a1_(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - m) / 26);
  }
  return s;
}

function recalcTempoParada_(sheetName, row) {
  _writeTempoParadaFormula_(sheetName, row, 'Data Início', 'Data Fim');
}

/**
 * Escreve a fórmula "(Fim - Início) * 24" (horas) na coluna Tempo Parada
 * (h), a partir de duas colunas de data/hora quaisquer — genérico porque
 * Manutencoes_Custos usa "Data Início"/"Data Fim" mas Historico_Preventivas
 * usa "Data da Realização"/"Data Fim" para o mesmo cálculo.
 */
function _writeTempoParadaFormula_(sheetName, row, inicioHeader, fimHeader) {
  const inicioCol = colIndex(sheetName, inicioHeader);
  const fimCol = colIndex(sheetName, fimHeader);
  const tempoCol = colIndex(sheetName, 'Tempo Parada (h)');
  const inicio = _a1_(inicioCol) + row;
  const fim = _a1_(fimCol) + row;
  const sheet = getSheet_(sheetName);
  sheet.getRange(row, tempoCol).setFormula(
    `=IFERROR(IF(OR(${inicio}="",${fim}=""),"",(${fim}-${inicio})*24),"")`
  );
}
