# Day 3–4 feature audit

## Scope of this audit
The exact original Day 3 prompt is not available in this session's retained context; its recorded feature summary was used. Day 4 was checked against its retained requirements and `DAY_04_PROMPT.md`. This audit cannot prove that every detail of an unavailable prompt was implemented. It inspects source and automated checks; it is not a real Chrome certification.

## Feature inventory
| Phase | Requirement in retained context | Implementation and scope |
|---|---|---|
| Day 3 | Clock, date, greeting and personalization | Local clock with 12/24-hour option, seconds, optional name and greeting. |
| Day 3 | Shortcut management | Create, edit, delete and reorder HTTP(S) links, text icons, category filter and optional site favicon. Categories are filters, not folders; no image-icon upload. |
| Day 3 | Notes | Multiple plain-text notes, create/delete/edit, pin, search and debounced local autosave. |
| Day 3 | Tasks | Add, edit, delete and complete; priorities, due dates, filtering and completion count. |
| Day 3 | Focus workspace | Focus/short/long timers with adjustable durations, start/pause/resume/reset, timestamp recovery and session count. No background notifications or automatic break transitions. |
| Day 3 | Preserve prior dashboard | Search, starter links, themes, backgrounds, layout presets and motion remain; workspace widgets can be shown or hidden. |
| Day 4 | Advanced theme editor | Accent, text, surface, solid background, two-color linear gradient and angle, border/shadow intensity, preview and limited contrast warning. Solid background is in Backgrounds. |
| Day 4 | Wallpaper studio | Four bundled illustrations plus upload; position, brightness, overlay, blur, restore/remove. One image is stored locally with a 4 MB cap. |
| Day 4 | Layout studio and saving | Reorder sections/widgets via draggable rows or keyboard buttons in Settings; normal/wide widths for Notes, Tasks and Focus; spacing, alignment and reset. Save a layout as part of a profile snapshot. This is not free-form dashboard dragging or arbitrary resizing. |
| Day 4 | Environment profiles | Work, Study, Personal and up to 20 total custom/saved snapshots, with explicit apply/save/delete. Edits to the current look do not automatically update a snapshot; notes, tasks, shortcuts and the single uploaded wallpaper are shared. |
| Day 4 | Import/export and defaults | Versioned customization JSON with allowlist, size and schema validation and confirmation. Productivity data, name, profiles and image bytes are excluded; preference and layout resets do not delete them. |
| Day 4 | Reusable prompt | `docs/DAY_04_PROMPT.md`. |

## Defects found and fixed in this audit
- A focus session could reopen with stale state if the widget remounted while a previous save was pending. Timer writes now serialize across remounts in the same page; a regression test covers it. This is not a cross-tab transaction.
- A missing uploaded wallpaper in the Custom theme fell back to a fixed preset rather than the selected custom gradient. It now uses the custom gradient, with a regression test.

## Verification and remaining work
- `npm test`: 41 passed with mocked storage and jsdom, including synthetic drag, keyboard ordering, invalid import, layout reset, timer remount and gradient fallback checks.
- `npm run build`: passed; `npm run test:package`: 3 passed; `npm audit`: 0 vulnerabilities; `git diff --check`: clean.
- No Chrome/Chromium executable is available in this sandbox. Real MV3 installation, IndexedDB upload/restart, drag/drop and keyboard behavior, visual contrast, reduced motion, network activity and CPU/memory have not been verified in an installed extension. Follow the README checklists on target Chrome.
- Cross-tab concurrent writes remain last-writer-wins. Asynchronous writes on abrupt shutdown are best effort. Contrast checks do not cover all wallpaper/gradient combinations. A separate browser bookmarks manager, notifications, free-form dragging, and distinct wallpaper storage per profile are not implemented; these should not be assumed to exist.
