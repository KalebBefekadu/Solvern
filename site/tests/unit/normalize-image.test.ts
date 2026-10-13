import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeImage } from "@/lib/server/normalize-image";

describe("uploaded image normalization", () => {
  it("re-encodes original pixels and removes metadata", async () => {
    const input = await sharp({ create: { width: 12, height: 8, channels: 3, background: "red" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "customer@example.com" } } })
      .toBuffer();
    const result = await normalizeImage(input, "original-1.jpg", "original");
    const metadata = await sharp(result.bytes).metadata();
    expect(result.contentType).toBe("image/jpeg");
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.width).toBe(12);
    expect(metadata.height).toBe(8);
  });

  it("rejects false extensions and undecodable bytes", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: "blue" } })
      .png()
      .toBuffer();
    await expect(normalizeImage(png, "original-1.jpg", "original")).rejects.toThrow("format or size");
    await expect(normalizeImage(Buffer.from("not an image"), "original-1.png", "original")).rejects.toThrow("could not be opened");
    await expect(normalizeImage(png, "annotated-1.jpg", "annotated")).rejects.toThrow("supported image");
  });

  it("rejects excessive decoded dimensions", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="1"/>');
    await expect(normalizeImage(svg, "original-1.png", "original")).rejects.toThrow("format or size");
  });
});
