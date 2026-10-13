export type CspOptions = { mode: "local" | "hosted"; dev: boolean };

/** 16 random bytes, base64-encoded; safe in the Edge runtime. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** Content-Security-Policy for one response; scripts run only with the nonce (and what it loads). */
export function buildCsp(nonce: string, { mode, dev }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ];
  if (mode === "hosted") directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
