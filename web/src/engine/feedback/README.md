# Learner feedback

Production: set `VITE_FEEDBACK_URL=https://feedback.example/api/feedback` at build time. The build embeds the current Git commit. No endpoint means reports remain in the local queue; configure an endpoint before shipping.

Vite development uses `/api/feedback` and appends reports to `web/.feedback/reports.jsonl`. The receiver exists only in the development server. No read endpoint is exposed. Delete the file after testing if it contains personal data.

The submitted JSON is the sanitized preview. Reports are persisted in IndexedDB only on Send; retries preserve the report ID and exact body. Network failures and 429/5xx use bounded exponential backoff. Other 4xx responses retain the report without automatic retries. Browser storage failure leaves the form open. Pending uploads resume while the app is open, including after reload; closing the browser pauses retries.

Snapshots are registered by live components and released on disposal. Simulator snapshots contain changed/deleted inodes relative to setup and snapshotable extension state (kube-lite, sim-net, dsim). v86 reports contain the last successfully collected facts, console tail and command records, never RAM or disks. Feedback does not execute guest commands. Widget facts use the existing `reportFacts` callback, including cloud facts where exposed by the widget. A two-second timeout records an unavailable snapshot instead of blocking the form. Completed commands are retained in the terminal event buffer; an uncompleted v86 command is also visible in its console tail when the machine responds.

All strings pass through the existing `maskSecrets`; credential-named object fields are suppressed. Automatic masking is heuristic: the learner must review the preview, especially free-form output or file contents. No localStorage, AI credential store, cookies, or whole progress database is collected. The 256 KiB cap removes oversized attachments with explicit omission markers, then rejects an oversized core report. Payloads use gzip where CompressionStream is available.

## Follow-up and contact (second pass)

For the full development workflow run the Go receiver and start Vite with
`FEEDBACK_SERVICE_URL=http://127.0.0.1:6111`. Vite proxies all feedback API routes.
The old JSONL fallback is write-only and removes follow tokens; it cannot provide replies.

The compact form focuses the message, uses optional category chips and folds automatic
context/terminal attachments into a details element. Ctrl/Cmd+Enter submits. Contact
forms in Settings and the footer send `type: contact`; `VITE_AUTHOR_EMAIL` optionally
adds a mailto link. Reports may include a contact through the collapsed details.

Each new client report has a random 256-bit follow capability, retained in IndexedDB
separately from the outgoing queue. Progress export/import includes these capabilities.
Keep exported progress files private. The messages page checks threads on entry;
background checks occur at most once per day per thread, including failed attempts.
Cached replies remain readable offline. Replies retry with the same id while the form
is open. A failed reply remains in the form and must be retried; it is not silently queued.

Follow-up tests use the real receiver:
```sh
FEEDBACK_SERVICE_URL=http://127.0.0.1:6111 E2E_PORT=6110 npx playwright test
```
Set `FEEDBACK_ADMIN_TOKEN` to the receiver's admin token (test default:
`feedback2-test-token`). Run one Playwright worker. Set `FEEDBACK_SCREENSHOTS` to
write form.png, messages.png and contact.png. No VM is required.
