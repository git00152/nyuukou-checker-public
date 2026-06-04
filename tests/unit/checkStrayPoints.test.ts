import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { checkStrayPoints } from "../../src/jsx/hostscript/checks/checkStrayPoints";

describe("checkStrayPoints", () => {
  it("PATH-02: pathPoints.length === 1 のパスを WARNING / PATH_STRAY_01 として検出する", () => {
    const mockPathItems = [
      {
        pathPoints: [{ anchor: [10, 20] }],
        name: "stray1",
        layer: { name: "Layer 1" },
        geometricBounds: [10, 20, 10, 20],
      },
    ] as unknown as PathItem[];

    const results = checkStrayPoints(mockPathItems);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("PATH_STRAY_01");
    expect(results[0].objectName).toBe("stray1");
    expect(results[0].layerName).toBe("Layer 1");
  });

  it("PATH-02: pathPoints.length > 1 のパスは検出しない", () => {
    const mockPathItems = [
      {
        pathPoints: [
          { anchor: [10, 20] },
          { anchor: [30, 40] },
        ],
        name: "line1",
        layer: { name: "Layer 1" },
        geometricBounds: [10, 40, 30, 20],
      },
    ] as unknown as PathItem[];

    const results = checkStrayPoints(mockPathItems);
    expect(results).toHaveLength(0);
  });

  it("PATH-02: 複数のパスのうち孤立点のみ検出する", () => {
    const mockPathItems = [
      {
        pathPoints: [{ anchor: [10, 20] }],
        name: "stray1",
        layer: { name: "Layer 1" },
        geometricBounds: [10, 20, 10, 20],
      },
      {
        pathPoints: [
          { anchor: [0, 0] },
          { anchor: [100, 100] },
        ],
        name: "line1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
      },
    ] as unknown as PathItem[];

    const results = checkStrayPoints(mockPathItems);
    expect(results).toHaveLength(1);
    expect(results[0].objectName).toBe("stray1");
  });

  it("PATH-02: 空配列を渡すと空配列を返す", () => {
    const results = checkStrayPoints([] as unknown as PathItem[]);
    expect(results).toHaveLength(0);
  });

  it("PATH-02: ソースファイル内の message 文字列リテラルが日本語 UTF-8 バイトを含まないこと — CEP 文字化け防止", () => {
    // CEP ブリッジは UTF-8 日本語リテラルを Shift-JIS として解釈して文字化けさせる。
    // message は Unicode エスケープ形式（全 ASCII バイト）でなければならない。
    const srcPath = path.resolve(
      __dirname,
      "../../src/jsx/hostscript/checks/checkStrayPoints.ts"
    );
    const rawBytes = fs.readFileSync(srcPath);
    const marker = Buffer.from('message: "');
    const messageByteStart = rawBytes.indexOf(marker);
    expect(messageByteStart).toBeGreaterThan(-1);
    let hasHighByte = false;
    for (let i = messageByteStart + marker.length; i < rawBytes.length; i++) {
      const byte = rawBytes[i];
      if (byte === 0x22) break;
      if (byte > 0x7f) { hasHighByte = true; break; }
    }
    expect(hasHighByte).toBe(false);
  });

  it("PATH-02: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    const nativeLike = Object.assign(Object.create(null), {
      0: 10,
      1: 20,
      2: 10,
      3: 20,
      length: 4,
    });
    const mockPathItems = [
      {
        pathPoints: [{ anchor: [10, 20] }],
        name: "stray",
        layer: { name: "Layer 1" },
        geometricBounds: nativeLike,
      },
    ] as unknown as PathItem[];

    const results = checkStrayPoints(mockPathItems);

    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([10, 20, 10, 20]);
  });
});
