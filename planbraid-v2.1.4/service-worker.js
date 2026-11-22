/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
const CACHE_PREFIX = `planbraid-shell:${self.registration.scope}:`;
const CACHE = `${CACHE_PREFIX}2.1.4`;
const VERSION = '?v=2.1.4';
const shell = [
    'index.html',
    'LICENSE',
    ...['bootstrap', 'version', 'pm', 'templates', 'tags', 'views', 'notes',
        'agenda-spreadsheet', 'agenda-notes', 'reminders', 'export', 'account',
        'help', 'license', 'settings', 'offline', 'app'].map(name => `assets/js/${name}.js${VERSION}`),
    ...['tailwind', 'design-classic', 'design-studio', 'design-modern', 'design-minimal',
        'design-vibrant', 'design-fusion'].map(name => `assets/css/${name}.css${VERSION}`),
    ...['planbraid-logo', 'apple-touch-icon'].map(name => `assets/images/${name}.png${VERSION}`)
];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(shell)));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
    const index = new URL('index.html', self.registration.scope);
    const url = new URL(request.url);
    if (request.mode === 'navigate' && (url.pathname === index.pathname || url.pathname === new URL(self.registration.scope).pathname)) {
        event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match(index.href)));
        return;
    }
    if (!shell.slice(1).some(path => new URL(path, self.registration.scope).href === request.url)) return;
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});
