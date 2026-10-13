# Security suite

Run with `pnpm test:security` (also part of the normal `pnpm test`).

| Test                                             | Protects against                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `no-secrets-in-logs.test.ts`                     | API keys, bearer tokens, cookies and passwords reaching pino output, and provider keys echoed into stored or emitted call errors |
| `xss-model-output.test.ts`                       | Script, event handler, `javascript:`/`data:` link and style injection through rendered model Markdown                            |
| `components/session/claim-row.security.test.tsx` | Hostile claim notes and non-http source URLs in the UI                                                                           |
| `sql-injection.test.ts`                          | Injection through search and rename; schema and FTS index stay intact                                                            |
| `authz-isolation.test.ts`                        | One user reading or mutating another user's sessions on every per-session route                                                  |
| `headers.test.ts`                                | Every API route sets `nosniff`, `no-store` and `x-request-id`                                                                    |
| `body-cap.test.ts`                               | Oversized chunked bodies are cut off with 413 without full buffering                                                             |
| `tests/integration/secrets-rotate.test.ts`       | Transactional re-encryption in `pnpm secrets:rotate --old <secret> --new <secret>`                                               |
