# NOVA

A local-first Chrome New Tab extension. Days 7–8 add an opt-in AI side panel and local research workspace; Day 9 adds opt-in automations and Tab Space adds a visual tab manager alongside the existing Command Centre, New Tab Personalisation Studio, productivity workspace and website controls. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for verification and limitations.

## Development

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm test
npm run build
npm run test:package
npm run dev
```

The package check verifies built extension files; it does not replace a real Chrome test. The development preview stores data separately from an installed extension. Notes, tasks, shortcuts, timer and preferences use `chrome.storage.local` in Chrome (localStorage in the preview); uploaded wallpaper uses IndexedDB.

## Lightweight architecture

The new-tab entry loads the settings shell only when Personalize is opened. Advanced Studio, layout controls, profiles and transfer load when their respective sections are selected; workspace widgets load when one is visible. Wallpaper IndexedDB is opened only when an uploaded background is selected or settings needs the saved image. Tab Space is a lazy in-page view and suspends browser listeners while hidden; the Command Centre is a separate entry loaded only when opened; browser events update its view while it is open. The MV3 service worker is event-driven, with no polling; website scripts run only on explicit current-tab action or a separately granted site. The build-manifest package test checks the chunk boundaries; it is not a substitute for measuring CPU, memory or startup in Chrome.

## Load or update in Chrome

1. Run `npm install` if dependencies changed, then `npm run build` in this project folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. For a first install choose **Load unpacked**, then select this project's `dist` folder. If already installed, click NOVA's **reload** button after rebuilding.
4. Open a fresh new tab. If Chrome asks you to keep the new-tab change, confirm it.

## NOVA Tab Space

Use **Switch tabs** in the new-tab header for a Samsung Recent Apps–inspired carousel of open normal Chrome tabs. Swipe or use the arrow keys, choose a card to switch, or select **Open Tab Space** for the full manager. Cards use favicons and decorative artwork, not screenshots; private tabs are excluded. Chrome tabs only are shown—not Android apps or tabs on other devices.

Open **Tab Space** from the new-tab header for a theme-aware Gallery or Compact view of normal-window tabs. Search, filter, select, manage native groups, review exact duplicates and save or restore the existing local workspaces. Cleanup never closes or organizes tabs automatically; destructive actions ask for confirmation. No tab screenshots are captured, and private tabs are excluded. The feature reuses existing permissions and Day 6 storage; it adds no history access or host grant.

See [docs/TAB_SPACE.md](docs/TAB_SPACE.md) for architecture, privacy, limitations and an **unexecuted installed-Chrome checklist**. Browser actions have only been exercised using mocked Chrome APIs in this environment; the web preview cannot manage real Chrome tabs. Performance and accessibility require real-browser testing.

## Motion and transitions

Every NOVA window — new tab, Command Centre, Automations, Research, Assistant, the toolbar popup, the tab switcher and Tab Space — shares one motion layer (`src/motion.css`) so interactions settle on the same short curve instead of each screen inventing its own timing.

- Transitions run at 100ms (hover/press), 150ms (state changes), 220ms (panels and cards) and 300ms (surface entrances). Only colour, border, shadow, opacity and transform are animated, so moving elements stay on the compositor; layout, scrolling and virtualized content never animate.
- The **Motion** setting in Settings still offers Off / Subtle / Standard / Expressive. Each level scales the same tokens (×1, ×1.2, ×1.45) rather than adding new effects, and the choice now reaches every surface, including the popup. A saved change propagates to open surfaces through `chrome.storage.onChanged`.
- **Reduce motion** (the setting or `prefers-reduced-motion`) collapses the scale to zero and disables entrance animations everywhere, including the switcher and Tab Space. Streaming Assistant answers are deliberately never animated.
- No animation library or new dependency is used, and no frame-rate, latency or device-parity claim is made: timings are design values, not measurements. Real profiling still needs an installed Chrome browser.

## Day 9 — Automations

Open **Explore NOVA → Automations** from a new tab, or open the NOVA toolbar popup on the page you want to use as a source and choose **Automations**. Create a workflow or edit one of four optional templates. Add and reorder actions, preview, save, and run. New automatic triggers are disabled by default. Manual runs remain available even when the automatic trigger is disabled.

The runner uses the existing Command Centre sessions, themes/layouts, focus timer, notes and Research store. It supports opening safe URLs, restoring a session, changing theme/layout, starting focus, creating a note, saving a reviewed source page, showing a notification, waiting and asking for confirmation. Research collection and library actions support the Research Sprint template. A saved workspace with more than 10 tabs requires an approved confirmation step immediately before restoration. Source-page saving is manual-only; open Automations from the popup on that page and review the displayed source.

**Triggers:** manual, an opt-in browser-startup alarm, daily local-time schedule, and one opt-in keyboard-shortcut workflow. Chrome may delay alarms; startup is deferred by at least 30 seconds. Configure the shortcut in `chrome://extensions/shortcuts` (suggested Ctrl+Shift+Y, or Command+Shift+Y on macOS). Grant optional notification permission via **Enable notifications** only if needed. Day 9 adds mandatory `alarms` and optional `notifications`; it adds no new website host access. Chrome may ask for permission review after an update.

One workflow runs at a time; overlapping automatic triggers are recorded as failures, not queued. Pause, resume, cancel and confirmation are available on the dashboard. History retains at most 100 runs. A timeout includes pauses and waits. A stopped, timed-out or interrupted action may already have had effects; review before retrying. In-flight actions are not replayed after a service-worker restart; persisted waits and confirmations can be resumed. Settings and notes can still be last-writer-wins across open tabs: finish editing them before a workflow changes them. Do not use NOVA to automate sensitive submissions; workflows cannot execute arbitrary code.

See [docs/DAY_09_AUTOMATIONS.md](docs/DAY_09_AUTOMATIONS.md) for architecture, limits, security and an **unexecuted installed-Chrome test checklist**. A browser preview cannot run extension automation APIs. Live Chrome startup, alarms, commands, notifications, restart behavior and real-device accessibility require manual verification.

## Days 7–8 — Assistant and Research

Open **Explore NOVA** on the dashboard to discover Assistant, Command Centre and Research, or use the NOVA toolbar popup on a page → **NOVA Assistant** or **Research workspace**. The existing dashboard, website controls and Command Centre remain separate. The side panel and research workspace load only when opened.

**AI is not live out of the box.** A separately configured Django backend, authenticated account token and server-side provider key are required. Full setup, environment variables, API contract and security/deployment limitations are in [docs/AI_BACKEND.md](docs/AI_BACKEND.md). No live provider call or installed Chrome run has been verified here. Without a backend, requests show an error rather than a pretend AI response; local research still works.

In Assistant, choose a suggested prompt or use **Page context** / **Selection**, review the extracted text, and explicitly approve sharing it for each request. General chat is clearly labelled and sends no page context. The settings panel configures a 1,000–24,000-character context limit and your backend connection. The extension filters common sensitive sites and password pages, excludes private tabs and common hidden/form/navigation content, and strips URL query/fragment from shared context. These are best-effort safeguards: **review everything**, because sensitive-page/hidden-data detection and prompt-injection resistance cannot be guaranteed. Ask a follow-up after approving the same context again, stop a stream, copy an answer, or clear local conversation history. If the source tab changes, prepare and approve fresh context; if setup fails, your typed question remains in the composer. User messages and AI answers are stored locally; a generated answer could repeat source content.

Research stores collections, pages, descriptions, tags, personal notes, links between sources and approved AI cards in a separate local IndexedDB database. Open Research from the popup on the page you want to save, check the displayed source and select **Save current page**. Alternatively, use **Add a link** without reading a page. Full saved URLs can include sensitive query strings. Search is local text matching, not semantic search. To create a knowledge card, keep the saved page open, explicitly request extraction, review/approve sharing, then review and save the returned card. Chrome may require you to click NOVA on that source page again to grant temporary `activeTab` access. If no backend is configured, there is no AI card; saved pages and notes remain usable. Deleting a collection moves its pages to Unfiled.

Day 7 adds the `sidePanel` permission. Existing `activeTab`/`scripting` are used for user-triggered page extraction; the backend origin uses the existing optional host-permission mechanism and is requested only on Connect. No `history` permission or new mandatory website access is requested. The account token is kept in session storage until browser restart; the provider API key stays only on the backend. IndexedDB and local chat data are not encrypted by NOVA or automatically synced. Research alone can be exported as an unencrypted JSON backup via **Back up or restore your library**; keep it private. Backups contain Research collections, saved URLs, notes and cards, not chats, preferences or credentials. Imports are confirmed, validated, merged in a single transaction and skip existing matching URLs; existing records are not overwritten. Missing collection references become unfiled. Exports and imports are limited to 5 MB, 1,000 collections and 5,000 pages. Back up elsewhere before uninstalling the extension; removal may delete local data.

### Manual testing — not yet executed here

1. Build and reload `dist`; review permissions. On an ordinary article, open Assistant, use general chat and each suggested action. Check extraction previews, per-request consent, URL query stripping, selection, follow-up context, clear history, restore a failed question, stop and network errors. Switch tabs or navigate after approving context and confirm a fresh review is required. Check internal, password, private and obviously sensitive pages are blocked. Never use real secrets in tests.
2. Configure your backend as described in [docs/AI_BACKEND.md](docs/AI_BACKEND.md); verify the Chrome permission prompt, authentication, streaming, failed provider credentials and per-user limit. Inspect requests and server logs safely. Exercise both light/dark themes and narrow side-panel widths, keyboard and reduced motion.
3. From a normal page open Research and save it, add collections, tags, notes and related sources, search, try duplicates and reload Chrome. With a configured backend, preview and generate a card, cancel, review and save; verify no source text is stored as a page snapshot. Test quota/storage errors and large collections. Export a backup, confirm it excludes account credentials, import into a separate test profile, cancel an import, check duplicates and deliberately invalid files; protect the unencrypted file.
4. Regression-test Days 1–6, including popup, settings, widgets and Command Centre. Inspect Console and Network and profile idle/active CPU and memory. Cross-window research edits, real Chrome browser APIs, live provider behavior and performance remain unverified by the mocks.

## Day 6 — Command Centre

Click the NOVA toolbar icon → **Command Centre**. It opens as a separate extension tab. Search by title or URL; `/` or Ctrl/Cmd+K focuses search, Escape clears it. Select tabs to create a native group or save a workspace. Switch to a tab or close it individually (closing asks for confirmation). The selected theme’s panel colors are used; wallpapers are not loaded on this page.

- **Groups:** select unpinned tabs in the same window, then use Tab groups to create a named/color group, add to an existing group or ungroup; rename, recolor and collapse/expand Chrome groups. The Work, Study, Research, Entertainment, Shopping and Personal names are suggestions, not automatic categorization. Chrome controls group behavior and pinned tabs cannot join a group.
- **Duplicates:** review HTTP(S) pages with the same normalized URL ignoring fragments. Queries are preserved, and HTTP and HTTPS are distinct. Normal and incognito tabs are never compared together. Pick the tab to keep and confirm; NOVA rechecks live URLs before closing the others. No tabs close automatically.
- **Workspaces:** name and save the current window or selected tabs. Only non-incognito HTTP(S) URLs without embedded credentials are saved, along with titles, pinned state and available native-group names/colors. Explicitly saved URLs include their query strings, which may contain sensitive information; they stay in `chrome.storage.local` on this device. Up to 50 workspaces and 500 tabs per workspace are supported. Details lets you select individual tabs to restore, and workspaces can be renamed or deleted. Restore opens in the current **normal** window, skips unsupported URLs and normalized URLs already open in any normal window or already restored, and asks before attempting more than 10 tabs. It reports opened, skipped and failed operations; a group operation can fail after its tabs have opened. Identically named native groups are kept distinct when captured.
- **Recently closed:** lists up to 25 entries from Chrome’s native `sessions` API, not a separate history database; select Restore to use Chrome’s own recovery. Availability and retention are controlled by Chrome.
- **Performance:** tabs and groups are updated by browser events while the page is open; there is no polling, automatic discarding or claimed RAM saving. Inactive means a non-active tab whose Chrome `lastAccessed` timestamp is at least 30 minutes old; browsers that do not provide this field cannot show that indicator. Chrome’s local favicon endpoint is used with a fallback; no direct third-party favicon service is used by this view.

### Day 6 permissions and privacy

The existing `storage`, `activeTab`, `scripting`, and optional per-site HTTP(S) permissions remain. Day 6 adds `tabs` to read titles and URLs of open tabs, `tabGroups` for native group controls, `sessions` for Chrome's recently closed list/restore, and `favicon` for Chrome’s cached extension favicon endpoint. Chrome may describe the `tabs` permission as access to browsing history and may ask you to review permissions on upgrade; NOVA does not request the `history` permission or build a browsing-history database. These permissions do not add a mandatory HTTP(S) host grant or access webpage content. Saved workspaces are local and never include incognito tabs, but their titles and full URLs can be sensitive. Open tab metadata and native recent sessions are read only while Command Centre is open. Day 6 itself sends nothing to a NOVA server. Day 7 adds an optional backend for explicitly requested AI; see below.

### Day 6 manual Chrome matrix — **not yet executed here**

1. Build with `npm ci && npm run build`; reload or load unpacked `dist` in `chrome://extensions` and review Chrome’s new permission prompt. Open toolbar popup on a normal and protected page and open Command Centre. Check Days 1–5 still work.
2. In multiple windows open HTTP(S), pinned and internal pages; search title and URL, use `/` and Ctrl/Cmd+K, select, switch, cancel/confirm close, and test narrow widths, keyboard focus and reduced motion. Check tab/group counts and event updates when another window opens, moves, groups or closes tabs.
3. Select tabs in one window, create a suggested and a custom group; rename, change color, collapse/expand, add and ungroup. Try pinned and cross-window selections and check errors rather than unintended grouping.
4. Open same URLs with differing fragments, differing queries and HTTP versus HTTPS; review and change the keep choice. Cancel and confirm closing, and navigate a tab before confirmation to test revalidation. If extension incognito access is enabled, verify private and normal duplicates are separate.
5. Save a current window and a selection with pinned, grouped, private and unsupported tabs. Check private/internal URLs were skipped; reload/restart Chrome, rename and delete a workspace. Restore all and selected, check deduplication, pinned/groups and the >10 confirmation. Test unavailable tabs, permission/storage failures where practical and partial-result messages.
6. Close a tab and window and use Recently closed to restore them; compare availability to Chrome’s own list. Test denial/revocation of the separately optional Day 5 host permission.
7. Inspect extension page, popup and service-worker DevTools Console and Network; profile CPU/memory on representative tab counts, both idle and during updates. Verify favicon behavior and confirm no unexpected remote requests. Measurements and browser accessibility/compatibility are not established by the automated mocks.

Known constraints: workspace writes are serialized within one Command Centre but are not atomic across multiple Command Centre pages; avoid concurrent edits. Restoring and duplicate closing involve separate Chrome API calls and cannot be perfectly atomic against external browser changes. Group creation can partially succeed if the subsequent rename/color update fails. Large tab lists are rendered rather than virtualized, so responsiveness with very large tab counts is unmeasured. Native Chrome APIs, favicons, permission prompts, restart persistence and actual resource use require the manual matrix above.

## Day 5 — NOVA Web

Open a normal HTTP(S) page and click the NOVA extension icon (pin it from Chrome’s Extensions menu if necessary). The popup controls the **current origin**. Turn on Dark mode or Typography, edit their settings and turn **NOVA on this site** off to restore the page. Use **Apply saved styling to this tab** after navigation when automatic access is off.

**Reader:** click Open / exit on a suitable article, then adjust theme, system font, size, line height and width in the reader toolbar. Escape or Exit reader restores the original page. The reader extracts a sanitized text-only view from an `article`, `main` or main role; it omits media and forms and may not work on every page. Nothing is uploaded.

**Distractions:** click Select, hover to preview and click a non-essential element, or press Escape. NOVA asks before hiding a container with interactive controls. Reopen the popup → Rules to disable or undo individual rules; the distraction toggle disables all rules without deleting them. Rules are selectors and may stop matching when a site changes. The picker requires a pointer to select elements (Escape cancels) and operates in the top document, not inside cross-origin frames or shadow roots.

### Permissions and privacy

- `storage` stores preferences locally. `activeTab` provides temporary access after clicking the extension; `scripting` applies bundled scripts/CSS to that tab.
- Optional HTTP(S) host patterns are declared so Chrome can prompt later, but **no host is granted by default**. Enable **Apply automatically on this site** to request access to the selected scheme and host; accept or deny Chrome’s prompt. Chrome host patterns cover all ports of that host, even though profiles are keyed by origin. To avoid silently widening a non-default port, automatic access is unavailable for custom-port origins; temporary current-tab access remains available.
- Turning off automatic access unregisters the site script and requests permission removal. Already-applied current-tab styling remains until NOVA is disabled or the tab navigates. Resetting the site revokes automatic access and restores its styling.
- NOVA Web stores selected origins, settings and user-selected selectors, not full URLs, article text or a browsing history. The separately requested Day 6 workspaces do store the full URLs and titles of tabs you explicitly save, as described above. Those origin/selector records can still reveal which sites you customized. Day 5 does not transmit page contents; Day 7 AI can send reviewed content to a configured backend only when explicitly approved.
- Chrome internal pages, Chrome Web Store and other browser-protected pages cannot be modified. Restricted pages or enterprise policy may also reject script injection.

### Manual Chrome matrix — **not yet executed here**

1. Run `npm install` and `npm run build`, then reload the unpacked `dist` extension under `chrome://extensions`. Chrome may require you to review the new permissions. Open a fresh tab and verify Days 1–4.
2. On a static article and a documentation page, toggle dark mode, edit colors, apply typography, reload, and restore the original. Confirm forms and links still function.
3. On a news article, open Reader, adjust every control, follow a safe link and exit. Try a short/non-article page and confirm an unsupported message. Verify the original page is unchanged on exit.
4. On a JavaScript-heavy site and a video/image site, try styling, navigate inside the site and check media, forms and interactive controls. The engine is best-effort, not universally compatible; disable it if anything breaks.
5. Pick a sidebar or promotional section, cancel once with Escape, then hide, disable and undo its rule. Check confirmation when a selected container includes controls.
6. Deny automatic access and check current-tab controls still work. Grant it for one site, reload that site, test a different host, then disable it and verify Chrome’s extension site-access UI. Test `chrome://settings` and a protected store page.
7. Use DevTools to inspect extension/service-worker errors, network requests, performance and memory while idle and with the reader/picker open. Do not infer CPU/RAM improvements from bundle sizes alone.

## Day 4 testing checklist

1. **Theme editor:** open **Personalize → Studio**, change accent, text, surface and gradient colors, angle, borders and shadows. Check the dashboard and preview update. Choose low-contrast text and surface colors and verify the warning; the settings panel should remain usable. Reload and restart Chrome to check persistence.
2. **Backgrounds:** try the four local illustrated wallpapers, gradients and solid color. Upload a JPEG/PNG/WebP/AVIF under 4 MB, adjust horizontal/vertical position, overlay, brightness and blur, then reload. Try **Restore default background** and **Remove upload**. A minimum overlay applies to non-default backgrounds for readability.
3. **Layout:** under **Personalize → Layout**, select Workspace. Drag sections and widgets by their rows, and try the up/down keyboard buttons instead. Set a widget to Wide, adjust alignment and spacing, then reload. Confirm existing note text survives reordering. Test **Restore default layout**.
4. **Profiles:** under **Profiles**, apply Work, Study and Personal. Save the current look to an existing profile or create a named one, switch away and apply it again after reload. Profile changes are snapshots: edits do not automatically update a profile. Notes, tasks, shortcuts and the single uploaded wallpaper are shared, not profile-specific.
5. **Transfer:** export under **Transfer**, change your look, then import the file and confirm it restores the exported customization. Try invalid, unsupported-version and larger-than-128-KB JSON files; they must leave settings unchanged. Exports exclude notes, tasks, shortcuts, your name, saved profiles and wallpaper image bytes. An uploaded wallpaper must be supplied separately on another device.
6. **Regression and profiling:** test Day 3 clock, search, shortcuts, notes, tasks and focus timer; try all themes and layouts. Check keyboard navigation, reduced motion and narrow screens. Inspect the Chrome DevTools Console/Network and profile CPU and memory; no performance guarantee is implied by bundle size.

A reusable engineering prompt for this phase is in `docs/DAY_04_PROMPT.md`.

## Day 3 testing checklist

1. **Clock:** under Personalize → General, set a name, try 12/24-hour time and turn seconds on and off. Check the local date and greeting. Under Layout, hide and restore the clock.
2. **Shortcuts:** in Quick Access add a shortcut with a valid URL, optional text icon and category. Test editing, moving using arrow controls, filtering by category and deleting. Check that invalid URLs are rejected and that removing every shortcut remains empty after reload. Site favicons are **opt-in** and contact the selected site's `/favicon.ico`; if unavailable, a fallback appears.
3. **Widgets:** open Personalize → Layout and select **Workspace**. Toggle Notes, Tasks and Focus, move them with the up/down controls, close settings and reload. Check their order and visibility persist. Restore the default layout without deleting productivity data.
4. **Notes:** create multiple notes, edit titles and content, pin one, search, unpin and delete. Pause after typing for autosave, reload and restart Chrome. Existing Day 2 quick notes should still appear.
5. **Tasks:** add and edit tasks with priority and optional due date, complete one, switch All/Pending/Completed filters, delete one and check the completed count. Reload and restart Chrome to check persistence.
6. **Focus:** select Focus, Short break and Long break; change a duration (1–180 minutes), start, pause, resume and reset. For completion, set a 1-minute session, start it, close the new tab, wait over a minute, and open another NOVA tab with Focus visible. The completed message and focus count should update. There is no notification or background timer; completion is reconciled when the widget is next opened/visible.
7. **Regression:** test search, `/` and Ctrl/Cmd+K, all four themes, wallpapers and the Focus/Workspace/Immersive layouts. Test keyboard navigation, reduced-motion settings and narrow windows. Inspect DevTools Console and Network; site favicons only make requests when explicitly enabled. Profile CPU, memory and animations on target hardware.

Settings reset affects preferences only; it does not erase notes, tasks, shortcuts, timer state or the wallpaper Blob. Uploaded wallpaper can be removed separately under Backgrounds. The bundled wallpapers are local illustrations. Unsaved asynchronous writes can fail if the browser closes immediately or storage is unavailable; wait briefly after editing before closing.
