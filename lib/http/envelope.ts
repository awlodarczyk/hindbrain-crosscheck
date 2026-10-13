export type ApiOk<T> = { ok: true; data: T; meta?: { total: number; page: number; limit: number } };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };

export const ok = <T>(data: T, meta?: ApiOk<T>["meta"]): ApiOk<T> =>
  meta ? { ok: true, data, meta } : { ok: true, data };

export const fail = (code: string, message: string, details?: unknown): ApiErr => ({
  ok: false,
  error: details === undefined ? { code, message } : { code, message, details },
});
