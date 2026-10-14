import type { HistoryItem } from "@/components/shell/group-by-day";
import type { ProviderId } from "@/lib/db/enums";
import type { ProviderStatus } from "@/lib/providers/types";
import type { Session } from "@/lib/repos/types";
import type { SearchHit } from "@/lib/repos/search";
import type { Settings } from "@/lib/settings/schema";
import type { SessionDetail } from "./sessions-dto";
import type { SettingsView } from "./settings-dto";

/** Failure from the API or transport; `status` is 0 for network errors. */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type SessionListResponse = {
  items: HistoryItem[];
  meta: { total: number; page: number; limit: number };
};

export type CreateSessionInput = {
  question: string;
  mode?: "ask" | "paste" | "transcript";
  pasted?: { claude?: string; chatgpt?: string };
  transcript?: string;
  overrides?: unknown;
};

type Envelope =
  | { ok: true; data: unknown; meta?: unknown }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

const isEnvelope = (v: unknown): v is Envelope =>
  typeof v === "object" && v !== null && typeof (v as { ok?: unknown }).ok === "boolean";

async function send(method: string, path: string, body?: unknown): Promise<Envelope> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, "network", "Cannot reach the server.");
  }
  const json: unknown = await res.json().catch(() => undefined);
  if (!isEnvelope(json)) {
    throw new ApiClientError(res.status, "bad_response", "Unexpected server response.");
  }
  if (!json.ok) {
    const { code, message, details } = json.error;
    throw new ApiClientError(res.status, code, message, details);
  }
  return json;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const env = await send(method, path, body);
  return (env as { data: T }).data;
}

async function requestList(path: string): Promise<SessionListResponse> {
  const env = (await send("GET", path)) as { data: HistoryItem[]; meta?: unknown };
  const meta = (env.meta as SessionListResponse["meta"] | undefined) ?? {
    total: env.data.length,
    page: 1,
    limit: env.data.length,
  };
  return { items: env.data, meta };
}

const enc = encodeURIComponent;

async function readJsonFile(file: File): Promise<string> {
  const text = await file.text();
  try {
    JSON.parse(text);
  } catch {
    throw new ApiClientError(400, "bad_file", "That file is not valid JSON.");
  }
  return text;
}

export const api = {
  sessions: {
    list(q: { limit?: number; before?: string } = {}): Promise<SessionListResponse> {
      const p = new URLSearchParams();
      if (q.limit !== undefined) p.set("limit", String(q.limit));
      if (q.before) p.set("before", q.before);
      const qs = p.toString();
      return requestList(`/api/sessions${qs ? `?${qs}` : ""}`);
    },
    create: (body: CreateSessionInput) => request<{ id: string }>("POST", "/api/sessions", body),
    get: (id: string) => request<SessionDetail>("GET", `/api/sessions/${enc(id)}`),
    rename: (id: string, title: string) =>
      request<Session>("PATCH", `/api/sessions/${enc(id)}`, { title }),
    remove: (id: string) => request<{ id: string }>("DELETE", `/api/sessions/${enc(id)}`),
    removeAll: () => request<{ deleted: number }>("DELETE", "/api/sessions", { confirm: "DELETE" }),
    rerun: (id: string) =>
      request<{ id: string; queued: boolean }>("POST", `/api/sessions/${enc(id)}/rerun`),
    retry: (id: string, callId: string) =>
      request<{ id: string; callId: string; queued: boolean }>(
        "POST",
        `/api/sessions/${enc(id)}/calls/${enc(callId)}/retry`,
      ),
    listDeleted: () => requestList("/api/sessions/deleted"),
    restore: (id: string) => request<Session>("POST", `/api/sessions/${enc(id)}/restore`),
    exportUrl: (id: string, format: "json" | "md") =>
      `/api/sessions/${enc(id)}/export?format=${format}`,
    exportAllUrl: () => "/api/sessions/export",
    async importFile(file: File) {
      const text = await readJsonFile(file);
      return request<{ imported: number; ids: string[]; warnings: string[] }>(
        "POST",
        "/api/sessions/import",
        text,
      );
    },
  },
  settings: {
    get: () => request<SettingsView>("GET", "/api/settings"),
    put: (s: Settings) =>
      request<{ settings: Settings; savedAt: string }>("PUT", "/api/settings", s),
    putKey: (b: { provider: ProviderId; apiKey: string }) =>
      request<{ provider: ProviderId; masked: string }>("PUT", "/api/settings/keys", b),
    removeKey: (provider: ProviderId) =>
      request<{ provider: ProviderId }>("DELETE", "/api/settings/keys", { provider }),
    reveal: (b: { provider: ProviderId; password?: string }) =>
      request<{ provider: ProviderId; apiKey: string }>("POST", "/api/settings/keys/reveal", b),
    testProvider: (id: ProviderId) =>
      request<ProviderStatus>("POST", `/api/providers/${enc(id)}/test`),
  },
  search(q: string, limit?: number): Promise<SearchHit[]> {
    const p = new URLSearchParams({ q });
    if (limit !== undefined) p.set("limit", String(limit));
    return request<SearchHit[]>("GET", `/api/search?${p}`);
  },
  auth: {
    me: () => request<{ userId: string; email: string; mode: string }>("GET", "/api/auth/me"),
    logout: () => request<{ ok: true }>("POST", "/api/auth/logout"),
  },
};
