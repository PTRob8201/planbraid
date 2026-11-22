#!/usr/bin/env python3
# PlanBraid - outlining, project tracking, and material orders.
# Copyright (C) 2026 Robert Wasniowski
# SPDX-License-Identifier: AGPL-3.0-or-later
# Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
# Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
"""Create and verify an online backup of the existing Supply database."""
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote

if len(sys.argv) != 3:
    raise SystemExit("Usage: backup-supply.py SOURCE DESTINATION")
source = Path(sys.argv[1]).resolve(strict=True)
destination = Path(sys.argv[2])
if not source.is_file() or destination.exists():
    raise SystemExit("Supply source must be a file and destination must not exist.")
uri = "file:" + quote(str(source), safe="/") + "?mode=ro"
with sqlite3.connect(uri, uri=True, timeout=30) as original:
    with sqlite3.connect(destination) as backup:
        original.backup(backup)
        if backup.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise RuntimeError("Supply backup failed integrity check.")
        tables = {row[0] for row in backup.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        if not {"users", "orders", "shared"}.issubset(tables):
            raise RuntimeError("Supply backup is missing required tables.")
print("Supply database backup completed and verified.")
