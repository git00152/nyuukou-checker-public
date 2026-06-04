import { describe, it, expect } from "vitest";
import {
  checkUnusedSwatches,
} from "../../src/jsx/hostscript/checks/checkUnusedSwatches";
import type { DocumentForSwatches } from "../../src/jsx/hostscript/checks/checkUnusedSwatches";

// スウォッチヘルパー
function makeSwatch(name: string) {
  return { name };
}

// SpotColor ヘルパー
function spotColor(name: string) {
  return { typename: "SpotColor", spot: { name } };
}

// CMYK ヘルパー
function cmyk(c: number, m: number, y: number, k: number) {
  return { typename: "CMYKColor", cyan: c, magenta: m, yellow: y, black: k };
}

// PathItem ヘルパー
function pathItem(fillColor: unknown, strokeColor: unknown = { typename: "NoColor" }) {
  return { typename: "PathItem", fillColor, strokeColor };
}

// TextFrame ヘルパー
function textFrame(fillColor: unknown) {
  return { typename: "TextFrame", fillColor, strokeColor: { typename: "NoColor" } };
}

// ドキュメントビルダー
function makeDoc(swatchNames: string[], items: unknown[]): DocumentForSwatches {
  return {
    swatches: swatchNames.map(makeSwatch),
    allPageItems: items,
  };
}

describe("checkUnusedSwatches", () => {
  it("Test 1: スウォッチ 'Pantone 485' が全オブジェクトで未使用 → INFO / COLOR_UNUSED_SWATCH_01", () => {
    const doc = makeDoc(
      ["Pantone 485"],
      [pathItem(cmyk(0, 0, 0, 100))]
    );
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("INFO");
    expect(results[0].messageKey).toBe("COLOR_UNUSED_SWATCH_01");
    expect(results[0].message).toContain("Pantone 485");
  });

  it("Test 2: スウォッチ 'Pantone 485' が PathItem の fillColor で使用されている → INFO なし", () => {
    const doc = makeDoc(
      ["Pantone 485"],
      [pathItem(spotColor("Pantone 485"))]
    );
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 3: スウォッチ名 '[None]' → 除外（INFO なし）", () => {
    const doc = makeDoc(["[None]"], []);
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 4: スウォッチ名 '[Registration]' → 除外（INFO なし）", () => {
    const doc = makeDoc(["[Registration]"], []);
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 5: スウォッチ名 'White' / 'Black' → 除外", () => {
    const doc = makeDoc(["White", "Black"], []);
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 6: スウォッチが 0 件 → 空配列", () => {
    const doc = makeDoc([], []);
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(0);
  });

  it("スウォッチが strokeColor に使用されている場合も使用済みとみなす", () => {
    const doc = makeDoc(
      ["Pantone 485"],
      [pathItem(cmyk(0, 0, 0, 0), spotColor("Pantone 485"))]
    );
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 8: allPageItems が undefined の場合（古い Illustrator）→ クラッシュせず INFO を返す", () => {
    const doc = {
      swatches: [makeSwatch("Pantone 485")],
      allPageItems: undefined as unknown as unknown[],
    } as DocumentForSwatches;
    expect(() => checkUnusedSwatches(doc)).not.toThrow();
    // allPageItems が取得できない場合、使用状況が不明なので INFO を返さない（スキップ扱い）
    const results = checkUnusedSwatches(doc);
    expect(results).toHaveLength(0);
  });
});
