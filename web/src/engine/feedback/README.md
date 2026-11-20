# Learner feedback

Production: set `VITE_FEEDBACK_URL=https://feedback.example/api/feedback` at build time. The build embeds the current Git commit. No endpoint means reports remain in the local queue; configure an endpoint before shipping.

Vite development uses `/api/feedback` and appends reports to `web/.feedback/reports.jsonl`. The receiver exists only in the development server. No read endpoint is exposed. Delete the file after testing if it contains personal data.

The submitted JSON is the sanitized preview. Reports are persisted in IndexedDB only on Send; retries preserve the report ID and exact body. Network failures and 429/5xx use bounded exponential backoff. Other 4xx responses retain the report without automatic retries. Browser storage failure leaves the form open. Pending uploads resume while the app is open, including after reload; closing the browser pauses retries.

Snapshots are registered by live components and released on disposal. Simulator snapshots contain changed/deleted inodes relative to setup and snapshotable extension state (kube-lite, sim-net, dsim). v86 reports contain the last successfully collected facts, console tail and command records, never RAM or disks. Feedback does not execute guest commands. Widget facts use the existing `reportFacts` callback, including cloud facts where exposed by the widget. A two-second timeout records an unavailable snapshot instead of blocking the form. Completed commands are retained in the terminal event buffer; an uncompleted v86 command is also visible in its console tail when the machine responds.

All strings pass through the existing `maskSecrets`; credential-named object fields are suppressed. Automatic masking is heuristic: the learner must review the preview, especially free-form output or file contents. No localStorage, AI credential store, cookies, or whole progress database is collected. The 256 KiB cap removes oversized attachments with explicit omission markers, then rejects an oversized core report. Payloads use gzip where CompressionStream is available.
