/**
 * 03_Historico.js
 * Quando alguém marca que uma preventiva foi realizada (preenche "Última
 * Preventiva" em Preventivas_Equipamentos ou Preventivas_Armazem), este
 * arquivo cria automaticamente o registro correspondente em
 * Historico_Preventivas — sem precisar digitar tudo de novo.
 */

function onUltimaPreventivaEditada_(sheetName, row) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  const get = (header) => values[colIndex(sheetName, header) - 1];

  const unidade = get('Unidade');
  const dataRealizacao = get('Última Preventiva');
  if (!unidade || !dataRealizacao) return;

  const isEquip = sheetName === SHEETS.PREV_EQUIP;
  const equipamento = isEquip ? get('Equipamento') : get('Equipamento / Estrutura');
  const prestadora = isEquip ? get('Fornecedor') : get('Responsável');
  const classificacao = isEquip ? 'EQUIPAMENTOS' : 'PREDIAL';

  logPreventivaRealizada_({
    unidade: unidade,
    dataRealizacao: dataRealizacao,
    classificacao: classificacao,
    equipamento: equipamento,
    prestadora: prestadora,
    servico: 'PREVENTIVA',
    valor: '',
    anexo: '',
  });
}

/**
 * Cria uma linha em Historico_Preventivas. Pode ser chamada tanto pela
 * automação (onUltimaPreventivaEditada_) quanto manualmente / por outro
 * script (ex: um formulário do AppSheet gravando direto nesta função via
 * uma Web App, se um dia vocês quiserem evoluir para isso).
 */
function logPreventivaRealizada_(data) {
  const sheet = getSheet_(SHEETS.HISTORICO);
  const row = sheet.getLastRow() + 1;
  _writeRowByHeader_(SHEETS.HISTORICO, row, {
    'ID_Historico': nextId_('HI'),
    'Unidade': data.unidade,
    'Data da Realização': data.dataRealizacao,
    'Data Fim': data.dataFim || '',
    'Classificação': data.classificacao,
    'Equipamento / Estrutura': data.equipamento,
    'Prestadora': data.prestadora || '',
    'Serviço Realizado': data.servico || 'PREVENTIVA',
    'Valor': data.valor || '',
    'Documento / Anexo': data.anexo || '',
  });
  // Se veio Data Fim (preventiva de equipamento, com início/fim capturados
  // no app), calcula o tempo parado automaticamente — fica em branco (fórmula
  // não erra) quando só a data única antiga é usada, como nas edições manuais
  // direto na planilha.
  _writeTempoParadaFormula_(SHEETS.HISTORICO, row, 'Data da Realização', 'Data Fim');
}
