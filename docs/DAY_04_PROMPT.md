# NOVA — Day 04: Personalisation Studio

## Role and workflow
Continue the existing NOVA Chrome Manifest V3 extension as a senior product engineer and UI/UX designer. Do not create a new project or remove working features. Inspect the repository, current status, manifest, storage models, theme engine, dashboard, settings, tests and build before editing. Explain the audit and implementation plan. Work in focused modules, verify each step, update `PROJECT_STATUS.md`, report actual results, and stop for user confirmation before Day 5.

## Objective
Make NOVA feel personal, premium and effortless: users should be able to create visually distinct environments without sacrificing readability, accessibility, privacy or performance. Use the supplied reference as inspiration, not a mandate to copy it.

## Scope
1. **Theme editor:** edit accent, background, text and surface colors, gradient colors and angle, border and shadow intensity, with live preview. Reuse the existing token-based theme system. Provide a clear contrast warning and keep settings usable even with poor user-selected colors.
2. **Wallpaper studio:** reuse local presets and uploaded wallpaper. Add image positioning, brightness, overlay, blur and restore/remove controls. Bound file size, keep images separate from frequently read preferences, avoid remote image servers and clean up object URLs.
3. **Layout studio:** preserve existing presets and productivity features. Support section and widget reordering, supported widget widths, spacing, alignment, persistence and reset. If native drag-and-drop is used, provide equivalent keyboard buttons and usable focus states.
4. **Environment profiles:** provide Work, Study and Personal starting points plus user-created profiles. Make saving, applying, replacing and deleting explicit. Document precisely which settings are snapshots, whether profile edits auto-save, and whether notes, tasks, shortcuts and wallpapers are shared.
5. **Import/export:** export customization as a small versioned JSON document. Validate all imported fields and limits before applying anything; reject malformed, unknown or unsafe values. Clearly explain excluded data and confirm before replacing current customization. Do not include notes, tasks, shortcuts, personal names, credentials or image bytes unless separately and explicitly designed for it.

## Engineering constraints
- Keep Manifest V3, Chrome Storage and the existing architecture. No broad host permissions, remote executable code, continuous background work, or unnecessary dependencies.
- Preserve existing stored data and migrate missing settings with safe defaults. Avoid large images in settings. Debounce writes and surface storage errors.
- Use strict TypeScript, CSS variables, native CSS motion and reduced-motion support. Avoid continuous animation and large backdrop effects. Settings should be responsive and keyboard accessible.
- Do not claim exact memory usage, universal contrast or browser compatibility without testing. Disclose cross-tab races, quota limitations and any unsupported behavior.

## Verification and delivery
Run TypeScript, unit/component tests, production build, package/manifest checks and dependency audit. Test theme persistence, layout ordering and keyboard controls, profile save/apply/reset, wallpaper handling, valid/invalid/oversized imports, and regression of clock/search/notes/tasks/focus. Report exact bundle sizes. Distinguish mocked or DOM tests from real Chrome installation, reload/restart, accessibility, network and DevTools CPU/memory profiling. Provide an actionable manual checklist and list known issues. Do not proceed to Day 5 without confirmation.
