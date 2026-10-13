"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { restoreMarkupPhoto, serializeMarkup, serializeNotes, type MarkupPhoto } from "@/lib/markup";
import { submitLead, uploadPhotos } from "@/lib/leads/client";
import { clearLocalPhotos, deleteLocalPhoto, readLocalPhotos, saveLocalAnnotations, saveLocalFiles } from "@/lib/preview-draft-local";
import { contactErrors } from "@/lib/leads/validate";
import type { FieldErrors } from "@/lib/leads/constants";
import { MarkupTool } from "./MarkupTool";
import { Turnstile, turnstileEnabled } from "./Turnstile";
import { CheckIcon } from "./Icons";
import { useLeadForm } from "./form/useLeadForm";

export interface TradeOption {
  slug: string;
  name: string;
  diagnosis: boolean;
  photoSubject: string;
  formPlaceholder: string;
  exampleNotes: string[];
}

type UploadedPhoto = Awaited<ReturnType<typeof uploadPhotos>>[number];
type DraftReply = {
  id: string;
  sourcePath?: string;
  revision: number;
  photos: { id: string; position: number; record: UploadedPhoto }[];
  finalized?: boolean;
};

interface Props {
  /** Fixed trade (trade pages) or a list to choose from (standalone /concept-preview page). */
  trade?: TradeOption;
  tradeOptions?: TradeOption[];
  /** Preselected option when tradeOptions is used. */
  initial?: TradeOption;
}

export function PreviewForm({ trade, tradeOptions, initial }: Props) {
  const [selected, setSelected] = useState<TradeOption | undefined>(trade ?? initial);
  const current = trade ?? selected;
  const diagnosis = current?.diagnosis ?? false;
  const formName = diagnosis ? "visit" : "concept_preview";

  const [photos, setPhotos] = useState<MarkupPhoto[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<Record<string, UploadedPhoto>>({});
  const draftRef = useRef<{ id: string; revision: number } | null>(null);
  const uploadedRef = useRef<Record<string, UploadedPhoto>>({});
  const pendingMutations = useRef(new Map<string, { id: string; fingerprint: string }>());
  const localFileIds = useRef(new Set<string>());
  const [restoring, setRestoring] = useState(true);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const doneRef = useRef<HTMLDivElement>(null);
  const { formRef, ...f } = useLeadForm(formName, () => ({ trade: current?.slug, photos: photos.length }));

  // Browser recovery is best effort, so still warn before leaving unsent work.
  const unsent = photos.length > 0 && f.status !== "done";
  useEffect(() => {
    if (!unsent) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsent]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    async function restore() {
      try {
        const local = await readLocalPhotos(window.location.pathname).catch(() => []);
        const response = await fetch("/api/preview-drafts", { cache: "no-store" }).catch(() => null);
        const fetched = response?.ok && response.status !== 204 ? ((await response.json()) as DraftReply) : null;
        const draft = fetched?.sourcePath === window.location.pathname ? fetched : null;
        if (draft?.finalized) {
          await clearLocalPhotos(window.location.pathname).catch(() => {});
          return;
        }
        const localById = new Map(local.map((photo) => [photo.id, photo]));
        const serverById = new Map(draft?.photos.map((photo) => [photo.id, photo]) ?? []);
        const restored: MarkupPhoto[] = local.map((photo) => {
          const url = URL.createObjectURL(photo.file);
          urls.push(url);
          return { id: photo.id, file: photo.file, url, width: photo.width, height: photo.height, strokes: photo.strokes, notes: photo.notes };
        });
        for (const saved of draft?.photos ?? []) {
          if (localById.has(saved.id)) continue;
          const fileResponse = await fetch(`/api/preview-drafts/photos/${saved.id}/original`, { cache: "no-store" });
          if (!fileResponse.ok) throw new Error("A saved photo could not be restored. Please reload and try again.");
          const blob = await fileResponse.blob();
          const file = new File([blob], `photo-${saved.id}.jpg`, { type: blob.type });
          const url = URL.createObjectURL(file);
          urls.push(url);
          restored.splice(Math.min(saved.position, restored.length), 0, restoreMarkupPhoto(saved.id, file, url, saved.record));
        }
        if (cancelled) return;
        if (draft) {
          draftRef.current = { id: draft.id, revision: draft.revision };
          uploadedRef.current = Object.fromEntries(draft.photos.map((photo) => [photo.id, photo.record]));
        }
        localFileIds.current = new Set(local.map((photo) => photo.id));
        setPhotos(restored);
        setSavedPhotos(
          Object.fromEntries(
            restored.flatMap((photo) => {
              const saved = serverById.get(photo.id);
              if (!saved) return [];
              const same =
                JSON.stringify(serializeMarkup(photo)) === JSON.stringify(saved.record.strokes) && JSON.stringify(serializeNotes(photo)) === JSON.stringify(saved.record.notes);
              return same ? [[photo.id, saved.record]] : [];
            }),
          ),
        );
      } catch (e) {
        if (!cancelled) setPhotoError(e instanceof Error ? e.message : "Saved photos could not be restored.");
      } finally {
        if (cancelled) urls.forEach(URL.revokeObjectURL);
        else setRestoring(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restoring || f.status === "done") return;
    const newFiles = photos.filter((photo) => !localFileIds.current.has(photo.id));
    newFiles.forEach((photo) => localFileIds.current.add(photo.id));
    const filesSaved = saveLocalFiles(window.location.pathname, newFiles).catch(() => {
      newFiles.forEach((photo) => localFileIds.current.delete(photo.id));
      setPhotoError("Local recovery is unavailable. Keep this page open until your photos are saved.");
    });
    const timer = window.setTimeout(async () => {
      await filesSaved;
      await saveLocalAnnotations(window.location.pathname, photos).catch(() => setPhotoError("Local recovery is unavailable. Keep this page open until your photos are saved."));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [photos, restoring, f.status]);

  const onPhotoChanged = useCallback((id: string) => {
    pendingMutations.current.delete(`save:${id}`);
    setSavedPhotos((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setPhotoError(null);
  }, []);

  const onPhotoRemoved = useCallback(async (id: string) => {
    setSavingPhoto(true);
    setPhotoError(null);
    try {
      if (uploadedRef.current[id] && draftRef.current) {
        const key = `delete:${id}`;
        const mutation = pendingMutations.current.get(key) ?? { id: crypto.randomUUID(), fingerprint: id };
        pendingMutations.current.set(key, mutation);
        const response = await fetch("/api/preview-drafts/photos", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, expectedRevision: draftRef.current.revision, mutationId: mutation.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "This photo could not be removed. Please try again.");
        draftRef.current.revision = data.revision;
        pendingMutations.current.delete(key);
      }
      setSavedPhotos((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      delete uploadedRef.current[id];
      localFileIds.current.delete(id);
      await deleteLocalPhoto(window.location.pathname, id).catch(() => {});
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "This photo could not be removed. Please try again.");
      throw e;
    } finally {
      setSavingPhoto(false);
    }
  }, []);

  async function onSavePhoto(photo: MarkupPhoto) {
    setSavingPhoto(true);
    setPhotoError(null);
    try {
      if (!draftRef.current) {
        if (turnstileEnabled && !f.token) throw new Error("Complete the security check before saving this photo.");
        const response = await fetch("/api/preview-drafts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourcePath: window.location.pathname, turnstileToken: f.token }),
        });
        const data = (await response.json()) as DraftReply & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not start the photo request.");
        draftRef.current = { id: data.id, revision: data.revision };
        f.resetChallenge();
      }
      const [record] = await uploadPhotos([photo], setProgress, uploadedRef.current[photo.id] ? { [photo.id]: uploadedRef.current[photo.id] } : {}, draftRef.current.id);
      uploadedRef.current[photo.id] = record;
      const key = `save:${photo.id}`;
      const fingerprint = JSON.stringify({ position: photos.findIndex((item) => item.id === photo.id), record });
      const prior = pendingMutations.current.get(key);
      const mutation = prior?.fingerprint === fingerprint ? prior : { id: crypto.randomUUID(), fingerprint };
      pendingMutations.current.set(key, mutation);
      const response = await fetch("/api/preview-drafts/photos", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: photo.id,
          position: photos.findIndex((item) => item.id === photo.id),
          expectedRevision: draftRef.current.revision,
          mutationId: mutation.id,
          record,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "This photo could not be saved. Please try again.");
      const savedRecord = data.record as UploadedPhoto;
      if (!savedRecord?.originalPath) throw new Error("This photo could not be confirmed. Please try again.");
      draftRef.current.revision = data.revision;
      pendingMutations.current.delete(key);
      uploadedRef.current[photo.id] = savedRecord;
      setSavedPhotos((current) => ({ ...current, [photo.id]: savedRecord }));
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "This photo could not be saved. Please try again.");
      throw e;
    } finally {
      setSavingPhoto(false);
      setProgress("");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (restoring) return;
    if (photos.some((photo) => !savedPhotos[photo.id])) {
      setPhotoError("Save every photo before sending your request.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const local: FieldErrors = {};
    if (!current) local.tradeSlug = "Choose a trade.";
    if (get("message").length < 3) local.message = diagnosis ? "Tell us what is happening." : "Tell us a little about what you want.";
    if (get("name").length < 2) local.name = "Enter your name.";
    Object.assign(local, contactErrors(get));

    const ok = await f.submit(local, async () => {
      const records = photos.map((photo) => savedPhotos[photo.id]);
      setProgress("Sending your request");
      await submitLead({
        type: formName,
        tradeSlug: current!.slug,
        message: get("message"),
        name: get("name"),
        zip: get("zip"),
        phone: get("phone"),
        email: get("email"),
        company: get("company"),
        turnstileToken: f.token,
        requestId: f.requestId,
        draftId: draftRef.current?.id,
        photoIds: photos.map((photo) => photo.id),
        photos: records,
      });
    });
    setProgress("");
    if (ok) {
      void clearLocalPhotos(window.location.pathname).catch(() => {});
      requestAnimationFrame(() => doneRef.current?.focus());
    }
  }

  const { field, error: err, id: fid } = f;
  const status = f.status;

  const title = diagnosis ? "Request a visit" : "Get my Concept Preview";

  return (
    <div className="see-grid">
      <div className="panel panel--tool">
        {restoring ? (
          <p className="small" role="status">
            Checking saved photos…
          </p>
        ) : (
          <MarkupTool
            photos={photos}
            savedIds={new Set(Object.keys(savedPhotos))}
            saving={savingPhoto || status === "sending"}
            saveError={photoError}
            onSavePhoto={onSavePhoto}
            onChanged={onPhotoChanged}
            onRemoved={onPhotoRemoved}
            setPhotos={(v) => {
              f.onStart();
              setPhotos(v);
            }}
            photoSubject={current?.photoSubject ?? "space"}
            exampleNotes={current?.exampleNotes ?? []}
            diagnosis={diagnosis}
            tradeSlug={current?.slug}
          />
        )}
      </div>

      <div className="panel">
        {status === "done" ? (
          <div className="form-success" ref={doneRef} tabIndex={-1} role="status">
            <span className="form-success__icon">
              <CheckIcon />
            </span>
            <h3 className="h3">Received.</h3>
            <p className="body-l">{diagnosis ? "We will call you back to confirm a time for your visit." : "Your Concept Preview and estimate will arrive within 48 hours."}</p>
            <p className="small">A confirmation is on its way to your email.</p>
          </div>
        ) : (
          <form ref={formRef} className="form" noValidate onSubmit={onSubmit} onFocus={f.onStart} aria-labelledby={fid("title")} aria-busy={status === "sending"}>
            <h3 className="h3" id={fid("title")}>
              {title}
            </h3>

            {tradeOptions && (
              <div className="field">
                <label htmlFor={fid("tradeSlug")}>Trade or project</label>
                <select className="select" {...field("tradeSlug")} value={selected?.slug ?? ""} onChange={(e) => setSelected(tradeOptions.find((t) => t.slug === e.target.value))}>
                  <option value="">Choose a trade</option>
                  {tradeOptions.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {err("tradeSlug")}
              </div>
            )}

            <div className="field">
              <label htmlFor={fid("message")}>{diagnosis ? "What's happening?" : "What would you like?"}</label>
              <textarea className="textarea" rows={3} maxLength={2000} placeholder={current?.formPlaceholder} {...field("message")} />
              {err("message")}
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={fid("name")}>Name</label>
                <input className="input" type="text" autoComplete="name" maxLength={120} {...field("name")} />
                {err("name")}
              </div>
              <div className="field">
                <label htmlFor={fid("zip")}>Zip code</label>
                <input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={10} {...field("zip")} />
                {err("zip")}
              </div>
              <div className="field">
                <label htmlFor={fid("phone")}>Phone</label>
                <input className="input" type="tel" autoComplete="tel" maxLength={30} {...field("phone")} />
                {err("phone")}
              </div>
              <div className="field">
                <label htmlFor={fid("email")}>Email</label>
                <input className="input" type="email" autoComplete="email" maxLength={200} {...field("email")} />
                {err("email")}
              </div>
            </div>

            <div className="hp" aria-hidden="true">
              <label htmlFor={fid("company")}>Company</label>
              <input id={fid("company")} name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <Turnstile active={f.started} onToken={f.onToken} resetKey={f.resetKey} />

            {f.formError && (
              <p className="form-status form-status--error" role="alert">
                {f.formError}
              </p>
            )}

            <button type="submit" className="btn btn--trade btn--block" disabled={status === "sending" || savingPhoto} aria-describedby={fid("promise")}>
              {status === "sending" ? progress || "Sending" : title}
            </button>
            <span className="small" id={fid("promise")} aria-live="polite">
              {diagnosis ? "We call back to confirm a time." : "Your Concept Preview and estimate arrive within 48 hours."}
            </span>
            {photos.length === 0 && (
              <span className="small">
                {diagnosis ? "A photo helps us arrive prepared, but it is optional." : "Adding a photo gets you a Concept Preview. You can also send your request without one."}
              </span>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
