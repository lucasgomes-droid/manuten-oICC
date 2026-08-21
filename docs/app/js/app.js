/**
 * app.js — roteador e telas do app:
 *   #/selecao                     seleção de nome (lista fixa) + unidade (ou "Todas as unidades")
 *   #/menu                        menu principal com cards de KPI (clicáveis -> #/preventivas?status=...)
 *   #/cadastro-equipamento        cadastro de equipamento (+ lista)
 *   #/cadastro-armazem            cadastro de preventiva de armazém (+ lista)
 *   #/preventivas-equipamento     operação: preventivas de equipamentos
 *   #/preventivas-armazem         operação: preventivas de armazém
 *   #/preventivas                 operação: equipamentos + armazém juntos, filtrável por ?status=
 *   #/manutencoes                 lançar manutenção (corretiva OU preventiva, mesma tela)
 *   #/manutencoes-corretivas      histórico de lançamentos tipo CORRETIVA
 *   #/manutencoes-preventivas     histórico de lançamentos tipo PREVENTIVA (com custo)
 *   #/historico                   histórico de preventivas de rotina marcadas como feitas, com filtros
 *   #/dashboard-custos            budget / saldo / gasto (por unidade, ou "Todas")
 *   #/dashboard-tempo-ocioso      equipamentos parados, horas, recorrência (por unidade, ou "Todas")
 *
 * Vanilla JS de propósito (sem framework/bundler) — abre direto no GitHub
 * Pages, sem passo de build.
 */

const root = document.getElementById('app-root');

// ---------------------------------------------------------------------
// Utilidades de UI
// ---------------------------------------------------------------------

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function toast(msg, tipo) {
  const el = h(`<div class="toast toast--${tipo || 'info'}">${escapeHtml(msg)}</div>`);
  document.getElementById('toast-root').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function fmtMoney(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtHoras(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'h';
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtMesLabel(yyyyMM) {
  const [y, m] = String(yyyyMM).split('-');
  const idx = Number(m) - 1;
  return (MESES[idx] || m) + '/' + String(y).slice(2);
}

/** Lista de barras horizontais simples (sem lib externa) — usada nos dashboards. */
function barList(items, opts) {
  opts = opts || {};
  const label = opts.label || ((it) => it.label);
  const value = opts.value || ((it) => it.value);
  const fmt = opts.fmt || ((v) => v);
  const max = Math.max(1, ...items.map(value));
  if (!items.length) return `<p class="empty-state">${escapeHtml(opts.vazio || 'Sem dados ainda.')}</p>`;
  return `<div class="bar-list">${items.map(it => {
    const v = value(it);
    const pct = Math.max(2, Math.round((v / max) * 100));
    return `<div class="bar-row">
      <span class="bar-row__label">${escapeHtml(label(it))}</span>
      <div class="bar-row__track"><div class="bar-row__fill" style="width:${pct}%"></div></div>
      <span class="bar-row__value">${escapeHtml(String(fmt(v)))}</span>
    </div>`;
  }).join('')}</div>`;
}

/** Lê um <input type="file"> e devolve uma Promise com a data URL base64 (ou '' se nenhum arquivo escolhido). */
function fileParaBase64(input) {
  return new Promise((resolve, reject) => {
    const file = input && input.files && input.files[0];
    if (!file) { resolve({ base64: '', nome: '' }); return; }
    if (file.size > 15 * 1024 * 1024) { reject(new Error('Anexo maior que 15MB — escolha um arquivo menor.')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: reader.result, nome: file.name });
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo anexado.'));
    reader.readAsDataURL(file);
  });
}

function loadingBlock(label) {
  return `<div class="loading"><div class="spinner"></div><p>${escapeHtml(label || 'Carregando...')}</p></div>`;
}

function errorBlock(err, retryHash) {
  return `<div class="error-block">
    <p>⚠️ ${escapeHtml(err.message || String(err))}</p>
    ${retryHash ? `<button class="btn btn--secondary" data-nav="${retryHash}">Tentar novamente</button>` : ''}
  </div>`;
}

function header(titulo, opts) {
  opts = opts || {};
  const s = Session.get();
  const backBtn = opts.back ? `<button class="icon-btn" data-nav="${opts.back}" aria-label="Voltar">←</button>` : '';
  return `
    <header class="app-header">
      <div class="app-header__top">
        ${backBtn}
        <h1>${escapeHtml(titulo)}</h1>
        <button class="icon-btn" data-nav="#/menu" aria-label="Menu">☰</button>
      </div>
      ${s ? `<div class="app-header__ctx">
        <span>📍 ${escapeHtml(s.unidade)}</span>
        <span>·</span>
        <span>${escapeHtml(s.nome)}</span>
        <button class="link-btn" data-action="trocar-unidade">trocar</button>
      </div>` : ''}
    </header>`;
}

// ---------------------------------------------------------------------
// Roteador
// ---------------------------------------------------------------------

const routes = {
  '#/selecao': screenSelecao,
  '#/menu': screenMenu,
  '#/cadastro-equipamento': screenCadastroEquipamento,
  '#/cadastro-armazem': screenCadastroArmazem,
  '#/preventivas-equipamento': (q) => screenPreventivas('equipamento', q),
  '#/preventivas-armazem': (q) => screenPreventivas('armazem', q),
  '#/preventivas': (q) => screenPreventivas('todas', q),
  '#/manutencoes': screenLancarManutencao,
  '#/corretivas': screenLancarManutencao, // rota antiga — mesma tela nova
  '#/manutencoes-corretivas': () => screenListaManutencoes('CORRETIVA'),
  '#/manutencoes-preventivas': () => screenListaManutencoes('PREVENTIVA'),
  '#/historico': screenHistorico,
  '#/dashboard-custos': screenDashboardCustos,
  '#/dashboard-tempo-ocioso': screenDashboardTempoOcioso,
};

async function router() {
  let hash = window.location.hash || '#/selecao';
  const [path, queryStr] = hash.split('?');
  const query = new URLSearchParams(queryStr || '');
  const session = Session.get();
  if (!session && path !== '#/selecao') {
    window.location.hash = '#/selecao';
    return;
  }
  const screen = routes[path] || screenNotFound;
  root.innerHTML = loadingBlock('Carregando...');
  try {
    const html = await screen(query);
    root.innerHTML = html;
    window.scrollTo(0, 0);
  } catch (err) {
    root.innerHTML = errorBlock(err, path);
  }
}

window.addEventListener('hashchange', router);

// Delegação global de cliques para data-nav / data-action
document.addEventListener('click', (e) => {
  const navEl = e.target.closest('[data-nav]');
  if (navEl) {
    window.location.hash = navEl.getAttribute('data-nav');
    return;
  }
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.getAttribute('data-action');
    if (action === 'trocar-unidade') {
      Session.clear();
      Cache.clear();
      window.location.hash = '#/selecao';
    }
  }
});

function screenNotFound() {
  return `${header('Página não encontrada', { back: '#/menu' })}
    <main class="container"><p>Tela não encontrada.</p></main>`;
}

// ---------------------------------------------------------------------
// Tela: Seleção de nome + unidade
// ---------------------------------------------------------------------

async function screenSelecao() {
  let unidades = ['Macatuba', 'Jundiaí I', 'Jundiaí II'];
  let usuarios = [];
  try {
    const cfg = Cache.get('config') || Cache.set('config', await Api.config());
    if (cfg && cfg.unidades && cfg.unidades.length) unidades = cfg.unidades;
    if (cfg && cfg.usuarios && cfg.usuarios.length) usuarios = cfg.usuarios;
  } catch (e) {
    // segue com a lista padrão embutida acima se a API ainda não estiver
    // configurada/no ar — assim a tela nunca fica travada em branco.
  }
  const existente = Session.get();

  setTimeout(() => {
    const form = document.getElementById('form-selecao');
    if (!form) return;

    // Escolher o nome já pré-seleciona a unidade da pessoa (quando ela não
    // é "geral") — continua editável, caso alguém precise trocar.
    if (form.nome && form.nome.tagName === 'SELECT') {
      form.nome.addEventListener('change', () => {
        const u = usuarios.find(x => x.nome === form.nome.value);
        if (u && u.unidade && u.unidade !== 'geral') {
          form.unidade.value = u.unidade;
        }
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = form.nome.value.trim();
      const unidade = form.unidade.value;
      if (!nome || !unidade) {
        toast('Escolha seu nome e a unidade.', 'erro');
        return;
      }
      Session.set(nome, unidade);
      Cache.clear();
      window.location.hash = '#/menu';
    });
  }, 0);

  const campoNome = usuarios.length
    ? `<select name="nome" required>
        <option value="" disabled ${!existente ? 'selected' : ''}>Selecione...</option>
        ${usuarios.map(u => `<option value="${escapeHtml(u.nome)}" ${existente && existente.nome === u.nome ? 'selected' : ''}>${escapeHtml(u.nome)}</option>`).join('')}
      </select>`
    : `<input type="text" name="nome" placeholder="Ex: Lucas" value="${escapeHtml(existente ? existente.nome : '')}" required />`;

  return `
    <div class="tela-selecao">
      <div class="tela-selecao__card">
        <div class="logo">🔧</div>
        <h1>Gestão de Manutenção</h1>
        <p class="subtitle">Macatuba · Jundiaí I · Jundiaí II</p>
        <form id="form-selecao">
          <label>Seu nome
            ${campoNome}
          </label>
          <label>Unidade
            <select name="unidade" required>
              <option value="" disabled ${!existente ? 'selected' : ''}>Selecione...</option>
              ${unidades.map(u => `<option value="${escapeHtml(u)}" ${existente && existente.unidade === u ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('')}
              <option value="Todas" ${existente && existente.unidade === 'Todas' ? 'selected' : ''}>Todas as unidades (dashboards)</option>
            </select>
          </label>
          <button type="submit" class="btn btn--primary btn--block">Entrar</button>
        </form>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Tela: Menu principal (cards de KPI)
// ---------------------------------------------------------------------

async function screenMenu() {
  const s = Session.get();

  // "Todas as unidades" só dá acesso aos 2 dashboards consolidados — sem
  // cadastro nem lançamento, já que essas ações precisam de uma unidade
  // específica.
  if (s.unidade === 'Todas') {
    return `
      ${header('Menu Principal', {})}
      <main class="container">
        <h2 class="section-title">Dashboards consolidados</h2>
        <section class="menu-grid">
          <button class="menu-tile" data-nav="#/dashboard-tempo-ocioso">
            <span class="menu-tile__icon">⏱️</span>
            <span class="menu-tile__label">Tempo Ocioso — todas as unidades</span>
          </button>
          <button class="menu-tile" data-nav="#/dashboard-custos">
            <span class="menu-tile__icon">💰</span>
            <span class="menu-tile__label">Gastos — todas as unidades</span>
          </button>
        </section>
      </main>`;
  }

  let dash;
  try {
    dash = await Api.dashboard(s.unidade);
  } catch (err) {
    return `${header('Menu', {})}<main class="container">${errorBlock(err, '#/menu')}</main>`;
  }

  const st = dash.preventivas.porStatus;
  const pct = Math.round((dash.preventivas.percEmDia || 0) * 100);

  return `
    ${header('Menu Principal', {})}
    <main class="container">
      <section class="kpi-grid">
        <div class="kpi-card kpi-card--accent">
          <span class="kpi-card__label">Preventivas em dia</span>
          <span class="kpi-card__value">${pct}%</span>
          <span class="kpi-card__sub">${dash.preventivas.total} preventivas no total</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Equipamentos cadastrados</span>
          <span class="kpi-card__value">${dash.totalEquipamentos}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Itens de armazém</span>
          <span class="kpi-card__value">${dash.totalEstruturas}</span>
        </div>
      </section>

      <section class="status-strip">
        <button class="status-pill status-pill--em_dia" data-nav="#/preventivas?status=em_dia"><span>🟢</span> ${st.em_dia} em dia</button>
        <button class="status-pill status-pill--proxima" data-nav="#/preventivas?status=proxima"><span>🟡</span> ${st.proxima} próxima</button>
        <button class="status-pill status-pill--para_hoje" data-nav="#/preventivas?status=para_hoje"><span>🟠</span> ${st.para_hoje} p/ hoje</button>
        <button class="status-pill status-pill--atrasada" data-nav="#/preventivas?status=atrasada"><span>🔴</span> ${st.atrasada} atrasada${st.atrasada === 1 ? '' : 's'}</button>
        ${st.pendente ? `<button class="status-pill status-pill--pendente" data-nav="#/preventivas?status=pendente"><span>⚪</span> ${st.pendente} pendente${st.pendente === 1 ? '' : 's'}</button>` : ''}
      </section>
      <p class="muted status-strip__dica">Clique num status acima para ver a lista já filtrada.</p>

      <h2 class="section-title">Cadastro</h2>
      <section class="menu-grid">
        <button class="menu-tile" data-nav="#/cadastro-equipamento">
          <span class="menu-tile__icon">🛠️</span>
          <span class="menu-tile__label">Cadastro de Equipamentos</span>
        </button>
        <button class="menu-tile" data-nav="#/cadastro-armazem">
          <span class="menu-tile__icon">🏬</span>
          <span class="menu-tile__label">Cadastro de Preventiva de Armazém</span>
        </button>
      </section>

      <h2 class="section-title">Operação</h2>
      <section class="menu-grid">
        <button class="menu-tile" data-nav="#/preventivas-equipamento">
          <span class="menu-tile__icon">⚙️</span>
          <span class="menu-tile__label">Preventivas de Equipamentos</span>
        </button>
        <button class="menu-tile" data-nav="#/preventivas-armazem">
          <span class="menu-tile__icon">📦</span>
          <span class="menu-tile__label">Preventivas de Armazém</span>
        </button>
        <button class="menu-tile" data-nav="#/manutencoes">
          <span class="menu-tile__icon">📝</span>
          <span class="menu-tile__label">Lançar Manutenção</span>
        </button>
        <button class="menu-tile" data-nav="#/manutencoes-corretivas">
          <span class="menu-tile__icon">🚨</span>
          <span class="menu-tile__label">Manutenções Corretivas</span>
        </button>
        <button class="menu-tile" data-nav="#/manutencoes-preventivas">
          <span class="menu-tile__icon">✅</span>
          <span class="menu-tile__label">Manutenções Preventivas</span>
        </button>
        <button class="menu-tile" data-nav="#/historico">
          <span class="menu-tile__icon">🗂️</span>
          <span class="menu-tile__label">Histórico</span>
        </button>
      </section>

      <h2 class="section-title">Dashboards</h2>
      <section class="menu-grid">
        <button class="menu-tile" data-nav="#/dashboard-custos">
          <span class="menu-tile__icon">💰</span>
          <span class="menu-tile__label">Gastos e Budget</span>
        </button>
        <button class="menu-tile" data-nav="#/dashboard-tempo-ocioso">
          <span class="menu-tile__icon">⏱️</span>
          <span class="menu-tile__label">Tempo Ocioso</span>
        </button>
      </section>
    </main>`;
}

// ---------------------------------------------------------------------
// Tela: Cadastro de Equipamento
// ---------------------------------------------------------------------

async function screenCadastroEquipamento() {
  const s = Session.get();
  let cfg, lista;
  try {
    cfg = Cache.get('config') || Cache.set('config', await Api.config());
    lista = await Api.equipamentos(s.unidade);
  } catch (err) {
    return `${header('Cadastro de Equipamentos', { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  setTimeout(() => bindCadastroForm({
    formId: 'form-cadastro-equip',
    build: (fd) => ({
      unidade: s.unidade,
      ativoPatrimonio: fd.get('ativoPatrimonio').trim(),
      equipamento: fd.get('equipamento').trim(),
      tipo: fd.get('tipo').trim(),
      frequencia: fd.get('frequencia'),
      fornecedor: fd.get('fornecedor').trim(),
    }),
    submit: (payload) => Api.criarEquipamento(payload),
    campoObrigatorio: 'equipamento',
    mensagemSucesso: 'Equipamento cadastrado! Já apareceu em Preventivas de Equipamentos.',
    hashAtual: '#/cadastro-equipamento',
  }), 0);

  return `
    ${header('Cadastro de Equipamentos', { back: '#/menu' })}
    <main class="container">
      <form id="form-cadastro-equip" class="card-form">
        <label>Equipamento *
          <input type="text" name="equipamento" placeholder="Ex: Empilhadeira Elétrica 01" required />
        </label>
        <label>Ativo / Patrimônio
          <input type="text" name="ativoPatrimonio" placeholder="Ex: PAT-0231" />
        </label>
        <label>Tipo
          <input type="text" name="tipo" placeholder="Ex: Empilhadeira, Paleteira, Rack..." />
        </label>
        <label>Frequência da preventiva
          <select name="frequencia">
            ${cfg.frequencias.map(f => `<option value="${escapeHtml(f)}" ${f === 'Anual' ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
          </select>
        </label>
        <label>Fornecedor padrão
          <input type="text" name="fornecedor" placeholder="Ex: Prestadora XYZ" />
        </label>
        <button type="submit" class="btn btn--primary btn--block">Cadastrar equipamento</button>
      </form>

      <h2 class="section-title">Equipamentos cadastrados (${lista.length})</h2>
      <div class="list">
        ${lista.length ? lista.slice().reverse().map(itemEquipamentoRow).join('') :
          '<p class="empty-state">Nenhum equipamento cadastrado ainda nesta unidade.</p>'}
      </div>
    </main>`;
}

function itemEquipamentoRow(r) {
  return `<div class="list-row">
    <div class="list-row__main">
      <strong>${escapeHtml(r['Equipamento'])}</strong>
      <span class="muted">${escapeHtml(r['Ativo / Patrimônio'] || '')}</span>
    </div>
    <div class="list-row__meta">
      <span>${escapeHtml(r['Tipo'] || '—')}</span>
      <span>${escapeHtml(r['Frequência Preventiva'] || '—')}</span>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------
// Tela: Cadastro de Preventiva de Armazém
// ---------------------------------------------------------------------

async function screenCadastroArmazem() {
  const s = Session.get();
  let cfg, lista;
  try {
    cfg = Cache.get('config') || Cache.set('config', await Api.config());
    lista = await Api.estruturas(s.unidade);
  } catch (err) {
    return `${header('Cadastro de Preventiva de Armazém', { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  setTimeout(() => bindCadastroForm({
    formId: 'form-cadastro-armazem',
    build: (fd) => ({
      unidade: s.unidade,
      categoria: fd.get('categoria').trim(),
      descricao: fd.get('descricao').trim(),
      prestador: fd.get('prestador').trim(),
      criticidade: fd.get('criticidade'),
      frequencia: fd.get('frequencia'),
    }),
    submit: (payload) => Api.criarEstrutura(payload),
    campoObrigatorio: 'descricao',
    mensagemSucesso: 'Item cadastrado! Já apareceu em Preventivas de Armazém.',
    hashAtual: '#/cadastro-armazem',
  }), 0);

  return `
    ${header('Cadastro de Preventiva de Armazém', { back: '#/menu' })}
    <main class="container">
      <form id="form-cadastro-armazem" class="card-form">
        <label>Descrição *
          <input type="text" name="descricao" placeholder="Ex: Porta de Doca 03" required />
        </label>
        <label>Categoria
          <input type="text" name="categoria" placeholder="Ex: Estrutura Metálica, Elétrica, Civil..." />
        </label>
        <label>Prestador
          <input type="text" name="prestador" placeholder="Ex: Prestadora ABC" />
        </label>
        <label>Criticidade
          <select name="criticidade">
            ${cfg.criticidades.map(c => `<option value="${escapeHtml(c)}" ${c === 'Média' ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
        </label>
        <label>Frequência da preventiva
          <select name="frequencia">
            ${cfg.frequencias.map(f => `<option value="${escapeHtml(f)}" ${f === 'Anual' ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="btn btn--primary btn--block">Cadastrar item</button>
      </form>

      <h2 class="section-title">Itens cadastrados (${lista.length})</h2>
      <div class="list">
        ${lista.length ? lista.slice().reverse().map(itemArmazemRow).join('') :
          '<p class="empty-state">Nenhum item cadastrado ainda nesta unidade.</p>'}
      </div>
    </main>`;
}

function itemArmazemRow(r) {
  return `<div class="list-row">
    <div class="list-row__main">
      <strong>${escapeHtml(r['Descrição'] || r['Categoria'])}</strong>
      <span class="muted">${escapeHtml(r['Categoria'] || '')}</span>
    </div>
    <div class="list-row__meta">
      <span>${escapeHtml(r['Criticidade'] || '—')}</span>
      <span>${escapeHtml(r['Frequência'] || '—')}</span>
    </div>
  </div>`;
}

/** Lógica compartilhada dos dois formulários de cadastro acima. */
function bindCadastroForm({ formId, build, submit, campoObrigatorio, mensagemSucesso, hashAtual }) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = build(fd);
    if (!payload[campoObrigatorio]) {
      toast('Preencha o campo obrigatório (*).', 'erro');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      await submit(payload);
      Cache.clear();
      toast(mensagemSucesso, 'sucesso');
      form.reset();
      // recarrega a tela pra lista aparecer atualizada
      const current = window.location.hash;
      window.location.hash = '#/menu';
      setTimeout(() => { window.location.hash = current; }, 0);
    } catch (err) {
      toast(err.message || 'Erro ao salvar.', 'erro');
      btn.disabled = false;
      btn.textContent = form === document.getElementById('form-cadastro-equip') ? 'Cadastrar equipamento' : 'Cadastrar item';
    }
  });
}

// ---------------------------------------------------------------------
// Tela: Preventivas (operacional) — equipamento | armazem
// ---------------------------------------------------------------------

const STATUS_ORDEM = ['atrasada', 'para_hoje', 'proxima', 'em_dia', 'pendente'];
const STATUS_LABEL = {
  atrasada: '🔴 Atrasada', para_hoje: '🟠 Para hoje', proxima: '🟡 Próxima',
  em_dia: '🟢 Em dia', pendente: '⚪ Pendente',
};

async function screenPreventivas(tipo, query) {
  const s = Session.get();
  const isTodas = tipo === 'todas';
  const titulo = isTodas ? 'Preventivas (Equipamentos + Armazém)'
    : (tipo === 'equipamento' ? 'Preventivas de Equipamentos' : 'Preventivas de Armazém');
  let lista;
  try {
    if (isTodas) {
      const [eq, arm] = await Promise.all([Api.preventivasEquipamentos(s.unidade), Api.preventivasArmazem(s.unidade)]);
      lista = eq.map(r => Object.assign({}, r, { _tipo: 'equipamento', _nome: r['Equipamento'] }))
        .concat(arm.map(r => Object.assign({}, r, { _tipo: 'armazem', _nome: r['Equipamento / Estrutura'] })));
    } else if (tipo === 'equipamento') {
      lista = (await Api.preventivasEquipamentos(s.unidade)).map(r => Object.assign({}, r, { _tipo: 'equipamento', _nome: r['Equipamento'] }));
    } else {
      lista = (await Api.preventivasArmazem(s.unidade)).map(r => Object.assign({}, r, { _tipo: 'armazem', _nome: r['Equipamento / Estrutura'] }));
    }
  } catch (err) {
    return `${header(titulo, { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  lista.sort((a, b) => STATUS_ORDEM.indexOf(a._status.codigo) - STATUS_ORDEM.indexOf(b._status.codigo));

  const statusInicial = (query && query.get('status')) || '';
  setTimeout(() => bindPreventivasScreen(statusInicial), 0);

  return `
    ${header(titulo, { back: '#/menu' })}
    <main class="container">
      <div class="filtros">
        <input type="search" id="busca-preventiva" placeholder="Buscar por nome..." />
        <select id="filtro-status">
          <option value="">Todos os status</option>
          ${STATUS_ORDEM.map(c => `<option value="${c}" ${c === statusInicial ? 'selected' : ''}>${STATUS_LABEL[c]}</option>`).join('')}
        </select>
      </div>
      <div class="list" id="lista-preventivas">
        ${lista.length ? lista.map(r => rowPreventiva(r, isTodas)).join('') :
          '<p class="empty-state">Nenhuma preventiva cadastrada ainda nesta unidade.</p>'}
      </div>

      <div class="modal-backdrop" id="modal-realizar" hidden>
        <div class="modal">
          <h3>Marcar preventiva como realizada</h3>
          <p id="modal-item-nome" class="muted"></p>
          <form id="form-realizar">
            <div id="campos-equip">
              <label>Data/Hora Início <span class="muted">(quando o equipamento parou)</span>
                <input type="datetime-local" name="dataInicio" />
              </label>
              <label>Data/Hora Fim <span class="muted">(quando voltou a funcionar)</span>
                <input type="datetime-local" name="dataFim" />
              </label>
              <p class="tempo-parado-preview">Tempo parado: <strong id="tempo-parado-valor">—</strong></p>
            </div>
            <div id="campos-armazem">
              <label>Data da realização
                <input type="date" name="dataRealizacao" />
              </label>
            </div>
            <label>Observação
              <textarea name="observacao" rows="3" placeholder="Opcional"></textarea>
            </label>
            <label>Certificação / comprovante <span class="muted">(opcional — foto ou PDF, fica salvo para auditoria)</span>
              <input type="file" name="anexo" accept="image/*,.pdf" />
            </label>
            <div class="modal__actions">
              <button type="button" class="btn btn--secondary" data-action="fechar-modal">Cancelar</button>
              <button type="submit" class="btn btn--primary">Confirmar</button>
            </div>
          </form>
        </div>
      </div>
    </main>`;
}

function rowPreventiva(r, mostrarTipo) {
  const codigo = r._status.codigo;
  return `<div class="list-row list-row--preventiva" data-nome="${escapeHtml((r._nome || '').toLowerCase())}" data-status="${codigo}">
    <div class="list-row__main">
      <strong>${escapeHtml(r._nome || '—')}</strong>
      <span class="muted">${mostrarTipo ? (r._tipo === 'equipamento' ? '⚙️ Equipamento · ' : '📦 Armazém · ') : ''}Última: ${fmtDate(r['Última Preventiva'])} · Próxima: ${fmtDate(r['Próxima Preventiva'])}</span>
    </div>
    <div class="list-row__side">
      <span class="badge badge--${codigo}">${STATUS_LABEL[codigo]}</span>
      <button class="btn btn--small" data-id="${escapeHtml(r['ID_Preventiva'])}" data-tipo="${r._tipo}" data-nome-item="${escapeHtml(r._nome || '')}" data-action="abrir-modal">Marcar realizada</button>
    </div>
  </div>`;
}

function bindPreventivasScreen(statusInicial) {
  const busca = document.getElementById('busca-preventiva');
  const filtroStatus = document.getElementById('filtro-status');
  const aplicarFiltro = () => {
    const termo = (busca.value || '').toLowerCase();
    const status = filtroStatus.value;
    document.querySelectorAll('#lista-preventivas .list-row--preventiva').forEach(el => {
      const bateNome = !termo || el.dataset.nome.includes(termo);
      const bateStatus = !status || el.dataset.status === status;
      el.style.display = (bateNome && bateStatus) ? '' : 'none';
    });
  };
  busca && busca.addEventListener('input', aplicarFiltro);
  filtroStatus && filtroStatus.addEventListener('change', aplicarFiltro);
  if (statusInicial) aplicarFiltro();

  const modal = document.getElementById('modal-realizar');
  const form = document.getElementById('form-realizar');
  const camposEquip = document.getElementById('campos-equip');
  const camposArmazem = document.getElementById('campos-armazem');
  let idAtual = null;
  let tipoAtual = null;

  function atualizarTempoParadoPreview() {
    const preview = document.getElementById('tempo-parado-valor');
    if (!preview || !form.dataInicio.value || !form.dataFim.value) { if (preview) preview.textContent = '—'; return; }
    const inicio = new Date(form.dataInicio.value);
    const fim = new Date(form.dataFim.value);
    const horas = (fim - inicio) / 3600000;
    preview.textContent = horas > 0 ? fmtHoras(horas) : 'data fim antes do início';
  }

  document.querySelectorAll('[data-action="abrir-modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      idAtual = btn.dataset.id;
      tipoAtual = btn.dataset.tipo;
      const isEquip = tipoAtual === 'equipamento';
      camposEquip.hidden = !isEquip;
      camposArmazem.hidden = isEquip;
      form.dataInicio.required = isEquip;
      form.dataFim.required = isEquip;
      form.dataRealizacao.required = !isEquip;
      document.getElementById('modal-item-nome').textContent = btn.dataset.nomeItem;
      const agora = new Date();
      const agoraLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      if (isEquip) {
        form.dataInicio.value = agoraLocal;
        form.dataFim.value = agoraLocal;
        atualizarTempoParadoPreview();
      } else {
        form.dataRealizacao.value = agoraLocal.slice(0, 10);
      }
      form.observacao.value = '';
      form.anexo.value = '';
      modal.hidden = false;
    });
  });

  form.dataInicio.addEventListener('input', atualizarTempoParadoPreview);
  form.dataFim.addEventListener('input', atualizarTempoParadoPreview);

  modal.querySelectorAll('[data-action="fechar-modal"]').forEach(el => el.addEventListener('click', () => { modal.hidden = true; }));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      const isEquip = tipoAtual === 'equipamento';
      const payload = {
        tipo: tipoAtual, idPreventiva: idAtual,
        observacao: form.observacao.value.trim(),
        registradoPor: (Session.get() || {}).nome || '',
      };
      if (isEquip) {
        if (new Date(form.dataFim.value) < new Date(form.dataInicio.value)) {
          throw new Error('A data/hora de fim não pode ser antes do início.');
        }
        payload.dataInicio = form.dataInicio.value;
        payload.dataFim = form.dataFim.value;
      } else {
        payload.dataRealizacao = form.dataRealizacao.value;
      }
      const anexo = await fileParaBase64(form.anexo);
      if (anexo.base64) { payload.anexoBase64 = anexo.base64; payload.anexoNome = anexo.nome; }
      await Api.marcarPreventivaRealizada(payload);
      Cache.clear();
      toast('Preventiva marcada como realizada!', 'sucesso');
      modal.hidden = true;
      const current = window.location.hash;
      window.location.hash = '#/menu';
      setTimeout(() => { window.location.hash = current; }, 0);
    } catch (err) {
      toast(err.message || 'Erro ao salvar.', 'erro');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirmar';
    }
  });
}

// ---------------------------------------------------------------------
// Tela: Lançar Manutenção (corretiva OU preventiva — mesma tela, um
// seletor de tipo; o histórico depois fica em 2 abas separadas, ver
// screenListaManutencoes)
// ---------------------------------------------------------------------

const TIPOS_PRINCIPAIS = ['CORRETIVA', 'PREVENTIVA'];

async function screenLancarManutencao() {
  const s = Session.get();
  let cfg, equipamentos, estruturas;
  try {
    cfg = Cache.get('config') || Cache.set('config', await Api.config());
    [equipamentos, estruturas] = await Promise.all([Api.equipamentos(s.unidade), Api.estruturas(s.unidade)]);
  } catch (err) {
    return `${header('Lançar Manutenção', { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  setTimeout(() => bindLancarManutencaoForm(), 0);

  const opcoesEquip = equipamentos.map(e => `<option value="${escapeHtml(e['Equipamento'])}">⚙️ ${escapeHtml(e['Equipamento'])}</option>`).join('');
  const opcoesEstrutura = estruturas.map(e => `<option value="${escapeHtml(e['Descrição'] || e['Categoria'])}">📦 ${escapeHtml(e['Descrição'] || e['Categoria'])}</option>`).join('');
  const outrosTipos = cfg.tiposManutencao.filter(t => TIPOS_PRINCIPAIS.indexOf(t) === -1);

  return `
    ${header('Lançar Manutenção', { back: '#/menu' })}
    <main class="container">
      <form id="form-manutencao" class="card-form">
        <label>Tipo de lançamento *</label>
        <div class="segmented" id="segmented-tipo">
          <button type="button" class="segmented__btn segmented__btn--ativo" data-tipo="CORRETIVA">🚨 Corretiva</button>
          <button type="button" class="segmented__btn" data-tipo="PREVENTIVA">✅ Preventiva</button>
        </div>
        <label>Outro tipo <span class="muted">(instalação, ponto de melhoria etc. — deixe em branco para usar o botão acima)</span>
          <select name="tipoOutro">
            <option value="">— usar Corretiva/Preventiva acima —</option>
            ${outrosTipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
          </select>
        </label>
        <input type="hidden" name="tipo" value="CORRETIVA" />

        <label>Equipamento / Local *
          <select name="equipamentoSelect" required>
            <option value="" disabled selected>Selecione no cadastro...</option>
            ${opcoesEquip}
            ${opcoesEstrutura}
            <option value="__outro__">Outro (não está na lista — digitar)</option>
          </select>
        </label>
        <label id="campo-equipamento-outro" hidden>Nome do equipamento/local *
          <input type="text" name="equipamentoOutro" placeholder="Ex: Empilhadeira Elétrica 01" />
        </label>

        <label>Classificação *
          <select name="classificacao" required>
            ${cfg.classificacoes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
        </label>
        <label>Responsável / Prestador
          <input type="text" name="responsavel" placeholder="Ex: Prestadora XYZ" />
        </label>
        <label>Data/Hora Início * <span class="muted">(quando parou)</span>
          <input type="datetime-local" name="dataInicio" required />
        </label>
        <label>Data/Hora Fim * <span class="muted">(quando voltou a funcionar)</span>
          <input type="datetime-local" name="dataFim" required />
        </label>
        <p class="tempo-parado-preview">Tempo parado: <strong id="tempo-parado-corretiva">—</strong></p>
        <label>Descrição do serviço
          <textarea name="descricao" rows="3" placeholder="O que foi feito"></textarea>
        </label>
        <label>Valor (R$) *
          <input type="number" name="valor" step="0.01" min="0" placeholder="0,00" required />
        </label>
        <label>Anexo (orçamento / nota / certificação) *
          <input type="file" name="anexo" accept="image/*,.pdf" required />
        </label>
        <button type="submit" class="btn btn--primary btn--block">Registrar lançamento</button>
      </form>
    </main>`;
}

function bindLancarManutencaoForm() {
  const form = document.getElementById('form-manutencao');
  if (!form) return;

  form.querySelectorAll('.segmented__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.segmented__btn').forEach(b => b.classList.remove('segmented__btn--ativo'));
      btn.classList.add('segmented__btn--ativo');
      form.tipo.value = btn.dataset.tipo;
      form.tipoOutro.value = '';
    });
  });
  form.tipoOutro.addEventListener('change', () => {
    if (form.tipoOutro.value) {
      form.querySelectorAll('.segmented__btn').forEach(b => b.classList.remove('segmented__btn--ativo'));
    }
  });

  form.equipamentoSelect.addEventListener('change', () => {
    const outroCampo = document.getElementById('campo-equipamento-outro');
    const isOutro = form.equipamentoSelect.value === '__outro__';
    outroCampo.hidden = !isOutro;
    form.equipamentoOutro.required = isOutro;
  });

  function atualizarPreview() {
    const preview = document.getElementById('tempo-parado-corretiva');
    if (!form.dataInicio.value || !form.dataFim.value) { preview.textContent = '—'; return; }
    const horas = (new Date(form.dataFim.value) - new Date(form.dataInicio.value)) / 3600000;
    preview.textContent = horas > 0 ? fmtHoras(horas) : 'data fim antes do início';
  }
  form.dataInicio.addEventListener('input', atualizarPreview);
  form.dataFim.addEventListener('input', atualizarPreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = Session.get();
    if (new Date(form.dataFim.value) < new Date(form.dataInicio.value)) {
      toast('A data/hora de fim não pode ser antes do início.', 'erro');
      return;
    }
    const equipamento = form.equipamentoSelect.value === '__outro__'
      ? form.equipamentoOutro.value.trim()
      : form.equipamentoSelect.value;
    if (!equipamento) {
      toast('Escolha (ou digite) o equipamento/local.', 'erro');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      const anexo = await fileParaBase64(form.anexo);
      if (!anexo.base64) throw new Error('Anexe o orçamento/comprovante/certificação (campo obrigatório).');
      await Api.criarCorretiva({
        unidade: s.unidade,
        classificacao: form.classificacao.value,
        tipo: form.tipoOutro.value || form.tipo.value,
        equipamento: equipamento,
        responsavel: form.responsavel.value.trim(),
        dataInicio: form.dataInicio.value,
        dataFim: form.dataFim.value,
        descricao: form.descricao.value.trim(),
        valor: form.valor.value,
        anexoBase64: anexo.base64,
        anexoNome: anexo.nome,
        registradoPor: s.nome || '',
      });
      Cache.clear();
      toast('Manutenção registrada!', 'sucesso');
      form.reset();
      window.location.hash = '#/menu';
    } catch (err) {
      toast(err.message || 'Erro ao salvar.', 'erro');
      btn.disabled = false;
      btn.textContent = 'Registrar lançamento';
    }
  });
}

// ---------------------------------------------------------------------
// Telas: Manutenções Corretivas / Preventivas (listagem, cada uma na sua
// aba — o lançamento de ambas acontece na tela única acima)
// ---------------------------------------------------------------------

async function screenListaManutencoes(tipoFiltro) {
  const s = Session.get();
  const isPrev = tipoFiltro === 'PREVENTIVA';
  const titulo = isPrev ? 'Manutenções Preventivas (com custo)' : 'Manutenções Corretivas';
  let lista;
  try {
    lista = await Api.custos(s.unidade, { tipo: tipoFiltro });
  } catch (err) {
    return `${header(titulo, { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  return `
    ${header(titulo, { back: '#/menu' })}
    <main class="container">
      <button class="btn btn--primary btn--block" data-nav="#/manutencoes">+ Lançar ${isPrev ? 'preventiva' : 'corretiva'}</button>
      <h2 class="section-title">Lançamentos (${lista.length})</h2>
      <div class="list">
        ${lista.length ? lista.map(itemCorretivaRow).join('') :
          `<p class="empty-state">Nenhum lançamento de ${isPrev ? 'preventiva' : 'corretiva'} ainda nesta unidade.</p>`}
      </div>
    </main>`;
}

function itemCorretivaRow(r) {
  const tempo = r['Tempo Parada (h)'];
  const anexo = r['Anexo'];
  return `<div class="list-row">
    <div class="list-row__main">
      <strong>${escapeHtml(r['Equipamento'] || '—')}</strong>
      <span class="muted">${escapeHtml(r['Tipo'] || '')} · ${fmtDate(r['Data Início'])}${tempo ? ' · ' + fmtHoras(tempo) + ' parado' : ''}${r['Registrado Por'] ? ' · por ' + escapeHtml(r['Registrado Por']) : ''}</span>
    </div>
    <div class="list-row__meta">
      <span>${fmtMoney(r['Valor'])}</span>
      <span>${escapeHtml(r['Responsável'] || '—')}</span>
      ${anexo ? `<a href="${escapeHtml(anexo)}" target="_blank" rel="noopener" class="anexo-link">📎 Anexo</a>` : ''}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------
// Tela: Histórico
// ---------------------------------------------------------------------

async function screenHistorico() {
  const s = Session.get();
  let cfg, lista;
  try {
    cfg = Cache.get('config') || Cache.set('config', await Api.config());
    lista = await Api.historico(s.unidade, {});
  } catch (err) {
    return `${header('Histórico', { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  setTimeout(() => bindHistoricoScreen(cfg), 0);

  const anos = Array.from(new Set(lista.map(r => r['Data da Realização'] ? r['Data da Realização'].slice(0, 4) : null).filter(Boolean))).sort().reverse();

  return `
    ${header('Histórico de Preventivas', { back: '#/menu' })}
    <main class="container">
      <div class="filtros filtros--wrap">
        <input type="search" id="hist-busca" placeholder="Buscar equipamento/estrutura..." />
        <select id="hist-classificacao">
          <option value="">Todas as classificações</option>
          ${cfg.classificacoes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
        <select id="hist-ano">
          <option value="">Todos os anos</option>
          ${anos.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>
      </div>
      <div class="list" id="lista-historico">
        ${lista.length ? lista.map(itemHistoricoRow).join('') :
          '<p class="empty-state">Nenhum histórico registrado ainda nesta unidade.</p>'}
      </div>
    </main>`;
}

function itemHistoricoRow(r) {
  const tempo = r['Tempo Parada (h)'];
  const nome = r['Equipamento / Estrutura'] || '—';
  const ano = r['Data da Realização'] ? r['Data da Realização'].slice(0, 4) : '';
  const anexo = r['Documento / Anexo'];
  return `<div class="list-row" data-nome="${escapeHtml(nome.toLowerCase())}" data-classificacao="${escapeHtml(r['Classificação'] || '')}" data-ano="${ano}">
    <div class="list-row__main">
      <strong>${escapeHtml(nome)}</strong>
      <span class="muted">${escapeHtml(r['Classificação'] || '')} · ${fmtDate(r['Data da Realização'])}${tempo ? ' · ' + fmtHoras(tempo) + ' parado' : ''}${r['Registrado Por'] ? ' · por ' + escapeHtml(r['Registrado Por']) : ''}</span>
    </div>
    <div class="list-row__meta">
      <span>${escapeHtml(r['Prestadora'] || '—')}</span>
      <span>${escapeHtml(r['Serviço Realizado'] || '')}</span>
      ${anexo ? `<a href="${escapeHtml(anexo)}" target="_blank" rel="noopener" class="anexo-link">📎 Certificação</a>` : ''}
    </div>
  </div>`;
}

function bindHistoricoScreen() {
  const busca = document.getElementById('hist-busca');
  const classif = document.getElementById('hist-classificacao');
  const ano = document.getElementById('hist-ano');
  const aplicar = () => {
    const termo = (busca.value || '').toLowerCase();
    document.querySelectorAll('#lista-historico .list-row').forEach(el => {
      const bateNome = !termo || el.dataset.nome.includes(termo);
      const bateClassif = !classif.value || el.dataset.classificacao === classif.value;
      const bateAno = !ano.value || el.dataset.ano === ano.value;
      el.style.display = (bateNome && bateClassif && bateAno) ? '' : 'none';
    });
  };
  [busca, classif, ano].forEach(el => el && el.addEventListener('input', aplicar));
}

// ---------------------------------------------------------------------
// Tela: Dashboard de Gastos (budget / saldo / gasto)
// ---------------------------------------------------------------------

async function screenDashboardCustos() {
  const s = Session.get();
  const todas = s.unidade === 'Todas';
  let d;
  try {
    d = await Api.dashboardCustos(s.unidade, '');
  } catch (err) {
    return `${header('Gastos e Budget', { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  const evolucao = (d.evolucaoMensal || []).map(m => ({ label: fmtMesLabel(m.mes), value: m.valor }));
  const porTipo = (d.custoPorTipo || []).map(t => ({ label: t.tipo, value: t.valor }));

  const blocoUnidade = (nome, budget, gasto, saldo) => `
    <div class="custo-card">
      <h3>${escapeHtml(nome)}</h3>
      <div class="custo-card__grid">
        <div><span class="muted">Budget</span><strong>${fmtMoney(budget.total)}</strong></div>
        <div><span class="muted">Gasto</span><strong class="cor-gasto">${fmtMoney(gasto.total)}</strong></div>
        <div><span class="muted">Saldo</span><strong class="${saldo.total >= 0 ? 'cor-saldo-ok' : 'cor-saldo-neg'}">${fmtMoney(saldo.total)}</strong></div>
      </div>
      ${(budget.equipamentos || budget.predial) ? `
      <div class="custo-card__split">
        <div>
          <span class="muted">Equipamentos</span>
          <span>Budget ${fmtMoney(budget.equipamentos)} · Gasto ${fmtMoney(gasto.equipamentos)} · Saldo <span class="${(budget.equipamentos - gasto.equipamentos) >= 0 ? 'cor-saldo-ok' : 'cor-saldo-neg'}">${fmtMoney(budget.equipamentos - gasto.equipamentos)}</span></span>
        </div>
        <div>
          <span class="muted">Predial</span>
          <span>Budget ${fmtMoney(budget.predial)} · Gasto ${fmtMoney(gasto.predial)} · Saldo <span class="${(budget.predial - gasto.predial) >= 0 ? 'cor-saldo-ok' : 'cor-saldo-neg'}">${fmtMoney(budget.predial - gasto.predial)}</span></span>
        </div>
      </div>` : ''}
    </div>`;

  const cardsPorUnidade = todas
    ? `<div class="custo-card-grid">
        <div class="custo-card custo-card--total">
          <h3>🏢 Corporativo (3 unidades)</h3>
          <div class="custo-card__grid">
            <div><span class="muted">Budget</span><strong>${fmtMoney(d.budgetTotal)}</strong></div>
            <div><span class="muted">Gasto</span><strong class="cor-gasto">${fmtMoney(d.gastoTotal)}</strong></div>
            <div><span class="muted">Saldo</span><strong class="${d.saldoTotal >= 0 ? 'cor-saldo-ok' : 'cor-saldo-neg'}">${fmtMoney(d.saldoTotal)}</strong></div>
          </div>
        </div>
        ${d.porUnidade.map(u => blocoUnidade('📍 ' + u.unidade, u.budget, u.gasto, u.saldo)).join('')}
      </div>`
    : `<div class="custo-card-grid">${blocoUnidade(s.unidade, d.budget, d.gasto, d.saldo)}</div>`;

  const graficoPorUnidade = todas
    ? `<h2 class="section-title">Gasto por unidade</h2>
       ${barList((d.custoPorUnidade || []).map(u => ({ label: u.unidade, value: u.valor })), { fmt: fmtMoney, vazio: 'Sem lançamentos ainda.' })}`
    : '';

  return `
    ${header('Gastos e Budget' + (todas ? ' — todas as unidades' : ''), { back: '#/menu' })}
    <main class="container">
      ${cardsPorUnidade}
      ${graficoPorUnidade}

      <h2 class="section-title">Custo por tipo de manutenção</h2>
      ${barList(porTipo, { fmt: fmtMoney, vazio: 'Sem lançamentos de custo ainda. Lançamentos de preventiva com valor (tela "Lançar Manutenção") também entram aqui.' })}

      <h2 class="section-title">Evolução mensal de custos</h2>
      ${barList(evolucao, { fmt: fmtMoney, vazio: 'Sem lançamentos com data ainda.' })}
    </main>`;
}

// ---------------------------------------------------------------------
// Tela: Dashboard de Tempo Ocioso
// ---------------------------------------------------------------------

async function screenDashboardTempoOcioso() {
  const s = Session.get();
  const todas = s.unidade === 'Todas';
  let d;
  try {
    d = await Api.dashboardTempoOcioso(s.unidade);
  } catch (err) {
    return `${header('Tempo Ocioso', { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  const graficoPorUnidade = todas
    ? `<h2 class="section-title">Tempo parado por unidade</h2>
       ${barList((d.porUnidade || []).map(u => ({ label: u.unidade, value: u.horasTotal })), { fmt: fmtHoras, vazio: 'Sem paradas registradas ainda.' })}
       <div class="kpi-grid kpi-grid--compacto">
         ${(d.porUnidade || []).map(u => `
           <div class="kpi-card">
             <span class="kpi-card__label">📍 ${escapeHtml(u.unidade)}</span>
             <span class="kpi-card__value">${fmtHoras(u.horasTotal)}</span>
             <span class="kpi-card__sub">${u.totalEquipamentosParados} equip. · ${u.totalRecorrentes} recorrente${u.totalRecorrentes === 1 ? '' : 's'}</span>
           </div>`).join('')}
       </div>`
    : '';

  return `
    ${header('Tempo Ocioso' + (todas ? ' — todas as unidades' : ''), { back: '#/menu' })}
    <main class="container">
      <section class="kpi-grid">
        <div class="kpi-card kpi-card--accent">
          <span class="kpi-card__label">Equipamentos com parada registrada</span>
          <span class="kpi-card__value">${d.totalEquipamentosParados}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Tempo total parado</span>
          <span class="kpi-card__value">${fmtHoras(d.horasTotal)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">Recorrentes (pararam +1x)</span>
          <span class="kpi-card__value">${d.totalRecorrentes}</span>
        </div>
      </section>

      ${graficoPorUnidade}

      <h2 class="section-title">Por equipamento</h2>
      <div class="list">
        ${d.equipamentos.length ? d.equipamentos.map(e => `
          <div class="list-row">
            <div class="list-row__main">
              <strong>${escapeHtml(e.equipamento || '—')}</strong>
              <span class="muted">${todas ? escapeHtml(e.unidade) + ' · ' : ''}${e.ocorrencias} parada${e.ocorrencias === 1 ? '' : 's'}</span>
            </div>
            <div class="list-row__side">
              <span class="badge badge--${e.recorrente ? 'atrasada' : 'em_dia'}">${e.recorrente ? '🔁 Recorrente' : 'Único'}</span>
              <strong>${fmtHoras(e.horasTotal)}</strong>
            </div>
          </div>`).join('') :
          '<p class="empty-state">Nenhuma parada de equipamento registrada ainda.</p>'}
      </div>
    </main>`;
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

router();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline first load ok falhar silenciosamente */ });
  });
}
