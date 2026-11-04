# NOVA — Day 05: Website Transformation Engine

Continue the existing Manifest V3 React/TypeScript/Vite extension; do not replace the New Tab application. Audit `PROJECT_STATUS.md`, the manifest, service worker, storage, theme and settings first, run the existing checks, and disclose unresolved browser-level risks.

Build **NOVA Web** as small modules: a compact popup for the current site; reversible, best-effort dark colors and system-font typography; an on-demand sanitized article reader; an explicitly activated element picker with reversible per-site rules; and independently enabled per-origin profiles. Preserve existing features and site functionality. Do not claim universal website compatibility.

Prefer CSS for styling; do not invert media. Do not use remote code, remote fonts, continuous polling, general mutation observers, repeated full-page scans or automatic website modifications by default. Load the reader and picker only on request. Keep article contents on the device and never execute extracted HTML. Restrict selectors and protect essential controls.

Use `activeTab` and `scripting` for explicit current-tab actions. Declare optional host patterns only as needed and request the selected site’s permission only when the user enables persistence; explain the permission, denial, revocation and Chrome match-pattern limitations. Do not inject into protected browser pages. Avoid storing page contents, full URLs or browsing history.

Validate stored values and surface loading, permission and storage failures. Test functionality, cleanup, malformed input, permission denial, restricted pages and regressions. Run the TypeScript/build, unit/component tests, package/manifest checks and dependency audit. Distinguish mocked tests from an actual Chrome extension. Manually test static article, documentation, news, JavaScript-heavy, media and form sites; inspect the console, network and DevTools performance/memory, or explicitly report if unavailable. Update `PROJECT_STATUS.md` and README with results, permissions and limitations; stop after Day 5 and ask for confirmation before Day 6.
