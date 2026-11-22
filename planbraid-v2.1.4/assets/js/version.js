/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
const SMARTLIST_RELEASES = [
    {
        version: '2.1.4',
        date: 'November 21, 2026',
        changes: ['Added release-specific source links and source license notices']
    },
    {
        version: '2.1.3',
        date: 'November 21, 2026',
        changes: ['Moved Release history from the sidebar to the top menu']
    },
    {
        version: '2.1.2',
        date: 'November 21, 2026',
        changes: ['Added License to the Help menu']
    },
    {
        version: '2.1.1',
        date: 'November 21, 2026',
        changes: ['Added Supply catalog suggestions and notifications for items outside the catalog']
    },
    {
        version: '2.1.0',
        date: 'November 21, 2026',
        changes: ['Made Manage accounts more compact and show Supply roles only when an extension is selected']
    },
    {
        version: '2.0.9',
        date: 'November 21, 2026',
        changes: ['Added a default Personal project for accounts that do not already have one']
    },
    {
        version: '2.0.8',
        date: 'November 21, 2026',
        changes: ['Added touch swipes to open and close the sidebar']
    },
    {
        version: '2.0.7',
        date: 'November 21, 2026',
        changes: ['Added account-level access to PlanBraid PM and PlanBraid Supply']
    },
    {
        version: '2.0.6',
        date: 'November 21, 2026',
        changes: ['Separated PlanBraid PM project and milestone actions, moved JSON Schema to its menu, and moved release history to the sidebar']
    },
    {
        version: '2.0.5',
        date: 'November 21, 2026',
        changes: ['Made the PlanBraid PM summary cards more compact']
    },
    {
        version: '2.0.4',
        date: 'November 21, 2026',
        changes: ['Moved New space above the spaces list']
    },
    {
        version: '2.0.3',
        date: 'November 21, 2026',
        changes: ['Hid the spaces list scrollbar while keeping scrolling available']
    },
    {
        version: '2.0.2',
        date: 'November 21, 2026',
        changes: ['Organized app assets and added offline editing with protected recovery']
    },
    {
        version: '2.0.1',
        date: 'November 20, 2026',
        changes: ['Added a shared PlanBraid PM tracker using PlanBraid accounts']
    },
    {
        version: '2.0.0',
        date: 'November 20, 2026',
        changes: ['Clarified invitation-only access on the landing page']
    },
    {
        version: '1.9.9',
        date: 'November 20, 2026',
        changes: ['Expanded the landing page with sample screenshots of PlanBraid']
    },
    {
        version: '1.9.8',
        date: 'November 20, 2026',
        changes: ['Made Dashboard and Continuum core features and enlarged the PlanBraid logo']
    },
    {
        version: '1.9.7',
        date: 'November 20, 2026',
        changes: ['Added project title editing from the project page']
    },
    {
        version: '1.9.6',
        date: 'November 20, 2026',
        changes: ['Added a separate PlanBraid landing page']
    },
    {
        version: '1.9.5',
        date: 'November 20, 2026',
        changes: ['Updated the PlanBraid logo and Apple Home Screen icon']
    },
    {
        version: '1.9.4',
        date: 'November 20, 2026',
        changes: ['Added a PlanBraid icon for Apple Home Screen bookmarks']
    },
    {
        version: '1.9.3',
        date: 'November 20, 2026',
        changes: ['Renamed Smart List to PlanBraid and introduced a new logo']
    },
    {
        version: '1.9.2',
        date: 'November 20, 2026',
        changes: ['Fixed saved PM tasks with a legacy Done status']
    },
    {
        version: '1.9.1',
        date: 'November 20, 2026',
        changes: ['Made the Scratchpad creation date prominent and moved other dates into a note information menu']
    },
    {
        version: '1.9.0',
        date: 'November 20, 2026',
        changes: ['Simplified Kanban cards, added task details and keyboard movement']
    },
    {
        version: '1.8.9',
        date: 'November 20, 2026',
        changes: ['Added Kanban drag-and-drop ordering and replaced Waiting with Blocked in task statuses']
    },
    {
        version: '1.8.8',
        date: 'November 20, 2026',
        changes: ['Separated site information from task progress and added a site section setting']
    },
    {
        version: '1.8.7',
        date: 'November 20, 2026',
        changes: ['Added a PM progress panel switch and removed PM Testing and bulk outline task deletion']
    },
    {
        version: '1.8.6',
        date: 'November 20, 2026',
        changes: ['Aligned task stars with checkboxes']
    },
    {
        version: '1.8.5',
        date: 'November 20, 2026',
        changes: ['Aligned task heading controls to the right']
    },
    {
        version: '1.8.4',
        date: 'November 20, 2026',
        changes: ['Added arrow-based movement for notes through visible outline positions']
    },
    {
        version: '1.8.3',
        date: 'November 20, 2026',
        changes: ['Made outline dots expand and collapse branches and kept note menus visible']
    },
    {
        version: '1.8.2',
        date: 'November 20, 2026',
        changes: ['Added three-state task checkboxes for To do, In progress and Done']
    },
    {
        version: '1.8.1',
        date: 'November 19, 2026',
        changes: ['Moved task and note controls to three-dot menus and refined star and collapse visibility']
    },
    {
        version: '1.8.0',
        date: 'November 19, 2026',
        changes: ['Added Modern, Minimal, Vibrant and Fusion designs with separately loaded design stylesheets']
    },
    {
        version: '1.7.9',
        date: 'November 19, 2026',
        changes: ['Standardized interface icons across Classic and Studio designs']
    },
    {
        version: '1.7.8',
        date: 'November 19, 2026',
        changes: ['Added Classic and Studio designs with a shared appearance switch']
    },
    {
        version: '1.7.7',
        date: 'November 19, 2026',
        changes: ['Enlarged menu and task controls and moved outline actions beside the heading']
    },
    {
        version: '1.7.6',
        date: 'November 19, 2026',
        changes: ['Aligned project and task controls, priority colors, and menu sizing']
    },
    {
        version: '1.7.5',
        date: 'November 19, 2026',
        changes: ['Show task descriptions and expandable field notes with outline-style menus', 'Added confirmed cleanup of old outline tasks']
    },
    {
        version: '1.7.4',
        date: 'November 19, 2026',
        changes: ['Added important tasks to Dashboard and compact reusable task controls']
    },
    {
        version: '1.7.3',
        date: 'November 19, 2026',
        changes: ['Added collapsible task sections and completed-task visibility controls']
    },
    {
        version: '1.7.2',
        date: 'November 19, 2026',
        changes: ['Added inline PM task editing and a task-only board view']
    },
    {
        version: '1.7.1',
        date: 'November 20, 2026',
        changes: ['Redesigned separate PM tasks as a nested, checkable outline']
    },
    {
        version: '1.7.0',
        date: 'November 20, 2026',
        changes: ['Added optional PM Testing tools for real tasks']
    },
    {
        version: '1.6.9',
        date: 'November 20, 2026',
        changes: ['Added optional independent project tasks for PM projects']
    },
    {
        version: '1.6.8',
        date: 'November 20, 2026',
        changes: ['Added a project outline collapse toggle', 'Removed the Testing module']
    },
    {
        version: '1.6.7',
        date: 'November 20, 2026',
        changes: ['Added Testing 2: an isolated sample project workspace']
    },
    {
        version: '1.6.6',
        date: 'November 20, 2026',
        changes: ['Show and edit linked Scratchpad cards below project outlines']
    },
    {
        version: '1.6.5',
        date: 'November 20, 2026',
        changes: ['Aligned PM task status badges with their outline notes']
    },
    {
        version: '1.6.4',
        date: 'November 20, 2026',
        changes: ['Widened sidebar views to match the project workspace on large screens']
    },
    {
        version: '1.6.3',
        date: 'November 20, 2026',
        changes: ['Added a Board view option under Project management settings']
    },
    {
        version: '1.6.2',
        date: 'November 20, 2026',
        changes: ['Widened the project workspace on large screens']
    },
    {
        version: '1.6.1',
        date: 'November 20, 2026',
        changes: ['Added an optional Board view for PM project tasks']
    },
    {
        version: '1.6.0',
        date: 'November 19, 2026',
        changes: ['Added an isolated Testing module with five interactive feature trials']
    },
    {
        version: '1.5.6',
        date: 'November 18, 2026',
        changes: ['Added a project-header eye button to show or hide completed notes']
    },
    {
        version: '1.5.5',
        date: 'November 18, 2026',
        changes: ['Moved the Dashboard priority icon onto each priority note and made it indicate the note level']
    },
    {
        version: '1.5.4',
        date: 'November 18, 2026',
        changes: ['Added a priority icon to the Dashboard Priority section']
    },
    {
        version: '1.5.3',
        date: 'November 18, 2026',
        changes: ['Hid empty Dashboard sections and added a single empty-state message']
    },
    {
        version: '1.5.2',
        date: 'November 18, 2026',
        changes: ['Changed Dashboard and Settings labels from pinned notes to starred notes']
    },
    {
        version: '1.5.1',
        date: 'November 18, 2026',
        changes: ['Matched the Scratchpad new-card button styling to the project Add a note button']
    },
    {
        version: '1.5.0',
        date: 'November 18, 2026',
        changes: ['Matched the Scratchpad new-card icon to the size and artwork of the project Add a note icon']
    },
    {
        version: '1.4.9',
        date: 'November 18, 2026',
        changes: ['Switched the positions of the project Add a note button and project menu']
    },
    {
        version: '1.4.8',
        date: 'November 18, 2026',
        changes: ['Added a top-right project button to create a note']
    },
    {
        version: '1.4.7',
        date: 'November 18, 2026',
        changes: ['Ensured All notes is actually hidden when disabled in Sidebar settings']
    },
    {
        version: '1.4.6',
        date: 'November 18, 2026',
        changes: ['Added a Settings → Sidebar option to show or hide All notes, hidden by default']
    },
    {
        version: '1.4.5',
        date: 'November 18, 2026',
        changes: ['Kept the desktop sidebar fixed while project content scrolls']
    },
    {
        version: '1.4.4',
        date: 'November 18, 2026',
        changes: ['Kept Scratchpad note backgrounds unchanged while editing and added a subtle orange focus frame']
    },
    {
        version: '1.4.3',
        date: 'November 18, 2026',
        changes: ['Renamed Scratchpad note counts to note cards and added a no-color highlight icon']
    },
    {
        version: '1.4.2',
        date: 'November 18, 2026',
        changes: ['Added expandable text formatting tools and a highlight palette with a no-color option']
    },
    {
        version: '1.4.1',
        date: 'November 18, 2026',
        changes: ['Removed the visible Scratchpad toolbar scrollbar while preserving arrow and touch scrolling']
    },
    {
        version: '1.4.0',
        date: 'November 18, 2026',
        changes: ['Restored the scrolling Scratchpad icon toolbar and grouped tools by Formatting, Insert, and Note actions']
    },
    {
        version: '1.3.8',
        date: 'November 18, 2026',
        changes: ['Added picture descriptions, attachment dates, and compact attachment controls in Scratchpad']
    },
    {
        version: '1.3.7',
        date: 'November 18, 2026',
        changes: ['Added left and right scroll arrows to the Scratchpad editing toolbar']
    },
    {
        version: '1.3.6',
        date: 'November 18, 2026',
        changes: ['Renamed Agenda Notes to Scratchpad throughout the app']
    },
    {
        version: '1.3.5',
        date: 'November 18, 2026',
        changes: ['Saved Agenda note changes automatically on editor exit', 'Added orange checklist and New note controls and a full-width scrolling icon toolbar']
    },
    {
        version: '1.3.4',
        date: 'November 18, 2026',
        changes: ['Added more Agenda editing tools, file attachments, and automatic image resizing to fit 256 KB']
    },
    {
        version: '1.3.3',
        date: 'November 18, 2026',
        changes: ['Moved Agenda Note dates to the bottom of each card']
    },
    {
        version: '1.3.2',
        date: 'November 18, 2026',
        changes: ['Added Save, Discard, and Keep editing choices for unsaved Agenda notes', 'Opened Agenda Notes with cards collapsed by default']
    },
    {
        version: '1.3.1',
        date: 'November 18, 2026',
        changes: ['Fixed Enter to continue or exit checklists in Agenda Notes']
    },
    {
        version: '1.3.0',
        date: 'November 18, 2026',
        changes: ['Added Markdown typing shortcuts, numbered lists, and keyboard list nesting in Agenda Notes']
    },
    {
        version: '1.2.9',
        date: 'November 18, 2026',
        changes: ['Added automatic Created and Modified dates to Agenda notes', 'Added a setting to hide Agenda spreadsheets without deleting saved grids']
    },
    {
        version: '1.2.8',
        date: 'November 18, 2026',
        changes: ['Made spreadsheets opt-in when sharing an Agenda note']
    },
    {
        version: '1.2.7',
        date: 'November 18, 2026',
        changes: ['Added text snapshot sharing to every Agenda note']
    },
    {
        version: '1.2.6',
        date: 'November 18, 2026',
        changes: ['Included Agenda Notes in top-bar search and opened matching cards directly']
    },
    {
        version: '1.2.5',
        date: 'November 18, 2026',
        changes: ['Moved the attached-note count beside the project title, Notes below Continuum, and Search to the top bar']
    },
    {
        version: '1.2.4',
        date: 'November 18, 2026',
        changes: ['Moved the Agenda toolbar above the note text and added icon controls for removing spreadsheet rows and columns']
    },
    {
        version: '1.2.3',
        date: 'November 18, 2026',
        changes: ['Moved Project and Date above Agenda note text and added optional spreadsheets with basic formulas']
    },
    {
        version: '1.2.2',
        date: 'November 18, 2026',
        changes: ['Moved Agenda note controls to the info line and bottom of the editor, and added confirmed deletion from the card']
    },
    {
        version: '1.2.1',
        date: 'November 18, 2026',
        changes: ['Moved the Agenda note collapse chevron to the left of the title']
    },
    {
        version: '1.2.0',
        date: 'November 18, 2026',
        changes: ['Added a chevron to collapse Agenda notes to their titles and details']
    },
    {
        version: '1.1.9',
        date: 'November 18, 2026',
        changes: ['Simplified the Agenda Notes editor to a borderless layout with a single row of toolbar icons']
    },
    {
        version: '1.1.8',
        date: 'November 18, 2026',
        changes: ['Made the first line the Agenda note title, added growing editors and project note counts, and limited rich-text editing to Agenda Notes']
    },
    {
        version: '1.1.7',
        date: 'November 18, 2026',
        changes: ['Added in-place Agenda card editing with a note toolbar and optional rich-text formatting']
    },
    {
        version: '1.1.6',
        date: 'November 18, 2026',
        changes: ['Styled account, export, and backup actions in Settings as distinct buttons']
    },
    {
        version: '1.1.5',
        date: 'November 18, 2026',
        changes: ['Made the sidebar narrower with tighter spacing and larger controls on touch devices']
    },
    {
        version: '1.1.4',
        date: 'November 18, 2026',
        changes: ['Moved the project save status to the left of the project menu']
    },
    {
        version: '1.1.3',
        date: 'November 18, 2026',
        changes: ['Made completed outline rows less prominent without hiding them']
    },
    {
        version: '1.1.2',
        date: 'November 18, 2026',
        changes: ['Restored the warm Smart List look and standardized controls, menus, panels, and keyboard focus']
    },
    {
        version: '1.1.1',
        date: 'November 17, 2026',
        changes: ['Extended the Agenda-inspired palette, cards, and controls across Smart List']
    },
    {
        version: '1.1.0',
        date: 'November 17, 2026',
        changes: ['Restyled Agenda Notes with the original Agenda timeline, card badges, and orange toolbar accents']
    },
    {
        version: '1.0.9',
        date: 'November 17, 2026',
        changes: ['Added the optional Agenda Notes module with project-linked Markdown notes, checklists, and dated views']
    },
    {
        version: '1.0.8',
        date: 'November 17, 2026',
        changes: ['Displayed account, export, and backup actions as menu rows in Settings']
    },
    {
        version: '1.0.7',
        date: 'November 17, 2026',
        changes: ['Made note menus more compact, added inline branch controls, and simplified access to search and Settings actions']
    },
    {
        version: '1.0.6',
        date: 'November 17, 2026',
        changes: ['Reorganized More options in the header, moved note menus to the left, and added sidebar visibility settings for Starred and Priority']
    },
    {
        version: '1.0.5',
        date: 'November 17, 2026',
        changes: ['Moved account options to the sidebar, project tools beside the title and note creation into note menus']
    },
    {
        version: '1.0.4',
        date: 'November 17, 2026',
        changes: ['Changed the note hover-menu icon to a nine-dot grid']
    },
    {
        version: '1.0.3',
        date: 'November 17, 2026',
        changes: ['Moved priority and star indicators beside the completion dot']
    },
    {
        version: '1.0.2',
        date: 'November 17, 2026',
        changes: ['Restored header breadcrumbs, moved search to the sidebar and placed note details below the text']
    },
    {
        version: '1.0.1',
        date: 'November 17, 2026',
        changes: ['Simplified project headings and moved note controls into a hover or touch menu']
    },
    {
        version: '1.0.0',
        date: 'November 17, 2026',
        changes: ['Moved account actions into Settings and grouped project tools and filters in an icon menu']
    },
    {
        version: '0.9.9',
        date: 'November 17, 2026',
        changes: ['Separated optional feature code from the core outline without changing workspace behavior']
    },
    {
        version: '0.9.8',
        date: 'November 17, 2026',
        changes: ['Moved the edit pencil to the read-only note viewer and enabled editing existing formatted notes']
    },
    {
        version: '0.9.7',
        date: 'November 17, 2026',
        changes: ['Added a pencil button for editing outline text']
    },
    {
        version: '0.9.6',
        date: 'November 17, 2026',
        changes: ['Added expand-all and collapse-all controls to project toolbars']
    },
    {
        version: '0.9.5',
        date: 'November 17, 2026',
        changes: ['Added a searchable in-app user guide and frequently asked questions']
    },
    {
        version: '0.9.4',
        date: 'November 17, 2026',
        changes: ['Added a first-use guide, optional account email, required temporary-password changes, and simple new-workspace defaults']
    },
    {
        version: '0.9.3',
        date: 'November 16, 2026',
        changes: ['Added expandable field notes beneath PM notes']
    },
    {
        version: '0.9.2',
        date: 'November 16, 2026',
        changes: ['Added reversible PM status and removed sample PM project content']
    },
    {
        version: '0.9.1',
        date: 'November 16, 2026',
        changes: ['Separated PM from custom templates and updated site details and menus']
    },
    {
        version: '0.9.0',
        date: 'November 16, 2026',
        changes: ['Restored PM site editing and added a project templates setting']
    },
    {
        version: '0.8.9',
        date: 'November 16, 2026',
        changes: ['Made note progress opt-in and moved task status to the right']
    },
    {
        version: '0.8.8',
        date: 'November 16, 2026',
        changes: ['Centered custom field labels and outlined their values']
    },
    {
        version: '0.8.7',
        date: 'November 16, 2026',
        changes: ['Moved custom field labels below values and made them smaller']
    },
    {
        version: '0.8.6',
        date: 'November 16, 2026',
        changes: ['Added custom field sizing and PM support for existing projects']
    },
    {
        version: '0.8.5',
        date: 'November 16, 2026',
        changes: ['Improved template and custom field management and simplified PM progress']
    },
    {
        version: '0.8.4',
        date: 'November 16, 2026',
        changes: ['Added manual updates of project custom fields from templates']
    },
    {
        version: '0.8.3',
        date: 'November 16, 2026',
        changes: ['Made template fields and project management details more compact']
    },
    {
        version: '0.8.2',
        date: 'November 16, 2026',
        changes: ['Moved project management actions to the top of note menus and added icons']
    },
    {
        version: '0.8.1',
        date: 'November 16, 2026',
        changes: ['Kept project management in project templates and removed its sidebar view']
    },
    {
        version: '0.8.0',
        date: 'November 16, 2026',
        changes: ['Added project management templates, task progress and node details to regular projects']
    },
    {
        version: '0.7.9',
        date: 'November 16, 2026',
        changes: ['Expanded the PM module with the construction template and outline navigation']
    },
    {
        version: '0.7.8',
        date: 'November 16, 2026',
        changes: ['Added an optional project management module']
    },
    {
        version: '0.7.7',
        date: 'November 16, 2026',
        changes: [
            'Added project templates with starter outlines and custom fields'
        ]
    },
    {
        version: '0.7.6',
        date: 'November 16, 2026',
        changes: [
            'Removed the sidebar tip card'
        ]
    },
    {
        version: '0.7.5',
        date: 'November 16, 2026',
        changes: [
            'Moved the save confirmation into the top menu'
        ]
    },
    {
        version: '0.7.4',
        date: 'November 16, 2026',
        changes: [
            'Added a hide/show completed toggle in Continuum'
        ]
    },
    {
        version: '0.7.3',
        date: 'November 16, 2026',
        changes: [
            'Added a Priority module setting'
        ]
    },
    {
        version: '0.7.2',
        date: 'November 16, 2026',
        changes: [
            'Fixed unwanted space above the app introduced by the logo'
        ]
    },
    {
        version: '0.7.1',
        date: 'November 16, 2026',
        changes: [
            'Added a new Smart List logo to the sign-in screen and sidebar'
        ]
    },
    {
        version: '0.7.0',
        date: 'November 16, 2026',
        changes: [
            'Renamed Flow to Continuum'
        ]
    },
    {
        version: '0.6.13',
        date: 'November 16, 2026',
        changes: [
            'Replaced the Flow navigation symbol with an original outline-tree icon'
        ]
    },
    {
        version: '0.6.12',
        date: 'November 16, 2026',
        changes: [
            'Added configurable browser reminders for due-date notes',
            'Added a Reminders module setting'
        ]
    },
    {
        version: '0.6.11',
        date: 'November 16, 2026',
        changes: [
            'Added a note-menu action to move a note under another note'
        ]
    },
    {
        version: '0.6.10',
        date: 'November 16, 2026',
        changes: [
            'Kept instance takeover detection active when saving is blocked'
        ]
    },
    {
        version: '0.6.9',
        date: 'November 16, 2026',
        changes: [
            'Limited each account to one active Smart List instance',
            'Added clear takeover notices and unsaved-work export for disconnected instances'
        ]
    },
    {
        version: '0.6.8',
        date: 'November 16, 2026',
        changes: [
            'Changed the default interface font weight to medium'
        ]
    },
    {
        version: '0.6.7',
        date: 'November 16, 2026',
        changes: [
            'Restored Keyboard shortcuts in the top menu',
            'Removed the floating note toolbar above the mobile keyboard'
        ]
    },
    {
        version: '0.6.6',
        date: 'November 16, 2026',
        changes: [
            'Made node menus visible on iPhone-sized touch screens',
            'Added completion controls to node menus',
            'Removed the Keyboard shortcuts menu item'
        ]
    },
    {
        version: '0.6.5',
        date: 'November 15, 2026',
        changes: [
            'Added administrator-managed accounts with separate workspaces',
            'Added password changes and session revocation'
        ]
    },
    {
        version: '0.6.4',
        date: 'November 15, 2026',
        changes: [
            'Grouped settings options under their respective modules'
        ]
    },
    {
        version: '0.6.3',
        date: 'November 15, 2026',
        changes: [
            'Styled Starred and Priority notes as project-like outlines'
        ]
    },
    {
        version: '0.6.2',
        date: 'November 15, 2026',
        changes: [
            'Styled dashboard sections as a project-like outline'
        ]
    },
    {
        version: '0.6.1',
        date: 'November 15, 2026',
        changes: [
            'Added an optional startup dashboard for starred, priority and upcoming due notes'
        ]
    },
    {
        version: '0.6.0',
        date: 'November 15, 2026',
        changes: [
            'Removed the saved confirmation from project pages while retaining save warnings'
        ]
    },
    {
        version: '0.5.9',
        date: 'November 15, 2026',
        changes: [
            'Renamed Endless view to Flow'
        ]
    },
    {
        version: '0.5.8',
        date: 'November 15, 2026',
        changes: [
            'Added a 145% font size option'
        ]
    },
    {
        version: '0.5.7',
        date: 'November 15, 2026',
        changes: [
            'Added an optional node zoom setting, off by default'
        ]
    },
    {
        version: '0.5.6',
        date: 'November 15, 2026',
        changes: [
            'Made the narrow-screen sidebar a readable overlay with full labels'
        ]
    },
    {
        version: '0.5.5',
        date: 'November 15, 2026',
        changes: [
            'Kept the note menu visible on tablets and added space to its left'
        ]
    },
    {
        version: '0.5.4',
        date: 'November 15, 2026',
        changes: [
            'Added optional Endless view and node zoom navigation'
        ]
    },
    {
        version: '0.5.3',
        date: 'November 14, 2026',
        changes: [
            'Require all sub-notes to be completed before completing a parent'
        ]
    },
    {
        version: '0.5.2',
        date: 'November 14, 2026',
        changes: [
            'Excluded completed notes from the global Priority view and count'
        ]
    },
    {
        version: '0.5.1',
        date: 'November 14, 2026',
        changes: [
            'Opened the sidebar by default on wider screens'
        ]
    },
    {
        version: '0.5.0',
        date: 'November 14, 2026',
        changes: [
            'Added a formatted outline and table preview to the export window'
        ]
    },
    {
        version: '0.4.9',
        date: 'November 14, 2026',
        changes: [
            'Added Markdown preview and export with readable tables'
        ]
    },
    {
        version: '0.4.8',
        date: 'November 14, 2026',
        changes: [
            'Added an export preview with copy, PDF and text actions'
        ]
    },
    {
        version: '0.4.7',
        date: 'November 14, 2026',
        changes: [
            'Moved application JavaScript into separate files'
        ]
    },
    {
        version: '0.4.6',
        date: 'November 14, 2026',
        changes: [
            'Moved application styles into a separate stylesheet'
        ]
    },
    {
        version: '0.4.5',
        date: 'November 14, 2026',
        changes: [
            'Colored hashtag text gray-red without a background highlight'
        ]
    },
    {
        version: '0.4.4',
        date: 'November 14, 2026',
        changes: [
            'Removed hashtag highlighting while retaining sidebar tags'
        ]
    },
    {
        version: '0.4.3',
        date: 'November 14, 2026',
        changes: [
            'Updated tag colors and simplified sidebar pills'
        ]
    },
    {
        version: '0.4.2',
        date: 'November 14, 2026',
        changes: [
            'Styled sidebar tags as pills and highlighted hashtags in notes and titles'
        ]
    },
    {
        version: '0.4.1',
        date: 'November 14, 2026',
        changes: [
            'Added hashtag discovery, sidebar tag views and tag management in Settings'
        ]
    },
    {
        version: '0.4.0',
        date: 'November 14, 2026',
        changes: [
            'Added PDF and text exports beside project filters, including notes'
        ]
    },
    {
        version: '0.3.9',
        date: 'November 14, 2026',
        changes: [
            'Placed compact theme and font-size selectors beside their labels in Settings'
        ]
    },
    {
        version: '0.3.8',
        date: 'November 14, 2026',
        changes: [
            'Organized Settings into consistent appearance, module and backup sections'
        ]
    },
    {
        version: '0.3.7',
        date: 'November 14, 2026',
        changes: [
            'Moved backup, PDF export and font-size options into Settings'
        ]
    },
    {
        version: '0.3.6',
        date: 'November 14, 2026',
        changes: [
            'Added light, dark and sepia appearance settings'
        ]
    },
    {
        version: '0.3.5',
        date: 'November 14, 2026',
        changes: [
            'Added workspace settings to enable or disable the rich-text editor'
        ]
    },
    {
        version: '0.3.4',
        date: 'November 14, 2026',
        changes: [
            'Added smaller and larger font controls beside project filters'
        ]
    },
    {
        version: '0.3.3',
        date: 'November 14, 2026',
        changes: [
            'Moved project renaming into each sidebar project menu'
        ]
    },
    {
        version: '0.3.2',
        date: 'November 14, 2026',
        changes: [
            'Moved project deletion to each project’s sidebar menu'
        ]
    },
    {
        version: '0.3.1',
        date: 'November 14, 2026',
        changes: [
            'Moved the signed-in account name into the top-right menu'
        ]
    },
    {
        version: '0.3.0',
        date: 'November 14, 2026',
        changes: [
            'Show the node name as the rich-text editor title'
        ]
    },
    {
        version: '0.2.13',
        date: 'November 14, 2026',
        changes: [
            'Added a sidebar view of prioritized notes across all spaces'
        ]
    },
    {
        version: '0.2.12',
        date: 'November 14, 2026',
        changes: [
            'Made the node menu narrower and placed priority choices on one row'
        ]
    },
    {
        version: '0.2.11',
        date: 'November 14, 2026',
        changes: [
            'Improved node menu spacing and viewport fit'
        ]
    },
    {
        version: '0.2.10',
        date: 'November 14, 2026',
        changes: [
            'Clarified rich-text note menu labels'
        ]
    },
    {
        version: '0.2.9',
        date: 'November 14, 2026',
        changes: [
            'Added icons to node menu actions'
        ]
    },
    {
        version: '0.2.8',
        date: 'November 14, 2026',
        changes: [
            'Reduced spacing around rich note menus and editor controls'
        ]
    },
    {
        version: '0.2.7',
        date: 'November 14, 2026',
        changes: [
            'Keep the selected rich note tool group visible while editing'
        ]
    },
    {
        version: '0.2.6',
        date: 'November 14, 2026',
        changes: [
            'Grouped rich note formatting, headings, lists and table tools into collapsible controls'
        ]
    },
    {
        version: '0.2.5',
        date: 'November 14, 2026',
        changes: [
            'Added headings and text highlighting to the existing rich note editor'
        ]
    },
    {
        version: '0.2.4',
        date: 'November 14, 2026',
        changes: [
            'Rich note naming, preserved selected text in checklists, and added undo and redo'
        ]
    },
    {
        version: '0.2.3',
        date: 'November 14, 2026',
        changes: [
            'Single-line rich note toolbar and editable checklists'
        ]
    },
    {
        version: '0.2.2',
        date: 'November 14, 2026',
        changes: [
            'More compact rich note editor with icon-based formatting and table controls'
        ]
    },
    {
        version: '0.2.1',
        date: 'November 14, 2026',
        changes: [
            'Show completion progress immediately to the right of the note'
        ]
    },
    {
        version: '0.2.0',
        date: 'November 14, 2026',
        changes: [
            'Version history and pre-upgrade backup procedure',
            'Database-backed private workspace and connection status',
            'Mobile editing toolbar and adjustable font size',
            'Simple and rich notes, including tables',
            'Progress nodes, project filters and global starred notes'
        ]
    },
    {
        version: '0.1.0',
        date: 'Original release (date previously recorded as November 12, 2026)',
        changes: [
            'Initial browser-based release with spaces, projects and nested notes',
            'Priority, stars, completion, search and backups'
        ]
    }
];
