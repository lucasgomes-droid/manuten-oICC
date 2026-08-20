/**
 * 07_WebApp.js
 * API (Web App) que expõe esta planilha como backend JSON para o app novo
 * (PWA independente). O app novo NUNCA acessa a planilha diretamente — ele
 * só fala com doGet/doPost aqui. Isso mantém a planilha como fonte única
 * de verdade e permite trocar o frontend no futuro sem mexer nos dados.
 *
 * DEPLOY (resumo — ver docs/DEPLOY_WEBAPP.md para o passo a passo com telas):
 *   Extensões → Apps Script → Implantar → Nova implantação → tipo "App da Web"
 *   Executar como: Eu (você)
 *   Quem pode acessar: Qualquer pessoa
 *   Copie a URL "…/exec" gerada e cole em docs/app/js/config.js (API_BASE_URL).
 *
 * SEGURANÇA (opcional): se você definir uma Propriedade do Script chamada
 * API_TOKEN (menu 🔧 Gestão de Manutenção → Configurar token da API, ou
 * manualmente em Configurações do projeto → Propriedades do script), todo
 * request (GET ?token=... ou POST {..., token:"..."}) precisa enviar esse
 * mesmo valor, senão é rejeitado com 401. Sem token configurado, a API fica
 * aberta para qualquer um com o link — ok para testar, recomendo configurar
 * antes de divulgar o app pra equipe.
 *
 * STATUS DE PREVENTIVA NA API (4 estados, diferente da coluna "Status" da
 * planilha): a coluna "Status" da aba (EM DIA/PARA HOJE/ATRASADO/PENDENTE)
 * continua exatamente como está — é o motor do Dashboard Geral e não foi
 * tocado. Para o app novo, que pede 4 estados visuais (🟢 Em dia / 🟡
 * Próxima / 🟠 Para hoje / 🔴 Atrasada), a API calcula esse status à parte
 * (função _statusPreventiva_), lendo direto "Dias Restantes" com um corte
 * extra em 30 dias para "Próxima". Isso evita mexer nas fórmulas e nos
 * blocos do Dashboard_Data (que têm larguras fixas usadas pelos gráficos).
 */

// ---------------------------------------------------------------------
// Entradas HTTP
// ---------------------------------------------------------------------

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    _checkToken_(params.token);
    const action = params.action || '';

    switch (action) {
      case 'ping':
        return _json_({ ok: true, mensagem: 'API Gestão de Manutenção no ar.', agora: new Date().toISOString() });
      case 'config':
        return _json_({ ok: true, data: _configLists_() });
      case 'unidades':
        return _json_({ ok: true, data: UNIDADES });
      case 'equipamentos':
        return _json_({ ok: true, data: _listEquipamentos_(params.unidade) });
      case 'estruturas':
        return _json_({ ok: true, data: _listEstruturas_(params.unidade) });
      case 'preventivasEquipamentos':
        return _json_({ ok: true, data: _listPreventivasEquipamentos_(params.unidade) });
      case 'preventivasArmazem':
        return _json_({ ok: true, data: _listPreventivasArmazem_(params.unidade) });
      case 'dashboard':
        return _json_({ ok: true, data: _dashboardCards_(params.unidade) });
      default:
        return _json_({ ok: false, erro: 'Ação desconhecida: "' + action + '".' }, 400);
    }
  } catch (err) {
    return _json_({ ok: false, erro: String(err && err.message || err) }, 500);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return _json_({ ok: false, erro: 'Sistema ocupado, tente novamente em alguns segundos.' }, 429);
  }

  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    let body;
    try {
      body = JSON.parse(raw);
    } catch (parseErr) {
      return _json_({ ok: false, erro: 'Corpo da requisição não é um JSON válido.' }, 400);
    }
    _checkToken_(body.token);
    const action = body.action || '';
    const payload = body.payload || {};

    switch (action) {
      case 'criarEquipamento':
        return _json_({ ok: true, data: _criarEquipamento_(payload) });
      case 'criarEstrutura':
        return _json_({ ok: true, data: _criarEstrutura_(payload) });
      case 'marcarPreventivaRealizada':
        return _json_({ ok: true, data: _marcarPreventivaRealizada_(payload) });
      default:
        return _json_({ ok: false, erro: 'Ação desconhecida: "' + action + '".' }, 400);
    }
  } catch (err) {
    return _json_({ ok: false, erro: String(err && err.message || err) }, 500);
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------
// Autenticação leve (opcional)
// ---------------------------------------------------------------------

function _checkToken_(tokenFromRequest) {
  const configured = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!configured) return; // API aberta — nenhum token configurado
  if (tokenFromRequest !== configured) {
    throw new Error('Token inválido ou ausente.');
  }
}

/** Menu: define/atualiza o API_TOKEN pedindo o valor por um prompt. */
function configurarApiToken() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    'Token da API',
    'Digite um token (senha) para proteger a API do app novo. Deixe em branco e confirme para REMOVER a proteção (API fica aberta).',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const value = resp.getResponseText().trim();
  const props = PropertiesService.getScriptProperties();
  if (!value) {
    props.deleteProperty('API_TOKEN');
    ui.alert('Token removido. A API está aberta (qualquer um com o link consegue usar).');
  } else {
    props.setProperty('API_TOKEN', value);
    ui.alert('Token salvo. Cole esse mesmo valor em docs/app/js/config.js (API_TOKEN) no app.');
  }
}

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------

function _configLists_() {
  return {
    unidades: UNIDADES,
    classificacoes: CLASSIFICACOES,
    tiposManutencao: TIPOS_MANUTENCAO,
    criticidades: CRITICIDADES,
    frequencias: FREQUENCIAS,
  };
}

/** Lê uma aba inteira e devolve um array de objetos {Cabecalho: valor}, usando os nomes de coluna reais da aba (linha 1). */
function _rowsAsObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const out = [];
  values.forEach((row, i) => {
    const obj = { _linha: i + 2 };
    headers.forEach((h, c) => {
      if (!h) return;
      let v = row[c];
      if (v instanceof Date) v = _isoDate_(v);
      obj[h] = v;
    });
    out.push(obj);
  });
  return out;
}

function _isoDate_(d) {
  // Só a parte da data (sem hora), no fuso da planilha — evita o clássico
  // bug de "um dia a menos" quando o front converte pra Date() em UTC.
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Sao_Paulo', 'yyyy-MM-dd');
}

function _filterByUnidade_(rows, unidade) {
  if (!unidade || unidade === 'Todas' || unidade === 'Todos') return rows;
  return rows.filter(r => r['Unidade'] === unidade);
}

function _listEquipamentos_(unidade) {
  return _filterByUnidade_(_rowsAsObjects_(SHEETS.CADASTRO_EQUIP), unidade);
}

function _listEstruturas_(unidade) {
  return _filterByUnidade_(_rowsAsObjects_(SHEETS.CADASTRO_ARMAZEM), unidade);
}

function _listPreventivasEquipamentos_(unidade) {
  const rows = _filterByUnidade_(_rowsAsObjects_(SHEETS.PREV_EQUIP), unidade);
  return rows.map(r => _comStatus_(r));
}

function _listPreventivasArmazem_(unidade) {
  const rows = _filterByUnidade_(_rowsAsObjects_(SHEETS.PREV_ARMAZEM), unidade);
  return rows.map(r => _comStatus_(r));
}

/** Anexa o status calculado (4 estados) num registro de preventiva. */
function _comStatus_(row) {
  const info = _statusPreventiva_(row['Última Preventiva'], row['Dias Restantes']);
  row._status = info;
  return row;
}

/**
 * Calcula o status "visual" de 4 estados a partir de Dias Restantes.
 * Cortes: <0 atrasada · <=7 para hoje · <=30 próxima · caso contrário em dia.
 * Sem "Última Preventiva" registrada ainda -> pendente (nunca foi feita).
 */
function _statusPreventiva_(ultimaPreventiva, diasRestantes) {
  if (!ultimaPreventiva) {
    return { codigo: 'pendente', rotulo: 'Pendente (nunca registrada)', emoji: '⚪' };
  }
  const dias = Number(diasRestantes);
  if (isNaN(dias)) {
    return { codigo: 'pendente', rotulo: 'Pendente', emoji: '⚪' };
  }
  if (dias < 0) return { codigo: 'atrasada', rotulo: 'Atrasada', emoji: '🔴', diasRestantes: dias };
  if (dias <= 7) return { codigo: 'para_hoje', rotulo: 'Para hoje', emoji: '🟠', diasRestantes: dias };
  if (dias <= 30) return { codigo: 'proxima', rotulo: 'Próxima', emoji: '🟡', diasRestantes: dias };
  return { codigo: 'em_dia', rotulo: 'Em dia', emoji: '🟢', diasRestantes: dias };
}

/** KPIs para os cards do menu principal de uma unidade (ou 'Todas'). */
function _dashboardCards_(unidade) {
  const equipamentos = _listEquipamentos_(unidade);
  const estruturas = _listEstruturas_(unidade);
  const prevEquip = _listPreventivasEquipamentos_(unidade);
  const prevArmazem = _listPreventivasArmazem_(unidade);
  const todasPreventivas = prevEquip.concat(prevArmazem);

  const porStatus = { em_dia: 0, proxima: 0, para_hoje: 0, atrasada: 0, pendente: 0 };
  todasPreventivas.forEach(p => { porStatus[p._status.codigo]++; });
  const total = todasPreventivas.length;
  const consideradas = total - porStatus.pendente; // % em dia é sobre quem já tem baseline
  const percEmDia = consideradas > 0 ? porStatus.em_dia / consideradas : 0;

  return {
    unidade: unidade || 'Todas',
    totalEquipamentos: equipamentos.length,
    totalEstruturas: estruturas.length,
    preventivas: {
      total: total,
      porStatus: porStatus,
      percEmDia: percEmDia,
    },
  };
}

// ---------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------

function _requireFields_(payload, fields) {
  const faltando = fields.filter(f => payload[f] === undefined || payload[f] === null || String(payload[f]).trim() === '');
  if (faltando.length) {
    throw new Error('Campo(s) obrigatório(s) faltando: ' + faltando.join(', '));
  }
}

function _requireUnidade_(unidade) {
  if (UNIDADES.indexOf(unidade) === -1) {
    throw new Error('Unidade inválida: "' + unidade + '". Use uma de: ' + UNIDADES.join(', '));
  }
}

/**
 * Cadastra um equipamento novo e já dispara o vínculo automático para
 * Preventivas_Equipamentos (mesma função usada pelo onEdit da planilha —
 * o app novo e a edição manual na planilha usam exatamente a mesma lógica).
 */
function _criarEquipamento_(payload) {
  _requireFields_(payload, ['unidade', 'equipamento']);
  _requireUnidade_(payload.unidade);

  const sheet = getSheet_(SHEETS.CADASTRO_EQUIP);
  const row = sheet.getLastRow() + 1;
  _writeRowByHeader_(SHEETS.CADASTRO_EQUIP, row, {
    'Unidade': payload.unidade,
    'Ativo / Patrimônio': payload.ativoPatrimonio || '',
    'Equipamento': payload.equipamento,
    'Tipo': payload.tipo || '',
    'Frequência Preventiva': payload.frequencia || 'Anual',
    'Fornecedor Padrão': payload.fornecedor || '',
  });
  SpreadsheetApp.flush();
  clearHeaderCache();

  syncEquipamentoToPreventiva_(row);
  SpreadsheetApp.flush();

  const criado = _rowsAsObjects_(SHEETS.CADASTRO_EQUIP).find(r => r._linha === row);
  return criado || { linha: row };
}

/**
 * Cadastra uma estrutura/item de armazém novo e dispara o vínculo
 * automático para Preventivas_Armazem.
 */
function _criarEstrutura_(payload) {
  _requireFields_(payload, ['unidade']);
  if (!payload.descricao && !payload.categoria) {
    throw new Error('Informe ao menos "descricao" ou "categoria".');
  }
  _requireUnidade_(payload.unidade);

  const sheet = getSheet_(SHEETS.CADASTRO_ARMAZEM);
  const row = sheet.getLastRow() + 1;
  _writeRowByHeader_(SHEETS.CADASTRO_ARMAZEM, row, {
    'Unidade': payload.unidade,
    'Categoria': payload.categoria || '',
    'Descrição': payload.descricao || '',
    'Prestador': payload.prestador || '',
    'Criticidade': payload.criticidade || 'Média',
    'Frequência': payload.frequencia || 'Anual',
  });
  SpreadsheetApp.flush();
  clearHeaderCache();

  syncArmazemToPreventiva_(row);
  SpreadsheetApp.flush();

  const criado = _rowsAsObjects_(SHEETS.CADASTRO_ARMAZEM).find(r => r._linha === row);
  return criado || { linha: row };
}

/**
 * Marca uma preventiva (equipamento ou armazém) como realizada: grava a
 * data em "Última Preventiva" (o que recalcula Dias Restantes/Status
 * automaticamente, pois são fórmulas) e cria o registro correspondente em
 * Historico_Preventivas — igual ao que acontece ao editar a célula na mão.
 */
function _marcarPreventivaRealizada_(payload) {
  _requireFields_(payload, ['tipo', 'idPreventiva']);
  const tipo = payload.tipo;
  if (tipo !== 'equipamento' && tipo !== 'armazem') {
    throw new Error('"tipo" deve ser "equipamento" ou "armazem".');
  }
  const sheetName = tipo === 'equipamento' ? SHEETS.PREV_EQUIP : SHEETS.PREV_ARMAZEM;
  const sheet = getSheet_(sheetName);
  const idCol = colIndex(sheetName, 'ID_Preventiva');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Nenhuma preventiva cadastrada em ' + sheetName + '.');

  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat();
  const idx = ids.indexOf(payload.idPreventiva);
  if (idx === -1) throw new Error('Preventiva não encontrada: ' + payload.idPreventiva);
  const row = idx + 2;

  const dataRealizacao = payload.dataRealizacao ? new Date(payload.dataRealizacao) : new Date();
  const ultimaCol = colIndex(sheetName, 'Última Preventiva');
  sheet.getRange(row, ultimaCol).setValue(dataRealizacao);

  if (payload.observacao) {
    const obsCol = colIndex(sheetName, 'Observação');
    sheet.getRange(row, obsCol).setValue(payload.observacao);
  }
  SpreadsheetApp.flush();

  // Mesma lógica do onEdit (03_Historico.js), chamada direta — edições
  // feitas por script não disparam o gatilho onEdit instalável da mesma
  // forma que uma edição manual, então garantimos o log aqui.
  onUltimaPreventivaEditada_(sheetName, row);
  SpreadsheetApp.flush();

  const atualizado = _rowsAsObjects_(sheetName).find(r => r._linha === row);
  return _comStatus_(atualizado || { _linha: row });
}

// ---------------------------------------------------------------------
// Resposta
// ---------------------------------------------------------------------

function _json_(obj) {
  // ContentService não permite definir status HTTP customizado; erros vêm
  // com {ok:false, erro:"..."} no corpo mesmo assim (o front checa "ok").
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
