<?php
/*
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$config = require '/etc/smartlist/database.php';
$db = new PDO(
    'mysql:host=' . $config['host'] . ';dbname=' . $config['database'] . ';charset=utf8mb4',
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
);
$db->exec('CREATE TABLE IF NOT EXISTS sl_account_access (
    user_id INT UNSIGNED NOT NULL PRIMARY KEY,
    is_admin TINYINT UNSIGNED NOT NULL DEFAULT 0,
    enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
    auth_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT sl_access_user FOREIGN KEY (user_id) REFERENCES sl_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$column = $db->query("SHOW COLUMNS FROM sl_account_access LIKE 'active_instance_token'")->fetch(PDO::FETCH_ASSOC);
if (!$column) {
    $db->exec('ALTER TABLE sl_account_access ADD COLUMN active_instance_token CHAR(64) NULL');
}
$db->beginTransaction();
try {
    $users = $db->query('SELECT id FROM sl_users FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN);
    $access = $db->query('SELECT user_id, is_admin, enabled FROM sl_account_access FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
    if (count($users) === 1 && count($access) === 0) {
        $db->prepare('INSERT INTO sl_account_access (user_id, is_admin, enabled, auth_version) VALUES (?, 1, 1, 0)')->execute([$users[0]]);
    } else {
        $userIds = array_map('intval', $users);
        $accessIds = array_map(static fn(array $row): int => (int) $row['user_id'], $access);
        sort($userIds);
        sort($accessIds);
        $admins = array_filter($access, static fn(array $row): bool => (int) $row['is_admin'] === 1 && (int) $row['enabled'] === 1);
        if (!$userIds || $userIds !== $accessIds || count($admins) !== 1) {
            throw new RuntimeException('Expected exactly one existing user without metadata, or a complete migration with one enabled administrator. No account was changed.');
        }
    }
    $db->commit();
    echo "Account access migration verified.\n";
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    throw $error;
}
