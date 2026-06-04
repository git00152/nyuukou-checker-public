// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/jsx/hostscript/inspector", () => ({
  collectPathItems: vi.fn(() => []),
  collectPlacedItems: vi.fn(() => []),
  collectRasterItems: vi.fn(() => []),
  collectTextFrames: vi.fn(() => []),
}));

import { collectPathItems, collectPlacedItems, collectRasterItems, collectTextFrames } from "../../src/jsx/hostscript/inspector";
import { cleanupCheckTargets, deleteCheckTarget, selectCheckTarget } from "../../src/jsx/hostscript/actions/targetActions";
import type { CheckTargetRef } from "../../src/jsx/hostscript/types";

const mockRedraw = vi.fn();

function makePath(overrides: Record<string, unknown> = {}) {
  return {
    name: "stray",
    layer: { name: "Artwork" },
    geometricBounds: [0, 10, 10, 0],
    closed: false,
    filled: false,
    stroked: false,
    strokeWidth: 0,
    pathPoints: [{}],
    selected: false,
    remove: vi.fn(),
    ...overrides,
  };
}

function makePathRef(overrides: Partial<CheckTargetRef> = {}): CheckTargetRef {
  return {
    kind: "pathItem",
    messageKey: "PATH_STRAY_01",
    layerName: "Artwork",
    objectName: "stray",
    bounds: [0, 10, 10, 0],
    collectionIndex: 0,
    signature: "closed=false|filled=false|stroked=false|strokeWidth=0.000|pathPoints=1|bounds=0.000,10.000,10.000,0.000",
    ...overrides,
  };
}

function makeTextFrame(overrides: Record<string, unknown> = {}) {
  return {
    name: "live-text",
    contents: "aaaa",
    layer: { name: "Artwork" },
    geometricBounds: [0, 10, 10, 0],
    selected: false,
    ...overrides,
  };
}

function makeTextFrameRef(overrides: Partial<CheckTargetRef> = {}): CheckTargetRef {
  return {
    kind: "textFrame",
    messageKey: "TEXT_LIVE_01",
    layerName: "Artwork",
    objectName: "live-text",
    bounds: [0, 10, 10, 0],
    collectionIndex: 0,
    signature: "textFrame=true|bounds=0.000,10.000,10.000,0.000",
    ...overrides,
  };
}

function makeImageItem(overrides: Record<string, unknown> = {}) {
  return {
    typename: "PlacedItem",
    name: "image.psd",
    layer: { name: "Artwork" },
    geometricBounds: [0, 10, 10, 0],
    file: { fsName: "/tmp/image.psd" },
    selected: false,
    ...overrides,
  };
}

function makeImageRef(overrides: Partial<CheckTargetRef> = {}): CheckTargetRef {
  return {
    kind: "placedItem",
    messageKey: "IMG_RESOLUTION_LOW_01",
    layerName: "Artwork",
    objectName: "image.psd",
    bounds: [0, 10, 10, 0],
    collectionIndex: 0,
    signature: "typename=PlacedItem|file=/tmp/image.psd|bounds=0.000,10.000,10.000,0.000",
    ...overrides,
  };
}

describe("targetActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("app", {
      activeDocument: {
        selection: null,
        swatches: [],
        allPageItems: [],
      },
      redraw: mockRedraw,
    });
  });

  it("selectCheckTarget は一意に見つかった PathItem を選択する", () => {
    const path = makePath();
    vi.mocked(collectPathItems).mockReturnValue([path] as unknown as ReturnType<typeof collectPathItems>);

    const result = selectCheckTarget(makePathRef());

    expect(result.ok).toBe(true);
    expect(path.selected).toBe(true);
    expect(mockRedraw).toHaveBeenCalledOnce();
  });

  it("selectCheckTarget は検出結果種別が PATH_STRAY_01 以外でも PathItem を選択する", () => {
    const path = makePath();
    vi.mocked(collectPathItems).mockReturnValue([path] as unknown as ReturnType<typeof collectPathItems>);

    const result = selectCheckTarget(makePathRef({
      messageKey: "CUSTOM_PATH_CHECK_01",
    }));

    expect(result.ok).toBe(true);
    expect(path.selected).toBe(true);
  });

  it("selectCheckTarget は TextFrame を選択する", () => {
    const select = vi.fn();
    const textFrame = makeTextFrame({ textRange: { select } });
    vi.mocked(collectTextFrames).mockReturnValue([textFrame] as unknown as ReturnType<typeof collectTextFrames>);

    const result = selectCheckTarget(makeTextFrameRef());

    expect(result.ok).toBe(true);
    expect(textFrame.selected).toBe(true);
    expect(select).toHaveBeenCalledOnce();
    expect(mockRedraw).toHaveBeenCalledOnce();
  });

  it("selectCheckTarget は targetRef 作成時に contents がなくても TextFrame を選択する", () => {
    const textFrame = makeTextFrame({ contents: "実際のテキスト" });
    vi.mocked(collectTextFrames).mockReturnValue([textFrame] as unknown as ReturnType<typeof collectTextFrames>);

    const result = selectCheckTarget(makeTextFrameRef({
      messageKey: "BLEED_SAFE_ZONE_01",
      signature: "textFrame=true|bounds=0.000,10.000,10.000,0.000",
    }));

    expect(result.ok).toBe(true);
    expect(textFrame.selected).toBe(true);
  });

  it("selectCheckTarget は PlacedItem を選択する", () => {
    const image = makeImageItem();
    vi.mocked(collectPlacedItems).mockReturnValue([image] as unknown as ReturnType<typeof collectPlacedItems>);

    const result = selectCheckTarget(makeImageRef());

    expect(result.ok).toBe(true);
    expect(image.selected).toBe(true);
    expect(mockRedraw).toHaveBeenCalledOnce();
  });

  it("selectCheckTarget は RasterItem を選択する", () => {
    const image = makeImageItem({ typename: "RasterItem", file: undefined });
    vi.mocked(collectRasterItems).mockReturnValue([image] as unknown as ReturnType<typeof collectRasterItems>);

    const result = selectCheckTarget(makeImageRef({
      kind: "rasterItem",
      signature: "typename=RasterItem|file=|bounds=0.000,10.000,10.000,0.000",
    }));

    expect(result.ok).toBe(true);
    expect(image.selected).toBe(true);
  });

  it("候補が複数残る場合は AMBIGUOUS を返して選択しない", () => {
    const path1 = makePath();
    const path2 = makePath();
    vi.mocked(collectPathItems).mockReturnValue([path1, path2] as unknown as ReturnType<typeof collectPathItems>);

    const result = selectCheckTarget(makePathRef({ collectionIndex: undefined }));

    expect(result).toMatchObject({ ok: false, reason: "AMBIGUOUS" });
    expect(path1.selected).toBe(false);
    expect(path2.selected).toBe(false);
  });

  it("PATH_STRAY_01 は削除直前に pathPoints.length === 1 を再確認して削除する", () => {
    const remove = vi.fn();
    const path = makePath({ remove });
    vi.mocked(collectPathItems).mockReturnValue([path] as unknown as ReturnType<typeof collectPathItems>);

    const result = deleteCheckTarget(makePathRef());

    expect(result).toMatchObject({ ok: true, deletedCount: 1, failedCount: 0 });
    expect(remove).toHaveBeenCalledOnce();
  });

  it("孤立点でなくなった PATH_STRAY_01 は削除しない", () => {
    const remove = vi.fn();
    const path = makePath({ pathPoints: [{}, {}], remove });
    vi.mocked(collectPathItems).mockReturnValue([path] as unknown as ReturnType<typeof collectPathItems>);

    const result = deleteCheckTarget(makePathRef({
      signature: "closed=false|filled=false|stroked=false|strokeWidth=0.000|pathPoints=2|bounds=0.000,10.000,10.000,0.000",
    }));

    expect(result).toMatchObject({ ok: false, reason: "INVALID_TARGET_REF" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("未使用スウォッチを削除し、使用中スウォッチは削除しない", () => {
    const unusedRemove = vi.fn();
    vi.stubGlobal("app", {
      activeDocument: {
        swatches: [{ name: "Unused Spot", remove: unusedRemove }],
        allPageItems: [],
      },
      redraw: mockRedraw,
    });

    expect(deleteCheckTarget({
      kind: "swatch",
      messageKey: "COLOR_UNUSED_SWATCH_01",
      swatchName: "Unused Spot",
    })).toMatchObject({ ok: true, deletedCount: 1 });
    expect(unusedRemove).toHaveBeenCalledOnce();

    const usedRemove = vi.fn();
    vi.stubGlobal("app", {
      activeDocument: {
        swatches: [{ name: "Used Spot", remove: usedRemove }],
        allPageItems: [{ fillColor: { typename: "SpotColor", spot: { name: "Used Spot" } } }],
      },
      redraw: mockRedraw,
    });

    expect(deleteCheckTarget({
      kind: "swatch",
      messageKey: "COLOR_UNUSED_SWATCH_01",
      swatchName: "Used Spot",
    })).toMatchObject({ ok: false, reason: "STILL_IN_USE" });
    expect(usedRemove).not.toHaveBeenCalled();
  });

  it("cleanupCheckTargets は同じ messageKey の targetRef だけを削除する", () => {
    const remove = vi.fn();
    const path = makePath({ remove });
    vi.mocked(collectPathItems).mockReturnValue([path] as unknown as ReturnType<typeof collectPathItems>);

    const result = cleanupCheckTargets("PATH_STRAY_01", [
      makePathRef(),
      makePathRef({ messageKey: "PATH_OPEN_01" }),
    ]);

    expect(result).toMatchObject({ ok: false, deletedCount: 1, failedCount: 1, reason: "INVALID_TARGET_REF" });
    expect(remove).toHaveBeenCalledOnce();
  });
});
