# PlanBraid - outlining, project tracking, and material orders.
# Copyright (C) 2026 Robert Wasniowski
# SPDX-License-Identifier: AGPL-3.0-or-later
# Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
# Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
"""Integration tests with an isolated MariaDB and synthetic accounts."""
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
PASSWORD = "synthetic-password-123"


class SharedTrackerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="planbraid-tracker-test-")
        cls.path = Path(cls.temp.name)
        cls.socket = cls.path / "mysql.sock"
        subprocess.run(["mariadb-install-db", "--no-defaults", "--datadir=" + str(cls.path / "db"),
                        "--auth-root-authentication-method=normal", "--skip-test-db"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        cls.db = subprocess.Popen(
            ["mariadbd", "--no-defaults", "--datadir=" + str(cls.path / "db"),
             "--socket=" + str(cls.socket), "--pid-file=" + str(cls.path / "mysql.pid"),
             "--skip-networking", "--log-error=" + str(cls.path / "mysql.log")],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                if cls.db.poll() is not None:
                    raise RuntimeError("MariaDB failed to start: " + (cls.path / "mysql.log").read_text())
                if cls.socket.exists():
                    result = subprocess.run(["mariadb-admin", "--no-defaults", "--socket=" + str(cls.socket),
                                             "-u", "root", "ping"], capture_output=True)
                    if result.returncode == 0:
                        break
                time.sleep(0.1)
            else:
                raise RuntimeError("MariaDB did not start")
            cls.sql("""
                CREATE DATABASE tracker_test;
                USE tracker_test;
                CREATE TABLE sl_users (id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT, username VARCHAR(80) UNIQUE, password_hash VARCHAR(255) NOT NULL) ENGINE=InnoDB;
                CREATE TABLE sl_account_access (user_id INT UNSIGNED PRIMARY KEY, is_admin TINYINT NOT NULL DEFAULT 0, enabled TINYINT NOT NULL DEFAULT 1, auth_version BIGINT NOT NULL DEFAULT 0, active_instance_token CHAR(64), email VARCHAR(254), must_change_password TINYINT UNSIGNED NOT NULL DEFAULT 0, guide_seen TINYINT UNSIGNED NOT NULL DEFAULT 0) ENGINE=InnoDB;
                CREATE TABLE sl_workspaces (user_id INT UNSIGNED PRIMARY KEY, revision BIGINT NOT NULL, data LONGTEXT NOT NULL) ENGINE=InnoDB;
                CREATE TABLE sl_login_attempts (client_hash CHAR(64) PRIMARY KEY, attempts INT NOT NULL, expires_at DATETIME NOT NULL) ENGINE=InnoDB;
            """)
            hashed = subprocess.check_output(["php", "-r", f"echo password_hash('{PASSWORD}', PASSWORD_DEFAULT);"], text=True)
            cls.sql(f"USE tracker_test; INSERT INTO sl_users VALUES (1,'alice','{hashed}'),(2,'bob','{hashed}');"
                    "INSERT INTO sl_account_access (user_id) VALUES (1),(2);")
            config = cls.path / "config.php"
            config.write_text("<?php return ['host' => 'localhost;unix_socket=" + str(cls.socket)
                              + "', 'database' => 'tracker_test', 'username' => 'root', 'password' => ''];")
            migration = (ROOT / "migrate-onboarding.php").read_text().replace("'/etc/smartlist/database.php'", repr(str(config)))
            (cls.path / "migration.php").write_text(migration)
            for _ in range(2):
                subprocess.run(["php", str(cls.path / "migration.php")], check=True, capture_output=True)
            api = (ROOT / "api.php").read_text().replace("'/etc/smartlist/database.php'", repr(str(config)))
            (cls.path / "api.php").write_text(api)
            (cls.path / "shared-tracker-validation.php").write_text((ROOT / "shared-tracker-validation.php").read_text())
            for name in ("supply-api.php", "supply-bootstrap.php"):
                (cls.path / name).write_text((ROOT / name).read_text())
            cls.supply_db = cls.path / "supply.sqlite"
            with sqlite3.connect(cls.supply_db) as supply:
                supply.executescript("""
                    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                        password_hash TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
                    CREATE TABLE shared (name TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL);
                    CREATE TABLE orders (id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id),
                        version INTEGER NOT NULL, data TEXT NOT NULL);
                """)
                supply.executemany("INSERT INTO shared VALUES (?, 1, ?)", [
                    ("settings", json.dumps({"categories": ["Test"], "units": ["ea"], "defaultUnit": "ea"})),
                    ("catalog", "[]")])
            router = cls.path / "router.php"
            router.write_text("<?php $_SERVER['HTTPS'] = 'on'; require __DIR__ . '/api.php';")
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                cls.port = sock.getsockname()[1]
            cls.php = subprocess.Popen(["php", "-S", f"127.0.0.1:{cls.port}", str(router)],
                                       cwd=cls.path, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                       env={**os.environ, "FIELDOPS_DB_PATH": str(cls.supply_db)})
            for _ in range(100):
                try:
                    with socket.create_connection(("127.0.0.1", cls.port), timeout=1):
                        break
                except OSError:
                    time.sleep(0.05)
            else:
                raise RuntimeError("PHP server did not start")
        except Exception:
            cls.cleanup()
            raise

    @classmethod
    def sql(cls, text):
        subprocess.run(["mariadb", "--no-defaults", "--socket=" + str(cls.socket), "-u", "root"],
                       input=text, text=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    @classmethod
    def cleanup(cls):
        for process in (getattr(cls, "php", None), getattr(cls, "db", None)):
            if process and process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
        cls.temp.cleanup()

    @classmethod
    def tearDownClass(cls):
        cls.cleanup()

    def request(self, client, action, body=None, token=None):
        headers = {"X-Smartlist-Instance": client["instance"]}
        if client.get("cookie"):
            headers["Cookie"] = client["cookie"]
        if body is not None:
            headers["Content-Type"] = "application/json"
            headers["X-CSRF-Token"] = token if token is not None else client["csrf"]
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET" if body is None else "POST", "/smartlist/api.php?action=" + action,
                     body=None if body is None else json.dumps(body), headers=headers)
        response = conn.getresponse()
        cookie = response.getheader("Set-Cookie")
        if cookie:
            client["cookie"] = cookie.split(";", 1)[0]
        result = json.loads(response.read())
        status = response.status
        conn.close()
        return status, result

    def login(self, username):
        client = {"instance": secrets.token_hex(32)}
        status, session = self.request(client, "session")
        self.assertEqual(status, 200)
        client["csrf"] = session["csrf"]
        status, result = self.request(client, "login", {"username": username, "password": PASSWORD})
        self.assertEqual(status, 200, result)
        client["csrf"] = result["csrf"]
        return client

    def test_shared_tracker_authentication_and_conflicts(self):
        self.sql("USE tracker_test; UPDATE sl_account_access SET pm_enabled = 1, enabled = 1, must_change_password = 0;")
        anonymous = {"instance": secrets.token_hex(32), "csrf": "invalid"}
        self.assertEqual(self.request(anonymous, "shared-tracker-load", {})[0], 401)
        alice, bob = self.login("alice"), self.login("bob")
        loaded = self.request(alice, "load", {})[1]
        self.assertEqual((loaded["userId"], loaded["revision"], loaded["state"]), (1, 0, None))
        self.assertEqual(self.request(bob, "load", {})[1]["userId"], 2)
        outline = {"spaces": [{"id": "space"}], "documents": [{"id": "document", "title": "Synthetic"}]}
        self.assertEqual(self.request(alice, "save", {"revision": 0, "state": outline})[0], 200)
        self.assertEqual(self.request(alice, "save", {"revision": 0, "state": outline})[0], 409)
        loaded = self.request(alice, "load", {})[1]
        self.assertEqual((loaded["revision"], loaded["state"]), (1, outline))
        self.assertIsNone(self.request(bob, "load", {})[1]["state"])
        status, initial = self.request(alice, "shared-tracker-load", {})
        self.assertEqual(status, 200)
        self.assertEqual(initial["state"], {"projects": [], "milestones": [], "tasks": []})
        self.assertEqual(initial["version"], 0)
        self.assertEqual(initial["users"], ["alice", "bob"])
        state = {"projects": [{"id": "p1", "name": "Project", "owner": "alice", "targetDate": ""}],
                 "milestones": [], "tasks": []}
        self.assertEqual(self.request(alice, "shared-tracker-save", {"version": 0, "state": state}, "wrong")[0], 403)
        self.assertEqual(self.request(alice, "shared-tracker-save", {"version": 0, "state": {"projects": []}})[0], 422)
        invalid = {"projects": state["projects"], "milestones": [
            {"id": "m1", "projectId": "missing", "name": "Phase", "targetDate": ""}], "tasks": []}
        self.assertEqual(self.request(alice, "shared-tracker-save", {"version": 0, "state": invalid})[0], 422)
        invalid["milestones"][0]["projectId"] = "p1"
        invalid["tasks"] = [{"id": "t1", "title": "Task", "owner": "alice", "milestoneId": "m1",
                             "status": "Blocked", "priority": "Normal", "dueDate": "",
                             "blockedBy": "", "notes": ""}]
        self.assertEqual(self.request(alice, "shared-tracker-save", {"version": 0, "state": invalid})[0], 422)
        self.assertEqual(self.request(alice, "shared-tracker-save",
                                      {"version": 0, "state": dict(state, padding="x" * 1048576)})[0], 413)
        self.assertEqual(self.request(alice, "shared-tracker-save", {"version": 0, "state": state})[0], 200)
        status, shared = self.request(bob, "shared-tracker-load", {})
        self.assertEqual((status, shared["version"], shared["state"]), (200, 1, state))
        self.assertEqual(self.request(bob, "shared-tracker-save", {"version": 0, "state": state})[0], 409)
        self.assertEqual(self.request(bob, "shared-tracker-save", {"version": 1, "state": state})[0], 200)
        replacement = self.login("alice")
        status, displaced = self.request(alice, "shared-tracker-save", {"version": 2, "state": state})
        self.assertEqual((status, displaced.get("code")), (409, "session_replaced"))
        self.sql("USE tracker_test; UPDATE sl_account_access SET must_change_password = 1 WHERE user_id = 2;")
        self.assertEqual(self.request(bob, "shared-tracker-load", {})[0], 403)
        self.sql("USE tracker_test; UPDATE sl_account_access SET enabled = 0, auth_version = auth_version + 1 WHERE user_id = 2;")
        self.assertEqual(self.request(bob, "shared-tracker-load", {})[0], 401)
        self.assertEqual(self.request(replacement, "shared-tracker-load", {})[1]["version"], 2)

    def test_extension_permissions_and_supply_isolation(self):
        self.sql("USE tracker_test; UPDATE sl_account_access SET is_admin = (user_id = 1), "
                 "enabled = 1, must_change_password = 0, pm_enabled = 0, supply_enabled = 0, "
                 "supply_role = 'technician';")
        alice, bob = self.login("alice"), self.login("bob")
        session = self.request(bob, "session")[1]
        self.assertEqual((session["pmEnabled"], session["supplyEnabled"], session["supplyRole"]),
                         (False, False, "technician"))
        self.assertEqual(self.request(bob, "shared-tracker-load", {})[0], 403)
        self.assertEqual(self.request(bob, "supply-state", {})[0], 403)
        change = {"userId": 2, "pmEnabled": True, "supplyEnabled": True, "supplyRole": "technician"}
        self.assertEqual(self.request(bob, "account-extensions", change)[0], 403)
        self.assertEqual(self.request(alice, "account-extensions", change, "wrong")[0], 403)
        self.assertEqual(self.request(alice, "account-extensions", change)[0], 200)
        self.assertEqual(self.request(bob, "shared-tracker-load", {})[0], 200)
        self.assertEqual(self.request(bob, "supply-session", {})[0], 200)
        order = {"id": "ORD-synthetic-12345678", "createdAt": "2026-01-01T00:00:00Z",
                 "techName": "Synthetic", "jobSite": "Test", "woNumber": "123",
                 "dateNeeded": "2026-01-02", "priority": "Routine", "deliveryMethod": "Office Will-Call",
                 "status": "Submitted", "orderNotes": "", "items": [
                     {"name": "Test", "partNumber": "1", "unit": "ea", "qty": 1, "notes": "", "image": ""}]}
        legacy_order = dict(order, id="ORD-legacy-12345678")
        with sqlite3.connect(self.supply_db) as db:
            db.execute("INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)",
                       ("legacy-synthetic", "synthetic-hash", "technician"))
            legacy_id = db.execute("SELECT id FROM users WHERE username = 'legacy-synthetic'").fetchone()[0]
            db.execute("INSERT INTO orders (id, owner_id, version, data) VALUES (?, ?, 1, ?)",
                       (legacy_order["id"], legacy_id, json.dumps(legacy_order)))
        self.assertEqual(self.request(bob, "supply-update", {"orders": [
            {"id": order["id"], "version": 0, "data": order}]})[0], 200)
        self.assertEqual(self.request(bob, "supply-update", {"orders": [
            {"id": order["id"], "version": 1, "delete": True}]})[0], 403)
        self.assertEqual(self.request(bob, "supply-update", {"settings": {"version": 1, "data": {}}})[0], 403)
        alice_change = dict(change, userId=1)
        self.assertEqual(self.request(alice, "account-extensions", alice_change)[0], 200)
        self.assertEqual(self.request(alice, "supply-state", {})[1]["orders"], [])
        self.assertEqual(len(self.request(bob, "supply-state", {})[1]["orders"]), 1)
        self.assertEqual(self.request(alice, "account-extensions", dict(change, supplyRole="office"))[0], 200)
        self.assertEqual(len(self.request(bob, "supply-state", {})[1]["orders"]), 2)
        settings = {"categories": ["Test", "Extra"], "units": ["ea"], "defaultUnit": "ea"}
        self.assertEqual(self.request(bob, "supply-update", {"settings": {"version": 1, "data": settings}})[0], 403)
        self.assertEqual(self.request(bob, "supply-update", {"orders": [
            {"id": order["id"], "version": 1, "data": dict(order, status="Ordered")},
            {"id": legacy_order["id"], "version": 10, "delete": True}]})[0], 409)
        unchanged = self.request(bob, "supply-state", {})[1]["orders"]
        self.assertEqual(next(row for row in unchanged if row["data"]["id"] == order["id"])["version"], 1)
        self.assertEqual(self.request(bob, "supply-update", {"orders": [
            {"id": order["id"], "version": 1, "data": dict(order, status="Ordered")}]})[0], 200)
        self.assertEqual(self.request(bob, "supply-update", {"orders": [
            {"id": order["id"], "version": 1, "delete": True}]})[0], 409)
        self.assertEqual(self.request(alice, "account-extensions", dict(change, supplyRole="admin"))[0], 200)
        self.assertEqual(self.request(bob, "supply-update", {"settings": {"version": 1, "data": settings}})[0], 200)
        self.assertEqual(self.request(alice, "account-extensions", dict(change, supplyEnabled=False, pmEnabled=False))[0], 200)
        self.assertEqual(self.request(bob, "supply-state", {})[0], 403)
        self.assertEqual(self.request(bob, "shared-tracker-load", {})[0], 403)
        self.assertEqual(self.request(alice, "account-extensions", change)[0], 200)
        replacement = self.login("bob")
        status, displaced = self.request(bob, "supply-state", {})
        self.assertEqual((status, displaced.get("code")), (409, "session_replaced"))
        self.sql("USE tracker_test; UPDATE sl_account_access SET must_change_password = 1 WHERE user_id = 2;")
        self.assertEqual(self.request(replacement, "supply-state", {})[0], 403)
        self.sql("USE tracker_test; UPDATE sl_account_access SET enabled = 0, auth_version = auth_version + 1 WHERE user_id = 2;")
        self.assertEqual(self.request(replacement, "supply-state", {})[0], 401)
        with sqlite3.connect(self.supply_db) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM orders").fetchone()[0], 2)
            self.assertEqual(db.execute("SELECT owner_id FROM orders WHERE id = ?", (legacy_order["id"],)).fetchone()[0], legacy_id)

    def test_supply_catalog_notifications(self):
        self.sql("USE tracker_test; UPDATE sl_account_access SET enabled = 1, must_change_password = 0, "
                 "supply_enabled = 1, supply_role = CASE WHEN user_id = 1 THEN 'office' ELSE 'technician' END;")
        alice, bob = self.login("alice"), self.login("bob")
        catalog = [{"id": "test-item", "partNumber": "ABC", "name": "Widget", "category": "Test",
                    "unit": "ea", "spec": "", "isFrequent": False, "image": ""}]
        with sqlite3.connect(self.supply_db) as db:
            original = db.execute("SELECT data, version FROM shared WHERE name = 'catalog'").fetchone()
            db.execute("UPDATE shared SET data = ?, version = version + 1 WHERE name = 'catalog'", (json.dumps(catalog),))
        def cleanup_supply():
            with sqlite3.connect(self.supply_db) as db:
                db.execute("DELETE FROM catalog_notification_reads WHERE notification_id IN "
                           "(SELECT id FROM catalog_notifications WHERE order_id = ?)", ("ORD-notification-12345678",))
                db.execute("DELETE FROM catalog_notifications WHERE order_id = ?", ("ORD-notification-12345678",))
                db.execute("DELETE FROM orders WHERE id = ?", ("ORD-notification-12345678",))
                db.execute("UPDATE shared SET data = ?, version = ? WHERE name = 'catalog'", original)
        self.addCleanup(cleanup_supply)
        order = {"id": "ORD-notification-12345678", "createdAt": "2026-01-01T00:00:00Z",
                 "techName": "Synthetic", "jobSite": "Test site", "woNumber": "123",
                 "dateNeeded": "2026-01-02", "priority": "Routine", "deliveryMethod": "Office Will-Call",
                 "status": "Submitted", "orderNotes": "", "items": [
                     {"name": "widget", "partNumber": " abc ", "unit": "ea", "qty": 1, "notes": "", "image": ""},
                     {"name": "New", "partNumber": "NEW", "unit": "ea", "qty": 1, "notes": "", "image": ""},
                     {"name": "No part", "partNumber": "CUSTOM", "partMissing": True, "unit": "ea", "qty": 1, "notes": "", "image": ""}]}
        payload = {"orders": [{"id": order["id"], "version": 0, "data": order}]}
        self.assertEqual(self.request(bob, "supply-update", payload)[0], 200)
        self.assertEqual(self.request(bob, "supply-state", {})[1]["notifications"], [])
        self.assertEqual(self.request(bob, "supply-notification-read", {"id": 1})[0], 403)
        notices = [n for n in self.request(alice, "supply-state", {})[1]["notifications"] if n["orderId"] == order["id"]]
        self.assertEqual({n["name"] for n in notices}, {"New", "No part"})
        self.assertEqual(self.request(bob, "supply-update", payload)[0], 409)
        self.assertEqual(len([n for n in self.request(alice, "supply-state", {})[1]["notifications"]
                              if n["orderId"] == order["id"]]), 2)
        notice_id = notices[0]["id"]
        self.assertEqual(self.request(alice, "supply-notification-read", {"id": notice_id})[0], 200)
        self.assertNotIn(notice_id, [n["id"] for n in self.request(alice, "supply-state", {})[1]["notifications"]])
        self.sql("USE tracker_test; UPDATE sl_account_access SET supply_role = 'admin' WHERE user_id = 2;")
        self.assertIn(notice_id, [n["id"] for n in self.request(bob, "supply-state", {})[1]["notifications"]])
        self.assertEqual(self.request(bob, "supply-notification-read", {"id": 999999})[0], 404)

    def test_personal_project_added_once_without_overwriting_workspaces(self):
        self.addCleanup(self.sql, "USE tracker_test; DELETE FROM sl_workspaces; UPDATE sl_account_access "
                        "SET personal_project_pending = 0, must_change_password = 0, enabled = 1;")
        self.sql("USE tracker_test; UPDATE sl_account_access SET enabled = 1, must_change_password = 0, "
                 "personal_project_pending = 1; DELETE FROM sl_workspaces;")
        existing = {"spaces": [{"id": "space", "name": "Existing"}], "activeId": "personal",
                    "documents": [{"id": "personal", "title": "Work", "nodes": []}], "settings": {"theme": "light"}}
        already_personal = {"spaces": [{"id": "space", "name": "Existing"}], "activeId": "keep",
                            "documents": [{"id": "keep", "title": " personal ", "nodes": []}]}
        def workspace_sql(user_id, data, revision):
            encoded = json.dumps(data, ensure_ascii=False).replace("'", "''")
            return f"INSERT INTO sl_workspaces VALUES ({user_id}, {revision}, '{encoded}');"
        self.sql("USE tracker_test; " + workspace_sql(1, already_personal, 4) + workspace_sql(2, existing, 7))
        alice, bob = self.login("alice"), self.login("bob")
        original = self.request(alice, "load", {})[1]
        self.assertEqual((original["revision"], original["state"]), (4, already_personal))
        renamed = dict(already_personal, documents=[{"id": "keep", "title": "Renamed", "nodes": []}])
        self.assertEqual(self.request(alice, "save", {"revision": 4, "state": renamed})[0], 200)
        self.assertEqual(self.request(alice, "load", {})[1]["state"], renamed)
        status, loaded = self.request(bob, "load", {})
        self.assertEqual(status, 200)
        self.assertEqual(loaded["revision"], 8)
        self.assertEqual(loaded["state"]["documents"][0], existing["documents"][0])
        self.assertEqual(loaded["state"]["activeId"], existing["activeId"])
        personal = loaded["state"]["documents"][1]
        self.assertEqual((personal["title"], personal["spaceId"], personal["nodes"]), ("Personal", "space", []))
        self.assertNotEqual(personal["id"], "personal")
        self.assertEqual(self.request(bob, "save", {"revision": 7, "state": existing})[0], 409)
        self.assertEqual(self.request(bob, "save", {"revision": 8, "state": existing})[0], 200)
        self.assertEqual(self.request(bob, "load", {})[1]["state"], existing)
        self.sql("USE tracker_test; DELETE FROM sl_workspaces WHERE user_id = 2; "
                 "UPDATE sl_account_access SET personal_project_pending = 1 WHERE user_id = 2;")
        self.assertIsNone(self.request(bob, "load", {})[1]["state"])
        legacy = {"activeId": "work", "documents": [{"id": "work", "title": "Work", "nodes": []}]}
        self.sql("USE tracker_test; " + workspace_sql(2, legacy, 1) +
                 "UPDATE sl_account_access SET personal_project_pending = 1 WHERE user_id = 2;")
        self.assertEqual(self.request(bob, "load", {})[1]["state"]["documents"][1]["spaceId"], "default-space")
        nearly_full = dict(existing, padding="x" * 5239920)
        self.sql("USE tracker_test; DELETE FROM sl_workspaces WHERE user_id = 2; " +
                 workspace_sql(2, nearly_full, 2) +
                 "UPDATE sl_account_access SET personal_project_pending = 1 WHERE user_id = 2;")
        status, full = self.request(bob, "load", {})
        self.assertEqual(status, 200)
        self.assertEqual(full["revision"], 2)
        self.assertIn("size limit", full["personalProjectWarning"])
        self.assertEqual(self.request(bob, "save", {"revision": 2, "state": existing})[0], 200)
        self.assertEqual(self.request(bob, "load", {})[1]["state"]["documents"][1]["title"], "Personal")


if __name__ == "__main__":
    unittest.main()
