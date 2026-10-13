"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
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
  savedIds: ReadonlySet<string>;
  saving: boolean;
  saveError: string | null;
  onSavePhoto: (photo: MarkupPhoto) => Promise<void>;
  onChanged: (id: string) => void;
  onRemoved: (id: string) => Promise<void>;
  photoSubject: string;
  exampleNotes: string[];
  diagnosis: boolean;
  tradeSlug?: string;
}

export function MarkupTool({ photos, setPhotos, savedIds, saving, saveError, onSavePhoto, onChanged, onRemoved, photoSubject, exampleNotes, diagnosis, tradeSlug }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pen, setPen] = useState<PenId>("blue");
  /** Current stroke group (note). New strokes join it while the pen stays the same. */
  const [groupId, setGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addingRef = useRef(false);
  const usedRef = useRef(false);
  const historyRef = useRef(new Map<string, { past: Pick<MarkupPhoto, "strokes" | "notes">[]; future: Pick<MarkupPhoto, "strokes" | "notes">[] }>());
  const [historyCounts, setHistoryCounts] = useState<Record<string, { past: number; future: number }>>({});

  const active = photos.find((p) => p.id === activeId) ?? photos[0] ?? null;

  // Release object URLs on unmount.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const updateActive = useCallback(
    (fn: (p: MarkupPhoto) => MarkupPhoto) => {
      if (!active) return;
      setPhotos((all) => all.map((p) => (p.id === active.id ? fn(p) : p)));
      onChanged(active.id);
    },
    [active, setPhotos, onChanged],
  );

  function historyFor(id: string) {
    let history = historyRef.current.get(id);
    if (!history) {
      history = { past: [], future: [] };
      historyRef.current.set(id, history);
    }
    return history;
  }

  function remember() {
    if (!active) return;
    const history = historyFor(active.id);
    history.past.push({ strokes: active.strokes, notes: active.notes });
    if (history.past.length > 50) history.past.shift();
    history.future = [];
    setHistoryCounts((counts) => ({ ...counts, [active.id]: { past: history.past.length, future: 0 } }));
  }

  async function addFiles(list: FileList | File[]) {
    if (addingRef.current) return;
    addingRef.current = true;
    try {
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
        if (!active || savedIds.has(active.id)) {
          setActiveId(added[0].id);
          setGroupId(null);
        }
      }
    } finally {
      addingRef.current = false;
    }
  }

  async function removePhoto(id: string) {
    if (saving) return;
    try {
      await onRemoved(id);
    } catch {
      // The parent reports the server error; leave this photo in place for retry.
      return;
    }
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    historyRef.current.delete(id);
    setHistoryCounts((counts) => {
      const next = { ...counts };
      delete next[id];
      return next;
    });
    setPhotos((all) => all.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
    setGroupId(null);
  }

  // ----- Drawing -----
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef<{ strokeId: string; pointerId: number; noteId: string; newNote: boolean } | null>(null);
  const pendingPoints = useRef<Pt[]>([]);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  function flushPoints() {
    const d = drawing.current;
    const points = pendingPoints.current;
    pendingPoints.current = [];
    frameRef.current = null;
    if (!d || !points.length) return;
    updateActive((p) => ({ ...p, strokes: p.strokes.map((s) => (s.id === d.strokeId ? { ...s, points: [...s.points, ...points] } : s)) }));
  }

  function toImagePoint(e: React.PointerEvent): Pt {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(active!.width, ((e.clientX - r.left) / r.width) * active!.width));
    const y = Math.max(0, Math.min(active!.height, ((e.clientY - r.top) / r.height) * active!.height));
    const pressure = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
    return [x, y, pressure];
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!active || saving || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const currentGroup = active.notes.find((n) => n.id === groupId);
    const startNew = !currentGroup || currentGroup.pen !== pen;
    if (active.strokes.length >= MAX_STROKES || (startNew && active.notes.length >= MAX_NOTES)) {
      setError("This photo has as many marks as it can hold. Undo or delete a note to draw more.");
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const pt = toImagePoint(e);
    remember();
    const strokeId = uid();
    let noteId = groupId;
    if (startNew) noteId = uid();
    drawing.current = { strokeId, pointerId: e.pointerId, noteId: noteId!, newNote: startNew };
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
      Math.max(0, Math.min(active.width, ((ev.clientX - r.left) / r.width) * active.width)),
      Math.max(0, Math.min(active.height, ((ev.clientY - r.top) / r.height) * active.height)),
      ev.pointerType === "pen" ? ev.pressure || 0.5 : 0.5,
    ]);
    pendingPoints.current.push(...pts);
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(flushPoints);
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = drawing.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    flushPoints();
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
    if (d.newNote) setFocusNote(d.noteId);
  }

  function choosePen(id: PenId) {
    if (saving) return;
    setPen(id);
    // Switching pen color starts a new note on the next stroke.
    if (id !== pen) setGroupId(null);
  }

  function undo() {
    if (!active || saving) return;
    const history = historyFor(active.id);
    const previous = history.past.pop();
    if (!previous) return;
    setError(null);
    history.future.push({ strokes: active.strokes, notes: active.notes });
    setHistoryCounts((counts) => ({ ...counts, [active.id]: { past: history.past.length, future: history.future.length } }));
    updateActive((p) => ({ ...p, ...previous }));
    setGroupId(null);
  }

  function redo() {
    if (!active || saving) return;
    const history = historyFor(active.id);
    const next = history.future.pop();
    if (!next) return;
    history.past.push({ strokes: active.strokes, notes: active.notes });
    setHistoryCounts((counts) => ({ ...counts, [active.id]: { past: history.past.length, future: history.future.length } }));
    updateActive((p) => ({ ...p, ...next }));
    setGroupId(null);
  }

  function clearAll() {
    if (saving) return;
    remember();
    updateActive((p) => ({ ...p, strokes: [], notes: [] }));
    setGroupId(null);
  }

  function deleteNote(id: string) {
    if (saving) return;
    remember();
    updateActive((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== id), strokes: p.strokes.filter((s) => s.noteId !== id) }));
    if (groupId === id) setGroupId(null);
  }

  function editNote(id: string, text: string) {
    if (saving) return;
    updateActive((p) => ({ ...p, notes: p.notes.map((n) => (n.id === id ? { ...n, text: text.slice(0, MAX_NOTE_LENGTH) } : n)) }));
  }

  const size = active ? strokeSize(active.width, active.height) : 6;

  const subjectLabel = `Add a photo of your ${photoSubject}`;
  const activeIndex = active ? photos.findIndex((p) => p.id === active.id) : -1;

  async function saveAndContinue() {
    if (!active || saving) return;
    if (active.notes.some((n) => !n.text.trim())) {
      const firstEmpty = active.notes.find((n) => !n.text.trim());
      setError(`Describe note ${firstEmpty?.n} before continuing, or delete it.`);
      document.getElementById(`note-${firstEmpty?.id}`)?.focus();
      return;
    }
    setError(null);
    try {
      await onSavePhoto(active);
      const next = photos[activeIndex + 1];
      if (next) {
        setActiveId(next.id);
        setGroupId(null);
        setFocusNote(null);
      }
    } catch {
      // The parent shows the upload error and keeps this photo active for retry.
    }
  }

  return (
    <div className="markup">
      {active && (
        <div className="markup__progress" aria-live="polite">
          <strong>
            Photo {activeIndex + 1} of {photos.length}
          </strong>
          <span>{saving ? "Saving this photo…" : savedIds.has(active.id) ? "Saved" : "Not saved yet"}</span>
        </div>
      )}
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
              disabled={saving}
              style={{ ["--pen" as string]: p.color }}
              onClick={() => choosePen(p.id)}
            >
              <span />
            </button>
          ))}
        </div>
        <div className="markup__actions">
          <button type="button" className="chip-btn" onClick={() => setGroupId(null)} disabled={saving || !active || !groupId} title="Start a new note with the same pen">
            <PlusIcon size={16} /> New note
          </button>
          <button type="button" className="chip-btn" onClick={undo} disabled={saving || !active || !historyCounts[active.id]?.past}>
            <UndoIcon /> Undo
          </button>
          <button type="button" className="chip-btn" onClick={redo} disabled={saving || !active || !historyCounts[active.id]?.future}>
            Redo
          </button>
          <button type="button" className="chip-btn" onClick={clearAll} disabled={saving || !active?.strokes.length}>
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
              {active.strokes.map((stroke) => (
                <StrokePath key={stroke.id} stroke={stroke} size={size} />
              ))}
            </svg>
            {active.notes.map((n) => (
              <NoteMarker
                key={`m-${n.id}`}
                note={n}
                photo={active}
                selected={groupId === n.id}
                onSelect={() => {
                  setGroupId(n.id);
                  setPen(n.pen);
                  document.getElementById(`note-${n.id}`)?.focus();
                }}
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

      {/* The image stays visible while all text entry happens in rows below it. */}
      {active && active.notes.length > 0 && (
        <ol className="notes-list" aria-label="Your notes">
          {active.notes.map((n) => (
            <AnnotationRow
              key={n.id}
              note={n}
              selected={groupId === n.id}
              disabled={saving}
              autoFocus={focusNote === n.id}
              onFocused={() => setFocusNote(null)}
              onSelect={() => {
                setGroupId(n.id);
                setPen(n.pen);
              }}
              onChange={(t) => editNote(n.id, t)}
              onDelete={() => deleteNote(n.id)}
            />
          ))}
        </ol>
      )}

      {active && (
        <div className="markup__continue">
          <button type="button" className="btn btn--trade btn--sm" disabled={saving} onClick={saveAndContinue}>
            {saving
              ? "Saving photo…"
              : active.notes.length === 0
                ? activeIndex < photos.length - 1
                  ? "Save reference photo and continue"
                  : "Save reference photo"
                : activeIndex < photos.length - 1
                  ? "Save photo and continue"
                  : "Save photo"}
          </button>
          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}
        </div>
      )}

      <div className="thumbs" aria-label="Your photos">
        {photos.map((p, i) => (
          <span key={p.id} className="thumb-wrap">
            <button
              type="button"
              className="thumb"
              aria-current={active?.id === p.id}
              aria-label={`Photo ${i + 1}${p.notes.length ? `, ${p.notes.length} notes` : ""}`}
              disabled={saving || (i > activeIndex && !savedIds.has(active!.id))}
              onClick={() => {
                setActiveId(p.id);
                setGroupId(null);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
              {p.notes.length > 0 && <span className="thumb__count">{p.notes.length}</span>}
            </button>
            {savedIds.has(p.id) && (
              <span className="thumb__saved" aria-label={`Photo ${i + 1} saved`}>
                ✓
              </span>
            )}
            <button type="button" className="note-box__del thumb__remove" aria-label={`Remove photo ${i + 1}`} disabled={saving} onClick={() => removePhoto(p.id)}>
              <CloseIcon size={14} />
            </button>
          </span>
        ))}
        {photos.length > 0 && photos.length < MAX_PHOTOS && (
          <button type="button" className="thumb-add" aria-label="Add another photo" disabled={saving} onClick={() => fileRef.current?.click()}>
            <PlusIcon />
          </button>
        )}
        <span className="small">{photos.length === 0 ? `Add 1 to ${MAX_PHOTOS} photos.` : `${savedIds.size} of ${photos.length} photos saved. Work on one at a time.`}</span>
      </div>

      <input
        ref={fileRef}
        type="file"
        disabled={saving}
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
          ? "Pick a pen and circle where the problem is. Describe it in the matching row below the photo."
          : "Pick a pen and circle what you want changed. Describe it in the matching row below the photo."}
      </p>
    </div>
  );
}

function pct(v: number, total: number) {
  return `${(v / total) * 100}%`;
}

const StrokePath = memo(function StrokePath({ stroke, size }: { stroke: Stroke; size: number }) {
  return <path d={outlineToPath(strokeOutline(stroke.points, size))} fill={penById(stroke.pen).color} />;
});

function NoteMarker({ note, photo, selected, onSelect }: { note: Note; photo: MarkupPhoto; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className="note-marker"
      aria-label={`Edit note ${note.n}`}
      aria-pressed={selected}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
      style={{ left: pct(note.anchor.x, photo.width), top: pct(note.anchor.y, photo.height), ["--note" as string]: penById(note.pen).color }}
    >
      {note.n}
    </button>
  );
}

function AnnotationRow({
  note,
  selected,
  disabled,
  autoFocus,
  onFocused,
  onSelect,
  onChange,
  onDelete,
}: {
  note: Note;
  selected: boolean;
  disabled: boolean;
  autoFocus: boolean;
  onFocused: () => void;
  onSelect: () => void;
  onChange: (t: string) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      onFocused();
    }
  }, [autoFocus, onFocused]);
  const p = penById(note.pen);
  return (
    <li data-selected={selected} style={{ ["--note" as string]: p.color }}>
      <span className="note-marker note-marker--inline" aria-hidden="true">
        {note.n}
      </span>
      <label className="visually-hidden" htmlFor={`note-${note.id}`}>
        Note {note.n}
      </label>
      <textarea
        ref={ref}
        id={`note-${note.id}`}
        rows={2}
        maxLength={MAX_NOTE_LENGTH}
        value={note.text}
        disabled={disabled}
        placeholder="What should change here?"
        onChange={(e) => onChange(e.target.value)}
        onFocus={onSelect}
      />
      <button type="button" className="note-box__del" disabled={disabled} aria-label={`Delete note ${note.n} and its drawing`} onClick={onDelete}>
        <TrashIcon size={14} />
      </button>
    </li>
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
      <div className="markup__stage markup__stage--empty" data-dragging={dragging} {...dnd} onClick={onPick} aria-hidden="true">
        <span className="example-tag">Example</span>
        <svg className="markup__example-art" viewBox="0 0 720 420" preserveAspectRatio="xMidYMid slice">
          <path
            d="M120 250 C140 200 260 190 300 240 C330 280 250 320 170 305 C120 295 110 270 120 250"
            fill="none"
            stroke="#2F63D6"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M430 320 L640 320 L640 380" fill="none" stroke="#E8742C" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {notes.length > 0 && (
        <ol className="notes-list notes-list--example" aria-label="Example notes">
          {notes.slice(0, 2).map((text, i) => (
            <li key={i} style={{ ["--note" as string]: penById(i === 0 ? "blue" : "orange").color }}>
              <span className="note-marker note-marker--inline" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>Example note {i + 1}</strong>
                <br />
                {text}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="dropzone dropzone--row" data-dragging={dragging} {...dnd}>
        <span className="small">Drag photos here, or choose them from your phone or computer.</span>
        <button type="button" className="btn btn--trade btn--sm" onClick={onPick}>
          <UploadIcon size={18} /> {label}
        </button>
      </div>
    </>
  );
}

export type { Stroke };
