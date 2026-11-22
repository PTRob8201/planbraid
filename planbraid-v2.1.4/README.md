# PlanBraid database storage

PlanBraid was previously called Smart List. Existing URLs, database
configuration, and saved workspaces remain unchanged.

The standalone introduction is available at `landing.html` next to the app
(for example, `/smartlist/landing.html`). Its Open PlanBraid buttons lead to
the existing sign-in page; the app remains at its original URL.
The landing page screenshots show a fictional sample workspace and are stored
under `assets/images/`.

On iPhone or iPad, open PlanBraid in Safari and use Share → Add to Home Screen
to create a shortcut with the PlanBraid icon. If an existing shortcut still
shows an old icon after an upgrade, remove it and add it again. The icon has
a transparent background; iOS may display its transparent areas as dark.

This deployment stores each account's workspace in MariaDB/MySQL as a JSON
document. Access requires HTTPS. Each account has its own separate outline
workspace; invitations and sharing individual outline projects are not available.
Account separation is not encryption: the site or database administrator can
access stored workspaces and can reset users' passwords.

**PlanBraid PM** in the sidebar opens a separate shared tracker for projects,
milestones, and tasks. Accounts granted PM access can view and edit the
same tracker after signing in; owners are PlanBraid usernames. It starts empty
and has separate New Project and New Milestone actions. The tracker’s
right-hand menu opens the JSON Schema inspector. Release history is in the
main More options menu's Help group. The tracker does not import or alter the separate
`/pm/` installation. Concurrent edits
are checked for conflicts: if another user saves first, the latest tracker is
loaded and the rejected change must be entered again. The tracker is distinct
from the optional Project management module in individual outline workspaces.
Its data is included in server database backups, but not in an individual
workspace export. PHP 8.1+ and the mbstring extension are required.

An administrator chooses extension access per account in **Manage accounts**.
Core is always available to enabled accounts; PM and Supply are disabled by
default, including for existing accounts. Supply access also requires a role:
technicians can submit and view their own orders, office staff can manage the
catalog and all orders, and Supply administrators can also manage settings.
The Supply role selector appears when PM or Supply is selected; its role applies
only to Supply. Hiding it does not change the stored role. These roles are
independent of PlanBraid account administration.

In Supply's new order table, populated rows that do not match both a catalog
part number and description are amber. Type either field to find and select a
catalog item. Submitting an order creates in-app notices for non-catalog items;
office and Supply admin users see and dismiss their own notices. Refresh Supply
or keep it open for its periodic refresh to receive notices. Notices do not
automatically add items to the catalog.

Supply uses the existing `/var/lib/fieldops-supply/fieldops.sqlite` database
and requires PHP's PDO SQLite extension and write access to that database and
its directory. New PlanBraid Supply identities are separate from legacy Supply
accounts: existing orders keep their original owners and are visible to office
staff and Supply administrators, not automatically to technicians. The old
standalone Supply login and API must be retired during integration so they
cannot bypass these permissions. Preserve the legacy accounts and data.
Server backups must include both application trees and both databases.

After signing in while connected, you can continue editing the main workspace
in the open tab if the server becomes unavailable. Pending workspace changes
are saved in this browser's IndexedDB and retried after reconnecting. The app
also caches its core files when supported. Reopening the workspace still
requires an online sign-in; the shared PlanBraid PM tracker and Supply are not
available offline. The browser may clear or evict local storage, and unfinished editor
drafts are not queued until saved. Keep backups and check the save status.
Local copies are not encrypted and are accessible to someone with device access.
Signing out requires a server connection. When signing out with unsynced
changes, choose whether to keep or discard them.
After signing in, use **More options → Recover offline changes** to restore,
export, or explicitly delete retained copies. Restore is allowed only if the
server revision matches; otherwise export the copy for review. A restored copy
remains until explicitly deleted. A replaced or expired session must reconnect
and reauthenticate before syncing.

The original account is the administrator. From the top-right More options menu, choose
**Manage accounts** to create users, reset their passwords, or disable and
re-enable their accounts. Disabling an account retains its workspace. Share
temporary passwords securely. New accounts and accounts whose password an
administrator resets must change the temporary password before opening their
workspace. The new password must differ from the temporary password. Users can
also choose **More options → Settings → Change password** at any time. Passwords
must be 12–72 UTF-8 bytes. Existing accounts are not forced to change their
password by this upgrade.
New accounts start with a Personal project. The first time an existing account
opens its workspace after this upgrade, a blank Personal project is added to its
first space if no project named Personal already exists. This happens only once:
users may subsequently rename or delete it. If a workspace is near its size
limit, the app reports that the project could not be added and retries on a
later sign-in after space has been freed. Changes from older open tabs may
conflict with this one-time addition; export unsaved work before reconnecting.
Disabling an account or resetting its password invalidates its active sessions;
changing your own password invalidates your other sessions. Ask users to save
their work first, as unsaved changes in those sessions cannot be saved.

An optional email address can be added when creating an account or changed by
its owner under **More options → Settings → Account email**. The administrator can see
account email addresses in **Manage accounts**. Addresses are not verified,
and PlanBraid does not send emails or offer email-based password recovery;
users who forget a password must contact the administrator.

The welcome guide appears once per account, including existing accounts after
the upgrade. It explains the basics and how to enable optional features through
**More options → Settings → Modules**. Its completion is stored with the
account, not in workspace backups. New workspaces start with all optional modules
turned off; existing workspaces and imported backups keep their other settings.
Dashboard and Continuum are core features, including for workspaces where
they were previously disabled.
For detailed instructions and common questions, choose **Guide and FAQ** in
the top-right More options menu. Search by keyword or open
individual topics and answers.

The signed-in account name and **Sign out** are in the top-right More options menu.
On touch screens, swipe right from the left edge to open the sidebar or swipe
left on the sidebar to close it. Browser navigation gestures can take priority
at the very edge; the sidebar button remains available.
Use the edit icon beside the project title to rename it, or use its sidebar menu.
Use **Settings → Sidebar** to show or hide Starred and Priority independently.
The Priority shortcut requires the Priority module. Hiding either shortcut
does not change notes or Dashboard sections.
Use **Search** in the sidebar or press Command+K / Ctrl+K to open the search
field. Account, export, and backup actions are menu items at the top of
Settings. Click the dot beside a note with sub-notes to collapse or expand it.
Only one PlanBraid window or device can be active per account. Connecting in
another instance takes over and disconnects the previous one; that instance
shows a notice and can export unsaved work before reconnecting.
Use **Settings → Appearance** to choose Classic, Studio, Modern, Minimal,
Vibrant or Fusion design and Light,
Dark or Sepia theme. The design is saved with the workspace, included in
backups, and defaults to Classic for older workspaces. All three
themes share consistent control sizing, focus indicators, and panel styling
while keeping the warm PlanBraid look. The choice
is saved with the account workspace and included in workspace backups; older
workspaces default to Light. Other devices apply it after loading the saved
workspace. The sign-in screen stays light.
Settings has separate Dashboard and Continuum sections for their options.
The Modules section groups optional module settings, including tag management.

In **Project templates**, edit a template name inline or use its edit icon.
In the template editor, use the field manager's icons to add, configure,
reorder, and remove custom fields; save the template to apply the changes.
Each field can use auto width based on its content or a fixed width from 48
to 1200 pixels. Template changes apply to newly created projects; existing
projects and their fields are not changed.
In **Settings → Modules**, turn off **Project templates** to hide custom
template management and creation actions. The PM template remains
available when the PM module is enabled. Existing projects, custom fields,
PM features and saved templates are retained.

The optional **Project management** module is off by default. Enable it in
**Settings → Modules**, then choose **Create from template** from a space's
menu and select **Project management**. This creates an empty regular project
with PM enabled and no sample outline or tasks. When separate project tasks are
enabled, the progress panel shows the number and percentage of tasks completed,
including hidden and collapsed tasks. Site details and project custom-field
values appear in a separate site information section. Use **Edit site** there
to edit site details including
Start date, Scope Summary and Meeting day. The former Mobilization date is
shown as Start date. Existing rough-in, cutover and handover dates remain in
saved data and backups, but are no longer displayed or editable. Custom fields
remain editable below the project subtitle, not in the site editor. When
separate project tasks are disabled, each note's left-hand menu shows
**Task status**, due date, **Assignee**, and **Field notes** at the top. Task
status marks it as To do, In progress,
Blocked, Done, or not a task. Enable **Board view** under Project management in
Settings → Modules to show the task outline / board icons.
Use **Show project progress panel** in those settings to show or hide the
progress panel. Progress is unavailable while separate tasks are off; in that
mode this setting controls the Outline / Board switch, and hiding it shows the
outline instead of the board. Use **Show site information** to independently
show or hide the whole site section, including Edit site.
Board moves the same saved tasks among To do, In progress, Blocked and
Done without hiding the project outline. Cards show the description, priority,
assignee, due date and field-note count. Drag a card by its handle to another
column or to a position within a column. For keyboard access, focus the handle
and use left/right arrows to change status or up/down arrows to reorder.
Board order is saved separately for
outline and separate tasks; it does not change task hierarchy or outline order.
The usual completion rule still applies when moving to Done.
The default is the task outline; disabling Board keeps all tasks and statuses.
Existing workspaces retain Board view enabled, while new workspaces can opt in.
Completing a task uses the normal outline rule: all its
sub-notes must be complete first. Automatic progress nodes cannot be tasks.
Click a note's field-note count to show or hide its field notes beneath it.
Notes start hidden after a refresh; use the note menu to add or delete them.
Choose **Add a note at this level** to add a sibling note or **Add a sub-note**
to add a child.
Only notes explicitly set as progress nodes show sub-note progress; the first
top-level note no longer shows it automatically. Use the note menu's **Make
progress node** and **Remove progress node** actions to control it.
Disabling PM hides these controls but retains the project and its PM data.
On an existing project, **Add PM status** in the project menu enables PM
progress and note actions without changing notes or fields. **Remove PM
status** hides those features for the project while retaining site details
and task data; add PM status again to restore them.
Enable **Separate project tasks** under **Settings → Modules → Project management**
to add an independent Tasks section below PM project outlines. Existing outline
tasks are copied once per project, including their status, assignee, due date,
plain-text description and field notes. The original notes stay unchanged and
later edits do not sync. While enabled, the Board and project progress use the
separate tasks; turning it off hides progress and restores the outline-based
Board while retaining both sets. New PM projects start with an empty separate task list.
While separate tasks are enabled, outline menus omit PM-specific actions; the
normal note due-date action remains available.
Separate tasks appear as an outline with checkboxes and compact details. Click
the checkbox to cycle from To do to In progress to Blocked to Done and back to
To do. Blocked replaces the former Waiting status; existing Waiting tasks
are converted to Blocked when a workspace is opened or imported. Older versions
may reject saved Blocked statuses.
Use the three-dot task menu on the left to mark a task important; a star appears
only for marked tasks. Edit titles directly, and use the task options menu to set priority,
edit details, add sub-tasks,
indent or outdent tasks, manage field notes, collapse branches, or delete a task
and its sub-tasks. Descriptions appear beneath task titles; click the field-note
count to show or hide saved field notes. Task details and new tasks are entered inline. Click the
Tasks heading to collapse or expand the section; the task view, show/hide
completed, and add controls are on the right of that heading. Click Outline to do the same
when project-outline collapse is enabled. The Tasks eye hides completed tasks
in both task outline and board without changing progress or saved data.
A parent can be completed only when all its descendants are
complete; reopening a sub-task also reopens completed ancestors. The Board
and project progress include tasks at every level.
PM Testing and automatic recurrence have been removed. Existing tasks and their
saved recurrence data remain in the workspace and backups; completing a task
does not create another occurrence.
The former separate PM sidebar view is no longer available. Its existing sites
remain in the workspace and full workspace backups, but cannot be viewed or
edited through the app in this version. Older PlanBraid versions may not
preserve PM project data or honor a project's removed PM status. The module implementation is in `pm.js`, loaded before `app.js`, with workspace and settings integration
in the shared application scripts.

Use the **Outline** arrow in a project to collapse or expand the whole outline.
Enable or disable the control in **Settings → Project outline**. Collapse
choices last for the current browser session and do not change individual notes.
The Testing module has been removed. Existing Testing sample data remains in
workspace backups but is no longer accessible in the app.

The database settings live outside the web root at
`/etc/smartlist/database.php`. The one-time account setup script is kept on the
server at `/home/robert/smartlist-stage/setup.php`; it refuses to replace an
existing account. Database errors are reported in the server's PHP error log,
not sent to the browser.

To migrate existing browser notes, first export a backup from the original
PlanBraid address. Sign in to the new site and use **Import backup** in
**Settings** in the top-right More options menu. Import replaces the current database workspace after confirmation;
the original browser data is not deleted. The account, export, and backup
buttons are at the top of **Settings**. Export backups regularly.

The database indicator is checked periodically and when clicked. If a save
fails, retry using the indicator. If another session changes the workspace,
saving is stopped to avoid overwriting it: export the unsaved workspace before
reloading. Workspaces are currently limited to 5 MB per save.
The top-right More options menu shows the save status beneath the database
indicator.
Saving and unsaved-change warnings appear in the project header. Dashboard
and Continuum also show these warnings,
while the all-changes-saved confirmation appears in More options.

Dashboard opens after signing in and is always available in the sidebar.
When Project management is enabled, it also shows an **Important tasks** section
for active starred or prioritized PM tasks from the active task source.
Outline-task priorities are included only while the Priority module is enabled;
separate-task priorities are available with Project management. Click a result
to open the task, including its collapsed ancestors.
Dashboard collects starred notes (including completed starred notes),
active priority notes ordered high to low, and active notes that are overdue
or due through seven calendar days from today, ordered by due date. Dates use
the current device's local calendar. Select a result to open its project and
note. Empty sections are hidden. If enabled sections contain no notes, the
Dashboard shows "Nothing important for now." Settings lets you disable any of
its three note sections; the task section follows the PM module. These options
are shared across devices and included in workspace backups.

## Reusable interface design template

Use the existing theme tokens in `styles.css` (`--surface`, `--surface-soft`,
`--line`, `--text`, `--muted`, `--accent`, and `--font-scale`) rather than
hard-coded theme colors. Prefer established controls such as `toolbar-button`,
`priority-menu` / `priority-option`, and `node-action-icon`.

For short inline inputs, reuse the compact panel and form classes:

```html
<div class="compact-inline-panel">
    <form class="compact-inline-form">
        <label>Field <input name="field"></label>
        <button type="submit">Save</button>
        <button type="button">Cancel</button>
    </form>
</div>
```

Provide real save and cancel handlers, accessible labels for icon-only controls,
visible focus, explicit errors, and protection for unsaved drafts. Construct user
content with text nodes rather than HTML. Check Light, Dark and Sepia themes,
keyboard use, narrow screens and long content. The panel is at most 400px wide
and shrinks to its container; use a larger existing modal only when a workflow
actually needs more space.

The Reminders module can be enabled in **Settings → Modules**. For a note with a due date, choose **Set reminder…**
in its menu and select a date and time. PlanBraid asks for browser
notification permission when a reminder is set. Notifications use the local
time zone of the active device and are delivered while PlanBraid is open;
overdue reminders are checked when the app opens or returns to the foreground.
Changing or clearing a due date clears its reminder. Reminder settings and
times are included in workspace backups.

The node menu shows priority choices in one row: dash for no priority and
one, two or three exclamation marks for low, medium or high priority.
The three-dot menu is visible beside each note. Use it to mark a note complete
or reopen it. Click the dot or use the note menu to expand or collapse
sub-notes; a ring around the dot indicates a
collapsed branch. Priority, star, due date, reminder, progress and PM badges
appear below the note text. The project's nine-dot menu contains project tools.
The **Priority** module can be enabled in **Settings → Modules**. Turning it off hides priority controls, the sidebar
view, the project priority filter, and the Dashboard priority section. It also
omits priority details from visible-outline exports. Existing note priorities
and the Dashboard section preference are retained and restored when the module
is re-enabled. The module setting is shared across devices and included in
workspace backups.
The sidebar starts open on screens wider than 760 pixels and closed on narrower
screens. Use the sidebar button to open or close it at any size; this choice
lasts until the page is reloaded. On narrow screens the sidebar opens over the
outline with readable labels; use its close button, tap outside it, or press
Escape to dismiss it. Choosing a project or navigation view closes it.
The sidebar uses compact navigation and project rows, with larger tap targets
on touch devices.
Use the magnifying glass in the top bar to search outline notes across projects
and, when enabled, Scratchpad note titles and text. Scratchpad results show their linked
project and open the matching card.
Command+K or Ctrl+K opens and focuses search without opening the sidebar.
**Continuum** (formerly Flow and Endless view) is always available in the sidebar.
It shows every project in a continuous outline; notes can be
edited in place, and the project title opens its normal project view. The
sidebar uses an outline-tree icon for Continuum. The separate **Enable node
zoom** option is off by default, including for existing
workspaces. When enabled, use **Zoom into note** in its menu to
zoom into it and the breadcrumbs to navigate back. Project breadcrumbs are
in the top header and show the space, project and zoomed note path. Zoom is available in both
Continuum and project views; project export uses the zoomed outline. Turning off
zoom exits the zoomed view. Continuum does not apply project filters;
use its **Hide completed** / **Show completed** button to filter completed notes
across projects. This filter is independent of project filters and resets when
the page reloads. While completed notes are hidden, matching branches are expanded.
When shown, completed outline rows use strikethrough text and subdued
highlights and indicators. Hover or focus the row to restore its accents.
exporting the entire workspace from this view is not supported. Module
settings are shared across devices and included in workspace backups.
The sidebar Priority view lists active prioritized notes across all spaces and
projects, ordered high to low. Completed notes are hidden from this view and
its count, but keep their priority and reappear if reopened. Select a result to
open it in its project. Notes without a priority are not included.
The Tags section below spaces discovers hashtags from node titles and full
note text across all projects, including nested and completed nodes. Type
tags such as `#work`; letters, numbers, underscores and hyphens are supported,
and matching is case-insensitive. Select a tag to see matching nodes across
spaces and open a result in its project. Settings lets you hide or restore
discovered tags without changing the text, and turn the Tags module on or
off. Tags appear as sidebar pills; hashtags in titles and notes use gray-red
text without a background highlight in browsers supporting the CSS Custom
Highlight API. Other browsers still support tag discovery and navigation.
The module setting and hidden-tag list are saved with the workspace and
included in backups; older workspaces default to enabled. Older app versions
may not preserve these settings when saving or importing a workspace.
Use a project's sidebar menu to rename or delete it. New projects open a
rename dialog automatically. Deletion requires confirmation and
deleting a project also deletes its notes. If it is the last project, a new
empty project is created.

Use the add-note and hide-completed buttons on the Outline line to add a note
or hide completed notes. Use **Expand all** and **Collapse all** in the nine-dot menu beside the project
outline heading to expand or collapse all branches.
The change is saved with the workspace, including for branches hidden by the
starred filter. When zoomed, the buttons affect only the zoomed note's
descendants; the zoomed note stays open. Priority and hide-completed filters
automatically expand matching branches, so clear those filters to use the
buttons.

Choose **Project templates** in the top-right More options menu to create, edit, or delete
templates. Each template can define text, number, date, checkbox, and dropdown
fields, plus a starter outline: enter one note per line and indent nested notes
with two spaces per level. In a space's menu, choose **Create from template**,
select a template, and name the project. Its fields appear below the project
subtitle and can be edited independently. Editing or deleting a template does
not change projects already created from it. Templates and project fields are
shared with the workspace, included in backups, and project field values appear
in visible-outline exports. Older versions of PlanBraid may not preserve them.

On phones, tap the visible three-dot menu beside a note to open its actions,
including marking it complete. The menu remains beside its note while editing;
there is no floating note toolbar over the keyboard.
Edit an outline item's text directly. Click its separate note preview to view
the full note read-only, then use the pencil in the viewer to edit that note.
This works in projects and Continuum.
Choose **Move under…** in a note's menu to move it and all its sub-notes under
another note in the same project. The destination picker excludes the note and
its descendants to prevent circular moves.
Choose **Move with arrows** to show up/down arrows beside that note; use the
check button to finish. Each move follows the visible outline, may change the
note's parent, and carries its sub-notes. Moving down past an expanded parent
places the note before its first child. Clear outline filters before using the
arrows; moves stay within the current project and zoomed outline.

Use the text-size actions in the project menu, or **Font size** in
**Settings**, to change text size across the app, up to 145%.
The interface uses medium font weight by default; headings and emphasized
text retain their stronger weights.
The setting is saved in this browser on this device, not in the database or
workspace backups. The default retains the original size, and individual note
heading sizes remain available. PDF exports keep their own print formatting.
Use **Export visible outline** in the project menu, or the same action in
**Settings**, to preview the visible project outline and full notes. The
formatted preview shows the same outline used for PDF, including rich notes and
tables. Switch to plain text or Markdown to preview and copy those formats;
the formatted preview's **Copy text** action copies plain text. Save either
format, or choose **Save as PDF** and use the browser's print dialog. Markdown
exports notes with tables, lists, checklists and common formatting; tables
without headers use a blank Markdown header row. Some rich formatting, such as
highlighting and underlining, is not represented in Markdown. If automatic
copying is unavailable, the preview is selected for manual copying. All exports
respect filters and collapsed branches. PDF preserves rich formatting. The
preview is a snapshot taken when the window opens. Outline export is
unavailable in global views. **Settings** also provides backup export and import.

Parent progress appears below the parent note text, before its description and
sub-notes. Counts include descendants hidden by filters or collapsed branches.
Complete all descendants before marking a parent complete. Reopening or moving
an active sub-note under a completed parent reopens that parent. Existing and
imported completed parents with active descendants are reopened and saved.

Each outline item has a simple note editor. It edits the first line inline and
preserves subsequent lines. The one-line preview opens the full note read-only;
its pencil opens the full plain-text editor. Older formatting is retained in
the preview unless you confirm an edit that converts the note to plain text.
Full notes and their formatting are included
in backups and PDF printing; search matches note text. Older versions of
PlanBraid may discard rich formatting when importing a backup.

The rich editor groups formatting, headings, lists and table tools into
icon menus. The selected group's controls remain visible while editing.
Choose an icon to switch groups; hover over an
icon to see its name. Scroll the toolbar horizontally on very small screens.
Insert checklist adds checkboxes; press Enter in an item to add the next one,
and press Enter in an empty final item to finish the checklist.
Select text before inserting a checklist to convert it into checklist items.
Selections within existing lists or tables cannot be converted.
Undo and Redo work while the rich editor is open, including checklist and table edits.
Checklist check states are saved with the note. Use Insert table to insert a three-column table with a header
and two rows. Select a cell to add or remove a row or column; removals require
confirmation. Tables retain at least one row and column and can be expanded
to 20 rows and 10 columns; use Delete table to remove a whole table. Table
content is included in backups and PDF
printing. Older versions do not support tables.
Older versions do not preserve checklist checkboxes or their checked states.
Versions older than 0.2.5 do not preserve rich-note headings or highlighting.

## Upgrades and backups

Scratchpad is a separate module, off by default. Enable it in
**Settings → Modules**, then open **Scratchpad** in the sidebar. Cards appear on an
Agenda-style timeline with the project badge and creation date at the top,
with the date on the right,
even when collapsed. The three-dot information menu shows Modified and any
Previous date. Cards remain sorted by their most recent activity.
Notes start collapsed
when you open the page. Use the chevron on the top info line to show or hide
the body. Opening a note from global search expands the matching card.
Created and Modified are recorded automatically when you save a new note.
Edits, including checklist changes, update Modified. The date filter shows
notes created or modified today in your local time. Older notes keep any
previously assigned date, labeled **Previous date**; unknown timestamps
aren't inferred from that date.
The trash icon on that line asks for confirmation before deleting a note.
The **Share note** icon on each saved card previews a text snapshot of its
title and body. If the note has a spreadsheet, check **Include spreadsheet**
to add its calculated values. Copy the text or use **Send snapshot** if your
browser supports device sharing. No link is created.
Click a title or note body to
edit it in place, or choose the orange **New note** icon to open a blank card. The first line
is the title; press Enter to move into the rich-text body. Edit Project at
the top of the card. The text fields grow
as you type. The single-row icon toolbar above the text provides formatting, bullets, checklists, and
**Save note**, **Discard changes**, and **Delete note** for existing notes. When enabled,
the attached note-card count beside each project title opens Scratchpad filtered to that project.
Linked Scratchpad notes also appear below the project outline. Add, edit, share,
or delete those same cards there; new cards start linked to the open project.
Changes save automatically when you leave the editor within PlanBraid.
Use **Discard changes** if you don't want to keep them. Refreshing or closing
the tab uses the browser's own unsaved-changes warning.
In the note body, type `#`, `##`, `###`, `-`, `*`, or `1.` followed by
a space to start a heading, bulleted list, or numbered list. Type `**text**`
to make that text bold. Enter continues a bulleted list, numbered list, or
checklist; Enter on the empty last item exits the list. In bulleted and
numbered lists, Tab / Shift+Tab nests or unnests items where possible.
Choose **Download PDF** from **Share note** for a paginated snapshot with text,
pictures, and captions. Check **Include spreadsheet** to add its calculated
values. After generating the PDF, **Share PDF** opens the system share sheet
on supported devices. The PDF is generated locally and does not create a link.

**Save note** stays beside the project selector. The scrolling icon toolbar
groups tools into **Formatting**, **Insert**, and **Note actions**. Choose
**Text formatting tools** to show or hide text controls. Choose the highlight
icon to show five colors and **No color**; select text before clearing its
highlight. Select text to link it, or put the cursor inside a link and choose
**Insert or edit link** to update or remove it. On narrow screens, use the
arrows or swipe to reach each group.
Files are limited to 256 KB each. **Add image** previews PNG, JPEG, GIF, and
WebP images; oversized images are resized or compressed locally to fit,
and converted animated images become still images. While editing a note, add a
description below a picture or use the trash icon to remove an attachment.
New pictures insert at the text cursor. Picture filenames are hidden in
saved notes and remain downloadable while editing.
New attachments show the date they were added; older attachments without a
recorded date remain undated. Select a filename to download it. Attachments are stored with
the note and included in workspace backups, not in text snapshots. The 5 MB
workspace limit still applies.
Spreadsheets are enabled by default. To hide spreadsheet grids and controls
without deleting any saved grid, turn off **Enable spreadsheets in Scratchpad**
under **Settings → Modules → Scratchpad**. Turn it back on to restore access.
When enabled, choose **Add spreadsheet** while editing to insert one grid at
the cursor. Existing grids keep their position. Enter text,
numbers, or formulas such as `=A1*2` and `=SUM(A1:A3)`. Formulas support
arithmetic, parentheses, cell references, `SUM`, `AVERAGE`, `MIN`, and `MAX`.
The grid can grow to 20 rows by 10 columns and is saved with the note.
Select a cell and use the spreadsheet toolbar icons to remove its row or
column. After confirmation, references to shifted cells adjust; references
to deleted cells show `#REF!`. Save the note to keep the changes.
Turning the Scratchpad module off retains its notes and does not change
the outline. Deleting a
project removes its links from Scratchpad notes without deleting those notes.
Scratchpad notes are included in workspace backups. Existing Agenda.html notes
are not imported automatically.

Before each server upgrade, save pending edits and export a workspace backup.
Run `upgrade.sh STAGING_DIRECTORY EXPECTED_LIVE_HASHES EXPECTED_SUPPLY_HASHES` from a private staging
directory containing the full release files, including `dump-database.php`,
`backup-supply.py`, `retired-supply.php`, `migrate-onboarding.php`,
`service-worker.js`, the HTML and PHP files, and
the complete `assets/js/`, `assets/css/` and `assets/images/` directories.
The onboarding migration is required and runs after the verified
database backup, before the updated application is installed. It can be
rerun safely; if migration fails, retain the backup and resolve the error
before retrying. Fresh installs use the updated `setup.php`.
Copies of the backup
scripts are kept in the backup directory's `tools/` folder. Update the first
version in `assets/js/version.js`, `service-worker.js`, and all matching asset
cache keys in the HTML and scripts for every release. Generate the hash file from the live files
before editing (including all existing JavaScript and CSS assets), using `sha256sum` with filenames
relative to `/var/www/html/smartlist`. Generate the Supply hash file relative
to `/var/www/html/supply`, including at least `index.php`, `app.php`, `api.php`,
and `bootstrap.php`. The script stops on hash mismatch, backup failure or
missing staged files. It archives both application directories, exports the
PlanBraid database, and creates a verified online SQLite snapshot before
installing files. It retires the standalone Supply endpoints before enabling
the integration, and writes the version and snapshot path to
`/home/robert/smartlist-backups/upgrades.log`. On an installation error it
attempts to restore the previous application files; if rollback fails, keep
Supply disabled and restore manually from the snapshot.

Backups contain private notes and account password hashes. They are stored
outside the web root with owner-only permissions; keep protected copies on
another device too. The database export captures committed server data, not
unsaved browser edits; other live sessions should stop editing during backup
and upgrade. The database is not deleted. This release removes the obsolete
Testing scripts from the web root after backing up the application.

To restore, stop access to PlanBraid, verify the desired snapshot with
`sha256sum -c SHA256SUMS` from its directory, and have a server administrator
restore `app.tar.gz`, `supply-app.tar.gz`, `database.sql`, and `supply.sqlite`
to the intended applications and databases.
Restoring the database replaces newer data; back up the current state first.
The release history source is `assets/js/version.js` and is shown in the app.

## Client code organization

`assets/js/app.js` owns the core outline, workspace state, saving and initialization.
The other JavaScript files contain the PM, template, tag, view, note, reminder,
export, account, help and settings features. These are classic scripts sharing
global state and functions; `index.html` must load the feature scripts before
`app.js`. Feature scripts must not access application state during script
loading: their functions use it only after the core script initializes it.
Keep the script list in `upgrade.sh` and `service-worker.js` in sync with `index.html`.
Legacy root-level assets are retained for existing open tabs during upgrades.

The app loads the compiled `tailwind.css` and one `design-NAME.css` at a time.
The common source `tailwind-input.css` imports existing component styles as a
compatibility layer; each `design-NAME.input.css` contains its design rules.
Rebuild with Tailwind CSS v4.3.5 from `assets/css/`: `tailwindcss -i tailwind-input.css -o tailwind.css`,
and `tailwindcss -i design-NAME.input.css -o design-NAME.css` for each changed
design. Ship the compiled files; the server does not need Tailwind installed.
Supply uses Tailwind CSS v3.4.17: from the release root run
`tailwindcss -i assets/css/supply-input.css -o assets/css/supply.css --content supply-app.html --minify`.

Shared outline icons and alternate symbols are defined in `index.html`; dynamic
controls use `createIcon()` in `bootstrap.js`. Keep icon-only controls labeled
and decorative icons hidden from assistive technology. Preserve filled stars
for starred items and the existing larger touch targets.

## License

Copyright (C) 2026 Robert Wasniowski

PlanBraid is free software: you can redistribute it and/or modify it under the
terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version. It is distributed WITHOUT ANY WARRANTY; see the full text in
[LICENSE](./LICENSE) (SPDX: `AGPL-3.0-or-later`).

If you run a modified version of PlanBraid as a network service, the AGPL
requires you to offer its complete source code to that service's users.

The compiled Tailwind CSS files are third-party code under the MIT License,
as noted in their headers.

The PlanBraid name and logo are not licensed under the AGPL. Distributed
modified versions must use a different name and icon.

Donations, including in-app purchases, are voluntary and do not grant a
license or any additional rights.

`LICENSE` is included and verified during upgrades. Keep this section in every
staged `README.md`. Do not change the GNU license document itself.

## Corresponding source and release publication

The **More options → Help → Source code** link and the License dialog point to
[the v2.1.4 source](https://github.com/PTRob8201/planbraid/tree/v2.1.4).
Before deploying this release, publish this complete directory to that public
repository and create the `v2.1.4` tag. The repository currently needs the
application files; a README and license alone are not corresponding source.
For future releases, publish and tag the source before deploying, and update
both source links to the matching tag. Include all HTML, JavaScript, PHP,
stylesheet inputs and outputs, images, tests, and install/upgrade scripts.
Users can download a source ZIP from GitHub's tagged source page.

Publish application source only. Never include `/etc/smartlist/database.php`,
environment files, passwords, API tokens, database dumps, SQLite databases,
user uploads, workspace exports, backups, or browser storage. Landing images
use a fictional sample workspace. Keep existing third-party notices; compiled
Tailwind files include their MIT attribution and are not wholly AGPL code.
The app-owned source files carry copyright and AGPL notices. No public email
or postal contact address has been supplied; both are intentionally omitted.

### Building and installing from source

The checked-in assets are ready to run; there is no JavaScript bundler or
package installation step. To rebuild CSS, use the exact Tailwind compiler
versions and commands in **Client code organization** above. Verify standalone
compiler downloads against their release checksums before running them.

Use a PHP 8.1+ web server with HTTPS and the PDO MySQL, PDO SQLite and mbstring
extensions, plus MariaDB/MySQL. Create an empty database and a database user
permitted to create and update its tables. Store its connection configuration
outside the web root at `/etc/smartlist/database.php`:

```php
<?php
return [
    'host' => 'localhost',
    'database' => 'planbraid',
    'username' => 'planbraid',
    'password' => 'REPLACE_ON_THE_SERVER',
];
```

Replace the placeholder locally, never commit this file, and restrict it to
the server administrator and PHP process. Copy the release to the web root
(the default deployment path is `/var/www/html/smartlist`) and run
`php setup.php` in a terminal to initialize the tables and create the first
administrator. PM and Supply initially remain disabled. Do not run setup
against a database with existing accounts.

Supply normally uses its existing database. For a new installation with no
legacy Supply data, create an empty SQLite database at
`/var/lib/fieldops-supply/fieldops.sqlite` with the following base schema:

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE users (
    id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE shared (name TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE orders (
    id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL, data TEXT NOT NULL
);
INSERT INTO shared VALUES ('settings', 1,
    '{"categories":["General"],"units":["ea"],"defaultUnit":"ea"}');
INSERT INTO shared VALUES ('catalog', 1, '[]');
```

Give the PHP process write access to the SQLite file and its parent directory;
keep them outside the web root. The integration creates its identity mapping
and notification tables on first use. Do not apply this initialization to an
existing Supply database. Enable Supply and choose a role in Manage accounts.
When upgrading a legacy standalone Supply installation, follow the
backup-first upgrade procedure above to retire its old login/API.

### Testing

The Python integration tests use isolated synthetic databases. On a machine
with PHP and MariaDB server/client tools, run
`python3 -m unittest -v tests.test_shared_tracker tests.test_upgrade_layout`.
The browser fixtures in `tests/` use synthetic data; serve the source with a
local HTTP server and open the fixture pages. They must not use real accounts.
