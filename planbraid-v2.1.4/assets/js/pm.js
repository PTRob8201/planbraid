/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        const PM_STATUSES = ['Active', 'Rough-In', 'Trim-Out', 'Closeout', 'On Hold'];
        const PM_DATES = ['mobilization', 'roughIn', 'cutover', 'handover'];
        const PM_BOARD_STATUSES = ['todo', 'in-progress', 'blocked', 'done'];
        const PM_BOARD_STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', blocked: 'Blocked', done: 'Done' };
        const PM_REPEAT_VALUES = ['', 'daily', 'weekly', 'monthly'];
        const pmBoardViewDocuments = new Set();
        const collapsedSeparatePMTasks = new Set();
        const collapsedPMTaskSections = new Set();
        const hideCompletedPMTasks = new Set();
        let separatePMDraft = null;
        function normalizePMTask(value) {
            if (value === undefined || value === null) return null;
            if (value === 'waiting') return 'blocked';
            if (value === 'done') return 'todo';
            if (!['todo', 'in-progress', 'blocked'].includes(value)) throw new Error('Invalid PM task status.');
            return value;
        }
        function normalizePMRepeat(value) {
            if (value === undefined) return '';
            if (!PM_REPEAT_VALUES.includes(value)) throw new Error('Invalid PM task recurrence.');
            return value;
        }
        function normalizePMRepeatSpawned(value) {
            if (value === undefined) return false;
            if (typeof value !== 'boolean') throw new Error('Invalid PM recurrence history.');
            return value;
        }
        function normalizePMAssignee(value) {
            if (value === undefined) return '';
            if (typeof value !== 'string') throw new Error('Invalid PM assignee.');
            return value;
        }
        function normalizePMFieldNotes(value) {
            if (value === undefined) return [];
            if (!Array.isArray(value) || value.some(entry => !entry || typeof entry.text !== 'string' || !entry.text.trim() ||
                typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at)))) throw new Error('Invalid PM field notes.');
            return value.map(entry => ({ text: entry.text, at: entry.at }));
        }
        function normalizeSeparatePMTasks(tasks) {
            const ids = new Set();
            function normalize(items) {
                if (!Array.isArray(items)) throw new Error('Invalid separate project tasks.');
                return items.map(task => {
                    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
                        typeof task.text !== 'string' || typeof task.completed !== 'boolean' ||
                        typeof task.dueDate !== 'string' || typeof task.description !== 'string' ||
                        typeof task.pmAssignee !== 'string' || !normalizePMTask(task.pmTask) ||
                        (task.starred !== undefined && typeof task.starred !== 'boolean')) {
                        throw new Error('Invalid separate project task.');
                    }
                    ids.add(task.id);
                    return { ...task, pmTask: normalizePMTask(task.pmTask), starred: task.starred === true, priority: normalizePriority(task.priority), pmFieldNotes: normalizePMFieldNotes(task.pmFieldNotes),
                        pmRepeat: normalizePMRepeat(task.pmRepeat), pmRepeatSpawned: normalizePMRepeatSpawned(task.pmRepeatSpawned),
                        children: normalize(task.children === undefined ? [] : task.children) };
                });
            }
            return normalize(tasks);
        }
        function findSeparatePMTask(tasks, target, parent = null) {
            for (let index = 0; index < tasks.length; index++) {
                const task = tasks[index];
                if (task === target) return { task, array: tasks, index, parent };
                const found = findSeparatePMTask(task.children, target, task);
                if (found) return found;
            }
            return null;
        }
        function syncSeparatePMTasks(tasks) {
            let reopened = 0;
            tasks.forEach(task => {
                reopened += syncSeparatePMTasks(task.children);
                if (task.completed && task.children.some(child => !child.completed)) {
                    task.completed = false;
                    task.pmTask = 'todo';
                    markNodeEdited(task);
                    reopened++;
                }
            });
            return reopened;
        }
        function copyOutlinePMTasks(doc) {
            return allNodes(doc.nodes).map(item => item.node).filter(node => node.pmTask).map(node => ({
                id: makeId(), text: node.text, completed: node.completed, pmTask: node.pmTask,
                dueDate: node.dueDate, description: node.description, starred: node.starred, priority: node.priority, pmAssignee: node.pmAssignee,
                pmFieldNotes: node.pmFieldNotes.map(entry => ({ ...entry })),
                pmRepeat: node.pmRepeat || '', pmRepeatSpawned: node.pmRepeatSpawned === true, children: []
            }));
        }
        function projectPMTasks(doc) {
            return state.settings.pmSeparateTasksEnabled ? allNodes(doc.pmTasks).map(item => item.node) : allNodes(doc.nodes).map(item => item.node).filter(node => node.pmTask);
        }
        function normalizePMBoardOrder(value) {
            if (value === undefined) return { outline: [], separate: [] };
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid PM board order.');
            const result = {};
            for (const key of ['outline', 'separate']) {
                const ids = value[key] === undefined ? [] : value[key];
                if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
                    throw new Error('Invalid PM board order.');
                }
                result[key] = [...ids];
            }
            return result;
        }
        function orderedPMBoardTasks(doc, separate) {
            const tasks = projectPMTasks(doc);
            const order = new Map((doc.pmBoardOrder?.[separate ? 'separate' : 'outline'] || []).map((id, index) => [id, index]));
            return tasks.sort((a, b) => (order.get(a.id) ?? tasks.length) - (order.get(b.id) ?? tasks.length));
        }
        function movePMBoardCard(doc, node, status, beforeId, separate) {
            if (status === 'done' && !node.completed && descendantProgress(node).completed < descendantProgress(node).total) {
                showToast(separate ? 'Complete all sub-tasks before completing this task.' : 'Complete all sub-notes before completing this task.');
                return false;
            }
            const currentStatus = node.completed ? 'done' : node.pmTask;
            const current = orderedPMBoardTasks(doc, separate);
            const others = current.filter(task => task !== node);
            let index = beforeId ? others.findIndex(task => task.id === beforeId && (task.completed ? 'done' : task.pmTask) === status) : -1;
            if (index < 0) {
                index = others.length;
                for (let i = others.length - 1; i >= 0; i--) {
                    if ((others[i].completed ? 'done' : others[i].pmTask) === status) {
                        index = i + 1;
                        break;
                    }
                }
            }
            others.splice(index, 0, node);
            if (currentStatus === status && current.every((task, i) => task === others[i])) return false;
            node.completed = status === 'done';
            if (!node.completed) node.pmTask = status;
            if (currentStatus !== status) markNodeEdited(node);
            if (!doc.pmBoardOrder) doc.pmBoardOrder = normalizePMBoardOrder();
            doc.pmBoardOrder[separate ? 'separate' : 'outline'] = others.map(task => task.id);
            const boardSelector = separate ? '#pm-separate-tasks .pm-board' : '#pm-board-view .pm-board';
            const scrollLeft = document.querySelector(boardSelector)?.scrollLeft || 0;
            scheduleSave();
            render();
            const board = document.querySelector(boardSelector);
            if (board) board.scrollLeft = scrollLeft;
            return true;
        }
        function appendPMTaskMetadata(meta, task, prefix = []) {
            const parts = [...prefix, PM_BOARD_STATUS_LABELS[task.completed ? 'done' : task.pmTask]];
            parts.filter(Boolean).forEach(part => {
                if (meta.hasChildNodes()) meta.append(' · ');
                meta.append(part);
            });
            if (task.priority && task.priority !== 'none') {
                if (meta.hasChildNodes()) meta.append(' · ');
                const priority = document.createElement('span');
                priority.className = `priority-mark ${task.priority}`;
                priority.textContent = `Priority: ${task.priority}`;
                meta.appendChild(priority);
            }
            [task.pmAssignee && `Assignee: ${task.pmAssignee}`, task.dueDate && `Due ${task.dueDate}`].filter(Boolean).forEach(part => {
                if (meta.hasChildNodes()) meta.append(' · ');
                meta.append(part);
            });
        }
        function validatePMProject(project) {
            if (project === undefined || project === null) return;
            if (typeof project !== 'object' || Array.isArray(project) ||
                ['client', 'address', 'pm'].some(key => typeof project[key] !== 'string') ||
                !PM_STATUSES.includes(project.status) || !project.dates || typeof project.dates !== 'object' ||
                PM_DATES.some(key => typeof project.dates[key] !== 'string' ||
                    (project.dates[key] && !/^\d{4}-\d{2}-\d{2}$/.test(project.dates[key])))) {
                throw new Error('Invalid PM project details.');
            }
            if (project.scopeSummary === undefined) project.scopeSummary = '';
            if (project.meetingDay === undefined) project.meetingDay = '';
            if (project.enabled === undefined) project.enabled = true;
            if (typeof project.scopeSummary !== 'string' || typeof project.meetingDay !== 'string' || typeof project.enabled !== 'boolean') throw new Error('Invalid PM project site information.');
        }
        function createPMProjectDetails() {
            return { enabled: true, client: '', address: '', pm: '', status: 'Active', scopeSummary: '', meetingDay: '', dates: Object.fromEntries(PM_DATES.map(key => [key, ''])) };
        }
        function isPMProject(doc) {
            return !!doc.pmProject && doc.pmProject.enabled !== false;
        }
        function togglePMStatus(doc) {
            if (currentView !== 'project' || !state.settings.pmEnabled || !state.documents.includes(doc)) {
                showToast('Project management is unavailable for this project.');
                return;
            }
            const removing = isPMProject(doc);
            const message = removing
                ? 'Remove PM status from this project? Site details and task data will be kept for when PM is enabled again.'
                : 'Enable project management for this project? Existing notes and fields will not be changed.';
            if (!confirm(message)) return;
            if (doc.pmProject) doc.pmProject.enabled = !removing;
            else doc.pmProject = createPMProjectDetails();
            if (!removing && state.settings.pmSeparateTasksEnabled && doc.pmTasks === undefined) doc.pmTasks = copyOutlinePMTasks(doc);
            scheduleSave();
            render();
            showToast(removing ? 'PM status removed. Site details and task data were kept.' : 'Project management enabled. Mark notes as tasks to track progress.');
        }
        function initializePMProject(doc) {
            doc.pmProject = createPMProjectDetails();
            if (state.settings.pmSeparateTasksEnabled) doc.pmTasks = copyOutlinePMTasks(doc);
        }
        function renderPMProjectHeader(doc) {
            const root = document.getElementById('pm-project-header');
            const siteRoot = document.getElementById('pm-site-info');
            root.replaceChildren();
            siteRoot.replaceChildren();
            const pmVisible = state.settings.pmEnabled && isPMProject(doc);
            root.hidden = !pmVisible || !state.settings.pmProgressPanelEnabled ||
                (!state.settings.pmSeparateTasksEnabled && !state.settings.pmBoardEnabled);
            siteRoot.hidden = !pmVisible || !state.settings.pmSiteInfoEnabled;
            if (!root.hidden) {
                const heading = document.createElement('div');
                heading.className = 'pm-project-heading';
                if (state.settings.pmSeparateTasksEnabled) {
                    const tasks = projectPMTasks(doc);
                    const completed = tasks.filter(node => node.completed).length;
                    const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
                    const label = document.createElement('strong');
                    label.textContent = `Project progress: ${percent}% (${completed}/${tasks.length} tasks)`;
                    heading.appendChild(label);
                    const bar = document.createElement('progress');
                    bar.max = 100;
                    bar.value = percent;
                    bar.setAttribute('aria-label', 'Project task progress');
                    root.append(heading, bar);
                } else {
                    const label = document.createElement('strong');
                    label.textContent = 'Task view';
                    heading.append(label, createPMViewSwitch(doc));
                    root.appendChild(heading);
                }
            }
            if (siteRoot.hidden) return;
            const heading = document.createElement('div');
            heading.className = 'pm-project-heading';
            const label = document.createElement('strong');
            label.textContent = 'Site information';
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'toolbar-button';
            edit.textContent = 'Edit site';
            edit.onclick = () => editPMProject(doc);
            heading.append(label, edit);
            const details = document.createElement('div');
            details.className = 'pm-project-site-details';
            const site = doc.pmProject;
            const entries = [
                ['Status', site.status], ['Client / GC', site.client], ['Address', site.address], ['PM / lead', site.pm],
                ['Start date', site.dates.mobilization], ['Scope Summary', site.scopeSummary], ['Meeting day', site.meetingDay],
                ...doc.customFields.map(field => [field.label, field.type === 'checkbox' ? (field.value ? 'Yes' : 'No') : field.value])
            ];
            entries.filter(([, value]) => value !== '').forEach(([name, value]) => {
                const item = document.createElement('span');
                item.textContent = `${name}: ${value}`;
                details.appendChild(item);
            });
            siteRoot.append(heading, details);
        }
        function createPMViewSwitch(doc) {
            const viewSwitch = document.createElement('div');
            viewSwitch.className = 'pm-view-switch';
            viewSwitch.hidden = !state.settings.pmBoardEnabled;
            viewSwitch.setAttribute('role', 'group');
            viewSwitch.setAttribute('aria-label', 'Task view');
            [['outline', 'Task outline', 'list'], ['board', 'Task board', 'board']].forEach(([view, text, icon]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'toolbar-button';
                button.appendChild(createIcon(icon));
                button.setAttribute('aria-label', text);
                button.title = text;
                button.dataset.pmView = view;
                button.setAttribute('aria-pressed', String(pmBoardViewDocuments.has(doc.id) === (view === 'board')));
                button.onclick = () => {
                    if (view === 'board') pmBoardViewDocuments.add(doc.id);
                    else pmBoardViewDocuments.delete(doc.id);
                    if (state.settings.pmSeparateTasksEnabled) collapsedPMTaskSections.delete(doc.id);
                    render();
                    const scope = state.settings.pmSeparateTasksEnabled ? 'pm-separate-tasks' : 'pm-project-header';
                    document.querySelector(`#${scope} [data-pm-view="${view}"]`)?.focus();
                };
                viewSwitch.appendChild(button);
            });
            return viewSwitch;
        }
        function renderPMBoard(doc, root = document.getElementById('pm-board-view')) {
            root.replaceChildren();
            const separate = state.settings.pmSeparateTasksEnabled;
            const tasks = orderedPMBoardTasks(doc, separate).filter(task => !separate || !hideCompletedPMTasks.has(doc.id) || !task.completed);
            if (!tasks.length) {
                const empty = document.createElement('p');
                empty.className = 'pm-board-empty';
                empty.textContent = separate
                    ? (projectPMTasks(doc).length ? 'All tasks are completed and hidden.' : 'No project tasks yet. Use Add task to create one.')
                    : "No PM tasks yet. Use Task status in a note's menu to add one.";
                root.appendChild(empty);
            }
            const board = document.createElement('div');
            board.className = 'pm-board';
            let drag = null;
            let scrollFrame = 0;
            function clearDropTarget() {
                board.querySelectorAll('.pm-board-drop-before, .pm-board-drop-end').forEach(element => {
                    element.classList.remove('pm-board-drop-before', 'pm-board-drop-end');
                });
            }
            function updateDropTarget() {
                clearDropTarget();
                const target = document.elementFromPoint(drag.x, drag.y);
                const column = target?.closest('.pm-board-column');
                drag.target = null;
                if (!column || !board.contains(column)) return;
                const cards = [...column.querySelectorAll('.pm-board-card')].filter(card => card !== drag.card);
                const before = cards.find(card => drag.y < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
                if (before) before.classList.add('pm-board-drop-before');
                else column.classList.add('pm-board-drop-end');
                drag.target = { status: column.dataset.pmBoardColumn, beforeId: before?.dataset.pmBoardCard || null };
            }
            function scrollDuringDrag() {
                if (!drag?.started) return;
                const bounds = board.getBoundingClientRect();
                const left = Math.max(bounds.left, 0);
                const right = Math.min(bounds.right, window.innerWidth);
                if (drag.y >= bounds.top && drag.y <= bounds.bottom && drag.x >= left && drag.x <= right) {
                    if (drag.x < left + 40) board.scrollLeft -= 12;
                    else if (drag.x > right - 40) board.scrollLeft += 12;
                }
                if (drag.x >= left && drag.x <= right) {
                    if (drag.y < 48) window.scrollBy(0, -12);
                    else if (drag.y > window.innerHeight - 48) window.scrollBy(0, 12);
                }
                updateDropTarget();
                scrollFrame = requestAnimationFrame(scrollDuringDrag);
            }
            function finishDrag(event, cancelled) {
                if (!drag || drag.pointerId !== event.pointerId) return;
                const current = drag;
                drag = null;
                cancelAnimationFrame(scrollFrame);
                current.card.classList.remove('is-dragging');
                clearDropTarget();
                if (!cancelled && current.started && current.target) {
                    movePMBoardCard(doc, current.node, current.target.status, current.target.beforeId, separate);
                }
            }
            PM_BOARD_STATUSES.forEach(statusValue => {
                const column = document.createElement('section');
                column.className = 'pm-board-column';
                column.dataset.pmBoardColumn = statusValue;
                const cards = tasks.filter(node => (node.completed ? 'done' : node.pmTask) === statusValue);
                const heading = document.createElement('h2');
                heading.textContent = `${PM_BOARD_STATUS_LABELS[statusValue]} (${cards.length})`;
                column.appendChild(heading);
                cards.forEach((node, cardIndex) => {
                    const card = document.createElement('article');
                    card.className = `pm-board-card${node.completed ? ' is-completed' : ''}`;
                    card.dataset.pmBoardCard = node.id;
                    const cardHeading = document.createElement('div');
                    cardHeading.className = 'pm-board-card-heading';
                    const handle = document.createElement('button');
                    handle.type = 'button';
                    handle.className = 'pm-board-drag-handle';
                    const taskName = node.text.trim() || 'Untitled task';
                    handle.title = 'Drag or use arrow keys to move';
                    handle.setAttribute('aria-label', `Move ${taskName}: use left and right arrows to change status, up and down arrows to reorder`);
                    handle.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown');
                    handle.appendChild(createIcon('menu'));
                    handle.onpointerdown = event => {
                        if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
                        event.preventDefault();
                        drag = { pointerId: event.pointerId, node, card, x: event.clientX, y: event.clientY,
                            startX: event.clientX, startY: event.clientY, started: false, target: null };
                        handle.setPointerCapture(event.pointerId);
                    };
                    handle.onpointermove = event => {
                        if (!drag || drag.pointerId !== event.pointerId) return;
                        drag.x = event.clientX;
                        drag.y = event.clientY;
                        if (!drag.started && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 5) {
                            drag.started = true;
                            card.classList.add('is-dragging');
                            scrollDuringDrag();
                        } else if (drag.started) updateDropTarget();
                    };
                    handle.onpointerup = event => finishDrag(event, false);
                    handle.onpointercancel = event => finishDrag(event, true);
                    handle.onlostpointercapture = event => finishDrag(event, true);
                    handle.onkeydown = event => {
                        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) ||
                            event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                        event.preventDefault();
                        let destination = statusValue;
                        let beforeId = null;
                        if (event.key === 'ArrowUp') {
                            if (cardIndex === 0) return;
                            beforeId = cards[cardIndex - 1].id;
                        } else if (event.key === 'ArrowDown') {
                            if (cardIndex === cards.length - 1) return;
                            beforeId = cards[cardIndex + 2]?.id || null;
                        } else {
                            const nextIndex = PM_BOARD_STATUSES.indexOf(statusValue) + (event.key === 'ArrowLeft' ? -1 : 1);
                            if (nextIndex < 0 || nextIndex >= PM_BOARD_STATUSES.length) return;
                            destination = PM_BOARD_STATUSES[nextIndex];
                        }
                        if (!movePMBoardCard(doc, node, destination, beforeId, separate)) return;
                        const scope = separate ? '#pm-separate-tasks' : '#pm-board-view';
                        const moved = document.querySelector(`${scope} [data-pm-board-card="${CSS.escape(node.id)}"] .pm-board-drag-handle`);
                        if (moved) moved.focus();
                        else document.getElementById('pm-task-completed-toggle')?.focus();
                        const columnCards = orderedPMBoardTasks(doc, separate).filter(task => (task.completed ? 'done' : task.pmTask) === destination);
                        const hiddenNotice = moved ? '' : ' Completed tasks are hidden.';
                        showToast(`${taskName}: ${PM_BOARD_STATUS_LABELS[destination]}, position ${columnCards.indexOf(node) + 1} of ${columnCards.length}.${hiddenNotice}`);
                    };
                    const title = document.createElement('strong');
                    title.textContent = taskName;
                    cardHeading.append(handle, title);
                    card.appendChild(cardHeading);
                    const descriptionText = node.description || (node.descriptionHtml ? exportNoteText(node) : '');
                    if (descriptionText.trim()) {
                        const description = document.createElement('div');
                        description.className = 'pm-board-description';
                        description.textContent = descriptionText;
                        card.appendChild(description);
                    }
                    const metadata = [`Priority: ${node.priority || 'none'}`, node.pmAssignee ? `Assignee: ${node.pmAssignee}` : 'Unassigned',
                        node.dueDate ? `Due ${node.dueDate}` : 'No due date',
                        `${node.pmFieldNotes.length} field note${node.pmFieldNotes.length === 1 ? '' : 's'}`];
                    const details = document.createElement('span');
                    details.className = 'pm-board-meta';
                    details.textContent = metadata.join(' · ');
                    card.appendChild(details);
                    const open = document.createElement('button');
                    open.type = 'button';
                    open.className = 'pm-board-open';
                    open.textContent = separate ? 'Open task' : 'Open in outline';
                    open.onclick = () => {
                        if (separate) {
                            pmBoardViewDocuments.delete(doc.id);
                            let location = findSeparatePMTask(doc.pmTasks, node);
                            while (location?.parent) {
                                collapsedSeparatePMTasks.delete(location.parent.id);
                                location = findSeparatePMTask(doc.pmTasks, location.parent);
                            }
                            render();
                            document.querySelector(`[data-pm-task-id="${CSS.escape(node.id)}"] .pm-task-title`)?.focus();
                            return;
                        }
                        pmBoardViewDocuments.delete(doc.id);
                        zoomNodeId = null;
                        zoomDocumentId = null;
                        activeFilter = 'all';
                        priorityFilter = 'all';
                        completedFilter = 'show';
                        focusRequest = { id: node.id, end: true };
                        render();
                    };
                    card.appendChild(open);
                    column.appendChild(card);
                });
                if (!cards.length) {
                    const empty = document.createElement('p');
                    empty.className = 'pm-board-empty';
                    empty.textContent = 'No cards';
                    column.appendChild(empty);
                }
                board.appendChild(column);
            });
            root.appendChild(board);
        }
        function renderSeparatePMTasks(doc) {
            const root = document.getElementById('pm-separate-tasks');
            root.replaceChildren();
            const heading = document.createElement('div');
            heading.className = 'pm-separate-heading';
            const title = document.createElement('h2');
            const titleToggle = pmButton(`Tasks (${projectPMTasks(doc).length})`, () => {
                if (collapsedPMTaskSections.has(doc.id)) collapsedPMTaskSections.delete(doc.id);
                else collapsedPMTaskSections.add(doc.id);
                render();
                document.querySelector('#pm-separate-tasks .section-title-toggle')?.focus();
            });
            titleToggle.className = 'section-title-toggle';
            titleToggle.setAttribute('aria-expanded', String(!collapsedPMTaskSections.has(doc.id)));
            titleToggle.setAttribute('aria-controls', 'pm-separate-task-content');
            title.appendChild(titleToggle);
            const add = pmButton('', () => {
                if (collapsedPMTaskSections.delete(doc.id)) {
                    render();
                    showSeparatePMTaskComposer(doc, document.getElementById('pm-separate-tasks'), null);
                } else showSeparatePMTaskComposer(doc, root, null);
            });
            add.appendChild(createIcon('plus'));
            add.className = 'toolbar-button';
            add.setAttribute('aria-label', 'Add task');
            add.title = 'Add task';
            const viewSwitch = createPMViewSwitch(doc);
            const completedToggle = pmButton('', () => {
                if (hideCompletedPMTasks.has(doc.id)) hideCompletedPMTasks.delete(doc.id);
                else hideCompletedPMTasks.add(doc.id);
                render();
                document.querySelector('#pm-task-completed-toggle')?.focus();
            });
            const showCompleted = !hideCompletedPMTasks.has(doc.id);
            completedToggle.id = 'pm-task-completed-toggle';
            completedToggle.className = 'toolbar-button project-completed-toggle pm-task-completed-toggle';
            completedToggle.setAttribute('aria-label', showCompleted ? 'Hide completed tasks' : 'Show completed tasks');
            completedToggle.title = completedToggle.getAttribute('aria-label');
            completedToggle.innerHTML = showCompleted
                ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>'
                : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 3 18 18m-8.5-8.5a2.5 2.5 0 0 1-3.5-3.5M10.6 6.2A10.7 10.7 0 0 1 12 6c6.3 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.8M6.2 6.3C3.9 8 2.5 12 2.5 12s3.2 6 9.5 6c.8 0 1.5-.1 2.2-.3"/></svg>';
            const actions = document.createElement('div');
            actions.className = 'pm-separate-actions';
            actions.append(viewSwitch, completedToggle, add);
            heading.append(title, actions);
            root.appendChild(heading);
            const content = document.createElement('div');
            content.id = 'pm-separate-task-content';
            content.hidden = collapsedPMTaskSections.has(doc.id);
            root.appendChild(content);
            if (content.hidden) return;
            if (state.settings.pmBoardEnabled && pmBoardViewDocuments.has(doc.id)) {
                const board = document.createElement('div');
                content.appendChild(board);
                renderPMBoard(doc, board);
                return;
            }
            if (!doc.pmTasks.length) {
                const empty = document.createElement('p');
                empty.className = 'pm-board-empty';
                empty.textContent = 'No project tasks yet.';
                content.appendChild(empty);
            } else if (hideCompletedPMTasks.has(doc.id) && !projectPMTasks(doc).some(task => !task.completed)) {
                const empty = document.createElement('p');
                empty.className = 'pm-board-empty';
                empty.textContent = 'All tasks are completed and hidden.';
                content.appendChild(empty);
            }
            function renderTasks(tasks) {
                const list = document.createElement('div');
                list.className = 'pm-task-outline';
                tasks.forEach(task => {
                    if (hideCompletedPMTasks.has(doc.id) && task.completed) return;
                    const item = document.createElement('div');
                    item.className = 'pm-task-item';
                    item.dataset.pmTaskId = task.id;
                    const row = document.createElement('div');
                    row.className = `pm-task-row${task.completed ? ' is-completed' : ''}`;
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    function updateTaskCheckbox() {
                        const status = task.completed ? 'done' : task.pmTask;
                        const nextStatus = status === 'done' ? 'todo' : status === 'todo' ? 'in-progress' : status === 'in-progress' ? 'blocked' : 'done';
                        checkbox.checked = task.completed;
                        checkbox.indeterminate = status === 'in-progress' || status === 'blocked';
                        checkbox.dataset.pmStatus = status;
                        checkbox.setAttribute('aria-label', `${task.text || 'Untitled task'}: ${PM_BOARD_STATUS_LABELS[status]}; change to ${PM_BOARD_STATUS_LABELS[nextStatus]}`);
                        checkbox.title = checkbox.getAttribute('aria-label');
                    }
                    updateTaskCheckbox();
                    checkbox.onchange = () => {
                        const nextStatus = task.completed ? 'todo' : task.pmTask === 'todo' ? 'in-progress' : task.pmTask === 'in-progress' ? 'blocked' : 'done';
                        if (nextStatus === 'done' && descendantProgress(task).completed < descendantProgress(task).total) {
                            updateTaskCheckbox();
                            showToast('Complete all sub-tasks before completing this task.');
                            return;
                        }
                        task.completed = nextStatus === 'done';
                        if (!task.completed) task.pmTask = nextStatus;
                        markNodeEdited(task);
                        scheduleSave();
                        render();
                        const next = document.querySelector(`[data-pm-task-id="${CSS.escape(task.id)}"] > .pm-task-row input`);
                        (next || document.getElementById('pm-task-completed-toggle'))?.focus();
                    };
                    const body = document.createElement('div');
                    body.className = 'pm-task-body';
                    const name = document.createElement('input');
                    name.className = 'pm-task-title';
                    name.value = task.text;
                    name.setAttribute('aria-label', 'Task title');
                    let initialTitle = task.text;
                    name.onfocus = () => { initialTitle = task.text; };
                    name.oninput = () => {
                        if (!name.value.trim() || !separatePMTaskAvailable(doc, task)) return;
                        task.text = name.value;
                        markNodeEdited(task); scheduleSave();
                    };
                    name.onchange = () => {
                        const text = name.value.trim();
                        if (!text) {
                            task.text = initialTitle;
                            name.value = initialTitle;
                            markNodeEdited(task); scheduleSave();
                            showToast('Enter a task title.');
                            return;
                        }
                        if (!findSeparatePMTask(doc.pmTasks, task)) {
                            showToast('This task is no longer available.');
                            return;
                        }
                        if (text !== task.text) {
                            task.text = text;
                            markNodeEdited(task); scheduleSave();
                        }
                        updateTaskCheckbox();
                    };
                    name.onkeydown = event => {
                        if (event.key === 'Enter') { event.preventDefault(); name.blur(); }
                        if (event.key === 'Escape') {
                            task.text = initialTitle;
                            name.value = initialTitle;
                            markNodeEdited(task); scheduleSave(); name.blur();
                        }
                    };
                    const meta = document.createElement('span');
                    meta.className = 'pm-board-meta';
                    appendPMTaskMetadata(meta, task);
                    body.appendChild(name);
                    if (task.description) {
                        const description = document.createElement('div');
                        description.className = 'pm-task-description';
                        description.textContent = task.description;
                        body.appendChild(description);
                    }
                    body.appendChild(meta);
                    appendPMFieldNotes(meta, task, body, separatePMFieldNotesKey(doc, task));
                    function toggleStar(focusMenu = false) {
                        if (!separatePMTaskAvailable(doc, task)) { showToast('This task is no longer available.'); return; }
                        task.starred = !task.starred;
                        markNodeEdited(task); scheduleSave(); render();
                        const target = focusMenu || !task.starred ? 'summary' : '.pm-task-star';
                        document.querySelector(`[data-pm-task-id="${CSS.escape(task.id)}"] > .pm-task-row ${target}`)?.focus();
                    }
                    const star = pmButton('', () => toggleStar());
                    star.appendChild(createIcon('star', task.starred));
                    star.className = 'pm-task-star';
                    star.hidden = !task.starred;
                    star.setAttribute('aria-label', `${task.starred ? 'Unstar' : 'Star'} ${task.text || 'untitled task'}`);
                    star.setAttribute('aria-pressed', String(task.starred));
                    star.title = task.starred ? 'Unstar task' : 'Star task';
                    const menu = document.createElement('details');
                    menu.className = 'pm-task-menu';
                    const summary = document.createElement('summary');
                    summary.className = 'pm-task-edit';
                    summary.setAttribute('aria-label', `Task options for ${task.text || 'untitled task'}`);
                    summary.title = 'Task options';
                    summary.appendChild(createIcon('more'));
                    const actions = document.createElement('div');
                    actions.className = 'priority-menu pm-task-menu-actions';
                    const priorityLabel = document.createElement('div');
                    priorityLabel.className = 'priority-menu-label';
                    priorityLabel.textContent = 'Priority';
                    const priorities = document.createElement('div');
                    priorities.className = 'priority-choices';
                    priorities.setAttribute('role', 'group');
                    priorities.setAttribute('aria-label', 'Task priority');
                    [['none', 'No priority', '–'], ['low', 'Low priority', '!'], ['medium', 'Medium priority', '!!'], ['high', 'High priority', '!!!']].forEach(([value, label, icon]) => {
                        const button = pmButton('', () => {
                            if (!separatePMTaskAvailable(doc, task)) { showToast('This task is no longer available.'); return; }
                            task.priority = value;
                            markNodeEdited(task); scheduleSave(); render();
                            document.querySelector(`[data-pm-task-id="${CSS.escape(task.id)}"] > .pm-task-row summary`)?.focus();
                        });
                        button.className = 'priority-choice';
                        button.setAttribute('aria-label', label);
                        button.setAttribute('aria-pressed', String((task.priority || 'none') === value));
                        button.title = label;
                        const mark = document.createElement('span');
                        mark.className = `priority-mark ${value}`;
                        mark.textContent = icon;
                        mark.setAttribute('aria-hidden', 'true');
                        button.appendChild(mark);
                        priorities.appendChild(button);
                    });
                    actions.append(priorityLabel, priorities);
                    function action(label, paths, callback, disabled = false) {
                        const button = pmButton('', () => { menu.open = false; callback(); });
                        button.className = 'priority-option';
                        button.append(createNodeActionIcon(paths), document.createTextNode(label));
                        button.disabled = disabled;
                        actions.appendChild(button);
                    }
                    action(task.starred ? 'Remove star' : 'Star task', ['m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9z'], () => toggleStar(true));
                    action('Add sub-task', ['M12 5v14M5 12h14'], () => showSeparatePMTaskComposer(doc, item, task));
                    action('Edit status', ['M4 5h16v14H4z', 'M8 12l2 2 5-5'], () => showSeparatePMTaskField(doc, item, task, 'status'));
                    action('Edit assignee', ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M5 20a7 7 0 0 1 14 0'], () => showSeparatePMTaskField(doc, item, task, 'assignee'));
                    action('Edit due date', ['M4 6h16v14H4z', 'M8 3v6M16 3v6M4 10h16'], () => showSeparatePMTaskField(doc, item, task, 'dueDate'));
                    action('Edit description', ['M5 4h14v16H5z', 'M8 9h8M8 13h8M8 17h5'], () => showSeparatePMTaskField(doc, item, task, 'description'));
                    action('Field notes', ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5'], () => showSeparatePMTaskNotes(doc, item, task));
                    if (task.children.length) action(collapsedSeparatePMTasks.has(task.id) ? 'Expand sub-tasks' : 'Collapse sub-tasks', ['M6 9l6 6 6-6'], () => {
                        if (collapsedSeparatePMTasks.has(task.id)) collapsedSeparatePMTasks.delete(task.id);
                        else collapsedSeparatePMTasks.add(task.id);
                        render();
                    });
                    const location = findSeparatePMTask(doc.pmTasks, task);
                    action('Indent task', ['M4 6h16M4 18h16M9 12h11m-4-4 4 4-4 4'], () => {
                        const current = findSeparatePMTask(doc.pmTasks, task);
                        if (!current || !current.index) { showToast('This task cannot be indented.'); return; }
                        const previous = current.array[current.index - 1];
                        current.array.splice(current.index, 1);
                        previous.children.push(task);
                        collapsedSeparatePMTasks.delete(previous.id);
                        scheduleSave(); render();
                    }, !location || location.index === 0);
                    action('Outdent task', ['M4 6h16M4 18h16M4 12h11m-7-4-4 4 4 4'], () => {
                        const current = findSeparatePMTask(doc.pmTasks, task);
                        const parentLocation = current?.parent && findSeparatePMTask(doc.pmTasks, current.parent);
                        if (!parentLocation) { showToast('This task cannot be outdented.'); return; }
                        current.array.splice(current.index, 1);
                        parentLocation.array.splice(parentLocation.index + 1, 0, task);
                        scheduleSave(); render();
                    }, !location?.parent);
                    action('Delete task', ['M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5'], () => {
                        const current = findSeparatePMTask(doc.pmTasks, task);
                        if (!current) { showToast('This task is no longer available.'); return; }
                        if (!confirm('Delete this task and all its sub-tasks? The project outline will not change.')) return;
                        current.array.splice(current.index, 1);
                        scheduleSave(); render();
                    });
                    menu.append(summary, actions);
                    row.append(menu, checkbox, star, body);
                    item.appendChild(row);
                    if (task.children.length) {
                        const children = renderTasks(task.children);
                        children.classList.add('pm-task-children');
                        children.hidden = collapsedSeparatePMTasks.has(task.id);
                        item.appendChild(children);
                    }
                    list.appendChild(item);
                });
                return list;
            }
            content.appendChild(renderTasks(doc.pmTasks));
            if (separatePMDraft?.doc === doc) {
                const draft = separatePMDraft;
                const container = draft.task
                    ? root.querySelector(`[data-pm-task-id="${CSS.escape(draft.task.id)}"]`)
                    : root;
                if (container) {
                    if (draft.kind === 'compose') showSeparatePMTaskComposer(doc, container, draft.task, true);
                    else if (draft.kind === 'notes') showSeparatePMTaskNotes(doc, container, draft.task, true);
                    else showSeparatePMTaskField(doc, container, draft.task, draft.kind, true);
                }
            }
        }
        function separatePMTaskAvailable(doc, task = null) {
            return state.documents.includes(doc) && state.settings.pmEnabled && state.settings.pmSeparateTasksEnabled &&
                isPMProject(doc) && (!task || !!findSeparatePMTask(doc.pmTasks, task));
        }
        function hasUnsavedSeparatePMDraft() {
            return !!separatePMDraft && separatePMDraft.value !== null &&
                separatePMDraft.value !== separatePMDraft.initial;
        }
        function separatePMInlinePanel(container, draft, restoring = false) {
            if (!restoring && separatePMDraft) {
                if (!confirm('Discard the open task edit?')) return null;
                document.querySelector('.pm-task-inline-panel')?.remove();
            }
            if (!restoring) separatePMDraft = draft;
            const panel = document.createElement('div');
            panel.className = 'pm-task-inline-panel compact-inline-panel';
            container.insertBefore(panel, container.querySelector(':scope > .pm-task-children'));
            return panel;
        }
        function showSeparatePMTaskComposer(doc, container, parent, restoring = false) {
            if (parent) {
                collapsedSeparatePMTasks.delete(parent.id);
                const children = container.querySelector(':scope > .pm-task-children');
                if (children) children.hidden = false;
            } else if (state.settings.pmBoardEnabled && pmBoardViewDocuments.has(doc.id)) {
                pmBoardViewDocuments.delete(doc.id);
                render();
                container = document.getElementById('pm-separate-tasks');
            }
            const panel = separatePMInlinePanel(container, { doc, task: parent, kind: 'compose', value: '', initial: '' }, restoring);
            if (!panel) return;
            const form = document.createElement('form');
            form.className = 'pm-task-inline-form compact-inline-form';
            const input = document.createElement('input');
            input.required = true;
            input.value = separatePMDraft.value;
            input.placeholder = parent ? 'New sub-task' : 'New task';
            input.setAttribute('aria-label', input.placeholder);
            const save = pmButton('Add', () => {});
            save.type = 'submit';
            const cancel = pmButton('Cancel', () => { separatePMDraft = null; panel.remove(); });
            form.append(input, save, cancel);
            panel.appendChild(form);
            form.onsubmit = event => {
                event.preventDefault();
                const text = input.value.trim();
                if (!text) { input.setCustomValidity('Enter a task title.'); input.reportValidity(); return; }
                if (!separatePMTaskAvailable(doc, parent)) { showToast('This task is no longer available.'); return; }
                const task = { id: makeId(), text, completed: false, pmTask: 'todo', dueDate: '', description: '',
                    starred: false, priority: 'none', pmAssignee: '', pmFieldNotes: [], pmRepeat: '', pmRepeatSpawned: false, children: [] };
                (parent ? parent.children : doc.pmTasks).push(task);
                if (parent) collapsedSeparatePMTasks.delete(parent.id);
                separatePMDraft = null;
                scheduleSave(); render();
                document.querySelector(`[data-pm-task-id="${CSS.escape(task.id)}"] .pm-task-title`)?.focus();
            };
            input.oninput = () => { input.setCustomValidity(''); separatePMDraft.value = input.value; };
            if (!restoring) input.focus();
        }
        function showSeparatePMTaskField(doc, container, task, field, restoring = false) {
            const panel = separatePMInlinePanel(container, { doc, task, kind: field, value: null }, restoring);
            if (!panel) return;
            const form = document.createElement('form');
            form.className = 'pm-task-inline-form compact-inline-form';
            const label = document.createElement('label');
            const labels = { status: 'Status', assignee: 'Assignee', dueDate: 'Due date', priority: 'Priority',
                description: 'Description' };
            label.textContent = labels[field];
            let input;
            if (field === 'status' || field === 'priority') {
                input = document.createElement('select');
                const values = field === 'status' ? PM_BOARD_STATUSES.map(value => [value, PM_BOARD_STATUS_LABELS[value]]) :
                    [['none', 'None'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
                values.forEach(([value, text]) => input.add(new Option(text, value)));
                input.value = field === 'status' ? (task.completed ? 'done' : task.pmTask) : (task.priority || 'none');
            } else {
                input = document.createElement(field === 'description' ? 'textarea' : 'input');
                if (field === 'dueDate') input.type = 'date';
                if (field === 'assignee') input.maxLength = 160;
                input.value = field === 'assignee' ? task.pmAssignee : task[field];
                if (field === 'dueDate' && task.dueDate && !input.value) {
                    input.type = 'text'; input.value = task.dueDate;
                }
            }
            if (restoring && separatePMDraft.value !== null) input.value = separatePMDraft.value;
            if (!restoring) separatePMDraft.initial = input.value;
            input.oninput = () => { separatePMDraft.value = input.value; };
            input.onchange = () => { separatePMDraft.value = input.value; };
            label.appendChild(input);
            const save = pmButton('Save', () => {});
            save.type = 'submit';
            const cancel = pmButton('Cancel', () => { separatePMDraft = null; panel.remove(); });
            const message = document.createElement('p');
            message.className = 'pm-task-message';
            message.setAttribute('role', 'alert');
            form.append(label, save, cancel, message);
            panel.appendChild(form);
            form.onsubmit = event => {
                event.preventDefault();
                if (!separatePMTaskAvailable(doc, task)) { message.textContent = 'This task is no longer available.'; return; }
                if (field === 'status') {
                    if (!PM_BOARD_STATUSES.includes(input.value)) { message.textContent = 'Choose a valid status.'; return; }
                    if (input.value === 'done' && !task.completed && descendantProgress(task).completed < descendantProgress(task).total) {
                        message.textContent = 'Complete all sub-tasks before completing this task.'; return;
                    }
                    task.completed = input.value === 'done';
                    if (!task.completed) task.pmTask = input.value;
                } else if (field === 'assignee') task.pmAssignee = input.value.trim();
                else task[field] = input.value;
                separatePMDraft = null;
                markNodeEdited(task); scheduleSave(); render();
            };
            if (!restoring) input.focus();
        }
        function showSeparatePMTaskNotes(doc, container, task, restoring = false) {
            const panel = separatePMInlinePanel(container, { doc, task, kind: 'notes', value: '', initial: '' }, restoring);
            if (!panel) return;
            const heading = document.createElement('strong');
            heading.textContent = 'Field notes';
            panel.appendChild(heading);
            task.pmFieldNotes.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'pm-task-inline-note';
                const text = document.createElement('span');
                text.textContent = `${new Date(entry.at).toLocaleString()} — ${entry.text}`;
                const remove = pmButton('', () => {
                    if (!separatePMTaskAvailable(doc, task)) { showToast('This task is no longer available.'); return; }
                    if (!confirm('Delete this field note?')) return;
                    task.pmFieldNotes.splice(task.pmFieldNotes.indexOf(entry), 1);
                    if (!task.pmFieldNotes.length) expandedPMFieldNotes.delete(separatePMFieldNotesKey(doc, task));
                    markNodeEdited(task); scheduleSave(); render();
                });
                remove.appendChild(createIcon('close'));
                remove.setAttribute('aria-label', 'Delete field note');
                remove.title = 'Delete field note';
                item.append(text, remove);
                panel.appendChild(item);
            });
            const form = document.createElement('form');
            form.className = 'pm-task-inline-form compact-inline-form';
            const input = document.createElement('textarea');
            input.required = true;
            input.value = separatePMDraft.value;
            input.setAttribute('aria-label', 'New field note');
            input.placeholder = 'New field note';
            const save = pmButton('Add', () => {});
            save.type = 'submit';
            const cancel = pmButton('Close', () => { separatePMDraft = null; panel.remove(); });
            form.append(input, save, cancel);
            panel.appendChild(form);
            form.onsubmit = event => {
                event.preventDefault();
                const text = input.value.trim();
                if (!text) { input.setCustomValidity('Enter a field note.'); input.reportValidity(); return; }
                if (!separatePMTaskAvailable(doc, task)) { showToast('This task is no longer available.'); return; }
                task.pmFieldNotes.unshift({ text, at: new Date().toISOString() });
                separatePMDraft = null;
                markNodeEdited(task); scheduleSave(); render();
            };
            input.oninput = () => { input.setCustomValidity(''); separatePMDraft.value = input.value; };
            if (!restoring) input.focus();
        }
        function editPMProject(doc) {
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) closeModal()"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pm-project-edit-title">
                <h2 id="pm-project-edit-title">Edit site details</h2><form class="pm-form pm-site-form">
                <label>Client / GC<input name="client" maxlength="160"></label>
                <label>Address<input name="address" maxlength="250"></label>
                <label>PM / lead<input name="pm" maxlength="160"></label>
                <label>Status<select name="status"></select></label>
                <label>Start date<input name="mobilization" type="date"></label>
                <label>Scope Summary<textarea name="scopeSummary" maxlength="4000"></textarea></label>
                <label>Meeting day<input name="meetingDay" maxlength="160" placeholder="e.g. Tuesday at 10 AM"></label>
                <p class="pm-site-message" role="alert"></p>
                <div class="pm-actions"><button type="submit">Save site</button><button type="button" class="pm-cancel">Cancel</button></div>
                </form></section></div>`;
            const form = root.querySelector('form');
            const site = doc.pmProject;
            PM_STATUSES.forEach(status => form.elements.status.appendChild(new Option(status, status)));
            ['client', 'address', 'pm', 'status'].forEach(key => { form.elements[key].value = site[key]; });
            form.elements.mobilization.value = site.dates.mobilization;
            form.elements.scopeSummary.value = site.scopeSummary;
            form.elements.meetingDay.value = site.meetingDay;
            root.querySelector('.pm-cancel').onclick = closeModal;
            form.onsubmit = event => {
                event.preventDefault();
                if (!state.documents.includes(doc) || !state.settings.pmEnabled || !isPMProject(doc) || doc.pmProject !== site) {
                    root.querySelector('.pm-site-message').textContent = 'This project is no longer available for editing.';
                    return;
                }
                ['client', 'address', 'pm'].forEach(key => { site[key] = form.elements[key].value.trim(); });
                site.status = form.elements.status.value;
                site.dates.mobilization = form.elements.mobilization.value;
                site.scopeSummary = form.elements.scopeSummary.value.trim();
                site.meetingDay = form.elements.meetingDay.value.trim();
                closeModal(); scheduleSave(); render();
            };
            form.elements.client.focus();
        }
        const expandedPMFieldNotes = new Set();
        function pmFieldNotesKey(doc, node) {
            return JSON.stringify([doc.id, node.id]);
        }
        function separatePMFieldNotesKey(doc, task) {
            return JSON.stringify([doc.id, 'separate-task', task.id]);
        }
        function appendPMNodeBadges(line, doc, node, content) {
            const values = [];
            if (node.pmAssignee) values.push(`Assignee: ${node.pmAssignee}`);
            values.forEach(value => {
                const badge = document.createElement('span');
                badge.className = 'pm-project-badge';
                badge.textContent = value;
                line.appendChild(badge);
            });
            appendPMFieldNotes(line, node, content, pmFieldNotesKey(doc, node));
        }
        function appendPMFieldNotes(line, node, content, key) {
            if (!node.pmFieldNotes.length) return;
            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = 'pm-project-badge pm-field-notes-toggle';
            badge.textContent = `${node.pmFieldNotes.length} field note${node.pmFieldNotes.length === 1 ? '' : 's'}`;
            const notes = document.createElement('div');
            notes.className = 'pm-inline-field-notes';
            node.pmFieldNotes.forEach(entry => {
                const item = document.createElement('div');
                const timestamp = document.createElement('time');
                timestamp.dateTime = entry.at;
                timestamp.textContent = new Date(entry.at).toLocaleString();
                const text = document.createElement('div');
                text.textContent = entry.text;
                item.append(timestamp, text);
                notes.appendChild(item);
            });
            function updateVisibility() {
                const expanded = expandedPMFieldNotes.has(key);
                badge.setAttribute('aria-expanded', String(expanded));
                badge.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} ${badge.textContent}`);
                notes.hidden = !expanded;
            }
            badge.onclick = () => {
                if (expandedPMFieldNotes.has(key)) expandedPMFieldNotes.delete(key);
                else expandedPMFieldNotes.add(key);
                updateVisibility();
            };
            updateVisibility();
            line.appendChild(badge);
            content.appendChild(notes);
        }
        function appendPMTaskBadge(line, node) {
            if (!node.pmTask) return;
            const badge = document.createElement('span');
            badge.className = 'pm-project-badge pm-task-badge';
            badge.textContent = `Task: ${node.completed ? 'Done' : PM_BOARD_STATUS_LABELS[node.pmTask] || 'To do'}`;
            line.appendChild(badge);
        }
        function appendPMNodeActions(menu, doc, node, closeMenu, actionLabel, dueAction) {
            function action(label, icon, callback) {
                const button = pmButton('', () => { closeMenu(); callback(); });
                button.className = 'priority-option';
                actionLabel(button, label, icon);
                menu.appendChild(button);
            }
            action('Task status…', ['M4 5h16v14H4z', 'M8 12l2 2 5-5'], () => {
                const root = document.getElementById('modal-root');
                root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pm-task-title">
                    <h2 id="pm-task-title">Task status</h2><form class="pm-form"><label>Status<select name="status">
                    <option value="none">Not a task</option><option value="todo">To do</option><option value="in-progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option>
                    </select></label><p class="pm-task-message" role="alert"></p><div class="pm-actions"><button type="submit">Save status</button><button type="button" class="pm-cancel">Cancel</button></div></form></section></div>`;
                const form = root.querySelector('form');
                form.elements.status.value = !node.pmTask ? 'none' : node.completed ? 'done' : node.pmTask;
                root.querySelector('.pm-cancel').onclick = closeModal;
                form.onsubmit = event => {
                    event.preventDefault();
                    const value = form.elements.status.value;
                    if (value !== 'none' && node.progressNode) {
                        root.querySelector('.pm-task-message').textContent = 'Remove the automatic progress node setting before marking this as a task.';
                        return;
                    }
                    if (value === 'done' && !node.completed && descendantProgress(node).completed < descendantProgress(node).total) {
                        root.querySelector('.pm-task-message').textContent = 'Complete all sub-notes before completing this task.';
                        return;
                    }
                    node.pmTask = value === 'none' ? null : value === 'done' ? 'todo' : value;
                    if (value !== 'none') node.completed = value === 'done';
                    markNodeEdited(node); closeModal(); scheduleSave(); render();
                };
                form.elements.status.focus();
            });
            menu.appendChild(dueAction);
            action(node.pmAssignee ? 'Edit assignee…' : 'Add assignee…', ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M5 20a7 7 0 0 1 14 0'], () => {
                const root = document.getElementById('modal-root');
                root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pm-assignee-title">
                    <h2 id="pm-assignee-title">Assignee</h2><form class="pm-form"><label>Assignee<input name="assignee" maxlength="160"></label>
                    <div class="pm-actions"><button type="submit">Save assignee</button><button type="button" class="pm-cancel">Cancel</button></div></form></section></div>`;
                const form = root.querySelector('form');
                form.elements.assignee.value = node.pmAssignee;
                root.querySelector('.pm-cancel').onclick = closeModal;
                form.onsubmit = event => { event.preventDefault(); node.pmAssignee = form.elements.assignee.value.trim(); markNodeEdited(node); closeModal(); scheduleSave(); render(); };
                form.elements.assignee.focus();
            });
            action('Field notes…', ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5'], () => editPMFieldNotes(doc, node));
        }
        function editPMFieldNotes(doc, node) {
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pm-notes-title">
                <h2 id="pm-notes-title">Field notes</h2><div class="pm-field-notes"></div>
                <form class="pm-form"><label>New field note<textarea name="note" required></textarea></label>
                <div class="pm-actions"><button type="submit">Add field note</button><button type="button" class="pm-cancel">Close</button></div></form></section></div>`;
            const list = root.querySelector('.pm-field-notes');
            if (!node.pmFieldNotes.length) list.textContent = 'No field notes yet.';
            node.pmFieldNotes.forEach((entry, index) => {
                const item = document.createElement('div');
                const text = document.createElement('p');
                text.textContent = `${new Date(entry.at).toLocaleString()} — ${entry.text}`;
                const remove = pmButton('Delete', () => {
                    if (!confirm('Delete this field note?')) return;
                    node.pmFieldNotes.splice(index, 1);
                    if (!node.pmFieldNotes.length) expandedPMFieldNotes.delete(pmFieldNotesKey(doc, node));
                    markNodeEdited(node); scheduleSave(); render(); editPMFieldNotes(doc, node);
                });
                item.append(text, remove);
                list.appendChild(item);
            });
            const form = root.querySelector('form');
            root.querySelector('.pm-cancel').onclick = () => { closeModal(); render(); };
            form.onsubmit = event => {
                event.preventDefault();
                const text = form.elements.note.value.trim();
                if (!text) { form.elements.note.setCustomValidity('Enter a field note.'); form.elements.note.reportValidity(); return; }
                node.pmFieldNotes.unshift({ text, at: new Date().toISOString() });
                markNodeEdited(node); scheduleSave(); render(); editPMFieldNotes(doc, node);
            };
            form.elements.note.oninput = () => form.elements.note.setCustomValidity('');
            form.elements.note.focus();
        }
        let pmZoomId = null;
        function pmFind(nodes, id, ancestors = []) {
            for (let index = 0; index < nodes.length; index++) {
                const node = nodes[index];
                if (node.id === id) return { node, nodes, index, ancestors };
                const found = pmFind(node.children, id, [...ancestors, node]);
                if (found) return found;
            }
            return null;
        }
        function pmHeight(node) {
            return node.children.length ? 1 + Math.max(...node.children.map(pmHeight)) : 0;
        }
        function pmFocus(id) {
            requestAnimationFrame(() => {
                const input = [...document.querySelectorAll('[data-pm-node]')].find(item => item.dataset.pmNode === id);
                if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            });
        }
        function pmRefreshSearch(label, value) {
            renderPM();
            const input = document.querySelector(`[aria-label="${label}"]`);
            if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
        }
        function pmDownload() {
            const blob = new Blob([JSON.stringify(state.pmSites, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'smart-list-pm-sites.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        async function pmCopyOutline(site) {
            const selected = pmZoomId ? pmFind(site.nodes, pmZoomId) : null;
            const lines = [`${site.name} #project`];
            function visit(nodes, depth) {
                nodes.forEach(node => {
                    lines.push(`${'\t'.repeat(depth)}${node.checked === null ? '' : node.checked ? '[x] ' : '[ ] '}${node.text}`);
                    visit(node.children, depth + 1);
                });
            }
            visit(selected ? [selected.node] : site.nodes, 0);
            try {
                await navigator.clipboard.writeText(lines.join('\n'));
                showToast('Outline copied to clipboard.');
            } catch (error) {
                console.error('Could not copy PM outline:', error);
                showToast('Could not copy outline. Check clipboard permissions.');
            }
        }
        function validatePMSites(sites) {
            if (!Array.isArray(sites)) throw new Error('PM sites must be a list.');
            const ids = new Set();
            function validateNodes(nodes, depth) {
                if (!Array.isArray(nodes) || (depth > 50 && nodes.length)) throw new Error('Invalid PM outline.');
                nodes.forEach(node => {
                    if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id) ||
                        typeof node.text !== 'string' || (node.checked !== null && typeof node.checked !== 'boolean') ||
                        typeof node.collapsed !== 'boolean' || ![null, 'blue', 'amber', 'emerald', 'rose'].includes(node.highlight)) {
                        throw new Error('Invalid PM outline node.');
                    }
                    ids.add(node.id);
                    validateNodes(node.children, depth + 1);
                });
            }
            sites.forEach(site => {
                if (!site || typeof site.id !== 'string' || !site.id || ids.has(site.id) ||
                    typeof site.name !== 'string' || !site.name.trim() ||
                    ['client', 'address', 'pm'].some(key => typeof site[key] !== 'string') ||
                    !PM_STATUSES.includes(site.status) || !site.dates || typeof site.dates !== 'object' ||
                    PM_DATES.some(key => typeof site.dates[key] !== 'string' ||
                        (site.dates[key] !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(site.dates[key])))) {
                    throw new Error('Invalid PM site or milestone.');
                }
                ids.add(site.id);
                validateNodes(site.nodes, 0);
            });
        }
        function pmNode(text, checked = null, children = []) {
            return { id: makeId(), text, checked, collapsed: false, highlight: null, children };
        }
        function pmTemplateNode(text, options = {}, children = []) {
            const node = pmNode(text, options.checked ?? null, children);
            node.collapsed = Boolean(options.collapsed);
            node.highlight = options.highlight || null;
            return node;
        }
    function pmStarterNodes(siteMeta = {}) {
      return [
        pmTemplateNode('📋 Project Overview & Contacts', { highlight: 'blue' }, [
          pmTemplateNode(`Client / GC: ${siteMeta.client || 'TBD'}`),
          pmTemplateNode(`Site Address: ${siteMeta.address || 'TBD'}`),
          pmTemplateNode(`PM / Lead Tech: ${siteMeta.pm || 'TBD'}`),
          pmTemplateNode('Site Superintendent / Contact: '),
          pmTemplateNode('Scope Summary: Structured Cabling (Cat6A/Fiber), Access Control, IP CCTV & IDF Buildout')
        ]),
        pmTemplateNode('📁 Engineering, Submittals & Docs', { collapsed: true }, [
          pmTemplateNode('Drawings & Floor Plans (As-Builts / Reflected Ceiling / Door Schedules)', { checked: false }),
          pmTemplateNode('Submittals & Product Data Sheets Approved', { checked: false }),
          pmTemplateNode('Permits, Lift Certifications & Site Badging Requirements', { checked: false }),
          pmTemplateNode('RFIs & Change Orders (COs)', {}, [
            pmTemplateNode('RFI-01: Confirm 120V dedicated quad outlet at IDF-2 ACP wall #waiting', { checked: false })
          ])
        ]),
        pmTemplateNode('📦 Materials, Staging & Procurement', { collapsed: true }, [
          pmTemplateNode('Long-Lead Equipment Ordered (Panels, PoE Switches, NVRs, Readers, Cabling)', { checked: true }),
          pmTemplateNode('BOM / Material Delivery Verification on Site #next', { checked: false }),
          pmTemplateNode('Rack / MDF / IDF Pre-Build & Bench Testing', { checked: false })
        ]),
        pmTemplateNode('🔨 Phase 1: Pre-Construction & Site Walk', { collapsed: true }, [
          pmTemplateNode('Review drawings against architectural & electrical plans', { checked: true }),
          pmTemplateNode('Verify pathway readiness (conduit, J-hooks, sleeves, core drills)', { checked: true }),
          pmTemplateNode('Confirm MDF/IDF room readiness (power, cooling, 3/4" fire-rated plywood backboards)', { checked: false }),
          pmTemplateNode('Walk site with GC & Electrician for door hardware & power drops #next', { checked: false })
        ]),
        pmTemplateNode('🔌 Phase 2: Rough-In & Pathway Installation', {}, [
          pmTemplateNode('Install J-hooks (max 4-5 ft spacing), cable tray, and pathways', { checked: true }),
          pmTemplateNode('Pull horizontal cabling (Cat6/6A, fiber backbone, composite access control)', { checked: false }),
          pmTemplateNode('Label both ends of every cable run per TIA-606 labeling schedule', { checked: false }),
          pmTemplateNode('Install single-gang mud rings, backboxes, and stub-ups at ADA heights', { checked: false }),
          pmTemplateNode('Rough-in inspection & photo documentation before drywall close-up', { checked: false })
        ]),
        pmTemplateNode('🚪 Phase 3: Access Control & Door Hardware Scope', { highlight: 'amber' }, [
          pmTemplateNode('Door Schedule & Hardware Verification (Fail-Safe vs. Fail-Secure locks)', { checked: true }),
          pmTemplateNode('Cabling Infrastructure per Opening (22/6 Reader, 22/2 DPS, 22/4 REX, 18/2 Lock Power)', { checked: true }),
          pmTemplateNode('Field Device Trim-Out: Mount readers, DPS contacts, and PIR/touchless REX sensors', { checked: false }),
          pmTemplateNode('Panel Termination: Land Data0/Data1 (or OSDP RS-485), relays (C/NO/NC), and FACP fire trip relay #next', { checked: false }),
          pmTemplateNode('Commissioning: Test valid/invalid badge reads, DPS forced/held alarms, REX shunt & FACP drop', { checked: false })
        ]),
        pmTemplateNode('⚙️ Phase 4: Trim-Out, Termination & Head-End', { collapsed: true }, [
          pmTemplateNode('MDF / IDF Buildout (2-post/4-post racks, patch panels, vertical wire managers, UPS)', { checked: false }),
          pmTemplateNode('Terminate & velcro-dress patch panels and field keystones/faceplates', { checked: false }),
          pmTemplateNode('Mount & focus IP cameras (dome/bullet/multisensor) and patch into PoE switches', { checked: false }),
          pmTemplateNode('Program controllers, static IP addressing, VLANs, and NVR/VMS recording schedules', { checked: false })
        ]),
        pmTemplateNode('✅ Phase 5: Testing, Commissioning & Closeout', { collapsed: true }, [
          pmTemplateNode('Certify copper/fiber runs (Fluke Versiv test results exported to PDF)', { checked: false }),
          pmTemplateNode('Client / GC walkthrough & punch-list resolution', { checked: false }),
          pmTemplateNode('Deliver As-Built drawings, Fluke test reports, O&M manuals, and credentials', { checked: false }),
          pmTemplateNode('Final sign-off & warranty handoff', { checked: false })
        ]),
        pmTemplateNode('📝 Field Log & Site Notes', { highlight: 'emerald' }, [
          pmTemplateNode('Site mobilized; walked 1st floor corridor with GC superintendent to mark core drill locations.')
        ])
      ];
    }

    function pmDemoSites() {
      const site1Meta = {
        client: 'Apex Commercial Builders',
        address: '1200 Tech Center Dr, Bldg A',
        pm: 'D. Mercer'
      };
      const site1Nodes = pmStarterNodes(site1Meta);
      // Add a couple of extra realistic field log entries
      const fieldLog1 = site1Nodes[site1Nodes.length - 1];
      fieldLog1.children.unshift(
        pmTemplateNode('[2026-11-15 14:20] IDF-1 plywood backboard mounted; awaiting electrician 20A dedicated quad circuit #waiting'),
        pmTemplateNode('[2026-11-12 09:45] Completed 24-door composite cable pull on East Wing; all home runs labeled at ACP-1.')
      );

      const site2Meta = {
        client: 'Vanguard Healthcare Construction',
        address: '880 North Wing Medical Plaza',
        pm: 'R. Alvarez'
      };
      const site2Nodes = [
        pmTemplateNode('📋 Project Overview & Contacts', { highlight: 'blue' }, [
          pmTemplateNode('Client / GC: Vanguard Healthcare Construction'),
          pmTemplateNode('Site Address: 880 North Wing Medical Plaza (Floors 2 & 3)'),
          pmTemplateNode('PM / Lead Tech: R. Alvarez'),
          pmTemplateNode('Scope Summary: 340 Cat6A Drops, 12-Strand OS2 Fiber Tie, 42 IP Cameras, Nurse Call Rough-In')
        ]),
        pmTemplateNode('🔌 Structured Cabling & IDF Buildout', {}, [
          pmTemplateNode('Pull 280x Cat6A Plenum blue cables to Floor 2 workstations', { checked: true }),
          pmTemplateNode('Pull 60x Cat6A Plenum yellow cables for Wi-Fi 6E ceiling APs', { checked: true }),
          pmTemplateNode('Terminate 48-port angled Cat6A patch panels in IDF-2A #next', { checked: false }),
          pmTemplateNode('Fusion splice 12-strand OS2 single-mode fiber between MDF and IDF-2A', { checked: false }),
          pmTemplateNode('Fluke DSX-8000 certification testing across all 340 drops #waiting', { checked: false })
        ]),
        pmTemplateNode('📹 IP CCTV & NVR Integration', {}, [
          pmTemplateNode('Mount 28 interior corridor dome cameras with backboxes', { checked: true }),
          pmTemplateNode('Install 14 exterior parapet/loading dock IR bullet cameras with weatherproof glands #next', { checked: false }),
          pmTemplateNode('Configure Genetec/Milestone VMS server, RAID storage, and retention policy', { checked: false }),
          pmTemplateNode('Verify night-vision IR glare and field-of-view sign-off with Hospital Security', { checked: false })
        ]),
        pmTemplateNode('📝 Field Log & Site Notes', { highlight: 'emerald' }, [
          pmTemplateNode('[2026-11-16 10:15] Above-ceiling inspection passed in Radiology corridor; ceiling grid tiles dropping tomorrow.'),
          pmTemplateNode('[2026-11-13 15:30] RFI-04 submitted for exterior north loading dock camera mounting height clearance #rfi')
        ])
      ];

      return [
        {
          id: makeId(),
          name: 'Building A — Main Campus Access Control',
          client: site1Meta.client,
          address: site1Meta.address,
          pm: site1Meta.pm,
          status: 'Rough-In',
          dates: {
            mobilization: '2026-11-02',
            roughIn: '2026-11-24',
            cutover: '2026-12-08',
            handover: '2026-12-15'
          },
          nodes: site1Nodes
        },
        {
          id: makeId(),
          name: 'North Wing Medical Plaza — Cabling & CCTV',
          client: site2Meta.client,
          address: site2Meta.address,
          pm: site2Meta.pm,
          status: 'Trim-Out',
          dates: {
            mobilization: '2026-10-10',
            roughIn: '2026-11-10',
            cutover: '2026-11-28',
            handover: '2026-12-05'
          },
          nodes: site2Nodes
        }
      ];
    }

        function pmProgressData(nodes) {
            let total = 0, completed = 0;
            function visit(items) {
                items.forEach(node => {
                    if (node.checked !== null) { total++; if (node.checked) completed++; }
                    visit(node.children);
                });
            }
            visit(nodes);
            return { total, completed, percent: total ? Math.round(completed * 100 / total) : 0 };
        }
        function pmProgress(nodes) {
            const result = pmProgressData(nodes);
            return `${result.percent}% (${result.completed}/${result.total} tasks)`;
        }
        function pmProgressBar(nodes) {
            const progress = pmProgressData(nodes);
            const bar = document.createElement('div');
            bar.className = 'pm-progress';
            bar.setAttribute('role', 'progressbar');
            bar.setAttribute('aria-label', 'Task completion');
            bar.setAttribute('aria-valuemin', '0');
            bar.setAttribute('aria-valuemax', '100');
            bar.setAttribute('aria-valuenow', String(progress.percent));
            const fill = document.createElement('span');
            fill.style.width = `${progress.percent}%`;
            bar.appendChild(fill);
            return bar;
        }
        function pmButton(text, callback) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = text;
            button.onclick = callback;
            return button;
        }
        function renderPM() {
            const root = document.getElementById('pm-workspace');
            root.replaceChildren();
            const layout = document.createElement('div');
            layout.className = 'pm-layout';
            const directory = document.createElement('aside');
            directory.className = 'pm-directory';
            directory.setAttribute('aria-label', 'Construction sites');
            const directoryTitle = document.createElement('h2');
            directoryTitle.textContent = 'Construction sites';
            directory.appendChild(directoryTitle);
            const toolbar = document.createElement('div');
            toolbar.className = 'pm-toolbar';
            toolbar.append(pmButton('New site', () => editPMSite()));
            const search = document.createElement('input');
            search.type = 'search';
            search.placeholder = 'Search sites';
            search.setAttribute('aria-label', 'Search PM sites');
            search.value = pmSearch;
            search.oninput = () => { pmSearch = search.value; pmRefreshSearch('Search PM sites', pmSearch); };
            const filter = document.createElement('select');
            filter.setAttribute('aria-label', 'Filter sites by status');
            ['All', ...PM_STATUSES].forEach(value => filter.appendChild(new Option(value, value)));
            filter.value = pmStatusFilter;
            filter.onchange = () => { pmStatusFilter = filter.value; renderPM(); };
            toolbar.append(search, filter);
            directory.appendChild(toolbar);
            const list = document.createElement('div');
            list.className = 'pm-site-list';
            directory.appendChild(list);
            const transfer = document.createElement('div');
            transfer.className = 'pm-toolbar';
            transfer.append(pmButton('Export JSON', pmDownload), pmButton('Import FieldTree backup', importPMSites), pmButton('Add demo site', addPMDemo));
            directory.appendChild(transfer);
            const workspace = document.createElement('div');
            workspace.className = 'pm-main';
            layout.append(directory, workspace);
            root.appendChild(layout);
            const visible = state.pmSites.filter(site => (pmStatusFilter === 'All' || site.status === pmStatusFilter) &&
                [site.name, site.client, site.address, site.pm].some(value => value.toLowerCase().includes(pmSearch.trim().toLowerCase())));
            if (!visible.length) {
                const message = document.createElement('p');
                message.className = 'pm-meta';
                message.textContent = state.pmSites.length ? 'No sites match these filters.' : 'No PM sites yet. Create one, add demo data, or import a FieldTree backup.';
                workspace.appendChild(message);
                return;
            }
            if (!visible.some(site => site.id === activePMSiteId)) { activePMSiteId = visible[0].id; pmZoomId = null; }
            visible.forEach(site => {
                const item = pmButton('', () => { activePMSiteId = site.id; pmZoomId = null; pmNodeSearch = ''; pmNodeFilter = 'All'; renderPM(); });
                item.className = 'pm-site-item';
                item.setAttribute('aria-pressed', String(site.id === activePMSiteId));
                const name = document.createElement('strong');
                name.textContent = site.name;
                const description = document.createElement('span');
                description.textContent = `${site.status} · ${site.client || 'No client'} · ${pmProgress(site.nodes)}`;
                item.append(name, description, pmProgressBar(site.nodes));
                list.appendChild(item);
            });
            const site = visible.find(item => item.id === activePMSiteId);
            let zoom = pmZoomId && pmFind(site.nodes, pmZoomId);
            if (pmZoomId && !zoom) { pmZoomId = null; zoom = null; }
            const breadcrumbs = document.createElement('nav');
            breadcrumbs.className = 'pm-breadcrumbs';
            breadcrumbs.setAttribute('aria-label', 'PM outline navigation');
            breadcrumbs.appendChild(pmButton(site.name, () => { pmZoomId = null; renderPM(); }));
            if (zoom) [...zoom.ancestors, zoom.node].forEach(node => {
                breadcrumbs.appendChild(pmButton(node.text || 'Untitled', () => { pmZoomId = node.id; renderPM(); }));
            });
            workspace.appendChild(breadcrumbs);
            const card = document.createElement('section');
            card.className = 'pm-site';
            const title = document.createElement('h2');
            title.textContent = site.name;
            const meta = document.createElement('p');
            meta.className = 'pm-meta';
            meta.textContent = `${site.status} · Client: ${site.client || '—'} · Address: ${site.address || '—'} · PM: ${site.pm || '—'} · ${pmProgress(site.nodes)}`;
            const dates = document.createElement('div');
            dates.className = 'pm-dates';
            [['mobilization', 'Mobilization'], ['roughIn', 'Rough-in done'], ['cutover', 'System cutover'], ['handover', 'Handover']].forEach(([key, label]) => {
                const item = document.createElement('div');
                const heading = document.createElement('strong');
                heading.textContent = label;
                const value = document.createElement('span');
                value.textContent = site.dates[key] || 'TBD';
                item.append(heading, value);
                dates.appendChild(item);
            });
            const actions = document.createElement('div');
            actions.className = 'pm-actions';
            actions.append(pmButton('Edit site', () => editPMSite(site)), pmButton('Copy outline', () => pmCopyOutline(site)), pmButton('Delete site', () => {
                if (!confirm(`Delete PM site "${site.name}" and its outline?`)) return;
                state.pmSites = state.pmSites.filter(item => item.id !== site.id);
                activePMSiteId = null;
                pmZoomId = null;
                scheduleSave();
                renderPM();
            }), pmButton('Add note', () => {
                const parent = pmZoomId && pmFind(site.nodes, pmZoomId);
                if (parent && parent.ancestors.length >= 50) { showToast('Maximum outline depth reached.'); return; }
                const node = pmNode('', false);
                if (parent) { parent.node.children.push(node); parent.node.collapsed = false; }
                else site.nodes.push(node);
                scheduleSave();
                renderPM();
                pmFocus(node.id);
            }));
            const log = document.createElement('form');
            log.className = 'pm-toolbar';
            const note = document.createElement('input');
            note.type = 'text';
            note.placeholder = 'Add a field note';
            note.setAttribute('aria-label', 'Field note');
            note.required = true;
            const submit = document.createElement('button');
            submit.type = 'submit';
            submit.textContent = 'Log note';
            log.append(note, submit);
            log.onsubmit = event => {
                event.preventDefault();
                if (!note.value.trim()) { note.setCustomValidity('Enter a field note.'); note.reportValidity(); return; }
                let fieldLog = site.nodes.find(node => /field\s*log/i.test(node.text));
                if (!fieldLog) { fieldLog = pmNode('Field log and site notes'); site.nodes.push(fieldLog); }
                fieldLog.collapsed = false;
                fieldLog.children.unshift(pmNode(`[${new Date().toLocaleString()}] ${note.value.trim()}`));
                scheduleSave();
                renderPM();
            };
            note.oninput = () => note.setCustomValidity('');
            card.append(title, meta, pmProgressBar(site.nodes), dates, actions, log);
            const outline = document.createElement('div');
            outline.setAttribute('aria-label', 'PM site outline');
            const outlineFilters = document.createElement('div');
            outlineFilters.className = 'pm-toolbar';
            const nodeSearch = document.createElement('input');
            nodeSearch.type = 'search';
            nodeSearch.placeholder = 'Search outline';
            nodeSearch.setAttribute('aria-label', 'Search PM outline');
            nodeSearch.value = pmNodeSearch;
            nodeSearch.oninput = () => { pmNodeSearch = nodeSearch.value; pmRefreshSearch('Search PM outline', pmNodeSearch); };
            const nodeFilter = document.createElement('select');
            nodeFilter.setAttribute('aria-label', 'Filter PM outline');
            [['All', 'All notes'], ['open', 'Open tasks'], ['#next', '#next'], ['#waiting', '#waiting'], ['#rfi', '#rfi']].forEach(([value, label]) => nodeFilter.appendChild(new Option(label, value)));
            nodeFilter.value = pmNodeFilter;
            nodeFilter.onchange = () => { pmNodeFilter = nodeFilter.value; renderPM(); };
            outlineFilters.append(nodeSearch, nodeFilter, pmButton('Expand all', () => { site.nodes.forEach(node => { node.collapsed = false; }); scheduleSave(); renderPM(); }), pmButton('Collapse phases', () => { site.nodes.forEach(node => { if (node.children.length) node.collapsed = true; }); scheduleSave(); renderPM(); }));
            card.appendChild(outlineFilters);
            const shortcuts = document.createElement('p');
            shortcuts.className = 'pm-shortcuts';
            shortcuts.textContent = 'Enter: new node · Tab / Shift+Tab: indent / outdent · Ctrl or ⌘ + Enter: toggle task · Alt or ⌘ + arrows: move · Click a bullet to zoom';
            card.appendChild(shortcuts);
            const filtering = Boolean(pmNodeSearch.trim()) || pmNodeFilter !== 'All';
            function matches(node) {
                const text = node.text.toLowerCase();
                return (text.includes(pmNodeSearch.trim().toLowerCase()) &&
                    (pmNodeFilter === 'All' || (pmNodeFilter === 'open' ? node.checked === false : text.includes(pmNodeFilter)))) ||
                    node.children.some(matches);
            }
            function renderNodes(nodes, parent, depth, onlyId = null) {
                nodes.forEach((node, index) => {
                    if (onlyId && node.id !== onlyId) return;
                    if (filtering && !matches(node)) return;
                    const row = document.createElement('div');
                    row.className = 'pm-node';
                    if (node.highlight) row.dataset.highlight = node.highlight;
                    const collapse = pmButton('', () => { node.collapsed = !node.collapsed; scheduleSave(); renderPM(); });
                    collapse.appendChild(createIcon(node.collapsed ? 'chevron-right' : 'chevron-down'));
                    collapse.setAttribute('aria-label', `${node.collapsed ? 'Expand' : 'Collapse'} ${node.text}`);
                    collapse.disabled = !node.children.length;
                    const bullet = pmButton('●', () => { pmZoomId = node.id; renderPM(); });
                    bullet.setAttribute('aria-label', `Zoom into ${node.text || 'untitled node'}`);
                    bullet.className = 'pm-bullet';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = node.checked === true;
                    checkbox.hidden = node.checked === null;
                    checkbox.setAttribute('aria-label', `Complete ${node.text || 'untitled node'}`);
                    checkbox.onchange = () => { node.checked = checkbox.checked; scheduleSave(); renderPM(); };
                    const text = document.createElement('textarea');
                    text.rows = 1;
                    text.value = node.text;
                    text.dataset.pmNode = node.id;
                    text.setAttribute('aria-label', `Edit ${node.text}`);
                    text.className = 'pm-node-text';
                    text.placeholder = 'Type task, scope item, or field note...';
                    if (node.checked === true) text.classList.add('pm-completed');
                    const tags = document.createElement('div');
                    tags.className = 'pm-node-tags';
                    function renderTags() {
                        tags.replaceChildren();
                        (node.text.match(/#[a-zA-Z0-9_-]+/g) || []).forEach(tag => {
                            const badge = document.createElement('span');
                            badge.textContent = tag;
                            tags.appendChild(badge);
                        });
                    }
                    renderTags();
                    text.oninput = () => {
                        node.text = text.value;
                        const name = node.text || 'untitled node';
                        text.setAttribute('aria-label', `Edit ${node.text}`);
                        bullet.setAttribute('aria-label', `Zoom into ${name}`);
                        checkbox.setAttribute('aria-label', `Complete ${name}`);
                        kind.setAttribute('aria-label', `Cycle task mode for ${name}`);
                        highlight.setAttribute('aria-label', `Cycle highlight for ${name}`);
                        indentButton.setAttribute('aria-label', `Indent ${node.text}`);
                        outdentButton.setAttribute('aria-label', `Outdent ${node.text}`);
                        up.setAttribute('aria-label', `Move ${node.text} up`);
                        down.setAttribute('aria-label', `Move ${node.text} down`);
                        remove.setAttribute('aria-label', `Delete ${node.text}`);
                        collapse.setAttribute('aria-label', `${node.collapsed ? 'Expand' : 'Collapse'} ${node.text}`);
                        text.style.height = 'auto';
                        text.style.height = `${text.scrollHeight}px`;
                        renderTags();
                        scheduleSave();
                    };
                    const refreshFocus = id => { scheduleSave(); renderPM(); pmFocus(id); };
                    const indent = () => {
                        const ctx = pmFind(site.nodes, node.id);
                        if (!ctx || !ctx.index || node.id === pmZoomId) return;
                        if (ctx.ancestors.length + 1 + pmHeight(node) > 50) { showToast('Maximum outline depth reached.'); return; }
                        const previous = ctx.nodes[ctx.index - 1];
                        ctx.nodes.splice(ctx.index, 1);
                        previous.children.push(node);
                        previous.collapsed = false;
                        refreshFocus(node.id);
                    };
                    const outdent = () => {
                        const ctx = pmFind(site.nodes, node.id);
                        if (!ctx || !ctx.ancestors.length || ctx.ancestors[ctx.ancestors.length - 1].id === pmZoomId || node.id === pmZoomId) return;
                        const parentContext = pmFind(site.nodes, ctx.ancestors[ctx.ancestors.length - 1].id);
                        ctx.nodes.splice(ctx.index, 1);
                        parentContext.nodes.splice(parentContext.index + 1, 0, node);
                        refreshFocus(node.id);
                    };
                    text.onkeydown = event => {
                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                            event.preventDefault(); node.checked = node.checked === null ? false : !node.checked; refreshFocus(node.id);
                        } else if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
                            event.preventDefault();
                            const ctx = pmFind(site.nodes, node.id);
                            if (!ctx) return;
                            const child = node.id === pmZoomId || (node.children.length && !node.collapsed);
                            if (child && ctx.ancestors.length >= 50) { showToast('Maximum outline depth reached.'); return; }
                            const next = pmNode('', node.checked === null ? null : false);
                            if (child) { node.children.unshift(next); node.collapsed = false; }
                            else ctx.nodes.splice(ctx.index + 1, 0, next);
                            refreshFocus(next.id);
                        } else if (event.key === 'Tab') {
                            event.preventDefault(); if (event.shiftKey) outdent(); else indent();
                        } else if (event.key === 'Backspace' && !text.value && !node.children.length) {
                            event.preventDefault();
                            const ctx = pmFind(site.nodes, node.id);
                            if (!ctx) return;
                            const focus = ctx.index ? ctx.nodes[ctx.index - 1].id : ctx.ancestors.at(-1)?.id;
                            ctx.nodes.splice(ctx.index, 1);
                            if (pmZoomId === node.id) pmZoomId = focus || null;
                            scheduleSave(); renderPM(); if (focus) pmFocus(focus);
                        } else if ((event.altKey || event.metaKey) && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                            event.preventDefault();
                            const ctx = pmFind(site.nodes, node.id);
                            const target = ctx && ctx.index + (event.key === 'ArrowUp' ? -1 : 1);
                            if (ctx && target >= 0 && target < ctx.nodes.length && node.id !== pmZoomId) {
                                [ctx.nodes[target], ctx.nodes[ctx.index]] = [ctx.nodes[ctx.index], ctx.nodes[target]];
                                refreshFocus(node.id);
                            }
                        }
                    };
                    const add = pmButton('Add sub-note', () => { const child = pmNode('', false); node.children.push(child); node.collapsed = false; refreshFocus(child.id); });
                    add.disabled = depth >= 50;
                    const kind = pmButton('', () => { node.checked = node.checked === null ? false : node.checked === false ? true : null; scheduleSave(); renderPM(); });
                    kind.appendChild(createIcon('task'));
                    kind.setAttribute('aria-label', `Cycle task mode for ${node.text || 'untitled node'}`);
                    kind.title = 'Cycle note / open task / completed task';
                    const highlight = pmButton('', () => {
                        const colors = [null, 'blue', 'amber', 'emerald', 'rose'];
                        node.highlight = colors[(colors.indexOf(node.highlight) + 1) % colors.length];
                        scheduleSave(); renderPM();
                    });
                    highlight.appendChild(createIcon('highlight'));
                    highlight.setAttribute('aria-label', `Cycle highlight for ${node.text || 'untitled node'}`);
                    highlight.title = 'Cycle highlight color';
                    const indentButton = pmButton('', indent);
                    indentButton.appendChild(createIcon('arrow-right'));
                    indentButton.setAttribute('aria-label', `Indent ${node.text}`);
                    indentButton.disabled = index === 0 || node.id === pmZoomId || depth + 1 + pmHeight(node) > 50;
                    const outdentButton = pmButton('', outdent);
                    outdentButton.appendChild(createIcon('arrow-left'));
                    outdentButton.setAttribute('aria-label', `Outdent ${node.text}`);
                    const parentNode = pmFind(site.nodes, node.id).ancestors.at(-1);
                    outdentButton.disabled = !parentNode || parentNode.id === pmZoomId || node.id === pmZoomId;
                    const up = pmButton('', () => { [nodes[index - 1], nodes[index]] = [nodes[index], nodes[index - 1]]; scheduleSave(); renderPM(); });
                    up.appendChild(createIcon('arrow-up'));
                    up.disabled = index === 0 || node.id === pmZoomId;
                    up.setAttribute('aria-label', `Move ${node.text} up`);
                    const down = pmButton('', () => { [nodes[index + 1], nodes[index]] = [nodes[index], nodes[index + 1]]; scheduleSave(); renderPM(); });
                    down.appendChild(createIcon('arrow-down'));
                    down.disabled = index === nodes.length - 1 || node.id === pmZoomId;
                    down.setAttribute('aria-label', `Move ${node.text} down`);
                    const remove = pmButton('Delete', () => {
                        if (!confirm(`Delete "${node.text}" and its sub-notes?`)) return;
                        if (pmZoomId === node.id) pmZoomId = parentNode?.id || null;
                        nodes.splice(index, 1); scheduleSave(); renderPM();
                    });
                    remove.setAttribute('aria-label', `Delete ${node.text}`);
                    const tools = document.createElement('div');
                    tools.className = 'pm-node-tools';
                    tools.append(kind, highlight, add, outdentButton, indentButton, up, down, remove);
                    row.append(collapse, bullet, checkbox, text, tags, tools);
                    parent.appendChild(row);
                    if (node.children.length) {
                        const children = document.createElement('div');
                        children.className = 'pm-node-children';
                        children.hidden = node.collapsed && !filtering;
                        renderNodes(node.children, children, depth + 1);
                        parent.appendChild(children);
                    }
                });
            }
            renderNodes(zoom ? zoom.nodes : site.nodes, outline, zoom ? zoom.ancestors.length : 0, zoom ? zoom.node.id : null);
            card.appendChild(outline);
            workspace.appendChild(card);
            requestAnimationFrame(() => outline.querySelectorAll('textarea').forEach(input => { input.style.height = `${input.scrollHeight}px`; }));
        }
        function editPMSite(site = null) {
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) closeModal()"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pm-edit-title">
                <h2 id="pm-edit-title"></h2><form class="pm-form">
                <label>Site name<input name="name" required maxlength="160"></label>
                <label>Client / GC<input name="client" maxlength="160"></label><label>Address<input name="address" maxlength="250"></label>
                <label>PM / lead<input name="pm" maxlength="160"></label><label>Status<select name="status"></select></label>
                <label>Mobilization<input name="mobilization" type="date"></label><label>Rough-in<input name="roughIn" type="date"></label>
                <label>Cutover<input name="cutover" type="date"></label><label>Handover<input name="handover" type="date"></label>
                <label class="pm-starter-label"><span><input type="checkbox" name="starter" checked> Add starter outline</span></label>
                <div class="pm-actions"><button type="submit">Save site</button><button type="button" class="pm-cancel">Cancel</button></div>
                </form></section></div>`;
            root.querySelector('#pm-edit-title').textContent = site ? 'Edit PM site' : 'New PM site';
            const form = root.querySelector('form');
            PM_STATUSES.forEach(status => form.elements.status.appendChild(new Option(status, status)));
            for (const key of ['name', 'client', 'address', 'pm']) form.elements[key].value = site ? site[key] : '';
            form.elements.status.value = site ? site.status : 'Active';
            PM_DATES.forEach(key => { form.elements[key].value = site ? site.dates[key] : ''; });
            root.querySelector('.pm-starter-label').hidden = Boolean(site);
            root.querySelector('.pm-cancel').onclick = closeModal;
            form.onsubmit = event => {
                event.preventDefault();
                const name = form.elements.name.value.trim();
                if (!name) { form.elements.name.setCustomValidity('Enter a site name.'); form.elements.name.reportValidity(); return; }
                const values = { name, client: form.elements.client.value.trim(), address: form.elements.address.value.trim(), pm: form.elements.pm.value.trim(), status: form.elements.status.value, dates: Object.fromEntries(PM_DATES.map(key => [key, form.elements[key].value])) };
                const target = site || { id: makeId(), nodes: form.elements.starter.checked ? pmStarterNodes(values) : [] };
                Object.assign(target, values);
                if (!site) state.pmSites.push(target);
                activePMSiteId = target.id;
                pmZoomId = null;
                pmNodeSearch = '';
                pmNodeFilter = 'All';
                pmSearch = '';
                pmStatusFilter = 'All';
                closeModal(); scheduleSave(); renderPM();
            };
            form.elements.name.oninput = () => form.elements.name.setCustomValidity('');
            form.elements.name.focus();
        }
        function addPMDemo() {
            if (!confirm('Add two sample PM sites to your workspace? Existing sites will be kept.')) return;
            const sites = pmDemoSites();
            state.pmSites.push(...sites);
            activePMSiteId = sites[0].id;
            pmZoomId = null;
            pmNodeSearch = '';
            pmNodeFilter = 'All';
            pmSearch = '';
            pmStatusFilter = 'All';
            scheduleSave();
            renderPM();
        }
        function importPMSites() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json,.json';
            input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                    const source = JSON.parse(await file.text());
                    if (!Array.isArray(source) || !source.length) throw new Error('Choose a FieldTree JSON backup containing sites.');
                    function copyNodes(nodes, depth) {
                        if (!Array.isArray(nodes) || (depth > 50 && nodes.length)) throw new Error('Invalid or excessively nested FieldTree outline.');
                        return nodes.map(node => {
                            if (!node || typeof node.text !== 'string' || ![null, true, false].includes(node.checked) ||
                                typeof node.collapsed !== 'boolean' || ![null, 'blue', 'amber', 'emerald', 'rose'].includes(node.highlight)) throw new Error('A FieldTree node is invalid.');
                            return { id: makeId(), text: node.text, checked: node.checked, collapsed: node.collapsed, highlight: node.highlight, children: copyNodes(node.children, depth + 1) };
                        });
                    }
                    const sites = source.map(site => {
                        if (!site || typeof site.name !== 'string' || !site.name.trim() || !PM_STATUSES.includes(site.status) ||
                            ['client', 'address', 'pm'].some(key => typeof site[key] !== 'string') || !site.dates || typeof site.dates !== 'object') throw new Error('A FieldTree site is invalid.');
                        return { id: makeId(), name: site.name, client: site.client, address: site.address, pm: site.pm, status: site.status,
                            dates: Object.fromEntries(PM_DATES.map(key => [key, site.dates[key]])), nodes: copyNodes(site.nodes, 0) };
                    });
                    validatePMSites(sites);
                    if (!confirm(`Add ${sites.length} FieldTree site(s) to PM? Existing sites will be kept.`)) return;
                    state.pmSites.push(...sites);
                    activePMSiteId = sites[0].id;
                    pmZoomId = null;
                    pmNodeSearch = '';
                    pmNodeFilter = 'All';
                    pmSearch = '';
                    pmStatusFilter = 'All';
                    scheduleSave();
                    renderPM();
                    showToast(`Imported ${sites.length} PM site(s).`);
                } catch (error) {
                    console.error('Could not import FieldTree backup:', error);
                    showToast(`Could not import FieldTree backup: ${error.message}`);
                }
            };
            input.click();
        }
