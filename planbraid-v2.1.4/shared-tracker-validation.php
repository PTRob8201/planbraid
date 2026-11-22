<?php
/*
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
declare(strict_types=1);

function trackerValidText(mixed $value, int $max, bool $required = false): bool {
    return is_string($value) && mb_check_encoding($value, 'UTF-8')
        && mb_strlen($value) <= $max && (!$required || trim($value) !== '')
        && !preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value);
}

function trackerValidDate(mixed $value): bool {
    if ($value === '') return true;
    if (!is_string($value) || !preg_match('/\A(\d{4})-(\d{2})-(\d{2})\z/', $value, $parts)) return false;
    return checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
}

function trackerValidId(mixed $value): bool {
    return is_string($value) && preg_match('/\A[a-zA-Z0-9_-]{1,80}\z/', $value) === 1;
}

function trackerValidState(mixed $data): bool {
    if (!is_array($data)) return false;
    foreach (['projects', 'milestones', 'tasks'] as $key) {
        if (!isset($data[$key]) || !is_array($data[$key]) || !array_is_list($data[$key]) || count($data[$key]) > 5000) return false;
    }
    $projects = [];
    foreach ($data['projects'] as $project) {
        if (!is_array($project) || !trackerValidId($project['id'] ?? null) || isset($projects[$project['id']])
            || !trackerValidText($project['name'] ?? null, 200, true)
            || !trackerValidText($project['owner'] ?? null, 100, true)
            || !trackerValidDate($project['targetDate'] ?? null)) return false;
        $projects[$project['id']] = true;
    }
    $milestones = [];
    foreach ($data['milestones'] as $milestone) {
        if (!is_array($milestone) || !trackerValidId($milestone['id'] ?? null) || isset($milestones[$milestone['id']])
            || !trackerValidId($milestone['projectId'] ?? null) || !isset($projects[$milestone['projectId']])
            || !trackerValidText($milestone['name'] ?? null, 200, true)
            || !trackerValidDate($milestone['targetDate'] ?? null)) return false;
        $milestones[$milestone['id']] = true;
    }
    $tasks = [];
    foreach ($data['tasks'] as $task) {
        if (!is_array($task) || !trackerValidId($task['id'] ?? null) || isset($tasks[$task['id']])
            || !trackerValidText($task['title'] ?? null, 200, true)
            || !in_array($task['status'] ?? null, ['Backlog', 'Ready', 'In Progress', 'Blocked', 'Done'], true)
            || !in_array($task['priority'] ?? null, ['High', 'Normal', 'Low'], true)
            || !trackerValidText($task['owner'] ?? null, 100, true)
            || !trackerValidDate($task['dueDate'] ?? null)
            || !trackerValidId($task['milestoneId'] ?? null) || !isset($milestones[$task['milestoneId']])
            || !trackerValidText($task['blockedBy'] ?? null, 2000, ($task['status'] ?? null) === 'Blocked')
            || !trackerValidText($task['notes'] ?? null, 10000)) return false;
        $tasks[$task['id']] = true;
    }
    return true;
}
