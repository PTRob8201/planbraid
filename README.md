# PlanBraid

PlanBraid is a web app for organizing notes and projects, tracking shared
work, and managing material orders. Visit [planbraid.com](https://planbraid.com/).

## What it includes

- **Core:** Organize an outline workspace with notes, projects, search,
  priorities, reminders, and customizable designs.
- **PlanBraid PM:** Track shared projects, milestones, and tasks with a compact
  dashboard. Accounts with PM access work in the same shared tracker.
- **PlanBraid Supply:** Manage a material catalog and orders. Technicians can
  submit and view their own orders; office staff can manage the catalog and
  orders; managers and administrators can also manage Supply settings.
  Supply managers do not receive PlanBraid account-administration access.

PM and Supply use the same PlanBraid login. An administrator controls access
to each extension and assigns Supply roles in **Manage accounts**.

## Hostinger upgrade

The [v2.4.0 Hostinger release](https://github.com/PTRob8201/planbraid/tree/v2.4.0-hostinger)
is an upgrade for an existing v2.2.0 Hostinger installation, not a fresh
installer. Download the
[Hostinger upgrade ZIP](https://github.com/PTRob8201/planbraid/raw/v2.4.0-hostinger/planbraid-hostinger-v2.4.0.zip)
from the tagged commit. GitHub's automatically generated source archives
contain the repository, not a ready-to-deploy app directory.

v2.4.0 adds private/shared tasks and project grouping, the Walkthrough and
Files extensions, private Continuum, device-aware dark landing and sign-in
pages, and administrator visitor statistics.

Before upgrading, schedule downtime and verify backups of the application
files, private configuration, MySQL database, and Supply SQLite database.
Extract the ZIP outside the web root and follow its `README.md`; preserve the
existing `.htaccess` and private data. This upgrade **requires** running the
additive database migrations in the package's `tools/` directory before
copying `public_html/`.

The package includes the DB-IP Country Lite database by
[DB-IP](https://db-ip.com), licensed under CC BY 4.0.

## Source and license

The upgrade ZIP includes the application source and a `planbraid-source.zip`
for the deployed app. The deployed source is also available from the app's
License dialog. The application source is licensed under the GNU AGPL v3 or
later; see `public_html/LICENSE` in the upgrade package. The PlanBraid name
and logo are not licensed under the AGPL.
