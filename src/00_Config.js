/**
 * 00_Config.js
 * Constantes centrais do sistema. Mude aqui os nomes de unidades, abas e
 * colunas — todo o resto do projeto lê a partir daqui, nada de nome de aba
 * "hardcoded" espalhado pelo código.
 */

const SHEETS = {
  CONFIG: 'Config',
  CADASTRO_EQUIP: 'Cadastro_Equipamentos',
  CADASTRO_ARMAZEM: 'Cadastro_Preventiva_Armazem',
  PREV_EQUIP: 'Preventivas_Equipamentos',
  PREV_ARMAZEM: 'Preventivas_Armazem',
  HISTORICO: 'Historico_Preventivas',
  MANUTENCOES: 'Manutencoes_Custos',
  ORCAMENTO: 'Orcamento',
  USUARIOS: 'Usuarios',
  DASH_DATA: 'Dashboard_Data',
  DASHBOARD: 'Dashboard',
};

const UNIDADES = ['Macatuba', 'Jundiaí I', 'Jundiaí II'];

// Lista de usuários — usada só como SEMENTE inicial da aba "Usuarios" na
// planilha (Nome, Unidade) na primeira vez que "Configurar planilha" roda.
// Depois disso, quem manda é a aba: pra adicionar/remover/editar alguém,
// edite direto lá — não precisa mexer em código. "unidade": 'geral'
// significa que a pessoa pode escolher qualquer unidade (ou "Todas as
// unidades") ao entrar; para os demais, a unidade já vem pré-selecionada.
const USUARIOS_SEED = [
  { nome: 'Eduardo Dirolli', unidade: 'geral' },
  { nome: 'Ricardo Augusto', unidade: 'geral' },
  { nome: 'Lucas Gomes', unidade: 'geral' },
  { nome: 'Jesiel Ricardo', unidade: 'Jundiaí II' },
  { nome: 'Guilherme Henrique', unidade: 'Jundiaí I' },
  { nome: 'Matheus Martins', unidade: 'Jundiaí I' },
  { nome: 'Daniely Villaça', unidade: 'Jundiaí II' },
];

const CLASSIFICACOES = ['EQUIPAMENTOS', 'PREDIAL'];

// Orcamento aceita também "GERAL" — usado quando a unidade ainda não tem o
// budget separado por Equipamentos/Predial (ex: valor único informado).
const CLASSIFICACOES_ORCAMENTO = ['EQUIPAMENTOS', 'PREDIAL', 'GERAL'];

const TIPOS_MANUTENCAO = [
  'PREVENTIVA',
  'CORRETIVA',
  'INSTALAÇÃO',
  'INVESTIMENTOS E ADEQUAÇÕES',
  'PONTO DE MELHORIA',
  'FECHAMENTO DE FRESTAS',
  'OUTROS',
];

const CRITICIDADES = ['Baixa', 'Média', 'Alta'];

const STATUS_PREVENTIVA = ['EM DIA', 'PARA HOJE', 'ATRASADO', 'PENDENTE'];

// Frequência -> dias até a próxima preventiva.
const FREQUENCIA_DIAS = {
  'Mensal': 30,
  'Bimestral': 60,
  'Trimestral': 90,
  'Quadrimestral': 120,
  'Semestral': 180,
  'Anual': 365,
};
const FREQUENCIAS = Object.keys(FREQUENCIA_DIAS);

// Definição de colunas por aba. A ordem aqui É a ordem das colunas na
// planilha quando setupSpreadsheet() cria a aba do zero.
const COLS = {
  CADASTRO_EQUIP: [
    'ID_Equipamento', 'Unidade', 'Ativo / Patrimônio', 'Equipamento', 'Tipo',
    'Frequência Preventiva', 'Fornecedor Padrão', 'Data de Cadastro',
    'Cadastro Ativo',
  ],
  CADASTRO_ARMAZEM: [
    'ID_Estrutura', 'Unidade', 'Categoria', 'Descrição', 'Prestador',
    'Criticidade', 'Frequência', 'Data de Cadastro',
    'Cadastro Ativo',
  ],
  PREV_EQUIP: [
    'ID_Preventiva', 'ID_Equipamento', 'Unidade', 'Equipamento', 'Tipo',
    'Fornecedor', 'Frequência', 'Última Preventiva', 'Dias Restantes',
    'Próxima Preventiva', 'Status', 'Observação', 'Orçamento / Anexo',
    'Anexo Negociação', 'Cadastro Ativo',
  ],
  PREV_ARMAZEM: [
    'ID_Preventiva', 'ID_Estrutura', 'Unidade', 'Equipamento / Estrutura',
    'Frequência', 'Responsável', 'Última Preventiva', 'Dias Restantes',
    'Próxima Preventiva', 'Status', 'Observação', 'Orçamento / Anexo',
    'Anexo Negociação', 'Cadastro Ativo',
  ],
  HISTORICO: [
    'ID_Historico', 'Unidade', 'Data da Realização', 'Data Fim',
    'Tempo Parada (h)', 'Classificação', 'Equipamento / Estrutura',
    'Prestadora', 'Serviço Realizado', 'Valor', 'Documento / Anexo',
    'Registrado Por',
  ],
  MANUTENCOES: [
    'ID_Manutencao', 'Unidade', 'Data Início', 'Data Fim',
    'Tempo Parada (h)', 'Responsável', 'Classificação', 'Tipo',
    'Equipamento', 'Descrição do Serviço', 'Valor', 'Anexo',
    'Registrado Por',
  ],
  ORCAMENTO: ['Unidade', 'Classificação', 'Ano', 'Budget Anual'],
  USUARIOS: ['Nome', 'Unidade'],
};

/**
 * Índice (1-based) de uma coluna pelo nome do cabeçalho, lendo a linha 1 da
 * aba. Cacheado por execução para não ficar relendo a mesma linha.
 */
const _headerCache = {};
function colIndex(sheetName, headerName) {
  if (!_headerCache[sheetName]) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error('Aba não encontrada: ' + sheetName);
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};
    headers.forEach((h, i) => { if (h) map[String(h).trim()] = i + 1; });
    _headerCache[sheetName] = map;
  }
  const idx = _headerCache[sheetName][headerName];
  if (!idx) throw new Error('Coluna "' + headerName + '" não encontrada em ' + sheetName);
  return idx;
}

function clearHeaderCache() {
  Object.keys(_headerCache).forEach(k => delete _headerCache[k]);
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Aba não encontrada: ' + name + '. Rode "Configurar planilha" no menu Gestão de Manutenção.');
  return sheet;
}

/** Gera um ID sequencial simples com prefixo, ex: EQ-000123. */
function nextId_(prefix) {
  const props = PropertiesService.getDocumentProperties();
  const key = 'SEQ_' + prefix;
  const current = Number(props.getProperty(key) || '0') + 1;
  props.setProperty(key, String(current));
  return prefix + '-' + String(current).padStart(6, '0');
}
