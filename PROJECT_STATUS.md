# Project status

## Current phase
Day 5 — NOVA Web implementation is present; real Chrome extension, site compatibility, permission and performance verification are outstanding. Stop after Day 5 and wait for user confirmation before Day 6. Day 3–4 browser/restart verification remains outstanding.

## Audit and preserved foundation
- Existing React 19 / strict TypeScript / Vite MV3 new-tab override, search, themes, wallpaper storage, layout presets, settings and idle service worker remain in place. Day 1–4 originally requested only `storage`; Day 5 adds `activeTab`, `scripting` and optional host patterns as described below.
- Day 2's single quick note and basic tasks are read using the existing storage keys and stable IDs. Existing starter-link ordering is used when no saved shortcut list exists; an intentionally empty list remains empty.
- User indicated Day 1–2 were ready to proceed, but this environment has not independently verified the installed extension in Chrome.

## Day 3 features
- Local clock/date/greeting with optional name, 12/24-hour format and optional seconds. Timer aligns to the next minute/second and pauses in hidden tabs.
- Local shortcut manager: add/edit/delete, HTTP(S) validation, text icons, optional category filter, keyboard-accessible ordering and opt-in website favicon with fallback.
- Multiple notes: create/edit/delete, search, pin, timestamps and debounced autosave; content is plain text.
- Tasks: add/edit/delete/complete, priority, due date, filters and completed count.
- Focus/short/long break timer: configurable durations, start/pause/resume/reset, completion feedback and focus-session count. State uses end timestamps and is written on actions/completion, not every second. No worker timer or notifications.
- Workspace supports toggling and ordering notes, tasks and focus through settings; Day 4 also allows reordering their containing dashboard sections. Focus, Workspace and Immersive presets remain available.
- Development-only jsdom and React Testing Library dependencies exercise widget interactions with mocked Chrome storage; no added production dependency.

## Day 4 features
- Live custom accent, text and surface colors; gradient colors/angle; border and shadow intensity. A contrast warning compares custom text and solid surface; the settings panel uses fallback ink when those choices are unreadable.
- Four local illustrated wallpaper presets plus the existing upload; horizontal/vertical position, brightness, overlay, blur and restore controls.
- Reorder dashboard sections and workspace widgets via native drag or keyboard buttons; normal/wide widget widths, spacing, alignment and layout reset. Existing data stays separate.
- Work, Study and Personal profile snapshots plus custom profiles. Changes are not automatically saved back to a profile; notes, tasks, shortcuts and the single uploaded wallpaper are shared.
- Versioned, allowlisted JSON customization import/export with strict validation and a 128 KB file limit. The export excludes productivity data, personal name, profiles and image bytes.
- `docs/DAY_04_PROMPT.md` contains the requested reusable engineering prompt. `docs/DAY_03_04_AUDIT.md` records the later feature audit and its limitations.

## Day 5 — NOVA Web
- Dedicated compact popup for current-site activation, dark colors, typography, Reader, element selection/rules, reset and permission state.
- `activeTab` + `scripting` permit user-triggered current-tab changes; optional HTTP(S) host patterns are declared but requested only for the chosen scheme/host when automatic styling is enabled. Chrome match patterns cover every port; non-default port origins are denied automatic registration. No mandatory host permissions or static content scripts.
- Per-origin settings and validated element selectors use local Chrome storage. The registered content script runs only for granted hosts and applies settings for the matching origin. Reader and picker scripts load only on request; user-origin CSS is removed when disabled. The worker is event-driven and has no polling or observers.
- Reader builds an allowlisted text-only DOM, with safe HTTP(S) links and no executable copied HTML; page content is not transmitted or persisted. Picker refuses direct interactive/structural controls and asks before hiding containers with controls.
- Website transforms are best effort; Shadow DOM, iframes, dynamic page structures, visual contrast and protected pages remain compatibility limitations. `docs/DAY_05_PROMPT.md` preserves a reusable prompt for this phase.

## Verification
- Day 1–4 baseline before edits: 43 automated tests, build, 4 package checks passed; npm audit 0 vulnerabilities.
- Day 5: 62 automated unit/jsdom/mocked-Chrome tests passed and cover popup behavior, selector validation, reader extraction/sanitization, CSS cleanup, origin isolation, permission denial/registration, and worker messages. These are not actual browser extension tests.
- Production build and package checks pass; `npm audit` reports 0 vulnerabilities. Vite output: new-tab entry 28.44 KB / 9.95 KB gzip plus shared React chunk 226.39 KB / 70.38 KB gzip; popup entry 12.61 KB / 4.26 KB gzip plus the same shared chunk. The popup also loads its CSS and local model script. These are build sizes, not RAM/CPU measurements.
- No real website category has been tested in Chrome in this environment. Installed-extension behavior, permission prompts/revocation, site compatibility, browser restart, accessibility, network activity and CPU/memory profiling remain unverified; follow the README matrix.

## Architectural decisions
- Existing theme tokens and reduced-motion styles are reused. The settings shell is lazy-loaded, and advanced theme, layout, profile and transfer modules load only when their sections are opened. The productivity workspace loads only when a workspace widget is visible. The default tab does not open wallpaper IndexedDB until an uploaded background is selected or settings is opened. The MV3 worker is event-driven and performs no polling.
- Notes use a 500 ms debounce. List writes and focus timer writes are serialized across widget unmount/remount in the same page, and pending list edits are flushed on page hide where possible.
- A focus session that ends while no focus widget is visible is reconciled when that widget next opens. It does not notify or automatically transition to a break. Completion count is local.
- Favicons are fetched directly from the shortcut's site only when explicitly enabled; custom icons are short text, not uploaded images. Categories are filters, not nested folders.

## Audit fixes
- Fixed a focus timer remount race during a pending save and added a regression test. This does not coordinate different tabs.
- Fixed missing uploaded wallpaper fallback in the Custom theme to use the user’s custom gradient.

## Known limitations / risks
- The element picker requires pointer selection (Escape cancels); a keyboard element-selection workflow is not implemented.
- Day 5 site styling and reader extraction are best-effort and have not been tested in an installed extension. Styling affects only the top document; isolated frames, Shadow DOM and canvas-heavy sites may be unsupported. Selectors can become stale. Reader can omit or misidentify content and intentionally omits media/forms.
- Site records store selected origins and selectors, not full browsing histories; these records still reveal customized hosts. Per-origin changes in simultaneous tabs are not transactional. Revoking automatic access does not immediately remove CSS already applied to the current document; disable NOVA or navigate to restore it.
- No atomic cross-tab transactions for productivity lists or the timer. Simultaneous edits in multiple new tabs are last-writer-wins and may overwrite changes or race when reconciling a timer. Avoid editing the same data in multiple tabs until cross-tab coordination is implemented.
- Autosave and timer actions use asynchronous local storage; browser shutdown or storage quota/errors may prevent the last write. Errors are shown while the widget is mounted, but a closing page cannot guarantee delivery. Wait briefly before closing.
- Completion is not announced while all focus widgets are closed/hidden; it appears when one is opened/visible again. No background timer or notification permission is used.
- Notes, tasks and focus support normal/wide widths and independent order; clock, search and shortcuts can be reordered only as whole sections. Shortcut categories are filters rather than folders; custom icons accept text, not image files.
- Browser-level keyboard behavior, reduced motion, Chrome storage/restart and focus lifecycle, wallpaper/contrast and performance require the README's manual testing. DOM tests do not prove those behaviors.
- Existing wallpaper minimum overlay and custom-accent contrast tradeoffs remain. The contrast warning covers solid text/surface only, not arbitrary wallpaper, gradients or every UI element. Simultaneous tab preference/profile changes do not live-synchronize and can overwrite each other.
- Profiles are explicit snapshots; editing the current look does not automatically update a saved profile. All profiles reference the same single uploaded wallpaper. Export does not include the uploaded image; applying an upload-based profile or import on a device without it falls back to the theme background.

## Next steps
1. Build and reload the unpacked extension in Chrome; follow the Day 5, Day 4 and Day 3 checklists in README.
2. Inspect Console and Network, test browser restart and profile CPU/memory on ordinary hardware.
3. Fix reported problems and obtain confirmation before Day 6.
