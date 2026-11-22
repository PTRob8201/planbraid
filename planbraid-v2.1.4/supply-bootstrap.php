<?php
/*
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
declare(strict_types=1);

const FIELDOPS_STATUSES = ['Submitted', 'Reviewing', 'Ordered', 'Ready / Picked', 'Delivered'];
const FIELDOPS_ROLES = ['technician', 'office', 'admin'];

function db(): PDO
{
    static $db;
    if ($db instanceof PDO) {
        return $db;
    }
    $path = getenv('FIELDOPS_DB_PATH') ?: '/var/lib/fieldops-supply/fieldops.sqlite';
    if (!is_file($path)) {
        throw new RuntimeException('The existing Supply database is not configured.');
    }
    $db = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    return $db;
}

function nonempty_string(mixed $value, int $max = 500): bool
{
    return is_string($value) && trim($value) !== '' && strlen($value) <= $max;
}

function valid_image(mixed $value): bool
{
    return is_string($value) && strlen($value) <= 500000 &&
        ($value === '' || preg_match('~\Ahttps://[^\s<>"\']+\z~i', $value) ||
         preg_match('~\Adata:image/(?:jpeg|png|gif|webp);base64,[a-z0-9+/=]+\z~i', $value));
}

function valid_order(array $order): bool
{
    foreach (['id', 'createdAt', 'techName', 'jobSite', 'woNumber', 'dateNeeded', 'priority', 'deliveryMethod', 'status'] as $key) {
        if (!nonempty_string($order[$key] ?? null)) {
            return false;
        }
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $order['dateNeeded']);
    if (!preg_match('/\AORD-[A-Za-z0-9-]{8,80}\z/', $order['id']) ||
        !preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $order['dateNeeded']) ||
        !$date || $date->format('Y-m-d') !== $order['dateNeeded'] ||
        strtotime($order['createdAt']) === false ||
        !in_array($order['priority'], ['Routine', 'Urgent', 'Emergency'], true) ||
        !in_array($order['deliveryMethod'], ['Office Will-Call', 'Jobsite Drop', 'Tech Van Restock'], true) ||
        !in_array($order['status'], FIELDOPS_STATUSES, true) ||
        !is_string($order['orderNotes'] ?? null) || strlen($order['orderNotes']) > 5000 ||
        !is_array($order['items'] ?? null) || !array_is_list($order['items']) ||
        count($order['items']) < 1 || count($order['items']) > 500) {
        return false;
    }
    foreach ($order['items'] as $item) {
        if (!is_array($item) || !nonempty_string($item['name'] ?? null) ||
            !nonempty_string($item['partNumber'] ?? null) || !nonempty_string($item['unit'] ?? null, 100) ||
            !is_int($item['qty'] ?? null) || $item['qty'] < 1 || $item['qty'] > 1000000 ||
            !is_string($item['notes'] ?? null) || strlen($item['notes']) > 5000 ||
            (isset($item['partMissing']) && !is_bool($item['partMissing'])) ||
            !valid_image($item['image'] ?? null)) {
            return false;
        }
    }
    return true;
}

function valid_settings(mixed $data): bool
{
    if (!is_array($data) || !is_array($data['categories'] ?? null) || !is_array($data['units'] ?? null) ||
        !array_is_list($data['categories']) || !array_is_list($data['units']) ||
        count($data['categories']) < 1 || count($data['categories']) > 500 ||
        count($data['units']) < 1 || count($data['units']) > 500) {
        return false;
    }
    foreach (array_merge($data['categories'], $data['units']) as $entry) {
        if (!nonempty_string($entry, 100)) {
            return false;
        }
    }
    return in_array($data['defaultUnit'] ?? null, $data['units'], true);
}

function valid_catalog(mixed $catalog): bool
{
    if (!is_array($catalog) || !array_is_list($catalog) || count($catalog) > 5000) {
        return false;
    }
    $ids = [];
    foreach ($catalog as $item) {
        if (!is_array($item) || !nonempty_string($item['id'] ?? null, 100) ||
            isset($ids[$item['id']]) || !nonempty_string($item['partNumber'] ?? null) ||
            !nonempty_string($item['name'] ?? null) || !nonempty_string($item['category'] ?? null, 100) ||
            !nonempty_string($item['unit'] ?? null, 100) || !is_string($item['spec'] ?? null) ||
            strlen($item['spec']) > 5000 || !is_bool($item['isFrequent'] ?? null) ||
            !valid_image($item['image'] ?? null)) {
            return false;
        }
        $ids[$item['id']] = true;
    }
    return true;
}

function shared_state(array $user): array
{
    $shared = [];
    foreach (db()->query('SELECT name, version, data FROM shared') as $row) {
        $shared[$row['name']] = ['version' => (int) $row['version'], 'data' => json_decode($row['data'], true, 64, JSON_THROW_ON_ERROR)];
    }
    $sql = 'SELECT id, owner_id, version, data FROM orders';
    $stmt = db()->prepare($sql . ($user['role'] === 'technician' ? ' WHERE owner_id = ?' : '') . ' ORDER BY rowid DESC');
    $stmt->execute($user['role'] === 'technician' ? [$user['id']] : []);
    $orders = [];
    while ($row = $stmt->fetch()) {
        $orders[] = [
            'version' => (int) $row['version'],
            'ownerId' => (int) $row['owner_id'],
            'data' => json_decode($row['data'], true, 64, JSON_THROW_ON_ERROR),
        ];
    }
    $notifications = [];
    if ($user['role'] !== 'technician') {
        $stmt = db()->prepare('SELECT n.id, n.order_id, n.part_number, n.name, n.job_site
            FROM catalog_notifications n
            WHERE NOT EXISTS (SELECT 1 FROM catalog_notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?)
            ORDER BY n.id DESC LIMIT 100');
        $stmt->execute([$user['id']]);
        while ($row = $stmt->fetch()) {
            $notifications[] = ['id' => (int) $row['id'], 'orderId' => $row['order_id'],
                'partNumber' => $row['part_number'], 'name' => $row['name'], 'jobSite' => $row['job_site']];
        }
    }
    return ['settings' => $shared['settings'], 'catalog' => $shared['catalog'], 'orders' => $orders, 'notifications' => $notifications];
}
