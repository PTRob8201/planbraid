#!/usr/bin/env bash
# PlanBraid - outlining, project tracking, and material orders.
# Copyright (C) 2026 Robert Wasniowski
# SPDX-License-Identifier: AGPL-3.0-or-later
# Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
# Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
set -euo pipefail
umask 077

if [ "$#" -ne 3 ]; then
    echo "Usage: bash upgrade.sh STAGING_DIRECTORY EXPECTED_LIVE_HASHES EXPECTED_SUPPLY_HASHES" >&2
    exit 1
fi
if ! php -r "exit(PHP_VERSION_ID >= 80100 && extension_loaded('mbstring') && extension_loaded('pdo_sqlite') ? 0 : 1);"; then
    echo "PlanBraid extensions require PHP 8.1 or later with mbstring and PDO SQLite." >&2
    exit 1
fi
stage=$(cd "$1" && pwd -P)
expected=$(cd "$(dirname "$2")" && pwd -P)/$(basename "$2")
supply_expected=$(cd "$(dirname "$3")" && pwd -P)/$(basename "$3")
live=/var/www/html/smartlist
supply=/var/www/html/supply
supply_database=/var/lib/fieldops-supply/fieldops.sqlite
backups=/home/robert/smartlist-backups
mkdir -p "$backups"
chmod 700 "$backups"
exec 9>"$backups/upgrade.lock"
if ! flock -n 9; then echo "Another upgrade is running." >&2; exit 1; fi
scripts=(assets/js/bootstrap.js assets/js/pm.js assets/js/templates.js assets/js/tags.js assets/js/views.js assets/js/notes.js assets/js/agenda-spreadsheet.js assets/js/agenda-notes.js assets/js/reminders.js assets/js/export.js assets/js/account.js assets/js/help.js assets/js/license.js assets/js/settings.js assets/js/offline.js assets/js/app.js)
styles=(assets/css/tailwind.css)
extension_files=(supply-app.html supply-api.php supply-bootstrap.php assets/css/supply.css assets/css/supply-input.css)
icons=(assets/images/apple-touch-icon.png)
images=(assets/images/planbraid-logo.png)
landing_images=(assets/images/landing-project.png assets/images/landing-dashboard.png assets/images/landing-continuum.png)
pages=(landing.html LICENSE)
tracker_files=(shared-tracker.html assets/css/shared-tracker.css shared-tracker-validation.php)
design_styles=(assets/css/design-classic.css assets/css/design-studio.css assets/css/design-modern.css assets/css/design-minimal.css assets/css/design-vibrant.css assets/css/design-fusion.css)
style_sources=(assets/css/styles.css assets/css/agenda-notes.css assets/css/tailwind-input.css assets/css/design-classic.input.css assets/css/design-studio.input.css assets/css/design-modern.input.css assets/css/design-minimal.input.css assets/css/design-vibrant.input.css assets/css/design-fusion.input.css)
for file in index.html "${pages[@]}" "${tracker_files[@]}" "${extension_files[@]}" "${styles[@]}" "${icons[@]}" "${images[@]}" "${landing_images[@]}" "${design_styles[@]}" "${style_sources[@]}" "${scripts[@]}" api.php README.md assets/js/version.js service-worker.js VERSIONS.md dump-database.php migrate-onboarding.php upgrade.sh backup-supply.py retired-supply.php; do
    if [ ! -f "$stage/$file" ]; then echo "Missing staged file: $file" >&2; exit 1; fi
done
if [ ! -f "$expected" ]; then echo "Expected live hash list is missing." >&2; exit 1; fi
if [ ! -f "$supply_expected" ]; then echo "Expected Supply hash list is missing." >&2; exit 1; fi
for file in index.php app.php api.php bootstrap.php; do
    if ! grep -Eq "^[0-9a-f]{64} [ *]+${file//./\\.}$" "$supply_expected"; then
        echo "Supply hash list does not cover $file." >&2
        exit 1
    fi
done
if ! (cd "$supply" && sha256sum --status -c "$supply_expected"); then
    echo "Supply files changed since preparation; upgrade stopped." >&2
    exit 1
fi
for file in index.html api.php README.md VERSIONS.md; do
    if ! grep -Eq "^[0-9a-f]{64} [ *]+${file//./\\.}$" "$expected"; then
        echo "Hash list does not cover $file." >&2
        exit 1
    fi
done
version=$(sed -n "s/^[[:space:]]*version: '\\([^']*\\)'.*/\\1/p" "$stage/assets/js/version.js" | head -n 1)
if [ -z "$version" ]; then echo "Staged version could not be read." >&2; exit 1; fi
if ! grep -Fq "src=\"assets/js/version.js?v=$version\"" "$stage/index.html"; then
    echo "The version.js cache key does not match the staged version." >&2
    exit 1
fi
for file in "${styles[@]}"; do
    if ! grep -Fq "href=\"$file?v=$version\"" "$stage/index.html"; then
        echo "The $file cache key does not match the staged version." >&2
        exit 1
    fi
done
for file in "${icons[@]}"; do
    if ! grep -Fq "href=\"$file?v=$version\"" "$stage/index.html"; then
        echo "The $file cache key does not match the staged version." >&2
        exit 1
    fi
done
for file in "${images[@]}"; do
    if ! grep -Fq "src=\"$file?v=$version\"" "$stage/index.html"; then
        echo "The $file cache key does not match the staged version." >&2
        exit 1
    fi
done
if ! grep -Fq "src=\"assets/images/planbraid-logo.png?v=$version\"" "$stage/landing.html" || ! grep -Fq "href=\"assets/images/apple-touch-icon.png?v=$version\"" "$stage/landing.html"; then
    echo "The landing page asset cache keys do not match the staged version." >&2
    exit 1
fi
for file in "${landing_images[@]}"; do
    if ! grep -Fq "src=\"$file?v=$version\"" "$stage/landing.html"; then
        echo "The $file landing page cache key does not match the staged version." >&2
        exit 1
    fi
done
if ! grep -Fq "href=\"assets/css/design-classic.css?v=$version\"" "$stage/index.html"; then
    echo "The default design stylesheet cache key does not match the staged version." >&2
    exit 1
fi
for file in "${scripts[@]}"; do
    if ! grep -Fq "src=\"$file?v=$version\"" "$stage/index.html"; then
        echo "The $file cache key does not match the staged version." >&2
        exit 1
    fi
done
if ! (cd "$live" && sha256sum --status -c "$expected"); then
    echo "Live files changed since preparation; upgrade stopped." >&2
    exit 1
fi
if [ -e "$live/version.js" ] && ! grep -Eq '^[0-9a-f]{64} [ *]+version\.js$' "$expected"; then
    echo "The existing version.js is not covered by the live hash list." >&2
    exit 1
fi
new_files=()
for file in service-worker.js assets/js/version.js "${pages[@]}" "${tracker_files[@]}" "${extension_files[@]}" "${styles[@]}" "${icons[@]}" "${images[@]}" "${landing_images[@]}" "${design_styles[@]}" "${style_sources[@]}" "${scripts[@]}"; do
    if [ -e "$live/$file" ]; then
        if ! grep -Eq "^[0-9a-f]{64} [ *]+${file//./\\.}$" "$expected"; then
            echo "The existing $file is not covered by the live hash list." >&2
            exit 1
        fi
    else
        new_files+=("$file")
    fi
done
obsolete_absent=()
for file in testing.js testing2.js pm-testing.js; do
    if [ -e "$live/$file" ]; then
        if ! grep -Eq "^[0-9a-f]{64} [ *]+${file//./\\.}$" "$expected"; then
            echo "The existing $file is not covered by the live hash list." >&2
            exit 1
        fi
    else
        obsolete_absent+=("$file")
    fi
done
backup=$(mktemp -d "$backups/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
echo "Backing up to $backup"
tar -C /var/www/html -czf "$backup/app.tar.gz" smartlist
gzip -t "$backup/app.tar.gz"
tar -C "$(dirname "$supply")" -czf "$backup/supply-app.tar.gz" "$(basename "$supply")"
gzip -t "$backup/supply-app.tar.gz"
php "$stage/dump-database.php" "$backup"
python3 "$stage/backup-supply.py" "$supply_database" "$backup/supply.sqlite"
(cd "$backup" && sha256sum app.tar.gz database.sql supply-app.tar.gz supply.sqlite > SHA256SUMS && sha256sum -c SHA256SUMS)
mkdir "$backup/restore"
tar -C "$backup/restore" -xzf "$backup/app.tar.gz"
tar -C "$backup/restore" -xzf "$backup/supply-app.tar.gz"
if ! (cd "$backup/restore/smartlist" && sha256sum --status -c "$expected") ||
   ! (cd "$backup/restore/$(basename "$supply")" && sha256sum --status -c "$supply_expected"); then
    echo "Backup files do not match the prepared installations; upgrade stopped. Backup retained at $backup." >&2
    exit 1
fi
mkdir -p "$backups/tools"
install -m 0700 "$stage/upgrade.sh" "$backups/tools/upgrade.sh"
install -m 0600 "$stage/dump-database.php" "$backups/tools/dump-database.php"
install -m 0600 "$stage/backup-supply.py" "$backups/tools/backup-supply.py"
if ! (cd "$live" && sha256sum --status -c "$expected"); then
    echo "Live files changed during backup; upgrade stopped. Backup retained at $backup." >&2
    exit 1
fi
if ! (cd "$supply" && sha256sum --status -c "$supply_expected"); then
    echo "Supply files changed during backup; upgrade stopped. Backup retained at $backup." >&2
    exit 1
fi
if [ -f "$stage/migrate-accounts.php" ]; then
    php "$stage/migrate-accounts.php"
fi
php "$stage/migrate-onboarding.php"
for file in "${new_files[@]}" "${obsolete_absent[@]}"; do
    if [ -e "$live/$file" ]; then
        echo "$file appeared during backup; upgrade stopped. Backup retained at $backup." >&2
        exit 1
    fi
done
deploy_files=(README.md VERSIONS.md assets/js/version.js service-worker.js "${pages[@]}" "${tracker_files[@]}" "${extension_files[@]}" "${styles[@]}" "${icons[@]}" "${images[@]}" "${landing_images[@]}" "${design_styles[@]}" "${style_sources[@]}" "${scripts[@]}" api.php index.html)
for file in "${deploy_files[@]}"; do
    install -d -m 0755 "$live/$(dirname "$file")"
    install -m 0644 "$stage/$file" "$live/$(dirname "$file")/.$(basename "$file").upgrade"
done
for file in index.php app.php api.php; do
    install -m 0644 "$stage/retired-supply.php" "$supply/.$file.upgrade"
done
rollback_upgrade() {
    local status=$? file restore_failed=0
    trap - EXIT
    if [ "$status" -ne 0 ]; then
        echo "Upgrade failed; restoring application files from $backup." >&2
        for file in "${deploy_files[@]}" testing.js testing2.js pm-testing.js; do
            if [ -f "$backup/restore/smartlist/$file" ]; then
                if ! install -m 0644 "$backup/restore/smartlist/$file" "$live/$(dirname "$file")/.$(basename "$file").rollback" ||
                   ! mv -f "$live/$(dirname "$file")/.$(basename "$file").rollback" "$live/$file"; then
                    restore_failed=1
                fi
            elif [ -e "$live/$file" ]; then
                if ! rm -f "$live/$file"; then restore_failed=1; fi
            fi
        done
        if ! (cd "$live" && sha256sum --status -c "$expected"); then restore_failed=1; fi
        if [ "$restore_failed" -eq 0 ]; then
            for file in index.php app.php api.php; do
                if ! install -m 0644 "$backup/restore/$(basename "$supply")/$file" "$supply/.$file.rollback" ||
                   ! mv -f "$supply/.$file.rollback" "$supply/$file"; then
                    restore_failed=1
                    break
                fi
            done
        fi
        if [ "$restore_failed" -ne 0 ]; then
            echo "Automatic rollback failed. Keep Supply disabled and restore from $backup before reopening it." >&2
        else
            echo "Application files restored. The additive database migration, if run, remains in place." >&2
        fi
    fi
    exit "$status"
}
trap rollback_upgrade EXIT
echo "Retiring the standalone Supply endpoints."
for file in api.php app.php index.php; do
    mv -f "$supply/.$file.upgrade" "$supply/$file"
done
for file in "${deploy_files[@]}"; do
    mv -f "$live/$(dirname "$file")/.$(basename "$file").upgrade" "$live/$file"
done
rm -f "$live/testing.js" "$live/testing2.js" "$live/pm-testing.js"
printf '%s\tversion=%s\tbackup=%s\tindex_sha256=%s\n' "$(date -u +%FT%TZ)" "$version" "$backup" "$(sha256sum "$live/index.html" | cut -d ' ' -f 1)" >> "$backups/upgrades.log"
trap - EXIT
echo "Upgrade to v$version completed. Backup: $backup"
