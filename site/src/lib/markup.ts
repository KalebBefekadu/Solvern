import { getStroke } from "perfect-freehand";
import { MAX_NOTE_LENGTH, MAX_NOTES, MAX_PHOTO_BYTES, MAX_POINTS_PER_STROKE, MAX_STROKES, PHOTO_TYPES } from "@/lib/leads/constants";

export const PENS = [
  { id: "blue", label: "Blue pen", color: "#2F63D6", text: "#2F63D6" },
  { id: "orange", label: "Orange pen", color: "#E8742C", text: "#A8501A" },
  { id: "green", label: "Green pen", color: "#1FA35B", text: "#16743F" },
] as const;
export type PenId = (typeof PENS)[number]["id"];
export const penById = (id: PenId) => PENS.find((p) => p.id === id)!;

/** Points are in image pixel space: [x, y, pressure]. */
export type Pt = [number, number, number];

export interface Stroke {
  id: string;
  pen: PenId;
  noteId: string;
  points: Pt[];
}
export interface Note {
  id: string;
  n: number;
  pen: PenId;
  text: string;
  /** Anchor in image pixel space (top-right of the first stroke in the group). */
  anchor: { x: number; y: number };
}
export interface MarkupPhoto {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  strokes: Stroke[];
  notes: Note[];
}

/** RFC 4122 v4 id. randomUUID needs a secure context, so older or plain-http browsers fall back to getRandomValues. */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function strokeSize(w: number, h: number) {
  return Math.max(4, Math.round(Math.max(w, h) * 0.008));
}

export function strokeOutline(points: Pt[], size: number) {
  return getStroke(points, { size, thinning: 0.35, smoothing: 0.6, streamline: 0.45, simulatePressure: points.every((p) => p[2] === 0.5) });
}

/** perfect-freehand outline to an SVG path (quadratic smoothing between midpoints). */
export function outlineToPath(outline: number[][]) {
  if (!outline.length) return "";
  const d = outline.reduce(
    (acc: (string | number)[], [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(round(x0), round(y0), round((x0 + x1) / 2), round((y0 + y1) / 2));
      return acc;
    },
    ["M", ...outline[0].map(round), "Q"],
  );
  d.push("Z");
  return d.join(" ");
}
const round = (n: number) => Math.round(n * 10) / 10;

export function bbox(points: Pt[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Drops points closer than `minDist` to the last kept point, then samples evenly down to `max`.
 * Keeps the saved vector data small (coalesced pointer events arrive at up to 240 per second)
 * without changing the drawn shape at the resolution it is reviewed at.
 */
export function simplifyPoints(points: Pt[], minDist: number, max = MAX_POINTS_PER_STROKE): Pt[] {
  if (points.length <= 2) return points;
  const kept: Pt[] = [points[0]];
  const min2 = minDist * minDist;
  for (let i = 1; i < points.length - 1; i++) {
    const [lx, ly] = kept[kept.length - 1];
    const dx = points[i][0] - lx;
    const dy = points[i][1] - ly;
    if (dx * dx + dy * dy >= min2) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  if (kept.length <= max) return kept;
  const step = (kept.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => kept[Math.round(i * step)]);
}

/** Serializable stroke data saved with the lead (vector, in image pixel space). */
export function serializeMarkup(photo: MarkupPhoto) {
  const minDist = Math.max(1, Math.max(photo.width, photo.height) / 1000);
  const noteNumber = new Map(photo.notes.map((n) => [n.id, n.n]));
  return {
    width: photo.width,
    height: photo.height,
    strokes: photo.strokes.slice(0, MAX_STROKES).map((s) => ({
      pen: s.pen,
      color: penById(s.pen).color,
      note: noteNumber.get(s.noteId) ?? null,
      points: simplifyPoints(s.points, minDist).map((p) => [round(p[0]), round(p[1]), round(p[2])] as Pt),
    })),
  };
}
export function serializeNotes(photo: MarkupPhoto) {
  return photo.notes.slice(0, MAX_NOTES).map((n) => ({
    n: n.n,
    pen: n.pen,
    color: penById(n.pen).color,
    text: n.text.trim().slice(0, MAX_NOTE_LENGTH),
    anchor: { x: Math.round(n.anchor.x), y: Math.round(n.anchor.y) },
  }));
}

/** Draws the photo, strokes and numbered note markers into a PNG (long edge capped). */
export async function flattenToPng(photo: MarkupPhoto, maxEdge = 1800): Promise<Blob> {
  const img = await loadImage(photo.url);
  const scale = Math.min(1, maxEdge / Math.max(photo.width, photo.height));
  const w = Math.round(photo.width * scale);
  const h = Math.round(photo.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.save();
  ctx.scale(scale, scale);
  const size = strokeSize(photo.width, photo.height);
  for (const s of photo.strokes) {
    ctx.fillStyle = penById(s.pen).color;
    ctx.fill(new Path2D(outlineToPath(strokeOutline(s.points, size))));
  }
  const r = Math.max(14, Math.round(Math.max(photo.width, photo.height) * 0.016));
  for (const n of photo.notes) {
    ctx.beginPath();
    ctx.arc(n.anchor.x, n.anchor.y, r, 0, Math.PI * 2);
    ctx.fillStyle = penById(n.pen).color;
    ctx.fill();
    ctx.lineWidth = r * 0.18;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 ${Math.round(r * 1.1)}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n.n), n.anchor.x, n.anchor.y + r * 0.05);
  }
  ctx.restore();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create image"))), "image/png"));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This photo could not be opened"));
    img.src = src;
  });
}

/**
 * Makes a decoded photo acceptable to storage: a type the bucket allows and at most 15 MB.
 * Anything else the browser can open (GIF, AVIF, BMP, a very large JPEG) is re-encoded as JPEG,
 * with the long edge capped so the result fits. Accepted files pass through untouched.
 */
export async function normalizePhoto(file: File, img: HTMLImageElement, maxEdge = 4096): Promise<{ file: File; width: number; height: number }> {
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if ((PHOTO_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_PHOTO_BYTES) return { file, width: w0, height: h0 };
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF"; // transparent areas (PNG, GIF) become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size <= MAX_PHOTO_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return { file: new File([blob], name, { type: "image/jpeg" }), width, height };
    }
  }
  throw new Error("This photo is too large to send. Try a smaller one.");
}
