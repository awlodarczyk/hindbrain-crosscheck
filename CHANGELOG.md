# Changelog

## Unreleased

### Added

- Transcript mode: import a chat transcript (paste or load a .txt/.md/.json file) with an optional focus question; both models challenge the conversation, verify the assistant's claims and review each other's analysis. Transcripts are included in search and export.
- Export parsers: ChatGPT (`conversations.json`, shared-link `mapping`) and Claude (`chat_messages`) JSON are converted to `User:` / `Assistant:` turns on paste, file load and on the server.
- Follow-up focus question from a transcript session, creating a new session on the same transcript.
- Transcript viewer on the session page with labelled turns, plus a "Transcript" badge in the header and history sidebar.

## 1.0.0 — 2026-10-13

First release. Rebuild of the FactCheck Duo 2.0 prototype as a single Next.js app.

### Added

- Sessions history: SQLite storage, full-text search, soft delete with restore, sidebar and search palette.
- Two-model cross-check: Claude and ChatGPT answer with web search, each reviews the other's answer claim by claim with sources; pasted answers; rerun and retry.
- Transports: Anthropic and OpenAI APIs, Claude Code CLI and Codex CLI, plus a mock transport.
- Live session view over server-sent events with running and error states.
- Settings: General (API keys), Models, Verification, Appearance, Data (deleted sessions, export).
- Markdown report, versioned JSON export and import.
- Hosted mode: login with argon2 passwords and server sessions, risk-weighted rate limits (Valkey), optional admin bootstrap env.
- Mobile layouts and dark theme.
- Docker image, Dokploy compose with Valkey and a data volume.

### Fixed

- Search now indexes answer text after every run, not only the question.
- Re-running a paste session (manual or on disagreement) reuses its pasted answers; without any it answers 409 `not_rerunnable`.
- Claude CLI runs in an empty temp directory with only WebSearch and WebFetch allowed; hosted mode now requires `CLI_ENABLED=0`.
- History paging uses a `(createdAt, id)` cursor, so sessions sharing a timestamp are no longer skipped.
- Added Import JSON in Settings and Export Markdown on the session page.
- The post-login redirect rejects every target outside the app origin.

### Security

- CSP nonces, CSRF checks, security headers and session cookie renewal.
- Encrypted provider secrets with rotation, log scrubbing, streaming body cap, untrusted-markdown rendering.
- Dedicated security test suite.

### Docs

- Context, architecture, API, design notes, ADRs, contributing guide, security policy, release checklist and README with local run and Dokploy deployment.

### Removed

- The `factcheck-duo/` prototype.
