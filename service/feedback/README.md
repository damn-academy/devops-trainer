# Learner feedback service

A single Go binary with SQLite by default and optional Postgres. No container is required for local development.

```sh
cd service/feedback
GOFLAGS=-p=2 go test ./...
GOFLAGS=-p=2 go build -o /tmp/dt-feedback .
ADMIN_TOKEN='choose-a-long-random-value' ALLOWED_ORIGINS=http://localhost:6100 /tmp/dt-feedback
```

The service listens on `127.0.0.1:6101`. Open `/admin` using HTTP Basic username `token` and your `ADMIN_TOKEN` as the password. Alternatively configure `ADMIN_USER` and `ADMIN_PASSWORD`. Scripts can use `Authorization: Bearer $ADMIN_TOKEN`. Tokens in URLs are deliberately unsupported. Use HTTPS outside localhost.

Build the course with `VITE_FEEDBACK_URL=https://feedback.example/api/feedback`. Vite development has a local JSONL receiver by default; to test the real service, set `VITE_FEEDBACK_URL=http://localhost:6101/api/feedback` when starting Vite. Never put admin, GitHub or Telegram tokens in `VITE_*` variables.

## Configuration

| Variable | Meaning |
|---|---|
| `ADDR` | Bind address, default `127.0.0.1:6101` |
| `DATABASE_URL` | SQLite filename (default `feedback.sqlite`) or `postgres://...` DSN |
| `ALLOWED_ORIGINS` | Comma-separated exact course origins; no wildcard |
| `ADMIN_TOKEN` | Admin bearer token; also Basic password for username `token` |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Alternative Basic credentials |
| `GITHUB_REPO`, `GITHUB_TOKEN` | Enable issue notices only when both are set; fine-grained issue-write token |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Enable Telegram notices only when both are set |

`POST /api/feedback` accepts `dt.feedback/v1` JSON, optionally gzip. Both compressed and decompressed bodies are capped at 256 KiB. The honeypot `website` must be empty. Twenty attempts per IP per hour are allowed, with bounded in-memory buckets. The socket peer is used; forwarded headers are not trusted. At an ingress, add a client-IP rate limit there; otherwise clients share the proxy's bucket. Rate limits are per process and reset on restart. CORS rejects unconfigured browser origins. The report ID is an idempotency key; retrying never creates a second row or notice.

Admin filters: `block`, `lesson`, `category`, `status`, `from`, `to` (ISO dates, UTC). Statuses: `new`, `triaged`, `fixed`, `wontfix`, `duplicate`. The dedup hint groups the same location/category without deleting or merging reports. Tags are free text; notes append with timestamps. Forms use a CSRF token and HTML escapes all report content. `/admin/export` exports the filtered set as JSON; add `format=jsonl` for JSONL. Each item includes the report, status, tags, notes, receipt time and dedup hint.

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://127.0.0.1:6101/admin/export?block=linux&status=new&format=jsonl' > linux-feedback.jsonl
```

Optional forwarding sends only report ID, category and lesson, not message/contact/dumps. Delivery is best-effort, with a ten-second timeout and no retry; the database is authoritative. Failures are logged without credentials. Both integrations are off by default.

## Operations and privacy

Apply the provided Dockerfile/Kubernetes example only after choosing hosting, registry, TLS, storage and credentials. SQLite requires one replica and persistent writable `/data`; use Postgres for shared storage. Back up SQLite using its online backup API or stop the service and copy the database together with WAL files. Postgres uses ordinary database backup tooling. Configure retention and deletion according to the owner's policy; this service does not automatically delete reports. Anyone with admin access can read contact details and attachments. The browser applies masking and previews the exact payload; server-side clients are responsible for sanitizing their own submissions.

`/healthz` checks database connectivity. SIGINT/SIGTERM gracefully stop the HTTP server. No environment images, containers or VMs need to run to test this service.

## Threads, contacts and notifications

New tables are created automatically alongside existing feedback; old reports remain
available to administrators. New clients send `type: report|contact` and a cryptographically
random 64-hex-character `followToken`. Only its SHA-256 hash is stored by the service;
the payload, admin exports and forwarding notices never contain the capability.

`GET /api/feedback/{id}?token=...` returns only the authorized thread's public status,
fixed build/date and replies (never attachments, contact details or private admin notes).
POST to the same URL adds `{"id":"unique-reply-id","message":"..."}` idempotently.
Merged reports inherit the main thread status and author replies. Learner replies remain
private to their original author. Merges reject cycles and mixing contacts with reports.
Both read and write requests have IP rate limits; do not log query strings or request
bodies at your reverse proxy, particularly for this route. The application emits no
request access log. HTTPS is required in production.

Admin lists separate course reports and contact messages. The reply form supports
plain text, **bold**, and inline code on the learner page. Set `BUILD_ID` to the release
identifier to prefill the optional fixed-build field. The fixed date is recorded when
the administrator marks the report fixed.

Optional public hints: set `PUBLIC_HINTS=1`. GET /api/feedback/hint with the place keys
(route, section, task, quiz, examCard, explainer, step) returns only an open-report flag
and an aggregate count. POST increments that count without storing personal data.
Counters are rate limited; they are approximate, not unique-person statistics.

Optional notifications are sent only when the administrator selects «Уведомить».
For email set `SMTP_ADDR=host:port`, `SMTP_FROM`, and optionally `SMTP_USER` /
`SMTP_PASSWORD`. STARTTLS with certificate validation is mandatory.
For Telegram set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CONTACTS` to a JSON object such as
`{"@learner":"123456789"}`. Users must start the bot first; Telegram does not allow a
bot to initiate a private conversation using only a username. This contact mapping is
distinct from `TELEGRAM_CHAT_ID`, which receives admin notices about new reports.
Notification delivery is best effort; a failure never discards the stored reply and is
logged without the address, message, bot credential or follow token.
