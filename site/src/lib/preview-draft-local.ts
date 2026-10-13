import type { MarkupPhoto, Note, Stroke } from "./markup";

const DB_NAME = "solvern-preview-drafts";

interface LocalFile {
  id: string;
  file: File;
  width: number;
  height: number;
  savedAt: number;
}
interface LocalAnnotations {
  id: string;
  position: number;
  strokes: Stroke[];
  notes: Note[];
}
export interface LocalPhoto extends LocalFile, LocalAnnotations {}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

function transaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function database(scope: string): Promise<IDBDatabase> {
  if (!window.indexedDB) throw new Error("Local photo recovery is unavailable in this browser.");
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(`${DB_NAME}:${encodeURIComponent(scope)}`, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      db.createObjectStore("files", { keyPath: "id" });
      db.createObjectStore("annotations", { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

export async function readLocalPhotos(scope: string): Promise<LocalPhoto[]> {
  const db = await database(scope);
  try {
    const tx = db.transaction(["files", "annotations"], "readonly");
    const [files, annotations] = await Promise.all([
      request(tx.objectStore("files").getAll() as IDBRequest<LocalFile[]>),
      request(tx.objectStore("annotations").getAll() as IDBRequest<LocalAnnotations[]>),
    ]);
    const byId = new Map(annotations.map((item) => [item.id, item]));
    return files
      .flatMap((file) => {
        if (file.savedAt && Date.now() - file.savedAt > 7 * 24 * 60 * 60 * 1000) {
          void deleteLocalPhoto(scope, file.id).catch(() => {});
          return [];
        }
        const markup = byId.get(file.id);
        return markup ? [{ ...file, ...markup }] : [];
      })
      .sort((a, b) => a.position - b.position);
  } finally {
    db.close();
  }
}

export async function saveLocalFiles(scope: string, photos: MarkupPhoto[]): Promise<void> {
  if (!photos.length) return;
  const db = await database(scope);
  try {
    const tx = db.transaction("files", "readwrite");
    for (const photo of photos) tx.objectStore("files").put({ id: photo.id, file: photo.file, width: photo.width, height: photo.height, savedAt: Date.now() } satisfies LocalFile);
    await transaction(tx);
  } finally {
    db.close();
  }
}

export async function saveLocalAnnotations(scope: string, photos: MarkupPhoto[]): Promise<void> {
  const db = await database(scope);
  try {
    const tx = db.transaction("annotations", "readwrite");
    photos.forEach((photo, position) => tx.objectStore("annotations").put({ id: photo.id, position, strokes: photo.strokes, notes: photo.notes } satisfies LocalAnnotations));
    await transaction(tx);
  } finally {
    db.close();
  }
}

export async function deleteLocalPhoto(scope: string, id: string): Promise<void> {
  const db = await database(scope);
  try {
    const tx = db.transaction(["files", "annotations"], "readwrite");
    tx.objectStore("files").delete(id);
    tx.objectStore("annotations").delete(id);
    await transaction(tx);
  } finally {
    db.close();
  }
}

export async function clearLocalPhotos(scope: string): Promise<void> {
  const db = await database(scope);
  try {
    const tx = db.transaction(["files", "annotations"], "readwrite");
    tx.objectStore("files").clear();
    tx.objectStore("annotations").clear();
    await transaction(tx);
  } finally {
    db.close();
  }
}
