"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PENS,
  type MarkupPhoto,
  type Note,
  type PenId,
  type Pt,
  type Stroke,
  bbox,
  loadImage,
  normalizePhoto,
  outlineToPath,
  penById,
  strokeOutline,
  strokeSize,
  uid,
} from "@/lib/markup";
import { track } from "@/lib/analytics";
import { MAX_NOTE_LENGTH, MAX_NOTES, MAX_PHOTOS, MAX_STROKES } from "@/lib/leads/constants";
import { CloseIcon, PlusIcon, TrashIcon, UndoIcon, UploadIcon } from "./Icons";

// Any image the browser can open; unsupported types are converted to JPEG on add.
const ACCEPT = "image/*";

interface Props {
  photos: MarkupPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<MarkupPhoto[]>>;
  photoSubject: string;
  exampleNotes: string[];
  diagnosis: boolean;
  tradeSlug?: string;
}

export function MarkupTool({ photos, setPhotos, photoSubject, exampleNotes, diagnosis, tradeSlug }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pen, setPen] = useState<PenId>("blue");
  /** Current stroke group (note). New strokes join it while the pen stays the same. */
  const [groupId, setGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const usedRef = useRef(false);

  const active = photos.find((p) => p.id === activeId) ?? photos[0] ?? null;

  useEffect(() => {
    if (!activeId && photos[0]) setActiveId(photos[0].id);
  }, [photos, activeId]);

  // Release object URLs on unmount.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const updateActive = useCallback(
    (fn: (p: MarkupPhoto) => MarkupPhoto) => {
      if (!active) return;
      setPhotos((all) => all.map((p) => (p.id === active.id ? fn(p) : p)));
    },
    [active, setPhotos],
  );

  async function addFiles(list: FileList | File[]) {
    setError(null);
    const files = Array.from(list);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const added: MarkupPhoto[] = [];
    for (const file of files.slice(0, room)) {
      if (file.type && !file.type.startsWith("image/")) {
        setError("Please choose a photo file, such as a JPG or PNG.");
        continue;
      }
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const normalized = await normalizePhoto(file, img);
        if (normalized.file === file) {
          added.push({ id: uid(), file, url, width: normalized.width, height: normalized.height, strokes: [], notes: [] });
        } else {
          URL.revokeObjectURL(url);
          const nurl = URL.createObjectURL(normalized.file);
          added.push({ id: uid(), file: normalized.file, url: nurl, width: normalized.width, height: normalized.height, strokes: [], notes: [] });
        }
      } catch (e) {
        URL.revokeObjectURL(url);
        setError(e instanceof Error && e.message.startsWith("This photo is too large") ? e.message : "That photo format could not be opened here. Try a JPG or PNG.");
      }
    }
    if (files.length > room) setError(`You can add up to ${MAX_PHOTOS} photos. The first ${room} were added.`);
    if (added.length) {
      setPhotos((all) => [...all, ...added].slice(0, MAX_PHOTOS));
      setActiveId(added[0].id);
      setGroupId(null);
    }
  }

  function removePhoto(id: string) {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    setPhotos((all) => all.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
    setGroupId(null);
  }

  // ----- Drawing -----
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef<{ strokeId: string; pointerId: number } | null>(null);

  function toImagePoint(e: React.PointerEvent): Pt {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * active!.width;
    const y = ((e.clientY - r.top) / r.height) * active!.height;
    const pressure = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
    return [x, y, pressure];
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!active || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const currentGroup = active.notes.find((n) => n.id === groupId);
    const startNew = !currentGroup || currentGroup.pen !== pen;
    if (active.strokes.length >= MAX_STROKES || (startNew && active.notes.length >= MAX_NOTES)) {
      setError("This photo has as many marks as it can hold. Undo or delete a note to draw more.");
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const pt = toImagePoint(e);
    const strokeId = uid();
    let noteId = groupId;
    if (startNew) noteId = uid();
    drawing.current = { strokeId, pointerId: e.pointerId };
    updateActive((p) => {
      const notes = startNew
        ? [...p.notes, { id: noteId!, n: (p.notes.reduce((m, n) => Math.max(m, n.n), 0) || 0) + 1, pen, text: "", anchor: { x: pt[0], y: pt[1] } } as Note]
        : p.notes;
      return { ...p, notes, strokes: [...p.strokes, { id: strokeId, pen, noteId: noteId!, points: [pt] }] };
    });
    if (startNew) setGroupId(noteId);
    if (!usedRef.current) {
      usedRef.current = true;
      track("markup_use", { trade: tradeSlug });
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drawing.current;
    if (!d || d.pointerId !== e.pointerId || !active) return;
    const native = e.nativeEvent;
    const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [native];
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const pts: Pt[] = events.map((ev) => [
      ((ev.clientX - r.left) / r.width) * active.width,
      ((ev.clientY - r.top) / r.height) * active.height,
      ev.pointerType === "pen" ? ev.pressure || 0.5 : 0.5,
    ]);
    updateActive((p) => ({ ...p, strokes: p.strokes.map((s) => (s.id === d.strokeId ? { ...s, points: [...s.points, ...pts] } : s)) }));
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = drawing.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drawing.current = null;
    // Re-anchor the note to the top-right of its first stroke, then focus it.
    updateActive((p) => {
      const stroke = p.strokes.find((s) => s.id === d.strokeId);
      if (!stroke) return p;
      const groupStrokes = p.strokes.filter((s) => s.noteId === stroke.noteId);
      if (groupStrokes.length !== 1) return p;
      const b = bbox(stroke.points);
      return { ...p, notes: p.notes.map((n) => (n.id === stroke.noteId ? { ...n, anchor: { x: b.maxX, y: b.minY } } : n)) };
    });
    const stroke = active?.strokes.find((s) => s.id === d.strokeId);
    if (stroke && active && active.strokes.filter((s) => s.noteId === stroke.noteId).length === 1) setFocusNote(stroke.noteId);
  }

  function choosePen(id: PenId) {
    setPen(id);
    // Switching pen color starts a new note on the next stroke.
    if (id !== pen) setGroupId(null);
  }

  function undo() {
    if (!active || !active.strokes.length) return;
    setError(null);
    updateActive((p) => {
      const last = p.strokes[p.strokes.length - 1];
      const strokes = p.strokes.slice(0, -1);
      const stillUsed = strokes.some((s) => s.noteId === last.noteId);
      return { ...p, strokes, notes: stillUsed ? p.notes : p.notes.filter((n) => n.id !== last.noteId) };
    });
    setGroupId(null);
  }

  function clearAll() {
    updateActive((p) => ({ ...p, strokes: [], notes: [] }));
    setGroupId(null);
  }

  function deleteNote(id: string) {
    updateActive((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== id), strokes: p.strokes.filter((s) => s.noteId !== id) }));
    if (groupId === id) setGroupId(null);
  }

  function editNote(id: string, text: string) {
    updateActive((p) => ({ ...p, notes: p.notes.map((n) => (n.id === id ? { ...n, text: text.slice(0, MAX_NOTE_LENGTH) } : n)) }));
  }

  const size = active ? strokeSize(active.width, active.height) : 6;
  const paths = useMemo(
    () => (active ? active.strokes.map((s) => ({ id: s.id, color: penById(s.pen).color, d: outlineToPath(strokeOutline(s.points, size)) })) : []),
    [active, size],
  );

  const subjectLabel = `Add a photo of your ${photoSubject}`;

  return (
    <div className="markup">
      <div className="markup__bar" role="toolbar" aria-label="Drawing tools">
        <div className="markup__pens">
          <span className="markup__pens-label" id="pens-label">
            Draw on your photo
          </span>
          {PENS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="pen"
              aria-label={p.label}
              aria-pressed={pen === p.id}
              style={{ ["--pen" as string]: p.color }}
              onClick={() => choosePen(p.id)}
            >
              <span />
            </button>
          ))}
        </div>
        <div className="markup__actions">
          <button type="button" className="chip-btn" onClick={() => setGroupId(null)} disabled={!active || !groupId} title="Start a new note with the same pen">
            <PlusIcon size={16} /> New note
          </button>
          <button type="button" className="chip-btn" onClick={undo} disabled={!active?.strokes.length}>
            <UndoIcon /> Undo
          </button>
          <button type="button" className="chip-btn" onClick={clearAll} disabled={!active?.strokes.length}>
            Clear
          </button>
        </div>
      </div>

      {active ? (
        <div className="markup__stage">
          <div className="markup__canvas" style={{ aspectRatio: `${active.width} / ${active.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.url} alt={`Your photo ${photos.indexOf(active) + 1} of ${photos.length}`} width={active.width} height={active.height} />
            <svg
              ref={svgRef}
              className="strokes"
              viewBox={`0 0 ${active.width} ${active.height}`}
              preserveAspectRatio="none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              role="img"
              aria-label={`Drawing area. ${active.notes.length} ${active.notes.length === 1 ? "note" : "notes"} on this photo.`}
            >
              {paths.map((p) => (
                <path key={p.id} d={p.d} fill={p.color} />
              ))}
            </svg>
            {active.notes.map((n) => (
              <NoteMarker key={`m-${n.id}`} note={n} photo={active} />
            ))}
            {active.notes.map((n) => (
              <NoteBox
                key={n.id}
                note={n}
                photo={active}
                autoFocus={focusNote === n.id}
                onFocused={() => setFocusNote(null)}
                onChange={(t) => editNote(n.id, t)}
                onDelete={() => deleteNote(n.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <ExampleStage
          notes={exampleNotes}
          dragging={dragging}
          onPick={() => fileRef.current?.click()}
          onDrag={setDragging}
          onDrop={(files) => addFiles(files)}
          label={subjectLabel}
        />
      )}

      {/* Notes list: the accessible, small-screen view of every note on the current photo. */}
      {active && active.notes.length > 0 && (
        <ol className="notes-list notes-list--inline" aria-label="Your notes">
          {active.notes.map((n) => (
            <li key={n.id} style={{ ["--note" as string]: penById(n.pen).color }}>
              <span className="note-marker" style={{ position: "static", margin: 0, ["--note" as string]: penById(n.pen).color }} aria-hidden="true">
                {n.n}
              </span>
              <label className="visually-hidden" htmlFor={`list-${n.id}`}>
                Note {n.n}
              </label>
              <textarea id={`list-${n.id}`} rows={2} maxLength={MAX_NOTE_LENGTH} value={n.text} placeholder="What should change here?" onChange={(e) => editNote(n.id, e.target.value)} />
              <button type="button" className="note-box__del" aria-label={`Delete note ${n.n} and its drawing`} onClick={() => deleteNote(n.id)}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="thumbs" aria-label="Your photos">
        {photos.map((p, i) => (
          <span key={p.id} style={{ position: "relative" }}>
            <button
              type="button"
              className="thumb"
              aria-current={active?.id === p.id}
              aria-label={`Photo ${i + 1}${p.notes.length ? `, ${p.notes.length} notes` : ""}`}
              onClick={() => {
                setActiveId(p.id);
                setGroupId(null);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
              {p.notes.length > 0 && <span className="thumb__count">{p.notes.length}</span>}
            </button>
            <button
              type="button"
              className="note-box__del"
              style={{ position: "absolute", top: -10, right: -10, width: 28, height: 28, border: "1.5px solid var(--trade-tint-strong)" }}
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => removePhoto(p.id)}
            >
              <CloseIcon size={14} />
            </button>
          </span>
        ))}
        {photos.length > 0 && photos.length < MAX_PHOTOS && (
          <button type="button" className="thumb-add" aria-label="Add another photo" onClick={() => fileRef.current?.click()}>
            <PlusIcon />
          </button>
        )}
        <span className="small">
          {photos.length === 0
            ? `Add 1 to ${MAX_PHOTOS} photos.`
            : `${photos.length} of ${MAX_PHOTOS} photos. Draw on one at a time.`}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="small">
        {diagnosis
          ? "Pick a pen, circle where the problem is, and a note box opens for your comment. Each pen color starts a new note."
          : "Pick a pen, circle what you want changed, and a note box opens for your comment. Each pen color starts a new note."}
      </p>
    </div>
  );
}

function pct(v: number, total: number) {
  return `${(v / total) * 100}%`;
}

function NoteMarker({ note, photo }: { note: Note; photo: MarkupPhoto }) {
  return (
    <span
      className="note-marker"
      aria-hidden="true"
      style={{ left: pct(note.anchor.x, photo.width), top: pct(note.anchor.y, photo.height), ["--note" as string]: penById(note.pen).color }}
    >
      {note.n}
    </span>
  );
}

function NoteBox({
  note,
  photo,
  autoFocus,
  onFocused,
  onChange,
  onDelete,
}: {
  note: Note;
  photo: MarkupPhoto;
  autoFocus: boolean;
  onFocused: () => void;
  onChange: (t: string) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus && ref.current && ref.current.offsetParent !== null) {
      ref.current.focus({ preventScroll: true });
      onFocused();
    }
  }, [autoFocus, onFocused]);
  const p = penById(note.pen);
  const x = (note.anchor.x / photo.width) * 100;
  const y = (note.anchor.y / photo.height) * 100;
  return (
    <div
      className="note-box"
      style={{
        // Open to the right of the drawing, or to the left when the drawing is near the right edge.
        left: x > 55 ? `clamp(8px, calc(${x}% - 236px), calc(100% - 228px))` : `clamp(8px, calc(${x}% + 16px), calc(100% - 228px))`,
        top: `clamp(8px, calc(${y}% - 16px), calc(100% - 112px))`,
        ["--note" as string]: p.color,
        ["--note-text" as string]: p.text,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="note-box__head">
        <label className="note-box__label" htmlFor={`box-${note.id}`}>
          Note {note.n}
        </label>
        <button type="button" className="note-box__del" aria-label={`Delete note ${note.n} and its drawing`} onClick={onDelete}>
          <TrashIcon size={14} />
        </button>
      </div>
      <textarea ref={ref} id={`box-${note.id}`} rows={2} maxLength={MAX_NOTE_LENGTH} value={note.text} placeholder="What should change here?" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ExampleStage({
  notes,
  dragging,
  onPick,
  onDrag,
  onDrop,
  label,
}: {
  notes: string[];
  dragging: boolean;
  onPick: () => void;
  onDrag: (v: boolean) => void;
  onDrop: (f: FileList) => void;
  label: string;
}) {
  const dnd = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      onDrag(true);
    },
    onDragLeave: () => onDrag(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      onDrag(false);
      if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files);
    },
  };
  return (
    <>
      <div className="markup__stage markup__stage--empty" data-dragging={dragging} {...dnd} onClick={onPick} style={{ cursor: "pointer" }} aria-hidden="true">
        <span className="example-tag">Example</span>
        <svg viewBox="0 0 720 420" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d="M120 250 C140 200 260 190 300 240 C330 280 250 320 170 305 C120 295 110 270 120 250" fill="none" stroke="#2F63D6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M430 320 L640 320 L640 380" fill="none" stroke="#E8742C" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {notes[0] && <ExampleNote n={1} pen="blue" text={notes[0]} style={{ left: "46%", top: "10%" }} />}
        {notes[1] && <ExampleNote n={2} pen="orange" text={notes[1]} style={{ left: "61%", top: "56%" }} />}
      </div>
      <div className="dropzone dropzone--row" data-dragging={dragging} {...dnd}>
        <span className="small">Drag photos here, or choose them from your phone or computer.</span>
        <button type="button" className="btn btn--trade btn--sm" onClick={onPick}>
          <UploadIcon size={18} /> {label}
        </button>
      </div>
    </>
  );
}

function ExampleNote({ n, pen, text, style }: { n: number; pen: PenId; text: string; style: React.CSSProperties }) {
  const p = penById(pen);
  return (
    <div className="note-box example-note" style={{ ...style, ["--note" as string]: p.color, ["--note-text" as string]: p.text }} aria-hidden="true">
      <span className="note-box__label" style={{ display: "block", marginBottom: 4 }}>
        Note {n}
      </span>
      {text}
    </div>
  );
}

export type { Stroke };
