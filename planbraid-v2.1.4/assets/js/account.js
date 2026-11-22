/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        function passwordsMatch(password, confirmation) {
            const bytes = new TextEncoder().encode(password).length;
            if (bytes < 12 || bytes > 72 || password.includes('\0')) throw new Error('Password must be 12–72 bytes and contain no null characters.');
            if (password !== confirmation) throw new Error('Passwords do not match.');
        }
        function showPasswordDialog(user) {
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop">
                    <section class="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="password-title">
                        <div class="settings-header"><h2 id="password-title"></h2></div>
                        <div class="settings-body">
                            <form class="account-form" id="password-form">
                                <label id="current-password-label">Current password<input name="currentPassword" type="password" autocomplete="current-password"></label>
                                <label>New password<input name="password" type="password" autocomplete="new-password" required></label>
                                <label>Confirm new password<input name="confirmation" type="password" autocomplete="new-password" required></label>
                                <p>Use 12–72 bytes. Other signed-in sessions will be signed out; save their work first. After an administrator reset, the user must change the temporary password before accessing their workspace.</p>
                                <p class="account-message" role="status" aria-live="polite"></p>
                                <button type="submit">Save password</button>
                            </form>
                        </div>
                        <div class="settings-footer"><button type="button" class="password-cancel">Cancel</button></div>
                    </section>
                </div>`;
            root.querySelector('#password-title').textContent = user ? `Reset password: ${user.username}` : 'Change password';
            const form = root.querySelector('#password-form');
            const currentLabel = root.querySelector('#current-password-label');
            currentLabel.hidden = !!user;
            currentLabel.querySelector('input').required = !user;
            const cancel = () => user ? showAccounts() : closeModal();
            root.querySelector('.password-cancel').onclick = cancel;
            root.querySelector('.modal-backdrop').onclick = event => { if (event.target === event.currentTarget) cancel(); };
            form.onsubmit = async event => {
                event.preventDefault();
                const button = form.querySelector('button');
                const message = form.querySelector('.account-message');
                button.disabled = true;
                try {
                    const password = form.elements.password.value;
                    passwordsMatch(password, form.elements.confirmation.value);
                    const result = user
                        ? await api('account-reset-password', { userId: user.id, password })
                        : await api('change-password', { currentPassword: form.elements.currentPassword.value, password });
                    form.reset();
                    if (user) await showAccounts();
                    else closeModal();
                    showToast(result.message);
                } catch (error) {
                    message.textContent = error.message;
                } finally {
                    button.disabled = false;
                }
            };
            form.elements[user ? 'password' : 'currentPassword'].focus();
        }
        async function showAccounts() {
            if (!isAdministrator) return;
            const root = document.getElementById('modal-root');
            root.innerHTML = `
                <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
                    <section class="modal settings-modal accounts-modal" role="dialog" aria-modal="true" aria-labelledby="accounts-title">
                        <div class="settings-header"><h2 id="accounts-title">Manage accounts</h2></div>
                        <div class="settings-body">
                            <section class="settings-section">
                                <h3>Create account</h3>
                                <form class="settings-card account-form" id="account-create-form">
                                    <label>Username<input name="username" autocomplete="off" required minlength="3" maxlength="80" pattern="[A-Za-z0-9_\\-]+"></label>
                                    <label>Email (optional)<input name="email" type="email" maxlength="254" autocomplete="off"></label>
                                    <label>Temporary password<input name="password" type="password" autocomplete="new-password" required></label>
                                    <label>Confirm password<input name="confirmation" type="password" autocomplete="new-password" required></label>
                                    <p>Use 12–72 bytes. Share the temporary password securely; the user must change it before accessing their workspace.</p>
                                    <p>New accounts start with a Personal project.</p>
                                    <p class="account-message" role="status" aria-live="polite"></p>
                                    <button type="submit">Create account</button>
                                </form>
                            </section>
                            <section class="settings-section">
                                <h3>Accounts</h3>
                                <div class="settings-card"><p id="account-list-message" role="status" aria-live="polite">Loading accounts…</p><div class="account-list"></div></div>
                            </section>
                        </div>
                        <div class="settings-footer"><button type="button" onclick="closeModal()">Close</button></div>
                    </section>
                </div>`;
            const form = root.querySelector('#account-create-form');
            const list = root.querySelector('.account-list');
            const status = root.querySelector('#account-list-message');
            async function refreshAccounts() {
                status.textContent = 'Loading accounts…';
                try {
                    const result = await api('accounts-list', {});
                    if (!Array.isArray(result.users)) throw new Error('The server returned an invalid account list.');
                    list.replaceChildren();
                    for (const user of result.users) {
                        const row = document.createElement('div');
                        row.className = 'account-row';
                        const name = document.createElement('span');
                        name.className = 'account-row-name';
                        name.textContent = `${user.username} — ${user.isAdmin ? 'Administrator' : user.enabled ? 'Enabled' : 'Disabled'}${user.email ? ` — ${user.email}` : ''}`;
                        row.appendChild(name);
                        const extensions = document.createElement('form');
                        extensions.className = 'extension-form';
                        extensions.innerHTML = `<p>PlanBraid Core: always enabled</p>
                            <label><input type="checkbox" name="pmEnabled"> PlanBraid PM</label>
                            <label><input type="checkbox" name="supplyEnabled"> PlanBraid Supply</label>
                            <label class="supply-role">Supply role <select name="supplyRole"><option value="technician">Technician</option><option value="office">Office</option><option value="admin">Administrator</option></select></label>
                            <button type="submit">Save access</button>`;
                        extensions.elements.pmEnabled.checked = user.pmEnabled;
                        extensions.elements.supplyEnabled.checked = user.supplyEnabled;
                        extensions.elements.supplyRole.value = user.supplyRole;
                        const roleLabel = extensions.querySelector('.supply-role');
                        const updateRoleVisibility = () => {
                            roleLabel.hidden = !extensions.elements.pmEnabled.checked && !extensions.elements.supplyEnabled.checked;
                        };
                        extensions.elements.pmEnabled.addEventListener('change', updateRoleVisibility);
                        extensions.elements.supplyEnabled.addEventListener('change', updateRoleVisibility);
                        updateRoleVisibility();
                        extensions.onsubmit = async event => {
                            event.preventDefault();
                            const save = extensions.querySelector('button');
                            save.disabled = true;
                            try {
                                const result = await api('account-extensions', {
                                    userId: user.id,
                                    pmEnabled: extensions.elements.pmEnabled.checked,
                                    supplyEnabled: extensions.elements.supplyEnabled.checked,
                                    supplyRole: extensions.elements.supplyRole.value
                                });
                                await refreshAccounts();
                                showToast(result.message);
                            } catch (error) {
                                status.textContent = `Could not change extension access: ${error.message}`;
                            } finally {
                                save.disabled = false;
                            }
                        };
                        if (!user.isAdmin) {
                            const reset = document.createElement('button');
                            reset.type = 'button';
                            reset.textContent = 'Reset password';
                            reset.setAttribute('aria-label', `Reset password for ${user.username}`);
                            reset.onclick = () => showPasswordDialog(user);
                            const toggle = document.createElement('button');
                            toggle.type = 'button';
                            toggle.textContent = user.enabled ? 'Disable' : 'Enable';
                            toggle.setAttribute('aria-label', `${toggle.textContent} ${user.username}`);
                            toggle.onclick = async () => {
                                if (user.enabled && !confirm(`Disable ${user.username}? Their sessions will be signed out, and unsaved changes may be lost.`)) return;
                                toggle.disabled = true;
                                try {
                                    const result = await api('account-status', { userId: user.id, enabled: !user.enabled });
                                    await refreshAccounts();
                                    showToast(result.message);
                                } catch (error) {
                                    status.textContent = `Could not change account status: ${error.message}`;
                                } finally {
                                    toggle.disabled = false;
                                }
                            };
                            row.append(reset, toggle);
                        }
                        row.appendChild(extensions);
                        list.appendChild(row);
                    }
                    status.textContent = result.users.length ? '' : 'No accounts found.';
                } catch (error) {
                    list.replaceChildren();
                    status.textContent = `Could not load accounts: ${error.message}`;
                }
            }
            form.onsubmit = async event => {
                event.preventDefault();
                const button = form.querySelector('button');
                const message = form.querySelector('.account-message');
                button.disabled = true;
                try {
                    const password = form.elements.password.value;
                    passwordsMatch(password, form.elements.confirmation.value);
                    const result = await api('account-create', { username: form.elements.username.value, email: form.elements.email.value.trim(), password });
                    form.reset();
                    message.textContent = result.message;
                    await refreshAccounts();
                } catch (error) {
                    message.textContent = error.message;
                } finally {
                    button.disabled = false;
                }
            };
            form.elements.username.focus();
            await refreshAccounts();
        }
        function showAccountEmail() {
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="email-title">
                <h2 id="email-title">Account email</h2>
                <form class="account-form"><label>Email (optional)<input name="email" type="email" maxlength="254" autocomplete="email"></label>
                <p>The address is not verified. Password resets are handled by your administrator; no reset emails are sent.</p>
                <p class="account-message" role="status" aria-live="polite"></p>
                <button type="submit">Save email</button><button type="button" class="cancel-email">Cancel</button></form></section></div>`;
            const form = root.querySelector('form');
            form.elements.email.value = accountEmail;
            root.querySelector('.cancel-email').onclick = closeModal;
            form.onsubmit = async event => {
                event.preventDefault();
                const button = form.querySelector('[type=submit]');
                button.disabled = true;
                try {
                    const email = form.elements.email.value.trim();
                    const result = await api('account-profile', { email });
                    accountEmail = email;
                    closeModal();
                    showToast(result.message);
                } catch (error) {
                    form.querySelector('.account-message').textContent = error.message;
                } finally {
                    button.disabled = false;
                }
            };
            form.elements.email.focus();
        }
