import { describe, it, expect } from "vitest";
import {
  artboardRectToRect,
  geometricBoundsToRect,
  BLEED_PT,
  SAFE_ZONE_PT,
  isOutsideBleedZone,
  isInsideSafeZone,
  overlapsArtboard,
} from "../../src/jsx/hostscript/utils/coordinateUtils";

describe("coordinateUtils", () => {
  // Test 1: artboardRectToRect の変換
  it("COORD-01: artboardRectToRect([10, 297, 210, 0]) が正しい Rect を返す", () => {
    const result = artboardRectToRect([10, 297, 210, 0]);
    expect(result).toEqual({ left: 10, top: 297, right: 210, bottom: 0 });
  });

  // Test 2: BLEED_PT ≈ 8.504
  it("COORD-02: BLEED_PT は 3mm を pt に変換した値 (≈8.504) である", () => {
    // 3 * (72 / 25.4) = 8.503937...
    expect(BLEED_PT).toBeCloseTo(8.504, 2);
  });

  // Test 3: SAFE_ZONE_PT ≈ 8.504
  it("COORD-03: SAFE_ZONE_PT は 3mm を pt に変換した値 (≈8.504) である", () => {
    expect(SAFE_ZONE_PT).toBeCloseTo(8.504, 2);
  });

  // Test 4: isOutsideBleedZone — 完全にアートボード内側のオブジェクト → false（塗り足し不要）
  it("COORD-04: isOutsideBleedZone — artboard 内側のみのオブジェクトは false を返す（塗り足し不要）", () => {
    // artboard: [0, 100, 100, 0]
    // item bounds: [1, 99, 99, 1] — artboard 内側のみ（どの端にも接触していない）
    // 完全に内側のオブジェクト（テキスト・アイコン等）は塗り足し不要
    const result = isOutsideBleedZone([1, 99, 99, 1], [0, 100, 100, 0]);
    expect(result).toBe(false);
  });

  // Test 5: isOutsideBleedZone — bleed zone に到達済み → false（OK）
  it("COORD-05: isOutsideBleedZone — artboard 外側 3mm 超のオブジェクトは false を返す", () => {
    // artboard: [0, 100, 100, 0]
    // item bounds: [-10, 110, 110, -10] — bleed zone (-8.504, 108.504, 108.504, -8.504) を超えている
    const result = isOutsideBleedZone([-10, 110, 110, -10], [0, 100, 100, 0]);
    expect(result).toBe(false);
  });

  // Test 6: isOutsideBleedZone — artboard 内側のみ → false（塗り足し不要）
  it("COORD-06: isOutsideBleedZone — artboard 内側のみなら false を返す（塗り足し対象外）", () => {
    // artboard: [0, 297, 210, 0]
    // item bounds: [10, 280, 200, 10] — artboard 内側のみ（端に接触していない）
    const result = isOutsideBleedZone([10, 280, 200, 10], [0, 297, 210, 0]);
    expect(result).toBe(false);
  });

  // Test 6a: isOutsideBleedZone — artboard 端に接触しているが bleed 未到達 → true（WARNING）
  it("COORD-06a: isOutsideBleedZone — artboard 端に接触しているが bleed 未到達なら true を返す", () => {
    // artboard: [0, 100, 100, 0]
    // item bounds: [0, 100, 100, 0] — artboard と同じサイズ（端に接触しているが bleed 未到達）
    const result = isOutsideBleedZone([0, 100, 100, 0], [0, 100, 100, 0]);
    expect(result).toBe(true);
  });

  // Test 6b: isOutsideBleedZone — 左端のみ接触して bleed 未到達 → true（WARNING）
  it("COORD-06b: isOutsideBleedZone — 左端のみ接触しているが bleed 未到達なら true を返す", () => {
    // artboard: [0, 100, 100, 0]
    // item: left=0（artboard 左端に接触）だが left > bleedLeft(-8.504) で bleed 未到達
    const result = isOutsideBleedZone([0, 50, 50, 10], [0, 100, 100, 0]);
    expect(result).toBe(true);
  });

  // Test 6c: isOutsideBleedZone — 左端に接触して bleed 到達済み → false（OK）
  it("COORD-06c: isOutsideBleedZone — 左端接触かつ bleed 到達済みなら false を返す", () => {
    // artboard: [0, 100, 100, 0]
    // item: left=-10（bleedLeft=-8.504 を超えている）
    const result = isOutsideBleedZone([-10, 50, 50, 10], [0, 100, 100, 0]);
    expect(result).toBe(false);
  });

  // Test 7: isInsideSafeZone — テキストが safe zone 内側 → true（OK）
  it("COORD-07: isInsideSafeZone — テキストが artboard 内側 3mm より内側なら true を返す", () => {
    // artboard: [0, 100, 100, 0]
    // safe zone: left=8.504, top=91.496, right=91.496, bottom=8.504
    // item: [10, 90, 90, 10] — safe zone 内側
    const result = isInsideSafeZone([10, 90, 90, 10], [0, 100, 100, 0]);
    expect(result).toBe(true);
  });

  // Test 8: isInsideSafeZone — テキストが safe zone 外にはみ出す → false（WARNING 対象）
  it("COORD-08: isInsideSafeZone — テキストが artboard 内側 3mm 外にはみ出すなら false を返す", () => {
    // artboard: [0, 100, 100, 0]
    // safe zone: left=8.504, top=91.496, right=91.496, bottom=8.504
    // item: [5, 95, 95, 5] — safe zone 外にはみ出している
    const result = isInsideSafeZone([5, 95, 95, 5], [0, 100, 100, 0]);
    expect(result).toBe(false);
  });

  // Test 7b: isInsideSafeZone — セーフゾーン境界ぴったりのオブジェクト → true（境界上は OK）
  it("COORD-07b: isInsideSafeZone — safe zone 境界ぴったりのオブジェクトは true（境界上は内側扱い）", () => {
    // artboard: [0, 100, 100, 0], safe zone: [8.504, 91.496, 91.496, 8.504]
    // item bounds が safe zone 境界ぴったり（浮動小数点誤差を考慮した許容）
    const safePt = SAFE_ZONE_PT;
    const result = isInsideSafeZone(
      [safePt, 100 - safePt, 100 - safePt, safePt],
      [0, 100, 100, 0]
    );
    expect(result).toBe(true);
  });

  // Test 9: Y 軸上向き確認
  it("COORD-09: Illustrator Y 軸確認 — artboardRect の top(297) > bottom(0)、safe zone は top から引き bottom に足す", () => {
    // artboard: [0, 297, 210, 0] (A4縦: left=0, top=297, right=210, bottom=0)
    // safe zone: left=8.504, top=297-8.504=288.496, right=210-8.504=201.496, bottom=0+8.504=8.504
    // item が safe zone に正確に収まるケース
    const insideItem: [number, number, number, number] = [9, 288, 201, 9];
    expect(isInsideSafeZone(insideItem, [0, 297, 210, 0])).toBe(true);
    // item が safe zone を少しはみ出すケース（top が safe top より大きい = Illustrator Y上向きで上方向）
    const outsideItem: [number, number, number, number] = [9, 290, 201, 9];
    expect(isInsideSafeZone(outsideItem, [0, 297, 210, 0])).toBe(false);
  });

  // --- overlapsArtboard テスト ---

  // Test 10: アートボードと完全に重なる
  it("COORD-10: overlapsArtboard — アートボードと完全一致するオブジェクトは true", () => {
    expect(overlapsArtboard([0, 100, 100, 0], [0, 100, 100, 0])).toBe(true);
  });

  // Test 11: アートボード内側にあるオブジェクト
  it("COORD-11: overlapsArtboard — アートボード内側のオブジェクトは true", () => {
    expect(overlapsArtboard([10, 80, 90, 20], [0, 100, 100, 0])).toBe(true);
  });

  // Test 12: アートボード外（左）に完全にあるオブジェクト
  it("COORD-12: overlapsArtboard — アートボード左外に完全にあるオブジェクトは false", () => {
    expect(overlapsArtboard([-50, 80, -10, 20], [0, 100, 100, 0])).toBe(false);
  });

  // Test 13: アートボード外（右）に完全にあるオブジェクト
  it("COORD-13: overlapsArtboard — アートボード右外に完全にあるオブジェクトは false", () => {
    expect(overlapsArtboard([110, 80, 200, 20], [0, 100, 100, 0])).toBe(false);
  });

  // Test 14: アートボード外（上）に完全にあるオブジェクト（Y上向き: top > artboard.top）
  it("COORD-14: overlapsArtboard — アートボード上方外（Y上向き）に完全にあるオブジェクトは false", () => {
    // Y上向き: item.bottom > artboard.top → item は artboard より上に完全にある
    expect(overlapsArtboard([10, 200, 90, 110], [0, 100, 100, 0])).toBe(false);
  });

  // Test 15: アートボード外（下）に完全にあるオブジェクト（Y上向き: top < artboard.bottom）
  it("COORD-15: overlapsArtboard — アートボード下方外（Y上向き）に完全にあるオブジェクトは false", () => {
    // Y上向き: item.top < artboard.bottom → item は artboard より下に完全にある
    expect(overlapsArtboard([10, -10, 90, -50], [0, 100, 100, 0])).toBe(false);
  });

  // Test 16: アートボード端に接するオブジェクト（bleed など）
  it("COORD-16: overlapsArtboard — アートボード端から外にはみ出るオブジェクトは true（部分重複）", () => {
    // bleed オブジェクトはアートボード外にはみ出すが一部重複あり
    expect(overlapsArtboard([-10, 110, 110, -10], [0, 100, 100, 0])).toBe(true);
  });

  // Test 17: アートボード外にあるオブジェクト（ペーストボード上のスケッチ等）
  it("COORD-17: overlapsArtboard — アートボードから完全に離れたオブジェクトは false", () => {
    // アートボード [0,100,100,0] の左下に存在するオブジェクト
    expect(overlapsArtboard([-200, -100, -100, -200], [0, 100, 100, 0])).toBe(false);
  });

  // --- isOutsideBleedZone 浮動小数点許容テスト ---

  // Test 18: bleed 境界ぴったりのオブジェクト → false（OK、塗り足し十分）
  it("COORD-18: isOutsideBleedZone — bleed 境界ぴったりのオブジェクトは false（塗り足し十分）", () => {
    // artboard: [0, 100, 100, 0]
    // item が四辺とも bleed 境界にぴったり: [-BLEED_PT, 100+BLEED_PT, 100+BLEED_PT, -BLEED_PT]
    const result = isOutsideBleedZone(
      [-BLEED_PT, 100 + BLEED_PT, 100 + BLEED_PT, -BLEED_PT],
      [0, 100, 100, 0]
    );
    expect(result).toBe(false);
  });

  // Test 19: bleed 境界から 0.05pt 内側（epsilon 範囲内）のオブジェクト → false（浮動小数点誤差を許容）
  it("COORD-19: isOutsideBleedZone — bleed 境界から 0.05pt 内側は false（epsilon 範囲内）", () => {
    // item が四辺とも bleed 境界から 0.05pt 内側（epsilon=0.1 未満） → 警告不要
    const d = 0.05;
    const result = isOutsideBleedZone(
      [-BLEED_PT + d, 100 + BLEED_PT - d, 100 + BLEED_PT - d, -BLEED_PT + d],
      [0, 100, 100, 0]
    );
    expect(result).toBe(false);
  });

  // Test 20: bleed 境界から epsilon を超えて内側のオブジェクト → true（WARNING）
  it("COORD-20: isOutsideBleedZone — bleed 境界から 0.15pt 内側は true（塗り足し不足）", () => {
    // item が四辺とも bleed 境界から 0.15pt 内側（epsilon=0.1 を超える） → 警告対象
    const d = 0.15;
    const result = isOutsideBleedZone(
      [-BLEED_PT + d, 100 + BLEED_PT - d, 100 + BLEED_PT - d, -BLEED_PT + d],
      [0, 100, 100, 0]
    );
    expect(result).toBe(true);
  });
});
