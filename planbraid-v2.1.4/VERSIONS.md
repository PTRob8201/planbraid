# PlanBraid release history

The canonical release list is [version.js](./assets/js/version.js). The app displays
the same list through Release history in More options. Update it for each release; the
first entry is the current version. Versions before 0.2.0 were not tracked
individually, so 0.2.0 summarizes changes since the original 0.1.0 release.

For new releases, increment the patch number through 9, then increment the
minor number and reset the patch to 0 (for example, 0.3.9 becomes 0.4.0).
When the minor number is 9, increment the major number and reset both minor
and patch to 0 (for example, 0.9.9 becomes 1.0.0).
Existing historical release numbers remain unchanged; after 0.2.13, the
next release was 0.3.0.

The server-side upgrade log and pre-upgrade snapshots are kept outside the
web root in `/home/robert/smartlist-backups/`. See README.md for the upgrade
and restoration procedure.
