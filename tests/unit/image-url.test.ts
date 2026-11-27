import { describe, expect, it } from "vitest";
import { cloudinaryImageUrl, IMAGE_WIDTHS } from "@/lib/media/image-url";

describe("image delivery", () => {
  it("uses a fixed named width with automatic format and quality", () => {
    const url = cloudinaryImageUrl("konnekt/posts/a", "card", "demo");
    expect(url).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/konnekt/posts/a");
    expect(url).not.toContain("q_80");
  });

  it("keeps the named width set small and ordered", () => {
    expect(Object.keys(IMAGE_WIDTHS)).toEqual(["avatar", "thumb", "card", "cover", "full"]);
    expect(IMAGE_WIDTHS.card).toBeLessThan(IMAGE_WIDTHS.cover);
  });
});
