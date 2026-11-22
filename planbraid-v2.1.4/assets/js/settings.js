/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function showSettings() {
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
                        <div class="settings-header"><h2 id="settings-title">Settings</h2></div>
                        <div class="settings-body">
                            <div class="settings-actions" role="group" aria-label="Account, export and backup actions">
                                <button type="button" id="change-password-button">Change password</button>
                                <button type="button" id="account-email-button">Account email</button>
                                <button type="button" id="export-pdf" aria-describedby="settings-pdf-hint">Export visible outline</button>
                                <button type="button" id="settings-export-backup">Export backup</button>
                                <button type="button" id="settings-import-backup">Import backup</button>
                                <p id="settings-pdf-hint" hidden>Open a project to export its outline.</p>
                            </div>
                            <section class="settings-section" aria-labelledby="settings-appearance-title">
                                <h3 id="settings-appearance-title">Appearance</h3>
                                <div class="settings-card">
                                    <label class="settings-field" for="design-select">Design
                                        <select id="design-select">
                                            <option value="classic">Classic</option>
                                            <option value="studio">Studio</option>
                                            <option value="modern">Modern</option>
                                            <option value="minimal">Minimal</option>
                                            <option value="vibrant">Vibrant</option>
                                            <option value="fusion">Fusion</option>
                                        </select>
                                    </label>
                                    <label class="settings-field" for="theme-select">Theme
                                        <select id="theme-select">
                                            <option value="light">Light</option>
                                            <option value="dark">Dark</option>
                                            <option value="sepia">Sepia</option>
                                        </select>
                                    </label>
                                    <label class="settings-field" for="font-size-select">Font size
                                        <select id="font-size-select">
                                            <option value="85">Small (85%)</option>
                                            <option value="100">Default (100%)</option>
                                            <option value="115">Large (115%)</option>
                                            <option value="130">Extra large (130%)</option>
                                            <option value="145">Largest (145%)</option>
                                        </select>
                                    </label>
                                    <p>Design and theme are shared across devices. Font size applies only to this browser.</p>
                                </div>
                            </section>
                            <section class="settings-section" aria-labelledby="settings-outline-title">
                                <h3 id="settings-outline-title">Project outline</h3>
                                <div class="settings-card">
                                    <label class="settings-module"><input type="checkbox" id="project-outline-collapse-enabled"> Enable project outline collapse</label>
                                    <p>Show an arrow beside each project outline heading to collapse or expand it. Turning this off shows the full outline.</p>
                                </div>
                            </section>
                            <section class="settings-section" aria-labelledby="settings-sidebar-title">
                                <h3 id="settings-sidebar-title">Sidebar</h3>
                                <div class="settings-card">
                                    <label class="settings-module"><input type="checkbox" id="sidebar-all-notes"> Show All notes in the sidebar</label>
                                    <label class="settings-module"><input type="checkbox" id="sidebar-starred"> Show Starred in the sidebar</label>
                                    <label class="settings-module"><input type="checkbox" id="sidebar-priority"> Show Priority in the sidebar</label>
                                    <p>The Priority shortcut requires the Priority module. Hiding shortcuts does not change your notes or Dashboard.</p>
                                </div>
                            </section>
                            <section class="settings-section" aria-labelledby="settings-dashboard-title">
                                <h3 id="settings-dashboard-title">Dashboard</h3>
                                <div class="settings-card">
                                    <p>Dashboard opens when you sign in. Sections include important PM tasks, starred notes, active priorities, and dates due within 7 days or overdue.</p>
                                    <label class="settings-module"><input type="checkbox" id="dashboard-pinned"> Show starred notes</label>
                                    <label class="settings-module"><input type="checkbox" id="dashboard-priority"> Show priority notes</label>
                                    <label class="settings-module"><input type="checkbox" id="dashboard-due"> Show due-date notes</label>
                                </div>
                            </section>
                            <section class="settings-section" aria-labelledby="settings-flow-title">
                                <h3 id="settings-flow-title">Continuum</h3>
                                <div class="settings-card">
                                    <p>Browse and edit projects together in one continuous outline.</p>
                                    <label class="settings-module"><input type="checkbox" id="node-zoom-enabled"> Enable node zoom</label>
                                    <p>Add zoom to note menus and show breadcrumbs in Continuum and project views.</p>
                                </div>
                            </section>
                            <section class="settings-section" aria-labelledby="settings-modules-title">
                                <h3 id="settings-modules-title">Modules</h3>
                                <div class="settings-card">
                                    <section class="settings-module-group" aria-labelledby="settings-tags-title">
                                        <h4 id="settings-tags-title">Tags</h4>
                                        <label class="settings-module"><input type="checkbox" id="tags-enabled"> Enable tags</label>
                                        <p>Tags are discovered from hashtags in node titles and notes and shared across devices.</p>
                                        <p id="tag-color-unavailable" hidden>Hashtag text color requires a newer browser. Tag discovery and navigation still work.</p>
                                        <div class="settings-tag-management" id="settings-tag-management">
                                            <p>Hide a tag from the sidebar without changing your text. Hidden tags can be restored.</p>
                                            <div class="settings-tag-list" id="settings-tag-list" aria-label="Manage tags"></div>
                                        </div>
                                    </section>
                                    <section class="settings-module-group" aria-labelledby="settings-agenda-title">
                                        <h4 id="settings-agenda-title">Scratchpad</h4>
                                        <label class="settings-module"><input type="checkbox" id="agenda-enabled"> Enable Scratchpad</label>
                                        <label class="settings-module"><input type="checkbox" id="agenda-spreadsheets-enabled"> Enable spreadsheets in Scratchpad</label>
                                        <p>Add Notes to the sidebar for standalone Markdown notes with checklists and optional dates. Turning this off keeps your notes.</p>
                                    </section>
                                    <section class="settings-module-group" aria-labelledby="settings-priority-title">
                                        <h4 id="settings-priority-title">Priority</h4>
                                        <label class="settings-module"><input type="checkbox" id="priority-enabled"> Enable priority</label>
                                        <p>Set priorities in note menus and see them in the sidebar and Dashboard when those shortcuts and sections are enabled. Turning this off keeps existing priorities.</p>
                                    </section>
                                    <section class="settings-module-group" aria-labelledby="settings-pm-title">
                                        <h4 id="settings-pm-title">Project management</h4>
                                        <label class="settings-module"><input type="checkbox" id="pm-enabled"> Enable PM</label>
                                        <p>Use the project management template with task progress, site details, assignees and field notes. Disabling PM hides these features without deleting data.</p>
                                        <div class="settings-module-options">
                                            <label class="settings-module"><input type="checkbox" id="pm-progress-panel-enabled"> Show project progress panel</label>
                                            <p>Progress is shown only when separate tasks are enabled. With separate tasks off, this setting controls the Outline / Board switch and board.</p>
                                            <label class="settings-module"><input type="checkbox" id="pm-site-info-enabled"> Show site information</label>
                                            <p>Show site details and Edit site in a separate section.</p>
                                            <label class="settings-module"><input type="checkbox" id="pm-separate-tasks-enabled"> Enable separate project tasks</label>
                                            <p>Copy existing outline tasks once into an independent Tasks section. Board and project progress use the separate tasks while this is enabled.</p>
                                            <label class="settings-module"><input type="checkbox" id="pm-board-enabled"> Enable Board view</label>
                                            <p>Show the Outline / Board switch in PM projects. Turning this off keeps all tasks and statuses.</p>
                                        </div>
                                    </section>
                                    <section class="settings-module-group" aria-labelledby="settings-templates-title">
                                        <h4 id="settings-templates-title">Project templates</h4>
                                        <label class="settings-module"><input type="checkbox" id="templates-enabled"> Enable project templates</label>
                                        <p>Turn custom project template management and creation on or off. The PM template is controlled by the PM module. Existing projects, fields and templates are kept.</p>
                                    </section>
                                    <section class="settings-module-group" aria-labelledby="settings-reminders-title">
                                        <h4 id="settings-reminders-title">Reminders</h4>
                                        <label class="settings-module"><input type="checkbox" id="reminders-enabled"> Enable due-date reminders</label>
                                        <p>Set a date and time in a due-date note’s menu. Browser notifications require permission and are delivered while PlanBraid is open.</p>
                                    </section>
                                </div>
                            </section>
                        </div>
                        <div class="settings-footer"><button type="button" onclick="closeModal()">Close</button></div>
                    </section>
                </div>`;
            root.querySelector('#change-password-button').onclick = () => showPasswordDialog(null);
            root.querySelector('#account-email-button').onclick = showAccountEmail;
            const tagsCheckbox = root.querySelector('#tags-enabled');
            const zoomCheckbox = root.querySelector('#node-zoom-enabled');
            const agendaCheckbox = root.querySelector('#agenda-enabled');
            agendaCheckbox.checked = state.settings.agendaNotesEnabled;
            const setAgendaEnabled = enabled => {
                state.settings.agendaNotesEnabled = enabled;
                if (!enabled && currentView === 'agenda') currentView = 'project';
                scheduleSave();
                render();
                updatePdfAvailability();
            };
            agendaCheckbox.onchange = () => {
                if (!agendaCheckbox.checked && agendaDraft?.workspace === state) {
                    if (hasUnsavedAgendaDraft()) closeModal();
                    if (!closeAgendaEditor()) return;
                }
                setAgendaEnabled(agendaCheckbox.checked);
            };
            const agendaSpreadsheetsCheckbox = root.querySelector('#agenda-spreadsheets-enabled');
            agendaSpreadsheetsCheckbox.checked = state.settings.agendaSpreadsheetsEnabled;
            agendaSpreadsheetsCheckbox.onchange = () => {
                if (!agendaSpreadsheetsCheckbox.checked && agendaDraft?.workspace === state && agendaDraft.sheetDirty()) {
                    agendaSpreadsheetsCheckbox.checked = true;
                    showToast('Save or cancel your spreadsheet edits before turning spreadsheets off.');
                    return;
                }
                state.settings.agendaSpreadsheetsEnabled = agendaSpreadsheetsCheckbox.checked;
                scheduleSave();
                if (currentView === 'agenda' || currentView === 'project') renderAgendaCards();
            };
            const priorityCheckbox = root.querySelector('#priority-enabled');
            const pmCheckbox = root.querySelector('#pm-enabled');
            const pmBoardCheckbox = root.querySelector('#pm-board-enabled');
            const pmSeparateTasksCheckbox = root.querySelector('#pm-separate-tasks-enabled');
            const pmProgressPanelCheckbox = root.querySelector('#pm-progress-panel-enabled');
            const pmSiteInfoCheckbox = root.querySelector('#pm-site-info-enabled');
            const templatesCheckbox = root.querySelector('#templates-enabled');
            const remindersCheckbox = root.querySelector('#reminders-enabled');
            const dashboardSections = [
                [root.querySelector('#dashboard-pinned'), 'dashboardPinned'],
                [root.querySelector('#dashboard-priority'), 'dashboardPriority'],
                [root.querySelector('#dashboard-due'), 'dashboardDue']
            ];
            const tagManagement = root.querySelector('#settings-tag-management');
            const sidebarPriorityCheckbox = root.querySelector('#sidebar-priority');
            for (const [input, key] of [[root.querySelector('#sidebar-all-notes'), 'sidebarAllNotes'], [root.querySelector('#sidebar-starred'), 'sidebarStarred'], [sidebarPriorityCheckbox, 'sidebarPriority']]) {
                input.checked = state.settings[key];
                input.onchange = () => {
                    state.settings[key] = input.checked;
                    scheduleSave();
                    renderSidebar();
                };
            }
            root.querySelector('#tag-color-unavailable').hidden = tagColorSupported;
            const theme = root.querySelector('#theme-select');
            const design = root.querySelector('#design-select');
            const fontSelect = root.querySelector('#font-size-select');
            fontSelect.value = fontSize;
            fontSelect.onchange = () => setFontSize(fontSelect.value);
            const outlineCollapse = root.querySelector('#project-outline-collapse-enabled');
            outlineCollapse.checked = state.settings.projectOutlineCollapseEnabled;
            outlineCollapse.onchange = () => {
                state.settings.projectOutlineCollapseEnabled = outlineCollapse.checked;
                if (!outlineCollapse.checked) collapsedProjectOutlines.clear();
                scheduleSave();
                render();
            };
            root.querySelector('#settings-export-backup').onclick = exportBackup;
            root.querySelector('#settings-import-backup').onclick = () => document.getElementById('import-input').click();
            const pdfButton = root.querySelector('#export-pdf');
            function updatePdfAvailability() {
                pdfButton.disabled = currentView !== 'project';
                pdfButton.title = pdfButton.disabled ? 'Open a project to export its outline' : '';
                root.querySelector('#settings-pdf-hint').hidden = !pdfButton.disabled;
            }
            updatePdfAvailability();
            pdfButton.onclick = () => showExportPreview(true);
            theme.value = state.settings.theme;
            design.value = state.settings.design;
            design.onchange = () => {
                if (!DESIGNS.includes(design.value)) {
                    showToast('Could not change appearance: invalid design.');
                    return;
                }
                state.settings.design = design.value;
                applyDesign(design.value);
                scheduleSave();
            };
            theme.onchange = () => {
                if (!['light', 'dark', 'sepia'].includes(theme.value)) {
                    showToast('Could not change appearance: invalid theme.');
                    return;
                }
                state.settings.theme = theme.value;
                document.documentElement.dataset.theme = theme.value;
                scheduleSave();
            };
            priorityCheckbox.checked = state.settings.priorityEnabled;
            sidebarPriorityCheckbox.disabled = !priorityCheckbox.checked;
            function updateDashboardSectionAvailability() {
                dashboardSections.forEach(([input, key]) => {
                    input.disabled = key === 'dashboardPriority' && !priorityCheckbox.checked;
                });
            }
            dashboardSections.forEach(([input, key]) => {
                input.checked = state.settings[key];
                input.onchange = () => {
                    state.settings[key] = input.checked;
                    scheduleSave();
                    render();
                };
            });
            updateDashboardSectionAvailability();
            priorityCheckbox.onchange = () => {
                state.settings.priorityEnabled = priorityCheckbox.checked;
                sidebarPriorityCheckbox.disabled = !priorityCheckbox.checked;
                updateDashboardSectionAvailability();
                scheduleSave();
                render();
                updatePdfAvailability();
            };
            pmCheckbox.checked = state.settings.pmEnabled;
            pmBoardCheckbox.checked = state.settings.pmBoardEnabled;
            pmSeparateTasksCheckbox.checked = state.settings.pmSeparateTasksEnabled;
            pmProgressPanelCheckbox.checked = state.settings.pmProgressPanelEnabled;
            pmSiteInfoCheckbox.checked = state.settings.pmSiteInfoEnabled;
            pmBoardCheckbox.disabled = !pmCheckbox.checked;
            pmSeparateTasksCheckbox.disabled = !pmCheckbox.checked;
            pmProgressPanelCheckbox.disabled = !pmCheckbox.checked;
            pmSiteInfoCheckbox.disabled = !pmCheckbox.checked;
            pmCheckbox.onchange = () => {
                state.settings.pmEnabled = pmCheckbox.checked;
                pmBoardCheckbox.disabled = !pmCheckbox.checked;
                pmSeparateTasksCheckbox.disabled = !pmCheckbox.checked;
                pmProgressPanelCheckbox.disabled = !pmCheckbox.checked;
                pmSiteInfoCheckbox.disabled = !pmCheckbox.checked;
                scheduleSave();
                render();
                updatePdfAvailability();
            };
            pmProgressPanelCheckbox.onchange = () => {
                state.settings.pmProgressPanelEnabled = pmProgressPanelCheckbox.checked;
                scheduleSave();
                render();
            };
            pmSiteInfoCheckbox.onchange = () => {
                state.settings.pmSiteInfoEnabled = pmSiteInfoCheckbox.checked;
                scheduleSave();
                render();
            };
            pmSeparateTasksCheckbox.onchange = () => {
                state.settings.pmSeparateTasksEnabled = pmSeparateTasksCheckbox.checked;
                if (pmSeparateTasksCheckbox.checked) {
                    state.documents.filter(doc => doc.pmProject && doc.pmTasks === undefined).forEach(doc => { doc.pmTasks = copyOutlinePMTasks(doc); });
                }
                scheduleSave();
                render();
            };
            pmBoardCheckbox.onchange = () => {
                state.settings.pmBoardEnabled = pmBoardCheckbox.checked;
                if (!pmBoardCheckbox.checked) pmBoardViewDocuments.clear();
                scheduleSave();
                render();
            };
            templatesCheckbox.checked = state.settings.templatesEnabled;
            templatesCheckbox.onchange = () => {
                state.settings.templatesEnabled = templatesCheckbox.checked;
                scheduleSave();
                render();
            };
            remindersCheckbox.checked = state.settings.remindersEnabled;
            remindersCheckbox.onchange = async () => {
                remindersCheckbox.disabled = true;
                try {
                    if (remindersCheckbox.checked) await requestReminderPermission();
                    state.settings.remindersEnabled = remindersCheckbox.checked;
                    scheduleSave();
                    render();
                } catch (error) {
                    console.error('Could not enable the Reminders module:', error);
                    remindersCheckbox.checked = false;
                    showToast(error.message);
                } finally {
                    remindersCheckbox.disabled = false;
                }
            };
            zoomCheckbox.checked = state.settings.nodeZoomEnabled;
            zoomCheckbox.onchange = () => {
                state.settings.nodeZoomEnabled = zoomCheckbox.checked;
                scheduleSave();
                render();
            };
            function renderTagManagement(focusTag) {
                tagManagement.hidden = !state.settings.tagsEnabled;
                const list = root.querySelector('#settings-tag-list');
                list.replaceChildren();
                if (!state.settings.tagsEnabled) return;
                const counts = collectTags();
                const hidden = new Set(state.settings.hiddenTags);
                const tags = [...new Set([...counts.keys(), ...hidden])].sort((a, b) => a.localeCompare(b));
                if (!tags.length) {
                    const empty = document.createElement('p');
                    empty.textContent = 'No tags yet. Add a hashtag such as #work to a node or note.';
                    list.appendChild(empty);
                }
                tags.forEach(tag => {
                    const row = document.createElement('div');
                    row.className = 'settings-tag-row';
                    const name = document.createElement('span');
                    name.className = 'tag-name';
                    name.textContent = `${tag} (${counts.get(tag) || 0})`;
                    name.title = tag;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = hidden.has(tag) ? 'Restore' : 'Hide';
                    button.setAttribute('aria-label', `${button.textContent} ${tag}`);
                    button.onclick = () => {
                        if (hidden.has(tag)) state.settings.hiddenTags = state.settings.hiddenTags.filter(item => item !== tag);
                        else state.settings.hiddenTags.push(tag);
                        if (currentView === 'tag' && selectedTag === tag && !hidden.has(tag)) currentView = 'project';
                        scheduleSave();
                        render();
                        updatePdfAvailability();
                        renderTagManagement(tag);
                    };
                    row.append(name, button);
                    list.appendChild(row);
                    if (tag === focusTag) button.focus();
                });
            }
            tagsCheckbox.checked = state.settings.tagsEnabled;
            tagsCheckbox.onchange = () => {
                state.settings.tagsEnabled = tagsCheckbox.checked;
                if (!tagsCheckbox.checked && currentView === 'tag') currentView = 'project';
                scheduleSave();
                render();
                updatePdfAvailability();
                renderTagManagement();
            };
            renderTagManagement();
            theme.focus();
            if (fontSizeStorageError) showToast('Font size preferences are unavailable on this device.');
        }
