/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        async function requestReminderPermission() {
            if (!('Notification' in window)) throw new Error('This browser does not support notifications.');
            if (Notification.permission === 'granted') return;
            if (Notification.permission === 'denied') throw new Error('Notifications are blocked. Allow them for PlanBraid in your browser settings.');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') throw new Error('Allow browser notifications to use reminders.');
            reminderPermissionNoticeShown = false;
        }
        function localDateTimeValue(timestamp) {
            const date = new Date(timestamp);
            if (!Number.isFinite(date.getTime())) return '';
            return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        function showReminderDialog(doc, id, returnFocus) {
            const location = findNode(id, doc.nodes);
            if (!location || !location.node.dueDate || !state.settings.remindersEnabled) return;
            const node = location.node;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal reminder-modal" role="dialog" aria-modal="true" aria-labelledby="reminder-title" aria-describedby="reminder-description">
                        <h2 id="reminder-title">${node.reminderAt ? 'Edit reminder' : 'Set reminder'}</h2>
                        <p id="reminder-description"></p>
                        <form class="reminder-form">
                            <label for="reminder-time">Notify me</label>
                            <input id="reminder-time" type="datetime-local" required>
                            <p class="reminder-message" role="status" aria-live="polite"></p>
                            <div class="space-form-actions">
                                <button type="button" class="cancel-reminder">Cancel</button>
                                <button type="submit" class="create-space save-reminder">Save reminder</button>
                                <button type="button" class="clear-reminder">Clear reminder</button>
                            </div>
                        </form>
                    </section>
                </div>`;
            root.querySelector('#reminder-description').textContent = `Choose a date and time for “${node.text.trim() || 'Untitled note'}”. Notifications use this device’s local time and arrive while PlanBraid is open.`;
            const input = root.querySelector('#reminder-time');
            input.value = node.reminderAt ? localDateTimeValue(node.reminderAt) : `${node.dueDate}T09:00`;
            const clearButton = root.querySelector('.clear-reminder');
            clearButton.hidden = !node.reminderAt;
            const close = () => {
                closeModal();
                if (returnFocus.isConnected) returnFocus.focus();
            };
            root.querySelector('.cancel-reminder').onclick = close;
            root.querySelector('.modal-backdrop').onclick = event => {
                if (event.target === event.currentTarget) close();
            };
            clearButton.onclick = () => {
                node.reminderAt = '';
                node.reminderNotifiedAt = '';
                markNodeEdited(node);
                scheduleSave();
                closeModal();
                render();
                document.querySelector(`[data-node-id="${CSS.escape(id)}"] > .node-row .node-menu summary`)?.focus();
                showToast('Reminder cleared.');
            };
            root.querySelector('.reminder-form').onsubmit = async event => {
                event.preventDefault();
                const message = root.querySelector('.reminder-message');
                const currentDoc = state.documents.find(item => item.id === doc.id);
                const current = currentDoc && findNode(id, currentDoc.nodes);
                const reminderDate = new Date(input.value);
                if (!current || !current.node.dueDate || !state.settings.remindersEnabled) {
                    message.textContent = 'This note’s due date or the Reminders module changed. Close this dialog and try again.';
                    return;
                }
                if (!input.value || !Number.isFinite(reminderDate.getTime())) {
                    message.textContent = 'Choose a valid reminder date and time.';
                    return;
                }
                const button = root.querySelector('.save-reminder');
                button.disabled = true;
                try {
                    await requestReminderPermission();
                    current.node.reminderAt = reminderDate.toISOString();
                    current.node.reminderNotifiedAt = '';
                    markNodeEdited(current.node);
                    scheduleSave();
                    closeModal();
                    render();
                    document.querySelector(`[data-node-id="${CSS.escape(id)}"] > .node-row .node-menu summary`)?.focus();
                    showToast('Reminder saved.');
                } catch (error) {
                    console.error('Could not enable reminder notifications:', error);
                    message.textContent = error.message;
                } finally {
                    if (button.isConnected) button.disabled = false;
                }
            };
            input.focus();
        }
        function checkReminders() {
            if (!authenticated || !state.settings.remindersEnabled) return;
            const pending = state.documents.flatMap(doc => allNodes(doc.nodes).map(({ node }) => ({ doc, node })))
                .filter(({ node }) => node.reminderAt && !node.reminderNotifiedAt && !node.completed && Date.parse(node.reminderAt) <= Date.now());
            if (!pending.length) return;
            if (!('Notification' in window) || Notification.permission !== 'granted') {
                if (!reminderPermissionNoticeShown) {
                    reminderPermissionNoticeShown = true;
                    showToast('A reminder is due, but browser notifications are unavailable or blocked.');
                }
                return;
            }
            pending.forEach(({ doc, node }) => {
                try {
                    const notification = new Notification(node.text.trim() || 'Untitled note', {
                        body: `${doc.title} · Due ${node.dueDate}`,
                        tag: `smart-list-reminder-${node.id}`
                    });
                    node.reminderNotifiedAt = new Date().toISOString();
                    markNodeEdited(node);
                    scheduleSave();
                    notification.onclick = () => {
                        window.focus();
                        selectDocument(doc.id);
                        focusRequest = { id: node.id, end: false };
                        render();
                        notification.close();
                    };
                } catch (error) {
                    console.error('Could not show a due-date reminder:', error);
                    showToast(`Could not show reminder: ${error.message}`);
                }
            });
        }
