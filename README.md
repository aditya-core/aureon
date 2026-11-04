# NOVA

A local-first Chrome New Tab extension. Day 5 adds opt-in website controls to the existing New Tab Personalisation Studio and productivity workspace. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for verification and limitations.

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

The new-tab entry loads the settings shell only when Personalize is opened. Advanced Studio, layout controls, profiles and transfer load when their respective sections are selected; workspace widgets load when one is visible. Wallpaper IndexedDB is opened only when an uploaded background is selected or settings needs the saved image. The MV3 service worker is event-driven, with no polling; website scripts run only on explicit current-tab action or a separately granted site. The build-manifest package test checks the chunk boundaries; it is not a substitute for measuring CPU, memory or startup in Chrome.

## Load or update in Chrome

1. Run `npm install` if dependencies changed, then `npm run build` in this project folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. For a first install choose **Load unpacked**, then select this project's `dist` folder. If already installed, click NOVA's **reload** button after rebuilding.
4. Open a fresh new tab. If Chrome asks you to keep the new-tab change, confirm it.

## Day 5 — NOVA Web

Open a normal HTTP(S) page and click the NOVA extension icon (pin it from Chrome’s Extensions menu if necessary). The popup controls the **current origin**. Turn on Dark mode or Typography, edit their settings and turn **NOVA on this site** off to restore the page. Use **Apply saved styling to this tab** after navigation when automatic access is off.

**Reader:** click Open / exit on a suitable article, then adjust theme, system font, size, line height and width in the reader toolbar. Escape or Exit reader restores the original page. The reader extracts a sanitized text-only view from an `article`, `main` or main role; it omits media and forms and may not work on every page. Nothing is uploaded.

**Distractions:** click Select, hover to preview and click a non-essential element, or press Escape. NOVA asks before hiding a container with interactive controls. Reopen the popup → Rules to disable or undo individual rules; the distraction toggle disables all rules without deleting them. Rules are selectors and may stop matching when a site changes. The picker requires a pointer to select elements (Escape cancels) and operates in the top document, not inside cross-origin frames or shadow roots.

### Permissions and privacy

- `storage` stores preferences locally. `activeTab` provides temporary access after clicking the extension; `scripting` applies bundled scripts/CSS to that tab.
- Optional HTTP(S) host patterns are declared so Chrome can prompt later, but **no host is granted by default**. Enable **Apply automatically on this site** to request access to the selected scheme and host; accept or deny Chrome’s prompt. Chrome host patterns cover all ports of that host, even though profiles are keyed by origin. To avoid silently widening a non-default port, automatic access is unavailable for custom-port origins; temporary current-tab access remains available.
- Turning off automatic access unregisters the site script and requests permission removal. Already-applied current-tab styling remains until NOVA is disabled or the tab navigates. Resetting the site revokes automatic access and restores its styling.
- NOVA stores selected origins, settings and user-selected selectors, not full URLs, article text or a browsing history. Those origin/selector records can still reveal which sites you customized. No page contents are transmitted to NOVA servers; there are no such servers in this implementation.
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
