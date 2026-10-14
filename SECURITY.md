# Security policy

## Reporting a vulnerability

Please report privately through GitHub: Security tab, "Report a vulnerability" (private
vulnerability reporting). Do not open a public issue or pull request for a vulnerability.
If that is unavailable, email adam.wlodarczk@gmail.com with "hindbrain crosscheck security"
in the subject.

Include the affected version or commit, steps to reproduce, and the impact. Do not include
real API keys or other people's data.

## Supported versions

Only `main` is supported. Fixes land on `main`; there are no backports.

## What to expect

You will get an acknowledgement within 7 days and a status update within 30 days. We will
credit you in the fix unless you prefer otherwise. This is a volunteer-run open source
project, so these are targets, not guarantees.

## Scope

Auth and sessions, rate limiting, CSRF/CSP, Markdown sanitising, provider key storage and
anything that exposes data across users. The security model is described in the README; the suite is `pnpm test:security`.
