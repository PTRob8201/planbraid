/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function validateCustomFields(fields, withValues) {
            if (!Array.isArray(fields)) throw new Error('Custom fields are not valid.');
            const ids = new Set();
            for (const field of fields) {
                if (!field || typeof field.id !== 'string' || !field.id || ids.has(field.id) ||
                    typeof field.label !== 'string' || !field.label.trim() ||
                    !['text', 'number', 'date', 'checkbox', 'dropdown'].includes(field.type) ||
                    !Array.isArray(field.options) || field.options.some(option => typeof option !== 'string' || !option.trim()) ||
                    new Set(field.options).size !== field.options.length ||
                    (field.type === 'dropdown' && !field.options.length) ||
                    (field.type !== 'dropdown' && field.options.length) ||
                    (field.size !== undefined && !['auto', 'fixed'].includes(field.size)) ||
                    (field.size === 'fixed' && (!Number.isInteger(field.width) || field.width < 48 || field.width > 1200)) ||
                    (field.size !== 'fixed' && field.width !== undefined)) {
                    throw new Error('A custom field definition is not valid.');
                }
                ids.add(field.id);
                if (withValues && (field.type === 'checkbox' ? typeof field.value !== 'boolean' :
                    typeof field.value !== 'string' ||
                    (field.type === 'dropdown' && field.value !== '' && !field.options.includes(field.value)) ||
                    (field.type === 'number' && field.value !== '' && !Number.isFinite(Number(field.value))) ||
                    (field.type === 'date' && field.value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(field.value)))) {
                    throw new Error(`The value of ${field.label} is not valid.`);
                }
            }
        }
        function validateTemplateOutline(outline) {
            let previousDepth = -1;
            for (const [index, line] of outline.split(/\r?\n/).entries()) {
                if (!line.trim()) continue;
                const indent = line.match(/^ */)[0].length;
                if (line.includes('\t') || indent % 2 || indent / 2 > previousDepth + 1) {
                    throw new Error(`Invalid outline indentation on line ${index + 1}. Use two spaces per level without skipping levels.`);
                }
                previousDepth = indent / 2;
            }
        }
        function nodesFromTemplateOutline(outline) {
            validateTemplateOutline(outline);
            const roots = [];
            const levels = [roots];
            for (const line of outline.split(/\r?\n/)) {
                if (!line.trim()) continue;
                const depth = line.match(/^ */)[0].length / 2;
                const node = createNode();
                node.text = line.trim();
                levels[depth].push(node);
                levels[depth + 1] = node.children;
            }
            return roots;
        }

        function createCustomFieldInput(field) {
            let input;
            if (field.type === 'dropdown') {
                input = document.createElement('select');
                input.appendChild(new Option('Select…', ''));
                field.options.forEach(option => input.appendChild(new Option(option, option)));
                input.value = field.value;
            } else {
                input = document.createElement('input');
                input.type = field.type;
                if (field.type === 'number') input.step = 'any';
                if (field.type === 'checkbox') input.checked = field.value;
                else input.value = field.value;
            }
            return input;
        }
        function renderProjectFields(doc) {
            const container = document.getElementById('project-fields');
            container.replaceChildren();
            container.hidden = !doc.customFields.length;
            doc.customFields.forEach(field => {
                const label = document.createElement('label');
                label.className = 'project-field';
                if (field.size === 'fixed') label.style.width = `${field.width}px`;
                else label.classList.add('project-field-auto');
                const name = document.createElement('span');
                name.textContent = field.label;
                const input = createCustomFieldInput(field);
                if (field.size !== 'fixed' && field.type !== 'checkbox') {
                    const measure = document.createElement('span');
                    measure.className = 'project-field-measure';
                    measure.setAttribute('aria-hidden', 'true');
                    const updateMeasure = () => {
                        measure.textContent = field.type === 'dropdown' ? input.selectedOptions[0].textContent : input.value || '     ';
                    };
                    input.addEventListener('input', updateMeasure);
                    input.addEventListener('change', updateMeasure);
                    updateMeasure();
                    label.appendChild(measure);
                }
                input.addEventListener('change', () => {
                    if (!input.checkValidity()) {
                        input.reportValidity();
                        return;
                    }
                    field.value = field.type === 'checkbox' ? input.checked : input.value;
                    scheduleSave();
                    renderPMProjectHeader(doc);
                });
                label.append(name, input);
                container.appendChild(label);
            });
        }
        function templateFieldUpdate(doc, template) {
            const existing = new Map(doc.customFields.map(field => [field.id, field]));
            const templateIds = new Set(template.fields.map(field => field.id));
            const changes = [];
            const kept = [];
            const fields = template.fields.map(definition => {
                const old = existing.get(definition.id);
                if (!old) {
                    changes.push(`Add: ${definition.label}`);
                    return { ...structuredClone(definition), value: definition.type === 'checkbox' ? false : '' };
                }
                if (old.type !== definition.type || (definition.type === 'dropdown' && old.value !== '' && !definition.options.includes(old.value))) {
                    kept.push(`${old.label}: type changed or the selected value is no longer an option`);
                    return structuredClone(old);
                }
                if (old.label !== definition.label || JSON.stringify(old.options) !== JSON.stringify(definition.options) ||
                    (old.size || 'auto') !== (definition.size || 'auto') || old.width !== definition.width) {
                    changes.push(`Update: ${old.label}${old.label !== definition.label ? ` → ${definition.label}` : ''}`);
                }
                return { ...structuredClone(definition), value: old.value };
            });
            doc.customFields.filter(field => !templateIds.has(field.id)).forEach(field => {
                kept.push(`${field.label}: not in this template`);
                fields.push(structuredClone(field));
            });
            if (doc.customFields.length !== fields.length || fields.some((field, index) => doc.customFields[index]?.id !== field.id)) {
                changes.push('Reorder fields to match the template; retained fields appear last.');
            }
            validateCustomFields(fields, true);
            return { fields, changes, kept };
        }
        function updateProjectFromTemplate(doc) {
            if (!state.settings.templatesEnabled) {
                showToast('Project templates are disabled in Settings.');
                return;
            }
            if (!state.templates.length) {
                showToast('No project templates are available. Create one first.');
                return;
            }
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                <section class="modal" role="dialog" aria-modal="true" aria-labelledby="update-template-title">
                    <h2 id="update-template-title">Update project from template</h2>
                    <p>Update custom fields only. Project notes and existing values are not replaced.</p>
                    <form class="template-form">
                        <label>Template<select name="template" required></select></label>
                        <div class="template-update-preview" aria-live="polite"></div>
                        <div class="template-field-actions"><button type="submit">Update fields</button><button type="button" class="cancel-template-update">Cancel</button></div>
                    </form>
                </section></div>`;
            const form = root.querySelector('form');
            const select = form.elements.template;
            select.appendChild(new Option('Choose a template…', ''));
            state.templates.forEach(template => select.appendChild(new Option(template.name, template.id)));
            if (doc.templateId && state.templates.some(template => template.id === doc.templateId)) select.value = doc.templateId;
            const preview = root.querySelector('.template-update-preview');
            function renderPreview() {
                preview.replaceChildren();
                const template = state.templates.find(item => item.id === select.value);
                if (!template) {
                    preview.textContent = doc.templateId ? 'The linked template is unavailable. Choose a template.' : 'Choose the template to use for this project.';
                    return;
                }
                const result = templateFieldUpdate(doc, template);
                function group(title, items, empty) {
                    const heading = document.createElement('strong');
                    heading.textContent = title;
                    preview.appendChild(heading);
                    if (!items.length) {
                        const message = document.createElement('p');
                        message.textContent = empty;
                        preview.appendChild(message);
                        return;
                    }
                    const list = document.createElement('ul');
                    items.forEach(item => {
                        const entry = document.createElement('li');
                        entry.textContent = item;
                        list.appendChild(entry);
                    });
                    preview.appendChild(list);
                }
                group('Changes', result.changes, 'No field definitions to add or change.');
                group('Kept unchanged', result.kept, 'No incompatible or removed fields.');
            }
            select.onchange = renderPreview;
            renderPreview();
            root.querySelector('.cancel-template-update').onclick = closeModal;
            form.onsubmit = event => {
                event.preventDefault();
                const template = state.templates.find(item => item.id === select.value);
                if (!template || !state.documents.includes(doc)) {
                    showToast('The project or template is no longer available.');
                    return;
                }
                const result = templateFieldUpdate(doc, template);
                doc.customFields = result.fields;
                doc.templateId = template.id;
                closeModal();
                scheduleSave();
                render();
                showToast(result.kept.length ? `Template applied. ${result.kept.length} field(s) kept unchanged.` : 'Template fields updated.');
            };
            select.focus();
        }
        function templateIconButton(label, paths) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'template-icon-button';
            button.setAttribute('aria-label', label);
            button.title = label;
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            paths.forEach(shape => {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', shape);
                svg.appendChild(path);
            });
            button.appendChild(svg);
            return button;
        }
        const templateIcons = {
            add: ['M12 5v14M5 12h14'],
            edit: ['M4 20h4L19 9a2 2 0 0 0-4-4L4 16v4z', 'M13 7l4 4'],
            remove: ['M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5'],
            up: ['M12 19V5M6 11l6-6 6 6'],
            down: ['M12 5v14M6 13l6 6 6-6']
        };
        function showTemplates() {
            if (!state.settings.templatesEnabled) {
                showToast('Project templates are disabled in Settings.');
                return;
            }
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                <section class="modal" role="dialog" aria-modal="true" aria-labelledby="templates-title">
                    <h2 id="templates-title">Project templates</h2>
                    <p>Create reusable project fields and starter outlines.</p>
                    <div class="template-list"></div>
                    <div class="space-form-actions"><button type="button" class="new-template">New template</button><button type="button" class="close-templates">Close</button></div>
                </section></div>`;
            const list = root.querySelector('.template-list');
            if (!state.templates.length) {
                const empty = document.createElement('p');
                empty.textContent = 'No templates yet.';
                list.appendChild(empty);
            }
            state.templates.forEach(template => {
                const row = document.createElement('div');
                row.className = 'template-row';
                const name = document.createElement('input');
                name.className = 'template-inline-name';
                name.value = template.name;
                name.maxLength = 120;
                name.setAttribute('aria-label', `Template name: ${template.name}`);
                const actions = document.createElement('div');
                actions.className = 'template-row-actions';
                const edit = templateIconButton(`Edit ${template.name}`, templateIcons.edit);
                const remove = templateIconButton(`Delete ${template.name}`, templateIcons.remove);
                name.onchange = () => {
                    const value = name.value.trim();
                    if (!value) {
                        name.value = template.name;
                        showToast('Template name cannot be empty.');
                        return;
                    }
                    if (value !== template.name) {
                        template.name = value;
                        scheduleSave();
                    }
                    name.value = value;
                    name.setAttribute('aria-label', `Template name: ${value}`);
                    edit.setAttribute('aria-label', `Edit ${value}`);
                    edit.title = `Edit ${value}`;
                    remove.setAttribute('aria-label', `Delete ${value}`);
                    remove.title = `Delete ${value}`;
                };
                name.onkeydown = event => {
                    if (event.key === 'Enter') { event.preventDefault(); name.blur(); }
                    if (event.key === 'Escape') { event.stopPropagation(); name.value = template.name; name.blur(); }
                };
                edit.onclick = () => editTemplate(template.id);
                remove.onclick = () => {
                    if (!confirm(`Delete template "${template.name}"? Existing projects will not be changed.`)) return;
                    state.templates = state.templates.filter(item => item.id !== template.id);
                    scheduleSave();
                    showTemplates();
                };
                actions.append(edit, remove);
                row.append(name, actions);
                list.appendChild(row);
            });
            const newTemplate = root.querySelector('.new-template');
            const addIcon = templateIconButton('New template', templateIcons.add);
            newTemplate.prepend(addIcon.firstChild, document.createTextNode(' '));
            newTemplate.onclick = () => editTemplate();
            root.querySelector('.close-templates').onclick = closeModal;
            root.querySelector('.new-template').focus();
        }
        function editTemplate(id = null) {
            const original = id ? state.templates.find(template => template.id === id) : null;
            if (id && !original) throw new Error('The project template no longer exists.');
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop">
                <section class="modal" role="dialog" aria-modal="true" aria-labelledby="template-title">
                    <h2 id="template-title"></h2>
                    <form class="template-form">
                        <label>Template name<input name="name" required maxlength="120"></label>
                        <label>Starter outline<textarea name="outline" placeholder="First note&#10;  Sub-note&#10;Another note"></textarea></label>
                        <p>One note per line. Indent sub-notes with two spaces per level.</p>
                        <div class="template-fields-heading"><strong>Custom fields</strong><span class="add-template-field-slot"></span></div>
                        <div class="template-fields"></div>
                        <p class="template-message" role="alert"></p>
                        <div class="template-field-actions"><button type="submit">Save template</button><button type="button" class="cancel-template">Cancel</button></div>
                    </form>
                </section></div>`;
            root.querySelector('#template-title').textContent = original ? 'Edit template' : 'New template';
            const form = root.querySelector('form');
            form.elements.name.value = original?.name || '';
            form.elements.outline.value = original?.outline || '';
            const fieldList = root.querySelector('.template-fields');
            function updateFieldOrderButtons() {
                [...fieldList.children].forEach((row, index, rows) => {
                    row.querySelector('.move-template-field-up').disabled = index === 0;
                    row.querySelector('.move-template-field-down').disabled = index === rows.length - 1;
                });
            }
            function addField(field = { id: makeId(), label: '', type: 'text', options: [] }) {
                const row = document.createElement('div');
                row.className = 'template-field-row';
                row.dataset.fieldId = field.id;
                row.innerHTML = `<div class="template-field-main"><label class="template-field-name-label"><span class="visually-hidden">Field name</span><input class="field-name" required maxlength="120" placeholder="Field name"></label><div class="template-field-icons"></div></div>
                    <div class="template-field-details" hidden>
                    <label>Field type<select class="field-type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="checkbox">Checkbox</option><option value="dropdown">Dropdown</option></select></label>
                    <label>Size<select class="field-size"><option value="auto">Auto (content)</option><option value="fixed">Fixed</option></select></label>
                    <label class="field-width-label">Fixed width (pixels, 48–1200)<input class="field-width" type="number" step="any"></label>
                    <label class="field-options-label">Dropdown options, one per line<textarea class="field-options"></textarea></label>
                    </div>`;
                row.querySelector('.field-name').value = field.label;
                const type = row.querySelector('.field-type');
                type.value = field.type;
                const options = row.querySelector('.field-options');
                options.value = field.options.join('\n');
                const optionLabel = row.querySelector('.field-options-label');
                const size = row.querySelector('.field-size');
                const width = row.querySelector('.field-width');
                const widthLabel = row.querySelector('.field-width-label');
                size.value = field.size || 'auto';
                width.value = field.width ?? 200;
                function updateWidth() {
                    widthLabel.hidden = size.value !== 'fixed';
                    width.disabled = size.value !== 'fixed';
                }
                size.onchange = updateWidth;
                updateWidth();
                function updateOptions() { optionLabel.hidden = type.value !== 'dropdown'; }
                type.onchange = updateOptions;
                updateOptions();
                const details = row.querySelector('.template-field-details');
                const icons = row.querySelector('.template-field-icons');
                const edit = templateIconButton('Edit field details', templateIcons.edit);
                edit.setAttribute('aria-expanded', 'false');
                edit.onclick = () => {
                    details.hidden = !details.hidden;
                    edit.setAttribute('aria-expanded', String(!details.hidden));
                    if (!details.hidden) type.focus();
                };
                const up = templateIconButton('Move field up', templateIcons.up);
                up.classList.add('move-template-field-up');
                up.onclick = () => {
                    if (row.previousElementSibling) fieldList.insertBefore(row, row.previousElementSibling);
                    updateFieldOrderButtons();
                    (up.disabled ? down : up).focus();
                };
                const down = templateIconButton('Move field down', templateIcons.down);
                down.classList.add('move-template-field-down');
                down.onclick = () => {
                    if (row.nextElementSibling) fieldList.insertBefore(row.nextElementSibling, row);
                    updateFieldOrderButtons();
                    (down.disabled ? up : down).focus();
                };
                const remove = templateIconButton('Delete field', templateIcons.remove);
                remove.onclick = () => {
                    if (!confirm(`Remove field "${row.querySelector('.field-name').value.trim() || 'untitled'}" from this template? Existing project fields will be kept.`)) return;
                    row.remove();
                    updateFieldOrderButtons();
                    root.querySelector('.add-template-field').focus();
                };
                icons.append(edit, up, down, remove);
                fieldList.appendChild(row);
                updateFieldOrderButtons();
                return row;
            }
            (original?.fields || []).forEach(field => addField(field));
            const addFieldButton = templateIconButton('Add field', templateIcons.add);
            addFieldButton.classList.add('add-template-field');
            root.querySelector('.add-template-field-slot').appendChild(addFieldButton);
            addFieldButton.onclick = () => addField().querySelector('.field-name').focus();
            root.querySelector('.cancel-template').onclick = showTemplates;
            form.onsubmit = event => {
                event.preventDefault();
                try {
                    const name = form.elements.name.value.trim();
                    if (!name) throw new Error('Enter a template name.');
                    const outline = form.elements.outline.value;
                    validateTemplateOutline(outline);
                    const fields = [...fieldList.children].map(row => {
                        const type = row.querySelector('.field-type').value;
                        const field = {
                            id: row.dataset.fieldId,
                            label: row.querySelector('.field-name').value.trim(),
                            type,
                            size: row.querySelector('.field-size').value,
                            options: type === 'dropdown' ? row.querySelector('.field-options').value.split(/\r?\n/).map(option => option.trim()).filter(Boolean) : []
                        };
                        if (field.size === 'fixed') {
                            const widthInput = row.querySelector('.field-width');
                            field.width = widthInput.value === '' ? NaN : Number(widthInput.value);
                            if (!Number.isInteger(field.width) || field.width < 48 || field.width > 1200) {
                                throw new Error(`Enter a whole-number width from 48 to 1200 pixels for ${field.label || 'the field'}.`);
                            }
                        }
                        return field;
                    });
                    validateCustomFields(fields, false);
                    const template = { id: original?.id || makeId(), name, outline, fields };
                    if (original) state.templates[state.templates.indexOf(original)] = template;
                    else state.templates.push(template);
                    scheduleSave();
                    showTemplates();
                } catch (error) {
                    root.querySelector('.template-message').textContent = error.message;
                }
            };
            form.elements.name.focus();
        }
        function createFromTemplate(spaceId) {
            if (!closeAgendaEditor()) return;
            if (!state.settings.templatesEnabled && !state.settings.pmEnabled) {
                showToast('Project templates and project management are disabled in Settings.');
                return;
            }
            if ((!state.settings.templatesEnabled || !state.templates.length) && !state.settings.pmEnabled) {
                showToast('Create a project template in the top menu first.');
                return;
            }
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                <section class="modal" role="dialog" aria-modal="true" aria-labelledby="create-template-title">
                    <h2 id="create-template-title">Create from template</h2>
                    <form class="template-form">
                        <label>Template<select name="template"></select></label>
                        <label>Project name<input name="name" required maxlength="120"></label>
                        <div class="template-field-actions"><button type="submit">Create project</button><button type="button" class="cancel-template">Cancel</button></div>
                    </form>
                </section></div>`;
            const form = root.querySelector('form');
            if (state.settings.pmEnabled) form.elements.template.appendChild(new Option('Project management', 'pm'));
            if (state.settings.templatesEnabled) state.templates.forEach(template => form.elements.template.appendChild(new Option(template.name, `template:${template.id}`)));
            const selectedName = () => form.elements.template.value === 'pm' ? 'PM project' : state.templates.find(item => `template:${item.id}` === form.elements.template.value)?.name;
            form.elements.name.value = selectedName() || '';
            form.elements.template.onchange = () => {
                form.elements.name.value = selectedName() || '';
            };
            root.querySelector('.cancel-template').onclick = closeModal;
            form.onsubmit = event => {
                event.preventDefault();
                const name = form.elements.name.value.trim();
                if (!name) { form.elements.name.setCustomValidity('Enter a project name.'); form.elements.name.reportValidity(); return; }
                const isPM = form.elements.template.value === 'pm' && state.settings.pmEnabled;
                const template = state.settings.templatesEnabled ? state.templates.find(item => `template:${item.id}` === form.elements.template.value) : null;
                if ((!isPM && !template) || !state.spaces.some(space => space.id === spaceId)) {
                    showToast('The template or space is no longer available.');
                    return;
                }
                const doc = newDocument(spaceId);
                doc.title = name;
                if (isPM) initializePMProject(doc);
                else {
                    doc.customFields = template.fields.map(field => ({ ...structuredClone(field), value: field.type === 'checkbox' ? false : '' }));
                    doc.nodes = nodesFromTemplateOutline(template.outline);
                    doc.templateId = template.id;
                }
                state.documents.push(doc);
                state.activeId = doc.id;
                currentView = 'project';
                zoomNodeId = null;
                zoomDocumentId = null;
                activeFilter = 'all';
                priorityFilter = 'all';
                completedFilter = 'show';
                collapsedSpaces.delete(spaceId);
                closeModal();
                if (narrowSidebar.matches) closeOverlaySidebar();
                scheduleSave();
                render();
                document.getElementById('doc-title').focus();
            };
            form.elements.name.oninput = () => form.elements.name.setCustomValidity('');
            form.elements.name.focus();
            form.elements.name.select();
        }
