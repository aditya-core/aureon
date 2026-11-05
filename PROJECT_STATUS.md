# Project status

## Current phase
Post-Day-8 product refinement: dashboard and popup discovery, Research backup and source clarity, and Assistant recovery/privacy safeguards added without changing the architecture. Live AI integration and installed-Chrome verification remain incomplete. See `docs/PRODUCT_REFINEMENT.md`; do not claim real provider, browser, network, accessibility, restart or performance verification without executing it.

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

## Day 6 — Command Centre
- Separate popup-linked extension page; theme panel tokens, responsive tab search, counts, tab selection, switch/confirmed close, duplicate/inactivity/group indicators, keyboard search and native cached favicon endpoint with fallback.
- Event-driven tab/group/recent updates while open; listeners and deferred updates are cleaned up. Stale initial/refresh snapshots are rejected and retried. No polling, automatic grouping, tab discarding or RAM claims.
- Native groups can be created, named, recolored, expanded/collapsed, populated or ungrouped explicitly; pinned and cross-window selections are rejected. Suggested labels are manual, not AI categorization.
- Duplicate keys ignore fragments, preserve queries and schemes, and separate incognito from normal. Closure is confirmed and each URL is rechecked; operations are not atomic with Chrome changes.
- Local named workspaces save only non-incognito, credential-free HTTP(S) tabs, title, pin and group metadata. Full query strings are sensitive. Restore skips unsupported/already-open URLs, recreates possible groups/pins, confirms over ten tabs and reports partial errors. Up to 50 workspaces of 500 tabs; same-page writes serialized, cross-page writes not atomic.
- Recently closed uses native `chrome.sessions` and no additional history database. Required new permissions `tabs`, `tabGroups`, `sessions`, `favicon`; no `history` permission, new mandatory website hosts, page-content access, telemetry or server. Existing Day 5 optional hosts remain opt-in. Chrome may present `tabs` as browsing-history access.
- Known limitations: large lists are not virtualized; activity indicator requires Chrome `lastAccessed`; grouping may partially succeed on errors; restore and duplicate checking cannot be atomic; favicon and API behavior require real Chrome verification.

## Days 7–8 — Assistant and Research
- Chrome side panel entry and popup launcher; separate, themed, responsive React entry. General chat and source-based summary, explanation, questions and notes use authenticated backend SSE. Streaming, stop, local conversation history/clear, copy, restoring failed questions and explicit per-request context approval are implemented.
- Extraction is user-triggered, transient and bounded; skips forms, common hidden and navigation elements, rejects incognito/internal/sensitive heuristics and password fields, strips query/fragment from shared URL, and checks navigation. Sensitive detection, hidden filtering and prompt-injection mitigation cannot guarantee safety. Source is not intentionally persisted, though generated text may repeat it.
- Backend in `backend/`: Django/DRF account token auth, per-user UTC daily quota, bounded request/context/output, CORS allowlist, streaming, timeouts and server-only provider credentials. OpenAI adapter is implemented; no deployed server or live provider has been tested. Token provisioning and production infrastructure are operator responsibilities. See `docs/AI_BACKEND.md`.
- Local IndexedDB research collections, saved pages, title/URL/tag/note search, personal notes, related pages, duplicate detection and explicit AI knowledge-card preview/save. Plaintext data is not encrypted or automatically backed up; an opt-in unencrypted Research-only JSON export/import is now available (5 MB, 1,000 collections, 5,000 pages). No semantic search. Simultaneous research pages do not live-sync, and editing the same record concurrently is last-writer-wins.
- Permission added: `sidePanel`. Existing `activeTab`, `scripting` and optional host permissions are reused. Backend origin is requested only on user Connect; account token lives in session storage, not the server provider key. Chrome may need renewed `activeTab` access for source capture.
- Known gaps: real side-panel opening, Chrome permissions, CORS, favicon behavior, live AI/provider output, browser restart, network/console, keyboard/contrast and resource measurements are not verified here. Stop/cancellation is best-effort upstream; model-generated JSON may be invalid and requires retry. Chrome page and private-site heuristics cannot detect all sensitive data.

## Verification
- Product refinement: 106 JavaScript unit/jsdom/mocked-Chrome tests and 5 package checks passed; production build and `npm audit` passed (0 vulnerabilities). Six Django tests using a fake provider and Django system checks passed. A development dashboard responded over HTTP; this is not an installed Chrome or live AI test.
- Days 7–8: 93 JavaScript unit/jsdom/mocked-Chrome tests passed, 6 Django tests passed with a fake provider, production build and 5 package checks passed; `npm audit` reported 0 vulnerabilities. These do not verify an installed extension or real AI provider.
- Day 1–4 baseline before edits: 43 automated tests, build, 4 package checks passed; npm audit 0 vulnerabilities.
- Day 5: 62 automated unit/jsdom/mocked-Chrome tests passed and cover popup behavior, selector validation, reader extraction/sanitization, CSS cleanup, origin isolation, permission denial/registration, and worker messages. These are not actual browser extension tests.
- Day 6: 79 automated unit/jsdom/mocked-Chrome tests passed (including model, privacy, grouping, duplicate revalidation, storage, restore, UI confirmations, browser events and cleanup); production build and 4 package checks pass; `npm audit` reports 0 vulnerabilities. These are not installed-Chrome tests.
- Day 5 production build and package checks passed; `npm audit` reports 0 vulnerabilities. Vite output: new-tab entry 28.44 KB / 9.95 KB gzip plus shared React chunk 226.39 KB / 70.38 KB gzip; popup entry 12.61 KB / 4.26 KB gzip plus the same shared chunk. The popup also loads its CSS and local model script. These are build sizes, not RAM/CPU measurements.
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
1. Provision the backend and a real provider account as documented; test live streaming and quotas without exposing secrets.
2. Load the extension in Chrome and follow the Days 7–8 and prior manual matrices; inspect Console, Network, restart and resource use.
3. Fix any reported issues and obtain confirmation before Day 9.
