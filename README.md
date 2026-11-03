# NOVA

A local-first Chrome New Tab extension. Day 2 adds adaptive themes, backgrounds and layout controls on top of the Day 1 foundation. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for current verification and limitations.

## Development

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm test
npm run build
npm run test:package
npm run dev
```

The packaging check requires a build and verifies the manifest, local assets and permissions; it does not replace a Chrome installation test. The Vite preview uses localStorage for preferences and IndexedDB for wallpapers. Its data is separate from an installed extension's data. Search and links navigate the current tab; no remote fonts, wallpapers or search suggestions are requested.

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select this project's `dist` directory, then open a new tab. If Chrome asks you to confirm the new-tab change, keep it.
4. After rebuilding, reload NOVA on `chrome://extensions` and open a fresh tab.

## Day 2 testing checklist

1. Open **Personalize → Themes**. Select Midnight, Dawn, Aurora and Custom; each should update immediately without a reload. Change the custom accent and surface style. Wait for “Changes saved locally,” reload, and confirm the chosen theme remains. Restart Chrome and check again.
2. Under **Backgrounds**, try theme default, solid color, both gradients and both bundled illustrated wallpapers. Change overlay, brightness and blur. For readability, non-default backgrounds apply a minimum protective overlay; the slider cannot remove that minimum. Upload a JPEG, PNG, WebP or AVIF under 4 MB, reload and restart Chrome, and check it remains. Try an unsupported or oversized file and verify an error. Select another background, choose **Use uploaded wallpaper**, then **Remove upload**.
3. Under **Layout**, select Focus, Workspace and Immersive. Hide and restore clock, shortcuts, notes and tasks, and change spacing. Reorder sample shortcuts using the up/down buttons, close settings, and check the order. Reload and confirm the layout remains. Use **Restore default layout** and check the result.
4. In Workspace, type a quick note, add a task, mark it done and delete it. Wait briefly for the note to save, reload and confirm retained data. These are simple local widgets, not the planned full notes and task features.
5. Under **Motion**, try Off, Subtle, Standard and Expressive. Enable the operating system's reduced-motion setting and verify it overrides animation. Check keyboard navigation, Escape to close settings, focus returning to the trigger, and the responsive layout at narrow sizes.
6. Under **General**, change clock format, search engine and greeting. Test search and `/` or Ctrl/Cmd+K. Reset preferences and verify defaults return; notes, tasks and the uploaded wallpaper are retained unless removed separately.
7. Check DevTools Console for errors and the Network panel for unexpected requests before navigating. In `chrome://extensions`, check permissions and reload the extension. The service worker may be inactive because it has no background tasks. Profile CPU, memory and animation performance in Chrome on your target hardware; no performance guarantee is implied by bundle size.

Settings use `chrome.storage.local` in the extension, with debounced, ordered writes. The uploaded image is stored as a separate IndexedDB Blob, not in the preferences object. Only one upload is kept; selecting a replacement overwrites it. Wallpaper data is local and can be removed in settings. Settings reset does not erase notes, tasks or the wallpaper Blob.
