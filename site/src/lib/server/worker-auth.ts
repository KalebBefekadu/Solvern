import { timingSafeEqual } from "node:crypto";

export function authorizedWorker(req: Request, secret = process.env.PREVIEW_WORKER_SECRET || process.env.CRON_SECRET): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!secret || !given) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(given);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
