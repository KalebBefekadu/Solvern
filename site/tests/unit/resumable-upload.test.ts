import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadPhotos } from "@/lib/leads/client";
import type { MarkupPhoto } from "@/lib/markup";

const uploadOptions = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(_file: Blob, options: Record<string, unknown>) {
      uploadOptions.current = options;
    }
    findPreviousUploads() {
      return Promise.resolve([]);
    }
    start() {
      (uploadOptions.current?.onProgress as (sent: number, total: number) => void)(3, 6);
      (uploadOptions.current?.onSuccess as () => void)();
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  uploadOptions.current = null;
});

describe("resumable photo uploads", () => {
  it("sends files over 6 MB to the signed TUS target with 6 MB chunks", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        targets: [
          {
            path: "previews/draft/batch/original-1.jpg",
            url: "https://example.com/signed",
            mode: "supabase",
            method: "PUT",
            token: "signed-token",
            tusEndpoint: "https://storage.example.com/storage/v1/upload/resumable",
            bucket: "lead-uploads",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const file = new File([new Uint8Array(6 * 1024 * 1024 + 1)], "photo.jpg", { type: "image/jpeg" });
    const photo: MarkupPhoto = { id: "photo", file, url: "blob:photo", width: 100, height: 100, strokes: [], notes: [] };
    const progress: string[] = [];
    const records = await uploadPhotos([photo], (message) => progress.push(message), {}, "draft");
    expect(records[0].originalPath).toBe("previews/draft/batch/original-1.jpg");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(uploadOptions.current).toMatchObject({
      endpoint: "https://storage.example.com/storage/v1/upload/resumable",
      headers: { "x-signature": "signed-token", "x-upsert": "false" },
      chunkSize: 6 * 1024 * 1024,
      metadata: { bucketName: "lead-uploads", objectName: "previews/draft/batch/original-1.jpg", contentType: "image/jpeg" },
    });
    expect(progress).toContain("Uploading your photos 50%");
  });
});
