import { describe, expect, it } from "vitest";
import { serializeMarkup, serializeNotes, simplifyPoints, type MarkupPhoto, type Pt } from "@/lib/markup";
import { photoSchema } from "@/lib/leads/schema";
import { MAX_POINTS_PER_STROKE } from "@/lib/leads/constants";

const line = (n: number, step = 0.1): Pt[] => Array.from({ length: n }, (_, i) => [i * step, i * step, 0.5]);

describe("simplifyPoints", () => {
  it("keeps short strokes as they are", () => {
    const pts = line(2);
    expect(simplifyPoints(pts, 5)).toBe(pts);
  });

  it("drops points closer than the minimum distance but keeps both ends", () => {
    const pts = line(101, 0.1);
    const out = simplifyPoints(pts, 1);
    expect(out[0]).toEqual(pts[0]);
    expect(out.at(-1)).toEqual(pts.at(-1));
    expect(out.length).toBeLessThan(20);
  });

  it("never returns more than the per-stroke limit", () => {
    const out = simplifyPoints(line(20_000, 10), 1);
    expect(out.length).toBe(MAX_POINTS_PER_STROKE);
    expect(out.at(-1)).toEqual([199990, 199990, 0.5]);
  });
});

describe("serialized markup", () => {
  const photo: MarkupPhoto = {
    id: "p1",
    file: new Blob() as File,
    url: "blob:x",
    width: 4000,
    height: 3000,
    notes: [
      { id: "n1", n: 1, pen: "blue", text: "  Open this wall  ", anchor: { x: 10.4, y: 20.6 } },
      { id: "n2", n: 2, pen: "orange", text: "", anchor: { x: 100, y: 100 } },
    ],
    strokes: [
      { id: "s1", pen: "blue", noteId: "n1", points: line(9000, 0.5) },
      { id: "s2", pen: "orange", noteId: "n2", points: [[5, 5, 0.5]] },
    ],
  };

  it("passes the server schema, even for a very long stroke", () => {
    const record = {
      originalPath: "leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/original-1.jpg",
      annotatedPath: "leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/annotated-2.png",
      strokes: serializeMarkup(photo),
      notes: serializeNotes(photo),
    };
    expect(photoSchema.safeParse(record).success).toBe(true);
  });

  it("links strokes to note numbers and trims note text", () => {
    const s = serializeMarkup(photo);
    expect(s.strokes.map((x) => x.note)).toEqual([1, 2]);
    expect(serializeNotes(photo)[0]).toMatchObject({ n: 1, text: "Open this wall", anchor: { x: 10, y: 21 } });
  });
});
