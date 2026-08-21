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
      case 'historico':
        return _json_({ ok: true, data: _listHistorico_(params.unidade, params) });
      case 'custos':
        return _json_({ ok: true, data: _listCustos_(params.unidade, params) });
      case 'dashboardCustos':
        return _json_({ ok: true, data: _dashboardCustos_(params.unidade, params.ano, params.mes) });
      case 'dashboardTempoOcioso':
        return _json_({ ok: true, data: _dashboardTempoOcioso_(params.unidade, params.ano, params.mes) });
      case 'orcamento':
        return _json_({ ok: true, data: _rowsAsObjects_(SHEETS.ORCAMENTO) });
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
      case 'excluirCadastro':
        return _json_({ ok: true, data: _excluirCadastro_(payload) });
      case 'marcarPreventivaRealizada':
        return _json_({ ok: true, data: _marcarPreventivaRealizada_(payload) });
      case 'criarCorretiva':
        return _json_({ ok: true, data: _criarCorretiva_(payload) });
      case 'editarPreventiva':
        return _json_({ ok: true, data: _editarPreventiva_(payload) });
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
    usuarios: _listUsuarios_(),
  };
}

/**
 * Lê a lista de usuários (login) direto da aba Usuarios — Lucas edita essa
 * aba (adiciona/remove/renomeia linha) sem precisar mexer em código. Se a
 * aba ainda não existir (planilha não atualizada pra essa versão), cai de
 * volta na lista fixa USUARIOS_SEED pra não travar o login.
 */
function _listUsuarios_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return USUARIOS_SEED;
  const rows = _rowsAsObjects_(SHEETS.USUARIOS)
    .filter(r => r['Nome'])
    .map(r => ({ nome: String(r['Nome']).trim(), unidade: String(r['Unidade'] || 'geral').trim() }));
  return rows.length ? rows : USUARIOS_SEED;
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

/** Tira as linhas excluídas (soft delete via coluna "Cadastro Ativo" = false). Em branco/ausente conta como ativo. */
function _apenasAtivos_(rows) {
  return rows.filter(r => r['Cadastro Ativo'] !== false && r['Cadastro Ativo'] !== 'FALSE');
}

function _listEquipamentos_(unidade) {
  return _apenasAtivos_(_filterByUnidade_(_rowsAsObjects_(SHEETS.CADASTRO_EQUIP), unidade));
}

function _listEstruturas_(unidade) {
  return _apenasAtivos_(_filterByUnidade_(_rowsAsObjects_(SHEETS.CADASTRO_ARMAZEM), unidade));
}

function _listPreventivasEquipamentos_(unidade) {
  const rows = _apenasAtivos_(_filterByUnidade_(_rowsAsObjects_(SHEETS.PREV_EQUIP), unidade));
  return rows.map(r => _comStatus_(r));
}

function _listPreventivasArmazem_(unidade) {
  const rows = _apenasAtivos_(_filterByUnidade_(_rowsAsObjects_(SHEETS.PREV_ARMAZEM), unidade));
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
// Anexos (Google Drive)
// ---------------------------------------------------------------------

/**
 * Salva um anexo (enviado pelo app como data URL base64) numa pasta do
 * Drive organizada por unidade, deixa o link acessível para quem tiver o
 * link (para poder abrir direto do app/planilha em auditoria) e devolve a
 * URL para gravar na coluna de anexo. Devolve '' se não veio anexo.
 */
function _salvarAnexo_(base64DataUrl, nomeArquivo, unidade) {
  if (!base64DataUrl) return '';
  const match = String(base64DataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error('Anexo em formato inválido.');
  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, mime, nomeArquivo || 'anexo');
  const pasta = _pastaAnexos_(unidade);
  const file = pasta.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Se o compartilhamento por link estiver bloqueado pelo Workspace, o
    // arquivo ainda fica salvo (só não abre pra quem não tiver acesso à
    // pasta) — não trava o lançamento por causa disso.
  }
  return file.getUrl();
}

function _pastaAnexos_(unidade) {
  const raizNome = 'Gestão de Manutenção - Anexos';
  const raiz = DriveApp.getRootFolder();
  const pastasRaiz = raiz.getFoldersByName(raizNome);
  const pastaRaiz = pastasRaiz.hasNext() ? pastasRaiz.next() : raiz.createFolder(raizNome);
  const subNome = unidade || 'Geral';
  const sub = pastaRaiz.getFoldersByName(subNome);
  return sub.hasNext() ? sub.next() : pastaRaiz.createFolder(subNome);
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
 * Exclui (soft delete) um equipamento ou item de armazém: marca "Cadastro
 * Ativo" = false na linha do Cadastro E na linha correspondente das abas
 * fixas de Preventivas (achada pelo ID_Equipamento/ID_Estrutura) — assim
 * ele some das duas listas e do dropdown de "Lançar Manutenção" de uma
 * vez só. Não apaga a linha nem mexe em Historico_Preventivas ou
 * Manutencoes_Custos — o que já foi registrado continua no histórico
 * normalmente, só o cadastro ativo é que some.
 */
function _excluirCadastro_(payload) {
  _requireFields_(payload, ['tipo', 'id']);
  const tipo = payload.tipo;
  if (tipo !== 'equipamento' && tipo !== 'armazem') {
    throw new Error('"tipo" deve ser "equipamento" ou "armazem".');
  }

  const cadastroSheet = tipo === 'equipamento' ? SHEETS.CADASTRO_EQUIP : SHEETS.CADASTRO_ARMAZEM;
  const cadastroIdHeader = tipo === 'equipamento' ? 'ID_Equipamento' : 'ID_Estrutura';
  const prevSheet = tipo === 'equipamento' ? SHEETS.PREV_EQUIP : SHEETS.PREV_ARMAZEM;

  const cadRow = _marcarInativo_(cadastroSheet, cadastroIdHeader, payload.id);
  if (!cadRow) throw new Error('Cadastro não encontrado: ' + payload.id);
  _marcarInativo_(prevSheet, cadastroIdHeader, payload.id); // mesma coluna de ID nas duas abas

  SpreadsheetApp.flush();
  return { ok: true, id: payload.id };
}

/** Acha a linha com `idValue` em `idHeader` na aba `sheetName` e marca "Cadastro Ativo" = false. Devolve a linha (número) ou null se não achou. */
function _marcarInativo_(sheetName, idHeader, idValue) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const idCol = colIndex(sheetName, idHeader);
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat();
  const idx = ids.indexOf(idValue);
  if (idx === -1) return null;
  const row = idx + 2;
  const ativoCol = colIndex(sheetName, 'Cadastro Ativo');
  sheet.getRange(row, ativoCol).setValue(false);
  return row;
}

/**
 * Marca uma preventiva (equipamento ou armazém) como realizada: grava a
 * data em "Última Preventiva" (o que recalcula Dias Restantes/Status
 * automaticamente, pois são fórmulas) e cria o registro correspondente em
 * Historico_Preventivas — igual ao que acontece ao editar a célula na mão.
 *
 * Para equipamento, Data/Hora Início + Fim são OBRIGATÓRIOS (é o que
 * alimenta o Dashboard de Tempo Ocioso) — o Tempo Parada (h) em
 * Historico_Preventivas é calculado automaticamente a partir delas. Para
 * armazém (que não tem esse conceito de "parada"), continua só com uma
 * data de realização.
 *
 * Aceita opcionalmente um anexo (certificação/comprovante da preventiva,
 * en­viado como data URL base64) e o nome de quem registrou (auditoria).
 */
function _marcarPreventivaRealizada_(payload) {
  _requireFields_(payload, ['tipo', 'idPreventiva']);
  const tipo = payload.tipo;
  if (tipo !== 'equipamento' && tipo !== 'armazem') {
    throw new Error('"tipo" deve ser "equipamento" ou "armazem".');
  }
  if (tipo === 'equipamento') {
    _requireFields_(payload, ['dataInicio', 'dataFim']);
  } else {
    _requireFields_(payload, ['dataRealizacao']);
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

  const isEquip = tipo === 'equipamento';
  const dataInicio = isEquip ? new Date(payload.dataInicio) : new Date(payload.dataRealizacao);

  const ultimaCol = colIndex(sheetName, 'Última Preventiva');
  sheet.getRange(row, ultimaCol).setValue(dataInicio);

  if (payload.observacao) {
    const obsCol = colIndex(sheetName, 'Observação');
    sheet.getRange(row, obsCol).setValue(payload.observacao);
  }
  SpreadsheetApp.flush();

  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const get = (header) => values[colIndex(sheetName, header) - 1];
  const unidade = get('Unidade');
  const anexoUrl = payload.anexoBase64 ? _salvarAnexo_(payload.anexoBase64, payload.anexoNome, unidade) : '';

  if (isEquip) {
    logPreventivaRealizada_({
      unidade: unidade,
      dataRealizacao: dataInicio,
      dataFim: new Date(payload.dataFim),
      classificacao: 'EQUIPAMENTOS',
      equipamento: get('Equipamento'),
      prestadora: get('Fornecedor'),
      servico: 'PREVENTIVA',
      valor: '',
      anexo: anexoUrl,
      registradoPor: payload.registradoPor || '',
    });
  } else {
    logPreventivaRealizada_({
      unidade: unidade,
      dataRealizacao: dataInicio,
      dataFim: '',
      classificacao: 'PREDIAL',
      equipamento: get('Equipamento / Estrutura'),
      prestadora: get('Responsável'),
      servico: 'PREVENTIVA',
      valor: '',
      anexo: anexoUrl,
      registradoPor: payload.registradoPor || '',
    });
  }
  SpreadsheetApp.flush();

  const atualizado = _rowsAsObjects_(sheetName).find(r => r._linha === row);
  return _comStatus_(atualizado || { _linha: row });
}

/**
 * Altera uma preventiva SEM marcá-la como realizada — dois usos possíveis,
 * que podem vir junto ou separados no mesmo request:
 *  (a) "novaProximaData": reagenda manualmente a Próxima Preventiva (ex: o
 *      prestador remarcou a visita) — sobrescreve direto a célula, que
 *      normalmente é fórmula; a partir daí ela fica "fixa" até a próxima
 *      vez que a preventiva for marcada como realizada (o que recalcula
 *      Última Preventiva e reescreve a fórmula de novo).
 *  (b) "anexoBase64": anexa um documento (ex: orçamento em negociação)
 *      sem mexer em nenhuma data — fica salvo na coluna "Anexo Negociação"
 *      e visível na lista do app, pra acompanhamento.
 */
function _editarPreventiva_(payload) {
  _requireFields_(payload, ['tipo', 'idPreventiva']);
  const tipo = payload.tipo;
  if (tipo !== 'equipamento' && tipo !== 'armazem') {
    throw new Error('"tipo" deve ser "equipamento" ou "armazem".');
  }
  if (!payload.novaProximaData && !payload.anexoBase64) {
    throw new Error('Informe uma nova data ou um anexo — nenhum dos dois veio.');
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

  if (payload.novaProximaData) {
    const proximaCol = colIndex(sheetName, 'Próxima Preventiva');
    sheet.getRange(row, proximaCol).setValue(new Date(payload.novaProximaData)).setNumberFormat('dd/mm/yyyy');
  }

  if (payload.anexoBase64) {
    const unidadeCol = colIndex(sheetName, 'Unidade');
    const unidade = sheet.getRange(row, unidadeCol).getValue();
    const anexoUrl = _salvarAnexo_(payload.anexoBase64, payload.anexoNome, unidade);
    const anexoCol = colIndex(sheetName, 'Anexo Negociação');
    sheet.getRange(row, anexoCol).setValue(anexoUrl);
  }

  if (payload.observacao !== undefined) {
    const obsCol = colIndex(sheetName, 'Observação');
    sheet.getRange(row, obsCol).setValue(payload.observacao);
  }
  SpreadsheetApp.flush();

  const atualizado = _rowsAsObjects_(sheetName).find(r => r._linha === row);
  return _comStatus_(atualizado || { _linha: row });
}

/**
 * Registra um lançamento de manutenção em Manutencoes_Custos — tanto
 * corretiva quanto preventiva (ou instalação, ponto de melhoria etc., ver
 * TIPOS_MANUTENCAO), é a mesma tela/ação no app, só muda o "Tipo". É essa
 * unificação que faz a preventiva também aparecer no Dashboard de Gastos
 * (custo por tipo), já que a preventiva "de rotina" (marcarPreventivaRealizada)
 * não tem valor/custo associado.
 *
 * Equipamento, Classificação, Data Início, Data Fim, Valor e Anexo são
 * obrigatórios (pedido explícito do Lucas, para nunca perder o
 * comprovante/valor de um lançamento). O Tempo Parada (h) é calculado
 * automaticamente por fórmula a partir de Início/Fim.
 */
function _criarCorretiva_(payload) {
  _requireFields_(payload, ['unidade', 'classificacao', 'equipamento', 'dataInicio', 'dataFim', 'valor']);
  if (!payload.anexoBase64) {
    throw new Error('Anexo obrigatório: anexe o orçamento/comprovante/certificação deste lançamento.');
  }
  _requireUnidade_(payload.unidade);
  if (CLASSIFICACOES.indexOf(payload.classificacao) === -1) {
    throw new Error('Classificação inválida: "' + payload.classificacao + '". Use uma de: ' + CLASSIFICACOES.join(', '));
  }

  const anexoUrl = _salvarAnexo_(payload.anexoBase64, payload.anexoNome, payload.unidade);

  const sheet = getSheet_(SHEETS.MANUTENCOES);
  const row = sheet.getLastRow() + 1;
  _writeRowByHeader_(SHEETS.MANUTENCOES, row, {
    'ID_Manutencao': nextId_('MA'),
    'Unidade': payload.unidade,
    'Data Início': new Date(payload.dataInicio),
    'Data Fim': new Date(payload.dataFim),
    'Responsável': payload.responsavel || '',
    'Classificação': payload.classificacao,
    'Tipo': payload.tipo || 'CORRETIVA',
    'Equipamento': payload.equipamento,
    'Descrição do Serviço': payload.descricao || '',
    'Valor': payload.valor,
    'Anexo': anexoUrl,
    'Registrado Por': payload.registradoPor || '',
  });
  recalcTempoParada_(SHEETS.MANUTENCOES, row);
  SpreadsheetApp.flush();

  const criado = _rowsAsObjects_(SHEETS.MANUTENCOES).find(r => r._linha === row);
  return criado || { linha: row };
}

// ---------------------------------------------------------------------
// Histórico e Custos (listagem com filtros)
// ---------------------------------------------------------------------

function _anoOf_(isoDate) { return isoDate ? String(isoDate).slice(0, 4) : ''; }
function _mesOf_(isoDate) { return isoDate ? String(isoDate).slice(5, 7) : ''; }

/**
 * Histórico de preventivas realizadas, com filtros — sem filtro de unidade
 * porque a unidade já foi escolhida na entrada do app (a listagem já vem
 * filtrada nela).
 */
function _listHistorico_(unidade, params) {
  let rows = _filterByUnidade_(_rowsAsObjects_(SHEETS.HISTORICO), unidade);
  if (params.ano) rows = rows.filter(r => _anoOf_(r['Data da Realização']) === String(params.ano));
  if (params.mes) rows = rows.filter(r => _mesOf_(r['Data da Realização']) === String(params.mes).padStart(2, '0'));
  if (params.classificacao) rows = rows.filter(r => r['Classificação'] === params.classificacao);
  if (params.equipamento) {
    const termo = String(params.equipamento).toLowerCase();
    rows = rows.filter(r => String(r['Equipamento / Estrutura'] || '').toLowerCase().includes(termo));
  }
  if (params.prestadora) {
    const termo = String(params.prestadora).toLowerCase();
    rows = rows.filter(r => String(r['Prestadora'] || '').toLowerCase().includes(termo));
  }
  return rows.sort((a, b) => String(b['Data da Realização']).localeCompare(String(a['Data da Realização'])));
}

/** Lançamentos de Manutencoes_Custos (corretivas, instalações etc.), com filtros. */
function _listCustos_(unidade, params) {
  let rows = _filterByUnidade_(_rowsAsObjects_(SHEETS.MANUTENCOES), unidade);
  if (params.ano) rows = rows.filter(r => _anoOf_(r['Data Início']) === String(params.ano));
  if (params.mes) rows = rows.filter(r => _mesOf_(r['Data Início']) === String(params.mes).padStart(2, '0'));
  if (params.classificacao) rows = rows.filter(r => r['Classificação'] === params.classificacao);
  if (params.tipo) rows = rows.filter(r => r['Tipo'] === params.tipo);
  if (params.equipamento) {
    const termo = String(params.equipamento).toLowerCase();
    rows = rows.filter(r => String(r['Equipamento'] || '').toLowerCase().includes(termo));
  }
  return rows.sort((a, b) => String(b['Data Início']).localeCompare(String(a['Data Início'])));
}

// ---------------------------------------------------------------------
// Dashboard de Gastos (budget / saldo / gasto por unidade)
// ---------------------------------------------------------------------

/** Soma o budget cadastrado em Orcamento para uma unidade/ano, por classificação. */
function _orcamentoUnidade_(unidade, ano) {
  const rows = _rowsAsObjects_(SHEETS.ORCAMENTO).filter(r =>
    r['Unidade'] === unidade && String(r['Ano']) === String(ano));
  const out = { equipamentos: 0, predial: 0, geral: 0, total: 0 };
  rows.forEach(r => {
    const val = Number(r['Budget Anual']) || 0;
    const classif = String(r['Classificação'] || '').toUpperCase();
    if (classif === 'EQUIPAMENTOS') out.equipamentos += val;
    else if (classif === 'PREDIAL') out.predial += val;
    else out.geral += val;
  });
  out.total = out.equipamentos + out.predial + out.geral;
  return out;
}

/**
 * Soma o gasto (Manutencoes_Custos) de uma unidade/ano, por classificação.
 * Lançamentos sem Data Início sempre entram no total (mesma regra usada no
 * Dashboard Geral da planilha) — só não dá pra saber em qual ano exatamente
 * caíram, então entram independente do filtro de ano.
 */
function _gastoPorClassificacao_(unidade, ano) {
  const rows = _filterByUnidade_(_rowsAsObjects_(SHEETS.MANUTENCOES), unidade)
    .filter(r => !ano || !r['Data Início'] || _anoOf_(r['Data Início']) === String(ano));
  const out = { equipamentos: 0, predial: 0, total: 0 };
  rows.forEach(r => {
    const val = Number(r['Valor']) || 0;
    out.total += val;
    const classif = String(r['Classificação'] || '').toUpperCase();
    if (classif === 'EQUIPAMENTOS') out.equipamentos += val;
    else if (classif === 'PREDIAL') out.predial += val;
  });
  return out;
}

function _agruparPorTipo_(rows) {
  const map = {};
  rows.forEach(r => {
    const tipo = r['Tipo'] || 'Outros';
    if (!map[tipo]) map[tipo] = { tipo: tipo, valor: 0, quantidade: 0 };
    map[tipo].valor += Number(r['Valor']) || 0;
    map[tipo].quantidade++;
  });
  return Object.values(map).sort((a, b) => b.valor - a.valor);
}

function _agruparPorEquipamento_(rows) {
  const map = {};
  rows.forEach(r => {
    const nome = r['Equipamento'] || '—';
    if (!map[nome]) map[nome] = { equipamento: nome, valor: 0, quantidade: 0 };
    map[nome].valor += Number(r['Valor']) || 0;
    map[nome].quantidade++;
  });
  return Object.values(map).sort((a, b) => b.valor - a.valor);
}

function _agruparPorMes_(rows) {
  const map = {};
  rows.forEach(r => {
    const d = r['Data Início'];
    if (!d) return;
    const key = String(d).slice(0, 7); // yyyy-MM
    if (!map[key]) map[key] = { mes: key, valor: 0 };
    map[key].valor += Number(r['Valor']) || 0;
  });
  return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
}

function _saldoDe_(budget, gasto) {
  return {
    equipamentos: budget.equipamentos - gasto.equipamentos,
    predial: budget.predial - gasto.predial,
    total: budget.total - gasto.total,
  };
}

/**
 * Dashboard de gastos de uma unidade (budget / gasto / saldo, separado por
 * Equipamentos e Predial, mais custo por tipo, por equipamento e evolução
 * mensal). Com unidade = 'Todas', devolve o mesmo, por unidade, mais os
 * totais consolidados (equivalente ao "Budget Corporativo" do dashboard
 * antigo). `mesParam` (01-12), se vier, filtra custoPorTipo/custoPorEquipamento
 * pra só aquele mês do ano escolhido — Budget/Saldo continuam sempre pelo
 * ano inteiro (o budget é anual, não faz sentido "por mês").
 */
function _dashboardCustos_(unidadeParam, anoParam, mesParam) {
  const ano = anoParam || new Date().getFullYear();
  const mes = mesParam ? String(mesParam).padStart(2, '0') : '';
  const isTodas = !unidadeParam || unidadeParam === 'Todas' || unidadeParam === 'Todos';

  const filtroPeriodo = (r) => {
    if (!r['Data Início']) return true; // sem data sempre entra (mesma regra do total)
    if (_anoOf_(r['Data Início']) !== String(ano)) return false;
    if (mes && _mesOf_(r['Data Início']) !== mes) return false;
    return true;
  };

  if (!isTodas) {
    const budget = _orcamentoUnidade_(unidadeParam, ano);
    const gasto = _gastoPorClassificacao_(unidadeParam, ano);
    const rowsAno = _filterByUnidade_(_rowsAsObjects_(SHEETS.MANUTENCOES), unidadeParam).filter(filtroPeriodo);
    return {
      unidade: unidadeParam,
      ano: ano,
      mes: mes,
      budget: budget,
      gasto: gasto,
      saldo: _saldoDe_(budget, gasto),
      custoPorTipo: _agruparPorTipo_(rowsAno),
      custoPorEquipamento: _agruparPorEquipamento_(rowsAno),
      evolucaoMensal: _agruparPorMes_(_filterByUnidade_(_rowsAsObjects_(SHEETS.MANUTENCOES), unidadeParam)
        .filter(r => !r['Data Início'] || _anoOf_(r['Data Início']) === String(ano))),
    };
  }

  const porUnidade = UNIDADES.map(u => {
    const budget = _orcamentoUnidade_(u, ano);
    const gasto = _gastoPorClassificacao_(u, ano);
    return { unidade: u, budget: budget, gasto: gasto, saldo: _saldoDe_(budget, gasto) };
  });

  const budgetTotal = porUnidade.reduce((s, u) => s + u.budget.total, 0);
  const gastoTotal = porUnidade.reduce((s, u) => s + u.gasto.total, 0);
  const todasRowsAno = _rowsAsObjects_(SHEETS.MANUTENCOES)
    .filter(r => !r['Data Início'] || _anoOf_(r['Data Início']) === String(ano));
  const todasRowsPeriodo = todasRowsAno.filter(filtroPeriodo);

  return {
    unidade: 'Todas',
    ano: ano,
    mes: mes,
    budgetTotal: budgetTotal,
    gastoTotal: gastoTotal,
    saldoTotal: budgetTotal - gastoTotal,
    porUnidade: porUnidade,
    custoPorUnidade: porUnidade.map(u => ({ unidade: u.unidade, valor: u.gasto.total })),
    custoPorTipo: _agruparPorTipo_(todasRowsPeriodo),
    custoPorEquipamento: _agruparPorEquipamento_(todasRowsPeriodo),
    evolucaoMensal: _agruparPorMes_(todasRowsAno),
  };
}

// ---------------------------------------------------------------------
// Dashboard de Tempo Ocioso (equipamentos parados)
// ---------------------------------------------------------------------

/**
 * Junta os eventos de parada de equipamento (preventivas com início/fim +
 * corretivas) e agrupa por equipamento: quantas manutenções/paradas, horas
 * totais paradas, data da última parada, e se é recorrente (parou mais de
 * uma vez). Com unidade = 'Todas', agrupa também por unidade (dois
 * equipamentos com o mesmo nome em unidades diferentes contam separado).
 * `mesParam` (01-12) + `anoParam`, se vierem, filtram pelos eventos cuja
 * data de início caiu naquele mês/ano.
 */
function _dashboardTempoOcioso_(unidadeParam, anoParam, mesParam) {
  const isTodas = !unidadeParam || unidadeParam === 'Todas' || unidadeParam === 'Todos';
  const ano = anoParam ? String(anoParam) : '';
  const mes = mesParam ? String(mesParam).padStart(2, '0') : '';
  const dentroDoPeriodo = (dataIso) => {
    if (!ano && !mes) return true;
    if (!dataIso) return false;
    if (ano && _anoOf_(dataIso) !== ano) return false;
    if (mes && _mesOf_(dataIso) !== mes) return false;
    return true;
  };

  const historico = _filterByUnidade_(_rowsAsObjects_(SHEETS.HISTORICO), unidadeParam)
    .filter(r => r['Classificação'] === 'EQUIPAMENTOS' && r['Tempo Parada (h)'] !== '' && r['Tempo Parada (h)'] != null)
    .filter(r => dentroDoPeriodo(r['Data da Realização']))
    .map(r => ({ equipamento: r['Equipamento / Estrutura'], unidade: r['Unidade'], horas: Number(r['Tempo Parada (h)']) || 0, data: r['Data da Realização'] }));

  const custos = _filterByUnidade_(_rowsAsObjects_(SHEETS.MANUTENCOES), unidadeParam)
    .filter(r => r['Classificação'] === 'EQUIPAMENTOS' && r['Tempo Parada (h)'] !== '' && r['Tempo Parada (h)'] != null)
    .filter(r => dentroDoPeriodo(r['Data Início']))
    .map(r => ({ equipamento: r['Equipamento'], unidade: r['Unidade'], horas: Number(r['Tempo Parada (h)']) || 0, data: r['Data Início'] }));

  const eventos = historico.concat(custos);
  const map = {};
  eventos.forEach(ev => {
    const key = (ev.equipamento || '—') + '|' + ev.unidade;
    if (!map[key]) map[key] = { equipamento: ev.equipamento, unidade: ev.unidade, horasTotal: 0, ocorrencias: 0, ultimaParada: '' };
    map[key].horasTotal += ev.horas;
    map[key].ocorrencias++;
    if (ev.data && String(ev.data) > String(map[key].ultimaParada)) map[key].ultimaParada = ev.data;
  });

  const equipamentos = Object.values(map)
    .map(e => Object.assign({}, e, { recorrente: e.ocorrencias > 1 }))
    .sort((a, b) => b.horasTotal - a.horasTotal);

  const resultado = {
    unidade: isTodas ? 'Todas' : unidadeParam,
    ano: ano,
    mes: mes,
    totalEquipamentosParados: equipamentos.length,
    horasTotal: equipamentos.reduce((s, e) => s + e.horasTotal, 0),
    totalRecorrentes: equipamentos.filter(e => e.recorrente).length,
    equipamentos: equipamentos,
  };

  // Com "Todas as unidades", adiciona o mesmo resumo separado por unidade
  // (Macatuba / Jundiaí I / Jundiaí II) — igual ao gráfico por unidade do
  // Dashboard de Gastos, pra dar pra comparar de relance.
  if (isTodas) {
    resultado.porUnidade = UNIDADES.map(u => {
      const doUnidade = equipamentos.filter(e => e.unidade === u);
      return {
        unidade: u,
        totalEquipamentosParados: doUnidade.length,
        horasTotal: doUnidade.reduce((s, e) => s + e.horasTotal, 0),
        totalRecorrentes: doUnidade.filter(e => e.recorrente).length,
      };
    });
  }

  return resultado;
}

// ---------------------------------------------------------------------
// Resposta
// ---------------------------------------------------------------------

function _json_(obj) {
  // ContentService não permite definir status HTTP customizado; erros vêm
  // com {ok:false, erro:"..."} no corpo mesmo assim (o front checa "ok").
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
