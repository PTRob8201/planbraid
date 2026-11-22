/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function renderZoomBreadcrumbs(container, doc) {
            container.replaceChildren();
            const location = zoomNodeId && zoomDocumentId === doc.id ? allNodes(doc.nodes).find(item => item.node.id === zoomNodeId) : null;
            const projectHeader = container.id === 'project-zoom-breadcrumbs';
            container.hidden = !projectHeader && !location;
            if (!projectHeader && !location) return;
            if (projectHeader) {
                const space = document.createElement('span');
                space.textContent = state.spaces.find(item => item.id === doc.spaceId).name;
                container.appendChild(space);
                const separator = createIcon('chevron-right');
                container.appendChild(separator);
            }
            const root = document.createElement('button');
            root.type = 'button';
            root.textContent = currentView === 'endless' ? 'All projects' : doc.title;
            if (!location) root.setAttribute('aria-current', 'location');
            root.onclick = () => {
                zoomNodeId = null;
                zoomDocumentId = null;
                render();
                if (projectHeader) document.querySelector('#project-zoom-breadcrumbs [aria-current]')?.focus();
                else document.getElementById('endless-title').focus();
            };
            container.appendChild(root);
            if (!location) return;
            let nodes = doc.nodes;
            location.path.forEach((index, depth) => {
                const node = nodes[index];
                const separator = createIcon('chevron-right');
                container.appendChild(separator);
                const crumb = document.createElement('button');
                crumb.type = 'button';
                crumb.textContent = node.text.trim() || 'Untitled note';
                if (depth === location.path.length - 1) crumb.setAttribute('aria-current', 'location');
                crumb.onclick = () => {
                    zoomNodeId = node.id;
                    zoomDocumentId = doc.id;
                    render();
                    document.querySelector(currentView === 'endless' ? '#endless-zoom-breadcrumbs [aria-current]' : '#project-zoom-breadcrumbs [aria-current]')?.focus();
                };
                container.appendChild(crumb);
                nodes = node.children;
            });
        }
        function zoomIntoNode(doc, node) {
            if (!state.settings.nodeZoomEnabled) return;
            setEditingDocument(doc);
            zoomDocumentId = doc.id;
            zoomNodeId = node.id;
            render();
            const breadcrumb = document.querySelector(currentView === 'endless' ? '#endless-zoom-breadcrumbs [aria-current]' : '#project-zoom-breadcrumbs [aria-current]');
            breadcrumb?.focus();
        }
        function renderEndless() {
            const container = document.getElementById('endless-outline');
            document.getElementById('endless-completed-filter').textContent = endlessCompletedFilter === 'show' ? 'Hide completed' : 'Show completed';
            container.replaceChildren();
            const zoomDoc = state.documents.find(doc => doc.id === zoomDocumentId);
            if (zoomNodeId && (!zoomDoc || !findNode(zoomNodeId, zoomDoc.nodes))) {
                zoomNodeId = null;
                zoomDocumentId = null;
            }
            const crumbs = document.getElementById('endless-zoom-breadcrumbs');
            if (zoomNodeId) renderZoomBreadcrumbs(crumbs, zoomDoc);
            else { crumbs.replaceChildren(); crumbs.hidden = true; }
            state.spaces.forEach(space => {
                state.documents.filter(doc => doc.spaceId === space.id && (!zoomNodeId || doc.id === zoomDocumentId)).forEach(doc => {
                    const section = document.createElement('section');
                    section.className = 'endless-project';
                    section.dataset.docId = doc.id;
                    const activate = () => setEditingDocument(doc);
                    section.addEventListener('pointerdown', activate, true);
                    section.addEventListener('focusin', activate, true);
                    section.addEventListener('click', activate, true);
                    section.addEventListener('keydown', activate, true);
                    section.addEventListener('input', activate, true);
                    const header = document.createElement('div');
                    header.className = 'endless-project-header';
                    const title = document.createElement('button');
                    title.type = 'button';
                    title.className = 'endless-project-title';
                    title.textContent = doc.title;
                    title.title = 'Open project';
                    title.onclick = () => selectDocument(doc.id);
                    const label = document.createElement('span');
                    label.className = 'endless-space';
                    label.textContent = space.name;
                    header.append(title, label);
                    section.appendChild(header);
                    const list = document.createElement('div');
                    list.className = 'outline-list';
                    const roots = zoomNodeId ? [findNode(zoomNodeId, doc.nodes).node] : doc.nodes;
                    visibleNodes(roots).forEach(node => list.appendChild(renderNode(node, doc)));
                    section.appendChild(list);
                    const add = document.createElement('button');
                    add.type = 'button';
                    add.className = 'add-first';
                    add.textContent = zoomNodeId ? '+ Add a sub-note' : '+ Add a note';
                    add.onclick = () => zoomNodeId ? addChild(zoomNodeId) : addRootNode();
                    section.appendChild(add);
                    container.appendChild(section);
                });
            });
        }
        function isActivePriority(node) {
            return !node.completed && ['low', 'medium', 'high'].includes(node.priority);
        }
        function showDashboard() {
            if (!closeAgendaEditor()) return;
            currentView = 'dashboard';
            zoomNodeId = null;
            zoomDocumentId = null;
            render();
            document.getElementById('dashboard-title').focus();
        }
        function showSharedTracker() {
            if (!extensionAccess.pmEnabled) return;
            if (!closeAgendaEditor()) return;
            currentView = 'shared-tracker';
            zoomNodeId = null;
            zoomDocumentId = null;
            const tracker = document.getElementById('shared-tracker');
            if (!tracker.hasAttribute('src')) tracker.src = 'shared-tracker.html?v=2.1.4';
            render();
            tracker.focus();
        }
        function showSupply() {
            if (!extensionAccess.supplyEnabled || !closeAgendaEditor()) return;
            currentView = 'supply';
            zoomNodeId = null;
            zoomDocumentId = null;
            const supply = document.getElementById('supply');
            if (!supply.hasAttribute('src') || supplyNeedsReload) {
                supply.src = 'supply-app.html?v=2.1.4';
                supplyNeedsReload = false;
            }
            render();
            supply.focus();
        }
        function showEndless() {
            if (!closeAgendaEditor()) return;
            currentView = 'endless';
            zoomNodeId = null;
            zoomDocumentId = null;
            render();
            document.getElementById('endless-title').focus();
        }
        function showStarred() {
            if (!closeAgendaEditor()) return;
            currentView = 'starred';
            render();
        }
        function showPriority() {
            if (!state.settings.priorityEnabled) return;
            if (!closeAgendaEditor()) return;
            currentView = 'priority';
            render();
        }
        function openGlobalNote({ node, path, doc, space }) {
            if (!closeAgendaEditor()) return;
            let nodes = doc.nodes;
            path.slice(0, -1).forEach(index => {
                nodes[index].collapsed = false;
                nodes = nodes[index].children;
            });
            collapsedSpaces.delete(space.id);
            selectDocument(doc.id);
            focusRequest = { id: node.id, end: true };
            render();
        }
        function createGlobalNoteResult(item, detail = '', showPriorityIcon = false) {
            const { node, doc, space } = item;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'search-result starred-result';
            const title = document.createElement('span');
            title.className = `search-result-title${node.completed ? ' completed' : ''}`;
            if (showPriorityIcon) {
                const icon = document.createElement('span');
                icon.className = 'dashboard-priority-note-icon';
                icon.dataset.priority = node.priority;
                icon.setAttribute('aria-hidden', 'true');
                icon.textContent = { low: '!', medium: '!!', high: '!!!' }[node.priority];
                title.append(icon, document.createTextNode(node.text || 'Untitled note'));
            } else {
                title.textContent = node.text || 'Untitled note';
            }
            const meta = document.createElement('span');
            meta.className = 'search-result-meta';
            meta.textContent = `${space.name} / ${doc.title}${detail}${node.completed ? ' · Completed' : ''}`;
            button.append(title, meta);
            button.onclick = () => openGlobalNote(item);
            return button;
        }
        function createDashboardTaskResult(item) {
            const { node, doc, space, separate } = item;
            const showPriority = (separate || state.settings.priorityEnabled) && isActivePriority(node);
            const detail = [
                node.starred && 'Starred',
                showPriority && `${node.priority[0].toUpperCase()}${node.priority.slice(1)} priority`,
                node.dueDate && `Due ${node.dueDate}`
            ].filter(Boolean).map(value => ` · ${value}`).join('');
            const button = createGlobalNoteResult(item, detail, showPriority);
            if (node.starred) {
                const star = document.createElement('span');
                star.className = 'dashboard-task-star';
                star.setAttribute('aria-hidden', 'true');
                star.appendChild(createIcon('star', true));
                button.querySelector('.search-result-title').prepend(star);
            }
            if (separate) button.onclick = () => {
                if (!closeAgendaEditor()) return;
                if (!separatePMTaskAvailable(doc, node)) { showToast('This task is no longer available.'); return; }
                collapsedSpaces.delete(space.id);
                collapsedPMTaskSections.delete(doc.id);
                pmBoardViewDocuments.delete(doc.id);
                let location = findSeparatePMTask(doc.pmTasks, node);
                while (location?.parent) {
                    collapsedSeparatePMTasks.delete(location.parent.id);
                    location = findSeparatePMTask(doc.pmTasks, location.parent);
                }
                selectDocument(doc.id);
                document.querySelector(`[data-pm-task-id="${CSS.escape(node.id)}"] > .pm-task-row .pm-task-title`)?.focus();
            };
            return button;
        }
        function renderDashboard() {
            const container = document.getElementById('dashboard-sections');
            container.replaceChildren();
            const entries = [];
            const taskEntries = [];
            state.spaces.forEach(space => {
                state.documents.filter(doc => doc.spaceId === space.id).forEach(doc => {
                    allNodes(doc.nodes).forEach(item => entries.push({ ...item, doc, space }));
                    if (state.settings.pmEnabled && isPMProject(doc)) {
                        const separate = state.settings.pmSeparateTasksEnabled;
                        allNodes(separate ? doc.pmTasks : doc.nodes).forEach(item => {
                            if ((separate || item.node.pmTask) && !item.node.completed &&
                                (item.node.starred || ((separate || state.settings.priorityEnabled) && isActivePriority(item.node)))) {
                                taskEntries.push({ ...item, doc, space, separate });
                            }
                        });
                    }
                });
            });
            const rank = { high: 0, medium: 1, low: 2 };
            const today = new Date();
            const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
            const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
            const sections = [
                { enabled: state.settings.pmEnabled, title: 'Important tasks', items: taskEntries.sort((a, b) =>
                    (a.separate || state.settings.priorityEnabled ? (rank[a.node.priority] ?? 3) : 3) -
                    (b.separate || state.settings.priorityEnabled ? (rank[b.node.priority] ?? 3) : 3)), taskSection: true },
                { enabled: state.settings.dashboardPinned, title: 'Starred notes', items: entries.filter(item => item.node.starred), detail: () => '' },
                { enabled: state.settings.priorityEnabled && state.settings.dashboardPriority, title: 'Priority notes', showPriorityIcon: true, items: entries.filter(item => isActivePriority(item.node)).sort((a, b) => rank[a.node.priority] - rank[b.node.priority]), detail: node => ` · ${node.priority[0].toUpperCase()}${node.priority.slice(1)} priority` },
                { enabled: state.settings.dashboardDue, title: 'Due dates', items: entries.filter(item => !item.node.completed && /^\d{4}-\d{2}-\d{2}$/.test(item.node.dueDate) && item.node.dueDate <= cutoffDate).sort((a, b) => a.node.dueDate.localeCompare(b.node.dueDate)), detail: node => ` · Due ${node.dueDate}` }
            ];
            const enabledSections = sections.filter(section => section.enabled);
            const populatedSections = enabledSections.filter(section => section.items.length);
            populatedSections.forEach(section => {
                const card = document.createElement('section');
                card.className = 'dashboard-section';
                const heading = document.createElement('h2');
                heading.textContent = section.title;
                card.appendChild(heading);
                section.items.forEach(item => card.appendChild(section.taskSection
                    ? createDashboardTaskResult(item)
                    : createGlobalNoteResult(item, section.detail(item.node), section.showPriorityIcon)));
                container.appendChild(card);
            });
            if (!populatedSections.length) {
                const empty = document.createElement('p');
                empty.className = 'search-result-meta';
                empty.textContent = enabledSections.length ? 'Nothing important for now.' : 'Enable dashboard sections in Settings to see notes here.';
                container.appendChild(empty);
            }
        }
        function renderGlobalNotes(view) {
            const list = document.getElementById('starred-list');
            list.replaceChildren();
            const priorityView = view === 'priority';
            const tagView = view === 'tag';
            list.classList.toggle('outline-results', !tagView);
            document.getElementById('starred-title').textContent = tagView ? selectedTag : priorityView ? 'Priority notes' : 'Starred notes';
            document.getElementById('global-notes-subtitle').textContent = priorityView ? 'Active prioritized notes from all spaces and projects' : 'Notes from all spaces and projects';
            const results = [];
            state.spaces.forEach(space => {
                state.documents.filter(doc => doc.spaceId === space.id).forEach(doc => {
                    allNodes(doc.nodes).filter(item => tagView ? nodeTags(item.node).has(selectedTag) : priorityView ? isActivePriority(item.node) : item.node.starred).forEach(item => {
                        results.push({ ...item, doc, space });
                    });
                });
            });
            if (priorityView) {
                const rank = { high: 0, medium: 1, low: 2 };
                results.sort((a, b) => rank[a.node.priority] - rank[b.node.priority]);
            }
            results.forEach(item => {
                const priority = priorityView ? ` · ${item.node.priority[0].toUpperCase()}${item.node.priority.slice(1)} priority` : '';
                list.appendChild(createGlobalNoteResult(item, priority));
            });
            if (!list.childElementCount) {
                const empty = document.createElement('p');
                empty.className = 'search-result-meta';
                empty.textContent = tagView ? 'No notes with this tag.' : priorityView ? 'No active priority notes. Set a priority in a note menu.' : 'No starred notes yet. Use a note menu to star one.';
                list.appendChild(empty);
            }
        }
