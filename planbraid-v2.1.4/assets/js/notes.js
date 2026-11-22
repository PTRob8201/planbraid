/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function continueNoteChecklist(editor) {
            const selection = window.getSelection();
            if (!selection?.rangeCount) return false;
            const range = selection.getRangeAt(0);
            const element = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
            const item = element?.closest('li');
            const list = item?.parentElement;
            if (!list?.matches('ul[data-checklist="true"]') || !editor.contains(item) || !item.contains(range.endContainer)) return false;

            if (range.collapsed && !item.textContent.trim() && item === list.lastElementChild) {
                const paragraph = document.createElement('p');
                paragraph.append(document.createElement('br'));
                list.after(paragraph);
                item.remove();
                if (!list.firstElementChild) list.remove();
                selection.collapse(paragraph, 0);
                return true;
            }

            const originalCheckbox = item.querySelector(':scope > input[type="checkbox"]');
            if (originalCheckbox) {
                const boundary = document.createRange();
                boundary.setStartAfter(originalCheckbox);
                boundary.collapse(true);
                if (range.compareBoundaryPoints(Range.START_TO_START, boundary) < 0) range.setStartAfter(originalCheckbox);
            }
            range.deleteContents();
            const remainder = document.createRange();
            remainder.setStart(range.startContainer, range.startOffset);
            remainder.setEnd(item, item.childNodes.length);
            const next = document.createElement('li');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.setAttribute('contenteditable', 'false');
            checkbox.setAttribute('aria-label', 'Checklist item');
            next.append(checkbox, document.createTextNode(' '), remainder.extractContents());
            if (next.childNodes.length === 2) next.append(document.createElement('br'));
            item.after(next);
            selection.collapse(next, 2);
            return true;
        }

        function noteHasFormatting(node) {
            if (!node.descriptionHtml) return false;
            const template = document.createElement('template');
            template.innerHTML = node.descriptionHtml;
            return [...template.content.querySelectorAll('*')].some(element =>
                !['BR', 'DIV', 'P'].includes(element.tagName) || element.attributes.length > 0
            );
        }
        const noteHighlightColors = {
            Yellow: '#fff1b8', Green: '#d3efbf', Blue: '#cde9ff', Pink: '#ffd7e5', Purple: '#e5d8ff'
        };
        const noteHighlightStyles = Object.values(noteHighlightColors).map(hex =>
            `rgb(${[1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`);

        function safeNoteContent(html, agendaEmbeds = false) {
            const template = document.createElement('template');
            template.innerHTML = html;
            const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'P', 'DIV', 'H1', 'H2', 'H3', 'MARK', 'BR', 'UL', 'OL', 'LI', 'A', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD']);
            const discarded = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE']);
            function copy(source, destination) {
                for (const child of source.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        destination.appendChild(document.createTextNode(child.data));
                    } else if (child.nodeType === Node.ELEMENT_NODE && !discarded.has(child.tagName)) {
                        if (child.tagName === 'INPUT') {
                            if (child.getAttribute('type') === 'checkbox' && child.parentElement?.tagName === 'LI' && child.parentElement.parentElement?.matches('ul[data-checklist="true"]')) {
                                const checkbox = document.createElement('input');
                                checkbox.type = 'checkbox';
                                checkbox.setAttribute('contenteditable', 'false');
                                checkbox.setAttribute('aria-label', 'Checklist item');
                                if (child.hasAttribute('checked')) checkbox.setAttribute('checked', '');
                                destination.appendChild(checkbox);
                            }
                            continue;
                        }
                        const embed = child.tagName === 'SPAN' && child.getAttribute('data-agenda-embed');
                        if (embed && /^(sheet|image-[a-f0-9]{32})$/.test(embed)) {
                            if (agendaEmbeds) {
                                const marker = document.createElement('span');
                                marker.dataset.agendaEmbed = embed;
                                marker.contentEditable = 'false';
                                destination.append(marker);
                            }
                            continue;
                        }
                        const color = ['SPAN', 'MARK'].includes(child.tagName) && noteHighlightStyles.includes(child.style.backgroundColor)
                            ? child.style.backgroundColor : '';
                        if (!allowed.has(child.tagName) && !color) { copy(child, destination); continue; }
                        const element = document.createElement(color ? 'mark' : child.tagName.toLowerCase());
                        if (color && color !== noteHighlightStyles[0]) element.style.backgroundColor = color;
                        if (child.tagName === 'UL' && child.getAttribute('data-checklist') === 'true') element.setAttribute('data-checklist', 'true');
                        if (child.tagName === 'A') {
                            try {
                                const url = new URL(child.getAttribute('href'));
                                if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
                                    element.href = url.href;
                                    element.target = '_blank';
                                    element.rel = 'noopener noreferrer';
                                }
                            } catch (error) {
                                console.warn('Removed an invalid note link.', error);
                            }
                        }
                        copy(child, element);
                        destination.appendChild(element);
                    }
                }
            }
            const fragment = document.createDocumentFragment();
            copy(template.content, fragment);
            return fragment;
        }
        function noteContent(node) {
            if (node.descriptionHtml) return safeNoteContent(node.descriptionHtml);
            const fragment = document.createDocumentFragment();
            node.description.split('\n').forEach((line, index) => {
                if (index) fragment.appendChild(document.createElement('br'));
                fragment.appendChild(document.createTextNode(line));
            });
            return fragment;
        }
        function editRichNote(id, allowFormattedNote = false) {
            const location = findNode(id);
            if (!location) return;
            const node = location.node;
            if (!state.settings.richTextEnabled && !(allowFormattedNote && noteHasFormatting(node))) {
                showToast('Enable the rich-text editor in Settings to edit this note.');
                return;
            }
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal rich-note-modal" role="dialog" aria-modal="true" aria-labelledby="rich-note-title">
                        <div class="rich-note-header">
                            <h2 id="rich-note-title"></h2>
                            <p class="rich-note-context">Edit rich-text note</p>
                        </div>
                        <div class="rich-note-body">
                        <div class="rich-note-toolbar" role="toolbar" aria-label="Note formatting">
                            <button type="button" class="undo-rich-note" aria-label="Undo" title="Undo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M4 12h10a5 5 0 0 1 5 5"/></svg></button>
                            <button type="button" class="redo-rich-note" aria-label="Redo" title="Redo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7 5 5-5 5M20 12H10a5 5 0 0 0-5 5"/></svg></button>
                            <button type="button" data-rich-group="rich-format" aria-label="Text formatting" title="Text formatting" aria-controls="rich-format" aria-pressed="true"><svg class="ui-icon" aria-hidden="true"><use href="#icon-text"></use></svg></button>
                            <button type="button" data-rich-group="rich-headings" aria-label="Headings" title="Headings" aria-controls="rich-headings" aria-pressed="false"><svg class="ui-icon" aria-hidden="true"><use href="#icon-heading"></use></svg></button>
                            <button type="button" data-rich-group="rich-lists" aria-label="Lists" title="Lists" aria-controls="rich-lists" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/></svg></button>
                            <button type="button" data-rich-group="rich-tables" aria-label="Tables" title="Tables" aria-controls="rich-tables" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 10v10M15 10v10"/></svg></button>
                            <button type="button" data-command="createLink" aria-label="Add link" title="Add link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2"/></svg></button>
                        </div>
                        <div id="rich-format" class="rich-note-group" role="group" aria-label="Text formatting">
                            <button type="button" data-command="bold" aria-label="Bold" title="Bold"><svg class="ui-icon" aria-hidden="true"><use href="#icon-bold"></use></svg></button>
                            <button type="button" data-command="italic" aria-label="Italic" title="Italic"><svg class="ui-icon" aria-hidden="true"><use href="#icon-italic"></use></svg></button>
                            <button type="button" data-command="underline" aria-label="Underline" title="Underline"><svg class="ui-icon" aria-hidden="true"><use href="#icon-underline"></use></svg></button>
                            <button type="button" data-command="hiliteColor" data-value="#fff1b8" aria-label="Highlight text" title="Highlight text"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 15 9-9 5 5-9 9H4v-5ZM12 7l2-2a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-2 2M3 22h18"/></svg></button>
                        </div>
                        <div id="rich-headings" class="rich-note-group" role="group" aria-label="Headings" hidden>
                            <button type="button" data-command="formatBlock" data-value="h1" aria-label="Heading 1" title="Heading 1"><b aria-hidden="true">H1</b></button>
                            <button type="button" data-command="formatBlock" data-value="h2" aria-label="Heading 2" title="Heading 2"><b aria-hidden="true">H2</b></button>
                            <button type="button" data-command="formatBlock" data-value="h3" aria-label="Heading 3" title="Heading 3"><b aria-hidden="true">H3</b></button>
                            <button type="button" data-command="formatBlock" data-value="p" aria-label="Paragraph" title="Paragraph"><svg class="ui-icon" aria-hidden="true"><use href="#icon-paragraph"></use></svg></button>
                        </div>
                        <div id="rich-lists" class="rich-note-group" role="group" aria-label="Lists" hidden>
                            <button type="button" data-command="insertUnorderedList" aria-label="Bulleted list" title="Bulleted list"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/></svg></button>
                            <button type="button" data-command="insertOrderedList" aria-label="Numbered list" title="Numbered list"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5h11M10 12h11M10 19h11M3 4l1-1v5M3 8h3M3 11c0-2 3-2 3 0 0 1-3 3-3 4h3M3 18h3l-2 2c3-1 3 2 0 2"/></svg></button>
                            <button type="button" class="insert-note-checklist" aria-label="Insert checklist" title="Insert checklist"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="6" height="6" rx="1"/><path d="m4.5 7 1.2 1.2 2-2M12 7h9M3 15h6v6H3zM12 18h9"/></svg></button>
                        </div>
                        <div id="rich-tables" class="rich-note-group rich-note-table-tools" role="group" aria-label="Table controls" hidden>
                            <button type="button" class="insert-note-table" aria-label="Insert table" title="Insert table"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 10v10M15 10v10"/></svg></button>
                            <button type="button" data-table-action="add-row" aria-label="Add row" title="Add row"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="12" height="15"/><path d="M3 8h12M3 13h12M19 11v8M16 15h6"/></svg></button>
                            <button type="button" data-table-action="remove-row" aria-label="Remove row" title="Remove row"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="12" height="15"/><path d="M3 8h12M3 13h12M16 15h6"/></svg></button>
                            <button type="button" data-table-action="add-column" aria-label="Add column" title="Add column"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="15" height="12"/><path d="M8 3v12M13 3v12M19 16v6M16 19h6"/></svg></button>
                            <button type="button" data-table-action="remove-column" aria-label="Remove column" title="Remove column"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="15" height="12"/><path d="M8 3v12M13 3v12M16 19h6"/></svg></button>
                            <button type="button" data-table-action="remove-table" aria-label="Delete table" title="Delete table"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="13" height="15"/><path d="M3 8h13M9 8v10M17 15l5 5M22 15l-5 5"/></svg></button>
                        </div>
                        <div class="rich-note-link" hidden>
                            <label for="rich-note-url">Link URL</label>
                            <input id="rich-note-url" type="url" placeholder="https://example.com">
                            <button type="button" class="apply-note-link">Apply link</button>
                            <button type="button" class="cancel-note-link">Cancel link</button>
                        </div>
                        <div class="rich-note-editor" contenteditable="true" role="textbox" aria-label="Note content" aria-multiline="true"></div>
                        </div>
                        <div class="rich-note-footer">
                            <div class="rich-note-actions"><button type="button" class="cancel-rich-note">Cancel</button><button type="button" class="save-rich-note">Save</button></div>
                        </div>
                    </section>
                </div>`;
            applyDesignIcons(root);
            const editor = root.querySelector('.rich-note-editor');
            const groupButtons = [...root.querySelectorAll('[data-rich-group]')];
            const selectGroup = selected => {
                groupButtons.forEach(button => {
                    const active = button === selected;
                    button.setAttribute('aria-pressed', String(active));
                    root.querySelector(`#${button.dataset.richGroup}`).hidden = !active;
                });
            };
            groupButtons.forEach(button => {
                button.addEventListener('pointerdown', event => event.preventDefault());
                button.addEventListener('click', () => selectGroup(button));
            });
            root.querySelector('#rich-note-title').textContent = node.text.trim() || 'Untitled note';
            const linkForm = root.querySelector('.rich-note-link');
            const linkInput = root.querySelector('#rich-note-url');
            editor.appendChild(noteContent(node));
            const original = editor.innerHTML;
            let selectionRange = null;
            const history = [original];
            let historyIndex = 0;
            const recordHistory = () => {
                const html = editor.innerHTML;
                if (history[historyIndex] === html) return;
                history.splice(historyIndex + 1);
                history.push(html);
                if (history.length > 200) history.shift();
                historyIndex = history.length - 1;
            };
            const historyObserver = new MutationObserver(recordHistory);
            historyObserver.observe(editor, { subtree: true, childList: true, characterData: true, attributes: true });
            const moveHistory = direction => {
                if (historyObserver.takeRecords().length) recordHistory();
                const next = historyIndex + direction;
                if (next < 0 || next >= history.length) {
                    showToast(direction < 0 ? 'Nothing to undo.' : 'Nothing to redo.');
                    return;
                }
                historyIndex = next;
                editor.innerHTML = history[historyIndex];
                historyObserver.takeRecords();
                selectionRange = null;
                editor.focus();
                const range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                rememberSelection();
            };
            const rememberSelection = () => {
                const selection = window.getSelection();
                if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) selectionRange = selection.getRangeAt(0).cloneRange();
            };
            const restoreSelection = () => {
                editor.focus();
                if (selectionRange) {
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(selectionRange);
                }
            };
            const focusCell = cell => {
                const range = document.createRange();
                range.selectNodeContents(cell);
                range.collapse(true);
                selectionRange = range;
                restoreSelection();
            };
            const selectedCell = () => {
                const anchor = selectionRange?.startContainer;
                const element = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
                const cell = element?.closest('td, th');
                return cell && editor.contains(cell) ? cell : null;
            };
            root.querySelectorAll('.rich-note-table-tools button, .insert-note-table, .insert-note-checklist, .undo-rich-note, .redo-rich-note').forEach(button => {
                button.addEventListener('pointerdown', event => event.preventDefault());
            });
            root.querySelector('.undo-rich-note').onclick = () => moveHistory(-1);
            root.querySelector('.redo-rich-note').onclick = () => moveHistory(1);
            root.querySelector('.insert-note-checklist').onclick = () => {
                if (selectedCell()) { showToast('Place the cursor outside the table to insert a checklist.'); return; }
                restoreSelection();
                if (selectionRange && !selectionRange.collapsed) {
                    if ([...editor.querySelectorAll('ul, ol, table')].some(element => selectionRange.intersectsNode(element))) {
                        showToast('Select text outside existing lists and tables to create a checklist.');
                        return;
                    }
                    if (!document.execCommand('insertUnorderedList', false, null)) {
                        showToast('Could not create a checklist from the selected text.');
                        return;
                    }
                    const selection = window.getSelection();
                    const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
                    const list = anchor?.closest('ul');
                    if (!list || !editor.contains(list)) {
                        showToast('Could not turn this selection into a checklist. Use Undo to restore it.');
                        return;
                    }
                    list.dataset.checklist = 'true';
                    for (const item of list.children) {
                        if (item.tagName !== 'LI') continue;
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.setAttribute('contenteditable', 'false');
                        checkbox.setAttribute('aria-label', 'Checklist item');
                        item.prepend(checkbox);
                    }
                    rememberSelection();
                    return;
                }
                if (!document.execCommand('insertHTML', false, '<ul data-checklist="true" data-new-checklist="true"><li><input type="checkbox" contenteditable="false" aria-label="Checklist item"> <br></li></ul><p><br></p>')) {
                    showToast('Could not insert a checklist. Place the cursor in the note and try again.');
                    return;
                }
                const list = editor.querySelector('ul[data-new-checklist]');
                if (!list) { showToast('Checklist insertion failed.'); return; }
                list.removeAttribute('data-new-checklist');
                const item = list.querySelector('li');
                const cursor = document.createRange();
                cursor.setStart(item, 2);
                cursor.collapse(true);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(cursor);
                rememberSelection();
            };
            root.querySelector('.insert-note-table').onclick = () => {
                if (selectedCell()) { showToast('Place the cursor outside the current table to insert another.'); return; }
                restoreSelection();
                const range = selectionRange || window.getSelection().getRangeAt(0);
                range.collapse(false);
                const table = document.createElement('table');
                const head = table.createTHead();
                const header = head.insertRow();
                for (let column = 0; column < 3; column++) header.appendChild(document.createElement('th'));
                const body = table.createTBody();
                for (let row = 0; row < 2; row++) {
                    const newRow = body.insertRow();
                    for (let column = 0; column < 3; column++) newRow.insertCell();
                }
                const trailing = document.createElement('p');
                trailing.appendChild(document.createElement('br'));
                const fragment = document.createDocumentFragment();
                fragment.append(table, trailing);
                range.insertNode(fragment);
                focusCell(header.cells[0]);
            };
            root.querySelectorAll('[data-table-action]').forEach(button => {
                button.onclick = () => {
                    const cell = selectedCell();
                    if (!cell) { showToast('Select a table cell first.'); return; }
                    const row = cell.parentElement;
                    const table = cell.closest('table');
                    const rows = [...table.rows];
                    const column = cell.cellIndex;
                    if (rows.some(item => item.cells.length !== row.cells.length) || rows.some(item => [...item.cells].some(itemCell => itemCell.colSpan !== 1 || itemCell.rowSpan !== 1))) {
                        showToast('This table has an unsupported layout and cannot be changed here.');
                        return;
                    }
                    const action = button.dataset.tableAction;
                    if (action === 'remove-table') {
                        if (!confirm('Delete this table and all its contents?')) return;
                        const range = document.createRange();
                        range.setStartBefore(table);
                        range.collapse(true);
                        selectionRange = range;
                        table.remove();
                        restoreSelection();
                    } else if (action === 'add-row') {
                        if (rows.length >= 20) { showToast('A table can have at most 20 rows.'); return; }
                        const newRow = document.createElement('tr');
                        for (let index = 0; index < row.cells.length; index++) newRow.appendChild(document.createElement(row.parentElement.tagName === 'THEAD' ? 'th' : 'td'));
                        row.after(newRow);
                        focusCell(newRow.cells[column]);
                    } else if (action === 'add-column') {
                        if (row.cells.length >= 10) { showToast('A table can have at most 10 columns.'); return; }
                        rows.forEach(item => {
                            const newCell = document.createElement(item.cells[column].tagName.toLowerCase());
                            item.cells[column].after(newCell);
                        });
                        focusCell(row.cells[column + 1]);
                    } else if (action === 'remove-row') {
                        if (rows.length === 1) { showToast('A table must have at least one row.'); return; }
                        if (!confirm('Remove this row and all its contents?')) return;
                        const nextRow = rows[row.rowIndex + 1] || rows[row.rowIndex - 1];
                        row.remove();
                        focusCell(nextRow.cells[column]);
                    } else if (action === 'remove-column') {
                        if (row.cells.length === 1) { showToast('A table must have at least one column.'); return; }
                        if (!confirm('Remove this column and all its contents?')) return;
                        rows.forEach(item => item.cells[column].remove());
                        focusCell(row.cells[Math.min(column, row.cells.length - 1)]);
                    }
                };
            });
            editor.addEventListener('keyup', rememberSelection);
            editor.addEventListener('change', event => {
                const checkbox = event.target;
                if (checkbox instanceof HTMLInputElement && checkbox.type === 'checkbox' && checkbox.closest('ul[data-checklist="true"]')) {
                    checkbox.toggleAttribute('checked', checkbox.checked);
                }
            });
            editor.addEventListener('beforeinput', event => {
                if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
                    event.preventDefault();
                    moveHistory(event.inputType === 'historyUndo' ? -1 : 1);
                }
            });
            editor.addEventListener('keydown', event => {
                if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
                    event.preventDefault();
                    moveHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? 1 : -1);
                    return;
                }
                if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
                if (continueNoteChecklist(editor)) {
                    event.preventDefault();
                    rememberSelection();
                }
            });
            editor.addEventListener('mouseup', rememberSelection);
            editor.addEventListener('input', rememberSelection);
            editor.addEventListener('touchend', () => setTimeout(rememberSelection, 0));
            editor.addEventListener('paste', event => {
                event.preventDefault();
                document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
            });
            root.querySelectorAll('[data-command]').forEach(button => {
                button.addEventListener('pointerdown', event => event.preventDefault());
                button.addEventListener('click', () => {
                    const command = button.dataset.command;
                    if (command === 'createLink') {
                        if (!selectionRange || selectionRange.collapsed) { showToast('Select text before adding a link.'); return; }
                        linkForm.hidden = false;
                        linkInput.value = '';
                        linkInput.focus();
                        return;
                    }
                    restoreSelection();
                    if (command === 'hiliteColor' && (!selectionRange || selectionRange.collapsed)) {
                        showToast('Select text before highlighting.');
                        return;
                    }
                    if (!document.execCommand(command, false, button.dataset.value || null)) showToast('Could not apply formatting. Select text and try again.');
                    rememberSelection();
                });
            });
            root.querySelector('.apply-note-link').onclick = () => {
                let url;
                try {
                    url = new URL(linkInput.value.trim());
                    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('Unsupported link protocol.');
                } catch (error) {
                    showToast('Enter a valid http, https, or mailto link.');
                    linkInput.focus();
                    return;
                }
                restoreSelection();
                if (!document.execCommand('createLink', false, url.href)) showToast('Could not add the link. Select text and try again.');
                rememberSelection();
                linkForm.hidden = true;
            };
            root.querySelector('.cancel-note-link').onclick = () => { linkForm.hidden = true; restoreSelection(); };
            const cancel = () => {
                if (editor.innerHTML !== original && !confirm('Discard changes to this note?')) return;
                closeModal();
                document.querySelector(`[data-node-id="${CSS.escape(id)}"] > .node-row .node-description`)?.focus();
            };
            root.querySelector('.cancel-rich-note').onclick = cancel;
            root.querySelector('.modal-backdrop').onclick = event => { if (event.target === event.currentTarget) cancel(); };
            root.querySelector('.save-rich-note').onclick = () => {
                const clean = document.createElement('div');
                clean.appendChild(safeNoteContent(editor.innerHTML));
                const plain = editor.innerText.replace(/\r\n/g, '\n');
                const html = plain.trim() || clean.querySelector('table, ul[data-checklist] input[type="checkbox"]') ? clean.innerHTML : '';
                if (editor.innerHTML !== original && (node.description !== plain || node.descriptionHtml !== html)) {
                    node.description = plain;
                    node.descriptionHtml = html;
                    markNodeEdited(node);
                    scheduleSave();
                }
                closeModal();
                render();
                document.querySelector(`[data-node-id="${CSS.escape(id)}"] > .node-row .node-description`)?.focus();
            };
            editor.focus();
        }
        function viewNote(id, returnFocus) {
            const location = findNode(id);
            if (!location) return;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal rich-note-modal" role="dialog" aria-modal="true" aria-labelledby="view-note-title">
                        <div class="rich-note-header view-note-header"><div><h2 id="view-note-title"></h2><p class="rich-note-context">Read-only note</p></div>
                            <button type="button" class="edit-view-note" aria-label="Edit note" title="Edit note"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16zM14.5 6.5l3 3"/></svg></button>
                        </div>
                        <div class="rich-note-body"><div class="rich-note-editor rich-note-readonly"></div></div>
                        <div class="rich-note-footer"><div class="rich-note-actions"><button type="button" class="close-view-note">Close</button></div></div>
                    </section>
                </div>`;
            root.querySelector('#view-note-title').textContent = location.node.text.trim() || 'Untitled note';
            const content = root.querySelector('.rich-note-readonly');
            content.appendChild(noteContent(location.node));
            content.querySelectorAll('input[type="checkbox"]').forEach(checkbox => { checkbox.disabled = true; });
            const close = () => {
                closeModal();
                if (returnFocus.isConnected) returnFocus.focus();
            };
            root.querySelector('.close-view-note').onclick = close;
            root.querySelector('.edit-view-note').onclick = () => {
                editFullSimpleNote(id, returnFocus);
            };
            root.querySelector('.modal-backdrop').onclick = event => { if (event.target === event.currentTarget) close(); };
            root.querySelector('.close-view-note').focus();
        }
        function editFullSimpleNote(id, returnFocus) {
            const location = findNode(id);
            if (!location) return;
            const node = location.node;
            const original = node.description;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal rich-note-modal" role="dialog" aria-modal="true" aria-labelledby="simple-note-title">
                        <div class="rich-note-header"><h2 id="simple-note-title"></h2><p class="rich-note-context">Edit simple note</p></div>
                        <div class="rich-note-body"><textarea class="full-simple-note" aria-label="Note text"></textarea></div>
                        <div class="rich-note-footer"><div class="rich-note-actions"><button type="button" class="cancel-full-simple-note">Cancel</button><button type="button" class="save-rich-note">Save</button></div></div>
                    </section>
                </div>`;
            root.querySelector('#simple-note-title').textContent = node.text.trim() || 'Untitled note';
            const input = root.querySelector('.full-simple-note');
            input.value = original;
            const cancel = () => {
                if (input.value !== original && !confirm('Discard changes to this note?')) return;
                viewNote(id, returnFocus);
            };
            root.querySelector('.cancel-full-simple-note').onclick = cancel;
            root.querySelector('.modal-backdrop').onclick = event => { if (event.target === event.currentTarget) cancel(); };
            root.querySelector('.save-rich-note').onclick = () => {
                if (input.value !== original) {
                    if (noteHasFormatting(node) && !confirm('Saving this edit as plain text will remove this note’s formatting. Continue?')) return;
                    node.description = input.value;
                    node.descriptionHtml = '';
                    markNodeEdited(node);
                    scheduleSave();
                }
                closeModal();
                render();
                document.querySelector(`[data-node-id="${CSS.escape(id)}"] > .node-row .node-description`)?.focus();
            };
            input.focus();
        }
