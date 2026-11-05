# Day 9 — NOVA Automations

## Getting started

1. Run `npm ci` and `npm run build`, then reload the unpacked `dist` extension in Chrome. Review the added alarms permission if Chrome prompts. Open a normal (non-private) window.
2. On a new tab choose **Explore NOVA → Automations**, or open the NOVA toolbar popup on a normal webpage and choose **Automations**. The latter captures a source tab for the manual **Save source page** action; the dashboard displays the source and checks it again at run time.
3. Choose **Create workflow** or an optional template. Set a name, trigger and timeout; add, configure, enable/disable and reorder up to 30 actions. Preview, then save or save and test. Templates are independent editable copies, not installed automatically.
4. Manual runs do not require the automatic-trigger switch. For startup, schedule or shortcut, explicitly enable the workflow. A daily schedule uses the browser's local time. Startup is deferred using an alarm for at least 30 seconds to give Chrome time to open a normal window. Browser alarms can fire late, especially while the browser or computer is asleep.
5. Assign the suggested Ctrl+Shift+Y (Command+Shift+Y on macOS), or change it at `chrome://extensions/shortcuts`. Only one enabled shortcut workflow is allowed. Chrome may reserve or override shortcuts.
6. To use notifications, click **Enable notifications** and accept Chrome's optional permission prompt. Declining permission makes notification actions fail visibly; no permission is requested for workflows that don't need it.

## Actions and privacy

The fixed allowlist supports open HTTP(S) URL, restore a saved Command Centre session, apply a theme or layout, start the existing focus timer, create an existing NOVA note, save a source page to Research, display a notification, wait and ask for confirmation. Two additional actions create a Research collection (unless its name already exists) and open the existing Research workspace.

- URLs are validated and cannot contain credentials or use internal/script schemes. No user-supplied JavaScript, form submissions, payments, purchases or account changes are executed.
- Restores use the existing session service and skip already-open URLs. A workspace with more than 10 tabs requires an **Ask for confirmation** step immediately before it. Group creation and tab opening can partially succeed; failed runs show the failure and should be reviewed before retrying.
- A source-page action is allowed only in a manual workflow, when launched from the popup on the intended page. NOVA checks the tab, URL and sensitive/private-page heuristics before storing its metadata in Research. It does not extract page text. Sensitive-page detection is best effort; do not save sensitive URLs, and remember queries can contain secrets.
- Confirmation actions suspend the workflow until the user opens Automations and approves or cancels. An approval applies only to the next enabled action. If the deadline expires while waiting, the workflow fails.
- Local workflow definitions can contain URLs, note text, and notification/confirmation messages. They and the bounded history are stored in extension local storage, are not encrypted or automatically backed up, and may be lost on extension removal. History omits action configurations but can contain error messages. Do not put secrets in workflows.

## Architecture and operational guarantees

- `automations.html` and `src/automation/Dashboard.tsx` provide the themed entry point. `WorkflowEditor.tsx` is lazy-loaded. `model.ts` holds the fixed action metadata and validator; `actions.ts` invokes existing NOVA services; `engine.ts` persists the single active execution, workflow snapshots and up to 100 history entries. The Vite build bundles `worker.ts` as `automation-worker.js`, which imports the existing Day 5 `background.js` worker before registering its own listeners.
- The worker uses event listeners, not polling. `chrome.alarms` handles schedules, startup deferral and durable waits. Schedules are rebuilt if missing on worker activation; daily alarms are scheduled one occurrence at a time to account for local calendar changes. An OS timezone change while an alarm is already pending may not be reflected until it next fires or is reconfigured.
- At most one workflow runs or waits globally. A manual second run is rejected; an overlapping startup/scheduled/shortcut run is recorded as failed rather than queued. Up to 50 workflows are supported. Workflows are validated before saving and running.
- An execution snapshots the workflow. Every completed action advances persisted progress. After worker restart, an in-flight action is marked failed rather than replayed because its side effects are unknown. Waits and pending approvals remain durable; alarms are repaired when the worker next starts. A queued pause takes effect after the current action, while a wait can be paused immediately.
- Action calls have a 25-second maximum and are also bounded by the workflow deadline (30–7,200 seconds, including pauses and confirmation). Browser API calls cannot necessarily be cancelled once sent. Cancelling, timing out, or worker termination does not roll back effects; a timed-out action may still complete. Retrying starts from the beginning and asks the user to review earlier effects.
- Existing note and preference persistence is last-writer-wins across extension pages. An automation and a simultaneous edit in another tab can overwrite each other; finish edits before running workflows that change notes or appearance. Research and session operations retain the limitations documented for Days 6–8. There is no cross-device sync.
- `alarms` is a new mandatory permission; `notifications` is optional. Existing `tabs`, `storage`, and other Days 1–8 permissions remain. The worker accepts dashboard control messages only from this extension's Automations page in a normal window. It does not add host permissions or background website monitoring.

## Automated checks

130 JavaScript tests passed, including DOM and mocked Chrome tests for workflows and existing features. The production build and six package checks passed; npm audit reported zero vulnerabilities. Six Django tests with a fake provider and Django system checks passed. These are not installed-Chrome, live-provider or real-device accessibility tests.

## Manual Chrome verification — not performed in this environment

1. Rebuild/reload and review permissions. Check the dashboard, popup, templates, all action forms, keyboard reordering, preview, disabled actions, editing, duplicate/delete, 50-workflow/30-action limits and error messages. Confirm existing Days 1–8, especially website controls and the Assistant, still work.
2. Create a mixed manual workflow and observe order, progress, pause/resume, wait, confirmation, cancel, failure and history, including clear and retry. Verify a large workspace is blocked without confirmation and opens only after approval. Check partial restore failure and no silent continuation.
3. Configure a daily alarm and startup trigger (both initially off), restart Chrome, sleep/wake and change timezone; inspect alarm lateness and saved schedules. Enable and rebind the shortcut, including conflicts. Test overlapping triggers and no normal windows. These behaviors depend on Chrome and have not been verified here.
4. Grant/deny/revoke notification permission, test source page navigation/closure/private/protected pages, and inspect stored data and network requests with non-sensitive test data. Verify no webpage content is extracted by source-page saving.
5. Force a service-worker stop mid-action and during a wait/confirmation; check conservative failure versus durable wake, cancellation and timeout. Test multiple dashboard tabs, save failures, quota errors and extension restart. Verify keyboard focus, screen readers, narrow windows, themes, performance and actual power use.
