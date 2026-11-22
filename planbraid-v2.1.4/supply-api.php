<?php
/*
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
declare(strict_types=1);

if (!isset($db, $body, $action) || !function_exists('currentAccount')) {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/supply-bootstrap.php';

$db->beginTransaction();
$account = currentAccount($db, true);
if (!$account) { $db->rollBack(); respondSessionFailure($db); }
if ((int) $account['must_change_password'] || !(int) $account['supply_enabled']) {
    $db->rollBack();
    respond(403, ['code' => 'extension_disabled', 'error' => 'PlanBraid Supply is disabled for this account.']);
}
if (!in_array($account['supply_role'], FIELDOPS_ROLES, true)) {
    throw new RuntimeException('Invalid Supply role.');
}

$pdo = db();
$sqliteActive = false;
try {
    $pdo->exec('BEGIN IMMEDIATE');
    $sqliteActive = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS planbraid_users (
        planbraid_id INTEGER PRIMARY KEY,
        supply_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id)
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS catalog_notifications (
        id INTEGER PRIMARY KEY,
        order_id TEXT NOT NULL,
        part_number TEXT NOT NULL,
        name TEXT NOT NULL,
        job_site TEXT NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS catalog_notification_reads (
        notification_id INTEGER NOT NULL REFERENCES catalog_notifications(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        PRIMARY KEY (notification_id, user_id)
    )');
    $stmt = $pdo->prepare('SELECT supply_user_id FROM planbraid_users WHERE planbraid_id = ?');
    $stmt->execute([(int) $account['id']]);
    $supplyId = $stmt->fetchColumn();
    if ($supplyId === false) {
        $internalName = 'pb-' . $account['id'] . '-' . bin2hex(random_bytes(8));
        $passwordHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
        if ($passwordHash === false) throw new RuntimeException('Could not provision Supply identity.');
        $pdo->prepare('INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)')
            ->execute([$internalName, $passwordHash, 'technician']);
        $supplyId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO planbraid_users (planbraid_id, supply_user_id) VALUES (?, ?)')
            ->execute([(int) $account['id'], $supplyId]);
    }
    $user = ['id' => (int) $supplyId, 'username' => $account['username'], 'role' => $account['supply_role']];
    if ($action === 'supply-session') {
        $result = $user;
    } elseif ($action === 'supply-state') {
        $result = shared_state($user);
    } elseif ($action === 'supply-notification-read') {
        if ($user['role'] === 'technician') throw new DomainException('Only office staff can view notifications.', 403);
        $id = $body['id'] ?? null;
        if (!is_int($id) || $id < 1) throw new DomainException('Invalid notification.', 400);
        $stmt = $pdo->prepare('SELECT 1 FROM catalog_notifications WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetchColumn()) throw new DomainException('Notification not found.', 404);
        $stmt = $pdo->prepare('INSERT OR IGNORE INTO catalog_notification_reads (notification_id, user_id)
            SELECT id, ? FROM catalog_notifications WHERE id = ?');
        $stmt->execute([$user['id'], $id]);
        $result = shared_state($user);
    } elseif ($action === 'supply-update') {
        $input = $body;
        foreach (['settings', 'catalog'] as $name) {
            if (!array_key_exists($name, $input)) continue;
            if (($name === 'settings' && $user['role'] !== 'admin') ||
                ($name === 'catalog' && $user['role'] === 'technician')) {
                throw new DomainException('You do not have permission to change ' . $name . '.', 403);
            }
            $change = $input[$name];
            if (!is_array($change) || !is_int($change['version'] ?? null) ||
                !($name === 'settings' ? valid_settings($change['data'] ?? null) : valid_catalog($change['data'] ?? null))) {
                throw new DomainException('Invalid ' . $name . ' data.', 400);
            }
            $stmt = $pdo->prepare('UPDATE shared SET data = ?, version = version + 1 WHERE name = ? AND version = ?');
            $stmt->execute([json_encode($change['data'], JSON_THROW_ON_ERROR), $name, $change['version']]);
            if (!$stmt->rowCount()) throw new DomainException('Another user changed ' . $name . '. Refresh and try again.', 409);
        }
        $changes = $input['orders'] ?? [];
        if (!is_array($changes) || !array_is_list($changes) || count($changes) > 5000) {
            throw new DomainException('Invalid order changes.', 400);
        }
        $catalog = json_decode($pdo->query("SELECT data FROM shared WHERE name = 'catalog'")->fetchColumn(), true, 64, JSON_THROW_ON_ERROR);
        $catalogKeys = [];
        foreach ($catalog as $item) {
            $catalogKeys[json_encode([mb_strtolower(trim($item['partNumber'])), mb_strtolower(trim($item['name']))], JSON_THROW_ON_ERROR)] = true;
        }
        foreach ($changes as $change) {
            if (!is_array($change) || !is_string($change['id'] ?? null) || !is_int($change['version'] ?? null)) {
                throw new DomainException('Invalid order change.', 400);
            }
            $stmt = $pdo->prepare('SELECT owner_id, version, data FROM orders WHERE id = ?');
            $stmt->execute([$change['id']]);
            $existing = $stmt->fetch();
            if ($change['version'] === 0) {
                $order = $change['data'] ?? null;
                if ($existing || !is_array($order) || ($order['id'] ?? null) !== $change['id'] ||
                    !valid_order($order) || $order['status'] !== 'Submitted') {
                    throw new DomainException('Invalid or duplicate new order.', 409);
                }
                $pdo->prepare('INSERT INTO orders(id, owner_id, version, data) VALUES (?, ?, 1, ?)')
                    ->execute([$order['id'], $user['id'], json_encode($order, JSON_THROW_ON_ERROR)]);
                $notify = $pdo->prepare('INSERT INTO catalog_notifications (order_id, part_number, name, job_site) VALUES (?, ?, ?, ?)');
                foreach ($order['items'] as $item) {
                    $key = json_encode([mb_strtolower(trim($item['partNumber'])), mb_strtolower(trim($item['name']))], JSON_THROW_ON_ERROR);
                    if (($item['partMissing'] ?? false) || !isset($catalogKeys[$key])) {
                        $notify->execute([$order['id'], $item['partNumber'], $item['name'], $order['jobSite']]);
                    }
                }
            } else {
                if ($user['role'] === 'technician') throw new DomainException('Only office staff can update orders.', 403);
                if (!$existing || (int) $existing['version'] !== $change['version']) {
                    throw new DomainException('Another user changed this order. Refresh and try again.', 409);
                }
                if (($change['delete'] ?? false) === true) {
                    $pdo->prepare('DELETE FROM orders WHERE id = ?')->execute([$change['id']]);
                } else {
                    $order = $change['data'] ?? null;
                    $old = json_decode($existing['data'], true, 64, JSON_THROW_ON_ERROR);
                    if (!is_array($order) || !valid_order($order) || ($order['id'] ?? null) !== $change['id']) {
                        throw new DomainException('Invalid order.', 400);
                    }
                    $old['status'] = $order['status'];
                    if ($old != $order) throw new DomainException('Only order status can be changed.', 403);
                    $pdo->prepare('UPDATE orders SET data = ?, version = version + 1 WHERE id = ?')
                        ->execute([json_encode($order, JSON_THROW_ON_ERROR), $change['id']]);
                }
            }
        }
        if (isset($input['settings']) || isset($input['catalog'])) {
            $rows = $pdo->query("SELECT name, data FROM shared WHERE name IN ('settings', 'catalog')")->fetchAll();
            $values = [];
            foreach ($rows as $row) $values[$row['name']] = json_decode($row['data'], true, 64, JSON_THROW_ON_ERROR);
            foreach ($values['catalog'] as $item) {
                if (!in_array($item['category'], $values['settings']['categories'], true) ||
                    !in_array($item['unit'], $values['settings']['units'], true)) {
                    throw new DomainException('Catalog items must use existing categories and units. Refresh and try again.', 409);
                }
            }
        }
        $result = shared_state($user);
    } else {
        throw new DomainException('Unknown Supply action.', 404);
    }
    $pdo->exec('COMMIT');
    $sqliteActive = false;
    $db->commit();
    respond(200, $result);
} catch (Throwable $error) {
    if ($sqliteActive) $pdo->exec('ROLLBACK');
    if ($db->inTransaction()) $db->rollBack();
    if ($error instanceof DomainException) respond($error->getCode(), ['error' => $error->getMessage()]);
    throw $error;
}
