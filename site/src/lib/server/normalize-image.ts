import sharp from "sharp";
import { MAX_PHOTO_BYTES } from "@/lib/leads/constants";
import { HttpError } from "./http";

const MAX_EDGE = 8192;
const MAX_PIXELS = 32_000_000;

export type ImageKind = "original" | "annotated";

const expectedFormat: Record<string, string> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  heic: "heif",
  heif: "heif",
};

/** Decode untrusted uploads and emit new pixels without metadata. Never retain the signed-upload object as the saved image. */
export async function normalizeImage(bytes: Buffer, filename: string, kind: ImageKind): Promise<{ bytes: Buffer; extension: "jpg" | "png"; contentType: string }> {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new HttpError(422, "This photo is too large. Please choose a file under 15 MB.");
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const expected = expectedFormat[extension];
  if (!expected || (kind === "annotated" && expected !== "png")) throw new HttpError(422, "Choose a supported image file.");

  try {
    const input = sharp(bytes, { failOn: "error", limitInputPixels: MAX_PIXELS, animated: false });
    const metadata = await input.metadata();
    if (
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_EDGE ||
      metadata.height > MAX_EDGE ||
      metadata.width * metadata.height > MAX_PIXELS ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new HttpError(422, "This image format or size is not supported. Please choose another photo.");
    }
    const output = kind === "annotated" ? input.rotate().png({ compressionLevel: 7 }) : input.rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 86 });
    const normalized = await output.toBuffer();
    if (normalized.length > MAX_PHOTO_BYTES) throw new HttpError(422, "This image is too large after processing. Please choose a smaller photo.");
    return { bytes: normalized, extension: kind === "annotated" ? "png" : "jpg", contentType: kind === "annotated" ? "image/png" : "image/jpeg" };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, "This photo could not be opened. Please choose a valid image file.");
  }
}
