/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        let offlineDatabasePromise;
        let offlineWrites = Promise.resolve();
        let offlineStorageFailed = false;

        function offlineDatabase() {
            if (!offlineDatabasePromise) {
                offlineDatabasePromise = new Promise((resolve, reject) => {
                    const request = indexedDB.open(`planbraid-pending:${new URL('.', location.href).pathname}`, 1);
                    request.onupgradeneeded = () => request.result.createObjectStore('pending', { keyPath: 'id' });
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                    request.onblocked = () => reject(new Error('Local storage upgrade is blocked by another tab.'));
                }).catch(error => {
                    offlineDatabasePromise = null;
                    throw error;
                });
            }
            return offlineDatabasePromise;
        }
        async function offlineOperation(mode, operation) {
            const db = await offlineDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('pending', mode);
                const request = operation(transaction.objectStore('pending'));
                transaction.oncomplete = () => resolve(request.result);
                transaction.onerror = () => reject(transaction.error || request.error);
                transaction.onabort = () => reject(transaction.error || new Error('Local storage transaction was aborted.'));
            });
        }
        function offlineStorageError(error) {
            console.error('Could not save offline changes:', error);
            if (!offlineStorageFailed) showToast('Local recovery is unavailable. Keep this tab open and export a backup of unsaved changes.');
            offlineStorageFailed = true;
        }
        function queueLocalSnapshot() {
            if (!authenticated || currentAccountId === null) return;
            const snapshot = {
                id: getAppInstanceId(), accountId: currentAccountId, revision,
                generation: editGeneration, updated: Date.now(), state: structuredClone(state)
            };
            offlineWrites = offlineWrites.then(async () => {
                await offlineOperation('readwrite', store => store.put(snapshot));
                offlineStorageFailed = false;
                if (serverUnavailable && !syncBlocked && snapshot.generation === editGeneration && snapshot.revision === revision) {
                    setSaveStatus('Saved on this device; waiting to sync');
                }
            }).catch(offlineStorageError);
        }
        function queueLocalRemoval() {
            const id = getAppInstanceId();
            offlineWrites = offlineWrites.then(() => offlineOperation('readwrite', store => store.delete(id))).catch(offlineStorageError);
        }
        async function removeCurrentLocalSnapshot() {
            await offlineWrites;
            await offlineOperation('readwrite', store => store.delete(getAppInstanceId()));
        }
        async function localSnapshotReady() {
            queueLocalSnapshot();
            await offlineWrites;
            try {
                const record = await offlineOperation('readonly', store => store.get(getAppInstanceId()));
                if (record && record.accountId === currentAccountId && record.generation === editGeneration && record.revision === revision) return true;
            } catch (error) {
                offlineStorageError(error);
            }
            showToast('Could not keep offline changes on this device. Export a backup before signing out.');
            return false;
        }
        async function refreshOfflineRecovery() {
            try {
                const records = await offlineOperation('readonly', store => store.getAll());
                const other = records.filter(record => record.accountId === currentAccountId && record.id !== getAppInstanceId());
                document.getElementById('offline-recovery-button').hidden = other.length === 0;
                if (other.length) showToast('Offline changes are available in More options → Recover offline changes.');
                return other.length;
            } catch (error) {
                offlineStorageError(error);
                return null;
            }
        }
        async function showOfflineRecovery() {
            let records;
            try {
                records = (await offlineOperation('readonly', store => store.getAll()))
                    .filter(record => record.accountId === currentAccountId && record.id !== getAppInstanceId());
            } catch (error) {
                offlineStorageError(error);
                return;
            }
            const root = document.getElementById('modal-root');
            root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="offline-title">
                <h2 id="offline-title">Recover offline changes</h2>
                <p>These copies are stored on this device. Restore only when the server revision matches; otherwise export the copy for review.</p>
                <div class="offline-records"></div>
                <div class="space-form-actions"><button type="button" class="offline-close">Close</button></div>
            </section></div>`;
            const list = root.querySelector('.offline-records');
            if (!records.length) list.textContent = 'No saved offline changes.';
            for (const record of records) {
                const row = document.createElement('div');
                const label = document.createElement('p');
                label.textContent = `Saved ${new Date(record.updated).toLocaleString()} · server revision ${record.revision}`;
                const restore = document.createElement('button');
                restore.type = 'button';
                restore.textContent = 'Restore and sync';
                restore.onclick = async () => {
                    if (syncBlocked || editGeneration !== savedGeneration || hasUnsavedAgendaDraft() || hasUnsavedSeparatePMDraft()) {
                        showToast('Save or export current changes before restoring an offline copy.');
                        return;
                    }
                    let latest;
                    try { latest = await offlineOperation('readonly', store => store.get(record.id)); }
                    catch (error) { offlineStorageError(error); return; }
                    if (!latest || latest.accountId !== currentAccountId) { showToast('This offline copy is no longer available.'); return; }
                    if (latest.revision !== revision) { showToast('The server workspace changed. Export this copy for review instead.'); return; }
                    if (!confirm('Restore these offline changes into this workspace and sync them?')) return;
                    try { state = normalizeState(structuredClone(latest.state)); }
                    catch (error) { console.error('Invalid offline copy:', error); showToast('The offline copy could not be restored. Export it for review.'); return; }
                    closeModal();
                    currentView = 'dashboard';
                    scheduleSave();
                    render();
                };
                const download = document.createElement('button');
                download.type = 'button';
                download.textContent = 'Export';
                download.onclick = async () => {
                    let latest;
                    try { latest = await offlineOperation('readonly', store => store.get(record.id)); }
                    catch (error) { offlineStorageError(error); return; }
                    if (!latest || latest.accountId !== currentAccountId) { showToast('This offline copy is no longer available.'); return; }
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(new Blob([JSON.stringify(latest.state, null, 2)], { type: 'application/json' }));
                    link.download = 'planbraid-offline-backup.json';
                    link.click();
                    URL.revokeObjectURL(link.href);
                };
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = 'Delete copy';
                remove.onclick = async () => {
                    if (!confirm('Delete this offline copy from this device?')) return;
                    try {
                        const db = await offlineDatabase();
                        await new Promise((resolve, reject) => {
                            const tx = db.transaction('pending', 'readwrite');
                            const store = tx.objectStore('pending');
                            const request = store.get(record.id);
                            request.onsuccess = () => {
                                if (request.result && request.result.generation === record.generation) store.delete(record.id);
                            };
                            tx.oncomplete = resolve;
                            tx.onerror = () => reject(tx.error);
                            tx.onabort = () => reject(tx.error || new Error('Local deletion was aborted.'));
                        });
                        await showOfflineRecovery();
                        await refreshOfflineRecovery();
                    } catch (error) { offlineStorageError(error); }
                };
                row.append(label, restore, download, remove);
                list.append(row);
            }
            root.querySelector('.offline-close').onclick = closeModal;
            root.querySelector('.offline-close').focus();
        }
