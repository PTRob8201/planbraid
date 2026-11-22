/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function showWelcomeGuide() {
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
                <h2 id="welcome-title">Welcome to PlanBraid</h2>
                <p>Write a note, press Enter to add another, and use Tab or Shift+Tab to nest or unnest notes. Open a note's menu for more actions.</p>
                <p>Dashboard and Continuum are available in the sidebar. To turn optional features on or off, open More options in the top-right corner, choose Settings, then find Modules.</p>
                <p>Add an optional email under More options → Settings → Account email. Contact your administrator if you need a password reset. Find detailed help under More options → Guide and FAQ.</p>
                <p class="account-message" role="status" aria-live="polite"></p>
                <div class="space-form-actions"><button type="button" class="guide-settings">Open module settings</button><button type="button" class="guide-done">Got it</button></div>
                </section></div>`;
            async function finish(openSettings) {
                const buttons = root.querySelectorAll('button');
                buttons.forEach(button => { button.disabled = true; });
                try {
                    await api('guide-dismiss', {});
                    if (openSettings) {
                        showSettings();
                        document.getElementById('settings-modules-title').scrollIntoView({ block: 'start' });
                    } else closeModal();
                } catch (error) {
                    root.querySelector('.account-message').textContent = `Could not save guide status: ${error.message}`;
                    buttons.forEach(button => { button.disabled = false; });
                }
            }
            root.querySelector('.guide-settings').onclick = () => finish(true);
            root.querySelector('.guide-done').onclick = () => finish(false);
            root.querySelector('.guide-done').focus();
        }
        function closeUserGuide() {
            closeModal();
            document.querySelector('#top-menu summary').focus();
        }
        function showUserGuide() {
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal settings-modal guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
                        <div class="settings-header"><h2 id="guide-title">PlanBraid guide and FAQ</h2></div>
                        <div class="settings-body">
                            <p>Explore a topic or search for a word. Features marked as modules may need to be enabled first.</p>
                            <label class="guide-search">Search guide and questions<input type="search" placeholder="For example: reminders or backup" autocomplete="off"></label>
                            <p class="guide-status" role="status" aria-live="polite"></p>
                            <section class="guide-group" aria-labelledby="guide-topics">
                                <h3 class="guide-group-title" id="guide-topics">Using PlanBraid</h3>
                                <details class="guide-entry"><summary>Getting started and finding your way</summary>
                                    <ol><li>Sign in with your account. If an administrator gave you a temporary password, change it when prompted before opening your workspace.</li>
                                    <li>Use the sidebar to select a space and project. A space groups projects; a project contains an outline of notes and sub-notes.</li>
                                    <li>Choose the note-plus icon at the top-right of a project, type your idea, and press Enter to add another at the same level. Use Tab to nest a note and Shift+Tab to move it out.</li>
                                    <li>Use the visible three-dot menu on the left of a note to open its actions.</li></ol>
                                    <p><strong>More options</strong> is in the top-right corner and contains Settings, account actions, this guide, and save status. Release history is in its Help group, next to License. Use <strong>Settings → Sidebar</strong> to show or hide the All notes, Starred, and Priority shortcuts. All notes returns to your active project. The Priority shortcut requires the Priority module. Scroll the spaces list with a wheel, trackpad, or touch; its scrollbar is hidden. On a narrow screen, open the sidebar with the top-left button.</p>
                                </details>
                                <details class="guide-entry"><summary>Spaces and projects</summary>
                                    <p>Choose <strong>New space</strong> above the spaces list in the sidebar. Use a space's plus button to create a project, or its three-dot menu for space actions and <strong>Create from template</strong> when a suitable module is enabled. New projects open a rename dialog.</p>
                                    <p>Use the edit icon beside a project's title to rename it from the project page. You can also use its sidebar menu to rename, move or delete it. Moving a project requires another space. Deleting a project also deletes its notes; deleting a space deletes all its projects and notes. Both require confirmation. If no projects remain, an empty project is created. Keep a backup before deleting important content.</p>
                                </details>
                                <details class="guide-entry"><summary>Notes, nesting, completion and progress</summary>
                                    <p>Each outline item is a note. Tap or click its text to edit it. Enter adds a note at the same level; Tab and Shift+Tab change its nesting. Use <strong>Add a note at this level</strong> in the note menu to create a sibling, or <strong>Add a sub-note</strong> to create a child. Use <strong>Move under…</strong> to move a note and its sub-notes beneath another note in the same project. Click the dot beside a note with sub-notes to collapse or expand the branch. A ring around the dot indicates collapsed sub-notes.</p>
                                    <p>Choose <strong>Move with arrows</strong> in a note's menu to show up/down arrows beside it, then use the check button to finish. The note and its sub-notes move through visible positions and may change parent; moving down past an expanded parent places it before that parent's first child. Clear outline filters first. Moves stay within the current project and zoomed outline.</p>
                                    <p>Use the add-note and hide-completed buttons on the Outline line to add a note or hide completed notes. Open the nine-dot menu there for project tools and filters. Use Expand all / Collapse all to expand or collapse all branches in the project. When zoomed, they affect only branches within the zoomed note; the zoomed note itself stays open. Clear priority and hide-completed filters first, because those filters automatically expand matching branches.</p>
                                    <p>Use the note menu to mark it complete or reopen it. All sub-notes must be complete before a parent can be completed. Reopening or moving an active sub-note under a completed parent reopens the parent. Deleting a note also deletes its sub-notes and requires confirmation.</p>
                                    <p>Choose <strong>Make progress node</strong> in the note menu to show automatic progress for its descendants; use <strong>Remove progress node</strong> to stop. Counts include collapsed and filtered descendants. A progress node without sub-notes remains incomplete; it cannot also be a PM task.</p>
                                </details>
                                <details class="guide-entry"><summary>Outline note descriptions</summary>
                                    <p>Each outline item can have one longer note. Use <strong>Simple note</strong> in its menu to edit the first line inline; other lines are retained. Select the preview beneath the item to open the full note read-only, then use its pencil to edit.</p>
                                    <p>The pencil opens a plain-text editor. Existing formatting is kept in the read-only preview unless you edit the text and confirm the conversion.</p>
                                </details>
                                <details class="guide-entry"><summary>Search, stars and project filters</summary>
                                    <p>Use the magnifying glass in the top bar to find outline text and, when Scratchpad is enabled, Scratchpad note titles and text. Command+K on Mac or Ctrl+K on Windows opens and focuses search. Press Escape to close it, or select a result to open the note.</p>
                                    <p>Star important notes from their menus; the sidebar's <strong>Starred</strong> view collects them. Priority, stars, due dates, progress and PM details appear beneath the note. In a project, use the nine-dot menu on the Outline line → <strong>Project filters</strong> to show starred notes, hide completed notes, or filter by priority when Priority is enabled. Clear the filters to see the rest again.</p>
                                </details>
                                <details class="guide-entry"><summary>Turning modules on and off</summary>
                                    <ol><li>Open <strong>More options</strong> in the top-right corner and choose <strong>Settings</strong>.</li><li>Scroll to <strong>Modules</strong> and select the features you want.</li><li>Close Settings. Changes are saved with your workspace.</li></ol>
                                    <p>Available modules include Tags, Scratchpad, Priority, Project management, Project templates and Reminders. Dashboard and Continuum are always available; their options are in separate Settings sections. Turning a module off hides its controls rather than deleting its saved content. Existing workspaces keep their other settings.</p>
                                </details>
                                <details class="guide-entry"><summary>Scratchpad</summary>
                                    <p>Enable <strong>Scratchpad</strong> in Modules, then choose <strong>Scratchpad</strong> below Continuum in the sidebar. The first line is the title, and the rich-text body grows as you type. Optionally link a note to a project. Created appears at the top right of each card, even when collapsed; the three-dot information menu shows Modified and any older <strong>Previous date</strong>. Cards remain sorted by most recent activity.</p>
                                    <p>Each project also shows its linked Scratchpad cards below its outline. Use the Outline arrow to collapse or expand the entire outline; enable or disable this arrow in Settings → Project outline. Add or edit cards there; a new card starts linked to that project. These are the same notes shown in Scratchpad.</p>
                                    <p>Changes save automatically when you leave the editor within PlanBraid. Use <strong>Discard changes</strong> to close the editor without saving.</p>
                                    <p><strong>Save note</strong> stays beside the project selector. The scrolling icon toolbar groups tools into <strong>Formatting</strong>, <strong>Insert</strong>, and <strong>Note actions</strong>. Choose <strong>Text formatting tools</strong> to show or hide text controls. The highlight icon opens five colors and a <strong>No color</strong> icon for selected text. Scratchpad counts use note cards, including project-linked counts. Use the toolbar arrows or swipe to find each group. Add a picture or one spreadsheet at the text cursor. Files can be up to 256 KB; <strong>Add image</strong> resizes or compresses oversized supported images. Pictures can have descriptions, and attachments are included in backups.</p>
                                    <p>From <strong>Share note</strong>, copy the text or download a PDF with pictures and captions. The system share sheet is available for the PDF on supported devices.</p>
                                    <p>In the note body, type <code>##</code>, <code>-</code>, or <code>1.</code> followed by a space for a heading, bullet, or numbered list. Type <code>**text**</code> for bold. Enter continues a list or checklist, and Enter on the empty last item exits it. In bulleted and numbered lists, Tab / Shift+Tab nests or unnests items where possible.</p>
                                    <p>Use the <strong>Share note</strong> icon on a saved card to preview and copy its text, or send a snapshot when your browser offers device sharing. Check <strong>Include spreadsheet</strong> to add any calculated spreadsheet values. No link is created.</p>
                                    <p>Turn off <strong>Enable spreadsheets in Scratchpad</strong> in Modules to hide grids and their controls without deleting them.</p>
                                    <p>Turning off Scratchpad hides it without deleting anything. Notes stay in your workspace and backups. If you delete a linked project, its Scratchpad notes are kept without the project link.</p>
                                </details>
                                <details class="guide-entry"><summary>PlanBraid PM shared tracker</summary>
                                    <p>Choose <strong>PlanBraid PM</strong> in the sidebar to manage a shared tracker of projects, milestones, and tasks. An administrator must enable PM for your account. Use its separate New Project and New Milestone buttons, or its right-hand menu for the JSON Schema inspector. It is separate from the optional Project management module and from your private outline workspace.</p>
                                    <p>The tracker starts empty. If someone else saves while you are editing, your change is rejected and the latest data is loaded; review and retry. Server database backups include this tracker, but individual workspace exports do not.</p>
                                </details>
                                <details class="guide-entry"><summary>Dashboard, tags and priorities</summary>
                                    <p><strong>Dashboard</strong> opens a summary on sign-in and is always available in the sidebar. When project management is enabled, Important tasks shows active starred or prioritized PM tasks from the active task source. For outline tasks, priority requires the Priority module. Its optional note sections show starred notes, active priority notes, and active notes overdue or due within seven days. Empty sections are hidden. Select a result to open its project and task or note.</p>
                                    <p>Enable <strong>Tags</strong> and type a hashtag such as #work in a title or full note. Select a tag in the sidebar to see matches across projects. Tags are case-insensitive; you can hide or restore discovered tags in Settings without changing the text.</p>
                                    <p>Enable <strong>Priority</strong>, then use a note's menu to choose no priority, low, medium or high. The sidebar Priority view lists active prioritized notes; completed notes are hidden there until reopened. Turning the module off retains priorities.</p>
                                </details>
                                <details class="guide-entry"><summary>Due dates and reminders</summary>
                                    <p>Set a due date from the note menu. To add a reminder, enable <strong>Reminders</strong>, choose <strong>Set reminder…</strong> on a note with a due date, and select a date and time. Allow browser notifications when prompted.</p>
                                    <p>Reminders use the active device's local time zone and are delivered while PlanBraid is open. Overdue reminders are checked when the app opens or returns to the foreground. Changing or clearing a due date clears its reminder.</p>
                                </details>
                                <details class="guide-entry"><summary>Continuum and node zoom</summary>
                                    <p>Choose <strong>Continuum</strong> in the sidebar to view and edit projects in one continuous outline. Select a project title to open its regular project view. Continuum has its own Hide completed / Show completed control; it does not use project filters, and its filter resets after refresh.</p>
                                    <p>Enable <strong>Node zoom</strong> under Settings → Continuum, then choose <strong>Zoom into note</strong> from a note's menu to focus on its branch. Breadcrumbs take you back; in project view they appear in the top header. Zoom works in Continuum and project views.</p>
                                </details>
                                <details class="guide-entry"><summary>Project templates and custom fields</summary>
                                    <ol><li>Enable <strong>Project templates</strong> in Settings → Modules, then choose <strong>Project templates</strong> in More options.</li><li>Add or edit a template. Configure and reorder text, number, date, checkbox or dropdown fields; choose auto width or a fixed width. Enter starter outline notes one per line, using two spaces per nesting level.</li><li>Save the template. In a space menu, choose <strong>Create from template</strong>, select it and name the project. Edit its fields below the project subtitle.</li></ol>
                                    <p>Changes to a template affect newly created projects, not existing projects. Deleting a template does not delete projects made from it. The built-in PM template is controlled by the separate Project management module.</p>
                                </details>
                                <details class="guide-entry"><summary>Project management: sites, tasks and field notes</summary>
                                    <ol><li>Enable <strong>Project management</strong> in Settings → Modules. To start a new PM project, choose <strong>Create from template</strong> in a space menu and select Project management. It starts with an empty outline.</li><li>For an existing project, open it and choose <strong>Add PM status</strong> in the project menu. The outline stays unchanged.</li><li>Use <strong>Edit site</strong> in the site information section for site details, including start date, scope summary and meeting day.</li><li>When separate tasks are disabled, use a note's menu for <strong>Task status</strong>, due date, assignee and field notes. Click the field-note count to show or hide notes beneath the item.</li><li>Use the task view icons to switch between outline and Board. Board organizes the same saved tasks into status columns; drag a card to move it or return to Outline to edit it.</li></ol>
                                    <p>Enable <strong>Separate project tasks</strong> in Project management settings to add an independent Tasks section below each PM project outline. Existing outline tasks are copied once, including status, assignee, due date, plain-text description and field notes; outline notes remain unchanged. The copies do not sync with the outline. While enabled, project progress and Board use the separate tasks. Turning it off hides progress and restores the outline-based Board, without deleting either set.</p>
                                    <p>While separate tasks are enabled, PM-specific actions are hidden from outline menus. The normal note due-date action remains available.</p>
                                    <p>Separate tasks have checkboxes and compact details. Click a checkbox to cycle from To do to In progress to Blocked to Done and back to To do. Blocked replaces Waiting; existing Waiting tasks become Blocked when a workspace is opened or imported. Older versions may reject saved Blocked statuses. Use the three-dot task menu on the left to mark a task important; only marked tasks show a star. Edit titles directly; use the task menu to set priority, edit details, add sub-tasks, indent or outdent, manage field notes, collapse branches, or delete a task and its sub-tasks. Descriptions appear under task titles; click the field-note count to show or hide saved notes. Details and new tasks are entered inline. Click Tasks to collapse or expand the section; its view, show/hide-completed and add controls are on the right. Click Outline to collapse or expand it when outline collapse is enabled. The Tasks eye hides completed tasks in the task outline and board without changing progress or saved data. Complete all sub-tasks before completing their parent; reopening a sub-task reopens completed ancestors. Progress and Board include tasks at every level.</p>
                                    <p>Board cards show the task description, priority, assignee, due date and field-note count. Drag a card by its handle to another status column or a position within a column. For keyboard access, focus the handle and use left/right arrows to change status or up/down arrows to reorder. Board order is saved separately for outline and separate tasks; it does not change their hierarchy or outline order. Moving to Done still requires completed descendants.</p>
                                    <p>Use <strong>Show site information</strong> in Project management settings to show or hide the entire site section, including Edit site. <strong>Show project progress panel</strong> controls progress when separate tasks are enabled. With separate tasks off, progress is unavailable and that setting controls the Outline / Board switch; hiding it shows the outline instead of the board. PM Testing and automatic recurrence have been removed; existing tasks and saved recurrence data remain in the workspace and backups.</p>
                                    <p>Enable <strong>Board view</strong> under Project management in Settings → Modules to show the task view icons. The project outline stays visible when the task board is open. Turning Board off preserves tasks and statuses. The progress bar counts separate tasks, including hidden or collapsed ones. The normal parent completion rule still applies. Field notes start collapsed after a refresh. <strong>Remove PM status</strong> hides project PM features but preserves their data; add it again to restore them. Disabling the module also retains data.</p>
                                </details>
                                <details class="guide-entry"><summary>Appearance, mobile and keyboard shortcuts</summary>
                                    <p>Choose Classic, Studio, Modern, Minimal, Vibrant or Fusion design and Light, Dark or Sepia theme under Settings → Appearance. Design and theme are saved with the workspace. Font size is saved only in the current browser on this device; change it in Settings or with the text-size actions in the project menu.</p>
                                    <p>On a touch screen, swipe right from the left edge to open the sidebar, or swipe left on the sidebar to close it. Your browser may reserve the very edge for navigation; the sidebar button remains available. On narrow screens the sidebar opens over the outline and can also be closed with its close button, by tapping outside it, or with Escape. Choose <strong>Keyboard shortcuts</strong> in More options for the shortcut list.</p>
                                    <ul><li>Enter: add a note at the same level.</li><li>Tab / Shift+Tab: nest / unnest a note.</li><li>Command+Enter or Ctrl+Enter: mark a note complete.</li><li>Command+K or Ctrl+K: search.</li><li>Backspace on an empty note: delete it.</li></ul>
                                </details>
                                <details class="guide-entry"><summary>Saving, backups, importing and exporting</summary>
                                    <p>Changes save to your account's database workspace. If the connection drops, continue editing in the open tab; pending changes are stored on this device and retried when connected. Check the save status. Reopening requires an online sign-in. PlanBraid PM and Supply require a connection.</p>
                                    <p>Offline copies are not encrypted and browser storage can be cleared or evicted. Signing out requires a server connection. If you sign out with unsynced changes, choose whether to keep or discard them. After signing in, choose <strong>More options → Recover offline changes</strong> to restore a copy when the server revision matches, or export it for review. Restored copies remain until explicitly deleted. Workspaces have a 5 MB limit per save.</p>
                                    <p>Use <strong>Settings → Export backup</strong> regularly to download a full workspace backup. Store it privately. <strong>Import backup</strong> replaces your current workspace after confirmation: export the current workspace first if you need to keep it. Account email, password and guide completion are not part of a workspace backup.</p>
                                    <p>To share or print an outline, use <strong>Project menu → Export visible outline</strong> or <strong>Settings → Export visible outline</strong> from a project. Preview and copy or save text or Markdown, or use Save as PDF and the browser print dialog. Export follows filters, collapsed branches and project zoom; it is not a full workspace backup and is unavailable in global views.</p>
                                </details>
                                <details class="guide-entry"><summary>Accounts, privacy and administrator actions</summary>
                                    <p>Each account has a separate outline workspace; the PlanBraid PM tracker is shared by accounts with PM access. PlanBraid does not provide outline project sharing or invitations. The server or database administrator can access stored workspaces and reset users' passwords; account separation is not encryption.</p>
                                    <p>Use <strong>Change password</strong> or <strong>Account email</strong> in More options → Settings. Email is optional and visible to the administrator; it is not verified. PlanBraid does not send emails or password-reset links. Contact your administrator if you forget your password.</p>
                                    <p>Administrators can use <strong>Manage accounts</strong> to create, disable, re-enable and reset non-admin accounts, and to enable PM and Supply separately for each account. Core is always enabled; both extensions default to off. The Supply role selector appears when PM or Supply is selected; its technician, office, and administrator roles apply only to Supply. Hiding it does not change the stored role. Share temporary passwords securely. New and reset accounts must change the temporary password before opening their workspace. Passwords must be 12–72 UTF-8 bytes and the new password must differ from the current one. Resets and disabling accounts sign out existing sessions, so ask users to save first.</p>
                                </details>
                            </section>
                            <section class="guide-group" aria-labelledby="guide-faq">
                                <h3 class="guide-group-title" id="guide-faq">Common questions</h3>
                                <details class="guide-entry"><summary>Where did a feature or menu go?</summary><p>Many features are optional. Open More options → Settings → Modules and enable the module you need. PM actions also require a PM project; open a project and use Add PM status. Disabling a module does not delete its saved data.</p></details>
                                <details class="guide-entry"><summary>Why can't I complete a parent note?</summary><p>Complete all its sub-notes first, including any hidden or collapsed descendants. A progress node is automatic and requires at least one sub-note; its progress counts all descendants.</p></details>
                                <details class="guide-entry"><summary>Why are some notes missing?</summary><p>Expand collapsed branches and check Project filters for starred-only, completed or priority filters. Continuum has a separate completed filter. Switching a module off can hide its views without deleting saved data.</p></details>
                                <details class="guide-entry"><summary>Why does PM progress show zero or not count a note?</summary><p>With separate project tasks enabled, progress counts only tasks in the Tasks section. Otherwise it counts outline notes marked with a PM task status. Regular notes and automatic progress nodes are not PM tasks.</p></details>
                                <details class="guide-entry"><summary>Why didn't a template edit update my project?</summary><p>Template changes apply to new projects only. Existing projects keep their own fields and outline; edit those directly. The PM template is controlled by the Project management module, not the Project templates switch.</p></details>
                                <details class="guide-entry"><summary>Where can I edit with formatting?</summary><p>Rich-text editing is available in Scratchpad. Outline note previews retain older formatting until you confirm a plain-text edit.</p></details>
                                <details class="guide-entry"><summary>Why didn't I get a reminder?</summary><p>Check that Reminders is enabled, the note still has its due date and reminder, browser notifications are allowed, and PlanBraid is open. Reminders use the active device's local time. Changing the due date clears its reminder.</p></details>
                                <details class="guide-entry"><summary>What if my changes are not saving?</summary><p>Check the database and save status in More options; click the database indicator to retry. If saving is blocked or another session changed the workspace, export your unsaved workspace backup before reconnecting or reloading, and contact your administrator if the problem persists. A save cannot exceed 5 MB.</p></details>
                                <details class="guide-entry"><summary>Why was this window disconnected?</summary><p>Only one PlanBraid window or device can be active per account. Connecting in another instance takes over. The disconnected window offers an export of unsaved changes; export them before reconnecting because reconnecting loads the latest saved workspace.</p></details>
                                <details class="guide-entry"><summary>Can I recover a forgotten password by email?</summary><p>No. Ask your administrator for a reset. After signing in with the temporary password, you must choose a different password before opening the workspace. Account email is optional and no reset emails are sent.</p></details>
                                <details class="guide-entry"><summary>Is a visible-outline export the same as a backup?</summary><p>No. A visible-outline export reflects the current project, filters, collapsed branches and zoom. Export backup contains the full workspace and can be imported later. Import replaces the current workspace, so export it first if needed.</p></details>
                                <details class="guide-entry"><summary>Can I share a project with another account?</summary><p>No. Each account has its own workspace; project sharing and invitations are not available. A visible outline can be exported separately, but that does not create shared editing.</p></details>
                            </section>
                        </div>
                        <div class="settings-footer"><button type="button" class="guide-close">Close</button></div>
                    </section>
                </div>`;
            const search = root.querySelector('.guide-search input');
            const entries = [...root.querySelectorAll('.guide-entry')];
            const status = root.querySelector('.guide-status');
            const updateSearch = () => {
                const query = search.value.trim().toLocaleLowerCase();
                let count = 0;
                for (const entry of entries) {
                    const match = !query || entry.textContent.toLocaleLowerCase().includes(query);
                    entry.hidden = !match;
                    if (match) count++;
                }
                root.querySelectorAll('.guide-group').forEach(group => {
                    group.hidden = ![...group.querySelectorAll('.guide-entry')].some(entry => !entry.hidden);
                });
                status.textContent = query ? `${count} matching ${count === 1 ? 'topic' : 'topics'}.` : 'Select a topic to read more.';
            };
            search.addEventListener('input', updateSearch);
            root.querySelector('.guide-close').onclick = closeUserGuide;
            root.querySelector('.modal-backdrop').onclick = event => { if (event.target === event.currentTarget) closeUserGuide(); };
            updateSearch();
            search.focus();
        }
        function showReleaseHistory() {
            document.getElementById('modal-root').innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="release-title">
                        <h2 id="release-title">Release history</h2>
                        <div class="release-history"></div>
                        <button class="modal-close" onclick="closeModal()">Close</button>
                    </section>
                </div>`;
            const history = document.querySelector('#modal-root .release-history');
            if (typeof SMARTLIST_RELEASES === 'undefined' || !SMARTLIST_RELEASES.length) {
                history.textContent = 'Release history is unavailable. Check that version.js is installed.';
            } else {
                SMARTLIST_RELEASES.forEach(release => {
                    const title = document.createElement('h3');
                    title.textContent = `v${release.version} · ${release.date}`;
                    const list = document.createElement('ul');
                    list.className = 'release-list';
                    release.changes.forEach(change => {
                        const item = document.createElement('li');
                        item.textContent = change;
                        list.appendChild(item);
                    });
                    history.append(title, list);
                });
            }
            document.querySelector('#modal-root .modal-close').focus();
        }
        function showShortcuts() {
            document.getElementById('modal-root').innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
                        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
                        <p>Use the sidebar menus to rename or delete spaces and rename, move or delete projects. Use a note's menu to make it a progress node: it shows progress across all its sub-notes, including those hidden by filters, completes automatically when all its sub-notes are complete and reopens when they are not. A progress node without sub-notes stays incomplete. The menu also offers completion, priority, highlight, heading size, descriptions and due dates. Deleting a note requires confirmation and also deletes its sub-notes. Use Project menu → Project filters to filter notes. Use Export visible outline in the project menu or Settings to preview and copy the visible outline, or save it as PDF, text or Markdown.</p>
                        <div class="shortcut-list"></div>
                        <button class="modal-close" onclick="closeModal()">Got it</button>
                    </section>
                </div>`;
            const list = document.querySelector('#modal-root .shortcut-list');
            SHORTCUTS.forEach(shortcut => {
                const action = document.createElement('span');
                action.textContent = shortcut.action;
                const keys = document.createElement('kbd');
                keys.textContent = shortcut.keys;
                list.append(action, keys);
            });
            document.querySelector('#modal-root .modal-close').focus();
        }
