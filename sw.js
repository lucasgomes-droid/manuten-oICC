/**
 * sw.js — service worker mínimo: cacheia só o "shell" do app (HTML/CSS/JS/
 * ícones) para o app abrir rápido e funcionar offline (mesmo que sem dados
 * novos, já que estes vêm da API/planilha). Nunca cacheia chamadas à API
 * (script.google.com) — dados de preventivas/equipamentos são sempre
 * buscados na hora, para não mostrar informação desatualizada.
 *
 * Ao publicar uma atualização do app, mude CACHE_NAME (ex: v2, v3...) pra
 * forçar os usuários a pegarem os arquivos novos.
 */

const CACHE_NAME = 'gm-app-shell-v2';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/api.js',
  './js/state.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca intercepta chamadas de API cross-origin (Apps Script) — sempre
  // rede, sempre dado fresco.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
