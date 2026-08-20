/**
 * app.js — roteador e telas do app (Fase 1):
 *   #/selecao                     seleção de nome + unidade
 *   #/menu                        menu principal com cards de KPI
 *   #/cadastro-equipamento        cadastro de equipamento (+ lista)
 *   #/cadastro-armazem            cadastro de preventiva de armazém (+ lista)
 *   #/preventivas-equipamento     operação: preventivas de equipamentos
 *   #/preventivas-armazem         operação: preventivas de armazém
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
  '#/preventivas-equipamento': () => screenPreventivas('equipamento'),
  '#/preventivas-armazem': () => screenPreventivas('armazem'),
};

async function router() {
  let hash = window.location.hash || '#/selecao';
  const session = Session.get();
  if (!session && hash !== '#/selecao') {
    window.location.hash = '#/selecao';
    return;
  }
  const screen = routes[hash] || screenNotFound;
  root.innerHTML = loadingBlock('Carregando...');
  try {
    const html = await screen();
    root.innerHTML = html;
    window.scrollTo(0, 0);
  } catch (err) {
    root.innerHTML = errorBlock(err, hash);
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
  try {
    const cfg = Cache.get('config') || Cache.set('config', await Api.config());
    if (cfg && cfg.unidades && cfg.unidades.length) unidades = cfg.unidades;
  } catch (e) {
    // segue com a lista padrão embutida acima se a API ainda não estiver
    // configurada/no ar — assim a tela nunca fica travada em branco.
  }
  const existente = Session.get();

  setTimeout(() => {
    const form = document.getElementById('form-selecao');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = form.nome.value.trim();
      const unidade = form.unidade.value;
      if (!nome || !unidade) {
        toast('Preencha seu nome e escolha a unidade.', 'erro');
        return;
      }
      Session.set(nome, unidade);
      Cache.clear();
      window.location.hash = '#/menu';
    });
  }, 0);

  return `
    <div class="tela-selecao">
      <div class="tela-selecao__card">
        <div class="logo">🔧</div>
        <h1>Gestão de Manutenção</h1>
        <p class="subtitle">Macatuba · Jundiaí I · Jundiaí II</p>
        <form id="form-selecao">
          <label>Seu nome
            <input type="text" name="nome" placeholder="Ex: Lucas" value="${escapeHtml(existente ? existente.nome : '')}" required />
          </label>
          <label>Unidade
            <select name="unidade" required>
              <option value="" disabled ${!existente ? 'selected' : ''}>Selecione...</option>
              ${unidades.map(u => `<option value="${escapeHtml(u)}" ${existente && existente.unidade === u ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('')}
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
        <div class="status-pill status-pill--em_dia"><span>🟢</span> ${st.em_dia} em dia</div>
        <div class="status-pill status-pill--proxima"><span>🟡</span> ${st.proxima} próxima</div>
        <div class="status-pill status-pill--para_hoje"><span>🟠</span> ${st.para_hoje} p/ hoje</div>
        <div class="status-pill status-pill--atrasada"><span>🔴</span> ${st.atrasada} atrasada${st.atrasada === 1 ? '' : 's'}</div>
        ${st.pendente ? `<div class="status-pill status-pill--pendente"><span>⚪</span> ${st.pendente} pendente${st.pendente === 1 ? '' : 's'}</div>` : ''}
      </section>

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

async function screenPreventivas(tipo) {
  const s = Session.get();
  const isEquip = tipo === 'equipamento';
  const titulo = isEquip ? 'Preventivas de Equipamentos' : 'Preventivas de Armazém';
  let lista;
  try {
    lista = isEquip ? await Api.preventivasEquipamentos(s.unidade) : await Api.preventivasArmazem(s.unidade);
  } catch (err) {
    return `${header(titulo, { back: '#/menu' })}<main class="container">${errorBlock(err)}</main>`;
  }

  lista.sort((a, b) => STATUS_ORDEM.indexOf(a._status.codigo) - STATUS_ORDEM.indexOf(b._status.codigo));

  setTimeout(() => bindPreventivasScreen(tipo, lista), 0);

  const nomeCol = isEquip ? 'Equipamento' : 'Equipamento / Estrutura';

  return `
    ${header(titulo, { back: '#/menu' })}
    <main class="container">
      <div class="filtros">
        <input type="search" id="busca-preventiva" placeholder="Buscar por nome..." />
        <select id="filtro-status">
          <option value="">Todos os status</option>
          ${STATUS_ORDEM.map(c => `<option value="${c}">${STATUS_LABEL[c]}</option>`).join('')}
        </select>
      </div>
      <div class="list" id="lista-preventivas">
        ${lista.length ? lista.map(r => rowPreventiva(r, nomeCol, tipo)).join('') :
          '<p class="empty-state">Nenhuma preventiva cadastrada ainda nesta unidade.</p>'}
      </div>

      <div class="modal-backdrop" id="modal-realizar" hidden>
        <div class="modal">
          <h3>Marcar preventiva como realizada</h3>
          <p id="modal-item-nome" class="muted"></p>
          <form id="form-realizar">
            <label>Data da realização
              <input type="date" name="dataRealizacao" required />
            </label>
            <label>Observação
              <textarea name="observacao" rows="3" placeholder="Opcional"></textarea>
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

function rowPreventiva(r, nomeCol, tipo) {
  const codigo = r._status.codigo;
  return `<div class="list-row list-row--preventiva" data-nome="${escapeHtml((r[nomeCol] || '').toLowerCase())}" data-status="${codigo}">
    <div class="list-row__main">
      <strong>${escapeHtml(r[nomeCol] || '—')}</strong>
      <span class="muted">Última: ${fmtDate(r['Última Preventiva'])} · Próxima: ${fmtDate(r['Próxima Preventiva'])}</span>
    </div>
    <div class="list-row__side">
      <span class="badge badge--${codigo}">${STATUS_LABEL[codigo]}</span>
      <button class="btn btn--small" data-id="${escapeHtml(r['ID_Preventiva'])}" data-tipo="${tipo}" data-nome-item="${escapeHtml(r[nomeCol] || '')}" data-action="abrir-modal">Marcar realizada</button>
    </div>
  </div>`;
}

function bindPreventivasScreen(tipo, listaOriginal) {
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

  const modal = document.getElementById('modal-realizar');
  const form = document.getElementById('form-realizar');
  let idAtual = null;

  document.querySelectorAll('[data-action="abrir-modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      idAtual = btn.dataset.id;
      document.getElementById('modal-item-nome').textContent = btn.dataset.nomeItem;
      form.dataRealizacao.value = new Date().toISOString().slice(0, 10);
      form.observacao.value = '';
      modal.hidden = false;
    });
  });

  modal.querySelectorAll('[data-action="fechar-modal"]').forEach(el => el.addEventListener('click', () => { modal.hidden = true; }));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      await Api.marcarPreventivaRealizada({
        tipo,
        idPreventiva: idAtual,
        dataRealizacao: form.dataRealizacao.value,
        observacao: form.observacao.value.trim(),
      });
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
// Boot
// ---------------------------------------------------------------------

router();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline first load ok falhar silenciosamente */ });
  });
}
