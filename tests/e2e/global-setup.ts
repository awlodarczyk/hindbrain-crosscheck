const WARM = [
  {
    base: "http://127.0.0.1:4173",
    paths: [
      "/",
      "/settings",
      "/settings/models",
      "/settings/verification",
      "/settings/appearance",
      "/settings/data",
      "/api/settings",
      "/api/sessions",
      "/api/health",
    ],
  },
  { base: "http://127.0.0.1:4273", paths: ["/", "/api/health", "/api/sessions"] },
  { base: "http://127.0.0.1:4174", paths: ["/login", "/api/health"] },
] as const;

async function get(url: string, origin: string): Promise<void> {
  try {
    await fetch(url, { headers: { origin }, redirect: "manual" });
  } catch (e) {
    console.warn(`warm-up failed for ${url}`, e);
  }
}

/** Compiles the dev-server routes the specs hit so first loads do not race test timeouts. */
export default async function globalSetup(): Promise<void> {
  for (const { base, paths } of WARM) {
    for (const p of paths) await get(`${base}${p}`, base);
  }
  const main = WARM[0].base;
  try {
    const res = await fetch(`${main}/api/sessions`, {
      method: "POST",
      headers: { origin: main, "content-type": "application/json" },
      body: JSON.stringify({ question: "warm-up" }),
    });
    const id = ((await res.json()) as { data?: { id?: string } }).data?.id;
    if (id) await get(`${main}/s/${id}`, main);
  } catch (e) {
    console.warn("session warm-up failed", e);
  }
}
