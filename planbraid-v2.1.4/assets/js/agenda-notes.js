/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        let agendaDraft = null;
        function clearAgendaDraft() {
            agendaDraft?.stopToolbarObserver();
            agendaDraft = null;
        }
        function hasUnsavedAgendaDraft() {
            return agendaDraft?.workspace === state && agendaDraft.dirty();
        }

        function closeAgendaEditor() {
            const draft = agendaDraft;
            if (draft?.workspace !== state) return true;
            if (draft.dirty()) return draft.save();
            draft.finish();
            return true;
        }

        let expandedAgendaNotes = new WeakSet();
        const agendaDeleteIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v6m4-6v6"/></svg>';
        const agendaShareIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/></svg>';
        const agendaFileLimit = 256 * 1024;
        const agendaImageDescriptionLimit = 500;
        const agendaImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

        async function resizeAgendaImage(file) {
            if (file.size <= agendaFileLimit) return file;
            const bitmap = await createImageBitmap(file);
            try {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Image resizing is unavailable in this browser.');
                const fit = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
                for (let scale = fit; scale * Math.max(bitmap.width, bitmap.height) >= 1; scale *= 0.7) {
                    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                    for (const quality of [0.85, 0.65]) {
                        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
                        if (!blob) throw new Error('Could not encode the resized image.');
                        if (blob.size <= agendaFileLimit) {
                            const extension = blob.type === 'image/webp' ? '.webp' : '.png';
                            return new File([blob], file.name.replace(/\.[^.]+$/, '').slice(0, 250) + extension, { type: blob.type });
                        }
                        if (blob.type !== 'image/webp') break;
                    }
                }
                throw new Error('Could not resize the image to 256 KB.');
            } finally {
                bitmap.close();
            }
        }

        function validAgendaTimestamp(value) {
            return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
        }

        function validAgendaAttachment(file) {
            if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 255 ||
                !(file.imageType === '' || agendaImageTypes.includes(file.imageType)) ||
                (file.inlineId !== undefined && (!file.imageType || typeof file.inlineId !== 'string' || !/^image-[a-f0-9]{32}$/.test(file.inlineId))) ||
                (file.attachedAt !== undefined && !validAgendaTimestamp(file.attachedAt)) ||
                (file.description !== undefined && (!file.imageType ||
                    typeof file.description !== 'string' || file.description.length > agendaImageDescriptionLimit)) ||
                typeof file.data !== 'string' || !file.data.length || file.data.length % 4 ||
                file.data.length > Math.ceil(agendaFileLimit / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.data)) return false;
            return file.data.length / 4 * 3 - (file.data.endsWith('==') ? 2 : file.data.endsWith('=') ? 1 : 0) <= agendaFileLimit;
        }

        function renderAgendaAttachments(host, files, { removeFile, describeImage, inlineHost } = {}) {
            host.replaceChildren();
            host.hidden = !files.length;
            files.forEach((file, index) => {
                const row = document.createElement('div');
                if (file.imageType) {
                    const image = document.createElement('img');
                    image.alt = file.description?.trim() || file.name;
                    image.decoding = 'async';
                    image.src = `data:${file.imageType};base64,${file.data}`;
                    row.append(image);
                    if (describeImage) {
                        const description = document.createElement('textarea');
                        description.className = 'agenda-image-description';
                        description.rows = 2;
                        description.maxLength = agendaImageDescriptionLimit;
                        description.placeholder = 'Add a picture description';
                        description.setAttribute('aria-label', `Picture description for ${file.name}`);
                        description.value = file.description || '';
                        description.oninput = () => {
                            describeImage(index, description.value);
                            image.alt = description.value.trim() || file.name;
                        };
                        row.append(description);
                    } else if (file.description?.trim()) {
                        const caption = document.createElement('p');
                        caption.className = 'agenda-image-caption';
                        caption.textContent = file.description;
                        row.append(caption);
                    }
                }
                const details = document.createElement('div');
                details.className = 'agenda-attachment-details';
                const download = document.createElement('button');
                download.type = 'button';
                download.className = 'agenda-attachment-name';
                download.textContent = file.name;
                download.setAttribute('aria-label', `Download ${file.name}`);
                download.onclick = () => {
                    const bytes = Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
                    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = file.name;
                    anchor.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                };
                if (!file.imageType || removeFile) details.append(download);
                if (file.attachedAt) {
                    const date = document.createElement('time');
                    date.dateTime = file.attachedAt;
                    date.textContent = `Attached ${new Date(file.attachedAt).toLocaleDateString()}`;
                    details.append(date);
                }
                if (removeFile) {
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.className = 'agenda-remove-attachment';
                    remove.innerHTML = agendaDeleteIcon;
                    remove.title = 'Remove attachment';
                    remove.setAttribute('aria-label', `Remove ${file.name}`);
                    remove.onclick = () => removeFile(index);
                    details.append(remove);
                }
                if (details.hasChildNodes()) row.append(details);
                (inlineHost?.(file) || host).append(row);
            });
            host.hidden = !host.hasChildNodes();
        }

        function placeAgendaEmbeds(body, items) {
            for (const marker of body.querySelectorAll('[data-agenda-embed]')) {
                const item = items.get(marker.dataset.agendaEmbed);
                marker.replaceChildren();
                if (item) {
                    marker.append(item);
                    items.delete(marker.dataset.agendaEmbed);
                }

                marker.hidden = !item;
            }
        }

        function cleanAgendaBody(body) {
            const copy = body.cloneNode(true);
            copy.querySelectorAll('[data-agenda-embed]').forEach(marker => marker.replaceChildren());
            const clean = document.createElement('div');
            clean.append(safeNoteContent(copy.innerHTML, true));
            return clean;
        }

        function shareAgendaNote(note, trigger) {
            const body = exportNoteText({ description: note.content, descriptionHtml: note.contentHtml }).trim();
            const noteText = [note.title, body].filter(Boolean).join('\n\n');
            const dialog = document.createElement('dialog');
            dialog.className = 'modal export-modal agenda-share-dialog';
            dialog.setAttribute('aria-labelledby', 'agenda-share-title');
            dialog.innerHTML = `
                <div class="settings-header"><h2 id="agenda-share-title">Share note</h2></div>
                <div class="export-body">
                    <p>Copy or send a text snapshot, or create a PDF with pictures and captions. No link is created.</p>
                    ${state.settings.agendaSpreadsheetsEnabled && note.spreadsheet ? '<label class="export-format"><input type="checkbox" class="agenda-include-sheet"> Include spreadsheet</label>' : ''}
                    <textarea class="export-preview" aria-label="Note snapshot" readonly spellcheck="false"></textarea>
                    <p class="agenda-share-status" role="status"></p>
                </div>
                <div class="export-actions">
                    <button type="button" class="agenda-copy-text" autofocus>Copy text</button>
                    <button type="button" class="agenda-send-text" hidden>Send snapshot</button>
                    <button type="button" class="agenda-download-pdf">Download PDF</button>
                    <button type="button" class="agenda-send-pdf" hidden>Share PDF</button>
                    <form method="dialog" class="agenda-share-close"><button type="submit" class="export-close">Close</button></form>
                </div>`;
            const preview = dialog.querySelector('textarea');
            const status = dialog.querySelector('.agenda-share-status');
            const includeSheet = dialog.querySelector('.agenda-include-sheet');
            const send = dialog.querySelector('.agenda-send-text');
            const downloadPdf = dialog.querySelector('.agenda-download-pdf');
            const sendPdf = dialog.querySelector('.agenda-send-pdf');
            let pdf;
            let pdfBusy = false;
            const updatePreview = () => {
                let text = noteText;
                if (includeSheet?.checked) {
                    const rows = agendaSheetValues(note.spreadsheet).map(row =>
                        row.map(value => String(value).replace(/[\t\r\n]+/g, ' ')).join('\t'));
                    text += `\n\nSpreadsheet:\n${rows.join('\n')}`;
                }
                preview.value = text;
                pdf = null;
                sendPdf.hidden = true;
                status.textContent = '';
                send.hidden = typeof navigator.share !== 'function' ||
                    (typeof navigator.canShare === 'function' && !navigator.canShare({ text: preview.value }));
            };
            includeSheet?.addEventListener('change', updatePreview);
            updatePreview();
            downloadPdf.onclick = async () => {
                if (pdfBusy) return;
                pdfBusy = downloadPdf.disabled = true;
                if (includeSheet) includeSheet.disabled = true;
                status.textContent = 'Preparing PDF…';
                try {
                    pdf ||= await makeAgendaPdf(note, preview.value);
                    if (!dialog.open) return;
                    const url = URL.createObjectURL(pdf);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = pdf.name;
                    anchor.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    sendPdf.hidden = typeof navigator.share !== 'function' ||
                        typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [pdf] });
                    status.textContent = 'PDF ready.';
                } catch (error) {
                    console.error('Could not generate Scratchpad PDF:', error);
                    status.textContent = `Could not create the PDF: ${error.message}`;
                } finally {
                    pdfBusy = downloadPdf.disabled = false;
                    if (includeSheet) includeSheet.disabled = false;
                }
            };
            sendPdf.onclick = async () => {
                if (!pdf) return;
                try {
                    await navigator.share({ files: [pdf] });
                } catch (error) {
                    if (error.name !== 'AbortError') status.textContent = 'Could not open sharing. Use the downloaded PDF instead.';
                }
            };
            dialog.querySelector('.agenda-copy-text').onclick = async () => {
                const text = preview.value;
                try {
                    if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
                    await navigator.clipboard.writeText(text);
                    if (dialog.open && preview.value === text) status.textContent = 'Note copied.';
                } catch {
                    if (!dialog.open) return;
                    preview.focus();
                    preview.select();
                    status.textContent = 'Could not copy automatically. Copy the selected text manually.';
                }
            };
            send.onclick = async () => {
                send.disabled = true;
                status.textContent = '';
                try {
                    await navigator.share({ text: preview.value });
                    if (dialog.open) dialog.close();
                } catch (error) {
                    if (error.name !== 'AbortError') status.textContent = 'Could not open sharing. Try Copy text instead.';
                } finally {
                    send.disabled = false;
                }
            };
            dialog.addEventListener('keydown', event => {
                if (event.key === 'Escape') event.stopPropagation();
            });
            dialog.addEventListener('close', () => {
                dialog.remove();
                trigger.focus();
            }, { once: true });
            document.body.append(dialog);
            dialog.showModal();
        }

        async function makeAgendaPdf(note, text) {
            const width = 1224, height = 1584, margin = 96, leading = 38;
            const canvas = Object.assign(document.createElement('canvas'), { width, height });
            const context = canvas.getContext('2d');
            if (!context) throw new Error('PDF generation is unavailable in this browser.');
            const pages = [];
            let y;
            const reset = () => {
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, width, height);
                context.fillStyle = '#282823';
                context.font = '26px sans-serif';
                context.textBaseline = 'top';
                y = margin;
            };
            const page = () => {
                const url = canvas.toDataURL('image/jpeg', 0.88);
                if (!url.startsWith('data:image/jpeg;base64,')) throw new Error('Could not encode a PDF page.');
                pages.push(Uint8Array.from(atob(url.split(',')[1]), char => char.charCodeAt(0)));
                reset();
            };
            const line = value => {
                if (y + leading > height - margin) page();
                context.fillText(value, margin, y);
                y += leading;
            };
            const write = value => {
                for (const paragraph of value.split(/\r?\n/)) {
                    let current = '';
                    for (const word of paragraph.split(/(?<=\s)(?=\S)/u)) {
                        if (current && context.measureText(current + word).width > width - 2 * margin) {
                            line(current);
                            current = '';
                        }
                        if (context.measureText(word).width > width - 2 * margin) {
                            for (const char of word) {
                                if (context.measureText(current + char).width > width - 2 * margin) {
                                    line(current);
                                    current = '';
                                }
                                current += char;
                            }
                        } else current += word;
                    }
                    line(current);
                }
            };
            reset();
            write(text.replaceAll('\t', '    '));
            for (const attachment of note.attachments || []) {
                if (!attachment.imageType) continue;
                const bytes = Uint8Array.from(atob(attachment.data), char => char.charCodeAt(0));
                const image = await createImageBitmap(new Blob([bytes], { type: attachment.imageType }));
                try {
                    const scale = Math.min((width - 2 * margin) / image.width, (height - 2 * margin - leading) / image.height, 1);
                    const drawnHeight = image.height * scale;
                    if (y + drawnHeight + leading > height - margin) page();
                    context.drawImage(image, margin, y, image.width * scale, drawnHeight);
                    y += drawnHeight + 12;
                    if (attachment.description) write(attachment.description);
                    y += leading;
                } finally {
                    image.close();
                }
            }
            page();
            const encoder = new TextEncoder();
            const parts = [];
            let offset = 0;
            const offsets = [0];
            const append = value => {
                const bytes = typeof value === 'string' ? encoder.encode(value) : value;
                parts.push(bytes);
                offset += bytes.length;
            };
            const object = (number, ...chunks) => {
                offsets[number] = offset;
                append(`${number} 0 obj\n`);
                chunks.forEach(append);
                append('\nendobj\n');
            };
            append('%PDF-1.4\n');
            object(1, '<< /Type /Catalog /Pages 2 0 R >>');
            object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>`);
            pages.forEach((jpeg, index) => {
                const id = 3 + 3 * index;
                object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /NotePage ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
                object(id + 1, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream');
                const commands = 'q 612 0 0 792 0 0 cm /NotePage Do Q\n';
                object(id + 2, `<< /Length ${commands.length} >>\nstream\n${commands}endstream`);
            });
            const xref = offset;
            append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
            offsets.slice(1).forEach(entry => append(`${String(entry).padStart(10, '0')} 00000 n \n`));
            append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
            const name = note.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 100) || 'Scratchpad note';
            return new File(parts, `${name}.pdf`, { type: 'application/pdf' });
        }

        function deleteAgendaNote(note) {
            if (!confirm(`Delete the Scratchpad note "${note.title}"? This cannot be undone.`)) return;
            if (agendaDraft?.noteId === note.id) clearAgendaDraft();
            state.agendaNotes = state.agendaNotes.filter(item => item.id !== note.id);
            scheduleSave();
            renderAgendaCards();
            agendaNewNoteButton().focus();
        }

        function normalizeAgendaNotes(notes, documents) {
            if (notes === undefined) return [];
            if (!Array.isArray(notes)) throw new Error('The saved Scratchpad notes list is not valid.');
            const ids = new Set();
            const projects = new Set(documents.map(doc => doc.id));
            return notes.map(note => {
                if (!note || typeof note.id !== 'string' || !note.id || ids.has(note.id) ||
                    typeof note.title !== 'string' || !note.title.trim() || typeof note.content !== 'string' ||
                    (note.contentHtml !== undefined && typeof note.contentHtml !== 'string') ||
                    (note.spreadsheet !== undefined && !validAgendaSheet(note.spreadsheet)) ||
                    (note.attachments !== undefined && (!Array.isArray(note.attachments) || !note.attachments.every(validAgendaAttachment))) ||
                    typeof note.projectId !== 'string' || typeof note.date !== 'string' ||
                    (note.date !== '' && !validAgendaDate(note.date)) || typeof note.onTheAgenda !== 'boolean' ||
                    [note.createdAt, note.modifiedAt].some(value => value !== undefined && !validAgendaTimestamp(value))) {
                    throw new Error('A saved Scratchpad note is not valid.');
                }
                ids.add(note.id);
                return { ...note, projectId: projects.has(note.projectId) ? note.projectId : '' };
            });
        }

        function validAgendaDate(value) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
            const date = new Date(`${value}T00:00:00Z`);
            return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
        }

        function detachAgendaProjects() {
            const projects = new Set(state.documents.map(doc => doc.id));
            state.agendaNotes.forEach(note => {
                if (note.projectId && !projects.has(note.projectId)) {
                    note.projectId = '';
                    note.modifiedAt = new Date().toISOString();
                }
            });
        }

        function agendaTimestamp(label, value) {
            const badge = document.createElement(value ? 'time' : 'span');
            badge.className = 'agenda-badge agenda-date-badge';
            if (value) badge.dateTime = value;
            badge.textContent = `${label}: ${formatNodeTimestamp(value)}`;
            return badge;
        }

        function agendaProjectLabel(doc) {
            const space = state.spaces.find(item => item.id === doc.spaceId);
            return `${space.name} / ${doc.title}`;
        }

        function setAgendaProjectOptions(select, label, value) {
            select.replaceChildren(new Option(label, ''));
            state.documents.forEach(doc => select.add(new Option(agendaProjectLabel(doc), doc.id)));
            if ([...select.options].some(option => option.value === value)) select.value = value;
        }

        function showAgendaNotes(projectId = '', expandedNote = null) {
            if (!state.settings.agendaNotesEnabled) return;
            if (currentView !== 'agenda' && !closeAgendaEditor()) return;
            expandedAgendaNotes = new WeakSet();
            if (expandedNote) expandedAgendaNotes.add(expandedNote);
            document.getElementById('agenda-filter').value = 'all';
            setAgendaProjectOptions(document.getElementById('agenda-project-filter'), 'All projects', projectId);
            document.getElementById('agenda-search').value = '';
            currentView = 'agenda';
            render();
            if (narrowSidebar.matches) setSidebarOpen(false);
            document.getElementById('agenda-title').focus();
        }

        function agendaNoteMatches(note, query) {
            return `${note.title}\n${note.content}`.toLowerCase().includes(query);
        }

        function openAgendaSearchResult(note) {
            if (agendaDraft?.noteId !== note.id && !closeAgendaEditor()) return;
            showAgendaNotes(note.projectId, note);
            const target = agendaDraft?.noteId === note.id
                ? agendaDraft.card.querySelector('.agenda-first-line')
                : document.querySelector(`[data-agenda-edit="${CSS.escape(note.id)}"]`);
            target?.focus({ preventScroll: true });
            target?.scrollIntoView({ block: 'center' });
        }

        function renderProjectAgendaCount(doc) {
            const button = document.getElementById('project-agenda-count');
            button.hidden = !state.settings.agendaNotesEnabled;
            if (button.hidden) return;
            const count = state.agendaNotes.filter(note => note.projectId === doc.id).length;
            const label = `${count} ${count === 1 ? 'note card' : 'note cards'}`;
            button.textContent = label;
            button.setAttribute('aria-label', `${label} attached to ${doc.title}`);
            button.title = 'Open attached notes';
            button.onclick = () => showAgendaNotes(doc.id);
        }

        function appendAgendaInline(target, text) {
            text.split(/(\*\*[^*\n]+\*\*)/).forEach(part => {
                if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                    const strong = document.createElement('strong');
                    strong.textContent = part.slice(2, -2);
                    target.appendChild(strong);
                } else {
                    target.append(part);
                }
            });
        }

        function renderAgendaBody(container, note, onModified) {
            function saveChecklistChange(checkbox) {
                note.modifiedAt = new Date().toISOString();
                scheduleSave();
                onModified?.(checkbox);
            }
            if (note.contentHtml) {
                container.append(safeNoteContent(note.contentHtml, true));
                container.onchange = event => {
                    if (!event.target.matches('ul[data-checklist] input[type="checkbox"]')) return;
                    event.target.toggleAttribute('checked', event.target.checked);
                    note.contentHtml = cleanAgendaBody(container).innerHTML;
                    saveChecklistChange(event.target);
                };
                return;
            }
            const lines = note.content.split('\n');
            lines.forEach((line, index) => {
                const heading = /^(#{1,2}) (.*)$/.exec(line);
                const task = /^- \[([ xX])\] (.*)$/.exec(line);
                const row = document.createElement(heading ? (heading[1].length === 1 ? 'h3' : 'h4') : task ? 'label' : 'div');
                if (task) {
                    row.className = 'agenda-task';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = task[1].toLowerCase() === 'x';
                    if (!task[2].trim()) checkbox.setAttribute('aria-label', `Checklist item ${index + 1}`);
                    checkbox.onchange = () => {
                        lines[index] = `- [${checkbox.checked ? 'x' : ' '}] ${task[2]}`;
                        note.content = lines.join('\n');
                        saveChecklistChange(checkbox);
                    };
                    const text = document.createElement('span');
                    appendAgendaInline(text, task[2]);
                    row.append(checkbox, text);
                } else {
                    appendAgendaInline(row, heading ? heading[2] : line.startsWith('- ') ? `• ${line.slice(2)}` : line);
                }
                container.appendChild(row);
            });
        }

        function renderAgendaNotes() {
            const projectFilter = document.getElementById('agenda-project-filter');
            setAgendaProjectOptions(projectFilter, 'All projects', projectFilter.value);
            renderAgendaCards();
        }

        function agendaNewNoteButton() {
            return document.getElementById(currentView === 'project' ? 'project-agenda-new-note' : 'agenda-new-note');
        }
        function renderAgendaCards() {
            const inProject = currentView === 'project';
            const list = document.getElementById(inProject ? 'project-agenda-cards' : 'agenda-cards');
            const otherList = document.getElementById(inProject ? 'agenda-cards' : 'project-agenda-cards');
            otherList.replaceChildren();
            if (agendaDraft && agendaDraft.workspace !== state) clearAgendaDraft();
            const filter = inProject ? 'all' : document.getElementById('agenda-filter').value;
            const project = inProject ? activeDocument().id : document.getElementById('agenda-project-filter').value;
            const query = inProject ? '' : document.getElementById('agenda-search').value.trim().toLowerCase();
            const today = localDateTimeValue(Date.now()).slice(0, 10);
            const activity = note => note.modifiedAt || note.createdAt || '';
            const notes = state.agendaNotes.filter(note =>
                (filter !== 'today' || [note.createdAt, note.modifiedAt].some(value =>
                    value && localDateTimeValue(value).slice(0, 10) === today)) &&
                (!project || note.projectId === project) &&
                agendaNoteMatches(note, query)
            ).sort((a, b) => (activity(b) || b.date).localeCompare(activity(a) || a.date));
            document.getElementById(inProject ? 'project-agenda-note-count' : 'agenda-note-count').textContent = `${notes.length} ${notes.length === 1 ? 'note card' : 'note cards'}`;
            if (inProject) renderProjectAgendaCount(activeDocument());
            list.replaceChildren();
            list.classList.toggle('has-notes', notes.length > 0 || !!agendaDraft);
            if (agendaDraft) {
                agendaDraft.updateSheet();
            }
            if (agendaDraft && !notes.some(note => note.id === agendaDraft.noteId)) {
                list.append(agendaDraft.card);
                agendaDraft.fitTitle();
            }
            if (!notes.length) {
                if (agendaDraft) return;
                const empty = document.createElement('p');
                empty.className = 'doc-subtitle';
                empty.textContent = inProject ? 'No Scratchpad notes linked to this project yet.' : state.agendaNotes.length ? 'No notes match these filters.' : 'No Scratchpad notes yet. Choose New note to get started.';
                list.appendChild(empty);
                return;
            }
            for (const [index, note] of notes.entries()) {
                if (agendaDraft?.noteId === note.id) {
                    list.appendChild(agendaDraft.card);
                    agendaDraft.fitTitle();
                    continue;
                }
                const card = document.createElement('article');
                card.className = 'agenda-card';
                const heading = document.createElement('h2');
                const edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'agenda-note-title';
                edit.textContent = note.title;
                edit.setAttribute('aria-label', `Edit note: ${note.title}`);
                edit.dataset.agendaEdit = note.id;
                edit.onclick = () => editAgendaNote(note, 'title');
                heading.append(edit);
                const meta = document.createElement('div');
                meta.className = 'agenda-card-meta';
                const badges = document.createElement('div');
                badges.className = 'agenda-card-badges';
                const project = state.documents.find(doc => doc.id === note.projectId);
                const projectBadge = document.createElement('span');
                projectBadge.className = 'agenda-badge agenda-project-badge';
                projectBadge.textContent = project ? agendaProjectLabel(project) : 'No project';
                badges.appendChild(projectBadge);
                const created = agendaTimestamp('Created', note.createdAt);
                created.classList.add('agenda-created-date');
                badges.appendChild(created);
                const info = document.createElement('details');
                info.className = 'agenda-info-menu';
                const infoToggle = document.createElement('summary');
                infoToggle.className = 'agenda-card-action';
                infoToggle.title = 'Note information';
                infoToggle.setAttribute('aria-label', `Note information: ${note.title}`);
                infoToggle.appendChild(createIcon('more'));
                const infoContent = document.createElement('div');
                infoContent.className = 'agenda-info-content';
                infoContent.appendChild(agendaTimestamp('Modified', note.modifiedAt));
                if (note.date) {
                    const legacy = document.createElement('time');
                    legacy.className = 'agenda-badge agenda-date-badge';
                    legacy.dateTime = note.date;
                    legacy.textContent = `Previous date: ${note.date}`;
                    infoContent.appendChild(legacy);
                }
                info.append(infoToggle, infoContent);
                const hasSheet = state.settings.agendaSpreadsheetsEnabled && note.spreadsheet;
                const body = document.createElement('div');
                body.className = 'agenda-note-body';
                if (note.content || note.contentHtml) renderAgendaBody(body, note, checkbox => {
                    const focused = document.activeElement === checkbox;
                    const position = [...body.querySelectorAll('input[type="checkbox"]')].indexOf(checkbox);
                    renderAgendaCards();
                    if (focused) {
                        const title = list.querySelector(`[data-agenda-edit="${CSS.escape(note.id)}"]`);
                        const next = title?.closest('.agenda-card').querySelectorAll('.agenda-note-body input[type="checkbox"]')[position];
                        (next || agendaNewNoteButton()).focus({ preventScroll: true });
                    }
                });
                body.onclick = event => {
                    if (event.target.closest('input, a, [data-agenda-embed]') || !window.getSelection().isCollapsed) return;
                    event.preventDefault();
                    editAgendaNote(note, 'content');
                };
                const details = document.createElement('div');
                details.append(body);
                const embeds = new Map();
                if (hasSheet) embeds.set('sheet', renderAgendaSheet(note.spreadsheet));
                if (note.attachments?.length) {
                    const files = document.createElement('div');
                    files.className = 'agenda-attachments';
                    for (const file of note.attachments) {
                        const host = document.createElement('div');
                        host.className = 'agenda-attachments';
                        renderAgendaAttachments(host, [file]);
                        if (file.inlineId) embeds.set(file.inlineId, host);
                        else files.append(...host.childNodes);
                    }
                    details.append(files);
                    placeAgendaEmbeds(body, embeds);
                    for (const [id, host] of embeds) {
                        if (id !== 'sheet') files.append(...host.childNodes);
                    }
                    if (!files.hasChildNodes()) files.remove();
                } else {
                    placeAgendaEmbeds(body, embeds);
                }
                if (embeds.has('sheet')) details.append(embeds.get('sheet'));
                if (details.children.length > 1 || body.hasChildNodes()) {
                    details.id = `agenda-note-body-${index}`;
                    const toggle = document.createElement('button');
                    toggle.type = 'button';
                    toggle.className = 'node-branch-toggle agenda-collapse-toggle';
                    toggle.setAttribute('aria-controls', details.id);
                    function updateCollapse() {
                        const collapsed = !expandedAgendaNotes.has(note);
                        details.hidden = collapsed;
                        toggle.setAttribute('aria-expanded', String(!collapsed));
                        toggle.title = collapsed ? 'Expand note' : 'Collapse note';
                        toggle.setAttribute('aria-label', `${toggle.title}: ${note.title}`);
                    }
                    toggle.onclick = () => {
                        if (expandedAgendaNotes.has(note)) expandedAgendaNotes.delete(note);
                        else expandedAgendaNotes.add(note);
                        updateCollapse();
                    };
                    updateCollapse();
                    meta.append(toggle);
                }
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'agenda-delete agenda-card-action';
                remove.title = 'Delete note';
                remove.setAttribute('aria-label', `Delete note: ${note.title}`);
                remove.innerHTML = agendaDeleteIcon;
                remove.onclick = () => deleteAgendaNote(note);
                const share = document.createElement('button');
                share.type = 'button';
                share.className = 'agenda-card-action agenda-share';
                share.title = 'Share note';
                share.setAttribute('aria-label', `Share note: ${note.title}`);
                share.innerHTML = agendaShareIcon;
                share.onclick = () => shareAgendaNote(note, share);
                meta.append(badges, info, share, remove);
                card.append(meta, heading, details);
                list.appendChild(card);
            }
        }

        function editAgendaNote(note = null, focusField = 'title') {
            if (agendaDraft?.workspace === state && agendaDraft.noteId === note?.id) {
                agendaDraft.card.querySelector(focusField === 'title' ? '[name="title"]' : '.agenda-content-editor').focus();
                return;
            }
            if (!closeAgendaEditor()) return;
            const card = document.createElement('article');
            card.className = 'agenda-card agenda-editor';
            card.innerHTML = `
                <div class="agenda-edit-meta">
                    <label>Project <select name="project"></select></label>
                    <button type="button" class="agenda-save agenda-card-action" aria-label="Save note" title="Save note"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></button>
                </div>
                <div class="agenda-toolbar-slider">
                    <button type="button" class="agenda-toolbar-arrow" data-scroll="-1" aria-label="Scroll toolbar left" title="Scroll toolbar left" aria-controls="agenda-edit-toolbar" disabled><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>
                <div id="agenda-edit-toolbar" class="agenda-edit-toolbar" role="group" aria-label="Note editing tools (scroll sideways for more)" tabindex="0">
                    <div class="agenda-tool-group agenda-formatting" role="group" aria-label="Formatting">
                        <button type="button" class="agenda-toggle-formatting" aria-expanded="false" aria-controls="agenda-text-formatting" aria-label="Text formatting tools" title="Text formatting tools"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6V4h16v2M12 4v16m-4 0h8M7 10h10"/></svg></button>
                        <div class="agenda-formatting-tools" id="agenda-text-formatting" role="group" aria-label="Text formatting tools" hidden>
                        <button type="button" data-command="bold" aria-label="Bold" title="Bold"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5h5a3.5 3.5 0 0 1 0 7H8m0-7v14h6a3.5 3.5 0 0 0 0-7H8"/></svg></button>
                        <button type="button" data-command="italic" aria-label="Italic" title="Italic"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M11 5h8M5 19h8m2-14L9 19"/></svg></button>
                        <button type="button" data-command="underline" aria-label="Underline" title="Underline"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 5v6a5 5 0 0 0 10 0V5M5 20h14"/></svg></button>
                        <button type="button" data-command="insertUnorderedList" aria-label="Bulleted list" title="Bulleted list"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg></button>
                        <button type="button" data-command="insertOrderedList" aria-label="Numbered list" title="Numbered list"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5h11M10 12h11M10 19h11M3 4l1-1v5M3 8h3M3 11c0-2 3-2 3 0 0 1-3 3-3 4h3M3 18h3l-2 2c3-1 3 2 0 2"/></svg></button>
                        <button type="button" data-command="checklist" aria-label="Checklist" title="Checklist"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 6 2 2 4-4m3 2h9m-18 7 2 2 4-4m3 2h9M3 19h5m4 0h9"/></svg></button>
                        <div class="agenda-highlight-tools" role="group" aria-label="Highlight color">
                            <button type="button" class="agenda-toggle-highlight" aria-expanded="false" aria-controls="agenda-highlight-colors" aria-label="Highlight color" title="Highlight color"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 15 9-10 5 5-9 10H4zm6-6 5 5M3 22h18"/></svg></button>
                            <div id="agenda-highlight-colors" class="agenda-highlight-colors" role="group" aria-label="Highlight colors" hidden>
                                ${Object.entries(noteHighlightColors).map(([name, color]) => `<button type="button" data-command="hiliteColor" data-value="${color}" aria-label="${name}" title="${name}"><span class="agenda-highlight-swatch" style="background:${color}" aria-hidden="true"></span></button>`).join('')}
                                <button type="button" class="agenda-highlight-none" data-command="clearAgendaHighlight" aria-label="No color" title="No color"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 15 9-10 5 5-9 10H4zm6-6 5 5M3 22h18M4 4l16 16"/></svg></button>
                            </div>
                        </div>
                        <button type="button" data-command="strikeThrough" aria-label="Strikethrough" title="Strikethrough"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 6c-4-4-11-1-8 3m2 4c4 0 8 2 6 5-2 3-7 2-9 0M3 12h18"/></svg></button>
                        ${[1, 2, 3].map(level => `<button type="button" data-command="formatBlock" data-value="h${level}" aria-label="Heading ${level}" title="Heading ${level}"><span aria-hidden="true">H${level}</span></button>`).join('')}
                        <button type="button" data-command="removeFormat" aria-label="Clear formatting" title="Clear formatting"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 15 10-10 6 6-9 9H8zm6-6 6 6m-5 5h11"/></svg></button>
                        </div>
                    </div>
                    <div class="agenda-tool-group agenda-insert-tools" role="group" aria-label="Insert">
                        <button type="button" data-command="agendaLink" aria-label="Insert or edit link" title="Insert or edit link"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m10 13 4-4m-6 7-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-1 1"/></svg></button>
                        <button type="button" class="agenda-add-sheet" aria-label="Add spreadsheet" title="Add spreadsheet"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 4h18v16H3zM3 9h18m-12 0v11m6-11v11"/></svg></button>
                        <button type="button" class="agenda-attach-file" aria-label="Attach file" title="Attach file"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 13 7-7a3 3 0 0 1 4 4L9 20a4 4 0 0 1-6-6l9-9m-6 11 8-8"/></svg></button>
                        <button type="button" class="agenda-attach-image" aria-label="Add image" title="Add image"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 4h18v16H3zm0 12 6-6 4 4 3-3 5 5M16 8h.01"/></svg></button>
                    </div>
                    <div class="agenda-tool-group agenda-note-actions" role="group" aria-label="Note actions">
                        <button type="button" class="cancel-agenda" aria-label="Discard changes" title="Discard changes"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
                        ${note ? `<button type="button" class="agenda-delete" aria-label="Delete note" title="Delete note">${agendaDeleteIcon}</button>` : ''}
                    </div>
                </div>
                    <button type="button" class="agenda-toolbar-arrow" data-scroll="1" aria-label="Scroll toolbar right" title="Scroll toolbar right" aria-controls="agenda-edit-toolbar" disabled><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>
                </div>
                <input type="file" class="agenda-file-picker" hidden>
                <div class="agenda-writing-area">
                    <textarea class="agenda-first-line" name="title" rows="1" required aria-label="Note title, first line" placeholder="Note title"></textarea>
                    <div class="agenda-content-editor" contenteditable="true" role="textbox" aria-label="Note text" aria-multiline="true" data-placeholder="Write a note..."></div>
                </div>
                <div class="agenda-sheet-editor"></div>
                <div class="agenda-attachments" hidden></div>`;
            const [title, project] = ['title', 'project'].map(name => card.querySelector(`[name="${name}"]`));
            const content = card.querySelector('.agenda-content-editor');
            const attachments = [...(note?.attachments || [])];
            title.value = note?.title || '';
            if (note?.contentHtml) content.append(safeNoteContent(note.contentHtml, true));
            else if (note?.content) populateAgendaRichText(content, note);
            content.querySelectorAll('mark').forEach(mark => {
                const span = document.createElement('span');
                span.style.backgroundColor = mark.style.backgroundColor || noteHighlightColors.Yellow;
                span.append(...mark.childNodes);
                mark.replaceWith(span);
            });
            let updateToolbarArrows = () => {};
            let stopToolbarObserver = () => {};
            const selection = wireAgendaFormatting(card, content, () => updateToolbarArrows());
            const markerFor = id => content.querySelector(`[data-agenda-embed="${id}"]`);
            const insertMarker = (id, range) => {
                const marker = document.createElement('span');
                marker.contentEditable = 'false';
                marker.dataset.agendaEmbed = id;
                range.collapse(false);
                range.insertNode(marker);
                selection.after(marker);
                return marker;
            };
            const sheetHost = card.querySelector('.agenda-sheet-editor');
            const addSheet = card.querySelector('.agenda-add-sheet');
            const { read: readSheet, add } = editAgendaSheet(sheetHost, note?.spreadsheet, () => {
                markerFor('sheet')?.remove();
                card.append(sheetHost);
                updateSheet();
                addSheet.focus();
            });
            function updateSheet() {
                const enabled = state.settings.agendaSpreadsheetsEnabled;
                const marker = markerFor('sheet');
                if (!card.contains(sheetHost)) card.append(sheetHost);
                if (marker && !marker.contains(sheetHost)) marker.append(sheetHost);
                if (marker) marker.hidden = !enabled || !readSheet();
                sheetHost.hidden = !enabled || !readSheet();
                addSheet.hidden = !enabled;
                addSheet.setAttribute('aria-label', readSheet() ? 'Go to spreadsheet' : 'Add spreadsheet');
                addSheet.title = addSheet.getAttribute('aria-label');
            }
            const keepCursor = event => { selection.remember(); event.preventDefault(); };
            addSheet.onpointerdown = keepCursor;
            addSheet.onclick = () => {
                if (!readSheet()) insertMarker('sheet', selection.target());
                updateSheet();
                sheetHost.hidden = false;
                if (markerFor('sheet')) markerFor('sheet').hidden = false;
                add();
                updateSheet();
            };
            updateSheet();
            const readAttachments = wireAgendaAttachments(card, attachments, selection, markerFor, insertMarker);
            setAgendaProjectOptions(project, 'No project', note ? note.projectId : currentView === 'project' ? activeDocument().id : document.getElementById('agenda-project-filter').value);
            const cleanContent = () => cleanAgendaBody(content);
            const initialContent = cleanContent().innerHTML;
            const initialSheet = JSON.stringify(readSheet());
            const sheetDirty = () => JSON.stringify(readSheet()) !== initialSheet;
            const fields = () => JSON.stringify([title.value.trim(), project.value, cleanContent().innerHTML, readSheet(), attachments]);
            const initialFields = fields();
            const dirty = () => fields() !== initialFields;
            function finish(savedId = note?.id) {
                clearAgendaDraft();
                renderAgendaCards();
                const list = document.getElementById(currentView === 'project' ? 'project-agenda-cards' : 'agenda-cards');
                const edit = savedId && list.querySelector(`[data-agenda-edit="${CSS.escape(savedId)}"]`);
                (edit || agendaNewNoteButton()).focus();
            }
            const cancel = () => {
                if (!hasUnsavedAgendaDraft() || confirm('Discard changes to this Scratchpad note?')) finish();
            };
            card.querySelector('.cancel-agenda').onclick = cancel;
            if (note) {
                card.querySelector('.agenda-delete').onclick = () => deleteAgendaNote(note);
            }
            const fitTitle = () => {
                title.style.height = 'auto';
                title.style.height = `${title.scrollHeight}px`;
                updateToolbarArrows();
            };
            title.oninput = () => {
                if (/[\r\n]/.test(title.value)) title.value = title.value.replace(/\r\n?|\n/g, ' ');
                title.setCustomValidity('');
                fitTitle();
            };
            title.onpaste = event => {
                const text = event.clipboardData.getData('text/plain');
                if (!/[\r\n]/.test(text)) return;
                event.preventDefault();
                const [first, ...rest] = text.split(/\r\n?|\n/);
                title.setRangeText(first, title.selectionStart, title.selectionEnd, 'end');
                title.setCustomValidity('');
                fitTitle();
                const block = document.createElement('div');
                block.textContent = rest.join('\n');
                content.prepend(block);
                content.focus();
            };
            const save = () => {
                if (readAttachments()) {
                    showToast('Wait for the attachment to finish loading before saving.');
                    return false;
                }
                if (!title.value.trim()) {
                    title.setCustomValidity('Enter a note title.');
                    title.focus();
                    title.reportValidity();
                    return false;
                }
                if (note && !dirty()) {
                    finish();
                    return true;
                }
                const now = new Date().toISOString();
                const saved = note ? { ...note } : { id: makeId(), onTheAgenda: false, date: '', createdAt: now };
                const clean = cleanContent();
                if (!note || clean.innerHTML !== initialContent) {
                    const textOnly = clean.cloneNode(true);
                    textOnly.style.cssText = 'position:fixed;left:-10000px;white-space:pre-wrap';
                    card.append(textOnly);
                    saved.content = textOnly.innerText;
                    textOnly.remove();
                    // Some browsers indent by putting a list beside its parent item.
                    clean.querySelectorAll('ul > :is(ul, ol), ol > :is(ul, ol)').forEach(list => {
                        const parentItem = list.previousElementSibling;
                        if (parentItem?.matches('li')) parentItem.append(list);
                    });
                    saved.contentHtml = saved.content.trim() || clean.querySelector('ul[data-checklist] input[type="checkbox"], [data-agenda-embed]') ? clean.innerHTML : '';
                }
                const projectId = state.documents.some(doc => doc.id === project.value) ? project.value : '';
                const sheet = readSheet();
                if (sheet) saved.spreadsheet = sheet.map(row => [...row]);
                else delete saved.spreadsheet;
                Object.assign(saved, { title: title.value.trim(), projectId, modifiedAt: now });
                if (attachments.length) saved.attachments = [...attachments];
                else delete saved.attachments;
                if (attachments.length) {
                    const agendaNotes = note ? state.agendaNotes.map(item => item === note ? saved : item) : [saved, ...state.agendaNotes];
                    if (new Blob([JSON.stringify({ revision, state: { ...state, agendaNotes } })]).size > 5 * 1024 * 1024) {
                        showToast('This workspace would exceed 5 MB. Remove an attachment or shorten the note before saving.');
                        return false;
                    }
                }
                if (note) {
                    Object.assign(note, saved);
                    if (!sheet) delete note.spreadsheet;
                    if (!attachments.length) delete note.attachments;
                } else {
                    state.agendaNotes.unshift(saved);
                    document.getElementById('agenda-search').value = '';
                }
                scheduleSave();
                finish(saved.id);
                return true;
            };
            card.querySelector('.agenda-save').onclick = save;
            card.onkeydown = event => {
                if (event.defaultPrevented || event.isComposing) return;
                if (event.key === 'Escape' && event.target !== project) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeAgendaEditor();
                } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    save();
                } else if (event.key === 'Enter' && event.target === title) {
                    event.preventDefault();
                    content.focus();
                }
            };
            ({ updateArrows: updateToolbarArrows, stopToolbarObserver } = wireAgendaToolbarScroll(card));
            agendaDraft = { workspace: state, noteId: note?.id, card, dirty: () => readAttachments() || dirty(), sheetDirty, fitTitle, finish, save, stopToolbarObserver, updateSheet };
            renderAgendaCards();
            (focusField === 'title' ? title : content).focus();
        }

        function populateAgendaRichText(editor, note) {
            const preview = document.createElement('div');
            renderAgendaBody(preview, note);
            const lines = note.content.split('\n');
            const appendItem = (item, checklist) => {
                let list = editor.lastElementChild;
                if (!list?.matches(checklist ? 'ul[data-checklist]' : 'ul:not([data-checklist])')) {
                    list = document.createElement('ul');
                    if (checklist) list.dataset.checklist = 'true';
                    editor.append(list);
                }
                list.append(item);
            };
            [...preview.children].forEach((row, index) => {
                const line = lines[index];
                if (row.matches('.agenda-task')) {
                    const item = document.createElement('li');
                    const checkbox = row.querySelector('input');
                    checkbox.toggleAttribute('checked', checkbox.checked);
                    checkbox.setAttribute('contenteditable', 'false');
                    checkbox.setAttribute('aria-label', 'Checklist item');
                    item.append(checkbox, ' ', ...row.querySelector('span').childNodes);
                    appendItem(item, true);
                } else if (row.tagName === 'DIV' && line.startsWith('- ')) {
                    const item = document.createElement('li');
                    appendAgendaInline(item, line.slice(2));
                    appendItem(item, false);
                } else {
                    const block = document.createElement({ H3: 'h2', H4: 'h3' }[row.tagName] || row.tagName);
                    block.append(...row.childNodes);
                    if (!block.childNodes.length) block.append(document.createElement('br'));
                    editor.append(block);
                }
            });
        }

        function wireAgendaTyping(editor) {
            const currentRange = () => {
                const selection = window.getSelection();
                if (!selection?.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return null;
                return selection.getRangeAt(0);
            };
            const select = range => window.getSelection().setBaseAndExtent(
                range.startContainer, range.startOffset, range.endContainer, range.endOffset);
            const activeItem = range => {
                const node = range.startContainer;
                return (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement).closest('li');
            };
            editor.addEventListener('beforeinput', event => {
                if (!event.cancelable || event.isComposing) return;
                if (event.inputType === 'insertParagraph' && continueNoteChecklist(editor)) {
                    event.preventDefault();
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
                if (event.inputType !== 'insertText') return;
                const caret = currentRange();
                if (!caret || caret.startContainer.nodeType !== Node.TEXT_NODE) return;
                const node = caret.startContainer;
                const text = node.data.slice(0, caret.startOffset);
                if (event.data === ' ' && /^(#{1,3}|[-*]|1\.)$/.test(text)) {
                    const block = node.parentElement.closest('div, p, li, h1, h2, h3');
                    if (!block?.matches('div, p') || !editor.contains(block) || block.closest('li, table')) return;
                    const markers = caret.cloneRange();
                    markers.setStart(node, 0);
                    const preceding = markers.cloneRange();
                    preceding.setStart(block, 0);
                    preceding.setEnd(node, 0);
                    if (preceding.toString() || preceding.cloneContents().querySelector('br, div, p, ul, ol')) return;
                    const command = text.startsWith('#') ? 'formatBlock' : text === '1.' ? 'insertOrderedList' : 'insertUnorderedList';
                    if (!document.queryCommandEnabled(command)) return;
                    event.preventDefault();
                    select(markers);
                    document.execCommand('delete');
                    if (!document.execCommand(command, false, command === 'formatBlock' ? `h${text.length}` : null)) {
                        document.execCommand('insertText', false, `${text} `);
                        showToast('Could not apply the typing shortcut.');
                    }
                } else if (event.data === '*') {
                    const match = /(?:^|[^*])(\*\*([^*\n]+)\*)$/.exec(text);
                    if (!match || !match[2].trim() || node.parentElement.closest('b, strong')) return;
                    const strong = document.createElement('strong');
                    strong.textContent = match[2];
                    const markers = caret.cloneRange();
                    markers.setStart(node, caret.startOffset - match[1].length);
                    select(markers);
                    if (document.execCommand('insertHTML', false, strong.outerHTML)) {
                        event.preventDefault();
                        const after = currentRange();
                        const container = after?.startContainer;
                        const formatted = (container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentElement)?.closest('b, strong');
                        if (formatted) {
                            after.setStartAfter(formatted);
                            after.collapse(true);
                            select(after);
                        }
                        if (document.queryCommandState('bold')) document.execCommand('bold');
                    } else {
                        markers.collapse(false);
                        select(markers);
                        showToast('Could not apply the typing shortcut.');
                    }
                }
            });
            editor.addEventListener('keydown', event => {
                if (event.target.closest('[data-agenda-embed]') || event.defaultPrevented || event.isComposing ||
                    event.ctrlKey || event.metaKey || event.altKey || event.key !== 'Tab') return;
                const caret = currentRange();
                const item = caret && activeItem(caret);
                const list = item?.parentElement;
                if (!list?.matches('ul:not([data-checklist]), ol')) return;
                const parentItem = list.parentElement;
                if (event.shiftKey && parentItem.matches('li') && parentItem.parentElement.matches('ul:not([data-checklist]), ol')) {
                    // Outdent from a saved, semantic nested list without letting the browser nest one LI inside another.
                    event.preventDefault();
                    const node = caret.startContainer;
                    const offset = caret.startOffset;
                    const remaining = list.cloneNode(false);
                    while (item.nextElementSibling) remaining.append(item.nextElementSibling);
                    parentItem.after(item);
                    if (remaining.firstChild) item.append(remaining);
                    if (!list.firstElementChild) list.remove();
                    window.getSelection().collapse(node, offset);
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
                const command = event.shiftKey ? 'outdent' : 'indent';
                if (event.shiftKey ? !list.parentElement.closest('li, ul, ol') : !item.previousElementSibling?.matches('li')) return;
                if (document.execCommand(command)) event.preventDefault();
            });
        }

        function wireAgendaAttachments(card, files, selection, markerFor, insertMarker) {
            const host = card.querySelector('.agenda-attachments');
            const picker = card.querySelector('.agenda-file-picker');
            let loading = false;
            let imageOnly = false;
            let imageRange;
            const renderFiles = () => {
                card.querySelectorAll('[data-agenda-embed^="image-"]').forEach(marker => {
                    marker.replaceChildren();
                    marker.hidden = true;
                });
                renderAgendaAttachments(host, files, {
                removeFile(index) {
                    if (files[index].inlineId) markerFor(files[index].inlineId)?.remove();
                    files.splice(index, 1);
                    renderFiles();
                    card.querySelector('.agenda-attach-file').focus();
                },
                describeImage(index, description) {
                    const updated = { ...files[index] };
                    if (description.trim()) updated.description = description;
                    else delete updated.description;
                    files[index] = updated;
                },
                inlineHost(file) {
                    const marker = file.inlineId && markerFor(file.inlineId);
                    if (!marker) return null;
                    const inline = document.createElement('div');
                    inline.className = 'agenda-attachments';
                    marker.append(inline);
                    marker.hidden = false;
                    return inline;
                }
                });
            };
            const choose = images => {
                if (loading) {
                    showToast('An attachment is already loading.');
                    return;
                }
                imageOnly = images;
                imageRange = images ? selection.target() : null;
                picker.accept = images ? agendaImageTypes.join(',') : '';
                picker.click();
            };
            card.querySelector('.agenda-attach-file').onclick = () => choose(false);
            const addImage = card.querySelector('.agenda-attach-image');
            addImage.onpointerdown = event => { selection.remember(); event.preventDefault(); };
            addImage.onclick = () => choose(true);
            picker.onchange = async () => {
                const file = picker.files[0];
                picker.value = '';
                if (!file) return;
                const image = imageOnly;
                if (!file.size || file.size > (image ? 25 * 1024 * 1024 : agendaFileLimit) || file.name.length > 255) {
                    showToast(image ? 'Choose a non-empty image of up to 25 MB with a filename of at most 255 characters.'
                        : 'Choose a non-empty file of up to 256 KB with a filename of at most 255 characters.');
                    return;
                }
                if (image && !agendaImageTypes.includes(file.type)) {
                    showToast('Choose a PNG, JPEG, GIF, or WebP image.');
                    return;
                }
                loading = true;
                try {
                    const stored = image ? await resizeAgendaImage(file) : file;
                    if (agendaDraft?.card !== card) return;
                    const url = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(stored);
                    });
                    if (agendaDraft?.card !== card) return;
                    const attachment = {
                        name: stored.name, imageType: image ? stored.type : '', data: url.split(',')[1],
                        attachedAt: new Date().toISOString()
                    };
                    if (image) attachment.inlineId = `image-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`;
                    if (!validAgendaAttachment(attachment)) {
                        throw new Error('The saved attachment would be invalid or exceed 256 KB.');
                    }
                    files.push(attachment);
                    if (image) insertMarker(attachment.inlineId, selection.target(imageRange));
                    renderFiles();
                } catch (error) {
                    if (agendaDraft?.card === card) showToast(`Could not add ${image ? 'the image' : 'the attachment'}: ${error.message}`);
                } finally {
                    loading = false;
                }
            };
            renderFiles();
            return () => loading;
        }

        function wireAgendaToolbarScroll(card) {
            const toolbar = card.querySelector('.agenda-edit-toolbar');
            const [left, right] = card.querySelectorAll('.agenda-toolbar-arrow');
            const updateArrows = () => {
                left.disabled = toolbar.scrollLeft <= 1;
                right.disabled = toolbar.scrollWidth - toolbar.clientWidth - toolbar.scrollLeft <= 1;
            };
            const slide = direction => {
                toolbar.scrollBy({ left: direction * Math.max(36, toolbar.clientWidth - 36) });
                updateArrows();
            };
            [left, right].forEach(arrow => {
                // Keep the text selection available for formatting after scrolling with a mouse.
                arrow.onmousedown = event => event.preventDefault();
                arrow.onclick = () => slide(Number(arrow.dataset.scroll));
            });
            toolbar.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                slide(event.key === 'ArrowRight' ? 1 : -1);
            });
            toolbar.addEventListener('scroll', updateArrows);
            const observer = new ResizeObserver(updateArrows);
            observer.observe(toolbar);
            return { updateArrows, stopToolbarObserver: () => observer.disconnect() };
        }

        function wireAgendaFormatting(card, editor, updateToolbarArrows) {
            wireAgendaTyping(editor);
            let range;
            const remember = () => {
                const selection = window.getSelection();
                if (selection.rangeCount && inEditor(selection.getRangeAt(0))) range = selection.getRangeAt(0).cloneRange();
            };
            const inEditor = candidate => [candidate.startContainer, candidate.endContainer].every(node =>
                editor.contains(node) && !(node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('[data-agenda-embed]'));
            const target = (saved = range) => {
                if (saved && inEditor(saved)) return saved.cloneRange();
                const end = document.createRange();
                end.selectNodeContents(editor);
                end.collapse(false);
                return end;
            };
            const restore = saved => {
                editor.focus();
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(saved);
                range = saved.cloneRange();
                return selection;
            };
            const after = node => {
                const next = document.createRange();
                next.setStartAfter(node);
                next.collapse(true);
                restore(next);
            };
            for (const type of ['input', 'pointerup', 'keyup', 'focusout']) editor.addEventListener(type, remember);
            editor.onpaste = event => {
                if (event.target.closest('[data-agenda-embed]')) return;
                event.preventDefault();
                document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
            };
            editor.ondrop = event => event.preventDefault();
            editor.onchange = event => {
                if (event.target.matches('ul[data-checklist] input[type="checkbox"]')) {
                    event.target.toggleAttribute('checked', event.target.checked);
                }
            };
            const formattingToggle = card.querySelector('.agenda-toggle-formatting');
            const formattingTools = card.querySelector('.agenda-formatting-tools');
            formattingToggle.onpointerdown = event => { remember(); event.preventDefault(); };
            formattingToggle.onclick = () => {
                formattingTools.hidden = !formattingTools.hidden;
                formattingToggle.setAttribute('aria-expanded', String(!formattingTools.hidden));
                if (formattingTools.hidden) {
                    highlightColors.hidden = true;
                    highlightToggle.setAttribute('aria-expanded', 'false');
                }
                updateToolbarArrows();
            };
            const highlightToggle = card.querySelector('.agenda-toggle-highlight');
            const highlightColors = card.querySelector('.agenda-highlight-colors');
            highlightToggle.onpointerdown = event => { remember(); event.preventDefault(); };
            highlightToggle.onclick = () => {
                highlightColors.hidden = !highlightColors.hidden;
                highlightToggle.setAttribute('aria-expanded', String(!highlightColors.hidden));
                updateToolbarArrows();
            };
            card.querySelectorAll('[data-command]').forEach(button => {
                button.onpointerdown = event => { remember(); event.preventDefault(); };
                button.onclick = () => {
                    const saved = target();
                    const command = button.dataset.command;
                    if (command === 'clearAgendaHighlight') {
                        if (saved.collapsed) {
                            showToast('Select text to remove its highlight.');
                            return;
                        }
                        const highlightAt = node => {
                            let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                            while (element && element !== editor) {
                                if (element.tagName === 'MARK' || noteHighlightStyles.includes(element.style.backgroundColor)) return element;
                                element = element.parentElement;
                            }
                            return null;
                        };
                        const startHighlight = highlightAt(saved.startContainer);
                        const endHighlight = highlightAt(saved.endContainer);
                        const fragment = saved.extractContents();
                        const clearHighlights = content => {
                            const highlighted = [...content.querySelectorAll('mark, span[style]')];
                            [...content.children].filter(element => element.matches('mark, span[style]')).forEach(element => highlighted.unshift(element));
                            highlighted.forEach(element => {
                                const isHighlight = element.tagName === 'MARK' ||
                                    noteHighlightStyles.includes(element.style.backgroundColor);
                                if (!isHighlight) return;
                                if (element.tagName === 'MARK') element.replaceWith(...element.childNodes);
                                else {
                                    element.style.removeProperty('background-color');
                                    if (!element.getAttribute('style')) element.removeAttribute('style');
                                }
                            });
                        };
                        let last;
                        if (startHighlight && startHighlight === endHighlight) {
                            const before = document.createRange();
                            before.setStart(startHighlight, 0);
                            before.setEnd(saved.startContainer, saved.startOffset);
                            const after = document.createRange();
                            after.setStart(saved.endContainer, saved.endOffset);
                            after.setEnd(startHighlight, startHighlight.childNodes.length);
                            const prefix = before.cloneContents();
                            const suffix = after.cloneContents();
                            const removeEmptyHighlights = content => {
                                [...content.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && !node.data).forEach(node => node.remove());
                                const empty = element => !element.textContent && !element.querySelector('br, input, img');
                                [...content.querySelectorAll('mark, span[style]')].filter(empty).forEach(element => element.remove());
                                [...content.children].filter(element => element.matches('mark, span[style]') && empty(element)).forEach(element => element.remove());
                            };
                            removeEmptyHighlights(prefix);
                            removeEmptyHighlights(suffix);
                            clearHighlights(fragment);
                            const replacement = document.createDocumentFragment();
                            const appendHighlighted = content => {
                                if (!content.hasChildNodes()) return;
                                const wrapper = startHighlight.cloneNode(false);
                                wrapper.append(content);
                                replacement.append(wrapper);
                            };
                            appendHighlighted(prefix);
                            last = fragment.lastChild;
                            replacement.append(fragment);
                            appendHighlighted(suffix);
                            startHighlight.replaceWith(replacement);
                        } else {
                            clearHighlights(fragment);
                            last = fragment.lastChild;
                            saved.insertNode(fragment);
                        }
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                        if (last) after(last);
                        highlightColors.hidden = true;
                        highlightToggle.setAttribute('aria-expanded', 'false');
                        updateToolbarArrows();
                        return;
                    }
                    const start = saved.startContainer.nodeType === Node.ELEMENT_NODE ? saved.startContainer : saved.startContainer.parentElement;
                    if (command === 'agendaLink') {
                        const candidate = start?.closest('a');
                        editAgendaLink(saved, candidate?.contains(saved.endContainer) ? candidate : null, restore, after);
                        return;
                    }
                    if (command === 'checklist') saved.collapse(false);
                    const selection = restore(saved);
                    const value = command === 'checklist'
                        ? '<ul data-checklist="true" data-new-checklist><li><input type="checkbox" contenteditable="false" aria-label="Checklist item"> <br></li></ul><div><br></div>'
                        : button.dataset.value || null;
                    if (!document.execCommand(command === 'checklist' ? 'insertHTML' : command, false, value)) {
                        showToast('Could not apply formatting. Select text and try again.');
                    } else if (command === 'checklist') {
                        const list = editor.querySelector('ul[data-new-checklist]');
                        if (list) {
                            list.removeAttribute('data-new-checklist');
                            selection.collapse(list.firstElementChild, 2);
                        } else {
                            showToast('Could not place the cursor inside the checklist.');
                        }
                    }
                    if (command === 'removeFormat') {
                        const heading = start?.closest('h1, h2, h3');
                        if (heading?.contains(saved.endContainer)) document.execCommand('formatBlock', false, 'p');
                    }
                    if (command === 'hiliteColor') {
                        highlightColors.hidden = true;
                        highlightToggle.setAttribute('aria-expanded', 'false');
                        updateToolbarArrows();
                    }
                    remember();
                };
            });
            return { remember, target, after };
        }

        function editAgendaLink(range, link, restore, after) {
            const dialog = document.createElement('dialog');
            dialog.className = 'modal agenda-link-dialog';
            dialog.setAttribute('aria-label', link ? 'Edit link' : 'Insert link');
            dialog.innerHTML = `<form class="export-body">
                <label>Link address <input name="address" inputmode="url" autocomplete="off" placeholder="https://example.com" autofocus></label>
                <div class="export-actions"><button type="submit">Apply link</button>
                ${link ? '<button type="button" class="agenda-unlink">Remove link</button>' : ''}
                <button type="button" class="export-close">Cancel</button></div>
            </form>`;
            const form = dialog.querySelector('form');
            const input = form.elements.address;
            input.value = link?.getAttribute('href') || '';
            input.oninput = () => input.setCustomValidity('');
            dialog.querySelector('.export-close').onclick = () => dialog.close();
            dialog.onclose = () => { dialog.remove(); if (!applied) restore(range); };
            let applied = false;
            const unlink = dialog.querySelector('.agenda-unlink');
            if (unlink) unlink.onclick = () => {
                const end = link.lastChild;
                link.replaceWith(...link.childNodes);
                applied = true;
                dialog.close();
                if (end) after(end);
                else restore(range);
            };
            form.onsubmit = event => {
                event.preventDefault();
                const raw = input.value.trim();
                let address;
                try {
                    if (raw) address = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
                } catch (error) {
                    if (!(error instanceof TypeError)) throw error;
                }
                if (!address || !['http:', 'https:', 'mailto:'].includes(address.protocol)) {
                    input.setCustomValidity('Enter a valid HTTP, HTTPS, or mailto address.');
                    input.reportValidity();
                    return;
                }
                applied = true;
                dialog.close();
                if (link) {
                    link.href = address.href;
                    after(link);
                } else if (range.collapsed) {
                    const anchor = document.createElement('a');
                    anchor.href = address.href;
                    anchor.textContent = address.href;
                    range.insertNode(anchor);
                    after(anchor);
                } else {
                    restore(range);
                    if (!document.execCommand('createLink', false, address.href)) showToast('Could not link the selected text.');
                }
            };
            document.body.append(dialog);
            dialog.showModal();
        }
