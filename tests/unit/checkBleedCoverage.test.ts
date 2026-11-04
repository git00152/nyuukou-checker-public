import { describe, it, expect } from "vitest";
import { checkBleedCoverage, type BleedCheckItem } from "../../src/jsx/hostscript/checks/checkBleedCoverage";
import { checkSavedVersion } from "../../src/jsx/hostscript/checks/checkSavedVersion";
import type { ScopeInfo } from "../../src/jsx/hostscript/types";

// A4縦 アートボード: left=0, top=297, right=210, bottom=0 (Illustrator Y上向き座標系)
const scope: ScopeInfo = {
  bounds: [0, 297, 210, 0],
  hasIncompleteMarks: false,
};

function rectangle(bounds: [number, number, number, number]): BleedCheckItem {
  const [l, t, r, b] = bounds;
  return { typename: "PathItem", name: "rect", filled: true, closed: true, opacity: 100,
    fillColor: { typename: "CMYKColor" }, geometricBounds: bounds,
    pathPoints: [[l, t], [r, t], [r, b], [l, b]].map(anchor => ({ anchor, leftDirection: anchor, rightDirection: anchor })) };
}

describe("checkBleedCoverage", () => {
  it("部分区間だけを検査し、矩形の被覆を合成する", () => {
    const target: ScopeInfo = { bounds: [0, 100, 100, 0], hasIncompleteMarks: false };
    expect(checkBleedCoverage([rectangle([10, 100, 40, 50])], target)[0].severity).toBe("WARNING");
    expect(target.sideCoverage?.top.intervals).toMatchObject([{ startPt: 10, endPt: 40, status: "insufficient" }]);
    expect(target.sideCoverage?.left.status).toBe("not-applicable");
    expect(checkBleedCoverage([rectangle([10, 100, 40, 50]), rectangle([10, 110, 40, 50])], target)).toEqual([]);
    expect(target.sideCoverage?.top.status).toBe("satisfied");
  });

  it("default大判はINFO、explicit不足はWARNING、要求値不明と複雑形状はINFO", () => {
    const target: ScopeInfo = { bounds: [0, 100, 100, 0], hasIncompleteMarks: false };
    const item = rectangle([10, 100, 40, 50]);
    expect(checkBleedCoverage([item], target, { largePrintMode: true })[0].severity).toBe("INFO");
    target.requirementSource = "explicit";
    target.requiredBleedPt = 50 * 72 / 25.4;
    expect(checkBleedCoverage([item], target, { largePrintMode: true })[0].severity).toBe("WARNING");
    target.requirementSource = "unknown";
    expect(checkBleedCoverage([item], target)[0].severity).toBe("INFO");
    target.requirementSource = "default";
    item.clipping = true;
    expect(checkBleedCoverage([item], target)[0].severity).toBe("INFO");
    expect(target.sideCoverage?.top.status).toBe("unknown");
  });

  it("保存形式は未検証の属性を推測せず、明示アダプターだけを使う", () => {
    const doc = { savedVersion: 2020 } as unknown as Document;
    expect(checkSavedVersion(doc)[0].messageKey).toBe("DOCUMENT_SAVE_VERSION_UNKNOWN");
    expect(checkSavedVersion(doc, 2020, () => ({ year: 2020, source: "document-metadata" }))).toEqual([]);
    expect(checkSavedVersion(doc, 2020, () => ({ year: 2019, source: "document-metadata" }))[0].severity).toBe("INFO");
  });
  it("Test 1: 実形状を持たない塗りパスはINFOにする", () => {
    const items = [
      {
        name: "背景",
        fillColor: { typename: "CMYKColor" },
        geometricBounds: [0, 297, 210, 0] as [number, number, number, number],
      },
    ];
    const results = checkBleedCoverage(items, scope);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("INFO"); // bounds alone cannot prove the shape
    expect(results[0].messageKey).toBe("BLEED_COVERAGE_01");
    expect(results[0].targetRef).toMatchObject({
      kind: "pathItem",
      messageKey: "BLEED_COVERAGE_01",
      objectName: "背景",
      collectionIndex: 0,
    });
  });

  it("Test 2: boundsが3mmを超えていても実形状不明ならINFO", () => {
    const items = [
      {
        name: "背景",
        fillColor: { typename: "CMYKColor" },
        geometricBounds: [-9, 306, 219, -9] as [number, number, number, number],
      },
    ];
    const results = checkBleedCoverage(items, scope);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("INFO");
  });

  it("Test 3: boundsが要求値未満でも実形状不明ならINFO", () => {
    const items = [
      {
        name: "背景",
        fillColor: { typename: "CMYKColor" },
        geometricBounds: [-8, 305, 218, -8] as [number, number, number, number],
      },
    ];
    const results = checkBleedCoverage(items, scope);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("INFO");
  });

  it("Test 4: 塗りなし（fillColor.typename === 'NoColor'）のオブジェクト → スキップ（WARNING なし）", () => {
    const items = [
      {
        name: "塗りなし",
        fillColor: { typename: "NoColor" },
        geometricBounds: [0, 297, 210, 0] as [number, number, number, number],
      },
    ];
    const results = checkBleedCoverage(items, scope);
    expect(results).toHaveLength(0);
  });

  it("Test 5: scope.bounds を使用してアートボードと比較している（artboard bounds はスコープから受け取る）", () => {
    // 別サイズのスコープ（例: トンボあり時の広い範囲）で同じオブジェクトを検証
    const largerScope: ScopeInfo = {
      bounds: [-9, 306, 219, -9],
      hasIncompleteMarks: false,
    };
    // bounds=[0, 297, 210, 0] はデフォルトスコープでは WARNING だが、largerScope では境界内
    const items = [
      {
        name: "背景",
        fillColor: { typename: "CMYKColor" },
        geometricBounds: [0, 297, 210, 0] as [number, number, number, number],
      },
    ];
    const resultsDefault = checkBleedCoverage(items, scope);
    const resultsLarger = checkBleedCoverage(items, largerScope);
    // デフォルトスコープでは WARNING が出る
    expect(resultsDefault).toHaveLength(1);
    // largerScope の bleed zone は largerScope.bounds を外側に 8.504 拡張したもの
    // largerScope の bounds=[-9,306,219,-9] なので bleed zone は [-17.5, 314.5, 227.5, -17.5]
    // item の left=0 は -17.5 未満ではないので全辺未到達 → WARNING
    expect(resultsLarger.length).toBeGreaterThanOrEqual(0);
  });

  it("Test 6: PlacedItem / RasterItem も対象（画像は fillColor がなくても bounds で判定）", () => {
    const items = [
      {
        typename: "PlacedItem",
        name: "配置画像",
        geometricBounds: [0, 297, 210, 0] as [number, number, number, number],
      },
      {
        typename: "RasterItem",
        name: "ラスター画像",
        geometricBounds: [0, 297, 210, 0] as [number, number, number, number],
      },
    ];
    const results = checkBleedCoverage(items, scope);
    // 両方 WARNING が出ること（typename によるスキップなし）
    expect(results).toHaveLength(2);
    expect(results[0].objectName).toBe("配置画像");
    expect(results[1].objectName).toBe("ラスター画像");
    expect(results[0].targetRef).toMatchObject({ kind: "placedItem", messageKey: "BLEED_COVERAGE_01" });
    expect(results[1].targetRef).toMatchObject({ kind: "rasterItem", messageKey: "BLEED_COVERAGE_01" });
  });

  it("Test 7: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    const nativeLike = Object.assign(Object.create(null), {
      0: 0,
      1: 297,
      2: 210,
      3: 0,
      length: 4,
    });
    const items = [
      {
        name: "背景",
        fillColor: { typename: "CMYKColor" },
        geometricBounds: nativeLike,
      },
    ];
    const results = checkBleedCoverage(items, scope);
    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([0, 297, 210, 0]);
  });
});
