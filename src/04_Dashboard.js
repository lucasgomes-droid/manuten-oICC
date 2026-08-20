/**
 * 04_Dashboard.js
 * Motor do dashboard: refreshDashboardData() lê as abas de fato
 * (Historico_Preventivas, Manutencoes_Custos, Preventivas_Equipamentos,
 * Preventivas_Armazem) e escreve tabelas já agregadas na aba oculta
 * Dashboard_Data. buildDashboardSheet() monta a aba visual "Dashboard"
 * (filtros + KPIs + gráficos) que só LÊ Dashboard_Data com fórmulas simples
 * (SUMIFS/COUNTIFS) — nada de QUERY com string concatenada.
 *
 * Isso substitui as abas Calc_Data / Calc_Data_Consolidado / Aux_Dashboard
 * da planilha antiga, que dependiam de fórmulas LET/FILTER/HSTACK/QUERY
 * muito aninhadas e frágeis.
 */

// Blocos de colunas dentro de Dashboard_Data (todos começam na linha 1 = cabeçalho).
// Colunas K e L (11 e 12), dentro do próprio bloco DETALHE, são preenchidas à
// parte por _writeMatchFlags_ com fórmulas MatchBase / MatchAll — ver nota lá.
const DD = {
  DETALHE: { start: 1, headers: ['Unidade', 'Data', 'Ano', 'Mes', 'MesLabel', 'Classificação', 'Tipo', 'Equipamento', 'Valor', 'TempoParada'] },       // A:J (+ K:L = flags)
  RESUMO_UNIDADE: { start: 13, headers: ['Unidade', 'Preventivas', 'Atrasadas', 'Manutenções', 'HorasParadas', 'CustoTotal'] },                       // M:R
  STATUS_PREV: { start: 21, headers: ['Unidade', 'EmDia', 'ParaHoje', 'Atrasado', 'Pendente', 'Total', 'PercEmDia', 'PercAtrasado'] },                 // U:AB
  TOP_EQUIP: { start: 31, headers: ['Equipamento', 'Unidade', 'QtdManutencoes', 'TempoParadoTotal', 'CustoTotal'] },                                   // AE:AI
  EVOLUCAO: { start: 38, headers: ['Ano', 'Mes', 'MesLabel', 'Unidade', 'Qtd', 'Valor'] },                                                              // AL:AQ
  TOP_EQUIP_TEMPO: { start: 45, headers: ['Equipamento', 'Unidade', 'QtdManutencoes', 'TempoParadoTotal', 'CustoTotal'] },                              // AS:AW
  TOP_CORRETIVAS: { start: 52, headers: ['Equipamento', 'Unidade', 'QtdCorretivas'] },                                                                  // AZ:BB
  TIPO_DIST: { start: 57, headers: ['Tipo', 'Qtd'] },                                                                                                    // BE:BF
};

const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function refreshDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dd = ss.getSheetByName(SHEETS.DASH_DATA) || ss.insertSheet(SHEETS.DASH_DATA);
  dd.clear();

  const detalhe = _buildDetalhe_();
  _writeBlock_(dd, DD.DETALHE, detalhe);
  _writeMatchFlags_(dd, detalhe.length);

  const resumo = _buildResumoUnidade_(detalhe);
  _writeBlock_(dd, DD.RESUMO_UNIDADE, resumo);

  const status = _buildStatusPreventivas_();
  _writeBlock_(dd, DD.STATUS_PREV, status);

  const top = _buildTopEquipamentos_(detalhe, 'qtd');
  _writeBlock_(dd, DD.TOP_EQUIP, top);

  const topTempo = _buildTopEquipamentos_(detalhe, 'tempo');
  _writeBlock_(dd, DD.TOP_EQUIP_TEMPO, topTempo);

  const evolucao = _buildEvolucaoMensal_(detalhe);
  _writeBlock_(dd, DD.EVOLUCAO, evolucao);

  const topCorretivas = _buildTopCorretivas_(detalhe);
  _writeBlock_(dd, DD.TOP_CORRETIVAS, topCorretivas);

  const tipoDist = _buildTipoDist_(detalhe);
  _writeBlock_(dd, DD.TIPO_DIST, tipoDist);

  dd.hideSheet();
  ss.toast('Dashboard atualizado com sucesso.', 'Gestão de Manutenção');
}

function _writeBlock_(sheet, blockDef, rows) {
  const col = blockDef.start;
  sheet.getRange(1, col, 1, blockDef.headers.length).setValues([blockDef.headers]).setFontWeight('bold');
  if (rows.length > 0) {
    sheet.getRange(2, col, rows.length, blockDef.headers.length).setValues(rows);
  }
}

function _num_(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const s = String(v).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Tabela-fato: uma linha por evento de manutenção (preventiva realizada ou manutenção/corretiva/instalação lançada). */
function _buildDetalhe_() {
  const rows = [];

  const hist = getSheet_(SHEETS.HISTORICO);
  if (hist.getLastRow() > 1) {
    const data = hist.getRange(2, 1, hist.getLastRow() - 1, hist.getLastColumn()).getValues();
    const get = (r, h) => r[colIndex(SHEETS.HISTORICO, h) - 1];
    data.forEach(r => {
      const unidade = get(r, 'Unidade');
      const data_ = get(r, 'Data da Realização');
      if (!unidade || !(data_ instanceof Date)) return;
      rows.push([
        unidade, data_, data_.getFullYear(), data_.getMonth() + 1,
        _mesLabel_(data_.getMonth() + 1),
        get(r, 'Classificação') || 'EQUIPAMENTOS',
        'PREVENTIVA',
        get(r, 'Equipamento / Estrutura') || '',
        _num_(get(r, 'Valor')),
        _num_(get(r, 'Tempo Parada (h)')),
      ]);
    });
  }

  const man = getSheet_(SHEETS.MANUTENCOES);
  if (man.getLastRow() > 1) {
    const data = man.getRange(2, 1, man.getLastRow() - 1, man.getLastColumn()).getValues();
    const get = (r, h) => r[colIndex(SHEETS.MANUTENCOES, h) - 1];
    data.forEach(r => {
      const unidade = get(r, 'Unidade');
      const data_ = get(r, 'Data Início');
      if (!unidade || !(data_ instanceof Date)) return;
      rows.push([
        unidade, data_, data_.getFullYear(), data_.getMonth() + 1,
        _mesLabel_(data_.getMonth() + 1),
        get(r, 'Classificação') || '',
        get(r, 'Tipo') || 'OUTROS',
        get(r, 'Equipamento') || '',
        _num_(get(r, 'Valor')),
        _num_(get(r, 'Tempo Parada (h)')),
      ]);
    });
  }

  return rows;
}

function _mesLabel_(mes) {
  return String(mes).padStart(2, '0') + ' - ' + MESES_PT[mes - 1];
}

function _buildResumoUnidade_(detalhe) {
  const prevSheets = [SHEETS.PREV_EQUIP, SHEETS.PREV_ARMAZEM];
  return UNIDADES.map(unidade => {
    let preventivasCadastradas = 0, atrasadas = 0;
    prevSheets.forEach(sheetName => {
      const sheet = getSheet_(sheetName);
      if (sheet.getLastRow() < 2) return;
      const uCol = colIndex(sheetName, 'Unidade') - 1;
      const sCol = colIndex(sheetName, 'Status') - 1;
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      data.forEach(r => {
        if (r[uCol] !== unidade) return;
        preventivasCadastradas++;
        if (r[sCol] === 'ATRASADO') atrasadas++;
      });
    });

    const eventos = detalhe.filter(r => r[0] === unidade);
    const manutencoes = eventos.length;
    const horasParadas = eventos.reduce((s, r) => s + (r[9] || 0), 0);
    const custoTotal = eventos.reduce((s, r) => s + (r[8] || 0), 0);

    return [unidade, preventivasCadastradas, atrasadas, manutencoes, horasParadas, custoTotal];
  });
}

function _buildStatusPreventivas_() {
  const prevSheets = [SHEETS.PREV_EQUIP, SHEETS.PREV_ARMAZEM];
  const rows = UNIDADES.map(unidade => {
    const counts = { 'EM DIA': 0, 'PARA HOJE': 0, 'ATRASADO': 0, 'PENDENTE': 0 };
    prevSheets.forEach(sheetName => {
      const sheet = getSheet_(sheetName);
      if (sheet.getLastRow() < 2) return;
      const uCol = colIndex(sheetName, 'Unidade') - 1;
      const sCol = colIndex(sheetName, 'Status') - 1;
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      data.forEach(r => {
        if (r[uCol] !== unidade) return;
        if (counts[r[sCol]] !== undefined) counts[r[sCol]]++;
      });
    });
    const total = counts['EM DIA'] + counts['PARA HOJE'] + counts['ATRASADO'] + counts['PENDENTE'];
    const percEmDia = total ? counts['EM DIA'] / total : 0;
    const percAtrasado = total ? counts['ATRASADO'] / total : 0;
    return [unidade, counts['EM DIA'], counts['PARA HOJE'], counts['ATRASADO'], counts['PENDENTE'], total, percEmDia, percAtrasado];
  });

  // Linha TOTAL (consolidado das 3 unidades) — usada nos gráficos de pizza.
  const totalRow = ['TOTAL', 0, 0, 0, 0, 0, 0, 0];
  rows.forEach(r => { for (let i = 1; i <= 5; i++) totalRow[i] += r[i]; });
  totalRow[6] = totalRow[5] ? totalRow[1] / totalRow[5] : 0;
  totalRow[7] = totalRow[5] ? totalRow[3] / totalRow[5] : 0;
  rows.push(totalRow);
  return rows;
}

/** sortBy: 'qtd' (mais manutenções) ou 'tempo' (mais tempo parado). */
function _buildTopEquipamentos_(detalhe, sortBy) {
  const map = new Map();
  detalhe.forEach(r => {
    const equipamento = r[7], unidade = r[0], valor = r[8], tempo = r[9];
    if (!equipamento) return;
    const key = unidade + '||' + equipamento;
    if (!map.has(key)) map.set(key, { equipamento, unidade, qtd: 0, tempo: 0, custo: 0 });
    const e = map.get(key);
    e.qtd++; e.tempo += tempo; e.custo += valor;
  });
  return Array.from(map.values())
    .sort((a, b) => sortBy === 'tempo' ? b.tempo - a.tempo : b.qtd - a.qtd)
    .slice(0, 15)
    .map(e => [e.equipamento, e.unidade, e.qtd, e.tempo, e.custo]);
}

/**
 * Colunas K (MatchBase: Unidade+Ano+Mês) e L (MatchAll: + Classificação+Tipo)
 * do bloco Detalhe — usadas pelos KPIs do Dashboard (05_DashboardView.js) via
 * SUMIFS/COUNTIFS simples (Dashboard_Data!$L:$L, 1), em vez de um critério
 * "array" (IF(filtro="Todas", coluna_inteira, filtro)) dentro do próprio
 * SUMIFS — esse truque não é avaliado de forma confiável fora do Google
 * Sheets (Excel/LibreOffice fazem "interseção implícita" e devolvem um único
 * valor, não a coluna inteira), então evitamos ele aqui também por segurança
 * e para manter os dois lados (Apps Script e template .xlsx) idênticos.
 */
function _writeMatchFlags_(dd, n) {
  dd.getRange(1, 11, 1, 2).setValues([['MatchBase', 'MatchAll']]).setFontWeight('bold');
  if (n === 0) return;
  const kFormulas = [], lFormulas = [];
  for (let i = 0; i < n; i++) {
    const r = i + 2;
    kFormulas.push([
      `=IF(AND(OR(Dashboard!$C$4="Todas",$A${r}=Dashboard!$C$4),` +
      `OR(Dashboard!$C$5="Todos",TEXT($C${r},"0")=Dashboard!$C$5),` +
      `OR(Dashboard!$C$6="Todos",$E${r}=Dashboard!$C$6)),1,0)`
    ]);
    lFormulas.push([
      `=IF(AND($K${r}=1,` +
      `OR(Dashboard!$G$4="Todas",$F${r}=Dashboard!$G$4),` +
      `OR(Dashboard!$G$5="Todos",$G${r}=Dashboard!$G$5)),1,0)`
    ]);
  }
  dd.getRange(2, 11, n, 1).setFormulas(kFormulas);
  dd.getRange(2, 12, n, 1).setFormulas(lFormulas);
}

function _buildEvolucaoMensal_(detalhe) {
  const map = new Map();
  const bump = (ano, mes, unidade, valor) => {
    const key = ano + '|' + mes + '|' + unidade;
    if (!map.has(key)) map.set(key, { ano, mes, unidade, qtd: 0, valor: 0 });
    const e = map.get(key);
    e.qtd++; e.valor += valor;
  };
  detalhe.forEach(r => {
    const [unidade, , ano, mes, , , , , valor] = r;
    bump(ano, mes, unidade, valor);
    bump(ano, mes, 'TODAS', valor); // linha consolidada, útil para o gráfico geral
  });
  return Array.from(map.values())
    .sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes))
    .map(e => [e.ano, e.mes, _mesLabel_(e.mes), e.unidade, e.qtd, e.valor]);
}

/** Equipamentos com mais manutenções CORRETIVAS (para o gráfico "Equipamentos Recorrentes" e a KPI de recorrência). */
function _buildTopCorretivas_(detalhe) {
  const map = new Map();
  detalhe.forEach(r => {
    const unidade = r[0], tipo = r[6], equipamento = r[7];
    if (!equipamento || tipo !== 'CORRETIVA') return;
    const key = unidade + '||' + equipamento;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, qtd]) => { const [unidade, equipamento] = key.split('||'); return [equipamento, unidade, qtd]; })
    .sort((a, b) => b[2] - a[2])
    .slice(0, 15);
}

/** Quantidade de eventos por Tipo de manutenção (gráfico "Distribuição por Tipo"). */
function _buildTipoDist_(detalhe) {
  return TIPOS_MANUTENCAO.map(tipo => [tipo, detalhe.filter(r => r[6] === tipo).length]);
}
