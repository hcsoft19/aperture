import { describe, expect, it } from "vitest";

import {
  reviewSession,
  type ProtocolAngle,
  type SessionPhotoRef,
} from "@/features/photo-intelligence/completeness/review";

const protocol: ProtocolAngle[] = [
  { id: "front", name: "Front" },
  { id: "left-45", name: "Left 45" },
  { id: "right-45", name: "Right 45" },
];

describe("reviewSession", () => {
  it("is complete when every protocol angle has one photograph", () => {
    const photos: SessionPhotoRef[] = [
      { id: "photo-right", angleId: "right-45" },
      { id: "photo-front", angleId: "front" },
      { id: "photo-left", angleId: "left-45" },
    ];

    expect(reviewSession(protocol, photos)).toEqual({
      missing: [],
      duplicates: [],
      complete: true,
    });
  });

  it("lists a protocol angle that has no photograph", () => {
    const photos: SessionPhotoRef[] = [
      { id: "photo-front", angleId: "front" },
      { id: "photo-right", angleId: "right-45" },
    ];

    expect(reviewSession(protocol, photos)).toEqual({
      missing: [{ id: "left-45", name: "Left 45" }],
      duplicates: [],
      complete: false,
    });
  });

  it("lists photo ids when one angle has two photographs and leaves those photos in place", () => {
    const photos: SessionPhotoRef[] = [
      { id: "photo-front-a", angleId: "front" },
      { id: "photo-left", angleId: "left-45" },
      { id: "photo-front-b", angleId: "front" },
      { id: "photo-right", angleId: "right-45" },
    ];
    const before = photos.map((photo) => ({ ...photo }));

    expect(reviewSession(protocol, photos)).toEqual({
      missing: [],
      duplicates: [
        {
          id: "front",
          name: "Front",
          photoIds: ["photo-front-a", "photo-front-b"],
        },
      ],
      complete: false,
    });
    expect(photos).toEqual(before);
  });

  it("is complete when the protocol has no angles", () => {
    expect(reviewSession([], [])).toEqual({
      missing: [],
      duplicates: [],
      complete: true,
    });
  });
});
