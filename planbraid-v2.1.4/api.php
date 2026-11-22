<?php
/*
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    http_response_code(403);
    echo json_encode(['error' => 'HTTPS is required.']);
    exit;
}
session_name('smartlist_session');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_set_cookie_params(['secure' => true, 'httponly' => true, 'samesite' => 'Strict', 'path' => '/smartlist/']);
session_start();

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function validNewPassword(mixed $password): bool {
    return is_string($password) && strlen($password) >= 12 && strlen($password) <= 72 && !str_contains($password, "\0");
}
function validEmail(mixed $email): bool {
    return is_string($email) && strlen($email) <= 254 && ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) !== false);
}

function appInstanceToken(): ?string {
    $token = $_SERVER['HTTP_X_SMARTLIST_INSTANCE'] ?? '';
    return is_string($token) && preg_match('/\A[a-f0-9]{64}\z/', $token) === 1 ? $token : null;
}

function sessionAccount(PDO $db, bool $lock = false): ?array {
    if (!isset($_SESSION['user_id'], $_SESSION['auth_version'])) return null;
    $sql = 'SELECT u.id, u.username, u.password_hash, a.is_admin, a.enabled, a.auth_version, a.active_instance_token, a.email, a.must_change_password, a.guide_seen, a.pm_enabled, a.supply_enabled, a.supply_role, a.personal_project_pending FROM sl_users u JOIN sl_account_access a ON a.user_id = u.id WHERE u.id = ?';
    $statement = $db->prepare($sql . ($lock ? ' FOR UPDATE' : ''));
    $statement->execute([$_SESSION['user_id']]);
    $account = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$account || !(int) $account['enabled'] || (int) $account['auth_version'] !== $_SESSION['auth_version']) return null;
    return $account;
}

function currentAccount(PDO $db, bool $lock = false): ?array {
    $account = sessionAccount($db, $lock);
    $token = appInstanceToken();
    if (!$account || $token === null || !is_string($account['active_instance_token']) || !hash_equals($account['active_instance_token'], $token)) return null;
    return $account;
}

function respondSessionFailure(PDO $db): never {
    if (sessionAccount($db) !== null) {
        respond(409, ['code' => 'session_replaced', 'error' => 'You are connected in another PlanBraid instance. This instance has been disconnected.']);
    }
    respond(401, ['error' => 'Your session expired or your account is disabled. Sign in again.']);
}

function addPersonalProject(string $json): ?string {
    $state = json_decode($json, false, 512, JSON_THROW_ON_ERROR);
    if (!$state instanceof stdClass || !isset($state->documents) || !is_array($state->documents) || !$state->documents) {
        throw new RuntimeException('Cannot add Personal to an invalid workspace.');
    }
    $ids = [];
    foreach ($state->documents as $document) {
        if (!$document instanceof stdClass || !isset($document->id, $document->title) ||
            !is_string($document->id) || !is_string($document->title)) {
            throw new RuntimeException('Cannot add Personal to an invalid workspace project.');
        }
        if (mb_strtolower(trim($document->title), 'UTF-8') === 'personal') return null;
        $ids[$document->id] = true;
    }
    if (!isset($state->spaces)) {
        $spaceId = 'default-space';
    } elseif (is_array($state->spaces) && isset($state->spaces[0]->id) && is_string($state->spaces[0]->id)) {
        $spaceId = $state->spaces[0]->id;
    } else {
        throw new RuntimeException('Cannot add Personal to an invalid workspace space.');
    }
    do { $id = 'personal-' . bin2hex(random_bytes(16)); } while (isset($ids[$id]));
    $state->documents[] = [
        'id' => $id, 'spaceId' => $spaceId, 'title' => 'Personal',
        'starred' => false, 'updatedAt' => (int) floor(microtime(true) * 1000), 'nodes' => []
    ];
    return json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

try {
    $config = require '/etc/smartlist/database.php';
    $db = new PDO(
        'mysql:host=' . $config['host'] . ';dbname=' . $config['database'] . ';charset=utf8mb4',
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );
    $db->query('SELECT 1');
    $action = $_GET['action'] ?? 'session';
    $method = $_SERVER['REQUEST_METHOD'];
    if ($action === 'session' && $method === 'GET') {
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
        $token = appInstanceToken();
        $takeOver = ($_GET['claim'] ?? '') === '1';
        $account = sessionAccount($db);
        $tookOver = false;
        if ($takeOver && $account) {
            if ($token === null) respond(400, ['error' => 'Invalid app instance. Reload the page and try again.']);
            $db->beginTransaction();
            $account = sessionAccount($db, true);
            if ($account) {
                $previousToken = $account['active_instance_token'];
                $db->prepare('UPDATE sl_account_access SET active_instance_token = ? WHERE user_id = ?')->execute([$token, $account['id']]);
                $account['active_instance_token'] = $token;
                $tookOver = is_string($previousToken) && !hash_equals($previousToken, $token);
            }
            $db->commit();
        }
        $authenticated = $account !== null && $token !== null
            && is_string($account['active_instance_token'])
            && hash_equals($account['active_instance_token'], $token);
        respond(200, [
            'connected' => true,
            'authenticated' => $authenticated,
            'sessionReplaced' => $account !== null && !$authenticated,
            'tookOver' => $tookOver,
            'mustChangePassword' => $authenticated && (bool) $account['must_change_password'],
            'pmEnabled' => $authenticated && (bool) $account['pm_enabled'],
            'supplyEnabled' => $authenticated && (bool) $account['supply_enabled'],
            'supplyRole' => $authenticated ? $account['supply_role'] : null,
            'csrf' => $_SESSION['csrf']
        ]);
    }
    if ($method === 'POST' && $action !== 'login' && !currentAccount($db)) {
        respondSessionFailure($db);
    }
    if ($method !== 'POST' || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        respond(403, ['error' => 'Invalid request.']);
    }
    $bodyLimit = str_starts_with((string) $action, 'supply-') ? 8388608 : 5242880;
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $bodyLimit) {
        respond(413, ['error' => 'Request exceeds the size limit.']);
    }
    $raw = file_get_contents('php://input', false, null, 0, $bodyLimit + 1);
    if ($raw === false || strlen($raw) > $bodyLimit) respond(413, ['error' => 'Request exceeds the size limit.']);
    try {
        $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        respond(400, ['error' => 'Invalid request body.']);
    }
    if (!is_array($body)) {
        respond(400, ['error' => 'Invalid request body.']);
    }
    if ($action === 'login') {
        $username = $body['username'] ?? '';
        $password = $body['password'] ?? '';
        $token = appInstanceToken();
        if ($token === null) respond(400, ['error' => 'Invalid app instance. Reload the page and try again.']);
        if (!is_string($username) || !is_string($password) || strlen($username) > 80 || strlen($password) > 1024) {
            respond(400, ['error' => 'Invalid credentials.']);
        }
        $client = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
        $db->beginTransaction();
        $db->prepare('INSERT INTO sl_login_attempts (client_hash, attempts, expires_at) VALUES (?, 0, DATE_ADD(NOW(), INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE client_hash = client_hash')->execute([$client]);
        $statement = $db->prepare('SELECT attempts, expires_at <= NOW() AS expired FROM sl_login_attempts WHERE client_hash = ? FOR UPDATE');
        $statement->execute([$client]);
        $attempt = $statement->fetch(PDO::FETCH_ASSOC);
        if ($attempt['expired']) {
            $db->prepare('UPDATE sl_login_attempts SET attempts = 0, expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE client_hash = ?')->execute([$client]);
            $attempt['attempts'] = 0;
        }
        if ((int) $attempt['attempts'] >= 10) {
            $db->commit();
            respond(429, ['error' => 'Too many attempts. Try again later.']);
        }
        $statement = $db->prepare('SELECT u.id, u.password_hash, a.enabled, a.auth_version, a.active_instance_token, a.must_change_password FROM sl_users u JOIN sl_account_access a ON a.user_id = u.id WHERE u.username = ?');
        $statement->execute([$username]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$user || !(int) $user['enabled'] || !password_verify($password, $user['password_hash'])) {
            $db->prepare('UPDATE sl_login_attempts SET attempts = attempts + 1 WHERE client_hash = ?')->execute([$client]);
            $db->commit();
            respond(401, ['error' => 'Incorrect username or password.']);
        }
        $db->prepare('DELETE FROM sl_login_attempts WHERE client_hash = ?')->execute([$client]);
        $previousToken = $user['active_instance_token'];
        $db->prepare('UPDATE sl_account_access SET active_instance_token = ? WHERE user_id = ?')->execute([$token, $user['id']]);
        $db->commit();
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['auth_version'] = (int) $user['auth_version'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        respond(200, [
            'connected' => true,
            'csrf' => $_SESSION['csrf'],
            'mustChangePassword' => (bool) $user['must_change_password'],
            'tookOver' => is_string($previousToken) && !hash_equals($previousToken, $token)
        ]);
    }
    if ($action === 'logout') {
        $db->beginTransaction();
        $account = currentAccount($db, true);
        if (!$account) {
            $db->rollBack();
            respondSessionFailure($db);
        }
        $db->prepare('UPDATE sl_account_access SET active_instance_token = NULL WHERE user_id = ?')->execute([$account['id']]);
        $db->commit();
        $_SESSION = [];
        session_destroy();
        respond(200, ['connected' => true]);
    }
    $account = currentAccount($db);
    if (!$account) respondSessionFailure($db);
    if ((int) $account['must_change_password'] && $action !== 'change-password') {
        respond(403, ['code' => 'password_change_required', 'error' => 'Change your temporary password before continuing.']);
    }
    if (str_starts_with((string) $action, 'supply-')) {
        require __DIR__ . '/supply-api.php';
    }
    if ($action === 'account-profile') {
        $email = $body['email'] ?? null;
        if (!validEmail($email)) respond(400, ['error' => 'Enter a valid email address, or leave it blank.']);
        $db->beginTransaction();
        $account = currentAccount($db, true);
        if (!$account) { $db->rollBack(); respondSessionFailure($db); }
        if ((int) $account['must_change_password']) { $db->rollBack(); respond(403, ['error' => 'Change your temporary password before continuing.']); }
        $db->prepare('UPDATE sl_account_access SET email = ? WHERE user_id = ?')->execute([$email === '' ? null : $email, $account['id']]);
        $db->commit();
        respond(200, ['message' => 'Account email saved.']);
    }
    if ($action === 'guide-dismiss') {
        $db->beginTransaction();
        $account = currentAccount($db, true);
        if (!$account) { $db->rollBack(); respondSessionFailure($db); }
        if ((int) $account['must_change_password']) { $db->rollBack(); respond(403, ['error' => 'Change your temporary password before continuing.']); }
        $db->prepare('UPDATE sl_account_access SET guide_seen = 1 WHERE user_id = ?')->execute([$account['id']]);
        $db->commit();
        respond(200, ['message' => 'Guide dismissed.']);
    }
    if ($action === 'accounts-list') {
        if (!(int) $account['is_admin']) respond(403, ['error' => 'Administrator access is required.']);
        $rows = $db->query('SELECT u.id, u.username, a.is_admin, a.enabled, a.email, a.pm_enabled, a.supply_enabled, a.supply_role FROM sl_users u JOIN sl_account_access a ON a.user_id = u.id ORDER BY u.username')->fetchAll(PDO::FETCH_ASSOC);
        $users = array_map(static fn(array $row): array => [
            'id' => (int) $row['id'], 'username' => $row['username'],
            'isAdmin' => (bool) $row['is_admin'], 'enabled' => (bool) $row['enabled'], 'email' => $row['email'] ?? '',
            'pmEnabled' => (bool) $row['pm_enabled'], 'supplyEnabled' => (bool) $row['supply_enabled'], 'supplyRole' => $row['supply_role']
        ], $rows);
        respond(200, ['users' => $users]);
    }
    if ($action === 'account-extensions') {
        $userId = $body['userId'] ?? null;
        $pm = $body['pmEnabled'] ?? null;
        $supply = $body['supplyEnabled'] ?? null;
        $role = $body['supplyRole'] ?? null;
        if (!is_int($userId) || $userId <= 0 || !is_bool($pm) || !is_bool($supply) || !in_array($role, ['technician', 'office', 'admin'], true)) {
            respond(400, ['error' => 'Invalid extension permissions.']);
        }
        $db->beginTransaction();
        $account = currentAccount($db, true);
        if (!$account) { $db->rollBack(); respondSessionFailure($db); }
        if ((int) $account['must_change_password'] || !(int) $account['is_admin']) {
            $db->rollBack();
            respond(403, ['error' => 'Administrator access is required.']);
        }
        $target = $db->prepare('SELECT user_id FROM sl_account_access WHERE user_id = ? FOR UPDATE');
        $target->execute([$userId]);
        if (!$target->fetchColumn()) { $db->rollBack(); respond(404, ['error' => 'Account not found.']); }
        $db->prepare('UPDATE sl_account_access SET pm_enabled = ?, supply_enabled = ?, supply_role = ? WHERE user_id = ?')->execute([(int) $pm, (int) $supply, $role, $userId]);
        $db->commit();
        respond(200, ['message' => 'Extension access updated.']);
    }
    if ($action === 'account-create' || $action === 'account-reset-password' || $action === 'account-status' || $action === 'change-password') {
        $db->beginTransaction();
        $account = currentAccount($db, true);
        if (!$account) {
            $db->rollBack();
            respondSessionFailure($db);
        }
        if ($action !== 'change-password' && (int) $account['must_change_password']) {
            $db->rollBack();
            respond(403, ['code' => 'password_change_required', 'error' => 'Change your temporary password before continuing.']);
        }
        if ($action !== 'change-password' && !(int) $account['is_admin']) {
            $db->rollBack();
            respond(403, ['error' => 'Administrator access is required.']);
        }
        if ($action === 'change-password') {
            $current = $body['currentPassword'] ?? null;
            $password = $body['password'] ?? null;
            if (!is_string($current) || !password_verify($current, $account['password_hash'])) {
                $db->rollBack();
                respond(400, ['error' => 'Current password is incorrect.']);
            }
            if (!validNewPassword($password)) {
                $db->rollBack();
                respond(400, ['error' => 'The new password must be 12–72 bytes and contain no null characters.']);
            }
            if (password_verify($password, $account['password_hash'])) {
                $db->rollBack();
                respond(400, ['error' => 'Choose a password different from your current password.']);
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            if ($hash === false) throw new RuntimeException('Password hashing failed.');
            $db->prepare('UPDATE sl_users SET password_hash = ? WHERE id = ?')->execute([$hash, $account['id']]);
            $db->prepare('UPDATE sl_account_access SET auth_version = auth_version + 1, must_change_password = 0 WHERE user_id = ?')->execute([$account['id']]);
            $db->commit();
            $_SESSION['auth_version'] = (int) $account['auth_version'] + 1;
            session_regenerate_id(true);
            respond(200, ['message' => 'Password changed. Other sessions have been signed out.']);
        }
        if ($action === 'account-create') {
            $username = $body['username'] ?? null;
            $password = $body['password'] ?? null;
            $email = $body['email'] ?? '';
            if (!is_string($username) || !preg_match('/\A[a-zA-Z0-9_-]{3,80}\z/', $username) || !validNewPassword($password)) {
                $db->rollBack();
                respond(400, ['error' => 'Use a 3–80 character username (letters, numbers, underscores or hyphens) and a 12–72 byte password.']);
            }
            if (!validEmail($email)) { $db->rollBack(); respond(400, ['error' => 'Enter a valid email address, or leave it blank.']); }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            if ($hash === false) throw new RuntimeException('Password hashing failed.');
            try {
                $db->prepare('INSERT INTO sl_users (username, password_hash) VALUES (?, ?)')->execute([$username, $hash]);
            } catch (PDOException $error) {
                if ($error->getCode() !== '23000') throw $error;
                $db->rollBack();
                respond(409, ['error' => 'That username is already in use.']);
            }
            $db->prepare('INSERT INTO sl_account_access (user_id, is_admin, enabled, auth_version, email, must_change_password) VALUES (?, 0, 1, 0, ?, 1)')->execute([(int) $db->lastInsertId(), $email === '' ? null : $email]);
            $db->commit();
            respond(200, ['message' => 'Account created.']);
        }
        $userId = $body['userId'] ?? null;
        if (!is_int($userId) || $userId <= 0) {
            $db->rollBack();
            respond(400, ['error' => 'Invalid account.']);
        }
        $statement = $db->prepare('SELECT is_admin, enabled FROM sl_account_access WHERE user_id = ? FOR UPDATE');
        $statement->execute([$userId]);
        $target = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$target) {
            $db->rollBack();
            respond(404, ['error' => 'Account not found.']);
        }
        if ((int) $target['is_admin']) {
            $db->rollBack();
            respond(403, ['error' => 'Administrator accounts cannot be changed here.']);
        }
        if ($action === 'account-reset-password') {
            $password = $body['password'] ?? null;
            if (!validNewPassword($password)) {
                $db->rollBack();
                respond(400, ['error' => 'The new password must be 12–72 bytes and contain no null characters.']);
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            if ($hash === false) throw new RuntimeException('Password hashing failed.');
            $db->prepare('UPDATE sl_users SET password_hash = ? WHERE id = ?')->execute([$hash, $userId]);
            $db->prepare('UPDATE sl_account_access SET auth_version = auth_version + 1, must_change_password = 1 WHERE user_id = ?')->execute([$userId]);
            $db->commit();
            respond(200, ['message' => 'Password reset. Existing sessions have been signed out.']);
        }
        $enabled = $body['enabled'] ?? null;
        if (!is_bool($enabled)) {
            $db->rollBack();
            respond(400, ['error' => 'Invalid account status.']);
        }
        $db->prepare('UPDATE sl_account_access SET enabled = ?, auth_version = auth_version + 1 WHERE user_id = ?')->execute([(int) $enabled, $userId]);
        $db->commit();
        respond(200, ['message' => $enabled ? 'Account enabled.' : 'Account disabled. Existing sessions have been signed out.']);
    }
    if ($action === 'load') {
        $db->beginTransaction();
        $account = currentAccount($db, true);
        if (!$account) { $db->rollBack(); respondSessionFailure($db); }
        if ((int) $account['must_change_password']) {
            $db->rollBack();
            respond(403, ['code' => 'password_change_required', 'error' => 'Change your temporary password before continuing.']);
        }
        $statement = $db->prepare('SELECT u.username, w.revision, w.data FROM sl_users u LEFT JOIN sl_workspaces w ON w.user_id = u.id WHERE u.id = ?');
        $statement->execute([$_SESSION['user_id']]);
        $workspace = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$workspace) {
            $db->rollBack();
            respond(401, ['error' => 'Account not found. Sign in again.']);
        }
        $personalWarning = null;
        if ((int) $account['personal_project_pending']) {
            $updated = $workspace['data'] === null ? null : addPersonalProject($workspace['data']);
            if ($updated !== null && strlen($updated) > 5240000) {
                $personalWarning = 'Personal was not added because this workspace is near the size limit. Free some space and reconnect to try again.';
            } else {
                if ($updated !== null) {
                    $db->prepare('UPDATE sl_workspaces SET data = ?, revision = revision + 1 WHERE user_id = ?')
                        ->execute([$updated, $account['id']]);
                    $workspace['data'] = $updated;
                    $workspace['revision'] = (int) $workspace['revision'] + 1;
                }
                $db->prepare('UPDATE sl_account_access SET personal_project_pending = 0 WHERE user_id = ?')->execute([$account['id']]);
            }
        }
        $db->commit();
        respond(200, [
            'connected' => true,
            'username' => $workspace['username'],
            'userId' => (int) $account['id'],
            'isAdmin' => (bool) $account['is_admin'],
            'pmEnabled' => (bool) $account['pm_enabled'],
            'supplyEnabled' => (bool) $account['supply_enabled'],
            'supplyRole' => $account['supply_role'],
            'email' => $account['email'] ?? '',
            'guideSeen' => (bool) $account['guide_seen'],
            'personalProjectWarning' => $personalWarning,
            'revision' => $workspace['revision'] === null ? 0 : (int) $workspace['revision'],
            'state' => $workspace['data'] === null ? null : json_decode($workspace['data'], true, 512, JSON_THROW_ON_ERROR),
        ]);
    }
    if ($action === 'shared-tracker-load') {
        if (!(int) $account['pm_enabled']) respond(403, ['code' => 'extension_disabled', 'error' => 'PlanBraid PM is disabled for this account.']);
        $statement = $db->query('SELECT version, data FROM sl_shared_tracker WHERE id = 1');
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        $users = $db->query('SELECT u.username FROM sl_users u JOIN sl_account_access a ON a.user_id = u.id WHERE a.enabled = 1 ORDER BY u.username')->fetchAll(PDO::FETCH_COLUMN);
        respond(200, [
            'username' => $account['username'],
            'version' => $row ? (int) $row['version'] : 0,
            'state' => $row ? json_decode($row['data'], true, 512, JSON_THROW_ON_ERROR) : ['projects' => [], 'milestones' => [], 'tasks' => []],
            'users' => $users,
        ]);
    }
    if ($action === 'shared-tracker-save') {
        if (!(int) $account['pm_enabled']) respond(403, ['code' => 'extension_disabled', 'error' => 'PlanBraid PM is disabled for this account.']);
        require_once __DIR__ . '/shared-tracker-validation.php';
        $version = $body['version'] ?? null;
        $tracker = $body['state'] ?? null;
        if (!is_int($version) || $version < 0 || !trackerValidState($tracker)) {
            respond(422, ['error' => 'Invalid tracker data. Check required fields, dates, and blocker reasons.']);
        }
        $json = json_encode($tracker, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($json) > 1048576) respond(413, ['error' => 'Tracker data exceeds the 1 MB limit.']);
        $db->beginTransaction();
        $account = currentAccount($db, true);
        if (!$account) { $db->rollBack(); respondSessionFailure($db); }
        if ((int) $account['must_change_password']) { $db->rollBack(); respond(403, ['error' => 'Change your temporary password before continuing.']); }
        if (!(int) $account['pm_enabled']) { $db->rollBack(); respond(403, ['code' => 'extension_disabled', 'error' => 'PlanBraid PM is disabled for this account.']); }
        if ($version === 0) {
            $statement = $db->prepare('INSERT INTO sl_shared_tracker (id, version, data) VALUES (1, 1, ?) ON DUPLICATE KEY UPDATE id = id');
            $statement->execute([$json]);
        } else {
            $statement = $db->prepare('UPDATE sl_shared_tracker SET data = ?, version = version + 1 WHERE id = 1 AND version = ?');
            $statement->execute([$json, $version]);
        }
        if ($statement->rowCount() !== 1) {
            $db->rollBack();
            respond(409, ['error' => 'Another user changed the tracker. Your change was not saved.']);
        }
        $db->commit();
        respond(200, ['version' => $version + 1]);
    }
    if ($action === 'save') {
        $revision = $body['revision'] ?? null;
        $state = $body['state'] ?? null;
        if (!is_int($revision) || $revision < 0 || !is_array($state) || !isset($state['documents'], $state['spaces']) || !is_array($state['documents']) || !is_array($state['spaces']) || !$state['documents'] || !$state['spaces']) {
            respond(400, ['error' => 'Invalid workspace.']);
        }
        $json = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        $db->beginTransaction();
        if (!currentAccount($db, true)) {
            $db->rollBack();
            respondSessionFailure($db);
        }
        if ($revision === 0) {
            $statement = $db->prepare('INSERT INTO sl_workspaces (user_id, revision, data) VALUES (?, 1, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)');
            $statement->execute([$_SESSION['user_id'], $json]);
        } else {
            $statement = $db->prepare('UPDATE sl_workspaces SET data = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?');
            $statement->execute([$json, $_SESSION['user_id'], $revision]);
        }
        if ($statement->rowCount() !== 1) {
            $db->rollBack();
            respond(409, ['error' => 'This workspace changed in another session. Export your unsaved changes before reloading.']);
        }
        $db->commit();
        respond(200, ['connected' => true, 'revision' => $revision + 1]);
    }
    respond(404, ['error' => 'Unknown action.']);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('PlanBraid API: ' . $error->getMessage());
    respond(500, ['error' => 'Database or server error. Please try again or contact the administrator.']);
}
