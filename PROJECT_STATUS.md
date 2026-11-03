# Project status

## Current phase
Day 2 — adaptive visual experience implemented; awaiting Chrome testing and user confirmation before Day 3. The user gave the go-ahead to proceed from Day 1. This environment has not independently verified the unpacked extension in Chrome.

## Completed
- MV3 new-tab override, Vite/React 19/strict TypeScript entry and idle service worker; only `storage` permission.
- Clock, date, greeting, search with URL detection, keyboard search focus and four sample shortcuts.
- Central theme definitions and CSS tokens for Midnight, Dawn, Aurora and Custom, with custom accent and surface style. Preferences load before rendering the dashboard to avoid showing the wrong theme.
- Solid background, two gradient presets, two bundled SVG illustration wallpapers and one local upload (JPEG, PNG, WebP or AVIF, maximum 4 MB). IndexedDB stores the Blob separately from preferences. Remove and replace are supported.
- Overlay, brightness and blur controls; non-default backgrounds apply a minimum protective overlay for readability. No continuous background animation.
- Focus, Workspace and Immersive presets; section visibility, spacing, keyboard-accessible sample shortcut ordering and layout reset. Workspace includes simple locally saved note and task widgets.
- Lazy-loaded settings panel with themes, backgrounds, layout, motion and general controls; immediate preview, debounced ordered preference writes, save status, reset and basic keyboard/focus handling.
- Off, Subtle, Standard and Expressive motion settings and OS reduced-motion support. Clock pauses its timer while the page is hidden.
- Unit tests cover search, preference persistence with a mocked API, old-setting migration, theme/background tokens and wallpaper validation. Package tests verify MV3 output, minimal permissions and bundled assets.

## Build verification
- `npm test`: 11 tests passed, including a static settings render.
- `npm run build`: passed. Initial JS 247.02 KB / 77.53 KB gzip; lazy settings JS 13.25 KB / 3.91 KB gzip; CSS 24.97 KB / 6.13 KB gzip (Vite output).
- `npm run test:package`: 3 tests passed. `npm audit`: 0 reported vulnerabilities.
- A headless Chromium smoke-test attempt failed to launch due to missing system NSS libraries. It produced no browser test results. Chrome extension behavior, IndexedDB upload rendering, browser restart, accessibility, CPU and memory remain to be verified in a real Chrome installation.

## Architecture decisions
- Theme configuration is in `src/config/themes.ts`; `src/lib/theme-engine.ts` translates settings into CSS variables. Styles and visual previews use local assets only.
- Preferences and small lists use `chrome.storage.local`; development preview falls back to `localStorage`. Wallpaper bytes use IndexedDB in the same origin, with object URLs revoked after use. Extension and preview data are separate.
- Preference updates are debounced and serialized; no persistent background worker activity. Reset affects preferences only, not notes, tasks or the saved wallpaper.
- CSS transitions and finite entrance animations only; no animation library, remote imagery or broad host permissions.

## Known limitations / pending
- Browser and DevTools tests in README still need execution: theme restoration after Chrome restart, real extension storage, image uploads, focus behavior, reduced motion, CPU/memory and unexpected network requests. The headless browser attempt could not run.
- Shortcut creation, editing, deletion and user-supplied icons are not implemented; current starter links can only be reordered or hidden. Notes and tasks are deliberately basic; list item validation/migrations need work before expanding them.
- Widgets can be shown/hidden but not independently repositioned; only shortcut order and layout presets are configurable.
- The bundled wallpapers are lightweight vector illustrations, not photographic assets. The color/gradient changes are immediate; cross-fading between background images and modal close animations are not implemented.
- A minimum overlay is applied to non-default backgrounds to reduce contrast problems, so the effective overlay can be stronger than the slider value. Arbitrary uploaded images and custom accent choices still need real-device contrast testing.
- IndexedDB storage and debounced writes can fail due to quota, profile restrictions or a browser shutdown before pending asynchronous writes complete. Errors are surfaced when detected; do not assume durability until the save indicator appears.
- Multiple open new tabs do not live-synchronize settings changes; reopen or reload to pick up another tab's changes.
- Website customization, AI, monetisation and the remaining productivity features are later phases.

## Next steps
1. Load `dist` in Chrome and follow the Day 2 checklist in README, including restart and upload testing.
2. Inspect console/network, profile CPU/memory, and verify keyboard and reduced-motion behavior on target hardware.
3. Fix any issues found, then wait for confirmation before Day 3.
