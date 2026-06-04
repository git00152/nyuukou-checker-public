import { describe, it, expect } from "vitest";
import { checkThinLines } from "../../src/jsx/hostscript/checks/checkThinLines";

// 0.1mm = 0.28346pt（正確な変換値）
// 正しい閾値: THIN_LINE_THRESHOLD_PT = 0.284（0.283 では 0.28346 を見逃す）
const THIN_LINE_THRESHOLD = 0.284;

describe("checkThinLines", () => {
  it("PATH-03: stroked=true かつ strokeWidth < 0.284 のパスを WARNING / PATH_THIN_LINE_01 として検出する", () => {
    const mockPathItems = [
      {
        stroked: true,
        strokeWidth: 0.1,
        name: "thin1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
      },
    ] as unknown as PathItem[];

    const results = checkThinLines(mockPathItems);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("PATH_THIN_LINE_01");
    expect(results[0].objectName).toBe("thin1");
    expect(results[0].layerName).toBe("Layer 1");
  });

  it("PATH-03: strokeWidth = 0.28346pt (0.1mm の正確な値) は WARNING として検出する", () => {
    const items = [
      {
        stroked: true,
        strokeWidth: 0.28346,
        name: "exact01mm",
        layer: { name: "L1" },
        geometricBounds: [0, 100, 100, 0],
      },
    ] as unknown as PathItem[];
    const results = checkThinLines(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
  });

  it("PATH-03: strokeWidth = 0.284pt 以上のパスは検出しない", () => {
    const mockPathItems = [
      {
        stroked: true,
        strokeWidth: 0.284,
        name: "ok1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
      },
      {
        stroked: true,
        strokeWidth: 1.0,
        name: "ok2",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
      },
    ] as unknown as PathItem[];

    const results = checkThinLines(mockPathItems);
    expect(results).toHaveLength(0);
  });

  it("PATH-03: stroked=false のパスは検出しない（線なしパス）", () => {
    const mockPathItems = [
      {
        stroked: false,
        strokeWidth: 0.1,
        name: "noStroke",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
      },
    ] as unknown as PathItem[];

    const results = checkThinLines(mockPathItems);
    expect(results).toHaveLength(0);
  });

  it("PATH-03: 複数パスから細線のみ検出する", () => {
    const mockPathItems = [
      {
        stroked: true,
        strokeWidth: 0.1,
        name: "thin1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
      },
      {
        stroked: true,
        strokeWidth: 1.0,
        name: "normal1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
      },
      {
        stroked: true,
        strokeWidth: 0.2,
        name: "thin2",
        layer: { name: "Layer 2" },
        geometricBounds: [0, 50, 50, 0],
      },
    ] as unknown as PathItem[];

    const results = checkThinLines(mockPathItems);
    expect(results).toHaveLength(2);
    expect(results[0].objectName).toBe("thin1");
    expect(results[1].objectName).toBe("thin2");
  });

  it("PATH-03: 空配列を渡すと空配列を返す", () => {
    const results = checkThinLines([] as unknown as PathItem[]);
    expect(results).toHaveLength(0);
  });

  it("PATH-03: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    const nativeLike = Object.assign(Object.create(null), {
      0: 0,
      1: 100,
      2: 100,
      3: 0,
      length: 4,
    });
    const mockPathItems = [
      {
        stroked: true,
        strokeWidth: 0.1,
        name: "thin",
        layer: { name: "Layer 1" },
        geometricBounds: nativeLike,
      },
    ] as unknown as PathItem[];

    const results = checkThinLines(mockPathItems);

    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([0, 100, 100, 0]);
  });
});
