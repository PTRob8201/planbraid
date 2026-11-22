/*
 * PlanBraid — License dialog
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Licensed under GNU AGPL version 3 or later; see LICENSE.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        const PLANBRAID_LICENSE = {
            name: 'GNU Affero General Public License v3.0 or later',
            spdx: 'AGPL-3.0-or-later',
            copyright: 'Copyright (C) 2026 Robert Wasniowski',
            textUrl: 'LICENSE',
            licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.html'
        };

        function showLicense() {
            document.getElementById('modal-root').innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal license-modal" role="dialog" aria-modal="true" aria-labelledby="license-title" style="width:min(640px,100%)">
                        <h2 id="license-title">License</h2>
                        <p class="license-copyright"></p>
                        <p>PlanBraid is free software: you can redistribute it and/or modify it under the terms of the <strong class="license-name"></strong> (<code class="license-spdx"></code>), as published by the Free Software Foundation.</p>
                        <p>PlanBraid is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the license text below for details.</p>
                        <p>If you run a modified version of PlanBraid as a network service, you must offer its complete source code to that service's users.</p>
                        <p><a href="https://github.com/PTRob8201/planbraid/tree/v2.1.4" target="_blank" rel="noopener noreferrer">Source code for this release</a>, including installation instructions and stylesheet sources. No account or workspace data is included.</p>
                        <p>The PlanBraid name and logo are not licensed under the AGPL. Distributed modified versions must use a different name and icon. Compiled Tailwind CSS files are third-party code under the MIT License.</p>
                        <p>Donations, including in-app purchases, are voluntary and do not grant a license or any additional rights.</p>
                        <details class="license-full">
                            <summary style="cursor:pointer;font-size:calc(12px * var(--font-scale, 1));font-weight:650">Show full license text</summary>
                            <pre class="license-text" tabindex="0" style="max-height:45vh;overflow:auto;margin:10px 0 0;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-soft);white-space:pre-wrap;font-size:calc(11px * var(--font-scale, 1));line-height:1.5">Loading…</pre>
                        </details>
                        <button class="modal-close" onclick="closeModal()">Close</button>
                    </section>
                </div>`;
            const modal = document.querySelector('#modal-root .license-modal');
            modal.querySelector('.license-copyright').textContent = PLANBRAID_LICENSE.copyright;
            modal.querySelector('.license-name').textContent = PLANBRAID_LICENSE.name;
            modal.querySelector('.license-spdx').textContent = PLANBRAID_LICENSE.spdx;
            const text = modal.querySelector('.license-text');
            modal.querySelector('.license-full').addEventListener('toggle', event => {
                if (!event.target.open || text.dataset.loaded) return;
                text.dataset.loaded = '1';
                fetch(PLANBRAID_LICENSE.textUrl, { cache: 'no-cache' })
                    .then(response => {
                        if (!response.ok) throw new Error(response.status);
                        return response.text();
                    })
                    .then(body => { text.textContent = body; })
                    .catch(() => {
                        text.textContent = 'The license text could not be loaded. Read it online: ';
                        const link = document.createElement('a');
                        link.href = PLANBRAID_LICENSE.licenseUrl;
                        link.target = '_blank';
                        link.rel = 'noopener';
                        link.textContent = PLANBRAID_LICENSE.licenseUrl;
                        text.appendChild(link);
                        delete text.dataset.loaded;
                    });
            });
            modal.querySelector('.modal-close').focus();
        }
