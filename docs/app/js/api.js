/**
 * api.js — única camada que fala com o Apps Script (Web App). Nenhuma
 * outra parte do app faz fetch() diretamente; tudo passa por aqui, então
 * se um dia a URL/API mudar, só este arquivo precisa ser tocado.
 *
 * IMPORTANTE (CORS): POST é sempre enviado com Content-Type: text/plain
 * (nunca application/json) de propósito — é isso que evita o navegador
 * disparar um preflight OPTIONS, que o Apps Script Web App não responde
 * do jeito que o navegador espera. O corpo continua sendo um JSON válido
 * (só o cabeçalho HTTP é text/plain); o servidor faz JSON.parse normal.
 */

const Api = (() => {
  function baseUrl() {
    const url = window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL;
    if (!url || url.indexOf('COLE_AQUI') !== -1) {
      throw new Error('Configure a API_BASE_URL em js/config.js antes de usar o app.');
    }
    return url;
  }

  function withToken(params) {
    const token = window.APP_CONFIG && window.APP_CONFIG.API_TOKEN;
    if (token) params.token = token;
    return params;
  }

  async function get(action, params) {
    const qs = new URLSearchParams(withToken({ action, ...(params || {}) }));
    const res = await fetch(baseUrl() + '?' + qs.toString(), { method: 'GET' });
    return _parse(res);
  }

  async function post(action, payload) {
    const body = JSON.stringify(withToken({ action, payload: payload || {} }));
    const res = await fetch(baseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // ver nota CORS acima
      body,
    });
    return _parse(res);
  }

  async function _parse(res) {
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('Resposta inválida do servidor (HTTP ' + res.status + ').');
    }
    if (!json || json.ok !== true) {
      throw new Error((json && json.erro) || 'Erro desconhecido na API.');
    }
    return json.data;
  }

  return {
    ping: () => get('ping'),
    config: () => get('config'),
    unidades: () => get('unidades'),
    equipamentos: (unidade) => get('equipamentos', { unidade }),
    estruturas: (unidade) => get('estruturas', { unidade }),
    preventivasEquipamentos: (unidade) => get('preventivasEquipamentos', { unidade }),
    preventivasArmazem: (unidade) => get('preventivasArmazem', { unidade }),
    dashboard: (unidade) => get('dashboard', { unidade }),

    criarEquipamento: (payload) => post('criarEquipamento', payload),
    criarEstrutura: (payload) => post('criarEstrutura', payload),
    marcarPreventivaRealizada: (payload) => post('marcarPreventivaRealizada', payload),
  };
})();
