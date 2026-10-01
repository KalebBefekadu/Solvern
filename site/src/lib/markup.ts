import { getStroke } from "perfect-freehand";

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

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

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
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Serializable stroke data saved with the lead (vector, in image pixel space). */
export function serializeMarkup(photo: MarkupPhoto) {
  return {
    width: photo.width,
    height: photo.height,
    strokes: photo.strokes.map((s) => ({ pen: s.pen, color: penById(s.pen).color, note: photo.notes.find((n) => n.id === s.noteId)?.n ?? null, points: s.points.map((p) => [round(p[0]), round(p[1]), round(p[2])]) })),
  };
}
export function serializeNotes(photo: MarkupPhoto) {
  return photo.notes.map((n) => ({ n: n.n, pen: n.pen, color: penById(n.pen).color, text: n.text.trim(), anchor: { x: Math.round(n.anchor.x), y: Math.round(n.anchor.y) } }));
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
