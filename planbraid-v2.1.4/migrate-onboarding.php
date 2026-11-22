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
foreach ([
    'email' => 'VARCHAR(254) NULL',
    'must_change_password' => 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    'guide_seen' => 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    'pm_enabled' => 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    'supply_enabled' => 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    'supply_role' => "VARCHAR(12) NOT NULL DEFAULT 'technician'",
    'personal_project_pending' => 'TINYINT UNSIGNED NOT NULL DEFAULT 1'
] as $column => $definition) {
    $statement = $db->prepare('SELECT DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?');
    $statement->execute([$config['database'], 'sl_account_access', $column]);
    $existing = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        $db->exec("ALTER TABLE sl_account_access ADD COLUMN `$column` $definition");
        $statement->execute([$config['database'], 'sl_account_access', $column]);
        $existing = $statement->fetch(PDO::FETCH_ASSOC);
    }
    $valid = $existing && match ($column) {
        'email' => $existing['DATA_TYPE'] === 'varchar' && (int) $existing['CHARACTER_MAXIMUM_LENGTH'] === 254 && $existing['IS_NULLABLE'] === 'YES',
        'supply_role' => $existing['DATA_TYPE'] === 'varchar' && (int) $existing['CHARACTER_MAXIMUM_LENGTH'] === 12 && $existing['IS_NULLABLE'] === 'NO' && trim((string) $existing['COLUMN_DEFAULT'], "'") === 'technician',
        'personal_project_pending' => $existing['DATA_TYPE'] === 'tinyint' && str_contains($existing['COLUMN_TYPE'], 'unsigned') && $existing['IS_NULLABLE'] === 'NO' && (string) $existing['COLUMN_DEFAULT'] === '1',
        default => $existing['DATA_TYPE'] === 'tinyint' && str_contains($existing['COLUMN_TYPE'], 'unsigned') && $existing['IS_NULLABLE'] === 'NO' && (string) $existing['COLUMN_DEFAULT'] === '0',
    };
    if (!$valid) {
        throw new RuntimeException("Unexpected account metadata definition for $column; migration stopped.");
    }
}
$db->exec('CREATE TABLE IF NOT EXISTS sl_shared_tracker (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    version BIGINT UNSIGNED NOT NULL,
    data LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$statement = $db->prepare('SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION');
$statement->execute([$config['database'], 'sl_shared_tracker']);
$columns = $statement->fetchAll(PDO::FETCH_ASSOC);
$engine = $db->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND TABLE_TYPE = ?');
$engine->execute([$config['database'], 'sl_shared_tracker', 'BASE TABLE']);
if (count($columns) !== 3 || array_column($columns, 'COLUMN_NAME') !== ['id', 'version', 'data']
    || $columns[0]['DATA_TYPE'] !== 'tinyint' || !str_contains($columns[0]['COLUMN_TYPE'], 'unsigned') || $columns[0]['COLUMN_KEY'] !== 'PRI'
    || $columns[1]['DATA_TYPE'] !== 'bigint' || !str_contains($columns[1]['COLUMN_TYPE'], 'unsigned')
    || $columns[2]['DATA_TYPE'] !== 'longtext' || array_column($columns, 'IS_NULLABLE') !== ['NO', 'NO', 'NO']
    || strcasecmp((string) $engine->fetchColumn(), 'InnoDB') !== 0) {
    throw new RuntimeException('Unexpected shared tracker table definition; migration stopped.');
}
echo "Account onboarding and shared tracker migrations verified.\n";
