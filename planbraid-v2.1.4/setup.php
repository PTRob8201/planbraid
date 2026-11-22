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

$db->exec('CREATE TABLE IF NOT EXISTS sl_users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->exec('CREATE TABLE IF NOT EXISTS sl_workspaces (
    user_id INT UNSIGNED NOT NULL PRIMARY KEY,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    data LONGTEXT NOT NULL,
    CONSTRAINT sl_workspace_user FOREIGN KEY (user_id) REFERENCES sl_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->exec('CREATE TABLE IF NOT EXISTS sl_shared_tracker (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    version BIGINT UNSIGNED NOT NULL,
    data LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->exec('CREATE TABLE IF NOT EXISTS sl_account_access (
    user_id INT UNSIGNED NOT NULL PRIMARY KEY,
    is_admin TINYINT UNSIGNED NOT NULL DEFAULT 0,
    enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
    auth_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
    active_instance_token CHAR(64) NULL,
    email VARCHAR(254) NULL,
    must_change_password TINYINT UNSIGNED NOT NULL DEFAULT 0,
    guide_seen TINYINT UNSIGNED NOT NULL DEFAULT 0,
    pm_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0,
    supply_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0,
    supply_role VARCHAR(12) NOT NULL DEFAULT \'technician\',
    personal_project_pending TINYINT UNSIGNED NOT NULL DEFAULT 1,
    CONSTRAINT sl_access_user FOREIGN KEY (user_id) REFERENCES sl_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->exec('CREATE TABLE IF NOT EXISTS sl_login_attempts (
    client_hash CHAR(64) CHARACTER SET ascii NOT NULL PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

if ((int) $db->query('SELECT COUNT(*) FROM sl_users')->fetchColumn() !== 0) {
    fwrite(STDERR, "An account already exists; setup will not overwrite it.\n");
    exit(1);
}
fwrite(STDOUT, "Administrator username (3-80 letters, numbers, underscores, or hyphens): ");
$username = trim((string) fgets(STDIN));
if (!preg_match('/\A[a-zA-Z0-9_-]{3,80}\z/', $username)) {
    fwrite(STDERR, "Invalid username.\n");
    exit(1);
}
if (!function_exists('shell_exec') || trim((string) shell_exec('stty -g 2>/dev/null')) === '') {
    fwrite(STDERR, "Setup requires an interactive terminal to read the password safely.\n");
    exit(1);
}
$terminal = trim((string) shell_exec('stty -g'));
try {
    shell_exec('stty -echo');
    fwrite(STDOUT, "Administrator password (at least 12 characters): ");
    $password = rtrim((string) fgets(STDIN), "\r\n");
    fwrite(STDOUT, "\nRepeat password: ");
    $confirmation = rtrim((string) fgets(STDIN), "\r\n");
} finally {
    shell_exec('stty ' . escapeshellarg($terminal));
    fwrite(STDOUT, "\n");
}
if (strlen($password) < 12 || strlen($password) > 72 || str_contains($password, "\0") || !hash_equals($password, $confirmation)) {
    fwrite(STDERR, "Passwords do not match or are not 12-72 bytes.\n");
    exit(1);
}
$db->beginTransaction();
try {
    $db->query('SELECT id FROM sl_users FOR UPDATE')->fetchAll();
    if ((int) $db->query('SELECT COUNT(*) FROM sl_users')->fetchColumn() !== 0) {
        throw new RuntimeException('An account already exists.');
    }
    $statement = $db->prepare('INSERT INTO sl_users (username, password_hash) VALUES (?, ?)');
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) throw new RuntimeException('Password hashing failed.');
    $statement->execute([$username, $hash]);
    $db->prepare('INSERT INTO sl_account_access (user_id, is_admin, enabled, auth_version) VALUES (?, 1, 1, 0)')->execute([(int) $db->lastInsertId()]);
    $db->commit();
    fwrite(STDOUT, "Administrator account created.\n");
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
