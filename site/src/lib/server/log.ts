/**
 * One JSON line per event, so Vercel's log search and alerts can filter on `event` and `level`.
 * Pass ids and counts only: never names, emails, phone numbers or messages.
 */
type Level = "info" | "warn" | "error";

function errorFields(e: unknown) {
  if (e instanceof Error) return { error: e.name, message: e.message.slice(0, 500) };
  return e === undefined ? {} : { error: String(e).slice(0, 500) };
}

function write(level: Level, event: string, data: Record<string, unknown> = {}, err?: unknown) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...data, ...errorFields(err) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>, err?: unknown) => write("warn", event, data, err),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) => write("error", event, data, err),
};
