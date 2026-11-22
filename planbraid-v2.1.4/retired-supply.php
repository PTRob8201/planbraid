<?php
/*
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
declare(strict_types=1);
header('Cache-Control: no-store');
if (basename($_SERVER['SCRIPT_NAME']) === 'api.php') {
    http_response_code(410);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'The standalone Supply service has been retired. Open Supply from PlanBraid.']);
    exit;
}
header('Location: /smartlist/', true, 302);
exit;
