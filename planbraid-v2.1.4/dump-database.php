<?php
/*
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || $argc !== 2 || !is_dir($argv[1])) {
    fwrite(STDERR, "Usage: php dump-database.php BACKUP_DIRECTORY\n");
    exit(1);
}
umask(0077);
$options = $argv[1] . '/.mysql-options';
$dump = $argv[1] . '/database.sql';
$failed = false;
try {
    $config = require '/etc/smartlist/database.php';
    foreach (['host', 'database', 'username', 'password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key]) || str_contains($config[$key], "\n") || str_contains($config[$key], "\r")) {
            throw new RuntimeException('Invalid database configuration.');
        }
        $pdo = new PDO(
            'mysql:host=' . $config['host'] . ';dbname=' . $config['database'] . ';charset=utf8mb4',
            $config['username'],
            $config['password'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $statement = $pdo->prepare("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'");
        $statement->execute([$config['database']]);
        $tables = $statement->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach (['sl_users', 'sl_workspaces', 'sl_login_attempts'] as $table) {
            if (!isset($tables[$table])) throw new RuntimeException('A required database table is missing.');
        }
        foreach ($tables as $engine) {
            if (strcasecmp((string) $engine, 'InnoDB') !== 0) {
                throw new RuntimeException('Database contains a non-InnoDB table; a consistent online backup is not guaranteed.');
            }
        }
    }
    $quote = static fn(string $value): string => '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $value) . '"';
    $content = "[client]\nhost=" . $quote($config['host']) . "\nuser=" . $quote($config['username']) . "\npassword=" . $quote($config['password']) . "\n";
    if (file_put_contents($options, $content, LOCK_EX) !== strlen($content) || !chmod($options, 0600)) {
        throw new RuntimeException('Could not write private database options.');
    }
    $command = ['/usr/bin/mariadb-dump', '--defaults-extra-file=' . $options,
        '--single-transaction', '--skip-lock-tables', '--no-tablespaces',
        '--skip-add-locks', '--', $config['database']];
    $process = proc_open($command, [0 => ['file', '/dev/null', 'r'], 1 => ['file', $dump, 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) throw new RuntimeException('Could not start database backup.');
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    if (proc_close($process) !== 0) throw new RuntimeException('Database backup failed: ' . $error);
    if (!is_file($dump) || filesize($dump) === 0) throw new RuntimeException('Database backup is empty.');
    $data = file_get_contents($dump);
    if ($data === false) throw new RuntimeException('Cannot verify database backup.');
    foreach (['sl_users', 'sl_workspaces', 'sl_login_attempts'] as $table) {
        if (!str_contains($data, 'CREATE TABLE `' . $table . '`')) throw new RuntimeException('Backup is missing a required table.');
    }
    if (isset($tables['sl_account_access']) && !str_contains($data, 'CREATE TABLE `sl_account_access`')) {
        throw new RuntimeException('Backup is missing account access metadata.');
    }
    if (isset($tables['sl_shared_tracker']) && !str_contains($data, 'CREATE TABLE `sl_shared_tracker`')) {
        throw new RuntimeException('Backup is missing the shared tracker.');
    }
    echo "Database backup completed and verified.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Backup error: " . $error->getMessage() . "\n");
    $failed = true;
} finally {
    if (is_file($options) && !unlink($options)) {
        fwrite(STDERR, "Could not remove private database options. Remove the file immediately: $options\n");
        $failed = true;
    }
}
exit($failed ? 1 : 0);
