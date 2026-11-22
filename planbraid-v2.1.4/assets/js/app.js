/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        if (typeof SMARTLIST_RELEASES !== 'undefined' && SMARTLIST_RELEASES.length) {
            document.getElementById('release-version').textContent = `v${SMARTLIST_RELEASES[0].version}`;
        } else {
            console.error('PlanBraid release history could not be loaded.');
        }
        const DEFAULT_SUBTITLE = 'A place for your thoughts, plans, and everything in between.';
        const SHORTCUTS = [
            { action: 'Add a note at the same level', keys: 'Enter' },
            { action: 'Nest this note', keys: 'Tab' },
            { action: 'Move note out one level', keys: 'Shift + Tab' },
            { action: 'Mark note complete', keys: '⌘ / Ctrl + Enter' },
            { action: 'Search all notes', keys: '⌘ / Ctrl + K' },
            { action: 'Delete an empty note', keys: 'Backspace' }
        ];
        const starterData = {
            activeId: 'personal',
            settings: { richTextEnabled: false, tagsEnabled: false, endlessEnabled: true, nodeZoomEnabled: false,
                remindersEnabled: false, priorityEnabled: false, pmEnabled: false, pmBoardEnabled: false, templatesEnabled: false, dashboardEnabled: true },
            documents: [
                { id: 'personal', title: 'Personal', starred: false, updatedAt: Date.now(), nodes: [
                    { id: 'welcome', text: 'A calmer place to think', completed: false, collapsed: false, starred: false, children: [
                        { id: 'welcome-1', text: 'Add a thought, then press Enter to keep going', completed: false, collapsed: false, starred: false, children: [] },
                        { id: 'welcome-2', text: 'Press Tab to turn a thought into a sub-point', completed: false, collapsed: false, starred: false, children: [] },
                        { id: 'welcome-3', text: 'Use the note menu to mark something done', completed: false, collapsed: false, starred: false, children: [] }
                    ] },
                    { id: 'today', text: 'Today', completed: false, collapsed: false, starred: true, children: [
                        { id: 'today-1', text: 'Make a little room to think', completed: false, collapsed: false, starred: false, children: [] },
                        { id: 'today-2', text: 'Choose one thing to focus on', completed: false, collapsed: false, starred: false, children: [] }
                    ] },
                    { id: 'projects', text: 'Projects', completed: false, collapsed: false, starred: false, children: [
                        { id: 'project-1', text: 'Plan the next small step', completed: false, collapsed: false, starred: false, children: [] },
                        { id: 'project-2', text: 'Collect ideas as they come', completed: false, collapsed: false, starred: false, children: [] }
                    ] },
                    { id: 'read-later', text: 'Read later', completed: false, collapsed: true, starred: false, children: [
                        { id: 'read-1', text: 'A good article someone mentioned', completed: false, collapsed: false, starred: false, children: [] }
                    ] }
                ] },
                { id: 'work', title: 'Work', starred: false, updatedAt: Date.now(), nodes: [] },
                { id: 'ideas', title: 'Ideas', starred: false, updatedAt: Date.now(), nodes: [] }
            ]
        };
        let state = normalizeState(structuredClone(starterData));
        let activeFilter = 'all';
        let currentView = 'project';
        let movingNode = null;
        let zoomNodeId = null;
        let zoomDocumentId = null;
        let selectedTag = '';
        let priorityFilter = 'all';
        let completedFilter = 'show';
        let endlessCompletedFilter = 'show';
        let saveTimer;
        let csrfToken = '';
        let revision = 0;
        let editGeneration = 0;
        let savedGeneration = 0;
        let saveInFlight = false;
        let healthCheckInFlight = false;
        let serverUnavailable = false;
        let syncBlocked = false;
        let authenticated = false;
        let currentAccountId = null;
        let appInstanceId = '';
        let instanceDisconnected = false;
        let instanceBackupExported = false;
        let reminderPermissionNoticeShown = false;
        let isAdministrator = false;
        let extensionAccess = { pmEnabled: false, supplyEnabled: false, supplyRole: null };
        let supplyNeedsReload = false;
        let accountEmail = '';
        let toastTimer;
        let focusRequest = null;
        let activePMSiteId = null;
        let pmSearch = '';
        let pmStatusFilter = 'All';
        let pmNodeSearch = '';
        let pmNodeFilter = 'All';
        const collapsedSpaces = new Set();
        const collapsedProjectOutlines = new Set();

        function normalizeState(data, onReopened = null) {
            if (!data || !Array.isArray(data.documents) || !data.documents.length) throw new Error('The saved outline is not valid.');
            if (data.settings === undefined) data.settings = {};
            if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('The saved settings are not valid.');
            if (data.settings.richTextEnabled === undefined) data.settings.richTextEnabled = true;
            if (typeof data.settings.richTextEnabled !== 'boolean') throw new Error('The rich-text module setting is not valid.');
            if (data.settings.tagsEnabled === undefined) data.settings.tagsEnabled = true;
            if (typeof data.settings.tagsEnabled !== 'boolean') throw new Error('The tags module setting is not valid.');
            if (data.settings.endlessEnabled === undefined) data.settings.endlessEnabled = true;
            if (typeof data.settings.endlessEnabled !== 'boolean') throw new Error('The Continuum module setting is not valid.');
            if (data.settings.nodeZoomEnabled === undefined) data.settings.nodeZoomEnabled = false;
            if (typeof data.settings.nodeZoomEnabled !== 'boolean') throw new Error('The node zoom setting is not valid.');
            if (data.settings.remindersEnabled === undefined) data.settings.remindersEnabled = true;
            if (typeof data.settings.remindersEnabled !== 'boolean') throw new Error('The reminders module setting is not valid.');
            if (data.settings.priorityEnabled === undefined) data.settings.priorityEnabled = true;
            if (typeof data.settings.priorityEnabled !== 'boolean') throw new Error('The Priority module setting is not valid.');
            if (data.settings.agendaNotesEnabled === undefined) data.settings.agendaNotesEnabled = false;
            if (typeof data.settings.agendaNotesEnabled !== 'boolean') throw new Error('The Scratchpad module setting is not valid.');
            if (data.settings.agendaSpreadsheetsEnabled === undefined) data.settings.agendaSpreadsheetsEnabled = true;
            if (typeof data.settings.agendaSpreadsheetsEnabled !== 'boolean') throw new Error('The Scratchpad spreadsheets setting is not valid.');
            data.agendaNotes = normalizeAgendaNotes(data.agendaNotes, data.documents.filter(Boolean));
            if (data.settings.pmEnabled === undefined) data.settings.pmEnabled = false;
            if (typeof data.settings.pmEnabled !== 'boolean') throw new Error('The PM module setting is not valid.');
            if (data.settings.pmBoardEnabled === undefined) data.settings.pmBoardEnabled = true;
            if (typeof data.settings.pmBoardEnabled !== 'boolean') throw new Error('The PM board setting is not valid.');
            if (data.settings.pmSeparateTasksEnabled === undefined) data.settings.pmSeparateTasksEnabled = false;
            if (typeof data.settings.pmSeparateTasksEnabled !== 'boolean') throw new Error('The separate PM tasks setting is not valid.');
            if (data.settings.pmProgressPanelEnabled === undefined) data.settings.pmProgressPanelEnabled = true;
            if (typeof data.settings.pmProgressPanelEnabled !== 'boolean') throw new Error('The PM progress panel setting is not valid.');
            if (data.settings.pmSiteInfoEnabled === undefined) data.settings.pmSiteInfoEnabled = data.settings.pmProgressPanelEnabled;
            if (typeof data.settings.pmSiteInfoEnabled !== 'boolean') throw new Error('The PM site information setting is not valid.');
            if (data.settings.templatesEnabled === undefined) data.settings.templatesEnabled = true;
            if (typeof data.settings.templatesEnabled !== 'boolean') throw new Error('The project templates setting is not valid.');
            if (data.settings.projectOutlineCollapseEnabled === undefined) data.settings.projectOutlineCollapseEnabled = true;
            if (typeof data.settings.projectOutlineCollapseEnabled !== 'boolean') throw new Error('The project outline collapse setting is not valid.');
            if (data.settings.sidebarAllNotes === undefined) data.settings.sidebarAllNotes = false;
            if (typeof data.settings.sidebarAllNotes !== 'boolean') throw new Error('The All notes sidebar setting is not valid.');
            for (const key of ['dashboardEnabled', 'dashboardPinned', 'dashboardPriority', 'dashboardDue', 'sidebarStarred', 'sidebarPriority']) {
                if (data.settings[key] === undefined) data.settings[key] = true;
                if (typeof data.settings[key] !== 'boolean') throw new Error(`The ${key} setting is not valid.`);
            }
            if (data.settings.hiddenTags === undefined) data.settings.hiddenTags = [];
            if (!Array.isArray(data.settings.hiddenTags) || data.settings.hiddenTags.some(tag => typeof tag !== 'string' || !/^#[\p{L}\p{M}\p{N}_-]+$/u.test(tag))) throw new Error('The hidden tags setting is not valid.');
            data.settings.hiddenTags = [...new Set(data.settings.hiddenTags.map(tag => tag.toLowerCase().normalize('NFC')))];
            if (data.settings.theme === undefined) data.settings.theme = 'light';
            if (!['light', 'dark', 'sepia'].includes(data.settings.theme)) throw new Error('The saved theme is not valid.');
            if (data.settings.design === undefined) data.settings.design = 'classic';
            if (!DESIGNS.includes(data.settings.design)) throw new Error('The saved design is not valid.');
            if (data.spaces === undefined) data.spaces = [{ id: 'default-space', name: 'My space' }];
            if (!Array.isArray(data.spaces) || !data.spaces.length || data.spaces.some(space => !space || typeof space.id !== 'string' || typeof space.name !== 'string')) {
                throw new Error('The saved spaces are not valid.');
            }
            const spaceIds = new Set(data.spaces.map(space => space.id));
            if (spaceIds.size !== data.spaces.length) throw new Error('The saved spaces have duplicate IDs.');
            if (data.templates === undefined) data.templates = [];
            if (!Array.isArray(data.templates)) throw new Error('The saved project templates are not valid.');
            const templateIds = new Set();
            data.templates.forEach(template => {
                if (!template || typeof template.id !== 'string' || !template.id || templateIds.has(template.id) ||
                    typeof template.name !== 'string' || !template.name.trim() || typeof template.outline !== 'string') {
                    throw new Error('A saved project template is not valid.');
                }
                templateIds.add(template.id);
                validateTemplateOutline(template.outline);
                validateCustomFields(template.fields, false);
            });
            if (data.pmSites === undefined) data.pmSites = [];
            validatePMSites(data.pmSites);
            let reopened = 0;
            data.documents.forEach(doc => {
                if (!doc || !Array.isArray(doc.nodes)) throw new Error('A saved project is missing its outline.');
                if (doc.spaceId == null) doc.spaceId = data.spaces[0].id;
                if (!spaceIds.has(doc.spaceId)) throw new Error('A saved project refers to a missing space.');
                if (typeof doc.subtitle !== 'string') doc.subtitle = DEFAULT_SUBTITLE;
                if (doc.customFields === undefined) doc.customFields = [];
                validateCustomFields(doc.customFields, true);
                if (doc.templateId !== undefined && (typeof doc.templateId !== 'string' || !doc.templateId)) throw new Error('The project template reference is not valid.');
                validatePMProject(doc.pmProject);
                doc.nodes = normalizeNodes(doc.nodes);
                doc.pmBoardOrder = normalizePMBoardOrder(doc.pmBoardOrder);
                reopened += syncProgressNodes(doc.nodes, true).reopened;
                if (doc.pmTasks !== undefined) {
                    doc.pmTasks = normalizeSeparatePMTasks(doc.pmTasks);
                    reopened += syncSeparatePMTasks(doc.pmTasks);
                }
                else if (data.settings.pmSeparateTasksEnabled && doc.pmProject) doc.pmTasks = copyOutlinePMTasks(doc);
            });
            if (!data.documents.some(doc => doc.id === data.activeId)) data.activeId = data.documents[0].id;
            if (onReopened) onReopened(reopened);
            return data;
        }

        function normalizeNodes(nodes) {
            return nodes.map(node => ({
                id: typeof node.id === 'string' ? node.id : makeId(),
                text: typeof node.text === 'string' ? node.text : '',
                completed: Boolean(node.completed),
                progressNode: node.progressNode === true,
                collapsed: Boolean(node.collapsed),
                starred: Boolean(node.starred),
                priority: normalizePriority(node.priority),
                highlight: normalizeHighlight(node.highlight),
                heading: normalizeHeading(node.heading),
                description: typeof node.description === 'string' ? node.description : '',
                descriptionHtml: typeof node.descriptionHtml === 'string' ? node.descriptionHtml : '',
                dueDate: typeof node.dueDate === 'string' ? node.dueDate : '',
                reminderAt: normalizeReminderTimestamp(node.reminderAt, 'reminder time'),
                reminderNotifiedAt: normalizeReminderTimestamp(node.reminderNotifiedAt, 'reminder notification time'),
                pmTask: normalizePMTask(node.pmTask),
                pmAssignee: normalizePMAssignee(node.pmAssignee),
                pmFieldNotes: normalizePMFieldNotes(node.pmFieldNotes),
                pmRepeat: normalizePMRepeat(node.pmRepeat),
                pmRepeatSpawned: normalizePMRepeatSpawned(node.pmRepeatSpawned),
                createdAt: typeof node.createdAt === 'string' ? node.createdAt : null,
                editedAt: typeof node.editedAt === 'string' ? node.editedAt : null,
                children: Array.isArray(node.children) ? normalizeNodes(node.children) : []
            }));
        }
        function normalizeReminderTimestamp(timestamp, label) {
            if (timestamp == null || timestamp === '') return '';
            if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) throw new Error(`Invalid ${label}.`);
            return new Date(timestamp).toISOString();
        }

        function normalizePriority(priority) {
            if (priority == null) return 'none';
            if (['none', 'low', 'medium', 'high'].includes(priority)) return priority;
            throw new Error(`Invalid node priority: ${priority}`);
        }
        function normalizeHighlight(highlight) {
            if (highlight == null) return 'none';
            if (['none', 'yellow', 'green', 'blue', 'pink'].includes(highlight)) return highlight;
            throw new Error(`Invalid node highlight: ${highlight}`);
        }
        function normalizeHeading(heading) {
            if (heading == null) return 'none';
            if (['none', 'h1', 'h2', 'h3'].includes(heading)) return heading;
            throw new Error(`Invalid node heading: ${heading}`);
        }

        function activeDocument() {
            return state.documents.find(doc => doc.id === state.activeId) || state.documents[0];
        }
        function makeId() {
            return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        }
        function createNode() {
            const now = new Date().toISOString();
            return { id: makeId(), text: '', completed: false, progressNode: false, collapsed: false, starred: false, priority: 'none', highlight: 'none', heading: 'none', description: '', dueDate: '', reminderAt: '', reminderNotifiedAt: '', pmTask: null, pmAssignee: '', pmFieldNotes: [], createdAt: now, editedAt: now, children: [] };
        }
        function markNodeEdited(node) {
            node.editedAt = new Date().toISOString();
        }
        function formatNodeTimestamp(timestamp) {
            if (!timestamp || Number.isNaN(Date.parse(timestamp))) return 'Unknown';
            return new Date(timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        }
        function allNodes(nodes, path = [], result = []) {
            nodes.forEach((node, index) => {
                const nodePath = [...path, index];
                result.push({ node, path: nodePath });
                allNodes(node.children, nodePath, result);
            });
            return result;
        }
        function findNode(id, nodes = activeDocument().nodes, parent = null) {
            for (let index = 0; index < nodes.length; index++) {
                const node = nodes[index];
                if (node.id === id) return { node, array: nodes, index, parent };
                const found = findNode(id, node.children, node);
                if (found) return found;
            }
            return null;
        }
        function countNodes(nodes) {
            return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
        }
        function descendantProgress(node) {
            const descendants = allNodes(node.children);
            return { total: descendants.length, completed: descendants.filter(item => item.node.completed).length };
        }
        function progressLabel(progress) {
            const percentage = progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
            return `${progress.completed}/${progress.total} completed (${percentage}%)`;
        }
        function syncProgressNodes(nodes, updateTimestamps = false) {
            let total = 0;
            let completed = 0;
            let reopened = 0;
            nodes.forEach(node => {
                const descendants = syncProgressNodes(node.children, updateTimestamps);
                reopened += descendants.reopened;
                if (node.progressNode) {
                    const isComplete = descendants.total > 0 && descendants.completed === descendants.total;
                    if (node.completed !== isComplete) {
                        if (node.completed) reopened++;
                        node.completed = isComplete;
                        if (updateTimestamps) markNodeEdited(node);
                    }
                } else if (node.completed && descendants.completed < descendants.total) {
                    node.completed = false;
                    reopened++;
                    if (updateTimestamps) markNodeEdited(node);
                }
                total += 1 + descendants.total;
                completed += Number(node.completed) + descendants.completed;
            });
            return { total, completed, reopened };
        }
        function toggleNodeCompletion(node) {
            if (node.progressNode) {
                showToast('Progress node completion is calculated from its sub-notes.');
                return false;
            }
            const progress = descendantProgress(node);
            if (!node.completed && progress.completed < progress.total) {
                showToast('Complete all sub-notes before completing this note.');
                return false;
            }
            node.completed = !node.completed;
            if (node.pmTask && !node.completed) node.pmTask = 'todo';
            markNodeEdited(node);
            return true;
        }
        function hasStarred(node) {
            return node.starred || node.children.some(hasStarred);
        }
        function matchesNodeFilters(node) {
            if (currentView === 'endless') return endlessCompletedFilter === 'show' || !node.completed;
            return (completedFilter === 'show' || !node.completed) &&
                (activeFilter === 'all' || node.starred) &&
                (priorityFilter === 'all' || (node.priority || 'none') === priorityFilter);
        }
        function hasMatchingNode(node) {
            return matchesNodeFilters(node) || node.children.some(hasMatchingNode);
        }
        function visibleNodes(nodes) {
            return nodes.flatMap(node => {
                if (!hasMatchingNode(node)) return [];
                if ((currentView === 'endless' ? endlessCompletedFilter : completedFilter) === 'hide' && node.completed) return visibleNodes(node.children);
                return [node];
            });
        }
        function branchesExpandedForFilter() {
            return currentView === 'endless' ? endlessCompletedFilter === 'hide' : (priorityFilter !== 'all' || completedFilter === 'hide');
        }
        function setSaveStatus(message) {
            document.getElementById('menu-save-status').textContent = message;
            for (const id of ['saved-state', 'endless-saved-state', 'dashboard-saved-state', 'agenda-saved-state']) {
                const status = document.getElementById(id);
                status.textContent = message;
                status.hidden = message === 'All changes saved';
            }
        }
        function scheduleSave() {
            state.documents.forEach(doc => {
                syncProgressNodes(doc.nodes, true);
                if (doc.pmTasks) syncSeparatePMTasks(doc.pmTasks);
            });
            editGeneration++;
            queueLocalSnapshot();
            clearTimeout(saveTimer);
            setSaveStatus(syncBlocked ? 'Changes not saved' : 'Saving…');
            if (!syncBlocked) saveTimer = setTimeout(flushSave, 250);
        }
        function getAppInstanceId() {
            if (!appInstanceId) {
                if (!globalThis.crypto?.getRandomValues) throw new Error('Secure app instance IDs are not supported in this browser.');
                const bytes = crypto.getRandomValues(new Uint8Array(32));
                appInstanceId = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
            }
            return appInstanceId;
        }
        async function api(action, body, claimInstance = false) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            let response;
            const url = `api.php?action=${encodeURIComponent(action)}${claimInstance ? '&claim=1' : ''}`;
            try {
                response = await fetch(url, body === undefined ? {
                    headers: { 'X-SmartList-Instance': getAppInstanceId() },
                    cache: 'no-store', signal: controller.signal
                } : {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                        'X-SmartList-Instance': getAppInstanceId()
                    },
                    body: JSON.stringify(body),
                    cache: 'no-store', signal: controller.signal
                });
            } catch (error) {
                if (error.name === 'AbortError') throw new Error('The database request timed out.');
                throw error;
            } finally {
                clearTimeout(timeout);
            }
            let result;
            try { result = await response.json(); }
            catch { throw new Error('The server returned an invalid response.'); }
            if (!response.ok) {
                const error = new Error(result.error || `Server error (${response.status}).`);
                error.status = response.status;
                error.code = result.code;
                throw error;
            }
            return result;
        }
        function setDatabaseStatus(text, state) {
            const label = document.getElementById('database-status-label');
            const previous = label.textContent;
            label.textContent = text;
            document.getElementById('database-status').dataset.state = state;
            document.getElementById('database-announcement').textContent = text;
            if (text.startsWith('Database: unavailable') && !previous.startsWith('Database: unavailable')) {
                showToast('Database unavailable. Open More options in the top-right corner to retry.');
            }
        }
        function disconnectReplacedInstance() {
            if (instanceDisconnected) return;
            instanceDisconnected = true;
            syncBlocked = true;
            clearTimeout(saveTimer);
            setDatabaseStatus('Database: connected elsewhere', 'error');
            const hasUnsavedChanges = editGeneration !== savedGeneration;
            if (hasUnsavedChanges) setSaveStatus('Changes not saved');
            document.getElementById('auth-message').textContent = hasUnsavedChanges
                ? 'You are connected in another PlanBraid instance. This instance has been disconnected. Export your unsaved changes before reconnecting.'
                : 'You are connected in another PlanBraid instance. This instance has been disconnected.';
            document.getElementById('login-fields').hidden = true;
            document.getElementById('connection-retry').hidden = false;
            document.getElementById('connection-retry').textContent = 'Reconnect this instance';
            document.getElementById('displaced-export').hidden = !hasUnsavedChanges;
            document.getElementById('required-password-form').hidden = true;
            document.getElementById('login-form').hidden = false;
            document.getElementById('auth-screen').hidden = false;
            document.getElementById('app').hidden = true;
            document.getElementById('shared-tracker').removeAttribute('src');
            document.getElementById('supply').removeAttribute('src');
        }
        function updateExtensionAccess(result) {
            if (typeof result.pmEnabled !== 'boolean' || typeof result.supplyEnabled !== 'boolean' ||
                !['technician', 'office', 'admin'].includes(result.supplyRole)) {
                throw new Error('The server did not provide valid extension permissions.');
            }
            const previous = extensionAccess;
            extensionAccess = { pmEnabled: result.pmEnabled, supplyEnabled: result.supplyEnabled, supplyRole: result.supplyRole };
            if (previous.supplyRole && previous.supplyRole !== result.supplyRole) supplyNeedsReload = true;
            document.getElementById('nav-shared-tracker').hidden = !result.pmEnabled;
            document.getElementById('nav-supply').hidden = !result.supplyEnabled;
            if ((currentView === 'shared-tracker' && !result.pmEnabled) || (currentView === 'supply' && !result.supplyEnabled)) {
                currentView = 'dashboard';
                render();
                showToast('Extension access changed. Unsaved extension changes may not be saved.');
            } else if (currentView === 'supply' && previous.supplyRole && previous.supplyRole !== result.supplyRole) {
                showToast('Your Supply role changed. Reopen Supply to refresh its controls.');
            }
        }
        async function checkDatabase() {
            if (!authenticated || healthCheckInFlight) return;
            healthCheckInFlight = true;
            try {
                const result = await api('session');
                if (result.sessionReplaced) {
                    disconnectReplacedInstance();
                } else if (!result.authenticated) {
                    syncBlocked = true;
                    setDatabaseStatus('Database: session expired', 'error');
                    if (editGeneration !== savedGeneration) setSaveStatus('Changes not saved');
                    showToast('Your session expired. Export any unsaved changes before reloading.');
                } else if (!syncBlocked) {
                    updateExtensionAccess(result);
                    serverUnavailable = false;
                    setDatabaseStatus('Database: connected', 'connected');
                    if (editGeneration !== savedGeneration) flushSave();
                }
            } catch (error) {
                console.error('Database connection check failed:', error);
                if (error.code === 'session_replaced') disconnectReplacedInstance();
                else {
                    serverUnavailable = true;
                    setDatabaseStatus('Database: unavailable — click to retry', 'error');
                }
            } finally {
                healthCheckInFlight = false;
            }
        }
        async function flushSave() {
            if (saveInFlight || syncBlocked || editGeneration === savedGeneration || !authenticated) return;
            saveInFlight = true;
            const generation = editGeneration;
            const snapshot = structuredClone(state);
            try {
                const result = await api('save', { revision, state: snapshot });
                revision = result.revision;
                savedGeneration = generation;
                serverUnavailable = false;
                if (savedGeneration === editGeneration) queueLocalRemoval();
                else queueLocalSnapshot();
                setDatabaseStatus('Database: connected', 'connected');
                if (savedGeneration === editGeneration) {
                    setSaveStatus('All changes saved');
                    renderSidebar();
                }
            } catch (error) {
                console.error('Could not save workspace:', error);
                if (error.code === 'session_replaced') {
                    disconnectReplacedInstance();
                    return;
                }
                setSaveStatus('Changes not saved');
                if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
                    syncBlocked = true;
                    setDatabaseStatus('Database: save blocked', 'error');
                    showToast(`${error.message} Export a backup before reloading.`);
                } else {
                    const wasUnavailable = serverUnavailable;
                    serverUnavailable = true;
                    setDatabaseStatus('Database: unavailable — click to retry', 'error');
                    queueLocalSnapshot();
                    if (!wasUnavailable) showToast(`Could not sync: ${error.message} Changes will retry when connected.`);
                }
            } finally {
                saveInFlight = false;
            }
            if (savedGeneration === generation && editGeneration !== generation) flushSave();
        }
        function render() {
            document.documentElement.dataset.theme = state.settings.theme;
            applyDesign(state.settings.design);
            document.getElementById('manage-project-templates').hidden = !state.settings.templatesEnabled;
            if (!state.settings.priorityEnabled) {
                priorityFilter = 'all';
                if (currentView === 'priority') currentView = 'project';
            }
            document.getElementById('priority-filter-option').hidden = !state.settings.priorityEnabled;
            if (!state.settings.nodeZoomEnabled) {
                zoomNodeId = null;
                zoomDocumentId = null;
            }
            if (movingNode && (movingNode.view !== currentView || movingNode.zoomId !== zoomNodeId ||
                (currentView === 'project' && movingNode.docId !== state.activeId) ||
                moveNodeFiltersActive() || !state.documents.some(doc => doc.id === movingNode.docId && findNode(movingNode.nodeId, doc.nodes)))) {
                movingNode = null;
            }
            renderSidebar();
            const globalView = currentView === 'starred' || currentView === 'priority' || currentView === 'tag';
            const endlessView = currentView === 'endless';
            const dashboardView = currentView === 'dashboard';
            const agendaView = currentView === 'agenda';
            const trackerView = currentView === 'shared-tracker';
            const supplyView = currentView === 'supply';
            const projectView = !(globalView || endlessView || dashboardView || agendaView || trackerView || supplyView);
            document.getElementById('topbar-crumb').hidden = projectView;
            document.getElementById('project-zoom-breadcrumbs').hidden = !projectView;
            if (!projectView) document.getElementById('project-menu').open = false;
            const pmAction = document.getElementById('add-pm-template');
            pmAction.hidden = !projectView || !state.settings.pmEnabled;
            pmAction.querySelector('.pm-action-label').textContent = isPMProject(activeDocument()) ? 'Remove PM status' : 'Add PM status';
            document.getElementById('project-content').hidden = !projectView;
            document.getElementById('starred-content').hidden = !globalView;
            document.getElementById('endless-content').hidden = !endlessView;
            document.getElementById('dashboard-content').hidden = !dashboardView;
            document.getElementById('agenda-content').hidden = !agendaView;
            document.getElementById('shared-tracker').hidden = !trackerView;
            document.getElementById('supply').hidden = !supplyView;
            if (trackerView) {
                document.getElementById('crumb-space').textContent = 'Shared workspace';
                document.getElementById('crumb-title').textContent = 'PlanBraid PM';
                return;
            }
            if (supplyView) {
                document.getElementById('crumb-space').textContent = 'Shared workspace';
                document.getElementById('crumb-title').textContent = 'PlanBraid Supply';
                return;
            }
            if (agendaView) {
                document.getElementById('crumb-space').textContent = 'All spaces';
                document.getElementById('crumb-title').textContent = 'Scratchpad';
                renderAgendaNotes();
                return;
            }
            if (dashboardView) {
                document.getElementById('crumb-space').textContent = 'All spaces';
                document.getElementById('crumb-title').textContent = 'Dashboard';
                renderDashboard();
                return;
            }
            if (globalView) {
                document.getElementById('crumb-space').textContent = 'All spaces';
                document.getElementById('crumb-title').textContent = currentView === 'tag' ? selectedTag : currentView === 'priority' ? 'Priority' : 'Starred';
                renderGlobalNotes(currentView);
                return;
            }
            if (endlessView) {
                document.getElementById('crumb-space').textContent = 'All spaces';
                document.getElementById('crumb-title').textContent = 'Continuum';
                renderEndless();
                restoreOutlineFocus();
                return;
            }
            const doc = activeDocument();
            if (zoomDocumentId !== doc.id || (zoomNodeId && !findNode(zoomNodeId, doc.nodes))) {
                zoomNodeId = null;
                zoomDocumentId = null;
            }
            renderZoomBreadcrumbs(document.getElementById('project-zoom-breadcrumbs'), doc);
            document.getElementById('doc-title').textContent = doc.title;
            renderProjectAgendaCount(doc);
            document.getElementById('doc-subtitle').value = doc.subtitle;
            renderProjectFields(doc);
            renderPMProjectHeader(doc);
            const separateTasksVisible = state.settings.pmEnabled && state.settings.pmSeparateTasksEnabled && isPMProject(doc);
            const pmBoardActive = state.settings.pmEnabled && state.settings.pmBoardEnabled && isPMProject(doc) &&
                (separateTasksVisible || state.settings.pmProgressPanelEnabled) && pmBoardViewDocuments.has(doc.id);
            document.getElementById('pm-board-view').hidden = !pmBoardActive || separateTasksVisible;
            if (focusRequest) collapsedProjectOutlines.delete(doc.id);
            const outlineCollapsed = state.settings.projectOutlineCollapseEnabled && collapsedProjectOutlines.has(doc.id);
            const outlineToggle = document.getElementById('project-outline-toggle');
            const outlineTitle = document.getElementById('project-outline-title');
            const outlineAction = outlineCollapsed ? 'Expand project outline' : 'Collapse project outline';
            outlineToggle.setAttribute('aria-expanded', String(!outlineCollapsed));
            outlineToggle.setAttribute('aria-label', outlineAction);
            outlineToggle.title = outlineAction;
            outlineTitle.setAttribute('aria-expanded', String(!outlineCollapsed));
            outlineToggle.hidden = !state.settings.projectOutlineCollapseEnabled;
            outlineTitle.disabled = !state.settings.projectOutlineCollapseEnabled;
            document.getElementById('outline').hidden = outlineCollapsed;
            outlineToggle.onclick = () => {
                if (collapsedProjectOutlines.has(doc.id)) collapsedProjectOutlines.delete(doc.id);
                else collapsedProjectOutlines.add(doc.id);
                render();
                outlineToggle.focus();
            };
            outlineTitle.onclick = () => {
                if (collapsedProjectOutlines.has(doc.id)) collapsedProjectOutlines.delete(doc.id);
                else collapsedProjectOutlines.add(doc.id);
                render();
                outlineTitle.focus();
            };
            document.getElementById('project-agenda-content').hidden = !state.settings.agendaNotesEnabled;
            document.getElementById('crumb-space').textContent = state.spaces.find(space => space.id === doc.spaceId).name;
            document.getElementById('crumb-title').textContent = doc.title;
            document.getElementById('priority-filter').value = priorityFilter;
            document.getElementById('starred-filter').checked = activeFilter === 'starred';
            const showCompleted = completedFilter === 'show';
            const completedAction = showCompleted ? 'Hide completed notes' : 'Show completed notes';
            document.querySelector('#completed-filter .completed-filter-label').textContent = showCompleted ? 'Hide completed' : 'Show completed';
            const completedToggle = document.getElementById('project-completed-toggle');
            completedToggle.setAttribute('aria-label', completedAction);
            completedToggle.title = completedAction;
            completedToggle.querySelector('.completed-eye-open').hidden = !showCompleted;
            completedToggle.querySelector('.completed-eye-closed').hidden = showCompleted;
            const filterCount = Number(priorityFilter !== 'all') + Number(activeFilter === 'starred') + Number(completedFilter === 'hide');
            document.getElementById('project-filter-count').textContent = filterCount ? String(filterCount) : '';
            const projectMenuSummary = document.getElementById('project-menu-summary');
            projectMenuSummary.setAttribute('aria-label', `Project menu${filterCount ? `, ${filterCount} active ${filterCount === 1 ? 'filter' : 'filters'}` : ''}`);
            projectMenuSummary.title = projectMenuSummary.getAttribute('aria-label');
            document.getElementById('outline').replaceChildren();
            const roots = zoomNodeId ? [findNode(zoomNodeId, doc.nodes).node] : doc.nodes;
            const filteredExpansion = branchesExpandedForFilter();
            document.getElementById('project-expand-all').disabled = filteredExpansion;
            document.getElementById('project-collapse-all').disabled = filteredExpansion;
            document.getElementById('project-expand-hint').hidden = !filteredExpansion;
            if ((priorityFilter !== 'all' || completedFilter === 'hide') && !roots.some(hasMatchingNode)) {
                document.getElementById('outline').innerHTML = '<div class="empty-state">No notes match the current filters.</div>';
            } else if (activeFilter === 'starred' && !roots.some(hasStarred)) {
                document.getElementById('outline').innerHTML = '<div class="empty-state">No starred notes in this document yet. Use the note menu to star one.</div>';
            } else if (!doc.nodes.length) {
                document.getElementById('outline').innerHTML = '<div class="empty-state">This page is ready for its first thought.<button onclick="addRootNode()">Add a note</button></div>';
            } else {
                const list = document.createElement('div');
                list.className = 'outline-list';
                visibleNodes(roots).forEach(node => list.appendChild(renderNode(node, doc)));
                document.getElementById('outline').appendChild(list);
            }
            if (pmBoardActive && !separateTasksVisible) renderPMBoard(doc);
            document.getElementById('pm-separate-tasks').hidden = !separateTasksVisible;
            if (separateTasksVisible) renderSeparatePMTasks(doc);
            if (state.settings.agendaNotesEnabled) renderAgendaCards();
            restoreOutlineFocus();
        }
        function restoreOutlineFocus() {
            if (focusRequest) {
                const request = focusRequest;
                focusRequest = null;
                requestAnimationFrame(() => {
                    const scope = currentView === 'endless' ? document.querySelector(`.endless-project[data-doc-id="${CSS.escape(state.activeId)}"]`) : document.getElementById('outline');
                    const editor = scope?.querySelector(`[data-node-id="${CSS.escape(request.id)}"] .node-text`);
                    if (!editor) return;
                    editor.focus();
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(editor);
                    range.collapse(!request.end);
                    selection.removeAllRanges();
                    selection.addRange(range);
                });
            }
        }
        function setEditingDocument(doc) {
            if (state.activeId !== doc.id) {
                state.activeId = doc.id;
                scheduleSave();
            }
        }
        function renderSidebar() {
            const list = document.getElementById('spaces-list');
            list.replaceChildren();
            state.spaces.forEach(space => {
                const group = document.createElement('section');
                group.className = 'space-group';
                const header = document.createElement('div');
                header.className = 'space-header';
                const toggle = document.createElement('button');
                toggle.className = 'space-toggle';
                const collapsed = collapsedSpaces.has(space.id);
                toggle.setAttribute('aria-expanded', String(!collapsed));
                toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} space ${space.name}`);
                toggle.title = space.name;
                const arrow = createIcon(collapsed ? 'chevron-right' : 'chevron-down');
                const name = document.createElement('span');
                name.className = 'space-name';
                name.textContent = space.name;
                toggle.append(arrow, name);
                toggle.onclick = () => {
                    if (collapsedSpaces.has(space.id)) collapsedSpaces.delete(space.id);
                    else collapsedSpaces.add(space.id);
                    renderSidebar();
                };
                const addProject = document.createElement('button');
                addProject.className = 'small-icon-btn';
                addProject.appendChild(createIcon('plus'));
                addProject.title = `Create project in ${space.name}`;
                addProject.setAttribute('aria-label', addProject.title);
                addProject.onclick = () => createDocument(space.id);
                const spaceMenu = createSidebarMenu(`Space menu for ${space.name}`, [
                    ...(state.settings.templatesEnabled || state.settings.pmEnabled ? [{ label: 'Create from template', action: () => createFromTemplate(space.id) }] : []),
                    { label: 'Rename space', action: () => renameSpace(space.id) },
                    { label: 'Delete space', className: 'delete-space', action: () => deleteSpace(space.id) }
                ]);
                header.append(toggle, addProject, spaceMenu);
                group.appendChild(header);
                if (!collapsed) {
                    const projects = document.createElement('div');
                    projects.className = 'doc-list space-projects';
                    const docs = state.documents.filter(doc => doc.spaceId === space.id);
                    if (!docs.length) {
                        const empty = document.createElement('div');
                        empty.className = 'space-empty';
                        empty.textContent = 'No projects yet';
                        projects.appendChild(empty);
                    }
                    docs.forEach(doc => {
                        const button = document.createElement('button');
                        button.className = `doc-item${doc.id === state.activeId && currentView === 'project' ? ' active' : ''}`;
                        button.innerHTML = `<span class="nav-glyph" aria-hidden="true"></span><span class="doc-name"></span><span class="doc-count">${countNodes(doc.nodes)}</span>`;
                        button.querySelector('.nav-glyph').appendChild(createIcon('document'));
                        button.querySelector('.doc-name').textContent = doc.title;
                        button.title = `${space.name} / ${doc.title}`;
                        button.setAttribute('aria-label', `Open project ${doc.title} in ${space.name}`);
                        button.onclick = () => selectDocument(doc.id);
                        const row = document.createElement('div');
                        row.className = 'project-row';
                        const projectMenu = createSidebarMenu(`Project menu for ${doc.title} in ${space.name}`, [
                            { label: 'Rename project', action: summary => renameDocument(doc.id, summary) },
                            { label: 'Move to another space', disabled: state.spaces.length < 2, action: () => moveDocument(doc.id) },
                            { label: 'Delete project', className: 'delete-project', action: summary => deleteDocument(doc.id, summary) }
                        ]);
                        row.append(button, projectMenu);
                        projects.appendChild(row);
                    });
                    group.appendChild(projects);
                }
                list.appendChild(group);
            });
            document.getElementById('nav-dashboard').hidden = false;
            document.getElementById('nav-dashboard').classList.toggle('active', currentView === 'dashboard');
            document.getElementById('nav-shared-tracker').classList.toggle('active', currentView === 'shared-tracker');
            document.getElementById('nav-supply').classList.toggle('active', currentView === 'supply');
            document.getElementById('nav-agenda').hidden = !state.settings.agendaNotesEnabled;
            document.getElementById('nav-agenda').classList.toggle('active', currentView === 'agenda');
            document.getElementById('nav-all').hidden = !state.settings.sidebarAllNotes;
            document.getElementById('nav-all').classList.toggle('active', currentView === 'project');
            document.getElementById('nav-endless').hidden = false;
            document.getElementById('nav-endless').classList.toggle('active', currentView === 'endless');
            document.getElementById('nav-starred').hidden = !state.settings.sidebarStarred;
            document.getElementById('nav-starred').classList.toggle('active', currentView === 'starred');
            document.getElementById('nav-priority').hidden = !state.settings.priorityEnabled || !state.settings.sidebarPriority;
            document.getElementById('nav-priority').classList.toggle('active', currentView === 'priority');
            document.getElementById('all-count').textContent = state.documents.reduce((sum, doc) => sum + countNodes(doc.nodes), 0);
            document.getElementById('star-count').textContent = state.documents.reduce((sum, doc) => sum + allNodes(doc.nodes).filter(item => item.node.starred).length, 0);
            document.getElementById('priority-count').textContent = state.documents.reduce((sum, doc) => sum + allNodes(doc.nodes).filter(item => isActivePriority(item.node)).length, 0);
            renderTagSidebar();
        }
        function showAllNotes() {
            if (!closeAgendaEditor()) return;
            currentView = 'project';
            zoomNodeId = null;
            zoomDocumentId = null;
            activeFilter = 'all';
            render();
        }
        function createSidebarMenu(label, actions) {
            const menu = document.createElement('details');
            menu.className = 'sidebar-menu';
            const summary = document.createElement('summary');
            summary.className = 'small-icon-btn';
            summary.appendChild(createIcon('more'));
            summary.setAttribute('aria-label', label);
            summary.title = label;
            const list = document.createElement('div');
            list.className = 'sidebar-menu-list';
            actions.forEach(action => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = action.label;
                button.disabled = Boolean(action.disabled);
                if (action.className) button.className = action.className;
                if (action.disabled) button.title = 'Create another space first';
                button.onclick = () => { menu.open = false; action.action(summary); };
                list.appendChild(button);
            });
            summary.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-menu[open]').forEach(other => {
                    if (other !== menu) other.open = false;
                });
                const rect = summary.getBoundingClientRect();
                list.style.left = `${Math.max(8, Math.min(rect.right, window.innerWidth - 188))}px`;
                list.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - actions.length * 38 - 20))}px`;
            });
            menu.append(summary, list);
            return menu;
        }
        function createNodeActionIcon(paths) {
            const icon = document.createElement('span');
            icon.className = 'node-action-icon';
            icon.setAttribute('aria-hidden', 'true');
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            for (const shape of paths) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', shape);
                svg.appendChild(path);
            }
            icon.appendChild(svg);
            return icon;
        }
        function renderNode(node, doc = activeDocument()) {
            const wrapper = document.createElement('div');
            wrapper.className = 'outline-node';
            wrapper.dataset.nodeId = node.id;
            const row = document.createElement('div');
            row.className = `node-row${node.dueDate ? ' has-due' : ''}`;
            const filterExpanded = branchesExpandedForFilter() || (zoomNodeId === node.id && zoomDocumentId === doc.id);
            const branchLabel = node.collapsed && !filterExpanded ? 'Expand sub-notes' : 'Collapse sub-notes';
            const branchHint = zoomNodeId === node.id && zoomDocumentId === doc.id ? 'Zoomed note is expanded' : 'Branches expanded for active filters';
            const bullet = document.createElement('button');
            bullet.type = 'button';
            bullet.className = `bullet${node.completed ? ' done' : ''}${node.children.length && node.collapsed && !filterExpanded ? ' has-collapsed-children' : ''}`;
            if (node.completed) bullet.appendChild(createIcon('check'));
            else bullet.textContent = '•';
            bullet.title = !node.children.length ? 'No sub-notes' : filterExpanded ? branchHint : branchLabel;
            bullet.setAttribute('aria-label', bullet.title);
            if (node.children.length) bullet.setAttribute('aria-expanded', String(!node.collapsed || filterExpanded));
            bullet.disabled = !node.children.length || filterExpanded;
            bullet.onclick = () => toggleBranch('.bullet');
            const editor = document.createElement('div');
            editor.className = `node-text${node.completed ? ' completed' : ''}`;
            editor.contentEditable = 'true';
            editor.setAttribute('role', 'textbox');
            editor.setAttribute('aria-label', 'Outline note');
            editor.setAttribute('spellcheck', 'true');
            editor.dataset.nodeId = node.id;
            if (node.highlight !== 'none') editor.dataset.highlight = node.highlight;
            if (node.heading !== 'none') editor.dataset.heading = node.heading;
            editor.textContent = node.text;
            editor.oninput = () => {
                node.text = editor.innerText.replace(/\n$/, '');
                markNodeEdited(node);
                scheduleSave();
                if (state.settings.tagsEnabled) renderTagSidebar();
            };
            editor.onkeydown = event => handleNodeKeydown(event, node.id);
            editor.onblur = () => {
                const cleanText = editor.innerText.replace(/\n$/, '');
                if (cleanText !== node.text) { node.text = cleanText; markNodeEdited(node); scheduleSave(); }
            };
            const menu = document.createElement('details');
            menu.className = 'node-menu';
            const menuButton = document.createElement('summary');
            menuButton.tabIndex = 0;
            menuButton.appendChild(createIcon('more'));
            const priorityMarker = document.createElement('span');
            priorityMarker.className = 'node-priority-marker';
            const menuContent = document.createElement('div');
            menuContent.className = 'priority-menu';
            function closeNodeMenuAfterAction() {
                menu.open = false;
                menuButton.focus();
            }
            const menuLabel = document.createElement('div');
            menuLabel.className = 'priority-menu-label';
            menuLabel.textContent = 'Priority';
            const priorities = [
                ['none', 'No priority', '–'],
                ['low', 'Low', '!'],
                ['medium', 'Medium', '!!'],
                ['high', 'High', '!!!']
            ];
            const priorityChoices = document.createElement('div');
            priorityChoices.className = 'priority-choices';
            priorityChoices.setAttribute('role', 'group');
            priorityChoices.setAttribute('aria-label', 'Priority');
            if (state.settings.priorityEnabled) menuContent.append(menuLabel, priorityChoices);
            function updatePriorityMenu() {
                const current = priorities.find(([value]) => value === (state.settings.priorityEnabled ? (node.priority || 'none') : 'none'));
                menuButton.dataset.priority = current[0];
                menuButton.setAttribute('aria-label', !state.settings.priorityEnabled ? 'Node menu' : current[0] === 'none' ? 'Node menu, no priority' : `Node menu, ${current[1]} priority`);
                menuButton.title = !state.settings.priorityEnabled ? 'Node menu' : current[0] === 'none' ? 'Node menu: no priority' : `Node menu: ${current[1]} priority`;
                priorityMarker.hidden = current[0] === 'none';
                priorityMarker.dataset.priority = current[0];
                priorityMarker.textContent = current[2];
                priorityMarker.setAttribute('aria-label', `${current[1]} priority`);
                priorityChoices.querySelectorAll('[data-priority]').forEach(button => {
                    button.setAttribute('aria-pressed', String(button.dataset.priority === current[0]));
                });
            }
            priorities.forEach(([value, label, mark]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'priority-choice';
                button.dataset.priority = value;
                button.setAttribute('aria-label', label);
                button.title = value === 'none' ? label : `${label} priority`;
                const icon = document.createElement('span');
                icon.className = `priority-mark ${value}`;
                icon.textContent = mark;
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);
                button.onclick = () => {
                    if (node.priority !== value) markNodeEdited(node);
                    node.priority = value;
                    updatePriorityMenu();
                    scheduleSave();
                    if (priorityFilter !== 'all') {
                        render();
                    } else { closeNodeMenuAfterAction(); renderSidebar(); }
                };
                priorityChoices.appendChild(button);
            });
            const highlightLabel = document.createElement('div');
            highlightLabel.className = 'priority-menu-label';
            highlightLabel.textContent = 'Highlight';
            const highlightOptions = document.createElement('div');
            highlightOptions.className = 'highlight-options';
            highlightOptions.setAttribute('role', 'group');
            highlightOptions.setAttribute('aria-label', 'Highlight color');
            ['none', 'yellow', 'green', 'blue', 'pink'].forEach(color => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'highlight-option';
                button.dataset.color = color;
                button.setAttribute('aria-label', color === 'none' ? 'No highlight' : `${color[0].toUpperCase()}${color.slice(1)} highlight`);
                button.setAttribute('aria-pressed', String(node.highlight === color));
                button.onclick = () => {
                    if (node.highlight !== color) {
                        node.highlight = color;
                        markNodeEdited(node);
                        scheduleSave();
                    }
                    if (color === 'none') delete editor.dataset.highlight;
                    else editor.dataset.highlight = color;
                    highlightOptions.querySelectorAll('button').forEach(option => {
                        option.setAttribute('aria-pressed', String(option.dataset.color === color));
                    });
                    closeNodeMenuAfterAction();
                };
                highlightOptions.appendChild(button);
            });
            menuContent.append(highlightLabel, highlightOptions);
            const headingLabel = document.createElement('div');
            headingLabel.className = 'priority-menu-label';
            headingLabel.textContent = 'Text size';
            const headingOptions = document.createElement('div');
            headingOptions.className = 'heading-options';
            headingOptions.setAttribute('role', 'group');
            headingOptions.setAttribute('aria-label', 'Text size');
            [['none', 'Normal'], ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3']].forEach(([value, label]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'heading-option';
                button.textContent = label;
                button.setAttribute('aria-label', value === 'none' ? 'Normal text' : `Heading ${value.slice(1)}`);
                button.setAttribute('aria-pressed', String(node.heading === value));
                button.onclick = () => {
                    if (node.heading !== value) {
                        node.heading = value;
                        markNodeEdited(node);
                        scheduleSave();
                    }
                    if (value === 'none') delete editor.dataset.heading;
                    else editor.dataset.heading = value;
                    headingOptions.querySelectorAll('button').forEach(option => {
                        option.setAttribute('aria-pressed', String(option === button));
                    });
                    closeNodeMenuAfterAction();
                };
                headingOptions.appendChild(button);
            });
            menuContent.append(headingLabel, headingOptions);
            const menuActions = document.createElement('div');
            menuActions.className = 'node-menu-actions';
            const actionLabel = (button, label, paths) => {
                button.replaceChildren(createNodeActionIcon(paths), document.createTextNode(label));
            };
            const icons = {
                add: ['M12 5v14M5 12h14'],
                move: ['M5 7h14M5 7l4-4M5 7l4 4', 'M19 17H5m14 0-4-4m4 4-4 4'],
                branch: ['M6 9l6 6 6-6'],
                zoom: ['M13 5h6v6M19 5l-8 8', 'M19 14v5H5V5h5'],
                reminder: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
                simple: ['M5 4h14v16H5z', 'M8 9h8M8 13h8M8 17h5'],
                due: ['M4 6h16v14H4z', 'M8 3v6M16 3v6M4 10h16'],
                star: ['m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9z'],
                progress: ['M4 18V6M4 18h16', 'M8 15v-4M12 15V8M16 15v-6'],
                delete: ['M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5']
            };
            const addAction = document.createElement('button');
            addAction.type = 'button';
            addAction.className = 'priority-option';
            actionLabel(addAction, 'Add a sub-note', icons.add);
            addAction.setAttribute('aria-label', 'Add a sub-note');
            addAction.onclick = () => addChild(node.id);
            const siblingAction = document.createElement('button');
            siblingAction.type = 'button';
            siblingAction.className = 'priority-option';
            actionLabel(siblingAction, 'Add a note at this level', icons.add);
            siblingAction.setAttribute('aria-label', 'Add a sibling note');
            siblingAction.onclick = () => {
                menu.open = false;
                addSibling(node.id);
            };
            function toggleBranch(focusSelector) {
                if (filterExpanded) return;
                node.collapsed = !node.collapsed;
                scheduleSave();
                render();
                document.querySelector(`[data-node-id="${CSS.escape(node.id)}"] > .node-row ${focusSelector}`)?.focus();
            }
            const branchAction = document.createElement('button');
            branchAction.type = 'button';
            branchAction.className = 'priority-option';
            actionLabel(branchAction, branchLabel, icons.branch);
            branchAction.disabled = filterExpanded;
            if (filterExpanded) branchAction.title = branchHint;
            branchAction.onclick = () => toggleBranch('.node-menu summary');
            const zoomAction = document.createElement('button');
            zoomAction.type = 'button';
            zoomAction.className = 'priority-option';
            actionLabel(zoomAction, 'Zoom into note', icons.zoom);
            zoomAction.onclick = () => zoomIntoNode(doc, node);
            const moveAction = document.createElement('button');
            moveAction.type = 'button';
            moveAction.className = 'priority-option';
            actionLabel(moveAction, 'Move under…', icons.move);
            moveAction.setAttribute('aria-label', 'Move note under another note');
            moveAction.onclick = () => {
                menu.open = false;
                showMoveNodeDialog(doc, node.id, menuButton);
            };
            const moveArrowsAction = document.createElement('button');
            moveArrowsAction.type = 'button';
            moveArrowsAction.className = 'priority-option';
            actionLabel(moveArrowsAction, 'Move with arrows', icons.move);
            moveArrowsAction.onclick = () => {
                if (moveNodeFiltersActive()) {
                    showToast('Clear outline filters before moving a note with arrows.');
                    return;
                }
                movingNode = { docId: doc.id, nodeId: node.id, view: currentView, zoomId: zoomNodeId };
                render();
                focusMovingNode(doc, node.id, 'done');
            };
            const completeAction = document.createElement('button');
            completeAction.type = 'button';
            completeAction.className = 'priority-option';
            completeAction.dataset.completeNode = 'true';
            const updateCompleteAction = () => {
                actionLabel(completeAction, node.completed ? 'Reopen note' : 'Mark completed', ['M5 12l4 4L19 6']);
                completeAction.disabled = node.progressNode;
                completeAction.title = node.progressNode ? 'Completion is calculated from sub-notes' : '';
                completeAction.setAttribute('aria-pressed', String(node.completed));
            };
            updateCompleteAction();
            completeAction.onclick = () => {
                if (!toggleNodeCompletion(node)) return;
                menu.open = false;
                scheduleSave();
                render();
                document.querySelector(`[data-node-id="${CSS.escape(node.id)}"] > .node-row .node-menu summary`)?.focus();
            };
            const simpleAction = document.createElement('button');
            simpleAction.type = 'button';
            simpleAction.className = 'priority-option';
            simpleAction.dataset.opensDialog = 'true';
            actionLabel(simpleAction, node.description || node.descriptionHtml ? 'Edit simple note' : 'Add simple note', icons.simple);
            simpleAction.onclick = () => {
                menu.open = false;
                if (noteHasFormatting(node)) {
                    editFullSimpleNote(node.id, details.querySelector('.node-description'));
                    return;
                }
                showSimpleNoteEditor();
            };
            const dueAction = document.createElement('button');
            dueAction.type = 'button';
            dueAction.className = 'priority-option';
            dueAction.dataset.opensDialog = 'true';
            actionLabel(dueAction, node.dueDate ? 'Edit due date' : 'Add due date', icons.due);
            dueAction.onclick = () => { menu.open = false; editNodeMetadata(node.id, 'dueDate'); };
            const reminderAction = document.createElement('button');
            reminderAction.type = 'button';
            reminderAction.className = 'priority-option';
            actionLabel(reminderAction, node.reminderAt ? 'Edit reminder…' : 'Set reminder…', icons.reminder);
            reminderAction.setAttribute('aria-label', node.reminderAt ? 'Edit reminder' : 'Set reminder');
            reminderAction.onclick = () => {
                menu.open = false;
                showReminderDialog(doc, node.id, menuButton);
            };
            const starAction = document.createElement('button');
            starAction.type = 'button';
            starAction.className = 'priority-option';
            const starMark = document.createElement('span');
            starMark.className = 'node-star';
            starMark.appendChild(createIcon('star', true));
            starMark.setAttribute('role', 'img');
            starMark.setAttribute('aria-label', 'Starred note');
            starMark.title = 'Starred note';
            const updateStarAction = () => {
                actionLabel(starAction, node.starred ? 'Remove star' : 'Star note', icons.star);
                starAction.setAttribute('aria-label', node.starred ? 'Remove star' : 'Star note');
                starMark.hidden = !node.starred;
            };
            updateStarAction();
            starAction.onclick = () => {
                node.starred = !node.starred;
                markNodeEdited(node);
                scheduleSave();
                if (activeFilter === 'starred' && !node.starred) {
                    render();
                } else {
                    updateStarAction();
                    closeNodeMenuAfterAction();
                }
            };
            const deleteAction = document.createElement('button');
            deleteAction.type = 'button';
            deleteAction.className = 'priority-option delete-option';
            deleteAction.dataset.opensDialog = 'true';
            actionLabel(deleteAction, 'Delete note', icons.delete);
            deleteAction.setAttribute('aria-label', 'Delete note');
            deleteAction.onclick = () => {
                menu.open = false;
                confirmDeleteNode(node.id, menuButton);
            };
            const progressAction = document.createElement('button');
            progressAction.type = 'button';
            progressAction.className = 'priority-option';
            actionLabel(progressAction, node.progressNode ? 'Remove progress node' : 'Make progress node', icons.progress);
            progressAction.disabled = Boolean(node.pmTask) && !node.progressNode;
            if (progressAction.disabled) progressAction.title = 'Remove the PM task status first.';
            progressAction.onclick = () => {
                node.progressNode = !node.progressNode;
                markNodeEdited(node);
                scheduleSave();
                render();
                document.querySelector(`[data-node-id="${CSS.escape(node.id)}"] > .node-row .node-menu summary`)?.focus();
            };
            const showOutlinePMActions = state.settings.pmEnabled && isPMProject(doc) && !state.settings.pmSeparateTasksEnabled;
            if (showOutlinePMActions) {
                const pmActions = document.createElement('div');
                pmActions.className = 'pm-node-menu-actions';
                pmActions.setAttribute('role', 'group');
                pmActions.setAttribute('aria-label', 'Project management');
                appendPMNodeActions(pmActions, doc, node, () => { menu.open = false; }, actionLabel, dueAction);
                menuContent.prepend(pmActions);
            }
            if (node.children.length) menuActions.appendChild(branchAction);
            if (state.settings.nodeZoomEnabled) menuActions.appendChild(zoomAction);
            menuActions.append(siblingAction, addAction, moveAction, moveArrowsAction, completeAction, simpleAction);
            if (!showOutlinePMActions) menuActions.append(dueAction);
            if (state.settings.remindersEnabled && node.dueDate) menuActions.appendChild(reminderAction);
            menuActions.append(starAction, progressAction, deleteAction);
            menuContent.appendChild(menuActions);
            const stamps = document.createElement('div');
            stamps.className = 'node-stamps';
            const createdStamp = document.createElement('div');
            createdStamp.textContent = `Created: ${formatNodeTimestamp(node.createdAt)}`;
            const editedStamp = document.createElement('div');
            editedStamp.textContent = `Edited: ${formatNodeTimestamp(node.editedAt)}`;
            stamps.append(createdStamp, editedStamp);
            menuContent.appendChild(stamps);
            menuButton.onclick = () => {
                editedStamp.textContent = `Edited: ${formatNodeTimestamp(node.editedAt)}`;
                document.querySelectorAll('.node-menu[open]').forEach(other => {
                    if (other !== menu) other.open = false;
                });
            };
            menu.append(menuButton, menuContent);
            menu.addEventListener('toggle', () => {
                if (!menu.open) return;
                menuContent.style.left = '0px';
                menuContent.style.top = '28px';
                const rect = menuContent.getBoundingClientRect();
                const viewport = window.visualViewport;
                const left = viewport ? viewport.offsetLeft : 0;
                const right = left + (viewport ? viewport.width : document.documentElement.clientWidth);
                const adjustment = rect.right > right - 8 ? right - 8 - rect.right : Math.max(0, left + 8 - rect.left);
                menuContent.style.left = `${adjustment}px`;
                const top = viewport ? viewport.offsetTop : 0;
                const bottom = top + (viewport ? viewport.height : window.innerHeight);
                const vertical = rect.bottom > bottom - 8 ? bottom - 8 - rect.bottom : Math.max(0, top + 8 - rect.top);
                menuContent.style.top = `${28 + vertical}px`;
            });
            updatePriorityMenu();
            const content = document.createElement('div');
            content.className = 'node-content';
            const textLine = document.createElement('div');
            textLine.className = 'node-text-line';
            textLine.appendChild(editor);
            const metadata = document.createElement('div');
            metadata.className = 'node-info';
            if (state.settings.pmEnabled && isPMProject(doc)) appendPMNodeBadges(metadata, doc, node, content);
            if (node.progressNode) {
                const progress = document.createElement('span');
                progress.className = 'node-progress';
                progress.textContent = progressLabel(descendantProgress(node));
                progress.setAttribute('aria-label', `Sub-node progress: ${progress.textContent}`);
                metadata.appendChild(progress);
            }
            if (node.dueDate) {
                const due = document.createElement('span');
                due.className = 'node-due';
                due.textContent = `Due ${node.dueDate}`;
                metadata.appendChild(due);
                if (state.settings.remindersEnabled && node.reminderAt) {
                    const reminder = document.createElement('span');
                    reminder.className = 'node-reminder';
                    reminder.textContent = 'Reminder set';
                    reminder.title = `Reminder: ${new Date(node.reminderAt).toLocaleString()}`;
                    metadata.appendChild(reminder);
                }
            }
            if (state.settings.pmEnabled && isPMProject(doc)) appendPMTaskBadge(textLine, node);
            content.prepend(textLine, metadata);
            const details = document.createElement('div');
            details.className = 'node-details';
            function showNotePreview() {
                details.replaceChildren();
                if (!node.description && !node.descriptionHtml) {
                    details.remove();
                    return;
                }
                const description = document.createElement('button');
                description.type = 'button';
                description.className = 'node-description';
                description.textContent = node.description.split(/\r?\n/).find(line => line.trim())?.trim() || (node.descriptionHtml.includes('data-checklist="true"') ? 'Checklist' : 'Table');
                const action = 'View note (read-only)';
                description.setAttribute('aria-label', `${action}: ${description.textContent}`);
                description.title = action;
                description.onclick = () => viewNote(node.id, description);
                details.appendChild(description);
                content.appendChild(details);
            }
            function showSimpleNoteEditor() {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'simple-note-input';
                input.setAttribute('aria-label', 'Simple note, first line');
                input.placeholder = 'Add a simple note...';
                const lineEnd = node.description.search(/[\r\n]/);
                const suffix = lineEnd < 0 ? '' : node.description.slice(lineEnd);
                input.value = lineEnd < 0 ? node.description : node.description.slice(0, lineEnd);
                details.replaceChildren(input);
                content.appendChild(details);
                input.addEventListener('input', () => {
                    const value = input.value + suffix;
                    if (value !== node.description) {
                        node.description = value;
                        node.descriptionHtml = '';
                        markNodeEdited(node);
                        scheduleSave();
                        if (state.settings.tagsEnabled) renderTagSidebar();
                    }
                });
                input.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        input.blur();
                    }
                });
                input.addEventListener('blur', () => {
                    actionLabel(simpleAction, node.description ? 'Edit simple note' : 'Add simple note', icons.simple);
                    showNotePreview();
                });
                input.focus();
            }
            showNotePreview();
            if (movingNode?.docId === doc.id && movingNode.nodeId === node.id) {
                const controls = document.createElement('div');
                controls.className = 'node-move-controls';
                controls.setAttribute('role', 'group');
                controls.setAttribute('aria-label', `Move ${node.text.trim() || 'untitled note'}`);
                for (const [direction, icon, label] of [['up', 'arrow-up', 'Move up'], ['down', 'arrow-down', 'Move down'], ['done', 'check', 'Finish moving']]) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.dataset.moveDirection = direction;
                    button.appendChild(createIcon(icon));
                    button.setAttribute('aria-label', label);
                    button.title = label;
                    if (direction === 'done') {
                        button.onclick = () => {
                            movingNode = null;
                            render();
                            focusMovingNode(doc, node.id, 'menu');
                        };
                    } else {
                        button.disabled = !findMoveNeighbor(doc, node.id, direction);
                        button.onclick = () => moveNodeWithArrow(doc, node.id, direction);
                    }
                    controls.appendChild(button);
                }
                row.appendChild(controls);
            }
            row.appendChild(menu);
            row.append(bullet, priorityMarker, starMark, content);
            wrapper.appendChild(row);
            if (node.children.length) {
                const children = document.createElement('div');
                children.className = `node-children${node.collapsed && !filterExpanded ? ' collapsed' : ''}`;
                visibleNodes(node.children).forEach(child => children.appendChild(renderNode(child, doc)));
                wrapper.appendChild(children);
            }
            return wrapper;
        }
        function setFilter(filter) {
            activeFilter = filter;
            render();
        }
        function editNodeMetadata(id, field) {
            const location = findNode(id);
            if (!location) return;
            const node = location.node;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="node-metadata-title">
                        <h2 id="node-metadata-title">Due date</h2>
                        <form class="node-metadata-form">
                            <label for="node-metadata-value">Due date</label>
                            <input id="node-metadata-value" type="date">
                            <div class="space-form-actions"><button type="button" class="cancel-metadata">Cancel</button><button type="submit" class="create-space">Save</button></div>
                        </form>
                    </section>
                </div>`;
            const input = root.querySelector('#node-metadata-value');
            input.value = node[field] || '';
            root.querySelector('.cancel-metadata').onclick = closeModal;
            root.querySelector('form').onsubmit = event => {
                event.preventDefault();
                if (node[field] !== input.value) {
                    const reminderCleared = field === 'dueDate' && Boolean(node.reminderAt);
                    node[field] = input.value;
                    if (field === 'dueDate' && node.reminderAt) {
                        node.reminderAt = '';
                        node.reminderNotifiedAt = '';
                    }
                    markNodeEdited(node);
                    scheduleSave();
                    if (reminderCleared) showToast('Reminder cleared because the due date changed.');
                }
                closeModal();
                render();
                document.querySelector(`[data-node-id="${CSS.escape(id)}"] > .node-row .node-menu summary`)?.focus();
            };
            input.focus();
        }
        function selectDocument(id) {
            if (!closeAgendaEditor()) return;
            currentView = 'project';
            zoomNodeId = null;
            zoomDocumentId = null;
            state.activeId = id;
            activeFilter = 'all';
            priorityFilter = 'all';
            completedFilter = 'show';
            setSearchOpen(false);
            scheduleSave();
            render();
        }
        function createSpace() {
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="space-dialog-title">
                        <h2 id="space-dialog-title">Create a space</h2>
                        <p>Group related projects together in a space.</p>
                        <form class="space-form">
                            <input name="name" aria-label="Space name" maxlength="100" placeholder="Space name" required>
                            <div class="space-form-actions"><button type="button" class="cancel-space">Cancel</button><button type="submit" class="create-space">Create space</button></div>
                        </form>
                    </section>
                </div>`;
            const form = root.querySelector('form');
            const input = form.elements.name;
            root.querySelector('.cancel-space').onclick = closeModal;
            form.onsubmit = event => {
                event.preventDefault();
                const name = input.value.trim();
                if (!name) {
                    input.setCustomValidity('Enter a space name.');
                    input.reportValidity();
                    return;
                }
                state.spaces.push({ id: makeId(), name });
                closeModal();
                scheduleSave();
                renderSidebar();
            };
            input.oninput = () => input.setCustomValidity('');
            input.focus();
        }
        function renameSpace(id) {
            const space = state.spaces.find(item => item.id === id);
            if (!space) return;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="rename-space-title">
                        <h2 id="rename-space-title">Rename space</h2>
                        <form class="space-form">
                            <input name="name" aria-label="Space name" maxlength="100" required>
                            <div class="space-form-actions"><button type="button" class="cancel-space">Cancel</button><button type="submit" class="create-space">Save</button></div>
                        </form>
                    </section>
                </div>`;
            const form = root.querySelector('form');
            const input = form.elements.name;
            input.value = space.name;
            root.querySelector('.cancel-space').onclick = closeModal;
            input.oninput = () => input.setCustomValidity('');
            form.onsubmit = event => {
                event.preventDefault();
                const name = input.value.trim();
                if (!name) {
                    input.setCustomValidity('Enter a space name.');
                    input.reportValidity();
                    return;
                }
                space.name = name;
                closeModal();
                scheduleSave();
                render();
                searchNotes(document.getElementById('search-input').value);
            };
            input.focus();
            input.select();
        }
        function deleteSpace(id) {
            const space = state.spaces.find(item => item.id === id);
            if (!space) return;
            const count = state.documents.filter(doc => doc.spaceId === id).length;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-space-title">
                        <h2 id="delete-space-title">Delete space?</h2>
                        <p class="delete-space-message"></p>
                        <div class="space-form-actions"><button type="button" class="cancel-space">Cancel</button><button type="button" class="create-space delete-space-confirm">Delete space</button></div>
                    </section>
                </div>`;
            const replacement = state.documents.length === count
                ? (state.spaces.length === 1 ? ' A new empty space and project will be created.' : ' A new empty project will be created in another space.')
                : '';
            root.querySelector('.delete-space-message').textContent = `Delete "${space.name}" and its ${count} project${count === 1 ? '' : 's'}, including all their notes? This cannot be undone.${replacement}`;
            root.querySelector('.cancel-space').onclick = closeModal;
            root.querySelector('.delete-space-confirm').onclick = () => {
                if (state.documents.some(doc => doc.id === state.activeId && doc.spaceId === id) && !closeAgendaEditor()) return;
                state.spaces = state.spaces.filter(item => item.id !== id);
                state.documents = state.documents.filter(doc => doc.spaceId !== id);
                detachAgendaProjects();
                collapsedSpaces.delete(id);
                if (!state.spaces.length) state.spaces.push({ id: makeId(), name: 'My space' });
                if (!state.documents.length) state.documents.push(newDocument(state.spaces[0].id));
                if (!state.documents.some(doc => doc.id === state.activeId)) {
                    state.activeId = state.documents[0].id;
                    activeFilter = 'all';
                    priorityFilter = 'all';
                    completedFilter = 'show';
                    collapsedSpaces.delete(state.documents[0].spaceId);
                }
                closeModal();
                scheduleSave();
                render();
                searchNotes(document.getElementById('search-input').value);
            };
            root.querySelector('.cancel-space').focus();
        }
        function moveDocument(id) {
            const doc = state.documents.find(item => item.id === id);
            if (!doc) return;
            const targets = state.spaces.filter(space => space.id !== doc.spaceId);
            if (!targets.length) {
                showToast('Create another space before moving a project.');
                return;
            }
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="move-project-title">
                        <h2 id="move-project-title">Move project</h2>
                        <p class="move-project-message"></p>
                        <form class="space-form">
                            <select name="space" aria-label="Destination space"></select>
                            <div class="space-form-actions"><button type="button" class="cancel-space">Cancel</button><button type="submit" class="create-space">Move project</button></div>
                        </form>
                    </section>
                </div>`;
            root.querySelector('.move-project-message').textContent = `Move "${doc.title}" to another space.`;
            const form = root.querySelector('form');
            const select = form.elements.space;
            targets.forEach(space => {
                const option = document.createElement('option');
                option.value = space.id;
                option.textContent = space.name;
                select.appendChild(option);
            });
            root.querySelector('.cancel-space').onclick = closeModal;
            form.onsubmit = event => {
                event.preventDefault();
                if (!targets.some(space => space.id === select.value)) {
                    showToast('Choose a valid destination space.');
                    return;
                }
                doc.spaceId = select.value;
                collapsedSpaces.delete(doc.spaceId);
                closeModal();
                scheduleSave();
                render();
                searchNotes(document.getElementById('search-input').value);
            };
            if (targets.length) select.focus();
            else root.querySelector('.cancel-move-node').focus();
        }
        function renameDocument(id, returnFocus) {
            const doc = state.documents.find(item => item.id === id);
            if (!doc) return;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="rename-project-title">
                        <h2 id="rename-project-title">Rename project</h2>
                        <form class="space-form">
                            <input name="name" aria-label="Project name" maxlength="100" required>
                            <div class="space-form-actions"><button type="button" class="cancel-project">Cancel</button><button type="submit" class="create-space">Save</button></div>
                        </form>
                    </section>
                </div>`;
            const form = root.querySelector('form');
            const input = form.elements.name;
            input.value = doc.title;
            root.querySelector('.cancel-project').onclick = () => {
                closeModal();
                if (returnFocus?.isConnected) returnFocus.focus();
                else if (currentView === 'project') document.getElementById('doc-title').focus();
            };
            input.oninput = () => input.setCustomValidity('');
            form.onsubmit = event => {
                event.preventDefault();
                const name = input.value.trim();
                if (!name) {
                    input.setCustomValidity('Enter a project name.');
                    input.reportValidity();
                    return;
                }
                doc.title = name;
                closeModal();
                scheduleSave();
                render();
                searchNotes(document.getElementById('search-input').value);
                if (returnFocus?.isConnected) returnFocus.focus();
                else if (currentView === 'project' && state.activeId === doc.id) document.getElementById('doc-title').focus();
            };
            input.focus();
            input.select();
        }
        function deleteDocument(id, returnFocus) {
            const doc = state.documents.find(item => item.id === id);
            if (!doc) return;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-message">
                        <h2 id="delete-project-title">Delete project?</h2>
                        <p id="delete-project-message"></p>
                        <div class="space-form-actions"><button type="button" class="cancel-project">Cancel</button><button type="button" class="create-space delete-project-confirm">Delete project</button></div>
                    </section>
                </div>`;
            const replacement = state.documents.length === 1 ? ' A new empty project will be created in this space.' : '';
            root.querySelector('#delete-project-message').textContent = `Delete "${doc.title}" and all its notes? This cannot be undone.${replacement}`;
            root.querySelector('.cancel-project').onclick = () => {
                closeModal();
                if (returnFocus.isConnected) returnFocus.focus();
            };
            root.querySelector('.delete-project-confirm').onclick = () => {
                const deletingActive = state.activeId === doc.id;
                if (deletingActive && !closeAgendaEditor()) return;
                state.documents = state.documents.filter(item => item.id !== doc.id);
                detachAgendaProjects();
                if (!state.documents.length) state.documents.push(newDocument(doc.spaceId));
                if (deletingActive) {
                    const next = state.documents.find(item => item.spaceId === doc.spaceId) || state.documents[0];
                    state.activeId = next.id;
                    activeFilter = 'all';
                    priorityFilter = 'all';
                    completedFilter = 'show';
                    collapsedSpaces.delete(next.spaceId);
                }
                closeModal();
                scheduleSave();
                render();
                searchNotes(document.getElementById('search-input').value);
                if (deletingActive && currentView === 'project') document.getElementById('doc-title').focus();
            };
            root.querySelector('.cancel-project').focus();
        }
        function newDocument(spaceId) {
            return { id: makeId(), spaceId, title: 'New project', subtitle: DEFAULT_SUBTITLE, starred: false, updatedAt: Date.now(), customFields: [], nodes: [] };
        }
        function createDocument(spaceId) {
            if (!closeAgendaEditor()) return;
            const doc = newDocument(spaceId);
            currentView = 'project';
            state.documents.push(doc);
            state.activeId = doc.id;
            priorityFilter = 'all';
            completedFilter = 'show';
            collapsedSpaces.delete(spaceId);
            activeFilter = 'all';
            scheduleSave();
            render();
            renameDocument(doc.id);
        }
        function addRootNode() {
            if (zoomNodeId && zoomDocumentId === activeDocument().id) {
                addChild(zoomNodeId);
                return;
            }
            if (currentView !== 'endless') {
                activeFilter = 'all';
                priorityFilter = 'all';
            }
            const node = createNode();
            activeDocument().nodes.push(node);
            focusRequest = { id: node.id, end: false };
            scheduleSave();
            render();
        }
        function addSibling(id) {
            if (zoomNodeId === id && zoomDocumentId === activeDocument().id) {
                showToast('Navigate up to add a sibling to the zoomed note.');
                return;
            }
            const location = findNode(id);
            if (!location) return;
            if (currentView !== 'endless') priorityFilter = 'all';
            const node = createNode();
            location.array.splice(location.index + 1, 0, node);
            if (location.parent) location.parent.collapsed = false;
            focusRequest = { id: node.id, end: false };
            scheduleSave();
            render();
        }
        function addChild(id) {
            const location = findNode(id);
            if (!location) return;
            if (currentView !== 'endless') {
                activeFilter = 'all';
                priorityFilter = 'all';
            }
            const node = createNode();
            location.node.children.push(node);
            location.node.collapsed = false;
            focusRequest = { id: node.id, end: false };
            scheduleSave();
            render();
        }
        function moveNodeFiltersActive() {
            return currentView === 'endless' ? endlessCompletedFilter !== 'show' :
                activeFilter !== 'all' || priorityFilter !== 'all' || completedFilter !== 'show';
        }
        function findMoveNeighbor(doc, nodeId, direction) {
            const source = findNode(nodeId, doc.nodes);
            if (!source) return null;
            const zoomRoot = zoomNodeId && zoomDocumentId === doc.id ? findNode(zoomNodeId, doc.nodes)?.node : null;
            const nodes = [];
            function collect(items) {
                items.forEach(item => {
                    nodes.push(item);
                    if (!item.collapsed || item === zoomRoot) collect(item.children);
                });
            }
            collect(zoomRoot ? [zoomRoot] : doc.nodes);
            const index = nodes.indexOf(source.node);
            if (index < 0) return null;
            const excluded = new Set(allNodes([source.node]).map(item => item.node.id));
            let nextIndex = index + (direction === 'up' ? -1 : 1);
            while (nextIndex >= 0 && nextIndex < nodes.length && excluded.has(nodes[nextIndex].id)) {
                nextIndex += direction === 'up' ? -1 : 1;
            }
            const target = nodes[nextIndex];
            return target && target !== zoomRoot ? target : null;
        }
        function focusMovingNode(doc, nodeId, direction) {
            const scope = currentView === 'endless'
                ? document.querySelector(`.endless-project[data-doc-id="${CSS.escape(doc.id)}"]`)
                : document.getElementById('outline');
            const row = scope?.querySelector(`[data-node-id="${CSS.escape(nodeId)}"] > .node-row`);
            const button = direction === 'menu' ? row?.querySelector('.node-menu summary') :
                row?.querySelector(`[data-move-direction="${direction}"]:not(:disabled)`) || row?.querySelector('[data-move-direction="done"]');
            button?.focus();
        }
        function moveNodeWithArrow(doc, nodeId, direction) {
            if (!movingNode || movingNode.docId !== doc.id || movingNode.nodeId !== nodeId || moveNodeFiltersActive()) {
                showToast('Move mode is no longer available.');
                return;
            }
            const source = findNode(nodeId, doc.nodes);
            const neighbor = findMoveNeighbor(doc, nodeId, direction);
            if (!source || !neighbor) {
                showToast('The note cannot be moved in that direction.');
                return;
            }
            source.array.splice(source.index, 1);
            const destination = findNode(neighbor.id, doc.nodes);
            if (direction === 'down' && !neighbor.collapsed && neighbor.children.length) {
                neighbor.children.unshift(source.node);
                markNodeEdited(neighbor);
            } else {
                destination.array.splice(destination.index + (direction === 'down' ? 1 : 0), 0, source.node);
                if (destination.parent) markNodeEdited(destination.parent);
            }
            if (source.parent) markNodeEdited(source.parent);
            markNodeEdited(source.node);
            scheduleSave();
            render();
            focusMovingNode(doc, nodeId, direction);
        }
        function showMoveNodeDialog(doc, nodeId, returnFocus) {
            const source = findNode(nodeId, doc.nodes);
            if (!source) return;
            const excludedIds = new Set(allNodes([source.node]).map(item => item.node.id));
            const targets = [];
            function collectTargets(nodes, ancestors = []) {
                nodes.forEach(target => {
                    const path = [...ancestors, target];
                    if (!excludedIds.has(target.id) && target.id !== source.parent?.id) {
                        targets.push({ node: target, path });
                    }
                    collectTargets(target.children, path);
                });
            }
            collectTargets(doc.nodes);
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal move-node-modal" role="dialog" aria-modal="true" aria-labelledby="move-node-title" aria-describedby="move-node-description">
                        <h2 id="move-node-title">Move note</h2>
                        <p id="move-node-description"></p>
                        <form class="move-node-form">
                            <label for="move-node-target">Move under</label>
                            <select id="move-node-target" required></select>
                            <p class="move-node-message" role="status" aria-live="polite"></p>
                            <div class="space-form-actions">
                                <button type="button" class="cancel-move-node">Cancel</button>
                                <button type="submit" class="create-space confirm-move-node">Move note</button>
                            </div>
                        </form>
                    </section>
                </div>`;
            root.querySelector('#move-node-description').textContent = `Choose a parent for “${source.node.text.trim() || 'Untitled note'}”. Its sub-notes will move with it.`;
            const select = root.querySelector('#move-node-target');
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = targets.length ? 'Choose a destination note…' : 'No eligible destination notes';
            placeholder.disabled = true;
            placeholder.selected = true;
            select.appendChild(placeholder);
            targets.forEach(({ node: target, path }) => {
                const option = document.createElement('option');
                option.value = target.id;
                option.textContent = `${doc.title} › ${path.map(item => item.text.trim() || 'Untitled note').join(' › ')}`;
                select.appendChild(option);
            });
            select.disabled = targets.length === 0;
            const submit = root.querySelector('.confirm-move-node');
            submit.disabled = targets.length === 0;
            const close = () => {
                closeModal();
                if (returnFocus.isConnected) returnFocus.focus();
            };
            root.querySelector('.cancel-move-node').onclick = close;
            root.querySelector('.modal-backdrop').onclick = event => {
                if (event.target === event.currentTarget) close();
            };
            root.querySelector('.move-node-form').onsubmit = event => {
                event.preventDefault();
                const currentDoc = state.documents.find(item => item.id === doc.id);
                const currentSource = currentDoc && findNode(nodeId, currentDoc.nodes);
                const destination = currentDoc && findNode(select.value, currentDoc.nodes);
                if (!currentSource || !destination) {
                    root.querySelector('.move-node-message').textContent = 'The project or destination changed. Close this dialog and try again.';
                    return;
                }
                if (new Set(allNodes([currentSource.node]).map(item => item.node.id)).has(destination.node.id)) {
                    root.querySelector('.move-node-message').textContent = 'A note cannot be moved under itself or one of its sub-notes.';
                    return;
                }
                if (currentSource.parent?.id === destination.node.id) {
                    root.querySelector('.move-node-message').textContent = 'This note is already under that parent.';
                    return;
                }
                currentSource.array.splice(currentSource.index, 1);
                destination.node.children.push(currentSource.node);
                destination.node.collapsed = false;
                for (let parent = destination.parent; parent; parent = findNode(parent.id, currentDoc.nodes)?.parent) {
                    parent.collapsed = false;
                }
                markNodeEdited(currentSource.node);
                markNodeEdited(destination.node);
                closeModal();
                scheduleSave();
                render();
                showToast(`Moved under “${destination.node.text.trim() || 'Untitled note'}”.`);
            };
            select.focus();
        }
        function confirmDeleteNode(id, returnFocus) {
            const location = findNode(id);
            if (!location) return;
            const docId = activeDocument().id;
            const descendants = countNodes(location.node.children);
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-node-title" aria-describedby="delete-node-message">
                        <h2 id="delete-node-title">Delete note?</h2>
                        <p id="delete-node-message"></p>
                        <div class="space-form-actions"><button type="button" class="cancel-node">Cancel</button><button type="button" class="create-space delete-node-confirm">Delete note</button></div>
                    </section>
                </div>`;
            const name = location.node.text.trim() || 'Untitled note';
            const subnotes = descendants ? ` and its ${descendants} sub-note${descendants === 1 ? '' : 's'}` : '';
            root.querySelector('#delete-node-message').textContent = `Delete "${name}"${subnotes}? This cannot be undone.`;
            const cancel = () => {
                closeModal();
                if (returnFocus.isConnected) returnFocus.focus();
            };
            root.querySelector('.cancel-node').onclick = cancel;
            root.querySelector('.modal-backdrop').onclick = event => {
                if (event.target === event.currentTarget) cancel();
            };
            root.querySelector('.delete-node-confirm').onclick = () => {
                if (activeDocument().id !== docId) {
                    closeModal();
                    showToast('The project changed. The note was not deleted.');
                    return;
                }
                closeModal();
                deleteNode(id);
            };
            root.querySelector('.cancel-node').focus();
        }
        function deleteNode(id) {
            const location = findNode(id);
            if (!location) return;
            location.array.splice(location.index, 1);
            if (!activeDocument().nodes.length) {
                const node = createNode();
                activeDocument().nodes.push(node);
                focusRequest = { id: node.id, end: false };
            } else {
                const next = location.array[Math.min(location.index, location.array.length - 1)] || location.array[location.index - 1];
                if (next) focusRequest = { id: next.id, end: true };
            }
            scheduleSave();
            render();
        }
        function indentNode(id) {
            if (zoomNodeId === id && zoomDocumentId === activeDocument().id) {
                showToast('Navigate up to move the zoomed note.');
                return;
            }
            const location = findNode(id);
            if (!location || location.index === 0) return;
            const previous = location.array[location.index - 1];
            location.array.splice(location.index, 1);
            previous.children.push(location.node);
            previous.collapsed = false;
            focusRequest = { id, end: true };
            scheduleSave();
            render();
        }
        function outdentNode(id) {
            if (zoomNodeId === id && zoomDocumentId === activeDocument().id) {
                showToast('Navigate up to move the zoomed note.');
                return;
            }
            const location = findNode(id);
            if (!location || !location.parent) return;
            const parentLocation = findNode(location.parent.id);
            if (!parentLocation) return;
            location.array.splice(location.index, 1);
            parentLocation.array.splice(parentLocation.index + 1, 0, location.node);
            focusRequest = { id, end: true };
            scheduleSave();
            render();
        }
        function handleNodeKeydown(event, id) {
            const location = findNode(id);
            if (!location) return;
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                if (!toggleNodeCompletion(location.node)) return;
                focusRequest = { id, end: true };
                scheduleSave();
                render();
            } else if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                addSibling(id);
            } else if (event.key === 'Tab') {
                event.preventDefault();
                if (event.shiftKey) outdentNode(id);
                else indentNode(id);
            } else if (event.key === 'Backspace' && !event.currentTarget.textContent.trim()) {
                event.preventDefault();
                confirmDeleteNode(id, event.currentTarget);
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                const editors = [...document.querySelectorAll('.node-text')].filter(editor => editor.getClientRects().length > 0);
                const index = editors.indexOf(event.currentTarget);
                const target = editors[index + (event.key === 'ArrowUp' ? -1 : 1)];
                const atEdge = event.key === 'ArrowUp'
                    ? isCaretAtStart(event.currentTarget)
                    : isCaretAtEnd(event.currentTarget);
                if (target && atEdge) {
                    event.preventDefault();
                    target.focus();
                    placeCaret(target, event.key === 'ArrowUp');
                }
            }
        }
        function isCaretAtStart(element) {
            const selection = window.getSelection();
            if (!selection || !selection.isCollapsed || !selection.anchorNode) return false;
            const range = document.createRange();
            range.selectNodeContents(element);
            range.setEnd(selection.anchorNode, selection.anchorOffset);
            return range.toString().length === 0;
        }
        function isCaretAtEnd(element) {
            const selection = window.getSelection();
            if (!selection || !selection.isCollapsed || !selection.anchorNode) return false;
            const range = document.createRange();
            range.selectNodeContents(element);
            range.setStart(selection.anchorNode, selection.anchorOffset);
            return range.toString().length === 0;
        }
        function placeCaret(element, atEnd) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(!atEnd);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        function searchNotes(value) {
            const container = document.getElementById('search-results');
            const query = value.trim().toLowerCase();
            container.replaceChildren();
            if (!query) { container.classList.add('hidden'); return; }
            const outlineResults = [];
            state.documents.forEach(doc => allNodes(doc.nodes).forEach(({ node, path }) => {
                if (outlineResults.length >= 20 || (!node.text.toLowerCase().includes(query) && !node.description.toLowerCase().includes(query))) return;
                const space = state.spaces.find(item => item.id === doc.spaceId);
                outlineResults.push({ title: node.text, detail: `${space.name} / ${doc.title}`, open: () => openGlobalNote({ node, path, doc, space }) });
            }));
            const agendaResults = [];
            if (state.settings.agendaNotesEnabled) {
                for (const note of state.agendaNotes) {
                    if (!agendaNoteMatches(note, query)) continue;
                    const doc = state.documents.find(item => item.id === note.projectId);
                    agendaResults.push({ title: note.title, detail: `Scratchpad · ${doc ? agendaProjectLabel(doc) : 'No project'}`, open: () => openAgendaSearchResult(note) });
                    if (agendaResults.length === 20) break;
                }
            }
            const results = [];
            for (let i = 0; i < Math.max(outlineResults.length, agendaResults.length) && results.length < 20; i++) {
                if (outlineResults[i]) results.push(outlineResults[i]);
                if (agendaResults[i] && results.length < 20) results.push(agendaResults[i]);
            }
            if (!results.length) {
                const empty = document.createElement('div');
                empty.className = 'search-result-meta';
                empty.style.padding = '12px';
                empty.textContent = 'No notes found';
                container.appendChild(empty);
            } else results.forEach(result => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'search-result';
                const title = document.createElement('span');
                title.className = 'search-result-title';
                title.textContent = result.title;
                const meta = document.createElement('span');
                meta.className = 'search-result-meta';
                meta.textContent = result.detail;
                button.append(title, meta);
                button.onclick = () => {
                    setSearchOpen(false);
                    if (narrowSidebar.matches) setSidebarOpen(false);
                    result.open();
                };
                container.appendChild(button);
            });
            container.classList.remove('hidden');
        }
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.remove('hidden');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
        }
        document.getElementById('manage-accounts-button').addEventListener('click', showAccounts);
        function setFontSize(value) {
            if (!FONT_SIZES.includes(value)) {
                console.error('Invalid font size:', value);
                showToast('Could not change font size: invalid size.');
                return;
            }
            fontSize = value;
            document.documentElement.style.setProperty('--font-scale', Number(fontSize) / 100);
            updateFontSizeControls();
            try {
                localStorage.setItem(FONT_SIZE_KEY, fontSize);
                fontSizeStorageError = false;
            } catch (error) {
                fontSizeStorageError = true;
                console.error('Could not save the font size preference:', error);
                showToast('Font size changed, but could not be saved on this device.');
            }
        }
        function updateFontSizeControls() {
            const index = FONT_SIZES.indexOf(fontSize);
            document.getElementById('font-size-smaller').disabled = index === 0;
            document.getElementById('font-size-larger').disabled = index === FONT_SIZES.length - 1;
            const select = document.getElementById('font-size-select');
            if (select) select.value = fontSize;
        }
        document.getElementById('font-size-smaller').addEventListener('click', () => setFontSize(FONT_SIZES[FONT_SIZES.indexOf(fontSize) - 1]));
        document.getElementById('font-size-larger').addEventListener('click', () => setFontSize(FONT_SIZES[FONT_SIZES.indexOf(fontSize) + 1]));
        updateFontSizeControls();
        function closeModal() { document.getElementById('modal-root').replaceChildren(); }

        const sidebar = document.querySelector('.sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const narrowSidebar = window.matchMedia('(max-width: 760px)');
        function setSidebarOpen(open) {
            sidebar.hidden = !open;
            if (!open) closeSidebarMenus();
            const label = sidebar.hidden ? 'Open sidebar' : 'Close sidebar';
            sidebarToggle.setAttribute('aria-label', label);
            sidebarToggle.setAttribute('aria-expanded', String(!sidebar.hidden));
            sidebarToggle.title = label;
        }
        setSidebarOpen(!narrowSidebar.matches);
        sidebarToggle.addEventListener('click', () => setSidebarOpen(sidebar.hidden));
        function closeOverlaySidebar() {
            setSidebarOpen(false);
            sidebarToggle.focus();
        }
        document.getElementById('sidebar-close').addEventListener('click', closeOverlaySidebar);
        document.getElementById('sidebar-backdrop').addEventListener('click', closeOverlaySidebar);
        let sidebarSwipe = null;
        function bindSidebarSwipe(target, frame = null) {
            target.addEventListener('touchstart', event => {
                sidebarSwipe = null;
                if (!authenticated || event.touches.length !== 1 || document.getElementById('modal-root').hasChildNodes() ||
                    event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [id$="-modal"]')) return;
                const touch = event.touches[0];
                const x = touch.clientX + (frame ? frame.getBoundingClientRect().left : 0);
                const opening = sidebar.hidden;
                if (opening ? x > 32 : frame || !sidebar.contains(event.target)) return;
                sidebarSwipe = { target, id: touch.identifier, x, y: touch.clientY, opening };
            }, { passive: true, capture: true });
            target.addEventListener('touchend', event => {
                const swipe = sidebarSwipe;
                sidebarSwipe = null;
                if (!swipe || !authenticated || document.getElementById('modal-root').hasChildNodes() ||
                    swipe.target !== target || event.touches.length || sidebar.hidden !== swipe.opening) return;
                const touch = Array.from(event.changedTouches).find(item => item.identifier === swipe.id);
                if (!touch) return;
                const dx = touch.clientX + (frame ? frame.getBoundingClientRect().left : 0) - swipe.x;
                const dy = touch.clientY - swipe.y;
                if (Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy) * 1.5 &&
                    (swipe.opening ? dx > 0 : dx < 0)) setSidebarOpen(swipe.opening);
            }, { passive: true, capture: true });
            target.addEventListener('touchcancel', () => { sidebarSwipe = null; }, { passive: true, capture: true });
        }
        bindSidebarSwipe(document.getElementById('app'));
        for (const id of ['shared-tracker', 'supply']) {
            const frame = document.getElementById(id);
            frame.addEventListener('load', () => {
                if (frame.contentDocument) bindSidebarSwipe(frame.contentDocument, frame);
            });
        }
        sidebar.addEventListener('click', event => {
            if (narrowSidebar.matches && event.target.closest('.nav-list .nav-item, .project-row .doc-item, .sidebar-tag-list .nav-item')) {
                setSidebarOpen(false);
            }
        });
        document.getElementById('edit-project-title').addEventListener('click', event => {
            renameDocument(activeDocument().id, event.currentTarget);
        });
        document.getElementById('doc-subtitle').addEventListener('input', event => {
            activeDocument().subtitle = event.target.value;
            scheduleSave();
        });
        document.getElementById('priority-filter').addEventListener('change', event => {
            priorityFilter = event.target.value;
            render();
        });
        document.getElementById('starred-filter').addEventListener('change', event => {
            setFilter(event.target.checked ? 'starred' : 'all');
        });
        function toggleCompletedVisibility() {
            completedFilter = completedFilter === 'show' ? 'hide' : 'show';
            render();
        }
        document.getElementById('completed-filter').addEventListener('click', toggleCompletedVisibility);
        document.getElementById('project-completed-toggle').addEventListener('click', toggleCompletedVisibility);
        document.getElementById('endless-completed-filter').addEventListener('click', () => {
            endlessCompletedFilter = endlessCompletedFilter === 'show' ? 'hide' : 'show';
            render();
        });
        document.getElementById('project-export').addEventListener('click', () => showExportPreview());
        document.getElementById('project-menu').addEventListener('click', event => {
            if (event.target.closest('#project-export, #add-pm-template')) document.getElementById('project-menu').open = false;
        });
        function setProjectBranchesCollapsed(collapsed) {
            if (branchesExpandedForFilter()) return;
            const doc = activeDocument();
            const zoomed = zoomNodeId && zoomDocumentId === doc.id ? findNode(zoomNodeId, doc.nodes) : null;
            const roots = zoomed ? zoomed.node.children : doc.nodes;
            let changed = false;
            for (const { node } of allNodes(roots)) {
                if (node.children.length && node.collapsed !== collapsed) {
                    node.collapsed = collapsed;
                    changed = true;
                }
            }
            if (changed) {
                scheduleSave();
                render();
            }
        }
        document.getElementById('project-expand-all').addEventListener('click', () => setProjectBranchesCollapsed(false));
        document.getElementById('project-collapse-all').addEventListener('click', () => setProjectBranchesCollapsed(true));
        const searchToggle = document.getElementById('search-toggle');
        const searchPanel = document.getElementById('search-panel');
        const searchInput = document.getElementById('search-input');
        function setSearchOpen(open) {
            searchPanel.hidden = !open;
            searchToggle.setAttribute('aria-expanded', String(open));
            if (open) searchInput.focus();
            else {
                searchInput.value = '';
                searchNotes('');
            }
        }
        searchToggle.addEventListener('click', () => setSearchOpen(searchPanel.hidden));
        searchInput.addEventListener('input', event => searchNotes(event.target.value));
        searchInput.addEventListener('focus', event => searchNotes(event.target.value));
        searchInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') document.querySelector('#search-results:not(.hidden) .search-result')?.click();
        });
        searchPanel.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setSearchOpen(false);
                searchToggle.focus();
            }
        });
        document.addEventListener('click', event => {
            if (!searchPanel.hidden && !event.target.closest('.search-wrap')) setSearchOpen(false);
            const topMenu = document.getElementById('top-menu');
            if (!event.target.closest('.top-menu') || event.target.closest('.top-menu-list button')) topMenu.open = false;
            document.querySelectorAll('.project-menu[open]').forEach(menu => {
                if (!menu.contains(event.target)) menu.open = false;
            });
            document.querySelectorAll('.agenda-info-menu[open]').forEach(menu => {
                if (!menu.contains(event.target)) menu.open = false;
            });
            if (!event.target.closest('.sidebar-menu')) {
                document.querySelectorAll('.sidebar-menu[open]').forEach(menu => { menu.open = false; });
            }
            if (!event.target.closest('.node-menu')) {
                document.querySelectorAll('.node-menu[open]').forEach(menu => {
                    menu.open = false;
                });
            }
        });
        function closeSidebarMenus() {
            document.querySelectorAll('.sidebar-menu[open]').forEach(menu => { menu.open = false; });
        }
        document.getElementById('spaces-list').addEventListener('scroll', closeSidebarMenus);
        sidebar.addEventListener('scroll', closeSidebarMenus);
        window.addEventListener('resize', closeSidebarMenus);
        document.addEventListener('keydown', event => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('#modal-root .export-modal')) {
                event.preventDefault();
                if (narrowSidebar.matches && !sidebar.hidden) setSidebarOpen(false);
                setSearchOpen(true);
                searchInput.select();
            } else if (event.key === 'Escape') {
                const richCancel = document.querySelector('#modal-root .cancel-rich-note');
                if (richCancel) { richCancel.click(); return; }
                const simpleCancel = document.querySelector('#modal-root .cancel-full-simple-note');
                if (simpleCancel) { simpleCancel.click(); return; }
                const viewClose = document.querySelector('#modal-root .close-view-note');
                if (viewClose) { viewClose.click(); return; }
                const exportClose = document.querySelector('#modal-root .export-close');
                if (exportClose) { exportClose.click(); return; }
                const agendaCancel = document.querySelector('#modal-root .cancel-agenda');
                if (agendaCancel) { agendaCancel.click(); return; }
                const nodeCancel = document.querySelector('#modal-root .cancel-node');
                const openMenu = document.querySelector('.node-menu[open], .sidebar-menu[open], .agenda-info-menu[open]');
                if (nodeCancel) {
                    nodeCancel.click();
                } else if (openMenu) {
                    openMenu.open = false;
                    openMenu.querySelector('summary').focus();
                } else if (document.getElementById('top-menu').open) {
                    document.getElementById('top-menu').open = false;
                    document.querySelector('#top-menu summary').focus();
                } else if (document.getElementById('project-menu').open) {
                    document.getElementById('project-menu').open = false;
                    document.getElementById('project-menu-summary').focus();
                } else if (document.querySelector('#welcome-title')) {
                    event.preventDefault();
                } else if (document.querySelector('#guide-title')) {
                    closeUserGuide();
                } else if (document.getElementById('modal-root').hasChildNodes()) {
                    closeModal();
                } else if (!searchPanel.hidden) {
                    setSearchOpen(false);
                    searchToggle.focus();
                } else if (narrowSidebar.matches && !sidebar.hidden) {
                    closeOverlaySidebar();
                }
            }
        });
        document.getElementById('import-input').addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const imported = JSON.parse(await file.text());
                if (!Array.isArray(imported.documents) || !imported.documents.length) throw new Error('This backup does not contain any documents.');
                if (!confirm('Importing this backup replaces your current workspace. Export a backup first if you need to keep it. Continue?')) return;
                const nextState = {
                    activeId: imported.activeId,
                    spaces: imported.spaces,
                    settings: imported.settings,
                    testingData: imported.testingData,
                    testing2Data: imported.testing2Data,
                    templates: imported.templates,
                    pmSites: imported.pmSites,
                    agendaNotes: imported.agendaNotes,
                    documents: imported.documents.map(doc => ({
                        id: typeof doc.id === 'string' ? doc.id : makeId(),
                        title: typeof doc.title === 'string' ? doc.title : 'Untitled',
                        subtitle: typeof doc.subtitle === 'string' ? doc.subtitle : DEFAULT_SUBTITLE,
                        customFields: doc.customFields,
                        templateId: doc.templateId,
                        pmProject: doc.pmProject,
                        pmTasks: doc.pmTasks,
                        spaceId: doc.spaceId,
                        starred: Boolean(doc.starred),
                        updatedAt: Date.now(),
                        nodes: normalizeNodes(Array.isArray(doc.nodes) ? doc.nodes : [])
                    }))
                };
                let reopened = 0;
                state = normalizeState(nextState, count => { reopened = count; });
                closeModal();
                currentView = 'project';
                collapsedSpaces.clear();
                activeFilter = 'all';
                priorityFilter = 'all';
                completedFilter = 'show';
                scheduleSave();
                render();
                showToast(reopened ? `Backup imported. Reopened ${reopened} completed parent note(s) or task(s); saving to the database…` : 'Backup imported. Saving to the database…');
            } catch (error) {
                console.error('Could not import the outline:', error);
                showToast(`Could not import backup: ${error.message}`);
            } finally {
                event.target.value = '';
            }
        });
        async function openWorkspace(tookOver = false) {
            const result = await api('load', {});
            if (typeof result.username !== 'string' || !result.username) throw new Error('The server did not provide the signed-in username.');
            if (!Number.isSafeInteger(result.userId) || result.userId < 1) throw new Error('The server did not provide the account identity.');
            if (typeof result.isAdmin !== 'boolean') throw new Error('The server did not provide account permissions.');
            if (typeof result.email !== 'string' || typeof result.guideSeen !== 'boolean') throw new Error('The server did not provide account onboarding information.');
            let reopened = 0;
            state = result.state === null ? normalizeState(structuredClone(starterData)) : normalizeState(result.state, count => { reopened = count; });
            currentView = 'dashboard';
            revision = result.revision;
            currentAccountId = result.userId;
            document.getElementById('account-name').textContent = result.username;
            document.getElementById('account-avatar').textContent = result.username.charAt(0).toUpperCase();
            isAdministrator = result.isAdmin;
            updateExtensionAccess(result);
            accountEmail = result.email;
            document.getElementById('manage-accounts-button').hidden = !isAdministrator;
            authenticated = true;
            syncBlocked = false;
            instanceDisconnected = false;
            instanceBackupExported = false;
            document.getElementById('auth-screen').hidden = true;
            document.getElementById('required-password-form').hidden = true;
            document.getElementById('login-form').hidden = false;
            document.getElementById('app').hidden = false;
            setDatabaseStatus('Database: connected', 'connected');
            setSaveStatus('All changes saved');
            render();
            const recoveryCount = await refreshOfflineRecovery();
            if ((result.state === null || reopened) && recoveryCount === 0) scheduleSave();
            const notifications = [];
            if (result.personalProjectWarning) notifications.push(result.personalProjectWarning);
            if (reopened) notifications.push(recoveryCount === 0
                ? `Reopened ${reopened} completed parent note(s) or task(s) with active children. Saving changes…`
                : `Reopened ${reopened} completed parent note(s) or task(s) with active children. Save or recover changes when ready.`);
            if (tookOver) notifications.push('Connected. The other PlanBraid instance has been disconnected.');
            if (notifications.length) showToast(notifications.join(' '));
            if (!result.guideSeen) showWelcomeGuide();
            checkReminders();
        }
        function requirePasswordChange() {
            document.getElementById('login-form').hidden = true;
            document.getElementById('required-password-form').hidden = false;
            document.getElementById('auth-screen').hidden = false;
            document.getElementById('app').hidden = true;
            document.querySelector('#required-password-form [name=currentPassword]').focus();
        }
        async function connect() {
            const message = document.getElementById('auth-message');
            const fields = document.getElementById('login-fields');
            const retry = document.getElementById('connection-retry');
            fields.hidden = true;
            retry.hidden = true;
            message.textContent = 'Connecting to the database…';
            try {
                const result = await api('session', undefined, true);
                csrfToken = result.csrf;
                if (result.authenticated) {
                    if (result.mustChangePassword) requirePasswordChange();
                    else await openWorkspace(result.tookOver);
                } else if (result.sessionReplaced) {
                    disconnectReplacedInstance();
                } else {
                    message.textContent = 'Database connected. Sign in to your private workspace.';
                    fields.hidden = false;
                    document.getElementById('login-username').focus();
                }
            } catch (error) {
                console.error('Could not connect:', error);
                if (error.code === 'session_replaced') disconnectReplacedInstance();
                else {
                    message.textContent = `Database connection failed: ${error.message}`;
                    retry.hidden = false;
                }
            }
        }
        document.getElementById('login-form').addEventListener('submit', async event => {
            event.preventDefault();
            const button = event.currentTarget.querySelector('button[type="submit"]');
            const message = document.getElementById('auth-message');
            button.disabled = true;
            try {
                const result = await api('login', {
                    username: document.getElementById('login-username').value,
                    password: document.getElementById('login-password').value
                });
                csrfToken = result.csrf;
                document.getElementById('login-password').value = '';
                if (result.mustChangePassword) requirePasswordChange();
                else await openWorkspace(result.tookOver);
            } catch (error) {
                console.error('Could not sign in:', error);
                if (error.code === 'session_replaced') {
                    disconnectReplacedInstance();
                    return;
                }
                message.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        });
        document.getElementById('required-password-form').addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector('[type=submit]');
            button.disabled = true;
            try {
                passwordsMatch(form.elements.password.value, form.elements.confirmation.value);
                await api('change-password', { currentPassword: form.elements.currentPassword.value, password: form.elements.password.value });
                form.reset();
                form.hidden = true;
                document.getElementById('login-form').hidden = false;
                await connect();
            } catch (error) {
                form.querySelector('.auth-message').textContent = error.message;
            } finally {
                button.disabled = false;
            }
        });
        document.getElementById('required-password-signout').addEventListener('click', async () => {
            try {
                await api('logout', {});
                location.reload();
            } catch (error) {
                if (error.status === 401 || error.code === 'session_replaced') location.reload();
                else document.querySelector('#required-password-form .auth-message').textContent = error.message;
            }
        });
        document.getElementById('connection-retry').addEventListener('click', () => {
            if (instanceDisconnected && editGeneration !== savedGeneration && !instanceBackupExported) {
                document.getElementById('auth-message').textContent = 'Export your unsaved changes before reconnecting; reconnecting reloads the latest saved workspace.';
                return;
            }
            connect();
        });
        document.getElementById('displaced-export').addEventListener('click', () => {
            exportBackup();
            instanceBackupExported = true;
            document.getElementById('auth-message').textContent = 'Backup exported. You can reconnect this instance when ready.';
        });
        document.getElementById('database-status').addEventListener('click', () => {
            if (syncBlocked) {
                showToast('Save is blocked. Export a backup of your changes before reloading.');
            } else checkDatabase();
        });
        async function signOut() {
            if (hasUnsavedSeparatePMDraft() && !confirm('Discard the unsaved task edit and sign out?')) return;
            const savingNote = hasUnsavedAgendaDraft();
            if (!closeAgendaEditor()) return;
            if (savingNote) {
                await flushSave();
            }
            let keepOfflineChanges = false;
            if (editGeneration !== savedGeneration) {
                if (!confirm('There are unsaved changes. Sign out anyway?')) return;
                keepOfflineChanges = confirm('Keep unsynced changes on this device for recovery after signing in? Choose Cancel to discard them.');
                if (keepOfflineChanges && !await localSnapshotReady()) return;
            }
            try {
                await api('logout', {});
                authenticated = false;
                if (!keepOfflineChanges) {
                    try { await removeCurrentLocalSnapshot(); }
                    catch (error) {
                        console.error('Could not remove local changes:', error);
                        alert('Signed out, but the local copy could not be removed from this device.');
                    }
                }
                location.reload();
            } catch (error) {
                console.error('Could not sign out:', error);
                showToast(`Could not sign out: ${error.message}`);
            }
        }
        document.getElementById('logout-button').addEventListener('click', signOut);
        window.addEventListener('beforeunload', event => {
            if (hasUnsavedAgendaDraft() || hasUnsavedSeparatePMDraft() || (authenticated && editGeneration !== savedGeneration)) {
                event.preventDefault();
                event.returnValue = true;
            }
        });
        if (tagColorSupported) {
            const tagObserver = new MutationObserver(scheduleTagColors);
            tagObserver.observe(document.getElementById('app'), { subtree: true, childList: true, characterData: true });
            tagObserver.observe(document.getElementById('modal-root'), { subtree: true, childList: true, characterData: true });
        } else {
            console.warn('Hashtag text coloring is unavailable in this browser.');
        }
        setInterval(checkDatabase, 5000);
        window.addEventListener('online', checkDatabase);
        setInterval(checkReminders, 30000);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkReminders();
        });
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js').then(registration => {
                const watched = new WeakSet();
                const watch = worker => {
                    if (!worker || watched.has(worker)) return;
                    watched.add(worker);
                    worker.addEventListener('statechange', () => {
                        if (worker.state === 'redundant') {
                            console.error('App file caching failed.');
                            showToast('Could not cache the app files for offline availability.');
                        }
                    });
                };
                watch(registration.installing);
                registration.addEventListener('updatefound', () => watch(registration.installing));
            }).catch(error => {
                console.error('Could not cache the app:', error);
                showToast('Could not cache the app files for offline availability.');
            });
        } else {
            console.warn('App file caching is unavailable in this browser.');
        }
        connect();
