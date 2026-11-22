/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function tagMatches(text) {
            return text.matchAll(/(?:^|[^\p{L}\p{M}\p{N}_#])#([\p{L}\p{M}\p{N}_-]+)/gu);
        }
        const tagColorSupported = typeof Highlight !== 'undefined' && !!CSS.highlights;
        let tagColorFrame = 0;
        function updateTagColors() {
            tagColorFrame = 0;
            if (!tagColorSupported) return;
            const highlight = new Highlight();
            if (state.settings.tagsEnabled) {
                document.querySelectorAll('.node-text, .node-description, .rich-note-editor, .search-result-title, #rich-note-title, #view-note-title').forEach(element => {
                    let text = '';
                    const pieces = [];
                    const blocks = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'LI', 'TR', 'TD', 'TH', 'BR']);
                    function collect(node) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            pieces.push({ node, start: text.length, end: text.length + node.data.length });
                            text += node.data;
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            const separator = node !== element && blocks.has(node.tagName);
                            if (separator) text += '\n';
                            node.childNodes.forEach(collect);
                            if (separator) text += '\n';
                        }
                    }
                    collect(element);
                    for (const match of tagMatches(text)) {
                        const start = match.index + match[0].length - match[1].length - 1;
                        const end = start + match[1].length + 1;
                        const first = pieces.find(piece => piece.start <= start && piece.end > start);
                        const last = pieces.find(piece => piece.start < end && piece.end >= end);
                        if (!first || !last) continue;
                        const range = document.createRange();
                        range.setStart(first.node, start - first.start);
                        range.setEnd(last.node, end - last.start);
                        highlight.add(range);
                    }
                });
            }
            CSS.highlights.set('smartlist-tag', highlight);
        }
        function scheduleTagColors() {
            if (tagColorSupported && !tagColorFrame) tagColorFrame = requestAnimationFrame(updateTagColors);
        }
        function nodeTags(node) {
            const tags = new Set();
            const note = node.description || (node.descriptionHtml ? exportNoteText(node) : '');
            const text = `${node.text}\n${note}`;
            for (const match of tagMatches(text)) {
                tags.add(`#${match[1].toLowerCase().normalize('NFC')}`);
            }
            return tags;
        }
        function collectTags() {
            const tags = new Map();
            state.documents.forEach(doc => allNodes(doc.nodes).forEach(({ node }) => {
                nodeTags(node).forEach(tag => tags.set(tag, (tags.get(tag) || 0) + 1));
            }));
            return tags;
        }
        function renderTagSidebar() {
            const section = document.getElementById('sidebar-tags');
            section.hidden = !state.settings.tagsEnabled;
            const list = document.getElementById('sidebar-tag-list');
            list.replaceChildren();
            if (!state.settings.tagsEnabled) return;
            const hidden = new Set(state.settings.hiddenTags);
            const tags = [...collectTags()].filter(([tag]) => !hidden.has(tag)).sort((a, b) => a[0].localeCompare(b[0]));
            tags.forEach(([tag]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `nav-item${currentView === 'tag' && selectedTag === tag ? ' active' : ''}`;
                button.title = tag;
                button.setAttribute('aria-label', tag);
                const name = document.createElement('span');
                name.className = 'tag-name';
                name.textContent = tag;
                button.appendChild(name);
                button.onclick = () => {
                    if (!closeAgendaEditor()) return;
                    selectedTag = tag;
                    currentView = 'tag';
                    render();
                    document.getElementById('starred-title').focus();
                };
                list.appendChild(button);
            });
        }
