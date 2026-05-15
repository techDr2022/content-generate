import { describe, it, expect } from "vitest";
import { splitCaptionAndHashtags } from "@/lib/server/services/reviewCaptionSplit";

describe("splitCaptionAndHashtags", () => {
  it("extracts hashtags", () => {
    const r = splitCaptionAndHashtags("Hello world #Foo #Bar_1");
    expect(r.hashtags).toBe("Foo, Bar_1");
    expect(r.caption).toBe("Hello world");
  });
});
