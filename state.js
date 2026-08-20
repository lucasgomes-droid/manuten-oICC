/**
 * state.js — sessão do usuário (nome + unidade, sem senha) e um cache leve
 * em memória das últimas listas carregadas, para as telas não ficarem
 * piscando/recarregando toda hora. Persiste em localStorage só o essencial
 * (nome e unidade) para "lembrar" o usuário entre aberturas do app.
 */

const Session = (() => {
  const KEY = 'gm_session_v1';

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function set(nome, unidade) {
    const value = { nome, unidade };
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (e) { /* modo privado etc. */ }
    return value;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  }

  return { get, set, clear };
})();

/** Cache em memória (não persiste) só para evitar refetch dentro da mesma navegação. */
const Cache = (() => {
  const store = {};
  return {
    get: (k) => store[k],
    set: (k, v) => { store[k] = v; return v; },
    clear: (k) => { if (k) delete store[k]; else Object.keys(store).forEach(x => delete store[x]); },
  };
})();
