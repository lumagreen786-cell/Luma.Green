import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";

import { isRecyclingPhotoError, shopQueryArgs } from "./simple-recycling-flow";

vi.mock("@/i18n/navigation", () => ({ useRouter: vi.fn() }));

describe("recycling photo feedback", () => {
  it.each(["PHOTO_NOT_AVAILABLE", "PHOTOS_REQUIRED", "PHOTO_UPLOAD_LIMIT"])(
    "shows actionable photo feedback for %s",
    (code) => {
      expect(isRecyclingPhotoError(new ConvexError(code))).toBe(true);
    },
  );
  it("distinguishes failed image preparation from scheduling and network failures", () => {
    expect(isRecyclingPhotoError(new Error("PHOTO_UPLOAD_FAILED"))).toBe(true);
    expect(isRecyclingPhotoError(new ConvexError("SLOT_PASSED"))).toBe(false);
    expect(isRecyclingPhotoError(new Error("Network unavailable"))).toBe(false);
  });
});

it("discovers only an explicit canonical city, without GPS or pilot inference", () => {
  expect(shopQueryArgs("schedule", undefined, "  new  DELHI , DELHI ")).toEqual(
    {
      city: "New Delhi, Delhi",
      items: [],
    },
  );
  expect(shopQueryArgs("schedule", { lat: 12.9, lng: 77.6 }, "")).toBe("skip");
  expect(shopQueryArgs("details", undefined, "Mumbai, Maharashtra")).toBe(
    "skip",
  );
});
