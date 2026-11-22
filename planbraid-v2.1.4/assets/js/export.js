/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function exportBackup() {
            const file = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(file);
            link.download = 'outline-backup.json';
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('Your outline backup is ready.');
        }
        function exportNodeDetails(node, doc) {
            const details = [];
            if (node.completed) details.push('Done');
            if (node.starred) details.push('Starred');
            if (state.settings.priorityEnabled && node.priority && node.priority !== 'none') details.push(`${node.priority} priority`);
            if (node.dueDate) details.push(`Due ${node.dueDate}`);
            if (isPMProject(doc)) {
                if (node.pmTask) details.push(`Task: ${node.completed ? 'Done' : PM_BOARD_STATUS_LABELS[node.pmTask]}`);
                if (node.pmAssignee) details.push(`Assignee: ${node.pmAssignee}`);
                node.pmFieldNotes.forEach(entry => details.push(`Field note (${entry.at}): ${entry.text}`));
            }
            if (node.progressNode) details.push(`Sub-node progress: ${progressLabel(descendantProgress(node))}`);
            return details;
        }
        function exportRoots(doc) {
            const location = zoomNodeId && zoomDocumentId === doc.id ? findNode(zoomNodeId, doc.nodes) : null;
            return location ? [location.node] : doc.nodes;
        }
        function exportBranchExpanded(node, doc) {
            return !node.collapsed || branchesExpandedForFilter() || (zoomNodeId === node.id && zoomDocumentId === doc.id);
        }
        function exportNoteText(node) {
            if (!node.descriptionHtml) return node.description;
            const content = document.createElement('div');
            content.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;white-space:pre-wrap;';
            content.appendChild(noteContent(node));
            content.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.replaceWith(document.createTextNode(checkbox.checked ? '[x] ' : '[ ] '));
            });
            document.body.appendChild(content);
            try {
                return content.innerText.replace(/\r\n/g, '\n').trim();
            } finally {
                content.remove();
            }
        }
        function visibleOutlineText(doc) {
            const lines = [doc.title];
            if (doc.subtitle) lines.push(doc.subtitle);
            doc.customFields.forEach(field => lines.push(`${field.label}: ${field.type === 'checkbox' ? (field.value ? 'Yes' : 'No') : field.value}`));
            lines.push('');
            let count = 0;
            function appendNodes(nodes, depth) {
                visibleNodes(nodes).forEach(node => {
                    count++;
                    const indent = '  '.repeat(depth);
                    const details = exportNodeDetails(node, doc);
                    const title = node.text.replace(/\r\n/g, '\n').split('\n');
                    lines.push(`${indent}- ${title[0]}${details.length ? ` [${details.join(' · ')}]` : ''}`);
                    title.slice(1).forEach(line => lines.push(`${indent}  ${line}`));
                    if (node.description || node.descriptionHtml) {
                        exportNoteText(node).split('\n').forEach(line => lines.push(`${indent}  ${line}`));
                    }
                    if (exportBranchExpanded(node, doc)) appendNodes(node.children, depth + 1);
                });
            }
            appendNodes(exportRoots(doc), 0);
            if (!count) lines.push('No notes are visible.');
            return lines.join('\n') + '\n';
        }
        function escapeMarkdown(text) {
            return text.replace(/\\/g, '\\\\').replace(/([`*_[\]{}<>|~])/g, '\\$1')
                .replace(/(^|\n)([ \t]*)([#>+-]|\d+\.)(?=\s)/g, '$1$2\\$3');
        }
        function exportNoteMarkdown(node) {
            if (!node.descriptionHtml) return escapeMarkdown(node.description);
            const content = document.createElement('div');
            content.appendChild(noteContent(node));
            function wrapFormatting(text, marker) {
                return text.replace(/^(\s*)([\s\S]*?\S)(\s*)$/, (_, before, value, after) => `${before}${marker}${value}${marker}${after}`);
            }
            function inline(element) {
                if (element.nodeType === Node.TEXT_NODE) return escapeMarkdown(element.data);
                if (element.nodeType !== Node.ELEMENT_NODE) return '';
                const text = [...element.childNodes].map(inline).join('');
                switch (element.tagName) {
                    case 'BR': return '\n';
                    case 'B': case 'STRONG': return wrapFormatting(text, '**');
                    case 'I': case 'EM': return wrapFormatting(text, '*');
                    case 'S': case 'STRIKE': return wrapFormatting(text, '~~');
                    case 'A': return element.hasAttribute('href') ? `[${text}](${element.href.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\|/g, '%7C')})` : text;
                    default: return text;
                }
            }
            function table(element) {
                const rows = [...element.rows].filter(row => row.closest('table') === element).map(row =>
                    [...row.cells].map(cell => [...cell.childNodes].map(inline).join('').trim().replace(/\s*\n\s*/g, '<br>'))
                );
                if (!rows.length) return '';
                const columns = Math.max(...rows.map(row => row.length));
                if (!columns) return '';
                const firstRow = element.rows[0];
                const hasHeader = firstRow && [...firstRow.cells].some(cell => cell.tagName === 'TH');
                const header = hasHeader ? rows.shift() : [];
                const formatRow = row => `| ${Array.from({ length: columns }, (_, index) => row[index] || '').join(' | ')} |`;
                return [formatRow(header), formatRow(Array(columns).fill('---')), ...rows.map(formatRow)].join('\n');
            }
            function blocks(parent) {
                const parts = [];
                let pending = '';
                const flush = () => {
                    if (pending.trim()) parts.push(pending.trim());
                    pending = '';
                };
                for (const child of parent.childNodes) {
                    if (child.nodeType !== Node.ELEMENT_NODE) {
                        pending += inline(child);
                    } else if (child.tagName === 'TABLE') {
                        flush();
                        const value = table(child);
                        if (value) parts.push(value);
                    } else if (child.tagName === 'UL' || child.tagName === 'OL') {
                        flush();
                        const items = [...child.children].filter(item => item.tagName === 'LI').map((item, index) => {
                            const checkbox = item.querySelector(':scope > input[type="checkbox"]');
                            const marker = checkbox ? `- [${checkbox.checked ? 'x' : ' '}] ` : child.tagName === 'OL' ? `${index + 1}. ` : '- ';
                            const value = blocks(item);
                            return marker + value.replace(/\n/g, '\n'.concat(' '.repeat(marker.length)));
                        });
                        if (items.length) parts.push(items.join('\n'));
                    } else if (['P', 'DIV', 'H1', 'H2', 'H3'].includes(child.tagName)) {
                        flush();
                        const value = blocks(child);
                        if (value) parts.push(child.tagName.startsWith('H') ? `${'#'.repeat(Number(child.tagName[1]))} ${value}` : value);
                    } else if (child.tagName !== 'INPUT') {
                        pending += inline(child);
                    }
                }
                flush();
                return parts.join('\n\n');
            }
            return blocks(content);
        }
        function visibleOutlineMarkdown(doc) {
            const lines = [`# ${escapeMarkdown(doc.title).replace(/\n/g, ' ')}`];
            if (doc.subtitle) lines.push('', escapeMarkdown(doc.subtitle));
            doc.customFields.forEach(field => lines.push('', `**${escapeMarkdown(field.label)}:** ${escapeMarkdown(field.type === 'checkbox' ? (field.value ? 'Yes' : 'No') : field.value)}`));
            lines.push('');
            let count = 0;
            function appendNodes(nodes, depth) {
                visibleNodes(nodes).forEach(node => {
                    count++;
                    const indent = '  '.repeat(depth);
                    const details = exportNodeDetails(node, doc);
                    const title = escapeMarkdown(node.text.replace(/\r\n/g, '\n')).split('\n');
                    lines.push(`${indent}- ${title[0]}${details.length ? ` (${escapeMarkdown(details.join(' · '))})` : ''}`);
                    title.slice(1).forEach(line => lines.push(`${indent}  ${line}`));
                    if (node.description || node.descriptionHtml) {
                        const note = exportNoteMarkdown(node);
                        if (note) {
                            lines.push('');
                            note.split('\n').forEach(line => lines.push(line ? `${indent}  ${line}` : ''));
                            lines.push('');
                        }
                    }
                    if (exportBranchExpanded(node, doc)) appendNodes(node.children, depth + 1);
                });
            }
            appendNodes(exportRoots(doc), 0);
            if (!count) lines.push('No notes are visible.');
            return lines.join('\n').replace(/\n+$/, '') + '\n';
        }
        function exportVisibleText(text, markdown = false) {
            try {
                const file = new Blob([text], { type: `${markdown ? 'text/markdown' : 'text/plain'};charset=utf-8` });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(file);
                link.download = markdown ? 'visible-outline.md' : 'visible-outline.txt';
                try {
                    link.click();
                } finally {
                    URL.revokeObjectURL(link.href);
                }
                showToast(`Your visible outline is ready as ${markdown ? 'Markdown' : 'text'}.`);
            } catch (error) {
                console.error('Could not export the visible outline:', error);
                showToast(`Could not export the visible outline as ${markdown ? 'Markdown' : 'text'}.`);
            }
        }
        function buildPrintOutline(doc) {
            const container = document.createElement('section');
            container.className = 'print-export';
            const title = document.createElement('h1');
            title.textContent = doc.title;
            const subtitle = document.createElement('div');
            subtitle.className = 'print-meta';
            subtitle.textContent = doc.subtitle;
            const meta = document.createElement('div');
            meta.className = 'print-meta';
            const space = state.spaces.find(item => item.id === doc.spaceId);
            const filters = [];
            if (activeFilter === 'starred') filters.push('Starred notes');
            if (priorityFilter !== 'all') filters.push(`${priorityFilter === 'none' ? 'No' : priorityFilter} priority`);
            if (completedFilter === 'hide') filters.push('Completed notes hidden');
            meta.textContent = [space.name, ...filters].join(' · ');
            container.append(title);
            if (doc.subtitle) container.append(subtitle);
            doc.customFields.forEach(field => {
                const item = document.createElement('div');
                item.className = 'print-meta';
                item.textContent = `${field.label}: ${field.type === 'checkbox' ? (field.value ? 'Yes' : 'No') : field.value}`;
                container.appendChild(item);
            });
            container.append(meta);

            function appendNodes(nodes, parent) {
                const list = document.createElement('ul');
                list.className = 'print-list';
                visibleNodes(nodes).forEach(node => {
                    const item = document.createElement('li');
                    const text = document.createElement('span');
                    text.className = `print-node-text${node.completed ? ' print-completed' : ''}`;
                    if (node.highlight !== 'none') text.dataset.highlight = node.highlight;
                    if (node.heading !== 'none') text.dataset.heading = node.heading;
                    text.textContent = node.text;
                    item.appendChild(text);
                    const details = exportNodeDetails(node, doc);
                    if (details.length) {
                        const nodeMeta = document.createElement('span');
                        nodeMeta.className = 'print-node-meta';
                        nodeMeta.textContent = ` [${details.join(' · ')}]`;
                        item.appendChild(nodeMeta);
                    }
                    if (node.description || node.descriptionHtml) {
                        const description = document.createElement('div');
                        description.className = 'print-description';
                        description.appendChild(noteContent(node));
                        item.appendChild(description);
                    }
                    if (exportBranchExpanded(node, doc)) appendNodes(node.children, item);
                    list.appendChild(item);
                });
                if (list.childElementCount) parent.appendChild(list);
            }
            appendNodes(exportRoots(doc), container);
            if (!container.querySelector('li')) {
                const empty = document.createElement('p');
                empty.textContent = 'No notes are visible.';
                container.appendChild(empty);
            }
            return container;
        }
        function exportPdf(container, title) {
            document.body.appendChild(container);
            const previousTitle = document.title;
            document.title = title;
            const cleanup = () => {
                container.remove();
                document.title = previousTitle;
                window.removeEventListener('afterprint', cleanup);
            };
            window.addEventListener('afterprint', cleanup);
            try {
                window.print();
            } catch (error) {
                cleanup();
                console.error('Could not open the print dialog:', error);
                showToast('Could not open the print dialog. Please check your browser settings.');
            }
        }
        function showExportPreview(fromSettings = false) {
            if (currentView !== 'project') {
                showToast('Open a project to export its outline.');
                return;
            }
            let text, markdown, printOutline, title;
            try {
                const doc = activeDocument();
                text = visibleOutlineText(doc);
                markdown = visibleOutlineMarkdown(doc);
                printOutline = buildPrintOutline(doc);
                title = doc.title;
            } catch (error) {
                console.error('Could not prepare the export preview:', error);
                showToast('Could not prepare the export preview.');
                return;
            }
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-preview-title">
                        <div class="settings-header"><h2 id="export-preview-title">Export visible outline</h2></div>
                        <div class="export-body">
                            <p>Preview the formatted outline, text or Markdown. Choose Save as PDF in the print dialog.</p>
                            <label class="export-format">Preview format
                                <select class="export-format-select">
                                    <option value="formatted">Formatted</option>
                                    <option value="text">Plain text</option>
                                    <option value="markdown">Markdown</option>
                                </select>
                            </label>
                            <div class="export-formatted" role="region" aria-label="Formatted outline preview" tabindex="0"></div>
                            <textarea class="export-preview" aria-label="Export text preview" readonly spellcheck="false" hidden></textarea>
                        </div>
                        <div class="export-actions">
                            <button type="button" class="export-copy">Copy text</button>
                            <button type="button" class="export-text">Save as text</button>
                            <button type="button" class="export-markdown">Save as Markdown</button>
                            <button type="button" class="export-pdf">Save as PDF</button>
                            <button type="button" class="export-close">Close</button>
                        </div>
                    </section>
                </div>`;
            const preview = root.querySelector('.export-preview');
            preview.value = text;
            const formatted = root.querySelector('.export-formatted');
            const formattedOutline = printOutline.cloneNode(true);
            formattedOutline.className = 'export-rendered';
            formattedOutline.querySelectorAll('input[type="checkbox"]').forEach(checkbox => { checkbox.disabled = true; });
            formattedOutline.querySelectorAll('a').forEach(link => { link.tabIndex = -1; });
            formatted.appendChild(formattedOutline);
            const format = root.querySelector('.export-format-select');
            const copyButton = root.querySelector('.export-copy');
            format.onchange = () => {
                const isMarkdown = format.value === 'markdown';
                const isFormatted = format.value === 'formatted';
                preview.value = isMarkdown ? markdown : text;
                preview.hidden = isFormatted;
                formatted.hidden = !isFormatted;
                copyButton.textContent = isMarkdown ? 'Copy Markdown' : 'Copy text';
            };
            const dialog = root.querySelector('.export-modal');
            dialog.addEventListener('keydown', event => {
                if (event.key !== 'Tab') return;
                const controls = [...dialog.querySelectorAll('select, textarea, .export-formatted, button')].filter(control => !control.hidden);
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            });
            const close = () => {
                closeModal();
                if (fromSettings) {
                    showSettings();
                    document.getElementById('export-pdf').focus();
                } else {
                    document.getElementById('project-export').focus();
                }
            };
            root.querySelector('.export-close').onclick = close;
            root.querySelector('.modal-backdrop').onclick = event => {
                if (event.target === event.currentTarget) close();
            };
            copyButton.onclick = async () => {
                const copyFormat = format.value === 'markdown' ? 'markdown' : 'text';
                const copyText = copyFormat === 'markdown' ? markdown : text;
                try {
                    if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
                    await navigator.clipboard.writeText(copyText);
                    showToast('Outline copied to clipboard.');
                } catch (error) {
                    console.error('Could not copy the outline:', error);
                    if (preview.isConnected) {
                        format.value = copyFormat;
                        format.onchange();
                        preview.focus();
                        preview.select();
                    }
                    showToast('Could not copy automatically. The text is selected; copy it manually.');
                }
            };
            root.querySelector('.export-text').onclick = () => exportVisibleText(text);
            root.querySelector('.export-markdown').onclick = () => exportVisibleText(markdown, true);
            root.querySelector('.export-pdf').onclick = () => exportPdf(printOutline, title);
            root.querySelector('.export-copy').focus();
        }
