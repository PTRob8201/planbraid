# PlanBraid - outlining, project tracking, and material orders.
# Copyright (C) 2026 Robert Wasniowski
# SPDX-License-Identifier: AGPL-3.0-or-later
# Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
# Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
"""Exercise the upgrade layout against synthetic files, never a live installation."""
import hashlib
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class UpgradeLayoutTest(unittest.TestCase):
    def test_backup_before_nested_install_and_hash_guard(self):
        with tempfile.TemporaryDirectory(prefix="planbraid-upgrade-test-") as temp:
            path = Path(temp)
            stage = path / "stage"
            shutil.copytree(ROOT, stage)
            live = path / "www" / "smartlist"
            live.mkdir(parents=True)
            backups = path / "backups"
            supply = live.parent / "supply"
            supply.mkdir()
            supply_db = path / "supply.sqlite"
            supply_names = ("index.php", "app.php", "api.php", "bootstrap.php")
            for name in supply_names:
                (supply / name).write_text("previous " + name)
            supply_expected = path / "supply-expected"
            supply_expected.write_text("".join(
                f"{hashlib.sha256((supply / name).read_bytes()).hexdigest()}  {name}\n"
                for name in supply_names
            ))
            for name in ("index.html", "api.php", "README.md", "VERSIONS.md", "version.js"):
                (live / name).write_text("previous " + name)
            expected = path / "expected"
            expected.write_text("".join(
                f"{hashlib.sha256((live / name).read_bytes()).hexdigest()}  {name}\n"
                for name in ("index.html", "api.php", "README.md", "VERSIONS.md", "version.js")
            ))
            script = (stage / "upgrade.sh").read_text().replace(
                "live=/var/www/html/smartlist", f"live={live}"
            ).replace("backups=/home/robert/smartlist-backups", f"backups={backups}").replace(
                "supply=/var/www/html/supply", f"supply={supply}"
            ).replace("supply_database=/var/lib/fieldops-supply/fieldops.sqlite", f"supply_database={supply_db}").replace(
                "tar -C /var/www/html", f"tar -C {live.parent}"
            )
            (stage / "upgrade.sh").write_text(script)
            (stage / "dump-database.php").write_text("<?php fwrite(STDERR, 'synthetic backup failure'); exit(1);")
            for name in ("migrate-accounts.php", "migrate-onboarding.php"):
                (stage / name).write_text("<?php echo 'synthetic migration';")
            args = ["bash", str(stage / "upgrade.sh"), str(stage), str(expected), str(supply_expected)]
            result = subprocess.run(args,
                                    text=True, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((live / "index.html").read_text(), "previous index.html")
            self.assertFalse((live / "assets").exists())
            (stage / "dump-database.php").write_text(
                "<?php file_put_contents($argv[1] . '/database.sql', 'synthetic database');"
            )
            result = subprocess.run(args, text=True, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((supply / "api.php").read_text(), "previous api.php")
            self.assertEqual((live / "index.html").read_text(), "previous index.html")
            with sqlite3.connect(supply_db) as db:
                db.executescript("CREATE TABLE users (id INTEGER); CREATE TABLE orders (id INTEGER); CREATE TABLE shared (id INTEGER);")
            fake_bin = path / "bin"
            fake_bin.mkdir()
            failing_mv = fake_bin / "mv"
            failing_mv.write_text("#!/bin/sh\n"
                f"if [ \"$3\" = '{live}/api.php' ] && [ ! -f '{path}/failed-once' ]; then\n"
                f"  touch '{path}/failed-once'; exit 1\nfi\nexec /usr/bin/mv \"$@\"\n")
            failing_mv.chmod(0o755)
            result = subprocess.run(args, text=True, capture_output=True,
                                    env={**os.environ, "PATH": str(fake_bin) + ":" + os.environ["PATH"]})
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Application files restored", result.stderr)
            self.assertEqual((live / "index.html").read_text(), "previous index.html")
            self.assertEqual((supply / "api.php").read_text(), "previous api.php")
            result = subprocess.run(args,
                                    text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual((live / "assets/js/app.js").read_bytes(), (ROOT / "assets/js/app.js").read_bytes())
            self.assertEqual((live / "assets/css/tailwind.css").read_bytes(), (ROOT / "assets/css/tailwind.css").read_bytes())
            self.assertEqual((live / "LICENSE").read_bytes(), (ROOT / "LICENSE").read_bytes())
            self.assertEqual((live / "version.js").read_text(), "previous version.js")
            snapshots = [item for item in backups.iterdir() if item.is_dir() and (item / "SHA256SUMS").exists()]
            self.assertEqual(len(snapshots), 2)
            subprocess.run(["sha256sum", "-c", "SHA256SUMS"], cwd=snapshots[0], check=True, capture_output=True)
            self.assertEqual((snapshots[0] / "database.sql").read_text(), "synthetic database")
            self.assertTrue((snapshots[0] / "supply.sqlite").is_file())
            self.assertEqual((supply / "api.php").read_bytes(), (ROOT / "retired-supply.php").read_bytes())
            self.assertEqual((live / "supply-api.php").read_bytes(), (ROOT / "supply-api.php").read_bytes())
            result = subprocess.run(args,
                                    text=True, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Supply files changed", result.stderr)


if __name__ == "__main__":
    unittest.main()
