import type { z } from "zod";
import { errors, HttpError } from "./errors";

export const DEFAULT_MAX_BODY_BYTES = 262_144;
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type ParsedBody<B> = { value: B; bytes: number };

export const hasBody = (req: Request): boolean => BODY_METHODS.has(req.method.toUpperCase());

/** Maps zod issues to `{ path, message }` pairs safe to return to clients. */
export function zodDetails(error: z.ZodError): { issues: { path: string; message: string }[] } {
  return { issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
}

/** Parses a query string into a flat object; repeated keys keep the last value. */
export function parseQuery<Q>(req: Request, schema: z.ZodType<Q>): Q {
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  const r = schema.safeParse(raw);
  if (!r.success) throw errors.badRequest(zodDetails(r.error));
  return r.data;
}

/** Streams the body, cancelling the source as soon as it exceeds `maxBytes`. @throws HttpError 413. */
async function readCapped(
  req: Request,
  maxBytes: number,
): Promise<{ text: string; bytes: number }> {
  if (!req.body) return { text: "", bytes: 0 };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw errors.tooLarge();
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString("utf8"), bytes };
}

/**
 * Reads the body once, enforcing content type and size before JSON parsing.
 * @throws HttpError 415 wrong content type, 413 over `maxBytes`, 400 invalid JSON or schema mismatch.
 */
export async function parseBody<B>(
  req: Request,
  schema: z.ZodType<B>,
  opts: { maxBytes: number; contentType: string },
): Promise<ParsedBody<B>> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith(opts.contentType)) {
    throw errors.unsupportedMedia();
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > opts.maxBytes) throw errors.tooLarge();
  const { text, bytes } = await readCapped(req, opts.maxBytes);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON.");
  }
  const r = schema.safeParse(json);
  if (!r.success) throw errors.badRequest(zodDetails(r.error));
  return { value: r.data, bytes };
}
