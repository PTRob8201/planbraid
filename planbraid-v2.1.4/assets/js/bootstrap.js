/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        const FONT_SIZE_KEY = 'smartlist-font-size';
        const FONT_SIZES = ['85', '100', '115', '130', '145'];
        const DESIGNS = ['classic', 'studio', 'modern', 'minimal', 'vibrant', 'fusion'];
        const DESIGN_STYLE_VERSION = new URL(document.currentScript.src).searchParams.get('v');
        function designIconHref(name) {
            const alternative = ['modern', 'minimal', 'vibrant', 'fusion'].includes(document.documentElement.dataset.design);
            return `#${alternative ? 'alt-' : ''}icon-${name}`;
        }
        function applyDesignIcons(root = document) {
            root.querySelectorAll('use[href^="#icon-"], use[href^="#alt-icon-"]').forEach(use => {
                const name = use.getAttribute('href').replace(/^#(?:alt-)?icon-/, '');
                use.setAttribute('href', designIconHref(name));
            });
        }
        function applyDesign(design) {
            if (!DESIGNS.includes(design)) throw new Error('The saved design is not valid.');
            const stylesheet = document.getElementById('design-stylesheet');
            stylesheet.onerror = () => {
                console.error(`Could not load the ${design} design stylesheet.`);
                showToast('Could not load the selected design stylesheet.');
            };
            const href = `assets/css/design-${design}.css?v=${encodeURIComponent(DESIGN_STYLE_VERSION)}`;
            if (stylesheet.getAttribute('href') !== href) stylesheet.setAttribute('href', href);
            const changed = document.documentElement.dataset.design !== design;
            document.documentElement.dataset.design = design;
            if (changed) applyDesignIcons();
        }
        function createIcon(name, filled = false) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', filled ? 'ui-icon ui-icon-filled' : 'ui-icon');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', designIconHref(name));
            svg.appendChild(use);
            return svg;
        }
        let fontSize = '100';
        let fontSizeStorageError = false;
        try {
            const savedFontSize = localStorage.getItem(FONT_SIZE_KEY);
            if (FONT_SIZES.includes(savedFontSize)) fontSize = savedFontSize;
            else if (savedFontSize !== null) {
                fontSizeStorageError = true;
                console.error('The saved font size preference is invalid.');
            }
        } catch (error) {
            fontSizeStorageError = true;
            console.error('Could not read the font size preference:', error);
        }
        document.documentElement.style.setProperty('--font-scale', Number(fontSize) / 100);
