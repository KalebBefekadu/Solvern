import { NextResponse } from "next/server";

/** Largest JSON body the lead and upload routes accept. Photos never pass through these routes. */
export const MAX_JSON_BYTES = 1024 * 1024;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function errorResponse(e: HttpError) {
  return NextResponse.json({ error: e.message, ...(e.fields ? { fields: e.fields } : {}) }, { status: e.status, headers: { "Cache-Control": "no-store" } });
}

/** Reads a JSON body with a hard size cap, so an oversized payload is refused before parsing. */
export async function readJson(req: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "That request is too large.");
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, "That request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Bad request");
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/**
 * Refuses cross-site browser posts. Browsers always send Origin on fetch POSTs;
 * requests without it (server to server, curl) still have to pass Turnstile and validation.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Forbidden");
  }
  if (!host || originHost !== host) throw new HttpError(403, "Forbidden");
}
