import { describe, it, expect } from "vitest";
import { checkSafeZone } from "../../src/jsx/hostscript/checks/checkSafeZone";
import type { ScopeInfo } from "../../src/jsx/hostscript/types";

// A4縦 アートボード: left=0, top=297, right=210, bottom=0 (Illustrator Y上向き座標系)
// SAFE_ZONE_PT ≈ 8.504
// safe zone: left >= 8.504, top <= 288.496, right <= 201.496, bottom >= 8.504
const scope: ScopeInfo = {
  bounds: [0, 297, 210, 0],
  hasIncompleteMarks: false,
};

describe("checkSafeZone", () => {
  it("Test 1: テキスト bounds=[9, 288, 201, 9]（safe zone 内側）→ WARNING なし（OK）", () => {
    const textFrames = [
      {
        name: "テキスト1",
        geometricBounds: [9, 288, 201, 9] as [number, number, number, number],
      },
    ];
    const results = checkSafeZone(textFrames, scope);
    expect(results).toHaveLength(0);
  });

  it("Test 2: テキスト bounds=[5, 292, 205, 5]（safe zone 外にはみ出す）→ WARNING / messageKey: BLEED_SAFE_ZONE_01", () => {
    const textFrames = [
      {
        name: "テキスト2",
        geometricBounds: [5, 292, 205, 5] as [number, number, number, number],
      },
    ];
    const results = checkSafeZone(textFrames, scope);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("BLEED_SAFE_ZONE_01");
    expect(results[0].targetRef).toMatchObject({
      kind: "textFrame",
      messageKey: "BLEED_SAFE_ZONE_01",
      objectName: "テキスト2",
      collectionIndex: 0,
    });
  });

  it("Test 3: テキスト bounds=[0, 297, 210, 0]（アートボード境界にぴったり）→ WARNING（セーフゾーン外）", () => {
    const textFrames = [
      {
        name: "テキスト3",
        geometricBounds: [0, 297, 210, 0] as [number, number, number, number],
      },
    ];
    const results = checkSafeZone(textFrames, scope);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
  });

  it("Test 4: テキストが複数ある場合、各テキストフレームを個別にチェックする", () => {
    const textFrames = [
      {
        name: "OK テキスト",
        geometricBounds: [9, 288, 201, 9] as [number, number, number, number],
      },
      {
        name: "NG テキスト",
        geometricBounds: [5, 292, 205, 5] as [number, number, number, number],
      },
    ];
    const results = checkSafeZone(textFrames, scope);
    // OK テキストは WARNING なし、NG テキストは WARNING あり
    expect(results).toHaveLength(1);
    expect(results[0].objectName).toBe("NG テキスト");
  });

  it("Test 5: 空配列 → 空配列", () => {
    const results = checkSafeZone([], scope);
    expect(results).toHaveLength(0);
  });

  it("Test 6: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    const nativeLike = Object.assign(Object.create(null), {
      0: 5,
      1: 292,
      2: 205,
      3: 5,
      length: 4,
    });
    const textFrames = [
      {
        name: "テキスト",
        geometricBounds: nativeLike,
      },
    ];
    const results = checkSafeZone(textFrames, scope);
    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([5, 292, 205, 5]);
  });
});
